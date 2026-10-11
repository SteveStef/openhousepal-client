'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Mic, PhoneOff, ExternalLink, Loader2, AlertCircle, Minimize2, Bot, User as UserIcon } from 'lucide-react'
import api from '@/lib/api-service'
import { AIToolCallRef } from '@/types'
import { RECORD_LINKS, RECORD_LABELS } from './recordLinks'

type VoiceState = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'ended' | 'error'

interface TranscriptEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
}

const REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls'
const HEARTBEAT_INTERVAL_MS = 20_000

const stateLabel: Record<VoiceState, string> = {
  connecting: 'Connecting...',
  listening: 'Listening',
  thinking: 'Thinking...',
  speaking: 'Speaking',
  ended: 'Call ended',
  error: 'Could not connect',
}

// A live "Talk to OHP" conversation via OpenAI's Realtime API. The browser connects DIRECTLY
// to OpenAI over WebRTC using a short-lived client secret from POST /ai/realtime/session -
// this component never sees a permanent API key. Tool calls the model makes are relayed to
// our own POST /ai/realtime/tool-call (the only place OpenHousePal data is actually touched,
// with the same owner-scoping every other AI tool call already has), and every response's
// real usage is reported to POST /ai/realtime/usage so cost is tracked incrementally, not
// trusted as a single end-of-session self-report. See ai_realtime_service.py for the fuller
// picture, including the one platform limitation that can't be fully closed: OpenAI doesn't
// expose a way for our backend to force-end an already-connected session, so the hard timers
// below are the real backstop, not a formality.
//
// Rendered as ONE persistent component for the life of the call (mounted by AssistantWidget
// only while isTalking is true) so minimizing never tears down the WebRTC connection - the
// `minimized` prop just swaps which of two views this same instance draws: a small pill
// (collapsed) or a chat-panel-sized card with a live transcript (expanded). Never a full-page
// takeover, and never a separate mount/unmount pair, which would restart the call.
//
// NOTE: exact OpenAI Realtime server event names below (response.created,
// input_audio_buffer.speech_started, the transcript delta events, etc.) are implemented from
// OpenAI's documented event vocabulary but have not been exercised against a live browser
// session - there's no browser tool available to do that verification here. Treat the
// state-transition and transcript wiring as the part of this feature most worth a manual pass
// before relying on it.
export default function TalkToOHP({
  onClose,
  minimized,
  onExpand,
  onMinimize,
}: {
  onClose: () => void
  minimized: boolean
  onExpand?: () => void
  onMinimize?: () => void
}) {
  const [voiceState, setVoiceState] = useState<VoiceState>('connecting')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refs, setRefs] = useState<AIToolCallRef[]>([])
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const endedRef = useRef(false)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)

  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleSecondsRef = useRef(45)

  const addRefs = (newRefs: AIToolCallRef[]) => {
    if (!newRefs.length) return
    setRefs((prev) => {
      const seen = new Set(prev.map((r) => `${r.record_type}:${r.record_id}`))
      const merged = [...prev]
      for (const r of newRefs) {
        const key = `${r.record_type}:${r.record_id}`
        if (!seen.has(key)) {
          seen.add(key)
          merged.push(r)
        }
      }
      return merged.slice(-5)
    })
  }

  // Appends a delta onto (or replaces, for a `.completed`/`.done` event's final text) the
  // transcript line keyed by this item/response id, in the order lines were first heard.
  const upsertTranscript = (key: string, role: 'user' | 'assistant', text: string, replace: boolean) => {
    if (!text) return
    setTranscript((prev) => {
      const idx = prev.findIndex((t) => t.id === key)
      if (idx === -1) return [...prev, { id: key, role, text }]
      const next = [...prev]
      next[idx] = { ...next[idx], text: replace ? text : next[idx].text + text }
      return next
    })
  }

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  const cleanup = () => {
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)
    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    dcRef.current?.close()
    pcRef.current?.close()
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    pcRef.current = null
    dcRef.current = null
    localStreamRef.current = null
  }

  const endSession = async (reason: string) => {
    if (endedRef.current) return
    endedRef.current = true
    setVoiceState('ended')
    cleanup()
    const sessionId = sessionIdRef.current
    if (sessionId) {
      try {
        await api.ai.realtimeEnd(sessionId, reason)
      } catch {
        // best-effort - the session row is also caught by the server-side abandonment sweep
      }
    }
    onClose()
  }

  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => endSession('idle_timeout'), idleSecondsRef.current * 1000)
  }

  const sendEvent = (event: Record<string, unknown>) => {
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify(event))
    }
  }

  const handleFunctionCall = async (callId: string, name: string, argsJson: string) => {
    let args: Record<string, unknown> = {}
    try {
      args = argsJson ? JSON.parse(argsJson) : {}
    } catch {
      // malformed arguments - fall through with an empty object rather than dropping the turn
    }
    const sessionId = sessionIdRef.current
    if (!sessionId) return
    try {
      const res = await api.ai.realtimeToolCall(sessionId, name, args)
      if (res.success && res.data) {
        addRefs(res.data.refs)
        sendEvent({
          type: 'conversation.item.create',
          item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(res.data.result) },
        })
      } else {
        sendEvent({
          type: 'conversation.item.create',
          item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ error: 'tool_call_failed' }) },
        })
      }
    } catch {
      sendEvent({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ error: 'tool_call_failed' }) },
      })
    }
    sendEvent({ type: 'response.create' })
  }

  const handleServerEvent = (raw: string) => {
    let event: any
    try {
      event = JSON.parse(raw)
    } catch {
      return
    }

    switch (event.type) {
      case 'input_audio_buffer.speech_started':
        setVoiceState('listening')
        resetIdleTimer()
        break
      case 'response.created':
        setVoiceState('thinking')
        resetIdleTimer()
        break
      case 'response.output_audio.delta':
      case 'response.audio.delta':
        setVoiceState('speaking')
        break
      case 'conversation.item.input_audio_transcription.delta':
        upsertTranscript(event.item_id || 'user-current', 'user', event.delta || '', false)
        break
      case 'conversation.item.input_audio_transcription.completed':
        upsertTranscript(event.item_id || 'user-current', 'user', event.transcript || '', true)
        break
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta':
        upsertTranscript(event.item_id || event.response_id || 'assistant-current', 'assistant', event.delta || '', false)
        break
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
        if (event.transcript) {
          upsertTranscript(event.item_id || event.response_id || 'assistant-current', 'assistant', event.transcript, true)
        }
        break
      case 'response.function_call_arguments.done':
        handleFunctionCall(event.call_id, event.name, event.arguments)
        break
      case 'response.done': {
        setVoiceState('listening')
        const usage = event.response?.usage
        const sessionId = sessionIdRef.current
        if (usage && sessionId) {
          api.ai.realtimeUsage(sessionId, usage).then((res) => {
            if (res.success && res.data?.should_end) {
              endSession('cost_ceiling')
            }
          })
        }
        break
      }
      case 'error':
        setErrorMessage(event.error?.message || 'Voice session error.')
        break
      default:
        break
    }
  }

  useEffect(() => {
    let cancelled = false

    const connect = async () => {
      const res = await api.ai.startRealtimeSession()
      if (cancelled) return
      if (!res.success || !res.data || !res.data.client_secret) {
        setErrorMessage(res.error || "Couldn't start a voice session.")
        setVoiceState('error')
        return
      }
      const { session_id, client_secret, model, max_session_seconds, max_idle_seconds } = res.data
      sessionIdRef.current = session_id
      idleSecondsRef.current = max_idle_seconds

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        localStreamRef.current = stream

        const pc = new RTCPeerConnection()
        pcRef.current = pc
        stream.getTracks().forEach((track) => pc.addTrack(track, stream))

        pc.ontrack = (e) => {
          if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0]
        }

        const dc = pc.createDataChannel('oai-events')
        dcRef.current = dc
        dc.onopen = () => {
          sendEvent({
            type: 'session.update',
            session: {
              audio: {
                input: {
                  turn_detection: { type: 'server_vad' },
                  // Live captions for the transcript panel - without this OpenAI never
                  // transcribes what the user (as opposed to the model) said.
                  transcription: { model: 'whisper-1' },
                },
              },
            },
          })
          setVoiceState('listening')
          resetIdleTimer()
        }
        dc.onmessage = (e) => handleServerEvent(e.data)

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        const sdpResponse = await fetch(`${REALTIME_CALLS_URL}?model=${encodeURIComponent(model)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${client_secret}`, 'Content-Type': 'application/sdp' },
          body: offer.sdp,
        })
        if (!sdpResponse.ok) throw new Error('Could not connect the voice call.')
        const answerSdp = await sdpResponse.text()
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

        heartbeatTimerRef.current = setInterval(() => {
          if (sessionIdRef.current) api.ai.realtimeHeartbeat(sessionIdRef.current)
        }, HEARTBEAT_INTERVAL_MS)
        maxDurationTimerRef.current = setTimeout(() => endSession('max_duration'), max_session_seconds * 1000)
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : 'Could not start the voice call.')
          setVoiceState('error')
          cleanup()
          if (sessionIdRef.current) api.ai.realtimeEnd(sessionIdRef.current, 'client_ended')
        }
      }
    }

    connect()

    const onVisibilityChange = () => {
      if (document.hidden) resetIdleTimer()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (!endedRef.current) {
        endedRef.current = true
        cleanup()
        if (sessionIdRef.current) api.ai.realtimeEnd(sessionIdRef.current, 'client_ended')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refsRow = refs.length > 0 && (
    <div className="flex flex-wrap items-center gap-1.5 px-3 sm:px-4 pt-2.5">
      {refs.map((ref, i) => {
        const buildLink = RECORD_LINKS[ref.record_type]
        if (!buildLink) return null
        return (
          <Link
            key={`${ref.record_type}-${ref.record_id}-${i}`}
            href={buildLink(ref.record_id)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#8b7355] dark:text-[#C9A24D] bg-[#8b7355]/10 dark:bg-[#C9A24D]/10 hover:bg-[#8b7355]/20 dark:hover:bg-[#C9A24D]/20 rounded-lg px-2.5 py-1 transition-colors"
          >
            {RECORD_LABELS[ref.record_type] || ref.record_type}
            <ExternalLink className="w-3 h-3" />
          </Link>
        )
      })}
    </div>
  )

  const controlBar = (
    <div className="flex items-center gap-3 px-3 sm:px-4 py-3">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          voiceState === 'speaking' ? 'bg-[#8b7355] animate-pulse' : voiceState === 'error' ? 'bg-red-500/10' : 'bg-[#8b7355]/15'
        }`}
      >
        {voiceState === 'connecting' || voiceState === 'thinking' ? (
          <Loader2 className="w-4 h-4 text-[#8b7355] animate-spin" />
        ) : voiceState === 'error' ? (
          <AlertCircle className="w-4 h-4 text-red-500" />
        ) : (
          <Mic className={`w-4 h-4 ${voiceState === 'speaking' ? 'text-white' : 'text-[#8b7355]'}`} />
        )}
      </div>
      <span className="flex-1 min-w-0 text-xs font-semibold text-gray-500 dark:text-zinc-400 truncate">
        {voiceState === 'error' ? errorMessage || 'Something went wrong.' : stateLabel[voiceState]}
      </span>
      <button
        onClick={() => endSession('client_ended')}
        className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm transition-colors"
        aria-label="End call"
        title="End call"
      >
        <PhoneOff className="w-4 h-4" />
      </button>
    </div>
  )

  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-40 flex items-center bg-white dark:bg-zinc-900 rounded-full shadow-xl shadow-black/20 border border-gray-100 dark:border-zinc-800 pr-2 pl-1 py-1">
        <audio ref={remoteAudioRef} autoPlay className="hidden" />
        <button
          onClick={onExpand}
          title="Expand call"
          className="flex items-center gap-2 pl-2.5 pr-3 py-2 rounded-full hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <span
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              voiceState === 'speaking'
                ? 'bg-[#8b7355] animate-pulse'
                : voiceState === 'error'
                  ? 'bg-red-500'
                  : 'bg-[#8b7355]/50'
            }`}
          />
          <span className="text-xs font-semibold text-[#111827] dark:text-white whitespace-nowrap">
            {voiceState === 'error' ? 'Call error' : stateLabel[voiceState]}
          </span>
        </button>
        <button
          onClick={() => endSession('client_ended')}
          aria-label="End call"
          title="End call"
          className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center flex-shrink-0 transition-colors"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-40 sm:w-96 h-[70vh] sm:h-[560px] max-h-[560px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 flex flex-col overflow-hidden animate-fadeIn">
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-zinc-800/60 flex-shrink-0">
        <Mic className="w-4 h-4 text-[#8b7355]" />
        <span className="text-sm font-bold text-[#111827] dark:text-white truncate">Talk to OHP</span>
        <button
          onClick={onMinimize}
          title="Minimize (call keeps going)"
          className="ml-auto p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-4 space-y-4">
        {transcript.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            {voiceState === 'connecting' ? (
              <>
                <Loader2 className="w-6 h-6 text-[#8b7355] animate-spin mb-2" />
                <p className="text-xs text-gray-500 dark:text-zinc-400">Connecting...</p>
              </>
            ) : voiceState === 'error' ? (
              <>
                <AlertCircle className="w-6 h-6 text-red-500 mb-2" />
                <p className="text-xs text-gray-600 dark:text-zinc-300">{errorMessage || 'Something went wrong.'}</p>
              </>
            ) : (
              <p className="text-xs text-gray-400 dark:text-zinc-500">Say something to get started.</p>
            )}
          </div>
        ) : (
          transcript.map((entry) => {
            const isUser = entry.role === 'user'
            return (
              <div key={entry.id} className={`flex animate-fadeIn ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-start gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : ''}`}>
                  <div
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      isUser ? 'bg-[#8b7355] text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-300'
                    }`}
                  >
                    {isUser ? <UserIcon className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                  </div>
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                      isUser
                        ? 'bg-[#8b7355] text-white'
                        : 'bg-gray-50 dark:bg-zinc-800/70 text-gray-800 dark:text-zinc-100 border border-gray-100 dark:border-zinc-800'
                    }`}
                  >
                    {entry.text}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={transcriptEndRef} />
      </div>

      <div className="border-t border-gray-100 dark:border-zinc-800/60 flex-shrink-0">
        {refsRow}
        {controlBar}
      </div>
    </div>
  )
}
