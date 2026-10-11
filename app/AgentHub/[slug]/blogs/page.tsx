import { redirect } from 'next/navigation'

// Old /AgentHub/<slug> links (printed QR codes) -> the Agent Hub's current address. Next 16 hands
// params over as a Promise - reading params.slug directly sent everyone to "/undefined".
export default async function LegacyAgentHubBlogsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/${encodeURIComponent(slug)}/blogs`)
}
