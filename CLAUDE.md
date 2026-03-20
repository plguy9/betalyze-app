# CLAUDE.md — Betalyze App

## Contexte du projet

Betalyze est un **outil personnel d'analyse pour parieurs sportifs** couvrant NFL, NBA et NHL.
But : détecter les meilleurs picks du soir via des stats avancées et un Betalyze Score (0–100).
Long terme : plateforme vendable avec abonnements premium.

## Stack technique

- **Framework** : Next.js 16 (App Router, React 19)
- **Langage** : TypeScript strict
- **Styling** : TailwindCSS 4 + shadcn/ui (style "New York")
- **ORM** : Prisma 6 + Supabase PostgreSQL
- **Auth** : session custom (cookie `betalyze_session`)
- **Package manager** : pnpm
- **Icons** : lucide-react
- **Dev script** : `NEXT_DISABLE_TURBOPACK=1 next dev`

## Architecture clé

```
app/
  api/nba/, api/nfl/, api/nhl/    → routes internes (jamais appeler les APIs externes directement depuis le front)
  nba/                            → page NBA principale + composants
  nfl/                            → page NFL
  nhl/                            → (minimal)
components/ui/                    → shadcn/ui components
lib/
  nba/constants.ts                → TEAM_CODE_BY_ID, TEAM_PRIMARY_BY_CODE, etc.
  models/nba.ts                   → modèles Prisma NBA
  prisma.ts                       → client Prisma singleton
  auth/                           → session, db, password
  supabase/                       → server client, nba-odds-cache
types/nba.ts                      → types centralisés NBA
middleware.ts                     → protège /nba/* et /account/*
```

## Composants NBA (app/nba/components/)

| Fichier | Rôle |
|---|---|
| `nba-shared-types.ts` | Types locaux page NBA |
| `nba-helpers.ts` | Fonctions utilitaires (scores, formatting, couleurs) |
| `nba-sidebar.tsx` | Sidebar navigation NBA |
| `nba-ui.tsx` | Composants UI partagés (LeagueTab, etc.) |
| `best-props-section.tsx` | Section Top Props |
| `dvp-section.tsx` | Section Defense vs Position |
| `games-slate-section.tsx` | Section slate du jour |
| `teams-section.tsx` | Section classements |
| `search-card.tsx` | Recherche joueur/équipe |

## Conventions de code

- **Règle API** : le front ne fait jamais d'appels directs aux APIs externes — tout passe par `/api/...`
- **Clés API** : toujours dans `.env`, jamais hardcodées
- **Thème** : couleur primaire orange `#F59E0B` (CSS: `hsl(25 95% 53%)`)
- **Dark mode** : background `#07070b`, cohérent avec le thème Betalyze
- **Types** : centralisés dans `types/nba.ts` (NBA) ; helpers dans `nba-helpers.ts`

## Variables d'environnement (clés)

```
DATABASE_URL              Supabase PostgreSQL
DIRECT_URL                Direct Supabase
BALLDONTLIE_API_URL       NBA API
NHL_API_URL               NHL proxy
ODDS_API_KEY / URL        the-odds-api.com
SPORTSGAMEODDS_API_KEY    sportsgameodds.com v2
```

## Sync logs NBA (commande)

Commande locale pour sync les logs des joueurs qui jouent aujourd'hui (timezone Toronto):

```bash
pnpm nba:sync-today
```

Mode verification (sans ecriture, affiche `playersTargeted`):

```bash
pnpm nba:sync-today --dry=1
```

Prerequis:
- Terminal A: `pnpm dev` (API locale accessible sur `http://localhost:3000`)
- Terminal B: lancer `pnpm nba:sync-today ...`

Sortie attendue:
- Progression toutes les 10s: `en cours... 10s`, `20s`, etc.
- Resume final: `targeted`, `success`, `failed`, `gamesFound`, `teamsFound`

Options utiles:
- `--date=YYYY-MM-DD`
- `--season=2025` (ou `2025-2026`)
- `--concurrency=12`
- `--max=5000`
- `--refreshRoster=1`

Notes importantes:
- Utiliser `--dry=1` (double tiret), pas un tiret long `—dry=1`.
- Si `fetch failed`: le serveur local n'est pas joignable (lancer `pnpm dev`) ou `--origin` incorrect.
- Pipeline sync configure en NBA-only (API `v2.nba.api-sports.io`, pas de fallback basketball).
- La sync gere les aliases de saison (`2025` et `2025-2026`) pour le ciblage DB.

## Betalyze Score Engine

Score 0–100 pondéré :
- Forme récente : 40%
- Matchup qualité : 30%
- Volatilité : 10%
- Opportunité (usage rate, target share) : 10%
- Flow du match : 10%

Pour les totaux NBA : `score = clamp(70 + (total - 220) / 2, 40, 99)`

## Roadmap (blocs)

- [x] Bloc 1 — Setup & Base UI (80%)
- [ ] Bloc 2 — Sidebar & Navigation
- [ ] Bloc 3 — API Layer complet (NFL/NHL)
- [ ] Bloc 4 — Analyse Engine
- [ ] Bloc 5 — Betalyze Score
- [ ] Bloc 6 — Pages & UI (player page, picks)
- [ ] Bloc 7 — Picks Engine automatique
- [ ] Bloc 8 — Optimisation & Premium

## Règles importantes

- Toujours consulter `BETALYZE_BIBLE.md` pour les décisions de design et d'analyse
- Ne jamais recréer ce qui existe déjà
- Développer sport par sport avec une architecture scalable
- Maintenir ce fichier CLAUDE.md à jour après chaque session significative
