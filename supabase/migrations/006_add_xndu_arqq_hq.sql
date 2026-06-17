-- Ajout de trois pure-players à l'univers sectoriel : XNDU, ARQQ, HQ
-- Couverture yfinance vérifiée le 17/06/2026 (historique réel + sharesOutstanding exploitable).
--
-- XNDU : Xanadu Quantum Technologies — modalité PHOTONIQUE — IPO Nasdaq 27/03/2026 (NGM).
--        43,3 M actions (yfinance, Q1 2026). Premier cours : 27/03/2026.
--
-- ARQQ : Arqit Quantum Inc. — cryptographie quantique — Nasdaq (NCM) depuis sept 2021.
--        17,4 M actions (yfinance, Q1 2026). ⚠ Cas documenté de quantum washing —
--        voir analyse dédiée de la chaîne. À NE PAS traiter comme équivalent aux autres
--        pure-players sans la note d'avertissement sur l'affichage.
--
-- HQ   : Horizon Quantum Holdings — issu d'une fusion SPAC dMY Squared (Q1 2026).
--        31,8 M actions (yfinance, Q1 2026). Premier cours : 20/03/2026.
--
-- ON CONFLICT DO NOTHING : idempotent — sans effet si déjà présents.

INSERT INTO asset (ticker, name, category, exchange, currency) VALUES
  ('XNDU', 'Xanadu Quantum Technologies', 'pure_player', 'NASDAQ', 'USD'),
  ('ARQQ', 'Arqit Quantum',               'pure_player', 'NASDAQ', 'USD'),
  ('HQ',   'Horizon Quantum Holdings',    'pure_player', 'NASDAQ', 'USD')
ON CONFLICT (ticker) DO NOTHING;
