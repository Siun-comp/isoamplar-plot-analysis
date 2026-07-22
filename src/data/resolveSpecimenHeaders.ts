export type SpecimenHeaderEntry = {
  columnIndex: number;
  label: string;
  canInherit: boolean;
};

export type ResolvedSpecimenHeader = {
  columnIndex: number;
  label: string;
  inheritedFromColumnIndex?: number;
};

export type ResolveSpecimenHeadersResult =
  | { ok: true; headers: ResolvedSpecimenHeader[] }
  | { ok: false; missingColumnIndex: number };

export function resolveSpecimenHeaders(entries: readonly SpecimenHeaderEntry[]): ResolveSpecimenHeadersResult {
  if (entries.length === 0) return { ok: true, headers: [] };

  const first = entries[0];
  if (!first.label.trim()) return { ok: false, missingColumnIndex: first.columnIndex };

  let currentLabel = first.label;
  let currentSourceColumnIndex = first.columnIndex;
  const headers: ResolvedSpecimenHeader[] = [{ columnIndex: first.columnIndex, label: first.label }];

  for (let index = 1; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.label.trim()) {
      currentLabel = entry.label;
      currentSourceColumnIndex = entry.columnIndex;
      headers.push({ columnIndex: entry.columnIndex, label: entry.label });
      continue;
    }

    if (entry.canInherit) {
      headers.push({
        columnIndex: entry.columnIndex,
        label: currentLabel,
        inheritedFromColumnIndex: currentSourceColumnIndex
      });
      continue;
    }

    headers.push({ columnIndex: entry.columnIndex, label: entry.label });
  }

  return { ok: true, headers };
}
