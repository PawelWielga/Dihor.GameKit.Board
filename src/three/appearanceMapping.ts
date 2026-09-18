import type { Object3D } from "three";
import type {
  AppearanceVisual,
  PresentationPoint3,
} from "../presentation/index.js";

export interface ThreeAppearanceTransform {
  readonly offset: PresentationPoint3;
  readonly scale: PresentationPoint3;
  readonly rotation: PresentationPoint3;
}

const ZERO: PresentationPoint3 = Object.freeze({ x: 0, y: 0, z: 0 });
const ONE: PresentationPoint3 = Object.freeze({ x: 1, y: 1, z: 1 });

export function resolveThreeAppearanceTransform(
  appearance: AppearanceVisual,
): ThreeAppearanceTransform {
  return {
    offset: appearance.offset ?? ZERO,
    scale: typeof appearance.scale === "number"
      ? {
          x: appearance.scale,
          y: appearance.scale,
          z: appearance.scale,
        }
      : appearance.scale ?? ONE,
    rotation: typeof appearance.rotation === "number"
      ? {
          x: 0,
          y: appearance.rotation,
          z: 0,
        }
      : appearance.rotation ?? ZERO,
  };
}

export function applyThreeAppearanceTransform(
  object: Object3D,
  appearance: AppearanceVisual,
): void {
  const transform = resolveThreeAppearanceTransform(appearance);

  object.position.x += transform.offset.x;
  object.position.y += transform.offset.y;
  object.position.z += transform.offset.z;

  object.scale.x *= transform.scale.x;
  object.scale.y *= transform.scale.y;
  object.scale.z *= transform.scale.z;

  object.rotation.x += transform.rotation.x;
  object.rotation.y += transform.rotation.y;
  object.rotation.z += transform.rotation.z;
}
