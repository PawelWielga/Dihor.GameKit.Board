import type { SpaceId } from "../core/index.js";

export interface Topology {
  hasSpace(spaceId: SpaceId): boolean;
  getSpaceIds(): readonly SpaceId[];
  getNeighbors(spaceId: SpaceId): readonly SpaceId[];
}
