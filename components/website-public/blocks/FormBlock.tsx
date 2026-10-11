'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { SiteTheme } from '../types'
import { fontClass } from './fontClass'

interface FormQuestionField {
  id: string
  type: string
  label: string
  required?: boolean
}

interface FormQuestion extends FormQuestionField {
  fields?: FormQuestionField[]
}

interface PublicFormShape {
  formId: string
  title: string
  headline?: string | null
  subtitle?: string | null
  questions: FormQuestion[]
  successHeading?: string | null
  successMessage?: string | null
}

// Flattens contact_group questions (the real shape agent-built forms use, see
// backend/app/schemas/forms.py) into a plain list of fields to render - a real renderer for
// existing OHP forms, not a second form builder (Website Builder never edits questions/schema).
function flattenFields(questions: FormQuestion[]): FormQuestionField[] {
  const fields: FormQuestionField[] = []
  for (const q of questions) {
    if (q.type === 'statement') continue
    if (q.type === 'contact_group' && q.fields) {
      fields.push(...q.fields)
    } else {
      fields.push(q)
    }
  }
  return fields
}

export default function FormBlock({ data, theme, siteId }: { data: Record<string, any>; theme: SiteTheme; siteId?: string }) {
  const formId = data.form_id as string | undefined
  const [form, setForm] = useState<PublicFormShape | null>(null)
  const [loading, setLoading] = useState(true)
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!formId || !siteId) { setLoading(false); return }
    setLoading(true)
    fetch(`/api/website-forms/${formId}?site_id=${encodeURIComponent(siteId)}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(setForm)
      .catch(() => setForm(null))
      .finally(() => setLoading(false))
  }, [formId, siteId])

  if (!formId) return null
  if (!siteId) {
    // In-editor preview has no published site_id yet to fetch through - show a lightweight
    // placeholder instead of a spinner that would never resolve.
    return (
      <section className="mx-auto max-w-xl px-6 py-14 text-center text-sm font-semibold text-gray-400">
        Form preview available once your site is published.
      </section>
    )
  }
  if (loading) return (
    <section className="mx-auto max-w-xl px-6 py-14 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-300" /></section>
  )
  if (!form) return null

  const fields = flattenFields(form.questions)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/website-forms/${formId}?site_id=${encodeURIComponent(siteId!)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: Object.entries(values).map(([questionId, value]) => ({ questionId, value })) }),
    })
    const body = await res.json()
    setSubmitting(false)
    if (res.ok && body.success) {
      setDone(true)
    } else {
      setError(body.detail || 'Something went wrong. Please try again.')
    }
  }

  if (done) {
    return (
      <section className="mx-auto max-w-xl px-6 py-16 sm:py-20">
        <div className="rounded-3xl bg-white p-10 text-center shadow-[0_2px_30px_rgba(17,24,39,0.06)] ring-1 ring-black/[0.04]">
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-lg"
            style={{ backgroundColor: `${theme.secondary_color}20`, color: theme.secondary_color }}
          >
            ✓
          </div>
          <h2 className={`mt-4 text-2xl font-black ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>
            {form.successHeading || 'Thank you!'}
          </h2>
          {form.successMessage && <p className="mt-2 text-gray-600">{form.successMessage}</p>}
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-xl px-6 py-16 sm:py-20">
      <div className="rounded-3xl bg-white p-8 shadow-[0_2px_30px_rgba(17,24,39,0.06)] ring-1 ring-black/[0.04] sm:p-10">
        <h2 className={`text-center text-2xl font-black sm:text-3xl ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>
          {form.headline || form.title}
        </h2>
        {form.subtitle && <p className="mt-2 text-center text-gray-500">{form.subtitle}</p>}
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {fields.map(field => (
            <div key={field.id}>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-gray-500">
                {field.label}{field.required && ' *'}
              </label>
              {field.type === 'long_text' ? (
                <textarea
                  required={field.required}
                  rows={4}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#C9A24D] focus:ring-2 focus:ring-[#C9A24D]/20"
                  value={values[field.id] || ''}
                  onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                />
              ) : (
                <input
                  required={field.required}
                  type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#C9A24D] focus:ring-2 focus:ring-[#C9A24D]/20"
                  value={values[field.id] || ''}
                  onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                />
              )}
            </div>
          ))}
          {error && <p className="text-sm font-semibold text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="ohp-gold-sheen w-full rounded-full px-6 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50"
            style={{ backgroundColor: theme.primary_color }}
          >
            {submitting ? 'Sending...' : 'Submit'}
          </button>
        </form>
      </div>
    </section>
  )
}
