'use client'

import { 
  Building2, 
  DoorOpen, 
  Wind, 
  Car, 
  ShieldCheck, 
  GraduationCap, 
  FileText,
  Layers
} from 'lucide-react'

interface PropertyReportProps {
  resoFacts: any
  propertyAddress?: string
}

export default function PropertyReport({ resoFacts, propertyAddress }: PropertyReportProps) {
  const formatList = (items: string[] | null | undefined): string | null => {
    if (!items || items.length === 0) return null;
    return items.join(", ");
  };

  const formatCurrency = (amount: number | null | undefined): string | null => {
    if (!amount) return null;
    return `$${amount.toLocaleString()}`;
  };

  const sectionIcons: Record<string, any> = {
    "BUILDING & CONSTRUCTION": Building2,
    "INTERIOR FEATURES": DoorOpen,
    "HVAC & SYSTEMS": Wind,
    "PARKING & ACCESS": Car,
    "HOA & FEES": FileText,
    "SCHOOLS & DISTRICT": GraduationCap,
    "ADDITIONAL FEATURES": ShieldCheck
  };

  const allReportData = [
    // Listing Information
    { property: "Listing Information", value: "", isHeader: true },
    { property: "Status", value: resoFacts.standardStatus || resoFacts.homeStatus || resoFacts.standard_status || resoFacts.home_status },
    { property: "Days on Market", value: resoFacts.daysOnMarket || resoFacts.days_on_market },
    { property: "Cumulative DOM", value: resoFacts.cumulativeDaysOnMarket || resoFacts.cumulative_days_on_market },
    { property: "Original List Price", value: formatCurrency(resoFacts.originalListPrice || resoFacts.original_list_price) },

    // Building & Construction
    { property: "BUILDING & CONSTRUCTION", value: "", isHeader: true },
    { property: "Year Built", value: resoFacts.yearBuilt || resoFacts.year_built },
    { property: "New Construction", value: (resoFacts.newConstructionYn ?? resoFacts.new_construction_yn) ? "Yes" : (resoFacts.newConstructionYn === false || resoFacts.new_construction_yn === false ? "No" : null) },
    { property: "Architectural Style", value: resoFacts.architecturalStyle || resoFacts.architectural_style },
    { property: "Construction Materials", value: formatList(resoFacts.constructionMaterials || resoFacts.construction_materials) },
    { property: "Stories", value: resoFacts.stories },
    { property: "Total Stories", value: resoFacts.storiesTotal || resoFacts.stories_total },
    { property: "Square Footage", value: (resoFacts.livingArea || resoFacts.living_area) ? `${(resoFacts.livingArea || resoFacts.living_area).toLocaleString()} sq ft` : null },
    { property: "Lot Size", value: (resoFacts.lotSize || resoFacts.lot_size) ? `${(resoFacts.lotSize || resoFacts.lot_size).toLocaleString()} sq ft` : null },
    { property: "Lot Size (Acres)", value: (resoFacts.lotSizeAcres || resoFacts.lot_size_acres) ? `${(resoFacts.lotSizeAcres || resoFacts.lot_size_acres)} AC` : null },
    { property: "Zoning", value: resoFacts.zoning },

    // Interior Features
    { property: "INTERIOR FEATURES", value: "", isHeader: true },
    { property: "Appliances", value: formatList(resoFacts.appliances) },
    { property: "Interior Features", value: formatList(resoFacts.interiorFeatures || resoFacts.interior_features) },
    { property: "Flooring", value: formatList(resoFacts.flooring) },
    { property: "Window Features", value: formatList(resoFacts.windowFeatures || resoFacts.window_features) },
    { property: "Fireplace Features", value: formatList(resoFacts.fireplaceFeatures || resoFacts.fireplace_features) },
    { property: "Fireplaces", value: resoFacts.fireplaces },

    // HVAC & Systems
    { property: "HVAC & SYSTEMS", value: "", isHeader: true },
    { property: "Heating", value: formatList(resoFacts.heating) },
    { property: "Heating Fuel", value: formatList(resoFacts.heatingFuel || resoFacts.heating_fuel) },
    { property: "Cooling", value: formatList(resoFacts.cooling) },
    { property: "Cooling Fuel", value: formatList(resoFacts.coolingFuel || resoFacts.cooling_fuel) },
    { property: "Water Source", value: formatList(resoFacts.waterSource || resoFacts.water_source) },
    { property: "Sewer", value: formatList(resoFacts.sewer) },
    { property: "Electric", value: formatList(resoFacts.electric) },

    // Parking & Access
    { property: "PARKING & ACCESS", value: "", isHeader: true },
    { property: "Total Parking", value: (resoFacts.parkingCapacity || resoFacts.parking_capacity) ? `${(resoFacts.parkingCapacity || resoFacts.parking_capacity)} spaces` : null },
    { property: "Garage Parking", value: (resoFacts.garageParkingCapacity || resoFacts.garage_parking_capacity) ? `${(resoFacts.garageParkingCapacity || resoFacts.garage_parking_capacity)} spaces` : null },
    { property: "Attached Garage", value: (resoFacts.attachedGarageYn ?? resoFacts.attached_garage_yn) ? "Yes" : null },
    { property: "Parking Features", value: formatList(resoFacts.parkingFeatures || resoFacts.parking_features) },
    { property: "Accessibility Features", value: formatList(resoFacts.accessibilityFeatures || resoFacts.accessibility_features) },

    // HOA & Fees
    ...(resoFacts.hasAssociation || resoFacts.associationFee || resoFacts.has_association || resoFacts.association_fee ? [
      { property: "HOA & FEES", value: "", isHeader: true },
      { property: "HOA Fee", value: resoFacts.hoaFee || resoFacts.hoa_fee || resoFacts.associationFee || resoFacts.association_fee },
      { property: "Frequency", value: resoFacts.associationFeeFrequency || resoFacts.association_fee_frequency },
      { property: "Annual Property Tax", value: formatCurrency(resoFacts.taxAnnualAmount || resoFacts.tax_annual_amount) },
      { property: "Capital Contribution", value: formatCurrency(resoFacts.capitalContributionFee || resoFacts.capital_contribution_fee) },
      { property: "HOA Includes", value: formatList(resoFacts.associationFeeIncludes || resoFacts.association_fee_includes) },
      { property: "Amenities", value: formatList(resoFacts.associationAmenities || resoFacts.association_amenities) },
    ] : []),

    // Schools & District
    { property: "SCHOOLS & DISTRICT", value: "", isHeader: true },
    { property: "School District", value: resoFacts.schoolDistrictName || resoFacts.school_district_name },
    { property: "Elementary School", value: (resoFacts.elementarySchool || resoFacts.elementary_school) ? `${(resoFacts.elementarySchool || resoFacts.elementary_school)}${(resoFacts.elementarySchoolDistrict || resoFacts.elementary_school_district) ? ` (${resoFacts.elementarySchoolDistrict || resoFacts.elementary_school_district} District)` : ''}` : null },
    { property: "Middle School", value: (resoFacts.middleOrJuniorSchool || resoFacts.middle_or_junior_school) ? `${(resoFacts.middleOrJuniorSchool || resoFacts.middle_or_junior_school)}${(resoFacts.middleOrJuniorSchoolDistrict || resoFacts.middle_or_junior_school_district) ? ` (${resoFacts.middleOrJuniorSchoolDistrict || resoFacts.middle_or_junior_school_district} District)` : ''}` : null },
    { property: "High School", value: (resoFacts.highSchool || resoFacts.high_school) ? `${(resoFacts.highSchool || resoFacts.high_school)}${(resoFacts.highSchoolDistrict || resoFacts.high_school_district) ? ` (${resoFacts.highSchoolDistrict || resoFacts.high_school_district} District)` : ''}` : null },

    // Location & Neighborhood
    { property: "LOCATION & NEIGHBORHOOD", value: "", isHeader: true },
    { property: "County", value: resoFacts.county },
    { property: "Walk Score", value: resoFacts.walkScore || resoFacts.walk_score },
    { property: "Direction Faces", value: resoFacts.directionFaces || resoFacts.direction_faces },
    { property: "Cross Street", value: resoFacts.crossStreet || resoFacts.cross_street },
    { property: "Possession", value: formatList(resoFacts.possession) },

    // Additional Features
    { property: "ADDITIONAL FEATURES", value: "", isHeader: true },
    { property: "Senior Community", value: (resoFacts.seniorCommunityYn ?? resoFacts.senior_community_yn) ? "Yes" : (resoFacts.seniorCommunityYn === false || resoFacts.senior_community_yn === false ? "No" : null) },
    { property: "Pets Allowed", value: formatList(resoFacts.petsAllowed || resoFacts.pets_allowed) },
    { property: "Exterior Features", value: formatList(resoFacts.exteriorFeatures || resoFacts.exterior_features) },
    { property: "Lot Features", value: formatList(resoFacts.lotFeatures || resoFacts.lot_features) },
    { property: "Community Features", value: formatList(resoFacts.communityFeatures || resoFacts.community_features) },
    { property: "Security Features", value: formatList(resoFacts.securityFeatures || resoFacts.security_features) },

    // Financial Details
    { property: "FINANCIAL DETAILS", value: "", isHeader: true },
    { property: "Tax Assessment", value: formatCurrency(resoFacts.taxAssessmentAmount || resoFacts.tax_assessment_amount) },
    { property: "Land Assessment", value: formatCurrency(resoFacts.landAssessmentAmount || resoFacts.land_assessment_amount) },
    { property: "Improvement Assessment", value: formatCurrency(resoFacts.improvementAssessmentAmount || resoFacts.improvement_assessment_amount) },
    { property: "Assessment Year", value: resoFacts.assessmentYear || resoFacts.assessment_year },
  ];

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
    <div className="bg-white dark:bg-[#151517] rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="bg-gray-900 dark:bg-[#1a1a1c] px-10 py-10 text-white border-b border-gray-700 dark:border-gray-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                <FileText size={20} className="text-white" />
              </div>
              <h2 className="text-3xl font-black tracking-tight">Property Datasheet</h2>
            </div>
            <p className="text-gray-400 font-medium">Detailed Property Specifications</p>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-right">
              <div className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Status</div>
              <div className="flex items-center text-green-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse"></span>
                ACTIVE
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8 bg-gray-50/50 dark:bg-[#0B0B0B]">
        {sections.map((section, sectionIndex) => {
          const Icon = sectionIcons[section.header] || Layers;
            
            const fullWidthItems = section.items.filter(item => String(item.value).length > 40);
            const gridItems = section.items.filter(item => String(item.value).length <= 40);

            return (
              <div key={sectionIndex} className="bg-white dark:bg-[#151517] rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden transition-all hover:shadow-md">
                <div className="px-6 py-4 bg-gray-50 dark:bg-[#1a1a1c] border-b border-gray-100 dark:border-gray-800 flex items-center space-x-3">
                  <Icon size={18} className="text-blue-500" />
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">
                    {section.header}
                  </h3>
                </div>

                <div className="p-6">
                  {gridItems.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                      {gridItems.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex flex-col">
                          <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
                            {item.property}
                          </span>
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-200">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {fullWidthItems.length > 0 && (
                    <div className={`${gridItems.length > 0 ? 'mt-8 pt-8 border-t border-gray-50 dark:border-gray-800' : ''} space-y-6`}>
                      {fullWidthItems.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex flex-col">
                          <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                            {item.property}
                          </span>
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-[#0B0B0B] p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
