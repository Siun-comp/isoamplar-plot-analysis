import { describe, expect, it } from "vitest";
import { createHoverReadout } from "./ChartView";

describe("createHoverReadout", () => {
  it("extracts fixed readout values from an ECharts series hover event", () => {
    expect(
      createHoverReadout({
        componentType: "series",
        seriesName: "A1 / 검체 1",
        data: [23, 4.5123],
        color: "#0b6fa4"
      })
    ).toEqual({
      seriesName: "A1 / 검체 1",
      x: 23,
      y: 4.5123,
      color: "#0b6fa4"
    });
  });

  it("ignores non-series events and malformed point data", () => {
    expect(createHoverReadout({ componentType: "xAxis", data: [1, 2] })).toBeNull();
    expect(createHoverReadout({ componentType: "series", data: [] })).toBeNull();
  });
});
