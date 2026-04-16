'use client'

import { useState, useEffect, memo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { Bed, Bath, BoxSelect, DollarSign } from 'lucide-react'
import Image from 'next/image'
import Footer from '@/components/Footer'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete'
import { apiRequest, hasValidSubscription } from '@/lib/auth'
import { openHouseApi } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { PropertyRecommendationCard } from '@/components/PropertyRecommendationCard'
import { ViewPDFsModal } from '@/components/ViewPDFsModal'
import PDFPreviewModal from '@/components/PDFPreviewModal'

interface PropertyImage {
  url: string;
  width: number;
  height: number;
  caption?: string;
}

interface OpenHouse {
  id: string;
  openHouseEventId: string;
  agentId?: string;
  address: string;
  createdAt: string;
  qrCodeUrl: string;
  coverImageUrl: string;
  formUrl: string;
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number;
  price?: number;
  BedroomsTotal?: number;
  BathroomsTotal?: number;
  LivingArea?: number;
  ListPrice?: number;
  city?: string;
  notes?: string;
  similarPropertyIds?: string[];
  similarPropertiesSnapshot?: any[];
}

type WizardStep = 'ADDRESS' | 'FEATURES' | 'PREFERENCES' | 'SIMILAR_PROPS' | 'COVER_IMAGE' | 'REVIEW';

interface SearchPreferences {
  minPrice: number;
  maxPrice: number;
  minBeds: number;
  minBaths: number;
  radius: number;
}

// --- HELPERS ---
const formatStreetAddress = (address: string) => {
  if (!address) return "";
  const parts = address.split(',');
  const rawAddress = parts[0].trim();
  return rawAddress
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatAddress = (address: string) => {
  if (!address) return "";
  const parts = address.split(',');
  
  // Usually address is: Street, City, State Zip, County
  // We want to keep everything before the Zip, and the Zip itself, but remove County if it follows.
  
  // If it's a typical full address with many commas
  if (parts.length > 2) {
    const street = parts[0].trim();
    const city = parts[1].trim();
    const stateZip = parts[2].trim(); // This might contain "PA 19087 Delaware"
    
    // Clean up StateZip to remove anything after the 5-digit zip code
    const zipMatch = stateZip.match(/^([A-Z]{2}\s+\d{5})/);
    const cleanedStateZip = zipMatch ? zipMatch[1] : stateZip;
    
    const rawAddress = `${street}, ${city}, ${cleanedStateZip}`;
    return rawAddress
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  const rawAddress = parts.length > 1 
    ? `${parts[0].trim()}, ${parts[1].trim()}`
    : parts[0].trim();
  
  return rawAddress
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatStreetAndCity = (address: string, city?: string) => {
  if (!address) {
    return "";
  }
  const parts = address.split(',');
  
  const street = parts[0].trim();
  const targetCity = city || (parts.length >= 2 ? parts[1].trim() : "");
  
  if (targetCity) {
    // If the street already includes the city, don't append it again
    if (street.toLowerCase().includes(targetCity.toLowerCase())) {
      return street
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    const rawAddress = `${street}, ${targetCity}`;
    return rawAddress
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  return formatStreetAddress(address);
};

export default function OpenHousesPage() {
  return (
    <AuthGuard>
      <BrokerAuthorizationGuard>
        <SubscriptionGuard requiredPlan="BASIC">
          <OpenHouseContent />
        </SubscriptionGuard>
      </BrokerAuthorizationGuard>
    </AuthGuard>
  )
}

function OpenHouseContent() {
  const router = useRouter()
  const { user: currentUser, isAuthenticated, isLoading: isAuthenticating } = useAuth()
  const { showToast } = useToast()
  
  // Wizard State
  const [currentStep, setCurrentStep] = useState<WizardStep>('ADDRESS')
  
  // Data State
  const [address, setAddress] = useState('')
  const [coordinates, setCoordinates] = useState<{ lat: number, lng: number } | null>(null)
  const [propertyData, setPropertyData] = useState<any>(null)
  const [similarProperties, setSimilarProperties] = useState<any[]>([])
  const [isLoadingNeighbors, setIsLoadingNeighbors] = useState(false)
  const [selectedFeatures, setSelectedFeatures] = useState({ signinSheet: true, similarProperties: false })
  const [searchPreferences, setSearchPreferences] = useState<SearchPreferences>({
    minPrice: 0,
    maxPrice: 0,
    minBeds: 0,
    minBaths: 0,
    radius: 5
  })
  const [selectedSimilarPropertyIds, setSelectedSimilarPropertyIds] = useState<(string | number)[]>([])
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
  const isPrintingRef = useRef(false)
  const [filterQuery, setFilterQuery] = useState('')

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
  
  // PDF Preview State
  const [isPDFPreviewOpen, setIsPDFPreviewOpen] = useState(false)
  const [pdfPreviewData, setPdfPreviewData] = useState<any>(null)
  const [pdfPreviewType, setPdfPreviewType] = useState<'flyer' | 'recommendations'>('flyer')
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState('')
  const [pdfPreviewAddress, setPdfPreviewAddress] = useState('')
  const [pdfPreviewAgentId, setPdfPreviewAgentId] = useState('')
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

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

  // Unified PDF Preview Trigger
  const triggerPreview = useCallback(async (mode: 'flyer' | 'recommendations', id?: string) => {
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;
    setIsGeneratingPDF(true);

    const targetId = id || generatedOpenHouseId
    if (targetId) {
       let currentSimilarProps = similarProperties;
       const targetOH = id ? openHouses.find(oh => oh.id === id) : propertyData
       
       if (mode === 'recommendations' && targetOH) {
          if (id) {
            // Dashboard: Strict Snapshot only (No Backup)
            currentSimilarProps = (targetOH as any).similarPropertiesSnapshot || [];
          } else {
            // Wizard: Filter the currently fetched similar properties by user selection
            currentSimilarProps = similarProperties.filter(p => {
               const pId = String(p.ListingKey || p.listingKey || p.id);
               return selectedSimilarPropertyIds.map(sid => String(sid)).includes(pId);
            });
          }
       }       
       // Prepare data for PDF components
       if (mode === 'flyer') {
          const flyerData = {
            address: formatStreetAndCity(
              id ? (targetOH as any).address : address, 
              id ? ((targetOH as any).city || (targetOH as any).City) : (propertyData?.city || propertyData?.City)
            ),
            price: id ? ((targetOH as any).price || (targetOH as any).ListPrice) : (propertyData?.ListPrice || 0),
            beds: id ? ((targetOH as any).bedrooms || (targetOH as any).BedroomsTotal) : (propertyData?.BedroomsTotal || 0),
            baths: id ? ((targetOH as any).bathrooms || (targetOH as any).BathroomsTotal) : (propertyData?.BathroomsTotal || 0),
            sqft: id ? ((targetOH as any).LivingArea || (targetOH as any).livingArea || (targetOH as any).living_area) : (propertyData?.LivingArea || propertyData?.livingArea || 0),
            coverImage: id ? (targetOH as any).coverImageUrl : selectedImage?.url,
            openHouseUrl: id ? (targetOH as any).formUrl : `${process.env.NEXT_PUBLIC_CLIENT_URL || window.location.origin}/open-house/${generatedOpenHouseId}`
          };
          setPdfPreviewData(flyerData);
          setPdfPreviewTitle("Sign-In Flyer");
       } else {
          setPdfPreviewData(currentSimilarProps);
          setPdfPreviewTitle("Property Recommendations");
          setPdfPreviewAddress(formatStreetAndCity(
            id ? (targetOH as any).address : address,
            id ? ((targetOH as any).city || (targetOH as any).City) : (propertyData?.city || propertyData?.City)
          ));
          setPdfPreviewAgentId(currentUser?.id || '');
       }

       setPdfPreviewType(mode);
       setIsPDFPreviewOpen(true);
       setIsGeneratingPDF(false);
       isPrintingRef.current = false;
    } else {
      isPrintingRef.current = false;
      setIsGeneratingPDF(false);
    }
  }, [generatedOpenHouseId, openHouses, propertyData, similarProperties, address, selectedImage, currentUser, selectedSimilarPropertyIds])

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
        showToast('Note saved successfully', 'success')
      } else {
        showToast('Failed to save note: ' + (response.error || 'Unknown error'), 'error')
      }
    } catch (err) {
      console.error('Error saving open house note:', err)
      showToast('An error occurred while saving the note.', 'error')
    }
  }, [selectedOpenHouseForNote, currentOpenHouseNote, showToast])

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
        showToast('🗑 Listing removed successfully. All related data is preserved.', 'success')
        await loadOpenHouseHistory() // Refresh the list
        setShowDeleteDialog(false)
        setOpenHouseToDelete(null)
      } else {
        throw new Error(response.error || 'Failed to delete open house')
      }
    } catch (error) {
      console.error('Error deleting open house:', error)
      showToast('Failed to remove listing. Please try again.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false)
    setOpenHouseToDelete(null)
  }

  // load data
  useEffect(() => {
    if (!isAuthenticating && isAuthenticated && currentUser) {
      loadOpenHouseHistory()
    }
  }, [isAuthenticating, isAuthenticated, currentUser])


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
      const response = await apiRequest('/api/properties/lookup', {
        method: 'POST',
        body: JSON.stringify({ address: address })
      })
      
      if (response.status === 200 && response.data) {
        setPropertyData(response.data)
        const hasImages = (response.data.photos && response.data.photos.length > 0) || response.data.ListPictureURL
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

  const fetchSimilarProperties = async (data: any, autoSelect = false, preferences?: SearchPreferences) => {
    setIsLoadingNeighbors(true)
    try {
      const payload: any = {
        listingKey: data.ListingKey || data.listing_key,
        city: data.City || data.city,
        state: data.StateOrProvince || data.state,
        zipcode: data.PostalCode || data.zipcode,
        price: data.ListPrice || data.price,
        bedrooms: data.BedroomsTotal || data.bedrooms
      }

      if (preferences) {
        payload.minPrice = preferences.minPrice
        payload.maxPrice = preferences.maxPrice
        payload.minBeds = preferences.minBeds
        payload.minBaths = preferences.minBaths
        payload.radius = preferences.radius
      }

      if (coordinates) {
        payload.lat = coordinates.lat
        payload.lng = coordinates.lng
      }

      const response = await apiRequest('/api/properties/similar', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (response.status === 200 && response.data?.properties) {
        setSimilarProperties(response.data.properties)
        
        // If we are auto-selecting (viewing an old portfolio item), 
        // select the first 12 properties automatically to fill two full PDF pages.
        if (autoSelect) {
          const topIds = response.data.properties.slice(0, 12).map((p: any) => p.listingKey || p.id)
          setSelectedSimilarPropertyIds(topIds)
        }
        return response.data.properties
      }
    } catch (err) {
      console.error('Failed to fetch similar properties:', err)
    } finally {
      setIsLoadingNeighbors(false)
    }
    return []
  }

  // Step 2: Feature Selection -> Next Step
  const handleFeatureSelectionComplete = (features: { signinSheet: boolean; similarProperties: boolean }) => {
    setSelectedFeatures(features)
    if (features.similarProperties) {
      // Initialize preferences from property data
      const price = propertyData?.ListPrice || 0
      const beds = propertyData?.BedroomsTotal || 0
      const baths = propertyData?.BathroomsTotal || 0
      
      setSearchPreferences({
        minPrice: Math.floor(price * 0.8),
        maxPrice: Math.floor(price * 1.2),
        minBeds: Math.max(0, beds - 1),
        minBaths: Math.max(0, Math.floor(baths) - 1),
        radius: 5
      })
      setCurrentStep('PREFERENCES')
    } else {
      setCurrentStep('COVER_IMAGE')
    }
  }

  // Step 3: Similar Properties -> Next Step
  const handleSimilarPropertiesComplete = (selectedIds: (string | number)[]) => {
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

      // Get the full data objects for the selected similar properties
      const selectedSnapshot = similarProperties.filter(p => {
        const pId = String(p.ListingKey || p.listingKey || p.id);
        return selectedSimilarPropertyIds.map(sid => String(sid)).includes(pId);
      })

      const response = await apiRequest('/api/open-houses', {
        method: 'POST',
        body: JSON.stringify({
          address: address,
          property_data: propertyData,
          coverImageUrl: selectedImage.url,
          openHouseEventId: generatedOpenHouseId,
          similarPropertiesSnapshot: selectedSnapshot
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
        
        showToast('🎉 Open House created successfully!', 'success')
      } else {
        throw new Error(response.error || 'Failed to save open house')
      }
      
    } catch (error) {
      console.error('Error saving open house:', error)
      showToast('Failed to save open house. Please try again.', 'error')
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
  const propsToMap = selectedSimilarPropertyIds.length > 0 
    ? similarProperties.filter(p => {
        const pId = String(p.ListingKey || p.listingKey || p.id);
        return selectedSimilarPropertyIds.map(sid => String(sid)).includes(pId);
      })
    : (generatedOpenHouseId ? [] : similarProperties);

  const selectedSimilarProperties = propsToMap.map(p => ({
      id: p.ListingKey || p.listingKey || p.id,
      ListingKey: String(p.ListingKey || p.listingKey || p.id),
      ListPictureURL: p.ListPictureURL || p.imageUrl || p.imgSrc || p.image || "/placeholder.svg",
      FullStreetAddress: p.FullStreetAddress || p.address,
      City: p.City || p.city,
      StateOrProvince: p.StateOrProvince || p.state || "PA",
      MlsStatus: p.MlsStatus || p.status || "ACTIVE",
      ListPrice: p.ListPrice || p.price,
      BedroomsTotal: p.BedroomsTotal ?? p.bedrooms ?? p.beds ?? 0,
      BathroomsTotal: p.BathroomsTotal ?? p.bathrooms ?? p.baths ?? 0,
      LivingArea: p.LivingArea || p.sqft || 0,
      LotSizeAcres: p.LotSizeSquareFeet ? Number((p.LotSizeSquareFeet / 43560).toFixed(2)) : (p.LotSizeAcres || p.acres || 0),
      YearBuilt: p.YearBuilt || p.yearBuilt || p.year_built,
      DaysOnMarket: p.DaysOnMarket || p.daysOnMarket || p.dom || 0
    }))

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B] flex flex-col transition-colors duration-300 relative overflow-x-hidden">
      
      {/* PDF Generation Overlay */}
      {isGeneratingPDF && (
        <div className="fixed inset-0 z-[1000] bg-[#faf9f7]/80 dark:bg-[#0B0B0B]/80 backdrop-blur-md flex flex-col items-center justify-center p-6 print:hidden animate-fadeIn">
          <div className="w-16 h-16 relative mb-8">
            <div className="absolute inset-0 border-4 border-[#8b7355]/20 dark:border-[#C9A24D]/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-[#8b7355] dark:border-t-[#C9A24D] rounded-full animate-spin"></div>
          </div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-3">Crafting Your PDF</h2>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-xs font-medium uppercase text-[10px] tracking-[0.2em]">
            Preparing high-resolution assets...
          </p>
        </div>
      )}

      {/* 1. Main Dashboard */}
      <div className="flex-1 flex flex-col w-full max-w-full overflow-x-hidden">
        <div className="flex-1 p-4 sm:p-6 pb-20 w-full">
          <div className="max-w-7xl mx-auto w-full">

            {currentStep === 'ADDRESS' ? (
              <div className="space-y-8 sm:space-y-12 w-full">
                {/* 1. Generator Hero Section */}
                <div className="bg-white dark:bg-[#151517] rounded-2xl sm:rounded-3xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-5 sm:p-12 text-center relative overflow-hidden transition-colors w-full">
                  {/* Decorative Background Elements */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A24D]/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#111827]/5 dark:bg-white/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none"></div>

                  <div className="relative z-10 max-w-3xl mx-auto w-full">
                    <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-[#8b7355] to-gray-900 dark:from-white dark:via-[#C9A24D] dark:to-gray-200 tracking-tight mb-4 sm:mb-6">
                      Create Your Open House Kit
                    </h1>
                    <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 mb-8 sm:mb-10 font-light">
                      Enter a property address to instantly generate a QR code, professional PDF flyer, and sign-in form.
                    </p>

                    <form onSubmit={generateQRCode} className="relative max-w-2xl mx-auto w-full">
                      <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full">
                        <div className="relative flex-1 group w-full">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 group-focus-within:text-[#8b7355] dark:group-focus-within:text-[#C9A24D] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            onCoordinatesChange={(lat, lng) => setCoordinates({ lat, lng })}
                            placeholder="Enter property address..."
                            className="block w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-4 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-transparent focus:border-[#C9A24D] rounded-xl text-base text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 shadow-[0_2px_10px_rgba(0,0,0,0.05)] focus:shadow-[0_8px_30px_rgba(201,162,77,0.15)] focus:outline-none transition-all duration-300"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isGenerating || isLoadingProperty}
                          className="px-6 py-2.5 sm:py-0 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center whitespace-nowrap"
                        >
                          {isGenerating || isLoadingProperty ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <span>Generate Kit</span>
                          )}
                        </button>
                      </div>
                      {error && (
                        <div className="mt-3 text-center animate-fadeIn">
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
                  setCoordinates(null)
                }}
              />
            ) : currentStep === 'PREFERENCES' ? (
              <SimilarPropertiesPreferencesView
                preferences={searchPreferences}
                address={address}
                onFindProperties={async (prefs) => {
                  setSearchPreferences(prefs)
                  const properties = await fetchSimilarProperties(propertyData, false, prefs)
                  if (properties && properties.length > 0) {
                    setCurrentStep('SIMILAR_PROPS')
                  } else {
                    showToast('No properties found with these filters. Please try broadening your search.', 'error')
                  }
                }}
                onBack={() => setCurrentStep('FEATURES')}
              />
            ) : currentStep === 'SIMILAR_PROPS' ? (
              <SimilarPropertiesSelectionView
                properties={similarProperties}
                isLoading={isLoadingNeighbors}
                initialSelectedIds={selectedSimilarPropertyIds}
                onNext={handleSimilarPropertiesComplete}
                onBack={() => setCurrentStep('PREFERENCES')}
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

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        isOpen={isPDFPreviewOpen}
        onClose={() => setIsPDFPreviewOpen(false)}
        type={pdfPreviewType}
        data={pdfPreviewData}
        title={pdfPreviewTitle}
        address={pdfPreviewAddress}
        agentId={pdfPreviewAgentId}
      />

      {/* Save Dialog (Review Step) */}
      {currentStep === 'REVIEW' && (
        <div>
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
        </div>
      )}

      {/* View PDFs Modal */}
      {isViewPDFsModalOpen && openHouseForPDFs && (
        <div>
          <ViewPDFsModal
            openHouse={openHouseForPDFs}
            onClose={handleCloseViewPDFs}
            onViewFlyer={() => triggerPreview('flyer', openHouseForPDFs.id)}
            onViewRecommendations={() => triggerPreview('recommendations', openHouseForPDFs.id)}
          />
        </div>
      )}

      {/* Open House Note Modal */}
      {isOpenHouseNoteModalOpen && selectedOpenHouseForNote && (
        <div className={`fixed inset-0 bg-[#111827]/60 z-50 flex items-center justify-center p-4 transition-all duration-300 print:hidden`}>
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
    </div>
  )
}

// Similar Properties Selection Component
const SimilarPropertiesSelectionView = memo(function SimilarPropertiesSelectionView({ 
  properties, 
  isLoading, 
  initialSelectedIds = [], 
  onNext, 
  onBack 
}: { 
  properties: any[], 
  isLoading: boolean, 
  initialSelectedIds?: (string | number)[], 
  onNext: (selectedIds: (string | number)[]) => void, 
  onBack: () => void 
}) {
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>(initialSelectedIds)

  const toggleProperty = (id: string | number) => {
    const stringId = String(id);
    setSelectedIds(prev => {
      const stringPrev = prev.map(p => String(p));
      return stringPrev.includes(stringId) 
        ? stringPrev.filter(pid => pid !== stringId) 
        : [...stringPrev, stringId];
    });
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#151517] rounded-2xl sm:rounded-3xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-6 sm:p-12 text-center transition-colors max-w-7xl mx-auto animate-fadeIn">
        <div className="py-12 sm:py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] dark:border-[#C9A24D] mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Finding similar properties...</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Searching Bright MLS for active neighbor listings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-[#151517] rounded-2xl sm:rounded-3xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-4 sm:p-12 transition-colors max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
         <div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-1 sm:mb-2 tracking-tight">Select similar properties</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Choose listings for your supplemental flyer.</p>
         </div>
         <div className="flex items-baseline sm:text-right">
           <span className="text-3xl sm:text-4xl font-black text-[#8b7355] dark:text-[#C9A24D]">{selectedIds.length}</span>
           <span className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">Selected</span>
         </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8 sm:mb-12 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto pr-1">
                {properties.map((property) => {
                  const propertyId = String(property.ListingKey || property.listingKey || property.id);
                  const isSelected = selectedIds.map(sid => String(sid)).includes(propertyId);
                  
                  return (
                    <div 
                      key={propertyId} 
                      onClick={() => toggleProperty(propertyId)}
                      className="relative cursor-pointer"
                    >
                      <PropertyRecommendationCard 
                        image={property.ListPictureURL || property.imageUrl || property.imgSrc || property.image || "/placeholder.svg"}
                        streetAddress={property.FullStreetAddress || property.address}
                        town={property.City || property.city}
                        price={property.ListPrice || property.price}
                        beds={property.BedroomsTotal ?? property.bedrooms ?? property.beds ?? 0}
                        baths={property.BathroomsTotal ?? property.bathrooms ?? property.baths ?? 0}
                        sqft={property.LivingArea || property.sqft || 0}
                        acres={property.LotSizeSquareFeet ? Number((property.LotSizeSquareFeet / 43560).toFixed(2)) : (property.acres || 0)}
                        yearBuilt={property.YearBuilt || property.yearBuilt || property.year_built}
                        dom={property.DaysOnMarket || property.daysOnMarket || property.dom}
                        hideQr={true}
                        isCompact={true}
                        selected={isSelected}
                      />
                    </div>
                  );
                })}
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3 border-t border-gray-100 dark:border-gray-800 pt-6 sm:pt-8">
        <button
          onClick={onBack}
          className="w-full sm:w-auto px-6 py-3.5 bg-white dark:bg-transparent text-gray-600 dark:text-gray-400 font-bold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 text-sm"
        >
          Back
        </button>
        <button
          onClick={() => onNext(selectedIds)}
          disabled={selectedIds.length === 0}
          className="w-full sm:w-auto px-8 py-3.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] font-bold rounded-xl shadow-lg hover:shadow-xl hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 text-sm"
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
    <div className="bg-white dark:bg-[#151517] rounded-2xl sm:rounded-3xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-5 sm:p-12 transition-colors max-w-4xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="text-center mb-8 sm:mb-12">
        <h2 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white mb-3 sm:mb-4 tracking-tight">What materials do you need?</h2>
        <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 font-light">For <span className="font-medium text-gray-900 dark:text-white truncate block sm:inline">{address}</span></p>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12">
        {/* Option 1: Sign-in Sheet (MANDATORY) */}
        <div
          className="rounded-2xl p-6 sm:p-8 border-2 border-[#8b7355] bg-[#faf9f7] dark:bg-[#1c1c1e] shadow-md flex flex-col items-center text-center gap-4 sm:gap-6 relative overflow-hidden"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center bg-[#8b7355] text-white shadow-lg shadow-[#8b7355]/30">
            <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center justify-center gap-2 mb-1 sm:mb-2">
              <h3 className="text-lg sm:text-xl font-bold text-[#8b7355] dark:text-[#C9A24D]">Sign-in Sheet</h3>
              <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded">Required</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">Professional flyer with unique QR code for visitor registration.</p>
          </div>
          
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-[#8b7355] bg-[#8b7355] text-white flex items-center justify-center">
            <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
        </div>

        {/* Option 2: Similar Properties (OPTIONAL) */}
        <div
          onClick={() => toggleFeature('similarProperties')}
          className={`cursor-pointer rounded-2xl p-6 sm:p-8 border-2 transition-all duration-300 flex flex-col items-center text-center gap-4 sm:gap-6 group relative overflow-hidden ${
            features.similarProperties 
              ? 'border-[#8b7355] bg-[#faf9f7] dark:bg-[#1c1c1e] shadow-lg scale-[1.02]' 
              : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 bg-white dark:bg-[#151517]'
          }`}
        >
          <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-colors duration-300 ${
            features.similarProperties 
              ? 'bg-[#8b7355] text-white shadow-lg shadow-[#8b7355]/30' 
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-700'
          }`}>
            <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h3 className={`text-lg sm:text-xl font-bold mb-1 sm:mb-2 ${features.similarProperties ? 'text-[#8b7355] dark:text-[#C9A24D]' : 'text-gray-900 dark:text-white'}`}>Similar Listings</h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">Supplemental flyer showcasing active similar listings nearby.</p>
          </div>

          <div className={`absolute top-3 right-3 sm:top-4 sm:right-4 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
            features.similarProperties 
              ? 'border-[#8b7355] bg-[#8b7355] text-white' 
              : 'border-gray-200 dark:border-gray-700'
          }`}>
            {features.similarProperties && <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3">
        <button
          onClick={onBack}
          className="w-full sm:w-auto px-6 py-3.5 bg-white dark:bg-transparent text-gray-600 dark:text-gray-400 font-bold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 text-sm"
        >
          Back
        </button>
        <button
          onClick={() => onNext(features)}
          className="w-full sm:w-auto px-8 py-3.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] font-bold rounded-xl shadow-lg hover:shadow-xl hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] hover:text-white transform hover:-translate-y-0.5 transition-all duration-300 active:scale-95 text-sm"
        >
          Continue
        </button>
      </div>
    </div>
  )
})

// Image Selection Component
const ImageSelectionView = memo(function ImageSelectionView({ propertyData, address, onImageSelect, onBack }: any) {
  const availableImages = propertyData?.photos && propertyData.photos.length > 0 
    ? propertyData.photos 
    : [propertyData?.ListPictureURL].filter(Boolean)
  
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
        {availableImages.map((imageUrl: string, index: number) => {
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
          <p className="text-[#6B7280] dark:text-gray-400 text-sm mt-2 font-medium">{formatAddress(address)}</p>
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
                Includes Sign-in Flyer {hasRecommendations && '& Active COMPS'}.
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
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active COMPS</span>
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
          src={openHouse.coverImageUrl || (openHouse as any).cover_image_url || "/placeholder.svg"}
          alt={`Property at ${openHouse.address}`}
          fill
          sizes="(max-width: 640px) 100vw, 300px"
          className="object-cover"
        />
        {/* Subtle Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 sm:bg-gradient-to-tr sm:from-black/50 sm:via-transparent sm:to-transparent"></div>
      </div>

      {/* Right Side: Content */}
      <div className="flex-1 flex flex-col p-3.5 min-w-0 gap-2">
        
        {/* Top Row: Title + Overflow */}
        <div className="flex items-start justify-between gap-3">
          <h3 
            className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 leading-tight truncate"
            title={openHouse.address}
          >
            {formatAddress(openHouse.address)}
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
            <Bed className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            <span className="font-semibold">{openHouse.BedroomsTotal || (openHouse as any).bedrooms || '-'}</span>
            <span className="text-gray-400 dark:text-gray-600 text-[10px]">Beds</span>
          </div>
          {/* Baths */}
          <div className="flex items-center gap-1">
            <Bath className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            <span className="font-semibold">{openHouse.BathroomsTotal || (openHouse as any).bathrooms || '-'}</span>
            <span className="text-gray-400 dark:text-gray-600 text-[10px]">Baths</span>
          </div>
           {/* SqFt */}
           <div className="flex items-center gap-1">
            <BoxSelect className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            <span className="font-semibold">{(openHouse.LivingArea || (openHouse as any).living_area || (openHouse as any).livingArea)?.toLocaleString() || '-'}</span>
            <span className="text-gray-400 dark:text-gray-600 text-[10px]">SqFt</span>
          </div>
          {/* Price */}
          {(openHouse.ListPrice || (openHouse as any).price) && (
            <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-3">
              <DollarSign className="w-3.5 h-3.5 text-[#8b7355] dark:text-[#C9A24D]" />
              <span className="font-bold text-[#8b7355] dark:text-[#C9A24D]">
                {(openHouse.ListPrice || (openHouse as any).price).toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0
                })}
              </span>
            </div>
          )}
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
              href={openHouse.formUrl || (openHouse as any).form_url}
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

// Similar Properties Preferences Component
const SimilarPropertiesPreferencesView = memo(function SimilarPropertiesPreferencesView({ 
  preferences: initialPreferences, 
  address,
  onFindProperties, 
  onBack 
}: { 
  preferences: SearchPreferences, 
  address: string,
  onFindProperties: (prefs: SearchPreferences) => void, 
  onBack: () => void 
}) {
  const [prefs, setPrefs] = useState<SearchPreferences>(initialPreferences)

  const formatPriceForDisplay = (val: number) => {
    return val === 0 ? "" : val.toLocaleString()
  }

  const parsePriceFromDisplay = (val: string) => {
    return Number(val.replace(/\D/g, ""))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    
    if (name === "minPrice" || name === "maxPrice") {
      setPrefs(prev => ({
        ...prev,
        [name]: parsePriceFromDisplay(value)
      }))
    } else {
      setPrefs(prev => ({
        ...prev,
        [name]: Number(value)
      }))
    }
  }

  return (
    <div className="bg-white dark:bg-[#151517] rounded-2xl sm:rounded-3xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-5 sm:p-12 transition-colors max-w-4xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="text-center mb-8 sm:mb-12">
        <h2 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white mb-3 sm:mb-4 tracking-tight">Refine Your Search</h2>
        <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 font-light truncate px-4">Find properties similar to <span className="font-medium text-gray-900 dark:text-white">{address}</span></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 sm:mb-12">
        {/* Price Section */}
        <div className="space-y-4 bg-[#faf9f7] dark:bg-[#1c1c1e] p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-[#8b7355] dark:text-[#C9A24D] uppercase tracking-widest flex items-center">
            <DollarSign className="w-4 h-4 mr-2" /> Price Range
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Min Price</label>
              <input
                type="text"
                name="minPrice"
                value={formatPriceForDisplay(prefs.minPrice)}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C9A24D] transition-all"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Max Price</label>
              <input
                type="text"
                name="maxPrice"
                value={formatPriceForDisplay(prefs.maxPrice)}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C9A24D] transition-all"
                placeholder="No Max"
              />
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="space-y-4 bg-[#faf9f7] dark:bg-[#1c1c1e] p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-[#8b7355] dark:text-[#C9A24D] uppercase tracking-widest flex items-center">
            <BoxSelect className="w-4 h-4 mr-2" /> Property Details
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Min Beds</label>
              <select
                name="minBeds"
                value={prefs.minBeds}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C9A24D] transition-all appearance-none"
              >
                {[0, 1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}+ Beds</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Min Baths</label>
              <select
                name="minBaths"
                value={prefs.minBaths}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C9A24D] transition-all appearance-none"
              >
                {[0, 1, 1.5, 2, 2.5, 3, 3.5, 4].map(n => <option key={n} value={n}>{n}+ Baths</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Radius Section (Full Width) */}
        <div className="md:col-span-2 space-y-4 bg-[#faf9f7] dark:bg-[#1c1c1e] p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-[#8b7355] dark:text-[#C9A24D] uppercase tracking-widest flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Search Radius
          </h3>
          <div className="flex items-center gap-6">
            <input
              type="range"
              name="radius"
              min="1"
              max="20"
              step="1"
              value={prefs.radius}
              onChange={handleChange}
              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#C9A24D]"
            />
            <div className="bg-white dark:bg-[#0B0B0B] px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 min-w-[100px] text-center">
              <span className="text-lg font-black text-gray-900 dark:text-white">{prefs.radius}</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase ml-1">Miles</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 font-medium">Search area centered on the property coordinates captured from address entry.</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3">
        <button
          onClick={onBack}
          className="w-full sm:w-auto px-6 py-3.5 bg-white dark:bg-transparent text-gray-600 dark:text-gray-400 font-bold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 text-sm"
        >
          Back
        </button>
        <button
          onClick={() => onFindProperties(prefs)}
          className="w-full sm:w-auto px-10 py-3.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] font-bold rounded-xl shadow-lg hover:shadow-xl hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] hover:text-white transform hover:-translate-y-0.5 transition-all duration-300 active:scale-95 text-sm uppercase tracking-widest"
        >
          Find Properties
        </button>
      </div>
    </div>
  )
})
