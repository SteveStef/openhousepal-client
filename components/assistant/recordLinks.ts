// Maps a tool-call record reference (attached server-side to whatever produced it - see
// ai_orchestrator_service.py's _extract_record_refs/_extract_result_refs, reused by both the
// text assistant and Talk to OHP's /ai/realtime/tool-call) to the real OpenHousePal page for
// that record. Single source of truth so ChatThread.tsx and TalkToOHP.tsx render the exact
// same "why" link chips.
export const RECORD_LINKS: Record<string, (id: string) => string> = {
  lead: (id) => `/leads/${id}`,
  property: (id) => `/property/${id}`,
  open_house: (id) => `/open-houses/visitors/${id}`,
  cma: (id) => `/studio/cma/${id}`,
  showcase: (id) => `/showcases?showcase=${id}`,
}

export const RECORD_LABELS: Record<string, string> = {
  lead: 'Lead',
  property: 'Property',
  open_house: 'Open House',
  cma: 'CMA',
  showcase: 'Showcase',
}
