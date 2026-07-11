export type FiniteRange = {
  min: number;
  max: number;
  count: number;
};

export function getFiniteRange(values: Iterable<number | null | undefined>): FiniteRange | null {
  let min = Infinity;
  let max = -Infinity;
  let count = 0;

  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
    count += 1;
  }

  return count > 0 ? { min, max, count } : null;
}
