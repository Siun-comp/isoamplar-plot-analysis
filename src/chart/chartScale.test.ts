import { describe, expect, it } from "vitest";
import { createOneSpecimenEightReagentDataset } from "../data/sampleData";
import {
  createDefaultChartScale,
  getAppliedAxisScaleForDraft,
  getAxisAutoDomain,
  resolveAxisScale
} from "./chartScale";

describe("chart scale draft and applied state", () => {
  it("keeps the last valid applied bounds while the active fixed draft is incomplete", () => {
    const curve = createOneSpecimenEightReagentDataset().curves[0];
    const axis = createDefaultChartScale().y;
    axis.mode = "fixed";
    axis.fixedMin = "-1e-5";
    axis.fixedMax = "2e-5";
    axis.applied = getAppliedAxisScaleForDraft(axis)!;
    axis.fixedMax = "";

    const resolution = resolveAxisScale("y", axis, [curve]);

    expect(resolution).toMatchObject({
      min: -1e-5,
      max: 2e-5,
      status: "incomplete",
      issue: { blocksPlotExport: true }
    });
  });

  it("does not let an inactive invalid preset block the applied fixed scale", () => {
    const curve = createOneSpecimenEightReagentDataset().curves[0];
    const axis = createDefaultChartScale().x;
    axis.mode = "fixed";
    axis.fixedMin = "1";
    axis.fixedMax = "45";
    axis.applied = getAppliedAxisScaleForDraft(axis)!;
    axis.preset1 = { label: "Draft", min: "20", max: "10" };

    expect(resolveAxisScale("x", axis, [curve])).toMatchObject({ min: 1, max: 45, status: "valid" });
  });

  it.each([
    ["preset1", "20", "10"],
    ["preset2", "10", "10"]
  ] as const)("keeps the applied scale while active %s bounds are invalid", (mode, min, max) => {
    const curve = createOneSpecimenEightReagentDataset().curves[0];
    const axis = createDefaultChartScale().x;
    axis.mode = "fixed";
    axis.fixedMin = "1";
    axis.fixedMax = "45";
    axis.applied = getAppliedAxisScaleForDraft(axis)!;
    axis[mode] = { label: mode.toUpperCase(), min, max };
    axis.mode = mode;

    expect(resolveAxisScale("x", axis, [curve])).toMatchObject({
      min: 1,
      max: 45,
      status: "invalid-order",
      issue: { blocksPlotExport: true }
    });
  });

  it("warns without blocking when a valid applied scale does not overlap raw data", () => {
    const curve = createOneSpecimenEightReagentDataset().curves[0];
    const axis = createDefaultChartScale().x;
    axis.mode = "preset2";
    axis.preset2 = { label: "Outside", min: "100", max: "200" };
    axis.applied = getAppliedAxisScaleForDraft(axis)!;

    expect(resolveAxisScale("x", axis, [curve])).toMatchObject({
      min: 100,
      max: 200,
      status: "valid-no-data-overlap",
      issue: { blocksPlotExport: false }
    });
  });

  it("reduces accepted-size domains without argument spreading", () => {
    const base = createOneSpecimenEightReagentDataset().curves[0];
    const pointCount = 150_000;
    const curve = {
      ...base,
      x: Array.from({ length: pointCount }, (_, index) => index + 1),
      y: Array.from({ length: pointCount }, (_, index) => (index % 2 === 0 ? index / 10 : null))
    };

    expect(getAxisAutoDomain("x", [curve])).toEqual({ min: 1, max: pointCount });
    expect(getAxisAutoDomain("y", [curve])).toEqual({ min: 0, max: 14999.8 });
  });
});
