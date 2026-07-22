-- Ajout d'IQM Quantum Computers à l'univers sectoriel — 13e société.
-- Couverture yfinance vérifiée le 22/07/2026. ⚠ Couverture PARTIELLEMENT DÉFAILLANTE :
-- trois écarts documentés ci-dessous, tous traités par surcharge manuelle sourcée.
--
-- IQMX : IQM Quantum Computers Oyj — modalité SUPRACONDUCTEUR (full-stack), Espoo (Finlande).
--        Nasdaq Global Select depuis le 02/07/2026, après fusion SPAC avec Real Asset
--        Acquisition Corp. (RAAQ), closing le 01/07/2026. Première société européenne du
--        quantique cotée sur une grande place US. Double cotation Nasdaq Helsinki (~03/07/2026).
--        Titre coté = ADS, ratio 1 ADS = 1 action ordinaire (aucune distorsion de market cap).
--
-- PIÈGE 1 — TICKER. Le symbole 'IQM' sur Yahoo Finance est le Franklin Intelligent Machines
--        ETF (NYSE Arca), PAS la société. Le ticker correct est 'IQMX'.
--
-- PIÈGE 2 — HISTORIQUE FANTÔME. yfinance sert sous IQMX l'historique du SPAC RAAQ depuis
--        juin 2025 (~10 $ = valeur de trust). Ces cours ne sont PAS ceux d'IQM.
--        → TICKER_FIRST_TRADE['IQMX'] = 2026-07-02 dans ingest.py / backfill.py /
--          backfill_sectoral.py. Aucun cours antérieur n'entre en base.
--
-- PIÈGE 3 — ACTIONS SOUS-ESTIMÉES DE 24,7 %. yfinance retourne 210 988 684 actions.
--        Le registre du commerce finlandais en enregistre 263 039 597 au 16/07/2026
--        (6-K du 20/07/2026, « Total number of voting rights and shares »).
--        → surcharge sanctuarisée dans fetch_shares.py, source 'SEC 6-K 2026-07-16'.
--
-- PIÈGE 4 — DEVISE DE REPORTING NON DÉCLARÉE. info['financialCurrency'] est NULL alors que
--        les états financiers sont en EUR (CA 2025 = 31,333 M€, recoupé par le communiqué de
--        closing qui chiffre le PIPE à « EUR 127,7 M (USD 145,5 M) »). Sans correctif,
--        fetch_revenue.py retombait sur USD par défaut → P/S faux de +14 %.
--        → RÈGLE DEVISE DURCIE (CLAUDE.md) : plus aucun défaut USD deviné, devise explicite
--          ou refus d'upsert. CA IQMX surchargé manuellement en EUR (fx appliqué).
--
-- P/S NON FERME (‡) : aucun détail trimestriel disponible via yfinance (recoupement
--        impossible, comme LAES/ARQQ) ET le CA disponible est celui de l'exercice clos au
--        31/12/2025 — ce n'est pas un TTM. Ne jamais afficher de ratio ferme pour IQMX
--        tant que 4 trimestres publiés ne sont pas recoupables.
--
-- ON CONFLICT DO NOTHING : idempotent — sans effet si déjà présent.

INSERT INTO asset (ticker, name, category, exchange, currency) VALUES
  ('IQMX', 'IQM Quantum Computers', 'pure_player', 'NASDAQ', 'USD')
ON CONFLICT (ticker) DO NOTHING;
