import type {
  PresentationPoint3,
  SpaceLayout,
} from "../presentation/index.js";

export interface HybridLayoutFrame {
  readonly centerX: number;
  readonly centerZ: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
  readonly aspect: number;
}

export interface HybridNdcPoint {
  readonly x: number;
  readonly y: number;
}

export interface HybridViewport {
  readonly width: number;
  readonly height: number;
}

export interface HybridFrameOptions {
  readonly padding?: number;
  readonly minimumHalfExtent?: number;
}

export function calculateHybridLayoutFrame(
  layout: SpaceLayout,
  viewport: HybridViewport,
  options: HybridFrameOptions = {},
): HybridLayoutFrame {
  if (!Number.isFinite(viewport.width) || viewport.width <= 0) {
    throw new RangeError("Viewport width must be greater than zero.");
  }

  if (!Number.isFinite(viewport.height) || viewport.height <= 0) {
    throw new RangeError("Viewport height must be greater than zero.");
  }

  const spaces = layout.getSpaces();
  if (spaces.length === 0) {
    throw new RangeError("Hybrid renderer requires at least one mapped space.");
  }

  const padding = options.padding ?? 0.14;
  if (!Number.isFinite(padding) || padding < 0 || padding >= 0.5) {
    throw new RangeError("Hybrid layout padding must be between 0 and 0.5.");
  }

  const minimumHalfExtent = options.minimumHalfExtent ?? 0.6;
  if (!Number.isFinite(minimumHalfExtent) || minimumHalfExtent <= 0) {
    throw new RangeError("minimumHalfExtent must be greater than zero.");
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

  const aspect = viewport.width / viewport.height;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const usableFraction = 1 - padding;
  let halfWidth = Math.max((maxX - minX) / 2, minimumHalfExtent) / usableFraction;
  let halfHeight = Math.max((maxZ - minZ) / 2, minimumHalfExtent) / usableFraction;

  if (halfWidth / halfHeight < aspect) {
    halfWidth = halfHeight * aspect;
  } else {
    halfHeight = halfWidth / aspect;
  }

  return Object.freeze({
    centerX,
    centerZ,
    halfWidth,
    halfHeight,
    aspect,
  });
}

export function projectPresentationPointToNdc(
  point: PresentationPoint3,
  frame: HybridLayoutFrame,
): HybridNdcPoint {
  return Object.freeze({
    x: (point.x - frame.centerX) / frame.halfWidth,
    y: -(point.z - frame.centerZ) / frame.halfHeight,
  });
}

export function estimateHybridTileSize(layout: SpaceLayout): number {
  const spaces = layout.getSpaces();

  if (spaces.length < 2) {
    return 0.8;
  }

  let minimum = Number.POSITIVE_INFINITY;

  for (let left = 0; left < spaces.length; left += 1) {
    for (let right = left + 1; right < spaces.length; right += 1) {
      const a = spaces[left]?.position;
      const b = spaces[right]?.position;
      if (!a || !b) {
        continue;
      }

      const distance = Math.hypot(a.x - b.x, a.z - b.z);
      if (distance > 0) {
        minimum = Math.min(minimum, distance);
      }
    }
  }

  if (!Number.isFinite(minimum)) {
    return 0.8;
  }

  return Math.max(0.25, Math.min(2, minimum * 0.68));
}
