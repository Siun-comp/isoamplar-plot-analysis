import { useState } from "react";
import type { LegendItem } from "../chart/chartProjection";
import type { LineType, MarkerType } from "../data/types";

export function CustomLegend({ items }: { items: LegendItem[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = normalizedQuery
    ? items.filter((item) => item.label.toLowerCase().includes(normalizedQuery))
    : items;

  return (
    <section className="custom-legend" aria-label="Custom legend">
      <div className="custom-legend-header">
        <strong>Legend</strong>
        <span>{items.length} curves</span>
      </div>
      {items.length > 12 && (
        <input
          className="legend-search"
          type="search"
          aria-label="Legend search"
          placeholder="Search legend"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      )}
      <ul className="custom-legend-list">
        {visibleItems.map((item) => (
          <li className="custom-legend-item" key={item.curveId}>
            <LegendSample item={item} />
            <span title={item.label}>{item.label}</span>
          </li>
        ))}
      </ul>
      {visibleItems.length === 0 && <p>표시할 legend가 없습니다.</p>}
    </section>
  );
}

function LegendSample({ item }: { item: LegendItem }) {
  return (
    <svg
      className="legend-sample"
      viewBox="0 0 64 20"
      aria-hidden="true"
      data-line-type={item.lineType}
      data-marker-type={item.markerType}
    >
      <line
        x1="4"
        y1="10"
        x2="60"
        y2="10"
        stroke={item.color}
        strokeWidth={Math.max(2, item.lineWidth)}
        strokeLinecap={item.lineType === "dotted" ? "round" : "butt"}
        strokeDasharray={getStrokeDashArray(item.lineType)}
      />
      <LegendMarker markerType={item.markerType} color={item.color} />
    </svg>
  );
}

function LegendMarker({ markerType, color }: { markerType: MarkerType; color: string }) {
  if (markerType === "none") return null;
  if (markerType === "circle") {
    return <circle cx="32" cy="10" r="4.2" fill={color} data-marker-symbol="circle" />;
  }
  if (markerType === "triangle") {
    return <polygon points="32,5 37,15 27,15" fill={color} data-marker-symbol="triangle" />;
  }
  return <rect x="28" y="6" width="8" height="8" fill={color} data-marker-symbol="rect" />;
}

function getStrokeDashArray(lineType: LineType) {
  if (lineType === "dashed") return "8 5";
  if (lineType === "dotted") return "1 5";
  return undefined;
}
