// A link that opens the phone's own Messages app with the number and the text already written -
// sent from the agent's real cell, so replies and calls come straight back to their phone.
// iPhones read the body after "&", Android after "?".
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isPhoneDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return isIosDevice() || /Android|Mobile/i.test(navigator.userAgent)
}

/** "+16105551234" from any US-ish number; non-US numbers keep their own digits. */
export function smsNumber(phone: string): string {
  const d = (phone || '').replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return d ? `+${d}` : phone
}

export function smsHref(phone: string, body?: string | null): string {
  const to = smsNumber(phone)
  if (!body) return `sms:${to}`
  return `sms:${to}${isIosDevice() ? '&' : '?'}body=${encodeURIComponent(body)}`
}

/** Opens the phone's (or computer's) default email app - To, Subject and the message already
 *  written. iPhone uses the Mail app set in Settings > Default Mail App; Android opens its
 *  default, or asks once which app to use. */
export function mailHref(email: string, subject?: string | null, body?: string | null): string {
  const q = [subject && `subject=${encodeURIComponent(subject)}`, body && `body=${encodeURIComponent(body.replace(/\r?\n/g, '\r\n'))}`].filter(Boolean)
  return `mailto:${email}${q.length ? `?${q.join('&')}` : ''}`
}
