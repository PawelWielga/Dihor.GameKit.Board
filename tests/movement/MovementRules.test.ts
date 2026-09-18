import { describe, expect, it } from "vitest";
import {
  allowMovement,
  Board,
  combineMovementRules,
  LinearTopology,
  MovementError,
  rejectMovement,
} from "../../src/index.js";
import type {
  MovementRule,
  MovementRuleContext,
} from "../../src/index.js";

function context(): MovementRuleContext {
  const fromSpace = Object.freeze({ id: "a" });
  const toSpace = Object.freeze({ id: "b" });

  return Object.freeze({
    piece: Object.freeze({ id: "pawn" }),
    fromSpace,
    toSpace,
    path: Object.freeze(["a", "b"]),
    visitedSpaces: Object.freeze([fromSpace, toSpace]),
    destinationOccupants: Object.freeze([]),
  });
}

function createBoard(
  movementRules: readonly MovementRule[] = [],
): Board {
  const topology = new LinearTopology(["a", "b", "c"]);
  const board = new Board({ topology, movementRules });

  for (const spaceId of topology.getSpaceIds()) {
    board.addSpace({ id: spaceId });
  }

  return board;
}

describe("MovementRule", () => {
  it("combines rules in declaration order and stops at first rejection", () => {
    const calls: string[] = [];
    const combined = combineMovementRules(
      () => {
        calls.push("first");
        return allowMovement();
      },
      () => {
        calls.push("second");
        return rejectMovement("terrain.blocked", "Blocked terrain.");
      },
      () => {
        calls.push("third");
        return allowMovement();
      },
    );

    expect(combined(context())).toEqual({
      allowed: false,
      reason: "terrain.blocked",
      message: "Blocked terrain.",
    });
    expect(calls).toEqual(["first", "second"]);
  });

  it("requires a non-empty machine-readable rejection reason", () => {
    expect(() => rejectMovement("   ")).toThrow(RangeError);
  });

  it("rejects a board move atomically and exposes the rule reason", () => {
    const rules: MovementRule[] = [
      () => allowMovement(),
      () => rejectMovement("turn.not-owner", "It is another player's turn."),
    ];
    const board = createBoard(rules);
    board.addPiece({ id: "pawn" }, "a");

    let error: unknown;
    try {
      board.moveBy("pawn", 1);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(MovementError);
    expect(error).toMatchObject({
      code: "RULE_REJECTED",
      reason: "turn.not-owner",
      message: "It is another player's turn.",
    });
    expect(board.getPlacement("pawn").spaceId).toBe("a");
    expect(board.getPiecesAt("a").map((piece) => piece.id)).toEqual(["pawn"]);
    expect(board.getPiecesAt("b")).toEqual([]);
  });

  it("provides the full path and destination occupancy to rules", () => {
    const observed: Array<{
      path: readonly string[];
      visited: readonly string[];
      occupants: readonly string[];
    }> = [];

    const rule: MovementRule = ({
      path,
      visitedSpaces,
      destinationOccupants,
    }) => {
      observed.push({
        path,
        visited: visitedSpaces.map((space) => space.id),
        occupants: destinationOccupants.map((piece) => piece.id),
      });
      return allowMovement();
    };

    const board = createBoard([rule]);
    board.addPiece({ id: "blocker" }, "c");
    board.addPiece({ id: "pawn" }, "a");

    const result = board.moveBy("pawn", 2);

    expect(result.path).toEqual(["a", "b", "c"]);
    expect(observed).toEqual([
      {
        path: ["a", "b", "c"],
        visited: ["a", "b", "c"],
        occupants: ["blocker"],
      },
    ]);
  });

  it("evaluates board rules in stable order for successful moves", () => {
    const calls: string[] = [];
    const board = createBoard([
      () => {
        calls.push("first");
        return allowMovement();
      },
      () => {
        calls.push("second");
        return allowMovement();
      },
    ]);
    board.addPiece({ id: "pawn" }, "a");

    board.moveBy("pawn", 1);

    expect(calls).toEqual(["first", "second"]);
    expect(board.getPlacement("pawn").spaceId).toBe("b");
  });
});
