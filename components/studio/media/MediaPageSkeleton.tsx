'use client'

// While a Media Lab project loads: the page's own shape (top bar, the picture, the option cards)
// softly shimmering in place - never the whole-screen "Getting things ready" loader in the middle of
// a flow (owner 11/17). `side` = a preview column beside the options, like the video editor.
export default function MediaPageSkeleton({ side = false, label = 'Opening your project' }: { side?: boolean; label?: string }) {
  const block = 'rounded-2xl bg-gray-200/70 dark:bg-white/[0.06] animate-pulse'
  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]" aria-busy="true" aria-label={label}>
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:pt-6">
        <div className="relative mb-5 overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-[#151517]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#C9A24D] to-[#e0b85f]" />
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8b7355] dark:text-[#d7b974]">{label}</p>
          <div className={`mt-2 h-5 w-56 max-w-full ${block}`} />
          <div className="mt-4 grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className={`h-1.5 rounded-full bg-gray-200 dark:bg-white/10 ${i > 5 ? 'hidden sm:block' : ''}`} />)}
          </div>
        </div>
        <div className={`grid gap-6 ${side ? 'lg:grid-cols-[360px_minmax(0,1fr)]' : ''}`}>
          <div className={`${block} ${side ? 'aspect-[9/14] max-h-[70vh] w-full' : 'aspect-video w-full'}`} />
          <div className="space-y-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-[#151517]" style={{ animationDelay: `${i * 120}ms` }}>
                <div className={`h-4 w-40 ${block}`} />
                <div className={`mt-2 h-3 w-64 max-w-full ${block}`} />
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[0, 1, 2, 3].map(k => <div key={k} className={`h-20 ${block}`} style={{ animationDelay: `${(i * 4 + k) * 60}ms` }} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
