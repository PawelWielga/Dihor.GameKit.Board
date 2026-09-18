import type { PieceId, SpaceId } from "./ids.js";

export interface Space<TData = unknown> {
  readonly id: SpaceId;
  readonly data?: TData;
}

export interface Piece<TData = unknown> {
  readonly id: PieceId;
  readonly data?: TData;
}

export interface PiecePlacement {
  readonly pieceId: PieceId;
  readonly spaceId: SpaceId;
}

export interface BoardSnapshot<TSpaceData = unknown, TPieceData = unknown> {
  readonly spaces: readonly Space<TSpaceData>[];
  readonly pieces: readonly Piece<TPieceData>[];
  readonly placements: readonly PiecePlacement[];
}
