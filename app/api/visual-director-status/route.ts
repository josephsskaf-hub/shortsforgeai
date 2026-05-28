import { NextResponse } from 'next/server'

export const runtime = 'edge'

export function GET() {
  return NextResponse.json({
    phase1: true,
    phase2: true,
    phase3: true,
    version: '3.0',
  })
}
