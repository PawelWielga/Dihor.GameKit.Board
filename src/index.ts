export { Board, BoardStateError } from "./core/index.js";
export type {
  BoardSnapshot,
  BoardStateErrorCode,
  Piece,
  PieceId,
  PiecePlacement,
  Space,
  SpaceId,
} from "./core/index.js";

export { GraphTopology, LinearTopology, TopologyError } from "./topology/index.js";
export type {
  GraphConnectionOptions,
  LinearDirection,
  LinearTopologyOptions,
  Topology,
  TopologyErrorCode,
} from "./topology/index.js";
