# Polices embarquées — images Open Graph (C4)

`IBMPlexSans-SemiBold.ttf` sert **uniquement** à la génération des images OG
(`src/lib/og.tsx`). Les pages du site continuent de charger IBM Plex Sans via
`next/font/google` (`src/app/layout.tsx`) — ce fichier ne les concerne pas.

## Pourquoi un fichier et pas un téléchargement à la génération

Une image OG est produite quand un crawler social passe. La faire dépendre d'un appel
réseau à Google Fonts à cet instant, c'est accepter qu'un partage tombe sur une carte
sans police si le réseau bronche. Le fichier est donc versionné en git et embarqué dans
le bundle serverless via `outputFileTracingIncludes` (`next.config.ts`).

## Format

**TTF obligatoire.** `satori`, le moteur derrière `next/og`, ne lit **ni woff2 ni EOT**.
Piège rencontré : l'API CSS legacy de Google Fonts renvoie de l'**EOT** quand on
l'interroge avec un User-Agent ancien — le fichier a l'air correct, `file` annonce
« IBM Plex Sans SemiBold », et la génération échoue quand même. Vérifier les octets
de tête : un TTF commence par `00 01 00 00`.

```
xxd -p -l4 IBMPlexSans-SemiBold.ttf   # doit afficher 00010000
```

## Provenance

- Source : dépôt officiel IBM — `IBM/plex`, `packages/plex-sans/fonts/complete/ttf/`
- Récupéré le : 2026-08-08
- Licence : **SIL Open Font License 1.1** (voir `OFL.txt`), redistribution autorisée.
  Copyright © 2017 IBM Corp. avec nom de police réservé « Plex ».

Un seul poids (SemiBold 600) est embarqué : tout le texte des cartes est du titrage ou
du chiffre-vedette. En ajouter un alourdit chaque génération — ne le faire que si un
template en a réellement besoin.
