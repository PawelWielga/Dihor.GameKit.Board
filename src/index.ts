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

export {
  createMovementEvents,
  MOVEMENT_EVENT_SCHEMA,
  MOVEMENT_EVENT_VERSION,
} from "./events/index.js";
export type {
  CreateMovementEventsOptions,
  MoveCompletedEvent,
  MovementEvent,
  MovementEventState,
  MoveStartedEvent,
  SpaceEnteredEvent,
} from "./events/index.js";

export {
  AppearanceState,
  BoardRenderMode,
  createExplicitSpaceLayout,
  createLinearSpaceLayout,
  createSpaceLayout,
  createSquareGridSpaceLayout,
  DEFAULT_PIECE_APPEARANCE,
  DEFAULT_SPACE_APPEARANCE,
  mapPiecesToPresentation,
  PresentationError,
  RendererAssetCache,
  RendererAssetKind,
  resolvePieceAppearance,
  resolveSpaceAppearance,
} from "./presentation/index.js";
export type {
  AppearanceAssignment,
  AppearanceDefinition,
  AppearanceLabel,
  AppearanceVisual,
  BoardAppearanceConfig,
  BoardAppearanceTheme,
  BoardPresentationState,
  BoardRenderer,
  BoardRenderInput,
  ExplicitLayoutOptions,
  LinearLayoutOptions,
  PieceAppearance,
  PieceAppearanceResolver,
  PieceAppearanceResolverContext,
  PiecePresentation,
  PresentationEntityState,
  PresentationErrorCode,
  PresentationPoint3,
  RendererAssetCacheOptions,
  RendererAssetEntity,
  RendererAssetHandle,
  RendererAssetLoadResult,
  RendererAssetProvider,
  RendererAssetRequest,
  RendererAssetSnapshot,
  RendererAssetStatus,
  SpaceAppearance,
  SpaceAppearanceResolver,
  SpaceAppearanceResolverContext,
  SpaceLayout,
  SpacePositionEntry,
  SpacePresentation,
  SquareGridLayoutOptions,
} from "./presentation/index.js";
