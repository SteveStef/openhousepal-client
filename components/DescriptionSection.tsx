'use client'

import { useState } from 'react'

interface DescriptionSectionProps {
  description: string
  details?: any
}

export default function DescriptionSection({ description, details }: DescriptionSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const maxLength = 532
  const shouldTruncate = description.length > maxLength
  const displayText = isExpanded || !shouldTruncate ? description : description.slice(0, maxLength) + '...'

  return (
    <div className="md:col-span-2 py-4 border-t border-gray-200 dark:border-gray-800 mt-4">
      <h4 className="text-gray-600 dark:text-gray-400 font-medium mb-3">Description:</h4>
      <div className="space-y-2">
        <p className="text-gray-900 dark:text-gray-300 leading-relaxed text-sm">{displayText}</p>
        {shouldTruncate && (
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium transition-colors">
            {isExpanded ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>
      {(details?.listAgentFullName || details?.listOfficeName) && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed">
            <span className="font-semibold">Listing provided by:</span>{' '}
            {details.listAgentFullName || 'Agent'} 
            {details.listOfficeName && ` of ${details.listOfficeName}`}
            {details.listOfficePhone && ` (${details.listOfficePhone})`}.
            {details.listAgentEmail && ` Email: ${details.listAgentEmail}.`}
          </p>
        </div>
      )}
    </div>
  )
}
