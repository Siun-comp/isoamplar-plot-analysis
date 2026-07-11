import type { CheckState, Curve, GroupingMode, PcrDataset, TreeGroupNode } from "../data/types";
import { formatCurveLabel } from "../data/curveLabels";
import { getWarningsByCurveId } from "../warnings/warningIndex";

export function buildSelectionTree(args: {
  dataset: PcrDataset;
  groupingMode: GroupingMode;
  selectedCurveIds: Set<string>;
  collapsedGroupIds: Set<string>;
  includedCurveIds?: Set<string>;
}): TreeGroupNode[] {
  const { dataset, groupingMode, selectedCurveIds, collapsedGroupIds, includedCurveIds } = args;
  const curvesById = new Map(dataset.curves.map((curve) => [curve.curveId, curve]));
  const warningsByCurveId = getWarningsByCurveId(dataset);
  const primaryGroups = new Map<string, Map<string, Curve[]>>();

  dataset.orderedCurveIds.forEach((curveId) => {
    if (includedCurveIds && !includedCurveIds.has(curveId)) return;
    const curve = curvesById.get(curveId);
    if (!curve) return;

    const primaryId = groupingMode === "reagent" ? curve.reagentId : curve.specimenId;
    const secondaryId = groupingMode === "reagent" ? curve.specimenId : curve.reagentId;
    const secondaryGroups = primaryGroups.get(primaryId) ?? new Map<string, Curve[]>();
    const curves = secondaryGroups.get(secondaryId) ?? [];

    curves.push(curve);
    secondaryGroups.set(secondaryId, curves);
    primaryGroups.set(primaryId, secondaryGroups);
  });

  return [...primaryGroups.entries()].map(([primaryId, secondaryGroups]) => {
    const subgroups = [...secondaryGroups.entries()].map(([secondaryId, curves]) => {
      const curveIds = curves.map((curve) => curve.curveId);
      const selectedCount = countSelected(curveIds, selectedCurveIds);

      return {
        type: "subgroup" as const,
        groupId: createSubgroupId(groupingMode, primaryId, secondaryId),
        label: getSecondaryLabel(groupingMode, curves[0]),
        curveIds,
        checkState: getCheckState(selectedCount, curveIds.length),
        selectedCount,
        totalCount: curveIds.length,
        curves: curves.map((curve) => ({
          type: "curve" as const,
          curveId: curve.curveId,
          label: formatCurveLabel(curve, groupingMode),
          specimenLabel: curve.specimenLabel,
          reagentLabel: curve.reagentLabel,
          sourceLabel: `${curve.source.fileName} · ${curve.source.sheetName} · ${curve.source.columnLetter}`,
          selected: selectedCurveIds.has(curve.curveId),
          warningCount: warningsByCurveId.get(curve.curveId)?.length ?? 0
        }))
      };
    });

    const curveIds = subgroups.flatMap((subgroup) => subgroup.curveIds);
    const selectedCount = countSelected(curveIds, selectedCurveIds);
    const groupId = createGroupId(groupingMode, primaryId);

    return {
      type: "group" as const,
      groupId,
      label: getPrimaryLabel(groupingMode, subgroups[0]?.curves[0], curvesById, curveIds[0]),
      curveIds,
      checkState: getCheckState(selectedCount, curveIds.length),
      selectedCount,
      totalCount: curveIds.length,
      collapsed: collapsedGroupIds.has(groupId),
      subgroups
    };
  });
}

export function createAllMajorGroupIds(dataset: PcrDataset) {
  const ids = new Set<string>();

  dataset.reagents.forEach((reagent) => ids.add(createGroupId("reagent", reagent.id)));
  dataset.specimens.forEach((specimen) => ids.add(createGroupId("specimen", specimen.id)));

  return ids;
}

export function createGroupId(groupingMode: GroupingMode, entityId: string) {
  return `group:${groupingMode}:${entityId}`;
}

export function getCheckState(selectedCount: number, totalCount: number): CheckState {
  if (totalCount === 0 || selectedCount === 0) return "unchecked";
  if (selectedCount === totalCount) return "checked";
  return "mixed";
}

function createSubgroupId(groupingMode: GroupingMode, primaryId: string, secondaryId: string) {
  return `subgroup:${groupingMode}:${primaryId}:${secondaryId}`;
}

function countSelected(curveIds: string[], selectedCurveIds: Set<string>) {
  return curveIds.reduce((count, curveId) => count + (selectedCurveIds.has(curveId) ? 1 : 0), 0);
}

function getPrimaryLabel(
  groupingMode: GroupingMode,
  firstCurveNode: { curveId: string } | undefined,
  curvesById: Map<string, Curve>,
  firstCurveId: string | undefined
) {
  const curve = firstCurveNode ? curvesById.get(firstCurveNode.curveId) : firstCurveId ? curvesById.get(firstCurveId) : undefined;
  if (!curve) return "";
  return groupingMode === "reagent" ? curve.reagentLabel : curve.specimenLabel;
}

function getSecondaryLabel(groupingMode: GroupingMode, curve: Curve) {
  return groupingMode === "reagent" ? curve.specimenLabel : curve.reagentLabel;
}
