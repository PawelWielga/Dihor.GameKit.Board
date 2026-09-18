import type { BoardSnapshot, SpaceId } from "../core/index.js";
import type {
  PiecePresentation,
  PresentationPoint3,
  SpaceLayout,
  SpacePresentation,
} from "./contracts.js";
import { PresentationError } from "./errors.js";

export type SpacePositionEntry = readonly [
  spaceId: SpaceId,
  position: PresentationPoint3,
];

export function createSpaceLayout(
  entries: Iterable<SpacePositionEntry>,
): SpaceLayout {
  const positions = new Map<SpaceId, PresentationPoint3>();
  const spaces: SpacePresentation[] = [];

  for (const [spaceId, position] of entries) {
    if (positions.has(spaceId)) {
      throw new PresentationError(
        "DUPLICATE_SPACE",
        `Space '${spaceId}' already has a presentation position.`,
      );
    }

    const frozenPosition = freezePoint(position);
    positions.set(spaceId, frozenPosition);
    spaces.push(Object.freeze({ spaceId, position: frozenPosition }));
  }

  const frozenSpaces = Object.freeze(spaces);

  return Object.freeze({
    hasSpace(spaceId: SpaceId): boolean {
      return positions.has(spaceId);
    },

    getPosition(spaceId: SpaceId): PresentationPoint3 {
      const position = positions.get(spaceId);
      if (position === undefined) {
        throw new PresentationError(
          "UNKNOWN_SPACE",
          `Space '${spaceId}' has no presentation position.`,
        );
      }

      return position;
    },

    getSpaces(): readonly SpacePresentation[] {
      return frozenSpaces;
    },
  });
}

export function mapPiecesToPresentation<
  TSpaceData = unknown,
  TPieceData = unknown,
>(
  snapshot: BoardSnapshot<TSpaceData, TPieceData>,
  layout: SpaceLayout,
): readonly PiecePresentation[] {
  const pieces = new Set(snapshot.pieces.map((piece) => piece.id));
  const mapped: PiecePresentation[] = [];

  for (const placement of snapshot.placements) {
    if (!pieces.has(placement.pieceId)) {
      continue;
    }

    if (!layout.hasSpace(placement.spaceId)) {
      throw new PresentationError(
        "MISSING_SPACE_POSITION",
        `Space '${placement.spaceId}' has no presentation position for piece '${placement.pieceId}'.`,
      );
    }

    mapped.push(Object.freeze({
      pieceId: placement.pieceId,
      spaceId: placement.spaceId,
      position: layout.getPosition(placement.spaceId),
    }));
  }

  return Object.freeze(mapped);
}

function freezePoint(point: PresentationPoint3): PresentationPoint3 {
  for (const [axis, value] of Object.entries(point)) {
    if (!Number.isFinite(value)) {
      throw new RangeError(
        `Presentation coordinate '${axis}' must be finite; received ${value}.`,
      );
    }
  }

  return Object.freeze({
    x: point.x,
    y: point.y,
    z: point.z,
  });
}
