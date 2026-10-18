'use client'

import HomeAreaMap from '@/components/maps/HomeAreaMap'

// A property's "Location" map in the app (Showcase home details): the home with its township, the
// townships around it and its school district (components/maps/HomeAreaMap - loads on scroll).
export default function PropertyMap({ latitude, longitude, address }: {
  latitude: number
  longitude: number
  address?: string | null
}) {
  return <HomeAreaMap latitude={latitude} longitude={longitude} address={address} rounded="" />
}
