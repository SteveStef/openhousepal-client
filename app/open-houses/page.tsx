'use client'

import { useState, useEffect, memo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import Image from 'next/image'
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
  const [filterQuery, setFilterQuery] = useState('')

  // Filter open houses based on search query
  const filteredOpenHouses = openHouses.filter(oh => 
    oh.address.toLowerCase().includes(filterQuery.toLowerCase()) ||
    (oh.city && oh.city.toLowerCase().includes(filterQuery.toLowerCase()))
  )

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
      <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B] flex flex-col transition-colors duration-300">
  
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] dark:border-[#C9A24D] mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Checking authentication...</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B] flex flex-col transition-colors duration-300">

      <div className="flex-1 p-4 sm:p-6 pb-20">
        <div className="max-w-7xl mx-auto">

          {!showImageSelection ? (
            <div className="space-y-12">
              {/* 1. Generator Hero Section */}
              <div className="bg-white dark:bg-[#151517] rounded-3xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-8 sm:p-12 text-center relative overflow-hidden transition-colors">
                 {/* Decorative Background Elements */}
                 <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A24D]/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                 <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#111827]/5 dark:bg-white/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none"></div>

                <div className="relative z-10 max-w-3xl mx-auto">
                  <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-[#8b7355] to-gray-900 dark:from-white dark:via-[#C9A24D] dark:to-gray-200 tracking-tight mb-6">
                    Create Your Open House Kit
                  </h1>
                  <p className="text-lg text-gray-500 dark:text-gray-400 mb-10 font-light">
                    Enter a property address to instantly generate a QR code, professional PDF flyer, and sign-in form.
                  </p>

                  <form onSubmit={generateQRCode} className="relative max-w-2xl mx-auto">
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="h-6 w-6 text-gray-400 group-focus-within:text-[#8b7355] dark:group-focus-within:text-[#C9A24D] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <GooglePlacesAutocomplete
                        id="address"
                        name="address"
                        required
                        value={address}
                        onChange={setAddress}
                        placeholder="Enter property address (e.g. 123 Main St, Beverly Hills)"
                        className="block w-full pl-12 pr-32 py-5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border-2 border-transparent focus:border-[#C9A24D] rounded-2xl text-lg text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 shadow-[0_4px_20px_rgba(0,0,0,0.03)] focus:shadow-[0_8px_30px_rgba(201,162,77,0.15)] focus:outline-none transition-all duration-300"
                      />
                      <div className="absolute inset-y-2 right-2">
                        <button
                          type="submit"
                          disabled={isGenerating || isLoadingProperty}
                          className="h-full px-6 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-bold hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center"
                        >
                          {isGenerating || isLoadingProperty ? (
                            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <span>Generate</span>
                          )}
                        </button>
                      </div>
                    </div>
                    {error && (
                      <div className="absolute -bottom-8 left-0 right-0 text-center animate-fadeIn">
                        <p className="text-red-500 text-sm font-medium flex items-center justify-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {error}
                        </p>
                      </div>
                    )}
                  </form>
                </div>
              </div>

              {/* 2. Portfolio Dashboard Section */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div className="flex items-center space-x-4">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Your Portfolio</h2>
                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-full text-xs font-bold border border-gray-200 dark:border-gray-700">
                      {openHouses.length} Listings
                    </span>
                  </div>

                  {/* Portfolio Filter Search */}
                  <div className="relative max-w-md w-full sm:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search your portfolio..."
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      className="block w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#151517] border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8b7355]/20 focus:border-[#8b7355] transition-all"
                    />
                  </div>
                </div>

                {isLoadingHistory ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                     {[1, 2, 3].map(i => (
                       <div key={i} className="bg-white dark:bg-[#151517] rounded-2xl h-80 animate-pulse border border-gray-100 dark:border-gray-800"></div>
                     ))}
                  </div>
                ) : filteredOpenHouses.length === 0 ? (
                  <div className="text-center py-24 bg-white dark:bg-[#151517] rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-[#0B0B0B] rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                      {filterQuery ? 'No matching listings found' : 'Your portfolio is empty'}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mx-auto">
                      {filterQuery ? 'Try adjusting your search terms' : 'Use the generator above to create your first open house kit.'}
                    </p>
                    {filterQuery && (
                       <button 
                         onClick={() => setFilterQuery('')}
                         className="mt-4 text-[#8b7355] hover:underline text-sm font-medium"
                       >
                         Clear search
                       </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredOpenHouses.map((openHouse, index) => (
                      <OpenHouseCard
                        key={openHouse.id}
                        openHouse={openHouse}
                        index={index}
                        onViewVisitors={handleViewVisitors}
                        onViewPDF={handleViewPDF}
                        onDelete={handleDeleteClick}
                        onAddNote={handleOpenOpenHouseNoteModal}
                      />
                    ))}
                  </div>
                )}
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
          <div className="bg-white dark:bg-[#151517] rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 max-w-lg w-full overflow-hidden transform transition-all">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-[#faf9f7] dark:bg-[#0B0B0B]">
              <div>
                <h3 className="text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight">Open House Note</h3>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                  For {selectedOpenHouseForNote.address}
                </p>
              </div>
              <button
                onClick={() => setIsOpenHouseNoteModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Note Content
                </label>
                <textarea
                  value={currentOpenHouseNote}
                  onChange={(e) => setCurrentOpenHouseNote(e.target.value)}
                  className="block w-full px-4 py-3 bg-[#faf9f7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 resize-none font-medium"
                  rows={6}
                  placeholder="Enter notes about this open house (e.g., weather, turnout, specific feedback)..."
                  autoFocus
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setIsOpenHouseNoteModalOpen(false)}
                  className="px-5 py-2.5 bg-white dark:bg-transparent border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold rounded-xl transition-all duration-200 text-xs uppercase tracking-wide"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveOpenHouseNote}
                  className="px-6 py-2.5 bg-[#151517] dark:bg-white hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] text-white dark:text-[#111827] font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-xs uppercase tracking-wide"
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
    <div className="bg-white dark:bg-[#151517] rounded-2xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-6 transition-colors">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Select Cover Image</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{address}</p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-lg transition-colors duration-200 flex items-center"
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
              className="relative aspect-square bg-gray-100 dark:bg-[#0B0B0B] rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#8b7355] dark:hover:ring-[#C9A24D] transition-shadow duration-200 group"
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
                <div className="bg-white/90 dark:bg-[#151517]/90 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <svg className="w-5 h-5 text-[#8b7355] dark:text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#FAFAF7] dark:bg-[#151517] rounded-[2rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-white/50 dark:border-gray-800">
        <div className="p-8 border-b border-gray-200/50 dark:border-gray-800 bg-white/50 dark:bg-[#0B0B0B]/50">
          <h3 className="text-2xl font-black text-[#0B0B0B] dark:text-white tracking-tight">Save Open House</h3>
          <p className="text-[#6B7280] dark:text-gray-400 text-sm mt-2 font-medium">{address}</p>
        </div>
        
        <div className="p-8">
          <div className="flex items-center space-x-5 mb-8">
            <div className="w-24 h-24 bg-white dark:bg-[#0B0B0B] rounded-2xl overflow-hidden relative shadow-inner border border-gray-100 dark:border-gray-800">
              {selectedImage && (
                <Image src={selectedImage.url} alt="Selected cover" fill className="object-cover" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-base font-bold text-[#0B0B0B] dark:text-white">Cover Image Selected</p>
              <p className="text-sm text-[#6B7280] dark:text-gray-400 mt-1 font-light leading-relaxed">This image will be featured on your professional open house materials.</p>
            </div>
          </div>
          
          <div className="bg-white/80 dark:bg-[#0B0B0B]/80 rounded-2xl p-6 mb-8 border border-gray-100 dark:border-gray-800 shadow-sm">
            <h4 className="text-sm font-bold text-[#C9A24D] uppercase tracking-wider mb-3">Next Steps</h4>
            <ul className="text-sm text-[#6B7280] dark:text-gray-400 space-y-2 font-medium">
              <li className="flex items-start">
                <span className="text-[#C9A24D] mr-2">✓</span>
                QR code and property data will be secured
              </li>
              <li className="flex items-start">
                <span className="text-[#C9A24D] mr-2">✓</span>
                Visitors can scan for instant access
              </li>
              <li className="flex items-start">
                <span className="text-[#C9A24D] mr-2">✓</span>
                Lead capture starts automatically
              </li>
            </ul>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-3.5 bg-white dark:bg-[#0B0B0B] text-[#111827] dark:text-white rounded-xl font-bold border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#151515] transition-all duration-200 active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={onPreview}
              disabled={isGeneratingPreview}
              className="px-6 py-3.5 bg-white/80 dark:bg-[#0B0B0B]/80 text-[#111827] dark:text-white rounded-xl font-bold border border-[#C9A24D]/30 hover:border-[#C9A24D] transition-all duration-200 disabled:opacity-50 active:scale-95 flex items-center justify-center"
            >
              {isGeneratingPreview ? (
                <div className="w-5 h-5 border-2 border-[#C9A24D] border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Preview'
              )}
            </button>
            <button
              onClick={onSave}
              className="flex-[1.5] px-6 py-3.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-bold hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] transform transition-all duration-300 shadow-[0_10px_20px_-5px_rgba(17,24,39,0.2)] active:scale-95"
            >
              Save Listing
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#FAFAF7] dark:bg-[#151517] rounded-[2rem] shadow-2xl max-w-4xl w-full h-[80vh] max-h-[90vh] flex flex-col overflow-hidden border border-white/50 dark:border-gray-800">
        <div className="flex items-center justify-between p-8 border-b border-gray-200/50 dark:border-gray-800 bg-white/50 dark:bg-[#0B0B0B]/50">
          <h3 className="text-2xl font-black text-[#0B0B0B] dark:text-white tracking-tight">PDF Preview</h3>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-[#111827] dark:hover:text-white hover:border-[#C9A24D] transition-all duration-200 shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-hidden bg-[#FAFAF7]/50 dark:bg-[#0B0B0B]/50 relative">
          <div className="w-full h-full p-8 flex flex-col">
            <iframe
              src={pdfPreview}
              className="flex-1 w-full rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 bg-white"
              title="PDF Preview"
            />
          </div>
        </div>
        
        <div className="flex items-center justify-end space-x-4 p-8 border-t border-gray-200/50 dark:border-gray-800 bg-white/50 dark:bg-[#0B0B0B]/50">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white dark:bg-[#0B0B0B] text-[#111827] dark:text-white rounded-xl font-bold border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#151515] transition-all duration-200 active:scale-95 shadow-sm"
          >
            Close
          </button>
          <button
            onClick={onDownload}
            disabled={isGeneratingPDF}
            className="px-8 py-3 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-bold hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] transition-all duration-300 shadow-[0_10px_20px_-5px_rgba(17,24,39,0.2)] disabled:opacity-50 active:scale-95 flex items-center"
          >
            {isGeneratingPDF ? (
              <>
                <div className="w-4 h-4 border-2 border-white dark:border-[#111827] border-t-transparent rounded-full animate-spin mr-2"></div>
                Downloading...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </>
            )}
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#FAFAF7] dark:bg-[#151517] rounded-[2rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-white/50 dark:border-gray-800">
        <div className="p-8 border-b border-gray-200/50 dark:border-gray-800 bg-white/50 dark:bg-[#0B0B0B]/50">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mr-5 border border-red-100 dark:border-red-900/30 shadow-sm">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-black text-[#0B0B0B] dark:text-white tracking-tight">Remove Listing</h3>
              <p className="text-[#6B7280] dark:text-gray-400 text-sm mt-1 font-medium tracking-tight">This action is safe and reversible</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-8">
            <p className="text-base font-bold text-[#0B0B0B] dark:text-white mb-2 px-4 py-2 bg-white dark:bg-[#0B0B0B] rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm inline-block">
              {openHouse.address}
            </p>
            <p className="text-sm text-[#6B7280] dark:text-gray-400 mt-4 font-light leading-relaxed">
              This listing will be removed from your active dashboard. All associated data will be preserved securely for your records.
            </p>
          </div>

          <div className="bg-white/80 dark:bg-[#0B0B0B]/80 border border-green-100 dark:border-green-900/30 rounded-2xl p-6 mb-8 shadow-sm">
            <div className="flex items-start">
              <div className="w-6 h-6 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mr-3 mt-0.5 border border-green-100 dark:border-green-900/30">
                <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-green-900 dark:text-green-400 mb-2 uppercase tracking-wider">Data Protection</h4>
                <ul className="text-sm text-green-800/80 dark:text-green-500/80 space-y-2 font-medium">
                  <li>• Historical reports remain accessible</li>
                  <li>• Property collections remain intact</li>
                  <li>• QR codes continue to work</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 px-6 py-3.5 bg-white dark:bg-[#0B0B0B] text-[#111827] dark:text-white rounded-xl font-bold border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#151515] transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-6 py-3.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transform transition-all duration-300 shadow-[0_10px_20px_-5px_rgba(220,38,38,0.2)] active:scale-95 disabled:opacity-50"
            >
              {isDeleting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#FAFAF7] dark:bg-[#151517] rounded-[2rem] shadow-2xl max-w-4xl w-full h-[80vh] max-h-[90vh] flex flex-col overflow-hidden border border-white/50 dark:border-gray-800">
        <div className="flex items-center justify-between p-8 border-b border-gray-200/50 dark:border-gray-800 bg-white/50 dark:bg-[#0B0B0B]/50">
          <div>
            <h3 className="text-2xl font-black text-[#0B0B0B] dark:text-white tracking-tight">Open House PDF</h3>
            <p className="text-[#6B7280] dark:text-gray-400 text-sm mt-1 font-medium">{openHouse.address}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-[#111827] dark:hover:text-white hover:border-[#C9A24D] transition-all duration-200 shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-hidden bg-[#FAFAF7]/50 dark:bg-[#0B0B0B]/50 relative">
          {isGenerating ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#C9A24D] border-t-transparent mx-auto mb-4"></div>
                <p className="text-[#6B7280] dark:text-gray-400 font-medium">Generating your professional PDF...</p>
              </div>
            </div>
          ) : pdfUrl ? (
            <div className="w-full h-full p-8 flex flex-col">
              <iframe
                src={pdfUrl}
                className="flex-1 w-full rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 bg-white"
                title="Open House PDF Preview"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-500 font-medium">Failed to generate PDF. Please try again.</p>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-end space-x-4 p-8 border-t border-gray-200/50 dark:border-gray-800 bg-white/50 dark:bg-[#0B0B0B]/50">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white dark:bg-[#0B0B0B] text-[#111827] dark:text-white rounded-xl font-bold border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#151515] transition-all duration-200 active:scale-95 shadow-sm"
          >
            Close
          </button>
          {pdfUrl && (
            <button
              onClick={downloadPDF}
              className="px-8 py-3 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-bold hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] transition-all duration-300 shadow-[0_10px_20px_-5px_rgba(17,24,39,0.2)] active:scale-95 flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

// Memoized Open House Card Component
interface OpenHouseCardProps {
  openHouse: OpenHouse;
  index: number;
  onViewVisitors: (openHouse: OpenHouse) => void;
  onViewPDF: (openHouse: OpenHouse) => void;
  onDelete: (openHouse: OpenHouse) => void;
  onAddNote: (openHouse: OpenHouse) => void;
}

const OpenHouseCard = memo(function OpenHouseCard({
  openHouse,
  index,
  onViewVisitors,
  onViewPDF,
  onDelete,
  onAddNote
}: OpenHouseCardProps) {
  return (
    <div
      onClick={() => onViewVisitors(openHouse)}
      className="bg-white dark:bg-[#151517] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer flex flex-col h-full isolate transform-gpu"
    >
      {/* Card Image */}
      <div className="relative aspect-video bg-gray-100 dark:bg-[#0B0B0B] overflow-hidden">
        <Image
          src={openHouse.cover_image_url}
          alt={`Property at ${openHouse.address}`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
        
        {/* Delete Button (Top Right Overlay) */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(openHouse)
          }}
          className="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur-md text-white/80 hover:text-red-400 hover:bg-black/60 rounded-full flex items-center justify-center transition-all duration-200 z-10"
          title="Remove Listing"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>

        {/* Price Tag Overlay */}
        {openHouse.price && (
          <div className="absolute bottom-3 left-3">
            <span className="text-white font-black text-lg tracking-tight drop-shadow-md">
              ${openHouse.price?.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-5 flex flex-col flex-1">
        <div className="mb-6 flex-1">
          <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight mb-2 line-clamp-2 group-hover:text-[#8b7355] dark:group-hover:text-[#C9A24D] transition-colors">
            {openHouse.address}
          </h3>
          
          <div className="flex items-center space-x-3 text-xs font-medium text-gray-500 dark:text-gray-400">
            {openHouse.bedrooms && (
              <span className="flex items-center">
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                {openHouse.bedrooms} Beds
              </span>
            )}
            {openHouse.bathrooms && (
              <span className="flex items-center">
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                {openHouse.bathrooms} Baths
              </span>
            )}
            {openHouse.living_area && (
              <span className="flex items-center">
                 <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
                {openHouse.living_area.toLocaleString()} SqFt
              </span>
            )}
          </div>
        </div>

        {/* Action Grid */}
        <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onViewVisitors(openHouse);
            }}
            className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-bold text-xs shadow-md hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] hover:text-white transition-all duration-300 group/btn"
          >
            <svg className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            View Visitors
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onViewPDF(openHouse)
              }}
              className="flex flex-col items-center justify-center p-2 bg-gray-50 dark:bg-gray-800/50 hover:bg-[#8b7355]/10 dark:hover:bg-[#C9A24D]/10 text-gray-600 dark:text-gray-400 hover:text-[#8b7355] dark:hover:text-[#C9A24D] rounded-xl border border-gray-100 dark:border-gray-800 transition-all duration-200 group/item"
              title="Download PDF"
            >
              <svg className="w-5 h-5 mb-1 group-hover/item:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-tight">PDF Kit</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                onAddNote(openHouse)
              }}
              className="flex flex-col items-center justify-center p-2 bg-gray-50 dark:bg-gray-800/50 hover:bg-[#8b7355]/10 dark:hover:bg-[#C9A24D]/10 text-gray-600 dark:text-gray-400 hover:text-[#8b7355] dark:hover:text-[#C9A24D] rounded-xl border border-gray-100 dark:border-gray-800 transition-all duration-200 group/item"
              title="Add Note"
            >
              <svg className="w-5 h-5 mb-1 group-hover/item:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-tight">Notes</span>
            </button>

            <a
              href={openHouse.form_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center justify-center p-2 bg-gray-50 dark:bg-gray-800/50 hover:bg-[#8b7355]/10 dark:hover:bg-[#C9A24D]/10 text-gray-600 dark:text-gray-400 hover:text-[#8b7355] dark:hover:text-[#C9A24D] rounded-xl border border-gray-100 dark:border-gray-800 transition-all duration-200 group/item"
              title="Open Sign-in Form"
            >
              <svg className="w-5 h-5 mb-1 group-hover/item:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-tight">Form</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
})
