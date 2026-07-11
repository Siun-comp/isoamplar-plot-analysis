import { describe, expect, it } from "vitest";
import { findOverlappingBounds } from "../e2e/helpers/rasterEvidence";

describe("raster evidence helpers", () => {
  it("reports only intersecting identity bounds", () => {
    expect(
      findOverlappingBounds([
        { id: "curve-a", left: 0, top: 0, right: 100, bottom: 20 },
        { id: "curve-b", left: 0, top: 24, right: 100, bottom: 44 },
        { id: "curve-c", left: 90, top: 10, right: 140, bottom: 30 }
      ])
    ).toEqual([["curve-a", "curve-c"], ["curve-b", "curve-c"]]);
  });

  it("treats touching edges as non-overlapping", () => {
    expect(
      findOverlappingBounds([
        { id: "curve-a", left: 0, top: 0, right: 100, bottom: 20 },
        { id: "curve-b", left: 0, top: 20, right: 100, bottom: 40 }
      ])
    ).toEqual([]);
  });
});
