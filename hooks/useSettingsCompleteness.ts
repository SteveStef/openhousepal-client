'use client'

import { useEffect, useState } from 'react'
import api, { type SetupData } from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { stepCopy } from '@/lib/setupFlow'

// Every "is this agent set up?" signal in the app - the dashboard card, the new-account popup,
// the Settings badge - now reads the setup flow's own status (GET /setup, the backend works out
// each plan's steps and whether each is done/skipped/todo from the live data). One source, so the
// flow, the dashboard and the features always agree.

export type SetupItemKey = string

export interface SetupItem {
  key: SetupItemKey
  label: string
  why: string
  href: string
  missing: boolean
  optional?: boolean
  skipped?: boolean
  required?: boolean
}

export interface SettingsCompleteness {
  urlMissing: boolean
  profileMissing: boolean
  contactMissing: boolean
  socialLinksMissing: boolean
  /** A required step (about you / contact / license) is unfinished - the red Settings badge. */
  anyMissing: boolean
  items: SetupItem[]
  loaded: boolean
  setup: SetupData | null
}

let _shared: { key: string; at: number; promise: Promise<SetupData | null> } | null = null
const EVENT = 'ohp:setup-changed'

/** Call after a change that could finish a step, so badges/cards refresh at once. */
export function notifySetupChanged() {
  _shared = null
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

const EMPTY_STATE: SettingsCompleteness = {
  urlMissing: false, profileMissing: false, contactMissing: false, socialLinksMissing: false,
  anyMissing: false, items: [], loaded: false, setup: null,
}

export function useSettingsCompleteness(): SettingsCompleteness {
  const { user, isAuthenticated, isLoading } = useAuth()
  const [state, setState] = useState<SettingsCompleteness>(EMPTY_STATE)

  const load = async (force = false) => {
    const key = `${user?.id}|${user?.plan_tier}|${user?.broker_authorized}`
    const age = _shared ? Date.now() - _shared.at : Infinity
    if (!_shared || _shared.key !== key || age > 15000 || (force && age > 2000)) {
      _shared = { key, at: Date.now(), promise: api.setup.get().then(r => (r.success && r.data ? r.data : null)) }
    }
    const d = await _shared.promise
    if (!d) return
    const status = (id: string) => d.steps.find(s => s.id === id)?.status
    const items: SetupItem[] = d.steps.map(s => {
      const c = stepCopy(s.id, d.plan, d.has_mls)
      return {
        key: s.id, label: c.label, why: c.skip || c.intro, href: `/setup?step=${s.id}`,
        missing: s.status !== 'done', skipped: s.status === 'skipped', required: s.required, optional: !s.required,
      }
    })
    setState({
      urlMissing: false,
      profileMissing: status('about') !== 'done',
      contactMissing: status('contact') !== 'done',
      socialLinksMissing: !!status('socials') && status('socials') !== 'done',
      anyMissing: d.required_missing.length > 0,
      items,
      loaded: true,
      setup: d,
    })
  }

  useEffect(() => {
    if (isLoading || !isAuthenticated) return
    load()
    const onFocus = () => load(true)
    const onChange = () => load(true)
    window.addEventListener('focus', onFocus)
    window.addEventListener(EVENT, onChange)
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener(EVENT, onChange) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, user?.plan_tier, user?.photo_url])

  return state
}
