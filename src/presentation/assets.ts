export const RendererAssetKind = Object.freeze({
  Image: "image",
  Svg: "svg",
  Texture: "texture",
  Model: "model",
  Material: "material",
  PieceVisual: "piece-visual",
  SpaceVisual: "space-visual",
  Custom: "custom",
} as const);

export type RendererAssetKind =
  (typeof RendererAssetKind)[keyof typeof RendererAssetKind];

export type RendererAssetEntity = "space" | "piece";

export interface RendererAssetRequest {
  readonly key: string;
  readonly kind: RendererAssetKind;
  readonly entity?: RendererAssetEntity;
  readonly cacheKey?: string;
  readonly metadata?: unknown;
}

export interface RendererAssetLoadResult<TResource> {
  readonly resource: TResource;
  readonly dispose?: () => void | Promise<void>;
}

export interface RendererAssetProvider<TResource> {
  load(
    request: RendererAssetRequest,
  ):
    | RendererAssetLoadResult<TResource>
    | undefined
    | Promise<RendererAssetLoadResult<TResource> | undefined>;
  dispose?(): void | Promise<void>;
}

export type RendererAssetStatus =
  | "loading"
  | "ready"
  | "fallback"
  | "missing"
  | "error";

export interface RendererAssetSnapshot<TResource> {
  readonly status: RendererAssetStatus;
  readonly resource?: TResource;
  readonly error?: unknown;
}

export interface RendererAssetHandle<TResource> {
  readonly current: RendererAssetSnapshot<TResource>;
  readonly ready: Promise<RendererAssetSnapshot<TResource>>;
}

export interface RendererAssetCacheOptions<TResource> {
  readonly placeholder?: (
    request: RendererAssetRequest,
  ) => TResource | undefined;
  readonly fallback?: (
    request: RendererAssetRequest,
    error?: unknown,
  ) =>
    | RendererAssetLoadResult<TResource>
    | undefined
    | Promise<RendererAssetLoadResult<TResource> | undefined>;
  readonly onSettled?: (
    request: RendererAssetRequest,
    snapshot: RendererAssetSnapshot<TResource>,
  ) => void;
}

interface RendererAssetCacheEntry<TResource> {
  readonly request: RendererAssetRequest;
  current: RendererAssetSnapshot<TResource>;
  ready: Promise<RendererAssetSnapshot<TResource>>;
  owned?: RendererAssetLoadResult<TResource>;
}

export class RendererAssetCache<TResource> {
  readonly #provider: RendererAssetProvider<TResource>;
  readonly #options: RendererAssetCacheOptions<TResource>;
  readonly #entries = new Map<string, RendererAssetCacheEntry<TResource>>();
  #disposed = false;

  public constructor(
    provider: RendererAssetProvider<TResource>,
    options: RendererAssetCacheOptions<TResource> = {},
  ) {
    this.#provider = provider;
    this.#options = options;
  }

  public request(request: RendererAssetRequest): RendererAssetHandle<TResource> {
    this.#ensureActive();
    validateRequest(request);

    const key = getCacheKey(request);
    const existing = this.#entries.get(key);
    if (existing) {
      return {
        current: existing.current,
        ready: existing.ready,
      };
    }

    const entry: RendererAssetCacheEntry<TResource> = {
      request,
      current: {
        status: "loading",
        resource: this.#options.placeholder?.(request),
      },
      ready: Promise.resolve({ status: "loading" }),
    };

    this.#entries.set(key, entry);
    entry.ready = Promise.resolve()
      .then(() => this.#resolve(entry))
      .then((snapshot) => {
        entry.current = snapshot;
        this.#notifySettled(entry.request, snapshot);
        return snapshot;
      });

    return {
      current: entry.current,
      ready: entry.ready,
    };
  }

  public peek(
    request: RendererAssetRequest,
  ): RendererAssetSnapshot<TResource> | undefined {
    validateRequest(request);
    return this.#entries.get(getCacheKey(request))?.current;
  }

  public has(request: RendererAssetRequest): boolean {
    validateRequest(request);
    return this.#entries.has(getCacheKey(request));
  }

  public async dispose(): Promise<void> {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    const entries = [...this.#entries.values()];
    await Promise.allSettled(entries.map((entry) => entry.ready));

    for (const entry of entries) {
      await entry.owned?.dispose?.();
      entry.owned = undefined;
    }

    this.#entries.clear();
    await this.#provider.dispose?.();
  }

  async #resolve(
    entry: RendererAssetCacheEntry<TResource>,
  ): Promise<RendererAssetSnapshot<TResource>> {
    try {
      const loaded = await this.#provider.load(entry.request);
      if (loaded) {
        entry.owned = loaded;
        return {
          status: "ready",
          resource: loaded.resource,
        };
      }

      return await this.#resolveFallback(entry);
    } catch (error) {
      return await this.#resolveFallback(entry, error);
    }
  }

  async #resolveFallback(
    entry: RendererAssetCacheEntry<TResource>,
    error?: unknown,
  ): Promise<RendererAssetSnapshot<TResource>> {
    if (!this.#options.fallback) {
      return error === undefined
        ? { status: "missing" }
        : { status: "error", error };
    }

    try {
      const fallback = await this.#options.fallback(entry.request, error);
      if (!fallback) {
        return error === undefined
          ? { status: "missing" }
          : { status: "error", error };
      }

      entry.owned = fallback;
      return {
        status: "fallback",
        resource: fallback.resource,
        error,
      };
    } catch (fallbackError) {
      return {
        status: "error",
        error: fallbackError,
      };
    }
  }

  #notifySettled(
    request: RendererAssetRequest,
    snapshot: RendererAssetSnapshot<TResource>,
  ): void {
    try {
      this.#options.onSettled?.(request, snapshot);
    } catch {
      // Notification hooks must not change asset resolution semantics.
    }
  }

  #ensureActive(): void {
    if (this.#disposed) {
      throw new Error("RendererAssetCache has been disposed.");
    }
  }
}

function getCacheKey(request: RendererAssetRequest): string {
  return request.cacheKey ?? `${request.kind}:${request.key}`;
}

function validateRequest(request: RendererAssetRequest): void {
  if (request.key.trim().length === 0) {
    throw new RangeError("Renderer asset key must not be empty.");
  }

  if (request.cacheKey !== undefined && request.cacheKey.trim().length === 0) {
    throw new RangeError("Renderer asset cacheKey must not be empty.");
  }
}
