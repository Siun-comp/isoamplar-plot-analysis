# 02 Functional Requirements

## Purpose
Define user visible functional requirements for the chart creation web app.

## Status
Active draft

## Last Updated
2026-07-11

## Owner
Product / Engineering / Agent

## Compression-Safe Summary
- Requirements are focused on the IsoAmplar Plot Analysis MVP for PCR/LAMP-style amplification fluorescence curve analysis.
- MVP input is Excel upload only: `.xls` and `.xlsx`, first worksheet only, no in-app data editing. Additional Excel files may be appended to the current analysis.
- CSV import, manual entry, generic spreadsheet charting, SVG/PDF export, and transparent background are future candidates, not MVP.
- Must-have baseline covers Excel parsing, reagent-first selection, clean amplification line charting, fixed axes, user-editable P1/P2 scale presets, stable styling, analysis-name-based PNG/JPEG export filenames, clipboard fallback, and GitHub Pages.
- Post-MVP refinement scope adds internal analysis tabs, Analysis XLSX restore files, custom legend rendering, Analysis label editing, plot/legend export layouts, explicit style origin display, hover readout, large-list/export usability, and implemented Quick Paste Import for small pasted tables, including single-specimen paste.
- Each Must requirement should map to at least one `AC-*` item.
- Implementation details belong in decisions or source code, not requirement text.
- Open questions must remain explicit rather than hidden in assumptions.

## Update Rule
Update this file whenever a feature is added, removed, reprioritized, or behavior changes. Link requirements to acceptance criteria in `docs/04_TEST_PLAN_ACCEPTANCE_EN.md`.

## Priority Legend
- Must: required for initial usable product unless the user changes scope.
- Should: important but can be deferred if MVP needs to shrink.
- Could: useful future enhancement.

## Primary User Workflows

Source Excel analysis:

1. Open the web page.
2. Upload an original `.xls` or `.xlsx` workbook.
3. Review the detected PCR structure from the first worksheet: row 1 specimen, row 2 reagent, row 3 onward fluorescence.
4. Select curves by reagent-first or specimen-first grouping.
5. Configure fixed/preset X/Y scales, styles, legend order, and export settings.
6. Preview the amplification line chart.
7. Download PNG/JPEG, copy the chart output where supported, or export plotted-data CSV when the current chart is rectangular.

Analysis resume:

1. Export an Analysis XLSX restore file containing the full imported dataset and current settings.
2. Later, open the Analysis XLSX file in the web app.
3. Continue analysis with unselected curves, warnings, scale, style, legend/export settings, and order restored.

Multi-analysis workflow:

1. Open a new analysis tab.
2. Load another original Excel workbook or Analysis XLSX.
3. Rename tabs with analysis names and switch tabs to compare separate analysis states.

Deferred report workflow:

- Report/Plotted XLSX with current plotted data plus a static chart image is deferred. It is separate from Analysis XLSX and should not be implemented unless later prioritized.

## Requirements

| ID | Priority | User Story | Functional Requirement | Acceptance Criteria | Notes / Edge Cases |
| --- | --- | --- | --- | --- | --- |
| FR-001 | Must | As a user, I want to import PCR Excel data. | The app shall import `.xls` and `.xlsx` files from the browser, parse only the first worksheet, preserve Excel-formatted specimen/reagent display identity with raw cell provenance, and support either replacing the current dataset or appending another file to the current analysis. | AC-001, AC-002, AC-PCR-001, AC-PCR-015, AC-PCR-016, AC-PCR-025, AC-PCR-047, AC-PCR-048 | Later worksheets are ignored. If the first worksheet is invalid, import fails even if later worksheets are valid. File signature mismatch is diagnostic only until its policy is separately decided. |
| FR-002 | Could | As a user, I may later want CSV import. | CSV import is deferred beyond MVP. | TBD | Do not implement for MVP unless the user reopens scope. |
| FR-003 | Should | As a user, I want to add a small amount of data without creating a new Excel file. | The app shall support Quick Paste Import: full-table paste using the same structure as Excel input, or single-specimen paste where the user supplies one specimen name and pastes reagent/fluorescence rows. It shall generate a read-only preview with warnings and size/memory summary, then append it to the current analysis or open it as a new analysis. Accepted-shape parsing and import errors shall be contained without mutating the current analysis. The app shall not provide in-app cell editing, source-data correction, custom cycle columns, or spreadsheet-grid editing. | AC-PCR-017, AC-QP-001 through AC-QP-021 | This is paste/import only. Tab-separated tables and unambiguous single-column input are supported. Comma/CSV tables are rejected to prevent silent delimiter corruption. Incorrect pasted data is corrected by changing the textarea source/specimen field and regenerating preview before import. CSV file import remains deferred. Browser-process OOM is outside catchable error guarantees. |
| FR-004 | Must | As a user, I want to review detected PCR structure. | The app shall detect and display row 1 specimens, row 2 reagents, row 3+ fluorescence values, generated cycle values, and import warnings. A shared Warning Inspector shall expose source, worksheet, cell/range, raw/display evidence, handling, and affected curves where available. | AC-001, AC-002, AC-PCR-001, AC-PCR-019, AC-PCR-048 | Similar names warn only; no auto-merge, rename, or correction UI. Warning navigation is transient and does not change analysis state. |
| FR-005 | Must | As a user, I want to select analysis curves. | The app shall support reagent-first selection by default, optional specimen-first grouping, search, global search bulk actions, selected/unselected filters, collapsed groups, grouped-row readability styling, and simplified single-curve subgroup rows. | AC-004, AC-PCR-003, AC-PCR-004, AC-PCR-005, AC-PCR-018, AC-PCR-025, AC-PCR-026 | Search bulk actions apply to all matched curves, not only visible rows. Curve labels follow the active grouping mode and use a visible separator that remains distinguishable when specimen or reagent names contain `/`. |
| FR-006 | Must | As a user, I want to generate amplification plots. | The app shall render selected curves as clean amplification line charts using generated cycles as X values unless later configured otherwise. | AC-006, AC-PCR-006, AC-PCR-012, AC-PCR-023, AC-PCR-024, AC-PCR-025 | No automatic smoothing, normalization, Ct/Cq, averaging, or log transform. Visual style should be polished and readable, not decorative or dense. The preview plot viewport should not stretch when side panels expand and should stay visible during desktop page scrolling. |
| FR-007 | Could | As a user, I may later want layout or batch arrangement. | Multi-chart layout, batch output, and graph boards are deferred beyond the single-chart MVP. | TBD | Revisit after the single-chart PCR workflow is stable. |
| FR-008 | Must | As a user, I want to configure legends and styles. | The app shall support custom legend visibility/mode, current-order legend/export ordering, per-curve Analysis labels, group style rules, stable default colors, HEX-first color editing, combined group line/marker selection, individual curve overrides, optional markers, style origin display, scoped reset actions, preset overwrite semantics, and legend hover/focus highlighting for the matching curve. | AC-006, AC-PCR-008, AC-PCR-009, AC-PCR-020, AC-PCR-024, AC-PCR-025, AC-PCR-027, AC-PCR-028, AC-PCR-029, AC-PCR-030, AC-PCR-032, AC-PCR-039, AC-PCR-041, AC-PCR-042, AC-PCR-043, AC-PCR-046 | Built-in presets remain available for explicit assistance flows but are not shown as permanent Style-panel shortcut buttons. Default curves are solid lines without markers. Group and individual style settings can enable markers. Group rows should avoid horizontal scrolling where feasible. Custom legend samples must match actual line and marker styles. Measured two-line legend layout preserves distinguishing label endings and reports unresolved curve/source identity collisions without silently rewriting labels. Analysis labels apply to chart/custom legend labels, report legend outputs, plotted CSV headers, and Analysis XLSX restore state while original specimen/reagent/source labels remain immutable and resettable. Hover highlight is transient and must not change style/export state. |
| FR-009 | Must | As a user, I want fixed X-axis scales. | The app shall allow automatic, user fixed, user-defined P1/P2, or plot-area Box zoom X-axis min/max values. | AC-007, AC-PCR-024, AC-PCR-044 | Invalid bounds must be rejected. Fixed mode should show current Auto bounds as editing aid. Box zoom writes Fixed bounds and does not crop or transform the stored data. Previous scale returns one Box zoom step at a time; Auto scale is a separate full automatic reset. |
| FR-010 | Must | As a user, I want fixed Y-axis scales. | The app shall allow automatic, user fixed, user-defined P1/P2, or plot-area Box zoom Y-axis min/max values. | AC-008, AC-PCR-024, AC-PCR-044 | Fixed bounds should persist across filtering and redraws. P1/P2 values are user-entered, not invented defaults. Previous scale returns one Box zoom step at a time; Auto scale is a separate full automatic reset. |
| FR-011 | Must | As a user, I want to download chart images. | The app shall export the current chart as PNG and JPEG with white background and a browser-local date filename. When an analysis name exists, the filename shall use `YYMMDD_<sanitizedAnalysisName>_plotN.ext`; otherwise it falls back to `YYMMDD_plotN.ext` for legacy/no-name contexts. | AC-009, AC-PCR-010, AC-PCR-031, AC-PCR-041 | Example on 2026-07-09 with analysis name `Run A`: `260709_Run_A_plot1.png`. Blank or invalid names fall back to a safe `analysis` segment. Transparent background is out of MVP. |
| FR-012 | Must | As a user, I want to copy charts and report legends to the clipboard. | The app shall copy the selected chart image layout to the clipboard where supported, provide report-legend PNG clipboard copy, provide rich Excel clipboard copy for report legends as HTML table cells where supported, and show a fallback when unsupported. | AC-010, AC-PCR-031, AC-PCR-041 | Clipboard image copy and rich HTML clipboard copy require browser support, HTTPS or localhost, and user gesture. Report legend copy actions must not change the selected export layout and must use the current legend order, resolved style, and Analysis labels. |
| FR-013 | Must | As a user, I want the app hosted from GitHub. | The app shall work as a static GitHub Pages deployment without required backend services. | AC-011 | Asset paths must work under a repository base path. |
| FR-014 | Should | As a user, I want understandable errors. | The app shall show actionable errors for invalid input, invalid mappings, export failure, and clipboard failure. Quick Paste and the active analysis workspace shall fail locally so the app shell, other analysis tabs, and available Analysis XLSX recovery remain usable. | AC-012, AC-QP-021 | Error copy should be concise and user oriented. A retry must not reset or silently mutate analysis state. |
| FR-015 | Could | As a user, I want reusable chart configurations. | The app may allow downloading or reloading chart configuration JSON. | TBD | Future scope unless user prioritizes it. |
| FR-016 | Should | As a user, I may want exported plotted data. | The app should export currently plotted data as CSV only when the current chart state is simple and rectangular enough for reliable output. | AC-PCR-021, AC-PCR-022 | Disable with a clear reason when the chart state is not safely exportable. |
| FR-017 | Must | As a user, I want to continue a large analysis later. | The app shall expose a top-level analysis save command and import an Analysis XLSX restore file containing the full imported normalized dataset, source/header provenance, warnings and handling, selected/unselected state, grouping/collapse state, order, scale/P1/P2, style rules, individual overrides including Analysis labels, legend/export settings, analysis name, and export counter. It shall show the last completed snapshot time and whether later changes remain. | AC-PCR-033, AC-PCR-034, AC-PCR-036, AC-PCR-037, AC-PCR-041, AC-PCR-048, AC-PCR-049A, AC-PCR-049B | Analysis XLSX is a web-app project/session file, not a native editable Excel chart workbook. Hidden restore JSON is authoritative; visible HeaderProvenance/Warnings/ImportedData sheets are for review. Runtime save metadata and output jobs are transient. Schema 3 migrates schema 1/2 restore payloads. |
| FR-018 | Must | As a user, I want to work on multiple analyses in one browser window. | The app shall support internal analysis tabs, with independent dataset, selection, search/filter/collapse, scale, style, legend/export order, export counter, analysis name, save status, and output jobs per tab. Browser refresh/close protection shall be active while any tab is dirty, including inactive tabs. | AC-PCR-035, AC-PCR-036, AC-PCR-049A, AC-PCR-049B | Dirty tab close and file replacement require explicit confirmation. Closing can be canceled, saved as Analysis XLSX then closed, or discarded. Async output completion must never update a different, closed, or replaced runtime. No automatic localStorage/IndexedDB persistence is added. |
| FR-019 | Must | As a user, I want export outputs that do not obscure the plot. | The app shall support preview legend visibility, export legend inclusion, image export layout modes: Plot only, Plot + Legend, and Legend only, larger report-style legend image export/copy, rich Excel-cell report legend clipboard copy, and purpose-grouped Export controls. | AC-PCR-030, AC-PCR-031, AC-PCR-041, AC-PCR-046 | Default should show the preview legend outside the plot and include legend in image export. Legend-bearing output uses bounded measured layout and is blocked with curve/source evidence if identities still collide; Plot-only remains available and export dimensions are not silently expanded. Report-style legend export is not a native Excel chart workbook; Excel clipboard output is a rich HTML table for document/data assembly. |
| FR-020 | Should | As a user, I want the interface to remain usable with many curves. | The app should provide searchable or virtualized large style/legend lists, compact group style controls, a fixed hover/readout area, transient curve highlighting from chart/legend hover, a paginated/filterable Warning Inspector, assistance actions when more than 20 curves are visible, and keyboard-accessible controls where feasible. | AC-PCR-012, AC-PCR-038, AC-PCR-039, AC-PCR-040, AC-PCR-043, AC-PCR-048 | Warnings and assistance must not block preview/export by default. Hover and warning reveal state are transient. |
| FR-021 | Could | As a user, I may later want a report-style Excel workbook. | Report/Plotted XLSX with current plotted data and a static chart image is deferred. | TBD | This is not Analysis XLSX. Native editable Excel chart generation is excluded unless a future decision reopens it. |

## Confirmed Chart Type
- Amplification fluorescence line chart for IsoAmplar analysis.

Other chart types are future candidates only.

## Chart Configuration Fields
Candidate configurable fields:

- Chart title
- X axis label
- Y axis label
- Default visual theme
- Legend visibility
- Legend position
- Legend label mode
- Box zoom / Auto scale navigation controls
- Analysis label per-curve display name
- Export layout: Plot only, Plot + Legend, Legend only
- Series display name
- Series color
- Chart width and height
- Margins or layout presets
- Grid visibility
- X axis automatic scale
- X axis fixed min and max
- Y axis automatic scale
- Y axis fixed min and max

The fixed scale behavior must remain stable after filtering, data remapping, and chart redraws unless the user resets it.

## Default Chart Visual Direction
- White background.
- Clean clinical/report style rather than decorative dashboard styling.
- Sparse major grid lines only by default; dense minor grid lines are off by default.
- Axis, title, and legend typography should be readable and modern without becoming overly austere.
- Lines should have balanced width and distinguishable colors/line styles.
- Default lines should have no point markers; group and individual style settings can enable markers.
- PNG/JPEG export should match the preview's visual style.
- Reference images are style direction only. Do not hardcode reference-specific title text, axis labels, axis ranges, threshold/reference line, marker shapes, colors, legend labels, curve count, or data values.

## Privacy Requirement
By default, imported user data should stay inside the browser session and should not be uploaded to any server.

If future features require remote storage or sharing, they must be explicitly approved and documented in `DECISIONS.md`.

## Open Questions
- What maximum row count and file size should be targeted?
- Should advanced filters beyond search and selected/unselected state be global, per chart, or both?
- Should chart/style presets be saved in a future version?
- Should chart configuration JSON be downloadable?
- Should internal analysis tabs have a hard cap or warning-only memory policy?

## Initial Implementation Status - 2026-07-08
- Implemented: `.xls` / `.xlsx` upload, append upload, first worksheet only, row 1 specimen / row 2 reagent / row 3+ fluorescence parsing, generated cycle X values, warning-only similar names, missing-header warnings, and no source-data editing.
- Implemented: reagent-first default selection, specimen-first alternate view, grouping-aware curve labels, all groups collapsed after import, curveId-based selection, search/filter bulk actions across collapsed groups, grouped row banding, and virtualized major-group tree rendering in browser.
- Implemented: ECharts amplification line chart preview with white background, sparse major grid, no minor grid, large-value Y-axis spacing, fixed/sticky plot preview, plot-safe fixed hover readout, app-controlled transient curve highlighting, stable default colors, default no-marker solid lines, fixed/auto/user-defined P1/P2 X/Y scales, >20 visible-curve warning with assistance actions, compact group style controls, group/individual style controls, group marker style UI, built-in style presets with one-step undo, style origin badges, field/curve/selected/all/group reset controls, searchable large selected-curve style lists, and user legend/export order.
- Implemented: custom preview legend outside the plot, legend hover/focus highlighting, preview legend visibility control, Analysis label editing with auto-compact/full label mode for legend/report outputs, Plot only / Plot + Legend / Legend only image export layout, PNG/JPEG image export with white background and analysis-name-based filenames, selected-layout PNG clipboard copy with fallback message, report legend PNG clipboard copy, rich Excel-cell legend clipboard copy using Excel-friendly HTML table cells, purpose-grouped Export controls, and plotted-data CSV export when selected curves share a rectangular X axis.
- Implemented: internal analysis tabs with per-tab state, dirty close/replace confirmation, and Analysis XLSX restore files containing the full imported dataset plus analysis settings.
- Not finalized: internal tab count policy and reusable custom preset persistence.
- Implemented post-MVP input refinement: Quick Paste Import for small pasted tables, with full-table mode, single-specimen mode, preview/warnings, and append/new-analysis actions only.
- Deferred: CSV file import, manual input/editing, in-app data editing, sheet picker, saved custom presets, chart configuration JSON import/export, multi-chart/batch layout, SVG/PDF export, transparent background export, Report/Plotted XLSX with static chart image, and native editable Excel chart generation.
