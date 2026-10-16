import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

function resolveImageUrl(raw: string): URL | null {
  try {
    if (raw.startsWith('/')) return new URL(raw, INTERNAL_API_URL)
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url') || ''
  const url = resolveImageUrl(raw)
  if (!url) return NextResponse.json({ detail: 'Invalid image URL.' }, { status: 400 })

  const upstream = await fetch(url.toString(), { cache: 'no-store' })
  if (!upstream.ok) return NextResponse.json({ detail: 'Image could not be loaded.' }, { status: upstream.status })

  const contentType = upstream.headers.get('content-type') || 'image/jpeg'
  if (!contentType.toLowerCase().startsWith('image/')) {
    return NextResponse.json({ detail: 'URL did not return an image.' }, { status: 415 })
  }

  const body = await upstream.arrayBuffer()
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
