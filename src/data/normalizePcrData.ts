import { createSimilarNameWarnings } from "./similarNameWarnings";
import { getFiniteRange } from "./numericRange";
import type { Curve, CurveStats, DatasetSourceKind, PcrDataset, PcrEntity, PcrWarning } from "./types";
import { normalizeWarningProvenance } from "./warningProvenance";

let sourceInstanceSequence = 0;

export function createPcrDatasetFromCurves(args: {
  curves: Curve[];
  fileName: string;
  sheetName: string;
  cycleCount: number;
  sourceKind?: DatasetSourceKind;
  importedAtIso?: string;
  warnings?: PcrWarning[];
  sourceInstanceId?: string;
}): PcrDataset {
  const sourceKind = args.sourceKind ?? inferDatasetSourceKind(args.curves);
  const sourcedCurves = normalizeCurveSources(
    args.curves,
    sourceKind,
    args.sourceInstanceId ?? createImportedSourceInstanceId(sourceKind)
  );
  const curves = sourcedCurves.map((curve) => ({
    ...curve,
    warnings: normalizeWarningProvenance(curve.warnings, sourcedCurves)
  }));
  const orderedCurveIds = curves.map((curve) => curve.curveId);
  const specimenMap = createEntityMap(curves, "specimen");
  const reagentMap = createEntityMap(curves, "reagent");
  const duplicateLabelWarnings = createDuplicateCurveLabelWarnings(curves);
  const formattedIdentityWarnings = createFormattedHeaderIdentityWarnings(curves);
  const similarWarnings = createSimilarNameWarnings(
      [...specimenMap.values()].map((entity) => entity.label),
      "specimen",
      createCurveIdsByLabel(curves, "specimen")
    ).concat(
      createSimilarNameWarnings(
        [...reagentMap.values()].map((entity) => entity.label),
        "reagent",
        createCurveIdsByLabel(curves, "reagent")
      )
    );

  const warnings = normalizeWarningProvenance(
    (args.warnings ?? []).concat(formattedIdentityWarnings, duplicateLabelWarnings, similarWarnings),
    curves
  );

  return {
    schemaVersion: 2,
    sourceKind,
    datasetId: `dataset:${args.fileName}:${args.sheetName}:${args.curves.length}`,
    sourceFileName: args.fileName,
    sheetName: args.sheetName,
    sheetIndex: 0,
    importedAtIso: args.importedAtIso ?? new Date().toISOString(),
    cycleCount: args.cycleCount,
    curves,
    orderedCurveIds,
    specimens: [...specimenMap.values()],
    reagents: [...reagentMap.values()],
    warnings
  };
}

function normalizeCurveSources(
  curves: Curve[],
  datasetSourceKind: DatasetSourceKind,
  fallbackSourceInstanceId: string
) {
  return curves.map((curve) => {
    const sourceKind = curve.source.sourceKind ?? (datasetSourceKind === "paste" ? "paste" : "excel");
    const sourceInstanceId = curve.source.sourceInstanceId ?? fallbackSourceInstanceId;
    return {
      ...curve,
      source: {
        ...curve.source,
        sourceKind,
        sourceInstanceId,
        specimenHeader:
          sourceKind === "excel"
            ? curve.source.specimenHeader ?? createSyntheticHeaderProvenance(curve.specimenLabel)
            : curve.source.specimenHeader,
        reagentHeader:
          sourceKind === "excel"
            ? curve.source.reagentHeader ?? createSyntheticHeaderProvenance(curve.reagentLabel)
            : curve.source.reagentHeader
      }
    };
  });
}

function createSyntheticHeaderProvenance(label: string) {
  return {
    rawValue: label,
    displayValue: label,
    cellType: "generated",
    formulaCacheStatus: "not-formula" as const
  };
}

export function createImportedSourceInstanceId(sourceKind: DatasetSourceKind) {
  sourceInstanceSequence += 1;
  const randomId = globalThis.crypto?.randomUUID?.();
  const token = randomId ?? `${Date.now().toString(36)}-${sourceInstanceSequence.toString(36)}`;
  return `source:${sourceKind}:${token}`;
}

function inferDatasetSourceKind(curves: Curve[]): DatasetSourceKind {
  const sourceKinds = new Set(curves.map((curve) => curve.source.sourceKind ?? "excel"));
  return sourceKinds.size > 1 ? "mixed" : (sourceKinds.values().next().value ?? "excel");
}

export function createStats(values: Array<number | null>): CurveStats {
  const range = getFiniteRange(values);

  return {
    pointCount: values.length,
    missingCount: values.length - (range?.count ?? 0),
    minY: range?.min ?? null,
    maxY: range?.max ?? null
  };
}

export function createEntityId(kind: "specimen" | "reagent", label: string, fallbackKey?: string) {
  const key =
    label.trim().length > 0
      ? Array.from(label).map((character) => character.codePointAt(0)?.toString(16)).join("_")
      : fallbackKey;
  return `${kind}:${key || "missing"}`;
}

function createEntityMap(curves: Curve[], kind: "specimen" | "reagent") {
  const map = new Map<string, PcrEntity>();

  curves.forEach((curve) => {
    const id = kind === "specimen" ? curve.specimenId : curve.reagentId;
    const label = kind === "specimen" ? curve.specimenLabel : curve.reagentLabel;
    const existing = map.get(id);
    if (existing) {
      existing.curveIds.push(curve.curveId);
    } else {
      map.set(id, {
        id,
        label,
        curveIds: [curve.curveId],
        warnings: []
      });
    }
  });

  return map;
}

function createCurveIdsByLabel(curves: Curve[], kind: "specimen" | "reagent") {
  const map = new Map<string, string[]>();

  curves.forEach((curve) => {
    const label = kind === "specimen" ? curve.specimenLabel : curve.reagentLabel;
    const curveIds = map.get(label) ?? [];
    curveIds.push(curve.curveId);
    map.set(label, curveIds);
  });

  return map;
}

function createDuplicateCurveLabelWarnings(curves: Curve[]): PcrWarning[] {
  const byDisplayLabel = new Map<string, string[]>();

  curves.forEach((curve) => {
    const curveIds = byDisplayLabel.get(curve.displayLabel) ?? [];
    curveIds.push(curve.curveId);
    byDisplayLabel.set(curve.displayLabel, curveIds);
  });

  return [...byDisplayLabel.entries()]
    .filter(([, curveIds]) => curveIds.length > 1)
    .map(([label, curveIds]) => ({
      code: "DUPLICATE_CURVE_LABEL",
      severity: "warning",
      scope: "dataset",
      message: `Duplicate curve label detected: ${label}`,
      labels: [label],
      curveIds
    }));
}

function createFormattedHeaderIdentityWarnings(curves: Curve[]): PcrWarning[] {
  const byDisplayLabel = new Map<string, Curve[]>();
  for (const curve of curves) {
    if (!curve.source.specimenHeader && !curve.source.reagentHeader) continue;
    const matchingCurves = byDisplayLabel.get(curve.displayLabel) ?? [];
    matchingCurves.push(curve);
    byDisplayLabel.set(curve.displayLabel, matchingCurves);
  }

  return [...byDisplayLabel.entries()].flatMap(([displayLabel, matchingCurves]) => {
    if (matchingCurves.length < 2) return [];
    const rawIdentities = new Set(
      matchingCurves.map((curve) =>
        JSON.stringify([
          curve.source.specimenHeader?.rawValue,
          curve.source.specimenHeader?.cellType,
          curve.source.reagentHeader?.rawValue,
          curve.source.reagentHeader?.cellType
        ])
      )
    );
    if (rawIdentities.size < 2) return [];

    return [
      {
        code: "FORMATTED_HEADER_IDENTITY_COLLISION" as const,
        severity: "warning" as const,
        scope: "dataset" as const,
        message: `Different raw Excel headers display as the same curve identity: ${displayLabel}`,
        curveIds: matchingCurves.map((curve) => curve.curveId),
        labels: [displayLabel],
        handling: "kept" as const,
        sourceRefs: matchingCurves.map((curve) => ({
          sourceInstanceId: curve.source.sourceInstanceId,
          sourceName: curve.source.fileName,
          sourceKind: curve.source.sourceKind,
          worksheet: curve.source.sheetName,
          range: `${curve.source.specimenCell}:${curve.source.reagentCell}`,
          columnLetter: curve.source.columnLetter,
          rawValue: JSON.stringify([
            curve.source.specimenHeader?.rawValue ?? null,
            curve.source.reagentHeader?.rawValue ?? null
          ]),
          displayValue: displayLabel
        }))
      }
    ];
  });
}
