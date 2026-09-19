export {
  AppearanceAssetKind,
  AppearanceState,
  DEFAULT_PIECE_APPEARANCE,
  DEFAULT_SPACE_APPEARANCE,
  resolvePieceAppearance,
  resolveSpaceAppearance,
} from "./appearance.js";
export type {
  AppearanceAssetKind,
  AppearanceAssignment,
  AppearanceDefinition,
  AppearanceLabel,
  AppearanceVisual,
  BoardAppearanceConfig,
  BoardAppearanceTheme,
  PieceAppearance,
  PieceAppearanceResolver,
  PieceAppearanceResolverContext,
  PresentationEntityState,
  SpaceAppearance,
  SpaceAppearanceResolver,
  SpaceAppearanceResolverContext,
} from "./appearance.js";
export {
  RendererAssetCache,
  RendererAssetKind,
} from "./assets.js";
export type {
  RendererAssetCacheOptions,
  RendererAssetEntity,
  RendererAssetHandle,
  RendererAssetLoadResult,
  RendererAssetProvider,
  RendererAssetRequest,
  RendererAssetSnapshot,
  RendererAssetStatus,
} from "./assets.js";
export { BoardRenderMode } from "./contracts.js";
export type {
  BoardPresentationState,
  BoardRenderer,
  BoardRenderInput,
  PiecePresentation,
  PresentationPoint3,
  SpaceLayout,
  SpacePresentation,
} from "./contracts.js";
export { PresentationError } from "./errors.js";
export type { PresentationErrorCode } from "./errors.js";
export {
  createSpaceLayout,
  mapPiecesToPresentation,
} from "./layout.js";
export type { SpacePositionEntry } from "./layout.js";
export {
  createExplicitSpaceLayout,
  createLinearSpaceLayout,
  createSquareGridSpaceLayout,
} from "./mappers.js";
export type {
  ExplicitLayoutOptions,
  LinearLayoutOptions,
  SquareGridLayoutOptions,
} from "./mappers.js";
