'use client'

import HomeAreaMap from '@/components/maps/HomeAreaMap'
import { SiteTheme } from './types'

// The IDX property page's Location map: the home with its township, the townships around it and its
// school district, in the site's accent (components/maps/HomeAreaMap - loads on scroll).
export default function PropertyLocationMap({ latitude, longitude, address, theme }: {
  latitude: number
  longitude: number
  address?: string | null
  theme: SiteTheme
}) {
  return <HomeAreaMap latitude={latitude} longitude={longitude} address={address} accent={theme.secondary_color || '#C9A24D'} rounded="" />
}
