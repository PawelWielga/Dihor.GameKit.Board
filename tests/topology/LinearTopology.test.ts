import { describe, expect, it } from "vitest";
import { LinearTopology, TopologyError } from "../../src/index.js";

describe("LinearTopology", () => {
  it("keeps spaces in the declared order", () => {
    const topology = new LinearTopology(["start", "middle", "finish"]);

    expect(topology.getSpaceIds()).toEqual(["start", "middle", "finish"]);
    expect(topology.getNeighbors("middle")).toEqual(["start", "finish"]);
  });

  it("traverses forward and backward on a non-looping track", () => {
    const topology = new LinearTopology(["a", "b", "c", "d"]);

    expect(topology.getNext("b", "forward")).toBe("c");
    expect(topology.getNext("b", "backward")).toBe("a");
    expect(topology.getSpaceAtOffset("b", 2)).toBe("d");
    expect(topology.getSpaceAtOffset("c", -2)).toBe("a");
  });

  it("returns undefined when a non-looping traversal crosses an end", () => {
    const topology = new LinearTopology(["a", "b", "c"]);

    expect(topology.getNext("a", "backward")).toBeUndefined();
    expect(topology.getNext("c", "forward")).toBeUndefined();
    expect(topology.getSpaceAtOffset("a", -1)).toBeUndefined();
    expect(topology.getSpaceAtOffset("c", 1)).toBeUndefined();
  });

  it("wraps traversal on a looping track", () => {
    const topology = new LinearTopology(["a", "b", "c"], { looping: true });

    expect(topology.getNext("c", "forward")).toBe("a");
    expect(topology.getNext("a", "backward")).toBe("c");
    expect(topology.getSpaceAtOffset("b", 5)).toBe("a");
    expect(topology.getSpaceAtOffset("b", -5)).toBe("c");
  });

  it("handles one-space looping tracks deterministically", () => {
    const topology = new LinearTopology(["only"], { looping: true });

    expect(topology.getNeighbors("only")).toEqual(["only"]);
    expect(topology.getSpaceAtOffset("only", 100)).toBe("only");
    expect(topology.getSpaceAtOffset("only", -100)).toBe("only");
  });

  it("rejects duplicate space identifiers", () => {
    expect(() => new LinearTopology(["a", "a"])).toThrowError(
      expect.objectContaining<Partial<TopologyError>>({ code: "DUPLICATE_SPACE" }),
    );
  });

  it("rejects queries for missing spaces", () => {
    const topology = new LinearTopology(["a"]);

    expect(() => topology.getNext("missing")).toThrowError(
      expect.objectContaining<Partial<TopologyError>>({ code: "UNKNOWN_SPACE" }),
    );
  });

  it("rejects fractional offsets", () => {
    const topology = new LinearTopology(["a", "b"]);

    expect(() => topology.getSpaceAtOffset("a", 1.5)).toThrow(RangeError);
  });
});
