import { redirect } from 'next/navigation'

// The separate Listings page is gone: current listings now lead the Sales page, past sales follow.
// Old links (installed email signatures, shared URLs) land there.
export default async function LegacyListingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/${slug}/sales`)
}
