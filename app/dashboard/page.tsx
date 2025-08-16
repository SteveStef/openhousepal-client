'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function DashboardPage() {
  const [address, setAddress] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  const generateQRCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!address.trim()) {
      setError('Please enter a property address')
      return
    }

    setIsGenerating(true)

    // Simulate QR code generation
    setTimeout(() => {
      // Create a unique link for this property
      const propertyId = btoa(address).replace(/[^a-zA-Z0-9]/g, '').substring(0, 12)
      const formLink = `${window.location.origin}/property/${propertyId}`
      
      // Generate QR code (in a real app, you'd use a QR code library)
      // For demo purposes, we'll use a placeholder QR code service
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(formLink)}`
      
      setQrCode(qrCodeUrl)
      setIsGenerating(false)
    }, 2000)
  }

  const downloadQRCode = () => {
    if (qrCode) {
      const link = document.createElement('a')
      link.href = qrCode
      link.download = `qr-code-${address.replace(/\s+/g, '-').toLowerCase()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const copyLink = () => {
    if (address) {
      const propertyId = btoa(address).replace(/[^a-zA-Z0-9]/g, '').substring(0, 12)
      const formLink = `${window.location.origin}/property/${propertyId}`
      navigator.clipboard.writeText(formLink)
      alert('Link copied to clipboard!')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900">
      {/* Navigation */}
      <nav className="border-b border-zinc-800/40 backdrop-blur-sm bg-black/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold">EP</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">EntryPoint™</h1>
                <p className="text-xs text-zinc-400">Real Estate Lead Engine</p>
              </div>
            </Link>
            
            <div className="flex items-center space-x-4">
              <Link
                href="/collections"
                className="text-zinc-300 hover:text-white transition-colors duration-200"
              >
                Collections
              </Link>
              <span className="text-white font-medium">QR Codes</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">QR Codes</h1>
          <p className="text-zinc-400">Generate QR codes for your open house properties</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* QR Code Generator Form */}
          <div className="bg-zinc-900/40 rounded-xl p-6 border border-zinc-800/60 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-white mb-4">Property Information</h2>
            
            <form onSubmit={generateQRCode} className="space-y-4">
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-zinc-300 mb-2">
                  Property Address
                </label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800/60 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300"
                  placeholder="123 Main Street, City, State, ZIP"
                />
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
              </div>

              <div className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-700/30">
                <h3 className="text-white font-medium mb-2 text-sm">What happens next?</h3>
                <ul className="text-zinc-300 text-xs space-y-1">
                  <li>• QR code links to a custom form for this property</li>
                  <li>• Visitors can save property details to their collection</li>
                  <li>• You'll receive their contact information</li>
                  <li>• Perfect for open houses and marketing materials</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isGenerating ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Generating QR Code...
                  </div>
                ) : (
                  'Generate QR Code'
                )}
              </button>
            </form>
          </div>

          {/* QR Code Display */}
          <div className="bg-zinc-900/40 rounded-xl p-6 border border-zinc-800/60 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-white mb-4">Your QR Code</h2>
            
            {!qrCode ? (
              <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-zinc-700/50 rounded-xl">
                <div className="w-16 h-16 bg-zinc-800/50 rounded-xl flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <p className="text-zinc-400 text-center">Enter a property address to generate your QR code</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-lg shadow-lg">
                    <img
                      src={qrCode}
                      alt="Property QR Code"
                      className="w-48 h-48"
                    />
                  </div>
                </div>
                
                <div className="text-center space-y-2">
                  <p className="text-zinc-300 font-medium text-sm">{address}</p>
                  <p className="text-zinc-400 text-xs">Scan to access property details form</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={downloadQRCode}
                    className="px-3 py-2 bg-zinc-800/60 text-white rounded-lg hover:bg-zinc-700/60 transition-colors duration-200 flex items-center justify-center space-x-1 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Download</span>
                  </button>
                  
                  <button
                    onClick={copyLink}
                    className="px-3 py-2 bg-zinc-800/60 text-white rounded-lg hover:bg-zinc-700/60 transition-colors duration-200 flex items-center justify-center space-x-1 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Copy Link</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent QR Codes */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-white mb-4">Recent QR Codes</h2>
          <div className="bg-zinc-900/40 rounded-xl p-6 border border-zinc-800/60 backdrop-blur-sm">
            <div className="text-center py-6">
              <div className="w-10 h-10 bg-zinc-800/50 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-zinc-400 text-sm">No QR codes generated yet</p>
              <p className="text-zinc-500 text-xs mt-1">Your generated QR codes will appear here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}