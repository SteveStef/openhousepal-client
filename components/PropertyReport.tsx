'use client'

import { 
  FileText,
} from 'lucide-react'
import { PropertyDetailResponse } from '@/types'
import { formatMlsStatus, formatPropertyType } from '@/lib/utils'

interface PropertyReportProps {
  property: PropertyDetailResponse
}

export default function PropertyReport({ property }: PropertyReportProps) {
  const formatList = (items: any): string | null => {
    if (!items) return null;
    if (Array.isArray(items)) {
      if (items.length === 0) return null;
      return items.join(", ");
    }
    return String(items);
  };

  const formatCurrency = (amount: number | null | undefined): string | null => {
    if (!amount) return null;
    return `$${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string | null | undefined) => {
    try {
      if (!dateString) return null
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return null
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch (error) {
      return null
    }
  }

  const allReportData = [
    // Listing Information
    { property: "Listing Information", value: "", isHeader: true },
    { property: "Status", value: formatMlsStatus(property.MlsStatus) },
    { property: "Listing Date", value: formatDate(property.MLSListDate) },
    { property: "Last Price Change", value: formatDate(property.PriceChangeTimestamp) },
    { property: "Days on Market", value: property.DaysOnMarket },
    { property: "Cumulative DOM", value: property.CumulativeDaysOnMarket },
    { property: "Original List Price", value: formatCurrency(property.OriginalListPrice) },

    // Building & Construction
    { property: "BUILDING & CONSTRUCTION", value: "", isHeader: true },
    { property: "Property Type", value: formatPropertyType(property.PropertyType) },
    { property: "Year Built", value: property.YearBuilt },
    { property: "New Construction", value: property.NewConstructionYN ? "Yes" : (property.NewConstructionYN === false ? "No" : null) },
    { property: "Architectural Style", value: formatList(property.ArchitecturalStyle) },
    { property: "Construction Materials", value: formatList(property.ConstructionMaterials) },
    { property: "Stories", value: property.Stories },
    { property: "Basement", value: formatList(property.Basement) },
    { property: "Square Footage", value: property.LivingArea ? `${property.LivingArea.toLocaleString()} sq ft` : null },
    { property: "Above Grade SQFT", value: property.AboveGradeFinishedArea ? `${property.AboveGradeFinishedArea.toLocaleString()} sq ft` : null },
    { property: "Below Grade SQFT", value: property.BelowGradeFinishedArea ? `${property.BelowGradeFinishedArea.toLocaleString()} sq ft` : null },
    { property: "Lot Size", value: property.LotSizeSquareFeet ? `${property.LotSizeSquareFeet.toLocaleString()} sq ft` : null },
    { property: "Lot Size (Acres)", value: property.LotSizeAcres ? `${property.LotSizeAcres} AC` : null },
    { property: "Zoning", value: property.Zoning },

    // Interior Features
    { property: "INTERIOR FEATURES", value: "", isHeader: true },
    { property: "Appliances", value: formatList(property.Appliances) },
    { property: "Interior Features", value: formatList(property.InteriorFeatures) },
    { property: "Flooring", value: formatList(property.Flooring) },
    { property: "Window Features", value: formatList(property.WindowFeatures) },
    { property: "Fireplace Features", value: formatList(property.FireplaceFeatures) },
    { property: "Fireplaces", value: property.FireplacesTotal },

    // HVAC & Systems
    { property: "HVAC & SYSTEMS", value: "", isHeader: true },
    { property: "Central Air", value: property.CentralAirYN ? "Yes" : (property.CentralAirYN === false ? "No" : null) },
    { property: "Heating", value: formatList(property.Heating) },
    { property: "Heating Fuel", value: formatList(property.HeatingFuel) },
    { property: "Cooling", value: formatList(property.Cooling) },
    { property: "Cooling Fuel", value: formatList(property.CoolingFuel) },
    { property: "Water Source", value: formatList(property.WaterSource) },
    { property: "Sewer", value: formatList(property.Sewer) },
    { property: "Utilities", value: formatList(property.Utilities) },

    // Parking & Access
    { property: "PARKING & ACCESS", value: "", isHeader: true },
    { property: "Garage Spaces", value: property.GarageSpaces ? `${property.GarageSpaces} spaces` : null },
    { property: "Attached Garage", value: property.AttachedGarageYN ? "Yes" : (property.AttachedGarageYN === false ? "No" : null) },
    { property: "Parking Features", value: formatList(property.ParkingFeatures) },
    { property: "Accessibility Features", value: formatList(property.AccessibilityFeatures) },

    // HOA & Fees
    ...(property.AssociationYN || property.AssociationFee ? [
      { property: "HOA & FEES", value: "", isHeader: true },
      { property: "HOA Fee", value: formatCurrency(property.AssociationFee) },
      { property: "Frequency", value: property.AssociationFeeFrequency },
      { property: "HOA Fee 2", value: formatCurrency(property.AssociationFee2) },
      { property: "Frequency 2", value: property.AssociationFee2Frequency },
      { property: "HOA Includes", value: formatList(property.AssociationFeeIncludes) },
      { property: "Amenities", value: formatList(property.AssociationAmenities) },
    ] : []),

    // Schools & District
    { property: "SCHOOLS & DISTRICT", value: "", isHeader: true },
    { property: "School District", value: property.SchoolDistrictName },
    { property: "Elementary School", value: property.ElementarySchool },
    { property: "Middle School", value: property.MiddleOrJuniorSchool },
    { property: "High School", value: property.HighSchool },

    // Location & Neighborhood
    { property: "LOCATION & NEIGHBORHOOD", value: "", isHeader: true },
    { property: "County", value: property.County },
    { property: "Township", value: property.MLSAreaMajor },
    { property: "Subdivision", value: property.SubdivisionName },
    { property: "View", value: formatList(property.View) },
    { property: "Waterfront", value: formatList(property.WaterfrontFeatures) },
    { property: "Possession", value: formatList(property.Possession) },
    { property: "Directions", value: property.Directions },

    // Additional Features
    { property: "ADDITIONAL FEATURES", value: "", isHeader: true },
    { property: "Senior Community", value: property.SeniorCommunityYN ? "Yes" : (property.SeniorCommunityYN === false ? "No" : null) },
    { property: "Pets Allowed", value: formatList(property.PetsAllowed) },
    { property: "Exterior Features", value: formatList(property.ExteriorFeatures) },
    { property: "Lot Features", value: formatList(property.LotFeatures) },

    // Financial Details
    { property: "FINANCIAL DETAILS", value: "", isHeader: true },
    { property: "Annual Property Tax", value: formatCurrency(property.TaxAnnualAmount) },
    { property: "Tax Assessment", value: formatCurrency(property.TaxAssessmentAmount) },
    { property: "Assessment Year", value: property.AssessmentYear },
    { property: "Tax ID", value: property.ListingTaxID },
  ];

  // Filter out rows with null or empty values, but keep headers
  const reportData = allReportData.filter(row => row.isHeader || (row.value !== null && row.value !== undefined && row.value !== ''));

  interface ReportSection {
    header: string;
    items: Array<{ property: string; value: any }>;
  }

  // Group data by sections and filter out empty sections
  const sections: ReportSection[] = [];
  let currentSection: ReportSection | null = null;

  for (const row of reportData) {
    if (row.isHeader) {
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { header: row.property, items: [] };
    } else if (currentSection) {
      currentSection.items.push({ property: row.property, value: row.value });
    }
  }

  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return (
    <div className="bg-white dark:bg-[#0B0B0B] rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      {/* Report Header */}
      <div className="bg-gray-50 dark:bg-[#151517] px-8 py-8 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <FileText size={16} className="text-white" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight">Property Details Report</h2>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Comprehensive technical overview and specifications</p>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-black tracking-[0.2em] mb-1">
              {formatPropertyType(property.PropertyType)} • Status
            </div>
            <div className="flex items-center justify-end text-green-500 font-bold text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
              {formatMlsStatus(property.MlsStatus)}
            </div>
          </div>
        </div>
      </div>

      {/* Report Content - Grouped Sections */}
      <div className="p-6 sm:p-10 space-y-12 bg-white dark:bg-[#0B0B0B]">
        {sections.map((section, sectionIndex) => {
          return (
            <div
              key={sectionIndex}
              className="space-y-5"
            >
              {/* Subtle Section Header */}
              <h3 className="text-[10px] font-black text-[#C9A24D] uppercase tracking-[0.3em] mb-6 pb-2 border-b border-gray-100 dark:border-gray-800">
                {section.header}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                {section.items.map((item, itemIdx) => (
                    <div key={itemIdx} className={`flex justify-between items-start gap-4 py-1.5 border-b border-gray-50 dark:border-gray-800/50 last:border-0 ${
                        String(item.value).length > 35 ? 'md:col-span-2' : ''
                    }`}>
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tight flex-shrink-0">
                            {item.property}
                        </span>
                        <span className="text-xs font-semibold text-[#111827] dark:text-gray-200 text-right">
                            {item.value}
                        </span>
                    </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Listing Agent Info Paragraph */}
        {(property.ListAgentFullName || property.ListOfficeName) && (
          <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed italic">
              <span className="font-bold uppercase tracking-widest not-italic mr-2 text-[9px]">Listing Source:</span>{' '}
              {property.ListAgentFullName || 'Agent'}
              {property.ListOfficeName && ` of ${property.ListOfficeName}`}
              {property.ListOfficePhone && ` (${property.ListOfficePhone})`}.
              {property.ListAgentEmail && ` Email: ${property.ListAgentEmail}.`}
              {property.ListingId && ` (MLS# ${property.ListingId})`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
