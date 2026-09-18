import { describe, expect, it } from "vitest";
import {
  AppearanceState,
  Board,
  DEFAULT_PIECE_APPEARANCE,
  DEFAULT_SPACE_APPEARANCE,
  LinearTopology,
  resolvePieceAppearance,
  resolveSpaceAppearance,
} from "../../src/index.js";
import type {
  BoardAppearanceConfig,
  Piece,
  Space,
} from "../../src/index.js";

describe("external appearance resolution", () => {
  it("uses renderer-neutral defaults when no customization is supplied", () => {
    const space: Space = { id: "a" };
    const piece: Piece = { id: "pawn" };

    expect(resolveSpaceAppearance(space)).toMatchObject(DEFAULT_SPACE_APPEARANCE);
    expect(resolvePieceAppearance(piece)).toMatchObject(DEFAULT_PIECE_APPEARANCE);
  });

  it("applies default, named style, entity override and resolver precedence", () => {
    const space: Space<{ kind: string }> = {
      id: "bonus",
      data: { kind: "reward" },
    };

    const config: BoardAppearanceConfig<{ kind: string }> = {
      theme: {
        spaceDefault: {
          color: "#111111",
          opacity: 0.7,
          label: { visible: true, color: "#eeeeee" },
        },
        spaceStyles: {
          reward: {
            color: "#22aa22",
            scale: 1.1,
            label: { text: "Reward" },
          },
          resolverStyle: {
            scale: 1.25,
            texture: "textures/reward.png",
          },
        },
      },
      spaces: {
        bonus: {
          style: "reward",
          appearance: {
            opacity: 0.9,
            label: { color: "#ffffff" },
          },
        },
      },
      resolveSpace: ({ space: candidate }) =>
        candidate.data?.kind === "reward"
          ? {
              style: "resolverStyle",
              appearance: { color: "#00ff66" },
            }
          : undefined,
    };

    expect(resolveSpaceAppearance(space, config)).toMatchObject({
      color: "#00ff66",
      opacity: 0.9,
      scale: 1.25,
      texture: "textures/reward.png",
      label: {
        visible: true,
        text: "Reward",
        color: "#ffffff",
      },
    });
  });

  it("applies temporary presentation state variants without changing entity data", () => {
    const piece: Piece<{ team: string }> = {
      id: "pawn",
      data: { team: "blue" },
    };
    const before = structuredClone(piece);

    const config: BoardAppearanceConfig<unknown, { team: string }> = {
      theme: {
        pieceDefault: {
          color: "#3366ff",
          variants: {
            [AppearanceState.Highlighted]: {
              color: "#ffcc00",
              scale: 1.1,
            },
            [AppearanceState.Selected]: {
              scale: 1.2,
            },
            [AppearanceState.Active]: {
              opacity: 0.8,
            },
          },
        },
      },
      pieceStates: {
        pawn: {
          highlighted: true,
          selected: true,
          active: true,
        },
      },
    };

    expect(resolvePieceAppearance(piece, config)).toMatchObject({
      color: "#ffcc00",
      scale: 1.2,
      opacity: 0.8,
    });
    expect(piece).toEqual(before);
  });

  it("ignores missing named styles and retains fallback values", () => {
    const space: Space = { id: "unknown-style" };

    const appearance = resolveSpaceAppearance(space, {
      spaces: {
        "unknown-style": {
          style: "does-not-exist",
          appearance: { opacity: 0.5 },
        },
      },
    });

    expect(appearance.color).toBe(DEFAULT_SPACE_APPEARANCE.color);
    expect(appearance.opacity).toBe(0.5);
  });

  it("can switch themes without rebuilding or mutating logical board state", () => {
    const topology = new LinearTopology(["a", "b"]);
    const board = new Board({ topology });

    for (const spaceId of topology.getSpaceIds()) {
      board.addSpace({ id: spaceId });
    }
    board.addPiece({ id: "pawn" }, "a");

    const snapshotBefore = board.snapshot();
    const space = snapshotBefore.spaces[0]!;
    const piece = snapshotBefore.pieces[0]!;

    const light = {
      theme: {
        spaceDefault: { color: "#ffffff" },
        pieceDefault: { color: "#222222" },
      },
    } satisfies BoardAppearanceConfig;

    const dark = {
      theme: {
        spaceDefault: { color: "#222222" },
        pieceDefault: { color: "#eeeeee" },
      },
    } satisfies BoardAppearanceConfig;

    expect(resolveSpaceAppearance(space, light).color).toBe("#ffffff");
    expect(resolveSpaceAppearance(space, dark).color).toBe("#222222");
    expect(resolvePieceAppearance(piece, light).color).toBe("#222222");
    expect(resolvePieceAppearance(piece, dark).color).toBe("#eeeeee");
    expect(board.snapshot()).toEqual(snapshotBefore);
  });
});
