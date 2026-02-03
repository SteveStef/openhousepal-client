'use client';

import Image from "next/image";
import { Bed, Bath, Square, ChevronRight } from "lucide-react";

interface OpenHouseFlyerProps {
  coverImage: string;
  address?: string; 
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  qrCodeUrl?: string;
  openHouseUrl?: string;
}

export function OpenHouseFlyer({
  coverImage,
  address,
  price,
  beds,
  baths,
  sqft,
  qrCodeUrl,
  openHouseUrl,
}: OpenHouseFlyerProps) {
  const finalQrCodeUrl = qrCodeUrl || (openHouseUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(openHouseUrl)}` : '');

  return (
    <div className="w-full h-full bg-white text-[#1a1a1a] print:h-screen flex flex-col overflow-hidden">
      
      {/* Top Half: Hero Image */}
      <div className="relative h-[55%] w-full bg-gray-100 overflow-hidden">
        <Image
          src={coverImage || "/placeholder.jpg"}
          alt="Property Cover"
          fill
          priority
          className="object-cover object-center"
        />
      </div>

      {/* Bottom Half: Content */}
      <div className="h-[45%] w-full p-12 flex flex-row justify-between gap-12">
        
        {/* Left Column: Details */}
        <div className="flex-1 flex flex-col justify-between py-4">
          <div>
            <h1 className="font-serif text-6xl font-medium tracking-tight mb-3">
              Open House
            </h1>
            <h2 className="text-sm font-bold tracking-[0.2em] text-gray-500 uppercase mb-8">
              Welcome
            </h2>
            
            <div className="w-full h-px bg-gray-200 mb-10" />

            {/* Icons Grid */}
            <div className="flex items-start gap-16">
              {/* Beds */}
              <div className="flex flex-col gap-2">
                <Bed className="w-8 h-8 text-[#2a2a2a]" strokeWidth={1.5} />
                <div className="flex flex-col">
                  <span className="text-2xl font-semibold">{beds || 0}</span>
                  <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Beds</span>
                </div>
              </div>

              {/* Baths */}
              <div className="flex flex-col gap-2">
                <Bath className="w-8 h-8 text-[#2a2a2a]" strokeWidth={1.5} />
                <div className="flex flex-col">
                  <span className="text-2xl font-semibold">{baths || 0}</span>
                  <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Baths</span>
                </div>
              </div>

              {/* Sq Ft */}
              <div className="flex flex-col gap-2">
                <Square className="w-8 h-8 text-[#2a2a2a]" strokeWidth={1.5} />
                <div className="flex flex-col">
                  <span className="text-2xl font-semibold">{sqft?.toLocaleString() || '-'}</span>
                  <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Sq Ft</span>
                </div>
              </div>
            </div>
          </div>

          {/* Price Footer */}
          <div>
             <div className="w-full h-px bg-gray-200 mb-6" />
             <p className="text-xs uppercase tracking-[0.15em] text-gray-500 font-bold mb-1">
               Listing Price
             </p>
             <p className="font-serif text-3xl text-[#1a1a1a]">
               ${price?.toLocaleString() || '-'}
             </p>
          </div>
        </div>

        {/* Right Column: QR Card */}
        <div className="w-[340px] shrink-0">
          <div className="h-full w-full bg-[#F5F5F2] rounded-3xl p-8 flex flex-col items-center text-center border border-[#e5e5e0]">
            <h3 className="font-serif text-2xl font-medium mb-3 mt-2">
              Scan to Sign In
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed px-4 mb-8">
              Complete our online sign-in form to register your visit
            </p>

            {/* QR Code Container */}
            <div className="flex flex-col items-center gap-4 mb-auto">
              <div className="relative w-48 h-48 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                <Image
                  src={finalQrCodeUrl || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"} 
                  alt="Sign In QR Code"
                  fill
                  className={`object-contain p-2 ${!finalQrCodeUrl ? 'opacity-0' : ''}`}
                  unoptimized
                />
              </div>
            </div>

            <div className="mt-8">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-900 mb-1">
                Quick & Easy
              </p>
              <p className="text-[10px] text-gray-500">
                Takes less than 30 seconds to complete
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
