import { redirect } from 'next/navigation'

export default function LegacyAgentHubBlogsPage({ params }: { params: { slug: string } }) {
  redirect(`/${params.slug}/blogs`)
}
