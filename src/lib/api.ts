import { supabase } from './supabase';

export type PortfolioSummary = {
  id: string;
  name: string;
  description: string | null;
  inception_date: string;
  value_usd: number | null;
  perf_cumul: number | null;
  vol_30d: number | null;
  latestDate: string | null;
  initial_capital_usd: number;
};

// Open shape: 'date' + portfolio/benchmark keys + optional future keys (V1.5 'personnel')
export type ChartPoint = {
  date: string;
  defensif: number | null;
  dynamique: number | null;
  agressif: number | null;
  benchmark: number | null;
  [extra: string]: number | null | string;
};

export type HomepageData = {
  summaries: PortfolioSummary[];
  chartData: ChartPoint[];
};

export type HoldingRow = {
  ticker: string;
  name: string;
  category: string;
  quantity: number;
  adj_close: number;
  value_usd: number;
  current_weight: number;
  target_weight: number;
  perf_contribution: number;
};

export type DayReturn = {
  date: string;
  return: number;
};

export type PortfolioDetail = {
  id: string;
  name: string;
  description: string | null;
  inception_date: string;
  initial_capital_usd: number;
  latestSnapshot: {
    date: string;
    value_usd: number;
    perf_cumul: number;
    vol_30d: number | null;
    vol_90d: number | null;
    max_drawdown: number | null;
  } | null;
  chartData: { date: string; portfolio: number; benchmark: number | null }[];
  holdings: HoldingRow[];
  bestDay: DayReturn | null;
  worstDay: DayReturn | null;
};

const PORTFOLIO_IDS = ['defensif', 'dynamique', 'agressif'] as const;
const BENCHMARK_TICKER = 'QNTM.L';

export async function fetchHomepageData(): Promise<HomepageData> {
  const [portfoliosResult, ...latestSnapshotResults] = await Promise.all([
    supabase
      .from('portfolio')
      .select('id, name, description, initial_capital_usd, inception_date')
      .in('id', [...PORTFOLIO_IDS]),
    ...PORTFOLIO_IDS.map(id =>
      supabase
        .from('snapshot_daily')
        .select('portfolio_id, date, value_usd, perf_cumul, vol_30d')
        .eq('portfolio_id', id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()
    ),
  ]);

  const portfolios = portfoliosResult.data ?? [];

  const [allSnapshotsResult, benchmarkResult] = await Promise.all([
    supabase
      .from('snapshot_daily')
      .select('portfolio_id, date, value_usd')
      .in('portfolio_id', [...PORTFOLIO_IDS])
      .order('date', { ascending: true }),
    supabase
      .from('price_daily')
      .select('date, adj_close')
      .eq('ticker', BENCHMARK_TICKER)
      .order('date', { ascending: true }),
  ]);

  const allSnapshots = allSnapshotsResult.data ?? [];
  const benchmarkPrices = benchmarkResult.data ?? [];

  const summaries: PortfolioSummary[] = PORTFOLIO_IDS.map((id, i) => {
    const meta = portfolios.find(p => p.id === id);
    const snap = (latestSnapshotResults[i] as { data: { date: string; value_usd: number; perf_cumul: number; vol_30d: number | null } | null }).data;
    return {
      id,
      name: meta?.name ?? id,
      description: meta?.description ?? null,
      inception_date: meta?.inception_date ?? '',
      value_usd: snap?.value_usd ?? null,
      perf_cumul: snap?.perf_cumul ?? null,
      vol_30d: snap?.vol_30d ?? null,
      latestDate: snap?.date ?? null,
      initial_capital_usd: meta?.initial_capital_usd ?? 10000,
    };
  });

  // Build base-100 chart data
  const chartMap = new Map<string, ChartPoint>();

  for (const s of allSnapshots) {
    if (!chartMap.has(s.date)) {
      chartMap.set(s.date, { date: s.date, defensif: null, dynamique: null, agressif: null, benchmark: null });
    }
    const point = chartMap.get(s.date)!;
    const meta = portfolios.find(p => p.id === s.portfolio_id);
    const initial = meta?.initial_capital_usd ?? 10000;
    point[s.portfolio_id] = (s.value_usd / initial) * 100;
  }

  if (benchmarkPrices.length > 0) {
    const bFirst = benchmarkPrices[0].adj_close;
    for (const q of benchmarkPrices) {
      if (!chartMap.has(q.date)) {
        chartMap.set(q.date, { date: q.date, defensif: null, dynamique: null, agressif: null, benchmark: null });
      }
      chartMap.get(q.date)!.benchmark = (q.adj_close / bFirst) * 100;
    }
  }

  const chartData = Array.from(chartMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return { summaries, chartData };
}

type RawAsset = { name: string; category: string };

type RawPosition = {
  ticker: string;
  target_weight: number;
  quantity: number;
  // Supabase returns the joined row as an array when types aren't generated
  asset: RawAsset[] | RawAsset | null;
};

function resolveAsset(pos: RawPosition): RawAsset | null {
  if (!pos.asset) return null;
  return Array.isArray(pos.asset) ? (pos.asset[0] ?? null) : pos.asset;
}

export async function fetchPortfolioDetail(id: string): Promise<PortfolioDetail | null> {
  const { data: portfolio } = await supabase
    .from('portfolio')
    .select('id, name, description, inception_date, initial_capital_usd')
    .eq('id', id)
    .single();

  if (!portfolio) return null;

  const [snapshotsResult, positionsResult] = await Promise.all([
    supabase
      .from('snapshot_daily')
      .select('date, value_usd, perf_cumul, vol_30d, vol_90d, max_drawdown')
      .eq('portfolio_id', id)
      .order('date', { ascending: true }),
    supabase
      .from('position')
      .select('ticker, target_weight, quantity, asset(name, category)')
      .eq('portfolio_id', id),
  ]);

  const snapshots = snapshotsResult.data ?? [];
  const positions = (positionsResult.data ?? []) as unknown as RawPosition[];
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const firstDate = snapshots.length > 0 ? snapshots[0].date : portfolio.inception_date;
  const tickers = positions.map(p => p.ticker);

  const [latestPricesResult, inceptionPricesResult, benchmarkResult] = await Promise.all([
    latestSnapshot && tickers.length > 0
      ? supabase.from('price_daily').select('ticker, adj_close').eq('date', latestSnapshot.date).in('ticker', tickers)
      : Promise.resolve({ data: [] as { ticker: string; adj_close: number }[] }),
    tickers.length > 0
      ? supabase.from('price_daily').select('ticker, adj_close').eq('date', portfolio.inception_date).in('ticker', tickers)
      : Promise.resolve({ data: [] as { ticker: string; adj_close: number }[] }),
    supabase
      .from('price_daily')
      .select('date, adj_close')
      .eq('ticker', BENCHMARK_TICKER)
      .gte('date', firstDate)
      .order('date', { ascending: true }),
  ]);

  const latestPrices = new Map(((latestPricesResult as { data: { ticker: string; adj_close: number }[] | null }).data ?? []).map(p => [p.ticker, p.adj_close]));
  const inceptionPrices = new Map(((inceptionPricesResult as { data: { ticker: string; adj_close: number }[] | null }).data ?? []).map(p => [p.ticker, p.adj_close]));
  const benchmarkPrices = benchmarkResult.data ?? [];
  const bFirst = benchmarkPrices.length > 0 ? benchmarkPrices[0].adj_close : null;
  const bByDate = new Map(benchmarkPrices.map(q => [q.date, q.adj_close]));

  const totalValue = latestSnapshot?.value_usd ?? 0;
  const holdings: HoldingRow[] = positions
    .map(pos => {
      const price = latestPrices.get(pos.ticker) ?? 0;
      const inceptionPrice = inceptionPrices.get(pos.ticker) ?? 0;
      const value = pos.quantity * price;
      return {
        ticker: pos.ticker,
        name: resolveAsset(pos)?.name ?? pos.ticker,
        category: resolveAsset(pos)?.category ?? '',
        quantity: pos.quantity,
        adj_close: price,
        value_usd: value,
        current_weight: totalValue > 0 ? value / totalValue : 0,
        target_weight: pos.target_weight,
        perf_contribution:
          portfolio.initial_capital_usd > 0
            ? (pos.quantity * (price - inceptionPrice)) / portfolio.initial_capital_usd
            : 0,
      };
    })
    .sort((a, b) => b.value_usd - a.value_usd);

  const chartData = snapshots.map(s => ({
    date: s.date,
    portfolio: (s.value_usd / portfolio.initial_capital_usd) * 100,
    benchmark:
      bFirst != null && bByDate.has(s.date)
        ? (bByDate.get(s.date)! / bFirst) * 100
        : null,
  }));

  let bestDay: DayReturn | null = null;
  let worstDay: DayReturn | null = null;
  for (let i = 1; i < snapshots.length; i++) {
    const ret = (snapshots[i].value_usd - snapshots[i - 1].value_usd) / snapshots[i - 1].value_usd;
    const day: DayReturn = { date: snapshots[i].date, return: ret };
    if (!bestDay || ret > bestDay.return) bestDay = day;
    if (!worstDay || ret < worstDay.return) worstDay = day;
  }

  return {
    id: portfolio.id,
    name: portfolio.name,
    description: portfolio.description,
    inception_date: portfolio.inception_date,
    initial_capital_usd: portfolio.initial_capital_usd,
    latestSnapshot: latestSnapshot
      ? {
          date: latestSnapshot.date,
          value_usd: latestSnapshot.value_usd,
          perf_cumul: latestSnapshot.perf_cumul,
          vol_30d: latestSnapshot.vol_30d,
          vol_90d: latestSnapshot.vol_90d,
          max_drawdown: latestSnapshot.max_drawdown,
        }
      : null,
    chartData,
    holdings,
    bestDay,
    worstDay,
  };
}
