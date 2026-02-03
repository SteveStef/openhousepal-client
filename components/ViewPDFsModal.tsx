'use client'

import { memo } from 'react'
import Image from 'next/image'

interface OpenHouse {
  id: string;
  address: string;
  cover_image_url: string;
}

interface ViewPDFsModalProps {
  openHouse: OpenHouse;
  onClose: () => void;
  onViewFlyer: () => void;
  onViewRecommendations: () => void;
}

export const ViewPDFsModal = memo(function ViewPDFsModal({ 
  openHouse, 
  onClose, 
  onViewFlyer, 
  onViewRecommendations 
}: ViewPDFsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden animate-fadeIn">
      <div className="bg-[#FAFAF7] dark:bg-[#151517] rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden border border-white/50 dark:border-gray-800 transform transition-all animate-slide-in-up">
        {/* Header */}
        <div className="p-6 border-b border-gray-200/50 dark:border-gray-800 bg-white/50 dark:bg-[#0B0B0B]/50 flex justify-between items-start">
          <div>
            <h3 className="text-xl font-black text-[#0B0B0B] dark:text-white tracking-tight">Listing Documents</h3>
            <p className="text-[#6B7280] dark:text-gray-400 text-sm mt-1 font-medium">{openHouse.address}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Option 1: Sign-in Flyer */}
          <button 
            onClick={onViewFlyer}
            className="w-full group flex items-center p-4 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-800 rounded-xl hover:border-[#8b7355] dark:hover:border-[#C9A24D] hover:shadow-md transition-all duration-200 text-left"
          >
            <div className="w-12 h-12 bg-[#8b7355]/10 dark:bg-[#C9A24D]/10 rounded-lg flex items-center justify-center mr-4 group-hover:bg-[#8b7355] dark:group-hover:bg-[#C9A24D] transition-colors duration-200">
              <svg className="w-6 h-6 text-[#8b7355] dark:text-[#C9A24D] group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h4 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-[#8b7355] dark:group-hover:text-[#C9A24D] transition-colors">Sign-in Flyer</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Main event display with QR code</p>
            </div>
            <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0">
              <svg className="w-5 h-5 text-[#8b7355] dark:text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Option 2: Property Recommendations */}
          <button 
            onClick={onViewRecommendations}
            className="w-full group flex items-center p-4 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-800 rounded-xl hover:border-[#8b7355] dark:hover:border-[#C9A24D] hover:shadow-md transition-all duration-200 text-left"
          >
            <div className="w-12 h-12 bg-[#8b7355]/10 dark:bg-[#C9A24D]/10 rounded-lg flex items-center justify-center mr-4 group-hover:bg-[#8b7355] dark:group-hover:bg-[#C9A24D] transition-colors duration-200">
              <svg className="w-6 h-6 text-[#8b7355] dark:text-[#C9A24D] group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h4 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-[#8b7355] dark:group-hover:text-[#C9A24D] transition-colors">Property Recommendations</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Similar listings sheet</p>
            </div>
            <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0">
              <svg className="w-5 h-5 text-[#8b7355] dark:text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
        
        <div className="p-4 bg-gray-50 dark:bg-[#0B0B0B]/50 border-t border-gray-200/50 dark:border-gray-800 text-center">
          <button onClick={onClose} className="text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-widest">
            Close
          </button>
        </div>
      </div>
    </div>
  )
})
