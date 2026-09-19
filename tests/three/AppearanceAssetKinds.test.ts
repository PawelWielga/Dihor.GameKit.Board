import { describe, expect, it, vi } from "vitest";
import { Object3D } from "three";
import {
  AppearanceAssetKind,
  RendererAssetCache,
  RendererAssetKind,
} from "../../src/index.js";
import { resolveThreeAppearanceAssetKind } from "../../src/three/assets.js";
import type {
  ThreeBoardAsset,
  ThreeBoardAssetProvider,
} from "../../src/three/index.js";

describe("Three appearance asset kinds", () => {
  it("keeps entity-specific visual requests as the backward-compatible default", () => {
    expect(
      resolveThreeAppearanceAssetKind("piece", {}),
    ).toBe(RendererAssetKind.PieceVisual);
    expect(
      resolveThreeAppearanceAssetKind("space", {}),
    ).toBe(RendererAssetKind.SpaceVisual);
  });

  it("requests model assets explicitly for both pieces and Full3D spaces", async () => {
    const createdModels: Object3D[] = [];
    const load = vi.fn<ThreeBoardAssetProvider["load"]>(async (request) => {
      if (request.kind !== RendererAssetKind.Model) {
        return undefined;
      }

      const model = new Object3D();
      createdModels.push(model);

      return {
        resource: {
          type: "model",
          create: () => model,
        } satisfies ThreeBoardAsset,
      };
    });
    const cache = new RendererAssetCache<ThreeBoardAsset>({ load });
    const appearance = {
      assetKind: AppearanceAssetKind.Model,
    };

    for (const entity of ["piece", "space"] as const) {
      const request = {
        key: `${entity}.model`,
        kind: resolveThreeAppearanceAssetKind(entity, appearance),
        entity,
      };
      const first = cache.request(request);
      const second = cache.request(request);

      await expect(first.ready).resolves.toMatchObject({ status: "ready" });
      expect(second.ready).toBe(first.ready);
      expect(first.current).toEqual(cache.peek(request));
      expect(first.current.resource?.type).toBe("model");

      const resource = first.current.resource;
      if (resource?.type !== "model") {
        throw new Error("Expected a ThreeModelAsset.");
      }

      expect(resource.create()).toBe(createdModels.at(-1));
    }

    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        kind: RendererAssetKind.Model,
        entity: "piece",
      }),
    );
    expect(load).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        kind: RendererAssetKind.Model,
        entity: "space",
      }),
    );

    await cache.dispose();
  });
});
