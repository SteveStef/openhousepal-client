import { notFound } from 'next/navigation'
import GalleryClient from './GalleryClient'

// Dev-only: every Studio template for one format, all situations, side by side - used to art-direct
// the design library. Never served in production.
export default function DesignGalleryPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <GalleryClient />
}
