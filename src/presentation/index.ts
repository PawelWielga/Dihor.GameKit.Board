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
