import { describe, expect, it } from "vitest";
import {
  Board,
  GraphTopology,
  LinearTopology,
  MovementError,
} from "../../src/index.js";
import type { Topology } from "../../src/index.js";

function createBoard(topology: Topology): Board {
  const board = new Board({ topology });

  for (const spaceId of topology.getSpaceIds()) {
    board.addSpace({ id: spaceId });
  }

  return board;
}

describe("Board movement", () => {
  it("moveTo uses a deterministic shortest path and updates placement", () => {
    const topology = new GraphTopology(["a", "b", "c", "d"]);
    topology.addConnection("a", "b");
    topology.addConnection("a", "c");
    topology.addConnection("b", "d");
    topology.addConnection("c", "d");

    const board = createBoard(topology);
    board.addPiece({ id: "pawn" }, "a");

    const result = board.moveTo("pawn", "d");

    expect(result).toEqual({
      pieceId: "pawn",
      fromSpaceId: "a",
      toSpaceId: "d",
      path: ["a", "b", "d"],
    });
    expect(board.getPlacement("pawn")).toEqual({ pieceId: "pawn", spaceId: "d" });
  });

  it("moveTo treats moving to the current space as a zero-distance move", () => {
    const topology = new GraphTopology(["a"]);
    const board = createBoard(topology);
    board.addPiece({ id: "pawn" }, "a");

    const result = board.moveTo("pawn", "a");

    expect(result.path).toEqual(["a"]);
    expect(result.fromSpaceId).toBe("a");
    expect(result.toSpaceId).toBe("a");
  });

  it("moveTo rejects an unreachable target without changing placement", () => {
    const topology = new GraphTopology(["a", "b"]);
    topology.addConnection("a", "b", { directed: true });

    const board = createBoard(topology);
    board.addPiece({ id: "pawn" }, "b");

    expect(() => board.moveTo("pawn", "a")).toThrowError(
      expect.objectContaining<Partial<MovementError>>({ code: "NO_PATH" }),
    );
    expect(board.getPlacement("pawn").spaceId).toBe("b");
  });

  it("moveBy records every visited space in both directions", () => {
    const topology = new LinearTopology(["a", "b", "c", "d"]);
    const board = createBoard(topology);
    board.addPiece({ id: "pawn" }, "a");

    const forward = board.moveBy("pawn", 3);
    expect(forward.path).toEqual(["a", "b", "c", "d"]);

    const backward = board.moveBy("pawn", -2);
    expect(backward.path).toEqual(["d", "c", "b"]);
    expect(board.getPlacement("pawn").spaceId).toBe("b");
  });

  it("moveBy preserves repeated spaces while traversing a loop", () => {
    const topology = new LinearTopology(["a", "b", "c"], { looping: true });
    const board = createBoard(topology);
    board.addPiece({ id: "pawn" }, "c");

    const result = board.moveBy("pawn", 4);

    expect(result.path).toEqual(["c", "a", "b", "c", "a"]);
    expect(result.toSpaceId).toBe("a");
  });

  it("moveBy treats zero as a successful no-op", () => {
    const topology = new LinearTopology(["a", "b"]);
    const board = createBoard(topology);
    board.addPiece({ id: "pawn" }, "a");

    const result = board.moveBy("pawn", 0);

    expect(result.path).toEqual(["a"]);
    expect(board.getPlacement("pawn").spaceId).toBe("a");
  });

  it("moveBy rejects crossing a track end atomically", () => {
    const topology = new LinearTopology(["a", "b", "c"]);
    const board = createBoard(topology);
    board.addPiece({ id: "pawn" }, "b");

    expect(() => board.moveBy("pawn", 2)).toThrowError(
      expect.objectContaining<Partial<MovementError>>({ code: "OUT_OF_BOUNDS" }),
    );
    expect(board.getPlacement("pawn").spaceId).toBe("b");
  });

  it("moveBy rejects non-integer distances", () => {
    const topology = new LinearTopology(["a", "b"]);
    const board = createBoard(topology);
    board.addPiece({ id: "pawn" }, "a");

    expect(() => board.moveBy("pawn", 1.5)).toThrowError(
      expect.objectContaining<Partial<MovementError>>({ code: "INVALID_DISTANCE" }),
    );
  });

  it("moveBy rejects topologies without ordered traversal", () => {
    const topology = new GraphTopology(["a", "b"]);
    topology.addConnection("a", "b");

    const board = createBoard(topology);
    board.addPiece({ id: "pawn" }, "a");

    expect(() => board.moveBy("pawn", 1)).toThrowError(
      expect.objectContaining<Partial<MovementError>>({ code: "UNSUPPORTED_TOPOLOGY" }),
    );
  });

  it("requires a topology for logical movement", () => {
    const board = new Board();
    board.addSpace({ id: "a" });
    board.addPiece({ id: "pawn" }, "a");

    expect(() => board.moveTo("pawn", "a")).toThrowError(
      expect.objectContaining<Partial<MovementError>>({ code: "TOPOLOGY_REQUIRED" }),
    );
  });
});
