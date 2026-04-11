/*'use client';

import { Home } from "lucide-react";
import { PropertyRecommendationCard } from "@/components/PropertyRecommendationCard";
import { Property } from "@/types";

const chunkArray = <T,>(array: T[], size: number): T[][] => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

interface PropertyRecommendationsPrintViewProps {
    openHouseId?: string;
    agentId?: string;
    className?: string;
    properties?: Property[];
}

export function PropertyRecommendationsPrintView({ openHouseId, agentId, className, properties }: PropertyRecommendationsPrintViewProps) {
  
  // Only render if we have properties, otherwise show nothing to avoid dummy data
  if (!properties || properties.length === 0) {
    return null;
  }
  
  const pages = chunkArray(properties, 6);

  return (
    <div className={`min-h-screen bg-white text-black print-view-root ${className || ''}`}>
      {pages.map((pageItems, pageIndex) => (
        <div 
          key={pageIndex}
          className="page-container mx-auto max-w-6xl print:mx-0 print:max-w-none print-view-container"
          style={{ breakAfter: pageIndex < pages.length - 1 ? 'page' : 'auto' }}
        >
          <header className="flex w-full items-center justify-between px-6 py-4 print:px-0 print:py-0 print-header">
            <div className="flex flex-row items-center gap-4">
              <div className="flex items-center justify-center rounded-lg bg-gray-100 p-2 print:hidden">
                <Home className="h-6 w-6 text-[#111827]" strokeWidth={2} />
              </div>
              <Home className="hidden h-5 w-5 text-black print:block" strokeWidth={2} />
              
              <div className="flex flex-col text-left">
                <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#111827] print:text-lg">
                  Similar Properties
                </h1>
                <p className="text-sm text-gray-500 print:text-xs">
                  Page {pageIndex + 1} of {pages.length}
                </p>
              </div>
            </div>
            <div className="text-xs text-gray-400 print:hidden">
                Open House: {openHouseId}
            </div>
          </header>

          <main className="w-full px-6 pb-6 print:px-0 print:pb-0 print-main">
            <div className="properties-grid grid gap-6 sm:grid-cols-2 lg:grid-cols-2 print:gap-0">
              {pageItems.map((property) => (
                <PropertyRecommendationCard
                  key={property.id}
                  id={property.id}
                  agentId={agentId}
                  image={property.ListPictureURL || ''}
                  streetAddress={property.FullStreetAddress || ''}
                  town={property.City || ''}
                  price={property.ListPrice || 0}
                  beds={property.BedroomsTotal || 0}
                  baths={property.BathroomsTotal || 0}
                  sqft={property.LivingArea || 0}
                  acres={property.LotSizeAcres || 0}
                  yearBuilt={property.YearBuilt || 0}
                  dom={property.DaysOnMarket || 0}
                />
              ))}
            </div>
          </main>
        </div>
      ))}
    </div>
  );
}*/
