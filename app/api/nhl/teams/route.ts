export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

const NHL_API = process.env.NHL_API_URL ?? 'https://statsapi.web.nhl.com/api/v1'

export async function GET() {
  try {
    const r = await fetch(`${NHL_API}/teams`, { cache: 'no-store' })
    if (!r.ok) {
      const body = await r.text()
      return NextResponse.json({ ok: false, error: `Upstream ${r.status}`, body }, { status: 502 })
    }
    const data = await r.json() as any
    const teams = Array.isArray(data?.teams)
      ? data.teams.map((t: any) => ({
          id: t.id,
          name: t.name,
          teamName: t.teamName,
          abbreviation: t.abbreviation,
          locationName: t.locationName,
          division: t.division?.name ?? null,
          conference: t.conference?.name ?? null,
        }))
      : []

    return NextResponse.json({ ok: true, count: teams.length, teams })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 })
  }
}