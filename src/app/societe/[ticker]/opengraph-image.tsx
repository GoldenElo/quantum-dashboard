import { ImageResponse } from 'next/og';
import { fetchCompanyData, listCompanyTickers } from '@/lib/api';
import { formatMarketCap, formatRatio } from '@/lib/format';
import { t, TICKER_MODALITIES, TICKER_NOTES } from '@/i18n/t';
import {
  OG,
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgShell,
  changeColor,
  ogFonts,
  ogPct,
} from '@/lib/og';

/**
 * Image OG des fiches sociétés (C4) — destination des intégrations mi-vidéo.
 *
 * Trois chiffres seulement (capitalisation, P/S, variations) : c'est ce qui reste
 * lisible en miniature. Le marqueur éditorial du ticker (Up-C QNT, quantum washing
 * ARQQ, cotation récente IQMX) est repris tel quel — une carte qui affiche une
 * capitalisation ARQQ sans son avertissement contredirait la règle de la maison,
 * et une carte de partage circule plus loin que la page.
 */
export const runtime = 'nodejs';
export const revalidate = 86400;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = t.og.societe.alt;

// Mêmes bornes ET même casse que la page : les URLs de fiches sont en minuscules
// (/societe/ionq). Prerendre `IONQ` ici produirait une image à une URL que la page
// ne référence jamais — la carte serait regénérée à la demande à chaque partage.
export function generateStaticParams() {
  return listCompanyTickers().map(ticker => ({ ticker: ticker.toLowerCase() }));
}

/** Rendu du P/S — reprend les deux niveaux du tableau (jamais un ratio ferme par défaut). */
function psDisplay(company: { ps_ratio: number | null; ps_status: string }): {
  value: string;
  marker: string | null;
} {
  if (company.ps_status === 'insignificant') return { value: 'n.s.', marker: null };
  if (company.ps_status === 'none' || company.ps_ratio == null) return { value: '—', marker: null };
  const value = formatRatio(company.ps_ratio);
  if (company.ps_status === 'partial' || company.ps_status === 'unrecouped') {
    return { value, marker: '‡' };
  }
  if (company.ps_status === 'firm_extreme') return { value, marker: '⚠' };
  return { value, marker: null };
}

/** Bloc de statistique — libellé petit au-dessus, chiffre gros en dessous. */
function Stat({
  label,
  value,
  color,
  size: fontSize = 44,
  suffix,
}: {
  label: string;
  value: string;
  color: string;
  size?: number;
  suffix?: string | null;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginRight: 56 }}>
      <div style={{ display: 'flex', fontSize: 19, color: OG.muted }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 4 }}>
        <div style={{ display: 'flex', fontSize, color }}>{value}</div>
        {suffix && (
          <div style={{ display: 'flex', fontSize: 22, color: OG.muted, marginLeft: 6 }}>
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const company = await fetchCompanyData(ticker).catch(() => null);

  if (!company) {
    // Ticker hors univers ou base injoignable : carte de marque, pas un aperçu cassé.
    return new ImageResponse(
      (
        <OgShell dataDate={null}>
          <div
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div style={{ display: 'flex', fontSize: 52, color: OG.text }}>
              {t.og.fallback.accroche}
            </div>
            <div style={{ display: 'flex', fontSize: 26, color: OG.muted, marginTop: 12 }}>
              {t.og.fallback.indisponible}
            </div>
          </div>
        </OgShell>
      ),
      { ...OG_SIZE, fonts: await ogFonts() },
    );
  }

  const ps = psDisplay(company);
  const note = TICKER_NOTES[company.ticker];
  const modality = TICKER_MODALITIES[company.ticker];
  const categoryLabel = t.societe.categories[company.category] ?? company.category;

  return new ImageResponse(
    (
      <OgShell dataDate={company.price_date}>
        {/* ── Identité : catégorie, nom, ticker ── */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: 21, color: OG.teal }}>
              {categoryLabel}
            </div>
            {modality && (
              <div style={{ display: 'flex', fontSize: 21, color: OG.muted, marginLeft: 12 }}>
                · {modality}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 8 }}>
            <div style={{ display: 'flex', fontSize: 62, color: OG.text }}>
              {company.name}
            </div>
            <div style={{ display: 'flex', fontSize: 34, color: OG.muted, marginLeft: 18 }}>
              {company.ticker}
            </div>
          </div>

          {/* ── Capitalisation : le chiffre-vedette, seul en or ── */}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 30 }}>
            <div style={{ display: 'flex', fontSize: 20, color: OG.muted }}>
              {t.og.societe.capitalisation}
            </div>
            <div style={{ display: 'flex', fontSize: 84, color: OG.or, marginTop: 2 }}>
              {company.market_cap_usd == null ? '—' : formatMarketCap(company.market_cap_usd)}
            </div>
          </div>

          {/* ── Ligne de statistiques : P/S + trois horizons de variation ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 26 }}>
            <Stat
              label={t.og.societe.ps}
              value={ps.value}
              color={OG.text}
              suffix={ps.marker}
            />
            <Stat
              label={t.og.societe.jour}
              value={ogPct(company.change_1d)}
              color={changeColor(company.change_1d)}
            />
            <Stat
              label={t.og.societe.semaine}
              value={ogPct(company.change_1w)}
              color={changeColor(company.change_1w)}
            />
            <Stat
              label={t.og.societe.mois}
              value={ogPct(company.change_1m)}
              color={changeColor(company.change_1m)}
            />
          </div>
        </div>

        {/* Note éditoriale du ticker — reprise du tableau, jamais escamotée. */}
        {note && (
          <div style={{ display: 'flex', fontSize: 18, color: OG.muted, marginTop: 8 }}>
            {note.marker} {note.text}
          </div>
        )}
      </OgShell>
    ),
    { ...OG_SIZE, fonts: await ogFonts() },
  );
}
