# BETALYZE — PARLAY BUILDER + ALTERNATE LINES ENGINE (MVP)

## Overview

Le **Parlay Builder** permet aux utilisateurs de créer des parlays à partir des props disponibles dans Betalyze.

Le système supporte :

- multi-game parlays
- alternate lines
- calcul automatique des cotes
- calcul du payout
- sauvegarde du ticket
- envoi vers le Bet Journal

En plus du builder, Betalyze possède un **Alternate Lines Recommendation Engine** qui analyse les alternate lines disponibles pour chaque joueur afin de recommander les meilleures options pour les parlays.

---

# Parlay Builder (MVP)

## Core Concept

Un **parlay** est un ensemble de legs.

Chaque leg est un prop individuel :

Example:

```
Player: Jayson Tatum
Market: Points
Line: Over 28.5
Odds: -115
Game: BOS vs NYK
```

Conditions :

- tous les legs doivent gagner
- si un leg perd → le parlay perd

---

# Parlay Slip

Le parlay slip contient :

```
legs[]
total_odds
stake
potential_payout
profit
```

---

# Canonical Leg Format (V1)

Objectif: avoir **un seul format de leg** partage front + backend.

```json
{
  "legId": "nba:002230101:brice-sensabaugh:PTS:over:20.5:fanduel",
  "sport": "NBA",
  "gameId": 2230101,
  "eventDate": "2026-03-15",
  "playerId": 12345,
  "player": "Brice Sensabaugh",
  "market": "PTS",
  "side": "over",
  "line": 20.5,
  "oddsDecimal": 1.57,
  "oddsAmerican": -175,
  "teamCode": "UTA",
  "opponentCode": "SAC",
  "bookmakerKey": "fanduel",
  "bookmakerName": "FanDuel",
  "source": "alternate_lines"
}
```

Champs obligatoires MVP:

```
legId
sport
player
market
side
line
oddsDecimal
```

Champs optionnels MVP:

```
gameId
eventDate
playerId
teamCode
opponentCode
oddsAmerican
bookmakerKey
bookmakerName
source
```

Fonctions :

```
add_leg()
remove_leg()
clear_slip()
recalculate_odds()
```

---

# Add Leg

Les legs peuvent être ajoutés depuis :

```
Top Props
Player Page
Match Modal
Alternate Lines Panel
```

Action :

```
Add to Parlay
```

---

# Duplicate Prevention

Bloquer :

```
same player
same stat
same line
same side
```

Exemple bloqué :

```
Tatum Over 28.5
Tatum Over 28.5
```

---

# Contradiction Prevention

Empêcher :

```
Over 28.5
Under 28.5
```

pour le même joueur et la même stat.

---

# Odds Calculation

Les parlays utilisent les **decimal odds**.

### Conversion American → Decimal

```
if odds > 0:
decimal = (odds / 100) + 1

if odds < 0:
decimal = (100 / abs(odds)) + 1
```

Example :

```
-110 → 1.91
+120 → 2.20
```

---

### Parlay Odds

```
parlay_odds = product(all leg decimal odds)
```

Example :

```
Leg1: 1.91
Leg2: 2.20
Leg3: 1.80

Parlay Odds:

1.91 * 2.20 * 1.80 = 7.56
```

---

# Payout Calculation

```
payout = stake * parlay_odds
profit = payout - stake
```

Example :

```
Stake: $10
Odds: 7.56

Payout = $75.60
Profit = $65.60
```

---

# Basic Rules

Minimum legs :

```
2
```

Maximum legs :

```
10
```

Si un match commence :

```
disable leg
```

---

# Database Models

## parlay_tickets

```
id
user_id
sport
total_odds
stake
payout
profit
status
created_at
```

---

## parlay_legs

```
id
ticket_id
player_id
game_id
market
line
side
odds
created_at
```

---

# Alternate Lines Recommendation Engine

## Overview

Chaque prop possède plusieurs **alternate lines**.

Example :

```
Player: Luka Doncic
Market: Points

O 24.5 (-220)
O 26.5 (-180)
O 28.5 (-120)
O 30.5 (+110)
O 32.5 (+160)
```

Betalyze analyse chaque line et calcule :

```
estimated_hit_probability
consistency
matchup_score
edge
recommendation_score
```

---

# Metrics Used

## Hit Rate

Calculer le taux de réussite du joueur pour chaque line.

Données nécessaires :

```
last_5_games
last_10_games
last_20_games
season
```

Calcul :

```
hit_rate_L5
hit_rate_L10
hit_rate_L20
season_hit_rate
```

Example :

```
line: O 26.5

L10: 8 / 10
L20: 14 / 20
Season: 35 / 50
```

---

### Weighted Hit Rate

```
weighted_hit_rate =
(L10 * 0.5) +
(L20 * 0.3) +
(season * 0.2)
```

Résultat :

```
estimated_hit_probability
```

---

# Defense vs Position (DvP)

Évaluer la défense adverse.

Input :

```
opponent_rank_vs_stat
```

Conversion en score :

```
Rank 1-5 = -10
Rank 6-10 = -5
Rank 11-20 = 0
Rank 21-25 = +5
Rank 26-30 = +10
```

---

# Consistency Score

Mesurer la volatilité du joueur.

Calcul :

```
std_dev_last_20_games
```

Plus la déviation standard est faible :

```
→ joueur plus stable
```

Conversion en score :

```
stable player = +10
average = 0
volatile = -10
```

---

# Implied Probability

Conversion des odds :

```
if odds < 0:

prob = abs(odds) / (abs(odds) + 100)

if odds > 0:

prob = 100 / (odds + 100)
```

Example :

```
-120 → 54.5%
+150 → 40%
```

---

# Edge Calculation

```
edge = estimated_hit_probability - implied_probability
```

Example :

```
model probability: 62%
book probability: 55%

edge = +7%
```

---

# Recommendation Score

Score final pour classer les alternate lines.

```
score =
(hit_rate * 0.4) +
(edge * 0.3) +
(dvp_score * 0.2) +
(consistency * 0.1)
```

---

# Recommendation Tags

Chaque line reçoit un tag.

```
SAFE
BALANCED
AGGRESSIVE
LONGSHOT
```

Rules :

SAFE

```
hit rate > 70%
odds between -300 and -150
```

BALANCED

```
hit rate 55-70%
odds between -150 and +120
```

AGGRESSIVE

```
hit rate 45-55%
odds > +120
```

LONGSHOT

```
hit rate < 45%
odds > +200
```

---

# UI Display

Pour chaque alternate line afficher :

```
line
odds
hit rate
DvP
edge
recommendation tag
Add to Parlay button
```

Example :

```
O 26.5 (-180)
Hit Rate: 78% (L10)
DvP: Favorable
Edge: +6.2%

Tag: SAFE
```

---

# Goal of the Engine

Aider l'utilisateur à :

```
trouver des alternate lines plus sécuritaires
identifier les meilleures lines pour les parlays
comprendre le risque de chaque leg
```

---

# Out of Scope (MVP)

Ne pas implémenter :

```
same game correlation engine
AI predictions
Monte Carlo simulation
parlay optimizer
```

Ces features seront ajoutées dans les futures versions.

---

# Final MVP Goal

Créer un système capable de :

```
build parlays
calculate odds
recommend alternate lines
identify safer picks
track tickets in journal
```
