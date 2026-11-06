'use client'

import type { ImgHTMLAttributes } from 'react'
import { useLogoTone } from '@/lib/logoTone'

/**
 * An agent's logo that can't vanish (owner, 11/05): reads the logo (lib/logoTone) and globals.css puts
 * a small backing behind one that would. The logo itself is never recolored.
 * `on` = what's behind it. `overDark` = it sits on a dark photo.
 */
export default function FitLogo({ src, on, overDark = false, className = '', alt = '', ...rest }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string | null; on?: 'light' | 'dark'; overDark?: boolean }) {
  const tone = useLogoTone(src)
  if (!src) return null
  return <img src={src} alt={alt} data-tone={tone} data-on={on} data-over-dark={overDark ? '' : undefined} className={`ohp-logo-fit ${className}`} {...rest} />
}
