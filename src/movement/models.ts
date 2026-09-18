import type { PieceId, SpaceId } from "../core/index.js";

export type MovementPath = readonly SpaceId[];

export interface MovementResult {
  readonly pieceId: PieceId;
  readonly fromSpaceId: SpaceId;
  readonly toSpaceId: SpaceId;
  readonly path: MovementPath;
}
