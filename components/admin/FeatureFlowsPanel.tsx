'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, Code2, DollarSign, Plug, Search } from 'lucide-react'

// A static, hand-written developer reference - NOT live data. Every entry here describes a real
// code path as of when it was written (entrypoint file/function so a coder can jump straight to
// the source), covering every feature in the app that spends real money on an AI model or a paid
// external API. Source of truth for "what spends money" is the AIUsageEvent.event_type values
// actually recorded across the backend (see AIUsagePanel.tsx's EVENT_TYPE_LABELS for the same
// list) plus the one Google-Places flow that isn't tracked as a per-user AIUsageEvent.
//
// Keep this in sync by hand when a flow changes meaningfully - it's a snapshot, not a live query
// against the code, so it WILL drift if nobody updates it. That's an acceptable tradeoff for how
// simple and readable it stays for a coder who isn't an AI specialist.
interface FeatureFlow {
  id: string
  /** Groups related flows under one heading, e.g. "Studio Media Lab". */
  product: string
  /** The specific thing this flow does. */
  name: string
  /** The AIUsageEvent.event_type this flow's cost is recorded under, or null. */
  eventType: string | null
  /** One sentence: what triggers this and what it produces. */
  summary: string
  /** Where a coder should start reading - service file + function name. */
  entrypoint: string
  /** Numbered, in EXECUTION ORDER, one short sentence each. */
  steps: string[]
  /** Every paid provider/model this flow actually calls. */
  calls: string[]
  /** Real dollar figures found in code/config - reservation estimates, caps, ceilings, per-call prices. */
  costs: string[]
  /** Optional: things a coder should know that don't fit the happy-path steps (gaps, quirks, discrepancies actually found in the code). */
  gotchas?: string[]
}

const FLOWS: FeatureFlow[] = [
  // ---- CMA AI ----
  {
    id: 'cma_ai',
    product: 'CMA AI Reports',
    name: 'Generate AI Analysis (first run)',
    eventType: 'cma_ai',
    summary: 'Agent clicks "Generate AI Analysis" on a CMA with comps already picked; produces the first AI-reviewed valuation.',
    entrypoint: 'app/services/cma_ai_service.py -> generate_ai_analysis()',
    steps: [
      'Re-checks the subject property’s live status against Bright MLS and re-verifies each comp’s sold price, so the AI never works from stale data.',
      'Pulls free road/street data (OpenStreetMap) and a pool of nearby properties from OpenHousePal’s own MLS mirror, for extra context.',
      'Computes a provisional value estimate using OpenHousePal’s own deterministic comp-weighting math, BEFORE the AI sees anything.',
      'Builds one prompt: subject + comp facts, that provisional estimate, comp photos, and (optionally) a Google Static Map image per property.',
      'Calls Anthropic Claude to review each comp (strength/quality notes) and give a first value estimate.',
      'Runs the AI’s answer through a long chain of automated fact-checks - comps rated consistently, no invented details, no unsupported claims in the write-up. A few of these checks can trigger one small follow-up Claude call to fix a specific piece of text.',
      'Sends everything gathered so far to a SECOND, dedicated model whose only job is the final fair-market-value number, range, and confidence level - see "Final Valuation Reasoning" below. Its number overrides the first estimate.',
      'Runs one more full consistency pass on the final report text, catching any contradiction between the final number and the written explanation.',
      'Saves the finished analysis onto the report.',
    ],
    calls: ['Anthropic Claude (claude-sonnet-5) - comp review + first estimate', 'Bright MLS - live status re-check', 'OpenStreetMap - free road data', 'Google Static Maps - optional per-property map image', '(internally triggers the "Final Valuation Reasoning" flow below)'],
    costs: [
      'Reservation held before the call: $0.45, hard cap: $0.50 per generation',
      'Real cost typically runs ~$0.25–$0.28',
      'Platform-wide ceiling: $20/day, $150/month',
    ],
    gotchas: [
      'Up to 3 small "fix this one piece of text" follow-up Claude calls can fire during the fact-check chain - they cost real tokens but are NOT added to the cost figure recorded for this event, so the ledger slightly understates true spend.',
    ],
  },
  {
    id: 'cma_ai_recompute',
    product: 'CMA AI Reports',
    name: 'Recompute Valuation (after editing comps)',
    eventType: 'cma_ai_recompute',
    summary: 'Agent changes which comps are included/excluded on an existing analysis and clicks "Recompute" - cheaper than a full re-run.',
    entrypoint: 'app/services/cma_ai_service.py -> recompute_valuation()',
    steps: [
      'Re-checks Bright MLS status and re-pulls the nearby-properties context, same as the first run.',
      'Re-runs the same fact-check chain and re-weights the now-different comp set.',
      'Calls Claude again, but TEXT-ONLY this time (no photos re-sent) - just asking for an updated estimate consistent with the new comp set.',
      'Sends the result through the same "Final Valuation Reasoning" model and the same QA chain as the first run.',
      'Updates the report with the new numbers, without touching anything the agent has manually overridden.',
    ],
    calls: ['Anthropic Claude (claude-sonnet-5) - text-only updated estimate', 'Bright MLS - live status re-check', '(internally triggers the "Final Valuation Reasoning" flow below)'],
    costs: [
      'Uses the same reservation/cap/ceiling numbers as "Generate AI Analysis" above (no separate recompute-specific price found in config)',
    ],
    gotchas: [
      'Same understated-cost caveat as the first run - optional fix-up Claude calls during fact-checking aren’t folded into the recorded cost.',
    ],
  },
  {
    id: 'cma_reasoning',
    product: 'CMA AI Reports',
    name: 'Final Valuation Reasoning (internal step)',
    eventType: 'cma_reasoning',
    summary: 'Not something an agent triggers directly - runs automatically at the end of BOTH CMA flows above. A second, different AI model gives the final, authoritative number.',
    entrypoint: 'app/services/cma_ai_service.py -> _run_cma_reasoning_stage()',
    steps: [
      'Packages everything gathered so far (comps, the provisional deterministic estimate, all fact-check context) into one evidence document.',
      'Sends it to OpenAI’s reasoning model with a strict form it must fill out exactly (fair-market value, range, confidence level - no other format accepted).',
      'Checks the shape of what comes back and makes sure it doesn’t contradict any known fact.',
      'This model’s number becomes the one shown to the client - it overrides OpenHousePal’s own deterministic math (which is kept internally, for audit only).',
      'If this call fails for any reason, the WHOLE analysis fails - there is no silent fallback to a worse/guessed number.',
    ],
    calls: ['OpenAI (gpt-6-astra) - the sole call in this step'],
    costs: [
      'Reservation held: $0.75, hard cap: $1.00 per call',
      'Shares the same $20/day, $150/month platform ceiling as the CMA analysis above',
    ],
  },

  // ---- Studio Media Lab ----
  {
    id: 'studio_media_image',
    product: 'Studio Media Lab',
    name: 'Photo edit (twilight, virtual staging, lights-on, enhance)',
    eventType: 'studio_media_image',
    summary: 'Agent picks a photo + one or more effects; every effect is stacked into a single edit prompt and sent as ONE image-generation call, not one call per effect.',
    entrypoint: 'app/services/studio_media_service.py -> _run_image()',
    steps: [
      'Validates the picked effects, and that virtual staging has a room type + style chosen.',
      'Builds one combined edit prompt from every selected effect, plus a fixed "don’t misrepresent the property" and watermark-removal clause.',
      'Reserves a cost estimate against the agent’s monthly AI budget BEFORE calling any paid API.',
      'Downloads the source photo (max 12MB).',
      'Calls OpenAI gpt-image-2 once with the combined prompt to produce the edited photo.',
      '(Optional, off by default) Runs the result through 1+ extra "polish only" passes.',
      'Resizes the AI result back to the exact source photo’s pixel dimensions (gpt-image-2 only returns its own fixed sizes).',
      'Uploads the final image to S3.',
      '(Optional, off by default) Sends the image to an ML upscaler for extra sharpness.',
      'Computes the REAL cost from OpenAI’s own usage response, records it, and reconciles the earlier reservation to match.',
      'Saves the result as a new asset and logs the bytes against the agent’s storage quota.',
    ],
    calls: ['OpenAI gpt-image-2 - the edit itself', 'Runway Magnific Precision v2 - optional image upscale, disabled by default'],
    costs: [
      'Reservation estimate: $0.25 per edit, hard cap: $0.40 per generation',
      'Real gpt-image-2 cost (per code comment): ~$0.006 (low) / ~$0.05 (medium, default) / ~$0.17–$0.21 (high) quality',
      'Platform-wide ceiling: $40/day, $200/month',
    ],
  },
  {
    id: 'studio_media_video',
    product: 'Studio Media Lab',
    name: 'AI Video (photo-to-video reel)',
    eventType: 'studio_media_video',
    summary: 'Agent picks up to 7 photos; each becomes its own ~5-second clip, all clips render, then get concatenated + upscaled into one marketing video.',
    entrypoint: 'app/services/studio_media_service.py -> _run_video()',
    steps: [
      'Validates photo count (1–7) and plan access.',
      'Estimates the full job’s cost (render + optional enhance + upscale) before doing anything paid, and hard-rejects if it would ever exceed the per-generation cap.',
      'Checks the agent’s monthly AI budget has room, then reserves the estimated cost.',
      '(Style branch) If "Day → Twilight timelapse" is picked, this whole job reroutes to a different provider (Runway) at a real 10-second duration, forced to exactly 1 photo - every other style stays on the default pipeline below.',
      'For each photo, in order: crops off any MLS watermark + crops to 16:9 so the video model never stretches an off-aspect photo.',
      '(Optional, off by default) Runs the photo through an enhance pass before animating it.',
      'Builds a motion prompt (or, for the twilight style, a "camera holds still, light fades" prompt) and submits an image-to-video render job to the configured provider.',
      'Saves the asset as "processing" and returns immediately - the agent doesn’t wait on this request.',
      'The frontend polls the asset; once every clip has finished rendering, each clip gets its own automatic AI upscale pass.',
      'All finished clips are downloaded and concatenated server-side (ffmpeg) into one video, with a final resize/denoise pass.',
      'Uploads the finished video to S3, grabs a preview thumbnail frame.',
      'Computes the REAL total cost (every clip’s real render + upscale cost), records it, reconciles the reservation, and logs the bytes against the agent’s storage quota.',
      'Agent gets a one-time "your video is ready" notification.',
    ],
    calls: [
      'fal.ai Hailuo 2.3 Fast Pro - default render model (image-to-video)',
      'ByteDance upscaler via fal.ai - default per-clip upscale',
      'Runway gen4.5 - used for the Day→Twilight style, and as an alternate render/upscale pipeline',
      'MiniMax Hailuo H3 - alternate render provider, available but not default',
    ],
    costs: [
      'Hailuo clip price: $0.33/clip (Fast Pro) or $0.49/clip (Pro tier)',
      'Reservation held: $4.50, hard cap: $5.50 per generation',
      'Typical 7-photo/~30s video: ~$4.00–$4.10 total',
      'Optional post-render upscale (on an already-finished video): capped at $1.50',
      'Platform-wide ceiling: $150/day, $1,500/month',
    ],
  },

  // ---- Open House Cheat Sheet ----
  {
    id: 'cheat_sheet_places',
    product: 'Open House Cheat Sheet',
    name: 'Nearby amenities (grocery, medical, parks, airports, downtown, private schools)',
    eventType: 'external_api',
    summary: 'Agent builds/refreshes a Cheat Sheet; this is the section that finds real nearby places for the listing. Heavily cached, so this only actually costs money once per listing every 180 days.',
    entrypoint: 'app/services/nearby_amenities_service.py -> get_nearby_amenities()',
    steps: [
      'Looks up the listing’s assigned public schools first - free, from Bright MLS data + a local government school-boundary lookup, no Google call.',
      'Checks the property’s cached amenities. If cached within the last 180 days, returns that immediately - $0.00, no API calls at all. This cache is the real cost control, not the per-call limits.',
      'On a cache miss, runs a fixed sequence of Google Places lookups: grocery stores, hospitals, other medical/urgent care, parks, then a local (free) airport list re-ranked by real driving time via one Google Routes call, then downtown areas, then private schools.',
      'Each Google call’s cost is logged as it happens.',
      'Adds up the total and records it against the agent’s usage ledger (only if a real agent triggered it, not a background sync).',
      'Saves the results back onto the property so the next request for 180 days is free.',
    ],
    calls: ['Google Places API - Nearby Search & Text Search (grocery, medical, parks, downtown, private schools)', 'Google Routes API - re-ranks airports by real driving time'],
    costs: [
      'Places Nearby/Text Search: $0.032 per call',
      'Routes matrix: $0.01 per destination',
      'Cached for 180 days per listing - a re-visit or a second agent on the same listing costs nothing until then',
    ],
    gotchas: [
      'A separate config price table exists in ai_config_service.py for these same Google endpoints, but this flow doesn’t actually use it - it has its own hardcoded prices, and they don’t match (e.g. the config lists Routes at $0.005, this flow bills it at $0.01). Worth reconciling.',
    ],
  },
  {
    id: 'cheat_sheet_assembly',
    product: 'Open House Cheat Sheet',
    name: 'The rest of the Cheat Sheet (what else goes into the PDF)',
    eventType: null,
    summary: 'The nearby-amenities section above is only one of four pieces the Cheat Sheet PDF combines - listed here so the full "right order" is visible in one place.',
    entrypoint: 'frontend/lib/pdfs.tsx -> OpenHouseCheatSheetDocument',
    steps: [
      'Listing/MLS facts (address, price, beds/baths, tax, HOA, description) - already loaded earlier in the wizard. Free.',
      'Nearby amenities - see the flow above. Paid, cached.',
      'Agent branding/contact info - pulled from the agent’s own Agent Hub profile. Free.',
      'A static map image of the listing - built directly in the browser as a Google Static Maps image URL. This is a REAL, separately-billed Google call that is currently not tracked or recorded anywhere in the cost system (see note below).',
      '(Optional, opt-in) AI-written "highlights" bullets - agent taps a button to have Claude turn the listing description into short bullet points. This is a separate, real AI cost - see "AI Copywriter" below - recorded under a different event type than the rest of the cheat sheet.',
    ],
    calls: ['Google Static Maps - listing map image (untracked cost, see gotcha)', '(optional) Anthropic Claude via the AI Copywriter flow, purpose "cheat_sheet_highlights"'],
    costs: [],
    gotchas: [
      'The static map image is a real Google-billed call with NO cost tracking anywhere in the backend - it never shows up on the admin AI usage dashboard. Worth wiring up if spend visibility here matters.',
    ],
  },

  // ---- AI Blog Writer ----
  {
    id: 'blog_writer',
    product: 'AI Blog Writer',
    name: 'Guided interview -> full blog article draft, plus per-section refine',
    eventType: 'blog_writer',
    summary: 'Studio -> Blogs "Write it with AI" (and the editor’s "Draft with AI"): the agent answers topic/goal, audience + focus areas, key points, their own take, facts to cite, real sales/listings, tone/length/CTA; one structured Claude call returns a complete article that is saved as a DRAFT. Heading "Refine" buttons rewrite one section at a time.',
    entrypoint: 'app/services/ai/ai_blog_writer_service.py -> generate_article() / refine_section()',
    steps: [
      'GET /studio/blogs/ai/context pre-checks the agent’s monthly AI allowance so the UI can block with the upgrade message before the interview.',
      'Reserves budget (reserve_blog_writer: shared monthly allowance + blog_writer_global platform bucket + emergency brake) before calling anything.',
      'Calls Anthropic Claude once with a FORCED structured tool (submit_blog_article) - title, SEO fields, sections, closing CTA, facts_used.',
      'Records real cost from actual tokens and reconciles the reservation.',
      'Number audit: every figure in the article not found in the brief/real data is returned as numbers_to_verify for the agent to double-check.',
    ],
    calls: ['Anthropic Claude (claude-sonnet-5, config blog_writer_model)'],
    costs: [
      'Reservation held: $0.12 per article, $0.05 per section refine',
      'Platform-wide ceiling: $25/day, $300/month',
      'Measured: ~$0.03-$0.045 per full article (3.3K in / 2.3-3.5K out tokens)',
    ],
    gotchas: [
      'The AI never publishes - it only creates/overwrites a DRAFT.',
    ],
  },

  // ---- AI Copywriter ----
  {
    id: 'copywrite',
    product: 'AI Copywriter',
    name: 'Write/polish text + Fair Housing compliance check',
    eventType: 'copywrite',
    summary: 'One shared feature behind several buttons across the app: Settings bio, Studio description, Blog drafts, and the Cheat Sheet’s AI Highlights all call the same "write" endpoint; a separate "check" endpoint flags Fair-Housing-risky phrasing.',
    entrypoint: 'app/services/ai/ai_copywrite_service.py -> generate() / compliance_check()',
    steps: [
      'Write flow: builds one prompt from what’s being written (bio / listing description / blog / cheat sheet highlights / etc), an optional tone, and any instruction the agent typed.',
      'Reserves budget against the agent’s shared monthly AI allowance before calling anything.',
      'Calls Anthropic Claude once to produce the text.',
      'Records the real cost from actual tokens used and reconciles the reservation.',
      'Compliance-check flow (separate button, same budget pool): sends the finished text to Claude with a FORCED structured response - it can only return a list of flagged phrases + why + a suggested fix, never free-form text.',
      'Any flagged phrase that doesn’t literally appear in the original text is thrown out (guards against the model paraphrasing instead of quoting), capped at 25 flags.',
      'Same cost recording/reconcile as the write flow.',
    ],
    calls: ['Anthropic Claude (claude-haiku-5-5) - both writing and compliance-checking'],
    costs: [
      'Reservation held: $0.03 per call (both write and check)',
      'Platform-wide ceiling: $25/day, $300/month',
      'Per-agent real limiter is a SHARED monthly dollar pool across CMA/Studio Media/Copywriter combined, not a copywriter-specific limit ($5–$20/mo depending on plan tier)',
    ],
    gotchas: [
      'Compliance check is wired up next to Settings bio, Studio description, and the whole-article check in the Blog editor - Cheat Sheet Highlights currently skips it.',
      'The Fair-Housing risky-phrase list ("family", "walking distance", "master bedroom", etc) is hardcoded in the prompt text, not in config.',
    ],
  },

  // ---- AI Assistant ----
  {
    id: 'chat',
    product: 'AI Assistant',
    name: 'Chat (text conversation)',
    eventType: 'chat',
    summary: 'The AI Assistant chat box - can read (never write) an agent’s own leads, properties, CMAs, and open houses to answer questions.',
    entrypoint: 'app/api/ai_routes.py -> send_ai_message()',
    steps: [
      'Agent sends a message; checked against a max-length limit.',
      'Reserves a cost slot for this turn before doing anything expensive.',
      'If the conversation has gotten long, older messages get auto-summarized first (one small separate AI call) to keep replies cheap and fast.',
      'Calls Anthropic Claude with the conversation so far, plus a toolbox of read-only lookups (search leads, search properties, get CMA summary, get open house guests, etc).',
      'If the AI decides it needs data, it calls one of those tools itself - up to 8 times in one turn - each tool just reads OpenHousePal’s own database, no extra external cost.',
      'Once it has what it needs, it returns a final text reply.',
      'Real cost is computed from actual tokens used and logged.',
    ],
    calls: ['Anthropic Claude (claude-haiku-5-5)'],
    costs: [
      'Per-user monthly ceiling: $5.00',
      'Platform-wide ceiling: $25/day, $300/month',
    ],
    gotchas: [
      'The chat assistant NEVER sees or logs what an agent actually asked or was told - only which tools were called, for privacy.',
    ],
  },
  {
    id: 'realtime',
    product: 'AI Assistant',
    name: '"Talk to OHP" (live voice conversation)',
    eventType: 'realtime',
    summary: 'A live, interruptible voice conversation with the same AI assistant - the agent’s browser talks DIRECTLY to OpenAI, not through OpenHousePal’s server.',
    entrypoint: 'app/api/ai_routes.py -> start_realtime_session()',
    steps: [
      'Agent starts a live voice session; backend checks they’re not already at their concurrent-session/daily/monthly limits.',
      'Reserves a worst-case budget slot sized for a full session, BEFORE contacting OpenAI.',
      'Backend asks OpenAI for a short-lived, single-use voice credential - it never hands out the real API key.',
      'The agent’s browser connects directly to OpenAI over live voice (WebRTC) using that credential - OpenHousePal’s server is not in the actual audio conversation.',
      'If the AI wants to look something up mid-conversation, the browser relays that request back to OpenHousePal’s backend, which runs the exact same read-only tools the text chat uses.',
      'The browser reports real usage numbers back after each reply, which get logged as cost as the call progresses.',
      'A "still connected?" heartbeat keeps the session alive; ending the call (or going idle too long) settles the final real cost.',
    ],
    calls: ['OpenAI Realtime API (gpt-realtime-2.1-mini) - live voice, browser-to-OpenAI directly'],
    costs: [
      'Per-user monthly ceiling: $3.00',
      'Max session length: 10 minutes, 1 concurrent session per agent',
      'Platform-wide ceiling: $15/day, $150/month',
    ],
  },
  {
    id: 'tts',
    product: 'AI Assistant',
    name: 'Read Aloud (text-to-speech)',
    eventType: 'tts',
    summary: 'Agent taps "Read aloud" on an existing AI Assistant reply. Never calls Claude itself - it only reads out text some other feature already produced.',
    entrypoint: 'app/api/ai_routes.py -> get_ai_speech()',
    steps: [
      'Trims the text to a max length.',
      'Checks the agent hasn’t hit their monthly Read-Aloud spend limit.',
      'Reserves a worst-case budget slot before calling OpenAI.',
      'Sends the text to OpenAI’s text-to-speech model, gets back an MP3.',
      'Since OpenAI doesn’t report an exact cost for this endpoint, estimates it from the text length.',
      'Records the cost, reconciles the reservation, and streams the audio back.',
    ],
    calls: ['OpenAI TTS (gpt-4o-mini-tts)'],
    costs: [
      'Per-user monthly ceiling: $2.00',
      'Platform-wide ceiling: $10/day, $100/month',
    ],
  },

  // ---- Areas / Community Data ----
  {
    id: 'area_research',
    product: 'Areas / Community Data',
    name: 'Area Research (finding real schools, parks, restaurants, etc for a town)',
    eventType: 'area_research',
    summary: 'Runs ONCE per real-world town/neighborhood, platform-wide - the first time ANY agent adds it as a served area. Every agent after that reuses the same result for free, forever (until an admin forces a refresh).',
    entrypoint: 'app/services/areas/area_research_service.py -> research_community_grouped()',
    steps: [
      'Agent adds a new served area; if this exact town has already been researched by any agent, the saved result is reused instantly - no cost.',
      'For a genuinely new town, a background job splits research into 5 topic groups: schools; transport+medical; grocery+parks; restaurants+shopping+downtown; market context.',
      'Sends 5 separate requests to Claude Haiku, one per group, each allowed to actually search the web for real, named sources.',
      'Every fact that comes back is checked - it needs a real source link and can’t be geographically implausible (e.g. a "nearby" place that’s actually miles away gets rejected or downgraded).',
      'If a topic comes back empty (public schools especially never gets a free pass), one more focused follow-up call tries again just for that topic.',
      'If public schools still can’t be resolved and OpenHousePal’s own MLS data suggests a specific district, ONE upgraded call (a more capable Claude model) makes one last attempt.',
      'Total cost for all of this is recorded as one event, and the results are saved and versioned so this town is never re-researched under the same pipeline version.',
    ],
    calls: ['Anthropic Claude Haiku (claude-haiku-5-5) - the 5 grouped research calls + follow-ups, each with live web search', 'Anthropic Claude Sonnet (claude-sonnet-5) - rare, public-schools-only fallback'],
    costs: [
      'Hard cap: $1.00 per community',
      'Platform-wide ceiling: $50/day, $500/month',
      'Historical measured cost (per code comment, not current pricing): ~$0.25/community',
    ],
  },
  {
    id: 'area_narrative',
    product: 'Areas / Community Data',
    name: 'Area Narrative (the written paragraph about a town)',
    eventType: 'area_narrative',
    summary: 'The very last step of the same one-time area setup as Area Research above - writes the short paragraph agents actually see.',
    entrypoint: 'app/services/areas/area_enrichment_service.py -> _generate_narrative()',
    steps: [
      'Runs immediately after Area Research (above) and all the free data (census, Google Places, local market stats) have been gathered for this town.',
      'Reserves a small global (platform-wide, not per-agent) budget slot, since this result gets reused by every agent who later serves that town.',
      'Calls Claude once with ONLY the already-verified facts gathered above, and an explicit instruction to never invent a number or name that isn’t already in that data.',
      'Claude writes a 3–4 sentence paragraph describing the town.',
      'Saves the paragraph and shows it to every agent who serves that area from then on - it is never regenerated per agent or per page view.',
    ],
    calls: ['Anthropic Claude (claude-haiku-5-5)'],
    costs: [
      'Per-town budget: $0.02 reservation',
      'Monthly ceiling: $2.00',
    ],
  },
]

function FlowCard({ flow }: { flow: FeatureFlow }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517]">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black text-[#111827] dark:text-white">{flow.name}</p>
            {flow.eventType && (
              <span className="rounded-full bg-[#C9A24D]/15 px-2 py-0.5 font-mono text-[10px] font-black text-[#8b7355] dark:text-[#d7b974]">
                {flow.eventType}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{flow.summary}</p>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-black/20">
            <Code2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
            <p className="font-mono text-[11px] font-bold text-gray-600 dark:text-gray-300">{flow.entrypoint}</p>
          </div>

          {flow.steps.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">In order</p>
              <ol className="space-y-1.5">
                {flow.steps.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-xs font-semibold leading-relaxed text-gray-700 dark:text-gray-300">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#111827] text-[9px] font-black text-white dark:bg-white dark:text-[#111827]">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <Plug className="h-3 w-3" /> Calls
              </p>
              <ul className="space-y-1">
                {flow.calls.map((c, i) => (
                  <li key={i} className="text-xs font-semibold text-gray-600 dark:text-gray-300">{c}</li>
                ))}
              </ul>
            </div>
            {flow.costs.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <DollarSign className="h-3 w-3" /> Known costs
                </p>
                <ul className="space-y-1">
                  {flow.costs.map((c, i) => (
                    <li key={i} className="text-xs font-semibold text-gray-600 dark:text-gray-300">{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {flow.gotchas && flow.gotchas.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-900/10">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <ul className="space-y-1">
                {flow.gotchas.map((g, i) => (
                  <li key={i} className="text-xs font-semibold leading-relaxed text-amber-800 dark:text-amber-200">{g}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function FeatureFlowsPanel() {
  const [query, setQuery] = useState('')
  const products = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? FLOWS.filter(f => `${f.product} ${f.name} ${f.summary} ${f.eventType}`.toLowerCase().includes(q))
      : FLOWS
    const map = new Map<string, FeatureFlow[]>()
    for (const f of filtered) {
      if (!map.has(f.product)) map.set(f.product, [])
      map.get(f.product)!.push(f)
    }
    return Array.from(map.entries())
  }, [query])

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
        <p className="font-serif text-lg font-black text-[#111827] dark:text-white">Every feature that spends money</p>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500 dark:text-gray-400">
          A plain-language, in-order breakdown of what the backend actually does for every feature that calls a paid
          AI model or a paid external API - for a coder who needs to understand or change one of these flows without
          reverse-engineering the whole service file. This is a hand-maintained snapshot, not live data - it can drift
          from the real code over time. The entrypoint line under each one is where to start reading.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-black/20">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search features (e.g. cheat sheet, video, chat)..."
            className="w-full bg-transparent text-sm font-semibold text-[#111827] outline-none placeholder:text-gray-400 dark:text-white"
          />
        </div>
      </div>

      <div className="space-y-8">
        {products.map(([product, flows]) => (
          <div key={product}>
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974]">{product}</p>
            <div className="space-y-3">
              {flows.map(f => <FlowCard key={f.id} flow={f} />)}
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm font-bold text-gray-400 dark:border-gray-700">
            No features match that search.
          </p>
        )}
      </div>
    </div>
  )
}
