'use client'

import { useState, useEffect, memo, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import Image from 'next/image'
import { Home } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete'
import { apiRequest, hasValidSubscription } from '@/lib/auth'
import { openHouseApi } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface PropertyImage {
  url: string;
  width: number;
  height: number;
  caption?: string;
}

interface OpenHouse {
  id: string;
  property_id: string;
  address: string;
  created_at: string;
  qr_code_url: string;
  cover_image_url: string;
  form_url: string;
  bedrooms?: number;
  bathrooms?: number;
  living_area?: number;
  price?: number;
  city?: string;
}

export default function OpenHousesPage() {
  const router = useRouter()
  const { user: currentUser, isAuthenticated, isLoading: isAuthenticating } = useAuth()
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
  const [showImageSelection, setShowImageSelection] = useState(false)
  const [selectedImage, setSelectedImage] = useState<PropertyImage | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [openHouses, setOpenHouses] = useState<OpenHouse[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [notification, setNotification] = useState<{
    show: boolean
    type: 'success' | 'error'
    message: string
  }>({ show: false, type: 'success', message: '' })
  const [selectedOpenHouseForPDF, setSelectedOpenHouseForPDF] = useState<OpenHouse | null>(null)
  const [showPDFViewer, setShowPDFViewer] = useState(false)
  const [generatedOpenHouseId, setGeneratedOpenHouseId] = useState<string>('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [openHouseToDelete, setOpenHouseToDelete] = useState<OpenHouse | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Open House Note Modal state
  const [isOpenHouseNoteModalOpen, setIsOpenHouseNoteModalOpen] = useState(false)
  const [selectedOpenHouseForNote, setSelectedOpenHouseForNote] = useState<OpenHouse | null>(null)
  const [currentOpenHouseNote, setCurrentOpenHouseNote] = useState('')

  // Notification helper function with cleanup
  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ show: true, type, message })
    const timeout = setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }))
    }, 5000)
    // Cleanup will happen automatically on next call or unmount
    return () => clearTimeout(timeout)
  }, [])

  const handleViewVisitors = useCallback((openHouse: any) => {
    const url = `/open-houses/visitors/${openHouse.id}`;
    router.push(url);
  }, [router])

  // PDF viewing handler
  const handleViewPDF = useCallback(async (openHouse: OpenHouse) => {
    try {
      setSelectedOpenHouseForPDF(openHouse)
      setShowPDFViewer(true)
    } catch (error) {
      console.error('Error opening PDF viewer:', error)
      showNotification('error', 'Failed to load PDF')
    }
  }, [showNotification])

  // Open House Note handlers
  const handleOpenOpenHouseNoteModal = useCallback((openHouse: OpenHouse) => {
    setSelectedOpenHouseForNote(openHouse)
    // Backend uses 'notes', ensure we use that field
    setCurrentOpenHouseNote((openHouse as any).notes || '') 
    setIsOpenHouseNoteModalOpen(true)
  }, [])

  const handleSaveOpenHouseNote = useCallback(async () => {
    if (!selectedOpenHouseForNote) return

    try {
      // API call to persist the note
      const response = await openHouseApi.updateOpenHouseNote(selectedOpenHouseForNote.id, currentOpenHouseNote)

      if (response.success) {
        // Update local state on success (Optimistic UI)
        setOpenHouses(prev => prev.map(oh => 
          oh.id === selectedOpenHouseForNote.id ? { ...oh, notes: currentOpenHouseNote } : oh
        ))

        setIsOpenHouseNoteModalOpen(false)
        setSelectedOpenHouseForNote(null)
        setCurrentOpenHouseNote('')
        showNotification('success', 'Note saved successfully')
      } else {
        showNotification('error', 'Failed to save note: ' + (response.error || 'Unknown error'))
      }
    } catch (err) {
      console.error('Error saving open house note:', err)
      showNotification('error', 'An error occurred while saving the note.')
    }
  }, [selectedOpenHouseForNote, currentOpenHouseNote, showNotification])

  // Delete handlers
  const handleDeleteClick = useCallback((openHouse: OpenHouse) => {
    setOpenHouseToDelete(openHouse)
    setShowDeleteDialog(true)
  }, [])

  const handleDeleteConfirm = async () => {
    if (!openHouseToDelete) return

    setIsDeleting(true)
    try {
      const response = await apiRequest(`/api/open-houses/${openHouseToDelete.id}`, {
        method: 'DELETE'
      })

      if (response.status === 200) {
        showNotification('success', '🗑️ Listing removed successfully. All related data is preserved.')
        await loadOpenHouseHistory() // Refresh the list
        setShowDeleteDialog(false)
        setOpenHouseToDelete(null)
      } else {
        throw new Error(response.error || 'Failed to delete open house')
      }
    } catch (error) {
      console.error('Error deleting open house:', error)
      showNotification('error', 'Failed to remove listing. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false)
    setOpenHouseToDelete(null)
  }

  // Check authentication and load data
  useEffect(() => {
    if (!isAuthenticating) {
      if (!isAuthenticated) {
        router.push(`/login?redirect=${encodeURIComponent('/open-houses')}`)
        return
      }

      if (currentUser) {
        // Check subscription status
        if (!hasValidSubscription(currentUser)) {
          router.push('/upgrade-required')
          return
        }

        // Load open house history
        loadOpenHouseHistory()
      }
    }
  }, [isAuthenticating, isAuthenticated, currentUser, router])


  const loadOpenHouseHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true)
      const response = await apiRequest('/api/open-houses')
      if (response.status === 200 && response.data) {
        setOpenHouses(response.data || [])
      }
    } catch (error) {
      console.error('Error loading open house history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

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
      const response = await apiRequest('/api/property', {
        method: 'POST',
        body: JSON.stringify({
          address: address
        })
      })
      
      if (response.status === 200 && response.data) {
        setPropertyData(response.data)

        // Check if property has images
        const hasImages = response.data.originalPhotos && response.data.originalPhotos.length > 0

        if (hasImages) {
          setShowImageSelection(true)
        } else {
          // Show error - cannot create open house without images
          setError('Cannot create an open house for this property. No images are available.')
        }
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

  const handleImageSelect = async (image: PropertyImage) => {
    setSelectedImage(image)
    
    if (!currentUser) {
      setError('User not authenticated')
      return
    }

    // Generate actual UUID that will be used consistently as open house event ID
    const openHouseEventId = uuidv4()
    setGeneratedOpenHouseId(openHouseEventId)
    
    // Generate QR code URL with new routing pattern (no agent ID in path)
    const formLink = `${window.location.origin}/open-house/${openHouseEventId}`
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(formLink)}`
    
    setQrCode(qrCodeUrl)
    setShowSaveDialog(true)
  }

  //console.log(propertyData);

  const saveOpenHouse = async () => {
    try {
      if (!currentUser || !propertyData || !selectedImage || !qrCode || !generatedOpenHouseId) {
        setError('Missing required information to save open house')
        return
      }

      const response = await apiRequest('/api/open-houses', {
        method: 'POST',
        body: JSON.stringify({
          address: address,
          property_data: propertyData,
          cover_image_url: selectedImage.url,
          open_house_event_id: generatedOpenHouseId
        })
      })

      if (response.status === 200) {
        setShowSaveDialog(false)
        setShowImageSelection(false)
        
        // Refresh the history
        await loadOpenHouseHistory()
        
        // Reset form
        setAddress('')
        setPropertyData(null)
        setSelectedImage(null)
        setQrCode('')
        setGeneratedOpenHouseId('')
        
        showNotification('success', '🎉 Open House created successfully!')
      } else {
        throw new Error(response.error || 'Failed to save open house')
      }
      
    } catch (error) {
      console.error('Error saving open house:', error)
      showNotification('error', 'Failed to save open house. Please try again.')
    }
  }

  const downloadPDF = async () => {
    if (qrCode && address && propertyData && selectedImage) {
      setIsGeneratingPDF(true)
      setError('')
      
      try {
        const { generateTemplateQRCodePDF } = await import('@/lib/pdfGenerator')
        await generateTemplateQRCodePDF({
          qrCodeUrl: qrCode,
          address: address,
          propertyImageUrl: selectedImage.url,
          propertyDetails: {
            price: propertyData.price || 0,
            beds: propertyData.bedrooms || 0,
            baths: propertyData.bathrooms || 0,
            squareFeet: propertyData.livingArea || 0,
            city: propertyData.city,
            yearBuilt: propertyData.yearBuilt,
            homeType: propertyData.homeType,
            lotSize: propertyData.lotSize,
            garage: propertyData.garageSpaces ? `${propertyData.garageSpaces} Car` : undefined
          },
          filename: `open-house-${address.replace(/\s+/g, '-').toLowerCase()}.pdf`
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
    if (qrCode && address && propertyData && selectedImage) {
      setIsGeneratingPreview(true)
      setError('')

      try {
        const { generateTemplatePDFPreview } = await import('@/lib/pdfGenerator')
        const previewUrl = await generateTemplatePDFPreview({
          qrCodeUrl: qrCode,
          address: propertyData.abbreviatedAddress || address,
          propertyImageUrl: selectedImage.url,
          propertyDetails: {
            price: propertyData.price || 0,
            beds: propertyData.bedrooms || 0,
            baths: propertyData.bathrooms || 0,
            squareFeet: propertyData.livingArea || 0,
            city: propertyData.city,
            yearBuilt: propertyData.yearBuilt,
            homeType: propertyData.homeType,
            lotSize: propertyData.lotSize
          }
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

  // Show loading screen during authentication check
  if (isAuthenticating) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] mx-auto mb-4"></div>
            <p className="text-gray-600">Checking authentication...</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col">
      <Header />
      <div className="flex-1 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">

          {!showImageSelection ? (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200/60">
              {/* Page Header */}
              <div className="border-b border-gray-100 p-8 bg-white/50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-[#8b7355] to-gray-900 tracking-tight">Property Portfolio</h1>
                    <p className="text-base text-gray-500 mt-2 font-light tracking-wide">Manage your listings and capture leads effortlessly</p>
                  </div>
                  {currentUser && (
                    <div className="flex flex-wrap items-center gap-3">
                      {openHouses.length > 0 && (
                        <div className="bg-white border border-gray-200 shadow-sm rounded-full px-4 py-1.5">
                          <span className="text-gray-700 font-medium text-sm">
                            <span className="font-bold text-[#8b7355]">{openHouses.length}</span> Active Listings
                          </span>
                        </div>
                      )}
                      <div className="flex items-center space-x-3 bg-white shadow-sm rounded-full px-2 py-2 pr-5 border border-gray-100">
                        <div className="w-8 h-8 bg-[#1a1614] rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {currentUser.first_name?.charAt(0)}{currentUser.last_name?.charAt(0)}
                          </span>
                        </div>
                        <div className="leading-none">
                          <p className="text-sm font-bold text-gray-900">
                            {currentUser.first_name} {currentUser.last_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Content Area */}
              <div className="p-4 sm:p-8 bg-gray-50/30">
                <div className="grid lg:grid-cols-2 gap-10">
                  {/* Create Form - Left Side */}
                  <div>
                    <div className="sticky top-6">
                      <div className="bg-white rounded-2xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                        <div className="mb-6">
                          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Create New Listing</h2>
                          <p className="text-gray-500 text-sm mt-1">Generate a QR code and landing page in seconds.</p>
                        </div>
                        
                        <form onSubmit={generateQRCode} className="space-y-6">
                          <div>
                            <label htmlFor="address" className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                              Property Address
                            </label>
                            <div className="relative group">
                              <GooglePlacesAutocomplete
                                id="address"
                                name="address"
                                required
                                value={address}
                                onChange={setAddress}
                                placeholder="Search by address, city, or zip..."
                                className="block w-full px-4 py-4 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-300 font-medium hover:bg-white hover:border-[#C9A24D]/30"
                              />
                            </div>
                            {error && <p className="text-red-500 text-xs font-medium mt-2 flex items-center animate-fadeIn pl-1">
                              <svg className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {error}
                            </p>}
                          </div>

                          <div className="py-2">
                            <h3 className="text-[#6B7280] font-bold mb-4 text-[10px] uppercase tracking-widest ml-1">
                              Quick Start
                            </h3>
                            <ul className="space-y-3">
                              {[
                                'Enter property address',
                                'Select the best cover image',
                                'Generate QR code & materials'
                              ].map((step, i) => (
                                <li key={i} className="flex items-center text-sm text-gray-600">
                                  <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center mr-3 flex-shrink-0">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                  {step}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <button
                            type="submit"
                            disabled={isGenerating || isLoadingProperty}
                            className="w-full px-6 py-4 bg-gradient-to-br from-[#1a1614] via-[#3a2f25] to-[#8b7355] text-white rounded-xl font-bold hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                          >
                            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            {isGenerating || isLoadingProperty ? (
                              <div className="flex items-center justify-center relative z-10">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                {isLoadingProperty ? 'Fetching Details...' : 'Processing...'}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center relative z-10">
                                Find Property & Continue
                                <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                              </div>
                            )}
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>

                  {/* Listings History - Right Side */}
                  <div>
                    <div className="mb-6 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Your Open Houses</h2>
                                                <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-100">
                                                  <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                                  </span>
                                                  <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">Live</span>
                        </span>
                      </div>
                    </div>

                    {isLoadingHistory ? (
                      <div className="flex items-center justify-center py-24">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 mx-auto mb-4"></div>
                          <p className="text-gray-500 font-medium text-sm">Loading listings...</p>
                        </div>
                      </div>
                    ) : openHouses.length === 0 ? (
                      <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                          <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">No active listings</h3>
                        <p className="text-gray-500 mb-6 max-w-xs mx-auto text-sm">Create your first open house listing to start tracking visitors.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                        {openHouses.map((openHouse, index) => (
                          <OpenHouseListItem
                            key={openHouse.id}
                            openHouse={openHouse}
                            index={index}
                            onViewVisitors={handleViewVisitors}
                            onViewPDF={handleViewPDF}
                            onDelete={handleDeleteClick}
                            onAddNote={handleOpenOpenHouseNoteModal}
                          />
                        ))}
                        
                        {/* Listing Count Footer */}
                        {openHouses.length > 5 && (
                          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">
                              Showing all {openHouses.length} listings
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Coming Soon - Find Open Houses Section */}
              <div className="mt-8 sm:mt-12">
                <div className="bg-gradient-to-br from-gray-900 to-[#1a1614] rounded-2xl overflow-hidden relative shadow-2xl">
                  {/* Decorative Elements */}
                  <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-[#8b7355] rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-pulse"></div>
                  <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-[#8b7355] rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
                  
                  <div className="relative p-8 sm:p-12 text-center z-10">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-[#8b7355]/20 border border-[#8b7355]/30 text-[#8b7355] text-[10px] font-black tracking-widest uppercase mb-6">
                      Coming Soon
                    </span>
                    
                    <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight">Discover Open Houses</h2>
                    <p className="text-gray-400 mb-10 max-w-2xl mx-auto text-lg font-light leading-relaxed">
                      Connect with the community. Explore listings from other top agents, track market trends, and build your referral network.
                    </p>

                    <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
                      {[
                        { title: 'Location Search', desc: 'Find open houses by neighborhood' },
                        { title: 'Smart Filters', desc: 'Filter by price, type, and date' },
                        { title: 'Market Insights', desc: 'Track local property trends' }
                      ].map((feature, i) => (
                        <div key={i} className="bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-colors duration-300">
                          <h3 className="text-white font-bold text-sm mb-2">{feature.title}</h3>
                          <p className="text-gray-400 text-xs">{feature.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Image Selection View */
            <ImageSelectionView
              propertyData={propertyData}
              address={address}
              onImageSelect={handleImageSelect}
              onBack={() => setShowImageSelection(false)}
            />
          )}
        </div>
      </div>
      <Footer />
      
      {/* Save Dialog */}
      {showSaveDialog && (
        <SaveOpenHouseDialog
          address={address}
          selectedImage={selectedImage}
          qrCode={qrCode}
          onSave={saveOpenHouse}
          onCancel={() => setShowSaveDialog(false)}
          onPreview={previewPDF}
          onDownload={downloadPDF}
          isGeneratingPreview={isGeneratingPreview}
          isGeneratingPDF={isGeneratingPDF}
        />
      )}
      
      {/* PDF Preview Modal */}
      {showPreview && pdfPreview && (
        <PDFPreviewModal
          pdfPreview={pdfPreview}
          onClose={() => setShowPreview(false)}
          onDownload={downloadPDF}
          isGeneratingPDF={isGeneratingPDF}
        />
      )}

      {/* Open House Note Modal */}
      {isOpenHouseNoteModalOpen && selectedOpenHouseForNote && (
        <div className="fixed inset-0 bg-[#111827]/60 z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 max-w-lg w-full overflow-hidden transform transition-all">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-[#faf9f7]">
              <div>
                <h3 className="text-lg font-black text-[#0B0B0B] tracking-tight">Open House Note</h3>
                <p className="text-xs font-medium text-gray-500 mt-0.5">
                  For {selectedOpenHouseForNote.address}
                </p>
              </div>
              <button
                onClick={() => setIsOpenHouseNoteModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">
                  Note Content
                </label>
                <textarea
                  value={currentOpenHouseNote}
                  onChange={(e) => setCurrentOpenHouseNote(e.target.value)}
                  className="block w-full px-4 py-3 bg-[#faf9f7] border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 resize-none font-medium"
                  rows={6}
                  placeholder="Enter notes about this open house (e.g., weather, turnout, specific feedback)..."
                  autoFocus
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setIsOpenHouseNoteModalOpen(false)}
                  className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold rounded-xl transition-all duration-200 text-xs uppercase tracking-wide"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveOpenHouseNote}
                  className="px-6 py-2.5 bg-[#1a1614] hover:bg-[#8b7355] text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-xs uppercase tracking-wide"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && openHouseToDelete && (
        <DeleteConfirmationDialog
          openHouse={openHouseToDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          isDeleting={isDeleting}
        />
      )}

      {/* Open House PDF Viewer Modal */}
      {showPDFViewer && selectedOpenHouseForPDF && (
        <OpenHousePDFViewer
          openHouse={selectedOpenHouseForPDF}
          onClose={() => {
            setShowPDFViewer(false)
            setSelectedOpenHouseForPDF(null)
          }}
        />
      )}
      
      {/* Toast Notification */}
      {notification.show && (
        <div className={`fixed bottom-6 right-6 z-50 transform transition-all duration-300 ease-in-out ${
          notification.show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}>
          <div className={`p-4 rounded-xl shadow-lg border-l-4 min-w-[320px] max-w-md ${
            notification.type === 'success' 
              ? 'bg-white border-l-green-500 shadow-green-100' 
              : 'bg-white border-l-red-500 shadow-red-100'
          }`}>
            <div className="flex items-start space-x-3">
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                notification.type === 'success' 
                  ? 'bg-green-100 text-green-600' 
                  : 'bg-red-100 text-red-600'
              }`}>
                {notification.type === 'success' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  notification.type === 'success' ? 'text-green-900' : 'text-red-900'
                }`}>
                  {notification.message}
                </p>
              </div>
              <button
                onClick={() => setNotification(prev => ({ ...prev, show: false }))}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Image Selection Component
const ImageSelectionView = memo(function ImageSelectionView({ propertyData, address, onImageSelect, onBack }: any) {
  const availableImages = propertyData?.originalPhotos || []
  
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200/60 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Select Cover Image</h2>
          <p className="text-gray-600 text-sm mt-1">{address}</p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200 flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {availableImages.map((photo: any, index: number) => {
          const imageUrl = photo.mixedSources?.jpeg?.[0]?.url || photo.url
          return (
            <div
              key={index}
              className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#8b7355] transition-shadow duration-200 group"
              onClick={() => onImageSelect({ url: imageUrl, width: 400, height: 300 })}
            >
              <Image
                src={imageUrl}
                alt={`Property view ${index + 1}`}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                <div className="bg-white/90 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <svg className="w-5 h-5 text-[#8b7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Note: This section is no longer shown since we auto-skip when no images are available */}

    </div>
  )
})

// Save Dialog Component
const SaveOpenHouseDialog = memo(function SaveOpenHouseDialog({ address, selectedImage, qrCode, onSave, onCancel, onPreview, onDownload, isGeneratingPreview, isGeneratingPDF }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Save Open House</h3>
          <p className="text-gray-600 text-sm mt-1">{address}</p>
        </div>
        
        <div className="p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden relative">
              {selectedImage && (
                <Image src={selectedImage.url} alt="Selected cover" fill className="object-cover" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Cover Image Selected</p>
              <p className="text-xs text-gray-500 mt-1">This image will be featured on your open house materials</p>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-2">What happens next?</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• QR code and property data will be saved to your account</li>
              <li>• Visitors can scan QR code to access property details</li>
              <li>• Lead information will be collected automatically</li>
              <li>• You can download marketing materials anytime</li>
            </ul>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={onPreview}
              disabled={isGeneratingPreview}
              className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 rounded-lg transition-colors duration-200 disabled:opacity-50"
            >
              {isGeneratingPreview ? '...' : 'Preview'}
            </button>
            <button
              onClick={onSave}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-lg hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300"
            >
              Save Open House
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

// PDF Preview Modal Component
const PDFPreviewModal = memo(function PDFPreviewModal({ pdfPreview, onClose, onDownload, isGeneratingPDF }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">PDF Preview</h3>
          <button
            onClick={onClose}
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
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200"
          >
            Close
          </button>
          <button
            onClick={onDownload}
            disabled={isGeneratingPDF}
            className="px-4 py-2 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-lg hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300 disabled:opacity-50"
          >
            {isGeneratingPDF ? 'Downloading...' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  )
})

// Delete Confirmation Dialog Component
const DeleteConfirmationDialog = memo(function DeleteConfirmationDialog({
  openHouse,
  onConfirm,
  onCancel,
  isDeleting
}: {
  openHouse: OpenHouse
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-4">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Remove Listing</h3>
              <p className="text-gray-600 text-sm mt-1">This action is safe and reversible</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-900 mb-2">
              {openHouse.address}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              This listing will be removed from your dashboard, but all data will be preserved for your records.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-green-900 mb-1">Data Protection</h4>
                <ul className="text-xs text-green-800 space-y-1">
                  <li>• All visitor information is preserved</li>
                  <li>• Property collections remain intact</li>
                  <li>• QR codes continue to work</li>
                  <li>• Visitor can still access their collections</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:shadow-lg hover:shadow-red-500/25 transition-all duration-300 disabled:opacity-50"
            >
              {isDeleting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Removing...
                </div>
              ) : (
                'Remove Listing'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

// Open House PDF Viewer Component
const OpenHousePDFViewer = memo(function OpenHousePDFViewer({ openHouse, onClose }: { openHouse: OpenHouse, onClose: () => void }) {
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const { user: currentUser } = useAuth()

  // Generate PDF on mount
  useEffect(() => {
    const generatePDF = async () => {
      setIsGenerating(true)
      try {
        // Generate PDF preview using the template
        const { generateTemplatePDFPreview } = await import('@/lib/pdfGenerator')
        const pdfDataUrl = await generateTemplatePDFPreview({
          qrCodeUrl: openHouse.qr_code_url,
          address: openHouse.address,
          propertyImageUrl: openHouse.cover_image_url,
          propertyDetails: {
            beds: openHouse.bedrooms,
            baths: openHouse.bathrooms,
            squareFeet: openHouse.living_area,
            price: openHouse.price,
            city: openHouse.city,
            // yearBuilt: openHouse.year_built,
            // homeType: openHouse.home_type,
            // lotSize: openHouse.lot_size,
            // garage: openHouse.garage_spaces ? `${openHouse.garage_spaces} Car` : undefined
          }
        })
        setPdfUrl(pdfDataUrl)
      } catch (error) {
        console.error('Error generating PDF:', error)
      } finally {
        setIsGenerating(false)
      }
    }

    generatePDF()
  }, [openHouse])

  const downloadPDF = async () => {
    try {
      // Generate and download PDF using the template function
      const { generateTemplateQRCodePDF } = await import('@/lib/pdfGenerator')
      await generateTemplateQRCodePDF({
        qrCodeUrl: openHouse.qr_code_url,
        address: openHouse.address,
        propertyImageUrl: openHouse.cover_image_url,
        propertyDetails: {
          beds: openHouse.bedrooms,
          baths: openHouse.bathrooms,
          squareFeet: openHouse.living_area,
          price: openHouse.price,
          city: openHouse.city,
          // yearBuilt: openHouse.year_built,
          // homeType: openHouse.home_type,
          // lotSize: openHouse.lot_size,
          // garage: openHouse.garage_spaces ? `${openHouse.garage_spaces} Car` : undefined
        },
        filename: `${openHouse.address.replace(/[^a-zA-Z0-9]/g, '_')}_OpenHouse.pdf`
      })
    } catch (error) {
      console.error('Error downloading PDF:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Open House PDF</h3>
            <p className="text-gray-600 text-sm mt-1">{openHouse.address}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 p-6 overflow-auto">
          {isGenerating ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] mx-auto mb-4"></div>
                <p className="text-gray-600">Generating PDF...</p>
              </div>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-[500px] border border-gray-200 rounded-lg"
              title="Open House PDF Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-600">Failed to generate PDF</p>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200"
          >
            Close
          </button>
          {pdfUrl && (
            <button
              onClick={downloadPDF}
              className="px-4 py-2 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-lg hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300"
            >
              Download PDF
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

// Memoized Open House List Item Component - prevents re-renders when parent state changes
interface OpenHouseListItemProps {
  openHouse: OpenHouse;
  index: number;
  onViewVisitors: (openHouse: OpenHouse) => void;
  onViewPDF: (openHouse: OpenHouse) => void;
  onDelete: (openHouse: OpenHouse) => void;
  onAddNote: (openHouse: OpenHouse) => void;
}

const OpenHouseListItem = memo(function OpenHouseListItem({
  openHouse,
  index,
  onViewVisitors,
  onViewPDF,
  onDelete,
  onAddNote
}: OpenHouseListItemProps) {
  return (
    <div
      onClick={() => onViewVisitors(openHouse)}
      className="bg-white rounded-xl border border-gray-100 p-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-gray-200 transition-all duration-300 group cursor-pointer relative"
    >
      <div className="flex items-start gap-4">
        {/* Property Image */}
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shadow-sm relative group-hover:scale-[1.02] transition-transform duration-300">
            <Image
              src={openHouse.cover_image_url}
              alt={`Property at ${openHouse.address}`}
              width={400}
              height={400}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute -top-2 -left-2 w-5 h-5 bg-[#1a1614] rounded-full flex items-center justify-center shadow-lg border-2 border-white">
            <span className="text-white text-[9px] font-bold">{index + 1}</span>
          </div>
        </div>

        {/* Property Info */}
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex justify-between items-start mb-1">
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#8b7355] transition-colors truncate pr-4">
              {openHouse.address}
            </h3>
            {/* Status Badge - Optional */}
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-100 uppercase tracking-wide">
              Active
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mb-2">
            {openHouse.price && (
              <span className="font-bold text-gray-900 text-base tracking-tight">${openHouse.price?.toLocaleString()}</span>
            )}
            <div className="flex items-center space-x-2 text-[10px] font-medium text-gray-400">
              {openHouse.bedrooms && (
                <span>{openHouse.bedrooms} Beds</span>
              )}
              {openHouse.bathrooms && (
                <span>{openHouse.bathrooms} Baths</span>
              )}
              {openHouse.living_area && (
                <span>{openHouse.living_area.toLocaleString()} SqFt</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center px-3 py-1 bg-gradient-to-br from-[#1a1614] via-[#3a2f25] to-[#8b7355] text-white rounded-lg font-bold text-[10px] shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group/btn">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
              <svg className="w-3.5 h-3.5 mr-1.5 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="relative z-10">View Visitors</span>
            </div>

            <div className="h-3 w-px bg-gray-200 mx-0.5"></div>

            <button
              onClick={(e) => {
                e.stopPropagation()
                onAddNote(openHouse)
              }}
              className="p-1 text-gray-400 hover:text-[#8b7355] hover:bg-gray-100 rounded-lg transition-all duration-200"
              title="Add/View Note"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                onViewPDF(openHouse)
              }}
              className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
              title="Download PDF"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>

            <a
              href={openHouse.form_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
              title="Open Sign-in Form"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(openHouse)
              }}
              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 ml-auto"
              title="Remove Listing"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})
