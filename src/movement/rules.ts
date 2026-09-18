import type { Piece, Space } from "../core/index.js";
import type { MovementPath } from "./models.js";

export interface MovementRuleContext<
  TSpaceData = unknown,
  TPieceData = unknown,
> {
  readonly piece: Piece<TPieceData>;
  readonly fromSpace: Space<TSpaceData>;
  readonly toSpace: Space<TSpaceData>;
  readonly path: MovementPath;
  readonly visitedSpaces: readonly Space<TSpaceData>[];
  readonly destinationOccupants: readonly Piece<TPieceData>[];
}

export interface MovementRuleAllowed {
  readonly allowed: true;
}

export interface MovementRuleRejected {
  readonly allowed: false;
  readonly reason: string;
  readonly message?: string;
}

export type MovementRuleResult =
  | MovementRuleAllowed
  | MovementRuleRejected;

export type MovementRule<
  TSpaceData = unknown,
  TPieceData = unknown,
> = (
  context: MovementRuleContext<TSpaceData, TPieceData>,
) => MovementRuleResult;

const ALLOWED: MovementRuleAllowed = Object.freeze({ allowed: true });

export function allowMovement(): MovementRuleAllowed {
  return ALLOWED;
}

export function rejectMovement(
  reason: string,
  message?: string,
): MovementRuleRejected {
  if (reason.trim().length === 0) {
    throw new RangeError("Movement rejection reason cannot be empty.");
  }

  return Object.freeze({
    allowed: false,
    reason,
    ...(message === undefined ? {} : { message }),
  });
}

export function evaluateMovementRules<
  TSpaceData = unknown,
  TPieceData = unknown,
>(
  rules: readonly MovementRule<TSpaceData, TPieceData>[],
  context: MovementRuleContext<TSpaceData, TPieceData>,
): MovementRuleResult {
  for (const rule of rules) {
    const result = rule(context);
    if (!result.allowed) {
      return result;
    }
  }

  return ALLOWED;
}

export function combineMovementRules<
  TSpaceData = unknown,
  TPieceData = unknown,
>(
  ...rules: readonly MovementRule<TSpaceData, TPieceData>[]
): MovementRule<TSpaceData, TPieceData> {
  const orderedRules = Object.freeze([...rules]);
  return (context) => evaluateMovementRules(orderedRules, context);
}
