import { supabase } from './supabase';

// ─── Types communs ────────────────────────────────────────────────────────────

export type PortfolioSummary = {
  id: string;
  name: string;
  description: string | null;
  inception_date: string;
  value_usd: number | null;       // null pour le portefeuille personnel (public)
  perf_cumul: number | null;
  vol_30d: number | null;
  latestDate: string | null;
  initial_capital_usd: number;
  isPrivate: boolean;             // true → carte sans montant en dollars
};

export type ChartPoint = {
  date: string;
  defensif: number | null;
  dynamique: number | null;
  agressif: number | null;
  benchmark: number | null;
  personnel: number | null;
  nasdaq100: number | null;
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
  perf_since_inception: number | null;  // (prix actuel − prix inception) / prix inception
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

// ─── Types portefeuille personnel ─────────────────────────────────────────────

export type PersonnelPublicHolding = {
  ticker: string;
  name: string;
  account: string;                      // 'CTO' | 'PER'
  current_weight: number;               // pour le pie chart uniquement — ne pas afficher dans le tableau
  target_weight: number;                // pour le pie chart uniquement — ne pas afficher dans le tableau
  perf_since_inception: number | null;  // (prix actuel − prix au 1er juin) / prix au 1er juin — basé sur les prix, jamais sur le PRU
};

export type PersonnelPublicData = {
  inception_date: string;
  latestSnapshot: {
    date: string;
    perf_cumul: number;
    vol_30d: number | null;
    vol_90d: number | null;
    max_drawdown: number | null;
  } | null;
  chartData: { date: string; portfolio: number; benchmark: number | null }[];
  holdings: PersonnelPublicHolding[];
  bestDay: DayReturn | null;
  worstDay: DayReturn | null;
};

export type PersonnelPrivateHolding = {
  ticker: string;
  name: string;
  account: string;
  quantity: number;
  adj_close: number;
  value_usd: number;
  current_weight: number;
  avg_cost_usd: number | null;
  latent_gain: number | null;        // (adj_close − avg_cost_usd) × quantity = Plus-value ($)
  perf_since_purchase: number | null; // (adj_close − avg_cost_usd) / avg_cost_usd
};

export type PersonnelPrivateData = {
  total_value_usd: number;
  total_latent_gain: number | null;
  holdings: PersonnelPrivateHolding[];
};

// ─── Types market cap ─────────────────────────────────────────────────────────

export type MarketCapRow = {
  ticker: string;
  name: string;
  category: string;
  adj_close: number;
  price_date: string;
  shares: number;
  shares_date: string;
  shares_source: string;
  market_cap_usd: number;
  // Variations multi-horizons (S2), en jours de cotation — null si historique insuffisant
  change_1d: number | null;
  change_1w: number | null;
  change_1m: number | null;
  change_1y: number | null;          // calculé, non affiché en V1 (réservé infobulle/usage futur)
  change_1w_extreme: boolean;        // variation hebdo > ±150 % → marqueur de vérification (jamais masqué)
  // Ratio P/S (price-to-sales) — market_cap (USD) / CA TTM (USD). Calculé à la volée.
  ps_ratio: number | null;
  // Affichage à DEUX niveaux, marqueurs de nature distincte (ne pas confondre) :
  //   'firm'          → données fiables (4 trim. + devise convertie) → aucun marqueur
  //   'firm_extreme'  → fiable MAIS P/S > 200 → marqueur ⚠ « valorisation extrême »
  //   'partial'       → CA partiel (IPO récente, < 4 trim.) → marqueur ‡ (estimation)
  //   'unrecouped'    → CA non recoupé (détail trimestriel indisponible) → marqueur ‡
  //   'insignificant' → CA quasi nul, P/S aberrant → « n.s. »
  //   'none'          → CA indisponible / non calculable → « — »
  ps_status: 'firm' | 'firm_extreme' | 'partial' | 'unrecouped' | 'insignificant' | 'none';
};

export type MarketCapData = {
  rows: MarketCapRow[];
  pure_player_total_usd: number;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const FICTIF_IDS = ['defensif', 'dynamique', 'agressif'] as const;
const BENCHMARK_TICKER = 'QNTM.L';
const SECTORAL_TICKERS = ['GOOGL', 'IBM', 'IONQ', 'QBTS', 'LAES', 'INFQ', 'RGTI', 'QUBT', 'QNT', 'XNDU', 'ARQQ', 'HQ'] as const;

// Fenêtre de lecture par ticker pour les variations : 260 séances couvrent l'offset
// annuel (252) et restent SOUS le plafond PostgREST (1000 lignes/réponse). Une lecture
// par ticker, bornée, garantit qu'aucune donnée n'est tronquée silencieusement, quelle
// que soit la croissance de l'historique — cf. backfill_sectoral.py / check_changes.py.
const SECTORAL_WINDOW = 260;

// Seuil d'alerte sur la variation hebdomadaire — miroir de check_changes.py.
// Au-delà, on signale (⚑) sans masquer ; l'humain tranche vraie variation vs artefact.
const WEEKLY_ALERT_THRESHOLD = 1.5; // ±150 %

// Seuils P/S — miroir de check_ps.py.
// P/S > 200 sur données fiables → marqueur « valorisation extrême » (secteur pré-revenus).
const PS_EXTREME_THRESHOLD = 200;
// P/S > 5000 → non significatif (CA quasi nul), on n'affiche pas de ratio ferme.
const PS_INSIGNIFICANT_THRESHOLD = 5000;

// Variation sur `offset` séances depuis une série triée par date croissante. null si court.
function computeChange(closesAsc: number[], offset: number): number | null {
  if (closesAsc.length <= offset) return null;
  const last = closesAsc[closesAsc.length - 1];
  const past = closesAsc[closesAsc.length - 1 - offset];
  if (!past) return null;
  return last / past - 1;
}

// P/S = market cap (USD) / CA TTM (USD). Détermine aussi la fiabilité (statut à
// deux niveaux). Le CA est converti en USD via fx_rate (natif → USD) AVANT le ratio.
// CA de référence : le rapporté (totalRevenue) en priorité, sinon la somme des 4 trim.
function computePs(
  marketCapUsd: number,
  rev: { revenue_reported: number | null; revenue_sum_4q: number | null; quarters_used: number; fx_rate: number } | undefined,
): { ratio: number | null; status: MarketCapRow['ps_status'] } {
  if (!rev) return { ratio: null, status: 'none' };
  const fx = rev.fx_rate || 1;
  const reportedUsd = rev.revenue_reported != null ? rev.revenue_reported * fx : null;
  const sum4qUsd = rev.revenue_sum_4q != null ? rev.revenue_sum_4q * fx : null;
  const revUsd = reportedUsd ?? sum4qUsd;
  if (revUsd == null || revUsd <= 0) return { ratio: null, status: 'none' };

  const ratio = marketCapUsd / revUsd;
  if (ratio > PS_INSIGNIFICANT_THRESHOLD) return { ratio, status: 'insignificant' };
  if (rev.quarters_used >= 4) {
    return { ratio, status: ratio > PS_EXTREME_THRESHOLD ? 'firm_extreme' : 'firm' };
  }
  if (rev.quarters_used >= 1) return { ratio, status: 'partial' };
  return { ratio, status: 'unrecouped' }; // CA rapporté mais aucun détail trimestriel
}

// ─── Homepage ─────────────────────────────────────────────────────────────────

export async function fetchHomepageData(): Promise<HomepageData> {
  const ALL_IDS = [...FICTIF_IDS, 'personnel'] as const;

  const [portfoliosResult, ...latestSnapshotResults] = await Promise.all([
    supabase
      .from('portfolio')
      .select('id, name, description, initial_capital_usd, inception_date, type')
      .in('id', [...ALL_IDS]),
    ...ALL_IDS.map(id =>
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

  const [allSnapshotsResult, benchmarkResult, nasdaqResult] = await Promise.all([
    supabase
      .from('snapshot_daily')
      .select('portfolio_id, date, value_usd')
      .in('portfolio_id', [...ALL_IDS])
      .order('date', { ascending: true }),
    supabase
      .from('price_daily')
      .select('date, adj_close')
      .eq('ticker', BENCHMARK_TICKER)
      .order('date', { ascending: true }),
    supabase
      .from('price_daily')
      .select('date, adj_close')
      .eq('ticker', 'QQQ')
      .order('date', { ascending: true }),
  ]);

  const allSnapshots = allSnapshotsResult.data ?? [];
  const benchmarkPrices = benchmarkResult.data ?? [];
  const nasdaqPrices = nasdaqResult.data ?? [];

  const summaries: PortfolioSummary[] = ALL_IDS.map((id, i) => {
    const meta = portfolios.find(p => p.id === id);
    const snap = (latestSnapshotResults[i] as { data: { date: string; value_usd: number; perf_cumul: number; vol_30d: number | null } | null }).data;
    const isPersonnel = id === 'personnel';
    return {
      id,
      name: meta?.name ?? id,
      description: meta?.description ?? null,
      inception_date: meta?.inception_date ?? '',
      // Montant absolu jamais exposé pour le portefeuille personnel
      value_usd: isPersonnel ? null : (snap?.value_usd ?? null),
      perf_cumul: snap?.perf_cumul ?? null,
      vol_30d: snap?.vol_30d ?? null,
      latestDate: snap?.date ?? null,
      initial_capital_usd: isPersonnel ? 0 : (meta?.initial_capital_usd ?? 10000),
      isPrivate: isPersonnel,
    };
  });

  // Graphique base-100 — calcul côté serveur, initial_capital_usd non exposé
  const chartMap = new Map<string, ChartPoint>();

  const emptyPoint = (): ChartPoint => ({
    date: '', defensif: null, dynamique: null, agressif: null,
    benchmark: null, personnel: null, nasdaq100: null,
  });

  for (const s of allSnapshots) {
    if (!chartMap.has(s.date)) {
      chartMap.set(s.date, { ...emptyPoint(), date: s.date });
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
        chartMap.set(q.date, { ...emptyPoint(), date: q.date });
      }
      chartMap.get(q.date)!.benchmark = (q.adj_close / bFirst) * 100;
    }
  }

  if (nasdaqPrices.length > 0) {
    const nFirst = nasdaqPrices[0].adj_close;
    for (const q of nasdaqPrices) {
      if (!chartMap.has(q.date)) {
        chartMap.set(q.date, { ...emptyPoint(), date: q.date });
      }
      chartMap.get(q.date)!.nasdaq100 = (q.adj_close / nFirst) * 100;
    }
  }

  const chartData = Array.from(chartMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return { summaries, chartData };
}

// ─── Détail portefeuille fictif ───────────────────────────────────────────────

type RawAsset = { name: string; category: string };

type RawPosition = {
  ticker: string;
  target_weight: number;
  quantity: number;
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
      const inceptionPrice = inceptionPrices.get(pos.ticker) ?? null;
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
        perf_since_inception:
          inceptionPrice != null && inceptionPrice > 0
            ? (price - inceptionPrice) / inceptionPrice
            : null,
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

// ─── Portefeuille personnel — données publiques ───────────────────────────────

type RawPersonnelPosition = {
  ticker: string;
  account: string;
  target_weight: number;
  quantity: number;
  avg_cost_usd: number | null;
  asset: RawAsset[] | RawAsset | null;
};

function resolvePersonnelAsset(pos: RawPersonnelPosition): RawAsset | null {
  if (!pos.asset) return null;
  return Array.isArray(pos.asset) ? (pos.asset[0] ?? null) : pos.asset;
}

export async function fetchPersonnelPublicData(): Promise<PersonnelPublicData | null> {
  const { data: portfolio } = await supabase
    .from('portfolio')
    .select('id, inception_date, initial_capital_usd')
    .eq('id', 'personnel')
    .single();

  if (!portfolio) return null;

  const [snapshotsResult, positionsResult] = await Promise.all([
    supabase
      .from('snapshot_daily')
      .select('date, value_usd, perf_cumul, vol_30d, vol_90d, max_drawdown')
      .eq('portfolio_id', 'personnel')
      .order('date', { ascending: true }),
    supabase
      .from('position')
      .select('ticker, account, target_weight, quantity, avg_cost_usd, asset(name, category)')
      .eq('portfolio_id', 'personnel'),
  ]);

  const snapshots = snapshotsResult.data ?? [];
  const rawPositions = (positionsResult.data ?? []) as unknown as RawPersonnelPosition[];
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const firstDate = snapshots.length > 0 ? snapshots[0].date : portfolio.inception_date;

  const tickers = [...new Set(rawPositions.map(p => p.ticker))];
  const [latestPricesResult, inceptionPricesResult] = await Promise.all([
    latestSnapshot && tickers.length > 0
      ? supabase.from('price_daily').select('ticker, adj_close').eq('date', latestSnapshot.date).in('ticker', tickers)
      : Promise.resolve({ data: [] as { ticker: string; adj_close: number }[] }),
    tickers.length > 0
      ? supabase.from('price_daily').select('ticker, adj_close').eq('date', portfolio.inception_date).in('ticker', tickers)
      : Promise.resolve({ data: [] as { ticker: string; adj_close: number }[] }),
  ]);

  const latestPrices = new Map(((latestPricesResult as { data: { ticker: string; adj_close: number }[] | null }).data ?? []).map(p => [p.ticker, p.adj_close]));
  const inceptionPrices = new Map(((inceptionPricesResult as { data: { ticker: string; adj_close: number }[] | null }).data ?? []).map(p => [p.ticker, p.adj_close]));

  const totalValue = latestSnapshot?.value_usd ?? 0;

  const holdings: PersonnelPublicHolding[] = rawPositions
    .map(pos => {
      const price = latestPrices.get(pos.ticker) ?? 0;
      const value = pos.quantity * price;
      const inceptionPrice = inceptionPrices.get(pos.ticker) ?? null;
      return {
        ticker: pos.ticker,
        name: resolvePersonnelAsset(pos)?.name ?? pos.ticker,
        account: pos.account,
        current_weight: totalValue > 0 ? value / totalValue : 0,
        target_weight: pos.target_weight,
        perf_since_inception:
          inceptionPrice != null && inceptionPrice > 0
            ? (price - inceptionPrice) / inceptionPrice
            : null,
      };
    })
    .sort((a, b) => (b.perf_since_inception ?? -Infinity) - (a.perf_since_inception ?? -Infinity));

  // Benchmark depuis la même date de début que les snapshots
  const benchmarkResult = await supabase
    .from('price_daily')
    .select('date, adj_close')
    .eq('ticker', BENCHMARK_TICKER)
    .gte('date', firstDate)
    .order('date', { ascending: true });

  const benchmarkPrices = benchmarkResult.data ?? [];
  const bFirst = benchmarkPrices.length > 0 ? benchmarkPrices[0].adj_close : null;
  const bByDate = new Map(benchmarkPrices.map(q => [q.date, q.adj_close]));

  // Graphique base-100 — initial_capital_usd utilisé en interne, non exposé
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
    inception_date: portfolio.inception_date,
    latestSnapshot: latestSnapshot
      ? {
          date: latestSnapshot.date,
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

// ─── Market caps sectorielles ─────────────────────────────────────────────────

export async function fetchMarketCapsData(): Promise<MarketCapData | null> {
  const [assetsRes, sharesRes] = await Promise.all([
    supabase
      .from('asset')
      .select('ticker, name, category')
      .in('ticker', [...SECTORAL_TICKERS]),
    supabase
      .from('shares_outstanding')
      .select('ticker, shares, as_of_date, source')
      .in('ticker', [...SECTORAL_TICKERS])
      .order('as_of_date', { ascending: false }),
  ]);

  if (assetsRes.error || sharesRes.error) return null;

  // CA TTM (revenue_ttm) — table optionnelle (migration 007). Si absente ou vide,
  // le P/S retombe proprement sur 'none' sans casser le tableau des capitalisations.
  const revenueRes = await supabase
    .from('revenue_ttm')
    .select('ticker, as_of_date, revenue_reported, revenue_sum_4q, quarters_used, fx_rate')
    .in('ticker', [...SECTORAL_TICKERS])
    .order('as_of_date', { ascending: false });

  // Dernière ligne par ticker (surcharge manuelle SEC prime via as_of_date DESC)
  const latestRevenue = new Map<string, {
    revenue_reported: number | null;
    revenue_sum_4q: number | null;
    quarters_used: number;
    fx_rate: number;
  }>();
  if (!revenueRes.error) {
    for (const row of revenueRes.data ?? []) {
      if (!latestRevenue.has(row.ticker)) {
        latestRevenue.set(row.ticker, {
          revenue_reported: row.revenue_reported != null ? Number(row.revenue_reported) : null,
          revenue_sum_4q: row.revenue_sum_4q != null ? Number(row.revenue_sum_4q) : null,
          quarters_used: Number(row.quarters_used),
          fx_rate: row.fx_rate != null ? Number(row.fx_rate) : 1,
        });
      }
    }
  }

  // Prix : une requête bornée PAR ticker (≤ 260 lignes) — jamais tronqué par le
  // plafond PostgREST de 1000 lignes/réponse (≠ un .in() global qui le dépasserait).
  const priceResults = await Promise.all(
    SECTORAL_TICKERS.map(ticker =>
      supabase
        .from('price_daily')
        .select('adj_close, date')
        .eq('ticker', ticker)
        .order('date', { ascending: false })
        .limit(SECTORAL_WINDOW)
    )
  );

  // Séries triées par date CROISSANTE par ticker (pour le calcul des offsets)
  const closesByTicker = new Map<string, { date: string; adj_close: number }[]>();
  SECTORAL_TICKERS.forEach((ticker, i) => {
    const res = priceResults[i];
    if (res.error || !res.data) { closesByTicker.set(ticker, []); return; }
    closesByTicker.set(
      ticker,
      [...res.data].reverse().map(r => ({ date: r.date, adj_close: Number(r.adj_close) })),
    );
  });

  // Dernière ligne par ticker (ORDER BY DESC → premier occurrence = la plus récente)
  const latestShares = new Map<string, { shares: number; date: string; source: string }>();
  for (const row of sharesRes.data ?? []) {
    if (!latestShares.has(row.ticker)) {
      latestShares.set(row.ticker, {
        shares: Number(row.shares),
        date: row.as_of_date,
        source: row.source,
      });
    }
  }

  const rows: MarketCapRow[] = [];
  for (const asset of assetsRes.data ?? []) {
    const shares = latestShares.get(asset.ticker);
    const series = closesByTicker.get(asset.ticker) ?? [];
    if (!shares || series.length === 0) continue;

    const closesAsc = series.map(s => s.adj_close);
    const latest = series[series.length - 1];
    const change_1w = computeChange(closesAsc, 5);
    const market_cap_usd = shares.shares * latest.adj_close;
    const ps = computePs(market_cap_usd, latestRevenue.get(asset.ticker));

    rows.push({
      ticker: asset.ticker,
      name: asset.name,
      category: asset.category,
      adj_close: latest.adj_close,
      price_date: latest.date,
      shares: shares.shares,
      shares_date: shares.date,
      shares_source: shares.source,
      market_cap_usd,
      change_1d: computeChange(closesAsc, 1),
      change_1w,
      change_1m: computeChange(closesAsc, 21),
      change_1y: computeChange(closesAsc, 252),
      change_1w_extreme: change_1w !== null && Math.abs(change_1w) > WEEKLY_ALERT_THRESHOLD,
      ps_ratio: ps.ratio,
      ps_status: ps.status,
    });
  }

  rows.sort((a, b) => b.market_cap_usd - a.market_cap_usd);

  const pure_player_total_usd = rows
    .filter(r => r.category === 'pure_player')
    .reduce((sum, r) => sum + r.market_cap_usd, 0);

  return { rows, pure_player_total_usd };
}

// ─── Portefeuille personnel — données privées (nécessite auth) ────────────────

export async function fetchPersonnelPrivateData(): Promise<PersonnelPrivateData | null> {
  const { data: portfolio } = await supabase
    .from('portfolio')
    .select('inception_date, initial_capital_usd')
    .eq('id', 'personnel')
    .single();

  if (!portfolio) return null;

  const snapshotResult = await supabase
    .from('snapshot_daily')
    .select('date, value_usd')
    .eq('portfolio_id', 'personnel')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestSnapshot = snapshotResult.data;

  const positionsResult = await supabase
    .from('position')
    .select('ticker, account, quantity, avg_cost_usd, asset(name, category)')
    .eq('portfolio_id', 'personnel');

  const rawPositions = (positionsResult.data ?? []) as unknown as RawPersonnelPosition[];
  const tickers = [...new Set(rawPositions.map(p => p.ticker))];

  if (!latestSnapshot || tickers.length === 0) {
    return { total_value_usd: 0, total_latent_gain: null, holdings: [] };
  }

  const pricesResult = await supabase
    .from('price_daily')
    .select('ticker, adj_close')
    .eq('date', latestSnapshot.date)
    .in('ticker', tickers);

  const prices = new Map(((pricesResult as { data: { ticker: string; adj_close: number }[] | null }).data ?? []).map(p => [p.ticker, p.adj_close]));
  const totalValue = latestSnapshot.value_usd;

  let totalLatentGain: number | null = null;

  const holdings: PersonnelPrivateHolding[] = rawPositions
    .map(pos => {
      const price = prices.get(pos.ticker) ?? 0;
      const value = pos.quantity * price;
      const latentGain = pos.avg_cost_usd != null
        ? (price - pos.avg_cost_usd) * pos.quantity
        : null;
      if (latentGain != null) {
        totalLatentGain = (totalLatentGain ?? 0) + latentGain;
      }
      const perfSincePurchase = pos.avg_cost_usd != null && pos.avg_cost_usd > 0
        ? (price - pos.avg_cost_usd) / pos.avg_cost_usd
        : null;
      return {
        ticker: pos.ticker,
        name: resolvePersonnelAsset(pos)?.name ?? pos.ticker,
        account: pos.account,
        quantity: pos.quantity,
        adj_close: price,
        value_usd: value,
        current_weight: totalValue > 0 ? value / totalValue : 0,
        avg_cost_usd: pos.avg_cost_usd,
        latent_gain: latentGain,
        perf_since_purchase: perfSincePurchase,
      };
    })
    .sort((a, b) => b.value_usd - a.value_usd);

  return { total_value_usd: totalValue, total_latent_gain: totalLatentGain, holdings };
}
