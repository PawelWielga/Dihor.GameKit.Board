import type { SpaceId } from "../core/index.js";
import { TopologyError } from "./errors.js";
import type { Topology } from "./Topology.js";

export interface SquareGridCoordinate {
  readonly x: number;
  readonly y: number;
}

const ORTHOGONAL_OFFSETS: readonly SquareGridCoordinate[] = Object.freeze([
  Object.freeze({ x: 0, y: -1 }),
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: -1, y: 0 }),
]);

/**
 * Rectangular square-grid topology using zero-based coordinates.
 *
 * x grows from left to right, y grows from top to bottom.
 * Space ids are deterministic and use the form `grid:x:y`.
 */
export class SquareGridTopology implements Topology {
  readonly #spaceIds: readonly SpaceId[];
  readonly #coordinatesBySpaceId: ReadonlyMap<SpaceId, SquareGridCoordinate>;

  public readonly width: number;
  public readonly height: number;

  public constructor(width: number, height: number) {
    if (!Number.isInteger(width) || width <= 0) {
      throw new RangeError("Square grid width must be a positive integer.");
    }

    if (!Number.isInteger(height) || height <= 0) {
      throw new RangeError("Square grid height must be a positive integer.");
    }

    this.width = width;
    this.height = height;

    const spaceIds: SpaceId[] = [];
    const coordinatesBySpaceId = new Map<SpaceId, SquareGridCoordinate>();

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const spaceId = this.getSpaceId(x, y);
        spaceIds.push(spaceId);
        coordinatesBySpaceId.set(spaceId, Object.freeze({ x, y }));
      }
    }

    this.#spaceIds = Object.freeze(spaceIds);
    this.#coordinatesBySpaceId = coordinatesBySpaceId;
  }

  public hasSpace(spaceId: SpaceId): boolean {
    return this.#coordinatesBySpaceId.has(spaceId);
  }

  public getSpaceIds(): readonly SpaceId[] {
    return [...this.#spaceIds];
  }

  public getSpaceId(x: number, y: number): SpaceId {
    this.#validateCoordinate(x, y);
    return `grid:${x}:${y}`;
  }

  public getCoordinates(spaceId: SpaceId): SquareGridCoordinate {
    const coordinate = this.#coordinatesBySpaceId.get(spaceId);
    if (coordinate === undefined) {
      throw new TopologyError(
        "UNKNOWN_SPACE",
        `Space '${spaceId}' does not exist in the topology.`,
      );
    }

    return coordinate;
  }

  public getNeighbors(spaceId: SpaceId): readonly SpaceId[] {
    const { x, y } = this.getCoordinates(spaceId);
    const neighbors: SpaceId[] = [];

    for (const offset of ORTHOGONAL_OFFSETS) {
      const neighborX = x + offset.x;
      const neighborY = y + offset.y;

      if (this.#isInBounds(neighborX, neighborY)) {
        neighbors.push(this.getSpaceId(neighborX, neighborY));
      }
    }

    return neighbors;
  }

  #validateCoordinate(x: number, y: number): void {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      throw new RangeError("Square grid coordinates must be integers.");
    }

    if (!this.#isInBounds(x, y)) {
      throw new RangeError(
        `Square grid coordinate (${x}, ${y}) is outside ${this.width}x${this.height}.`,
      );
    }
  }

  #isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }
}
