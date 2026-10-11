'use client'

import { useState } from 'react'

interface DescriptionSectionProps {
  description: string
  details?: any
}

export default function DescriptionSection({ description, details }: DescriptionSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const maxLength = 700 // Reduced limit
  const shouldTruncate = description.length > maxLength
  const displayText = isExpanded || !shouldTruncate ? description : description.slice(0, maxLength) + '...'

  const agentName = details?.ListAgentFullName || details?.listAgentFullName
  const officeName = details?.ListOfficeName || details?.listOfficeName
  const phone = details?.ListAgentPreferredPhone || details?.listAgentPreferredPhone || details?.ListOfficePhone || details?.listOfficePhone
  const email = details?.ListAgentEmail || details?.listAgentEmail
  const mlsId = details?.ListingId || details?.listingId

  return (
    <div className="py-2">
      <div className="space-y-4">
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-base font-medium">{displayText}</p>
        {shouldTruncate && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[#C9A24D] hover:text-[#B38F3D] text-sm font-bold uppercase tracking-wider transition-colors duration-200"
          >
            {isExpanded ? 'Read Less' : 'Read Full Description'}
          </button>
        )}
      </div>

      {/* Deliberately understated - a small-print disclaimer, not a contact card. This is the
          MLS-required attribution for the actual listing agent/brokerage, not an invitation to
          reach out to them directly; the site's own "contact the agent" CTAs live elsewhere and
          are the ones meant to stand out. No icons, no bordered card, no bold heading - shared by
          every view-details/view-property surface (this public property page, PropertyDetailsModal,
          PropertyQuickViewModal) and matched by the IDX site's own property page so the tone is
          identical everywhere a listing needs this disclosure. */}
      {(agentName || officeName) && (
        <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed italic">
            <span className="font-bold uppercase tracking-widest not-italic mr-2">Listing Source:</span>{' '}
            {agentName || 'Agent'}
            {officeName && ` of ${officeName}`}
            {phone && ` (${phone})`}.
            {email && ` Email: ${email}.`}
            {mlsId && ` (MLS# ${mlsId})`}
          </p>
        </div>
      )}
    </div>
  )
}
