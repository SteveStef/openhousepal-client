'use client'

import { memo } from 'react'
import Image from 'next/image'

interface OpenHouse {
  id: string;
  address: string;
  cover_image_url?: string;
  similarPropertiesSnapshot?: any[];
}

interface ViewPDFsModalProps {
  openHouse: OpenHouse;
  onClose: () => void;
  onViewFlyer: () => void;
  onViewRecommendations: () => void;
  onEditRecommendations?: () => void;
}

// --- HELPERS ---
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

  // Fallback for shorter addresses
  const rawAddress = parts.length > 1 
    ? `${parts[0].trim()}, ${parts[1].trim()}`
    : parts[0].trim();
  
  return rawAddress
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const ViewPDFsModal = memo(function ViewPDFsModal({ 
  openHouse, 
  onClose, 
  onViewFlyer, 
  onViewRecommendations,
  onEditRecommendations
}: ViewPDFsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 print:hidden animate-fadeIn">
      <div className="bg-[#FAFAF7] dark:bg-[#151517] rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden border border-white/50 dark:border-gray-800 transform transition-all relative">
        {/* Decorative Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#8b7355] via-[#C9A24D] to-[#8b7355]" />

        {/* Header */}
        <div className="pt-10 pb-6 px-8 text-center border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-[#0B0B0B]/30">
          <h3 className="font-serif text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Documents</h3>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="h-px w-4 bg-[#C9A24D]/40" />
            <p className="text-[#6B7280] dark:text-gray-400 text-xs font-bold uppercase tracking-[0.2em]">{formatAddress(openHouse.address)}</p>
            <span className="h-px w-4 bg-[#C9A24D]/40" />
          </div>
        </div>
        
        <div className="p-8 space-y-4">
          {/* Option 1: Sign-in Flyer */}
          <button 
            onClick={onViewFlyer}
            className="w-full group flex items-center p-5 bg-white dark:bg-[#1c1c1e] border border-gray-100 dark:border-gray-800 rounded-2xl transition-all duration-150 text-left relative active:scale-[0.98]"
          >
            <div className="w-14 h-14 bg-[#faf9f7] dark:bg-[#0B0B0B] rounded-xl flex items-center justify-center mr-5 border border-gray-100 dark:border-gray-800 transition-all duration-150 relative z-10 shadow-sm">
              <svg className="w-7 h-7 text-[#8b7355] dark:text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            
            <div className="relative z-10 flex-1">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">Sign-in Flyer</h4>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Ready for Print • Includes QR</p>
            </div>

            <div className="relative z-10 ml-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center border border-gray-100 dark:border-gray-800 group-hover:border-[#8b7355] dark:group-hover:border-[#C9A24D] transition-all duration-150">
                <svg className="w-4 h-4 text-gray-300 group-hover:text-[#8b7355] dark:group-hover:text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>

          {/* Option 2: Property Recommendations */}
          {openHouse.similarPropertiesSnapshot && openHouse.similarPropertiesSnapshot.length > 0 && (
            <div className="space-y-3">
              <button 
                onClick={onViewRecommendations}
                className="w-full group flex items-center p-5 bg-white dark:bg-[#1c1c1e] border border-gray-100 dark:border-gray-800 rounded-2xl transition-all duration-150 text-left relative active:scale-[0.98]"
              >
                <div className="w-14 h-14 bg-[#faf9f7] dark:bg-[#0B0B0B] rounded-xl flex items-center justify-center mr-5 border border-gray-100 dark:border-gray-800 transition-all duration-150 relative z-10 shadow-sm">
                  <svg className="w-7 h-7 text-[#8b7355] dark:text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>

                <div className="relative z-10 flex-1">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">Active COMPS</h4>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Similar Active Listings</p>
                </div>

                <div className="relative z-10 ml-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center border border-gray-100 dark:border-gray-800 group-hover:border-[#8b7355] dark:group-hover:border-[#C9A24D] transition-all duration-150">
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-[#8b7355] dark:group-hover:text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>

              {onEditRecommendations && (
                <button 
                  onClick={onEditRecommendations}
                  className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-[#8b7355] dark:hover:text-[#C9A24D] transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Update Similar Listings
                </button>
              )}
            </div>
          )}
        </div>
        
        <div className="px-8 pb-10 flex flex-col items-center">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] hover:text-white transition-all duration-300 shadow-lg"
          >
            Close
          </button>
          <p className="mt-6 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Select a document to open print preview</p>
        </div>
      </div>
    </div>
  )
})
