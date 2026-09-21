import type { SpaceId } from "../core/index.js";
import type { Topology } from "../topology/index.js";
import type { PresentationPoint3, SpaceLayout } from "./contracts.js";
import { PresentationError } from "./errors.js";

export interface BoardConnectionAppearance {
  readonly color?: string;
  readonly opacity?: number;
  /**
   * Connection width in presentation-layout units.
   */
  readonly width?: number;
}

export interface BoardConnectionPresentation {
  readonly fromSpaceId: SpaceId;
  readonly toSpaceId: SpaceId;
  readonly appearance?: BoardConnectionAppearance;
}

export interface BoardConnectionSegment {
  readonly connection: BoardConnectionPresentation;
  readonly from: PresentationPoint3;
  readonly to: PresentationPoint3;
}

export const DEFAULT_CONNECTION_APPEARANCE: Readonly<Required<BoardConnectionAppearance>> =
  Object.freeze({
    color: "#526273",
    opacity: 1,
    width: 0.32,
  });

/**
 * Derives a presentation-safe connection list from the topology without
 * inventing edges. Reciprocal neighbor relationships are rendered once.
 */
export function createTopologyConnections(
  topology: Topology,
): readonly BoardConnectionPresentation[] {
  const spaceIds = topology.getSpaceIds();
  const knownSpaces = new Set(spaceIds);
  const seen = new Set<string>();
  const connections: BoardConnectionPresentation[] = [];

  for (const fromSpaceId of spaceIds) {
    for (const toSpaceId of topology.getNeighbors(fromSpaceId)) {
      if (!knownSpaces.has(toSpaceId)) {
        throw new PresentationError(
          "UNKNOWN_SPACE",
          `Topology connection '${fromSpaceId}' -> '${toSpaceId}' references an unknown space.`,
        );
      }

      if (fromSpaceId === toSpaceId) {
        continue;
      }

      const key = [fromSpaceId, toSpaceId].sort().join("\u0000");
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      connections.push(Object.freeze({ fromSpaceId, toSpaceId }));
    }
  }

  return Object.freeze(connections);
}

export function mapConnectionsToPresentation(
  connections: readonly BoardConnectionPresentation[],
  layout: SpaceLayout,
): readonly BoardConnectionSegment[] {
  return Object.freeze(
    connections.map((connection) => {
      if (!layout.hasSpace(connection.fromSpaceId)) {
        throw new PresentationError(
          "MISSING_SPACE_POSITION",
          `Connection source '${connection.fromSpaceId}' has no presentation position.`,
        );
      }
      if (!layout.hasSpace(connection.toSpaceId)) {
        throw new PresentationError(
          "MISSING_SPACE_POSITION",
          `Connection target '${connection.toSpaceId}' has no presentation position.`,
        );
      }

      return Object.freeze({
        connection,
        from: layout.getPosition(connection.fromSpaceId),
        to: layout.getPosition(connection.toSpaceId),
      });
    }),
  );
}

export function resolveConnectionAppearance(
  connection: BoardConnectionPresentation,
  fallback: BoardConnectionAppearance = {},
): Required<BoardConnectionAppearance> {
  const appearance = {
    ...DEFAULT_CONNECTION_APPEARANCE,
    ...fallback,
    ...connection.appearance,
  };

  if (
    !Number.isFinite(appearance.opacity) ||
    appearance.opacity < 0 ||
    appearance.opacity > 1
  ) {
    throw new RangeError("Connection opacity must be between zero and one.");
  }
  if (!Number.isFinite(appearance.width) || appearance.width <= 0) {
    throw new RangeError("Connection width must be greater than zero.");
  }

  return Object.freeze(appearance);
}
