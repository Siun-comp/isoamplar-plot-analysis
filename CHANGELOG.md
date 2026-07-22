# CHANGELOG.md

## 2026-07-22 - Specimen header inheritance

- Added source-local left-to-right specimen inheritance for truly blank later row-1 cells in Excel and full-table Quick Paste, reducing repeated entry for one-specimen/multi-reagent runs.
- Blocked Excel or paste sources whose first usable curve column has no specimen label; failed append attempts leave the open analysis unchanged and never borrow a specimen from another source.
- Preserved blank header provenance and added grouped informational evidence with explicit source and target cells; reagent headers, formula-without-cache headers, and formatted-display-empty headers are not inherited.
- Updated horizontal merged-specimen handling, fixed fixtures, append coverage, and Analysis XLSX semantic validation so inherited labels and original blank cells roundtrip without weakening unrelated header-integrity checks.
- Hardened Analysis XLSX continuation against missing, cross-source, nonblank, formula-derived, or non-nearest inheritance evidence, and replaced repeated warning/source scans with indexed validation for wide restored datasets.

## 2026-07-14 - Report-readable plot exports

- Defaulted new analyses to `Plot only` while retaining explicitly saved Analysis XLSX layout choices.
- Added an export-only 9.5 cm report-readability profile that keeps 2400px output and enlarges axes, ticks, curves, markers, and margins without changing preview geometry, raw fluorescence, selected curves, scales, order, or styles.
- Preserved relative line-width differences, matched Plot + Legend samples to the plot geometry, and added a downloaded 2400 x 1520 Plot PNG browser regression.

## 2026-07-12 - Selection Sets and Selected Data XLSX

- Added tab-local named Selection Sets with explicit apply, modified-state indication, update, rename, delete, and one-step return to the selection that existed before applying a set.
- Preserved Selection Sets through Analysis XLSX schema 4, added a visible `SelectionSets` review sheet, and migrated schema 1-3 files to an empty-set state.
- Added Selected Data XLSX as the primary current-selection numeric export with `PlottedData`, `CurveInfo`, `Warnings`, and `ExportInfo` sheets plus an output-only role marker.
- Kept raw fluorescence numeric/null values unchanged, retained all common-X rows regardless of Box zoom or visible Scale, and added source/warning provenance and formula/hyperlink-safe text cells.
- Rejected Selected Data XLSX from original-open, append, and saved-analysis restore paths before analysis mutation; retained Plotted CSV under `기타 형식` as a secondary output.
- Updated the Korean first-user guide with synthetic-only Selection Set and Selected Data XLSX workflows and screenshots.
- Hardened schema 4 against missing and wrong-typed Selection Set fields, reset editor intent across analysis tabs, froze rename/delete targets, distinguished active and candidate sets, showed update add/remove counts, restored focus after inline confirmations, and verified 120-character names without horizontal overflow.
- Contained long source/curve labels inside the settings accordion after public 1280px smoke exposed a 6px document-level overflow, and added a long synthetic filename browser regression.

## 2026-07-11 - Audit remediation S11 documentation and release preparation

- Replaced the generic chart-app charter and stale release checklist with the current IsoAmplar desktop workflow, exclusions, verification gates, and rollback procedure.
- Updated README, I/O, acceptance, plan status, and traceability documents to distinguish Excel/Quick Paste support from deferred CSV, drag/drop, manual editing, mobile analysis, and multi-plot scope.
- Expanded and regenerated the Korean first-user PDF guide to 16 pages with exact Analysis XLSX continuity, privacy/network boundaries, current import commands, and synthetic-only screenshots/examples.
- Added a release-candidate evidence document with automated, manual, post-deploy, unresolved-decision, and rollback checklists.
- Renamed the completed S10 release contract test and audit command so passing evidence is no longer presented as an open TODO/known-red item.
- Clarified the public and in-app research/kit-development boundary, aligned the saved-analysis control name, replaced overstated per-file Analysis XLSX verification language, and added a Korean workflow glossary for implementation terms still visible in the UI.
- Displayed the user-defined P1/P2 label in the applied-scale status instead of the internal `PRESET1`/`PRESET2` state key.
- Removed historical Markdown trailing whitespace exposed by the full `main` promotion diff, and made post-browser dist comparison conditional on a successfully created dist baseline so early CI failures do not add a misleading missing-dist error.
- Released audit remediation SHA `eae3281fb8f9bbbd900fab528be3e094b93b555a` under tag `release-20260711-audit-remediation-r1`; branch CI and Pages deployment passed full unit/audit/dependency/fresh-Chromium/exact-dist gates, followed by byte-identical public asset and synthetic import/render/style/scale/export/restore/network smoke.

## 2026-07-11 - Audit remediation S10 release verification

- Added fresh GitHub Pages base-path Chromium verification on a dedicated non-reused preview server.
- Added exact `dist` SHA-256 manifests before and after Playwright so Pages uploads only the browser-tested bytes.
- Added context-wide browser network evidence that permits only known static app `GET/HEAD` paths plus browser-local blob/data output, and blocks same-origin writes, cross-origin HTTP(S) transports, and WebSockets.
- Strengthened legend PNG checks for fully opaque white background, complete white perimeter, bounded content, and expected text/style pixels.
- Added Chromium clipboard-failure guidance and Analysis XLSX save/restore/resave coverage that verifies exact curve/source/X/Y/stats equality for null, negative, exponential, and large fluorescence values plus selection/scale/style/label continuity.
- Reduced Pages workflow permissions so only the deployment job can write Pages and request the OIDC token.

## 2026-07-11 - Audit remediation S9 hover and editor performance

- Coalesced chart pointer movement to one readout calculation per animation frame.
- Replaced every-point pixel conversion with a nearest-X hit-window lookup that preserves steep curves, gaps, boundaries, and duplicate X values while requiring at least a fivefold work-unit reduction in the deterministic 100x100 regression geometry.
- Separated transient hover emphasis from full chart option/data generation with a data-free series style patch.
- Avoided repeated React readout updates when the hovered curve and point have not changed.
- Added reusable 20x100 and 100x100 production-build measurements for import, selection/chart readiness, hover, Style open, tab switching, Export readiness, and DOM size.
- Retained the current Style/Legend workflow without new virtualization because the measured 100-curve editor remained responsive.

## 2026-07-11 - Audit remediation S8 desktop workspace clarity

- Fixed Legend Order/Labels tabs so the inactive editor is removed from both display and accessibility trees, with standard arrow/Home/End keyboard navigation.
- Kept the plot available while long desktop settings scroll by giving the chart panel viewport-aware height and internal overflow behavior.
- Simplified individual Style rows around curve identity plus color, line/marker, status, and reset controls; Analysis labels are now edited only in Legend Labels.
- Moved style popovers outside clipping scroll containers and reduced row widths so controls remain reachable on laptop-width desktop screens.
- Added advisory-only checks for duplicate visible style signatures, low contrast against the white chart background, and invalid colors without changing user styles.
- Replaced ambiguous Clean/Unsaved status wording with `저장됨` and `저장 안 됨`.

## 2026-07-11 - Audit remediation S7A restore and CSV safety

- Added semantic Analysis XLSX validation for cycle axes, curve statistics, specimen/reagent membership, source provenance, warning references, ordering, collapse state, and style references before a restored tab is created.
- Added payload measurements for curves, fluorescence points, sources, restore JSON, chunks, estimated workbook size, and actual workbook bytes without introducing an unapproved hard limit.
- Added source-specific cycle-count and `Cycle 1..N` review metadata to the visible Settings worksheet.
- Made restore JSON chunking preserve non-BMP text across chunk boundaries.
- Made plotted CSV headers beginning with `=`, `+`, `-`, or `@` spreadsheet-safe without changing source labels, Analysis labels, fluorescence values, or Analysis XLSX content.
- Added malformed restore, current-analysis preservation, formula-header, chunk-boundary, mixed-source, and 96-curve by 100-cycle generated payload regression tests.

## 2026-07-11 - Audit remediation S6 save continuity and async isolation

- Added browser refresh/close protection whenever any analysis tab has unsaved changes.
- Moved Analysis XLSX continuation saving to a top-level `분석 저장` command with last snapshot time and later-change status.
- Separated original Excel open, Excel append, saved-analysis restore, and Quick Paste commands with file-role validation.
- Added per-analysis output job reservation so save/export/clipboard completion cannot update another, closed, or replaced tab.
- Kept dirty state unchanged for ordinary exports, kept clipboard actions counter-free, and made failed jobs reuse the same output number.
- Removed Analysis XLSX from report/data Export controls; the header now owns the single continuation-save workflow used by normal, save-and-close, and recovery paths.
- Updated desktop regression tests and stable file-input locators for the expanded import command set.

## Purpose
User visible and release relevant change history.

## Status
Active draft

## Last Updated
2026-07-12

## Owner
Agent / Engineering

## Compression-Safe Summary
- IsoAmplar Plot Analysis has moved beyond the initial MVP into release validation and real-data hardening.
- The current change set includes documentation, GUI mockup planning, accepted implementation stack, narrowed PCR/LAMP plot initial scope, and post-MVP UI/analysis refinements.
- Feature changes should be recorded under `Unreleased`.
- Release entries should follow Keep a Changelog style.
- Known limitations should remain visible.

## Update Rule
Update this file when user visible behavior, documentation baseline, release readiness, or known limitations change. Internal refactors only need entries when they matter to users or maintainers.

## [Unreleased]

### Added
- Added Quick Paste size diagnostics for rows, columns, cells, source characters, curves, cycles, warnings, and approximate minimum working memory before import.
- Added localized recovery boundaries for the Quick Paste dialog and active analysis workspace, keeping the app shell, other analysis tabs, and Analysis XLSX recovery available after catchable render failures.
- Added a shared, filterable Warning Inspector for Excel and Quick Paste with source/cell evidence, handling outcome, affected curves, bounded pagination, and transient location reveal.
- Added visible `HeaderProvenance` and expanded `Warnings` review sheets to Analysis XLSX schema 3, with schema 1/2 migration and strict current-schema validation.
- Added curveId/source-aware legend identity validation, measured two-line preview/raster layout, and actionable collision warnings that leave Plot-only output available.
- Added synthetic desktop/raster evidence for shared-prefix Lot A/B labels and distinguishable dashed/dotted plus circle/rect legend samples.
- Added explicit Applied scale status and actionable invalid-draft feedback for X/Y Fixed and P1/P2 controls.
- Added Analysis XLSX schema 2 scale continuity with automatic schema 1 migration.
- Implemented Quick Paste Import for small comparison datasets with full-table and single-specimen modes, tab-separated or single-column input, read-only preview, source-position warnings, warning acknowledgement, append/new-analysis actions, and no in-app cell editing.
- Added mixed Excel/paste source provenance to Analysis XLSX hidden restore data and visible Settings/ImportedData sheets, including source type, immutable source ID, source name, source column, and paste input mode.
- Added Quick Paste parser, UI, store, Analysis XLSX, chart, legend, and plotted-CSV regression coverage.
- Added `docs/10_QUICK_PASTE_IMPORT_PLAN_KR.md` with phased prompts for a paste/import-only small-table input path, including full-table paste, single-specimen paste with pre-import specimen-name supply, read-only preview, warning policy, append/new-analysis flow, Analysis XLSX continuity, and no in-app source editing.
- Added Box zoom controls for chart preview. Dragging the plot area applies the selected region as Fixed X/Y scale so preview, image export, clipboard output, and Analysis XLSX restore state remain aligned.
- Added Analysis label editing under the Legend settings, with Auto compact / Full label modes and per-curve labels that apply consistently to chart/custom legends, report legend outputs, plotted-data CSV headers, and Analysis XLSX restore state while preserving original specimen/reagent/source labels for reset and traceability.
- Added rich Excel-cell legend clipboard copy using an HTML table clipboard payload with Malgun Gothic 9 pt text so style samples and names can paste into separate Excel cells where supported.
- Added purpose-grouped Export controls for Chart image, Report legend, and Data/session, with report legend image file saves moved behind a nested disclosure.
- Added Analysis XLSX continuity regression coverage for current Analysis labels, preview legend state, label mode, image export layout, export counter, selected/unselected curves, and user order.
- Added direct parser regression coverage for missing specimen headers, missing reagent headers, both headers missing, and uneven curve lengths.

### Changed
- Quick Paste warning provenance normalization and preview rendering now use indexed/iterative paths that complete the documented 250,000-cell tall, wide, and empty-heavy boundary matrix without introducing a lower hard cap.
- Excel specimen/reagent identity now follows SheetJS-formatted display values recomputed from raw value/type/number format while preserving raw/display/type/format/formula/cache provenance; cached formulas are never recalculated.
- Repeated imports with the same filename now remain source-distinct in warning filters and Analysis XLSX evidence, while file-signature mismatch remains diagnostic rather than changing import policy.
- Preview, standard legend, report legend, and rich Excel legend paths now retain one ordered curveId/style projection; raster labels preserve both leading context and distinguishing endings with explicit ellipsis.
- Legend raster exports keep the requested width/height and reject layouts that cannot fit safely instead of silently clipping or enlarging the canvas.
- Scale editing now preserves the last valid applied bounds while an active draft is incomplete or reversed. Plot-bearing PNG/JPEG/clipboard output is blocked until corrected, while Legend-only, report legends, plotted CSV, and Analysis XLSX remain available.
- Box zoom bounds now preserve size-aware significant digits instead of fixed 2/3-decimal rounding.
- Replaced accepted-size min/max and row-width argument spreads with iterative reductions in Quick Paste, Excel parsing, curve statistics, chart domains, dataset append, plotted CSV, and Analysis XLSX review generation.
- Quick Paste accepts Excel-style Tab copies and unambiguous single-column input; comma/CSV tables are rejected to prevent silent delimiter corruption.
- Analysis runtime operations now use transient instance IDs and revisions so stale paste previews and mid-save/mid-replace changes cannot overwrite or close the wrong analysis.
- Updated functional requirements, I/O rules, test plan, and decisions D037-D040 to treat Quick Paste Import as an implemented post-MVP import path while keeping CSV file import, manual entry, and in-app editing excluded.
- Changed Box zoom scale recovery so `Previous scale` restores the prior scale state one zoom step at a time, while `Auto scale` remains a separate full automatic reset.
- Changed Box zoom mode to visually highlight the valid plot area before dragging, reducing ambiguous starts or releases in the axis/label margins.
- Updated the default chart color order to the user-preferred palette: purple, blue, green, yellow, red, gray, sky blue, and pink.
- Normalized command-button and form-control sizing across analysis tabs, import actions, selection filters, chart tools, scale presets, legend controls, and export controls while keeping status badges intentionally smaller.

### Fixed
- Catchable Quick Paste parser/import failures now preserve the current analysis and return actionable local errors; retrying a recovered paste dialog correctly reopens it without discarding the entered source text.
- Long Quick Paste headers keep their full source identity while using bounded internal IDs and shortened preview-only labels, avoiding multi-megabyte DOM labels without changing imported data.
- Dataset-level warnings now participate in the warning filter and tree badges, and warning navigation no longer mutates selection, order, style, search/filter, collapse, revision, or dirty state.
- Warning Inspector collapse state now remains under user control across filter changes, and repeated same-name sources are visibly numbered.
- Quick Paste warning details are now paginated so every source cell remains inspectable without rendering an unbounded list, and the mobile dialog keeps all import actions visible while only its body scrolls.
- Stale Quick Paste previews can no longer create a new analysis after the captured target analysis changed, closed, or was replaced.
- Repeated imports with identical file metadata now retain distinct immutable source-instance identities, and whitespace-only headers use positional fallback identities and readable display labels.
- Dirty file replacement now uses a keyboard-modal native dialog with Escape and focus restoration; visible file controls show keyboard focus through their containing button labels.
- Analysis XLSX save completion no longer marks a different tab clean or closes an analysis that changed while its snapshot was being generated.
- Box zoom now cleans up outside-canvas mouse release states and suppresses hover/legend emphasis while the zoom tool is active.
- Fixed nested Style popover triggers inheriting accordion summary sizing, tightened icon reset buttons, and removed an obsolete hidden legend clipboard button wrapper from Export controls.
- Fixed the preview legend visibility label mojibake and applied Auto compact legend labels consistently to the chart preview legend and plot/legend image exports.
- Tightened the Legend Labels reset control and stacked the Export Legend header to prevent narrow-panel text overlap.
- Analysis XLSX schema 2 files with missing required applied scale state are now rejected as corrupt instead of being silently reconstructed as legacy state.
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
- Added grouping-aware curve labels so reagent mode displays `reagent │ specimen` and specimen mode displays `specimen │ reagent` in selection, chart legend, legend order, and plotted CSV.
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
- Added custom legend hover and keyboard focus highlighting for the matching chart curve.
- Added analysis-name-based filenames for PNG/JPEG, plotted-data CSV, and Analysis XLSX exports.
- Added a dedicated `범례 클립보드 PNG` action for copying only the current custom legend without changing the selected export layout.
- Added compact group style controls: HEX-first color popover and combined line/marker preview popover for specimen and reagent group rows.
- Added Playwright coverage using large Y-axis fluorescence values around 1,200,000 for chart spacing regression checks.
- Added a report-readable legend image export path with larger legend typography, including PNG/JPEG download and PNG clipboard copy.
- Added dirty analysis close confirmation with cancel, Analysis XLSX save-and-close, and close-without-saving choices.
- Added dirty file-replace confirmation with replace-current-analysis and open-as-new-analysis choices.
- Added regression coverage that chart series use raw fluorescence points without smoothing or resampling.

### Changed
- Changed the app header status badge from internal phase wording to `Browser-local analysis`.
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
- Updated Excel import/append state handling so async parse results apply only to the tab where the action started, failed append preserves the active analysis, and dirty replace requires explicit confirmation.
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
- Clarified release evidence boundaries: generated `.xlsx` public URL smoke is complete, real `graph_TEST.xlsx` remains manual domain validation, and e2e/audit are local release checks outside the current Pages workflow gate.
- Updated chart hover behavior to use app-controlled `curveId` highlighting instead of ECharts built-in series emphasis.
- Updated export filename rules so future downloads include the sanitized current analysis name before `plotN` or `analysisN`.
- Updated image export layout selection to live in the Export section instead of Legend Order.
- Updated chart Y-axis layout spacing to keep `Fluorescence` readable beside large tick labels.
- Updated chart grid spacing to reduce excessive left-side empty space while preserving large Y-axis label readability.
- Updated compact group style rows so group names remain visible, color controls show only a compact swatch, line/marker controls use a smaller preview button, and reset uses a compact icon button.
- Updated compact style popovers to use native `details` state for more reliable Escape and outside-click closing.
- Updated curve labels to use ` │ ` between specimen and reagent so labels remain readable when source names contain `/`.
- Updated the Style panel by removing permanent built-in preset shortcut buttons; preset logic remains available for explicit assistance flows such as the >20 visible-curve helper.
- Updated line/marker popovers so a selected line or marker choice closes the popover instead of leaving it over later controls.

### Fixed
- Fixed a Korean mojibake empty-state message in the Legend settings before any curves are selected.
- Adjusted report legend image spacing so legend text aligns with the line sample and no longer crowds the title.
- Changed the Excel report-legend clipboard style sample from SVG/CSS line snippets to colored text glyph samples with fixed-width cells, improving paste fidelity in Windows Excel.
- Fixed chart preview height stretching with expanded left/right panel content.
- Fixed default curve color shifting when earlier curves are selected later.
- Fixed static `시약별` selection-panel header text after switching to specimen view.
- Fixed add-select race handling so an empty tab that started an import remains the import target even if the user switches tabs before parsing completes.
- Fixed a legend-order edge case where moving a selected curve could appear to do nothing when an unselected curve sat between the selected curves in the full imported order.
- Fixed a data-loss risk where a pending replace/restore result could overwrite a tab that became dirty while the file was still being read.
- Fixed the >20 helper action that previously only changed the selection-panel filter instead of actually keeping the current search result selected.
- Fixed stale fixed-readout values after same-count selection swaps, grouping label changes, or style preset changes.
- Fixed stale single-curve highlighting after moving the pointer away from the chart.
- Fixed marker settings disappearing or changing during hover highlight.
- Fixed group style row horizontal-scroll pressure by replacing separate color/HEX/line/marker columns with compact popover controls.
- Fixed group style popovers being visually covered by following style sections.
- Fixed compact style popovers staying open after outside clicks, Escape, or opening another style popover.
- Fixed an Escape-close regression caused by controlling the native `details` open state from React state.
- Fixed dirty close/replace flows that previously showed only an explanatory warning without an actionable next step.
- Fixed ambiguous chart/legend/CSV labels when specimen or reagent names themselves contain `/`.

### Removed
- Removed permanent built-in style preset shortcut buttons from the Style panel to reduce clutter.
- Removed unused legacy Legend/Report editor code that still referenced the old report-name override model.

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
