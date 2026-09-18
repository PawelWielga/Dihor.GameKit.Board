import { describe, expect, it, vi } from "vitest";
import {
  RendererAssetCache,
  RendererAssetKind,
} from "../../src/index.js";
import type {
  RendererAssetLoadResult,
  RendererAssetProvider,
} from "../../src/index.js";

interface FakeResource {
  readonly id: string;
}

describe("RendererAssetCache", () => {
  it("starts async loading once, exposes a placeholder and reuses the cached result", async () => {
    let resolveLoad!: (value: RendererAssetLoadResult<FakeResource>) => void;
    const load = vi.fn(
      () =>
        new Promise<RendererAssetLoadResult<FakeResource>>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const provider: RendererAssetProvider<FakeResource> = { load };
    const cache = new RendererAssetCache(provider, {
      placeholder: () => ({ id: "placeholder" }),
    });
    const request = {
      key: "piece.hero",
      kind: RendererAssetKind.Model,
      entity: "piece" as const,
    };

    const first = cache.request(request);
    const second = cache.request(request);

    expect(first.current).toEqual({
      status: "loading",
      resource: { id: "placeholder" },
    });
    expect(second.current).toEqual(first.current);
    expect(second.ready).toBe(first.ready);
    expect(load).toHaveBeenCalledTimes(0);

    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);

    resolveLoad({
      resource: { id: "hero-model" },
    });

    await expect(first.ready).resolves.toEqual({
      status: "ready",
      resource: { id: "hero-model" },
    });
    expect(cache.peek(request)).toEqual({
      status: "ready",
      resource: { id: "hero-model" },
    });
  });

  it("uses fallback resources for missing and failed provider assets", async () => {
    const provider: RendererAssetProvider<FakeResource> = {
      load: async (request) => {
        if (request.key === "missing") {
          return undefined;
        }

        throw new Error("load failed");
      },
    };
    const cache = new RendererAssetCache(provider, {
      fallback: (request) => ({
        resource: { id: `fallback:${request.key}` },
      }),
    });

    await expect(
      cache.request({
        key: "missing",
        kind: RendererAssetKind.Texture,
      }).ready,
    ).resolves.toEqual({
      status: "fallback",
      resource: { id: "fallback:missing" },
      error: undefined,
    });

    const failed = await cache.request({
      key: "broken",
      kind: RendererAssetKind.Model,
    }).ready;

    expect(failed.status).toBe("fallback");
    expect(failed.resource).toEqual({ id: "fallback:broken" });
    expect(failed.error).toEqual(expect.any(Error));
  });

  it("reports missing and error states when no fallback exists", async () => {
    const provider: RendererAssetProvider<FakeResource> = {
      load: async (request) => {
        if (request.key === "missing") {
          return undefined;
        }

        throw new TypeError("bad asset");
      },
    };
    const cache = new RendererAssetCache(provider);

    await expect(
      cache.request({
        key: "missing",
        kind: RendererAssetKind.Image,
      }).ready,
    ).resolves.toEqual({ status: "missing" });

    const failed = await cache.request({
      key: "bad",
      kind: RendererAssetKind.Image,
    }).ready;

    expect(failed.status).toBe("error");
    expect(failed.error).toEqual(expect.any(TypeError));
  });

  it("disposes cached resources and the provider exactly once", async () => {
    const disposeResource = vi.fn();
    const disposeProvider = vi.fn();
    const provider: RendererAssetProvider<FakeResource> = {
      load: async (request) => ({
        resource: { id: request.key },
        dispose: disposeResource,
      }),
      dispose: disposeProvider,
    };
    const cache = new RendererAssetCache(provider);
    const request = {
      key: "shared",
      kind: RendererAssetKind.Material,
    };

    await cache.request(request).ready;
    await cache.request(request).ready;
    await cache.dispose();
    await cache.dispose();

    expect(disposeResource).toHaveBeenCalledTimes(1);
    expect(disposeProvider).toHaveBeenCalledTimes(1);
    expect(() => cache.request(request)).toThrow(
      "RendererAssetCache has been disposed.",
    );
  });

  it("allows explicit cache keys while rejecting empty identifiers", async () => {
    const load = vi.fn(async () => ({
      resource: { id: "shared" },
    }));
    const cache = new RendererAssetCache<FakeResource>({ load });

    const first = cache.request({
      key: "piece-a",
      kind: RendererAssetKind.Custom,
      cacheKey: "shared-visual",
    });
    const second = cache.request({
      key: "piece-b",
      kind: RendererAssetKind.Custom,
      cacheKey: "shared-visual",
    });

    await Promise.all([first.ready, second.ready]);
    expect(load).toHaveBeenCalledTimes(1);

    expect(() =>
      cache.request({
        key: "   ",
        kind: RendererAssetKind.Custom,
      })
    ).toThrow(RangeError);
  });
});
