const mcapFmt1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const mcapFmt0 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const compactDateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const usdFmt = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pctFmt = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const shortDateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});

export function formatUSD(value: number | null | undefined): string {
  if (value == null) return '—';
  return usdFmt.format(value);
}

export function formatPct(value: number | null | undefined): string {
  if (value == null) return '—';
  return pctFmt.format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  // Parse as UTC date (YYYY-MM-DD) to avoid timezone offset shifting the day
  const [y, m, d] = value.split('-').map(Number);
  return dateFmt.format(new Date(y, m - 1, d));
}

export function formatShortDate(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return shortDateFmt.format(new Date(y, m - 1, d));
}

export function formatMarketCap(usd: number): string {
  if (usd >= 1e12) return `${mcapFmt1.format(usd / 1e12)} T$`;
  if (usd >= 1e9)  return `${mcapFmt1.format(usd / 1e9)} Md$`;
  return `${mcapFmt0.format(usd / 1e6)} M$`;
}

export function formatDateCompact(value: string): string {
  if (!value) return '—';
  const [y, m, d] = value.split('-').map(Number);
  return compactDateFmt.format(new Date(y, m - 1, d));
}

export function formatQty(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}
