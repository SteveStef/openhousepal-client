'use client';

import React, { useMemo } from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { X, Download } from 'lucide-react';
import { OpenHouseFlyerDocument, SimilarPropertiesDocument } from '@/lib/pdfs';

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  title?: string;
  type?: 'flyer' | 'recommendations';
  agentId?: string;
  address?: string;
}

export default function PDFPreviewModal({ 
  isOpen, 
  onClose, 
  data, 
  title = "Document Preview",
  type = 'flyer',
  agentId,
  address
}: PDFPreviewModalProps) {
  const document = useMemo(() => {
    if (!data) return null;
    
    if (type === 'flyer') {
      return <OpenHouseFlyerDocument data={data} />;
    }
    
    // Recommendations case: data is the array of properties
    const properties = Array.isArray(data) ? data : (data.properties || []);
    return <SimilarPropertiesDocument properties={properties} agentId={agentId} address={address} />;
  }, [data, type, agentId, address]);

  const fileName = useMemo(() => {
    const baseAddress = (address || data?.address || 'Document').split(',')[0].replace(/\s+/g, '-');
    return `${type === 'flyer' ? 'Flyer' : 'COMPS'}-${baseAddress}.pdf`;
  }, [address, data?.address, type]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/80 animate-fadeIn">
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
            {document && (
              <PDFDownloadLink
                document={document}
                fileName={fileName}
                className="flex items-center gap-2 px-6 py-3 bg-[#C9A24D] hover:bg-[#8b7355] text-[#111827] hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 shadow-lg shadow-[#C9A24D]/10"
              >
                {({ loading }) => (
                  <>
                    <Download size={16} className={loading ? 'animate-bounce' : ''} />
                    <span>{loading ? 'Preparing...' : 'Download PDF'}</span>
                  </>
                )}
              </PDFDownloadLink>
            )}

            <div className="w-px h-8 bg-white/10 mx-1" />

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
          {document ? (
            <PDFViewer 
              key={data?.previewId || 'static'} 
              className="w-full h-full border-none"
            >
              {document}
            </PDFViewer>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-[#C9A24D] border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px]">Generating Preview...</p>
              </div>
            </div>
          )}
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
