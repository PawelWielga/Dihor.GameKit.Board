import { describe, expect, it } from "vitest";
import {
  createExplicitSpaceLayout,
  createTopologyConnections,
  GraphTopology,
  mapConnectionsToPresentation,
  PresentationError,
  resolveConnectionAppearance,
  SquareGridTopology,
} from "../../src/index.js";

describe("topology connection presentation", () => {
  it("derives each reciprocal graph edge once without inventing connectivity", () => {
    const topology = new GraphTopology(["a", "b", "c", "d"]);
    topology.addConnection("a", "b");
    topology.addConnection("b", "c");
    topology.addConnection("c", "d", { directed: true });

    expect(createTopologyConnections(topology)).toEqual([
      { fromSpaceId: "a", toSpaceId: "b" },
      { fromSpaceId: "b", toSpaceId: "c" },
      { fromSpaceId: "c", toSpaceId: "d" },
    ]);
  });

  it("represents all four orthogonal links in a 2x2 square grid", () => {
    const topology = new SquareGridTopology(2, 2);
    const pairs = createTopologyConnections(topology).map((connection) =>
      [connection.fromSpaceId, connection.toSpaceId].sort().join("--")
    );

    expect(pairs.sort()).toEqual([
      "grid:0:0--grid:0:1",
      "grid:0:0--grid:1:0",
      "grid:0:1--grid:1:1",
      "grid:1:0--grid:1:1",
    ]);
  });

  it("maps graph edges through arbitrary explicit layout positions", () => {
    const topology = new GraphTopology(["north", "center", "east"]);
    topology.addConnection("north", "center");
    topology.addConnection("center", "east");

    const layout = createExplicitSpaceLayout({
      north: { x: 0, z: -1 },
      center: { x: 0, z: 0 },
      east: { x: 1, z: 0 },
    });

    expect(
      mapConnectionsToPresentation(createTopologyConnections(topology), layout),
    ).toMatchObject([
      {
        from: { x: 0, y: 0, z: -1 },
        to: { x: 0, y: 0, z: 0 },
      },
      {
        from: { x: 0, y: 0, z: 0 },
        to: { x: 1, y: 0, z: 0 },
      },
    ]);
  });

  it("fails explicitly when a connection endpoint has no layout position", () => {
    const topology = new GraphTopology(["a", "b"]);
    topology.addConnection("a", "b");
    const layout = createExplicitSpaceLayout({
      a: { x: 0, z: 0 },
    });

    expect(() =>
      mapConnectionsToPresentation(createTopologyConnections(topology), layout)
    ).toThrowError(PresentationError);
  });

  it("keeps connection styling presentation-only and validates dimensions", () => {
    const connection = {
      fromSpaceId: "a",
      toSpaceId: "b",
      appearance: { color: "#ffffff", opacity: 0.5 },
    };

    expect(resolveConnectionAppearance(connection, { width: 0.4 })).toEqual({
      color: "#ffffff",
      opacity: 0.5,
      width: 0.4,
    });

    expect(() =>
      resolveConnectionAppearance(connection, { width: 0 })
    ).toThrow(RangeError);
  });
});
