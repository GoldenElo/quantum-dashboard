-- 017 — PSQL et IONQ : surcharges actions sur source primaire (septembre 2026)
--
-- Deux lignes, deux dossiers distincts, une même règle : `source` commence par
-- 'SEC' → sanctuarisée par guards.is_manual_source(), jamais écrasée par yfinance,
-- et _drop_superseding_yf() écarte toute ligne yfinance datée au même jour ou après.
-- Miroir exact de _MANUAL_OVERRIDES dans scripts/fetch_shares.py : le cron
-- trimestriel réécrit les mêmes lignes sans dérive.
--
-- ══ PSQL — L'ÉCHÉANCE DE MAINTENANCE EST ATTEINTE ════════════════════════════
--
-- Depuis la cotation du 28/08/2026, AUCUNE ligne shares_outstanding n'était écrite
-- pour Pasqal : le seul chiffre disponible (209 583 333, servi par yfinance) est
-- repris du 424B3 du 05/08/2026 où il désigne explicitement le scénario de RACHAT
-- MAXIMAL, l'autre borne étant 238 333 333 sans rachat — une amplitude de 13,7 %.
-- Ce n'était pas une donnée partielle mais une HYPOTHÈSE DE PROSPECTUS (migration
-- 014, PIÈGE 2).
--
-- Le 20-F déposé le 02/09/2026 (période close au 27/08) publie le chiffre réel, en
-- couverture et en Item 10.A :
--
--   « On August 27, 2026, the issuer had 212,293,691 Ordinary Shares, nominal
--     value €0.02 per share, outstanding. »
--
-- CONTRÔLE DE COHÉRENCE OBLIGATOIRE — contre le PRIX D'OPÉRATION de 10,00 $,
-- JAMAIS le cours (CLAUDE.md, Maintenance planifiée) :
--     212 293 691 × 10,00 $ = 2,123 Md$   ∈ [2,1 ; 2,4] Md$   ✔
--     212 293 691                          ∈ [209 583 333 ; 238 333 333]  ✔
-- Près de la borne basse, cohérent avec les ~266 M$ de rachats mentionnés au 20-F.
-- Rapporté au COURS (19,11 $ au premier jour, +91 % sur le prix d'opération), le
-- test aurait échoué sans que rien ne soit faux — d'où l'ancre au prix d'opération.
--
-- CONSÉQUENCES à traiter dans le même commit :
--   · retrait du marqueur ¶ (TICKER_NOTES.PSQL) — la capitalisation et le P/S
--     deviennent calculables, la tuile du Mur et l'image OG s'allument ;
--   · le P/S RESTE marqué ‡ : le CA est celui de l'exercice clos au 31/12/2025,
--     ce n'est pas un TTM et il n'est pas recoupable ;
--   · PSQL devient éligible au rebalancement de l'indice TQW du 02/11/2026
--     (index_tqw.py exclut tout constituant sans actions connues) ;
--   · le garde-fou de fetchMarketCapsData (nullabilité de shares / market_cap_usd)
--     RESTE EN PLACE : il ne se retire pas parce qu'un cas se résout.
--
-- Source : https://www.sec.gov/Archives/edgar/data/2119292/000121390026096761/ea0303765-20f_pasqal.htm
--
-- ══ IONQ — décompte trimestriel ordinaire ════════════════════════════════════
--
-- 381 044 481 actions au 30/06/2026 (10-Q déposé le 10/08/2026, bilan et XBRL
-- us-gaap:CommonStockSharesOutstanding). Progression normale : 362 592 722 au
-- 31/12/2025, 373 171 320 au 31/03/2026.
--
-- ⚠ NE PAS CONFONDRE avec la couverture du MÊME 10-Q, qui annonce 381 002 314
-- actions au 29/07/2026 : autre date, autre chiffre, et c'est le chiffre de BILAN
-- au 30/06 qui doit servir la capitalisation (cohérence avec la date des cours).
--
-- Source : https://www.sec.gov/Archives/edgar/data/1824920/000119312526341001/ionq-20260630.htm
--
-- Idempotent (ON CONFLICT sur la PK). NON-DESTRUCTIF : les lignes antérieures sont
-- conservées, elles nourrissent l'historique de dilution (C7). Elles sont
-- simplement supersédées — la lecture prend la plus récente (ORDER BY as_of_date DESC).

insert into shares_outstanding (ticker, as_of_date, shares, source)
values
  ('PSQL', '2026-08-27', 212293691,
   'SEC 20-F 2026-08-27 (capital social post-fusion, couverture et Item 10.A)'),
  ('IONQ', '2026-06-30', 381044481,
   'SEC 10-Q 2026-06-30')
on conflict (ticker, as_of_date) do update
  set shares = excluded.shares,
      source = excluded.source;

-- Contrôle après application — chaque ligne doit sortir en tête de son ticker :
--   select ticker, as_of_date, shares, source
--   from shares_outstanding
--   where ticker in ('PSQL', 'IONQ')
--   order by ticker, as_of_date desc;
--
-- Attendu : PSQL 2026-08-27 → 212 293 691 (première et seule ligne du ticker) ;
--           IONQ 2026-06-30 → 381 044 481, devant 2026-03-31 → 373 171 320.
