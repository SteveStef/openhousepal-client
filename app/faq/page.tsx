import Footer from '@/components/Footer'
import AskQuestionBlock from '@/components/marketing/AskQuestionBlock'
import FaqExplorer from '@/components/marketing/FaqExplorer'
import MarketingMotion from '@/components/marketing/MarketingMotion'
import { MarketingHero, marketingMeta } from '@/components/marketing/MarketingPage'
import { FAQ_GROUPS } from '@/components/marketing/faqData'

export const metadata = marketingMeta('/faq', 'Frequently Asked Questions', 'Answers about OpenHousePal: plans and pricing, open houses, Showcases, Agent Hub, Studio, CMAs and IDX websites for real estate agents.')

export default function FaqPage() {
  const schema = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ_GROUPS.flatMap(g => g.items).map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  return (
    <div className="flex min-h-screen flex-col bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <MarketingMotion />
      <MarketingHero path="/faq" kicker="FAQ" title="Questions, answered" accent="answered" lead="Everything agents ask about OpenHousePal, in plain words." center narrow />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 sm:px-6">
        <FaqExplorer />
        <AskQuestionBlock />
      </main>
      <Footer />
    </div>
  )
}
