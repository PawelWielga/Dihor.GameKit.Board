import { describe, expect, it } from "vitest";
import { Object3D } from "three";
import {
  applyThreeAppearanceTransform,
  resolveThreeAppearanceTransform,
} from "../../src/three/index.js";

describe("Three appearance mapping", () => {
  it("maps scalar scale and rotation to renderer-neutral Three transforms", () => {
    expect(
      resolveThreeAppearanceTransform({
        scale: 1.5,
        rotation: Math.PI / 4,
        offset: { x: 0.2, y: 0.3, z: -0.4 },
      }),
    ).toEqual({
      offset: { x: 0.2, y: 0.3, z: -0.4 },
      scale: { x: 1.5, y: 1.5, z: 1.5 },
      rotation: { x: 0, y: Math.PI / 4, z: 0 },
    });
  });

  it("preserves per-axis transforms and applies them relative to the logical anchor", () => {
    const object = new Object3D();
    object.position.set(10, 20, 30);
    object.scale.set(2, 3, 4);
    object.rotation.set(0.1, 0.2, 0.3);

    applyThreeAppearanceTransform(object, {
      offset: { x: 1, y: -2, z: 3 },
      scale: { x: 0.5, y: 2, z: 1.5 },
      rotation: { x: 0.4, y: -0.1, z: 0.2 },
    });

    expect(object.position.toArray()).toEqual([11, 18, 33]);
    expect(object.scale.toArray()).toEqual([1, 6, 6]);
    expect(object.rotation.x).toBeCloseTo(0.5);
    expect(object.rotation.y).toBeCloseTo(0.1);
    expect(object.rotation.z).toBeCloseTo(0.5);
  });

  it("uses identity transforms when appearance does not specify geometry changes", () => {
    expect(resolveThreeAppearanceTransform({ color: "#ffffff" })).toEqual({
      offset: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      rotation: { x: 0, y: 0, z: 0 },
    });
  });
});
