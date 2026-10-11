'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import StyleThumbnail from '@/components/studio/design/StyleThumbnail'
import { DESIGN_SITUATIONS } from '@/lib/studio/designSituations'
import { getTemplatesFor } from '@/lib/studio/designTemplates'
import { getDesignFormat } from '@/lib/studio/designFormats'
import { AGENT } from '@/components/home/demos/realData'
import type { DesignColorMode, DesignStyleId } from '@/types'

const agent = {
  agentName: AGENT.name, agentTitle: 'REALTOR®', agentBrokerage: 'Compass RE', agentPhotoUrl: AGENT.photo,
  agentPhotoPosition: null, agentPhone: AGENT.phone, agentEmail: AGENT.email, agentHubSlug: 'peter-stefanatos',
}

function Gallery() {
  const q = useSearchParams()
  const designType = q.get('f') || 'instagram_post'
  const style = (q.get('s') || 'modern_luxury') as DesignStyleId
  const color = (q.get('c') || 'light') as DesignColorMode
  const only = q.get('sit')
  const cols = Number(q.get('w') || 360)
  const format = getDesignFormat(designType)
  const situations = DESIGN_SITUATIONS.filter(s => s.formats.includes(designType) && (!only || s.id === only))
  // ?rows=styles&sit=just_sold - one row per style for a single situation.
  if (q.get('rows') === 'styles' && only) {
    return (
      <div style={{ padding: 24, background: '#e9e7e2', minHeight: '100vh', fontFamily: 'system-ui' }}>
        {(['modern_luxury', 'editorial', 'minimal', 'bold'] as DesignStyleId[]).map(st => (
          <div key={st} data-row={st} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>{st} · {color}</h2>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              {getTemplatesFor(only, designType).map(t => (
                <div key={t.id} style={{ width: cols }}>
                  <StyleThumbnail designType={designType} styleId={st} colorMode={color} templateId={t.id} situation={only} agent={agent} rounded={false} />
                  <p style={{ fontSize: 12, marginTop: 4 }}>{t.label} <span style={{ color: '#888' }}>({t.composition})</span></p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div style={{ padding: 24, background: '#e9e7e2', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>{format?.label} · {style} · {color}</h1>
      {situations.map(s => (
        <div key={s.id} data-row={s.id} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>{s.label}</h2>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {getTemplatesFor(s.id, designType).map(t => (
              <div key={t.id} style={{ width: cols }}>
                <StyleThumbnail designType={designType} styleId={style} colorMode={color} templateId={t.id} situation={s.id} agent={agent} rounded={false} />
                <p style={{ fontSize: 12, marginTop: 4 }}>{t.label} <span style={{ color: '#888' }}>({t.composition})</span></p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function GalleryClient() {
  return <Suspense><Gallery /></Suspense>
}
