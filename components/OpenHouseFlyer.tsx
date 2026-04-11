/*'use client';

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
  const finalQrCodeUrl = (qrCodeUrl && qrCodeUrl.length > 0) 
    ? qrCodeUrl 
    : (openHouseUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(openHouseUrl)}` : '');

  return (
    <div className="w-full h-full bg-white text-[#1a1a1a] print:h-screen flex flex-col overflow-hidden">
      
      <div className="relative h-[40%] w-full bg-gray-100 overflow-hidden">
        <Image
          src={coverImage || "/placeholder.svg"}
          alt="Property Cover"
          fill
          priority
          className="object-cover object-[center_35%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent" />
      </div>

      <div className="h-[60%] w-full p-12 flex flex-row justify-between gap-12">
        
        <div className="flex-1 flex flex-col justify-between py-4">
          <div>
            <h1 className="font-serif text-6xl font-medium tracking-tight mb-3">
              Open House
            </h1>
            <h2 className="text-sm font-bold tracking-[0.2em] text-gray-500 uppercase mb-8">
              Welcome
            </h2>
            
            <div className="w-full h-px bg-gray-200 mb-10" />

            <div className="mb-12">
              <p className="text-xs font-bold tracking-[0.15em] text-gray-400 uppercase mb-3">
                Property Address
              </p>
              <p className="text-4xl font-serif text-[#1a1a1a] leading-tight">
                {address || "Address not provided"}
              </p>
            </div>

            <div className="flex items-start gap-16">
              <div className="flex flex-col items-center gap-2">
                <Bed className="w-8 h-8 text-[#2a2a2a]" strokeWidth={1.5} />
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-semibold">{beds || 0}</span>
                  <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Beds</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2">
                <Bath className="w-8 h-8 text-[#2a2a2a]" strokeWidth={1.5} />
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-semibold">{baths || 0}</span>
                  <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Baths</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2">
                <Square className="w-8 h-8 text-[#2a2a2a]" strokeWidth={1.5} />
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-semibold">{sqft?.toLocaleString() || '-'}</span>
                  <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Sq Ft</span>
                </div>
              </div>
            </div>
          </div>

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

        <div className="w-[340px] shrink-0">
          <div className="h-full w-full bg-[#F5F5F2] rounded-3xl p-8 flex flex-col items-center text-center border border-[#e5e5e0]">
            <h3 className="font-serif text-2xl font-medium mb-3 mt-2">
              Scan to Sign In
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed px-4 mb-8">
              Complete our online sign-in form to register your visit
            </p>

            <div className="flex flex-col items-center gap-4 mb-auto">
              <div className="relative w-64 h-64 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center">
                {finalQrCodeUrl ? (
                  <img
                    src={finalQrCodeUrl} 
                    alt="Sign In QR Code"
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-50 animate-pulse rounded-lg" />
                )}
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
}*/
