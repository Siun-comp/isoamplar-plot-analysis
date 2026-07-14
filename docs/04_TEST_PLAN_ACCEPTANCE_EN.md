# 04 Test Plan and Acceptance Criteria

## Purpose
Define how the PCR graph web tool will be validated and how completion will be judged.

## Status
Active draft

## Last Updated
2026-07-12

## Owner
QA / Engineering / Agent

## Compression-Safe Summary
- MVP testing is PCR-specific, not generic spreadsheet charting.
- MVP input is Excel upload only: `.xls` and `.xlsx`, first worksheet only.
- CSV file import, manual entry, and in-app data editing are deferred beyond MVP.
- Quick Paste Import is implemented as a post-MVP paste/import path and must be tested as a source-import flow, not as source-data editing.
- Testing must cover PCR/LAMP-style import, append import, stable curve IDs, reagent-first selection, collapsed groups, search, grouping-aware labels, fixed axes, user-editable P1/P2 presets, clean chart visual style, stable colors, default no markers, style/legend behavior, PNG/JPEG export, clipboard fallback, and GitHub Pages.
- Exported images must match the current rendered chart state, use a white background, and use analysis-name-based safe filenames.
- Plotted-data CSV export is allowed only for a simple current chart projection.
- Selected Data XLSX is the primary selected-curve data output and must preserve raw numeric/null values, order, source/warning traceability, and workbook-role safety.
- Analysis XLSX export/import must preserve the full imported dataset and settings, including unselected curves.
- Selection Sets must remain curveId-safe, tab-local, append-safe, and restorable through Analysis XLSX schema 4.
- Internal analysis tabs must preserve independent per-tab analysis state.
- Custom legend and export layout behavior must be tested separately from curve selection state.
- Analysis label editing and rich Excel clipboard behavior must be tested across chart legend names, report legend outputs, plotted-data CSV headers, and Analysis XLSX restore state.
- Fixture manifest and expected snapshot schema live in `docs/07_FIXTURE_SNAPSHOT_PLAN_KR.md`.
- Known gaps must be recorded instead of assumed away.

## Update Rule
Update this file whenever requirements change, bugs are fixed, release criteria change, or new risk areas are discovered.

## Test Scope
Implemented MVP plus R0-R13 refinement scope:

- `.xls` and `.xlsx` Excel upload
- First-worksheet-only parsing
- Quick Paste Import for tab-separated or single-column text, with full-table and single-specimen modes
- PCR header interpretation: row 1 specimen, row 2 reagent, row 3+ fluorescence
- Generated cycle X values
- Import warnings without automatic correction
- Reagent-first and specimen-first selection projections
- Major-group collapsed default
- Full-dataset search and search bulk actions
- PCR amplification line chart rendering
- Clean chart visual style: white background, sparse major grid, no dense minor grid by default, readable title/axis/legend layout
- Fixed X/Y axis scales and P1/P2 presets
- Style rules, built-in presets, individual curve overrides, and one-step preset undo
- Legend/export order parity
- PNG and JPEG image download with white background
- Clipboard image copy and fallback
- Optional plotted-data CSV export for simple current chart state
- Selected Data XLSX export for simple current chart state
- Named Selection Sets for repeated curve-combination switching
- Internal analysis tabs
- Analysis XLSX export/import for full analysis restore
- Custom legend rendering outside the plot
- Plot only / Plot + Legend / Legend only image export layouts
- Analysis label editing and rich Excel-cell clipboard output
- Style origin display and group marker rules
- Hover/readout and large-list usability
- Static GitHub Pages deployment behavior

Deferred beyond MVP:

- CSV file import
- Manual entry
- In-app data editing
- Multi-sheet picker
- Generic spreadsheet chart types
- SVG/PDF export
- Transparent background export
- Saved custom presets
- Multi-chart/batch layout
- Report XLSX with static chart image
- Native editable Excel chart generation

Implemented post-MVP:

- Quick Paste Import for small tab-separated or single-column pasted tables using either full-table mode, row 1 specimen / row 2 reagent / row 3+ fluorescence, or single-specimen mode, one supplied specimen name / pasted row 1 reagent / pasted row 2+ fluorescence. Comma/CSV tables are rejected rather than guessed.
- Quick Paste must provide read-only preview, warnings, append/new-analysis import, source traceability, and Analysis XLSX continuity without in-app cell editing.

## Test Levels
- Smoke tests for the core Excel import to export flow.
- Unit tests for parsing, validation, PCR normalization, tree derivation, search, style precedence, filename generation, and axis range helpers.
- Component tests for upload, selection tree, warning surfaces, settings accordions, style preset application, legend ordering, and export controls.
- End to end tests for upload -> collapsed selection -> expand/select -> render -> axis lock -> style preset -> PNG/JPEG export.
- Visual/export smoke checks for chart-only output, white background, and preview/export state parity.
- Manual browser compatibility checks for clipboard and downloaded image fidelity.
- Accessibility sanity checks for form controls, tree controls, accordions, and keyboard reachable actions.

## Acceptance Criteria

| ID | Requirement | Acceptance Criterion | Verification |
| --- | --- | --- | --- |
| AC-001 | FR-001 | User can import a valid `.xls` or `.xlsx` file and see a normalized PCR model parsed from the first worksheet only. | Automated + manual |
| AC-002 | FR-001, FR-004 | User can review detected specimen labels, reagent labels, fluorescence columns, generated cycles, and import warnings. | Automated + manual |
| AC-003 | FR-003 | Quick Paste Import is implemented beyond the original MVP and remains paste/import only. Manual entry, spreadsheet-grid editing, and in-app source-data correction are not allowed. | Automated + manual/document review |
| AC-004 | FR-005 | Selection, grouping, search, and search bulk actions update the selected curve set and rendered chart data. | Automated + manual |
| AC-005 | FR-007 | Multi-chart layout and batch arrangement are deferred; the single-chart MVP layout remains usable without overlap or clipped controls. | Manual + visual |
| AC-006 | FR-006, FR-008 | Chart, style, and legend settings affect the rendered chart as configured. | Automated + manual |
| AC-007 | FR-009 | Fixed X scale is applied consistently across redraws and relevant filter, selection, grouping, and style changes until changed by the user. | Automated + manual |
| AC-008 | FR-010 | Fixed Y scale is applied consistently across redraws and relevant filter, selection, grouping, and style changes until changed by the user. | Automated + manual |
| AC-009 | FR-011 | Image download produces a valid PNG or JPEG of the current chart output, without surrounding UI controls, with white background and an analysis-name-based safe filename such as `YYMMDD_<sanitizedAnalysisName>_plotN.ext`. | Automated smoke + manual |
| AC-010 | FR-012 | Clipboard copy places the selected image layout on the clipboard where supported; report-legend PNG clipboard copy and rich Excel-cell legend clipboard copy work from the current order/style/Analysis-label projection without changing the selected export layout; otherwise the UI shows a clear download fallback. | Component + manual + fallback test |
| AC-011 | FR-013 | The app works from a GitHub Pages style URL without backend services. | Build + manual |
| AC-012 | FR-014 | Invalid file type, invalid first sheet, invalid axis bounds, export failure, and clipboard failure show actionable errors. | Automated + manual |

## PCR-Specific Acceptance Criteria

These criteria bind implementation to decisions `D010` through `D016`.

| ID | Requirement / Decision | Acceptance Criterion | Verification |
| --- | --- | --- | --- |
| AC-PCR-001 | FR-001, IO-001, D012, D014 | Excel upload creates a normalized PCR model with stable curve IDs, specimen labels from row 1, reagent labels from row 2, fluorescence values from row 3 onward, and generated cycle values when no X axis is present. | Automated + manual |
| AC-PCR-002 | D003 | Importing, selecting, rendering, and exporting PCR data remains browser-local and does not send uploaded data to a backend. | Automated network guard + manual |
| AC-PCR-003 | D011, D012 | The default selection tree is reagent-first. | Component + E2E |
| AC-PCR-004 | D011 | Reagent-first and specimen-first views are projections over the same curve IDs and preserve identical selection state when toggled. | Unit + component |
| AC-PCR-005 | D012 | Search matches the full normalized dataset, and search bulk actions apply to every matching curve including collapsed, nonvisible, and virtualized rows. | Unit + component + E2E |
| AC-PCR-006 | D010, D012 | Chart preview renders only selected curves and applies no implicit smoothing, baseline correction, normalization, averaging, log transform, or Ct/Cq calculation. | Unit + visual/manual |
| AC-PCR-007 | FR-009, FR-010, D008 | Fixed X/Y scales and scale presets persist after filter, selection, grouping mode, style, and redraw changes until the user changes them. | Unit + E2E |
| AC-PCR-008 | D012, D014 | Style presets overwrite scoped individual curve overrides, show affected-count feedback, and provide one-step undo for the last preset apply. | Unit + component |
| AC-PCR-009 | D006, D012 | Legend order and export order exactly match the current preview order. | E2E + export smoke |
| AC-PCR-010 | FR-011, D014 | PNG and JPEG export produce valid 2400px-wide images matching current preview selection, scale, style, legend/order state, and export layout, using a white background, analysis-name-based safe filenames, and the export-only report-readability geometry. | Automated smoke + manual |
| AC-PCR-011 | FR-012, D007 | Clipboard export succeeds where supported and shows image-download fallback when unsupported, blocked, or denied. | Manual + fallback test |
| AC-PCR-012 | D012, D014 | More than 20 visible curves triggers a readability warning and assistance path, but preview/export remain enabled and include all visible curves. | Component + E2E |
| AC-PCR-013 | D011 | Large datasets with dozens to hundreds of specimens and up to 8 reagents remain usable within the agreed performance budget. | Performance smoke + manual |
| AC-PCR-014 | D010 | Retired/default-forbidden UI terms do not appear in user-visible UI unless later approved: `replicate`, `series`, `solo/isolate`, hover/solo emphasis wording, and exclude/restore wording. | Automated text scan + manual |
| AC-PCR-015 | FR-001, IO-001, D014 | Multi-sheet workbook import always uses worksheet index 0; later sheets are ignored. If the first sheet is invalid, import fails even if later sheets are valid. | Parser unit + E2E |
| AC-PCR-016 | FR-001, IO-001, D014 | `.xls` and `.xlsx` fixtures with equivalent first-sheet data normalize to equivalent PCR curve data. | Parser unit |
| AC-PCR-017 | FR-003, IO-004, D014 | Imported specimen, reagent, and fluorescence values cannot be edited in the app; correcting source data requires reupload. | Component + manual |
| AC-PCR-018 | FR-005, D014 | All reagent/specimen major groups are collapsed immediately after import, with counts and checkbox state still accurate. | Component + E2E |
| AC-PCR-019 | FR-004, D014 | Similar names trigger a warning listing affected labels but do not change IDs, labels, selection, grouping, or export names. | Parser unit + component |
| AC-PCR-020 | FR-008, D014 | Built-in presets apply to the chosen scope, overwrite affected individual style fields deterministically, report affected count, and provide one-step undo. No saved custom presets are required in MVP. | Unit + component |
| AC-PCR-021 | FR-016, D014 | Plotted-data CSV export, when available, contains only currently plotted curves in current legend/export order. It excludes hidden/unselected curves and raw workbook-only data. | Unit + E2E |
| AC-PCR-022 | FR-016, D014 | Plotted-data CSV export is disabled with a clear reason unless the current chart is simple: one chart, shared X values across visible curves, and rectangular CSV output possible. | Unit + component |
| AC-PCR-023 | FR-006, FR-011, D015, D032 | The default chart theme is clean and analysis-readable: white background, sparse major grid lines only, no dense minor grid by default, readable title/axis/legend spacing including large Y-axis tick labels, balanced line widths, distinguishable but controlled colors, and PNG/JPEG export matches the preview style. Reference images are not hardcoded: example-specific title, axis labels, axis ranges, threshold/reference line, marker shapes, colors, legend labels, curve count, and data values must not be fixed from the reference. | Playwright screenshot + visual/manual + export smoke |
| AC-PCR-024 | FR-006, FR-008, FR-009, FR-010, D021, D023, D024 | The app identity is `IsoAmplar Plot Analysis` with developer credit `Jang Si Un`; preview plot height remains stable when side settings expand; default curve colors remain stable as earlier/later curves are selected; default lines have no markers; individual curve marker overrides support none, circle, triangle, and rect; P1/P2 X/Y presets are user-editable and selectable only with valid min/max; their applied status uses the current user label rather than `PRESET1`/`PRESET2`; Fixed mode displays current Auto bounds for editing support. | Unit + component + E2E |
| AC-PCR-025 | FR-001, FR-005, FR-006, FR-008, D025 | The app can append another `.xls`/`.xlsx` first worksheet to the current analysis without replacing existing data; appended curves receive unique IDs, are added unselected at the end of user order, and preserve existing selected curves, scale, style, overrides, and chart output. Reagent mode uses reagent-first labels across selection, legend, legend order, and plotted CSV; specimen mode uses specimen-first labels. The center chart panel stays visible on desktop scroll, tree group/subgroup rows are visually distinguishable, compact scale/export controls do not clip labels, and group/individual style colors can be entered by HEX code as well as picker. | Unit + component + E2E + visual/manual |
| AC-PCR-026 | FR-005 | A subgroup containing a single curve is displayed as one selectable row without duplicate checkboxes. | Unit + component + E2E |
| AC-PCR-027 | FR-008, D029 | Color, line, and marker bases and individual override origins are clearly shown in the UI as baseline, Custom, or Preset. | Unit + component + manual |
| AC-PCR-028 | FR-008, D029, D032 | Specimen and reagent group styles can set line type and marker none/circle/triangle/rect through a compact combined line/marker selector, and the result is reflected in chart and legend rendering. | Unit + component + visual |
| AC-PCR-029 | FR-008, D029 | Field-level, curve-level, selected-curves, and all-overrides reset actions restore baseline style behavior without changing unrelated data. | Unit + component |
| AC-PCR-030 | FR-008, FR-019, D028 | Custom legend does not obscure the plot, represents actual resolved line type and marker type including no-marker curves, and hover/focus on a legend item transiently highlights the matching curve. | Component + Playwright visual |
| AC-PCR-031 | FR-011, FR-012, FR-019, D028, D032, D034, D035 | Preview legend visibility, export legend inclusion, Plot only / Plot + Legend / Legend only image export layouts, selected-layout clipboard PNG, report legend-only PNG export/copy, Analysis label editing, and rich Excel-cell legend clipboard copy work independently. Analysis labels apply consistently to chart/custom legend labels, report legend outputs, plotted-data CSV headers, and Analysis XLSX restore state while original specimen/reagent/source labels remain traceable and resettable. | Unit + component + E2E + export pixel smoke + Playwright visual + manual Excel paste |
| AC-PCR-032 | FR-008, FR-019, D029 | Legend order changes preserve style overrides on the same curve IDs, move by the currently selected curve order even when unselected curves sit between them, and preview/export/data/style-row order remain consistent. | Unit + component + E2E |
| AC-PCR-033 | FR-017, D026, D035 | Analysis XLSX export stores the complete imported dataset, source metadata, warnings, selection, order, scale, style, Analysis labels, legend/export settings, analysis name, and export counter, regardless of whether curves are currently selected or plotted. Analysis XLSX filenames are safe and sanitized, visible `ImportedData` keeps original labels separate from Analysis labels, and transient UI state, runtime tab IDs, and dirty state are excluded. | Unit + workbook readback |
| AC-PCR-034 | FR-017, D026 | Analysis XLSX import restores the hidden JSON state, including unselected curves, while assigning a tab-local analysis ID and clean dirty state; missing, corrupt, chunk-damaged, or unsupported restore sheets show clear errors. | Unit + component + E2E |
| AC-PCR-035 | FR-018, D027 | Multiple analysis tabs keep dataset, selection, search, display filter, collapse state, scale, style, legend/export order, export counter, source files, and analysis name independent. Tab overflow remains usable without breaking the main layout. | Unit + component + E2E + visual |
| AC-PCR-036 | FR-001, FR-017, FR-018, D027 | File actions distinguish original Excel and Analysis XLSX: replace, append, restore, and new-tab open do not conflict. Dirty close and dirty replace/restore actions require explicit confirmation and never discard or overwrite analysis state silently. File-replace confirmation is a keyboard-modal dialog with initial focus, Escape cancel, and focus restoration. | Unit + component + E2E |
| AC-PCR-037 | FR-006, FR-017, D026 | Analysis XLSX contains no native editable Excel chart, and export/import performs no smoothing, normalization, baseline correction, Ct/Cq, threshold, or positive/negative interpretation. | Unit + package/workbook inspection |
| AC-PCR-038 | FR-020, D048 | With X values around 1-100, 100 visible curves x 100 points passes browser smoke testing, and hundreds to 1000 imported curves remain selectable through virtualization/search. | Passing S9 - generated 20x100/100x100 production-dist measurements, reusable JSON format, 100-curve Style interaction, and full fresh Chromium smoke; timings are not hard limits |
| AC-PCR-039 | FR-020, D030, D031, D048 | Hover information is available through a fixed readout or equivalent UI that does not block plot inspection; chart and legend hover highlight clears on pointer exit and does not alter marker/style/export state. | Passing S9 - RAF coalescing, nearest-X candidate bound, data-free highlight patch, marker-preserving unit/component tests, Box zoom suppression, and fresh Chromium hover/readout smoke |
| AC-PCR-040 | FR-020, D032, D047, D048 | Large style and legend lists remain operable through search, scrolling, virtualization when justified, and compact controls that avoid unnecessary horizontal scrolling. | Passing S9 - 100-curve Style opens and remains operable in generated stress measurement; no new virtualization added because no blocking row-render bottleneck was measured |
| AC-PCR-041 | FR-008, FR-011, FR-017, FR-019, D028 | Selected, chart-visible, legend-visible, export-layout, and Analysis XLSX persisted settings are separate states; changing one does not implicitly mutate the others. | Unit + component + E2E + Analysis XLSX roundtrip/readback |
| AC-PCR-042 | FR-008, D029 | Individual style rows show curve identity, clear column labels, source disambiguation for duplicate labels, and reset/status controls that target the intended curve ID. | Component + E2E |
| AC-PCR-043 | FR-020 | Main tab, file import, tree, accordion, style, legend, and export controls are keyboard reachable, expose accessible names/states where feasible, and show a visible focus indication. | Component + Playwright accessibility smoke + manual |
| AC-PCR-044 | FR-006, FR-009, FR-010, D036 | Box zoom mode highlights the valid plot area, lets the user drag a visible plot-area rectangle, and converts that selection to Fixed X/Y scale bounds without transforming, smoothing, cropping, or deleting the underlying curve data. The mode shows clear active/cancel/reject feedback, can be cancelled with Escape, clears hover emphasis while active, and enables Previous scale to restore the prior scale one Box zoom step at a time. Auto scale is separate and restores both axes to automatic mode while clearing Box zoom return history. Analysis XLSX stores/restores the current resulting scale bounds like any other scale setting; transient return history is browser-session state only. | Unit + component + E2E + Analysis XLSX roundtrip |

## Audit Remediation Target Acceptance Criteria

These criteria are frozen during Phase S1 as **Target / Known red**. S1 may add synthetic evidence, isolated current defect-signature probes, and CI plumbing, but it must not mark product behavior as accepted. A green defect-signature probe means only that its exact documented defect is reproduced. Each remediation Phase changes the status only after implementation, full regression, browser evidence, and expert review are complete.

| ID | Requirement / Decision | Target acceptance criterion | S1 status / verification |
| --- | --- | --- | --- |
| AC-PCR-045 | FR-006, FR-009, FR-010, D036, D041 | An invalid active Fixed/P1/P2 draft never renders or exports as an Auto-like plot under a Fixed label. Plot-bearing exports are blocked; Legend-only and Analysis XLSX remain available. Tiny, negative, and exponential Box zoom bounds remain finite with `min < max`. | Passing S2 - draft/applied unit, store, image-export parity, schema migration/roundtrip, component, and fresh Chromium evidence |
| AC-PCR-046 | FR-008, FR-011, FR-012, FR-019, D028, D035, D042 | Distinct curve IDs with shared-prefix or colliding labels remain identifiable in preview and every legend-bearing raster. Labels are not silently rewritten, Plot-only remains available, and unresolved legend identity collision blocks only legend-bearing output with affected curve/source evidence. | Passing S3 - measured layout/projection/collision unit tests, component warning/hover tests, SVG bounds/style matrix, and fresh synthetic Chromium PNG pixel evidence; Windows Excel visual fidelity remains manual |
| AC-PCR-047 | FR-001, IO-001, D014, D043 | `.xls/.xlsx` formatted header display text is the immutable visible label while raw value, raw type, number format, formula/cache state, worksheet, and source cell remain provenance. | Passing S4 - FX-001 fixed fixture, stale-`cell.w` unit, XLS/XLSX parity, and fresh Chromium evidence |
| AC-PCR-048 | FR-001, FR-004, FR-017, FR-020, IO-001, D014, D039, D043 | Every import warning exposes source identity, handling, and affected curves; applicable cell/header warnings also expose location and raw/display evidence. Append and Analysis XLSX roundtrip keep source evidence distinct without mutating selection/order/style/filter/revision/dirty state when navigating to a warning. | Passing S4 - FX-004, source-aware append, Warning Inspector/component, schema 1/2/3 roundtrip/strict validation, and fresh Chromium download evidence |
| AC-PCR-049A | FR-017, FR-018, D026, D027, D045 | Any dirty analysis, including an inactive tab, installs browser refresh/close protection; an all-clean workspace does not. Explicit Analysis XLSX remains the persistence path. | Passing S6 - inactive-dirty/all-clean component test plus desktop browser check |
| AC-PCR-049B | FR-011, FR-012, FR-017, FR-018, D040, D045 | Async save/export/clipboard success and failure update only the captured analysis runtime/revision according to the documented counter/dirty state table; closed/replaced runtimes receive no live update. | Passing S6 - store race matrix, deferred clipboard rejection after tab switch, stale new-tab parse failure, save-while-modified, counter retry, and fresh Chromium |
| AC-PCR-050 | FR-017, IO-005, D026, D039, D046 | Analysis XLSX validates curve lengths, stats, entity/source membership, and ID references before committing state; a rejected payload leaves the current analysis unchanged. | Passing S7A - malformed relationship matrix, hidden-sheet corruption, current-analysis preservation, mixed-source/full-unselected roundtrip, non-BMP chunk boundary, and 96-curve/100-cycle generated payload measurement |
| AC-PCR-051 | FR-016, D035, D046 | Every final plotted CSV specimen/reagent/generated/Analysis label header is spreadsheet-safe. Output escaping does not mutate source labels, Analysis labels, or Analysis XLSX values. | Passing S7A - all four prefixes, quoting, post-neutralization collision, negative fluorescence passthrough, Analysis XLSX value preservation, and isolated audit probe; final Windows Excel manual check remains release QA |
| AC-PCR-052A | FR-008, D035, D047 | The inactive Legend Order/Labels panel is absent from display and accessibility trees while the active editor remains keyboard operable. | Passing S8 - computed display/accessibility-tree checks plus roving tab focus and Arrow/Home keyboard tests |
| AC-PCR-052B | FR-020, D032, D047 | At user-approved desktop viewports, scrolling through settings preserves an inspectable plot bounding box without incoherent overlap or workspace horizontal overflow. | Passing S8 - 100-curve synthetic viewport measurements and screenshot at 1280x720, 1366x768, and 1920x1080; compact row and portalled popover clipping checks |
| AC-PCR-053 | FR-017, FR-018, FR-022, D050 | A Selection Set stores non-empty unique curveId membership only. Candidate selection does not mutate analysis state until Apply; Apply replaces current selection and records active state; manual changes show Modified without silent overwrite; update/rename/delete use explicit in-app controls; one-step return restores both pre-apply selection and active ID. Append preserves sets without auto-including new curves, replace clears them, tabs remain isolated, and Analysis XLSX schema 1-3 migrate to empty sets while schema 4 roundtrips and validates all references. | Unit + store + component + workbook readback + Playwright |
| AC-PCR-054 | FR-016, FR-021, IO-107, D050 | Selected Data XLSX is available only for a non-empty rectangular common-X projection and writes current-order `PlottedData`, `CurveInfo`, related `Warnings`, and `ExportInfo`. Fluorescence numbers remain numeric, null remains blank, all common-X rows are retained despite Box zoom/Scale, duplicate labels are deterministically source-disambiguated, and all user/source strings remain non-formula/non-hyperlink cells without changing their text. | Unit + workbook readback + component + Playwright download |
| AC-PCR-055 | FR-001, FR-017, FR-021, IO-006, IO-107, D050 | Selected Data XLSX carries a machine-readable hidden role marker and is rejected without analysis mutation by original open, append, and Analysis restore commands with purpose-specific guidance. Successful downloads alone consume the reserved plot counter; generation/download failure and inactive/closed/replaced target races do not. | Unit + store + component + Playwright |
| AC-PCR-059 | FR-011, FR-019, IO-102, D053 | A new analysis defaults Chart image layout to Plot only. Plot-bearing PNG/JPEG/clipboard rendering retains a 1200 x 760 logical surface at 2x output density and enlarges axis labels/titles, margins, major ticks, and curve/marker geometry for approximately 9.5 cm Excel placement. Relative line-width differences and matching Plot + Legend samples remain distinguishable. Preview geometry, raw data, Scale bounds, curve order, and explicit Analysis XLSX layout values remain unchanged. | Unit + component + Playwright raster + manual 9.5 cm inspection |
| RQ-CI-001 | FR-013, D002, D003, D049 | CI verifies committed-diff whitespace, production dependency audit, deterministic fixtures, the full unit/audit suite, one Pages-base-path `dist` hash, fresh Chromium against that same artifact, byte identity after Playwright, opaque-white/nonblank raster and legend slot evidence, known static app `GET/HEAD` plus blob/data network allowlisting including same-origin write and WebSocket rejection, clipboard fallback, and Analysis XLSX browser roundtrip before Pages artifact upload. | Passing S10 implementation; local CI-equivalent evidence complete, actual GitHub workflow run and post-deploy public smoke remain S11 release evidence |

## Quick Paste Import Acceptance Criteria

| ID | Requirement / Decision | Acceptance Criterion | Verification |
| --- | --- | --- | --- |
| AC-QP-001 | FR-003, D037 | The user can paste a small table into a textarea and generate a preview without importing it immediately. | Component + E2E |
| AC-QP-002 | FR-003, D037 | Before preview confirmation, and after an invalid preview, the active analysis dataset, selection, style, legend order, export counter, and Analysis labels are unchanged. | Unit + component |
| AC-QP-003 | FR-003, D037 | The preview table is read-only and provides no cell editing, spreadsheet grid editing, source-data correction, smoothing, normalization, or value transformation controls. | Component + visual/manual |
| AC-QP-004 | FR-003, IO-003 | Valid full-table pasted input is parsed using the same structure as Excel input: row 1 specimen labels, row 2 reagent labels, row 3+ fluorescence values, and generated `Cycle 1..N` X values. | Unit |
| AC-QP-005 | FR-003, IO-003 | Missing specimen headers, missing reagent headers, empty fluorescence cells, nonnumeric fluorescence cells, duplicate curve labels, and similar specimen/reagent labels produce warnings consistent with the Excel parser policy. | Unit |
| AC-QP-006 | FR-003, D025, D037 | Current-analysis append preserves existing selected curves, scale, style rules, individual overrides, Analysis labels, legend/export order, and export behavior. Newly appended paste curves are unselected and curve IDs do not collide. | Unit + component + E2E |
| AC-QP-007 | FR-003, FR-018, D027, D037 | New-analysis import creates an independent analysis tab using the same default selection policy as Excel import: no selected curves and all major groups collapsed. | Unit + component + E2E |
| AC-QP-008 | FR-003, FR-017, D026, D037 | Analysis XLSX export/import preserves the complete dataset including paste sources, unselected paste curves, warnings, selection, order, style, Analysis labels, scale, legend/export settings, analysis name, and export counter. | Unit + workbook readback |
| AC-QP-009 | FR-003, FR-006, FR-008, FR-011, FR-012, FR-016 | Paste curves use the same chart projection, custom legend, style resolution, plotted CSV, PNG/JPEG export, clipboard export, and report legend paths as Excel-imported curves. | Unit + component + E2E + export smoke |
| AC-QP-010 | FR-003, FR-006, D037 | Paste import applies no smoothing, normalization, baseline correction, log transform, averaging, Ct/Cq calculation, thresholding, or clinical interpretation. | Unit + code review |
| AC-QP-011 | FR-003, FR-017, IO-003, D037 | Paste sources are distinguishable from Excel sources through `sourceKind` or equivalent metadata in hidden Analysis XLSX restore data and visible review sheets. Older Analysis XLSX files without this metadata still restore safely. | Unit + workbook readback |
| AC-QP-012 | FR-003, D037 | Source name changes affect only display/source metadata and do not change `curveId`, selection identity, style overrides, Analysis labels, legend order, plotted CSV order, or export order. | Unit |
| AC-QP-013 | FR-003, D037 | If the textarea source changes after preview generation, stale preview confirmation is blocked or clearly invalidated before import. | Component + E2E |
| AC-QP-014 | FR-003, IO-003, D038 | In single-specimen mode, the supplied specimen name is required and is applied to all pasted reagent/fluorescence columns only while constructing the new paste import source. Blank specimen names block preview/import. | Unit + component |
| AC-QP-015 | FR-003, D038 | Changing input mode or the single-specimen name after preview generation blocks or invalidates stale preview confirmation, and does not mutate already imported curves. | Component + E2E |
| AC-QP-016 | FR-003, D037 | Tab-separated and delimiter-free single-column tables are accepted, while comma/CSV tables are rejected before analysis mutation with an actionable Tab-copy instruction. | Unit + component |
| AC-QP-017 | FR-003, D037 | Empty or nonnumeric fluorescence values identify their source location and `null`/chart-gap outcome in preview. Every warning location remains reachable through bounded pagination, and import remains disabled until the user acknowledges that outcome. | Unit + component + E2E |
| AC-QP-018 | FR-003, FR-018, D037 | Confirmation applies only to the analysis runtime instance and revision captured by preview. Closing, replacing, or changing the target blocks stale confirmation. | Unit + component |
| AC-QP-019 | FR-003, FR-017, D037 | Analysis XLSX visible Settings/ImportedData and hidden restore data preserve mixed Excel/paste source type, immutable source ID, source name, source column, and paste input mode; repeated imports with identical file metadata retain distinct source-instance IDs, and legacy missing provenance migrates to Excel. | Unit + workbook readback |
| AC-QP-020 | FR-003, FR-020, D037 | Historical mobile Quick Paste criterion. | Deferred / not a release gate: the 2026-07-11 audit explicitly limits this private/team tool to desktop browsers. |
| AC-QP-021 | FR-003, D037, D041, D044 | Generated valid tables at the documented boundaries - tall 250,000 x 1, wide 3 x 83,333, and balanced 500 x 500 cells, all within 2,000,000 characters - complete read-only preview without stack overflow or analysis mutation. Character-over-limit and cell-over-limit cases reject before mutation; catchable parser/import/render failures become controlled local errors while preserving the current analysis and app shell. Browser-process OOM is outside this guarantee. | Passing S5 - exact tall/wide/balanced, empty-heavy, character/cell rejection, UI summary, parser/import containment, dialog retry, workspace recovery save, and full regression execute |

## PCR Test Phases

1. Requirements and fixture definition: create small, medium, large, malformed, `.xls`, `.xlsx`, appended-workbook, multi-sheet, similar-name, over-20-curve, and data-export fixtures with expected normalized JSON snapshots.
2. Browser-local Excel parsing: test specimen/reagent extraction, first-sheet-only behavior, `.xls`/`.xlsx` equivalence, generated cycles, nonnumeric values, blank rows/columns, duplicate or similar names, missing headers, uneven lengths, formulas, old `.xls` encodings, protected files, and unsupported files.
3. Normalized PCR model: test stable curve IDs, source sheet/range, warnings, style state, selection state, and legend/export order.
4. Selection tree and search: test reagent-first default, specimen-first toggle, grouping-aware labels, all-groups-collapsed default, tri-state checkboxes, collapse/expand, full-dataset search matching, and search bulk actions.
5. Chart rendering: test selected-curve rendering, no implicit PCR transformations, null/missing values, clean visual theme, and over-20 readability warning without blocking preview/export.
6. Scale preset and fixed axis: test Auto, Fixed, P1, P2, Box zoom rectangle-to-Fixed conversion, Previous scale stack return, Auto scale history clearing, min/max validation, current Auto bound display, and persistence across redraw triggers.
7. Style preset and override: test style precedence, stable default colors, default no markers, individual marker overrides, built-in preset overwrite, affected-count feedback, and one-step undo.
8. Analysis state and tabs: test serializable AnalysisState, multi-tab independence, dirty close/replace confirmation, and analysis name/source name separation.
9. Analysis XLSX: test full-dataset export, hidden restore JSON, visible review sheets, roundtrip restore, invalid schema/chunk errors, and no native editable chart.
10. Legend and export order: test manual order, custom legend, selected order, reagent/specimen order, preview/export parity, and state separation.
11. PNG, JPEG, clipboard, plotted-data CSV, and export layout: test valid chart-only/plot+legend/legend-only images, report-readable legend-only images, white background, fake-date filename generation, selected-layout clipboard success/fallback, report legend PNG clipboard success/fallback, rich Excel report legend clipboard payload/fallback, simple plotted-data CSV, and disabled non-simple data export.
12. Quick Paste Import: test full-table tab paste, delimiter-free single-column paste, explicit comma/CSV rejection, single-specimen paste, invalid paste, blank single-specimen name rejection, read-only preview, stale-preview blocking after textarea/mode/specimen changes, append/new-analysis import, source metadata, Analysis XLSX roundtrip, and chart/export parity.
13. Performance, accessibility, and release: test large datasets, virtualized tree/style/legend behavior, hover readout, keyboard navigation, browser compatibility, and GitHub Pages base path.

## Manual Test Cases
Before a user-visible MVP release:

1. Import a valid `.xlsx` PCR workbook.
2. Import an equivalent valid `.xls` PCR workbook.
3. Import a multi-sheet workbook and confirm only the first worksheet is used.
4. Import a workbook whose first worksheet is invalid and a later worksheet is valid; confirm import fails.
5. Import a workbook whose active tab is not the first sheet; confirm worksheet index 0 is still used.
6. Confirm all major groups are collapsed after import and no curves are selected by default.
7. Toggle between reagent-first and specimen-first views and confirm selection is preserved.
8. Search across all data and apply a bulk selection action to matches inside collapsed groups.
9. Select a small readable set of curves and render the PCR line chart.
10. Select more than 20 visible curves and confirm the warning appears while export remains possible.
11. Set fixed X and Y axis bounds, then change selection and confirm scale remains fixed.
12. Apply a built-in style preset, confirm affected-count feedback, and use one-step undo.
13. Change legend order and confirm preview/export order matches it.
14. Download PNG and JPEG and confirm valid output, white background, and `YYMMDD_<analysisName>_plotN.ext` filenames with sanitized analysis names.
15. Copy the selected chart image layout to clipboard where supported; copy the report legend-only PNG and rich Excel-cell legend through dedicated actions; confirm fallback where unsupported or blocked.
16. Export plotted-data CSV for a simple current chart; confirm only plotted curves in current order are included.
17. Confirm plotted-data CSV is disabled with a clear reason for a non-simple chart state.
18. Test the production build through the same base path used by GitHub Pages.
19. Review the default chart screenshot and confirm it has a clean modern PCR-plot feel without dense background grid lines.
20. Confirm the implementation does not hardcode reference-image content such as title, threshold line, axis ranges, colors, marker shapes, legend labels, or data values.
21. Create two analysis tabs, import different workbooks, and confirm selection, scale, style, legend order, and export counter do not leak between tabs.
22. Rename an analysis tab and confirm source file labels and chart labels are not unintentionally changed.
23. Export Analysis XLSX, reload it, and confirm all imported curves, including unselected curves, warnings, scale, style, order, and export settings are restored.
24. Attempt dirty-tab close and dirty-tab replace/restore; confirm the app offers explicit cancel/save/discard or replace/new-analysis choices and never loses data silently.
25. Toggle preview legend visibility and export layout modes and confirm the plot remains unobscured.
26. Confirm custom legend samples match solid/dashed/dotted lines and none/circle/triangle/rect marker settings.
27. Hover chart curves and custom legend items, then move the pointer away; confirm highlight clears and configured markers do not disappear or change.
28. With large Y-axis values around 1,200,000, confirm the `Fluorescence` axis label does not overlap tick labels.
29. In group style rows, confirm the color popover opens with HEX entry first and the combined line/marker popover shows all line and marker choices without horizontal scrolling, then closes after a line or marker choice.
30. Edit an Analysis label and switch Auto compact / Full labels; confirm chart/custom legend labels, report legend PNG, Excel-cell legend copy, plotted-data CSV headers, and Analysis XLSX restore use the Analysis label while original specimen/reagent/source labels remain available for reset and traceability.
31. Paste `Copy for Excel` output into Windows Excel from Chrome/Edge and confirm the colored style glyph sample and legend name land in separate cells with readable Malgun Gothic 9 pt formatting.
32. Enable Box zoom, confirm the valid plot area is visibly highlighted, drag a visible region inside that highlighted plot area, and confirm X/Y modes become Fixed with populated bounds; press Previous scale and confirm the prior scale is restored. Repeat multiple Box zooms and confirm Previous scale returns one step at a time. Press Auto scale and confirm both axes return to Auto and Previous scale is disabled. Repeat a too-small or outside drag and confirm the app gives feedback without changing data or crashing.

## Browser Matrix
Minimum manual verification candidates:

- Latest Chrome
- Latest Edge
- Latest Firefox

Clipboard image behavior should be explicitly checked in Chrome and Edge because browser support and permissions differ.

## GitHub Pages Checks
- Production build emits static assets only.
- No backend server is required.
- No secrets or server-only environment variables are required.
- Asset paths work under a repository base path.
- File import uses browser APIs only.
- Clipboard image copy is tested in HTTPS deployment or a realistic local equivalent.

## Sample Test Data
Create or collect fixture datasets for:

- `.xlsx` PCR workbook: 1 specimen x 8 reagents.
- `.xls` PCR workbook equivalent to the `.xlsx` baseline.
- Real old BIFF `.xls` workbook with Korean labels.
- PCR workbook: many specimens sharing the same reagent names.
- PCR workbook: more than 20 selectable/visible curves.
- PCR workbook: similar specimen or reagent names such as `Sample1`, `Sample 1`, and `Sample-1`.
- PCR workbook: nonnumeric fluorescence cells.
- PCR workbook: formulas with and without cached values.
- PCR workbook: missing specimen or reagent cells.
- PCR workbook: empty rows, empty columns, and uneven curve lengths.
- Multi-sheet workbook where worksheet 0 is valid and later sheets differ.
- Multi-sheet workbook where worksheet 0 is invalid and a later sheet is valid.
- Multi-sheet workbook where worksheet 0 is valid, later sheet is invalid, and import still succeeds from worksheet 0.
- Workbook whose active tab is not worksheet index 0.
- Unsupported/corrupt/password-protected workbook.
- Formula workbook with cached numeric values.
- Formula workbook without cached values.
- Large workbook for performance smoke testing.
- Simple plotted-data export case with shared cycle X values.
- Non-simple plotted-data export case with mismatched X arrays or non-rectangular output.

## Automation Candidates
- Excel parser tests for `.xls` and `.xlsx`.
- First-sheet-only parser tests.
- Expected normalized JSON snapshot tests.
- Fixture manifest path/existence tests once fixtures are created.
- Similar-name warning tests.
- Header and missing-value validation tests.
- Search and selection-state tests.
- Tree derivation and collapsed-default tests.
- All-collapsed initial state snapshot tests for reagent-first and specimen-first trees.
- Axis validation tests.
- Style precedence, preset overwrite, and one-step undo tests.
- Preset undo state-machine tests covering second preset replacement and undo unavailable after use.
- Legend/export order tests.
- Export filename tests with fake browser-local date and sanitized analysis names, for example `260709_Run_A_plot1.png`, `260709_Run_A_plot2.jpg`, and legacy/no-name helper coverage such as `260707_plot1.png`.
- Export filename counter edge tests: image+CSV share a number, CSV-only consumes next number, failed export does not consume a number.
- Export image smoke tests for PNG/JPEG validity and white background.
- Playwright screenshot comparison/review for default chart visual theme.
- Clipboard fallback UI tests.
- Plotted-data CSV inclusion and disabled-reason tests.
- Plotted-data CSV shape tests: header row, duplicate header disambiguation, blank cell for null Y, quoting/escaping, row order.
- End to end smoke test for import to chart to PNG/JPEG download.
- AnalysisState serialization and deserialization tests.
- Multi-tab independence tests for dataset, search/filter/collapse, selection, scale, style, order, and export counter.
- Analysis XLSX workbook readback tests for visible sheets and hidden restore JSON.
- Analysis XLSX filename sanitization, export counter continuation, and failed-export counter tests.
- Analysis XLSX invalid schema, missing hidden sheet, chunk corruption, and ordinary workbook fallback tests.
- Custom legend rendering tests for line and marker samples.
- Export layout tests for Plot only, Plot + Legend, and Legend only.
- Report legend projection tests for auto-compact common specimen/reagent labels, Analysis labels, duplicate disambiguation, and original-label traceability.
- Rich Excel clipboard payload tests for HTML table structure, separate style/name columns, HTML escaping, and formula-safe label handling.
- State separation tests for selected/chart-visible/legend-visible/export-layout/restore settings.
- Style editor identity tests for duplicate labels and curveId-safe resets.
- Hover/readout, custom-legend hover/focus highlight, marker-preservation during hover, and >20 curve assistance tests.
- Large style/legend list virtualization or search tests.
- Keyboard/accessibility smoke tests for analysis tabs, tree, settings accordions, style rows, legend controls, and export controls.

## Accessibility Checks
- File input and primary controls are keyboard reachable.
- Buttons have accessible names.
- Grouping toggle has radio or equivalent semantics.
- Accordion/tree controls expose expanded/collapsed state.
- Mixed checkboxes expose their mixed state.
- Form errors are associated with relevant controls where feasible.
- Color is not the only signal for warnings or selected curves.
- Focus remains usable after file import and chart updates.

## Known Gaps
- PCR parser, selection UI, Selection Sets, chart preview, style controls, legend order, image export utilities, clipboard fallback, Selected Data XLSX, and secondary plotted-data CSV utilities are implemented.
- The selected test stack is installed and configured for unit/component/Playwright smoke tests.
- Phase S1 synthetic-only `.xlsx`/BIFF8 `.xls` fixtures, deterministic SHA-256 manifest, normalized projections, target snapshots, generated cases, and audit evidence are committed and active. Later S2-S10 acceptance rows identify which target defects are now passing.
- Browser checks have been performed with Playwright: upload-first smoke, generated `.xlsx` upload, appended `.xlsx` upload, collapsed reagent-first selection, internal analysis tab switching, fixed hover readout smoke, chart canvas nonblank pixel check, fixed chart viewport height after settings expansion, sticky chart panel behavior, and public URL technical smoke with generated `.xlsx` upload.
- Clipboard image behavior and rich Excel-cell legend paste have not been manually verified in Chrome/Edge under the final deployment origin.
- GitHub Pages deployment behavior was verified on 2026-07-08 through the Pages workflow and public URL technical smoke with generated `.xlsx` data.
- GitHub Actions branch CI and Pages build now run production dependency audit, unit/audit suites, a single Pages-base-path build, fresh Chromium, network/raster/clipboard/Analysis XLSX gates, and pre/post Playwright dist hashing. Pages uploads that tested dist; the actual workflow run and public post-deploy smoke are S11 release evidence.
- Performance budgets for file size, specimen count, imported curve count, and rendered curve count have not been finalized.
- P1/P2 presets are editable per analysis session and can be preserved through explicit Analysis XLSX export/import, but automatic browser-session persistence is not provided.
- Analysis XLSX export/import is implemented for full-dataset restore files; native editable Excel charts and report-style chart-image XLSX output remain deferred.
- Internal analysis tabs are implemented; tab-count warning/hard-cap behavior remains undecided.
- Hover readout, app-controlled curve highlight, custom-legend hover/focus highlight, marker-preserving hover behavior, and >20 visible-curve assistance are implemented; large style/legend lists use search/scroll affordances.
- Dirty tab close/replace confirmation is implemented; internal tab count policy remains a product decision.

## Current Automated Coverage - 2026-07-12
- Vitest: parser `.xlsx` / `.xls`, first-sheet-only, invalid first sheet, blank/nonnumeric/formula cells, similar-name warnings, append merge identity, selection tree and Selection Set state, schema 1-4 migration/validation, tab isolation, selected-data role rejection, chart option theme/scale/style, hover behavior, style resolution, export filename generation, plotted-data CSV shape, Selected Data XLSX numeric/null/provenance/formula safety, AnalysisState serialization, Analysis XLSX workbook readback, and tab-routing safety.
- Testing Library: upload-first workspace, reagent-first selection, search bulk selection, scale/style/legend controls, Selection Set explicit apply/manage/return behavior including a 20-set selector, selected-data export availability/counter behavior, and Analysis XLSX save availability for full imported datasets.
- Playwright: fresh Pages-base-path production preview, generated `.xlsx` upload/append, Quick Paste boundaries, selection/search, scale/Box zoom, Style/Legend interaction, chart hover/readout, raster/clipboard/network gates, Selection Set switching and overflow, schema-4 Analysis XLSX save/restore, Selected Data XLSX workbook readback, and output-role rejection without analysis mutation.
- Visual artifacts: `docs/gui_mockups/screenshots/phase8_mvp_desktop.png`, `docs/gui_mockups/screenshots/phase8_mvp_mobile.png`, `docs/gui_mockups/screenshots/isoamplar_refinement_desktop.png`, `docs/gui_mockups/screenshots/isoamplar_append_sticky_refinement.png`, `docs/gui_mockups/screenshots/phase-r12_hover_warning_desktop.png`, and `docs/gui_mockups/screenshots/phase-r12_hover_warning_mobile.png`.

## Context Compression Quality Gate
Before ending a development session:

- `DEVELOPMENT_STATE.md` reflects the current phase and next step.
- `DECISIONS.md` contains any newly accepted or changed decisions.
- This test plan contains acceptance criteria for newly added behavior.
- `CHANGELOG.md` records user visible changes.
- Known test gaps are visible in this file.
