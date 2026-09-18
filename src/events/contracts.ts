import type { PieceId, SpaceId } from "../core/index.js";
import type { MovementPath } from "../movement/index.js";

export const MOVEMENT_EVENT_SCHEMA = "dihor.gamekit.board/movement" as const;
export const MOVEMENT_EVENT_VERSION = 1 as const;

export interface MovementEventState {
  readonly pieceId: PieceId;
  readonly spaceId: SpaceId;
}

interface MovementEventBase {
  readonly schema: typeof MOVEMENT_EVENT_SCHEMA;
  readonly version: typeof MOVEMENT_EVENT_VERSION;
  readonly movementId: string;
  readonly sequence: number;
  readonly pieceId: PieceId;
}

export interface MoveStartedEvent extends MovementEventBase {
  readonly type: "movement.started";
  readonly fromSpaceId: SpaceId;
  readonly toSpaceId: SpaceId;
  readonly path: MovementPath;
  readonly state: MovementEventState;
}

export interface SpaceEnteredEvent extends MovementEventBase {
  readonly type: "movement.space-entered";
  readonly pathIndex: number;
  readonly spaceId: SpaceId;
  readonly state: MovementEventState;
}

export interface MoveCompletedEvent extends MovementEventBase {
  readonly type: "movement.completed";
  readonly fromSpaceId: SpaceId;
  readonly toSpaceId: SpaceId;
  readonly path: MovementPath;
  readonly state: MovementEventState;
}

export type MovementEvent =
  | MoveStartedEvent
  | SpaceEnteredEvent
  | MoveCompletedEvent;

export interface CreateMovementEventsOptions {
  readonly movementId: string;
}
