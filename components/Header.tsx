'use client'

export default function Header() {
  return (
    <header className="bg-black/80 backdrop-blur-lg border-b border-zinc-800/60">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-r from-zinc-700 via-zinc-800 to-black rounded-lg flex items-center justify-center mr-3 border border-zinc-600/40">
              <svg className="w-4 h-4 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white font-light">EntryPoint™</h1>
          </div>
          
          <nav className="hidden md:flex items-center space-x-6">
            <a href="/collections" className="text-white font-medium">Collections</a>
            <a href="/dashboard" className="text-zinc-400 hover:text-white transition-colors font-light">QR Codes</a>
          </nav>

          <div className="flex items-center space-x-4">
            <button className="text-zinc-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5 5-5-5h5v-12"></path>
              </svg>
            </button>
            <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">JD</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}