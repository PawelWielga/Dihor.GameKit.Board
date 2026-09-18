import { describe, expect, it } from "vitest";
import { Board, BoardStateError } from "../../src/index.js";

describe("Board", () => {
  it("stores spaces, pieces and the initial placement", () => {
    const board = new Board<{ label: string }, { name: string }>();

    board.addSpace({ id: "start", data: { label: "Start" } });
    board.addPiece({ id: "player-1", data: { name: "Ada" } }, "start");

    expect(board.getPieceSpace("player-1").id).toBe("start");
    expect(board.getPlacement("player-1")).toEqual({ pieceId: "player-1", spaceId: "start" });
    expect(board.snapshot()).toEqual({
      spaces: [{ id: "start", data: { label: "Start" } }],
      pieces: [{ id: "player-1", data: { name: "Ada" } }],
      placements: [{ pieceId: "player-1", spaceId: "start" }],
    });
  });

  it("rejects duplicate space identifiers", () => {
    const board = new Board();
    board.addSpace({ id: "a" });

    expect(() => board.addSpace({ id: "a" })).toThrowError(
      expect.objectContaining<Partial<BoardStateError>>({ code: "DUPLICATE_SPACE" }),
    );
  });

  it("rejects duplicate piece identifiers", () => {
    const board = new Board();
    board.addSpace({ id: "a" });
    board.addPiece({ id: "pawn" }, "a");

    expect(() => board.addPiece({ id: "pawn" }, "a")).toThrowError(
      expect.objectContaining<Partial<BoardStateError>>({ code: "DUPLICATE_PIECE" }),
    );
  });

  it("rejects placement on an unknown space", () => {
    const board = new Board();

    expect(() => board.addPiece({ id: "pawn" }, "missing")).toThrowError(
      expect.objectContaining<Partial<BoardStateError>>({ code: "UNKNOWN_SPACE" }),
    );
  });

  it("rejects removal of an occupied space", () => {
    const board = new Board();
    board.addSpace({ id: "a" });
    board.addPiece({ id: "pawn" }, "a");

    expect(() => board.removeSpace("a")).toThrowError(
      expect.objectContaining<Partial<BoardStateError>>({ code: "SPACE_OCCUPIED" }),
    );
  });

  it("removes a piece and its placement together", () => {
    const board = new Board();
    board.addSpace({ id: "a" });
    board.addPiece({ id: "pawn" }, "a");

    expect(board.removePiece("pawn")).toBe(true);
    expect(board.hasPiece("pawn")).toBe(false);
    expect(() => board.getPlacement("pawn")).toThrowError(
      expect.objectContaining<Partial<BoardStateError>>({ code: "UNKNOWN_PIECE" }),
    );
    expect(board.removeSpace("a")).toBe(true);
  });
});
