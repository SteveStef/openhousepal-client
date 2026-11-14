'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import api from '@/lib/api-service'
import { OhpBot } from './OhpBot'
import { useChatWide } from './useChatWide'
import MonthlyAiUsageMeter from '@/components/MonthlyAiUsageMeter'

// Shown until their own ideas load (GET /ai/suggestions, 11/04), or if those can't.
const SUGGESTED_PROMPTS = [
  'How do I set up my Agent Hub?',
  'Make me a Just Listed post for my newest listing',
  'Remind me to call my newest lead tomorrow at 10',
  'How do I make a Showcase for a client?',
  'Where do I change my email signature?',
  'How do I run an open house with OpenHousePal?',
]

interface AssistantHomeProps {
  onPrompt: (text: string) => void
}

export default function AssistantHome({ onPrompt }: AssistantHomeProps) {
  // Picked from their own account - a new listing with no Spotlight, form answers to recap,
  // follow-ups waiting (owner, 11/04). The list above shows until they arrive, or if they can't.
  const [prompts, setPrompts] = useState(SUGGESTED_PROMPTS)
  // Laid out by the chat's own width (11/13): two columns only in the big window, not the corner one.
  const boxRef = useRef<HTMLDivElement>(null)
  const wide = useChatWide(boxRef)
  useEffect(() => {
    let live = true
    api.ai.getSuggestions().then(r => { if (live && r.success && r.data?.suggestions?.length) setPrompts(r.data.suggestions) }).catch(() => {})
    return () => { live = false }
  }, [])
  return (
    <div ref={boxRef} className={`flex-1 overflow-y-auto ${wide ? 'px-8 py-12' : 'px-4 py-8'}`}>
      <div className="max-w-2xl mx-auto" data-chat-wide={wide ? 'yes' : 'no'}>
        <div className="flex items-center gap-3 mb-2">
          <OhpBot size={48} className="flex-shrink-0 drop-shadow" />
          <h1 className="text-xl chatwide:text-2xl font-black text-[#111827] dark:text-white">Good to see you</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
          Ask me how to do anything in OpenHousePal, or ask me to do it for you - designs, Spotlights, Showcases, follow-ups and more.
        </p>

        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500 mb-3">Try asking</p>
        <div className="grid chatwide:grid-cols-2 gap-2">
          {prompts.map((prompt, i) => (
            <button
              key={prompt}
              onClick={() => onPrompt(prompt)}
              style={{ ['--i' as string]: i }}
              className="ohp-rise ohp-ai-press group flex items-center justify-between text-left rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-[#C9A24D]/50 hover:bg-gray-50 dark:hover:bg-zinc-800/60 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-zinc-200"
            >
              {prompt}
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 dark:text-zinc-600 group-hover:text-[#C9A24D] group-hover:translate-x-0.5 transition-[color,transform] duration-150 flex-shrink-0 ml-2" />
            </button>
          ))}
        </div>
        {/* The one AI Usage allowance the chat draws from (since 11/13) */}
        <MonthlyAiUsageMeter kind="chat" variant="inline" className="mt-6" />
      </div>
    </div>
  )
}
