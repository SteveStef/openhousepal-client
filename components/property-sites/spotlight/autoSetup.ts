'use client'

// A new Spotlight's first-time setup - the standout amenities, the highlights, the short story and
// "About the town" - so the page is complete before the agent touches anything. The editor runs it
// on first open; the AI helper's chat runs the same steps right after it makes a Spotlight (owner,
// 11/01: "it should complete the entire thing from the listing data"). Whichever runs first marks
// auto_setup_done, so it never runs twice. Each AI step is one small copywriter call on the agent's
// monthly AI allowance.
import api from '@/lib/api-service'
import type { TownFacts } from './TownSection'
import { allFeatureTags, autoFeatured } from './features'

export type SetupStep = { key: string; label: string; state: 'wait' | 'run' | 'done' | 'skip' | 'fail' }

export function tidyTown(value?: string | null): string {
  const v = (value || '').trim()
  if (!v || /[a-z]/.test(v)) return v
  return v.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

export function parseTownFacts(text: string): TownFacts | null {
  try {
    const raw = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
    const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
    const list = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.map(x => str(x, n)).filter(Boolean).slice(0, max) : [])
    const dt = raw.downtown && typeof raw.downtown === 'object' ? raw.downtown : {}
    const facts: TownFacts = {
      tagline: str(raw.tagline, 140),
      known_for: list(raw.known_for, 50, 6),
      downtown: { name: str(dt.name, 60), where: str(dt.where, 90), highlights: list(dt.highlights, 60, 4) },
      why_move: list(raw.why_move, 90, 4),
      getting_around: (Array.isArray(raw.getting_around) ? raw.getting_around : [])
        .map((g: any) => ({ label: str(g?.label, 80), detail: str(g?.detail, 60) })).filter((g: { label: string }) => g.label).slice(0, 3),
      outdoors: list(raw.outdoors, 60, 4),
      whats_new: str(raw.whats_new, 140),
    }
    return facts.tagline || facts.known_for?.length || facts.downtown?.name || facts.why_move?.length ? facts : null
  } catch {
    return null
  }
}

export function townContext(name: string, p: { state?: string | null; county?: string | null; township?: string | null }): string {
  return [`Town: ${name}${p.state ? `, ${p.state}` : ''}`, p.county && `County: ${tidyTown(String(p.county).replace(/-[A-Za-z]{2}$/, ''))}`,
    p.township && `Township: ${tidyTown(p.township)}`].filter(Boolean).join('\n')
}

/** Runs the setup on a saved Spotlight (the chat's version - the editor keeps its own live state).
 *  `onSteps` gets the step list as it moves. Saves once at the end; never throws. */
export async function runSpotlightSetup(siteId: string, onSteps: (s: SetupStep[]) => void): Promise<{ ok: boolean; message: string }> {
  const r = await api.propertySites.get(siteId)
  const site = r.success ? r.data : null
  if (!site) return { ok: false, message: "I couldn't open the Spotlight - the editor finishes the setup when you open it." }
  const d = site.draft_data || {}
  if (d.auto_setup_done) return { ok: true, message: 'Already set up.' }
  const snap = site.property_snapshot
  const original = snap.description || ''
  const description = d.description_override || original
  const f = snap.features
  const tags = f ? allFeatureTags({ interior: f.interior || [], exterior: f.exterior || [], lifestyle: f.lifestyle || [], community: f.community || [], other: f.other || [] }) : []
  const cityName = tidyTown(snap.city) || ''
  let steps: SetupStep[] = [
    { key: 'featured', label: 'Picking the standout amenities', state: (d.featured_amenities || []).length || !tags.length ? 'skip' : 'wait' },
    { key: 'highlights', label: 'Writing the highlights', state: (d.highlights || []).length || !description.trim() ? 'skip' : 'wait' },
    { key: 'story', label: 'Polishing the property story', state: original.trim() ? 'wait' : 'skip' },
    { key: 'town', label: cityName ? `Writing about ${cityName}` : 'Writing about the town', state: d.town_story?.body || d.town_story?.facts || !cityName ? 'skip' : 'wait' },
  ]
  const mark = (key: string, state: SetupStep['state']) => { steps = steps.map(s => (s.key === key ? { ...s, state } : s)); onSteps(steps) }
  onSteps(steps)
  const patch: Record<string, unknown> = { auto_setup_done: true }
  if (steps[0].state === 'wait') {
    mark('featured', 'run')
    patch.featured_amenities = autoFeatured(tags)
    await new Promise(res => setTimeout(res, 450))
    mark('featured', 'done')
  }
  const jobs: Promise<void>[] = []
  if (steps[1].state === 'wait') {
    mark('highlights', 'run')
    jobs.push(api.ai.copywrite({ purpose: 'property_site_highlights', context: description }).then(res => {
      const list = res.success && res.data?.text ? res.data.text.split('\n').map(l => l.replace(/^[\s\-*•]+/, '').trim()).filter(Boolean) : []
      if (list.length) patch.highlights = list.slice(0, 8)
      mark('highlights', list.length ? 'done' : 'fail')
    }))
  }
  if (steps[2].state === 'wait') {
    mark('story', 'run')
    jobs.push(api.ai.copywrite({ purpose: 'property_site_story_short', context: original }).then(res => {
      const short = res.success && res.data?.text ? res.data.text.trim() : ''
      if (short) Object.assign(patch, { story_short: short, description_override: short, story_mode: 'short' })
      mark('story', short ? 'done' : 'fail')
    }))
  }
  if (steps[3].state === 'wait') {
    mark('town', 'run')
    jobs.push(api.ai.copywrite({ purpose: 'property_site_town_facts', context: townContext(cityName, snap) }).then(res => {
      const facts = res.success && res.data?.text ? parseTownFacts(res.data.text) : null
      if (facts) patch.town_story = { name: cityName, body: '', hidden: false, facts }
      mark('town', facts ? 'done' : 'fail')
    }))
  }
  await Promise.all(jobs)
  const saved = await api.propertySites.updateDraft(siteId, patch as any)
  const failed = steps.filter(s => s.state === 'fail').length
  if (!saved.success) return { ok: false, message: saved.error || "Couldn't save the setup - the editor finishes it when you open it." }
  return { ok: true, message: failed ? 'Ready - a part or two needs a look in the editor.' : 'Ready - every section is written. Review it and publish when you like.' }
}
