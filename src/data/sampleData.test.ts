import { describe, expect, it } from "vitest";
import {
  createOneSpecimenEightReagentDataset,
  createSimilarNameDataset,
  createSyntheticPcrDataset,
  createTwentyOnePlusCurveDataset
} from "./sampleData";
import { buildSelectionTree } from "../selection/buildTrees";
import { getFilteredCurveIds, getMatchedCurveIds } from "../selection/searchCurves";
import {
  createInitialSelectionState,
  setCurveSelection,
  setGroupingMode
} from "../selection/selectionState";

describe("PCR normalized sample data and selection utilities", () => {
  it("creates a stable one specimen by eight reagent dataset", () => {
    const dataset = createOneSpecimenEightReagentDataset();

    expect(dataset.curves).toHaveLength(8);
    expect(dataset.specimens).toHaveLength(1);
    expect(dataset.reagents).toHaveLength(8);
    expect(dataset.curves[0].curveId).toBe("sheet0_col_A");
    expect(dataset.curves[0].x).toEqual(Array.from({ length: 45 }, (_, index) => index + 1));
  });

  it("builds reagent-first selection tree by default with all major groups collapsed", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const state = createInitialSelectionState(dataset);
    const tree = buildSelectionTree({
      dataset,
      groupingMode: state.groupingMode,
      selectedCurveIds: state.selectedCurveIds,
      collapsedGroupIds: state.collapsedGroupIds
    });

    expect(state.groupingMode).toBe("reagent");
    expect(tree).toHaveLength(8);
    expect(tree.every((group) => group.collapsed)).toBe(true);
    expect(state.collapsedGroupIds.size).toBe(dataset.reagents.length + dataset.specimens.length);
  });

  it("keeps curveId selection stable when switching grouping mode", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const selectedCurveId = dataset.curves[2].curveId;
    const selectedState = setCurveSelection(createInitialSelectionState(dataset), [selectedCurveId], true);
    const specimenState = setGroupingMode(selectedState, "specimen");
    const specimenTree = buildSelectionTree({
      dataset,
      groupingMode: specimenState.groupingMode,
      selectedCurveIds: specimenState.selectedCurveIds,
      collapsedGroupIds: specimenState.collapsedGroupIds
    });

    expect(specimenState.selectedCurveIds.has(selectedCurveId)).toBe(true);
    expect(specimenTree).toHaveLength(1);
    expect(specimenTree[0].checkState).toBe("mixed");
  });

  it("warns about similar labels without merging names", () => {
    const dataset = createSimilarNameDataset();

    expect(dataset.specimens.map((specimen) => specimen.label)).toContain("검체 1");
    expect(dataset.specimens.map((specimen) => specimen.label)).toContain("검체1");
    expect(dataset.warnings.some((warning) => warning.code === "SIMILAR_SPECIMEN_LABEL")).toBe(true);
    expect(dataset.warnings.some((warning) => warning.code === "SIMILAR_REAGENT_LABEL")).toBe(true);
  });

  it("does not use similar-name keys as entity identity", () => {
    const dataset = createSyntheticPcrDataset({
      specimenLabels: ["Sample 1", "Sample-1"],
      reagentLabels: ["A1"]
    });

    expect(dataset.specimens.map((specimen) => specimen.label)).toEqual(["Sample 1", "Sample-1"]);
    expect(new Set(dataset.specimens.map((specimen) => specimen.id)).size).toBe(2);
    expect(dataset.warnings.some((warning) => warning.code === "SIMILAR_SPECIMEN_LABEL")).toBe(true);
  });

  it("includes dataset-level warning curve IDs in the warning filter and tree badges", () => {
    const dataset = createSimilarNameDataset();
    const warningCurveIds = getFilteredCurveIds(dataset, getMatchedCurveIds(dataset, ""), new Set(), "warning");
    const state = createInitialSelectionState(dataset);
    const tree = buildSelectionTree({
      dataset,
      groupingMode: state.groupingMode,
      selectedCurveIds: state.selectedCurveIds,
      collapsedGroupIds: new Set(),
      includedCurveIds: warningCurveIds
    });

    expect(warningCurveIds.size).toBeGreaterThan(0);
    expect(tree.flatMap((group) => group.subgroups).flatMap((subgroup) => subgroup.curves).every((curve) => curve.warningCount > 0)).toBe(true);
  });

  it("supports all-dataset search and twenty-one-plus sample cases", () => {
    const dataset = createTwentyOnePlusCurveDataset();
    const allMatches = getMatchedCurveIds(dataset, "");
    const reagentMatches = getMatchedCurveIds(dataset, "A8");

    expect(dataset.curves.length).toBeGreaterThan(20);
    expect(allMatches.size).toBe(dataset.curves.length);
    expect(reagentMatches.size).toBe(3);
  });
});
