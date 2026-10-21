'use client'

// "How we got there" - the agent-only adjustment grid (10/20). Each verified sale, the dollar
// adjustments that move it toward the subject, its share of the value, and every step from the
// adjusted sales to the final value. Deliberately NOT in the client report or PDF: the agent opens
// it from the CMA builder to check (or explain) the number.
import { useState } from 'react'
import { X, Calculator } from 'lucide-react'
import { CmaAiEstimate } from '@/types'
import { buildAdjustmentGrid, CmaAdjustmentGridComp, formatMoney, formatSignedMoney } from '@/lib/cma'

export default function CmaHowWeGotThere({ estimate }: { estimate?: CmaAiEstimate | null }) {
  const [open, setOpen] = useState(false)
  const grid = buildAdjustmentGrid(estimate)
  if (!grid) return null
  const rows: { label: string, get: (c: CmaAdjustmentGridComp) => string, bold?: boolean }[] = [
    { label: 'Sold price', get: c => formatMoney(c.sale) },
    { label: 'Size (above grade)', get: c => formatSignedMoney(c.size) },
    // the comp's lower-level area the grid used - "est." when the MLS says finished but records no size
    { label: 'Lower level used', get: c => c.lowerLevelSqft == null ? '—' : `${c.lowerLevelSqft.toLocaleString()} sq ft${c.lowerLevelEstimated ? ' (est.)' : ''}` },
    { label: 'Finished lower level', get: c => formatSignedMoney(c.lowerLevel) },
    { label: 'Bathrooms', get: c => formatSignedMoney(c.baths) },
    { label: 'Garage', get: c => formatSignedMoney(c.garage) },
    ...(grid.hasSewer ? [{ label: 'Cesspool', get: (c: CmaAdjustmentGridComp) => formatSignedMoney(c.sewer) }] : []),
    ...(grid.comps.some(c => c.lot) ? [{ label: 'Lot size', get: (c: CmaAdjustmentGridComp) => formatSignedMoney(c.lot) }] : []),
    { label: 'Adjusted price', get: c => formatMoney(c.adjusted), bold: true },
    { label: 'Share of value', get: c => `${c.weightPct}%` },
  ]
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cma-btn mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-xs font-black uppercase tracking-wide text-gray-600 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-300"
      >
        <Calculator className="h-3.5 w-3.5" /> How we got there
      </button>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 sm:items-center sm:p-6" onClick={() => setOpen(false)}>
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-[#151517] sm:rounded-3xl sm:p-7"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#C9A24D]">Agent only - not in the client report</p>
                <h3 className="mt-1 text-xl font-black text-[#111827] dark:text-white">How we got there</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Each sale adjusted toward this home at one market rate
                  {grid.marketPsf ? ` (${formatMoney(grid.marketPsf)}/sq ft` : ''}
                  {grid.rates.size ? `; size ${formatMoney(grid.rates.size)}/sq ft` : ''}
                  {grid.rates.lowerLevel ? `, finished lower level ${formatMoney(grid.rates.lowerLevel)}/sq ft` : ''}
                  {grid.marketPsf ? ')' : ''}.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full bg-gray-100 p-2 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th />
                    {grid.comps.map(c => (
                      <th key={c.label} className="px-3 py-2 text-right text-[11px] font-black uppercase tracking-wide text-gray-500">
                        {c.label}<span className="block font-semibold normal-case tracking-normal text-gray-400">{c.address}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.label} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 pr-3 text-xs font-black uppercase tracking-wide text-gray-500">{r.label}</td>
                      {grid.comps.map(c => (
                        <td key={c.label} className={`px-3 py-2 text-right ${r.bold ? 'font-black text-[#8b7355] dark:text-[#d7b974]' : 'font-semibold text-[#111827] dark:text-white'}`}>{r.get(c)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              <summary className="cursor-pointer font-bold">What each adjustment is based on</summary>
              <ul className="mt-2 space-y-1">
                {grid.comps.map(c => (
                  <li key={c.label}><span className="font-bold">{c.label} ({c.address}):</span> {c.notes.join('; ') || 'no adjustments'}</li>
                ))}
              </ul>
            </details>

            <div className="mt-5 space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
              {grid.steps.map(s => (
                <div key={s.label}>
                  <div className="flex items-baseline justify-between gap-4">
                    <p className={`text-sm ${s.bold ? 'font-black' : 'font-bold'} text-[#111827] dark:text-white`}>{s.label}</p>
                    <p className={`font-black ${s.bold ? 'text-lg text-[#8b7355] dark:text-[#d7b974]' : 'text-sm text-[#111827] dark:text-white'}`}>
                      {s.value != null ? formatMoney(s.value) : formatSignedMoney(s.amount || 0)}
                    </p>
                  </div>
                  {s.note && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{s.note}</p>}
                </div>
              ))}
            </div>

            {grid.uncertainties.length > 0 && (
              <div className="mt-4 rounded-2xl bg-amber-50 p-4 dark:bg-amber-500/10">
                <p className="text-[11px] font-black uppercase tracking-wide text-amber-800 dark:text-amber-300">What the sales can&apos;t pin down</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-200">
                  {grid.uncertainties.map(u => <li key={u}>{u}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
