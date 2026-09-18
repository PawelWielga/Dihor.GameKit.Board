import type { SpaceId } from "../core/index.js";
import { TopologyError } from "./errors.js";
import type { OrderedTopology } from "./Topology.js";

export type LinearDirection = "forward" | "backward";

export interface LinearTopologyOptions {
  readonly looping?: boolean;
}

/**
 * Ordered track topology for board games that move along a single path.
 *
 * Positive offsets move forward, negative offsets move backward.
 * Non-looping tracks return undefined when traversal would cross an end.
 */
export class LinearTopology implements OrderedTopology {
  readonly #spaceIds: readonly SpaceId[];
  readonly #indexBySpaceId: ReadonlyMap<SpaceId, number>;

  public readonly looping: boolean;

  public constructor(
    spaceIds: Iterable<SpaceId>,
    options: LinearTopologyOptions = {},
  ) {
    const orderedSpaceIds: SpaceId[] = [];
    const indexBySpaceId = new Map<SpaceId, number>();

    for (const spaceId of spaceIds) {
      if (indexBySpaceId.has(spaceId)) {
        throw new TopologyError(
          "DUPLICATE_SPACE",
          `Space '${spaceId}' already exists in the topology.`,
        );
      }

      indexBySpaceId.set(spaceId, orderedSpaceIds.length);
      orderedSpaceIds.push(spaceId);
    }

    this.#spaceIds = Object.freeze(orderedSpaceIds);
    this.#indexBySpaceId = indexBySpaceId;
    this.looping = options.looping === true;
  }

  public hasSpace(spaceId: SpaceId): boolean {
    return this.#indexBySpaceId.has(spaceId);
  }

  public getSpaceIds(): readonly SpaceId[] {
    return [...this.#spaceIds];
  }

  public getNeighbors(spaceId: SpaceId): readonly SpaceId[] {
    this.#requireIndex(spaceId);

    const neighbors = new Set<SpaceId>();
    const backward = this.getNext(spaceId, "backward");
    const forward = this.getNext(spaceId, "forward");

    if (backward !== undefined) {
      neighbors.add(backward);
    }

    if (forward !== undefined) {
      neighbors.add(forward);
    }

    return [...neighbors];
  }

  public getNext(
    spaceId: SpaceId,
    direction: LinearDirection = "forward",
  ): SpaceId | undefined {
    const index = this.#requireIndex(spaceId);
    const offset = direction === "forward" ? 1 : -1;

    return this.#spaceAtIndex(index + offset);
  }

  public getSpaceAtOffset(
    spaceId: SpaceId,
    offset: number,
  ): SpaceId | undefined {
    if (!Number.isInteger(offset)) {
      throw new RangeError("Linear topology offsets must be integers.");
    }

    const index = this.#requireIndex(spaceId);
    return this.#spaceAtIndex(index + offset);
  }

  #spaceAtIndex(index: number): SpaceId | undefined {
    const count = this.#spaceIds.length;

    if (count === 0) {
      return undefined;
    }

    if (this.looping) {
      const wrappedIndex = ((index % count) + count) % count;
      return this.#spaceIds[wrappedIndex];
    }

    if (index < 0 || index >= count) {
      return undefined;
    }

    return this.#spaceIds[index];
  }

  #requireIndex(spaceId: SpaceId): number {
    const index = this.#indexBySpaceId.get(spaceId);
    if (index === undefined) {
      throw new TopologyError(
        "UNKNOWN_SPACE",
        `Space '${spaceId}' does not exist in the topology.`,
      );
    }

    return index;
  }
}
