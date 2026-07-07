# IsoAmplar Plot Analysis

Browser-based amplification fluorescence plot analysis tool for IsoAmplar/LAMP result review.

## Features

- `.xls` and `.xlsx` Excel upload, first worksheet only.
- Optional append upload for adding another workbook to the current analysis.
- Reagent-first and specimen-first curve selection views.
- Stable curve selection by `curveId`.
- Clean ECharts line plot preview with fixed/sticky desktop chart panel.
- Auto, Fixed, and user-defined P1/P2 X/Y scale modes.
- Group and individual curve style controls with color picker and HEX input.
- Optional individual markers: none, circle, triangle, rect.
- User-controlled legend/export order.
- PNG/JPEG export, PNG clipboard copy, and conditional plotted-data CSV export.
- Browser tab, bookmark, Apple touch, and PWA/taskbar icons.

## Privacy

Uploaded Excel data is processed in the browser. The app does not require a backend and does not upload workbook contents to a server.

## Development

```bash
npm ci
npm run dev
```

## Verification

```bash
npm run test
npm run build
npm run test:e2e
```

## Deployment

The repository includes a GitHub Actions workflow that builds the app and deploys `dist/` to GitHub Pages on pushes to `main`.

Public app: https://siun-comp.github.io/isoamplar-plot-analysis/
