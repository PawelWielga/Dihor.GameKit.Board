import { describe, expect, it } from "vitest";
import {
  Board,
  BoardRenderMode,
  createExplicitSpaceLayout,
  createLinearSpaceLayout,
  createSquareGridSpaceLayout,
  LinearTopology,
  mapPiecesToPresentation,
  PresentationError,
  SquareGridTopology,
} from "../../src/index.js";

describe("presentation layout", () => {
  it("exposes the agreed render modes", () => {
    expect(BoardRenderMode).toEqual({
      TopDown: "top-down",
      FlatBoard3DPieces: "flat-board-3d-pieces",
      Full3D: "full-3d",
    });
  });

  it("maps linear spaces deterministically without touching topology state", () => {
    const topology = new LinearTopology(["start", "a", "finish"]);
    const before = topology.getSpaceIds();

    const layout = createLinearSpaceLayout(topology, {
      spacing: 2.5,
      origin: { x: 10, y: 0.25, z: -3 },
    });

    expect(layout.getSpaces()).toEqual([
      { spaceId: "start", position: { x: 10, y: 0.25, z: -3 } },
      { spaceId: "a", position: { x: 12.5, y: 0.25, z: -3 } },
      { spaceId: "finish", position: { x: 15, y: 0.25, z: -3 } },
    ]);
    expect(topology.getSpaceIds()).toEqual(before);
  });

  it("maps square-grid rows onto the XZ presentation plane", () => {
    const topology = new SquareGridTopology(3, 2);
    const layout = createSquareGridSpaceLayout(topology, {
      cellSize: 4,
      origin: { x: -4, y: 1, z: 10 },
    });

    expect(layout.getPosition("grid:0:0")).toEqual({ x: -4, y: 1, z: 10 });
    expect(layout.getPosition("grid:2:1")).toEqual({ x: 4, y: 1, z: 14 });
  });

  it("supports explicit layout for graph/custom topology presentation", () => {
    const layout = createExplicitSpaceLayout(
      {
        a: { x: 0, z: 0 },
        b: { x: 3, z: -2 },
      },
      { y: 0.5 },
    );

    expect(layout.getPosition("b")).toEqual({ x: 3, y: 0.5, z: -2 });
  });

  it("maps authoritative piece placements without mutating board state", () => {
    const topology = new LinearTopology(["a", "b"]);
    const board = new Board({ topology });
    for (const spaceId of topology.getSpaceIds()) {
      board.addSpace({ id: spaceId });
    }
    board.addPiece({ id: "pawn" }, "a");

    const snapshotBefore = board.snapshot();
    const layout = createLinearSpaceLayout(topology, { spacing: 3 });
    const pieces = mapPiecesToPresentation(snapshotBefore, layout);

    expect(pieces).toEqual([
      {
        pieceId: "pawn",
        spaceId: "a",
        position: { x: 0, y: 0, z: 0 },
      },
    ]);
    expect(board.snapshot()).toEqual(snapshotBefore);
  });

  it("fails explicitly when a placed piece has no mapped position", () => {
    const topology = new LinearTopology(["a", "b"]);
    const board = new Board({ topology });
    for (const spaceId of topology.getSpaceIds()) {
      board.addSpace({ id: spaceId });
    }
    board.addPiece({ id: "pawn" }, "b");

    const layout = createExplicitSpaceLayout({ a: { x: 0, z: 0 } });

    expect(() => mapPiecesToPresentation(board.snapshot(), layout)).toThrowError(
      expect.objectContaining<Partial<PresentationError>>({
        code: "MISSING_SPACE_POSITION",
      }),
    );
  });

  it("rejects non-finite and invalid layout configuration", () => {
    const topology = new LinearTopology(["a"]);

    expect(() => createLinearSpaceLayout(topology, { spacing: 0 })).toThrow(
      RangeError,
    );
    expect(() =>
      createSquareGridSpaceLayout(new SquareGridTopology(1, 1), {
        origin: { x: Number.NaN, y: 0, z: 0 },
      })
    ).toThrow(RangeError);
  });
});
