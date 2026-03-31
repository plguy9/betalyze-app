import { NextRequest, NextResponse } from "next/server";

export type InjuryStatus = "Out" | "Doubtful" | "Questionable" | "Day-To-Day" | "Active";

export type PlayerInjury = {
  name: string;
  firstName: string;
  lastName: string;
  status: InjuryStatus;
  comment: string;
  teamCode: string;
  teamName: string;
};

type EspnInjuryResponse = {
  injuries?: Array<{
    id: string;
    displayName: string;
    injuries?: Array<{
      id: string;
      shortComment?: string;
      longComment?: string;
      status?: string;
      athlete?: {
        id: string;
        displayName?: string;
        firstName?: string;
        lastName?: string;
      };
    }>;
  }>;
};

// Simple in-memory cache (2h TTL)
let cache: { data: PlayerInjury[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

const ESPN_TEAM_CODE_MAP: Record<string, string> = {
  "Atlanta Hawks": "ATL", "Boston Celtics": "BOS", "Brooklyn Nets": "BKN",
  "Charlotte Hornets": "CHA", "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN", "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW", "Houston Rockets": "HOU", "Indiana Pacers": "IND",
  "LA Clippers": "LAC", "Los Angeles Clippers": "LAC", "Los Angeles Lakers": "LAL",
  "Memphis Grizzlies": "MEM", "Miami Heat": "MIA", "Milwaukee Bucks": "MIL",
  "Minnesota Timberwolves": "MIN", "New Orleans Pelicans": "NOP", "New York Knicks": "NYK",
  "Oklahoma City Thunder": "OKC", "Orlando Magic": "ORL", "Philadelphia 76ers": "PHI",
  "Phoenix Suns": "PHX", "Portland Trail Blazers": "POR", "Sacramento Kings": "SAC",
  "San Antonio Spurs": "SAS", "Toronto Raptors": "TOR", "Utah Jazz": "UTA",
  "Washington Wizards": "WAS",
};

function normalizeStatus(raw: string | undefined): InjuryStatus {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("out")) return "Out";
  if (s.includes("doubtful")) return "Doubtful";
  if (s.includes("questionable")) return "Questionable";
  if (s.includes("day")) return "Day-To-Day";
  return "Active";
}

async function fetchInjuries(): Promise<PlayerInjury[]> {
  const res = await fetch(
    "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries",
    { next: { revalidate: 0 } }
  );
  if (!res.ok) return [];

  const data = (await res.json()) as EspnInjuryResponse;
  const result: PlayerInjury[] = [];

  for (const team of data.injuries ?? []) {
    const teamName = team.displayName ?? "";
    const teamCode = ESPN_TEAM_CODE_MAP[teamName] ?? "";

    for (const injury of team.injuries ?? []) {
      const athlete = injury.athlete;
      const displayName = athlete?.displayName ?? "";
      const firstName = athlete?.firstName ?? displayName.split(" ")[0] ?? "";
      const lastName = athlete?.lastName ?? displayName.split(" ").slice(1).join(" ") ?? "";
      const status = normalizeStatus(injury.status);
      const comment = injury.shortComment ?? injury.longComment ?? "";

      if (!displayName) continue;

      result.push({ name: displayName, firstName, lastName, status, comment, teamCode, teamName });
    }
  }

  return result;
}

export async function getInjuries(): Promise<PlayerInjury[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.data;
  try {
    const data = await fetchInjuries();
    cache = { data, fetchedAt: now };
    return data;
  } catch {
    return cache?.data ?? [];
  }
}

export async function GET(req: NextRequest) {
  const teamCode = req.nextUrl.searchParams.get("team")?.toUpperCase() ?? null;
  const playerName = req.nextUrl.searchParams.get("player")?.toLowerCase() ?? null;

  const injuries = await getInjuries();

  let filtered = injuries;
  if (teamCode) filtered = filtered.filter((p) => p.teamCode === teamCode);
  if (playerName) {
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(playerName) ||
        p.lastName.toLowerCase().includes(playerName),
    );
  }

  return NextResponse.json({ ok: true, count: filtered.length, injuries: filtered });
}
