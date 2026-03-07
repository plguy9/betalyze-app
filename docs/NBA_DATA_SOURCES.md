# NBA Data Sources (Contract)

This project uses two separate provider domains:

## 1) API-Sports (NBA data)
- Players
- Team rosters
- Games/schedule/results
- Standings
- Player game logs
- Stats/averages/trends
- DvP base stats inputs

## 2) Odds providers (bookmaker data only)
- SportsGameOdds
- The Odds API (fallback only when configured)
- Player prop odds (lines and prices)
- Bookmaker availability
- Top opportunities odds inputs

## Non-negotiable rule
- Never use odds providers for NBA stats/logs/standings.
- Never use API-Sports as bookmaker odds source for prop pricing.

## Quick mental model
- `API-Sports = basketball facts`
- `SportsGameOdds/TheOdds = betting prices`

