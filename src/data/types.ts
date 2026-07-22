export type WarningSeverity = "info" | "warning" | "error";

export type ImportedSourceKind = "excel" | "paste";
export type DatasetSourceKind = ImportedSourceKind | "mixed";
export type PasteInputMode = "fullTable" | "singleSpecimen";

export type WarningScope = "import" | "dataset" | "header" | "curve" | "cell" | "export";

export type PcrWarningCode =
  | "IGNORED_WORKSHEETS"
  | "FIRST_SHEET_INVALID"
  | "MISSING_SPECIMEN_LABEL"
  | "INHERITED_SPECIMEN_LABEL"
  | "MISSING_REAGENT_LABEL"
  | "SIMILAR_SPECIMEN_LABEL"
  | "SIMILAR_REAGENT_LABEL"
  | "DUPLICATE_CURVE_LABEL"
  | "NON_NUMERIC_FLUORESCENCE"
  | "EMPTY_FLUORESCENCE_CELL"
  | "FORMULA_CACHED_VALUE_USED"
  | "FORMULA_WITHOUT_CACHED_VALUE"
  | "MERGED_HEADER_CELL"
  | "FORMATTED_HEADER_EMPTY"
  | "FORMATTED_HEADER_IDENTITY_COLLISION"
  | "FILE_SIGNATURE_MISMATCH"
  | "INVALID_PASTED_TABLE"
  | "UNSUPPORTED_FILE_TYPE"
  | "PROTECTED_OR_UNREADABLE_WORKBOOK";

export type WarningHandling = "kept" | "null-gap" | "ignored" | "blocked";
export type FormulaCacheStatus = "not-formula" | "used" | "missing";
export type ProvenanceRawValue = string | number | boolean | null;

export type CellValueProvenance = {
  rawValue?: ProvenanceRawValue;
  displayValue: string;
  cellType?: string;
  numberFormat?: string;
  formulaText?: string;
  formulaCacheStatus?: FormulaCacheStatus;
};

export type WarningSourceRef = {
  sourceInstanceId?: string;
  sourceName: string;
  sourceKind?: ImportedSourceKind;
  worksheet?: string;
  cell?: string;
  range?: string;
  columnLetter?: string;
  rawValue?: ProvenanceRawValue;
  displayValue?: string;
  cellType?: string;
  numberFormat?: string;
  formulaText?: string;
  formulaCacheStatus?: FormulaCacheStatus;
};

export type PcrWarning = {
  code: PcrWarningCode;
  severity: WarningSeverity;
  scope: WarningScope;
  message: string;
  curveIds?: string[];
  labels?: string[];
  sourceCell?: string;
  sourceRange?: string;
  sheetName?: string;
  columnLetter?: string;
  rawValue?: unknown;
  handling?: WarningHandling;
  sourceRefs?: WarningSourceRef[];
};

export type CurveSource = {
  sourceKind?: ImportedSourceKind;
  sourceInstanceId?: string;
  inputMode?: PasteInputMode;
  fileName: string;
  sheetName: string;
  sheetIndex: number;
  columnIndex: number;
  columnLetter: string;
  specimenCell: string;
  reagentCell: string;
  dataStartCell: string;
  dataEndCell: string;
  specimenHeader?: CellValueProvenance;
  reagentHeader?: CellValueProvenance;
};

export type CurveStats = {
  pointCount: number;
  missingCount: number;
  minY: number | null;
  maxY: number | null;
};

export type CurveStyleOverride = {
  displayName?: string;
  color?: string;
  lineType?: LineType;
  markerType?: MarkerType;
  lineWidth?: number;
  visible?: boolean;
  source?: CurveStyleOverrideSource;
  fieldSources?: Partial<Record<CurveStyleField, CurveStyleOverrideSource>>;
};

export type CurveStyleOverrideSource = "custom" | "preset";
export type CurveStyleField = "displayName" | "color" | "lineType" | "markerType" | "lineWidth" | "visible";
export type LineType = "solid" | "dashed" | "dotted";
export type MarkerType = "none" | "circle" | "triangle" | "rect";

export type StyleGroupingTarget = "specimen" | "reagent";
export type StyleFieldOrigin = "override" | "group" | "default";

export type StyleRules = {
  colorBy: StyleGroupingTarget;
  lineTypeBy: StyleGroupingTarget;
  markerBy: StyleGroupingTarget;
  specimenColors: Record<string, string>;
  reagentColors: Record<string, string>;
  specimenLineTypes: Record<string, LineType>;
  reagentLineTypes: Record<string, LineType>;
  specimenMarkerTypes: Record<string, MarkerType>;
  reagentMarkerTypes: Record<string, MarkerType>;
};

export type ResolvedCurveStyle = {
  displayName: string;
  color: string;
  lineType: LineType;
  markerType: MarkerType;
  lineWidth: number;
  visible: boolean;
  source?: CurveStyleOverrideSource;
  sources: Partial<Record<CurveStyleField, CurveStyleOverrideSource>>;
  origins: {
    displayName: StyleFieldOrigin;
    color: StyleFieldOrigin;
    lineType: StyleFieldOrigin;
    markerType: StyleFieldOrigin;
    lineWidth: StyleFieldOrigin;
    visible: StyleFieldOrigin;
  };
};

export type ImageExportLayout = "plotOnly" | "plotWithLegend" | "legendOnly";
export type ReportLegendLabelMode = "autoCompact" | "full";

export type LegendSettings = {
  previewVisible: boolean;
  reportLabelMode: ReportLegendLabelMode;
  reportNameOverrides: Record<string, string>;
};

export type ExportSettings = {
  imageLayout: ImageExportLayout;
};

export type Curve = {
  curveId: string;
  sourceId: string;
  specimenId: string;
  reagentId: string;
  specimenLabel: string;
  reagentLabel: string;
  displayLabel: string;
  x: number[];
  y: Array<number | null>;
  source: CurveSource;
  stats: CurveStats;
  warnings: PcrWarning[];
};

export type PcrEntity = {
  id: string;
  label: string;
  curveIds: string[];
  warnings: PcrWarning[];
};

export type PcrDataset = {
  schemaVersion: 2;
  sourceKind?: DatasetSourceKind;
  datasetId: string;
  sourceFileName: string;
  sheetName: string;
  sheetIndex: number;
  importedAtIso: string;
  cycleCount: number;
  curves: Curve[];
  orderedCurveIds: string[];
  specimens: PcrEntity[];
  reagents: PcrEntity[];
  warnings: PcrWarning[];
};

export type GroupingMode = "reagent" | "specimen";
export type SelectionFilter = "all" | "selected" | "unselected" | "warning";

export type CheckState = "checked" | "unchecked" | "mixed";

export type TreeCurveNode = {
  type: "curve";
  curveId: string;
  label: string;
  specimenLabel: string;
  reagentLabel: string;
  sourceLabel: string;
  selected: boolean;
  warningCount: number;
};

export type TreeSubgroupNode = {
  type: "subgroup";
  groupId: string;
  label: string;
  curveIds: string[];
  checkState: CheckState;
  selectedCount: number;
  totalCount: number;
  curves: TreeCurveNode[];
};

export type TreeGroupNode = {
  type: "group";
  groupId: string;
  label: string;
  curveIds: string[];
  checkState: CheckState;
  selectedCount: number;
  totalCount: number;
  collapsed: boolean;
  subgroups: TreeSubgroupNode[];
};

export type SelectionState = {
  groupingMode: GroupingMode;
  selectedCurveIds: Set<string>;
  collapsedGroupIds: Set<string>;
  orderedCurveIds: string[];
};

export type SelectionSet = {
  selectionSetId: string;
  name: string;
  curveIds: string[];
};
