// What the engine's final check says about a report, in the agent's words (Pricing step), and whether a
// report is only 'stale' (a save after the check - a free re-stamp clears it). Moved out of the builder page
// so the Review editor uses the same rules.
import { CmaReport } from '@/types'

export function cmaQaBlocking(report: CmaReport): string[] {
  const estimate = report.pricing?.ai_estimate
  const qa = estimate?.qa_result
  const blocking = [
    ...(estimate?.qa_blocking || []),
    ...(qa?.blocking_errors || []),
  ].filter(Boolean)
  if (qa?.export_allowed === false && blocking.length === 0) {
    blocking.push('Deterministic final QA has not approved this report for export.')
  }
  return Array.from(new Set(blocking))
}

// Matches only the handful of blocking messages that mean "the saved report no longer matches
// what was last checked" (comps/pricing/scoring edited, or the artifact hash is simply stale) -
// recompute-valuation reruns the same deterministic pass against the CURRENT data and genuinely
// clears these. Anything else (e.g. "Comp #3 describes a system as original without supporting
// property data") is a real factual/reasoning problem the generation pass itself flagged in the
// comp notes or methodology text - recompute does not rewrite that prose (see handleRecompute's
// own comment: "no comp notes rewritten"), so it would just spend an AI call re-checking the exact
// same unchanged text and fail again. Auto-fixing must be limited to the former; the latter needs
// a real regenerate or a manual edit, so it's surfaced to the agent immediately instead of stalling
// on a recompute that can never resolve it.
const STALE_ARTIFACT_PATTERNS = [
  /changed after (deterministic )?final[- ]artifact qa/i,
  /changed after final qa/i,
  /has not passed deterministic final-artifact qa/i,
  /did not approve this report for export/i,
  /deterministic final qa has not approved this report for export/i,
  // The live hash-mismatch message from the backend's own _report_qa_blocking ("The saved
  // client artifact changed after deterministic final QA.") - "deterministic" sits between
  // "after" and "final" here, which none of the patterns above match, and this is the single
  // most common staleness signal (fires on any post-generation save that hasn't re-stamped).
  /client artifact changed after/i,
]
export function isStaleArtifactOnly(blockers: string[]): boolean {
  return blockers.length > 0 && blockers.every(b => STALE_ARTIFACT_PATTERNS.some(re => re.test(b)))
}

export function plainCmaQaIssue(raw: string): string {
  const text = String(raw || '').replace(/\s+/g, ' ').trim()
  const lower = text.toLowerCase()
  if (/offer/.test(lower) && /(stale|older|mismatch|does not match|inconsistent)/.test(lower)) {
    return 'The offer section is using a value that does not match the final report.'
  }
  if (/(system|mechanical|renovation)/.test(lower) && /(missing|unknown|unverified|unsupported|age)/.test(lower)) {
    return 'A condition statement relies on missing information instead of a confirmed fact.'
  }
  if (/(range)/.test(lower) && /(stale|mismatch|does not match|authoritative|final)/.test(lower)) {
    return 'A displayed valuation range does not match the final approved range.'
  }
  if (/(list price|asking price)/.test(lower) && /(stale|mismatch|does not match|incorrect)/.test(lower)) {
    return 'A report section is using the wrong current list price.'
  }
  if (/(fmv|fair market value|final value)/.test(lower) && /(stale|mismatch|does not match|authoritative|incorrect)/.test(lower)) {
    return 'A report section is using a value that does not match the final valuation.'
  }
  if (/(artifact|report)/.test(lower) && /(changed after|fingerprint|final qa|revalidat)/.test(lower)) {
    return 'The report changed after its final check and needs to be checked again.'
  }
  if (/(qa|consistency check)/.test(lower) && /(not approved|has not approved|not run|incomplete)/.test(lower)) {
    return 'The final consistency check has not approved this report yet.'
  }
  if (/(comp|subject|property)/.test(lower) && /(unsupported|unmatching|not found|wrong entity|does not match)/.test(lower)) {
    return 'A property or comp contains a number that is not supported by its saved record.'
  }
  if (/(raw.*id|unresolved|property id|mls id)/.test(lower)) {
    return 'A comp reference needs to be replaced with its property name.'
  }
  const firstSentence = text.replace(/([.!?])\s+/g, '$1\u0000').split('\u0000')[0] || text
  const cleaned = firstSentence
    .replace(/^[A-Z0-9_ -]{3,40}:\s*/i, '')
    .replace(/\b(comp_inferred|model_judgment|signals?|beta|fallback heuristic|audit fmv)\b/gi, 'internal check')
  return cleaned.length > 170 ? `${cleaned.slice(0, 167).trimEnd()}...` : cleaned
}

export function cmaQaReview(report: CmaReport) {
  const estimate = report.pricing?.ai_estimate
  const qa = estimate?.qa_result
  const blockers = cmaQaBlocking(report)
  const warnings = [
    ...(qa?.warnings || []).filter(Boolean),
    ...(!qa ? ['The final consistency check has not run yet.'] : []),
  ]
  const activeRaw = [...blockers, ...warnings]
  const issues = Array.from(new Set(activeRaw.map(plainCmaQaIssue).filter(Boolean)))
  return {
    status: blockers.length > 0 ? 'Blocked' as const : warnings.length > 0 ? 'Warning' as const : 'Passed' as const,
    issues,
    blockers,
    warnings,
    corrections: (qa?.corrections || []).filter(Boolean),
    flags: (estimate?.qa_flags || []).filter(Boolean),
    checks: qa?.checks_run || [],
    checkedAt: qa?.checked_at,
  }
}
