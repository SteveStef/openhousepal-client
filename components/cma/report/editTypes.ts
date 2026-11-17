// What the Review editor hands the report so its own elements become editable (see CmaReportView).
// With no hooks the report is exactly the client page. Nothing here runs for a client.
import type { ReactNode } from 'react'
import type { CmaComparable, CmaQualityAssessment } from '@/types'
import type { CmaGuidanceSection } from '@/lib/cma'
import type { CmaFigureKey, CmaTextKey } from '@/lib/cmaReport'

export type EditorComp = CmaComparable & { _hidden: boolean; _removed: boolean }

export interface CmaSectionState {
  /** Switched off: clients don't get it (the editor still shows it, greyed). */
  hidden: boolean
  /** Nothing to show yet (e.g. the map with no comps). */
  empty: boolean
  /** Where it sits among the sections that can move. */
  first: boolean
  last: boolean
  /** The subject always opens the report (it is the PDF's cover). */
  fixed: boolean
}

export interface CmaEditHooks {
  /** Wraps a whole section with the editor's bar (move, hide, delete) and its motion. */
  section: (key: string, label: string, state: CmaSectionState, content: ReactNode) => ReactNode
  /** The bar on a comp's card: move it, hide it from the client, take it out of the report, put it back. */
  compBar: (comp: EditorComp, shownIndex: number | null, state: { first: boolean; last: boolean }) => ReactNode
  /** Wraps a comp's card (motion when comps move). */
  wrapComp: (comp: EditorComp, node: ReactNode) => ReactNode
  /** The "add a comp" tile after the last comp (a short "comps are locked" line once the AI has written the report). */
  addCompTile: () => ReactNode
  /** The AI has written the report: the comps are locked, so the ones taken off earlier are not listed (there is
   *  no way back for them - different comps means a new CMA). */
  compsLocked?: boolean
  /** The AI has written the report: each comp's ratings and its classification are shown, not editable (11/17). */
  ratingsLocked?: boolean
  /** A small show / hide switch on one part of a section (e.g. "Inspection Concerns"). */
  partBar: (key: string, label: string, hidden: boolean) => ReactNode
  setText: (key: CmaTextKey, sections: CmaGuidanceSection[]) => void
  /** Goes up when a text is put back to the report's own wording, so its typing spots redraw. */
  textVersion: (key: CmaTextKey) => number
  /** "Back to the original" under a text the agent changed (null when it is unchanged). */
  textReset: (key: CmaTextKey) => ReactNode
  setLabel: (key: `title:${string}`, value: string) => void
  setFigure: (key: CmaFigureKey, value: number | null) => void
  /** A small "back to $378,000" under a number the agent changed (null when unchanged). */
  figureReset: (key: CmaFigureKey) => ReactNode
  setCompNote: (compId: string, text: string) => void
  setCompQuality: (compId: string, key: keyof CmaQualityAssessment, value: string) => void
  setCompStrength: (compId: string, value: string) => void
  /** Make this photo the first one for the subject ('subject') or a comp (its id). */
  pickPhoto: (who: string, url: string) => void
  setNote: (id: string, patch: { title?: string; body?: string }) => void
  setClientName: (value: string) => void
}
