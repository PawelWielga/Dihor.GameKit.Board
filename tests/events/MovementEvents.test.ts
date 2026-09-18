import { describe, expect, it } from "vitest";
import {
  createMovementEvents,
  MOVEMENT_EVENT_SCHEMA,
  MOVEMENT_EVENT_VERSION,
} from "../../src/index.js";
import type { MovementResult } from "../../src/index.js";

describe("movement events", () => {
  it("creates an ordered, versioned event stream with authoritative state", () => {
    const result: MovementResult = Object.freeze({
      pieceId: "pawn",
      fromSpaceId: "a",
      toSpaceId: "c",
      path: Object.freeze(["a", "b", "c"]),
    });

    const events = createMovementEvents(result, { movementId: "move-1" });

    expect(events).toEqual([
      {
        schema: MOVEMENT_EVENT_SCHEMA,
        version: MOVEMENT_EVENT_VERSION,
        type: "movement.started",
        movementId: "move-1",
        sequence: 0,
        pieceId: "pawn",
        fromSpaceId: "a",
        toSpaceId: "c",
        path: ["a", "b", "c"],
        state: { pieceId: "pawn", spaceId: "a" },
      },
      {
        schema: MOVEMENT_EVENT_SCHEMA,
        version: MOVEMENT_EVENT_VERSION,
        type: "movement.space-entered",
        movementId: "move-1",
        sequence: 1,
        pieceId: "pawn",
        pathIndex: 1,
        spaceId: "b",
        state: { pieceId: "pawn", spaceId: "b" },
      },
      {
        schema: MOVEMENT_EVENT_SCHEMA,
        version: MOVEMENT_EVENT_VERSION,
        type: "movement.space-entered",
        movementId: "move-1",
        sequence: 2,
        pieceId: "pawn",
        pathIndex: 2,
        spaceId: "c",
        state: { pieceId: "pawn", spaceId: "c" },
      },
      {
        schema: MOVEMENT_EVENT_SCHEMA,
        version: MOVEMENT_EVENT_VERSION,
        type: "movement.completed",
        movementId: "move-1",
        sequence: 3,
        pieceId: "pawn",
        fromSpaceId: "a",
        toSpaceId: "c",
        path: ["a", "b", "c"],
        state: { pieceId: "pawn", spaceId: "c" },
      },
    ]);
  });

  it("round-trips through JSON without transport-specific values", () => {
    const result: MovementResult = {
      pieceId: "pawn",
      fromSpaceId: "start",
      toSpaceId: "finish",
      path: ["start", "middle", "finish"],
    };

    const events = createMovementEvents(result, { movementId: "network-17" });
    const parsed = JSON.parse(JSON.stringify(events));

    expect(parsed).toEqual(events);
    expect(parsed.every((event: { schema: string; version: number }) =>
      event.schema === "dihor.gamekit.board/movement"
      && event.version === 1
    )).toBe(true);
  });

  it("preserves repeated spaces in looping movement", () => {
    const result: MovementResult = {
      pieceId: "pawn",
      fromSpaceId: "c",
      toSpaceId: "a",
      path: ["c", "a", "b", "c", "a"],
    };

    const events = createMovementEvents(result, { movementId: "loop-1" });

    expect(
      events
        .filter((event) => event.type === "movement.space-entered")
        .map((event) => event.spaceId),
    ).toEqual(["a", "b", "c", "a"]);

    expect(events.at(-1)).toMatchObject({
      type: "movement.completed",
      sequence: 5,
      state: { pieceId: "pawn", spaceId: "a" },
    });
  });

  it("uses start and completed events only for zero-distance movement", () => {
    const result: MovementResult = {
      pieceId: "pawn",
      fromSpaceId: "a",
      toSpaceId: "a",
      path: ["a"],
    };

    const events = createMovementEvents(result, { movementId: "noop-1" });

    expect(events.map((event) => event.type)).toEqual([
      "movement.started",
      "movement.completed",
    ]);
    expect(events.map((event) => event.sequence)).toEqual([0, 1]);
  });

  it("rejects invalid correlation ids and inconsistent movement results", () => {
    const result: MovementResult = {
      pieceId: "pawn",
      fromSpaceId: "a",
      toSpaceId: "b",
      path: ["a", "b"],
    };

    expect(() => createMovementEvents(result, { movementId: "   " })).toThrow(
      RangeError,
    );

    expect(() =>
      createMovementEvents(
        { ...result, path: ["a", "c"] },
        { movementId: "move-2" },
      )
    ).toThrow(RangeError);
  });
});
