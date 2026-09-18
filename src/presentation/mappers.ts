import type { SpaceId } from "../core/index.js";
import {
  LinearTopology,
  SquareGridTopology,
} from "../topology/index.js";
import type { PresentationPoint3, SpaceLayout } from "./contracts.js";
import { createSpaceLayout } from "./layout.js";

export interface LinearLayoutOptions {
  readonly spacing?: number;
  readonly origin?: PresentationPoint3;
  readonly axis?: "x" | "z";
}

export interface SquareGridLayoutOptions {
  readonly cellSize?: number;
  readonly origin?: PresentationPoint3;
}

export interface ExplicitLayoutOptions {
  readonly y?: number;
}

const ZERO: PresentationPoint3 = Object.freeze({ x: 0, y: 0, z: 0 });

export function createLinearSpaceLayout(
  topology: LinearTopology,
  options: LinearLayoutOptions = {},
): SpaceLayout {
  const spacing = positiveFinite(options.spacing ?? 1, "spacing");
  const origin = finitePoint(options.origin ?? ZERO);
  const axis = options.axis ?? "x";

  return createSpaceLayout(
    topology.getSpaceIds().map((spaceId, index) => [
      spaceId,
      axis === "x"
        ? {
            x: origin.x + index * spacing,
            y: origin.y,
            z: origin.z,
          }
        : {
            x: origin.x,
            y: origin.y,
            z: origin.z + index * spacing,
          },
    ] as const),
  );
}

export function createSquareGridSpaceLayout(
  topology: SquareGridTopology,
  options: SquareGridLayoutOptions = {},
): SpaceLayout {
  const cellSize = positiveFinite(options.cellSize ?? 1, "cellSize");
  const origin = finitePoint(options.origin ?? ZERO);

  return createSpaceLayout(
    topology.getSpaceIds().map((spaceId) => {
      const coordinate = topology.getCoordinates(spaceId);

      return [
        spaceId,
        {
          x: origin.x + coordinate.x * cellSize,
          y: origin.y,
          z: origin.z + coordinate.y * cellSize,
        },
      ] as const;
    }),
  );
}

export function createExplicitSpaceLayout(
  positions: Readonly<Record<SpaceId, { readonly x: number; readonly z: number }>>,
  options: ExplicitLayoutOptions = {},
): SpaceLayout {
  const y = finite(options.y ?? 0, "y");

  return createSpaceLayout(
    Object.entries(positions).map(([spaceId, position]) => [
      spaceId,
      {
        x: position.x,
        y,
        z: position.z,
      },
    ] as const),
  );
}

function positiveFinite(value: number, label: string): number {
  finite(value, label);
  if (value <= 0) {
    throw new RangeError(`${label} must be greater than zero.`);
  }

  return value;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite.`);
  }

  return value;
}

function finitePoint(point: PresentationPoint3): PresentationPoint3 {
  finite(point.x, "origin.x");
  finite(point.y, "origin.y");
  finite(point.z, "origin.z");
  return point;
}
