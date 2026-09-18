import type {
  Material,
  Object3D,
  Texture,
} from "three";
import type { PieceId, SpaceId } from "../core/index.js";
import type {
  PieceAppearance,
  RendererAssetProvider,
  SpaceAppearance,
} from "../presentation/index.js";

export interface ThreeTextureAsset {
  readonly type: "texture";
  readonly texture: Texture;
}

export interface ThreeMaterialAsset {
  readonly type: "material";
  readonly material: Material;
}

export interface ThreeModelAsset {
  readonly type: "model";
  create(): Object3D | Promise<Object3D>;
}

export interface ThreePieceVisualFactoryContext {
  readonly pieceId: PieceId;
  readonly appearance: PieceAppearance;
}

export interface ThreeSpaceVisualFactoryContext {
  readonly spaceId: SpaceId;
  readonly appearance: SpaceAppearance;
}

export interface ThreePieceVisualAsset {
  readonly type: "piece-visual";
  create(
    context: ThreePieceVisualFactoryContext,
  ): Object3D | Promise<Object3D>;
}

export interface ThreeSpaceVisualAsset {
  readonly type: "space-visual";
  create(
    context: ThreeSpaceVisualFactoryContext,
  ): Object3D | Promise<Object3D>;
}

export type ThreeBoardAsset =
  | ThreeTextureAsset
  | ThreeMaterialAsset
  | ThreeModelAsset
  | ThreePieceVisualAsset
  | ThreeSpaceVisualAsset;

export type ThreeBoardAssetProvider = RendererAssetProvider<ThreeBoardAsset>;
