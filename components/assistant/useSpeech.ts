'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import api from '@/lib/api-service'
import { stripMarkdown } from './markdown'

export type SpeechState = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

// Read Aloud - plays a real OpenAI-synthesized <audio> clip instead of the browser's
// speechSynthesis. `speakingId`/`state` track which message (if any) is active so
// ChatThread can show the right play/pause/stop icon. Deliberately no fallback to
// speechSynthesis on error - the whole point of this rewrite was to leave that voice
// quality behind; a failed request surfaces as a brief inline error instead.
export function useSpeech() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [state, setState] = useState<SpeechState>('idle')

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cacheRef = useRef<Map<string, string>>(new Map()) // messageId -> object URL, reused on replay
  const inFlightRef = useRef<string | null>(null) // messageId currently being fetched, guards duplicate requests

  const teardownAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    teardownAudio()
    inFlightRef.current = null
    setActiveId(null)
    setState('idle')
  }, [teardownAudio])

  const pause = useCallback(() => {
    if (audioRef.current && state === 'playing') {
      audioRef.current.pause()
      setState('paused')
    }
  }, [state])

  const resume = useCallback(() => {
    if (audioRef.current && state === 'paused') {
      audioRef.current.play()
      setState('playing')
    }
  }, [state])

  const playUrl = useCallback((id: string, url: string) => {
    teardownAudio()
    const audio = new Audio(url)
    audio.onended = () => {
      setActiveId((current) => (current === id ? null : current))
      setState((current) => (current === 'error' ? current : 'idle'))
    }
    audio.onerror = () => {
      setActiveId((current) => (current === id ? null : current))
      setState('error')
    }
    audioRef.current = audio
    setState('playing')
    audio.play()
  }, [teardownAudio])

  const speak = useCallback(async (id: string, content: string, conversationId?: string) => {
    // Clicking the active message's button again pauses/resumes rather than re-fetching;
    // clicking a different message stops whatever's currently active first.
    if (activeId === id) {
      if (state === 'playing') return pause()
      if (state === 'paused') return resume()
      if (state === 'loading' || inFlightRef.current === id) return
    }
    teardownAudio()
    inFlightRef.current = null

    const cached = cacheRef.current.get(id)
    if (cached) {
      setActiveId(id)
      playUrl(id, cached)
      return
    }

    setActiveId(id)
    setState('loading')
    inFlightRef.current = id
    try {
      const blob = await api.ai.getSpeechAudio(conversationId, stripMarkdown(content))
      const url = URL.createObjectURL(blob)
      cacheRef.current.set(id, url)
      if (inFlightRef.current === id) {
        playUrl(id, url)
      }
    } catch {
      setActiveId((current) => (current === id ? id : current))
      setState('error')
    } finally {
      if (inFlightRef.current === id) inFlightRef.current = null
    }
  }, [activeId, state, pause, resume, playUrl, teardownAudio])

  useEffect(() => {
    return () => {
      teardownAudio()
      cacheRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [teardownAudio])

  return { supported: true, speakingId: activeId, state, speak, pause, resume, stop }
}
