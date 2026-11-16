// How an AI cost is said to an agent: as a share of their monthly AI (owner, 11/16: every AI button says about how
// much it will use before it is pressed, and how much it really used after).
export type AiShare = { usd: number; percent: number | null }

/** "0.4%", "0.02%", or "less than 0.01%" - never a bare "0%". Null when there is no monthly limit to share. */
export function aiSharePercent(s?: AiShare | null): string | null {
  if (!s || s.percent == null) return null
  const p = s.percent
  if (p <= 0) return null
  if (p < 0.01) return 'less than 0.01%'
  if (p < 1) return `${p.toFixed(p < 0.1 ? 2 : 1)}%`
  return `${Math.round(p)}%`
}

/** Before a press: "Uses about 0.02% of your monthly AI". */
export const aiUsesLine = (s?: AiShare | null) => { const p = aiSharePercent(s); return p ? `Uses ${p.startsWith('less') ? p : `about ${p}`} of your monthly AI` : 'Uses your monthly AI' }
/** After a press: "Used 0.02% of your monthly AI". */
export const aiUsedLine = (s?: AiShare | null) => { const p = aiSharePercent(s); return p ? `Used ${p} of your monthly AI` : null }
