import type {
  PresentationPoint3,
  SpaceLayout,
} from "../presentation/index.js";

export type Full3DProjection = "perspective" | "orthographic";

export interface Full3DCameraOptions {
  readonly projection?: Full3DProjection;
  readonly position?: PresentationPoint3;
  readonly target?: PresentationPoint3;
  readonly zoom?: number;
  readonly fov?: number;
  readonly orthographicHeight?: number;
  readonly near?: number;
  readonly far?: number;
}

export interface ResolvedFull3DCameraOptions {
  readonly projection: Full3DProjection;
  readonly position: PresentationPoint3;
  readonly target: PresentationPoint3;
  readonly zoom: number;
  readonly fov: number;
  readonly orthographicHeight: number;
  readonly near: number;
  readonly far: number;
}

export function resolveFull3DCameraOptions(
  layout: SpaceLayout,
  options: Full3DCameraOptions = {},
): ResolvedFull3DCameraOptions {
  const spaces = layout.getSpaces();
  if (spaces.length === 0) {
    throw new RangeError("Full3D renderer requires at least one mapped space.");
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const space of spaces) {
    minX = Math.min(minX, space.position.x);
    maxX = Math.max(maxX, space.position.x);
    minZ = Math.min(minZ, space.position.z);
    maxZ = Math.max(maxZ, space.position.z);
  }

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const extent = Math.max(maxX - minX, maxZ - minZ, 2);
  const distance = extent * 1.35;

  const target = finitePoint(
    options.target ?? { x: centerX, y: 0, z: centerZ },
    "target",
  );
  const position = finitePoint(
    options.position ?? {
      x: centerX + distance * 0.72,
      y: distance,
      z: centerZ + distance * 1.05,
    },
    "position",
  );
  const zoom = positive(options.zoom ?? 1, "zoom");
  const fov = positive(options.fov ?? 42, "fov");
  if (fov >= 179) {
    throw new RangeError("fov must be lower than 179 degrees.");
  }

  const orthographicHeight = positive(
    options.orthographicHeight ?? extent * 1.55,
    "orthographicHeight",
  );
  const near = positive(options.near ?? 0.1, "near");
  const far = positive(options.far ?? Math.max(100, distance * 12), "far");
  if (far <= near) {
    throw new RangeError("far must be greater than near.");
  }

  return Object.freeze({
    projection: options.projection ?? "perspective",
    position,
    target,
    zoom,
    fov,
    orthographicHeight,
    near,
    far,
  });
}

function finitePoint(
  point: PresentationPoint3,
  label: string,
): PresentationPoint3 {
  for (const [axis, value] of Object.entries(point)) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`${label}.${axis} must be finite.`);
    }
  }

  return Object.freeze({ x: point.x, y: point.y, z: point.z });
}

function positive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be greater than zero.`);
  }

  return value;
}
