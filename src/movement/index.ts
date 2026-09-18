export { MovementError } from "./errors.js";
export type { MovementErrorCode } from "./errors.js";
export {
  calculateMoveByPath,
  calculateMoveToPath,
} from "./paths.js";
export type { MovementPath, MovementResult } from "./models.js";

export {
  allowMovement,
  combineMovementRules,
  evaluateMovementRules,
  rejectMovement,
} from "./rules.js";
export type {
  MovementRule,
  MovementRuleAllowed,
  MovementRuleContext,
  MovementRuleRejected,
  MovementRuleResult,
} from "./rules.js";
