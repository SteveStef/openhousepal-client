'use client'
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { OpenHouseFlyerDocument, SimilarPropertiesDocument } from '@/lib/pdfs'; 

const PDFDownloadLink = dynamic(() => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink), { ssr: false });
const PDFViewer = dynamic(() => import('@react-pdf/renderer').then((mod) => mod.PDFViewer), { ssr: false });

const PropertyPage = () => {
  const [isClient, setIsClient] = useState(false);
  const [activeView, setActiveView] = useState<'flyer' | 'recs'>('flyer');

  useEffect(() => { setIsClient(true); }, []);

  const testProperty = {
    id: "OH-789",
    coverImage: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c", 
    address: "123 Ocean Drive, Philadelphia",
    price: 2500000,
    beds: 4,
    baths: 3.5,
    sqft: 3450,
    openHouseUrl: "https://openhousepal.com/signin/123",
  };

  const dummyRecommendations = Array.from({ length: 8 }).map((_, i) => ({
    id: `rec-${i}`,
    ListPictureURL: `https://images.unsplash.com/photo-${1500335753033 + i}?auto=format&fit=crop&w=400&q=80`,
    FullStreetAddress: `${100 + i} Maple Street, Philadelphia`,
    ListPrice: 850000 + (i * 50000),
    BedroomsTotal: 3 + (i % 2),
    BathroomsTotal: 2,
    LivingArea: 2100 + (i * 100),
  }));

  if (!isClient) return <div className="p-10 font-sans text-gray-500 text-center">Loading PDF Designer...</div>;

  const flyerDoc = <OpenHouseFlyerDocument data={testProperty} />;
  const recsDoc = <SimilarPropertiesDocument properties={dummyRecommendations} agentId="agent_007" address={testProperty.address} />;
  const filenameBase = testProperty.address.split(',')[0].replace(/\s+/g, '-');

  return (
    <div className="p-6 md:p-10 font-sans bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Marketing Assets</h1>
            <p className="text-gray-500 mt-2">Generate high-end printables for your listing.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            {/* Flyer Card */}
            <div className={`p-6 rounded-3xl border-2 transition-all ${activeView === 'flyer' ? 'bg-white border-[#8b7355] shadow-xl' : 'bg-gray-100 border-transparent shadow-none'}`}>
              <h3 className="font-bold text-gray-900 text-xl mb-1">Check-In Flyer</h3>
              <p className="text-sm text-gray-500 mb-6">Signature flyer for the front entrance.</p>
              <div className="space-y-3">
                <button onClick={() => setActiveView('flyer')} className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${activeView === 'flyer' ? 'bg-[#8b7355] text-white' : 'bg-white text-gray-700 border'}`}>Preview</button>
                <PDFDownloadLink document={flyerDoc} fileName={`Flyer-${filenameBase}.pdf`} className="block w-full bg-gray-900 text-white text-sm font-bold py-3 rounded-xl text-center">
                  {({ loading }) => (loading ? 'Generating...' : 'Download PDF')}
                </PDFDownloadLink>
              </div>
            </div>

            {/* Recommendations Card */}
            <div className={`p-6 rounded-3xl border-2 transition-all ${activeView === 'recs' ? 'bg-white border-[#8b7355] shadow-xl' : 'bg-gray-100 border-transparent shadow-none'}`}>
              <h3 className="font-bold text-gray-900 text-xl mb-1">Similar Properties</h3>
              <p className="text-sm text-gray-500 mb-6">{dummyRecommendations.length} Curated Listings.</p>
              <div className="space-y-3">
                <button onClick={() => setActiveView('recs')} className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${activeView === 'recs' ? 'bg-[#8b7355] text-white' : 'bg-white text-gray-700 border'}`}>Preview</button>
                <PDFDownloadLink document={recsDoc} fileName={`Recommendations-${filenameBase}.pdf`} className="block w-full bg-gray-900 text-white text-sm font-bold py-3 rounded-xl text-center">
                  {({ loading }) => (loading ? 'Generating...' : 'Download PDF')}
                </PDFDownloadLink>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-white p-2 rounded-[2rem] shadow-2xl border border-gray-200 overflow-hidden">
               <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-400 uppercase">Live Viewer: {activeView}</span>
               </div>
               <PDFViewer className="w-full h-[780px] border-none">{activeView === 'flyer' ? flyerDoc : recsDoc}</PDFViewer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyPage;
