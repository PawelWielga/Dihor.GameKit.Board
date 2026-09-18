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

export { GraphTopology, LinearTopology, SquareGridTopology, TopologyError } from "./topology/index.js";
export type {
  GraphConnectionOptions,
  LinearDirection,
  LinearTopologyOptions,
  SquareGridCoordinate,
  Topology,
  TopologyErrorCode,
} from "./topology/index.js";
