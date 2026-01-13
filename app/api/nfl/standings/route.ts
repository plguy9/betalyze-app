// app/api/nfl/standings/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.APISPORTS_KEY;
const API_BASE =
  process.env.APISPORTS_NFL_URL ?? "https://v1.american-football.api-sports.io";
const DEFAULT_LEAGUE = process.env.APISPORTS_NFL_LEAGUE_ID ?? "1";
const DEFAULT_SEASON = process.env.APISPORTS_NFL_SEASON ?? "2025";

type TeamInfo = {
  id: number;
  name: string;
  code: string | null;
  logo: string | null;
  city: string | null;
  conference: "AFC" | "NFC" | "Unknown";
  division:
    | "AFC East"
    | "AFC North"
    | "AFC South"
    | "AFC West"
    | "NFC East"
    | "NFC North"
    | "NFC South"
    | "NFC West"
    | "Unknown";
};

type GameItem = {
  teams?: { home?: { id?: number }; away?: { id?: number } };
  scores?: { home?: { total?: number }; away?: { total?: number } };
  game?: {
    id?: number;
    date?: { timestamp?: number };
    status?: { short?: string };
    stage?: string;
  };
  status?: { short?: string };
  stage?: string;
};

type StandingRow = {
  teamId: number;
  name: string;
  code: string | null;
  logo: string | null;
  city: string | null;
  division: TeamInfo["division"];
  conference: TeamInfo["conference"];
  position: number | null;
  w: number;
  l: number;
  t: number;
  pct: number;
  pf: number;
  pa: number;
  net: number;
  home: { w: number; l: number; t: number; pct: number; text?: string };
  road: { w: number; l: number; t: number; pct: number; text?: string };
  div: { w: number; l: number; t: number; pct: number; text?: string };
  conf: { w: number; l: number; t: number; pct: number; text?: string };
  nonConf: { w: number; l: number; t: number; pct: number; text?: string };
  streak: string | null;
  last5: { w: number; l: number; t: number };
  order: number;
};

const DIVISION_BY_CODE: Record<
  string,
  {
    division:
      | "AFC East"
      | "AFC North"
      | "AFC South"
      | "AFC West"
      | "NFC East"
      | "NFC North"
      | "NFC South"
      | "NFC West";
    conference: "AFC" | "NFC";
  }
> = {
  BUF: { division: "AFC East", conference: "AFC" },
  MIA: { division: "AFC East", conference: "AFC" },
  NE: { division: "AFC East", conference: "AFC" },
  NYJ: { division: "AFC East", conference: "AFC" },

  BAL: { division: "AFC North", conference: "AFC" },
  CIN: { division: "AFC North", conference: "AFC" },
  CLE: { division: "AFC North", conference: "AFC" },
  PIT: { division: "AFC North", conference: "AFC" },

  HOU: { division: "AFC South", conference: "AFC" },
  IND: { division: "AFC South", conference: "AFC" },
  JAX: { division: "AFC South", conference: "AFC" },
  TEN: { division: "AFC South", conference: "AFC" },

  DEN: { division: "AFC West", conference: "AFC" },
  KC: { division: "AFC West", conference: "AFC" },
  LAC: { division: "AFC West", conference: "AFC" },
  LV: { division: "AFC West", conference: "AFC" },

  DAL: { division: "NFC East", conference: "NFC" },
  NYG: { division: "NFC East", conference: "NFC" },
  PHI: { division: "NFC East", conference: "NFC" },
  WAS: { division: "NFC East", conference: "NFC" },

  CHI: { division: "NFC North", conference: "NFC" },
  DET: { division: "NFC North", conference: "NFC" },
  GB: { division: "NFC North", conference: "NFC" },
  MIN: { division: "NFC North", conference: "NFC" },

  ATL: { division: "NFC South", conference: "NFC" },
  CAR: { division: "NFC South", conference: "NFC" },
  NO: { division: "NFC South", conference: "NFC" },
  TB: { division: "NFC South", conference: "NFC" },

  ARI: { division: "NFC West", conference: "NFC" },
  LA: { division: "NFC West", conference: "NFC" },
  SF: { division: "NFC West", conference: "NFC" },
  SEA: { division: "NFC West", conference: "NFC" },
};

const FINISHED_CODES = new Set(["FT", "AOT", "AET", "AP", "FINAL", "F", "3"]);

function normalizeCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return code.trim().toUpperCase();
}

function divisionFromTeam(
  name: string,
  code: string | null,
): { division: TeamInfo["division"]; conference: TeamInfo["conference"] } {
  const normalizedCode = normalizeCode(code);
  if (normalizedCode && DIVISION_BY_CODE[normalizedCode]) {
    return DIVISION_BY_CODE[normalizedCode];
  }
  const byName = name.trim().toLowerCase();
  const fallback: Array<{ key: keyof typeof DIVISION_BY_CODE; match: string }> = [
    { key: "LA", match: "chargers" },
  ];
  for (const entry of fallback) {
    if (byName.includes(entry.match) && DIVISION_BY_CODE[entry.key]) {
      return DIVISION_BY_CODE[entry.key];
    }
  }
  return { division: "Unknown", conference: "Unknown" };
}

function isFinishedGame(game: GameItem, includePreseason = false): boolean {
  const status =
    (game?.game?.status?.short ?? game?.status?.short ?? "").toString().toUpperCase();
  const stage = (game?.game?.stage ?? game?.stage ?? "").toString().toLowerCase();
  if (!includePreseason && stage.includes("pre")) return false;
  return FINISHED_CODES.has(status);
}

function recordToString(rec: { w: number; l: number; t: number }): string {
  return `${rec.w} - ${rec.l} - ${rec.t}`;
}

export async function GET(req: NextRequest) {
  const season = req.nextUrl.searchParams.get("season") ?? DEFAULT_SEASON;
  const league = req.nextUrl.searchParams.get("league") ?? DEFAULT_LEAGUE;

  if (!API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  try {
    const url = new URL("/standings", API_BASE);
    url.searchParams.set("league", league);
    url.searchParams.set("season", season);
    const res = await fetch(url.toString(), {
      headers: { "x-apisports-key": API_KEY },
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Upstream standings error", status: res.status, body: txt },
        { status: 502 },
      );
    }

    const parseRecord = (txt: string | null | undefined) => {
      if (!txt) return { w: 0, l: 0, t: 0, pct: 0, text: "0-0-0" };
      const parts = txt.split("-").map((x) => Number(x.trim()));
      const [w = 0, l = 0, t = 0] = parts;
      const total = w + l + t;
      const pct = total === 0 ? 0 : Number((w / total).toFixed(3));
      return { w, l, t, pct, text: `${w}-${l}-${t}` };
    };

    const toConfCode = (name: string | null | undefined): "AFC" | "NFC" | "Unknown" => {
      const n = (name ?? "").toLowerCase();
      if (n.includes("american")) return "AFC";
      if (n.includes("national")) return "NFC";
      return "Unknown";
    };

    const rows: StandingRow[] =
      Array.isArray(json?.response) && json.response.length
        ? json.response
            .map((r: any, idx: number) => {
              const id = Number(r?.team?.id);
              if (!Number.isFinite(id)) return null;
              const position = Number.isFinite(Number(r?.position))
                ? Number(r?.position)
                : null;
              const w = Number(r?.won ?? 0);
              const l = Number(r?.lost ?? 0);
              const t = Number(r?.ties ?? 0);
              const pf = Number(r?.points?.for ?? 0);
              const pa = Number(r?.points?.against ?? 0);
              const net = Number(r?.points?.difference ?? pf - pa);
              const home = parseRecord(r?.records?.home);
              const road = parseRecord(r?.records?.road);
              const div = parseRecord(r?.records?.division);
              const confRec = parseRecord(r?.records?.conference);
              const nonConf = {
                w: Math.max(0, w - confRec.w),
                l: Math.max(0, l - confRec.l),
                t: Math.max(0, t - confRec.t),
                pct: 0,
                text: "",
              };
              const nonConfTotal = nonConf.w + nonConf.l + nonConf.t;
              nonConf.pct = nonConfTotal === 0 ? 0 : Number((nonConf.w / nonConfTotal).toFixed(3));
              nonConf.text = `${nonConf.w}-${nonConf.l}-${nonConf.t}`;

              const totalGames = w + l + t;
              const pct = totalGames === 0 ? 0 : Number((w / totalGames).toFixed(3));
              return {
                teamId: id,
                name: r?.team?.name ?? "Team",
                code: null,
                logo: r?.team?.logo ?? null,
                city: null,
                division: (r?.division as any) ?? "Unknown",
                conference: toConfCode(r?.conference),
                position,
                w,
                l,
                t,
                pct,
                pf,
                pa,
                net,
                home,
                road,
                div,
                conf: confRec,
                nonConf,
                streak: r?.streak ?? null,
                last5: { w: 0, l: 0, t: 0 },
                order: idx,
              } as StandingRow;
            })
            .filter(Boolean) as StandingRow[]
        : [];

    return NextResponse.json({
      season,
      league,
      updatedAt: new Date().toISOString(),
      teams: rows,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error", message: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
