# IsoAmplar Plot Analysis

Desktop browser tool for reviewing and exporting IsoAmplar/LAMP amplification fluorescence plots. It is a static React application deployed on GitHub Pages; imported data is processed in the browser.

This tool is for research and kit-development visualization. It does not perform clinical interpretation, positive/negative classification, or Ct/Cq calculation.

## Current Capabilities

- Open `.xls` / `.xlsx` files and use the first worksheet only.
- Enter a specimen once for consecutive reagent columns; later blank specimen cells inherit the nearest specimen to their left within that source.
- Append another Excel workbook without changing existing selection or settings.
- Quick Paste Import for tab-separated or single-column comparison data, with read-only preview and warnings.
- Reagent-first or specimen-first selection, full-dataset search, and stable `curveId` identity.
- ECharts plot preview with Auto, Fixed, P1/P2, Box zoom, Previous scale, and raw point readout.
- Specimen/reagent group styles, per-curve overrides, HEX colors, line types, and markers.
- User-controlled legend order, Analysis labels, Auto compact labels, and separate plot/legend outputs.
- PNG/JPEG download, PNG clipboard copy with fallback, rich Excel legend clipboard, Selected Data XLSX, and secondary conditional plotted-data CSV.
- Named Selection Sets for switching recurring curve combinations without changing scale, style, labels, or order.
- Multiple analysis tabs and Analysis XLSX schema 4 save/restore containing the complete imported dataset, settings, and Selection Sets.

The app does not smooth, normalize, baseline-correct, log-transform, average, interpolate, or calculate threshold/Ct/Cq from fluorescence data.

## Input Contract

Excel columns represent curves:

1. Row 1: specimen or experimental condition
2. Row 2: reagent or assay/channel
3. Row 3 onward: fluorescence values in cycle order

The first usable curve column must contain a specimen label. A truly blank later specimen cell means "same specimen as the nearest explicit label to the left". This shorthand applies only inside the current workbook or full-table paste; reagent labels never inherit.

Quick Paste accepts Excel-style tab-separated ranges and delimiter-free single columns. CSV files, comma-separated tables, in-app source editing, custom X/cycle columns, and worksheet selection are not supported.

## Privacy

The production app has no backend requirement. Release browser tests allow only known static app `GET/HEAD` requests plus local `blob:` / `data:` output and fail on same-origin writes, cross-origin requests, or WebSockets. Exported files remain under the user's control.

## Development

```bash
npm ci
npm run dev
```

Local development: `http://127.0.0.1:5173/`

## Verification

```bash
npm run check:diff
npm run test
npm run test:audit
npm audit --omit=dev --audit-level=high
npm run build
npm run test:e2e
```

Playwright starts a fresh production preview on port `4174` and never reuses an existing server. CI builds once for `/isoamplar-plot-analysis/`, records the complete `dist` SHA-256 manifest, runs fresh Chromium, and rejects any pre/post-test byte difference.

## Deployment

Pushes to `main` and manual workflow dispatch run the verified GitHub Pages workflow. The build job is read-only; only the deploy job receives Pages/OIDC write permissions.

Public app: https://siun-comp.github.io/isoamplar-plot-analysis/

Developer: Jang Si Un
