// Feature ranking for both Spotlight templates: which MLS feature tags are "big ticket" (a pool,
// a guest house, a home theater) versus everyday details (ceiling fans, crown molding) - so the
// signature items lead with a symbol, and the long tail reads as a quiet, balanced list instead of
// one endless Interior column next to a two-line Exterior one.
import type { ComponentType } from 'react'
import {
  ArrowUpDown, Bath, BookOpen, Car, ChefHat, Clapperboard, Coffee, Cpu, Droplets, Dumbbell, Flame, Flower2, Gem,
  Home, Landmark, Layers, MapPin, Martini, Mountain, Receipt, Ruler, Sailboat, ShieldCheck, Shirt, Snowflake, Sun,
  Thermometer, Trees, Trophy, UtensilsCrossed, Warehouse, Waves, Wine, Zap,
} from 'lucide-react'
import type { KeyFact, PropertySiteFeatures } from './model'

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>

// [pattern, score, icon] - the first match wins, so more specific patterns come first.
const RULES: [RegExp, number, Icon][] = [
  [/pool table|billiard|game room/i, 48, Trophy],
  [/\bpool\b|swimming/i, 100, Waves],
  [/water ?front|\bdock\b|boat|lake ?front|river ?front|ocean|bay ?front|beach/i, 96, Sailboat],
  [/guest ?(house|suite|quarters|cottage)|carriage house|in[- ]law|accessory dwelling|au pair|2nd dwelling|apartment/i, 92, Home],
  [/barn|stable|equestrian|horse/i, 90, Warehouse],
  [/hot tub|\bspa\b|jacuzzi|sauna|steam room/i, 88, Droplets],
  [/tennis|pickleball|sport ?court|basketball|putting green|golf/i, 88, Trophy],
  [/elevator/i, 86, ArrowUpDown],
  [/theater|theatre|media room|screening/i, 86, Clapperboard],
  [/wine/i, 82, Wine],
  [/outdoor kitchen|summer kitchen|built[- ]in grill/i, 80, Flame],
  [/gym|exercise|fitness/i, 78, Dumbbell],
  [/(three|four|five|six|seven|eight|[3-9])[- ]?car|car lift|motor court/i, 78, Car],
  [/gourmet|chef|2nd kitchen|second kitchen|kitchen - gourmet/i, 76, ChefHat],
  [/view|vista|panoramic/i, 74, Mountain],
  [/gated/i, 72, ShieldCheck],
  [/generator/i, 70, Zap],
  [/solar/i, 68, Sun],
  [/butler/i, 66, ChefHat],
  [/wet bar|\bbar\b/i, 64, Martini],
  [/smart home|home automation|audio|surround/i, 62, Cpu],
  [/security|alarm/i, 50, ShieldCheck],
  [/fireplace/i, 60, Flame],
  [/library|study|office/i, 56, BookOpen],
  [/finished basement|basement - finished|walk[- ]?out/i, 55, Layers],
  [/garage/i, 52, Car],
  [/patio|deck|terrace|porch|balcony|pergola|gazebo|courtyard/i, 50, Sun],
  [/primary (bath|suite)|spa bath|soaking tub|jetted|walk-in shower/i, 46, Bath],
  [/greenhouse|garden|orchard/i, 45, Flower2],
  [/hardscape|landscap|water feature|fountain/i, 44, Trees],
  [/skylight|vaulted|cathedral|high ceiling|two[- ]story|2[- ]story/i, 40, Sun],
  [/island/i, 40, UtensilsCrossed],
  [/walk-?in closet/i, 36, Shirt],
  [/hardwood|wood floor|marble|stone floor/i, 34, Gem],
  [/built-?ins/i, 30, BookOpen],
  [/pantry/i, 30, UtensilsCrossed],
  [/breakfast/i, 28, Coffee],
  [/sprinkler|irrigation/i, 26, Droplets],
  [/central air|central a\/c|zoned/i, 22, Snowflake],
  [/crown molding|wainscot|coffered|tray ceiling/i, 22, Gem],
]

export interface RankedFeature { label: string; display: string; score: number; icon: Icon }

// MLS tags read "Kitchen - Gourmet" / "Bathroom - Soaking Tub" - shown as "Gourmet Kitchen" /
// "Soaking Tub". The raw tag stays the key everywhere (featured picks, de-duping).
const LEADING_ADJ = new Set(['gourmet', 'eat-in', 'traditional', 'open', 'galley', 'country', 'formal', 'efficiency', 'updated', 'custom', 'gas', 'wood', 'electric'])
export function prettyFeature(label: string): string {
  const m = label.match(/^([^-]+?)\s+-\s+(.+)$/)
  if (!m) return label
  const [, left, right] = m
  if (LEADING_ADJ.has(right.trim().toLowerCase())) return `${right.trim()} ${left.trim()}`
  if (!/\s/.test(right.trim())) return `${left.trim()} ${right.trim()}`
  return right.trim()
}

export function rankFeature(label: string): RankedFeature {
  const display = prettyFeature(label)
  for (const [re, score, icon] of RULES) if (re.test(label)) return { label, display, score, icon }
  return { label, display, score: 10, icon: Gem }
}

export function allFeatureTags(f: PropertySiteFeatures): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of [...f.interior, ...f.exterior, ...f.lifestyle, ...f.community, ...f.other]) {
    const v = String(t || '').trim()
    if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); out.push(v) }
  }
  return out
}

// The big-ticket items worth pre-selecting as "featured" - a pool over a new railing.
export function autoFeatured(tags: string[], max = 8): string[] {
  return tags.map(rankFeature).filter(r => r.score >= 44).sort((a, b) => b.score - a.score).slice(0, max).map(r => r.label)
}

// Signature items (with a symbol) + everything else, for the Features section.
export function splitFeatures(tags: string[], featured: string[]): { signature: RankedFeature[]; rest: string[] } {
  const pool = featured.length ? featured : autoFeatured(tags, 12)
  const ranked = pool.map(rankFeature).sort((a, b) => b.score - a.score)
  // Variety first: one tile per kind of thing (one bath item, one kitchen item...), then fill.
  const firstPass: RankedFeature[] = []
  const seenIcons = new Set<Icon>()
  for (const r of ranked) if (!seenIcons.has(r.icon)) { seenIcons.add(r.icon); firstPass.push(r) }
  const signature = [...firstPass, ...ranked.filter(r => !firstPass.includes(r))].slice(0, 8)
  const picked = new Set(signature.map(s => s.label.toLowerCase()))
  return { signature, rest: tags.filter(t => !picked.has(t.toLowerCase())) }
}

// ---------- specifications, grouped ----------

const SPEC_GROUPS: { title: string; icon: Icon; labels: string[] }[] = [
  { title: 'The residence', icon: Home, labels: ['Property type', 'Architectural style', 'Year built', 'Interior', 'Stories', 'Bedrooms', 'Bathrooms', 'New construction'] },
  { title: 'The grounds', icon: Trees, labels: ['Lot', 'Garage', 'Parking'] },
  { title: 'Systems & finishes', icon: Thermometer, labels: ['Heating', 'Cooling', 'Flooring', 'Basement', 'Fireplaces', 'Water', 'Sewer'] },
  { title: 'Ownership', icon: Receipt, labels: ['Annual taxes', 'HOA dues', 'HOA includes', 'Status', 'Days on market', 'MLS #'] },
  { title: 'Setting', icon: MapPin, labels: ['Subdivision', 'County', 'Township'] },
]

export interface SpecGroup { title: string; icon: Icon; facts: KeyFact[] }

export function groupSpecs(facts: KeyFact[]): SpecGroup[] {
  const used = new Set<string>()
  const groups: SpecGroup[] = SPEC_GROUPS.map(g => {
    const list = g.labels.map(l => facts.find(f => f.label === l)).filter(Boolean) as KeyFact[]
    list.forEach(f => used.add(f.label))
    return { title: g.title, icon: g.icon, facts: list }
  })
  const other = facts.filter(f => !used.has(f.label))
  if (other.length) groups.push({ title: 'Also of note', icon: Ruler, facts: other })
  return groups.filter(g => g.facts.length > 0)
}

export { Landmark }
