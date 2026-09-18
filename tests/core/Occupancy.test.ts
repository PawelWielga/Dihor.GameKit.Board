import { describe, expect, it } from "vitest";
import {
  Board,
  BoardStateError,
  LinearTopology,
} from "../../src/index.js";
import type { OccupancyPolicy } from "../../src/index.js";

function createTrackBoard(
  occupancyPolicy?: OccupancyPolicy,
): Board {
  const topology = new LinearTopology(["a", "b", "c"]);
  const board = new Board({ topology, occupancyPolicy });

  for (const spaceId of topology.getSpaceIds()) {
    board.addSpace({ id: spaceId });
  }

  return board;
}

describe("Board occupancy", () => {
  it("allows multiple pieces on one space by default", () => {
    const board = createTrackBoard();

    board.addPiece({ id: "one" }, "a");
    board.addPiece({ id: "two" }, "a");

    expect(board.isSpaceOccupied("a")).toBe(true);
    expect(board.getPiecesAt("a").map((piece) => piece.id)).toEqual(["one", "two"]);
  });

  it("keeps occupancy queries consistent after piece removal", () => {
    const board = createTrackBoard();

    board.addPiece({ id: "one" }, "a");
    board.addPiece({ id: "two" }, "a");

    expect(board.removePiece("one")).toBe(true);
    expect(board.getPiecesAt("a").map((piece) => piece.id)).toEqual(["two"]);

    expect(board.removePiece("two")).toBe(true);
    expect(board.getPiecesAt("a")).toEqual([]);
    expect(board.isSpaceOccupied("a")).toBe(false);
  });

  it("keeps occupancy indexes consistent after movement", () => {
    const board = createTrackBoard();
    board.addPiece({ id: "pawn" }, "a");

    board.moveBy("pawn", 2);

    expect(board.getPiecesAt("a")).toEqual([]);
    expect(board.getPiecesAt("c").map((piece) => piece.id)).toEqual(["pawn"]);
    expect(board.isSpaceOccupied("a")).toBe(false);
    expect(board.isSpaceOccupied("c")).toBe(true);
  });

  it("lets an occupancy policy reject an added piece", () => {
    const singleOccupancy: OccupancyPolicy = ({ occupants }) => occupants.length === 0;
    const board = createTrackBoard(singleOccupancy);

    board.addPiece({ id: "one" }, "a");

    expect(() => board.addPiece({ id: "two" }, "a")).toThrowError(
      expect.objectContaining<Partial<BoardStateError>>({
        code: "OCCUPANCY_REJECTED",
      }),
    );

    expect(board.hasPiece("two")).toBe(false);
    expect(board.getPiecesAt("a").map((piece) => piece.id)).toEqual(["one"]);
  });

  it("rejects movement into a disallowed occupied destination atomically", () => {
    const singleOccupancy: OccupancyPolicy = ({ occupants }) => occupants.length === 0;
    const board = createTrackBoard(singleOccupancy);

    board.addPiece({ id: "one" }, "a");
    board.addPiece({ id: "two" }, "b");

    expect(() => board.moveBy("one", 1)).toThrowError(
      expect.objectContaining<Partial<BoardStateError>>({
        code: "OCCUPANCY_REJECTED",
      }),
    );

    expect(board.getPlacement("one").spaceId).toBe("a");
    expect(board.getPiecesAt("a").map((piece) => piece.id)).toEqual(["one"]);
    expect(board.getPiecesAt("b").map((piece) => piece.id)).toEqual(["two"]);
  });

  it("excludes the moving piece from destination occupants", () => {
    const observedOccupants: string[][] = [];
    const policy: OccupancyPolicy = ({ occupants }) => {
      observedOccupants.push(occupants.map((piece) => piece.id));
      return occupants.length === 0;
    };

    const board = createTrackBoard(policy);
    board.addPiece({ id: "pawn" }, "a");

    expect(() => board.moveBy("pawn", 0)).not.toThrow();
    expect(observedOccupants).toEqual([[], []]);
  });

  it("provides movement context to the policy", () => {
    const calls: Array<{ from?: string; to: string }> = [];
    const policy: OccupancyPolicy = ({ fromSpaceId, toSpace }) => {
      calls.push({ from: fromSpaceId, to: toSpace.id });
      return true;
    };

    const board = createTrackBoard(policy);
    board.addPiece({ id: "pawn" }, "a");
    board.moveBy("pawn", 1);

    expect(calls).toEqual([
      { from: undefined, to: "a" },
      { from: "a", to: "b" },
    ]);
  });
});
