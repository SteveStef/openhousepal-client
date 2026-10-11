'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Loader2, Info, X } from 'lucide-react'
import { PropertyDetailResponse } from '@/types'
import api from '@/lib/api-service'
import PropertyDetailsModal from '@/components/PropertyDetailsModal'

interface PropertyQuickViewModalProps {
  // Null closes the modal. Passing a new listingKey while open swaps the property in place.
  listingKey: string | null
  agentId: string
  onClose: () => void
}

// Thin data-fetching wrapper around the same rich property view Showcases uses, so Discovery's
// "View Details" matches that look exactly - minus the visitor-only Like/Pass/Comments, which
// don't make sense for an agent previewing another agent's listing (see showVisitorActions).
export default function PropertyQuickViewModal({ listingKey, agentId, onClose }: PropertyQuickViewModalProps) {
  const [property, setProperty] = useState<PropertyDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!listingKey) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setProperty(null)
    api.properties.getPropertyForAgent(listingKey, agentId).then(({ success, data, error: apiError }) => {
      if (cancelled) return
      if (success && data) {
        setProperty(data)
      } else {
        setError(apiError || 'Property not found')
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [listingKey, agentId])

  // Lock background scroll while open. useLayoutEffect (not useEffect) so the lock is in place
  // before the browser's first paint of the fading-in backdrop - otherwise there's a frame where
  // the backdrop is already visible but the background underneath is still scrollable, which
  // reads as the background scrolling messily right as the modal opens.
  const scrollRestoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useLayoutEffect(() => {
    if (!listingKey) return
    if (scrollRestoreTimeoutRef.current) {
      clearTimeout(scrollRestoreTimeoutRef.current)
      scrollRestoreTimeoutRef.current = null
    }
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      // Delay the restore until after the closing animation finishes (350ms) - unlocking the
      // instant listingKey clears reintroduces the scrollbar (and the layout shift that comes
      // with it) while the modal is still visibly fading out, which reads as the same messy
      // "background scrolls" glitch on close.
      scrollRestoreTimeoutRef.current = setTimeout(() => {
        document.body.style.overflow = original
        scrollRestoreTimeoutRef.current = null
      }, 380)
    }
  }, [listingKey])

  if (!listingKey) return null

  return (
    <>
      {(loading || error) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B0B0B]/80 p-6">
          {loading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="animate-spin text-[#C9A24D] mb-4" size={32} />
              <p className="text-gray-300 font-bold uppercase tracking-widest text-xs">Loading property...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center max-w-sm bg-white dark:bg-[#0B0B0B] rounded-2xl p-8">
              <Info className="text-red-400 mb-4" size={40} />
              <p className="text-gray-500 dark:text-gray-400 font-medium mb-6">{error}</p>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          )}
        </div>
      )}

      <PropertyDetailsModal
        property={property}
        isOpen={!!property && !loading && !error}
        onClose={onClose}
        showVisitorActions={false}
        zIndex={100}
      />
    </>
  )
}
