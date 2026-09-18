export { Board, BoardStateError } from "./core/index.js";
export type {
  BoardOptions,
  BoardSnapshot,
  BoardStateErrorCode,
  OccupancyPolicy,
  OccupancyPolicyContext,
  Piece,
  PieceId,
  PiecePlacement,
  Space,
  SpaceId,
} from "./core/index.js";

export { GraphTopology, LinearTopology, SquareGridTopology, TopologyError } from "./topology/index.js";
export type {
  GraphConnectionOptions,
  LinearDirection,
  LinearTopologyOptions,
  OrderedTopology,
  SquareGridCoordinate,
  Topology,
  TopologyErrorCode,
} from "./topology/index.js";

export { MovementError } from "./movement/index.js";
export type {
  MovementErrorCode,
  MovementPath,
  MovementResult,
} from "./movement/index.js";

export {
  allowMovement,
  combineMovementRules,
  evaluateMovementRules,
  rejectMovement,
} from "./movement/index.js";
export type {
  MovementRule,
  MovementRuleAllowed,
  MovementRuleContext,
  MovementRuleRejected,
  MovementRuleResult,
} from "./movement/index.js";
