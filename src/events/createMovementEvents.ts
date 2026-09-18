import type { MovementResult } from "../movement/index.js";
import {
  MOVEMENT_EVENT_SCHEMA,
  MOVEMENT_EVENT_VERSION,
} from "./contracts.js";
import type {
  CreateMovementEventsOptions,
  MoveCompletedEvent,
  MovementEvent,
  MovementEventState,
  MoveStartedEvent,
  SpaceEnteredEvent,
} from "./contracts.js";

export function createMovementEvents(
  result: MovementResult,
  options: CreateMovementEventsOptions,
): readonly MovementEvent[] {
  const movementId = options.movementId.trim();
  if (movementId.length === 0) {
    throw new RangeError("Movement event movementId cannot be empty.");
  }

  if (
    result.path.length === 0
    || result.path[0] !== result.fromSpaceId
    || result.path[result.path.length - 1] !== result.toSpaceId
  ) {
    throw new RangeError(
      "Movement result path must contain matching start and destination spaces.",
    );
  }

  const path = Object.freeze([...result.path]);
  const events: MovementEvent[] = [];

  const started: MoveStartedEvent = Object.freeze({
    schema: MOVEMENT_EVENT_SCHEMA,
    version: MOVEMENT_EVENT_VERSION,
    type: "movement.started",
    movementId,
    sequence: 0,
    pieceId: result.pieceId,
    fromSpaceId: result.fromSpaceId,
    toSpaceId: result.toSpaceId,
    path,
    state: createState(result.pieceId, result.fromSpaceId),
  });
  events.push(started);

  for (let pathIndex = 1; pathIndex < path.length; pathIndex += 1) {
    const spaceId = path[pathIndex];
    if (spaceId === undefined) {
      throw new RangeError("Movement path contains an invalid space.");
    }

    const entered: SpaceEnteredEvent = Object.freeze({
      schema: MOVEMENT_EVENT_SCHEMA,
      version: MOVEMENT_EVENT_VERSION,
      type: "movement.space-entered",
      movementId,
      sequence: pathIndex,
      pieceId: result.pieceId,
      pathIndex,
      spaceId,
      state: createState(result.pieceId, spaceId),
    });
    events.push(entered);
  }

  const completed: MoveCompletedEvent = Object.freeze({
    schema: MOVEMENT_EVENT_SCHEMA,
    version: MOVEMENT_EVENT_VERSION,
    type: "movement.completed",
    movementId,
    sequence: path.length,
    pieceId: result.pieceId,
    fromSpaceId: result.fromSpaceId,
    toSpaceId: result.toSpaceId,
    path,
    state: createState(result.pieceId, result.toSpaceId),
  });
  events.push(completed);

  return Object.freeze(events);
}

function createState(
  pieceId: MovementResult["pieceId"],
  spaceId: MovementResult["toSpaceId"],
): MovementEventState {
  return Object.freeze({ pieceId, spaceId });
}
