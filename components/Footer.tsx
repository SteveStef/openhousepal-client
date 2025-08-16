'use client'

export default function Footer() {
  return (
    <footer className="bg-black/80 backdrop-blur-lg border-t border-zinc-800/60 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-6 h-6 bg-gradient-to-r from-zinc-700 via-zinc-800 to-black rounded-md flex items-center justify-center mr-2 border border-zinc-600/40">
              <svg className="w-3 h-3 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
              </svg>
            </div>
            <span className="text-zinc-400 text-sm font-light">© 2024 EntryPoint™. All rights reserved.</span>
          </div>
          
          <div className="flex items-center space-x-6 text-sm">
            <a href="/privacy" className="text-zinc-400 hover:text-white transition-colors font-light">Privacy</a>
            <a href="/terms" className="text-zinc-400 hover:text-white transition-colors font-light">Terms</a>
            <a href="/support" className="text-zinc-400 hover:text-white transition-colors font-light">Support</a>
          </div>
        </div>
      </div>
    </footer>
  )
}