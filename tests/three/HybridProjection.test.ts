import { describe, expect, it } from "vitest";
import {
  OrthographicCamera,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import {
  createExplicitSpaceLayout,
} from "../../src/index.js";
import {
  calculateHybridLayoutFrame,
  estimateHybridTileSize,
  projectPresentationPointToNdc,
} from "../../src/three/index.js";

describe("hybrid projection", () => {
  it("fits layouts while preserving viewport aspect ratio", () => {
    const layout = createExplicitSpaceLayout({
      a: { x: -4, z: -2 },
      b: { x: 4, z: 2 },
    });

    const wide = calculateHybridLayoutFrame(layout, {
      width: 1200,
      height: 600,
    });
    const tall = calculateHybridLayoutFrame(layout, {
      width: 600,
      height: 1200,
    });

    expect(wide.halfWidth / wide.halfHeight).toBeCloseTo(2);
    expect(tall.halfWidth / tall.halfHeight).toBeCloseTo(0.5);

    for (const frame of [wide, tall]) {
      for (const space of layout.getSpaces()) {
        const ndc = projectPresentationPointToNdc(space.position, frame);
        expect(Math.abs(ndc.x)).toBeLessThan(1);
        expect(Math.abs(ndc.y)).toBeLessThan(1);
      }
    }
  });

  it("uses the exact same screen coordinates as the flat orthographic pass", () => {
    const layout = createExplicitSpaceLayout({
      a: { x: -3, z: -1 },
      b: { x: 0, z: 2 },
      c: { x: 4, z: -2 },
    });

    for (const viewport of [
      { width: 960, height: 540 },
      { width: 540, height: 960 },
    ]) {
      const frame = calculateHybridLayoutFrame(layout, viewport);
      const camera = new OrthographicCamera(
        -frame.halfWidth,
        frame.halfWidth,
        frame.halfHeight,
        -frame.halfHeight,
        0.1,
        100,
      );
      camera.position.set(frame.centerX, -frame.centerZ, 10);
      camera.lookAt(frame.centerX, -frame.centerZ, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      for (const space of layout.getSpaces()) {
        const expected = projectPresentationPointToNdc(space.position, frame);
        const projected = new Vector3(
          space.position.x,
          -space.position.z,
          0,
        ).project(camera);

        expect(projected.x).toBeCloseTo(expected.x, 8);
        expect(projected.y).toBeCloseTo(expected.y, 8);
      }
    }
  });

  it("maps board NDC points to the 3D ground plane without screen drift", () => {
    const layout = createExplicitSpaceLayout({
      left: { x: -2, z: 1 },
      right: { x: 2, z: -1 },
    });
    const frame = calculateHybridLayoutFrame(layout, {
      width: 900,
      height: 600,
    });

    const camera = new PerspectiveCamera(36, 900 / 600, 0.1, 100);
    camera.position.set(0, 6.5, 8.5);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    const raycaster = new Raycaster();
    const groundPlane = new Plane(new Vector3(0, 1, 0), 0);

    for (const space of layout.getSpaces()) {
      const expected = projectPresentationPointToNdc(space.position, frame);
      raycaster.setFromCamera(new Vector2(expected.x, expected.y), camera);

      const ground = new Vector3();
      expect(raycaster.ray.intersectPlane(groundPlane, ground)).not.toBeNull();

      const reprojected = ground.clone().project(camera);
      expect(reprojected.x).toBeCloseTo(expected.x, 8);
      expect(reprojected.y).toBeCloseTo(expected.y, 8);
    }
  });

  it("derives stable tile size from presentation spacing", () => {
    const layout = createExplicitSpaceLayout({
      a: { x: 0, z: 0 },
      b: { x: 2, z: 0 },
      c: { x: 4, z: 0 },
    });

    expect(estimateHybridTileSize(layout)).toBeCloseTo(1.36);
  });

  it("rejects invalid viewports", () => {
    const layout = createExplicitSpaceLayout({ a: { x: 0, z: 0 } });

    expect(() =>
      calculateHybridLayoutFrame(layout, { width: 0, height: 500 })
    ).toThrow(RangeError);
  });
});
