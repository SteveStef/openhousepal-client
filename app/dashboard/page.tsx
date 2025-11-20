'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { apiRequest } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'

export default function DashboardPage() {
  const { user: currentUser } = useAuth()
  const [address, setAddress] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const [pdfPreview, setPdfPreview] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState('')
  const [propertyData, setPropertyData] = useState<any>(null)
  const [isLoadingProperty, setIsLoadingProperty] = useState(false)

  const generateQRCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!address.trim()) {
      setError('Please enter a property address')
      return
    }

    setIsGenerating(true)
    setIsLoadingProperty(true)

    try {
      // Fetch property data and save to database in one request
      const response = await apiRequest('/api/property', {
        method: 'POST',
        body: JSON.stringify({
          address: address
        })
      })
      
      if (response.status === 200 && response.data) {
        setPropertyData(response.data)
        const propertyId = response.data.property_id
        
        const formLink = `${window.location.origin}/open-house/${propertyId}`
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(formLink)}`
        
        setQrCode(qrCodeUrl)
      } else {
        setError(`Failed to fetch property data: ${response.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error fetching property data:', error)
      setError('Unable to fetch property data. Please check the address and try again.')
    } finally {
      setIsGenerating(false)
      setIsLoadingProperty(false)
    }
  }

  const downloadPDF = async () => {
    if (qrCode && address && propertyData) {
      setIsGeneratingPDF(true)
      setError('')
      
      try {
        // Get property image URL from the fetched data or fallback to placeholder
        const propertyImageUrl = propertyData.originalPhotos?.[0]?.mixedSources?.jpeg?.[0]?.url ||
                                'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop'

        const { generateVerticalBrandedQRCodePDF } = await import('@/lib/pdfGenerator')
        const isPremium = currentUser?.plan_tier === "PREMIUM"
        await generateVerticalBrandedQRCodePDF({
          qrCodeUrl: qrCode,
          address: address,
          propertyImageUrl: propertyImageUrl,
          propertyDetails: {
            price: propertyData.price || 0,
            beds: propertyData.bedrooms || 0,
            baths: propertyData.bathrooms || 0,
            squareFeet: propertyData.livingArea || 0,
            yearBuilt: propertyData.yearBuilt,
            homeType: propertyData.homeType,
            lotSize: propertyData.lotSize,
            garage: propertyData.garageSpaces ? `${propertyData.garageSpaces} Car` : undefined
          },
          filename: `property-qr-${address.replace(/\s+/g, '-').toLowerCase()}.pdf`,
          isPremium
        })
      } catch (error) {
        console.error('Error generating PDF:', error)
        setError('Failed to generate PDF. Please try again.')
      } finally {
        setIsGeneratingPDF(false)
      }
    }
  }

  const previewPDF = async () => {
    if (qrCode && address && propertyData) {
      setIsGeneratingPreview(true)
      setError('')
      
      try {
        // Get property image URL from the fetched data or fallback to placeholder
        const propertyImageUrl = propertyData.originalPhotos?.[0]?.mixedSources?.jpeg?.[0]?.url ||
                                'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop'

        const { generateVerticalBrandedPDFPreview } = await import('@/lib/pdfGenerator')
        const isPremium = currentUser?.plan_tier === "PREMIUM"
        const previewUrl = await generateVerticalBrandedPDFPreview({
          qrCodeUrl: qrCode,
          address: address,
          propertyImageUrl: propertyImageUrl,
          propertyDetails: {
            price: propertyData.price || 0,
            beds: propertyData.bedrooms || 0,
            baths: propertyData.bathrooms || 0,
            squareFeet: propertyData.livingArea || 0,
            yearBuilt: propertyData.yearBuilt,
            homeType: propertyData.homeType,
            lotSize: propertyData.lotSize,
            garage: propertyData.garageSpaces ? `${propertyData.garageSpaces} Car` : undefined
          },
          isPremium
        })
        setPdfPreview(previewUrl)
        setShowPreview(true)
      } catch (error) {
        console.error('Error generating PDF preview:', error)
        setError('Failed to generate PDF preview. Please try again.')
      } finally {
        setIsGeneratingPreview(false)
      }
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
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] flex flex-col">
      <Header />
      <div className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">QR Codes</h1>
          <p className="text-gray-600">Generate QR codes for your open house properties</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* QR Code Generator Form */}
          <div className="bg-white/95 rounded-2xl shadow-xl border border-gray-200/60 backdrop-blur-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Property Information</h2>
            
            <form onSubmit={generateQRCode} className="space-y-4">
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                  Property Address
                </label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white/60 border border-gray-200/50 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8b7355]/60 focus:border-[#8b7355]/60 transition-all duration-300 text-sm"
                  placeholder="123 Main Street, City, State, ZIP"
                />
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
              </div>

              <div className="bg-gray-50/30 rounded-lg p-3 border border-gray-200/30">
                <h3 className="text-gray-900 font-medium mb-2 text-sm">What happens next?</h3>
                <ul className="text-gray-700 text-xs space-y-1">
                  <li>• QR code links to a custom form for this property</li>
                  <li>• Visitors can save property details to their collection</li>
                  <li>• You'll receive their contact information</li>
                  <li>• Perfect for open houses and marketing materials</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={isGenerating || isLoadingProperty}
                className="w-full px-6 py-3 bg-[#8b7355] text-white rounded-lg font-semibold hover:bg-[#7a6449] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating || isLoadingProperty ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    {isLoadingProperty ? 'Fetching Property Data...' : 'Generating QR Code...'}
                  </div>
                ) : (
                  'Generate QR Code'
                )}
              </button>
            </form>
          </div>

          {/* QR Code Display */}
          <div className="bg-white/95 rounded-2xl shadow-xl border border-gray-200/60 backdrop-blur-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your QR Code</h2>
            
            {!qrCode ? (
              <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300/50 rounded-xl">
                <div className="w-16 h-16 bg-gray-100/50 rounded-xl flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <p className="text-gray-600 text-center">Enter a property address to generate your QR code</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-lg shadow-lg">
                    <Image
                      src={qrCode}
                      alt="Property QR Code"
                      width={192}
                      height={192}
                      className="w-48 h-48"
                    />
                  </div>
                </div>
                
                <div className="text-center space-y-2">
                  <p className="text-gray-700 font-medium text-sm">{address}</p>
                  <p className="text-gray-600 text-xs">Scan to access property details form</p>
                </div>
                
                {/* Property Details */}
                {propertyData && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <h4 className="font-semibold text-gray-900 text-sm">Property Details</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">Price:</span> ${propertyData.price?.toLocaleString() || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Type:</span> {propertyData.homeType || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Beds:</span> {propertyData.bedrooms || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Baths:</span> {propertyData.bathrooms || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Sqft:</span> {propertyData.livingArea?.toLocaleString() || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Built:</span> {propertyData.yearBuilt || 'N/A'}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={previewPDF}
                    disabled={isGeneratingPreview}
                    className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingPreview ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>Preview</span>
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={downloadPDF}
                    disabled={isGeneratingPDF}
                    className="px-3 py-2 bg-white text-gray-700 hover:bg-[#f5f4f2] border border-gray-200 hover:border-gray-300 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingPDF ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Download</span>
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={copyLink}
                    className="px-3 py-2 bg-white text-gray-700 hover:bg-[#f5f4f2] border border-gray-200 hover:border-gray-300 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-1 text-sm"
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
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent QR Codes</h2>
          <div className="bg-white/95 rounded-2xl shadow-xl border border-gray-200/60 backdrop-blur-lg p-6">
            <div className="text-center py-6">
              <div className="w-10 h-10 bg-gray-100/50 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">No QR codes generated yet</p>
              <p className="text-gray-500 text-xs mt-1">Your generated QR codes will appear here</p>
            </div>
          </div>
        </div>
        </div>
      </div>
      <Footer />
      
      {/* PDF Preview Modal */}
      {showPreview && pdfPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">PDF Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 p-6 overflow-auto">
              <iframe
                src={pdfPreview}
                className="w-full h-[600px] border border-gray-200 rounded-lg"
                title="PDF Preview"
              />
            </div>
            
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200"
              >
                Close
              </button>
              <button
                onClick={() => {
                  downloadPDF()
                  setShowPreview(false)
                }}
                disabled={isGeneratingPDF}
                className="px-4 py-2 bg-[#8b7355] hover:bg-[#7a6449] text-white rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingPDF ? 'Downloading...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
