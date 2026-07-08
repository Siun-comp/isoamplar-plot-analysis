# CHANGELOG.md

## Purpose
User visible and release relevant change history.

## Status
Active draft

## Last Updated
2026-07-08

## Owner
Agent / Engineering

## Compression-Safe Summary
- The MVP is implemented locally as IsoAmplar Plot Analysis.
- The current change set includes documentation, GUI mockup planning, accepted implementation stack, narrowed PCR/LAMP plot MVP scope, and post-MVP UI/analysis refinements.
- Feature changes should be recorded under `Unreleased`.
- Release entries should follow Keep a Changelog style.
- Known limitations should remain visible.

## Update Rule
Update this file when user visible behavior, documentation baseline, release readiness, or known limitations change. Internal refactors only need entries when they matter to users or maintainers.

## [Unreleased]

### Added
- Created initial documentation scaffold.
- Added agent operating rules and context compression protocol.
- Added initial project charter in Korean.
- Added functional requirement IDs for import, filtering, charting, fixed axes, export, clipboard copy, and GitHub Pages deployment.
- Added initial input/output specification.
- Added initial acceptance criteria and test strategy.
- Added GUI option proposal document with four page structure candidates and expert review notes.
- Added static GUI mockup HTML and rendered screenshots for Option A, Option B, Option C, and recommended Option D.
- Consolidated the GUI mockup into one A/D-style working baseline with Option A data selection and scale controls, no visible column labels, group style rules, individual curve overrides, and large-curve usability affordances.
- Added legend order controls, legend/style preset controls, and clearer individual curve settings to the consolidated mockup.
- Added specimen-first/reagent-first selection view controls, major-group collapse/expand controls, and four right-side settings accordions to the consolidated mockup.
- Added reagent-first default selection, search-result-wide bulk actions, preset overwrite summary, export-order summary, and visible-curve readability warning to the consolidated mockup.
- Added a phased implementation plan with step-by-step implementation prompts in `docs/06_IMPLEMENTATION_PLAN_KR.md`.
- Added PCR-specific acceptance criteria and test phases to the test plan.
- Added accepted implementation stack decision: React + Vite + TypeScript, SheetJS/xlsx, Apache ECharts, Zustand + Immer, `@tanstack/react-virtual`, Vitest + Testing Library, and Playwright.
- Added accepted MVP input/output scope: `.xls`/`.xlsx` Excel upload only, first worksheet only, no CSV/paste/manual input, no in-app data editing, PNG/JPEG white-background export, and conditional plotted-data CSV export.
- Added `AC-PCR-015` through `AC-PCR-022` covering first-sheet-only behavior, `.xls` equivalence, disabled editing, collapsed groups, similar-name warnings, preset overwrite/undo, and plotted-data CSV rules.
- Added accepted default chart visual style decision for clean modern PCR plots: white background, sparse major grid, no dense minor grid by default, readable title/axis/legend layout, and preview/export visual parity.
- Added explicit rule that reference chart images are style direction only and must not be hardcoded as fixed chart content or settings.
- Added Pre-Phase fixture manifest and normalized snapshot schema in `docs/07_FIXTURE_SNAPSHOT_PLAN_KR.md`.
- Added accepted fixture/snapshot baseline decision `D016`.
- Added React + Vite + TypeScript Phase 0 scaffold with package scripts, Vitest config, Playwright config, and a minimal three-panel app shell.
- Added verified dependencies and lockfile, using official SheetJS CDN tarball for `xlsx@0.20.3` and ECharts `^6.1.0`.
- Added Phase 0 smoke tests: one Vitest component test and one Playwright browser test.
- Added Phase 0 scaffold screenshot at `docs/gui_mockups/screenshots/phase0_scaffold.png`.
- Added Phase 1 normalized PCR data model types for datasets, curves, source metadata, warnings, tree nodes, style overrides, and selection state.
- Added Phase 1 sample dataset utilities covering 1 specimen x 8 reagents, shared reagents across specimens, similar labels, and more than 20 imported curves.
- Added Phase 1 selection utilities for reagent-first/specimen-first tree derivation, all-collapsed initial state, curveId-only selection, group selection, collapse toggling, and all-dataset search matching.
- Added Phase 1 unit coverage for stable `sheet0_col_<ExcelColumnLetter>` curve IDs, raw-label preservation, similar-name warning-only behavior, reagent-first defaults, group collapse defaults, and grouping-mode selection persistence.
- Added accepted curve ID convention decision `D018`.
- Added Phase 2 `.xlsx` / `.xls` Excel parser using the first worksheet only.
- Added direct cell-address parsing for PCR row structure: row 1 specimen, row 2 reagent, row 3+ fluorescence, generated cycle X values.
- Added Phase 2 import warnings for ignored later worksheets, invalid first worksheet, missing headers, merged headers, empty fluorescence cells, nonnumeric fluorescence, formulas without finite cached values, unsupported file extensions, and unreadable workbooks.
- Added BIFF `.xls` parser smoke coverage with Korean labels.
- Added accepted missing-header import policy decision `D019`.
- Added Phase 3 Zustand + Immer app store for upload/import status, dataset state, search, display filter, grouping mode, collapse state, and selected curve IDs.
- Added Phase 3 upload-first UI connected to `.xls`/`.xlsx` parser.
- Added Phase 3 reagent-first/specimen-first selection panel with all-collapsed default groups, search, all/selected/unselected/warning filters, tri-state group selection, individual curve checkboxes, and all collapse/expand controls.
- Added accepted displayed-result bulk selection decision `D020`.
- Added Playwright browser upload test using a generated `.xlsx` workbook.
- Added Phase 4 ECharts PCR line chart preview with central chart option builder, white background, sparse major grid, no minor grid, fixed/auto X/Y scale controls, and >20 visible-curve warning.
- Added accepted P1/P2 scale preset decision `D021`; P1/P2 bounds are user-defined and mode buttons remain unavailable until valid values exist.
- Added Phase 5 style controls for specimen/reagent group color and line type, individual curve overrides, built-in presets, one-step preset undo, and user legend/export order.
- Added Phase 6 PNG/JPEG image export, PNG clipboard copy with fallback message, `YYMMDD_plotN` filename generation, export counter handling, and plotted-data CSV export for safe common-X chart projections.
- Added Phase 7 virtualized major-group tree rendering and deferred search query handling.
- Added Phase 8 release checklist at `docs/08_RELEASE_CHECKLIST_KR.md`.
- Added Phase 8 desktop/mobile screenshots for the implemented MVP.
- Added IsoAmplar Plot Analysis product name and developer credit for Jang Si Un.
- Added editable per-analysis P1/P2 scale preset fields for both X and Y axes.
- Added current Auto range display and a Fixed scale action to copy current Auto bounds into editable min/max fields.
- Added individual curve marker options: none, circle, triangle, and rect.
- Added regression tests for stable default colors, default no-marker chart rendering, marker symbol mapping, editable P1 scale behavior, developer credit, and fixed chart viewport height.
- Added append Excel upload so an additional `.xls`/`.xlsx` first worksheet can be added to the current analysis without replacing existing data.
- Added Option A app icon assets for browser tabs, bookmarks, Apple touch icons, and PWA/taskbar install surfaces.
- Added icon option source previews under `docs/icon_options/` for future visual review.
- Added staged UX refinement implementation plan in `docs/09_UX_REFINEMENT_IMPLEMENTATION_PLAN_KR.md`, covering selection tree simplification, style hierarchy cleanup, custom legend/export layouts, plotted XLSX export review, and large-list usability.
- Added unique rekeying for appended curves to avoid `curveId` collisions across files.
- Added grouping-aware curve labels so reagent mode displays `reagent / specimen` and specimen mode displays `specimen / reagent` in selection, chart legend, legend order, and plotted CSV.
- Added sticky desktop chart preview behavior while long side panels/page content scrolls.
- Added first- and second-level selection tree row background banding.
- Added HEX color text input beside color pickers for group styles and individual curve styles.
- Added Analysis XLSX and internal analysis tab phases to the staged UX refinement plan, including full-dataset restore requirements and per-tab analysis state boundaries.
- Added Phase R0 requirement, I/O, acceptance-criteria, and decision updates for Analysis XLSX, internal analysis tabs, custom legends, export layouts, and style origin handling.
- Added Phase R1 serializable AnalysisState helpers and tests for future Analysis XLSX restore/import and internal analysis tabs.
- Added Phase R2 internal analysis tab state model with per-tab dataset, selection, search/filter, scale, style, source file summaries, dirty state, and export counter.
- Added Phase R3 visible analysis tabs with new-analysis creation, switching, renaming, dirty indicators, keyboard arrow tab switching, and dirty close blocking.
- Added Phase R4 Analysis XLSX export/import for full-dataset analysis continuity.
- Added Analysis XLSX workbook output with visible README, Settings, ImportedData, Warnings sheets and a hidden `_IsoAmplarAnalysis` restore JSON sheet.
- Added Analysis XLSX restore routing: file select restores a clean active tab when safe, while add select opens the saved analysis as a new internal tab.
- Added Analysis XLSX readback and routing tests for full unselected datasets, hidden restore JSON, invalid restore sheets, schema/chunk corruption, dirty restore blocking, ordinary workbook fallback, and async tab safety.
- Added Phase R5 selection-tree simplification so single-curve subgroups render as one selectable row without a duplicate subgroup checkbox.
- Added regression coverage for single-curve subgroup rendering, multi-curve subgroup select/mixed behavior, and Playwright verification of the virtualized selection tree branch.
- Added Phase R6 style state model support for group marker rules, style field origins, preset/custom override source metadata, and explicit legend/export settings in AnalysisState.
- Added central chart projection helper for shared visible-curve ordering, resolved styles, chart names, and scale issues.
- Added regression coverage for group marker chart rendering, style origin resolution, override resets, preset undo with group markers, append-cleared preset undo, and AnalysisState persistence of legend/export settings.
- Added same-schema restore migration for older Analysis XLSX payloads that do not yet contain marker group rules or legend/export settings.
- Added Phase R7 Style UI restructuring with a current-basis summary, color/line/marker basis selectors, specimen/reagent group marker controls, and explicit group reset buttons.
- Added individual style rows with curve identity, column labels, field-level baseline/Custom/Preset badges, field reset buttons, curve reset, selected reset, all override reset, and searchable large selected-curve lists.
- Added R7 regression coverage for marker basis controls, group marker UI, individual field/curve reset behavior, Custom/Preset status display, large selected-style search, and Playwright Style-panel smoke verification.
- Added Phase R8 custom preview legend rendered outside the plot, with SVG samples that match resolved line type and marker type.
- Added preview legend visibility control and export layout state control for Plot only / Plot + Legend / Legend only.
- Added R8 coverage for no-marker legend samples, dashed/dotted sample attributes, preview legend toggle, legend order reflection in CustomLegend, and Playwright custom legend smoke verification.
- Added Phase R9 image export layout rendering for Plot only, Plot + Legend, and Legend only across PNG/JPEG download and clipboard PNG.
- Added custom legend image rendering and chart+legend canvas composition with white background, one-pass final JPEG encoding, and invalid empty-image export guards.
- Added R9 export helper coverage for legend SVG rendering and invalid data URL rejection, plus Playwright Legend-only PNG download smoke verification.
- Added Phase R10 legend/style consistency safeguards: duplicate-label source suffixes in style and legend-order rows, curveId-safe order/style regression tests, and duplicate-label style edit coverage.
- Added Phase R11 Analysis XLSX/tab regression coverage for latest style, legend, export layout, export counter, and no-native-chart dependency guard behavior.
- Added R11 race-condition coverage for pending replace/restore results when the target tab becomes dirty mid-import.
- Added Phase R12 fixed chart hover readout below the canvas so point inspection does not cover the plot area.
- Added no-marker line hover support using ECharts series hover plus a nearest-point canvas fallback.
- Added >20 visible-curve helper actions for keeping only current search matches selected, clearing all visible selections, applying a distinguishing style preset, and locally undoing that preset.
- Added R12 coverage for hover payload extraction, browser hover readout smoke, and >20 helper actions.
- Added R12 desktop/mobile screenshots at `docs/gui_mockups/screenshots/phase-r12_hover_warning_desktop.png` and `docs/gui_mockups/screenshots/phase-r12_hover_warning_mobile.png`.
- Added R13 release verification notes for full local regression, dependency audit, GitHub Pages deploy, and public URL smoke.

### Changed
- Replaced default replicate/series/exclude/restore-style wording in the active GUI baseline with individual curve and selected/unselected terminology.
- Adjusted the consolidated mockup layout so long settings panels scroll independently instead of stretching the chart area into a large blank region.
- Changed the right settings panel default state so only Scale is expanded while Style, Legend Order, and Export remain collapsed with summaries.
- Changed the active GUI baseline to treat reagent-first navigation as the default analysis orientation.
- Updated planning status so implementation starts with a fixture/scope Pre-Phase before app scaffolding.
- Rewrote the implementation plan so Phase 0 scaffolds directly with the accepted stack instead of stopping for technology selection.
- Rewrote the test plan around the narrowed PCR MVP and removed CSV/paste/manual-entry checks from MVP release scope.
- Updated I/O rules so plotted-data CSV exports only the current simple chart projection as `YYMMDD_plotN_data.csv`.
- Updated project state after expert-agent review and final user scope decisions.
- Updated chart rendering plan and acceptance criteria to include clean visual-theme verification.
- Updated parser and export planning policies: formulas are not recalculated in-browser, missing Y renders as chart gap and CSV blank, failed exports do not consume `plotN`, and duplicate CSV headers are disambiguated.
- Updated Pre-Phase plan and test criteria to include `AC-PCR-023` and the fixture/snapshot manifest.
- Updated dependency decision after audit: npm registry `xlsx@0.18.5` was replaced with official SheetJS CE 0.20.3 tarball; ECharts was updated to 6.1.0.
- Updated implementation state after Phase 1 verification with `npm run test`, `npm run build`, and `npm run test:e2e`.
- Updated implementation state after Phase 2 verification with `npm run test`, `npm run build`, and `npm run test:e2e`.
- Updated parser loading so SheetJS is lazy-loaded only during Excel import, reducing the initial app bundle.
- Updated implementation state after Phase 3 verification with `npm run test`, `npm run build`, and `npm run test:e2e`.
- Updated ECharts chart/export code to lazy-loaded chunks and shared preview/export chart projection.
- Updated requirements, I/O, and test plan documents to match the implemented MVP.
- Updated implementation state after Phase 8 verification with `npm run test`, `npm run build`, `npm run test:e2e`, and `npm audit --omit=dev`.
- Updated chart preview so its viewport height remains fixed when the selection/settings panels expand.
- Updated default chart styling so lines are solid with no point markers unless the user enables a marker override.
- Updated default color assignment so adding or removing selected curves does not shift existing curve colors.
- Updated built-in style presets so scoped preset application uses the full dataset order and resets marker overrides to none.
- Updated P1/P2 scale handling so no arbitrary defaults are invented, but users can define valid bounds directly in the Scale panel.
- Updated the selection panel header mode label so it follows the active reagent/specimen grouping.
- Updated P1/P2 preset inputs and Export buttons with compact scoped sizing for better visual balance.
- Updated duplicate chart/CSV labels to include file name plus source column when duplicate labels occur across appended files.
- Updated style color controls to accept `#RRGGBB`, `RRGGBB`, `#RGB`, and `RGB` values.
- Updated the staged UX refinement plan to exclude native editable Excel chart generation, prioritize Analysis XLSX for analysis continuity, and defer report-style XLSX chart work.
- Updated D027 from provisional to accepted because the user requested sequential implementation of `docs/09_UX_REFINEMENT_IMPLEMENTATION_PLAN_KR.md` Phase R0 through R13.
- Updated the Analysis XLSX restore contract so runtime tab IDs and dirty state are excluded from saved payloads; restored files receive a tab-local ID and clean dirty state.
- Updated Excel import/append state handling so async parse results apply only to the tab where the action started, failed append preserves the active analysis, and dirty replace is blocked until the replace confirmation UX is finalized.
- Moved analysis tabs above file input controls so Excel replace/append actions visibly target the active analysis.
- Updated Analysis XLSX saved state so runtime tab IDs and dirty state are never restored, and the next export counter continues after a successful Analysis XLSX save.
- Updated Analysis XLSX detection so ordinary workbooks with `Settings` or `ImportedData` sheet names are not misclassified unless they contain the explicit IsoAmplar restore marker.
- Updated selection tree row height estimation to account for merged single-curve subgroup rows.
- Updated Analysis XLSX serialized state to include `legendSettings` and `exportSettings`, while restoring defaults for older payloads that lack those fields.
- Updated append import behavior so pending preset undo snapshots are cleared after data is appended.
- Updated style override metadata from row-level source only to field-level `fieldSources`, preventing mixed custom/preset rows from being mislabeled in the next UI phase.
- Updated legend order movement so it moves against the previous/next selected curve rather than hidden unselected curves.
- Updated duplicate-label style controls so source suffixes are part of ambiguous control names and individual-style search can match the visible source suffix.
- Updated I/O documentation to distinguish Analysis XLSX restore files from deferred Report/Plotted XLSX outputs and excluded native editable Excel charts.
- Updated Analysis XLSX save success handling so a saved analysis becomes clean while the saved export counter advances.
- Updated duplicate source suffixes so repeated same-file append imports are distinguishable with an appended `fileN` suffix.
- Updated Analysis XLSX detection so the hidden restore sheet name alone is not enough; the explicit restore marker is required.
- Updated chart tooltip behavior so ECharts tooltip display is disabled in favor of the fixed readout.
- Updated Playwright generated workbook fixtures from two-point curves to realistic 45-cycle amplification curves for hover/readout verification.
- Updated release checklist and test plan to mark GitHub Pages deployment behavior verified.

### Fixed
- Fixed chart preview height stretching with expanded left/right panel content.
- Fixed default curve color shifting when earlier curves are selected later.
- Fixed static `시약별` selection-panel header text after switching to specimen view.
- Fixed add-select race handling so an empty tab that started an import remains the import target even if the user switches tabs before parsing completes.
- Fixed a legend-order edge case where moving a selected curve could appear to do nothing when an unselected curve sat between the selected curves in the full imported order.
- Fixed a data-loss risk where a pending replace/restore result could overwrite a tab that became dirty while the file was still being read.
- Fixed the >20 helper action that previously only changed the selection-panel filter instead of actually keeping the current search result selected.
- Fixed stale fixed-readout values after same-count selection swaps, grouping label changes, or style preset changes.

### Removed
- Nothing yet.

### Known Limitations
- Clipboard image copy support has not been manually tested in Chrome/Edge on the final deployment origin.
- Static fixture files and expected normalized JSON snapshots do not exist yet; parser behavior is currently covered by generated workbook fixtures in Vitest.
- Performance budgets are not finalized.
- P1/P2 scale presets are editable in-session and can be preserved through explicit Analysis XLSX export/import, but there is still no automatic browser-session persistence.
- pnpm installation is not usable on the current H: exFAT workspace because symlinks are unsupported; npm is verified.

### Planned
- Manual validation with the real `graph_TEST.xlsx` workbook.
- Clipboard verification in Chrome/Edge.
- Optional reusable preset persistence if the user prioritizes it after Analysis XLSX.

### Deferred
- CSV import.
- Pasted or manual table input.
- In-app data editing.
- Multi-sheet picker.
- Layout/batch arrangement controls.
- SVG/PDF export.
- Transparent background export.
- Native editable Excel chart generation.
- Report/Plotted XLSX with static chart image, unless the user later prioritizes report-file output separately from Analysis XLSX.

## [0.0.0] - 2026-07-07

### Added
- Project planning baseline.
