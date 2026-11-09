// /llms.txt - the plain summary AI answer tools read (owner, 11/09). Built from the approved tool pages, FAQ
// and plan prices (lib/seoSummary.ts), so it always matches the site.
import { llmsText } from '@/lib/seoSummary'

export const dynamic = 'force-static'

export function GET() {
  return new Response(llmsText(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
}
