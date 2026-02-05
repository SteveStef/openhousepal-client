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
import { PropertyRecommendationsPrintView, allProperties as mockSimilarProperties } from '@/components/PropertyRecommendationsPrintView'
import { OpenHouseFlyer } from '@/components/OpenHouseFlyer'
import { PropertyRecommendationCard } from '@/components/PropertyRecommendationCard'
import { ViewPDFsModal } from '@/components/ViewPDFsModal'

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

type WizardStep = 'ADDRESS' | 'FEATURES' | 'SIMILAR_PROPS' | 'COVER_IMAGE' | 'REVIEW';

export default function OpenHousesPage() {
  const router = useRouter()
  const { user: currentUser, isAuthenticated, isLoading: isAuthenticating } = useAuth()
  
  // Wizard State
  const [currentStep, setCurrentStep] = useState<WizardStep>('ADDRESS')
  
  // Data State
  const [address, setAddress] = useState('')
  const [propertyData, setPropertyData] = useState<any>(null)
  const [selectedFeatures, setSelectedFeatures] = useState({ signinSheet: true, similarProperties: false })
  const [selectedSimilarPropertyIds, setSelectedSimilarPropertyIds] = useState<number[]>([])
  const [selectedImage, setSelectedImage] = useState<PropertyImage | null>(null)
  const [generatedOpenHouseId, setGeneratedOpenHouseId] = useState<string>('')
  const [qrCode, setQrCode] = useState('')
  
  // Loading & Error State
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingProperty, setIsLoadingProperty] = useState(false)
  const [error, setError] = useState('')
  
  // Dashboard State
  const [openHouses, setOpenHouses] = useState<OpenHouse[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [filterQuery, setFilterQuery] = useState('')
  const [notification, setNotification] = useState<{
    show: boolean
    type: 'success' | 'error'
    message: string
  }>({ show: false, type: 'success', message: '' })

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 6

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filterQuery])
  
  // Dialogs
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [openHouseToDelete, setOpenHouseToDelete] = useState<OpenHouse | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isOpenHouseNoteModalOpen, setIsOpenHouseNoteModalOpen] = useState(false)
  const [selectedOpenHouseForNote, setSelectedOpenHouseForNote] = useState<OpenHouse | null>(null)
  const [currentOpenHouseNote, setCurrentOpenHouseNote] = useState('')
  
  // View PDFs Modal State
  const [isViewPDFsModalOpen, setIsViewPDFsModalOpen] = useState(false)
  const [openHouseForPDFs, setOpenHouseForPDFs] = useState<OpenHouse | null>(null)
  
  // Printing State
  const [printingOpenHouseId, setPrintingOpenHouseId] = useState<string | null>(null)
  const [printMode, setPrintMode] = useState<'flyer' | 'recommendations'>('flyer')

  // Trigger print logic
  useEffect(() => {
    if (printingOpenHouseId) {
      // Small delay to ensure the print-only component is rendered
      const timer = setTimeout(() => {
        window.print();
        // Reset after a delay or on next tick
        setPrintingOpenHouseId(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [printingOpenHouseId]);

  // Filter open houses based on search query
  const filteredOpenHouses = openHouses.filter(oh => 
    oh.address.toLowerCase().includes(filterQuery.toLowerCase()) ||
    (oh.city && oh.city.toLowerCase().includes(filterQuery.toLowerCase()))
  )

  // Pagination Logic
  const totalPages = Math.ceil(filteredOpenHouses.length / ITEMS_PER_PAGE)
  const paginatedOpenHouses = filteredOpenHouses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

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

  // PDF Viewing Handlers
  const handleOpenViewPDFs = useCallback((openHouse: OpenHouse) => {
    setOpenHouseForPDFs(openHouse)
    setIsViewPDFsModalOpen(true)
  }, [])

  const handleCloseViewPDFs = useCallback(() => {
    setIsViewPDFsModalOpen(false)
    setOpenHouseForPDFs(null)
  }, [])

  // Unified Print Trigger
  const triggerPreview = useCallback((mode: 'flyer' | 'recommendations', id?: string) => {
    setPrintMode(mode)
    const targetId = id || generatedOpenHouseId
    if (targetId) {
       setPrintingOpenHouseId(targetId)
    }
  }, [generatedOpenHouseId])

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
        showNotification('success', '🗑 Listing removed successfully. All related data is preserved.')
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
        if (!hasValidSubscription(currentUser)) {
          router.push('/upgrade-required')
          return
        }
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

  // --- WIZARD HANDLERS ---

  // Step 1: Generate Data (Address -> Property Data)
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
        body: JSON.stringify({ address: address })
      })
      
      if (response.status === 200 && response.data) {
        setPropertyData(response.data)
        const hasImages = response.data.originalPhotos && response.data.originalPhotos.length > 0
        if (hasImages) {
          // Advance to Feature Selection
          setCurrentStep('FEATURES')
        } else {
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

  // Step 2: Feature Selection -> Next Step
  const handleFeatureSelectionComplete = (features: { signinSheet: boolean; similarProperties: boolean }) => {
    setSelectedFeatures(features)
    if (features.similarProperties) {
      setCurrentStep('SIMILAR_PROPS')
    } else {
      setCurrentStep('COVER_IMAGE')
    }
  }

  // Step 3: Similar Properties -> Next Step
  const handleSimilarPropertiesComplete = (selectedIds: number[]) => {
    setSelectedSimilarPropertyIds(selectedIds)
    setCurrentStep('COVER_IMAGE')
  }

  // Step 4: Image Selection -> Review
  const handleImageSelect = async (image: PropertyImage) => {
    setSelectedImage(image)
    if (!currentUser) return

    // Generate ID and QR code now for the review step
    const openHouseEventId = uuidv4()
    setGeneratedOpenHouseId(openHouseEventId)
    const formLink = `${window.location.origin}/open-house/${openHouseEventId}`
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(formLink)}`
    setQrCode(qrCodeUrl)
    
    setCurrentStep('REVIEW')
  }

  // Step 5: Save
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
          open_house_event_id: generatedOpenHouseId,
          // We could persist the selectedSimilarPropertyIds here if the backend supported it
        })
      })

      if (response.status === 200) {
        setCurrentStep('ADDRESS') // Reset wizard
        setShowDeleteDialog(false) // Cleanup any dialogs
        
        // Refresh history
        await loadOpenHouseHistory()
        
        // Reset local form state
        setAddress('')
        setPropertyData(null)
        setSelectedImage(null)
        setQrCode('')
        setGeneratedOpenHouseId('')
        setSelectedFeatures({ signinSheet: true, similarProperties: false })
        setSelectedSimilarPropertyIds([])
        
        showNotification('success', '🎉 Open House created successfully!')
      } else {
        throw new Error(response.error || 'Failed to save open house')
      }
      
    } catch (error) {
      console.error('Error saving open house:', error)
      showNotification('error', 'Failed to save open house. Please try again.')
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

  // Get filtered list of similar properties for the print view
  const selectedSimilarProperties = mockSimilarProperties.filter(p => selectedSimilarPropertyIds.includes(p.id))

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B] flex flex-col transition-colors duration-300 relative">
      
      {/* 1. Main Dashboard (Hidden on Print) */}
      <div className={`${printingOpenHouseId ? 'print:hidden' : ''} flex-1 flex flex-col`}>
        <div className="flex-1 p-4 sm:p-6 pb-20">
          <div className="max-w-7xl mx-auto">

            {currentStep === 'ADDRESS' ? (
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

                  <div className="min-h-[400px]">
                    {isLoadingHistory ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                          <div key={i} className="bg-white dark:bg-[#151517] rounded-2xl h-48 animate-pulse border border-gray-100 dark:border-gray-800"></div>
                        ))}
                      </div>
                    ) : filteredOpenHouses.length === 0 ? (
                      <div className="text-center py-12 bg-white dark:bg-[#151517] rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                        <div className="w-12 h-12 bg-gray-50 dark:bg-[#0B0B0B] rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-6 h-6 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                          {paginatedOpenHouses.map((openHouse, index) => (
                            <OpenHouseCard
                              key={openHouse.id}
                              openHouse={openHouse}
                              index={index}
                              onViewVisitors={handleViewVisitors}
                              onViewPDF={() => handleOpenViewPDFs(openHouse)}
                              onDelete={handleDeleteClick}
                              onAddNote={handleOpenOpenHouseNoteModal}
                            />
                          ))}
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                          <div className="flex justify-center items-center gap-4 pt-6 border-t border-gray-200 dark:border-gray-800">
                            <button
                              onClick={() => {
                                setCurrentPage(prev => Math.max(1, prev - 1));
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              disabled={currentPage === 1}
                              className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-[#151517] border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-[#202022] hover:border-[#8b7355] dark:hover:border-[#C9A24D] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                            >
                              Previous
                            </button>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Page <span className="font-bold text-gray-900 dark:text-white">{currentPage}</span> of <span className="font-bold text-gray-900 dark:text-white">{totalPages}</span>
                            </span>
                            <button
                              onClick={() => {
                                setCurrentPage(prev => Math.min(totalPages, prev + 1));
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              disabled={currentPage === totalPages}
                              className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-[#151517] border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-[#202022] hover:border-[#8b7355] dark:hover:border-[#C9A24D] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : currentStep === 'FEATURES' ? (
              <FeatureSelectionView
                address={address}
                onNext={handleFeatureSelectionComplete}
                onBack={() => {
                  setCurrentStep('ADDRESS')
                  setAddress('') // Optional: clear address or keep it? Keeping is better UX usually, but here we go back to start.
                  setPropertyData(null)
                }}
              />
            ) : currentStep === 'SIMILAR_PROPS' ? (
              <SimilarPropertiesSelectionView
                onNext={handleSimilarPropertiesComplete}
                onBack={() => setCurrentStep('FEATURES')}
              />
            ) : currentStep === 'COVER_IMAGE' ? (
               <ImageSelectionView
                propertyData={propertyData}
                address={address}
                onImageSelect={handleImageSelect}
                onBack={() => {
                  if (selectedFeatures.similarProperties) {
                    setCurrentStep('SIMILAR_PROPS')
                  } else {
                    setCurrentStep('FEATURES')
                  }
                }}
              />
            ) : null}
            
            {/* Note: Review Step is handled by the Modal overlay 'SaveOpenHouseDialog' */}
          </div>
        </div>
        <Footer />
      </div>

      {/* 2. Print-only Layouts */}
      {printMode === 'flyer' ? (
         (() => {
           const targetOpenHouse = openHouses.find(oh => oh.id === printingOpenHouseId);
           const flyerUrl = generatedOpenHouseId 
             ? `${typeof window !== 'undefined' ? window.location.origin : ''}/open-house/${generatedOpenHouseId}`
             : (targetOpenHouse?.form_url || (targetOpenHouse?.id ? `${typeof window !== 'undefined' ? window.location.origin : ''}/open-house/${targetOpenHouse.id}` : ''));
             
           return (
             <div className="hidden print:block absolute top-0 left-0 w-full h-full print-view-root bg-white">
                <OpenHouseFlyer 
                  coverImage={selectedImage?.url || targetOpenHouse?.cover_image_url || ''}
                  price={propertyData?.price || targetOpenHouse?.price || 0}
                  beds={propertyData?.bedrooms || targetOpenHouse?.bedrooms || 0}
                  baths={propertyData?.bathrooms || targetOpenHouse?.bathrooms || 0}
                  sqft={propertyData?.livingArea || targetOpenHouse?.living_area || 0}
                  qrCodeUrl={targetOpenHouse?.qr_code_url || ''}
                  openHouseUrl={flyerUrl}
                />
             </div>
           );
         })()
      ) : (
         <PropertyRecommendationsPrintView 
            openHouseId={printingOpenHouseId || ''} 
            className="hidden print:block absolute top-0 left-0 w-full"
            properties={selectedSimilarProperties.length > 0 ? selectedSimilarProperties : undefined}
         />
      )}
      
      
      {/* Save Dialog (Review Step) */}
      {currentStep === 'REVIEW' && (
        <SaveOpenHouseDialog
          address={address}
          selectedImage={selectedImage}
          qrCode={qrCode}
          onSave={saveOpenHouse}
          onCancel={() => setCurrentStep('COVER_IMAGE')}
          onPreviewFlyer={() => triggerPreview('flyer')}
          onPreviewRecommendations={() => triggerPreview('recommendations')}
          hasRecommendations={selectedFeatures.similarProperties}
        />
      )}

      {/* View PDFs Modal */}
      {isViewPDFsModalOpen && openHouseForPDFs && (
        <ViewPDFsModal
          openHouse={openHouseForPDFs}
          onClose={handleCloseViewPDFs}
          onViewFlyer={() => triggerPreview('flyer', openHouseForPDFs.id)}
          onViewRecommendations={() => triggerPreview('recommendations', openHouseForPDFs.id)}
        />
      )}

      {/* Open House Note Modal */}
      {isOpenHouseNoteModalOpen && selectedOpenHouseForNote && (
        <div className="fixed inset-0 bg-[#111827]/60 z-50 flex items-center justify-center p-4 transition-all duration-300 print:hidden">
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
        <div className="print:hidden">
          <DeleteConfirmationDialog
            openHouse={openHouseToDelete}
            onConfirm={handleDeleteConfirm}
            onCancel={handleDeleteCancel}
            isDeleting={isDeleting}
          />
        </div>
      )}
      
      {/* Toast Notification */}
      {notification.show && (
        <div className={`fixed bottom-6 right-6 z-50 transform transition-all duration-300 ease-in-out print:hidden ${
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

// Similar Properties Selection Component
const SimilarPropertiesSelectionView = memo(function SimilarPropertiesSelectionView({ onNext, onBack }: { onNext: (selectedIds: number[]) => void, onBack: () => void }) {
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const toggleProperty = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    )
  }

  return (
    <div className="bg-white dark:bg-[#151517] rounded-3xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-8 sm:p-12 transition-colors max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
         <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Select similar properties</h2>
          <p className="text-gray-500 dark:text-gray-400">Choose the listings to include in your supplemental flyer.</p>
         </div>
         <div className="text-right">
           <span className="text-4xl font-black text-[#8b7355] dark:text-[#C9A24D]">{selectedIds.length}</span>
           <span className="text-sm font-medium text-gray-400 uppercase tracking-widest ml-2">Selected</span>
         </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-12 max-h-[60vh] overflow-y-auto pr-2">
        {mockSimilarProperties.map((property) => (
          <div 
            key={property.id} 
            onClick={() => toggleProperty(property.id)}
            className={`relative rounded-xl border-2 transition-all cursor-pointer overflow-hidden group ${
              selectedIds.includes(property.id) 
                ? 'border-[#8b7355] ring-2 ring-[#8b7355]/20 ring-offset-2 dark:ring-offset-[#151517]' 
                : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'
            }`}
          >
            {/* Selection Checkbox Overlay */}
            <div className={`absolute top-2 right-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
              selectedIds.includes(property.id)
                ? 'bg-[#8b7355] border-[#8b7355] text-white'
                : 'bg-white/80 border-gray-300 text-transparent'
            }`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>

            {/* Render the generic card, but pointer-events-none so the wrapper handles click */}
            <div className="pointer-events-none">
              <PropertyRecommendationCard 
                image={property.image}
                streetAddress={property.streetAddress}
                town={property.town}
                beds={property.beds}
                baths={property.baths}
                sqft={property.sqft}
                acres={property.acres}
                yearBuilt={property.yearBuilt}
                dom={property.dom}
                hideQr={true}
                isCompact={true}
              />
            </div>
            
            {/* Overlay for unselected state to dim it slightly? Optional. */}
            {!selectedIds.includes(property.id) && (
              <div className="absolute inset-0 bg-white/10 dark:bg-black/10 group-hover:bg-transparent transition-colors pointer-events-none" />
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4 border-t border-gray-100 dark:border-gray-800 pt-8">
        <button
          onClick={onBack}
          className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-transparent text-gray-600 dark:text-gray-400 font-bold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200"
        >
          Back
        </button>
        <button
          onClick={() => onNext(selectedIds)}
          disabled={selectedIds.length === 0}
          className="w-full sm:w-auto px-10 py-4 bg-[#111827] dark:bg-white text-white dark:text-[#111827] font-bold rounded-xl shadow-lg hover:shadow-xl hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
        >
          Continue ({selectedIds.length})
        </button>
      </div>
    </div>
  )
})

// Feature Selection Component
const FeatureSelectionView = memo(function FeatureSelectionView({ address, onNext, onBack }: { address: string, onNext: (features: any) => void, onBack: () => void }) {
  const [features, setFeatures] = useState({ signinSheet: true, similarProperties: false })

  const toggleFeature = (key: 'similarProperties') => {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="bg-white dark:bg-[#151517] rounded-3xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-8 sm:p-12 transition-colors max-w-4xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">What would you like to generate?</h2>
        <p className="text-lg text-gray-500 dark:text-gray-400 font-light">Select the materials you need for <span className="font-medium text-gray-900 dark:text-white">{address}</span></p>
      </div>

      {/* Options Grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        {/* Option 1: Sign-in Sheet (MANDATORY) */}
        <div
          className="rounded-2xl p-8 border-2 border-[#8b7355] bg-[#faf9f7] dark:bg-[#1c1c1e] shadow-md flex flex-col items-center text-center gap-6 relative overflow-hidden"
        >
          <div className="w-20 h-20 rounded-full flex items-center justify-center bg-[#8b7355] text-white shadow-lg shadow-[#8b7355]/30">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <h3 className="text-xl font-bold text-[#8b7355] dark:text-[#C9A24D]">Sign-in Sheet</h3>
              <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded">Required</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">Generate a professional flyer with a unique QR code for visitor registration.</p>
          </div>
          
          {/* Checkbox Visual - Locked */}
          <div className="absolute top-4 right-4 w-6 h-6 rounded-full border-2 border-[#8b7355] bg-[#8b7355] text-white flex items-center justify-center">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
        </div>

        {/* Option 2: Similar Properties (OPTIONAL) */}
        <div
          onClick={() => toggleFeature('similarProperties')}
          className={`cursor-pointer rounded-2xl p-8 border-2 transition-all duration-300 flex flex-col items-center text-center gap-6 group relative overflow-hidden ${
            features.similarProperties 
              ? 'border-[#8b7355] bg-[#faf9f7] dark:bg-[#1c1c1e] shadow-lg scale-[1.02]' 
              : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 bg-white dark:bg-[#151517]'
          }`}
        >
          <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-colors duration-300 ${
            features.similarProperties 
              ? 'bg-[#8b7355] text-white shadow-lg shadow-[#8b7355]/30' 
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-700'
          }`}>
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h3 className={`text-xl font-bold mb-2 ${features.similarProperties ? 'text-[#8b7355] dark:text-[#C9A24D]' : 'text-gray-900 dark:text-white'}`}>Similar Properties Sheet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">Create a supplemental flyer showcasing active similar listings in the neighborhood.</p>
          </div>

          {/* Checkbox Visual */}
          <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
            features.similarProperties 
              ? 'border-[#8b7355] bg-[#8b7355] text-white' 
              : 'border-gray-200 dark:border-gray-700'
          }`}>
            {features.similarProperties && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
        <button
          onClick={onBack}
          className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-transparent text-gray-600 dark:text-gray-400 font-bold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200"
        >
          Back
        </button>
        <button
          onClick={() => onNext(features)}
          className="w-full sm:w-auto px-10 py-4 bg-[#111827] dark:bg-white text-white dark:text-[#111827] font-bold rounded-xl shadow-lg hover:shadow-xl hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] hover:text-white transform hover:-translate-y-0.5 transition-all duration-300 active:scale-95"
        >
          Continue
        </button>
      </div>
    </div>
  )
})

// Image Selection Component
const ImageSelectionView = memo(function ImageSelectionView({ propertyData, address, onImageSelect, onBack }: any) {
  const availableImages = propertyData?.originalPhotos || []
  
  return (
    <div className="bg-white dark:bg-[#151517] rounded-2xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-6 transition-colors animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Select Cover Image for Sign-in Sheet</h2>
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
    </div>
  )
})

// Save Dialog Component
const SaveOpenHouseDialog = memo(function SaveOpenHouseDialog({ address, selectedImage, qrCode, onSave, onCancel, onPreviewFlyer, onPreviewRecommendations, hasRecommendations }: any) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
      <div className="bg-[#FAFAF7] dark:bg-[#151517] rounded-[2rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-white/50 dark:border-gray-800">
        <div className="p-8 border-b border-gray-200/50 dark:border-gray-800 bg-white/50 dark:bg-[#0B0B0B]/50">
          <h3 className="text-2xl font-black text-[#0B0B0B] dark:text-white tracking-tight">Review & Save</h3>
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
              <p className="text-base font-bold text-[#0B0B0B] dark:text-white">Kit Ready to Generate</p>
              <p className="text-sm text-[#6B7280] dark:text-gray-400 mt-1 font-light leading-relaxed">
                Includes Sign-in Flyer {hasRecommendations && '& Similar Property Recommendations'}.
              </p>
            </div>
          </div>
          
          <div className="bg-white/80 dark:bg-[#0B0B0B]/80 rounded-2xl p-6 mb-8 border border-gray-100 dark:border-gray-800 shadow-sm">
            <h4 className="text-sm font-bold text-[#C9A24D] uppercase tracking-wider mb-3">Your Kit Includes</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#faf9f7] dark:bg-[#1a1a1c] rounded-lg border border-gray-100 dark:border-gray-700">
                 <div className="flex items-center">
                    <span className="text-[#C9A24D] mr-3 font-bold">✓</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sign-in Flyer</span>
                 </div>
                 <button onClick={onPreviewFlyer} className="text-xs font-bold text-[#111827] dark:text-white underline hover:text-[#8b7355] transition-colors">
                    Preview PDF
                 </button>
              </div>

              {hasRecommendations && (
                <div className="flex items-center justify-between p-3 bg-[#faf9f7] dark:bg-[#1a1a1c] rounded-lg border border-gray-100 dark:border-gray-700">
                   <div className="flex items-center">
                      <span className="text-[#C9A24D] mr-3 font-bold">✓</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Property Recommendations</span>
                   </div>
                   <button onClick={onPreviewRecommendations} className="text-xs font-bold text-[#111827] dark:text-white underline hover:text-[#8b7355] transition-colors">
                      Preview PDF
                   </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-3.5 bg-white dark:bg-[#0B0B0B] text-[#111827] dark:text-white rounded-xl font-bold border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#151515] transition-all duration-200 active:scale-95"
            >
              Back
            </button>
            <button
              onClick={onSave}
              className="flex-[2] px-6 py-3.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-bold hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] transform transition-all duration-300 shadow-[0_10px_20px_-5px_rgba(17,24,39,0.2)] active:scale-95"
            >
              Save & Finish
            </button>
          </div>
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
              <p className="text-[#6B7280] dark:text-gray-400 text-sm mt-1 font-medium tracking-tight">This action is permanent and cannot be undone</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-8">
            <p className="text-base font-bold text-[#0B0B0B] dark:text-white mb-2 px-4 py-2 bg-white dark:bg-[#0B0B0B] rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm inline-block">
              {openHouse.address}
            </p>
            <p className="text-sm text-[#6B7280] dark:text-gray-400 mt-4 font-light leading-relaxed">
              This listing and all associated visitor data will be removed from your dashboard.
            </p>
          </div>

          <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-6 mb-8 shadow-sm">
            <div className="flex items-start">
              <div className="w-6 h-6 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mr-3 mt-0.5 border border-red-100 dark:border-red-900/30">
                <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-900 dark:text-red-400 mb-2 uppercase tracking-wider">Data Loss Warning</h4>
                <ul className="text-sm text-red-800/80 dark:text-red-500/80 space-y-2 font-medium">
                  <li>• Visitor logs will be permanently deleted</li>
                  <li>• QR codes will stop working</li>
                  <li>• This action cannot be reversed</li>
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
      className="group relative flex flex-col sm:flex-row bg-white dark:bg-[#18181b] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer h-auto sm:h-40 isolate transform-gpu"
    >
      {/* Left Side: Image */}
      <div className="relative h-40 sm:h-full w-full sm:w-56 flex-shrink-0 bg-gray-100 dark:bg-[#202022]">
        <Image
          src={openHouse.cover_image_url}
          alt={`Property at ${openHouse.address}`}
          fill
          sizes="(max-width: 640px) 100vw, 300px"
          className="object-cover"
        />
        {/* Subtle Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 sm:bg-gradient-to-tr sm:from-black/50 sm:via-transparent sm:to-transparent"></div>

        {/* Price Pill Badge */}
        {openHouse.price && (
          <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
            <span className="text-white text-[10px] font-bold tracking-wide">
              ${openHouse.price.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Right Side: Content */}
      <div className="flex-1 flex flex-col p-3.5 min-w-0 gap-2">
        
        {/* Top Row: Title + Overflow */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">
            {openHouse.address}
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(openHouse)
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors -mr-1.5 -mt-1.5"
            title="Options"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
          </button>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
          {/* Beds */}
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            <span className="font-semibold">{openHouse.bedrooms || '-'}</span>
            <span className="text-gray-400 dark:text-gray-600 text-[10px]">Beds</span>
          </div>
          {/* Baths */}
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            <span className="font-semibold">{openHouse.bathrooms || '-'}</span>
            <span className="text-gray-400 dark:text-gray-600 text-[10px]">Baths</span>
          </div>
           {/* SqFt */}
           <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1" /></svg>
            <span className="font-semibold">{openHouse.living_area?.toLocaleString() || '-'}</span>
            <span className="text-gray-400 dark:text-gray-600 text-[10px]">SqFt</span>
          </div>
        </div>

        {/* Action Row */}
        <div className="mt-auto pt-1.5 flex flex-row items-center gap-2">
          
          {/* Primary CTA */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onViewVisitors(openHouse)
            }}
            className="flex-1 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-900 dark:text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors border border-transparent dark:border-white/5"
          >
            Visitors
          </button>

          {/* Secondary Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onViewPDF(openHouse) }}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-[#202022] hover:bg-gray-100 dark:hover:bg-[#2c2c2e] border border-gray-200 dark:border-gray-800 transition-colors group/btn"
              title="View PDFs"
            >
              <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 group-hover/btn:text-[#8b7355] dark:group-hover/btn:text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">PDFs</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onAddNote(openHouse) }}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-[#202022] hover:bg-gray-100 dark:hover:bg-[#2c2c2e] border border-gray-200 dark:border-gray-800 transition-colors group/btn"
              title="Add Note"
            >
              <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 group-hover/btn:text-[#8b7355] dark:group-hover/btn:text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Note</span>
            </button>

            <a
              href={openHouse.form_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-[#202022] hover:bg-gray-100 dark:hover:bg-[#2c2c2e] border border-gray-200 dark:border-gray-800 transition-colors group/btn"
              title="Open Form Link"
            >
              <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 group-hover/btn:text-[#8b7355] dark:group-hover/btn:text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Link</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
})
