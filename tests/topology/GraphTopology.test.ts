import { describe, expect, it } from "vitest";
import { GraphTopology, TopologyError } from "../../src/index.js";

describe("GraphTopology", () => {
  it("creates undirected connections by default", () => {
    const topology = new GraphTopology(["a", "b", "c"]);

    topology.addConnection("a", "b");
    topology.addConnection("b", "c");

    expect(topology.getNeighbors("a")).toEqual(["b"]);
    expect(topology.getNeighbors("b")).toEqual(["a", "c"]);
    expect(topology.getNeighbors("c")).toEqual(["b"]);
  });

  it("supports directed connections", () => {
    const topology = new GraphTopology(["start", "finish"]);

    topology.addConnection("start", "finish", { directed: true });

    expect(topology.hasConnection("start", "finish")).toBe(true);
    expect(topology.hasConnection("finish", "start")).toBe(false);
    expect(topology.getNeighbors("finish")).toEqual([]);
  });

  it("supports loops without duplicating the neighbor", () => {
    const topology = new GraphTopology(["loop"]);

    topology.addConnection("loop", "loop");

    expect(topology.getNeighbors("loop")).toEqual(["loop"]);
  });

  it("rejects connections that reference a missing space", () => {
    const topology = new GraphTopology(["known"]);

    expect(() => topology.addConnection("known", "missing")).toThrowError(
      expect.objectContaining<Partial<TopologyError>>({ code: "UNKNOWN_SPACE" }),
    );

    expect(() => topology.addConnection("missing", "known")).toThrowError(
      expect.objectContaining<Partial<TopologyError>>({ code: "UNKNOWN_SPACE" }),
    );
  });

  it("rejects neighbor queries for a missing space", () => {
    const topology = new GraphTopology(["known"]);

    expect(() => topology.getNeighbors("missing")).toThrowError(
      expect.objectContaining<Partial<TopologyError>>({ code: "UNKNOWN_SPACE" }),
    );
  });

  it("removes incoming and outgoing connections when a space is removed", () => {
    const topology = new GraphTopology(["a", "b", "c"]);

    topology.addConnection("a", "b");
    topology.addConnection("b", "c", { directed: true });

    expect(topology.removeSpace("b")).toBe(true);
    expect(topology.getNeighbors("a")).toEqual([]);
    expect(topology.getNeighbors("c")).toEqual([]);
    expect(topology.hasSpace("b")).toBe(false);
  });

  it("rejects duplicate space identifiers", () => {
    const topology = new GraphTopology(["a"]);

    expect(() => topology.addSpace("a")).toThrowError(
      expect.objectContaining<Partial<TopologyError>>({ code: "DUPLICATE_SPACE" }),
    );
  });
});
