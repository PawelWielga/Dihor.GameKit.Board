import type { PieceId, SpaceId } from "./ids.js";
import type { Piece, Space } from "./models.js";

export interface OccupancyPolicyContext<
  TSpaceData = unknown,
  TPieceData = unknown,
> {
  readonly piece: Piece<TPieceData>;
  readonly fromSpaceId?: SpaceId;
  readonly toSpace: Space<TSpaceData>;
  readonly occupants: readonly Piece<TPieceData>[];
  readonly occupantPieceIds: readonly PieceId[];
}

export type OccupancyPolicy<
  TSpaceData = unknown,
  TPieceData = unknown,
> = (context: OccupancyPolicyContext<TSpaceData, TPieceData>) => boolean;
