import {
  AmbientLight,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Camera } from "three";
import type { PieceId, SpaceId } from "../core/index.js";
import type { MovementResult } from "../movement/index.js";
import {
  BoardRenderMode,
  mapPiecesToPresentation,
} from "../presentation/index.js";
import type {
  BoardRenderInput,
  BoardRenderer,
} from "../presentation/index.js";
import { estimateHybridTileSize } from "./hybridProjection.js";
import {
  resolveFull3DCameraOptions,
} from "./full3dCamera.js";
import type {
  Full3DCameraOptions,
  ResolvedFull3DCameraOptions,
} from "./full3dCamera.js";

export interface Full3DRendererOptions {
  readonly background?: string | number;
  readonly boardColor?: string | number;
  readonly pathColor?: string | number;
  readonly pieceHeight?: number;
  readonly pieceRadius?: number;
  readonly shadows?: boolean;
  readonly pixelRatio?: number;
  readonly camera?: Full3DCameraOptions;
}

export interface Full3DMovementAnimationOptions {
  readonly durationPerStepMs?: number;
}

interface Full3DContext {
  readonly renderer: WebGLRenderer;
  scene: Scene;
  camera: Camera;
  readonly pieceGroups: Map<PieceId, Group>;
  readonly pointBySpace: Map<SpaceId, Vector3>;
  animationToken: number;
}

export class Full3DRenderer implements BoardRenderer<HTMLCanvasElement> {
  public readonly mode = BoardRenderMode.Full3D;

  readonly #options: Omit<Required<Full3DRendererOptions>, "camera">;
  #cameraOptions: Full3DCameraOptions;
  readonly #contexts = new Map<HTMLCanvasElement, Full3DContext>();

  public constructor(options: Full3DRendererOptions = {}) {
    this.#options = {
      background: options.background ?? "#0b111a",
      boardColor: options.boardColor ?? "#1b2940",
      pathColor: options.pathColor ?? "#4f5fb9",
      pieceHeight: positive(options.pieceHeight ?? 0.72, "pieceHeight"),
      pieceRadius: positive(options.pieceRadius ?? 0.22, "pieceRadius"),
      shadows: options.shadows ?? true,
      pixelRatio: positive(options.pixelRatio ?? 1, "pixelRatio"),
    };
    this.#cameraOptions = options.camera ?? {};
  }

  public setCameraOptions(options: Full3DCameraOptions): void {
    this.#cameraOptions = { ...options };
  }

  public getCameraOptions(): Readonly<Full3DCameraOptions> {
    return Object.freeze({ ...this.#cameraOptions });
  }

  public render(target: HTMLCanvasElement, input: BoardRenderInput): void {
    const context = this.#ensureContext(target);
    this.#rebuildContext(context, target, input);
    context.renderer.render(context.scene, context.camera);
  }

  public async animateMovement(
    target: HTMLCanvasElement,
    input: BoardRenderInput,
    movement: MovementResult,
    options: Full3DMovementAnimationOptions = {},
  ): Promise<void> {
    this.render(target, { ...input, movement });

    const context = this.#contexts.get(target);
    const piece = context?.pieceGroups.get(movement.pieceId);
    if (!context || !piece) {
      return;
    }

    const path = movement.path;
    if (path.length <= 1 || typeof requestAnimationFrame !== "function") {
      return;
    }

    const duration = positive(
      options.durationPerStepMs ?? 220,
      "durationPerStepMs",
    );
    const token = ++context.animationToken;
    const start = path[0] === undefined
      ? undefined
      : context.pointBySpace.get(path[0]);

    if (start) {
      piece.position.copy(start);
      context.renderer.render(context.scene, context.camera);
    }

    for (let index = 0; index < path.length - 1; index += 1) {
      if (context.animationToken !== token) {
        return;
      }

      const fromId = path[index];
      const toId = path[index + 1];
      const from = fromId === undefined
        ? undefined
        : context.pointBySpace.get(fromId);
      const to = toId === undefined
        ? undefined
        : context.pointBySpace.get(toId);

      if (!from || !to) {
        continue;
      }

      await this.#animateSegment(context, piece, from, to, duration, token);
    }
  }

  public disposeTarget(target: HTMLCanvasElement): void {
    const context = this.#contexts.get(target);
    if (!context) {
      return;
    }

    context.animationToken += 1;
    disposeScene(context.scene);
    context.renderer.dispose();
    this.#contexts.delete(target);
  }

  public dispose(): void {
    for (const target of [...this.#contexts.keys()]) {
      this.disposeTarget(target);
    }
  }

  #ensureContext(target: HTMLCanvasElement): Full3DContext {
    const existing = this.#contexts.get(target);
    if (existing) {
      return existing;
    }

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        canvas: target,
        alpha: false,
        antialias: true,
      });
    } catch (error) {
      throw new Error(
        `Full3D renderer could not create WebGL: ${String(error)}`,
      );
    }

    renderer.outputColorSpace = SRGBColorSpace;
    renderer.shadowMap.enabled = this.#options.shadows;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.setClearColor(new Color(this.#options.background), 1);

    const context: Full3DContext = {
      renderer,
      scene: new Scene(),
      camera: new PerspectiveCamera(),
      pieceGroups: new Map(),
      pointBySpace: new Map(),
      animationToken: 0,
    };
    this.#contexts.set(target, context);
    return context;
  }

  #rebuildContext(
    context: Full3DContext,
    target: HTMLCanvasElement,
    input: BoardRenderInput,
  ): void {
    context.animationToken += 1;
    disposeScene(context.scene);
    context.pieceGroups.clear();
    context.pointBySpace.clear();

    const width = Math.max(1, Math.round(target.clientWidth || target.width || 800));
    const height = Math.max(1, Math.round(target.clientHeight || target.height || 500));
    context.renderer.setPixelRatio(this.#options.pixelRatio);
    context.renderer.setSize(width, height, false);

    const scene = new Scene();
    scene.background = new Color(this.#options.background);

    const cameraOptions = resolveFull3DCameraOptions(
      input.layout,
      this.#cameraOptions,
    );
    const camera = createCamera(cameraOptions, width / height);

    scene.add(new AmbientLight(0xffffff, 1.15));
    const keyLight = new DirectionalLight(0xffffff, 3);
    keyLight.position.set(
      cameraOptions.target.x - 4,
      cameraOptions.target.y + 9,
      cameraOptions.target.z + 5,
    );
    keyLight.castShadow = this.#options.shadows;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const tileSize = estimateHybridTileSize(input.layout);
    const path = new Set(input.movement?.path ?? []);

    for (const space of input.layout.getSpaces()) {
      const tile = new Mesh(
        new PlaneGeometry(tileSize, tileSize),
        new MeshStandardMaterial({
          color: new Color(
            path.has(space.spaceId)
              ? this.#options.pathColor
              : this.#options.boardColor,
          ),
          roughness: 0.78,
          metalness: 0.02,
        }),
      );
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(space.position.x, space.position.y, space.position.z);
      tile.receiveShadow = this.#options.shadows;
      scene.add(tile);

      context.pointBySpace.set(
        space.spaceId,
        new Vector3(space.position.x, space.position.y, space.position.z),
      );
    }

    const occupancy = new Map<SpaceId, PieceId[]>();
    for (const piece of mapPiecesToPresentation(input.snapshot, input.layout)) {
      const list = occupancy.get(piece.spaceId) ?? [];
      list.push(piece.pieceId);
      occupancy.set(piece.spaceId, list);
    }

    for (const [spaceId, pieceIds] of occupancy) {
      const point = context.pointBySpace.get(spaceId);
      if (!point) {
        continue;
      }

      pieceIds.forEach((pieceId, index) => {
        const group = createPawn(
          pieceId,
          this.#options.pieceRadius,
          this.#options.pieceHeight,
          this.#options.shadows,
        );
        const offset = (index - (pieceIds.length - 1) / 2) *
          this.#options.pieceRadius * 1.7;
        group.position.set(point.x + offset, point.y, point.z);
        context.pieceGroups.set(pieceId, group);
        scene.add(group);
      });
    }

    context.scene = scene;
    context.camera = camera;
  }

  #animateSegment(
    context: Full3DContext,
    piece: Group,
    from: Vector3,
    to: Vector3,
    duration: number,
    token: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      const started = performance.now();

      const frame = (now: number): void => {
        if (context.animationToken !== token) {
          resolve();
          return;
        }

        const progress = Math.min(1, (now - started) / duration);
        const eased = progress * progress * (3 - 2 * progress);
        piece.position.lerpVectors(from, to, eased);
        piece.position.y =
          from.y + (to.y - from.y) * eased +
          Math.sin(Math.PI * progress) * 0.2;
        context.renderer.render(context.scene, context.camera);

        if (progress >= 1) {
          piece.position.copy(to);
          context.renderer.render(context.scene, context.camera);
          resolve();
          return;
        }

        requestAnimationFrame(frame);
      };

      requestAnimationFrame(frame);
    });
  }
}

function createCamera(
  options: ResolvedFull3DCameraOptions,
  aspect: number,
): Camera {
  if (options.projection === "orthographic") {
    const halfHeight = options.orthographicHeight / 2;
    const camera = new OrthographicCamera(
      -halfHeight * aspect,
      halfHeight * aspect,
      halfHeight,
      -halfHeight,
      options.near,
      options.far,
    );
    camera.zoom = options.zoom;
    camera.position.set(
      options.position.x,
      options.position.y,
      options.position.z,
    );
    camera.lookAt(options.target.x, options.target.y, options.target.z);
    camera.updateProjectionMatrix();
    return camera;
  }

  const camera = new PerspectiveCamera(
    options.fov,
    aspect,
    options.near,
    options.far,
  );
  camera.zoom = options.zoom;
  camera.position.set(
    options.position.x,
    options.position.y,
    options.position.z,
  );
  camera.lookAt(options.target.x, options.target.y, options.target.z);
  camera.updateProjectionMatrix();
  return camera;
}

function createPawn(
  pieceId: PieceId,
  radius: number,
  height: number,
  shadows: boolean,
): Group {
  const group = new Group();
  const material = new MeshStandardMaterial({
    color: deterministicColor(pieceId),
    roughness: 0.48,
    metalness: 0.04,
  });

  const body = new Mesh(
    new CylinderGeometry(radius * 0.72, radius, height * 0.68, 24),
    material,
  );
  body.position.y = height * 0.34;
  body.castShadow = shadows;
  group.add(body);

  const head = new Mesh(
    new SphereGeometry(radius * 0.72, 24, 16),
    material,
  );
  head.position.y = height * 0.78;
  head.castShadow = shadows;
  group.add(head);

  return group;
}

function deterministicColor(value: string): Color {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }

  const hue = ((hash % 360) + 360) % 360;
  return new Color().setHSL(hue / 360, 0.62, 0.58);
}

function disposeScene(scene: Scene): void {
  scene.traverse((object) => {
    const mesh = object as Mesh;
    mesh.geometry?.dispose();

    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const item of material) {
        item.dispose();
      }
    } else {
      material?.dispose();
    }
  });
}

function positive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be greater than zero.`);
  }

  return value;
}
