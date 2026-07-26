'use client'

import { useState, useEffect } from 'react'

export default function MLSComplianceFooter() {
  const [year, setYear] = useState<string>('')
  const [dateStr, setDateStr] = useState<string>('')

  useEffect(() => {
    setYear(new Date().getFullYear().toString())
    setDateStr(new Date().toLocaleDateString())
  }, [])

  return (
    <footer className="bg-[#0B0B0B] text-white py-12 border-t border-white/5 mt-auto">
      <div className="max-w-7xl mx-auto px-6">
        {/* Bright MLS Compliance Section */}
        <div className="grid grid-cols-1 gap-6 text-[10px] uppercase tracking-widest leading-loose text-gray-500 font-medium">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-gray-400 mb-2">
            <span className="bg-white/5 px-2 py-1 rounded border border-white/10">
              © {year || ''} Bright MLS • All Rights Reserved
            </span>
            <span className="text-[#C9A24D] font-black">Information Deemed Reliable But Not Guaranteed</span>
          </div>
          
          <p className="normal-case tracking-normal leading-relaxed text-xs opacity-80">
            The data relating to real estate for sale on this website appears in part through the BRIGHT Internet Data Exchange program, a voluntary cooperative exchange of property listing data between licensed real estate brokerage firms in which participates, and is provided by BRIGHT through a licensing agreement.
          </p>
          
          <p className="normal-case tracking-normal leading-relaxed text-xs opacity-80">
            The information provided by this website is for the personal, non-commercial use of consumers and may not be used for any purpose other than to identify prospective properties consumers may be interested in purchasing. Some properties which appear for sale on this website may no longer be available because they are under contract, have Closed or are no longer being offered for sale.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 text-gray-600">
            <p className="normal-case italic">
              Data last updated: {dateStr || ''}
            </p>
            <p className="normal-case max-w-sm sm:text-right">
              Some real estate firms do not participate in IDX and their listings do not appear on this website. 
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
