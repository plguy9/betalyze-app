# 🏈🏀🏒 BETALYZE_BIBLE.md  
**Version 1.0 — Document maître du projet Betalyze**

---

# 📌 Table des matières
1. [Vision & Objectifs](#vision--objectifs)  
2. [Sports supportés](#sports-supportés)  
3. [Style d’analyse Betalyze](#style-danalyse-betalyze)  
4. [UI/UX & Identité visuelle](#uiux--identité-visuelle)  
5. [Architecture de l’application](#architecture-de-lapplication)  
6. [APIs & Données](#apis--données)  
7. [Analyse Engine](#analyse-engine)  
8. [Betalyze Score Engine](#betalyze-score-engine)  
9. [Pages principales](#pages-principales)  
10. [Roadmap & Blocs](#roadmap--blocs)  
11. [État d’avancement](#état-davancement)  
12. [Décisions officielles](#décisions-officielles)  

---

# 1. 🚀 Vision & Objectifs

Betalyze est un **outil personnel avancé d’analyse pour parieurs sportifs**, conçu pour :

- analyser **NFL, NBA, NHL**
- fournir **le plus de statistiques avancées possibles**
- utiliser la **Betalyze Strategy** développée dans les chats
- calculer un **Betalyze Score** pour chaque pick
- présenter des analyses claires, fiables et rapides

🎯 **Court terme (Niveau 1)**  
Outil personnel performant pour détecter les meilleurs picks du soir.

🎯 **Long terme (Niveau 3)**  
Plateforme vendable, avec abonnements premium et analyses avancées.

---

# 2. 🏆 Sports supportés

1. **NFL**  
2. **NBA**  
3. **NHL**

Chacun doit contenir :

- Stats classiques  
- Stats avancées  
- Matchups similaires  
- Position vs défense  
- Tendances 5–10 derniers matchs  
- Analyse qualitative (flow du match)  

---

# 3. 🧠 Style d’analyse Betalyze

L’analyse se base sur les éléments suivants :

### 📌 Stats classiques
- yards, points, shots, minutes, etc.

### 📌 Stats avancées
- NFL : EPA, success rate, target share  
- NBA : PER, usage rate, pace, OPRP  
- NHL : Corsi, xG, TOI, CF%, shooting quality  

### 📌 Matchup-based analysis
- position vs défense  
- équipe adverse dernière tendance  
- matchups similaires (ex : défense top 5, bottom 5)

### 📌 Tendances récentes
- 3 derniers matchs  
- 5 derniers matchs  
- 10 derniers matchs

### 📌 Betalyze Flow Prediction
Flow attendu :
- match au sol vs aérien (NFL)
- pace rapide vs lent (NBA)
- contrôle vs chaos (NHL)

### 📌 Betalyze Score
Un score pondéré basé sur :
- stats récentes  
- matchups  
- homogénéité  
- volatilité  
- confiance du pick  

---

# 4. 🎨 UI/UX & Identité visuelle

### 📌 Style général
- Site complet  
- Sidebar gauche  
- Mode clair / sombre  
- Style sportif moderne  
- Thème orange (palette Betalyze)

### 📌 Pages clés visibles dans la sidebar
- Home (Dashboard)
- Players
- Teams
- Matchups
- Picks du soir
- Analyse d’un joueur
- Settings (plus tard)

### 📌 Composants déjà implémentés
- **Navbar** (avec dark / light working)
- **Theme provider** fonctionnel
- **Palette de couleurs Betalyze**
- **Structure de base Next.js 15**
- **shadcn/ui installé**
- **tailwind.config.js configuré**

---

# 5. 🏗️ Architecture de l’application

```
betalyze-app/
 ├─ BETALYZE_BIBLE.md
 ├─ app/
 │   ├─ (app)/layout.tsx
 │   ├─ page.tsx (Home)
 │   ├─ nfl/
 │   ├─ nba/
 │   ├─ nhl/
 │   ├─ players/
 │   └─ picks/
 ├─ components/
 │   ├─ NavbarClient.tsx
 │   ├─ Sidebar.tsx
 │   ├─ PlayerCard.tsx
 │   ├─ StatBox.tsx
 │   └─ ThemeToggle.tsx
 ├─ hooks/
 │   └─ useTheme.ts
 ├─ lib/
 │   ├─ api/
 │   ├─ utils/
 │   └─ scoring/
 ├─ public/
 ├─ styles/
 └─ prisma/
```

### 📌 Technologies utilisées
- Next.js 15 – App Router  
- React Server & Client components  
- TailwindCSS  
- shadcn/ui  
- TypeScript  
- API externe pour les stats  
- Pas de DB nécessaire au début  

---

# 6. 🌐 APIs & Données

👉 Règle générale :  
- Toutes les intégrations externes passent par un **API Layer interne** (dans `/lib/api` + routes `/api/...`).
- L’app consomme **UNIQUEMENT** nos endpoints internes (jamais directement l’API externe).
- Les clés d’API sont toujours dans `.env` (jamais en dur dans le code).

---

## 6.1 🏀 NBA – API-Sports (API-BASKETBALL) Mapping

**Fournisseur :** https://api-sports.io/documentation/basketball/v1  
**But :** récupérer toutes les données nécessaires à l’analyse NBA v1 (joueurs, équipes, matchs, boxscores).

### 🔑 6.1.1 Configuration & variables d’environnement

Dans `.env` (exemple) :

### 🧱 6.1.6 Endpoints INTERNES NBA (API Next.js)

> Tous ces endpoints seront implémentés dans `app/api/nba/...`  
> Le frontend utilise **uniquement** ces routes.  
> Les types utilisés viennent de `lib/models/nba.ts`.

---

#### 6.1.6.1 `GET /api/nba/teams`

**But :** récupérer la liste des équipes NBA pour l’affichage et le mapping interne.

- **Méthode :** `GET`
- **URL :** `/api/nba/teams`
- **Query params :** _aucun_
- **Réponse — TypeScript :**

```ts
type GetNbaTeamsResponse = {
  teams: NbaTeam[];
};

```env
API_SPORTS_BASKETBALL_BASE_URL="https://v1.basketball.api-sports.io"
API_SPORTS_BASKETBALL_KEY="TON_API_KEY_ICI"

---

# 7. ⚙️ Analyse Engine

Un module interne qui :
1. Fetch les stats  
2. Analyse matchups  
3. Pondère selon la stratégie  
4. Produit une analyse textuelle + score

Structure :

```
lib/analyze/
 ├─ nfl.ts
 ├─ nba.ts
 └─ nhl.ts
```

---

# 8. 📊 Betalyze Score Engine

But : produire un score de 0 → 100

Facteurs :
- Forme récente (40%)
- Matchup qualité (30%)
- Volatilité (10%)
- Opportunité (target share, usage rate…) (10%)
- Flow du match (10%)

Output :
```
{
  score: 87,
  confidence: "High",
  reasons: [...],
  stats_used: {...}
}
```

---

# 9. 📄 Pages principales

### 1. `/` Home — Dashboard
- Résumé du jour
- Top 5 picks
- Derniers résultats

### 2. `/players`
- Recherche cross-sport
- Résultat + card

### 3. `/players/[id]`
- Stats
- Analyse
- Betalyze Score

### 4. `/picks`
- Suggestions automatiques (Top 5)

### 5. `/nfl`, `/nba`, `/nhl`
- Page par sport

---

# 10. 📅 Roadmap & Blocs

## 🧱 **Bloc 1 — Setup & Base UI (EN GRANDE PARTIE FAIT)**
- Création du projet Next.js  
- Installation Tailwind  
- Installation shadcn/ui  
- Création du thème Betalyze  
- Création du **Navbar**  
- Ajout du **Theme Toggle**  
- Correction des erreurs TS/JS  
- Setup des pages de base  

→ ✔️ **État : 80 % complété**

---

## 🧱 **Bloc 2 — Sidebar & Navigation**
À faire :
- Sidebar complète  
- Navigation par sport  
- Navigation players / picks  
- Layout final

---

## 🧱 **Bloc 3 — API Layer**
À faire :
- Créer un module API unifié  
- NBA déjà fonctionnel (balldontlie)  
- Ajouter NHL  
- Ajouter NFL (source gratuite)  

---

## 🧱 **Bloc 4 — Analyse Engine**
À faire :
- Analyse NFL  
- Analyse NBA  
- Analyse NHL  
- Fonction commune de pondération  

---

## 🧱 **Bloc 5 — Betalyze Score**
À faire :  
- pondération  
- catégories de risques  
- sortie structurée  

---

## 🧱 **Bloc 6 — Pages & UI**
- Player page  
- Stats page  
- Picks du soir  

---

## 🧱 **Bloc 7 — Picks Engine**
- Construction automatique des 3 meilleurs picks  

---

## 🧱 **Bloc 8 — Optimisation**
- Mise en cache  
- Rapidité  
- Préparation Premium  

---

# 11. 📊 État d’avancement

### ✔️ Déjà fait
- Setup Next.js 15  
- Tailwind installé  
- shadcn/ui installé  
- Thème dark / light fonctionnel  
- Palette Betalyze définie  
- Navbar créé  
- Debug du theme toggle  
- Tests API NBA (OK)  
- Première structure du projet  

### 🟧 En cours
- Sidebar  
- Pages par sport  

### ⛔ Reste à faire
- API NFL  
- API NHL  
- Analyse engine  
- Betalyze Score  
- Player pages  
- Picks du soir engine

---

# 12. 📌 Décisions officielles

- Le projet est **personnel**, mais doit être **vendeur** à long terme.  
- API gratuite au début seulement.  
- On développe **sport par sport**, mais avec architecture scalable.  
- Le design suit la **palette orange Betalyze**.  
- Toujours garder la Bible à jour.  
- Ne jamais recréer ce qui existe déjà.  

---

# 🔚 Fin de BETALYZE_BIBLE.md — Version 1.0