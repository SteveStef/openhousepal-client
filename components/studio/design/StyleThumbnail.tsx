'use client'

import { useMemo, useRef, useState, memo, useEffect } from 'react'
import { BrandKit, DesignBlock, DesignColorMode, DesignStyleId, LinkedProperty } from '@/types'
import { getDesignFormat, PLACEHOLDER_PROPERTY } from '@/lib/studio/designFormats'
import { getTemplate, getTemplatesFor, TemplateBuildOptions } from '@/lib/studio/designTemplates'
import { DesignMessagingVariant, getSituation } from '@/lib/studio/designSituations'
import { DesignAgentInfo, SAMPLE_DESIGN_AGENT } from '@/lib/studio/designAgent'
import DesignCanvas, { DesignCanvasContext } from './DesignCanvas'

// Every preview renders the real DesignCanvas at a fixed base width and is scaled down with a CSS
// transform - a pixel-faithful miniature of the exact export, immune to browser minimum-font-size
// settings, at any tile size.
const BASE_WIDTH = 640

export const DesignPreview = memo(function DesignPreview({ blocks, ctx, className, rounded = true }: { blocks: DesignBlock[]; ctx: DesignCanvasContext; className?: string; rounded?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  // Sized from the ResizeObserver's own measurement (batched, once per frame for every preview on
  // the page) - reading clientWidth right after mount forced a full page layout per thumbnail,
  // which made opening the Look card / scrolling the editor stutter.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => { const w = e.contentRect.width; if (w) setScale(w / BASE_WIDTH) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div
      ref={wrapRef}
      className={`pointer-events-none relative w-full overflow-hidden ${rounded ? 'rounded-lg' : ''} ${className || ''}`}
      style={{ aspectRatio: String(ctx.format.aspectRatio) }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width: BASE_WIDTH, transform: `scale(${scale})`, transformOrigin: '0 0', visibility: scale ? 'visible' : 'hidden' }}>
        <DesignCanvas blocks={blocks} ctx={ctx} />
      </div>
    </div>
  )
})

// A live preview of a (situation, format, template, style, color) combination. With `property` /
// `blocks` / `agent` it shows the agent's real listing and branding (the wizard, the editor's
// Brand tab); without them it falls back to a realistic sample listing (the dashboard).
export default function StyleThumbnail({
  designType, styleId, colorMode = 'light', templateId, brandKit, className, situation, property, blocks, agent, messaging, buildOptions, rounded = true,
}: {
  designType: string
  styleId: DesignStyleId
  colorMode?: DesignColorMode
  templateId?: string
  brandKit?: BrandKit | null
  className?: string
  situation?: string | null
  property?: LinkedProperty | null
  blocks?: DesignBlock[]
  agent?: DesignAgentInfo | null
  messaging?: DesignMessagingVariant
  buildOptions?: TemplateBuildOptions
  rounded?: boolean
}) {
  const format = getDesignFormat(designType)
  const template = templateId ? getTemplate(templateId) : undefined
  const situationId = situation || (template && template.situationId !== 'any' ? template.situationId : null)
  const situationDef = situationId ? getSituation(situationId) : undefined
  const leadGen = situationDef?.propertyAttached === false
  const resolvedProperty = leadGen ? null : property === undefined ? PLACEHOLDER_PROPERTY : property
  const resolvedTemplate = template || (situationId ? getTemplatesFor(situationId, designType)[0] : undefined)

  const resolvedBlocks = useMemo(() => {
    if (blocks) return blocks
    if (!resolvedTemplate) return []
    return resolvedTemplate.buildBlocks(resolvedProperty, messaging, buildOptions || { openHouseDate: 'Sunday, October 12', openHouseTime: '1:00 – 3:00 PM' })
  }, [blocks, resolvedTemplate, resolvedProperty, messaging, buildOptions])

  if (!format) return null
  const a = agent || SAMPLE_DESIGN_AGENT
  const ctx: DesignCanvasContext = {
    format,
    styleId,
    colorMode,
    composition: resolvedTemplate?.composition,
    layoutHints: resolvedTemplate?.layoutHints,
    situation: situationId,
    property: resolvedProperty,
    ...a,
    brandKit: brandKit || null,
    brandingMode: 'personal',
  }
  return <DesignPreview blocks={resolvedBlocks} ctx={ctx} className={className} rounded={rounded} />
}
