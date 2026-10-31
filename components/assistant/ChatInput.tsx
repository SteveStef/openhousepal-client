'use client'

import { useCallback, useEffect, useRef, useState, KeyboardEvent } from 'react'
import { Send, Loader2, Mic, PhoneCall, Keyboard } from 'lucide-react'

interface ChatInputProps {
  // false back = it didn't go through (e.g. too many at once) - their words go back in the box
  onSend: (message: string) => void | boolean | Promise<void | boolean>
  disabled?: boolean
  maxChars?: number
  placeholder?: string
  // Called the moment new speech is detected, so the caller can interrupt a spoken reply
  // that's currently playing (barge-in) instead of talking over it unheard.
  onUserSpeaking?: () => void
  // Opens the live "Talk to OHP" call overlay (see AssistantWidget/TalkToOHP) - offered as a
  // choice from the mic button rather than auto-starting a call, since a one-tap "Call Now"
  // button used to fire off a live voice session immediately (and, if tapped again before the
  // UI settled, a second one alongside it) with no way to back out. Asking first also means
  // there's only ever one place a call can be started from, instead of two competing entry
  // points into the same "agent" - the other half of never running two agents at once is
  // AssistantWidget disabling this whole input while a call (isTalking) is already active.
  onStartCall?: () => void
}

// Minimal shape for the Web Speech API's SpeechRecognition - not in TypeScript's default
// DOM lib (it's still non-standard/webkit-prefixed in most browsers), so we type just what
// we use rather than pulling in a @types package for a few properties.
interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: any) => void) | null
  onend: (() => void) | null
  onerror: ((event: any) => void) | null
  start: () => void
  stop: () => void
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}

export default function ChatInput({ onSend, disabled, maxChars = 12000, placeholder, onUserSpeaking, onStartCall }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [showMicChoice, setShowMicChoice] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const baseValueRef = useRef('')
  // Mirrors `value` synchronously so recognition callbacks (created once per session,
  // not per render) always see the latest transcript instead of a stale closed-over value.
  const liveValueRef = useRef('')
  // Tracks whether the user wants dictation on, independent of any single recognition session -
  // lets onend tell "restart automatically" (the browser cut it off) from "user stopped it".
  const micModeRef = useRef(false)
  // Mirrors `disabled` synchronously, same reason as liveValueRef - handleSend reads it so a
  // second send can't race a reply that's still on its way.
  const disabledRef = useRef(!!disabled)

  useEffect(() => {
    setVoiceSupported(getSpeechRecognition() !== null)
  }, [])

  useEffect(() => {
    liveValueRef.current = value
  }, [value])

  const handleSend = useCallback((textOverride?: string): boolean => {
    const trimmed = (textOverride ?? liveValueRef.current).trim()
    if (!trimmed || disabledRef.current || trimmed.length > maxChars) return false
    Promise.resolve(onSend(trimmed)).then(ok => {
      if (ok === false && !liveValueRef.current.trim()) { setValue(trimmed); liveValueRef.current = trimmed }
    })
    setValue('')
    liveValueRef.current = ''
    // Send ends a dictation - the mic switches off (it never sends by itself).
    if (micModeRef.current) {
      micModeRef.current = false
      recognitionRef.current?.stop()
      setIsListening(false)
    }
    return true
  }, [maxChars, onSend])

  useEffect(() => { disabledRef.current = !!disabled }, [disabled])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()   // while a reply is coming this does nothing - what they typed stays put
    }
  }

  const startRecognitionSession = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    baseValueRef.current = liveValueRef.current ? `${liveValueRef.current} ` : ''

    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      const next = baseValueRef.current + transcript
      setValue(next)
      liveValueRef.current = next
      // No auto-send when they pause (owner, 11/01): it keeps listening until they tap the mic
      // off or tap Send - they can read it over and fix it first.
      if (transcript.trim()) onUserSpeaking?.()
    }

    recognition.onend = () => {
      // The browser cuts a session off on its own now and then (Chrome does, even with
      // continuous:true) - keep listening, adding to what's already in the box.
      if (micModeRef.current) {
        startRecognitionSession()
      } else {
        setIsListening(false)
      }
    }

    recognition.onerror = (event: any) => {
      const err = event?.error
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        micModeRef.current = false
        setIsListening(false)
      }
      // Other errors (no-speech, aborted, network blips) are benign - onend fires right
      // after and restarts the session as long as micModeRef is still true.
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [onUserSpeaking])

  const toggleListening = () => {
    if (micModeRef.current) {
      micModeRef.current = false
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }
    micModeRef.current = true
    startRecognitionSession()
  }

  // Stopping an active dictation session needs no confirmation - only starting one does, so it
  // can offer the live call as an alternative first.
  const handleMicClick = () => {
    if (isListening || !onStartCall) {
      // No live call on this plan (admin only - 10/30): the mic just dictates, free in the browser.
      toggleListening()
      return
    }
    setShowMicChoice(true)
  }

  useEffect(() => {
    return () => {
      micModeRef.current = false
      recognitionRef.current?.stop()
    }
  }, [])

  const overLimit = value.length > maxChars

  return (
    <div className="border-t border-gray-100 dark:border-zinc-800/60 p-3 sm:p-4 bg-white dark:bg-zinc-900">
      <div className="flex items-end gap-2">
        {voiceSupported && (
          <div className="relative flex-shrink-0">
            <button
              onClick={handleMicClick}
              disabled={disabled}
              title={isListening ? 'Stop listening' : 'Speak your question'}
              className={`relative flex items-center justify-center w-11 h-11 rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                isListening
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
              }`}
            >
              {isListening && <span className="absolute inset-0 rounded-xl bg-red-500 animate-ping opacity-40" />}
              {isListening ? (
                <span className="relative flex items-end gap-0.5 h-4">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className="w-0.5 bg-white rounded-full animate-bounce"
                      style={{ height: `${6 + (i % 2) * 6}px`, animationDelay: `${i * 0.1}s`, animationDuration: '0.6s' }}
                    />
                  ))}
                </span>
              ) : (
                <Mic className="w-4 h-4 relative" />
              )}
            </button>

            {showMicChoice && (
              <>
                {/* Click-away backdrop, not a real modal - just needs to catch the outside tap */}
                <div className="fixed inset-0 z-10" onClick={() => setShowMicChoice(false)} />
                <div className="absolute bottom-full left-0 z-20 mb-2 w-56 rounded-xl border border-gray-100 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 shadow-xl">
                  <p className="px-1.5 pb-2 pt-1 text-xs font-semibold text-gray-600 dark:text-zinc-300">Would you like me to talk to you like a call?</p>
                  <button
                    onClick={() => { setShowMicChoice(false); onStartCall?.() }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold text-[#8b7355] dark:text-[#C9A24D] hover:bg-[#8b7355]/10 dark:hover:bg-[#C9A24D]/10"
                  >
                    <PhoneCall className="w-4 h-4" /> Yes, start a call
                  </button>
                  <button
                    onClick={() => { setShowMicChoice(false); toggleListening() }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
                  >
                    <Keyboard className="w-4 h-4" /> No, just dictate this
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Listening...' : placeholder || 'Ask me anything...'}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/60 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#C9A24D]/50 focus:border-[#C9A24D]/50 transition-all max-h-32"
          style={{ minHeight: '48px', scrollbarGutter: 'stable' }}
          // Never switched off while a reply is coming (owner, 10/31): a disabled box drops the
          // cursor, so typing the next message needed a tap back in. They can type ahead; only
          // sending waits (handleSend checks disabledRef).
          aria-busy={disabled || undefined}
        />
        <button
          onClick={() => handleSend()}
          disabled={disabled || !value.trim() || overLimit}
          className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-[#8b7355] hover:bg-[#7a6549] disabled:bg-gray-200 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed text-white transition-colors"
        >
          {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      {overLimit && (
        <p className="mt-1.5 text-xs text-red-500">
          Message is too long ({value.length.toLocaleString()} / {maxChars.toLocaleString()} characters).
        </p>
      )}
    </div>
  )
}
