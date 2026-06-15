import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Metadata } from 'next';
import { fetchPersonnelPublicData, fetchPersonnelPrivateData } from '@/lib/api';
import { formatUSD, formatPct, formatDate } from '@/lib/format';
import Disclaimer from '@/components/Disclaimer';
import DetailChart from '@/components/DetailChart';
import AllocationPie from '@/components/AllocationPie';

// Jamais mis en cache — contenu différent selon l'état d'authentification
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Mon portefeuille — L'Investisseuse Quantique",
};

const ACCOUNT_LABELS: Record<string, string> = { CTO: 'CTO', PER: 'PER', NONE: '—' };
const CATEGORY_LABELS: Record<string, string> = {
  geant: 'Géant', infrastructure: 'Infrastructure', pure_player: 'Pure-player', etf: 'ETF',
};

async function signOut() {
  'use server';
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
  await supabase.auth.signOut();
  redirect('/');
}

export default async function PersonnelPage() {
  // Vérification de la session côté serveur
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
  const { data: { user } } = await authClient.auth.getUser();
  const isAuthenticated = !!user;

  // Données publiques toujours chargées
  const publicData = await fetchPersonnelPublicData();
  if (!publicData) notFound();

  // Données privées uniquement si authentifiée
  const privateData = isAuthenticated ? await fetchPersonnelPrivateData() : null;

  const snap = publicData.latestSnapshot;

  // Pie chart — allocation consolidée (GOOGL CTO + PER agrégés)
  const consolidatedMap = new Map<string, { name: string; weight: number }>();
  for (const h of publicData.holdings) {
    const entry = consolidatedMap.get(h.ticker);
    if (entry) {
      entry.weight += h.current_weight;
    } else {
      consolidatedMap.set(h.ticker, { name: h.name, weight: h.current_weight });
    }
  }
  const consolidatedInceptionMap = new Map<string, { name: string; weight: number }>();
  for (const h of publicData.holdings) {
    const entry = consolidatedInceptionMap.get(h.ticker);
    if (entry) {
      entry.weight += h.target_weight;
    } else {
      consolidatedInceptionMap.set(h.ticker, { name: h.name, weight: h.target_weight });
    }
  }
  const currentPie = Array.from(consolidatedMap.entries()).map(([ticker, v]) => ({
    ticker, name: v.name, weight: v.weight,
  }));
  const inceptionPie = Array.from(consolidatedInceptionMap.entries()).map(([ticker, v]) => ({
    ticker, name: v.name, weight: v.weight,
  }));

  return (
    <main className="page">
      <Disclaimer />

      <a href="/" className="detail-back">← Tous les portefeuilles</a>

      <div className="detail-header">
        <span className="card-badge badge-personnel">Personnel</span>
        <h1 className="detail-title" style={{ marginTop: '0.75rem' }}>Mon portefeuille</h1>
        <p className="detail-description">Portefeuille personnel — données privées masquées en public.</p>
        {snap && (
          <p className="detail-description" style={{ marginTop: '0.25rem' }}>
            Au {formatDate(snap.date)} · Depuis le {formatDate(publicData.inception_date)}
          </p>
        )}
      </div>

      {/* Indicateurs relatifs — toujours publics */}
      <section aria-label="Indicateurs clés">
        <div className="stats-grid">
          <div className="stat-box">
            <span className="stat-label">Perf. depuis le {formatDate(publicData.inception_date)}</span>
            <span className={`stat-value mono ${snap && snap.perf_cumul >= 0 ? 'positive' : snap ? 'negative' : ''}`}>
              {formatPct(snap?.perf_cumul)}
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Vol. 30j (ann.)</span>
            <span className="stat-value mono">{formatPct(snap?.vol_30d)}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Vol. 90j (ann.)</span>
            <span className="stat-value mono">{formatPct(snap?.vol_90d)}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Max drawdown</span>
            <span className="stat-value mono negative">{formatPct(snap?.max_drawdown)}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Meilleur jour</span>
            <span className="stat-value mono positive">
              {publicData.bestDay ? formatPct(publicData.bestDay.return) : '—'}
            </span>
            {publicData.bestDay && (
              <span className="stat-label" style={{ marginTop: '0.2rem' }}>
                {formatDate(publicData.bestDay.date)}
              </span>
            )}
          </div>
          <div className="stat-box">
            <span className="stat-label">Pire jour</span>
            <span className="stat-value mono negative">
              {publicData.worstDay ? formatPct(publicData.worstDay.return) : '—'}
            </span>
            {publicData.worstDay && (
              <span className="stat-label" style={{ marginTop: '0.2rem' }}>
                {formatDate(publicData.worstDay.date)}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Bloc PV latente — uniquement si authentifiée, absent du HTML en public */}
      {isAuthenticated && privateData && (
        <section className="section" aria-label="PV latente avant suivi">
          <h2 className="section-title">PV latente avant suivi (contexte statique)</h2>
          <div className="private-banner">
            <div className="private-banner-row">
              <span className="private-banner-label">Valeur actuelle du portefeuille</span>
              <span className="private-banner-value mono">{formatUSD(privateData.total_value_usd)}</span>
            </div>
            <div className="private-banner-row">
              <span className="private-banner-label">PV latente depuis achat (tous PRU confondus)</span>
              <span className={`private-banner-value mono ${privateData.total_latent_gain == null ? '' : privateData.total_latent_gain >= 0 ? 'positive' : 'negative'}`}>
                {formatUSD(privateData.total_latent_gain)}
              </span>
            </div>
            <p className="private-banner-note">
              Calculée depuis vos PRU historiques — contexte antérieur au suivi démarré le {formatDate(publicData.inception_date)}.
              Cette valeur n&apos;est pas suivie dans le temps.
            </p>
          </div>
        </section>
      )}

      {/* Graphique base-100 */}
      <section className="section" aria-label="Évolution vs benchmark">
        <h2 className="section-title">Évolution — base 100 vs VanEck UCITS</h2>
        <div className="chart-container">
          <DetailChart
            data={publicData.chartData}
            portfolioLabel="Mon portefeuille"
            portfolioColor="#FF9830"
          />
        </div>
        <p className="chart-note">
          Base 100 depuis le {formatDate(publicData.inception_date)} · Benchmark en tirets : VanEck Quantum Computing UCITS ETF (QNTM.L)
        </p>
      </section>

      {/* Allocation pie — consolidé (GOOGL = CTO + PER) */}
      <section className="section" aria-label="Allocation">
        <h2 className="section-title">Allocation (GOOGL consolidé CTO + PER)</h2>
        <div className="chart-container">
          <AllocationPie
            current={currentPie}
            inception={inceptionPie}
            inceptionDateLabel={formatDate(publicData.inception_date)}
          />
        </div>
      </section>

      {/* Tableau des positions */}
      <section className="section" aria-label="Composition">
        <h2 className="section-title">Composition{isAuthenticated ? ' — vue complète' : ' — vue publique'}</h2>
        <div className="chart-container" style={{ padding: '0' }}>
          <PersonnelHoldingsTable
            publicHoldings={publicData.holdings}
            privateHoldings={privateData?.holdings ?? null}
            isAuthenticated={isAuthenticated}
            inceptionDate={publicData.inception_date}
          />
        </div>
      </section>

      {/* Déconnexion — uniquement si authentifiée */}
      {isAuthenticated && (
        <div className="connexion-signout-wrap">
          <form action={signOut}>
            <button type="submit" className="connexion-signout-btn">
              Se déconnecter
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

// ─── Tableau des positions (Server Component inline) ──────────────────────────

type PublicHolding = {
  ticker: string;
  name: string;
  account: string;
  current_weight: number;
  target_weight: number;
  perf_since_inception: number | null;
};

type PrivateHolding = {
  ticker: string;
  account: string;
  quantity: number;
  adj_close: number;
  value_usd: number;
  avg_cost_usd: number | null;
  latent_gain: number | null;
  perf_since_purchase: number | null;
};

function PersonnelHoldingsTable({
  publicHoldings,
  privateHoldings,
  isAuthenticated,
  inceptionDate,
}: {
  publicHoldings: PublicHolding[];
  privateHoldings: PrivateHolding[] | null;
  isAuthenticated: boolean;
  inceptionDate: string;
}) {
  if (publicHoldings.length === 0) {
    return <p className="empty-state">Aucune position disponible.</p>;
  }

  // Index des données privées par (ticker, account) pour croisement
  const privateMap = new Map<string, PrivateHolding>();
  if (privateHoldings) {
    for (const h of privateHoldings) {
      privateMap.set(`${h.ticker}:${h.account}`, h);
    }
  }

  return (
    <div className="table-wrapper">
      <table className="holdings-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Société</th>
            <th>Enveloppe</th>
            {/* Perf depuis inception — basée sur les prix de marché, jamais sur le PRU */}
            <th className="right">Perf. depuis le {formatDate(inceptionDate)}</th>
            {/* Colonnes privées — absentes du HTML si non authentifiée */}
            {isAuthenticated && <th className="right hide-mobile">PRU</th>}
            {isAuthenticated && <th className="right hide-mobile">Prix actuel</th>}
            {isAuthenticated && <th className="right">Perf. depuis achat</th>}
            {isAuthenticated && <th className="right hide-mobile">Plus-value ($)</th>}
          </tr>
        </thead>
        <tbody>
          {publicHoldings.map(h => {
            const priv = isAuthenticated ? privateMap.get(`${h.ticker}:${h.account}`) : undefined;
            const inceptionPerfSign = h.perf_since_inception == null ? '' : h.perf_since_inception >= 0 ? 'positive' : 'negative';
            const purchasePerfSign  = priv?.perf_since_purchase == null ? '' : priv.perf_since_purchase >= 0 ? 'positive' : 'negative';
            const pvSign            = priv?.latent_gain == null ? '' : priv.latent_gain >= 0 ? 'positive' : 'negative';
            return (
              <tr key={`${h.ticker}-${h.account}`}>
                <td className="ticker mono">{h.ticker}</td>
                <td className="name">{h.name}</td>
                <td>
                  <span className="account-badge">{ACCOUNT_LABELS[h.account] ?? h.account}</span>
                </td>
                <td className={`right mono ${inceptionPerfSign}`}>
                  {h.perf_since_inception != null ? formatPct(h.perf_since_inception) : '—'}
                </td>
                {isAuthenticated && (
                  <td className="right mono hide-mobile">{priv?.avg_cost_usd != null ? formatUSD(priv.avg_cost_usd) : '—'}</td>
                )}
                {isAuthenticated && (
                  <td className="right mono hide-mobile">{priv ? formatUSD(priv.adj_close) : '—'}</td>
                )}
                {isAuthenticated && (
                  <td className={`right mono ${purchasePerfSign}`}>
                    {priv?.perf_since_purchase != null ? formatPct(priv.perf_since_purchase) : '—'}
                  </td>
                )}
                {isAuthenticated && (
                  <td className={`right mono ${pvSign} hide-mobile`}>
                    {priv?.latent_gain != null ? formatUSD(priv.latent_gain) : '—'}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
