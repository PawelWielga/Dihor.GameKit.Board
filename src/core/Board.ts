import { BoardStateError } from "./errors.js";
import type { PieceId, SpaceId } from "./ids.js";
import type { BoardSnapshot, Piece, PiecePlacement, Space } from "./models.js";

export class Board<TSpaceData = unknown, TPieceData = unknown> {
  readonly #spaces = new Map<SpaceId, Space<TSpaceData>>();
  readonly #pieces = new Map<PieceId, Piece<TPieceData>>();
  readonly #placements = new Map<PieceId, SpaceId>();

  public addSpace(space: Space<TSpaceData>): Space<TSpaceData> {
    if (this.#spaces.has(space.id)) {
      throw new BoardStateError("DUPLICATE_SPACE", `Space '${space.id}' already exists.`);
    }

    const stored = Object.freeze({ ...space });
    this.#spaces.set(stored.id, stored);
    return stored;
  }

  public removeSpace(spaceId: SpaceId): boolean {
    if (!this.#spaces.has(spaceId)) {
      return false;
    }

    for (const placedSpaceId of this.#placements.values()) {
      if (placedSpaceId === spaceId) {
        throw new BoardStateError(
          "SPACE_OCCUPIED",
          `Space '${spaceId}' cannot be removed while it contains a piece.`,
        );
      }
    }

    return this.#spaces.delete(spaceId);
  }

  public addPiece(piece: Piece<TPieceData>, spaceId: SpaceId): Piece<TPieceData> {
    if (this.#pieces.has(piece.id)) {
      throw new BoardStateError("DUPLICATE_PIECE", `Piece '${piece.id}' already exists.`);
    }

    this.#requireSpace(spaceId);

    const stored = Object.freeze({ ...piece });
    this.#pieces.set(stored.id, stored);
    this.#placements.set(stored.id, spaceId);
    return stored;
  }

  public removePiece(pieceId: PieceId): boolean {
    if (!this.#pieces.delete(pieceId)) {
      return false;
    }

    this.#placements.delete(pieceId);
    return true;
  }

  public hasSpace(spaceId: SpaceId): boolean {
    return this.#spaces.has(spaceId);
  }

  public hasPiece(pieceId: PieceId): boolean {
    return this.#pieces.has(pieceId);
  }

  public getSpace(spaceId: SpaceId): Space<TSpaceData> | undefined {
    return this.#spaces.get(spaceId);
  }

  public getPiece(pieceId: PieceId): Piece<TPieceData> | undefined {
    return this.#pieces.get(pieceId);
  }

  public getPieceSpace(pieceId: PieceId): Space<TSpaceData> {
    const spaceId = this.#placements.get(pieceId);
    if (spaceId === undefined) {
      throw new BoardStateError("UNKNOWN_PIECE", `Piece '${pieceId}' does not exist.`);
    }

    return this.#requireSpace(spaceId);
  }

  public getPlacement(pieceId: PieceId): PiecePlacement {
    const spaceId = this.#placements.get(pieceId);
    if (spaceId === undefined) {
      throw new BoardStateError("UNKNOWN_PIECE", `Piece '${pieceId}' does not exist.`);
    }

    return Object.freeze({ pieceId, spaceId });
  }

  public getSpaces(): readonly Space<TSpaceData>[] {
    return [...this.#spaces.values()];
  }

  public getPieces(): readonly Piece<TPieceData>[] {
    return [...this.#pieces.values()];
  }

  public snapshot(): BoardSnapshot<TSpaceData, TPieceData> {
    return {
      spaces: this.getSpaces(),
      pieces: this.getPieces(),
      placements: [...this.#placements].map(([pieceId, spaceId]) => ({ pieceId, spaceId })),
    };
  }

  #requireSpace(spaceId: SpaceId): Space<TSpaceData> {
    const space = this.#spaces.get(spaceId);
    if (space === undefined) {
      throw new BoardStateError("UNKNOWN_SPACE", `Space '${spaceId}' does not exist.`);
    }

    return space;
  }
}
