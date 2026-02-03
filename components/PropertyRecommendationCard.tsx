"use client";

import Image from "next/image";
import { Bed, Bath, Square, TreePine, Calendar, Clock } from "lucide-react";

interface PropertyCardProps {
  image: string;
  streetAddress: string;
  town: string;
  beds: number;
  baths: number;
  sqft: number;
  acres: number;
  yearBuilt: number;
  dom: number;
  qrLink?: string; // Optional custom link for the QR code
  hideQr?: boolean;
  isCompact?: boolean;
}

export function PropertyRecommendationCard({
  image,
  streetAddress,
  town,
  beds,
  baths,
  sqft,
  acres,
  yearBuilt,
  dom,
  qrLink,
  hideQr = false,
  isCompact = false,
}: PropertyCardProps) {
  // Use the provided qrLink, or fallback to the auto-generated one based on address
  const safeAddress = streetAddress || 'property';
  const destinationUrl = qrLink || `https://openhousepal.com/property/${safeAddress.replace(/\s+/g, "-").toLowerCase()}`;
  
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
    destinationUrl
  )}&bgcolor=ffffff&color=1a1a1a`;

  return (
    <article className={`group relative flex flex-col overflow-hidden rounded-lg bg-card text-card-foreground shadow-sm ring-1 ring-border transition-all hover:ring-primary/50 ${isCompact ? 'scale-95' : ''}`}>
      
      {/* Property Image - Sizing handled by globals.css in print */}
      <div className={`relative w-full overflow-hidden bg-muted ${isCompact ? 'aspect-video' : 'aspect-[4/3]'}`}>
        <Image
          src={image || "/placeholder.svg"}
          alt={streetAddress || "Property"}
          fill
          priority
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* DOM Badge */}
        <div className={`absolute left-2 top-2 rounded-full bg-white/95 font-bold uppercase tracking-wide text-black shadow-sm backdrop-blur-sm print:shadow-none print:border print:border-gray-200 ${isCompact ? 'px-1.5 py-0 text-[8px]' : 'px-2 py-0.5 text-[10px]'}`}>
          {dom || 0} Days
        </div>
      </div>

      {/* Content - Flex sizing handled by globals.css */}
      <div className={`flex flex-1 flex-col ${isCompact ? 'p-2' : 'p-3'}`}>
        
        {/* Top: Address & Secondary Info */}
        <div className={`flex justify-between items-start gap-4 ${isCompact ? 'mb-1' : 'mb-2'}`}>
          <div className="flex-1">
            <h3 className={`font-serif font-bold leading-tight text-foreground ${isCompact ? 'text-sm' : 'text-base'}`}>
              {streetAddress || 'Address Not Available'}
            </h3>
            <p className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
              {town}
            </p>
          </div>
          
          {!isCompact && (
            <div className="flex flex-col items-end gap-1 text-[10px] text-muted-foreground shrink-0">
               <div className="flex items-center gap-1">
                  <TreePine className="h-3 w-3" />
                  <span>{acres || 0} ac</span>
               </div>
               <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Built {yearBuilt || '-'}</span>
               </div>
            </div>
          )}
        </div>

        {/* Bottom Row: Stats & QR Code */}
        <div className="mt-auto flex items-end justify-between gap-3">
          
          {/* KPI Chips - Horizontal Row with Icons */}
          <div className="flex flex-1 gap-2 text-center">
            <div className={`flex flex-1 flex-col items-center justify-center rounded bg-muted/50 ${isCompact ? 'py-1' : 'py-1.5'}`}>
              <Bed className={`${isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-muted-foreground mb-0.5`} strokeWidth={2} />
              <span className={`font-bold leading-none ${isCompact ? 'text-xs' : 'text-sm'}`}>{beds || 0}</span>
            </div>
            <div className={`flex flex-1 flex-col items-center justify-center rounded bg-muted/50 ${isCompact ? 'py-1' : 'py-1.5'}`}>
              <Bath className={`${isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-muted-foreground mb-0.5`} strokeWidth={2} />
              <span className={`font-bold leading-none ${isCompact ? 'text-xs' : 'text-sm'}`}>{baths || 0}</span>
            </div>
            <div className={`flex flex-1 flex-col items-center justify-center rounded bg-muted/50 ${isCompact ? 'py-1' : 'py-1.5'}`}>
              <Square className={`${isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-muted-foreground mb-0.5`} strokeWidth={2} />
              <span className={`font-bold leading-none ${isCompact ? 'text-xs' : 'text-sm'}`}>{sqft?.toLocaleString() || '-'}</span>
            </div>
          </div>

          {/* QR Code - Compact & Inline */}
          {!hideQr && (
            <div className="shrink-0">
              <div className="relative h-12 w-12 overflow-hidden rounded bg-white p-0.5 ring-1 ring-border">
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
