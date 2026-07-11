export const quickPasteBoundaryCases = [
  { id: "tall-supported", rows: 250_000, columns: 1, expected: "preview" },
  { id: "wide-supported", rows: 3, columns: 83_333, expected: "preview" },
  { id: "balanced-supported", rows: 500, columns: 500, expected: "preview" },
  { id: "cell-over-limit", rows: 501, columns: 500, expected: "reject-without-mutation" }
] as const;

export const scaleEvidenceCases = [
  { id: "fixed-reversed", mode: "fixed", min: "20", max: "10", expected: "invalid-active" },
  { id: "preset1-empty", mode: "preset1", min: "", max: "", expected: "invalid-draft" },
  { id: "preset2-exponent", mode: "preset2", min: "-1e-5", max: "2e-5", expected: "valid" },
  { id: "box-zoom-tiny", mode: "fixed", min: "0.00001", max: "0.00002", expected: "valid" }
] as const;

export const legendIdentityCases = {
  uniqueSuffixes: [
    { curveId: "curve-a", label: "Condition Alpha concentration with distinguishing Lot A", sourceAlias: "source-1" },
    { curveId: "curve-b", label: "Condition Alpha concentration with distinguishing Lot B", sourceAlias: "source-2" }
  ],
  finalStringCollision: [
    { curveId: "curve-c", label: "Condition Shared Final Label", sourceAlias: "source-1" },
    { curveId: "curve-d", label: "Condition Shared Final Label", sourceAlias: "source-2" }
  ]
} as const;

export const sourceCompatibilityCases = [
  { sourceAlias: "source-1", sourceKind: "excel", cycleCount: 40, specimenLabels: ["Synthetic Source A"], reagentLabels: ["Assay 1", "Assay 2"] },
  { sourceAlias: "source-2", sourceKind: "paste", cycleCount: 60, specimenLabels: ["Synthetic Source A"], reagentLabels: ["Assay 1", "Assay 3"] }
] as const;

export const labelWarningCases = {
  duplicatePairs: [
    ["Synthetic Sample", "Assay 1"],
    ["Synthetic Sample", "Assay 1"]
  ],
  similarSpecimens: ["Synthetic Sample 01", "Synthetic Sample 1"],
  similarReagents: ["Assay-A", "Assay A"]
} as const;

export const malformedAnalysisCases = [
  { id: "curve-length", mutation: "curve x/y length mismatch", expected: "reject-before-state-commit" },
  { id: "stats", mutation: "stored stats differ from points", expected: "reject-before-state-commit" },
  { id: "entity-membership", mutation: "entity references unknown curve", expected: "reject-before-state-commit" },
  { id: "source-membership", mutation: "curve source missing from source files", expected: "reject-before-state-commit" },
  { id: "order-reference", mutation: "order references unknown curve", expected: "reject-before-state-commit" },
  { id: "chunk-missing", mutation: "restore chunk index missing", expected: "reject-before-state-commit" }
] as const;

export function createQuickPasteText(rows: number, columns: number) {
  if (rows < 3 || columns < 1) throw new Error("Quick Paste fixture requires at least 3 rows and 1 column.");
  const specimen = Array.from({ length: columns }, () => "S").join("\t");
  const reagent = Array.from({ length: columns }, () => "A").join("\t");
  const dataRow = Array.from({ length: columns }, () => "0").join("\t");
  return [specimen, reagent, ...Array.from({ length: rows - 2 }, () => dataRow)].join("\n");
}
