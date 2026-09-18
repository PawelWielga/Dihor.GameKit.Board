import { describe, expect, it } from "vitest";
import { SquareGridTopology, TopologyError } from "../../src/index.js";

describe("SquareGridTopology", () => {
  it("creates deterministic ids in row-major order", () => {
    const topology = new SquareGridTopology(3, 2);

    expect(topology.getSpaceIds()).toEqual([
      "grid:0:0",
      "grid:1:0",
      "grid:2:0",
      "grid:0:1",
      "grid:1:1",
      "grid:2:1",
    ]);

    expect(topology.getSpaceId(2, 1)).toBe("grid:2:1");
    expect(topology.getCoordinates("grid:2:1")).toEqual({ x: 2, y: 1 });
  });

  it("returns orthogonal neighbors in deterministic clockwise order", () => {
    const topology = new SquareGridTopology(3, 3);

    expect(topology.getNeighbors("grid:1:1")).toEqual([
      "grid:1:0",
      "grid:2:1",
      "grid:1:2",
      "grid:0:1",
    ]);
  });

  it("omits neighbors that fall outside the grid", () => {
    const topology = new SquareGridTopology(3, 3);

    expect(topology.getNeighbors("grid:0:0")).toEqual([
      "grid:1:0",
      "grid:0:1",
    ]);

    expect(topology.getNeighbors("grid:2:2")).toEqual([
      "grid:2:1",
      "grid:1:2",
    ]);
  });

  it("supports one-cell grids", () => {
    const topology = new SquareGridTopology(1, 1);

    expect(topology.getSpaceIds()).toEqual(["grid:0:0"]);
    expect(topology.getNeighbors("grid:0:0")).toEqual([]);
  });

  it("rejects invalid dimensions", () => {
    expect(() => new SquareGridTopology(0, 2)).toThrow(RangeError);
    expect(() => new SquareGridTopology(2, -1)).toThrow(RangeError);
    expect(() => new SquareGridTopology(2.5, 2)).toThrow(RangeError);
  });

  it("rejects invalid coordinates", () => {
    const topology = new SquareGridTopology(2, 2);

    expect(() => topology.getSpaceId(-1, 0)).toThrow(RangeError);
    expect(() => topology.getSpaceId(2, 0)).toThrow(RangeError);
    expect(() => topology.getSpaceId(0.5, 0)).toThrow(RangeError);
  });

  it("rejects unknown space ids", () => {
    const topology = new SquareGridTopology(2, 2);

    expect(() => topology.getCoordinates("grid:9:9")).toThrowError(
      expect.objectContaining<Partial<TopologyError>>({ code: "UNKNOWN_SPACE" }),
    );
  });
});
