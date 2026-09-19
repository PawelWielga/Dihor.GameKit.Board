import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const webglMocks = vi.hoisted(() => ({
  renderSpies: [] as Array<ReturnType<typeof vi.fn>>,
}));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();

  class MockWebGLRenderer {
    public outputColorSpace: unknown;
    public autoClear = true;
    public readonly shadowMap = {
      enabled: false,
      type: 0,
    };
    public readonly render = vi.fn();

    public constructor() {
      webglMocks.renderSpies.push(this.render);
    }

    public setPixelRatio(): void {}
    public setSize(): void {}
    public setClearColor(): void {}
    public clear(): void {}
    public clearDepth(): void {}
    public dispose(): void {}
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

import { Object3D, Texture } from "three";
import {
  Board,
  createLinearSpaceLayout,
  LinearTopology,
} from "../../src/index.js";
import type {
  BoardAppearanceConfig,
  RendererAssetLoadResult,
} from "../../src/index.js";
import {
  FlatBoard3DPiecesRenderer,
  Full3DRenderer,
} from "../../src/three/index.js";
import type {
  ThreeBoardAsset,
  ThreeBoardAssetProvider,
} from "../../src/three/index.js";

type TestRenderer =
  | FlatBoard3DPiecesRenderer
  | Full3DRenderer;

interface RendererCase {
  readonly name: string;
  create(provider: ThreeBoardAssetProvider): TestRenderer;
}

const rendererCases: readonly RendererCase[] = [
  {
    name: "FlatBoard3DPieces",
    create: (provider) => new FlatBoard3DPiecesRenderer({
      assetProvider: provider,
    }),
  },
  {
    name: "Full3D",
    create: (provider) => new Full3DRenderer({
      assetProvider: provider,
    }),
  },
];

function createScenario(): {
  readonly input: {
    readonly snapshot: ReturnType<Board["snapshot"]>;
    readonly layout: ReturnType<typeof createLinearSpaceLayout>;
    readonly appearance: BoardAppearanceConfig;
  };
  readonly movement: ReturnType<Board["moveBy"]>;
} {
  const topology = new LinearTopology(["a", "b", "c"]);
  const board = new Board({ topology });
  board.addSpace({ id: "a" });
  board.addSpace({ id: "b" });
  board.addSpace({ id: "c" });
  board.addPiece({ id: "pawn" }, "a");

  const movement = board.moveBy("pawn", 2);
  const appearance: BoardAppearanceConfig = {
    pieces: {
      pawn: {
        appearance: {
          assetKey: "piece.async",
        },
      },
    },
  };

  return {
    input: {
      snapshot: board.snapshot(),
      layout: createLinearSpaceLayout(topology),
      appearance,
    },
    movement,
  };
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
}

describe("async renderer asset refresh during movement", () => {
  let animationFrames: FrameRequestCallback[];

  beforeEach(() => {
    webglMocks.renderSpies.length = 0;
    animationFrames = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  for (const rendererCase of rendererCases) {
    it(`${rendererCase.name} defers a settled asset refresh until movement completes`, async () => {
      let resolveLoad!: (
        value: RendererAssetLoadResult<ThreeBoardAsset> | undefined,
      ) => void;
      const createVisual = vi.fn(() => new Object3D());
      const provider: ThreeBoardAssetProvider = {
        load: vi.fn(
          () =>
            new Promise<RendererAssetLoadResult<ThreeBoardAsset> | undefined>(
              (resolve) => {
                resolveLoad = resolve;
              },
            ),
        ),
      };
      const renderer = rendererCase.create(provider);
      const canvas = {
        clientWidth: 800,
        clientHeight: 500,
        width: 800,
        height: 500,
      } as HTMLCanvasElement;
      const { input, movement } = createScenario();

      const animation = renderer.animateMovement(
        canvas,
        input,
        movement,
        { durationPerStepMs: 100 },
      );

      await flushMicrotasks();
      expect(animationFrames).toHaveLength(1);

      const renderSpy = webglMocks.renderSpies.at(-1);
      if (!renderSpy) {
        throw new Error("Expected a WebGL renderer instance.");
      }

      const renderCountDuringAnimation = renderSpy.mock.calls.length;

      resolveLoad({
        resource: {
          type: "piece-visual",
          create: createVisual,
        },
      });
      await flushMicrotasks();

      expect(createVisual).not.toHaveBeenCalled();
      expect(renderSpy).toHaveBeenCalledTimes(renderCountDuringAnimation);
      expect(animationFrames).toHaveLength(1);

      const firstFrame = animationFrames.shift();
      if (!firstFrame) {
        throw new Error("Expected the first queued animation frame.");
      }

      firstFrame(Number.MAX_SAFE_INTEGER);
      await flushMicrotasks();

      expect(animationFrames).toHaveLength(1);
      expect(createVisual).not.toHaveBeenCalled();

      const secondFrame = animationFrames.shift();
      if (!secondFrame) {
        throw new Error("Expected the second queued animation frame.");
      }

      secondFrame(Number.MAX_SAFE_INTEGER);
      await animation;

      expect(createVisual).toHaveBeenCalledTimes(1);
      expect(renderSpy.mock.calls.length).toBeGreaterThan(
        renderCountDuringAnimation,
      );

      await renderer.dispose();
    });

    it(`${rendererCase.name} defers a settled space texture until movement completes`, async () => {
      let resolveLoad!: (
        value: RendererAssetLoadResult<ThreeBoardAsset> | undefined,
      ) => void;
      const texture = new Texture();
      const provider: ThreeBoardAssetProvider = {
        load: vi.fn(
          () =>
            new Promise<RendererAssetLoadResult<ThreeBoardAsset> | undefined>(
              (resolve) => {
                resolveLoad = resolve;
              },
            ),
        ),
      };
      const renderer = rendererCase.create(provider);
      const canvas = {
        clientWidth: 800,
        clientHeight: 500,
        width: 800,
        height: 500,
      } as HTMLCanvasElement;
      const scenario = createScenario();
      const input = {
        ...scenario.input,
        appearance: {
          spaces: {
            a: {
              appearance: {
                texture: "space.async",
              },
            },
          },
        },
      };

      const animation = renderer.animateMovement(
        canvas,
        input,
        scenario.movement,
        { durationPerStepMs: 100 },
      );

      await flushMicrotasks();
      expect(animationFrames).toHaveLength(1);

      const renderSpy = webglMocks.renderSpies.at(-1);
      if (!renderSpy) {
        throw new Error("Expected a WebGL renderer instance.");
      }

      const renderCountDuringAnimation = renderSpy.mock.calls.length;

      resolveLoad({
        resource: {
          type: "texture",
          texture,
        },
      });
      await flushMicrotasks();

      expect(renderSpy).toHaveBeenCalledTimes(renderCountDuringAnimation);

      for (let step = 0; step < 2; step += 1) {
        const frame = animationFrames.shift();
        if (!frame) {
          throw new Error(`Expected animation frame for movement step ${step + 1}.`);
        }

        frame(Number.MAX_SAFE_INTEGER);
        await flushMicrotasks();
      }

      await animation;
      expect(renderSpy.mock.calls.length).toBeGreaterThan(
        renderCountDuringAnimation,
      );

      await renderer.dispose();
      texture.dispose();
    });
  }
});
