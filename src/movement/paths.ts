import type { SpaceId } from "../core/index.js";
import type { OrderedTopology, Topology } from "../topology/index.js";
import { MovementError } from "./errors.js";
import type { MovementPath } from "./models.js";

function freezePath(spaceIds: Iterable<SpaceId>): MovementPath {
  return Object.freeze([...spaceIds]);
}

/**
 * Finds a deterministic shortest path using breadth-first search.
 *
 * Complexity is O(V + E) over the spaces and connections exposed by the
 * topology. Search is bounded to identifiers returned by getSpaceIds().
 */
export function calculateMoveToPath(
  topology: Topology,
  fromSpaceId: SpaceId,
  toSpaceId: SpaceId,
): MovementPath {
  const knownSpaceIds = new Set(topology.getSpaceIds());

  if (!knownSpaceIds.has(fromSpaceId)) {
    throw new MovementError(
      "UNKNOWN_TOPOLOGY_SPACE",
      `Space '${fromSpaceId}' does not exist in the movement topology.`,
    );
  }

  if (!knownSpaceIds.has(toSpaceId)) {
    throw new MovementError(
      "UNKNOWN_TOPOLOGY_SPACE",
      `Space '${toSpaceId}' does not exist in the movement topology.`,
    );
  }

  if (fromSpaceId === toSpaceId) {
    return freezePath([fromSpaceId]);
  }

  const parents = new Map<SpaceId, SpaceId | undefined>();
  parents.set(fromSpaceId, undefined);

  const queue: SpaceId[] = [fromSpaceId];
  let cursor = 0;

  while (cursor < queue.length) {
    const currentSpaceId = queue[cursor];
    cursor += 1;

    for (const neighborSpaceId of topology.getNeighbors(currentSpaceId)) {
      if (!knownSpaceIds.has(neighborSpaceId)) {
        throw new MovementError(
          "INVALID_TOPOLOGY",
          `Topology returned unknown neighbor '${neighborSpaceId}' from '${currentSpaceId}'.`,
        );
      }

      if (parents.has(neighborSpaceId)) {
        continue;
      }

      parents.set(neighborSpaceId, currentSpaceId);

      if (neighborSpaceId === toSpaceId) {
        return reconstructPath(parents, toSpaceId);
      }

      queue.push(neighborSpaceId);
    }
  }

  throw new MovementError(
    "NO_PATH",
    `No movement path exists from '${fromSpaceId}' to '${toSpaceId}'.`,
  );
}

export function calculateMoveByPath(
  topology: Topology,
  fromSpaceId: SpaceId,
  distance: number,
): MovementPath {
  if (!Number.isInteger(distance)) {
    throw new MovementError(
      "INVALID_DISTANCE",
      "Movement distance must be an integer.",
    );
  }

  if (!topology.hasSpace(fromSpaceId)) {
    throw new MovementError(
      "UNKNOWN_TOPOLOGY_SPACE",
      `Space '${fromSpaceId}' does not exist in the movement topology.`,
    );
  }

  if (distance === 0) {
    return freezePath([fromSpaceId]);
  }

  if (!isOrderedTopology(topology)) {
    throw new MovementError(
      "UNSUPPORTED_TOPOLOGY",
      "moveBy() requires an ordered topology.",
    );
  }

  const direction = Math.sign(distance);
  const path: SpaceId[] = [fromSpaceId];

  for (let step = 1; step <= Math.abs(distance); step += 1) {
    const nextSpaceId = topology.getSpaceAtOffset(fromSpaceId, step * direction);

    if (nextSpaceId === undefined) {
      throw new MovementError(
        "OUT_OF_BOUNDS",
        `Movement by ${distance} spaces crosses the end of the topology.`,
      );
    }

    if (!topology.hasSpace(nextSpaceId)) {
      throw new MovementError(
        "INVALID_TOPOLOGY",
        `Ordered topology returned unknown space '${nextSpaceId}'.`,
      );
    }

    path.push(nextSpaceId);
  }

  return freezePath(path);
}

function reconstructPath(
  parents: ReadonlyMap<SpaceId, SpaceId | undefined>,
  toSpaceId: SpaceId,
): MovementPath {
  const reversedPath: SpaceId[] = [];
  let currentSpaceId: SpaceId | undefined = toSpaceId;

  while (currentSpaceId !== undefined) {
    reversedPath.push(currentSpaceId);
    currentSpaceId = parents.get(currentSpaceId);
  }

  reversedPath.reverse();
  return freezePath(reversedPath);
}

function isOrderedTopology(topology: Topology): topology is OrderedTopology {
  return "getSpaceAtOffset" in topology
    && typeof topology.getSpaceAtOffset === "function";
}
