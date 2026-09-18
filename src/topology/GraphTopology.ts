import type { SpaceId } from "../core/index.js";
import { TopologyError } from "./errors.js";
import type { Topology } from "./Topology.js";

export interface GraphConnectionOptions {
  /**
   * When true, only the from -> to edge is created.
   * Undirected connections are the default.
   */
  readonly directed?: boolean;
}

/**
 * General-purpose topology backed by explicit graph connections.
 *
 * The topology stores logical space identifiers only. Board data and piece
 * placement remain owned by Board.
 */
export class GraphTopology implements Topology {
  readonly #neighbors = new Map<SpaceId, Set<SpaceId>>();

  public constructor(spaceIds: Iterable<SpaceId> = []) {
    for (const spaceId of spaceIds) {
      this.addSpace(spaceId);
    }
  }

  public addSpace(spaceId: SpaceId): void {
    if (this.#neighbors.has(spaceId)) {
      throw new TopologyError(
        "DUPLICATE_SPACE",
        `Space '${spaceId}' already exists in the topology.`,
      );
    }

    this.#neighbors.set(spaceId, new Set());
  }

  public removeSpace(spaceId: SpaceId): boolean {
    if (!this.#neighbors.delete(spaceId)) {
      return false;
    }

    for (const neighbors of this.#neighbors.values()) {
      neighbors.delete(spaceId);
    }

    return true;
  }

  public hasSpace(spaceId: SpaceId): boolean {
    return this.#neighbors.has(spaceId);
  }

  public getSpaceIds(): readonly SpaceId[] {
    return [...this.#neighbors.keys()];
  }

  public addConnection(
    fromSpaceId: SpaceId,
    toSpaceId: SpaceId,
    options: GraphConnectionOptions = {},
  ): void {
    const fromNeighbors = this.#requireSpace(fromSpaceId);
    const toNeighbors = this.#requireSpace(toSpaceId);

    fromNeighbors.add(toSpaceId);

    if (options.directed !== true) {
      toNeighbors.add(fromSpaceId);
    }
  }

  public removeConnection(
    fromSpaceId: SpaceId,
    toSpaceId: SpaceId,
    options: GraphConnectionOptions = {},
  ): boolean {
    const fromNeighbors = this.#requireSpace(fromSpaceId);
    const toNeighbors = this.#requireSpace(toSpaceId);

    const removedForward = fromNeighbors.delete(toSpaceId);

    if (options.directed === true) {
      return removedForward;
    }

    const removedBackward = toNeighbors.delete(fromSpaceId);
    return removedForward || removedBackward;
  }

  public hasConnection(fromSpaceId: SpaceId, toSpaceId: SpaceId): boolean {
    return this.#requireSpace(fromSpaceId).has(
      this.#requireSpaceId(toSpaceId),
    );
  }

  public getNeighbors(spaceId: SpaceId): readonly SpaceId[] {
    return [...this.#requireSpace(spaceId)];
  }

  #requireSpace(spaceId: SpaceId): Set<SpaceId> {
    const neighbors = this.#neighbors.get(spaceId);
    if (neighbors === undefined) {
      throw new TopologyError(
        "UNKNOWN_SPACE",
        `Space '${spaceId}' does not exist in the topology.`,
      );
    }

    return neighbors;
  }

  #requireSpaceId(spaceId: SpaceId): SpaceId {
    this.#requireSpace(spaceId);
    return spaceId;
  }
}
