import { enableMapSet } from "immer";
import { immer } from "zustand/middleware/immer";
import { create } from "zustand";
import type { AxisId, ChartScaleState, ScaleMode, ScalePresetId } from "../chart/chartScale";
import { createDefaultChartScale } from "../chart/chartScale";
import type { BuiltInStylePresetId } from "../chart/chartStyle";
import { createDefaultStyleRules, createPresetOverrides } from "../chart/chartStyle";
import {
  createDefaultExportSettings,
  createDefaultLegendSettings,
  createSourceFileSummary,
  type AnalysisState,
  type SourceFileSummary
} from "../analysis/analysisState";
import { readAnalysisWorkbookFile } from "../analysis/analysisWorkbook";
import type {
  CurveStyleField,
  CurveStyleOverride,
  CurveStyleOverrideSource,
  ExportSettings,
  GroupingMode,
  LineType,
  MarkerType,
  PcrDataset,
  SelectionFilter,
  SelectionState,
  StyleGroupingTarget,
  StyleRules
} from "../data/types";
import { parseExcelFile } from "../data/parseExcel";
import { appendPcrDataset } from "../data/mergeDatasets";
import { createAllMajorGroupIds } from "../selection/buildTrees";
import {
  createInitialSelectionState,
  setAllGroupsCollapsed,
  setCurveSelection,
  setGroupingMode as setSelectionGroupingMode,
  toggleCurveSelection,
  toggleGroupCollapse
} from "../selection/selectionState";

enableMapSet();

type ImportStatus = "idle" | "importing" | "ready" | "error";

type PresetUndoSnapshot = {
  previousOverrides: Record<string, CurveStyleOverride | undefined>;
  affectedCurveIds: string[];
};

export type AnalysisTabState = Omit<AnalysisState, "dataset" | "selection"> & {
  dataset: PcrDataset | null;
  selection: SelectionState | null;
  lastPresetUndo: PresetUndoSnapshot | null;
  lastPresetMessage: string | null;
  exportMessage: string | null;
  importStatus: ImportStatus;
  importError: string | null;
};

export const DIRTY_REPLACE_BLOCKED_MESSAGE =
  "Unsaved analysis changes are present. Replace is blocked until the close/replace confirmation UX is finalized.";

type ActiveAnalysisAdapterState = Omit<AnalysisTabState, "analysisId">;

type WorkspaceState = {
  activeAnalysisId: string;
  analysisOrder: string[];
  analyses: Record<string, AnalysisTabState>;
  analysisSequence: number;
};

type AppState = WorkspaceState & ActiveAnalysisAdapterState;

type AppStore = AppState & {
  loadDataset: (dataset: PcrDataset) => void;
  importFile: (file: File) => Promise<void>;
  appendFile: (file: File) => Promise<void>;
  reset: () => void;
  createAnalysis: (analysisName?: string) => string;
  switchAnalysis: (analysisId: string) => void;
  renameAnalysis: (analysisId: string, analysisName: string) => void;
  closeAnalysis: (analysisId: string) => boolean;
  setSearchQuery: (query: string) => void;
  setSelectionFilter: (filter: SelectionFilter) => void;
  setAxisScaleMode: (axis: AxisId, mode: ScaleMode) => void;
  setAxisFixedValue: (axis: AxisId, bound: "min" | "max", value: string) => void;
  setAxisPresetValue: (axis: AxisId, preset: ScalePresetId, field: "label" | "min" | "max", value: string) => void;
  setStyleGroupingTarget: (field: "colorBy" | "lineTypeBy" | "markerBy", target: StyleGroupingTarget) => void;
  setGroupColor: (target: StyleGroupingTarget, entityId: string, color: string) => void;
  setGroupLineType: (target: StyleGroupingTarget, entityId: string, lineType: LineType) => void;
  setGroupMarkerType: (target: StyleGroupingTarget, entityId: string, markerType: MarkerType) => void;
  resetGroupStyle: (target: StyleGroupingTarget, entityId: string) => void;
  setCurveOverride: (curveId: string, override: CurveStyleOverride) => void;
  resetCurveOverrideField: (curveId: string, field: CurveStyleField) => void;
  resetCurveOverride: (curveId: string) => void;
  resetSelectedCurveOverrides: () => void;
  resetAllCurveOverrides: () => void;
  setLegendPreviewVisible: (visible: boolean) => void;
  setExportImageLayout: (layout: ExportSettings["imageLayout"]) => void;
  applyStylePreset: (preset: BuiltInStylePresetId, curveIds: Iterable<string>) => void;
  undoLastPreset: () => void;
  moveCurveOrder: (curveId: string, direction: "up" | "down") => void;
  markExportSuccess: (message: string) => void;
  markAnalysisSaveSuccess: (message: string) => void;
  setExportMessage: (message: string | null) => void;
  setGroupingMode: (groupingMode: GroupingMode) => void;
  toggleCurve: (curveId: string) => void;
  setCurvesSelected: (curveIds: Iterable<string>, selected: boolean) => void;
  toggleGroup: (groupId: string) => void;
  setAllGroupsCollapsed: (collapsed: boolean) => void;
};

export const useAppStore = create<AppStore>()(
  immer((set, get) => ({
    ...createInitialAppState(),
    loadDataset: (dataset) => {
      set((state) => {
        state.dataset = dataset;
        state.selection = createInitialSelectionState(dataset);
        state.analysisName = dataset.sourceFileName || state.analysisName;
        state.searchQuery = "";
        state.selectionFilter = "all";
        state.chartScale = createDefaultChartScale();
        state.styleRules = createDefaultStyleRules();
        state.curveOverrides = {};
        state.legendSettings = createDefaultLegendSettings();
        state.exportSettings = createDefaultExportSettings();
        state.lastPresetUndo = null;
        state.lastPresetMessage = null;
        state.exportCounter = 1;
        state.exportMessage = null;
        state.importStatus = "ready";
        state.importError = null;
        state.importFileName = dataset.sourceFileName;
        state.sourceFiles = [createSourceFileSummary(dataset)];
        markDirtyAndPersistActive(state);
      });
    },
    importFile: async (file) => {
      const targetAnalysisId = get().activeAnalysisId;
      const targetAnalysis = get().analyses[targetAnalysisId];
      if (targetAnalysis?.dirty) {
        set((state) => {
          setAnalysisImportError(state, targetAnalysisId, DIRTY_REPLACE_BLOCKED_MESSAGE);
        });
        return;
      }

      set((state) => {
        setAnalysisImporting(state, targetAnalysisId, file.name);
      });

      const analysisWorkbook = await readAnalysisWorkbookFile(file);
      if (analysisWorkbook.kind === "analysis") {
        set((state) => {
          if (blockDirtyReplaceIfNeeded(state, targetAnalysisId)) return;
          restoreAnalysisToTab(state, targetAnalysisId, analysisWorkbook.analysis);
        });
        return;
      }

      if (analysisWorkbook.kind === "invalid-analysis") {
        set((state) => {
          setAnalysisImportError(state, targetAnalysisId, analysisWorkbook.message);
        });
        return;
      }

      const result = await parseExcelFile(file);
      if (result.ok) {
        set((state) => {
          if (blockDirtyReplaceIfNeeded(state, targetAnalysisId)) return;
          replaceAnalysisDataset(state, targetAnalysisId, result.dataset);
        });
      } else {
        set((state) => {
          setAnalysisImportError(state, targetAnalysisId, result.error.message);
        });
      }
    },
    appendFile: async (file) => {
      const targetAnalysisId = get().activeAnalysisId;
      const analysisWorkbook = await readAnalysisWorkbookFile(file);
      if (analysisWorkbook.kind === "analysis") {
        set((state) => {
          openAnalysisInNewTab(state, analysisWorkbook.analysis);
        });
        return;
      }

      if (analysisWorkbook.kind === "invalid-analysis") {
        set((state) => {
          setAnalysisImportError(state, targetAnalysisId, analysisWorkbook.message);
        });
        return;
      }

      const currentDataset = get().analyses[targetAnalysisId]?.dataset ?? null;
      if (!currentDataset) {
        if (get().analyses[targetAnalysisId]?.dirty) {
          set((state) => {
            setAnalysisImportError(state, targetAnalysisId, DIRTY_REPLACE_BLOCKED_MESSAGE);
          });
          return;
        }

        set((state) => {
          setAnalysisImporting(state, targetAnalysisId, file.name);
        });

        const result = await parseExcelFile(file);
        if (result.ok) {
          set((state) => {
            if (blockDirtyReplaceIfNeeded(state, targetAnalysisId)) return;
            replaceAnalysisDataset(state, targetAnalysisId, result.dataset);
          });
        } else {
          set((state) => {
            setAnalysisImportError(state, targetAnalysisId, result.error.message);
          });
        }
        return;
      }

      set((state) => {
        setAnalysisImporting(state, targetAnalysisId, file.name);
      });

      const result = await parseExcelFile(file);
      if (result.ok) {
        set((state) => {
          appendDatasetToAnalysis(state, targetAnalysisId, result.dataset, file.name);
        });
      } else {
        set((state) => {
          setAnalysisImportError(state, targetAnalysisId, result.error.message);
        });
      }
    },
    reset: () => {
      set(() => createInitialAppState());
    },
    createAnalysis: (analysisName) => {
      const nextSequence = get().analysisSequence + 1;
      const analysisId = `analysis-${nextSequence}`;
      set((state) => {
        persistActiveAnalysis(state);
        state.analysisSequence = nextSequence;
        const analysis = createEmptyAnalysisTab(analysisId, analysisName?.trim() || `Analysis ${nextSequence}`);
        state.analyses[analysisId] = analysis;
        state.analysisOrder.push(analysisId);
        state.activeAnalysisId = analysisId;
        applyAnalysisToAdapter(state, analysis);
      });
      return analysisId;
    },
    switchAnalysis: (analysisId) => {
      set((state) => {
        const nextAnalysis = state.analyses[analysisId];
        if (!nextAnalysis || state.activeAnalysisId === analysisId) return;
        persistActiveAnalysis(state);
        state.activeAnalysisId = analysisId;
        applyAnalysisToAdapter(state, nextAnalysis);
      });
    },
    renameAnalysis: (analysisId, analysisName) => {
      set((state) => {
        const analysis = state.analyses[analysisId];
        if (!analysis) return;

        analysis.analysisName = analysisName;
        analysis.dirty = true;
        if (state.activeAnalysisId === analysisId) {
          state.analysisName = analysisName;
          state.dirty = true;
          persistActiveAnalysis(state);
        }
      });
    },
    closeAnalysis: (analysisId) => {
      let didClose = false;
      set((state) => {
        const analysis = state.activeAnalysisId === analysisId ? snapshotAdapterAsAnalysis(state) : state.analyses[analysisId];
        if (!analysis || analysis.dirty) return;

        if (state.analysisOrder.length === 1) {
          const replacement = createEmptyAnalysisTab("analysis-1", "Analysis 1");
          state.activeAnalysisId = replacement.analysisId;
          state.analysisOrder = [replacement.analysisId];
          state.analyses = { [replacement.analysisId]: replacement };
          state.analysisSequence = 1;
          applyAnalysisToAdapter(state, replacement);
          didClose = true;
          return;
        }

        const closeIndex = state.analysisOrder.indexOf(analysisId);
        state.analysisOrder = state.analysisOrder.filter((id) => id !== analysisId);
        delete state.analyses[analysisId];

        if (state.activeAnalysisId === analysisId) {
          const fallbackId = state.analysisOrder[Math.max(0, closeIndex - 1)] ?? state.analysisOrder[0];
          const fallbackAnalysis = state.analyses[fallbackId];
          state.activeAnalysisId = fallbackId;
          applyAnalysisToAdapter(state, fallbackAnalysis);
        }
        didClose = true;
      });
      return didClose;
    },
    setSearchQuery: (query) => {
      set((state) => {
        state.searchQuery = query;
        markDirtyAndPersistActive(state);
      });
    },
    setSelectionFilter: (filter) => {
      set((state) => {
        state.selectionFilter = filter;
        markDirtyAndPersistActive(state);
      });
    },
    setAxisScaleMode: (axis, mode) => {
      set((state) => {
        state.chartScale[axis].mode = mode;
        markDirtyAndPersistActive(state);
      });
    },
    setAxisFixedValue: (axis, bound, value) => {
      set((state) => {
        if (bound === "min") {
          state.chartScale[axis].fixedMin = value;
        } else {
          state.chartScale[axis].fixedMax = value;
        }
        markDirtyAndPersistActive(state);
      });
    },
    setAxisPresetValue: (axis, preset, field, value) => {
      set((state) => {
        state.chartScale[axis][preset] ??= {
          label: preset === "preset1" ? "P1" : "P2",
          min: "",
          max: ""
        };
        state.chartScale[axis][preset][field] = value;
        markDirtyAndPersistActive(state);
      });
    },
    setStyleGroupingTarget: (field, target) => {
      set((state) => {
        state.styleRules[field] = target;
        markDirtyAndPersistActive(state);
      });
    },
    setGroupColor: (target, entityId, color) => {
      set((state) => {
        const key = target === "specimen" ? "specimenColors" : "reagentColors";
        state.styleRules[key][entityId] = color;
        markDirtyAndPersistActive(state);
      });
    },
    setGroupLineType: (target, entityId, lineType) => {
      set((state) => {
        const key = target === "specimen" ? "specimenLineTypes" : "reagentLineTypes";
        state.styleRules[key][entityId] = lineType;
        markDirtyAndPersistActive(state);
      });
    },
    setGroupMarkerType: (target, entityId, markerType) => {
      set((state) => {
        const key = target === "specimen" ? "specimenMarkerTypes" : "reagentMarkerTypes";
        state.styleRules[key][entityId] = markerType;
        markDirtyAndPersistActive(state);
      });
    },
    resetGroupStyle: (target, entityId) => {
      set((state) => {
        const colorKey = target === "specimen" ? "specimenColors" : "reagentColors";
        const lineKey = target === "specimen" ? "specimenLineTypes" : "reagentLineTypes";
        const markerKey = target === "specimen" ? "specimenMarkerTypes" : "reagentMarkerTypes";
        delete state.styleRules[colorKey][entityId];
        delete state.styleRules[lineKey][entityId];
        delete state.styleRules[markerKey][entityId];
        markDirtyAndPersistActive(state);
      });
    },
    setCurveOverride: (curveId, override) => {
      set((state) => {
        const previousOverride = state.curveOverrides[curveId];
        const nextFieldSources = {
          ...previousOverride?.fieldSources,
          ...createOverrideFieldSources(override, override.source ?? "custom")
        };
        state.curveOverrides[curveId] = {
          ...previousOverride,
          ...override,
          source: override.source ?? "custom",
          fieldSources: nextFieldSources
        };
        state.lastPresetUndo = null;
        markDirtyAndPersistActive(state);
      });
    },
    resetCurveOverrideField: (curveId, field) => {
      set((state) => {
        const previousOverride = state.curveOverrides[curveId];
        if (!previousOverride) return;

        delete previousOverride[field];
        delete previousOverride.fieldSources?.[field];

        if (previousOverride.fieldSources && Object.keys(previousOverride.fieldSources).length === 0) {
          delete previousOverride.fieldSources;
        }

        if (!hasCurveOverrideValue(previousOverride)) {
          delete state.curveOverrides[curveId];
        } else {
          previousOverride.source = inferOverrideSource(previousOverride);
        }

        state.lastPresetUndo = null;
        markDirtyAndPersistActive(state);
      });
    },
    resetCurveOverride: (curveId) => {
      set((state) => {
        delete state.curveOverrides[curveId];
        state.lastPresetUndo = null;
        markDirtyAndPersistActive(state);
      });
    },
    resetSelectedCurveOverrides: () => {
      set((state) => {
        if (!state.selection) return;
        state.selection.selectedCurveIds.forEach((curveId) => {
          delete state.curveOverrides[curveId];
        });
        state.lastPresetUndo = null;
        markDirtyAndPersistActive(state);
      });
    },
    resetAllCurveOverrides: () => {
      set((state) => {
        state.curveOverrides = {};
        state.lastPresetUndo = null;
        markDirtyAndPersistActive(state);
      });
    },
    setLegendPreviewVisible: (visible) => {
      set((state) => {
        state.legendSettings.previewVisible = visible;
        markDirtyAndPersistActive(state);
      });
    },
    setExportImageLayout: (layout) => {
      set((state) => {
        state.exportSettings.imageLayout = layout;
        markDirtyAndPersistActive(state);
      });
    },
    applyStylePreset: (preset, curveIds) => {
      set((state) => {
        if (!state.dataset) return;
        const affectedCurveIds = [...curveIds];
        const curvesById = new Map(state.dataset.curves.map((curve) => [curve.curveId, curve]));
        const affectedCurves = affectedCurveIds
          .map((curveId) => curvesById.get(curveId))
          .filter((curve): curve is NonNullable<typeof curve> => Boolean(curve));
        const nextOverrides = createPresetOverrides({ curves: affectedCurves, referenceCurves: state.dataset.curves, preset });
        const previousOverrides = Object.fromEntries(
          affectedCurves.map((curve) => [curve.curveId, state.curveOverrides[curve.curveId]])
        );

        affectedCurves.forEach((curve) => {
          const previousOverride = state.curveOverrides[curve.curveId];
          const presetOverride = nextOverrides[curve.curveId];
          state.curveOverrides[curve.curveId] = {
            ...previousOverride,
            ...presetOverride,
            fieldSources: {
              ...previousOverride?.fieldSources,
              ...presetOverride.fieldSources
            },
            source: "preset"
          };
        });
        state.lastPresetUndo = {
          previousOverrides,
          affectedCurveIds: affectedCurves.map((curve) => curve.curveId)
        };
        state.lastPresetMessage = `${affectedCurves.length} curves updated by preset.`;
        markDirtyAndPersistActive(state);
      });
    },
    undoLastPreset: () => {
      set((state) => {
        if (!state.lastPresetUndo) return;
        state.lastPresetUndo.affectedCurveIds.forEach((curveId) => {
          const previous = state.lastPresetUndo?.previousOverrides[curveId];
          if (previous) {
            state.curveOverrides[curveId] = previous;
          } else {
            delete state.curveOverrides[curveId];
          }
        });
        state.lastPresetUndo = null;
        state.lastPresetMessage = "Last preset application was undone.";
        markDirtyAndPersistActive(state);
      });
    },
    moveCurveOrder: (curveId, direction) => {
      set((state) => {
        if (!state.selection) return;
        const visibleOrderedCurveIds = state.selection.orderedCurveIds.filter((orderedCurveId) =>
          state.selection?.selectedCurveIds.has(orderedCurveId)
        );
        const visibleIndex = visibleOrderedCurveIds.indexOf(curveId);
        const targetCurveId =
          visibleIndex >= 0 ? visibleOrderedCurveIds[direction === "up" ? visibleIndex - 1 : visibleIndex + 1] : undefined;
        if (!targetCurveId) return;

        const index = state.selection.orderedCurveIds.indexOf(curveId);
        const nextIndex = state.selection.orderedCurveIds.indexOf(targetCurveId);
        if (index < 0) return;
        if (nextIndex < 0 || nextIndex >= state.selection.orderedCurveIds.length) return;
        const nextOrder = [...state.selection.orderedCurveIds];
        [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
        state.selection.orderedCurveIds = nextOrder;
        markDirtyAndPersistActive(state);
      });
    },
    markExportSuccess: (message) => {
      set((state) => {
        state.exportMessage = message;
        state.exportCounter += 1;
        markDirtyAndPersistActive(state);
      });
    },
    markAnalysisSaveSuccess: (message) => {
      set((state) => {
        state.exportMessage = message;
        state.exportCounter += 1;
        state.dirty = false;
        persistActiveAnalysis(state);
      });
    },
    setExportMessage: (message) => {
      set((state) => {
        state.exportMessage = message;
        persistActiveAnalysis(state);
      });
    },
    setGroupingMode: (groupingMode) => {
      set((state) => {
        if (!state.selection) return;
        state.selection = setSelectionGroupingMode(state.selection, groupingMode);
        markDirtyAndPersistActive(state);
      });
    },
    toggleCurve: (curveId) => {
      set((state) => {
        if (!state.selection) return;
        state.selection = toggleCurveSelection(state.selection, curveId);
        markDirtyAndPersistActive(state);
      });
    },
    setCurvesSelected: (curveIds, selected) => {
      set((state) => {
        if (!state.selection) return;
        state.selection = setCurveSelection(state.selection, curveIds, selected);
        markDirtyAndPersistActive(state);
      });
    },
    toggleGroup: (groupId) => {
      set((state) => {
        if (!state.selection) return;
        state.selection = toggleGroupCollapse(state.selection, groupId);
        markDirtyAndPersistActive(state);
      });
    },
    setAllGroupsCollapsed: (collapsed) => {
      set((state) => {
        if (!state.dataset || !state.selection) return;
        state.selection = setAllGroupsCollapsed(state.dataset, state.selection, collapsed);
        markDirtyAndPersistActive(state);
      });
    }
  }))
);

function createInitialAppState(): AppState {
  const initialAnalysis = createEmptyAnalysisTab("analysis-1", "Analysis 1");
  return {
    activeAnalysisId: initialAnalysis.analysisId,
    analysisOrder: [initialAnalysis.analysisId],
    analyses: { [initialAnalysis.analysisId]: cloneAnalysisTab(initialAnalysis) },
    analysisSequence: 1,
    ...analysisToAdapterState(initialAnalysis)
  };
}

function createEmptyAnalysisTab(analysisId: string, analysisName: string): AnalysisTabState {
  return {
    analysisId,
    analysisName,
    dataset: null,
    selection: null,
    searchQuery: "",
    selectionFilter: "all",
    chartScale: createDefaultChartScale(),
    styleRules: createDefaultStyleRules(),
    curveOverrides: {},
    legendSettings: createDefaultLegendSettings(),
    exportSettings: createDefaultExportSettings(),
    lastPresetUndo: null,
    lastPresetMessage: null,
    exportCounter: 1,
    exportMessage: null,
    importStatus: "idle",
    importError: null,
    importFileName: null,
    sourceFiles: [],
    dirty: false
  };
}

function markDirtyAndPersistActive(state: AppState) {
  state.dirty = true;
  persistActiveAnalysis(state);
}

function persistActiveAnalysis(state: AppState) {
  state.analyses[state.activeAnalysisId] = snapshotAdapterAsAnalysis(state);
}

function getAnalysisForWrite(state: AppState, analysisId: string) {
  if (state.activeAnalysisId === analysisId) {
    persistActiveAnalysis(state);
  }
  return state.analyses[analysisId] ?? null;
}

function writeAnalysis(state: AppState, analysis: AnalysisTabState) {
  state.analyses[analysis.analysisId] = cloneAnalysisTab(analysis);
  if (state.activeAnalysisId === analysis.analysisId) {
    applyAnalysisToAdapter(state, analysis);
    persistActiveAnalysis(state);
  }
}

function setAnalysisImporting(state: AppState, analysisId: string, fileName: string) {
  const analysis = getAnalysisForWrite(state, analysisId);
  if (!analysis) return;
  analysis.importStatus = "importing";
  analysis.importError = null;
  analysis.importFileName = fileName;
  writeAnalysis(state, analysis);
}

function setAnalysisImportError(state: AppState, analysisId: string, message: string) {
  const analysis = getAnalysisForWrite(state, analysisId);
  if (!analysis) return;
  analysis.importStatus = analysis.dataset ? "ready" : "error";
  analysis.importError = message;
  writeAnalysis(state, analysis);
}

function blockDirtyReplaceIfNeeded(state: AppState, analysisId: string) {
  const analysis = getAnalysisForWrite(state, analysisId);
  if (!analysis?.dirty) return false;
  analysis.importStatus = analysis.dataset ? "ready" : "error";
  analysis.importError = DIRTY_REPLACE_BLOCKED_MESSAGE;
  writeAnalysis(state, analysis);
  return true;
}

function replaceAnalysisDataset(state: AppState, analysisId: string, dataset: PcrDataset) {
  if (blockDirtyReplaceIfNeeded(state, analysisId)) return;
  const previous = getAnalysisForWrite(state, analysisId);
  if (!previous) return;
  const nextAnalysis: AnalysisTabState = {
    ...cloneAnalysisTab(previous),
    analysisName: dataset.sourceFileName || previous.analysisName,
    dataset,
    selection: createInitialSelectionState(dataset),
    searchQuery: "",
    selectionFilter: "all",
    chartScale: createDefaultChartScale(),
    styleRules: createDefaultStyleRules(),
    curveOverrides: {},
    legendSettings: createDefaultLegendSettings(),
    exportSettings: createDefaultExportSettings(),
    lastPresetUndo: null,
    lastPresetMessage: null,
    exportCounter: 1,
    exportMessage: null,
    importStatus: "ready",
    importError: null,
    importFileName: dataset.sourceFileName,
    sourceFiles: [createSourceFileSummary(dataset)],
    dirty: true
  };
  writeAnalysis(state, nextAnalysis);
}

function appendDatasetToAnalysis(state: AppState, analysisId: string, appendedDataset: PcrDataset, fileName: string) {
  const previous = getAnalysisForWrite(state, analysisId);
  if (!previous) return;

  if (!previous.dataset) {
    replaceAnalysisDataset(state, analysisId, appendedDataset);
    return;
  }

  const previousSelection = previous.selection;
  const mergeResult = appendPcrDataset(previous.dataset, appendedDataset);
  const mergedCurveIds = new Set(mergeResult.dataset.curves.map((curve) => curve.curveId));
  const previousMajorGroupIds = createAllMajorGroupIds(previous.dataset);
  const nextMajorGroupIds = createAllMajorGroupIds(mergeResult.dataset);
  const collapsedGroupIds = new Set(previousSelection?.collapsedGroupIds ?? []);

  nextMajorGroupIds.forEach((groupId) => {
    if (!previousMajorGroupIds.has(groupId)) {
      collapsedGroupIds.add(groupId);
    }
  });

  const nextAnalysis: AnalysisTabState = {
    ...cloneAnalysisTab(previous),
    dataset: mergeResult.dataset,
    selection: {
      groupingMode: previousSelection?.groupingMode ?? "reagent",
      selectedCurveIds: new Set(
        [...(previousSelection?.selectedCurveIds ?? new Set<string>())].filter((curveId) => mergedCurveIds.has(curveId))
      ),
      collapsedGroupIds,
      orderedCurveIds: [
        ...(previousSelection?.orderedCurveIds ?? previous.dataset.orderedCurveIds).filter((curveId) => mergedCurveIds.has(curveId)),
        ...mergeResult.appendedCurveIds
      ]
    },
    importStatus: "ready",
    importError: null,
    importFileName: `${fileName} appended`,
    sourceFiles: [...previous.sourceFiles, createSourceFileSummary(appendedDataset)],
    lastPresetUndo: null,
    lastPresetMessage: previous.lastPresetUndo
      ? "Preset undo was cleared after appended data."
      : previous.lastPresetMessage,
    dirty: true
  };
  writeAnalysis(state, nextAnalysis);
}

function restoreAnalysisToTab(state: AppState, analysisId: string, analysis: AnalysisState) {
  if (blockDirtyReplaceIfNeeded(state, analysisId)) return;
  const previous = getAnalysisForWrite(state, analysisId);
  if (!previous) return;
  writeAnalysis(state, createTabFromAnalysisState({ ...analysis, analysisId }));
}

function openAnalysisInNewTab(state: AppState, analysis: AnalysisState) {
  persistActiveAnalysis(state);
  const nextSequence = state.analysisSequence + 1;
  const analysisId = `analysis-${nextSequence}`;
  const nextAnalysis = createTabFromAnalysisState({
    ...analysis,
    analysisId,
    analysisName: analysis.analysisName || `Analysis ${nextSequence}`
  });

  state.analysisSequence = nextSequence;
  state.analyses[analysisId] = nextAnalysis;
  state.analysisOrder.push(analysisId);
  state.activeAnalysisId = analysisId;
  applyAnalysisToAdapter(state, nextAnalysis);
  persistActiveAnalysis(state);
}

function createTabFromAnalysisState(analysis: AnalysisState): AnalysisTabState {
  return {
    analysisId: analysis.analysisId,
    analysisName: analysis.analysisName || "Untitled analysis",
    dataset: analysis.dataset,
    selection: cloneSelection(analysis.selection),
    searchQuery: analysis.searchQuery,
    selectionFilter: analysis.selectionFilter,
    chartScale: clonePlain(analysis.chartScale),
    styleRules: clonePlain(analysis.styleRules),
    curveOverrides: clonePlain(analysis.curveOverrides),
    legendSettings: clonePlain(analysis.legendSettings),
    exportSettings: clonePlain(analysis.exportSettings),
    lastPresetUndo: null,
    lastPresetMessage: null,
    exportCounter: analysis.exportCounter,
    exportMessage: null,
    importStatus: "ready",
    importError: null,
    importFileName: analysis.importFileName,
    sourceFiles: cloneSourceFiles(analysis.sourceFiles),
    dirty: false
  };
}

function snapshotAdapterAsAnalysis(state: AppState): AnalysisTabState {
  return {
    analysisId: state.activeAnalysisId,
    analysisName: state.analysisName,
    dataset: state.dataset,
    selection: cloneSelection(state.selection),
    searchQuery: state.searchQuery,
    selectionFilter: state.selectionFilter,
    chartScale: clonePlain(state.chartScale),
    styleRules: clonePlain(state.styleRules),
    curveOverrides: clonePlain(state.curveOverrides),
    legendSettings: clonePlain(state.legendSettings),
    exportSettings: clonePlain(state.exportSettings),
    lastPresetUndo: clonePlain(state.lastPresetUndo),
    lastPresetMessage: state.lastPresetMessage,
    exportCounter: state.exportCounter,
    exportMessage: state.exportMessage,
    importStatus: state.importStatus,
    importError: state.importError,
    importFileName: state.importFileName,
    sourceFiles: cloneSourceFiles(state.sourceFiles),
    dirty: state.dirty
  };
}

function applyAnalysisToAdapter(state: AppState, analysis: AnalysisTabState) {
  const adapterState = analysisToAdapterState(analysis);
  state.analysisName = adapterState.analysisName;
  state.dataset = adapterState.dataset;
  state.selection = adapterState.selection;
  state.searchQuery = adapterState.searchQuery;
  state.selectionFilter = adapterState.selectionFilter;
  state.chartScale = adapterState.chartScale;
  state.styleRules = adapterState.styleRules;
  state.curveOverrides = adapterState.curveOverrides;
  state.legendSettings = adapterState.legendSettings;
  state.exportSettings = adapterState.exportSettings;
  state.lastPresetUndo = adapterState.lastPresetUndo;
  state.lastPresetMessage = adapterState.lastPresetMessage;
  state.exportCounter = adapterState.exportCounter;
  state.exportMessage = adapterState.exportMessage;
  state.importStatus = adapterState.importStatus;
  state.importError = adapterState.importError;
  state.importFileName = adapterState.importFileName;
  state.sourceFiles = adapterState.sourceFiles;
  state.dirty = adapterState.dirty;
}

function analysisToAdapterState(analysis: AnalysisTabState): ActiveAnalysisAdapterState {
  return {
    analysisName: analysis.analysisName,
    dataset: analysis.dataset,
    selection: cloneSelection(analysis.selection),
    searchQuery: analysis.searchQuery,
    selectionFilter: analysis.selectionFilter,
    chartScale: clonePlain(analysis.chartScale),
    styleRules: clonePlain(analysis.styleRules),
    curveOverrides: clonePlain(analysis.curveOverrides),
    legendSettings: clonePlain(analysis.legendSettings),
    exportSettings: clonePlain(analysis.exportSettings),
    lastPresetUndo: clonePlain(analysis.lastPresetUndo),
    lastPresetMessage: analysis.lastPresetMessage,
    exportCounter: analysis.exportCounter,
    exportMessage: analysis.exportMessage,
    importStatus: analysis.importStatus,
    importError: analysis.importError,
    importFileName: analysis.importFileName,
    sourceFiles: cloneSourceFiles(analysis.sourceFiles),
    dirty: analysis.dirty
  };
}

function cloneAnalysisTab(analysis: AnalysisTabState): AnalysisTabState {
  return {
    analysisId: analysis.analysisId,
    ...analysisToAdapterState(analysis)
  };
}

function cloneSelection(selection: SelectionState | null): SelectionState | null {
  if (!selection) return null;
  return {
    groupingMode: selection.groupingMode,
    selectedCurveIds: new Set(selection.selectedCurveIds),
    collapsedGroupIds: new Set(selection.collapsedGroupIds),
    orderedCurveIds: [...selection.orderedCurveIds]
  };
}

function cloneSourceFiles(sourceFiles: SourceFileSummary[]) {
  return sourceFiles.map((sourceFile) => ({ ...sourceFile }));
}

function createOverrideFieldSources(override: CurveStyleOverride, source: CurveStyleOverrideSource) {
  const fieldSources: CurveStyleOverride["fieldSources"] = {};
  if (override.displayName !== undefined) fieldSources.displayName = source;
  if (override.color !== undefined) fieldSources.color = source;
  if (override.lineType !== undefined) fieldSources.lineType = source;
  if (override.markerType !== undefined) fieldSources.markerType = source;
  if (override.lineWidth !== undefined) fieldSources.lineWidth = source;
  if (override.visible !== undefined) fieldSources.visible = source;
  return fieldSources;
}

function hasCurveOverrideValue(override: CurveStyleOverride) {
  return (
    override.displayName !== undefined ||
    override.color !== undefined ||
    override.lineType !== undefined ||
    override.markerType !== undefined ||
    override.lineWidth !== undefined ||
    override.visible !== undefined
  );
}

function inferOverrideSource(override: CurveStyleOverride): CurveStyleOverrideSource | undefined {
  const sources = Object.values(override.fieldSources ?? {});
  if (sources.includes("custom")) return "custom";
  if (sources.includes("preset")) return "preset";
  return undefined;
}

function clonePlain<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Immer drafts cannot be structured-cloned; JSON is sufficient for current plain serializable state.
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
