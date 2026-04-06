'use client';

import React, { useMemo } from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { X } from 'lucide-react';
import { OpenHousePDF, PropertyRecommendationsPDF } from '@/lib/pdf';

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  title?: string;
  type?: 'flyer' | 'recommendations';
  agentId?: string;
}

export default function PDFPreviewModal({ 
  isOpen, 
  onClose, 
  data, 
  title = "Document Preview",
  type = 'flyer',
  agentId
}: PDFPreviewModalProps) {
  const document = useMemo(() => {
    if (!data) return null;
    
    if (type === 'flyer') {
      const flyerData = data.previewId ? data : data; // flyer is flat or has previewId
      return <OpenHousePDF data={flyerData} />;
    }
    
    // Recommendations case: data is { properties, previewId }
    const properties = data.properties || (Array.isArray(data) ? data : []);
    return <PropertyRecommendationsPDF properties={properties} agentId={agentId} />;
  }, [data, type, agentId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#151517] w-full max-w-5xl h-full max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/10 relative">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-[#1c1c1e]">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
            <p className="text-xs font-medium text-gray-500 mt-1 uppercase tracking-widest">
              Ready for high-resolution print
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="p-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-2xl transition-all duration-200 group"
              title="Close Preview"
            >
              <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Container */}
        <div className="flex-1 bg-[#0B0B0B] relative overflow-hidden">
          <PDFViewer 
            key={data?.previewId || 'static'} 
            className="w-full h-full border-none"
          >
            {document}
          </PDFViewer>
        </div>

        {/* Footer Info */}
        <div className="px-8 py-4 bg-[#1c1c1e] border-t border-white/5 flex items-center justify-center">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em]">
            Use the browser's built-in controls to Print or Download
          </p>
        </div>
      </div>
    </div>
  );
}
