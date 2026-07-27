import { redirect } from 'next/navigation'

export default function LegacyAgentHubSalesPage({ params }: { params: { slug: string } }) {
  redirect(`/${params.slug}/sales`)
}
