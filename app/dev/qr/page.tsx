'use client'

// Dev proof: the site-wide QR look at several lengths / colours / sizes, as both the inline SVG
// (Studio designs) and the PNG (kits, kiosk, forms) - screenshotted and run through a decoder.
import { useQrDataUrl } from '@/lib/qr'
import { styledQrSvg } from '@/lib/qrStyle'
import { useState } from 'react'
import FormQrCode from '@/components/forms/FormQrCode'

const CASES: { text: string; eye?: string; px: number }[] = [
  { text: 'https://openhousepal.com/forms/abc123?src=qr', px: 220 },
  { text: 'https://openhousepal.com/open-house/7f3c2a91-1b2c-4d5e-8f90-123456789abc/sign-in?src=qr&utm=kit', eye: '#C9A24D', px: 220 },
  { text: 'https://petersteffanatos.openhousepal.com/hub', eye: '#1F3A5F', px: 140 },
  { text: 'https://openhousepal.com/d/FvaafDl-/text', eye: '#E8C97A', px: 110 },
]

function SvgCase({ text, eye, px, initials }: { text: string; eye?: string; px: number; initials?: string }) {
  const p = styledQrSvg(text, { eye, center: initials ? { kind: 'initials', initials } : undefined })
  if (!p) return null
  return (
    <div data-qr style={{ width: px, height: px, padding: px * 0.06, background: '#fff', boxSizing: 'border-box' }}>
      <svg viewBox={`0 0 ${p.size} ${p.size}`} style={{ display: 'block', width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: p.body }} />
    </div>
  )
}

function PngCase({ text, eye, px, plain = false }: { text: string; eye?: string; px: number; plain?: boolean }) {
  const src = useQrDataUrl(text, { size: px * 2, eye, styled: !plain, ecc: plain ? 'M' : undefined })
  return <div data-qr style={{ width: px, height: px, background: '#fff' }}>{src && <img src={src} alt="" style={{ width: px, height: px, display: 'block' }} />}</div>
}

export default function QrProof() {
  const [dl, setDl] = useState<(() => void) | null>(null)
  return (
    <div style={{ padding: 24, background: '#e9e6df', display: 'flex', flexWrap: 'wrap', gap: 24 }}>
      <div data-form-qr><FormQrCode url="https://openhousepal.com/forms/test-form" size={168} onDownloadReady={fn => setDl(() => fn)} /></div>
      <button data-dl onClick={() => dl?.()}>download</button>
      {CASES.map((c, i) => <SvgCase key={`s${i}`} {...c} />)}
      <SvgCase text="https://openhousepal.com/peterstefanatos" px={220} initials="PS" />
      <SvgCase text="https://openhousepal.com/peterstefanatos" px={110} initials="PS" />
      {CASES.map((c, i) => <PngCase key={`p${i}`} {...c} />)}
      {CASES.map((c, i) => <PngCase key={`q${i}`} {...c} plain />)}
    </div>
  )
}
