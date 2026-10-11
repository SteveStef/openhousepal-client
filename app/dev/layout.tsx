import { notFound } from 'next/navigation'

// Everything under /dev is a developer proof sheet (logo, link-preview image, design matrices) -
// never served on the live site.
export default function DevOnlyLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return children
}
