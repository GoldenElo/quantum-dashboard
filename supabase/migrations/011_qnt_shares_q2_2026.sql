-- 011 — QNT (Quantinuum) : surcharge actions au 30/06/2026 (résultats Q2 2026)
--
-- Contexte : jusqu'ici la seule mesure disponible était le 424B4 du 04/06/2026, en
-- FULLY-DILUTED (~322 M actions, dilution potentielle incluse). La société a publié
-- ses premiers comptes trimestriels le 11/08/2026 : on dispose désormais du nombre
-- d'actions ÉCONOMIQUES EN CIRCULATION au 30/06/2026.
--
--   Class A outstanding : 36 134 196
--   Class B outstanding : 226 771 877  (non-économiques, miroir 1:1 des Common Units
--                                        de Quantinuum Holdings — aucun double compte)
--   Total économique    : 262 906 073
--
-- Source : https://ir.quantinuum.com/news-releases/news-release-details/quantinuum-reports-second-quarter-2026-results
--
-- RÈGLE : la market cap QNT se calcule sur les actions économiques outstanding,
-- JAMAIS sur le fully-diluted. Ne pas revenir aux 322 M.
--
-- NON-DESTRUCTIF : la ligne 424B4 du 2026-06-05 est CONSERVÉE. Elle documente la
-- période IPO → première publication et nourrit l'historique d'actions (courbe de
-- capitalisation des fiches, C7). Elle est simplement supersédée : la lecture côté
-- API prend la ligne la plus récente (ORDER BY as_of_date DESC).
--
-- Idempotent (ON CONFLICT sur la PK). Miroir exact de _MANUAL_OVERRIDES dans
-- scripts/fetch_shares.py : le cron trimestriel réécrit la même ligne sans dérive.
-- `source` commence par 'SEC' → sanctuarisée par guards.is_manual_source(),
-- et _drop_superseding_yf() écarte toute ligne yfinance datée du 2026-06-30 ou après.

insert into shares_outstanding (ticker, as_of_date, shares, source)
values (
  'QNT',
  '2026-06-30',
  262906073,
  'SEC 8-K 2026-08-11 (Q2 2026 — Class A + Class B outstanding au 30/06/2026)'
)
on conflict (ticker, as_of_date) do update
  set shares = excluded.shares,
      source = excluded.source;

-- Contrôle après application — la ligne du 30/06 doit sortir en tête :
--   select as_of_date, shares, source
--   from shares_outstanding
--   where ticker = 'QNT'
--   order by as_of_date desc;
