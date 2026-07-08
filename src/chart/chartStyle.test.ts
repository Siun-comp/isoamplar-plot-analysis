import { describe, expect, it } from "vitest";
import { createOneSpecimenEightReagentDataset } from "../data/sampleData";
import { createDefaultStyleRules, resolveCurveStyle } from "./chartStyle";

describe("chart style resolution", () => {
  it("reports group marker origins and lets overrides take precedence", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curve = dataset.curves[0];
    const styleRules = createDefaultStyleRules();
    styleRules.markerBy = "reagent";
    styleRules.reagentMarkerTypes[curve.reagentId] = "triangle";

    const groupResolved = resolveCurveStyle({
      curve,
      index: 0,
      styleRules
    });

    expect(groupResolved.markerType).toBe("triangle");
    expect(groupResolved.origins.markerType).toBe("group");
    expect(groupResolved.color).toBe("#0b6fa4");
    expect(groupResolved.origins.color).toBe("default");

    const overrideResolved = resolveCurveStyle({
      curve,
      index: 0,
      styleRules,
      override: { markerType: "none", source: "custom", fieldSources: { markerType: "custom" } }
    });

    expect(overrideResolved.markerType).toBe("none");
    expect(overrideResolved.source).toBe("custom");
    expect(overrideResolved.sources.markerType).toBe("custom");
    expect(overrideResolved.origins.markerType).toBe("override");
  });
});
