'use client'

import type { CSSProperties } from 'react'
import DesignCanvas, { DesignCanvasContext } from '@/components/studio/design/DesignCanvas'
import { getDesignFormat } from '@/lib/studio/designFormats'
import { DESIGN_SITUATIONS, getSituation } from '@/lib/studio/designSituations'
import { getTemplatesFor } from '@/lib/studio/designTemplates'
import type { DesignColorMode, DesignStyleId } from '@/types'
import { VARIANTS } from './fixtures'

// Renders the real DesignCanvas at a fixed pixel width (no measuring, no scaling) so the page is
// complete straight from the server - a headless browser can screenshot it with or without
// hydration. One row per template, one tile per (variant × style × color).
export interface ProofParams {
  designType: string
  situations: string[]
  compositions: string[] | null
  styles: DesignStyleId[]
  colors: DesignColorMode[]
  variants: string[]
  width: number
  showLabels: boolean
  flow?: boolean
}

export default function ProofGrid({ params }: { params: ProofParams }) {
  const format = getDesignFormat(params.designType)
  if (!format) return <p style={{ padding: 24 }}>Unknown format: {params.designType}</p>
  const situations = DESIGN_SITUATIONS.filter(s => s.formats.includes(params.designType) && params.situations.includes(s.id))
  const tileStyle: CSSProperties = { width: params.width, flexShrink: 0 }
  return (
    <div style={{ padding: 16, background: '#d9d6cf', minHeight: '100vh', fontFamily: 'system-ui', color: '#111' }}>
      <h1 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 10px' }}>{format.label} ({format.designType}) · styles: {params.styles.join(', ')} · colors: {params.colors.join(', ')} · variants: {params.variants.join(', ')}</h1>
      {situations.map(s => (
        <div key={s.id} data-situation={s.id} style={{ marginBottom: 18, ...(params.flow ? { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' } : {}) }}>
          {getTemplatesFor(s.id, params.designType).filter(t => !params.compositions || params.compositions.includes(t.composition)).map(t => (
            <div key={t.id} data-template={t.id} style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 12, fontWeight: 800, margin: '0 0 4px' }}>{s.label} · {t.label} <span style={{ color: '#666', fontWeight: 600 }}>({t.composition})</span></h2>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {params.variants.map(vid => {
                  const v = VARIANTS[vid]
                  if (!v) return null
                  const leadGen = getSituation(s.id)?.propertyAttached === false
                  const property = leadGen ? null : v.property
                  const options = leadGen && v.leadPhoto !== undefined ? { ...v.options, heroPhoto: v.leadPhoto } : v.options
                  const built = t.buildBlocks(property, v.messaging, options)
                  const blocks = v.socialButton ? built.map(bl => bl.type === 'headline' ? { ...bl, data: { ...bl.data, socialButton: v.socialButton } } : bl) : built
                  return params.styles.map(styleId => params.colors.map(colorMode => {
                    const ctx: DesignCanvasContext = {
                      format, styleId, colorMode, composition: t.composition, layoutHints: t.layoutHints, situation: s.id,
                      property, ...v.agent, brandKit: v.brandKit, brandingMode: 'personal',
                    }
                    const key = `${vid}-${styleId}-${colorMode}`
                    return (
                      <div key={key} data-tile={key} style={tileStyle}>
                        <div style={{ boxShadow: '0 2px 10px rgba(0,0,0,.25)' }}><DesignCanvas blocks={blocks} ctx={ctx} /></div>
                        {params.showLabels && <p style={{ fontSize: 10, margin: '3px 0 0', color: '#333' }}>{v.label}{params.styles.length > 1 ? ` · ${styleId}` : ''}{params.colors.length > 1 ? ` · ${colorMode}` : ''}</p>}
                      </div>
                    )
                  }))
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
