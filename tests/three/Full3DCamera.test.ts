import { describe, expect, it } from "vitest";
import {
  BoardRenderMode,
  createExplicitSpaceLayout,
} from "../../src/index.js";
import {
  Full3DRenderer,
  resolveFull3DCameraOptions,
} from "../../src/three/index.js";

describe("Full3D camera configuration", () => {
  it("centers default camera on the presentation layout", () => {
    const layout = createExplicitSpaceLayout({
      a: { x: 10, z: -4 },
      b: { x: 14, z: 2 },
    });

    const camera = resolveFull3DCameraOptions(layout);

    expect(camera.projection).toBe("perspective");
    expect(camera.target).toEqual({ x: 12, y: 0, z: -1 });
    expect(camera.position.y).toBeGreaterThan(0);
    expect(camera.far).toBeGreaterThan(camera.near);
  });

  it("preserves explicit camera and orthographic settings", () => {
    const layout = createExplicitSpaceLayout({
      a: { x: 0, z: 0 },
      b: { x: 2, z: 2 },
    });

    const camera = resolveFull3DCameraOptions(layout, {
      projection: "orthographic",
      position: { x: 4, y: 8, z: 6 },
      target: { x: 1, y: 0, z: 1 },
      zoom: 1.75,
      orthographicHeight: 9,
      near: 0.25,
      far: 250,
    });

    expect(camera).toMatchObject({
      projection: "orthographic",
      position: { x: 4, y: 8, z: 6 },
      target: { x: 1, y: 0, z: 1 },
      zoom: 1.75,
      orthographicHeight: 9,
      near: 0.25,
      far: 250,
    });
  });

  it("keeps renderer camera state separate from logical board state", () => {
    const renderer = new Full3DRenderer({
      camera: {
        position: { x: 3, y: 7, z: 8 },
        target: { x: 0, y: 0, z: 0 },
      },
    });

    expect(renderer.mode).toBe(BoardRenderMode.Full3D);
    expect(renderer.getCameraOptions()).toEqual({
      position: { x: 3, y: 7, z: 8 },
      target: { x: 0, y: 0, z: 0 },
    });

    renderer.setCameraOptions({
      projection: "orthographic",
      zoom: 2,
    });

    expect(renderer.getCameraOptions()).toEqual({
      projection: "orthographic",
      zoom: 2,
    });
  });

  it("rejects invalid camera values", () => {
    const layout = createExplicitSpaceLayout({ a: { x: 0, z: 0 } });

    expect(() =>
      resolveFull3DCameraOptions(layout, { zoom: 0 })
    ).toThrow(RangeError);

    expect(() =>
      resolveFull3DCameraOptions(layout, { near: 10, far: 2 })
    ).toThrow(RangeError);
  });
});
