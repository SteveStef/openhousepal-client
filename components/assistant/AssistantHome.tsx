'use client'

import { AlertTriangle, Info, Sparkles, ArrowRight, Loader2 } from 'lucide-react'
import { AIInsight } from '@/types'

const SUGGESTED_PROMPTS = [
  'Who should I follow up with today?',
  'Make me a Just Listed post for my newest listing',
  "What's happened since yesterday?",
  'How do I set up my Agent Hub?',
  'Remind me to call my newest lead tomorrow at 10',
  'Prepare me for today',
]

const SEVERITY_STYLES: Record<string, string> = {
  attention: 'border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10',
  urgent: 'border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10',
  info: 'border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/40',
}

interface AssistantHomeProps {
  insights: AIInsight[]
  insightsLoading: boolean
  onPrompt: (text: string) => void
}

export default function AssistantHome({ insights, insightsLoading, onPrompt }: AssistantHomeProps) {
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

        {insightsLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-zinc-500 mb-6">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Checking what's new...
          </div>
        )}

        {!insightsLoading && insights.length > 0 && (
          <div className="space-y-2 mb-8">
            {insights.map((insight, i) => (
              <button
                key={insight.id}
                onClick={() => onPrompt(insight.title)}
                style={{ ['--i' as string]: i }}
                className={`ohp-rise ohp-ai-press w-full text-left rounded-2xl border p-4 hover:opacity-90 ${SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info}`}
              >
                <div className="flex items-start gap-2.5">
                  {insight.severity === 'attention' || insight.severity === 'urgent' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-bold text-[#111827] dark:text-white">{insight.title}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{insight.detail}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500 mb-3">Try asking</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {SUGGESTED_PROMPTS.map((prompt, i) => (
            <button
              key={prompt}
              onClick={() => onPrompt(prompt)}
              style={{ ['--i' as string]: i + insights.length }}
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
