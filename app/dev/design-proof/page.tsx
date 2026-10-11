import { notFound } from 'next/navigation'
import ProofGrid, { ProofParams } from './ProofGrid'
import { DESIGN_SITUATIONS } from '@/lib/studio/designSituations'
import type { DesignColorMode, DesignStyleId } from '@/types'

// Dev-only art-direction proof sheet: /dev/design-proof?f=instagram_post&v=base,long&s=modern_luxury&c=light
//   f    design type (required)                    sit   situations, comma list (default: all for f)
//   comp compositions, comma list (default: all)   s     styles, comma list        c   colors, comma list
//   v    content variants (see fixtures.ts)        w     tile width px (default 320)   labels=0 hides captions
// Server-rendered at fixed widths, so a headless screenshot needs no hydration. Never served in production.
export default async function DesignProofPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const q = await searchParams
  const list = (v: string | undefined, fallback: string[]) => (v && v !== 'all' ? v.split(',').map(s => s.trim()).filter(Boolean) : fallback)
  const designType = q.f || 'instagram_post'
  const params: ProofParams = {
    designType,
    situations: list(q.sit, DESIGN_SITUATIONS.filter(s => s.formats.includes(designType)).map(s => s.id)),
    compositions: q.comp && q.comp !== 'all' ? q.comp.split(',') : null,
    styles: list(q.s, ['modern_luxury']) as DesignStyleId[],
    colors: list(q.c, ['light']) as DesignColorMode[],
    variants: list(q.v, ['base']),
    width: Math.max(120, Math.min(900, Number(q.w) || 320)),
    showLabels: q.labels !== '0',
    flow: q.flow === '1',
  }
  return <ProofGrid params={params} />
}
