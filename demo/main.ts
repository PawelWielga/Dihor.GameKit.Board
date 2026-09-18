import {
  allowMovement,
  Board,
  BoardStateError,
  createExplicitSpaceLayout,
  createLinearSpaceLayout,
  createMovementEvents,
  createSquareGridSpaceLayout,
  GraphTopology,
  LinearTopology,
  MovementError,
  rejectMovement,
  SquareGridTopology,
  type MovementEvent,
  type MovementResult,
  type MovementRule,
  type SpaceId,
  type SpaceLayout,
  type Topology,
} from "@dihor/gamekit-board";
import { FlatBoard3DPiecesRenderer } from "@dihor/gamekit-board/three";

type TopologyKind = "linear" | "looping" | "grid" | "graph";
type DiagnosticView = "state" | "events";

interface DemoFailure {
  readonly code?: string;
  readonly reason?: string;
  readonly message: string;
}

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Demo element was not found: ${selector}`);
  }

  return element;
}

const topologyKindInput = requireElement<HTMLSelectElement>("#topology-kind");
const trackOptions = requireElement<HTMLElement>("#track-options");
const trackCountInput = requireElement<HTMLInputElement>("#track-count");
const gridOptions = requireElement<HTMLElement>("#grid-options");
const gridWidthInput = requireElement<HTMLInputElement>("#grid-width");
const gridHeightInput = requireElement<HTMLInputElement>("#grid-height");
const graphOptions = requireElement<HTMLElement>("#graph-options");
const graphSpacesInput = requireElement<HTMLTextAreaElement>("#graph-spaces");
const graphConnectionsInput = requireElement<HTMLTextAreaElement>("#graph-connections");
const rebuildButton = requireElement<HTMLButtonElement>("#rebuild-board");

const pieceIdInput = requireElement<HTMLInputElement>("#piece-id");
const pieceSpaceInput = requireElement<HTMLSelectElement>("#piece-space");
const addPieceButton = requireElement<HTMLButtonElement>("#add-piece");
const selectedPieceInput = requireElement<HTMLSelectElement>("#selected-piece");
const removePieceButton = requireElement<HTMLButtonElement>("#remove-piece");

const moveToSpaceInput = requireElement<HTMLSelectElement>("#move-to-space");
const moveToButton = requireElement<HTMLButtonElement>("#move-to");
const moveDistanceInput = requireElement<HTMLInputElement>("#move-distance");
const moveByButton = requireElement<HTMLButtonElement>("#move-by");
const moveByHint = requireElement<HTMLElement>("#move-by-hint");

const blockedSpaceInput = requireElement<HTMLInputElement>("#blocked-space");
const singleOccupancyInput = requireElement<HTMLInputElement>("#single-occupancy");

const boardTitle = requireElement<HTMLElement>("#board-title");
const statusElement = requireElement<HTMLElement>("#status");
const boardStage = requireElement<HTMLElement>("#board-stage");
const pathSummary = requireElement<HTMLElement>("#path-summary");
const pathChips = requireElement<HTMLElement>("#path-chips");
const diagnosticsJson = requireElement<HTMLElement>("#diagnostics-json");
const diagnosticTabs = [
  ...document.querySelectorAll<HTMLButtonElement>("[data-diagnostic]"),
];

let topologyKind: TopologyKind = "linear";
let topology!: Topology;
let board!: Board;
let lastMovement: MovementResult | undefined;
let lastEvents: readonly MovementEvent[] = [];
let lastFailure: DemoFailure | undefined;
let diagnosticView: DiagnosticView = "state";
let movementCounter = 0;
let animating = false;
let spaceElements = new Map<SpaceId, HTMLElement>();
let hybridCanvas: HTMLCanvasElement | undefined;
let usingHybridRenderer = false;

const hybridRenderer = new FlatBoard3DPiecesRenderer({
  pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
});

const blockedDestinationRule: MovementRule = ({ toSpace }) => {
  const blockedSpaceId = blockedSpaceInput.value.trim();

  if (blockedSpaceId.length > 0 && toSpace.id === blockedSpaceId) {
    return rejectMovement(
      "demo.blocked-destination",
      `Destination '${toSpace.id}' is blocked by the active demo rule.`,
    );
  }

  return allowMovement();
};

function readPositiveInteger(
  input: HTMLInputElement,
  label: string,
  maximum: number,
): number {
  const value = Number(input.value);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new RangeError(`${label} must be an integer between 1 and ${maximum}.`);
  }

  return value;
}

function readTopologyKind(): TopologyKind {
  const value = topologyKindInput.value;
  if (value === "linear" || value === "looping" || value === "grid" || value === "graph") {
    return value;
  }

  throw new Error(`Unknown topology type: ${value}`);
}

function parseGraphSpaceIds(): readonly SpaceId[] {
  const ids = graphSpacesInput.value
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (ids.length === 0) {
    throw new RangeError("Graph topology needs at least one space ID.");
  }

  return ids;
}

function createGraphTopology(): GraphTopology {
  const graph = new GraphTopology(parseGraphSpaceIds());
  const lines = graphConnectionsInput.value
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  for (const line of lines) {
    const match = /^(\S+)\s*(--|->)\s*(\S+)$/.exec(line);
    if (!match) {
      throw new RangeError(
        `Invalid graph connection '${line}'. Use 'a -- b' or 'a -> b'.`,
      );
    }

    const [, fromSpaceId, operator, toSpaceId] = match;
    if (!fromSpaceId || !toSpaceId) {
      throw new RangeError(`Invalid graph connection '${line}'.`);
    }

    graph.addConnection(fromSpaceId, toSpaceId, {
      directed: operator === "->",
    });
  }

  return graph;
}

function createTopology(): Topology {
  topologyKind = readTopologyKind();

  if (topologyKind === "linear" || topologyKind === "looping") {
    const count = readPositiveInteger(trackCountInput, "Track size", 40);
    const spaceIds = Array.from({ length: count }, (_, index) => `space-${index + 1}`);
    return new LinearTopology(spaceIds, {
      looping: topologyKind === "looping",
    });
  }

  if (topologyKind === "grid") {
    const width = readPositiveInteger(gridWidthInput, "Grid width", 12);
    const height = readPositiveInteger(gridHeightInput, "Grid height", 12);
    return new SquareGridTopology(width, height);
  }

  return createGraphTopology();
}

function rebuildBoard(): void {
  try {
    const nextTopology = createTopology();
    const nextBoard = new Board({
      topology: nextTopology,
      movementRules: [blockedDestinationRule],
      occupancyPolicy: ({ occupants }) =>
        !singleOccupancyInput.checked || occupants.length === 0,
    });

    for (const spaceId of nextTopology.getSpaceIds()) {
      nextBoard.addSpace({ id: spaceId });
    }

    topology = nextTopology;
    board = nextBoard;
    lastMovement = undefined;
    lastEvents = [];
    lastFailure = undefined;
    movementCounter = 0;

    syncControls();
    renderBoard();
    renderPath();
    renderDiagnostics();
    setStatus("Board rebuilt");
  } catch (error) {
    showFailure(error);
  }
}

function topologyLabel(): string {
  if (topologyKind === "linear") {
    return "Linear track";
  }

  if (topologyKind === "looping") {
    return "Looping track";
  }

  if (topologyKind === "grid") {
    const grid = topology as SquareGridTopology;
    return `Square grid · ${grid.width} × ${grid.height}`;
  }

  return "Arbitrary graph";
}

function selectedPieceId(): string | undefined {
  const value = selectedPieceInput.value.trim();
  return value.length > 0 ? value : undefined;
}

function populateSelect(
  select: HTMLSelectElement,
  values: readonly string[],
  preferredValue?: string,
  emptyLabel = "None",
): void {
  const previous = preferredValue ?? select.value;
  select.replaceChildren();

  if (values.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = emptyLabel;
    select.append(option);
    select.disabled = true;
    return;
  }

  select.disabled = false;

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }

  if (values.includes(previous)) {
    select.value = previous;
  }
}

function syncControls(preferredPieceId?: string): void {
  const spaceIds = topology.getSpaceIds();
  const pieceIds = board.getPieces().map((piece) => piece.id);

  populateSelect(pieceSpaceInput, spaceIds, pieceSpaceInput.value, "No spaces");
  populateSelect(moveToSpaceInput, spaceIds, moveToSpaceInput.value, "No spaces");
  populateSelect(
    selectedPieceInput,
    pieceIds,
    preferredPieceId ?? selectedPieceInput.value,
    "No pieces",
  );

  const canMove = pieceIds.length > 0 && spaceIds.length > 0 && !animating;
  moveToButton.disabled = !canMove;
  removePieceButton.disabled = pieceIds.length === 0 || animating;

  const ordered = topologyKind === "linear" || topologyKind === "looping";
  moveByButton.disabled = !canMove || !ordered;
  moveDistanceInput.disabled = !ordered || animating;
  moveByHint.textContent = ordered
    ? topologyKind === "looping"
      ? "Positive and negative distances wrap around the track."
      : "Positive and negative distances move along the ordered track."
    : "moveBy is available only for ordered topologies.";

  boardTitle.textContent = topologyLabel();
}

function createPresentationLayout(): SpaceLayout {
  if (topologyKind === "grid") {
    return createSquareGridSpaceLayout(topology as SquareGridTopology, {
      cellSize: 1.2,
    });
  }

  if (topologyKind === "linear") {
    return createLinearSpaceLayout(topology as LinearTopology, {
      spacing: 1.25,
    });
  }

  const spaceIds = topology.getSpaceIds();
  const radius = Math.max(2, spaceIds.length * 0.28);
  const positions: Record<string, { x: number; z: number }> = {};

  spaceIds.forEach((spaceId, index) => {
    const angle = spaceIds.length === 1
      ? 0
      : (Math.PI * 2 * index) / spaceIds.length - Math.PI / 2;

    positions[spaceId] = spaceIds.length === 1
      ? { x: 0, z: 0 }
      : {
          x: Math.cos(angle) * radius,
          z: Math.sin(angle) * radius,
        };
  });

  return createExplicitSpaceLayout(positions);
}

function createPieceToken(pieceId: string, selected: boolean): HTMLElement {
  const token = document.createElement("span");
  token.className = selected ? "piece-token is-selected" : "piece-token";
  token.textContent = pieceId;
  return token;
}

function createSpaceCard(spaceId: SpaceId): HTMLButtonElement {
  const selectedId = selectedPieceId();
  const occupants = board.getPiecesAt(spaceId);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "space-card";
  button.dataset.space = spaceId;
  button.title = `Use '${spaceId}' as moveTo destination`;

  if (occupants.length > 0) {
    button.classList.add("has-piece");
  }

  if (selectedId && occupants.some((piece) => piece.id === selectedId)) {
    button.classList.add("has-selected-piece");
  }

  if (lastMovement?.path.includes(spaceId)) {
    button.classList.add("is-in-path");
  }

  const id = document.createElement("span");
  id.className = "space-id";
  id.textContent = spaceId;
  button.append(id);

  const stack = document.createElement("span");
  stack.className = "piece-stack";

  if (occupants.length === 0) {
    const empty = document.createElement("span");
    empty.className = "empty-space";
    empty.textContent = "empty";
    stack.append(empty);
  } else {
    for (const piece of occupants) {
      stack.append(createPieceToken(piece.id, piece.id === selectedId));
    }
  }

  button.append(stack);
  button.addEventListener("click", () => {
    if (!moveToSpaceInput.disabled) {
      moveToSpaceInput.value = spaceId;
      setStatus(`Destination selected: ${spaceId}`);
    }
  });

  spaceElements.set(spaceId, button);
  return button;
}

function renderGraph(surface: HTMLElement): void {
  const spaceIds = topology.getSpaceIds();
  const positions = new Map<SpaceId, { x: number; y: number }>();
  const radiusX = 355;
  const radiusY = 220;
  const centerX = 500;
  const centerY = 300;

  spaceIds.forEach((spaceId, index) => {
    const angle = spaceIds.length === 1
      ? 0
      : (Math.PI * 2 * index) / spaceIds.length - Math.PI / 2;
    positions.set(spaceId, {
      x: spaceIds.length === 1 ? centerX : centerX + Math.cos(angle) * radiusX,
      y: spaceIds.length === 1 ? centerY : centerY + Math.sin(angle) * radiusY,
    });
  });

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("graph-lines");
  svg.setAttribute("viewBox", "0 0 1000 600");
  svg.setAttribute("aria-hidden", "true");

  const drawn = new Set<string>();
  for (const fromSpaceId of spaceIds) {
    for (const toSpaceId of topology.getNeighbors(fromSpaceId)) {
      const reverse = topology.getNeighbors(toSpaceId).includes(fromSpaceId);
      const edgeKey = reverse
        ? [fromSpaceId, toSpaceId].sort().join("\u0000")
        : `${fromSpaceId}->${toSpaceId}`;

      if (drawn.has(edgeKey)) {
        continue;
      }

      drawn.add(edgeKey);
      const from = positions.get(fromSpaceId);
      const to = positions.get(toSpaceId);
      if (!from || !to) {
        continue;
      }

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(from.x));
      line.setAttribute("y1", String(from.y));
      line.setAttribute("x2", String(to.x));
      line.setAttribute("y2", String(to.y));
      svg.append(line);
    }
  }

  surface.append(svg);

  for (const spaceId of spaceIds) {
    const position = positions.get(spaceId);
    if (!position) {
      continue;
    }

    const card = createSpaceCard(spaceId);
    card.style.left = `${position.x / 10}%`;
    card.style.top = `${position.y / 6}%`;
    surface.append(card);
  }
}

function tryRenderHybridBoard(): boolean {
  const canvas = document.createElement("canvas");
  canvas.className = "hybrid-canvas";
  canvas.setAttribute("aria-label", "Flat board with 3D pieces");
  boardStage.append(canvas);

  try {
    hybridRenderer.render(canvas, {
      snapshot: board.snapshot(),
      layout: createPresentationLayout(),
      ...(lastMovement ? { movement: lastMovement } : {}),
    });
    hybridCanvas = canvas;
    usingHybridRenderer = true;
    return true;
  } catch (error) {
    hybridRenderer.disposeTarget(canvas);
    canvas.remove();
    hybridCanvas = undefined;
    usingHybridRenderer = false;
    console.warn(
      "Hybrid WebGL renderer unavailable; using HTML/SVG fallback.",
      error,
    );
    return false;
  }
}

function renderBoard(): void {
  spaceElements = new Map();
  boardStage.replaceChildren();
  hybridCanvas = undefined;
  usingHybridRenderer = false;

  if (tryRenderHybridBoard()) {
    return;
  }

  const surface = document.createElement("div");
  surface.className = "board-surface";

  if (topologyKind === "grid") {
    surface.classList.add("board-surface--grid");
    surface.style.setProperty(
      "--grid-columns",
      String((topology as SquareGridTopology).width),
    );

    for (const spaceId of topology.getSpaceIds()) {
      surface.append(createSpaceCard(spaceId));
    }
  } else if (topologyKind === "graph") {
    surface.classList.add("board-surface--graph");
    renderGraph(surface);
  } else {
    surface.classList.add("board-surface--track");
    if (topologyKind === "looping") {
      surface.classList.add("board-surface--looping");
    }

    for (const spaceId of topology.getSpaceIds()) {
      surface.append(createSpaceCard(spaceId));
    }
  }

  boardStage.append(surface);
}

function renderPath(): void {
  pathChips.replaceChildren();

  if (!lastMovement) {
    pathSummary.textContent = "No movement yet.";
    return;
  }

  pathSummary.textContent =
    `${lastMovement.pieceId}: ${lastMovement.fromSpaceId} → ${lastMovement.toSpaceId} · ` +
    `${Math.max(0, lastMovement.path.length - 1)} step(s)`;

  lastMovement.path.forEach((spaceId, index) => {
    if (index > 0) {
      const arrow = document.createElement("span");
      arrow.className = "path-arrow";
      arrow.textContent = "→";
      pathChips.append(arrow);
    }

    const chip = document.createElement("span");
    chip.className = "path-chip";
    chip.textContent = spaceId;
    pathChips.append(chip);
  });
}

function currentStateDiagnostics(): unknown {
  const spaceIds = topology.getSpaceIds();
  const snapshot = board.snapshot();

  return {
    topology: {
      kind: topologyKind,
      spaces: spaceIds.map((spaceId) => ({
        id: spaceId,
        neighbors: topology.getNeighbors(spaceId),
      })),
    },
    snapshot,
    occupancy: Object.fromEntries(
      spaceIds.map((spaceId) => [
        spaceId,
        board.getPiecesAt(spaceId).map((piece) => piece.id),
      ]),
    ),
    renderer: {
      preferred: "flat-board-3d-pieces",
      active: usingHybridRenderer ? "flat-board-3d-pieces" : "html-svg-fallback",
    },
    activeRules: {
      movement: [
        {
          id: "demo.blocked-destination",
          blockedSpaceId: blockedSpaceInput.value.trim() || null,
        },
      ],
      occupancy: {
        id: "demo.single-occupancy",
        enabled: singleOccupancyInput.checked,
      },
    },
    lastMovement: lastMovement ?? null,
    lastRejectedAttempt: lastFailure ?? null,
  };
}

function renderDiagnostics(): void {
  const value = diagnosticView === "events"
    ? {
        schema: "Dihor.GameKit.Board movement event stream",
        events: lastEvents,
      }
    : currentStateDiagnostics();

  diagnosticsJson.textContent = JSON.stringify(value, null, 2);

  for (const tab of diagnosticTabs) {
    tab.classList.toggle("is-active", tab.dataset.diagnostic === diagnosticView);
  }
}

function setStatus(
  message: string,
  tone: "ok" | "busy" | "error" = "ok",
): void {
  statusElement.textContent = message;
  statusElement.dataset.tone = tone;
  statusElement.title = message;
}

function failureInfo(error: unknown): DemoFailure {
  if (error instanceof MovementError) {
    return {
      code: error.code,
      ...(error.reason ? { reason: error.reason } : {}),
      message: error.message,
    };
  }

  if (error instanceof BoardStateError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: String(error) };
}

function showFailure(error: unknown): void {
  lastFailure = failureInfo(error);
  setStatus(
    [lastFailure.code, lastFailure.reason, lastFailure.message]
      .filter(Boolean)
      .join(" · "),
    "error",
  );
  renderDiagnostics();
}

function setAnimating(value: boolean): void {
  animating = value;
  rebuildButton.disabled = value;
  addPieceButton.disabled = value;
  blockedSpaceInput.disabled = value;
  singleOccupancyInput.disabled = value;
  syncControls();
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function animateMovement(result: MovementResult): Promise<void> {
  setAnimating(true);

  try {
    if (usingHybridRenderer && hybridCanvas) {
      setStatus(
        `Animating 3D piece along ${Math.max(0, result.path.length - 1)} authoritative step(s)`,
        "busy",
      );

      await hybridRenderer.animateMovement(
        hybridCanvas,
        {
          snapshot: board.snapshot(),
          layout: createPresentationLayout(),
          movement: result,
        },
        result,
        {
          durationPerStepMs: result.path.length > 12 ? 110 : 220,
        },
      );

      setStatus(`Move complete: ${result.toSpaceId}`);
      return;
    }

    let previous: HTMLElement | undefined;

    for (let index = 0; index < result.path.length; index += 1) {
      const spaceId = result.path[index];
      if (spaceId === undefined) {
        continue;
      }

      previous?.classList.remove("is-current-step");
      const current = spaceElements.get(spaceId);
      current?.classList.add("is-current-step");
      previous = current;

      setStatus(
        `Animating authoritative path · ${index + 1}/${result.path.length} · ${spaceId}`,
        "busy",
      );
      await sleep(result.path.length > 12 ? 90 : 180);
    }

    previous?.classList.remove("is-current-step");
    setStatus(`Move complete: ${result.toSpaceId}`);
  } finally {
    setAnimating(false);
  }
}

async function runMovement(
  operation: () => MovementResult,
): Promise<void> {
  if (animating) {
    return;
  }

  try {
    const result = operation();
    movementCounter += 1;
    lastMovement = result;
    lastEvents = createMovementEvents(result, {
      movementId: `demo-move-${movementCounter}`,
    });
    lastFailure = undefined;

    syncControls(result.pieceId);
    renderBoard();
    renderPath();
    renderDiagnostics();
    await animateMovement(result);
    renderBoard();
  } catch (error) {
    showFailure(error);
  }
}

function addPiece(): void {
  try {
    const pieceId = pieceIdInput.value.trim();
    if (pieceId.length === 0) {
      throw new RangeError("Piece ID cannot be empty.");
    }

    const spaceId = pieceSpaceInput.value;
    board.addPiece({ id: pieceId }, spaceId);
    lastFailure = undefined;

    syncControls(pieceId);
    renderBoard();
    renderDiagnostics();
    setStatus(`Added '${pieceId}' on '${spaceId}'`);

    const numericSuffix = /^(.*?)(\d+)$/.exec(pieceId);
    pieceIdInput.value = numericSuffix
      ? `${numericSuffix[1]}${Number(numericSuffix[2]) + 1}`
      : `${pieceId}-2`;
  } catch (error) {
    showFailure(error);
  }
}

function removeSelectedPiece(): void {
  try {
    const pieceId = selectedPieceId();
    if (!pieceId) {
      throw new RangeError("Select a piece first.");
    }

    board.removePiece(pieceId);
    lastFailure = undefined;
    syncControls();
    renderBoard();
    renderDiagnostics();
    setStatus(`Removed '${pieceId}'`);
  } catch (error) {
    showFailure(error);
  }
}

function updateTopologyOptions(): void {
  const kind = readTopologyKind();
  trackOptions.hidden = kind !== "linear" && kind !== "looping";
  gridOptions.hidden = kind !== "grid";
  graphOptions.hidden = kind !== "graph";
}

topologyKindInput.addEventListener("change", updateTopologyOptions);
rebuildButton.addEventListener("click", rebuildBoard);
addPieceButton.addEventListener("click", addPiece);
removePieceButton.addEventListener("click", removeSelectedPiece);

selectedPieceInput.addEventListener("change", () => {
  renderBoard();
  renderDiagnostics();
});

moveToButton.addEventListener("click", () => {
  const pieceId = selectedPieceId();
  if (!pieceId) {
    showFailure(new RangeError("Select a piece first."));
    return;
  }

  const toSpaceId = moveToSpaceInput.value;
  void runMovement(() => board.moveTo(pieceId, toSpaceId));
});

moveByButton.addEventListener("click", () => {
  const pieceId = selectedPieceId();
  if (!pieceId) {
    showFailure(new RangeError("Select a piece first."));
    return;
  }

  const distance = Number(moveDistanceInput.value);
  void runMovement(() => board.moveBy(pieceId, distance));
});

for (const input of [blockedSpaceInput, singleOccupancyInput]) {
  input.addEventListener("input", renderDiagnostics);
  input.addEventListener("change", renderDiagnostics);
}

for (const tab of diagnosticTabs) {
  tab.addEventListener("click", () => {
    diagnosticView = tab.dataset.diagnostic === "events" ? "events" : "state";
    renderDiagnostics();
  });
}

function rerenderHybridAfterResize(): void {
  if (!usingHybridRenderer || !hybridCanvas || animating) {
    return;
  }

  try {
    hybridRenderer.render(hybridCanvas, {
      snapshot: board.snapshot(),
      layout: createPresentationLayout(),
      ...(lastMovement ? { movement: lastMovement } : {}),
    });
  } catch (error) {
    console.warn("Hybrid renderer resize failed; rebuilding fallback.", error);
    renderBoard();
  }
}

const resizeObserver = typeof ResizeObserver === "undefined"
  ? undefined
  : new ResizeObserver(rerenderHybridAfterResize);
resizeObserver?.observe(boardStage);
window.addEventListener("resize", rerenderHybridAfterResize);

window.addEventListener(
  "pagehide",
  () => {
    resizeObserver?.disconnect();
    window.removeEventListener("resize", rerenderHybridAfterResize);
    hybridRenderer.dispose();
  },
  { once: true },
);

updateTopologyOptions();
rebuildBoard();

const initialSpaceId = topology.getSpaceIds()[0];
if (initialSpaceId) {
  board.addPiece({ id: "player-1" }, initialSpaceId);
  pieceIdInput.value = "player-2";
  syncControls("player-1");
  renderBoard();
  renderDiagnostics();
  setStatus(`Ready · player-1 starts on ${initialSpaceId}`);
}
