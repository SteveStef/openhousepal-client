import { redirect } from 'next/navigation'

export default function LegacyAgentHubPage({ params }: { params: { slug: string } }) {
  redirect(`/${params.slug}`)
}
