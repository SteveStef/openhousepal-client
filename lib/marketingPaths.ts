import { ARTICLES } from '@/components/marketing/resourcesData'
import { TOOL_PAGES } from '@/components/marketing/toolPagesData'

// The addresses that exist under /tools and /resources, read straight from the pages' own lists so
// a new article or tool page is never answered "not found".
export const TOOL_SLUGS = TOOL_PAGES.map(t => t.slug)
export const ARTICLE_SLUGS = ARTICLES.map(a => a.slug)
