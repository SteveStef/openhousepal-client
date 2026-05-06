'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Footer from '@/components/Footer'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { ViewPDFsModal } from '@/components/ViewPDFsModal'
import { EditSimilarPropertiesModal } from '@/components/EditSimilarPropertiesModal'
import PDFPreviewModal from '@/components/PDFPreviewModal'
import { OpenHouse } from '@/types'

// Components
import { OpenHouseHistory } from './components/OpenHouseHistory'
import { CreateOpenHouseWizard } from './components/CreateOpenHouseWizard'
import { DeleteConfirmationDialog } from './components/DeleteConfirmationDialog'
import { OpenHouseNoteModal } from './components/OpenHouseNoteModal'

// --- HELPERS ---
const formatAddress = (address: string) => {
  if (!address) return "";
  const parts = address.split(',');
  
  if (parts.length > 2) {
    const street = parts[0].trim();
    const city = parts[1].trim();
    const stateZip = parts[2].trim();
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
  if (!address) return "";
  const parts = address.split(',');
  const street = parts[0].trim();
  const targetCity = city || (parts.length >= 2 ? parts[1].trim() : "");
  
  if (targetCity) {
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
  
  return street.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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
  
  // Dashboard State
  const [openHouses, setOpenHouses] = useState<OpenHouse[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const isPrintingRef = useRef(false)
  
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
  
  // Edit Similar Properties Modal State
  const [isEditSimilarModalOpen, setIsEditSimilarModalOpen] = useState(false)
  const [openHouseToEditSimilar, setOpenHouseToEditSimilar] = useState<OpenHouse | null>(null)
  
  // PDF Preview State
  const [isPDFPreviewOpen, setIsPDFPreviewOpen] = useState(false)
  const [pdfPreviewData, setPdfPreviewData] = useState<any>(null)
  const [pdfPreviewType, setPdfPreviewType] = useState<'flyer' | 'recommendations'>('flyer')
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState('')
  const [pdfPreviewAddress, setPdfPreviewAddress] = useState('')
  const [pdfPreviewAgentId, setPdfPreviewAgentId] = useState('')
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  const handleViewVisitors = useCallback((openHouse: any) => {
    router.push(`/open-houses/visitors/${openHouse.id}`);
  }, [router])

  const handleOpenViewPDFs = useCallback((openHouse: OpenHouse) => {
    setOpenHouseForPDFs(openHouse)
    setIsViewPDFsModalOpen(true)
  }, [])

  const handleCloseViewPDFs = useCallback(() => {
    setIsViewPDFsModalOpen(false)
    setOpenHouseForPDFs(null)
  }, [])

  const handleOpenEditSimilar = useCallback((openHouse: OpenHouse) => {
    setOpenHouseToEditSimilar(openHouse)
    setIsEditSimilarModalOpen(true)
    setIsViewPDFsModalOpen(false)
  }, [])

  const triggerPreview = useCallback(async (mode: 'flyer' | 'recommendations', id?: string, customData?: any) => {
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;
    setIsGeneratingPDF(true);

    // If customData is provided (from the Wizard), use it directly
    if (customData) {
      setPdfPreviewData(customData);
      setPdfPreviewType(mode);
      setPdfPreviewTitle(mode === 'flyer' ? "Sign-In Flyer" : "Property Recommendations");
      
      if (mode === 'recommendations') {
        setPdfPreviewAddress(customData.address || '');
        setPdfPreviewAgentId(currentUser?.id || '');
      }
      
      setIsPDFPreviewOpen(true);
      setIsGeneratingPDF(false);
      isPrintingRef.current = false;
      return;
    }

    const targetOH = id ? openHouses.find(oh => oh.id === id) : null;
    
    if (targetOH) {
       if (mode === 'flyer') {
          const flyerData = {
            address: formatStreetAndCity(targetOH.address, targetOH.city),
            price: targetOH.ListPrice || targetOH.price || 0,
            beds: targetOH.BedroomsTotal || targetOH.bedrooms || 0,
            baths: targetOH.BathroomsTotal || targetOH.bathrooms || 0,
            sqft: targetOH.LivingArea || targetOH.livingArea || 0,
            coverImage: targetOH.coverImageUrl,
            openHouseUrl: targetOH.formUrl
          };
          setPdfPreviewData(flyerData);
          setPdfPreviewTitle("Sign-In Flyer");
       } else {
          setPdfPreviewData((targetOH as any).similarPropertiesSnapshot || []);
          setPdfPreviewTitle("Property Recommendations");
          setPdfPreviewAddress(formatStreetAndCity(targetOH.address, targetOH.city));
          setPdfPreviewAgentId(currentUser?.id || '');
       }

       setPdfPreviewType(mode);
       setIsPDFPreviewOpen(true);
       setIsGeneratingPDF(false);
       isPrintingRef.current = false;
    } else {
      // If no ID is passed, this is coming from the Wizard (handled internally by Wizard now, 
      // but keeping compatibility for now if needed, though Wizard has its own triggerPreview)
      setIsGeneratingPDF(false);
      isPrintingRef.current = false;
    }
  }, [openHouses, currentUser])

  const handleOpenOpenHouseNoteModal = useCallback((openHouse: OpenHouse) => {
    setSelectedOpenHouseForNote(openHouse)
    setCurrentOpenHouseNote((openHouse as any).notes || '') 
    setIsOpenHouseNoteModalOpen(true)
  }, [])

  const handleSaveOpenHouseNote = useCallback(async () => {
    if (!selectedOpenHouseForNote) return
    const { success, error } = await api.openHouses.updateNote(selectedOpenHouseForNote.id, currentOpenHouseNote)
    if (success) {
      setOpenHouses(prev => prev.map(oh => oh.id === selectedOpenHouseForNote.id ? { ...oh, notes: currentOpenHouseNote } : oh))
      setIsOpenHouseNoteModalOpen(false)
      setSelectedOpenHouseForNote(null)
      setCurrentOpenHouseNote('')
      showToast('Note saved successfully', 'success')
    } else {
      showToast('Failed to save note: ' + (error || 'Unknown error'), 'error')
    }
  }, [selectedOpenHouseForNote, currentOpenHouseNote, showToast])

  const handleDeleteClick = useCallback((openHouse: OpenHouse) => {
    setOpenHouseToDelete(openHouse)
    setShowDeleteDialog(true)
  }, [])

  const handleDeleteConfirm = async () => {
    if (!openHouseToDelete) return
    setIsDeleting(true)
    const { success, error } = await api.openHouses.delete(openHouseToDelete.id)
    if (success) {
      showToast('🗑 Listing removed successfully. All related data is preserved.', 'success')
      await loadOpenHouseHistory()
      setShowDeleteDialog(false)
      setOpenHouseToDelete(null)
    } else {
      showToast(error || 'Failed to remove listing. Please try again.', 'error')
    }
    setIsDeleting(false)
  }

  const loadOpenHouseHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    const { success, data } = await api.openHouses.getAll()
    if (success && data) setOpenHouses(data)
    setIsLoadingHistory(false)
  }, [])

  useEffect(() => {
    if (!isAuthenticating && isAuthenticated && currentUser) {
      loadOpenHouseHistory()
    }
  }, [isAuthenticating, isAuthenticated, currentUser, loadOpenHouseHistory])

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
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B] flex flex-col transition-colors duration-300 relative overflow-x-hidden">
      
      {isGeneratingPDF && (
        <div className="fixed inset-0 z-[1000] bg-[#faf9f7]/80 dark:bg-[#0B0B0B]/80 backdrop-blur-md flex flex-col items-center justify-center p-6 print:hidden animate-fadeIn">
          <div className="w-16 h-16 relative mb-8">
            <div className="absolute inset-0 border-4 border-[#8b7355]/20 dark:border-[#C9A24D]/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-[#8b7355] dark:border-t-[#C9A24D] rounded-full animate-spin"></div>
          </div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-3">Crafting Your PDF</h2>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-xs font-medium uppercase text-[10px] tracking-[0.2em]">Preparing assets...</p>
        </div>
      )}

      <div className="flex-1 flex flex-col w-full max-w-full overflow-x-hidden">
        <div className="flex-1 p-4 sm:p-6 pb-20 w-full">
          <div className="max-w-7xl mx-auto w-full">
            
            {/* Create Wizard */}
            <CreateOpenHouseWizard 
              currentUser={currentUser}
              onSuccess={loadOpenHouseHistory}
              showToast={showToast}
              triggerPreview={triggerPreview}
              formatAddress={formatAddress}
            />

            {/* Portfolio History */}
            <OpenHouseHistory 
              openHouses={openHouses}
              isLoadingHistory={isLoadingHistory}
              onViewVisitors={handleViewVisitors}
              onOpenViewPDFs={handleOpenViewPDFs}
              onDeleteClick={handleDeleteClick}
              onOpenNoteModal={handleOpenOpenHouseNoteModal}
              formatAddress={formatAddress}
            />
            
          </div>
        </div>
        <Footer />
      </div>

      <PDFPreviewModal
        isOpen={isPDFPreviewOpen}
        onClose={() => setIsPDFPreviewOpen(false)}
        type={pdfPreviewType}
        data={pdfPreviewData}
        title={pdfPreviewTitle}
        address={pdfPreviewAddress}
        agentId={pdfPreviewAgentId}
      />

      {isViewPDFsModalOpen && openHouseForPDFs && (
        <ViewPDFsModal
          openHouse={openHouseForPDFs}
          onClose={handleCloseViewPDFs}
          onViewFlyer={() => triggerPreview('flyer', openHouseForPDFs.id)}
          onViewRecommendations={() => triggerPreview('recommendations', openHouseForPDFs.id)}
          onEditRecommendations={() => handleOpenEditSimilar(openHouseForPDFs)}
        />
      )}

      {isEditSimilarModalOpen && openHouseToEditSimilar && (
        <EditSimilarPropertiesModal
          isOpen={isEditSimilarModalOpen}
          onClose={() => setIsEditSimilarModalOpen(false)}
          openHouse={openHouseToEditSimilar}
          onSuccess={loadOpenHouseHistory}
        />
      )}

      <OpenHouseNoteModal 
        isOpen={isOpenHouseNoteModalOpen}
        onClose={() => setIsOpenHouseNoteModalOpen(false)}
        openHouse={selectedOpenHouseForNote}
        notes={currentOpenHouseNote}
        onNotesChange={setCurrentOpenHouseNote}
        onSave={handleSaveOpenHouseNote}
      />

      {showDeleteDialog && openHouseToDelete && (
        <DeleteConfirmationDialog
          openHouse={openHouseToDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteDialog(false)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  )
}
