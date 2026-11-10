'use client'

import NextImage, { type ImageProps } from 'next/image'
import imageLoader from '@/lib/imageLoader'

// next/image with its resized copies at the Cloudflare-storable /pimg/... address (lib/photoUrl.ts).
// A drop-in for `import Image from 'next/image'` - same props. Photos marked `unoptimized` stay as-is.
export default function Image(props: ImageProps) {
  return <NextImage loader={props.unoptimized ? undefined : imageLoader} {...props} />
}
