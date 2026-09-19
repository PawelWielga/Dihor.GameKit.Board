import { describe, expect, it, vi } from "vitest";
import {
  RendererTargetLifecycle,
  type RendererTargetOwner,
} from "../../demo/rendererTargetLifecycle.js";

describe("RendererTargetLifecycle", () => {
  it("disposes the previous target before a rerender replaces it", () => {
    const disposeTarget = vi.fn();
    const owner: RendererTargetOwner<string> = { disposeTarget };
    const lifecycle = new RendererTargetLifecycle<string>();

    lifecycle.activate(owner, "canvas-1");
    expect(lifecycle.target).toBe("canvas-1");

    lifecycle.activate(owner, "canvas-2");

    expect(disposeTarget).toHaveBeenCalledTimes(1);
    expect(disposeTarget).toHaveBeenCalledWith("canvas-1");
    expect(lifecycle.target).toBe("canvas-2");

    lifecycle.disposeActive();
    expect(disposeTarget).toHaveBeenCalledTimes(2);
    expect(disposeTarget).toHaveBeenLastCalledWith("canvas-2");
    expect(lifecycle.hasActiveTarget).toBe(false);
  });

  it("releases the previous renderer target when switching render modes", () => {
    const hybrid = { disposeTarget: vi.fn() };
    const full3d = { disposeTarget: vi.fn() };
    const lifecycle = new RendererTargetLifecycle<string>();

    lifecycle.activate(hybrid, "hybrid-canvas");
    lifecycle.activate(full3d, "full3d-canvas");

    expect(hybrid.disposeTarget).toHaveBeenCalledOnce();
    expect(hybrid.disposeTarget).toHaveBeenCalledWith("hybrid-canvas");
    expect(full3d.disposeTarget).not.toHaveBeenCalled();
    expect(lifecycle.target).toBe("full3d-canvas");

    lifecycle.disposeActive();
    lifecycle.disposeActive();

    expect(full3d.disposeTarget).toHaveBeenCalledOnce();
    expect(full3d.disposeTarget).toHaveBeenCalledWith("full3d-canvas");
    expect(lifecycle.hasActiveTarget).toBe(false);
  });

  it("does not dispose when the same target is activated again", () => {
    const owner = { disposeTarget: vi.fn() };
    const lifecycle = new RendererTargetLifecycle<string>();

    lifecycle.activate(owner, "canvas");
    lifecycle.activate(owner, "canvas");

    expect(owner.disposeTarget).not.toHaveBeenCalled();
    expect(lifecycle.target).toBe("canvas");
  });
});
