import { Playfair_Display } from 'next/font/google'

// The invitation's display serif (titles, dates) - the same face the link-preview images use.
export const inviteSerif = Playfair_Display({ subsets: ['latin'], weight: ['400', '700', '900'], style: ['normal', 'italic'], display: 'swap' })
export const SERIF = inviteSerif.style.fontFamily
