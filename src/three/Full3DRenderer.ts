import {
  AmbientLight,
  Camera,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
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
  readonly assetProvider?: ThreeBoardAssetProvider;
}

export interface Full3DMovementAnimationOptions {
  readonly durationPerStepMs?: number;
}

interface Full3DContext {
  readonly renderer: WebGLRenderer;
  scene: Scene;
  camera: Camera;
  readonly pieceGroups: Map<PieceId, Object3D>;
  readonly pieceOffsets: Map<PieceId, Vector3>;
  readonly pointBySpace: Map<SpaceId, Vector3>;
  lastInput?: BoardRenderInput;
  animationToken: number;
}

export class Full3DRenderer implements BoardRenderer<HTMLCanvasElement> {
  public readonly mode = BoardRenderMode.Full3D;

  readonly #options: Required<
    Omit<Full3DRendererOptions, "camera" | "assetProvider">
  >;
  readonly #assetCache?: RendererAssetCache<ThreeBoardAsset>;
  #cameraOptions: Full3DCameraOptions;
  readonly #contexts = new Map<HTMLCanvasElement, Full3DContext>();
  #assetRerenderScheduled = false;

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

    if (options.assetProvider) {
      this.#assetCache = new RendererAssetCache(options.assetProvider, {
        onSettled: () => this.#scheduleAssetRerender(),
      });
    }
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
    const visualOffset = context.pieceOffsets.get(movement.pieceId) ??
      new Vector3();
    const start = path[0] === undefined
      ? undefined
      : context.pointBySpace.get(path[0]);

    if (start) {
      piece.position.copy(start).add(visualOffset);
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
    disposeScene(context.scene);
    context.renderer.dispose();
    this.#contexts.delete(target);
  }

  public async dispose(): Promise<void> {
    for (const target of [...this.#contexts.keys()]) {
      this.disposeTarget(target);
    }

    await this.#assetCache?.dispose();
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
        "Full3D renderer could not create WebGL: " + String(error),
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
      pieceOffsets: new Map(),
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
    context.lastInput = input;
    disposeScene(context.scene);
    context.pieceGroups.clear();
    context.pieceOffsets.clear();
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
    const spaceById = new Map<SpaceId, Space>(
      input.snapshot.spaces.map((space) => [space.id, space]),
    );

    for (const space of input.layout.getSpaces()) {
      const domainSpace = spaceById.get(space.spaceId) ?? { id: space.spaceId };
      const appearance = input.appearance
        ? resolveSpaceAppearance(domainSpace, input.appearance)
        : undefined;
      const point = new Vector3(
        space.position.x,
        space.position.y,
        space.position.z,
      );

      const customVisual = appearance?.assetKey
        ? this.#createSpaceVisual(space.spaceId, appearance)
        : undefined;

      if (customVisual) {
        customVisual.position.copy(point);
        applyThreeAppearanceTransform(customVisual, appearance!);
        setObjectShadowFlags(customVisual, this.#options.shadows, true);
        scene.add(customVisual);
      } else {
        const tile = this.#createDefaultSpaceVisual(
          space.spaceId,
          tileSize,
          appearance,
          path.has(space.spaceId),
        );
        tile.position.copy(point);
        tile.rotation.x = -Math.PI / 2;

        if (appearance) {
          const transform = resolveThreeAppearanceTransform(appearance);
          tile.position.add(
            new Vector3(
              transform.offset.x,
              transform.offset.y,
              transform.offset.z,
            ),
          );
          tile.scale.set(
            transform.scale.x,
            transform.scale.z,
            transform.scale.y,
          );
          tile.rotation.z += transform.rotation.y;
        }

        tile.receiveShadow = this.#options.shadows;
        scene.add(tile);
      }

      context.pointBySpace.set(space.spaceId, point);
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
      const point = context.pointBySpace.get(spaceId);
      if (!point) {
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
        object.position.set(point.x + lateralOffset, point.y, point.z);

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

        setObjectShadowFlags(object, this.#options.shadows, false);
        context.pieceOffsets.set(pieceId, visualOffset);
        context.pieceGroups.set(pieceId, object);
        scene.add(object);
      });
    }

    context.scene = scene;
    context.camera = camera;
  }

  #createDefaultSpaceVisual(
    spaceId: SpaceId,
    tileSize: number,
    appearance: SpaceAppearance | undefined,
    inPath: boolean,
  ): Mesh {
    const materialAsset = appearance?.material
      ? this.#materialAsset(appearance.material, "space")
      : undefined;
    const texture = appearance?.texture
      ? this.#textureAsset(appearance.texture, "space")
      : undefined;
    const opacity = appearance?.opacity ?? 1;
    const material = materialAsset ?? new MeshStandardMaterial({
      color: new Color(
        appearance?.color ??
        (inPath ? this.#options.pathColor : this.#options.boardColor),
      ),
      roughness: 0.78,
      metalness: 0.02,
      opacity,
      transparent: opacity < 1,
      ...(texture ? { map: texture } : {}),
    });

    if (materialAsset) {
      material.opacity = opacity;
      material.transparent = material.transparent || opacity < 1;
    }

    return new Mesh(
      new PlaneGeometry(tileSize, tileSize),
      material,
    );
  }

  #createSpaceVisual(
    spaceId: SpaceId,
    appearance: SpaceAppearance,
  ): Object3D | undefined {
    if (!appearance.assetKey) {
      return undefined;
    }

    const assetKind = resolveThreeAppearanceAssetKind("space", appearance);
    const asset = this.#asset(
      appearance.assetKey,
      assetKind,
      "space",
    );

    if (
      assetKind === RendererAssetKind.Model &&
      asset?.type === "model"
    ) {
      return asset.create();
    }

    if (
      assetKind === RendererAssetKind.SpaceVisual &&
      asset?.type === "space-visual"
    ) {
      return asset.create({ spaceId, appearance });
    }

    return undefined;
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

  #animateSegment(
    context: Full3DContext,
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
        context.renderer.render(context.scene, context.camera);

        if (progress >= 1) {
          piece.position.copy(visualTo);
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

function setObjectShadowFlags(
  object: Object3D,
  castShadow: boolean,
  receiveShadow: boolean,
): void {
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
    }
  });
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
