'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PDFViewer, PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { X, Download, RefreshCw, Pencil, Info, Loader2, Check, Printer, Share2 } from 'lucide-react';
import { pdfPageImages, sharePdf } from '@/lib/pdfImages';
import { OhpSpinner } from '@/components/brand/OhpLoader';

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
import { OpenHouseFlyerDocument, SimilarPropertiesDocument, AgentBragSheetDocument, OpenHouseCheatSheetDocument, PaperSignInSheetDocument, fitCheatSheetLevel } from '@/lib/pdfs';

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

  // Cheat Sheet: the size that prints on exactly 2 pages (measured once per sheet, see lib/pdfs).
  const [cheatFit, setCheatFit] = useState<number | null>(null);
  useEffect(() => {
    if (type !== 'cheatSheet' || !data?.property) { setCheatFit(null); return; }
    let alive = true;
    setCheatFit(null);
    fitCheatSheetLevel({ property: data.property, agent: data.agent, amenities: data.amenities })
      .then(level => { if (alive) setCheatFit(level); })
      .catch(() => { if (alive) setCheatFit(3); });
    return () => { alive = false; };
  }, [type, data]);

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
      return <OpenHouseCheatSheetDocument property={data.property} agent={data.agent} amenities={data.amenities} fit={cheatFit ?? 0} />;
    }

    // Recommendations case: data is the array of properties
    const properties = Array.isArray(data) ? data : (data.properties || []);
    return <SimilarPropertiesDocument properties={properties} agentId={agentId} address={address} openHouseEventId={openHouseEventId || data?.openHouseEventId} showMatchScore={showMatchScore} />;
  }, [data, type, agentId, address, openHouseEventId, showMatchScore, cheatFit]);

  const fileName = useMemo(() => {
    const baseAddress = (address || data?.address || data?.property?.address || 'Document').split(',')[0].replace(/\s+/g, '-');
    return `${FILE_NAME_PREFIX[type] || 'Document'}-${baseAddress}.pdf`;
  }, [address, data?.address, type]);

  // One tap to the printer dialog (the Paper Sign-In Sheet is meant to be printed, not saved):
  // the rendered PDF goes into a hidden frame and that frame prints.
  const [printing, setPrinting] = useState(false);
  const printNow = async () => {
    if (!document || printing || (type === 'cheatSheet' && cheatFit === null)) return;
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

  // Phones (user, 10/17): the embedded PDF viewer opened zoomed-in with the buttons off screen, and
  // a downloaded PDF had no way to be saved or sent. So on a phone the preview is the real pages as
  // pictures (fit to the screen width), and the bottom bar is Print / Share / Save - Share opens the
  // phone's share sheet with the PDF attached (Mail, Messages, Save to Files, Print...).
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setIsPhone(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const [pages, setPages] = useState<string[] | null>(null);
  const [pagesFailed, setPagesFailed] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  useEffect(() => {
    if (!isOpen || !isPhone || !document) return;
    let alive = true;
    setPages(null); setPagesFailed(false); blobRef.current = null;
    const t = window.setTimeout(async () => {
      try {
        const blob = await pdf(document).toBlob();
        if (!alive) return;
        blobRef.current = blob;
        const imgs = await pdfPageImages(blob, Math.min(window.innerWidth, 560) - 24);
        if (alive) setPages(imgs);
      } catch {
        if (alive) setPagesFailed(true);
      }
    }, 150);
    return () => { alive = false; window.clearTimeout(t); };
  }, [isOpen, isPhone, document]);
  const [sharing, setSharing] = useState<'' | 'share' | 'save' | 'print'>('');
  const blobNow = async () => blobRef.current || (blobRef.current = await pdf(document!).toBlob());
  const sharePhone = async (why: 'share' | 'save' | 'print') => {
    if (!document || sharing) return;
    setSharing(why);
    try {
      const blob = await blobNow();
      const r = await sharePdf(blob, fileName, title);
      if (r === false) {
        // No file sharing here (older phone / desktop): open the PDF itself - the phone's own
        // viewer has Share and Print.
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank') || (window.location.href = url);
        window.setTimeout(() => URL.revokeObjectURL(url), 120000);
      }
    } finally {
      setSharing('');
    }
  };

  if (!isOpen) return null;

  if (isPhone) {
    const tools = (
      <>
        {type === 'flyer' && onToggleFlyerBrand && (
          <button onClick={onToggleFlyerBrand} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-widest ${toggleClass(flyerBrand)}`}>
            <ToggleMark on={flyerBrand} /> Brand
          </button>
        )}
        {type === 'flyer' && onToggleQrDarkMode && (
          <button onClick={onToggleQrDarkMode} className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${qrDarkMode ? 'bg-black text-white ring-1 ring-white/25' : 'bg-white text-gray-900'}`}>
            <ThemeSwitch dark={Boolean(qrDarkMode)} /> {qrDarkMode ? 'Dark' : 'Light'}
          </button>
        )}
        {showStatsToggle && onToggleStats && (
          <button onClick={onToggleStats} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-widest ${toggleClass(statsEnabled)}`}>
            <ToggleMark on={statsEnabled} /> Sold Stats
          </button>
        )}
        {showHighlightsToggle && onToggleHighlights && (
          <button onClick={onToggleHighlights} disabled={highlightsLoading} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-60 ${toggleClass(highlightsEnabled)}`}>
            {highlightsLoading ? <Loader2 size={13} className="animate-spin" /> : <ToggleMark on={highlightsEnabled} />} {highlightsLoading ? 'Writing...' : 'Recap'}
          </button>
        )}
        {type === 'recommendations' && (
          <button onClick={toggleMatchScore} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-widest ${toggleClass(showMatchScore)}`}>
            <ToggleMark on={showMatchScore} /> Match %
          </button>
        )}
        {onEdit && (
          <button onClick={onEdit} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-200">
            <Pencil size={13} /> Edit
          </button>
        )}
        {onRefresh && (
          <button onClick={onRefresh} disabled={isRefreshing} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-200 disabled:opacity-50">
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} /> {isRefreshing ? 'Working...' : refreshLabel}
          </button>
        )}
      </>
    );
    const hasTools = Boolean((type === 'flyer' && (onToggleFlyerBrand || onToggleQrDarkMode)) || (showStatsToggle && onToggleStats) || (showHighlightsToggle && onToggleHighlights) || type === 'recommendations' || onEdit || onRefresh);
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-[#0B0B0B] animate-fadeIn" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3 border-b border-white/10 bg-[#151517] px-4 py-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[16px] font-black text-white">{title}</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Print-ready PDF</p>
          </div>
          <button onClick={onClose} aria-label="Close preview" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-gray-200 active:scale-95">
            <X size={20} />
          </button>
        </div>
        {hasTools && (
          <div className="flex gap-2 overflow-x-auto border-b border-white/5 bg-[#151517] px-4 py-2.5 [scrollbar-width:none]">{tools}</div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain bg-[#1c1c1e] px-3 py-4">
          {!document || (!pages && !pagesFailed) ? (
            <div className="flex h-full min-h-[50vh] items-center justify-center"><OhpSpinner size={34} label="Drawing the pages" /></div>
          ) : pagesFailed ? (
            <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm font-bold text-gray-300">The preview couldn&apos;t be drawn here, but the PDF is ready.</p>
              <button onClick={() => sharePhone('share')} className="rounded-xl bg-[#C9A24D] px-4 py-2.5 text-xs font-black text-[#111827]">Open the PDF</button>
            </div>
          ) : (
            <div className="mx-auto flex max-w-[560px] flex-col gap-3">
              {pages!.map((src, i) => (
                <img key={i} src={src} alt={`Page ${i + 1}`} className="w-full rounded-lg bg-white shadow-xl ring-1 ring-white/10" />
              ))}
              {pages!.length > 1 && <p className="pb-1 text-center text-[10px] font-bold uppercase tracking-widest text-gray-500">{pages!.length} pages</p>}
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-white/10 bg-[#151517] px-3 pt-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button onClick={() => sharePhone('print')} disabled={!document || !!sharing}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-white py-2.5 text-[11px] font-black text-[#111827] active:scale-95 disabled:opacity-50">
            {sharing === 'print' ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />} Print
          </button>
          <button onClick={() => sharePhone('share')} disabled={!document || !!sharing}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-[#C9A24D] py-2.5 text-[11px] font-black text-[#111827] active:scale-95 disabled:opacity-50">
            {sharing === 'share' ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />} Share
          </button>
          <button onClick={() => sharePhone('save')} disabled={!document || !!sharing}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-white/10 py-2.5 text-[11px] font-black text-white active:scale-95 disabled:opacity-50">
            {sharing === 'save' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Save
          </button>
          <p className="col-span-3 pb-0.5 text-center text-[10px] font-semibold text-gray-500">Print, Share and Save open your phone&apos;s share menu - pick Print, Mail, Messages or Save to Files.</p>
        </div>
      </div>
    );
  }

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

            {document && (
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
                <OhpSpinner size={34} label="Generating preview" />
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-8 py-4 bg-[#1c1c1e] border-t border-white/5 flex items-center justify-center">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em]">
            Print sends it straight to your printer - Download saves the PDF
          </p>
        </div>
      </div>
    </div>
  );
}
