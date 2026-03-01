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
      
      {/* Listing Agent Info Paragraph */}
      {(details?.ListAgentFullName || details?.ListOfficeName || details?.listAgentFullName || details?.listOfficeName) && (
        <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed italic">
            <span className="font-bold uppercase tracking-widest not-italic mr-2">Listing Source:</span>{' '}
            {details.ListAgentFullName || details.listAgentFullName || 'Agent'} 
            {(details.ListOfficeName || details.listOfficeName) && ` of ${details.ListOfficeName || details.listOfficeName}`}
            {(details.ListOfficePhone || details.listOfficePhone) && ` (${details.ListOfficePhone || details.listOfficePhone})`}.
            {(details.ListAgentEmail || details.listAgentEmail) && ` Email: ${details.ListAgentEmail || details.listAgentEmail}.`}
          </p>
        </div>
      )}
    </div>
  )
}
