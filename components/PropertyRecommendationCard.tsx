"use client";

import Image from "next/image";
import { Bed, Bath, Square, TreePine, Calendar, Clock } from "lucide-react";

interface PropertyCardProps {
  image: string;
  streetAddress: string;
  town?: string;
  price?: number;
  beds: number;
  baths: number;
  sqft: number;
  acres: number;
  yearBuilt: number;
  dom: number;
  id?: string | number; // Unique ID for QR code link
  agentId?: string; // Agent ID for the QR code link
  qrLink?: string; // Optional custom link for the QR code
  hideQr?: boolean;
  isCompact?: boolean;
  selected?: boolean; // New prop for selection state
}

export function PropertyRecommendationCard({
  image,
  streetAddress,
  town,
  price,
  beds,
  baths,
  sqft,
  acres,
  yearBuilt,
  dom,
  id,
  agentId,
  qrLink,
  hideQr = false,
  isCompact = false,
  selected = false,
}: PropertyCardProps) {
  // Generic cleanup: Take the first two parts (Street, City) and apply Title Case
  const parts = (streetAddress || 'Address Not Available').split(',');
  const rawAddress = parts.length > 1 
    ? `${parts[0].trim()}, ${parts[1].trim()}`
    : parts[0].trim();
  
  const cleanAddress = rawAddress
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Use the provided qrLink, or fallback to the auto-generated one based on the unique ID and Agent ID
  const destinationUrl = qrLink || `https://openhousepal.com/property/${id || 'listing'}/${agentId || 'agent'}`;
  
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
    destinationUrl
  )}&bgcolor=ffffff&color=1a1a1a`;

  return (
    <article className={`group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm border-2 transition-all duration-300 ${
      selected 
        ? 'border-[#8b7355] ring-4 ring-[#8b7355]/10' 
        : 'border-transparent hover:border-gray-200'
    } ${isCompact ? '' : ''}`}>
      
      {/* Property Image */}
      <div className={`relative w-full overflow-hidden bg-muted ${isCompact ? 'aspect-[16/10]' : 'aspect-[4/3]'}`}>
        <Image
          src={image || "/placeholder.svg"}
          alt={cleanAddress}
          fill
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover"
          quality={75}
        />
        
        {/* Selection Overlay Indicator */}
        {selected && (
          <div className="absolute inset-0 bg-[#8b7355]/10 flex items-center justify-center">
            <div className="bg-[#8b7355] text-white p-2 rounded-full shadow-lg transform animate-fadeIn">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`flex flex-1 flex-col ${isCompact ? 'p-4' : 'p-5'} print:bg-white print:p-3`}>
        
        {/* Top: Address & Price */}
        <div className="mb-4 print:mb-2">
          <h3 className={`font-black tracking-tight leading-tight text-[#111827] print:text-black ${isCompact ? 'text-base' : 'text-lg'} print:text-[11pt]`}>
            {cleanAddress}
          </h3>
          <p className="text-sm font-black text-[#8b7355] mt-1 print:text-black print:text-[10pt]">
            {price ? `$${price.toLocaleString()}` : 'Price not available'}
          </p>
        </div>

        {/* Bottom Row: Stats & QR Code */}
        <div className="mt-auto flex items-end justify-between gap-2 print:gap-2">
          
          {/* Stats Row - Improved for mobile responsiveness */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 print:gap-2 min-w-0">
            <div className="flex items-center gap-1 whitespace-nowrap">
              <span className="text-sm font-black text-[#111827] print:text-black">{beds || 0}</span>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-gray-500 font-bold print:text-[8pt] print:text-gray-700">Beds</span>
            </div>
            
            <div className="hidden sm:block w-px h-3 bg-gray-200" />
            
            <div className="flex items-center gap-1 whitespace-nowrap">
              <span className="text-sm font-black text-[#111827] print:text-black">{baths || 0}</span>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-gray-500 font-bold print:text-[8pt] print:text-gray-700">Baths</span>
            </div>

            <div className="hidden sm:block w-px h-3 bg-gray-200" />
            
            <div className="flex items-center gap-1 whitespace-nowrap min-w-0">
              <span className="text-sm font-black text-[#111827] print:text-black">
                {sqft ? sqft.toLocaleString() : '-'}
              </span>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-gray-500 font-bold print:text-[8pt] print:text-gray-700 shrink-0">Sq Ft</span>
            </div>
          </div>

          {/* QR Code */}
          {!hideQr && (
            <div className="shrink-0 print:block ml-2">
              <div className="relative h-10 w-10 sm:h-12 sm:w-12 overflow-hidden rounded-none bg-white p-1 shadow-sm border border-gray-100 print:h-14 print:w-14 print:border-gray-200">
                 <Image
                  src={qrUrl || "/placeholder.svg"}
                  alt="Scan"
                  fill
                  priority
                  className="object-contain p-0.5"
                  unoptimized
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
