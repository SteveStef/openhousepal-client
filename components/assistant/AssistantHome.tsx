'use client'

import { Sparkles, ArrowRight } from 'lucide-react'

// The helper does things for you and shows you around the app (owner, 10/30) - no "suggested
// actions" about clients here: the daily briefing, the Dash and alerts already cover that.
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
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-[#8b7355] flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#111827] dark:text-white">Good to see you</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
          Ask me how to do anything in OpenHousePal, or ask me to do it for you - designs, Spotlights, Showcases, follow-ups and more.
        </p>

        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500 mb-3">Try asking</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {SUGGESTED_PROMPTS.map((prompt, i) => (
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
      </div>
    </div>
  )
}
