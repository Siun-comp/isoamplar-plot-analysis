# DEVELOPMENT_STATE.md

## Purpose
Single project state snapshot for resuming work after context compression.

## Status
Active

## Last Updated
2026-07-08

## Compression-Safe Summary
- IsoAmplar Plot Analysis MVP implementation has progressed through Phase 8 plus the 2026-07-08 UI/analysis refinement and GitHub Pages deployment passes.
- Stack: React + Vite + TypeScript, SheetJS/xlsx, Apache ECharts, Zustand + Immer, `@tanstack/react-virtual`, Vitest + Testing Library, Playwright.
- MVP input: `.xls` / `.xlsx` upload only, first worksheet only. CSV, paste/manual entry, app-side data editing, and sheet picker are deferred.
- Parser preserves raw fluorescence values; no smoothing, normalization, baseline correction, log transform, averaging, or Ct/Cq calculation is applied.
- Default selection view is reagent-first. Import starts with all major groups collapsed. Selection identity is `curveId`; single-file parser IDs use `sheet0_col_<ExcelColumnLetter>`, and appended file IDs use an import prefix such as `file2_sheet0_col_A`.
- Search/display-filter bulk actions apply across the full dataset, including collapsed groups.
- Chart preview uses ECharts with white background, sparse major grid, no minor grid, animation off, `connectNulls: false`, and a fixed preview viewport height that does not stretch with side-panel expansion. On desktop the chart panel is sticky while the page scrolls.
- X/Y Auto, Fixed, and user-editable P1/P2 scale presets are implemented. P1/P2 have no invented default min/max values and become selectable only after valid numeric bounds are entered.
- Style controls include specimen/reagent group color with picker and HEX input, line type, stable default colors based on original data/group order, individual curve overrides, marker options, built-in presets, one-step preset undo, and user legend/export order.
- Export supports PNG/JPEG downloads, PNG clipboard copy with fallback message, and plotted-data CSV only for current rectangular common-X chart projections.
- GitHub Pages asset base is configured as `./` by default. The public GitHub Pages deployment is active at `https://siun-comp.github.io/isoamplar-plot-analysis/`.
- Browser tab/bookmark/PWA icon assets use the selected Option A amplification-curve icon.

## Current Goal
MVP implementation, requested IsoAmplar refinement passes, public GitHub Pages deployment, and selected app icon application are complete. Next work should focus on manual validation with the real workbook and clipboard verification in the deployed browser origin.

## Current Milestone
M8 - MVP release preparation complete locally, with post-MVP UI refinement applied.

## Last Completed Step
Completed the 2026-07-08 refinements: app rename to IsoAmplar Plot Analysis, developer credit, fixed/sticky plot viewport, stable default color assignment, editable P1/P2 scale presets, Fixed auto-bound display/copy, marker override options, append Excel upload, grouping-aware curve labels, tree row banding, compact settings/export sizing, public GitHub deployment, and Option A app icon application.

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
  - >20 visible-curve warning
  - stable default colors based on original specimen/reagent order rather than visible selection index
  - group style rules and individual curve overrides
  - color picker plus HEX color input for group and individual curve styles
  - default solid lines with no markers; optional individual markers: circle, triangle, rect
  - built-in presets with overwrite semantics and one-step undo
  - user legend/export order
  - curve labels in selection, chart, legend order, and CSV follow the active grouping mode
- Export:
  - PNG/JPEG image download with white background and `YYMMDD_plotN.ext`
  - PNG clipboard copy with fallback message
  - plotted-data CSV with `YYMMDD_plotN_data.csv` when common-X rectangular output is safe
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

## Verification Status
- `npm run test`: passed, 37 Vitest tests.
- `npm run build`: passed.
- `npm run test:e2e`: passed, 2 Chromium Playwright tests.
- `npm audit --omit=dev`: 0 vulnerabilities.
- GitHub Pages deployment: active at `https://siun-comp.github.io/isoamplar-plot-analysis/`.
- Playwright checks include upload-first smoke, generated `.xlsx` upload, append `.xlsx` import, reagent-first collapsed state, search bulk select, chart canvas visibility, nonwhite pixel count, chart viewport height stability after settings expansion, and sticky chart panel behavior.
- Visual screenshots:
  - `docs/gui_mockups/screenshots/phase8_mvp_desktop.png`
  - `docs/gui_mockups/screenshots/phase8_mvp_mobile.png`
  - `docs/gui_mockups/screenshots/isoamplar_refinement_desktop.png`
  - `docs/gui_mockups/screenshots/isoamplar_append_sticky_refinement.png`

## Known Gaps
- Clipboard image copy has not been manually verified in Chrome/Edge on the final deployment origin.
- Static fixture files and expected normalized JSON snapshots are still not checked in; tests currently generate workbook fixtures.
- Real `C:\Users\siunj\Desktop\graph_TEST.xlsx` has been inspected read-only but has not yet been uploaded through the finished UI in this session.
- Performance budgets for max file size, row count, specimen count, imported curve count, and rendered curve count remain undecided.
- P1/P2 scale presets are user-editable per analysis session but are not persisted after app reload/import reset.

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
1. Manually upload `C:\Users\siunj\Desktop\graph_TEST.xlsx` in the UI, append another workbook if available, and compare labels, curve count, warnings, chart, scale presets, marker options, and export output.
2. Verify clipboard PNG copy in Chrome/Edge under local preview and later GitHub Pages.
3. Decide whether P1/P2 presets, style presets, and chart configuration should be saved/reloaded across sessions.
