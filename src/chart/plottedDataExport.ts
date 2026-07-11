import type { Curve, CurveStyleOverride, GroupingMode, StyleRules } from "../data/types";
import { formatCurveSourceSuffix } from "../data/curveLabels";
import { createDefaultStyleRules, resolveCurveStyle } from "./chartStyle";

export type PlottedDataCsvResult =
  | { ok: true; csv: string }
  | { ok: false; reason: string };

export function createPlottedDataCsv(args: {
  curves: Curve[];
  labelMode?: GroupingMode;
  styleRules?: StyleRules;
  curveOverrides?: Record<string, CurveStyleOverride>;
}): PlottedDataCsvResult {
  const { curves } = args;
  if (curves.length === 0) {
    return { ok: false, reason: "No visible curves are selected." };
  }

  const referenceX = curves[0].x;
  const hasCommonX = curves.every(
    (curve) => curve.x.length === referenceX.length && curve.x.every((value, index) => value === referenceX[index])
  );

  if (!hasCommonX) {
    return { ok: false, reason: "Selected curves do not share one rectangular X axis." };
  }

  const styleRules = args.styleRules ?? createDefaultStyleRules();
  const headers = createSpreadsheetSafeHeaders(
    createUniqueHeaders(curves, styleRules, args.curveOverrides ?? {}, args.labelMode)
  );
  const lines = [["Cycle"].concat(headers).map(csvEscape).join(",")];
  for (let rowIndex = 0; rowIndex < referenceX.length; rowIndex += 1) {
    const cells = [String(referenceX[rowIndex])];
    for (const curve of curves) {
      const value = curve.y[rowIndex];
      cells.push(typeof value === "number" && Number.isFinite(value) ? String(value) : "");
    }
    lines.push(cells.map(csvEscape).join(","));
  }

  return {
    ok: true,
    csv: lines.join("\r\n")
  };
}

function createUniqueHeaders(
  curves: Curve[],
  styleRules: StyleRules,
  curveOverrides: Record<string, CurveStyleOverride>,
  labelMode?: GroupingMode
) {
  const names = curves.map((curve, index) =>
    resolveCurveStyle({
      curve,
      index,
      labelMode,
      styleRules,
      override: curveOverrides[curve.curveId]
    }).displayName
  );
  const counts = new Map<string, number>();
  names.forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1));

  return names.map((name, index) => ((counts.get(name) ?? 0) > 1 ? `${name} [${formatCurveSourceSuffix(curves[index])}]` : name));
}

function csvEscape(value: string) {
  if (!/[",\r\n]/u.test(value)) return value;
  return `"${value.replace(/"/gu, '""')}"`;
}

function createSpreadsheetSafeHeaders(headers: string[]) {
  const used = new Set<string>();
  return headers.map((header) => {
    const safeHeader = /^[=+\-@]/u.test(header) ? `'${header}` : header;
    let candidate = safeHeader;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${safeHeader} [${suffix}]`;
      suffix += 1;
    }
    used.add(candidate);
    return candidate;
  });
}
