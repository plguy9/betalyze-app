import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Deprecated endpoint. Use /api/nba/sync-players-v2 (NBA v2 only).",
    },
    { status: 410 },
  );
}
