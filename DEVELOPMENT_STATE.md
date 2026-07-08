# DEVELOPMENT_STATE.md

## Purpose
Single project state snapshot for resuming work after context compression.

## Status
Active

## Last Updated
2026-07-09

## Compression-Safe Summary
- IsoAmplar Plot Analysis MVP implementation has progressed through Phase 8 plus the 2026-07-08 UI/analysis refinement, GitHub Pages deployment, app icon, and staged UX refinement planning passes.
- Stack: React + Vite + TypeScript, SheetJS/xlsx, Apache ECharts, Zustand + Immer, `@tanstack/react-virtual`, Vitest + Testing Library, Playwright.
- MVP input: `.xls` / `.xlsx` upload only, first worksheet only. CSV, paste/manual entry, app-side data editing, and sheet picker are deferred.
- Parser preserves raw fluorescence values; no smoothing, normalization, baseline correction, log transform, averaging, or Ct/Cq calculation is applied.
- Default selection view is reagent-first. Import starts with all major groups collapsed. Selection identity is `curveId`; single-file parser IDs use `sheet0_col_<ExcelColumnLetter>`, and appended file IDs use an import prefix such as `file2_sheet0_col_A`.
- Search/display-filter bulk actions apply across the full dataset, including collapsed groups.
- Chart preview uses ECharts with white background, sparse major grid, no minor grid, animation off, `connectNulls: false`, and a fixed preview viewport height that does not stretch with side-panel expansion. On desktop the chart panel is sticky while the page scrolls.
- X/Y Auto, Fixed, and user-editable P1/P2 scale presets are implemented. P1/P2 have no invented default min/max values and become selectable only after valid numeric bounds are entered.
- Style controls include specimen/reagent group color with picker and HEX input, line type, group marker state model, stable default colors based on original data/group order, individual curve overrides, marker options, built-in presets, one-step preset undo, and user legend/export order.
- Export supports PNG/JPEG downloads, PNG clipboard copy with fallback message, and plotted-data CSV only for current rectangular common-X chart projections.
- GitHub Pages asset base is configured as `./` by default. The public GitHub Pages deployment is active at `https://siun-comp.github.io/isoamplar-plot-analysis/`.
- Browser tab/bookmark/PWA icon assets use the selected Option A amplification-curve icon.
- The current implementation plan is `docs/09_UX_REFINEMENT_IMPLEMENTATION_PLAN_KR.md`. Phases R0 through R13 are complete.
- The latest direct refinement pass adds app-controlled curve hover highlighting, custom-legend hover/focus highlighting, marker-preserving hover behavior, analysis-name-based export filenames, large-Y-axis spacing, dedicated legend-only clipboard PNG copy, and compact group style popovers.

## Current Goal
Direct post-release usability fixes after Phase R13: large-value Y-axis label spacing, legend-only clipboard copy, compact group style controls, and updated regression coverage/docs.

## Current Milestone
M8 - MVP release preparation complete locally, with post-MVP UI refinement applied.

## Last Completed Step
Completed the implementation, local verification, GitHub push, GitHub Pages deployment, and public URL smoke for large Y-axis spacing, dedicated legend-only clipboard PNG, Export-section image layout selection, and compact group style color/line/marker popovers.

## Latest Changed Files
- `src/chart/chartConfig.ts`
- `src/chart/chartConfig.test.ts`
- `src/ui/SettingsPanel.tsx`
- `src/styles.css`
- `src/app/App.test.tsx`
- `tests/e2e/app.spec.ts`
- `DECISIONS.md`
- `CHANGELOG.md`
- `docs/02_FUNCTIONAL_REQUIREMENTS_EN.md`
- `docs/03_INPUT_OUTPUT_SPEC_EN.md`
- `docs/04_TEST_PLAN_ACCEPTANCE_EN.md`
- `DEVELOPMENT_STATE.md`

## Implemented
- Documentation baseline: `AGENTS.md`, `DEVELOPMENT_STATE.md`, `DECISIONS.md`, `CHANGELOG.md`, and docs `01` through `08`.
- React/Vite SPA scaffold with relative asset base for static hosting.
- Excel parser:
  - `.xlsx` and `.xls`
  - first worksheet only
  - row 1 specimen, row 2 reagent, row 3+ fluorescence
  - generated `Cycle 1..N`
  - ignored later sheet warning
  - invalid first sheet failure
  - missing header warnings
  - merged header warning, no auto-fill
  - empty/nonnumeric/formula-without-cache warnings
  - cached numeric formula values accepted, formulas never recalculated
  - appended workbook import into the current analysis via a separate add action
- Normalized data model:
  - typed `PcrDataset`, `Curve`, `PcrWarning`, source metadata, curve stats
  - stable source-position `curveId`
  - similar-name warnings without merge/rename
- Selection UI:
  - upload-first top panel
  - replace upload and append upload controls
  - reagent-first/specimen-first views
  - panel mode label follows the current view
  - all major groups collapsed after import
  - search and all/selected/unselected/warning display filter
  - bulk select/unselect for displayed result set across collapsed groups
  - tri-state group checkboxes
  - grouped tree row banding for first- and second-level classification rows
  - virtualized major-group rendering in browser
- Chart and settings:
  - central chart option builder for preview/export parity
  - ECharts canvas chart
  - fixed preview chart viewport height independent from left/right panel expansion
  - sticky center chart panel on desktop while side panels/page scroll
  - Auto/Fixed X/Y scale with validation and current auto-bound display
  - user-editable P1/P2 scale presets per analysis session, selectable only after valid min/max values
  - app-controlled transient curve highlighting by `curveId`
  - >20 visible-curve warning
  - stable default colors based on original specimen/reagent order rather than visible selection index
  - group style rules and individual curve overrides
  - compact group style popovers with HEX-first color editing and combined line/marker preview selection
  - color picker plus HEX color input for group and individual curve styles
  - default solid lines with no markers; optional individual markers: circle, triangle, rect
  - built-in presets with overwrite semantics and one-step undo
  - user legend/export order
  - curve labels in selection, chart, legend order, and CSV follow the active grouping mode
- Export:
  - PNG/JPEG image download with white background and analysis-name-based filenames such as `YYMMDD_<analysisName>_plotN.ext`
  - selected-layout PNG clipboard copy with fallback message
  - dedicated legend-only PNG clipboard copy that does not mutate the selected image export layout
  - plotted-data CSV with `YYMMDD_<analysisName>_plotN_data.csv` when common-X rectangular output is safe
  - failed export attempts do not consume `plotN`
- Browser-local processing only; no backend or remote upload.
- Public app icon assets:
  - `public/favicon.svg`
  - `public/favicon-16.png`
  - `public/favicon-32.png`
  - `public/apple-touch-icon.png`
  - `public/icon-192.png`
  - `public/icon-512.png`
  - `public/manifest.webmanifest`
- UX refinement planning:
  - `docs/09_UX_REFINEMENT_IMPLEMENTATION_PLAN_KR.md`
  - Covers AnalysisState serialization, internal analysis tabs, Analysis XLSX export/import, redundant selection checkbox removal, style/override hierarchy, group marker rules, custom legend rendering, plot/legend export layouts, legend/style order parity, Analysis XLSX/tabs regression, hover readout, and large-list usability.
- Phase R1 AnalysisState serialization:
  - `src/analysis/analysisState.ts`
  - `src/analysis/analysisState.test.ts`
  - `AnalysisState` stores dataset, selection, search/filter, chart scale, style rules, curve overrides, export counter, import filename, source summaries, and dirty flag.
  - Serialized Analysis XLSX payload excludes transient UI fields, runtime `analysisId`, and dirty state.
  - Restore validates schema version, dataset shape, curve IDs, x/y lengths, selection/order integrity, scale state, style rules, curve overrides, and source file summaries before casting.
  - Restore can accept a caller-provided tab-local ID and otherwise generates one; dirty starts as `false`.
- Phase R2 internal analysis tabs state model:
  - `src/app/appStore.ts`
  - `src/app/appStore.test.ts`
  - Workspace state includes `activeAnalysisId`, `analysisOrder`, `analyses`, and `analysisSequence`.
  - Existing UI selectors (`dataset`, `selection`, `chartScale`, `styleRules`, `curveOverrides`, `exportCounter`, etc.) remain as the active-analysis facade.
  - New actions include `createAnalysis`, `switchAnalysis`, `renameAnalysis`, and `closeAnalysis`.
  - Dirty close and dirty replace are blocked until the exact confirmation UX is finalized.
  - Async import/append captures the originating tab ID and cannot overwrite whichever tab is active when parsing finishes.
- Phase R3 visible analysis tabs:
  - `src/ui/AnalysisTabs.tsx`
  - `src/app/App.tsx`
  - `src/styles.css`
  - `tests/e2e/app.spec.ts`
  - Tabs are displayed above file input controls so imports target the visible active analysis.
  - New analysis, switch, rename, dirty indicator, active clean close, dirty close blocking, and arrow-key tab switching are implemented.
  - Close/replace confirmation UX remains undecided; current behavior blocks dirty close/replace rather than silently losing data.
- Phase R4 Analysis XLSX export/import:
  - `src/analysis/analysisWorkbook.ts`
  - `src/analysis/analysisWorkbook.test.ts`
  - `src/app/appStore.ts`
  - `src/app/appStore.test.ts`
  - `src/ui/SettingsPanel.tsx`
  - `src/app/App.test.tsx`
  - Analysis XLSX export writes README, Settings, ImportedData, Warnings, and hidden `_IsoAmplarAnalysis` sheets.
  - Hidden restore JSON is authoritative and contains full imported dataset, unselected curves, warnings, selection/order, scale, style rules, curve overrides, source files, analysis name, and export counter.
  - Serialized restore payload excludes runtime `analysisId`, dirty state, import/export progress, messages, hover/clipboard state, and preset undo stack.
  - Analysis XLSX import validates schema, dataset shape, selection/order integrity, chunk count/index continuity, and source/style/scale state before restoring.
  - `파일 선택` with Analysis XLSX restores the clean active tab when safe; dirty active tabs are blocked.
  - `추가 선택` with Analysis XLSX opens a new independent internal analysis tab instead of merging into the active dataset.
  - Ordinary `.xlsx` workbooks with review-like sheet names are still parsed as source Excel unless they contain the explicit IsoAmplar restore marker.
  - Async import/append routing stays tied to the tab where the action started, including empty-tab add-select imports.
- Phase R5 selection tree simplification:
  - `src/ui/DataSelectionPanel.tsx`
  - `src/styles.css`
  - `src/app/App.test.tsx`
  - `tests/e2e/app.spec.ts`
  - Single-curve subgroups are displayed as one checkbox row, removing the previous subgroup checkbox plus child checkbox duplication.
  - Multi-curve subgroups retain subgroup tri-state checkbox behavior and child curve checkboxes.
  - Subgroup and child checkbox actions still use `curveId` and subgroup `curveIds`; no selection identity changed.
  - Virtualized row height estimation accounts for merged single-curve rows.
- Phase R6 style state/model cleanup:
  - `src/data/types.ts`
  - `src/chart/chartStyle.ts`
  - `src/chart/chartProjection.ts`
  - `src/chart/chartConfig.ts`
  - `src/analysis/analysisState.ts`
  - `src/app/appStore.ts`
  - `src/ui/SettingsPanel.tsx`
  - `StyleRules` now includes `markerBy`, `specimenMarkerTypes`, and `reagentMarkerTypes`.
  - `resolveCurveStyle` returns resolved color, line type, marker type, line width, visibility, override source, and per-field origin.
  - `CurveStyleOverride.fieldSources` distinguishes custom and preset source per style field for future UI origin display, while `source` remains as a legacy/summary hint.
  - Store actions now include `setGroupMarkerType`, `resetCurveOverride`, `resetSelectedCurveOverrides`, and `resetAllCurveOverrides`.
  - Store actions also include `setLegendPreviewVisible` and `setExportImageLayout`; preview legend visibility is connected to chart options, while full custom legend/export rendering remains later-phase work.
  - Preset apply/undo remains one-step and scoped; append import clears pending preset undo snapshots to avoid stale restoration after dataset shape changes.
  - `legendSettings` and `exportSettings` are part of AnalysisState and Analysis XLSX payloads, with defaults applied when restoring older payloads.
  - Same-schema restore migration fills missing marker rule defaults for older Analysis XLSX payloads created before Phase R6.
  - `buildChartProjection` centralizes visible curve order, resolved styles, unique chart names, and scale issue calculation for chart-facing outputs.
- Phase R7 Style UI restructuring:
  - `src/ui/SettingsPanel.tsx`
  - `src/styles.css`
  - `src/app/appStore.ts`
  - `src/app/App.test.tsx`
  - `src/app/appStore.test.ts`
  - `tests/e2e/app.spec.ts`
  - Style accordion now shows a current basis summary for color, line, and marker grouping.
  - Basis controls now include `색상 기준`, `선 기준`, and `마커 기준`.
  - Specimen and reagent group style tables now include color picker, HEX input, line type, marker type, and group reset.
  - Individual style rows now show curve identity, legend name, color, HEX, line, marker, row status, curve reset, and field-level reset buttons.
  - Field badges show `기준`, `Custom`, or `Preset` per editable field; mixed rows show `Custom/Preset`.
  - Selected-curve style rows are searchable and no longer hard-slice after 30 selected curves.
  - Style table headers and rows share the same scroll container to avoid horizontal alignment drift in narrow panels.
- Phase R8 custom legend and legend controls:
  - `src/ui/CustomLegend.tsx`
  - `src/ui/CustomLegend.test.tsx`
  - `src/ui/ChartPanel.tsx`
  - `src/chart/chartProjection.ts`
  - `src/chart/chartConfig.ts`
  - `src/ui/SettingsPanel.tsx`
  - `src/styles.css`
  - ECharts built-in legend is hidden so it cannot overlap the plot canvas.
  - `buildChartProjection` now produces `LegendItem[]` from the same visible-curve order and resolved styles used by the chart.
  - Custom preview legend renders outside the plot with SVG line samples for solid/dashed/dotted and marker samples for none/circle/triangle/rect.
  - Preview legend visibility can be toggled independently from selected curves.
  - Export layout state can be selected as Plot only / Plot + Legend / Legend only; image composition is implemented in Phase R9.
  - Custom legend order follows the current user legend/export order.
- Phase R9 export layout expansion:
  - `src/chart/exportChart.ts`
  - `src/chart/exportChart.test.ts`
  - `src/ui/SettingsPanel.tsx`
  - `tests/e2e/app.spec.ts`
  - PNG/JPEG downloads and clipboard PNG use the selected export layout.
  - `plotOnly` exports only the chart image with built-in ECharts legend hidden.
  - `plotWithLegend` creates chart and custom legend images separately, then composites them vertically on a white canvas.
  - `legendOnly` exports the custom legend image for the current selected/order/style projection.
  - Composite JPEG avoids double JPEG compression by using PNG intermediate images and encoding only the final canvas as JPEG.
  - Empty or non-image data URLs and zero-size blobs are treated as export failures so `plotN` is not consumed by invalid images.
- Phase R10 legend order/style editor consistency:
  - `src/ui/SettingsPanel.tsx`
  - `src/styles.css`
  - `src/app/appStore.test.ts`
  - `src/app/App.test.tsx`
  - Individual Style rows and Legend Order rows show source suffixes such as `file.xlsx:A` to distinguish duplicate labels.
  - Style override edits remain keyed by `curveId`; legend order moves only change `orderedCurveIds`.
  - Legend order moves use the previous/next selected curve, so unselected curves between selected entries do not make a move appear inert.
  - Duplicate-label style control names include source suffixes where needed, and individual style search can match source suffixes.
  - Tests cover style overrides surviving order changes, selected-order movement with unselected curves in between, style row order parity, and duplicate-label style edits targeting the correct curve ID.
- Phase R11 Analysis XLSX/tab regression and Report XLSX deferral:
  - `src/analysis/analysisWorkbook.test.ts`
  - `src/app/appStore.test.ts`
  - `src/app/App.test.tsx`
  - `docs/03_INPUT_OUTPUT_SPEC_EN.md`
  - `docs/04_TEST_PLAN_ACCEPTANCE_EN.md`
  - Analysis XLSX workbook roundtrip now explicitly covers group style marker/color/line rules, curve override field source metadata, preview legend visibility, image export layout, and export counter.
  - App store Analysis XLSX helper and routing tests now preserve latest legend/export settings and export counter through active-tab restore and add-select new-tab open.
  - Pending replace/restore results are blocked if the target tab becomes dirty while the file is still being read.
  - Successful Analysis XLSX saves advance the saved counter and mark the analysis clean so close/replace blocking reflects the saved state.
  - Repeated same-file append imports add a `fileN` source suffix for visible duplicate-label disambiguation.
  - Analysis XLSX detection requires the explicit restore marker; the reserved sheet name alone falls back to ordinary workbook routing unless the README restore marker is present.
  - A dependency guard asserts that native editable chart/report workbook libraries such as `exceljs`, `xlsx-populate`, `xlsx-js-style`, and `office-chart` are not introduced.
  - Report/Plotted XLSX remains deferred and documented as separate from Analysis XLSX.
- Phase R12 hover/readout and large-curve assistance:
  - `src/chart/ChartView.tsx`
  - `src/chart/ChartView.test.ts`
  - `src/chart/chartConfig.ts`
  - `src/ui/ChartPanel.tsx`
  - `src/selection/searchCurves.ts`
  - `src/ui/DataSelectionPanel.tsx`
  - `src/app/App.test.tsx`
  - `tests/e2e/app.spec.ts`
  - Chart tooltip rendering is disabled; hover information is shown in a fixed chart-panel readout below the canvas.
  - The readout supports direct ECharts series hover and a canvas nearest-point fallback so no-marker line charts remain inspectable.
  - Readout state is transient and clears when the visible chart projection, labels, or resolved style fingerprint changes.
  - Direct refinement now disables ECharts built-in series emphasis and uses app-controlled `curveId` highlighting so marker settings remain stable during hover.
  - Chart hover clears on globalout and native mouseleave; custom legend hover/focus highlights the matching curve and clears on leave/blur.
  - The >20 visible-curve warning keeps preview/export enabled and adds actions for current-search-only selection reduction, full selection clearing, and visual style preset assistance.
  - The warning preset action uses existing one-step preset undo and exposes a local `프리셋 Undo` button after application.
  - Search matching/filtering is shared between the selection panel and chart warning helper actions.
  - Playwright now uses a 45-cycle generated workbook fixture so browser hover smoke reflects realistic amplification curves.

## Key Decisions
- `D013`: accepted stack.
- `D014`: narrowed PCR MVP scope.
- `D015`: clean modern PCR chart style; reference image is direction only.
- `D016`: fixture/snapshot baseline.
- `D017`: official SheetJS CDN tarball and npm in this exFAT workspace.
- `D018`: curve IDs use `sheet0_col_<ExcelColumnLetter>`.
- `D019`: missing headers import with warnings and source-position fallback identity.
- `D020`: bulk selection uses current search/filter result set across full dataset.
- `D021`: P1/P2 scale values are not invented.
- `D022`: preview/export/CSV order share the central projection; SheetJS and ECharts/export are lazy-loaded.
- `D023`: product identity is IsoAmplar Plot Analysis with developer credit Jang Si Un.
- `D024`: 2026-07-08 chart refinement rules for fixed viewport height, stable colors, editable P1/P2 presets, and no default markers.
- `D025`: append upload identity, sticky chart, grouping-aware labels, tree banding, and compact settings/export sizing.
- `D026`: native editable Excel chart generation excluded; Analysis XLSX stores full imported dataset plus settings for analysis continuity without automatic localStorage persistence.
- `D027`: internal analysis tabs are accepted for multiple simultaneous analyses, with independent per-tab AnalysisState.
- `D028`: use app-controlled custom legends and separate legend/chart/export states.
- `D029`: style origin and reset semantics are explicit; group marker styles are supported.
- `D030`: hover readout is fixed outside the plot; >20 curve assistance remains non-blocking.
- `D031`: chart/legend hover highlighting is app-controlled by `curveId`, marker-preserving, transient, and export filenames include sanitized analysis names.

## Verification Status
- Phase R1 `git diff --check`: passed, with CRLF replacement warnings only.
- Phase R1 `npm run test`: passed, 45 Vitest tests.
- Phase R1 `npm run build`: passed.
- Phase R1 `npm run test:e2e`: passed, 2 Chromium Playwright tests.
- Phase R2 `npm run test`: passed, 52 Vitest tests.
- Phase R2 `npm run build`: passed.
- Phase R2 `npm run test:e2e`: passed, 2 Chromium Playwright tests.
- Phase R2 `git diff --check`: passed, with CRLF replacement warnings only.
- Phase R3 `npm run test`: passed, 53 Vitest tests.
- Phase R3 `npm run build`: passed.
- Phase R3 `npm run test:e2e`: passed, 3 Chromium Playwright tests.
- Phase R4 `npm run test`: passed, 65 Vitest tests.
- Phase R4 `npm run build`: passed.
- Phase R4 `npm run test:e2e`: passed, 3 Chromium Playwright tests.
- Phase R4 `git diff --check`: passed, with CRLF replacement warnings only.
- Phase R5 `npm run test`: passed, 67 Vitest tests.
- Phase R5 `npm run build`: passed.
- Phase R5 `npm run test:e2e`: passed, 3 Chromium Playwright tests.
- Phase R5 `git diff --check`: passed, with CRLF replacement warnings only.
- Phase R6 `npm run test`: passed, 76 Vitest tests.
- Phase R6 `npm run build`: passed.
- Phase R6 `npm run test:e2e`: passed, 3 Chromium Playwright tests.
- Phase R7 `npm run test`: passed, 80 Vitest tests.
- Phase R7 `npm run build`: passed.
- Phase R7 `npm run test:e2e`: passed, 3 Chromium Playwright tests.
- Phase R8 `npm run test`: passed, 82 Vitest tests.
- Phase R8 `npm run build`: passed.
- Phase R8 `npm run test:e2e`: passed, 3 Chromium Playwright tests.
- Phase R9 `npm run test`: passed, 85 Vitest tests.
- Phase R9 `npm run build`: passed.
- Phase R9 `npm run test:e2e`: passed, 3 Chromium Playwright tests.
- Phase R10 `npm run test`: passed, 87 Vitest tests.
- Phase R10 `npm run build`: passed.
- Phase R10 `npm run test:e2e`: passed, 3 Chromium Playwright tests.
- Phase R11 `npm run test`: passed, 94 Vitest tests.
- Phase R11 `npm run build`: passed.
- Phase R11 `npm run test:e2e`: passed, 3 Chromium Playwright tests.
- Phase R11 `git diff --check`: passed, with CRLF replacement warnings only.
- Phase R12 focused `npm run test -- --run src/app/App.test.tsx src/chart/ChartView.test.ts src/chart/chartConfig.test.ts`: passed, 32 Vitest tests.
- Phase R12 full `npm run test`: passed, 97 Vitest tests.
- Phase R12 `npm run build`: passed.
- Phase R12 `npm run test:e2e`: passed, 3 Chromium Playwright tests, including fixed readout hover smoke.
- Phase R12 `git diff --check`: passed, with CRLF replacement warnings only.
- Phase R13 `npm audit --omit=dev`: passed, 0 vulnerabilities.
- Phase R13 GitHub Actions Pages deploy: passed for pushed `main`; the workflow gate runs `npm run test` and `npm run build`.
- Phase R13 public URL technical smoke: passed at `https://siun-comp.github.io/isoamplar-plot-analysis/` for HTTP 200, `favicon.svg`, `manifest.webmanifest`, generated `.xlsx` Excel upload, chart canvas render, custom legend, and Export controls.
- Phase R13 local-only release checks: `npm run test:e2e`, `npm audit --omit=dev`, and public URL smoke were run locally rather than as required Pages workflow gates.
- Direct post-release refinement focused tests: passed, 6 Vitest files / 42 tests covering marker-preserving highlight, hover payload `curveId`, custom legend hover/focus, analysis-name filenames, Analysis XLSX filename, and app legend hover.
- Direct post-release refinement full `npm run test`: passed, 14 files / 100 tests.
- Direct post-release refinement `npm run build`: passed.
- Direct post-release refinement `npm run test:e2e`: passed, 3 Chromium Playwright tests including analysis-name PNG filename smoke.
- Direct post-release refinement `git diff --check`: passed with CRLF replacement warnings only.
- Direct post-release refinement GitHub Actions Pages deploy: passed for pushed `main` run `28958239135`; the workflow gate ran `npm run test` and `npm run build`.
- Direct post-release refinement public URL smoke: passed at `https://siun-comp.github.io/isoamplar-plot-analysis/` for HTTP 200, latest asset hash `index-uj2oA7cH.js`, generated `.xlsx` Excel upload, chart canvas nonblank render, custom legend hover/leave highlight, and PNG download filename `260709_Public_Smoke_plot1.png`.
- Current UX/export fix focused `npm run test -- --run src/app/App.test.tsx src/chart/exportChart.test.ts src/ui/CustomLegend.test.tsx src/chart/chartConfig.test.ts`: passed, 4 files / 36 Vitest tests.
- Current UX/export fix full `npm run test`: passed, 14 files / 100 Vitest tests.
- Current UX/export fix `npm run build`: passed.
- Current UX/export fix `npm run test:e2e`: passed, 3 Chromium Playwright tests; generated workbook fixture now uses large Y-axis values around 1,200,000.
- Current UX/export fix visual screenshot review: passed for large Y-axis label spacing and group line/marker popover stacking in `test-results\app-uploads-an-xlsx-workbo-26c3e-t-first-collapsed-selection-chromium\phase-r8-style-legend-panel.png`.
- Current UX/export fix GitHub Actions Pages deploy: passed for pushed `main` run `28961446984`; the workflow gate ran `npm run test` and `npm run build`.
- Current UX/export fix public URL smoke: passed at `https://siun-comp.github.io/isoamplar-plot-analysis/` for HTTP/browser load, latest asset hash `index-BBdXD71o.js`, generated `.xlsx` Excel upload, chart canvas render, and visible `범례 클립보드 PNG` control.
- `npm audit --omit=dev`: 0 vulnerabilities.
- GitHub Pages deployment: active at `https://siun-comp.github.io/isoamplar-plot-analysis/`.
- Playwright checks include upload-first smoke, generated `.xlsx` upload, append `.xlsx` import, reagent-first collapsed state, virtualized single-curve selection row, search bulk select, Style-panel marker basis/group marker smoke, fixed hover readout smoke, chart canvas visibility, nonwhite pixel count, chart viewport height stability after settings expansion, and sticky chart panel behavior.
- Visual screenshots:
  - `docs/gui_mockups/screenshots/phase8_mvp_desktop.png`
  - `docs/gui_mockups/screenshots/phase8_mvp_mobile.png`
  - `docs/gui_mockups/screenshots/isoamplar_refinement_desktop.png`
  - `docs/gui_mockups/screenshots/isoamplar_append_sticky_refinement.png`
  - `docs/gui_mockups/screenshots/phase-r12_hover_warning_desktop.png`
  - `docs/gui_mockups/screenshots/phase-r12_hover_warning_mobile.png`

## Known Gaps
- Clipboard image copy has not been manually verified in Chrome/Edge on the final deployment origin.
- Static fixture files and expected normalized JSON snapshots are still not checked in; tests currently generate workbook fixtures.
- Public URL technical smoke used generated `.xlsx` workbooks. Real `C:\Users\siunj\Desktop\graph_TEST.xlsx` has been inspected read-only but has not yet been uploaded through the finished UI in this session; final domain judgement for real labels/curve counts remains a user/manual validation item.
- Performance budgets for max file size, row count, specimen count, imported curve count, and rendered curve count remain undecided.
- P1/P2 scale presets are user-editable per analysis session and represented in AnalysisState; they can be preserved through explicit Analysis XLSX export/import but not automatic browser-session persistence.
- Analysis XLSX currently stores restore JSON and visible review sheets, but it does not include a native editable Excel chart or a static chart image workbook.
- Group style controls are now compact, but individual curve style rows can still become dense when many curves are selected; a broader style overview/editor pattern remains a future UX candidate.
- Dirty tab close/replace confirmation behavior and tab-count warning/hard-cap policy remain undecided.

## Important Links
- Project root: `H:\Vibe Cording\Graph`
- Functional requirements: `docs/02_FUNCTIONAL_REQUIREMENTS_EN.md`
- I/O spec: `docs/03_INPUT_OUTPUT_SPEC_EN.md`
- Test plan: `docs/04_TEST_PLAN_ACCEPTANCE_EN.md`
- Implementation plan: `docs/06_IMPLEMENTATION_PLAN_KR.md`
- Fixture plan: `docs/07_FIXTURE_SNAPSHOT_PLAN_KR.md`
- Release checklist: `docs/08_RELEASE_CHECKLIST_KR.md`
- Local dev server: `http://127.0.0.1:5173/`

## Next 3 Tasks
1. Manually validate the real `C:\Users\siunj\Desktop\graph_TEST.xlsx` in the deployed app when the user is ready.
2. Manually verify clipboard image copy behavior in Chrome/Edge on the deployed HTTPS origin.
3. Decide dirty tab close/replace confirmation UX and internal tab-count warning policy before making destructive tab actions more permissive.
