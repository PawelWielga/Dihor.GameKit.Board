import {
  calculateMoveByPath,
  calculateMoveToPath,
  evaluateMovementRules,
  MovementError,
} from "../movement/index.js";
import type {
  MovementPath,
  MovementResult,
  MovementRule,
} from "../movement/index.js";
import type { Topology } from "../topology/index.js";
import { BoardStateError } from "./errors.js";
import type { PieceId, SpaceId } from "./ids.js";
import type { BoardSnapshot, Piece, PiecePlacement, Space } from "./models.js";
import type { OccupancyPolicy } from "./occupancy.js";

export interface BoardOptions<
  TSpaceData = unknown,
  TPieceData = unknown,
> {
  readonly topology?: Topology;
  readonly occupancyPolicy?: OccupancyPolicy<TSpaceData, TPieceData>;
  readonly movementRules?: readonly MovementRule<TSpaceData, TPieceData>[];
}

export class Board<TSpaceData = unknown, TPieceData = unknown> {
  readonly #spaces = new Map<SpaceId, Space<TSpaceData>>();
  readonly #pieces = new Map<PieceId, Piece<TPieceData>>();
  readonly #placements = new Map<PieceId, SpaceId>();
  readonly #pieceIdsBySpace = new Map<SpaceId, Set<PieceId>>();
  readonly #occupancyPolicy?: OccupancyPolicy<TSpaceData, TPieceData>;
  readonly #movementRules: readonly MovementRule<TSpaceData, TPieceData>[];

  public readonly topology?: Topology;

  public constructor(options: BoardOptions<TSpaceData, TPieceData> = {}) {
    this.topology = options.topology;
    this.#occupancyPolicy = options.occupancyPolicy;
    this.#movementRules = Object.freeze([...(options.movementRules ?? [])]);
  }

  public addSpace(space: Space<TSpaceData>): Space<TSpaceData> {
    if (this.#spaces.has(space.id)) {
      throw new BoardStateError("DUPLICATE_SPACE", `Space '${space.id}' already exists.`);
    }

    const stored = Object.freeze({ ...space });
    this.#spaces.set(stored.id, stored);
    this.#pieceIdsBySpace.set(stored.id, new Set());
    return stored;
  }

  public removeSpace(spaceId: SpaceId): boolean {
    if (!this.#spaces.has(spaceId)) {
      return false;
    }

    const occupantIds = this.#pieceIdsBySpace.get(spaceId);
    if (occupantIds !== undefined && occupantIds.size > 0) {
      throw new BoardStateError(
        "SPACE_OCCUPIED",
        `Space '${spaceId}' cannot be removed while it contains a piece.`,
      );
    }

    this.#pieceIdsBySpace.delete(spaceId);
    return this.#spaces.delete(spaceId);
  }

  public addPiece(piece: Piece<TPieceData>, spaceId: SpaceId): Piece<TPieceData> {
    if (this.#pieces.has(piece.id)) {
      throw new BoardStateError("DUPLICATE_PIECE", `Piece '${piece.id}' already exists.`);
    }

    this.#requireSpace(spaceId);

    const stored = Object.freeze({ ...piece });
    this.#assertOccupancyAllowed(stored, undefined, spaceId);

    this.#pieces.set(stored.id, stored);
    this.#placements.set(stored.id, spaceId);
    this.#requireOccupantIds(spaceId).add(stored.id);
    return stored;
  }

  public removePiece(pieceId: PieceId): boolean {
    const spaceId = this.#placements.get(pieceId);
    if (spaceId === undefined || !this.#pieces.delete(pieceId)) {
      return false;
    }

    this.#placements.delete(pieceId);
    this.#requireOccupantIds(spaceId).delete(pieceId);
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

  public getPiecesAt(spaceId: SpaceId): readonly Piece<TPieceData>[] {
    this.#requireSpace(spaceId);

    return [...this.#requireOccupantIds(spaceId)].map((pieceId) => {
      const piece = this.#pieces.get(pieceId);
      if (piece === undefined) {
        throw new Error(
          `Board occupancy is inconsistent: piece '${pieceId}' is missing.`,
        );
      }

      return piece;
    });
  }

  public isSpaceOccupied(spaceId: SpaceId): boolean {
    this.#requireSpace(spaceId);
    return this.#requireOccupantIds(spaceId).size > 0;
  }

  public moveTo(pieceId: PieceId, toSpaceId: SpaceId): MovementResult {
    const fromSpaceId = this.getPlacement(pieceId).spaceId;
    this.#requireSpace(toSpaceId);

    const path = calculateMoveToPath(
      this.#requireMovementTopology(),
      fromSpaceId,
      toSpaceId,
    );

    return this.#applyMovement(pieceId, fromSpaceId, path);
  }

  public moveBy(pieceId: PieceId, distance: number): MovementResult {
    const fromSpaceId = this.getPlacement(pieceId).spaceId;
    const path = calculateMoveByPath(
      this.#requireMovementTopology(),
      fromSpaceId,
      distance,
    );

    return this.#applyMovement(pieceId, fromSpaceId, path);
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

  #applyMovement(
    pieceId: PieceId,
    fromSpaceId: SpaceId,
    path: MovementPath,
  ): MovementResult {
    if (path.length === 0 || path[0] !== fromSpaceId) {
      throw new MovementError(
        "INVALID_TOPOLOGY",
        "Movement path must start at the piece's current space.",
      );
    }

    for (const spaceId of path) {
      this.#requireSpace(spaceId);
    }

    const toSpaceId = path[path.length - 1];
    if (toSpaceId === undefined) {
      throw new MovementError("INVALID_TOPOLOGY", "Movement path cannot be empty.");
    }

    const piece = this.#requirePiece(pieceId);
    this.#assertMovementRules(piece, fromSpaceId, toSpaceId, path);
    this.#assertOccupancyAllowed(piece, fromSpaceId, toSpaceId);

    if (toSpaceId !== fromSpaceId) {
      this.#requireOccupantIds(fromSpaceId).delete(pieceId);
      this.#requireOccupantIds(toSpaceId).add(pieceId);
      this.#placements.set(pieceId, toSpaceId);
    }

    return Object.freeze({
      pieceId,
      fromSpaceId,
      toSpaceId,
      path,
    });
  }

  #assertMovementRules(
    piece: Piece<TPieceData>,
    fromSpaceId: SpaceId,
    toSpaceId: SpaceId,
    path: MovementPath,
  ): void {
    if (this.#movementRules.length === 0) {
      return;
    }

    const destinationOccupants = this.getPiecesAt(toSpaceId).filter(
      (occupant) => occupant.id !== piece.id,
    );
    const result = evaluateMovementRules(
      this.#movementRules,
      Object.freeze({
        piece,
        fromSpace: this.#requireSpace(fromSpaceId),
        toSpace: this.#requireSpace(toSpaceId),
        path,
        visitedSpaces: Object.freeze(
          path.map((spaceId) => this.#requireSpace(spaceId)),
        ),
        destinationOccupants: Object.freeze(destinationOccupants),
      }),
    );

    if (!result.allowed) {
      throw new MovementError(
        "RULE_REJECTED",
        result.message ?? `Movement rejected by rule reason '${result.reason}'.`,
        result.reason,
      );
    }
  }

  #assertOccupancyAllowed(
    piece: Piece<TPieceData>,
    fromSpaceId: SpaceId | undefined,
    toSpaceId: SpaceId,
  ): void {
    if (this.#occupancyPolicy === undefined) {
      return;
    }

    const occupants = this.getPiecesAt(toSpaceId).filter(
      (occupant) => occupant.id !== piece.id,
    );
    const allowed = this.#occupancyPolicy(Object.freeze({
      piece,
      fromSpaceId,
      toSpace: this.#requireSpace(toSpaceId),
      occupants: Object.freeze(occupants),
      occupantPieceIds: Object.freeze(occupants.map((occupant) => occupant.id)),
    }));

    if (!allowed) {
      throw new BoardStateError(
        "OCCUPANCY_REJECTED",
        `Occupancy policy rejected piece '${piece.id}' on space '${toSpaceId}'.`,
      );
    }
  }

  #requireMovementTopology(): Topology {
    if (this.topology === undefined) {
      throw new MovementError(
        "TOPOLOGY_REQUIRED",
        "Board movement requires a topology.",
      );
    }

    return this.topology;
  }

  #requirePiece(pieceId: PieceId): Piece<TPieceData> {
    const piece = this.#pieces.get(pieceId);
    if (piece === undefined) {
      throw new BoardStateError("UNKNOWN_PIECE", `Piece '${pieceId}' does not exist.`);
    }

    return piece;
  }

  #requireSpace(spaceId: SpaceId): Space<TSpaceData> {
    const space = this.#spaces.get(spaceId);
    if (space === undefined) {
      throw new BoardStateError("UNKNOWN_SPACE", `Space '${spaceId}' does not exist.`);
    }

    return space;
  }

  #requireOccupantIds(spaceId: SpaceId): Set<PieceId> {
    const occupantIds = this.#pieceIdsBySpace.get(spaceId);
    if (occupantIds === undefined) {
      throw new Error(
        `Board occupancy is inconsistent: space '${spaceId}' has no occupancy index.`,
      );
    }

    return occupantIds;
  }
}
