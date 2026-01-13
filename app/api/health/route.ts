// app/api/health/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ⚠️ Prisma => forcer Node.js (pas Edge)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const teamCount = await prisma.team.count()
    return NextResponse.json({
      ok: true,
      service: 'betalyze',
      db: 'sqlite',
      teamCount,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    // TEMP: renvoyer l'erreur pour debug (on retirera après)
    return NextResponse.json(
      {
        ok: false,
        error: 'Database connection failed',
        message: String(err?.message ?? err),
        stack: err?.stack ?? null,
      },
      { status: 500 },
    )
  }
}