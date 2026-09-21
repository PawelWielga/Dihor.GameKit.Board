import type {
  BoardSnapshot,
  PieceId,
  SpaceId,
} from "../core/index.js";
import type { MovementResult } from "../movement/index.js";
import type { BoardAppearanceConfig } from "./appearance.js";
import type {
  BoardConnectionAppearance,
  BoardConnectionPresentation,
} from "./connections.js";

export const BoardRenderMode = Object.freeze({
  TopDown: "top-down",
  FlatBoard3DPieces: "flat-board-3d-pieces",
  Full3D: "full-3d",
} as const);

export type BoardRenderMode =
  (typeof BoardRenderMode)[keyof typeof BoardRenderMode];

export interface PresentationPoint3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SpacePresentation {
  readonly spaceId: SpaceId;
  readonly position: PresentationPoint3;
}

export interface SpaceLayout {
  hasSpace(spaceId: SpaceId): boolean;
  getPosition(spaceId: SpaceId): PresentationPoint3;
  getSpaces(): readonly SpacePresentation[];
}

export interface PiecePresentation {
  readonly pieceId: PieceId;
  readonly spaceId: SpaceId;
  readonly position: PresentationPoint3;
}

export interface BoardRenderInput<
  TSpaceData = unknown,
  TPieceData = unknown,
> {
  readonly snapshot: BoardSnapshot<TSpaceData, TPieceData>;
  readonly layout: SpaceLayout;
  readonly movement?: MovementResult;
  readonly appearance?: BoardAppearanceConfig<TSpaceData, TPieceData>;
  readonly connections?: readonly BoardConnectionPresentation[];
  readonly connectionAppearance?: BoardConnectionAppearance;
}

export interface BoardPresentationState<
  TSpaceData = unknown,
  TPieceData = unknown,
> extends BoardRenderInput<TSpaceData, TPieceData> {
  readonly mode: BoardRenderMode;
}

export interface BoardRenderer<
  TTarget = unknown,
  TSpaceData = unknown,
  TPieceData = unknown,
> {
  readonly mode: BoardRenderMode;
  render(
    target: TTarget,
    input: BoardRenderInput<TSpaceData, TPieceData>,
  ): void;
  dispose?(): void | Promise<void>;
}
