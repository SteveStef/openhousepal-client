'use client'

// "Directions" never assumes Google (user, 10/24): every Directions button asks Apple Maps or
// Google Maps first. On a phone the choice slides up from the bottom; on a computer it's a small
// centred card. Plain DOM so it works on every page (agent app, guest pages, agent sites) with no
// provider or extra component - call openDirections(address) from any click handler.

export function appleMapsUrl(destination: string) {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(destination)}`
}

export function googleMapsUrl(destination: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}

let openSheet: HTMLElement | null = null

export function openDirections(destination: string, opts?: { label?: string }) {
  if (typeof document === 'undefined' || !destination) return
  openSheet?.remove()
  const phone = window.innerWidth < 640
  const dark = document.documentElement.classList.contains('dark') || window.matchMedia?.('(prefers-color-scheme: dark)').matches && !document.documentElement.classList.contains('light')
  const bg = dark ? '#16161a' : '#ffffff'
  const fg = dark ? '#f3f4f6' : '#111827'
  const sub = dark ? '#9ca3af' : '#6b7280'
  const line = dark ? 'rgba(255,255,255,.1)' : 'rgba(17,24,39,.08)'

  const root = document.createElement('div')
  root.setAttribute('data-scroll-lock', 'off')
  root.style.cssText = `position:fixed;inset:0;z-index:2147483000;display:flex;${phone ? 'align-items:flex-end' : 'align-items:center'};justify-content:center;background:rgba(0,0,0,0);transition:background .25s ease;font-family:inherit`
  const card = document.createElement('div')
  card.setAttribute('role', 'dialog')
  card.setAttribute('aria-label', 'Get directions')
  card.style.cssText = `background:${bg};color:${fg};width:${phone ? '100%' : '360px'};border-radius:${phone ? '22px 22px 0 0' : '20px'};padding:${phone ? '10px 16px calc(18px + env(safe-area-inset-bottom))' : '20px'};box-shadow:0 -10px 40px rgba(0,0,0,.25);transform:${phone ? 'translateY(100%)' : 'scale(.94)'};opacity:${phone ? 1 : 0};transition:transform .34s cubic-bezier(.2,.9,.25,1),opacity .2s ease`
  const grab = phone ? `<div style="width:38px;height:5px;border-radius:9px;background:${line};margin:0 auto 12px"></div>` : ''
  const btn = (id: string, name: string, icon: string) =>
    `<button data-go="${id}" style="all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:12px;width:100%;padding:14px;border-radius:14px;border:1px solid ${line};margin-top:8px;font-weight:600;font-size:16px;color:${fg}">${icon}<span>${name}</span></button>`
  const appleIcon = `<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#5ac8fa,#34c759)"><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l7 18-7-4-7 4z"/></svg></span>`
  const googleIcon = `<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#fff;border:1px solid ${line}"><svg width="18" height="18" viewBox="0 0 24 24"><path fill="#ea4335" d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z"/></svg></span>`
  card.innerHTML = `${grab}<div style="font-weight:700;font-size:17px">Get directions</div><div style="font-size:13px;color:${sub};margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(opts?.label || destination).replace(/</g, '&lt;')}</div>${btn('apple', 'Apple Maps', appleIcon)}${btn('google', 'Google Maps', googleIcon)}<button data-go="close" style="all:unset;box-sizing:border-box;cursor:pointer;display:block;text-align:center;width:100%;padding:12px;margin-top:8px;font-weight:600;font-size:15px;color:${sub}">Cancel</button>`
  root.appendChild(card)
  document.body.appendChild(root)
  openSheet = root
  requestAnimationFrame(() => {
    root.style.background = 'rgba(0,0,0,.45)'
    card.style.transform = 'none'
    card.style.opacity = '1'
  })
  const close = () => {
    root.style.background = 'rgba(0,0,0,0)'
    card.style.transform = phone ? 'translateY(100%)' : 'scale(.94)'
    if (!phone) card.style.opacity = '0'
    setTimeout(() => { root.remove(); if (openSheet === root) openSheet = null }, 300)
    document.removeEventListener('keydown', onKey)
  }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
  document.addEventListener('keydown', onKey)
  root.addEventListener('click', (e) => {
    const go = (e.target as HTMLElement).closest('[data-go]')?.getAttribute('data-go')
    if (go === 'apple') window.open(appleMapsUrl(destination), '_blank', 'noopener')
    if (go === 'google') window.open(googleMapsUrl(destination), '_blank', 'noopener')
    if (go || e.target === root) close()
  })
}
