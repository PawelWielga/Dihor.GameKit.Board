import { describe, expect, it, vi } from "vitest";
import {
  FlatBoard3DPiecesRenderer,
  Full3DRenderer,
} from "../../src/three/index.js";
import type { ThreeBoardAssetProvider } from "../../src/three/index.js";

type RendererWithDispose = {
  dispose(): Promise<void>;
};

const rendererFactories: ReadonlyArray<
  (provider: ThreeBoardAssetProvider) => RendererWithDispose
> = [
  (provider) => new FlatBoard3DPiecesRenderer({ assetProvider: provider }),
  (provider) => new Full3DRenderer({ assetProvider: provider }),
];

describe("Three renderer disposal", () => {
  it("awaits provider cleanup and calls it once for repeated disposal", async () => {
    for (const createRenderer of rendererFactories) {
      let releaseProvider!: () => void;
      const providerGate = new Promise<void>((resolve) => {
        releaseProvider = resolve;
      });
      const disposeProvider = vi.fn(async () => {
        await providerGate;
      });
      const provider: ThreeBoardAssetProvider = {
        load: () => undefined,
        dispose: disposeProvider,
      };
      const renderer = createRenderer(provider);

      const firstDispose = renderer.dispose();
      const secondDispose = renderer.dispose();

      await vi.waitFor(() => {
        expect(disposeProvider).toHaveBeenCalledTimes(1);
      });

      let settled = false;
      void firstDispose.finally(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);

      releaseProvider();
      await Promise.all([firstDispose, secondDispose]);

      expect(disposeProvider).toHaveBeenCalledTimes(1);
    }
  });

  it("propagates provider cleanup rejection without retrying it", async () => {
    for (const createRenderer of rendererFactories) {
      const cleanupError = new Error("provider cleanup failed");
      const disposeProvider = vi.fn(async () => {
        throw cleanupError;
      });
      const renderer = createRenderer({
        load: () => undefined,
        dispose: disposeProvider,
      });

      await expect(renderer.dispose()).rejects.toBe(cleanupError);
      await expect(renderer.dispose()).rejects.toBe(cleanupError);
      expect(disposeProvider).toHaveBeenCalledTimes(1);
    }
  });
});
