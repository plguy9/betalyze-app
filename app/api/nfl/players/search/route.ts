// app/api/nfl/players/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_SPORT = "nfl";
const MAX_LIMIT = 50;
const ALLOWED_POSITIONS = ["QB", "RB", "WR", "TE"];

type PlayerSearchRow = {
  externalId: string | null;
  firstName: string;
  lastName: string;
  position: string | null;
  team: {
    id: number;
    name: string;
    abbreviation: string | null;
  } | null;
};

function normalizeQuery(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeQuery(value).split(" ").filter(Boolean);
}

function buildName(firstName: string, lastName: string) {
  const parts = [firstName, lastName].filter(Boolean);
  return parts.join(" ").trim() || "Player";
}

function buildPlayerImage(externalId: number) {
  return `https://media.api-sports.io/american-football/players/${externalId}.png`;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const query = params.get("q") ?? "";
  const limit = Math.min(Number(params.get("limit") ?? 20) || 20, MAX_LIMIT);

  const needle = normalizeQuery(query);
  const tokens = tokenize(query);
  if (needle.length < 2 || tokens.length === 0) {
    return NextResponse.json({ ok: true, query, players: [] });
  }

  const whereTokens = tokens.map((token) => ({
    OR: [
      { firstName: { contains: token, mode: "insensitive" } },
      { lastName: { contains: token, mode: "insensitive" } },
    ],
  }));

  const positionFilters = ALLOWED_POSITIONS.map((pos) => ({
    position: { equals: pos, mode: "insensitive" as const },
  }));

  const results = await prisma.player.findMany({
    where: {
      sport: { equals: DEFAULT_SPORT, mode: "insensitive" },
      AND: [...whereTokens, { OR: positionFilters }],
    },
    select: {
      externalId: true,
      firstName: true,
      lastName: true,
      position: true,
      team: {
        select: {
          id: true,
          name: true,
          abbreviation: true,
        },
      },
    },
    take: MAX_LIMIT,
  });

  const ranked = (results as PlayerSearchRow[])
    .map((player) => {
      const name = buildName(player.firstName, player.lastName);
      const nameNorm = normalizeQuery(name);
      const score =
        nameNorm === needle
          ? 0
          : nameNorm.startsWith(needle)
            ? 1
            : nameNorm.split(" ").some((p) => p.startsWith(needle))
              ? 2
              : 3;
      return { player, score, nameNorm };
    })
    .sort((a, b) => a.score - b.score || a.nameNorm.localeCompare(b.nameNorm))
    .slice(0, limit);

  const payload = ranked
    .map(({ player }) => {
      const externalId = Number(player.externalId);
      if (!Number.isFinite(externalId)) return null;
      const image = buildPlayerImage(externalId);
      return {
        id: externalId,
        name: buildName(player.firstName, player.lastName),
        position: player.position,
        number: null,
        image,
        team: player.team
          ? {
              id: player.team.id,
              name: player.team.name,
              code: player.team.abbreviation,
              logo: null,
            }
          : { id: 0, name: "NFL", code: null, logo: null },
      };
    })
    .filter(Boolean);

  return NextResponse.json({ ok: true, query, count: payload.length, players: payload });
}
