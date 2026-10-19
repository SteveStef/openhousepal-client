'use client'

// A visitor opening their Showcase link on the agent's site (an open house sign-in email, a text
// from the agent): from now on the site shows "{first}'s Showcase" in its menu. Never replaces a
// different Showcase this browser already has.
import { useEffect } from 'react'
import { readVisitor, saveVisitor } from '@/lib/visitor'

export default function RememberShowcase({ code, name }: { code: string; name?: string | null }) {
  useEffect(() => {
    const was = readVisitor()
    if (was?.showcase && was.showcase !== code) return
    saveVisitor({ name: was?.name || name || undefined, showcase: code })
  }, [code, name])
  return null
}
