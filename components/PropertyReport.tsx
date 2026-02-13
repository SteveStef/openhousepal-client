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
    { property: "BUILDING & CONSTRUCTION", value: "", isHeader: true },
    { property: "Year Built", value: resoFacts.yearBuilt },
    { property: "Architectural Style", value: resoFacts.architecturalStyle },
    { property: "Construction Materials", value: formatList(resoFacts.constructionMaterials) },
    { property: "Stories", value: resoFacts.stories },
    { property: "Square Footage", value: resoFacts.livingArea },

    { property: "INTERIOR FEATURES", value: "", isHeader: true },
    { property: "Appliances", value: formatList(resoFacts.appliances) },
    { property: "Interior Features", value: formatList(resoFacts.interiorFeatures) },
    { property: "Flooring", value: formatList(resoFacts.flooring) },
    { property: "Window Features", value: formatList(resoFacts.windowFeatures) },
    { property: "Fireplace Features", value: formatList(resoFacts.fireplaceFeatures) },

    { property: "HVAC & SYSTEMS", value: "", isHeader: true },
    { property: "Heating", value: formatList(resoFacts.heating) },
    { property: "Cooling", value: formatList(resoFacts.cooling) },
    { property: "Water Source", value: formatList(resoFacts.waterSource) },
    { property: "Sewer", value: formatList(resoFacts.sewer) },
    { property: "Electric", value: formatList(resoFacts.electric) },

    { property: "PARKING & ACCESS", value: "", isHeader: true },
    { property: "Total Parking", value: resoFacts.parkingCapacity ? `${resoFacts.parkingCapacity} spaces` : null },
    { property: "Garage Parking", value: resoFacts.garageParkingCapacity ? `${resoFacts.garageParkingCapacity} spaces` : null },
    { property: "Parking Features", value: formatList(resoFacts.parkingFeatures) },
    { property: "Accessibility Features", value: formatList(resoFacts.accessibilityFeatures) },

    ...(resoFacts.hasAssociation ? [
      { property: "HOA & FEES", value: "", isHeader: true },
      { property: "HOA Fee", value: resoFacts.hoaFee },
      { property: "Annual Property Tax", value: formatCurrency(resoFacts.taxAnnualAmount) },
      { property: "HOA Includes", value: formatList(resoFacts.associationFeeIncludes) },
    ] : []),

    { property: "SCHOOLS & DISTRICT", value: "", isHeader: true },
    { property: "Elementary School", value: resoFacts.elementarySchool ? `${resoFacts.elementarySchool}${resoFacts.elementarySchoolDistrict ? ` (${resoFacts.elementarySchoolDistrict} District)` : ''}` : null },
    { property: "Middle School", value: resoFacts.middleOrJuniorSchool ? `${resoFacts.middleOrJuniorSchool}${resoFacts.middleOrJuniorSchoolDistrict ? ` (${resoFacts.middleOrJuniorSchoolDistrict} District)` : ''}` : null },
    { property: "High School", value: resoFacts.highSchool ? `${resoFacts.highSchool}${resoFacts.highSchoolDistrict ? ` (${resoFacts.highSchoolDistrict} District)` : ''}` : null },

    { property: "ADDITIONAL FEATURES", value: "", isHeader: true },
    { property: "Exterior Features", value: formatList(resoFacts.exteriorFeatures) },
    { property: "Lot Features", value: formatList(resoFacts.lotFeatures) },
    { property: "Community Features", value: formatList(resoFacts.communityFeatures) },
    { property: "Security Features", value: formatList(resoFacts.securityFeatures) },
  ];

  const reportData = allReportData.filter(row => row.isHeader || (row.value !== null && row.value !== undefined && row.value !== ''));
  const filteredData = reportData.filter((row, index) => {
    if (!row.isHeader) return true;
    const nextRows = reportData.slice(index + 1);
    const hasDataInSection = nextRows.some((nextRow) => {
      if (nextRow.isHeader) return false;
      return !nextRow.isHeader;
    });
    return hasDataInSection;
  });

  return (
    <div className="bg-white dark:bg-[#151517] rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="bg-gray-900 dark:bg-[#1a1a1c] px-10 py-10 text-white border-b border-gray-700 dark:border-gray-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                <FileText size={20} className="text-white" />
              </div>
              <h2 className="text-3xl font-black tracking-tight">Technical Datasheet</h2>
            </div>
            <p className="text-gray-400 font-medium">Verified Property Specifications & Compliance Data</p>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-right">
              <div className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Status</div>
              <div className="flex items-center text-green-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse"></span>
                ACTIVE
              </div>
            </div>
            <div className="h-10 w-px bg-gray-700"></div>
            <div className="text-right">
              <div className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Revision</div>
              <div className="font-mono font-bold text-sm">#{new Date().toISOString().slice(0,10).replace(/-/g,'')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8 bg-gray-50/50 dark:bg-[#0B0B0B]">
        {(() => {
          const sections: Array<{ header: string; items: Array<{ property: string; value: any }> }> = [];
          let currentSection: { header: string; items: Array<{ property: string; value: any }> } | null = null;

          filteredData.forEach((row) => {
            if (row.isHeader) {
              if (currentSection) sections.push(currentSection);
              currentSection = { header: row.property, items: [] };
            } else if (currentSection) {
              currentSection.items.push({ property: row.property, value: row.value });
            }
          });
          if (currentSection) sections.push(currentSection);

          return sections.map((section, sectionIndex) => {
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
          });
        })()}
      </div>
    </div>
  );
}
