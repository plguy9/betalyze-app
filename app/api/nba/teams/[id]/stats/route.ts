// app/api/nba/teams/[id]/stats/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.APISPORTS_BASKETBALL_URL ||
  process.env.APISPORTS_NBA_URL ||
  "https://v1.basketball.api-sports.io";
const API_KEY = process.env.APISPORTS_KEY;
const DEFAULT_SEASON =
  process.env.APISPORTS_BASKETBALL_SEASON ??
  process.env.APISPORTS_NBA_SEASON ??
  "2025-2026";
const IS_BASKETBALL_V1 = API_BASE.includes("basketball");

// Correspondance codes -> IDs NBA v2 (https://v2.nba.api-sports.io)
const V2_TEAM_ID_BY_CODE: Record<string, number> = {
  ATL: 1,
  BOS: 2,
  BKN: 3,
  CHA: 5,
  CHI: 6,
  CLE: 7,
  DET: 10,
  IND: 15,
  MIA: 20,
  MIL: 21,
  NYK: 24,
  ORL: 26,
  PHI: 27,
  TOR: 38,
  WAS: 41,
  DAL: 8,
  DEN: 9,
  GSW: 11,
  HOU: 14,
  LAC: 16,
  LAL: 17,
  MEM: 19,
  MIN: 22,
  NOP: 23,
  OKC: 25,
  PHX: 28,
  POR: 29,
  SAC: 30,
  SAS: 31,
  UTA: 40,
};

// Correspondance des IDs basket v1 (12=NBA) -> codes équipes
const CODE_BY_TEAM_ID: Record<number, string> = {
  132: "ATL",
  133: "BOS",
  134: "BKN",
  135: "CHA",
  136: "CHI",
  137: "CLE",
  140: "DET",
  143: "IND",
  147: "MIA",
  148: "MIL",
  151: "NYK",
  153: "ORL",
  154: "PHI",
  159: "TOR",
  161: "WAS",
  138: "DAL",
  139: "DEN",
  141: "GSW",
  142: "HOU",
  144: "LAC",
  145: "LAL",
  146: "MEM",
  149: "MIN",
  150: "NOP",
  152: "OKC",
  155: "PHX",
  156: "POR",
  157: "SAC",
  158: "SAS",
  160: "UTA",
};

function resolveV2TeamId(teamId: number) {
  const code = CODE_BY_TEAM_ID[teamId];
  if (!code) return teamId;
  return V2_TEAM_ID_BY_CODE[code] ?? teamId;
}

function resolveTeamIdForApi(teamId: number) {
  if (IS_BASKETBALL_V1) return teamId;
  return resolveV2TeamId(teamId);
}

function normalizeSeason(value: string): string {
  const match = value.match(/(\d{4})/);
  if (!match) return value;
  const year = Number(match[1]);
  if (!Number.isFinite(year)) return value;
  return IS_BASKETBALL_V1 ? `${year}-${year + 1}` : String(year);
}

function isFinishedStatus(short?: string | null) {
  if (!short) return false;
  const value = short.toUpperCase();
  return value === "FT" || value === "AOT" || value === "OT";
}

export async function GET(
  req: NextRequest,
  { params }: { params?: { id?: string | string[] } },
) {
  // Next devrait passer params, mais on garde un fallback basé sur l'URL
  const rawIdFromParams = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean); // api, nba, teams, {id}, stats
  const idx = segments.findIndex((s) => s === "teams");
  const rawIdFromPath = idx >= 0 ? segments[idx + 1] : null;
  const rawId = rawIdFromParams ?? rawIdFromPath;

  const teamId = Number(rawId);
  if (!Number.isFinite(teamId)) {
    return NextResponse.json(
      { error: "Missing or invalid team id" },
      { status: 400 },
    );
  }

  const seasonParam = req.nextUrl.searchParams.get("season") ?? DEFAULT_SEASON;
  const season = normalizeSeason(seasonParam);
  if (!API_KEY) {
    return NextResponse.json(
      { error: "Missing API key", response: null },
      { status: 500 },
    );
  }

  try {
    const teamIdForApi = resolveTeamIdForApi(teamId);

    if (IS_BASKETBALL_V1) {
      const gamesUrl = new URL("/games", API_BASE);
      gamesUrl.searchParams.set("team", String(teamIdForApi));
      gamesUrl.searchParams.set("season", String(season));
      const gamesRes = await fetch(gamesUrl.toString(), {
        headers: { "x-apisports-key": API_KEY },
        cache: "no-store",
      });
      if (!gamesRes.ok) {
        const txt = await gamesRes.text().catch(() => "");
        return NextResponse.json(
          { error: "Upstream games error", status: gamesRes.status, body: txt },
          { status: 502 },
        );
      }
      const gamesJson = await gamesRes.json();
      const gamesList = Array.isArray(gamesJson?.response) ? gamesJson.response : [];
      const finished = gamesList
        .filter((g: any) => isFinishedStatus(g?.status?.short))
        .sort((a: any, b: any) => {
          const da = Date.parse(a?.date ?? "");
          const db = Date.parse(b?.date ?? "");
          return db - da;
        })
        .slice(0, 30);

      const totals = {
        games: 0,
        points: 0,
        fgm: 0,
        fga: 0,
        tpm: 0,
        tpa: 0,
        ftm: 0,
        fta: 0,
        offReb: 0,
        defReb: 0,
        totReb: 0,
        assists: 0,
        pFouls: 0,
        steals: 0,
        turnovers: 0,
        blocks: 0,
        plusMinus: 0,
      };

      for (const g of finished) {
        const gameId = g?.id;
        if (!gameId) continue;
        const statsUrl = new URL("/games/statistics/teams", API_BASE);
        statsUrl.searchParams.set("id", String(gameId));
        const statsRes = await fetch(statsUrl.toString(), {
          headers: { "x-apisports-key": API_KEY },
          cache: "no-store",
        });
        if (!statsRes.ok) continue;
        const statsJson = await statsRes.json();
        const entries = Array.isArray(statsJson?.response) ? statsJson.response : [];
        const entry = entries.find(
          (e: any) => String(e?.team?.id) === String(teamIdForApi),
        );
        if (!entry) continue;

        const homeId = g?.teams?.home?.id ?? null;
        const awayId = g?.teams?.away?.id ?? null;
        const homeScoreRaw = g?.scores?.home?.total ?? null;
        const awayScoreRaw = g?.scores?.away?.total ?? null;
        const homeScore =
          typeof homeScoreRaw === "number" ? homeScoreRaw : Number(homeScoreRaw);
        const awayScore =
          typeof awayScoreRaw === "number" ? awayScoreRaw : Number(awayScoreRaw);
        let pointsFor: number | null = null;
        let pointsAgainst: number | null = null;
        if (homeId === teamIdForApi) {
          pointsFor = Number.isFinite(homeScore) ? homeScore : null;
          pointsAgainst = Number.isFinite(awayScore) ? awayScore : null;
        } else if (awayId === teamIdForApi) {
          pointsFor = Number.isFinite(awayScore) ? awayScore : null;
          pointsAgainst = Number.isFinite(homeScore) ? homeScore : null;
        }

        totals.games += 1;
        if (typeof pointsFor === "number") totals.points += pointsFor;
        if (typeof pointsFor === "number" && typeof pointsAgainst === "number") {
          totals.plusMinus += pointsFor - pointsAgainst;
        }

        totals.fgm += entry?.field_goals?.total ?? 0;
        totals.fga += entry?.field_goals?.attempts ?? 0;
        totals.tpm += entry?.threepoint_goals?.total ?? 0;
        totals.tpa += entry?.threepoint_goals?.attempts ?? 0;
        totals.ftm += entry?.freethrows_goals?.total ?? 0;
        totals.fta += entry?.freethrows_goals?.attempts ?? 0;
        totals.offReb += entry?.rebounds?.offence ?? 0;
        totals.defReb += entry?.rebounds?.defense ?? 0;
        totals.totReb +=
          entry?.rebounds?.total ?? (entry?.rebounds?.offence ?? 0) + (entry?.rebounds?.defense ?? 0);
        totals.assists += entry?.assists ?? 0;
        totals.pFouls += entry?.personal_fouls ?? 0;
        totals.steals += entry?.steals ?? 0;
        totals.turnovers += entry?.turnovers ?? 0;
        totals.blocks += entry?.blocks ?? 0;
      }

      if (totals.games === 0) {
        return NextResponse.json({ ok: true, season, stats: null });
      }

      const fgp = totals.fga > 0 ? ((totals.fgm / totals.fga) * 100).toFixed(1) : "0";
      const tpp = totals.tpa > 0 ? ((totals.tpm / totals.tpa) * 100).toFixed(1) : "0";
      const ftp = totals.fta > 0 ? ((totals.ftm / totals.fta) * 100).toFixed(1) : "0";

      return NextResponse.json({
        ok: true,
        season,
        stats: {
          games: totals.games,
          points: totals.points,
          fgm: totals.fgm,
          fga: totals.fga,
          fgp,
          tpm: totals.tpm,
          tpa: totals.tpa,
          tpp,
          ftm: totals.ftm,
          fta: totals.fta,
          ftp,
          offReb: totals.offReb,
          defReb: totals.defReb,
          totReb: totals.totReb,
          assists: totals.assists,
          pFouls: totals.pFouls,
          steals: totals.steals,
          turnovers: totals.turnovers,
          blocks: totals.blocks,
          plusMinus: totals.plusMinus,
        },
      });
    }

    const url = new URL("/teams/statistics", API_BASE);
    url.searchParams.set("id", String(teamIdForApi));
    url.searchParams.set("season", String(season));

    const res = await fetch(url.toString(), {
      headers: { "x-apisports-key": API_KEY },
      cache: "no-store",
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Upstream error", status: res.status, body: txt },
        { status: 502 },
      );
    }

    const json = await res.json();
    const payload = json?.response?.[0] ?? null;
    return NextResponse.json({ ok: true, season, stats: payload ?? null });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error", message: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
