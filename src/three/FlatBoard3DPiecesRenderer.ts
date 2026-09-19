import {
  AmbientLight,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Raycaster,
  Scene,
  ShadowMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Piece, PieceId, Space, SpaceId } from "../core/index.js";
import type { MovementResult } from "../movement/index.js";
import {
  BoardRenderMode,
  mapPiecesToPresentation,
  RendererAssetCache,
  RendererAssetKind,
  resolvePieceAppearance,
  resolveSpaceAppearance,
} from "../presentation/index.js";
import type {
  BoardRenderInput,
  BoardRenderer,
  PieceAppearance,
  SpaceAppearance,
} from "../presentation/index.js";
import {
  applyThreeAppearanceTransform,
  resolveThreeAppearanceTransform,
} from "./appearanceMapping.js";
import { resolveThreeAppearanceAssetKind } from "./assets.js";
import type {
  ThreeBoardAsset,
  ThreeBoardAssetProvider,
} from "./assets.js";
import {
  calculateHybridLayoutFrame,
  estimateHybridTileSize,
  projectPresentationPointToNdc,
} from "./hybridProjection.js";
import type { HybridLayoutFrame } from "./hybridProjection.js";

export interface FlatBoard3DPiecesRendererOptions {
  readonly background?: string | number;
  readonly boardColor?: string | number;
  readonly pathColor?: string | number;
  readonly pieceHeight?: number;
  readonly pieceRadius?: number;
  readonly cameraFov?: number;
  readonly shadows?: boolean;
  readonly pixelRatio?: number;
  readonly assetProvider?: ThreeBoardAssetProvider;
}

export interface HybridMovementAnimationOptions {
  readonly durationPerStepMs?: number;
}

interface HybridContext {
  readonly renderer: WebGLRenderer;
  boardScene: Scene;
  boardCamera: OrthographicCamera;
  pieceScene: Scene;
  pieceCamera: PerspectiveCamera;
  frame: HybridLayoutFrame;
  readonly pieceGroups: Map<PieceId, Object3D>;
  readonly pieceOffsets: Map<PieceId, Vector3>;
  readonly groundBySpace: Map<SpaceId, Vector3>;
  lastInput?: BoardRenderInput;
  animationToken: number;
  width: number;
  height: number;
}

export class FlatBoard3DPiecesRenderer
implements BoardRenderer<HTMLCanvasElement> {
  public readonly mode = BoardRenderMode.FlatBoard3DPieces;

  readonly #options: Required<
    Omit<FlatBoard3DPiecesRendererOptions, "assetProvider">
  >;
  readonly #assetCache?: RendererAssetCache<ThreeBoardAsset>;
  readonly #contexts = new Map<HTMLCanvasElement, HybridContext>();
  #assetRerenderScheduled = false;

  public constructor(options: FlatBoard3DPiecesRendererOptions = {}) {
    this.#options = {
      background: options.background ?? "#0b111a",
      boardColor: options.boardColor ?? "#1b2940",
      pathColor: options.pathColor ?? "#4f5fb9",
      pieceHeight: positive(options.pieceHeight ?? 0.7, "pieceHeight"),
      pieceRadius: positive(options.pieceRadius ?? 0.22, "pieceRadius"),
      cameraFov: positive(options.cameraFov ?? 36, "cameraFov"),
      shadows: options.shadows ?? true,
      pixelRatio: positive(options.pixelRatio ?? 1, "pixelRatio"),
    };

    if (options.assetProvider) {
      this.#assetCache = new RendererAssetCache(options.assetProvider, {
        onSettled: () => this.#scheduleAssetRerender(),
      });
    }
  }

  public render(
    target: HTMLCanvasElement,
    input: BoardRenderInput,
  ): void {
    const context = this.#ensureContext(target);
    this.#rebuildContext(context, target, input);
    this.#renderContext(context);
  }

  public async animateMovement(
    target: HTMLCanvasElement,
    input: BoardRenderInput,
    movement: MovementResult,
    options: HybridMovementAnimationOptions = {},
  ): Promise<void> {
    this.render(target, { ...input, movement });

    const context = this.#contexts.get(target);
    const piece = context?.pieceGroups.get(movement.pieceId);
    if (!context || !piece) {
      return;
    }

    const duration = positive(
      options.durationPerStepMs ?? 220,
      "durationPerStepMs",
    );
    const token = ++context.animationToken;
    const path = movement.path;
    const visualOffset = context.pieceOffsets.get(movement.pieceId) ??
      new Vector3();

    if (path.length <= 1 || typeof requestAnimationFrame !== "function") {
      return;
    }

    const startSpaceId = path[0];
    const start = startSpaceId === undefined
      ? undefined
      : context.groundBySpace.get(startSpaceId);
    if (start) {
      piece.position.copy(start).add(visualOffset);
      this.#renderContext(context);
    }

    for (let index = 0; index < path.length - 1; index += 1) {
      if (context.animationToken !== token) {
        return;
      }

      const fromId = path[index];
      const toId = path[index + 1];
      if (fromId === undefined || toId === undefined) {
        continue;
      }

      const from = context.groundBySpace.get(fromId);
      const to = context.groundBySpace.get(toId);
      if (!from || !to) {
        continue;
      }

      await this.#animateSegment(
        context,
        piece,
        from,
        to,
        visualOffset,
        duration,
        token,
      );
    }
  }

  public disposeTarget(target: HTMLCanvasElement): void {
    const context = this.#contexts.get(target);
    if (!context) {
      return;
    }

    context.animationToken += 1;
    disposeScene(context.boardScene);
    disposeScene(context.pieceScene);
    context.renderer.dispose();
    this.#contexts.delete(target);
  }

  public async dispose(): Promise<void> {
    for (const target of [...this.#contexts.keys()]) {
      this.disposeTarget(target);
    }

    await this.#assetCache?.dispose();
  }

  #ensureContext(target: HTMLCanvasElement): HybridContext {
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
        "FlatBoard3DPieces renderer could not create WebGL: " + String(error),
      );
    }

    renderer.outputColorSpace = SRGBColorSpace;
    renderer.shadowMap.enabled = this.#options.shadows;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.autoClear = false;

    const context: HybridContext = {
      renderer,
      boardScene: new Scene(),
      boardCamera: new OrthographicCamera(),
      pieceScene: new Scene(),
      pieceCamera: new PerspectiveCamera(),
      frame: {
        centerX: 0,
        centerZ: 0,
        halfWidth: 1,
        halfHeight: 1,
        aspect: 1,
      },
      pieceGroups: new Map(),
      pieceOffsets: new Map(),
      groundBySpace: new Map(),
      animationToken: 0,
      width: 0,
      height: 0,
    };

    this.#contexts.set(target, context);
    return context;
  }

  #rebuildContext(
    context: HybridContext,
    target: HTMLCanvasElement,
    input: BoardRenderInput,
  ): void {
    context.animationToken += 1;
    context.lastInput = input;
    disposeScene(context.boardScene);
    disposeScene(context.pieceScene);
    context.pieceGroups.clear();
    context.pieceOffsets.clear();
    context.groundBySpace.clear();

    const width = Math.max(1, Math.round(target.clientWidth || target.width || 800));
    const height = Math.max(1, Math.round(target.clientHeight || target.height || 500));
    context.width = width;
    context.height = height;

    context.renderer.setPixelRatio(this.#options.pixelRatio);
    context.renderer.setSize(width, height, false);
    context.renderer.setClearColor(new Color(this.#options.background), 1);

    const frame = calculateHybridLayoutFrame(input.layout, { width, height });
    context.frame = frame;

    const boardScene = new Scene();
    const boardCamera = new OrthographicCamera(
      -frame.halfWidth,
      frame.halfWidth,
      frame.halfHeight,
      -frame.halfHeight,
      0.1,
      100,
    );
    boardCamera.position.set(frame.centerX, -frame.centerZ, 10);
    boardCamera.lookAt(frame.centerX, -frame.centerZ, 0);
    boardCamera.updateProjectionMatrix();

    const tileSize = estimateHybridTileSize(input.layout);
    const path = new Set(input.movement?.path ?? []);
    const spaceById = new Map<SpaceId, Space>(
      input.snapshot.spaces.map((space) => [space.id, space]),
    );

    for (const space of input.layout.getSpaces()) {
      const domainSpace = spaceById.get(space.spaceId) ?? { id: space.spaceId };
      const appearance = input.appearance
        ? resolveSpaceAppearance(domainSpace, input.appearance)
        : undefined;
      const texture = appearance?.texture
        ? this.#textureAsset(appearance.texture, "space")
        : undefined;
      const color = appearance?.color ??
        (path.has(space.spaceId)
          ? this.#options.pathColor
          : this.#options.boardColor);
      const opacity = appearance?.opacity ?? 1;
      const material = new MeshBasicMaterial({
        color: new Color(color),
        opacity,
        transparent: opacity < 1,
        ...(texture ? { map: texture } : {}),
      });
      const tile = new Mesh(
        new PlaneGeometry(tileSize, tileSize),
        material,
      );

      if (appearance) {
        const transform = resolveThreeAppearanceTransform(appearance);
        tile.position.set(
          space.position.x + transform.offset.x,
          -(space.position.z + transform.offset.z),
          transform.offset.y,
        );
        tile.scale.set(transform.scale.x, transform.scale.z, 1);
        tile.rotation.z = -transform.rotation.y;
      } else {
        tile.position.set(space.position.x, -space.position.z, 0);
      }

      boardScene.add(tile);
    }

    const pieceScene = new Scene();
    const pieceCamera = new PerspectiveCamera(
      this.#options.cameraFov,
      width / height,
      0.1,
      100,
    );
    pieceCamera.position.set(0, 6.5, 8.5);
    pieceCamera.lookAt(0, 0, 0);
    pieceCamera.updateProjectionMatrix();
    pieceCamera.updateMatrixWorld();

    pieceScene.add(new AmbientLight(0xffffff, 1.25));

    const keyLight = new DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(-4, 8, 5);
    keyLight.castShadow = this.#options.shadows;
    keyLight.shadow.mapSize.set(1024, 1024);
    pieceScene.add(keyLight);

    const shadowPlane = new Mesh(
      new PlaneGeometry(40, 40),
      new ShadowMaterial({ opacity: this.#options.shadows ? 0.26 : 0 }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.002;
    shadowPlane.receiveShadow = this.#options.shadows;
    pieceScene.add(shadowPlane);

    const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
    const raycaster = new Raycaster();

    for (const space of input.layout.getSpaces()) {
      const ndc = projectPresentationPointToNdc(space.position, frame);
      raycaster.setFromCamera(new Vector2(ndc.x, ndc.y), pieceCamera);
      const ground = new Vector3();

      if (!raycaster.ray.intersectPlane(groundPlane, ground)) {
        throw new Error(
          "Could not align 3D piece pass with board space '" +
          space.spaceId +
          "'.",
        );
      }

      context.groundBySpace.set(space.spaceId, ground.clone());
    }

    const pieceById = new Map<PieceId, Piece>(
      input.snapshot.pieces.map((piece) => [piece.id, piece]),
    );
    const occupancy = new Map<SpaceId, PieceId[]>();
    for (const piece of mapPiecesToPresentation(input.snapshot, input.layout)) {
      const list = occupancy.get(piece.spaceId) ?? [];
      list.push(piece.pieceId);
      occupancy.set(piece.spaceId, list);
    }

    for (const [spaceId, pieceIds] of occupancy) {
      const ground = context.groundBySpace.get(spaceId);
      if (!ground) {
        continue;
      }

      pieceIds.forEach((pieceId, index) => {
        const domainPiece = pieceById.get(pieceId) ?? { id: pieceId };
        const appearance = input.appearance
          ? resolvePieceAppearance(domainPiece, input.appearance)
          : undefined;
        const object = this.#createPieceVisual(pieceId, appearance);
        const lateralOffset = (index - (pieceIds.length - 1) / 2) *
          this.#options.pieceRadius * 1.7;
        object.position.set(ground.x + lateralOffset, ground.y, ground.z);

        const visualOffset = new Vector3(lateralOffset, 0, 0);
        if (appearance) {
          const transform = resolveThreeAppearanceTransform(appearance);
          visualOffset.add(
            new Vector3(
              transform.offset.x,
              transform.offset.y,
              transform.offset.z,
            ),
          );
          applyThreeAppearanceTransform(object, appearance);
        }

        context.pieceOffsets.set(pieceId, visualOffset);
        context.pieceGroups.set(pieceId, object);
        pieceScene.add(object);
      });
    }

    context.boardScene = boardScene;
    context.boardCamera = boardCamera;
    context.pieceScene = pieceScene;
    context.pieceCamera = pieceCamera;
  }

  #createPieceVisual(
    pieceId: PieceId,
    appearance: PieceAppearance | undefined,
  ): Object3D {
    if (appearance?.assetKey) {
      const assetKind = resolveThreeAppearanceAssetKind("piece", appearance);
      const asset = this.#asset(
        appearance.assetKey,
        assetKind,
        "piece",
      );

      if (
        assetKind === RendererAssetKind.Model &&
        asset?.type === "model"
      ) {
        return asset.create();
      }

      if (
        assetKind === RendererAssetKind.PieceVisual &&
        asset?.type === "piece-visual"
      ) {
        return asset.create({ pieceId, appearance });
      }
    }

    const material = appearance?.material
      ? this.#materialAsset(appearance.material, "piece")
      : undefined;
    const texture = appearance?.texture
      ? this.#textureAsset(appearance.texture, "piece")
      : undefined;

    return createPawn(
      pieceId,
      this.#options.pieceRadius,
      this.#options.pieceHeight,
      this.#options.shadows,
      appearance,
      material,
      texture,
    );
  }

  #asset(
    key: string,
    kind: (typeof RendererAssetKind)[keyof typeof RendererAssetKind],
    entity: "space" | "piece",
  ): ThreeBoardAsset | undefined {
    return this.#assetCache?.request({
      key,
      kind,
      entity,
    }).current.resource;
  }

  #textureAsset(
    key: string,
    entity: "space" | "piece",
  ): Texture | undefined {
    const asset = this.#asset(key, RendererAssetKind.Texture, entity);
    return asset?.type === "texture" ? asset.texture : undefined;
  }

  #materialAsset(
    key: string,
    entity: "space" | "piece",
  ): Material | undefined {
    const asset = this.#asset(key, RendererAssetKind.Material, entity);
    return asset?.type === "material" ? asset.material.clone() : undefined;
  }

  #scheduleAssetRerender(): void {
    if (this.#assetRerenderScheduled) {
      return;
    }

    this.#assetRerenderScheduled = true;
    queueMicrotask(() => {
      this.#assetRerenderScheduled = false;

      for (const [target, context] of this.#contexts) {
        const input = context.lastInput;
        if (!input) {
          continue;
        }

        try {
          this.render(target, input);
        } catch {
          // Keep the previously rendered fallback frame.
        }
      }
    });
  }

  #renderContext(context: HybridContext): void {
    context.renderer.clear(true, true, true);
    context.renderer.render(context.boardScene, context.boardCamera);
    context.renderer.clearDepth();
    context.renderer.render(context.pieceScene, context.pieceCamera);
  }

  #animateSegment(
    context: HybridContext,
    piece: Object3D,
    from: Vector3,
    to: Vector3,
    visualOffset: Vector3,
    duration: number,
    token: number,
  ): Promise<void> {
    const visualFrom = from.clone().add(visualOffset);
    const visualTo = to.clone().add(visualOffset);

    return new Promise((resolve) => {
      const started = performance.now();

      const frame = (now: number): void => {
        if (context.animationToken !== token) {
          resolve();
          return;
        }

        const progress = Math.min(1, (now - started) / duration);
        const eased = progress * progress * (3 - 2 * progress);
        piece.position.lerpVectors(visualFrom, visualTo, eased);
        piece.position.y =
          visualFrom.y +
          (visualTo.y - visualFrom.y) * eased +
          Math.sin(Math.PI * progress) * 0.2;
        this.#renderContext(context);

        if (progress >= 1) {
          piece.position.copy(visualTo);
          this.#renderContext(context);
          resolve();
          return;
        }

        requestAnimationFrame(frame);
      };

      requestAnimationFrame(frame);
    });
  }
}

function createPawn(
  pieceId: PieceId,
  radius: number,
  height: number,
  shadows: boolean,
  appearance?: PieceAppearance,
  suppliedMaterial?: Material,
  texture?: Texture,
): Group {
  const group = new Group();
  const opacity = appearance?.opacity ?? 1;
  const material = suppliedMaterial ?? new MeshStandardMaterial({
    color: appearance?.color
      ? new Color(appearance.color)
      : deterministicColor(pieceId),
    roughness: 0.48,
    metalness: 0.04,
    opacity,
    transparent: opacity < 1,
    ...(texture ? { map: texture } : {}),
  });

  if (suppliedMaterial) {
    material.opacity = opacity;
    material.transparent = material.transparent || opacity < 1;
  }

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
  const geometries = new Set<{ dispose(): void }>();
  const materials = new Set<Material>();

  scene.traverse((object) => {
    const mesh = object as Mesh;
    if (mesh.geometry) {
      geometries.add(mesh.geometry);
    }

    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const item of material) {
        materials.add(item);
      }
    } else if (material) {
      materials.add(material);
    }
  });

  for (const geometry of geometries) {
    geometry.dispose();
  }

  for (const material of materials) {
    material.dispose();
  }
}

function positive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(label + " must be greater than zero.");
  }

  return value;
}
