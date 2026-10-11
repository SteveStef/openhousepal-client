'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PDFViewer, PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { X, Download, RefreshCw, Pencil, Info, Loader2, Check, Printer } from 'lucide-react';

import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import ThemeSwitch from '@/components/ThemeSwitch';

// On/off state glyph shared by every toggle in the header: solid green check when on, small grey
// X when off (matches the Documents window's toggle rows).
const ToggleMark = ({ on }: { on: boolean }) => on ? (
  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><Check size={9} strokeWidth={4} /></span>
) : (
  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-gray-500 text-gray-500"><X size={9} strokeWidth={3.5} /></span>
);
// On = faint green tint + a crisp green underline (reads like an active tab), no glow.
const toggleClass = (on: boolean) => on
  ? 'bg-emerald-500/[0.08] text-emerald-300 shadow-[inset_0_-2px_0_0_rgba(52,211,153,0.9)] hover:bg-emerald-500/[0.14]'
  : 'bg-white/5 text-gray-400 hover:bg-white/10';
import { OpenHouseFlyerDocument, SimilarPropertiesDocument, AgentBragSheetDocument, OpenHouseCheatSheetDocument, PaperSignInSheetDocument } from '@/lib/pdfs';

const FILE_NAME_PREFIX: Record<string, string> = { paperSignIn: 'Clipboard-Sign-In', flyer: 'Flyer', recommendations: 'COMPS', bragSheet: 'Brag-Sheet', cheatSheet: 'Cheat-Sheet' };

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  title?: string;
  type?: 'flyer' | 'recommendations' | 'bragSheet' | 'cheatSheet' | 'paperSignIn';
  agentId?: string;
  address?: string;
  openHouseEventId?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  // Label for the reload button - differs per document type (e.g. "Resync Sales" for the Brag
  // Sheet, "Reload" elsewhere) so the button reads accurately for what it actually re-pulls.
  refreshLabel?: string;
  // Similar Homes only - lets the agent swap out which comps are shown without leaving the preview.
  onEdit?: () => void;
  // Brag Sheet only - shows/hides the Sold/Volume/Avg stats block for this print run.
  showStatsToggle?: boolean;
  statsEnabled?: boolean;
  onToggleStats?: () => void;
  // Similar Homes only - shows/hides the "X% Match" badge on each card. Controlled by the parent
  // (shared with the same toggle on the Documents selection screen) when provided; falls back to
  // local state so this modal still works standalone if a caller doesn't wire it up.
  showMatchScore?: boolean;
  onToggleMatchScore?: () => void;
  // Sign-In Flyer only - dark mode for the on-screen Sign-In Sheet/Kiosk guests see when they
  // scan this flyer's QR code. Does NOT affect the printed flyer itself.
  qrDarkMode?: boolean;
  onToggleQrDarkMode?: () => void;
  // Sign-In Flyer only - the "Brand" upgrade (agent photo/name/brokerage pill over the photo).
  flyerBrand?: boolean;
  onToggleFlyerBrand?: () => void;
  // Cheat Sheet only - swap the truncated MLS description paragraph for an AI-condensed bullet
  // list of top highlights (generated on first enable, then cached in the snapshot).
  showHighlightsToggle?: boolean;
  highlightsEnabled?: boolean;
  highlightsLoading?: boolean;
  onToggleHighlights?: () => void;
}

export default function PDFPreviewModal({
  isOpen,
  onClose,
  data,
  title = "Document Preview",
  type = 'flyer',
  agentId,
  address,
  openHouseEventId,
  onRefresh,
  isRefreshing = false,
  refreshLabel = 'Reload',
  onEdit,
  showStatsToggle = false,
  statsEnabled = true,
  onToggleStats,
  showMatchScore: showMatchScoreProp,
  onToggleMatchScore,
  qrDarkMode,
  onToggleQrDarkMode,
  flyerBrand = false,
  onToggleFlyerBrand,
  showHighlightsToggle = false,
  highlightsEnabled = false,
  highlightsLoading = false,
  onToggleHighlights,
}: PDFPreviewModalProps) {
  const [showMatchScoreLocal, setShowMatchScoreLocal] = useState(true);
  const showMatchScore = showMatchScoreProp ?? showMatchScoreLocal;
  // Wheel/touch over the preview must not scroll the Open Houses page behind it.
  useBodyScrollLock(isOpen);
  const toggleMatchScore = onToggleMatchScore ?? (() => setShowMatchScoreLocal(v => !v));
  // Escape closes just this preview (capture phase + stop, so the Documents window under it stays open).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  const document = useMemo(() => {
    if (!data) return null;
    
    if (type === 'flyer') {
      return <OpenHouseFlyerDocument data={data} />;
    }

    if (type === 'paperSignIn') {
      return <PaperSignInSheetDocument data={data} />;
    }

    if (type === 'bragSheet') {
      return <AgentBragSheetDocument agent={data.agent} recentSales={data.recentSales} showcaseSampleProperties={data.showcaseSampleProperties} showcaseQrUrl={data.showcaseQrUrl} showSalesStats={data.showSalesStats} stats={data.stats} />;
    }

    if (type === 'cheatSheet') {
      return <OpenHouseCheatSheetDocument property={data.property} agent={data.agent} amenities={data.amenities} />;
    }

    // Recommendations case: data is the array of properties
    const properties = Array.isArray(data) ? data : (data.properties || []);
    return <SimilarPropertiesDocument properties={properties} agentId={agentId} address={address} openHouseEventId={openHouseEventId || data?.openHouseEventId} showMatchScore={showMatchScore} />;
  }, [data, type, agentId, address, openHouseEventId, showMatchScore]);

  const fileName = useMemo(() => {
    const baseAddress = (address || data?.address || data?.property?.address || 'Document').split(',')[0].replace(/\s+/g, '-');
    return `${FILE_NAME_PREFIX[type] || 'Document'}-${baseAddress}.pdf`;
  }, [address, data?.address, type]);

  // One tap to the printer dialog (the Paper Sign-In Sheet is meant to be printed, not saved):
  // the rendered PDF goes into a hidden frame and that frame prints.
  const [printing, setPrinting] = useState(false);
  const printNow = async () => {
    if (!document || printing) return;
    setPrinting(true);
    try {
      const blob = await pdf(document).toBlob();
      const url = URL.createObjectURL(blob);
      const frame = window.document.createElement('iframe');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      frame.src = url;
      frame.onload = () => {
        setPrinting(false);
        try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { window.open(url, '_blank'); }
      };
      window.document.body.appendChild(frame);
      window.setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 120000);
    } catch {
      setPrinting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/80 animate-fadeIn">
      <div className="bg-[#151517] w-full max-w-5xl h-full max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/10 relative">
        
        {/* Header - one non-wrapping row (buttons ... divider ... close), tighter padding than
            before so a full button set (Match Score, Edit, Refresh, Download, close) reliably
            stays on one line instead of wrapping. */}
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between gap-4 bg-[#1c1c1e]">
          <div className="min-w-0 shrink-0">
            <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
            <p className="text-xs font-medium text-gray-500 mt-1 uppercase tracking-widest">
              Ready for high-resolution print
            </p>
          </div>

          <div className="flex flex-nowrap items-center justify-end gap-2">
            {type === 'flyer' && onToggleFlyerBrand && (
              <button
                onClick={onToggleFlyerBrand}
                className={`flex shrink-0 items-center gap-1.5 px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 ${
                  toggleClass(flyerBrand)
                }`}
                title="Adds your branding to the printed flyer: your photo, name, and brokerage (from your Settings profile) in a pill across the top of the photo - the same look as the top of the Sign-In Sheet guests see on screen."
              >
                <ToggleMark on={flyerBrand} />
                <span>Brand</span>
                <Info size={12} className="opacity-60" />
              </button>
            )}

            {type === 'flyer' && onToggleQrDarkMode && (
              <button
                onClick={onToggleQrDarkMode}
                className={`flex shrink-0 items-center gap-2 px-3 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 ${
                  qrDarkMode ? 'bg-black text-white ring-1 ring-white/25 hover:ring-white/40' : 'bg-white text-gray-900 hover:bg-gray-100'
                }`}
                title={`Sign-in screen theme: ${qrDarkMode ? 'DARK' : 'LIGHT'} (tap to switch). Sets the look of the on-screen Sign-In Sheet/Kiosk guests see when they scan this QR code or use the tablet. Does NOT affect the printed flyer.`}
              >
                <ThemeSwitch dark={Boolean(qrDarkMode)} />
                <span>{qrDarkMode ? 'Dark' : 'Light'}</span>
                <Info size={12} className="opacity-60" />
              </button>
            )}

            {showStatsToggle && onToggleStats && (
              <button
                onClick={onToggleStats}
                className={`flex shrink-0 items-center gap-1.5 px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 ${
                  toggleClass(statsEnabled)
                }`}
                title="Shows/hides the Sold/Volume/Avg stats block on the Brag Sheet for this print run."
              >
                <ToggleMark on={statsEnabled} />
                <span>Sold Stats</span>
                <Info size={12} className="opacity-60" />
              </button>
            )}

            {showHighlightsToggle && onToggleHighlights && (
              <button
                onClick={onToggleHighlights}
                disabled={highlightsLoading}
                className={`flex shrink-0 items-center gap-1.5 px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 disabled:opacity-60 ${
                  toggleClass(highlightsEnabled)
                }`}
                title="Swaps the full MLS description for a short 'Highlights of [address]' paragraph the AI writes from it - the home's top selling points in 2-4 tight sentences, capped to 3 printed lines."
              >
                {highlightsLoading ? <Loader2 size={15} className="animate-spin" /> : <ToggleMark on={highlightsEnabled} />}
                <span>{highlightsLoading ? 'Writing...' : 'Recap'}</span>
                <Info size={12} className="opacity-60" />
              </button>
            )}

            {type === 'recommendations' && (
              <button
                onClick={toggleMatchScore}
                className={`flex shrink-0 items-center gap-1.5 px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 ${
                  toggleClass(showMatchScore)
                }`}
                title="Shows/hides the % Match badge on each card, and sorts by best match first when on."
              >
                <ToggleMark on={showMatchScore} />
                <span>Match %</span>
                <Info size={12} className="opacity-60" />
              </button>
            )}

            {onEdit && (
              <button
                onClick={onEdit}
                className="flex shrink-0 items-center gap-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300"
                title="Pick different similar listings to show"
              >
                <Pencil size={15} />
                <span>Edit</span>
              </button>
            )}

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex shrink-0 items-center gap-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 disabled:opacity-50"
                title="Refresh this document's data"
              >
                <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
                <span>{isRefreshing ? 'Working...' : refreshLabel}</span>
              </button>
            )}

            {document && type === 'paperSignIn' && (
              <button
                onClick={printNow}
                disabled={printing}
                className="flex shrink-0 items-center gap-1.5 px-5 py-2.5 bg-white hover:bg-gray-100 text-[#111827] rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 disabled:opacity-60"
                title="Print this sheet"
              >
                {printing ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                <span>{printing ? 'Preparing...' : 'Print'}</span>
              </button>
            )}

            {document && (
              <PDFDownloadLink
                document={document}
                fileName={fileName}
                className="flex shrink-0 items-center gap-1.5 px-4 py-2.5 bg-[#C9A24D] hover:bg-[#8b7355] text-[#111827] hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 shadow-lg shadow-[#C9A24D]/10"
              >
                {({ loading }) => (
                  <>
                    <Download size={15} className={loading ? 'animate-bounce' : ''} />
                    <span>{loading ? 'Preparing...' : 'Download'}</span>
                  </>
                )}
              </PDFDownloadLink>
            )}

            <div className="w-px h-8 bg-white/10 mx-1 shrink-0" />

            <button
              onClick={onClose}
              className="flex shrink-0 items-center p-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-2xl transition-all duration-200 group"
              title="Close Preview"
            >
              <X size={19} className="group-hover:rotate-90 transition-transform duration-300" />
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
