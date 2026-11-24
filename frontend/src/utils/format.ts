/**
 * Display-only ETB formatting. Numeric values remain plain numbers in state,
 * payloads and persistence; this helper never changes the stored value.
 */
export function formatEtb(value?: number | string | null): string {
  return `ETB ${formatEtbNumber(value)}`;
}

export function formatEtbNumber(value?: number | string | null): string {
  const numeric = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Parses a formatted ETB display value back into a number for storage/API use. */
export function parseEtb(value?: number | string | null): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const numeric = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(numeric) ? numeric : 0;
}
