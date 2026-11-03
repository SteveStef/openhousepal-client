'use client'

// The helper's form card shows the form as a guest sees it on a phone, in a small frame (owner,
// 11/02: "a mini preview where you can flip through the questions"). A page of its own in an
// iframe, so the phone layout is what shows even in the computer's chat panel. The card sends the
// form (questions, look, agent, home) and which screen to show by postMessage - same site only.
import { useEffect, useState } from 'react'
import FormRunner, { type FormRunnerBranding } from '@/components/forms/FormRunner'
import type { FormQuestion, LinkedProperty } from '@/types'
import type { FormLook } from '@/lib/formLook'

export type FormPreviewData = {
  questions: FormQuestion[]
  branding: FormRunnerBranding
  linkedProperty: LinkedProperty | null
  backgroundEffects: boolean
  look?: FormLook
  focus: string
}

export default function FormPreviewPage() {
  const [data, setData] = useState<FormPreviewData | null>(null)
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'ohp-form-preview') return
      setData(e.data.data as FormPreviewData)
    }
    window.addEventListener('message', on)
    window.parent?.postMessage({ type: 'ohp-form-preview-ready' }, window.location.origin)
    return () => window.removeEventListener('message', on)
  }, [])
  if (!data) return <div className="h-screen bg-[#FAFAF7]" />
  return (
    <div className={`h-screen overflow-hidden ${data.look?.dark ? 'dark' : ''}`}>
      <FormRunner
        // a changed question list starts over (on the screen asked for), like the form editor's preview
        key={data.questions.map(q => `${q.id}:${q.label}:${q.type}:${(q.options || []).join('|')}`).join(',') + String(data.backgroundEffects)}
        questions={data.questions}
        branding={data.branding}
        linkedProperty={data.linkedProperty}
        backgroundEffects={data.backgroundEffects}
        successHeading="Thanks!"
        successMessage="I'll be in touch soon."
        onSubmit={async () => ({ success: true })}
        focusBlockId={data.focus}
        look={data.look}
        redirectDelayMs={10 ** 9}
      />
    </div>
  )
}
