'use client';

import { Home } from "lucide-react";
import { PropertyRecommendationCard } from "@/components/PropertyRecommendationCard";

// 1. Define the shape of your data
interface Property {
  id: number;
  image: string;
  streetAddress: string;
  town: string;
  beds: number;
  baths: number;
  sqft: number;
  acres: number;
  yearBuilt: number;
  dom: number;
}

// ... (Keep existing sample data for fallback/dev) ...
export const allProperties: Property[] = [
  {
    id: 1,
    image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop",
    streetAddress: "1586 Salomon Ln",
    town: "Chesterbrook, PA 19087",
    beds: 4,
    baths: 3,
    sqft: 2450,
    acres: 0.5,
    yearBuilt: 1995,
    dom: 12
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=600&fit=crop",
    streetAddress: "2400 Chestnut St",
    town: "Philadelphia, PA 19103",
    beds: 2,
    baths: 2,
    sqft: 1200,
    acres: 0.0,
    yearBuilt: 2005,
    dom: 45
  },
  {
    id: 3,
    image: "https://images.unsplash.com/photo-1600596542815-2a4d9fdd40d9?w=800&h=600&fit=crop",
    streetAddress: "123 Maple Ave",
    town: "Wayne, PA 19087",
    beds: 5,
    baths: 4,
    sqft: 3500,
    acres: 1.2,
    yearBuilt: 1920,
    dom: 5
  },
  {
    id: 4,
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop",
    streetAddress: "789 Oak Ln",
    town: "Berwyn, PA 19312",
    beds: 3,
    baths: 2.5,
    sqft: 2100,
    acres: 0.75,
    yearBuilt: 1980,
    dom: 28
  }
];

// Fallback logic
const dynamicProperties = [
  ...allProperties,
  ...allProperties.map(p => ({ ...p, id: p.id + 10 })),
  ...allProperties.slice(0, 2).map(p => ({ ...p, id: p.id + 20 }))
];

const chunkArray = <T,>(array: T[], size: number): T[][] => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

interface PropertyRecommendationsPrintViewProps {
    openHouseId?: string;
    className?: string;
    properties?: Property[]; // New prop
}

export function PropertyRecommendationsPrintView({ openHouseId, className, properties }: PropertyRecommendationsPrintViewProps) {
  
  // Use passed data OR fallback to simulation
  const propertiesToRender = properties || dynamicProperties;
  
  const pages = chunkArray(propertiesToRender, 6);

  return (
    <div className={`min-h-screen bg-background text-foreground print:bg-[#f9f9f9] print-view-root ${className || ''}`}>
      {pages.map((pageItems, pageIndex) => (
        <div 
          key={pageIndex}
          className="page-container mx-auto max-w-6xl print:mx-0 print:max-w-none print-view-container"
          style={{ breakAfter: pageIndex < pages.length - 1 ? 'page' : 'auto' }}
        >
          {/* Header */}
          <header className="flex w-full items-center justify-between px-6 py-4 print:px-0 print:py-0 print-header">
            <div className="flex flex-row items-center gap-4">
              <div className="flex items-center justify-center rounded-lg bg-primary/10 p-2 print:hidden">
                <Home className="h-6 w-6 text-primary" strokeWidth={2} />
              </div>
              <Home className="hidden h-5 w-5 text-primary print:block" strokeWidth={2} />
              
              <div className="flex flex-col text-left">
                <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground print:text-lg">
                  Property Recommendations
                </h1>
                <p className="text-sm text-muted-foreground print:text-xs">
                  Page {pageIndex + 1} of {pages.length}
                </p>
              </div>
            </div>
            {/* Show Open House ID for context during dev */}
            <div className="text-xs text-muted-foreground print:hidden">
                Open House: {openHouseId}
            </div>
          </header>

          {/* Properties Grid */}
          <main className="w-full px-6 pb-6 print:px-0 print:pb-0 print-main">
            <div className="properties-grid grid gap-6 sm:grid-cols-2 lg:grid-cols-2 print:gap-0">
              {pageItems.map((property) => (
                <PropertyRecommendationCard
                  key={property.id}
                  image={property.image}
                  streetAddress={property.streetAddress}
                  town={property.town}
                  beds={property.beds}
                  baths={property.baths}
                  sqft={property.sqft}
                  acres={property.acres}
                  yearBuilt={property.yearBuilt}
                  dom={property.dom}
                />
              ))}
            </div>
          </main>
        </div>
      ))}
    </div>
  );
}
