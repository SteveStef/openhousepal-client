'use client'

import { Plus, Trash2 } from 'lucide-react'
import MoneyInput from './MoneyInput'

export interface EditableLineItem {
  id: string
  label: string
  amount?: number | null
  enabled?: boolean
}

function newLineItemId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `li-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// Freeform, agent-editable expense/credit list used across the Financial Tools (mortgage payoffs,
// seller closing costs, repairs, buyer closing costs, prepaids, inspections). Suggested labels are
// quick-add chips, not a fixed set of fields - the agent can add/edit/remove anything.
export default function LineItemList<T extends EditableLineItem>({ items, onChange, suggestedLabels, showEnabledToggle = false, totalLabel }: {
  items: T[]
  onChange: (items: T[]) => void
  suggestedLabels?: string[]
  showEnabledToggle?: boolean
  totalLabel?: string
}) {
  const addItem = (label = '') => {
    onChange([...items, { id: newLineItemId(), label, amount: null, enabled: true } as T])
  }
  const updateItem = (id: string, patch: Partial<EditableLineItem>) => {
    onChange(items.map(i => i.id === id ? { ...i, ...patch } : i))
  }
  const removeItem = (id: string) => onChange(items.filter(i => i.id !== id))

  const total = items.reduce((sum, i) => sum + ((showEnabledToggle && i.enabled === false) ? 0 : (i.amount || 0)), 0)
  const usedLabels = new Set(items.map(i => i.label))
  const availableSuggestions = (suggestedLabels || []).filter(l => !usedLabels.has(l))

  return (
    <div>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2">
            {showEnabledToggle && (
              <input
                type="checkbox"
                checked={item.enabled !== false}
                onChange={e => updateItem(item.id, { enabled: e.target.checked })}
                className="h-4 w-4 shrink-0 rounded border-gray-300 text-[#C9A24D] focus:ring-[#C9A24D]"
              />
            )}
            <input
              value={item.label}
              onChange={e => updateItem(item.id, { label: e.target.value })}
              placeholder="Description"
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white"
            />
            <MoneyInput value={item.amount} onChange={v => updateItem(item.id, { amount: v })} className="w-36 shrink-0" />
            <button onClick={() => removeItem(item.id)} className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {availableSuggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {availableSuggestions.map(label => (
            <button
              key={label}
              onClick={() => addItem(label)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-[10px] font-bold text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-400"
            >
              <Plus className="h-3 w-3" /> {label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <button onClick={() => addItem()} className="inline-flex items-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 px-3 py-2 text-xs font-black text-gray-400 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700">
          <Plus className="h-3.5 w-3.5" /> Add Custom
        </button>
        {totalLabel && (
          <p className="text-sm font-black text-[#111827] dark:text-white">{totalLabel}: <span className="text-[#8b7355] dark:text-[#d7b974]">{total.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</span></p>
        )}
      </div>
    </div>
  )
}
