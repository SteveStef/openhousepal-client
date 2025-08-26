'use client'

export default function Footer() {
  return (
    <footer className="bg-white/80 backdrop-blur-lg border-t border-gray-200/60 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-6 h-6 bg-gradient-to-r from-gray-300 via-gray-400 to-gray-500 rounded-md flex items-center justify-center mr-2 border border-gray-300/40">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
              </svg>
            </div>
            <span className="text-gray-600 text-sm font-light">© 2024 Open House Pal. All rights reserved.</span>
          </div>
          
          <div className="flex items-center space-x-6 text-sm">
            <a href="/privacy" className="text-gray-600 hover:text-gray-900 transition-colors font-light">Privacy</a>
            <a href="/terms" className="text-gray-600 hover:text-gray-900 transition-colors font-light">Terms</a>
            <a href="/support" className="text-gray-600 hover:text-gray-900 transition-colors font-light">Support</a>
          </div>
        </div>
      </div>
    </footer>
  )
}