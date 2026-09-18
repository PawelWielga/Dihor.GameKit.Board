import {
  allowMovement,
  Board,
  BoardRenderMode,
  BoardStateError,
  createExplicitSpaceLayout,
  createLinearSpaceLayout,
  createMovementEvents,
  createSquareGridSpaceLayout,
  GraphTopology,
  LinearTopology,
  MovementError,
  rejectMovement,
  resolvePieceAppearance,
  resolveSpaceAppearance,
  SquareGridTopology,
  type BoardAppearanceConfig,
  type BoardAppearanceTheme,
  type MovementEvent,
  type MovementResult,
  type MovementRule,
  type SpaceId,
  type SpaceLayout,
  type Topology,
} from "@dihor/gamekit-board";
import {
  FlatBoard3DPiecesRenderer,
  Full3DRenderer,
  type Full3DCameraOptions,
  type ThreeBoardAssetProvider,
} from "@dihor/gamekit-board/three";
import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";

type TopologyKind = "linear" | "looping" | "grid" | "graph";
type DiagnosticView = "state" | "events";
type AppearanceThemeKind = "midnight" | "arcade";

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

const renderModeInput = requireElement<HTMLSelectElement>("#render-mode");
const appearanceThemeInput = requireElement<HTMLSelectElement>("#appearance-theme");
const full3dControls = requireElement<HTMLElement>("#full3d-controls");
const cameraProjectionInput = requireElement<HTMLSelectElement>("#camera-projection");
const cameraPositionX = requireElement<HTMLInputElement>("#camera-position-x");
const cameraPositionY = requireElement<HTMLInputElement>("#camera-position-y");
const cameraPositionZ = requireElement<HTMLInputElement>("#camera-position-z");
const cameraTargetX = requireElement<HTMLInputElement>("#camera-target-x");
const cameraTargetY = requireElement<HTMLInputElement>("#camera-target-y");
const cameraTargetZ = requireElement<HTMLInputElement>("#camera-target-z");
const cameraZoomInput = requireElement<HTMLInputElement>("#camera-zoom");
const resetCameraButton = requireElement<HTMLButtonElement>("#reset-camera");

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
let full3dCanvas: HTMLCanvasElement | undefined;
let usingHybridRenderer = false;
let usingFull3DRenderer = false;
let selectedRenderMode: BoardRenderMode = BoardRenderMode.FlatBoard3DPieces;
let activeAppearance: BoardAppearanceConfig = {};

const DEMO_THEMES: Readonly<Record<AppearanceThemeKind, BoardAppearanceTheme>> = {
  midnight: {
    name: "Midnight",
    spaceDefault: {
      color: "#172235",
      opacity: 1,
      variants: {
        occupied: { color: "#243653" },
        blocked: { color: "#5f2832" },
        highlighted: { color: "#3f3b85" },
        selected: { color: "#315a73" },
      },
    },
    pieceDefault: {
      color: "#5e7fe8",
      variants: {
        highlighted: { color: "#a98cff" },
        selected: { scale: 1.12 },
        active: { color: "#7c9cff", scale: 1.16 },
      },
    },
    spaceStyles: {
      accent: {
        color: "#165d63",
        icon: "★",
        label: { color: "#ecfeff" },
      },
      secondary: {
        color: "#5b3d22",
        icon: "◆",
        label: { color: "#fff7ed" },
      },
    },
  },
  arcade: {
    name: "Arcade",
    spaceDefault: {
      color: "#54216f",
      opacity: 1,
      variants: {
        occupied: { color: "#7b2f91" },
        blocked: { color: "#8d2739" },
        highlighted: { color: "#9a4b10" },
        selected: { color: "#116466" },
      },
    },
    pieceDefault: {
      color: "#20c997",
      variants: {
        highlighted: { color: "#f59f00" },
        selected: { scale: 1.18 },
        active: { color: "#ff6b9a", scale: 1.2 },
      },
    },
    spaceStyles: {
      accent: {
        color: "#007f73",
        icon: "✦",
        label: { color: "#e6fffb" },
      },
      secondary: {
        color: "#ad5f00",
        icon: "⬢",
        label: { color: "#fff4e6" },
      },
    },
  },
};

function createDemoCustomPiece(): Group {
  const group = new Group();
  const material = new MeshStandardMaterial({
    color: "#6ee7ff",
    roughness: 0.28,
    metalness: 0.34,
  });

  const base = new Mesh(
    new CylinderGeometry(0.24, 0.3, 0.2, 24),
    material,
  );
  base.position.y = 0.1;
  group.add(base);

  const body = new Mesh(
    new ConeGeometry(0.26, 0.72, 24),
    material,
  );
  body.position.y = 0.54;
  group.add(body);

  return group;
}

const demoAssetProvider: ThreeBoardAssetProvider = {
  async load(request) {
    await Promise.resolve();

    if (request.key === "demo.custom-piece") {
      return {
        resource: {
          type: "piece-visual",
          create: () => createDemoCustomPiece(),
        },
      };
    }

    if (request.key === "demo.glossy-material") {
      const material = new MeshStandardMaterial({
        color: "#ffb347",
        roughness: 0.18,
        metalness: 0.52,
      });

      return {
        resource: {
          type: "material",
          material,
        },
        dispose: () => material.dispose(),
      };
    }

    return undefined;
  },
};

const hybridRenderer = new FlatBoard3DPiecesRenderer({
  pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  assetProvider: demoAssetProvider,
});
const full3dRenderer = new Full3DRenderer({
  pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  assetProvider: demoAssetProvider,
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

function readOptionalVector(
  xInput: HTMLInputElement,
  yInput: HTMLInputElement,
  zInput: HTMLInputElement,
  label: string,
): { x: number; y: number; z: number } | undefined {
  const values = [xInput.value.trim(), yInput.value.trim(), zInput.value.trim()];
  if (values.every((value) => value.length === 0)) {
    return undefined;
  }

  if (values.some((value) => value.length === 0)) {
    throw new RangeError(`${label} requires X, Y and Z or all three fields left blank.`);
  }

  const [x, y, z] = values.map(Number);
  if (![x, y, z].every(Number.isFinite)) {
    throw new RangeError(`${label} values must be finite numbers.`);
  }

  return { x: x!, y: y!, z: z! };
}

function readFull3DCameraOptions(): Full3DCameraOptions {
  const projection = cameraProjectionInput.value;
  if (projection !== "perspective" && projection !== "orthographic") {
    throw new RangeError(`Unknown camera projection '${projection}'.`);
  }

  const zoom = Number(cameraZoomInput.value);
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new RangeError("Camera zoom must be greater than zero.");
  }

  const position = readOptionalVector(
    cameraPositionX,
    cameraPositionY,
    cameraPositionZ,
    "Camera position",
  );
  const target = readOptionalVector(
    cameraTargetX,
    cameraTargetY,
    cameraTargetZ,
    "Camera target",
  );

  return {
    projection,
    zoom,
    ...(position ? { position } : {}),
    ...(target ? { target } : {}),
  };
}

function readRenderMode(): BoardRenderMode {
  const value = renderModeInput.value;
  if (
    value === BoardRenderMode.TopDown ||
    value === BoardRenderMode.FlatBoard3DPieces ||
    value === BoardRenderMode.Full3D
  ) {
    return value;
  }

  throw new RangeError(`Unknown render mode '${value}'.`);
}

function readAppearanceTheme(): AppearanceThemeKind {
  const value = appearanceThemeInput.value;
  if (value === "midnight" || value === "arcade") {
    return value;
  }

  throw new RangeError(`Unknown appearance theme '${value}'.`);
}

function syncPresentationControls(): void {
  full3dControls.hidden = selectedRenderMode !== BoardRenderMode.Full3D;
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

function createDemoAppearanceConfig(): BoardAppearanceConfig {
  const snapshot = board.snapshot();
  const spaceIds = topology.getSpaceIds();
  const pieceIds = snapshot.pieces.map((piece) => piece.id);
  const selectedPiece = selectedPieceId();
  const highlightedSpaces = new Set(lastMovement?.path ?? []);
  const occupiedSpaces = new Set(
    snapshot.placements.map((placement) => placement.spaceId),
  );
  const blockedSpace = blockedSpaceInput.value.trim();
  const selectedDestination = moveToSpaceInput.value;

  const spaces = Object.fromEntries(
    spaceIds.map((spaceId, index) => {
      if (index === 0) {
        return [
          spaceId,
          {
            style: "accent",
            appearance: {
              label: { text: "START" },
            },
          },
        ];
      }

      if (index === 1) {
        return [
          spaceId,
          {
            style: "secondary",
            appearance: {
              label: { text: spaceId },
            },
          },
        ];
      }

      if (index === 2) {
        return [
          spaceId,
          {
            appearance: {
              color: readAppearanceTheme() === "arcade"
                ? "#224f9a"
                : "#263f67",
              icon: "•",
            },
          },
        ];
      }

      return [spaceId, {}];
    }),
  );

  const pieces = Object.fromEntries(
    pieceIds.map((pieceId, index) => {
      if (index === 0) {
        return [
          pieceId,
          {
            appearance: {
              assetKey: "demo.custom-piece",
              color: "#6ee7ff",
              icon: "▲",
              scale: 1.12,
              rotation: 0.12,
              label: { text: pieceId },
            },
          },
        ];
      }

      if (index === 1) {
        return [
          pieceId,
          {
            appearance: {
              assetKey: "demo.missing-piece",
              material: "demo.glossy-material",
              color: "#ffb347",
              icon: "●",
              scale: 0.98,
              label: { text: pieceId },
            },
          },
        ];
      }

      return [
        pieceId,
        {
          appearance: {
            color: index % 2 === 0 ? "#f472b6" : "#67e8f9",
            icon: "◆",
            label: { text: pieceId },
          },
        },
      ];
    }),
  );

  const spaceStates = Object.fromEntries(
    spaceIds.map((spaceId) => [
      spaceId,
      {
        occupied: occupiedSpaces.has(spaceId),
        blocked: blockedSpace.length > 0 && blockedSpace === spaceId,
        highlighted: highlightedSpaces.has(spaceId),
        selected: selectedDestination === spaceId,
      },
    ]),
  );

  const pieceStates = Object.fromEntries(
    pieceIds.map((pieceId) => [
      pieceId,
      {
        selected: pieceId === selectedPiece,
        active: pieceId === selectedPiece,
        highlighted: pieceId === lastMovement?.pieceId,
      },
    ]),
  );

  return {
    theme: DEMO_THEMES[readAppearanceTheme()],
    spaces,
    pieces,
    spaceStates,
    pieceStates,
  };
}

function createPieceToken(pieceId: string, selected: boolean): HTMLElement {
  const token = document.createElement("span");
  token.className = selected ? "piece-token is-selected" : "piece-token";

  const piece = board.snapshot().pieces.find((candidate) => candidate.id === pieceId) ??
    { id: pieceId };
  const appearance = resolvePieceAppearance(piece, activeAppearance);
  const scale = typeof appearance.scale === "number"
    ? appearance.scale
    : appearance.scale?.x ?? 1;
  const rotation = typeof appearance.rotation === "number"
    ? appearance.rotation
    : appearance.rotation?.z ?? appearance.rotation?.y ?? 0;
  const offsetX = (appearance.offset?.x ?? 0) * 8;
  const offsetY = -(appearance.offset?.z ?? 0) * 8;

  if (appearance.color) {
    token.style.background = appearance.color;
  }
  if (appearance.label?.color) {
    token.style.color = appearance.label.color;
  }
  token.style.opacity = String(appearance.opacity ?? 1);
  token.style.transform =
    `translate(${offsetX}px, ${offsetY}px) scale(${scale}) rotate(${rotation}rad)`;

  const label = appearance.label?.text ?? pieceId;
  token.textContent = appearance.icon
    ? `${appearance.icon} ${label}`
    : label;
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

  const domainSpace = board.snapshot().spaces.find(
    (candidate) => candidate.id === spaceId,
  ) ?? { id: spaceId };
  const appearance = resolveSpaceAppearance(domainSpace, activeAppearance);
  if (appearance.color) {
    button.style.background = appearance.color;
  }
  if (appearance.label?.color) {
    button.style.color = appearance.label.color;
  }
  button.style.opacity = String(appearance.opacity ?? 1);

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
  const spaceLabel = appearance.label?.text ?? spaceId;
  id.textContent = appearance.icon
    ? `${appearance.icon} ${spaceLabel}`
    : spaceLabel;
  if (appearance.label?.color) {
    id.style.color = appearance.label.color;
  }
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
      appearance: activeAppearance,
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

function tryRenderFull3DBoard(): boolean {
  const canvas = document.createElement("canvas");
  canvas.className = "hybrid-canvas";
  canvas.setAttribute("aria-label", "Full 3D board and pieces");
  boardStage.append(canvas);

  try {
    full3dRenderer.setCameraOptions(readFull3DCameraOptions());
    full3dRenderer.render(canvas, {
      snapshot: board.snapshot(),
      layout: createPresentationLayout(),
      appearance: activeAppearance,
      ...(lastMovement ? { movement: lastMovement } : {}),
    });
    full3dCanvas = canvas;
    usingFull3DRenderer = true;
    return true;
  } catch (error) {
    full3dRenderer.disposeTarget(canvas);
    canvas.remove();
    full3dCanvas = undefined;
    usingFull3DRenderer = false;
    console.warn(
      "Full3D WebGL renderer unavailable; using TopDown fallback.",
      error,
    );
    return false;
  }
}

function renderBoard(): void {
  activeAppearance = createDemoAppearanceConfig();
  spaceElements = new Map();
  boardStage.replaceChildren();
  hybridCanvas = undefined;
  full3dCanvas = undefined;
  usingHybridRenderer = false;
  usingFull3DRenderer = false;

  if (
    selectedRenderMode === BoardRenderMode.FlatBoard3DPieces &&
    tryRenderHybridBoard()
  ) {
    return;
  }

  if (
    selectedRenderMode === BoardRenderMode.Full3D &&
    tryRenderFull3DBoard()
  ) {
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
    appearance: {
      theme: activeAppearance.theme?.name ?? null,
      spaces: snapshot.spaces.map((space) => {
        const appearance = resolveSpaceAppearance(space, activeAppearance);
        return {
          id: space.id,
          color: appearance.color ?? null,
          icon: appearance.icon ?? null,
          texture: appearance.texture ?? null,
          material: appearance.material ?? null,
          assetKey: appearance.assetKey ?? null,
          state: activeAppearance.spaceStates?.[space.id] ?? null,
        };
      }),
      pieces: snapshot.pieces.map((piece) => {
        const appearance = resolvePieceAppearance(piece, activeAppearance);
        return {
          id: piece.id,
          color: appearance.color ?? null,
          icon: appearance.icon ?? null,
          texture: appearance.texture ?? null,
          material: appearance.material ?? null,
          assetKey: appearance.assetKey ?? null,
          state: activeAppearance.pieceStates?.[piece.id] ?? null,
        };
      }),
    },
    renderer: {
      preferred: BoardRenderMode.FlatBoard3DPieces,
      selected: selectedRenderMode,
      active: usingFull3DRenderer
        ? BoardRenderMode.Full3D
        : usingHybridRenderer
          ? BoardRenderMode.FlatBoard3DPieces
          : BoardRenderMode.TopDown,
      camera: selectedRenderMode === BoardRenderMode.Full3D
        ? full3dRenderer.getCameraOptions()
        : null,
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
  appearanceThemeInput.disabled = value;
  syncControls();
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function animateMovement(result: MovementResult): Promise<void> {
  setAnimating(true);

  try {
    if (usingFull3DRenderer && full3dCanvas) {
      setStatus(
        `Animating Full3D piece along ${Math.max(0, result.path.length - 1)} authoritative step(s)`,
        "busy",
      );

      await full3dRenderer.animateMovement(
        full3dCanvas,
        {
          snapshot: board.snapshot(),
          layout: createPresentationLayout(),
          movement: result,
          appearance: activeAppearance,
        },
        result,
        {
          durationPerStepMs: result.path.length > 12 ? 110 : 220,
        },
      );

      setStatus(`Move complete: ${result.toSpaceId}`);
      return;
    }

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
          appearance: activeAppearance,
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

renderModeInput.addEventListener("change", () => {
  try {
    selectedRenderMode = readRenderMode();
    syncPresentationControls();
    renderBoard();
    renderDiagnostics();
    setStatus(`Render mode: ${selectedRenderMode}`);
  } catch (error) {
    showFailure(error);
  }
});

appearanceThemeInput.addEventListener("change", () => {
  try {
    const snapshotBefore = board.snapshot();
    activeAppearance = createDemoAppearanceConfig();
    renderBoard();
    renderDiagnostics();

    if (JSON.stringify(board.snapshot()) !== JSON.stringify(snapshotBefore)) {
      throw new Error("Appearance theme changed logical board state.");
    }

    setStatus(`Appearance theme: ${activeAppearance.theme?.name ?? "default"}`);
  } catch (error) {
    showFailure(error);
  }
});

for (const input of [
  cameraProjectionInput,
  cameraPositionX,
  cameraPositionY,
  cameraPositionZ,
  cameraTargetX,
  cameraTargetY,
  cameraTargetZ,
  cameraZoomInput,
]) {
  input.addEventListener("change", () => {
    if (selectedRenderMode !== BoardRenderMode.Full3D || animating) {
      return;
    }

    try {
      full3dRenderer.setCameraOptions(readFull3DCameraOptions());
      renderBoard();
      renderDiagnostics();
      setStatus("Full3D camera updated");
    } catch (error) {
      showFailure(error);
    }
  });
}

resetCameraButton.addEventListener("click", () => {
  cameraProjectionInput.value = "perspective";
  cameraPositionX.value = "";
  cameraPositionY.value = "";
  cameraPositionZ.value = "";
  cameraTargetX.value = "";
  cameraTargetY.value = "";
  cameraTargetZ.value = "";
  cameraZoomInput.value = "1";

  if (selectedRenderMode === BoardRenderMode.Full3D) {
    full3dRenderer.setCameraOptions(readFull3DCameraOptions());
    renderBoard();
    renderDiagnostics();
    setStatus("Full3D camera reset to auto");
  }
});

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

blockedSpaceInput.addEventListener("input", () => {
  renderBoard();
  renderDiagnostics();
});
blockedSpaceInput.addEventListener("change", () => {
  renderBoard();
  renderDiagnostics();
});
singleOccupancyInput.addEventListener("input", renderDiagnostics);
singleOccupancyInput.addEventListener("change", renderDiagnostics);

moveToSpaceInput.addEventListener("change", () => {
  renderBoard();
  renderDiagnostics();
});

for (const tab of diagnosticTabs) {
  tab.addEventListener("click", () => {
    diagnosticView = tab.dataset.diagnostic === "events" ? "events" : "state";
    renderDiagnostics();
  });
}

function rerenderActiveRendererAfterResize(): void {
  if (animating) {
    return;
  }

  try {
    if (usingFull3DRenderer && full3dCanvas) {
      full3dRenderer.setCameraOptions(readFull3DCameraOptions());
      full3dRenderer.render(full3dCanvas, {
        snapshot: board.snapshot(),
        layout: createPresentationLayout(),
        appearance: activeAppearance,
        ...(lastMovement ? { movement: lastMovement } : {}),
      });
      return;
    }

    if (usingHybridRenderer && hybridCanvas) {
      hybridRenderer.render(hybridCanvas, {
        snapshot: board.snapshot(),
        layout: createPresentationLayout(),
        appearance: activeAppearance,
        ...(lastMovement ? { movement: lastMovement } : {}),
      });
    }
  } catch (error) {
    console.warn("Active WebGL renderer resize failed; rebuilding fallback.", error);
    renderBoard();
  }
}

const resizeObserver = typeof ResizeObserver === "undefined"
  ? undefined
  : new ResizeObserver(rerenderActiveRendererAfterResize);
resizeObserver?.observe(boardStage);
window.addEventListener("resize", rerenderActiveRendererAfterResize);

window.addEventListener(
  "pagehide",
  () => {
    resizeObserver?.disconnect();
    window.removeEventListener("resize", rerenderActiveRendererAfterResize);
    hybridRenderer.dispose();
    full3dRenderer.dispose();
  },
  { once: true },
);

selectedRenderMode = readRenderMode();
syncPresentationControls();
updateTopologyOptions();
rebuildBoard();

const initialSpaceIds = topology.getSpaceIds();
const initialSpaceId = initialSpaceIds[0];
if (initialSpaceId) {
  board.addPiece({ id: "player-1" }, initialSpaceId);

  const secondSpaceId = initialSpaceIds[1];
  if (secondSpaceId) {
    board.addPiece({ id: "player-2" }, secondSpaceId);
  }

  pieceIdInput.value = secondSpaceId ? "player-3" : "player-2";
  syncControls("player-1");
  renderBoard();
  renderDiagnostics();
  setStatus(
    secondSpaceId
      ? `Ready · custom player-1 and fallback player-2 are visible`
      : `Ready · player-1 starts on ${initialSpaceId}`,
  );
}
