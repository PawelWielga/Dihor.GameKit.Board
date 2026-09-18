import type { SpaceId } from "../core/index.js";

export interface Topology {
  hasSpace(spaceId: SpaceId): boolean;
  getSpaceIds(): readonly SpaceId[];
  getNeighbors(spaceId: SpaceId): readonly SpaceId[];
}

export interface OrderedTopology extends Topology {
  getSpaceAtOffset(spaceId: SpaceId, offset: number): SpaceId | undefined;
}
