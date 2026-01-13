// app/api/nfl/players/[id]/statistics/route.ts
import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.APISPORTS_KEY;
const API_BASE =
  process.env.APISPORTS_NFL_URL ?? "https://v1.american-football.api-sports.io";
const DEFAULT_SEASON = process.env.APISPORTS_NFL_SEASON ?? "2025";
const PLACEHOLDER_IMAGE_HASH =
  "72f0bbb253ab54961cd5d66148e55aceb3e6bc9823da43e57a6e0812e5427430";
const PLACEHOLDER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const imagePlaceholderCache = new Map<
  string,
  { isPlaceholder: boolean; checkedAt: number }
>();

type StatGroup = { name?: string; statistics?: Array<{ name?: string; value?: any }> };

function normalizeGroups(groups: StatGroup[] | undefined) {
  if (!Array.isArray(groups)) return {};
  const out: Record<string, Record<string, any>> = {};
  for (const g of groups) {
    const label = (g?.name ?? "Other").toString();
    const stats: Record<string, any> = {};
    for (const item of g?.statistics ?? []) {
      if (!item?.name) continue;
      stats[item.name] = item.value;
    }
    out[label] = stats;
  }
  return out;
}

async function isPlaceholderImage(url: string) {
  const cached = imagePlaceholderCache.get(url);
  const now = Date.now();
  if (cached && now - cached.checkedAt < PLACEHOLDER_CACHE_TTL_MS) {
    return cached.isPlaceholder;
  }
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    const hash = createHash("sha256").update(buf).digest("hex");
    const isPlaceholder = hash === PLACEHOLDER_IMAGE_HASH;
    imagePlaceholderCache.set(url, { isPlaceholder, checkedAt: now });
    return isPlaceholder;
  } catch {
    return false;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params?: { id?: string | string[] } | Promise<{ id?: string | string[] }> },
) {
  const resolvedParams = await params;
  const rawIdParam = Array.isArray(resolvedParams?.id)
    ? resolvedParams?.id[0]
    : resolvedParams?.id;
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  const idx = segments.findIndex((s) => s === "players");
  const rawIdPath = idx >= 0 ? segments[idx + 1] : null;
  const rawId = rawIdParam ?? rawIdPath;
  const playerId = Number(rawId);
  const season = req.nextUrl.searchParams.get("season") ?? DEFAULT_SEASON;

  if (!Number.isFinite(playerId)) {
    return NextResponse.json({ error: "Missing or invalid player id" }, { status: 400 });
  }
  if (!API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  try {
    // L'API retourne des statistiques NFL uniquement avec le paramètre "id" (pas besoin de league).
    const paramVariants = ["id", "player"] as const;
    const attempts: Array<{ url: string; status?: number; errors?: any }> = [];
    let finalJson: any = null;

    for (const param of paramVariants) {
      const url = new URL("/players/statistics", API_BASE);
      url.searchParams.set(param, String(playerId));
      url.searchParams.set("season", String(season));

      const res = await fetch(url.toString(), {
        headers: { "x-apisports-key": API_KEY },
        cache: "no-store",
      });
      const textBody = await res.text().catch(() => "");
      let jsonBody: any = null;
      try {
        jsonBody = JSON.parse(textBody);
      } catch {
        jsonBody = textBody;
      }
      attempts.push({ url: url.toString(), status: res.status, errors: jsonBody?.errors });

      if (!res.ok) {
        continue;
      }

      const first = Array.isArray(jsonBody?.response) ? jsonBody.response[0] : null;
      if (!first) {
        finalJson = jsonBody;
        continue;
      }

      finalJson = jsonBody;
      const groups: StatGroup[] = Array.isArray(first?.teams?.[0]?.groups)
        ? first?.teams?.[0]?.groups
        : [];
      const statsByGroup = normalizeGroups(groups);

      const player = {
        id: first?.player?.id ?? playerId,
        name: first?.player?.name ?? null,
        image: first?.player?.image ?? null,
        team: first?.teams?.[0]?.team ?? null,
      };
      if (player.image && (await isPlaceholderImage(player.image))) {
        player.image = null;
      }

      return NextResponse.json({
        ok: true,
        season,
        player,
        stats: statsByGroup,
        rawGroups: groups,
      });
    }

    // Si on arrive ici : aucune réponse exploitable, on renvoie ok:false avec debug léger
    return NextResponse.json(
      {
        ok: false,
        season,
        player: { id: playerId },
        stats: {},
        attempts,
        raw: finalJson,
      },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error", message: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
