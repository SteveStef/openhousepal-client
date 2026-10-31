'use client'

// The agent's own wording for a message they send from their phone or email app - remembered on
// their account and used next time (owner, 10/31: "it saves for other requests but would keep the
// agent name there"). Saved with {placeholders} so the names and the home fill in fresh each time:
//   {agent_first_name} {address} {city} {my_name} {my_brokerage} {my_phone}
// Backend: GET/PUT /setup/message-templates (users.setup_state.message_templates).
import { useCallback, useEffect, useRef, useState } from 'react'
import api from '@/lib/api-service'

export type TemplateKey = 'host_request'
export type TemplateVars = Partial<Record<'agent_first_name' | 'address' | 'city' | 'my_name' | 'my_brokerage' | 'my_phone', string>>
export type Message = { subject: string; body: string }

/** {placeholders} -> this time's names and home. */
export function fillTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars as Record<string, string | undefined>)[k] ?? m)
}

/** This time's names and home -> {placeholders} (longest first, so "Bryn Mawr" isn't split by "Bryn"). */
export function toTemplate(text: string, vars: TemplateVars): string {
  const pairs = Object.entries(vars).filter(([, v]) => v && v.trim().length >= 2) as [string, string][]
  pairs.sort((a, b) => b[1].length - a[1].length)
  let out = text
  for (const [k, v] of pairs) out = out.split(v).join(`{${k}}`)
  return out
}

let cache: Record<string, { subject?: string; body?: string }> | null = null
let loading: Promise<void> | null = null

/** The saved wording for `key` (else `fallback`), filled with `vars`; `remember` saves an edit for next time. */
export function useMessageTemplate(key: TemplateKey, fallback: Message, vars: TemplateVars) {
  const [saved, setSaved] = useState<{ subject?: string; body?: string } | null>(cache ? cache[key] || {} : null)
  useEffect(() => {
    if (cache) { setSaved(cache[key] || {}); return }
    loading = loading || api.setup.messageTemplates().then(r => { cache = (r.success && r.data?.templates) || {} }).catch(() => { cache = {} })
    loading.then(() => setSaved((cache || {})[key] || {}))
  }, [key])
  const varsRef = useRef(vars)
  varsRef.current = vars
  const message: Message | null = saved === null ? null : {
    subject: saved.subject ? fillTemplate(saved.subject, vars) : fallback.subject,
    body: saved.body ? fillTemplate(saved.body, vars) : fallback.body,
  }
  const remember = useCallback(async (m: Message) => {
    const t = { subject: toTemplate(m.subject, varsRef.current), body: toTemplate(m.body, varsRef.current) }
    cache = { ...(cache || {}), [key]: t }
    setSaved(t)
    await api.setup.setMessageTemplate({ key, ...t })
  }, [key])
  const reset = useCallback(async () => {
    if (cache) delete cache[key]
    setSaved({})
    await api.setup.setMessageTemplate({ key, reset: true })
  }, [key])
  return { message, customized: !!(saved && (saved.subject || saved.body)), remember, reset }
}

/** Opens the agent's own Messages app with the text filled in (iPhone and Android both read "&body"). */
export function smsHref(phone: string, body: string): string {
  const digits = (phone || '').replace(/[^\d+]/g, '')
  return `sms:${digits}?&body=${encodeURIComponent(body)}`
}

export function mailtoHref(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
