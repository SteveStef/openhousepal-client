'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Footer from '@/components/Footer'
import { hasMlsAccess } from '@/lib/navAccess'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { ViewPDFsModal } from '@/components/ViewPDFsModal'
import { EditSimilarPropertiesModal } from '@/components/EditSimilarPropertiesModal'
import { EditCheatSheetPhotosModal } from '@/components/EditCheatSheetPhotosModal'
import PDFPreviewModal from '@/components/PDFPreviewModal'
import { CHEAT_SHEET_NEARBY_VERSION, GuestSettingsPatch, OpenHouse, StatSummary } from '@/types'
import { buildBragSheetData, buildCheatSheetAgentData } from '@/lib/bragSheetData'
import { cheatSheetSqft } from '@/lib/cheatSheetContent'
import MissedShowcasesBanner from '@/components/MissedShowcasesBanner'
import { computeMatchScore } from '@/lib/matchScore'
import { readPrintPref, writePrintPref } from '@/lib/printPrefs'

// Components
import { OpenHouseHistory } from './components/OpenHouseHistory'
import { KioskModal } from './components/KioskModal'
import { CreateOpenHouseWizard } from './components/CreateOpenHouseWizard'
import ConfirmedToHostStrip from '@/components/open-house-manager/ConfirmedToHostStrip'
import { OpenHouseFormRequestsPanel } from '@/components/OpenHouseFormRequestsPanel'
import { DeleteConfirmationDialog } from './components/DeleteConfirmationDialog'
import { OpenHouseNoteModal } from './components/OpenHouseNoteModal'
import OpenHouseVisitors from './components/OpenHouseVisitors'
import { AnimatePresence } from 'framer-motion'
import OhpLoader from '@/components/brand/OhpLoader'
import OhSheet from '@/components/open-house-manager/OhSheet'
import { useIsPhone, useLastValue } from '@/components/ui/windowMotion'
import ShowcasesOffSheet from './components/ShowcasesOffSheet'
import { similarHomesOn } from '@/lib/similarHomes'

// --- HELPERS ---
const formatAddress = (address: string) => {
  if (!address) return "";
  const parts = address.split(',');

  if (parts.length > 2) {
    const street = parts[0].trim();
    const city = parts[1].trim();
    const stateZip = parts[2].trim();
    const zipMatch = stateZip.match(/^([A-Z]{2}\s+\d{5})/);
    const cleanedStateZip = zipMatch ? zipMatch[1] : stateZip;

    const rawAddress = `${street}, ${city}, ${cleanedStateZip}`;
    return rawAddress
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  const rawAddress = parts.length > 1
    ? `${parts[0].trim()}, ${parts[1].trim()}`
    : parts[0].trim();

  return rawAddress
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// The Brag Sheet's "What a Showcase looks like" example uses this open house's Similar Homes -
// none when its Similar Homes switch is off.
const bragSimilar = (oh: any) => (oh && oh.similarHomes !== false ? oh.similarPropertiesSnapshot : []) || []

const formatStreetAndCity = (address: string, city?: string) => {
  if (!address) return "";
  const parts = address.split(',');
  const street = parts[0].trim();
  const targetCity = city || (parts.length >= 2 ? parts[1].trim() : "");

  if (targetCity) {
    if (street.toLowerCase().includes(targetCity.toLowerCase())) {
      return street
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    const rawAddress = `${street}, ${targetCity}`;
    return rawAddress
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return street.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function OpenHousesPage() {
  return (
    <AuthGuard>
      <BrokerAuthorizationGuard>
        <SubscriptionGuard>
          <OpenHouseContent />
        </SubscriptionGuard>
      </BrokerAuthorizationGuard>
    </AuthGuard>
  )
}

function OpenHouseContent() {
  const router = useRouter()
  const { user: currentUser, isAuthenticated, isLoading: isAuthenticating } = useAuth()
  const { showToast } = useToast()

  // Dashboard State
  const [openHouses, setOpenHouses] = useState<OpenHouse[]>([])
  // "Build kit" on an open you're confirmed to host -> fills the kit address box.
  const [kitPrefill, setKitPrefill] = useState<{ address: string; nonce: number } | null>(null)
  const buildKitFor = useCallback((address: string) => setKitPrefill({ address, nonce: Date.now() }), [])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [statSummary, setStatSummary] = useState<StatSummary | null>(null)
  const isPrintingRef = useRef(false)

  // Dialogs
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [openHouseToDelete, setOpenHouseToDelete] = useState<OpenHouse | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isOpenHouseNoteModalOpen, setIsOpenHouseNoteModalOpen] = useState(false)
  const [selectedOpenHouseForNote, setSelectedOpenHouseForNote] = useState<OpenHouse | null>(null)
  const [currentOpenHouseNote, setCurrentOpenHouseNote] = useState('')

  // View PDFs Modal State
  const [isViewPDFsModalOpen, setIsViewPDFsModalOpen] = useState(false)
  const [openHouseForPDFs, setOpenHouseForPDFs] = useState<OpenHouse | null>(null)

  // Kiosk Modal State - in-screen popup (like clicking into a property) instead of navigating
  // away or opening a separate browser window/tab.
  const [kioskOpenHouse, setKioskOpenHouse] = useState<OpenHouse | null>(null)
  const kioskShown = useLastValue(kioskOpenHouse)
  const isPhone = useIsPhone()
  // Guests' disclosure / second-tour requests not handled yet - that section moves to the top.
  const [requestsWaiting, setRequestsWaiting] = useState(0)

  // Edit Similar Properties Modal State
  const [isEditSimilarModalOpen, setIsEditSimilarModalOpen] = useState(false)
  const [openHouseToEditSimilar, setOpenHouseToEditSimilar] = useState<OpenHouse | null>(null)
  const [isEditCheatSheetModalOpen, setIsEditCheatSheetModalOpen] = useState(false)
  const [openHouseToEditCheatSheet, setOpenHouseToEditCheatSheet] = useState<OpenHouse | null>(null)

  // PDF Preview State
  const [isPDFPreviewOpen, setIsPDFPreviewOpen] = useState(false)
  const [pdfPreviewData, setPdfPreviewData] = useState<any>(null)
  const [pdfPreviewType, setPdfPreviewType] = useState<'flyer' | 'recommendations' | 'bragSheet' | 'cheatSheet' | 'paperSignIn'>('flyer')
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState('')
  const [pdfPreviewAddress, setPdfPreviewAddress] = useState('')
  const [pdfPreviewAgentId, setPdfPreviewAgentId] = useState('')
  const [pdfPreviewOpenHouseEventId, setPdfPreviewOpenHouseEventId] = useState('')
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isRefreshingBragSheet, setIsRefreshingBragSheet] = useState(false)
  const [isReloadingCheatSheetPrice, setIsReloadingCheatSheetPrice] = useState(false)
  const [isReloadingFlyerPrice, setIsReloadingFlyerPrice] = useState(false)
  const [isRefreshingRecommendations, setIsRefreshingRecommendations] = useState(false)
  // Local override for the Brag Sheet's Sold/Volume/Avg stats block, set via the "Documents"
  // window - doesn't touch the agent's actual Agent Hub "Show stats" setting.
  // Remembered per device, shared with the create wizard's Review step (lib/printPrefs).
  const [bragSheetStatsEnabled, setBragSheetStatsEnabledRaw] = useState(true)
  useEffect(() => { setBragSheetStatsEnabledRaw(readPrintPref('bragStats')) }, [])
  const setBragSheetStatsEnabled = (next: boolean | ((cur: boolean) => boolean)) => setBragSheetStatsEnabledRaw(cur => {
    const v = typeof next === 'function' ? next(cur) : next
    writePrintPref('bragStats', v)
    return v
  })
  // Print choices below are remembered per device (lib/printPrefs) - last choice wins, so the
  // next open house's kit is already set the way the agent likes it.
  // Similar Homes only - shared between the Documents selection screen and the full preview so
  // toggling it in either place stays in sync.
  const [showMatchScoreOnRecs, setShowMatchScoreOnRecs] = useState(true)
  // Cheat Sheet "Recap" - the AI "Highlights of ..." paragraph in place of the MLS description.
  // A preference (default on): whenever a Cheat Sheet opens it's applied to that sheet, generating
  // the paragraph once and caching it on the snapshot.
  const [cheatSheetHighlightsOn, setCheatSheetHighlightsOn] = useState(true)
  // Sign-In flyer "Brand" upgrade - the hosting-agent pill (photo, name, brokerage) over the
  // flyer's photo. Default on.
  const [flyerBrandOn, setFlyerBrandOn] = useState(true)
  useEffect(() => {
    setFlyerBrandOn(readPrintPref('flyerBrand'))
    setShowMatchScoreOnRecs(readPrintPref('matchScore'))
    setCheatSheetHighlightsOn(readPrintPref('recap'))
  }, [])
  const handleToggleMatchScore = useCallback(() => {
    setShowMatchScoreOnRecs(current => { writePrintPref('matchScore', !current); return !current })
  }, [])
  const [cheatSheetHighlightsLoading, setCheatSheetHighlightsLoading] = useState(false)
  const cheatSheetPreviewCacheRef = useRef<Record<string, any>>({})

  // Visitors open in a pop-up over Opens (same view as the full page) so the agent keeps their place.
  const [visitorsFor, setVisitorsFor] = useState<string | null>(null)
  const handleViewVisitors = useCallback((openHouse: any) => {
    setVisitorsFor(openHouse.id)
  }, [])
  // Closing the Visitors pop-up: once it has finished animating away, quietly refresh just that
  // open house's guest count (notes/deletes may have changed it) - no list reload, no spinner.
  const closedVisitorsFor = useRef<string | null>(null)
  // Kept while the sheet slides away (the id clears the moment it's told to close).
  const visitorsSheetId = useLastValue(visitorsFor)
  const visitorsSheetOh = openHouses.find(oh => oh.id === visitorsSheetId) || null
  const closeVisitors = useCallback(() => {
    closedVisitorsFor.current = visitorsFor
    setVisitorsFor(null)
    // Once the sheet has slid away, quietly refresh that open house's guest count.
    window.setTimeout(() => { refreshClosedVisitorCountRef.current?.() }, 420)
  }, [visitorsFor])
  const refreshClosedVisitorCountRef = useRef<(() => void) | null>(null)
  const refreshClosedVisitorCount = useCallback(async () => {
    const id = closedVisitorsFor.current
    closedVisitorsFor.current = null
    if (!id) return
    const response = await api.openHouses.getVisitors(id)
    if (response.success && response.data) {
      const count = response.data.length
      setOpenHouses(prev => prev.map(oh => (oh.id === id ? { ...oh, visitorCount: count } : oh)))
    }
  }, [])
  refreshClosedVisitorCountRef.current = refreshClosedVisitorCount

  // A Cheat Sheet saved under older nearby-places rules gets its "What's Nearby" section looked up
  // again - only here, when the agent opens that open house's Kit (user, 10/25: never a platform-wide
  // refresh; the paid Google lookup only for a Kit someone is actually using). The rest of the saved
  // sheet stays as it is; the Guest Pass reads the same snapshot, so it picks up the new section too.
  const nearbyRefreshTriedRef = useRef<Set<string>>(new Set())
  const refreshStaleCheatSheetNearby = useCallback(async (openHouse: OpenHouse) => {
    const snap: any = (openHouse as any).cheatSheetSnapshot
    if (!snap?.property || !openHouse.listingKey || nearbyRefreshTriedRef.current.has(openHouse.id)) return
    if ((snap.amenities?.schema_version ?? 0) >= CHEAT_SHEET_NEARBY_VERSION) return
    nearbyRefreshTriedRef.current.add(openHouse.id)
    const res = await api.properties.getNearbyAmenities(openHouse.listingKey)
    if (!res.success || !res.data?.available || !res.data.schema_version) return
    const next = { ...snap, amenities: res.data }
    api.openHouses.updateCheatSheetSnapshot(openHouse.id, next)
    setOpenHouses(prev => prev.map(oh => oh.id === openHouse.id ? { ...oh, cheatSheetSnapshot: next } as any : oh))
    setOpenHouseForPDFs(prev => prev && prev.id === openHouse.id ? { ...prev, cheatSheetSnapshot: next } as any : prev)
  }, [])

  const handleOpenViewPDFs = useCallback((openHouse: OpenHouse) => {
    setOpenHouseForPDFs(openHouse)
    setIsViewPDFsModalOpen(true)
    refreshStaleCheatSheetNearby(openHouse)
  }, [refreshStaleCheatSheetNearby])

  const handleCloseViewPDFs = useCallback(() => {
    setIsViewPDFsModalOpen(false)
    setOpenHouseForPDFs(null)
  }, [])

  const handleOpenKiosk = useCallback((openHouse: OpenHouse) => {
    setKioskOpenHouse(openHouse)
  }, [])

  const handleCloseKiosk = useCallback(() => {
    setKioskOpenHouse(null)
  }, [])

  const handleToggleQrDarkMode = useCallback(() => {
    if (!openHouseForPDFs) return
    const next = !openHouseForPDFs.qrDarkMode
    // Also the default the create wizard offers for the next open house.
    writePrintPref('qrDark', next)
    setOpenHouseForPDFs(current => current ? { ...current, qrDarkMode: next } : current)
    setOpenHouses(current => current.map(oh => oh.id === openHouseForPDFs.id ? { ...oh, qrDarkMode: next } : oh))
    api.openHouses.updateQrDarkMode(openHouseForPDFs.id, next).then(({ success }) => {
      if (!success) {
        // Roll back on failure - this is a real persisted setting, not a local-only preview toggle.
        setOpenHouseForPDFs(current => current ? { ...current, qrDarkMode: !next } : current)
        setOpenHouses(current => current.map(oh => oh.id === openHouseForPDFs.id ? { ...oh, qrDarkMode: !next } : oh))
        showToast('Unable to update QR Dark Mode right now.', 'error')
      }
    })
  }, [openHouseForPDFs])

  const handleGuestSettings = useCallback((openHouse: OpenHouse, patch: GuestSettingsPatch) => {
    const undo: GuestSettingsPatch = { autoShowcase: openHouse.autoShowcase, similarHomes: openHouse.similarHomes, afterSignin: openHouse.afterSignin ?? undefined, guestPass: openHouse.guestPass, passSignature: openHouse.passSignature, passShowcase: openHouse.passShowcase }
    const merge = (oh: OpenHouse, vals: GuestSettingsPatch) => {
      const next = { ...oh }
      if (vals.autoShowcase !== undefined) next.autoShowcase = vals.autoShowcase
      if (vals.similarHomes !== undefined) next.similarHomes = vals.similarHomes
      if (vals.afterSignin !== undefined) next.afterSignin = vals.afterSignin
      if (vals.guestPass !== undefined) next.guestPass = vals.guestPass
      if (vals.passSignature !== undefined) next.passSignature = vals.passSignature
      if (vals.passShowcase !== undefined) next.passShowcase = vals.passShowcase
      return next
    }
    // The card list and the open Documents window both show these switches - keep them in step.
    const apply = (vals: GuestSettingsPatch) => {
      setOpenHouses(current => current.map(oh => oh.id === openHouse.id ? merge(oh, vals) : oh))
      setOpenHouseForPDFs(current => current && current.id === openHouse.id ? merge(current, vals) : current)
    }
    apply(patch)
    api.openHouses.updateGuestSettings(openHouse.id, {
      ...(patch.autoShowcase !== undefined ? { auto_showcase: patch.autoShowcase } : {}),
      ...(patch.similarHomes !== undefined ? { similar_homes: patch.similarHomes } : {}),
      ...(patch.afterSignin !== undefined ? { after_signin: patch.afterSignin } : {}),
      ...(patch.guestPass !== undefined ? { guest_pass: patch.guestPass } : {}),
      ...(patch.passSignature !== undefined ? { pass_signature: patch.passSignature } : {}),
      ...(patch.passShowcase !== undefined ? { pass_showcase: patch.passShowcase } : {}),
    }).then(({ success }) => {
      if (!success) {
        apply(undo)
        showToast('Unable to update this open house right now.', 'error')
      }
    })
  }, [])

  // Switching Showcases OFF asks first what guests without an agent still get on their Guest Pass
  // (Similar homes / a build-on-tap Showcase) - user, 10/24. Everything else saves right away.
  const [showcasesOffFor, setShowcasesOffFor] = useState<OpenHouse | null>(null)
  const requestGuestSettings = useCallback((openHouse: OpenHouse, patch: GuestSettingsPatch) => {
    if (patch.autoShowcase === false && openHouse.autoShowcase !== false && Object.keys(patch).length === 1) {
      setShowcasesOffFor(openHouse)
      return
    }
    handleGuestSettings(openHouse, patch)
  }, [handleGuestSettings])

  // Opened from the Documents window -> back to it when the picker closes. turnOn = Include was
  // tapped: saving picked homes switches Similar Homes on, backing out leaves it off.
  const editSimilarFrom = useRef<{ docs: boolean; turnOn: boolean }>({ docs: false, turnOn: false })
  const handleOpenEditSimilar = useCallback((openHouse: OpenHouse, turnOn = false) => {
    editSimilarFrom.current = { docs: isViewPDFsModalOpen, turnOn }
    setOpenHouseToEditSimilar(openHouse)
    setIsEditSimilarModalOpen(true)
    setIsViewPDFsModalOpen(false)
  }, [isViewPDFsModalOpen])

  const handleSimilarSaved = useCallback((openHouse: OpenHouse, snapshot: any[]) => {
    setOpenHouses(current => current.map(oh => oh.id === openHouse.id ? { ...oh, similarPropertiesSnapshot: snapshot } : oh))
    setOpenHouseForPDFs(current => current && current.id === openHouse.id ? { ...current, similarPropertiesSnapshot: snapshot } : current)
    if (editSimilarFrom.current.turnOn && snapshot.length && openHouse.similarHomes === false) handleGuestSettings(openHouse, { similarHomes: true })
  }, [handleGuestSettings])

  const handleCloseEditSimilar = useCallback(() => {
    setIsEditSimilarModalOpen(false)
    if (editSimilarFrom.current.docs) setIsViewPDFsModalOpen(true)
    editSimilarFrom.current = { docs: false, turnOn: false }
  }, [])

  const handleOpenEditCheatSheet = useCallback((openHouse: OpenHouse) => {
    setOpenHouseToEditCheatSheet(openHouse)
    setIsEditCheatSheetModalOpen(true)
    setIsViewPDFsModalOpen(false)
  }, [])

  // Re-checks each property in the saved "Similar Homes" snapshot against our MLS mirror: updates
  // its price if it's changed, and drops it entirely if it's sold/withdrawn/no longer active -
  // so a snapshot saved days before the open house doesn't quietly go stale.
  const handleRefreshRecommendations = useCallback(async () => {
    if (!openHouseForPDFs) return
    setIsRefreshingRecommendations(true)
    const { success, data, error } = await api.openHouses.refreshSnapshot(openHouseForPDFs.id)
    if (!success || !data) {
      showToast(error || 'Unable to refresh similar homes right now.', 'error')
      setIsRefreshingRecommendations(false)
      return
    }
    setOpenHouses(prev => prev.map(oh => oh.id === openHouseForPDFs.id ? { ...oh, similarPropertiesSnapshot: data.similarPropertiesSnapshot } as any : oh))
    setOpenHouseForPDFs(prev => prev && prev.id === openHouseForPDFs.id ? { ...prev, similarPropertiesSnapshot: data.similarPropertiesSnapshot } as any : prev)
    // Also push the refreshed data into the PDF preview itself, if the Similar Homes sheet is the
    // one currently open - without this, clicking "Refresh Listings" from inside the full-screen
    // PDF preview updated the underlying snapshot but the preview kept showing the stale one until
    // closed and reopened, since <PDFViewer> doesn't reliably repaint on a children/data change
    // alone. previewId forces it to actually remount - same pattern already used for the Brag
    // Sheet/Cheat Sheet refresh buttons below.
    setPdfPreviewData((prev: any) => {
      if (pdfPreviewType !== 'recommendations' || !prev) return prev
      const subject = (openHouseForPDFs as any).property_data || openHouseForPDFs
      const scoreSet = data.similarPropertiesSnapshot || []
      const snapshotWithScores = scoreSet.map((p: any) => ({ ...p, matchScore: computeMatchScore(p, subject, scoreSet) }))
      return { ...prev, properties: snapshotWithScores, previewId: Date.now() }
    })
    const parts: string[] = []
    if (data.updatedCount > 0) parts.push(`${data.updatedCount} price${data.updatedCount === 1 ? '' : 's'} updated`)
    if (data.removedCount > 0) parts.push(`${data.removedCount} sold listing${data.removedCount === 1 ? '' : 's'} removed`)
    showToast(parts.length > 0 ? parts.join(', ') + '.' : 'Similar homes are already up to date.', 'success')
    setIsRefreshingRecommendations(false)
  }, [openHouseForPDFs, showToast, pdfPreviewType])

  const triggerPreview = useCallback(async (mode: 'flyer' | 'recommendations' | 'bragSheet' | 'cheatSheet' | 'paperSignIn', id?: string, customData?: any) => {
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;
    setIsGeneratingPDF(true);
    // Pick up choices made elsewhere since mount (e.g. the create wizard's Review step).
    setShowMatchScoreOnRecs(readPrintPref('matchScore'));
    setCheatSheetHighlightsOn(readPrintPref('recap'));
    setFlyerBrandOn(readPrintPref('flyerBrand'));

    // If customData is provided (from the Wizard), use it directly
    if (customData) {
      setPdfPreviewData(customData);
      setPdfPreviewType(mode);
      setPdfPreviewTitle(mode === 'flyer' ? "Sign-In Flyer" : mode === 'bragSheet' ? "Agent Brag Sheet" : mode === 'cheatSheet' ? "Open House Cheat Sheet" : "Similar Properties");

      if (mode === 'recommendations') {
        setPdfPreviewAddress(customData.address || '');
        setPdfPreviewAgentId(currentUser?.id || '');
        setPdfPreviewOpenHouseEventId(customData.openHouseEventId || '');
      }

      setIsPDFPreviewOpen(true);
      setIsGeneratingPDF(false);
      isPrintingRef.current = false;
      return;
    }

    if (mode === 'bragSheet') {
      const targetOHForBragSheet = id ? openHouses.find(oh => oh.id === id) : null;
      const { data, error } = await buildBragSheetData(currentUser, bragSimilar(targetOHForBragSheet), { showcases: targetOHForBragSheet?.autoShowcase !== false });
      if (!data) {
        showToast(error || 'Unable to build your Brag Sheet right now.', 'error');
        setIsGeneratingPDF(false);
        isPrintingRef.current = false;
        return;
      }
      setPdfPreviewData({ ...data, showSalesStats: bragSheetStatsEnabled });
      setPdfPreviewTitle("Agent Brag Sheet");
      setPdfPreviewType('bragSheet');
      setIsPDFPreviewOpen(true);
      setIsGeneratingPDF(false);
      isPrintingRef.current = false;
      return;
    }

    const targetOH = id ? openHouses.find(oh => oh.id === id) : null;

    if (mode === 'cheatSheet') {
      // The Cheat Sheet is MLS-built - a manually entered open house (No-MLS plans) never has one.
      if (!targetOH?.listingKey) {
        showToast("This listing isn't linked to an MLS record, so a Cheat Sheet can't be generated.", 'error');
        setIsGeneratingPDF(false);
        isPrintingRef.current = false;
        return;
      }
      // Agent contact info (name/phone/email/photo/Agent Hub QR) is account-level, not
      // open-house-specific - it must never be served stale from a frozen snapshot, or the QR
      // could point at an Agent Hub URL the agent has since changed. Only the property/photos/
      // amenities portion of the snapshot is safe to reuse as-is.
      if (targetOH.cheatSheetSnapshot) {
        const freshAgent = await buildCheatSheetAgentData(currentUser);
        // Also backfills openHouseEventId onto the property for snapshots saved before the
        // disclosure/second-visit QR codes were scoped to the open house event.
        const mergedData = {
          ...targetOH.cheatSheetSnapshot,
          agent: freshAgent,
          property: { ...targetOH.cheatSheetSnapshot.property, openHouseEventId: targetOH.id },
        };
        setPdfPreviewData(mergedData);
        setPdfPreviewTitle("Open House Cheat Sheet");
        setPdfPreviewType('cheatSheet');
        setIsPDFPreviewOpen(true);
        setIsGeneratingPDF(false);
        isPrintingRef.current = false;
        return;
      }
      const cheatSheetCacheKey = [
        targetOH.id,
        targetOH.listingKey,
        JSON.stringify(targetOH.cheatSheetPhotos || []),
        currentUser?.id || '',
      ].join(':');
      const cachedCheatSheet = cheatSheetPreviewCacheRef.current[cheatSheetCacheKey];
      if (cachedCheatSheet) {
        const freshAgent = await buildCheatSheetAgentData(currentUser);
        const mergedData = {
          ...cachedCheatSheet,
          agent: freshAgent,
          property: { ...cachedCheatSheet.property, openHouseEventId: targetOH.id },
        };
        setPdfPreviewData(mergedData);
        setPdfPreviewTitle("Open House Cheat Sheet");
        setPdfPreviewType('cheatSheet');
        setIsPDFPreviewOpen(true);
        setIsGeneratingPDF(false);
        isPrintingRef.current = false;
        return;
      }
      const listingKey = targetOH.listingKey as string; // guarded non-empty above
      const [propertyRes, amenitiesRes, cheatSheetAgent] = await Promise.all([
        api.properties.lookup({ listingKey }),
        api.properties.getNearbyAmenities(listingKey),
        buildCheatSheetAgentData(currentUser),
      ]);
      if (!propertyRes.success || !propertyRes.data) {
        showToast(propertyRes.error || 'Unable to load this listing right now.', 'error');
        setIsGeneratingPDF(false);
        isPrintingRef.current = false;
        return;
      }
      const p = propertyRes.data;
      const previewData = {
        property: {
          id: p.id || targetOH.listingKey,
          openHouseEventId: targetOH.id,
          listingKey: p.listingKey || p.ListingKey || targetOH.listingKey,
          address: p.street_address || p.FullStreetAddress || targetOH.address,
          city: p.city || p.City,
          state: p.state || p.StateOrProvince,
          latitude: p.latitude || p.Latitude || (targetOH as any).lat,
          longitude: p.longitude || p.Longitude || (targetOH as any).lng,
          googleRooftopLatitude: p.google_rooftop_latitude || p.googleRooftopLatitude,
          googleRooftopLongitude: p.google_rooftop_longitude || p.googleRooftopLongitude,
          googleGeocodeLocationType: p.google_geocode_location_type || p.googleGeocodeLocationType,
          price: p.price || p.ListPrice,
          originalListPrice: p.original_list_price || p.OriginalListPrice,
          previousListPrice: p.PreviousListPrice || p.raw_mls_data?.PreviousListPrice,
          priceChangeTimestamp: p.price_change_timestamp || p.PriceChangeTimestamp,
          majorChangeTimestamp: p.MajorChangeTimestamp || p.raw_mls_data?.MajorChangeTimestamp,
          majorChangeType: p.MajorChangeType || p.raw_mls_data?.MajorChangeType,
          beds: p.bedrooms || p.BedroomsTotal,
          baths: p.bathrooms || p.BathroomsTotal,
          sqft: p.living_area || p.LivingArea,
          aboveGradeSqft: p.above_grade_finished_area || p.AboveGradeFinishedArea,
          belowGradeSqft: p.below_grade_finished_area || p.BelowGradeFinishedArea,
          acres: p.lot_size_acres || p.LotSizeAcres || (
            (p.lot_size || p.LotSizeSquareFeet) ? Math.round(((p.lot_size || p.LotSizeSquareFeet) / 43560) * 100) / 100 : undefined
          ),
          township: p.township || p.MLSAreaMajor,
          schoolDistrict: p.school_district_name || p.SchoolDistrictName,
          elementarySchool: p.elementary_school || p.ElementarySchool,
          middleSchool: p.middle_or_junior_school || p.MiddleOrJuniorSchool,
          highSchool: p.high_school || p.HighSchool,
          taxAnnualAmount: p.tax_annual_amount || p.TaxAnnualAmount,
          taxYear: p.tax_year || p.TaxYear,
          yearBuilt: p.year_built || p.YearBuilt,
          waterSource: p.water_source || p.WaterSource,
          sewer: p.sewer || p.Sewer,
          heating: p.heating || p.Heating,
          heatingFuel: p.heating_fuel || p.HeatingFuel,
          cooling: p.cooling || p.Cooling,
          hoaFee: p.association_fee || p.AssociationFee,
          hoaFeeFrequency: p.association_fee_frequency || p.AssociationFeeFrequency,
          hoaIncludes: p.association_fee_includes || p.AssociationFeeIncludes,
          description: p.description || p.PublicRemarks,
          photos: (targetOH.cheatSheetPhotos && targetOH.cheatSheetPhotos.length > 0) ? targetOH.cheatSheetPhotos : (p.photos || []).slice(0, 3),
        },
        agent: cheatSheetAgent,
        amenities: amenitiesRes.success ? amenitiesRes.data : undefined,
      };
      cheatSheetPreviewCacheRef.current[cheatSheetCacheKey] = previewData;
      const snapshotRes = await api.openHouses.updateCheatSheetSnapshot(targetOH.id, previewData);
      if (snapshotRes.success) {
        setOpenHouses(prev => prev.map(openHouse => (
          openHouse.id === targetOH.id ? { ...openHouse, cheatSheetSnapshot: previewData } : openHouse
        )));
        setOpenHouseForPDFs(prev => prev && prev.id === targetOH.id ? { ...prev, cheatSheetSnapshot: previewData } : prev);
      }
      setPdfPreviewData(previewData);
      setPdfPreviewTitle("Open House Cheat Sheet");
      setPdfPreviewType('cheatSheet');
      setIsPDFPreviewOpen(true);
      setIsGeneratingPDF(false);
      isPrintingRef.current = false;
      return;
    }

    if (targetOH && mode === 'paperSignIn') {
      // The pencil sign-in sheet: this home's photo/address/facts + the hosting agent (always -
      // the footer is who guests are signing in with), and the same QR as the flyer.
      setPdfPreviewData({
        address: formatStreetAndCity(targetOH.address, targetOH.city),
        state: (targetOH as any).state || (targetOH as any).StateOrProvince || '',
        price: targetOH.ListPrice || targetOH.price || 0,
        beds: targetOH.BedroomsTotal || targetOH.bedrooms || 0,
        baths: targetOH.BathroomsTotal || targetOH.bathrooms || 0,
        sqft: targetOH.LivingArea || targetOH.livingArea || cheatSheetSqft((targetOH as any).cheatSheetSnapshot?.property) || 0,
        brand: await buildCheatSheetAgentData(currentUser),
        coverImage: targetOH.coverImageUrl,
        coverImagePosition: (targetOH as any).coverImagePosition || { x: 50, y: 50 },
        openHouseUrl: targetOH.formUrl,
      });
      setPdfPreviewTitle("Clipboard Sign-In");
      setPdfPreviewType('paperSignIn');
      setIsPDFPreviewOpen(true);
      setIsGeneratingPDF(false);
      isPrintingRef.current = false;
      return;
    }

    if (targetOH) {
       if (mode === 'flyer') {
          // School district for the flyer's bar under the stat tiles: the saved Cheat Sheet
          // snapshot already has it when it exists; otherwise one MLS lookup fills it in.
          const snapProp = (targetOH as any).cheatSheetSnapshot?.property || {}
          let schoolDistrict: string | undefined = snapProp.schoolDistrict || undefined
          if (!schoolDistrict && targetOH.listingKey) {
            const lookup = await api.properties.lookup({ listingKey: targetOH.listingKey })
            if (lookup.success && lookup.data) {
              const lp: any = lookup.data
              schoolDistrict = lp.school_district_name || lp.SchoolDistrictName || undefined
            }
          }
          const flyerData = {
            address: formatStreetAndCity(targetOH.address, targetOH.city),
            state: (targetOH as any).state || (targetOH as any).StateOrProvince || '',
            price: targetOH.ListPrice || targetOH.price || 0,
            beds: targetOH.BedroomsTotal || targetOH.bedrooms || 0,
            baths: targetOH.BathroomsTotal || targetOH.bathrooms || 0,
            sqft: targetOH.LivingArea || targetOH.livingArea || cheatSheetSqft((targetOH as any).cheatSheetSnapshot?.property) || 0,
            schoolDistrict,
            // Always fetched fresh (name/photo/brokerage can change in Settings any time).
            brand: readPrintPref('flyerBrand') ? await buildCheatSheetAgentData(currentUser) : null,
            coverImage: targetOH.coverImageUrl,
            coverImagePosition: (targetOH as any).coverImagePosition || { x: 50, y: 50 },
            openHouseUrl: targetOH.formUrl
          };
          setPdfPreviewData(flyerData);
          setPdfPreviewTitle("Sign-In Flyer");
       } else {
          const subject = (targetOH as any).property_data || targetOH;
          const scoreSet = (targetOH as any).similarPropertiesSnapshot || [];
          const snapshotWithScores = scoreSet.map((p: any) => ({ ...p, matchScore: computeMatchScore(p, subject, scoreSet) }));
          // Wrapped in an object (not a bare array) so handleRefreshRecommendations can update
          // this same shape in place later, with a fresh previewId - see that handler's comment.
          setPdfPreviewData({ properties: snapshotWithScores });
          setPdfPreviewTitle("Similar Properties");
          setPdfPreviewAddress(formatStreetAndCity(targetOH.address, targetOH.city));
          setPdfPreviewAgentId(currentUser?.id || '');
          setPdfPreviewOpenHouseEventId(targetOH.id);
       }

       setPdfPreviewType(mode);
       setIsPDFPreviewOpen(true);
       setIsGeneratingPDF(false);
       isPrintingRef.current = false;
    } else {
      // If no ID is passed, this is coming from the Wizard (handled internally by Wizard now,
      // but keeping compatibility for now if needed, though Wizard has its own triggerPreview)
      setIsGeneratingPDF(false);
      isPrintingRef.current = false;
    }
  }, [openHouses, currentUser, showToast, bragSheetStatsEnabled, flyerBrandOn])

  const handleToggleFlyerBrand = useCallback(async () => {
    const next = !flyerBrandOn
    setFlyerBrandOn(next)
    writePrintPref('flyerBrand', next)
    // Flyer preview already open - swap the pill in/out live.
    if (isPDFPreviewOpen && pdfPreviewType === 'flyer') {
      const brand = next ? await buildCheatSheetAgentData(currentUser) : null
      setPdfPreviewData((prev: any) => prev ? { ...prev, brand, previewId: Date.now() } : prev)
    }
  }, [flyerBrandOn, isPDFPreviewOpen, pdfPreviewType, currentUser])

  const handleRefreshBragSheet = useCallback(async (options?: { silent?: boolean }) => {
    setIsRefreshingBragSheet(true);
    const { data, error } = await buildBragSheetData(currentUser, bragSimilar(openHouseForPDFs), { showcases: openHouseForPDFs?.autoShowcase !== false });
    if (!data) {
      showToast(error || 'Unable to resync your Brag Sheet right now.', 'error');
      setIsRefreshingBragSheet(false);
      return;
    }
    // previewId forces PDFPreviewModal's <PDFViewer> to remount - without a changing key it keeps
    // showing the already-rendered PDF even after this data update (react-pdf doesn't reliably
    // re-render an already-open PDFViewer from a children/prop change alone).
    setPdfPreviewData({ ...data, showSalesStats: bragSheetStatsEnabled, previewId: Date.now() });
    if (!options?.silent) showToast('Recent sales resynced from your Agent Hub.', 'success');
    setIsRefreshingBragSheet(false);
  }, [currentUser, showToast, openHouseForPDFs, bragSheetStatsEnabled])

  // Refreshes only the listing price from the database for the Flyer - the flyer isn't a saved
  // snapshot, it's built live from the openHouses list each time it's opened, so this just pulls
  // a fresh price into that local record. Everything else (QR code, cover photo, form URL) is
  // left completely untouched.
  const handleReloadFlyerPrice = useCallback(async (targetOH: OpenHouse) => {
    if (!targetOH.listingKey) return;
    setIsReloadingFlyerPrice(true);
    const propertyRes = await api.properties.lookup({ listingKey: targetOH.listingKey });
    if (!propertyRes.success || !propertyRes.data) {
      showToast(propertyRes.error || 'Unable to refresh price data right now.', 'error');
      setIsReloadingFlyerPrice(false);
      return;
    }
    const freshPrice = propertyRes.data.price || propertyRes.data.ListPrice;
    setOpenHouses(prev => prev.map(oh => oh.id === targetOH.id ? { ...oh, price: freshPrice, ListPrice: freshPrice } : oh));
    setOpenHouseForPDFs(prev => prev && prev.id === targetOH.id ? { ...prev, price: freshPrice, ListPrice: freshPrice } : prev);
    if (pdfPreviewType === 'flyer') setPdfPreviewData((prev: any) => prev ? { ...prev, price: freshPrice, previewId: Date.now() } : prev);
    showToast('Flyer price refreshed from the database.', 'success');
    setIsReloadingFlyerPrice(false);
  }, [showToast, pdfPreviewType])

  // Refreshes only price-related fields on a saved Cheat Sheet snapshot (price, price history,
  // beds/baths/sqft) straight from MLS - deliberately does NOT call getNearbyAmenities again,
  // since that's a paid Google Places lookup and the nearby places/photos don't change between
  // opens the way price does.
  const handleReloadCheatSheetPrice = useCallback(async (targetOH: OpenHouse) => {
    if (!targetOH.listingKey) return;
    setIsReloadingCheatSheetPrice(true);
    const [propertyRes, freshAgent] = await Promise.all([
      api.properties.lookup({ listingKey: targetOH.listingKey }),
      buildCheatSheetAgentData(currentUser),
    ]);
    if (!propertyRes.success || !propertyRes.data) {
      showToast(propertyRes.error || 'Unable to refresh price data right now.', 'error');
      setIsReloadingCheatSheetPrice(false);
      return;
    }
    const p = propertyRes.data;
    const existingSnapshot = (targetOH as any).cheatSheetSnapshot;
    const updatedSnapshot = {
      ...(existingSnapshot || {}),
      property: {
        ...(existingSnapshot?.property || {}),
        openHouseEventId: targetOH.id,
        price: p.price || p.ListPrice,
        originalListPrice: p.original_list_price || p.OriginalListPrice,
        previousListPrice: p.PreviousListPrice || p.raw_mls_data?.PreviousListPrice,
        priceChangeTimestamp: p.price_change_timestamp || p.PriceChangeTimestamp,
        majorChangeTimestamp: p.MajorChangeTimestamp || p.raw_mls_data?.MajorChangeTimestamp,
        majorChangeType: p.MajorChangeType || p.raw_mls_data?.MajorChangeType,
        beds: p.bedrooms || p.BedroomsTotal,
        baths: p.bathrooms || p.BathroomsTotal,
        sqft: p.living_area || p.LivingArea,
      },
      agent: freshAgent,
      // amenities/photos left as they are - except missing assigned schools (below)
    } as any;
    // A sheet saved without all three assigned schools: ask again. The listing's places are cached
    // (no new Google charge); the server fills missing levels from a one-time web lookup (user,
    // 10/17 - 1330 N Avignon had no schools).
    {
      const levels = ['Elementary School', 'Middle School', 'High School']
      const sp = existingSnapshot?.property || {}
      const own = [sp.elementarySchool, sp.middleSchool, sp.highSchool]
      const schools: any[] = existingSnapshot?.amenities?.schools || []
      const covered = levels.filter((l, i) => own[i] || schools.some(s => s?.place_type === l)).length
      if (covered < 3) {
        const am = await api.properties.getNearbyAmenities(targetOH.listingKey)
        const fresh: any[] = am.success && am.data ? (am.data as any).schools || [] : []
        if (fresh.length > schools.length) updatedSnapshot.amenities = { ...(existingSnapshot?.amenities || {}), schools: fresh, available: true }
      }
    }
    // The listing's description: picked up only when it actually changed in the MLS. Then (and only
    // then) a Recap that's on is rewritten from the new text - one AI call, after which the new
    // description is the saved one, so refreshing again costs nothing. A Recap that's switched off
    // just drops its parked copy, so turning it on later writes it fresh. Old snapshots saved
    // without a description only store it - nothing to compare, so no AI call.
    const tidy = (s: unknown) => String(s || '').replace(/\s+/g, ' ').trim()
    const freshDesc = tidy(p.description || p.PublicRemarks)
    const oldDesc = tidy(existingSnapshot?.property?.description)
    let recapRewritten = false
    if (freshDesc && freshDesc !== oldDesc) {
      const prop: any = updatedSnapshot.property
      prop.description = p.description || p.PublicRemarks
      if (oldDesc) {
        delete recapTextCacheRef.current[targetOH.id]
        if (prop.descriptionHighlights?.length) {
          const res = await api.ai.copywrite({ purpose: 'cheat_sheet_highlights', context: freshDesc })
          const text = res.success && res.data?.text ? res.data.text.replace(/\s+/g, ' ').trim() : ''
          if (text) { prop.descriptionHighlights = text; recapRewritten = true }
        } else if (prop.descriptionHighlightsSaved) {
          prop.descriptionHighlightsSaved = null
        }
      }
    }
    const snapshotRes = await api.openHouses.updateCheatSheetSnapshot(targetOH.id, updatedSnapshot);
    if (!snapshotRes.success) {
      showToast(snapshotRes.error || 'Unable to save refreshed price data.', 'error');
      setIsReloadingCheatSheetPrice(false);
      return;
    }
    setOpenHouses(prev => prev.map(oh => oh.id === targetOH.id ? { ...oh, cheatSheetSnapshot: updatedSnapshot } as any : oh));
    setOpenHouseForPDFs(prev => prev && prev.id === targetOH.id ? { ...prev, cheatSheetSnapshot: updatedSnapshot } as any : prev);
    if (pdfPreviewType === 'cheatSheet') setPdfPreviewData({ ...updatedSnapshot, previewId: Date.now() });
    showToast(recapRewritten ? 'Cheat Sheet refreshed - the listing description changed, so the Recap was rewritten.' : 'Cheat Sheet price data refreshed.', 'success');
    setIsReloadingCheatSheetPrice(false);
  }, [currentUser, pdfPreviewType, showToast])

  // Puts one Cheat Sheet into the given Recap state and saves it to that open house's snapshot.
  // Turning it off parks the paragraph in descriptionHighlightsSaved (the PDF only reads
  // descriptionHighlights), so turning it back on - here or on any later open - costs no AI call.
  // Returns false if it couldn't be applied (no description / AI failure).
  // Recap text by open house id for this session - a wizard preview's Recap is reused once that
  // open house is saved instead of paying for a second AI call.
  const recapTextCacheRef = useRef<Record<string, string | string[]>>({})
  const applyCheatSheetRecap = useCallback(async (on: boolean, data: any, usingLivePreview: boolean, quiet = false) => {
    const persist = (next: any) => {
      if (usingLivePreview) setPdfPreviewData(next)
      const ohId = next?.property?.openHouseEventId || openHouseForPDFs?.id
      if (ohId && next?.property?.descriptionHighlights?.length) recapTextCacheRef.current[ohId] = next.property.descriptionHighlights
      // A wizard preview has no saved open house yet - nothing to write to.
      if (ohId && openHouses.some(oh => oh.id === ohId)) {
        const snap = { ...next }; delete (snap as any).previewId
        api.openHouses.updateCheatSheetSnapshot(ohId, snap)
        setOpenHouses(prev => prev.map(oh => oh.id === ohId ? { ...oh, cheatSheetSnapshot: snap } as any : oh))
        setOpenHouseForPDFs(prev => prev && prev.id === ohId ? { ...prev, cheatSheetSnapshot: snap } as any : prev)
      }
    }
    const current = data.property.descriptionHighlights
    const saved = data.property.descriptionHighlightsSaved
    if (!on) {
      if (!current?.length) return true
      persist({ ...data, property: { ...data.property, descriptionHighlights: null, descriptionHighlightsSaved: current }, previewId: Date.now() })
      return true
    }
    if (current?.length) return true
    // Paragraph form (was a bullet array) - see cheat_sheet_highlights in ai_copywrite_service.py.
    // A legacy cached array is still respected as-is.
    let highlights: string | string[] = saved?.length ? saved : (recapTextCacheRef.current[data.property.openHouseEventId] || '')
    if (!highlights) {
      const desc = (data.property.description || '').trim()
      if (!desc) { if (!quiet) showToast('This listing has no description to recap.', 'error'); return false }
      setCheatSheetHighlightsLoading(true)
      const res = await api.ai.copywrite({ purpose: 'cheat_sheet_highlights', context: desc })
      setCheatSheetHighlightsLoading(false)
      if (!res.success || !res.data?.text) { showToast(res.error || 'Could not write the Recap right now.', 'error'); return false }
      highlights = res.data.text.replace(/\s+/g, ' ').trim()
      if (!highlights) { showToast('The Recap came back empty - try again in a moment.', 'error'); return false }
    }
    persist({ ...data, property: { ...data.property, descriptionHighlights: highlights }, previewId: Date.now() })
    return true
  }, [openHouseForPDFs, openHouses, showToast])

  // Whenever a Cheat Sheet preview opens (snapshot, cache, or a fresh build), bring it in line
  // with the agent's Recap preference. One attempt per sheet+state so a failure can't loop.
  const recapAppliedRef = useRef('')
  useEffect(() => {
    if (!isPDFPreviewOpen) { recapAppliedRef.current = ''; return }
    if (pdfPreviewType !== 'cheatSheet' || !pdfPreviewData?.property || cheatSheetHighlightsLoading) return
    const has = !!pdfPreviewData.property.descriptionHighlights?.length
    if (has === cheatSheetHighlightsOn) return
    const attempt = `${pdfPreviewData.property.openHouseEventId || ''}:${cheatSheetHighlightsOn}`
    if (recapAppliedRef.current === attempt) return
    recapAppliedRef.current = attempt
    applyCheatSheetRecap(cheatSheetHighlightsOn, pdfPreviewData, true, true)
  }, [isPDFPreviewOpen, pdfPreviewType, pdfPreviewData, cheatSheetHighlightsOn, cheatSheetHighlightsLoading, applyCheatSheetRecap])

  // Recap button (Documents card or full preview): flips the remembered preference and applies
  // it to this open house's Cheat Sheet right away when there's one to apply it to - otherwise it
  // just takes effect the first time that Cheat Sheet is opened.
  const handleToggleCheatSheetHighlights = useCallback(async () => {
    const next = !cheatSheetHighlightsOn
    const usingLivePreview = pdfPreviewType === 'cheatSheet' && !!pdfPreviewData?.property
    const data = usingLivePreview ? pdfPreviewData : openHouseForPDFs?.cheatSheetSnapshot
    if (data?.property) {
      const ok = await applyCheatSheetRecap(next, data, usingLivePreview)
      if (!ok) return
    }
    setCheatSheetHighlightsOn(next)
    writePrintPref('recap', next)
  }, [pdfPreviewData, pdfPreviewType, cheatSheetHighlightsOn, openHouseForPDFs, applyCheatSheetRecap])

  const handleOpenOpenHouseNoteModal = useCallback((openHouse: OpenHouse) => {
    setSelectedOpenHouseForNote(openHouse)
    setCurrentOpenHouseNote((openHouse as any).notes || '')
    setIsOpenHouseNoteModalOpen(true)
  }, [])

  const handleSaveOpenHouseNote = useCallback(async () => {
    if (!selectedOpenHouseForNote) return
    const { success, error } = await api.openHouses.updateNote(selectedOpenHouseForNote.id, currentOpenHouseNote)
    if (success) {
      setOpenHouses(prev => prev.map(oh => oh.id === selectedOpenHouseForNote.id ? { ...oh, notes: currentOpenHouseNote } : oh))
      setIsOpenHouseNoteModalOpen(false)
      setSelectedOpenHouseForNote(null)
      setCurrentOpenHouseNote('')
      showToast('Note saved successfully', 'success')
    } else {
      showToast('Failed to save note: ' + (error || 'Unknown error'), 'error')
    }
  }, [selectedOpenHouseForNote, currentOpenHouseNote, showToast])

  const handleDeleteClick = useCallback((openHouse: OpenHouse) => {
    setOpenHouseToDelete(openHouse)
    setShowDeleteDialog(true)
  }, [])

  const handleDeleteConfirm = async () => {
    if (!openHouseToDelete) return
    setIsDeleting(true)
    const { success, error } = await api.openHouses.delete(openHouseToDelete.id)
    if (success) {
      // Close the window first, then take just this card out of the list - it collapses away and
      // the rest glide up (OpenHouseHistory). No full reload: that flashed the skeletons and made
      // the whole page jump (user, 10/24).
      const goneId = openHouseToDelete.id
      setShowDeleteDialog(false)
      setOpenHouseToDelete(null)
      window.setTimeout(() => setOpenHouses(prev => prev.filter(oh => oh.id !== goneId)), 180)
      showToast('Listing removed. Its visitors, leads and notes are all kept.', 'success')
    } else {
      showToast(error || 'Failed to remove listing. Please try again.', 'error')
    }
    setIsDeleting(false)
  }

  const loadOpenHouseHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    const { success, data } = await api.openHouses.getAll()
    if (success && data) {
      setOpenHouses(data)
      const withLiveVisitorCounts = await Promise.all(data.map(async openHouse => {
        const response = await api.openHouses.getVisitors(openHouse.id)
        if (response.success && response.data) {
          return { ...openHouse, visitorCount: response.data.length }
        }
        return openHouse
      }))
      setOpenHouses(withLiveVisitorCounts)
    }
    setIsLoadingHistory(false)
  }, [])

  useEffect(() => {
    if (!isAuthenticating && isAuthenticated && currentUser) {
      loadOpenHouseHistory()
      api.stats.getSummary().then(({ success, data }) => {
        if (success && data) setStatSummary(data)
      })
    }
  }, [isAuthenticating, isAuthenticated, currentUser, loadOpenHouseHistory])

  if (isAuthenticating) {
    return (
      <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B] flex flex-col transition-colors duration-300">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <OhpLoader fullScreen={false} className="!py-0" />
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B] flex flex-col transition-colors duration-300 relative overflow-x-hidden">

      {isGeneratingPDF && (
        <div className="fixed inset-0 z-[1000] bg-[#faf9f7]/80 dark:bg-[#0B0B0B]/80 flex flex-col items-center justify-center p-6 print:hidden animate-fadeIn">
          <div className="w-16 h-16 relative mb-8">
            <div className="absolute inset-0 border-4 border-[#8b7355]/20 dark:border-[#C9A24D]/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-[#8b7355] dark:border-t-[#C9A24D] rounded-full animate-spin"></div>
          </div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-3">Crafting Your PDF</h2>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-xs font-medium uppercase text-[10px] tracking-[0.2em]">Preparing assets...</p>
        </div>
      )}

      <div className="flex-1 flex flex-col w-full max-w-full overflow-x-hidden">
        <div className="flex-1 p-4 sm:p-6 pb-20 w-full">
          <div className="max-w-7xl mx-auto w-full flex flex-col">

            {/* Basic only: guests who'd already have a Showcase on Premium (renders nothing otherwise). */}
            <div className="mb-6 empty:hidden">
              <MissedShowcasesBanner />
            </div>

            {/* Create Wizard - its address suggestions must sit above everything below it */}
            <div className="relative z-30">
            <CreateOpenHouseWizard
              currentUser={currentUser}
              onSuccess={loadOpenHouseHistory}
              showToast={showToast}
              triggerPreview={triggerPreview}
              formatAddress={formatAddress}
              prefill={kitPrefill}
            />
            </div>

            {/* Opens you're approved to host come from Discovery (Bright MLS) - none on No-MLS plans. */}
            {hasMlsAccess(currentUser?.plan_tier) && (
              <ConfirmedToHostStrip
                openHouses={openHouses}
                onBuild={buildKitFor}
                onOpenKit={handleOpenViewPDFs}
                autoBuildId={typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('build') : null}
              />
            )}

            {/* Portfolio History */}
            <OpenHouseHistory
              openHouses={openHouses}
              isLoadingHistory={isLoadingHistory}
              statSummary={statSummary}
              onViewVisitors={handleViewVisitors}
              onOpenViewPDFs={handleOpenViewPDFs}
              onDeleteClick={handleDeleteClick}
              onOpenNoteModal={handleOpenOpenHouseNoteModal}
              onOpenKiosk={handleOpenKiosk}
              onGuestSettings={requestGuestSettings}
              formatAddress={formatAddress}
            />

            {/* Disclosure/Second-Visit Requests from Cheat Sheet QR scans - No-MLS plans have no
                Cheat Sheet, so nothing to show there. */}
            {/* While a guest's request is waiting on you it jumps to the very TOP of the page (user,
                10/25 - a has-agent guest's disclosure request sat unseen at the bottom); once
                they're all handled it settles back down here. */}
            {hasMlsAccess(currentUser?.plan_tier) && (
              <div className={requestsWaiting > 0 ? 'order-first mb-8 [&>section]:mt-0' : ''}>
                <OpenHouseFormRequestsPanel limit={isPhone ? 4 : 6} onActionNeededChange={setRequestsWaiting} />
              </div>
            )}

          </div>
        </div>
        <Footer />
      </div>

      <PDFPreviewModal
        isOpen={isPDFPreviewOpen}
        onClose={() => setIsPDFPreviewOpen(false)}
        type={pdfPreviewType}
        data={pdfPreviewData}
        title={pdfPreviewTitle}
        address={pdfPreviewAddress}
        agentId={pdfPreviewAgentId}
        openHouseEventId={pdfPreviewOpenHouseEventId}
        onRefresh={
          pdfPreviewType === 'bragSheet' ? () => handleRefreshBragSheet()
          : pdfPreviewType === 'flyer' && openHouseForPDFs ? () => handleReloadFlyerPrice(openHouseForPDFs)
          : pdfPreviewType === 'cheatSheet' && openHouseForPDFs ? () => handleReloadCheatSheetPrice(openHouseForPDFs)
          : pdfPreviewType === 'recommendations' ? handleRefreshRecommendations
          : undefined
        }
        refreshLabel={
          pdfPreviewType === 'bragSheet' ? 'Resync Sales'
          : pdfPreviewType === 'flyer' ? 'Refresh Price'
          : pdfPreviewType === 'recommendations' ? 'Refresh Listings'
          : pdfPreviewType === 'cheatSheet' ? 'Refresh Data'
          : 'Reload'
        }
        isRefreshing={
          pdfPreviewType === 'bragSheet' ? isRefreshingBragSheet
          : pdfPreviewType === 'flyer' ? isReloadingFlyerPrice
          : pdfPreviewType === 'cheatSheet' ? isReloadingCheatSheetPrice
          : isRefreshingRecommendations
        }
        onEdit={pdfPreviewType === 'recommendations' && openHouseForPDFs ? () => { setIsPDFPreviewOpen(false); handleOpenEditSimilar(openHouseForPDFs) } : undefined}
        showMatchScore={showMatchScoreOnRecs}
        onToggleMatchScore={handleToggleMatchScore}
        qrDarkMode={openHouseForPDFs?.qrDarkMode}
        onToggleQrDarkMode={handleToggleQrDarkMode}
        flyerBrand={flyerBrandOn}
        onToggleFlyerBrand={handleToggleFlyerBrand}
        showHighlightsToggle={pdfPreviewType === 'cheatSheet'}
        highlightsEnabled={cheatSheetHighlightsOn}
        highlightsLoading={cheatSheetHighlightsLoading}
        onToggleHighlights={handleToggleCheatSheetHighlights}
        showStatsToggle={pdfPreviewType === 'bragSheet'}
        statsEnabled={bragSheetStatsEnabled}
        onToggleStats={() => {
          setBragSheetStatsEnabled(current => {
            const next = !current
            setPdfPreviewData((prevData: any) => prevData ? { ...prevData, showSalesStats: next } : prevData)
            return next
          })
        }}
      />

      <KioskModal
        open={!!kioskOpenHouse}
        url={kioskShown ? `${kioskShown.formUrl || (kioskShown as any).form_url}?kiosk=1` : ''}
        onClose={handleCloseKiosk}
      />

      {isViewPDFsModalOpen && openHouseForPDFs && (
        <ViewPDFsModal
          openHouse={openHouseForPDFs}
          onClose={handleCloseViewPDFs}
          onViewFlyer={() => triggerPreview('flyer', openHouseForPDFs.id)}
          onViewPaperSignIn={() => triggerPreview('paperSignIn', openHouseForPDFs.id)}
          onViewRecommendations={() => triggerPreview('recommendations', openHouseForPDFs.id)}
          onEditRecommendations={() => handleOpenEditSimilar(openHouseForPDFs)}
          similarHomes={similarHomesOn(openHouseForPDFs)}
          onToggleSimilarHomes={() => {
            // Include is the on/off: off -> the same picker as Edit (earlier picks still ticked);
            // it switches on once homes are saved there.
            if (similarHomesOn(openHouseForPDFs)) handleGuestSettings(openHouseForPDFs, { similarHomes: false })
            else handleOpenEditSimilar(openHouseForPDFs, true)
          }}
          showcasesOn={openHouseForPDFs.autoShowcase !== false}
          onViewBragSheet={() => triggerPreview('bragSheet', openHouseForPDFs.id)}
          onViewCheatSheet={() => triggerPreview('cheatSheet', openHouseForPDFs.id)}
          onEditCheatSheet={() => handleOpenEditCheatSheet(openHouseForPDFs)}
          onReloadFlyerPrice={() => handleReloadFlyerPrice(openHouseForPDFs)}
          isReloadingFlyerPrice={isReloadingFlyerPrice}
          onReloadBragSheet={() => handleRefreshBragSheet()}
          isReloadingBragSheet={isRefreshingBragSheet}
          onReloadCheatSheet={() => handleReloadCheatSheetPrice(openHouseForPDFs)}
          isReloadingCheatSheet={isReloadingCheatSheetPrice}
          showCheatSheetSummary={cheatSheetHighlightsOn}
          isSummarizingCheatSheet={cheatSheetHighlightsLoading}
          onToggleCheatSheetSummary={handleToggleCheatSheetHighlights}
          onReloadRecommendations={handleRefreshRecommendations}
          isReloadingRecommendations={isRefreshingRecommendations}
          showMatchScore={showMatchScoreOnRecs}
          onToggleMatchScore={handleToggleMatchScore}
          showBragSheetStats={bragSheetStatsEnabled}
          onToggleBragSheetStats={() => setBragSheetStatsEnabled(current => !current)}
          qrDarkMode={openHouseForPDFs.qrDarkMode}
          onToggleQrDarkMode={handleToggleQrDarkMode}
          flyerBrand={flyerBrandOn}
          onToggleFlyerBrand={handleToggleFlyerBrand}
        />
      )}

      {isEditSimilarModalOpen && openHouseToEditSimilar && (
        <EditSimilarPropertiesModal
          isOpen={isEditSimilarModalOpen}
          onClose={handleCloseEditSimilar}
          openHouse={openHouseToEditSimilar}
          onSuccess={(snapshot) => { handleSimilarSaved(openHouseToEditSimilar, snapshot); loadOpenHouseHistory() }}
        />
      )}

      {isEditCheatSheetModalOpen && openHouseToEditCheatSheet && (
        <EditCheatSheetPhotosModal
          isOpen={isEditCheatSheetModalOpen}
          onClose={() => setIsEditCheatSheetModalOpen(false)}
          openHouse={openHouseToEditCheatSheet}
          onSuccess={loadOpenHouseHistory}
        />
      )}

      <OpenHouseNoteModal
        isOpen={isOpenHouseNoteModalOpen}
        onClose={() => setIsOpenHouseNoteModalOpen(false)}
        openHouse={selectedOpenHouseForNote}
        notes={currentOpenHouseNote}
        onNotesChange={setCurrentOpenHouseNote}
        onSave={handleSaveOpenHouseNote}
      />

      {/* Visitors (user, 10/24): a slide-up sheet on phones that pulls down to close, a centred
          window on a computer - the shared OhSheet, with the home's photo + address up top. */}
      <OhSheet
        open={!!visitorsFor}
        onClose={closeVisitors}
        width="max-w-6xl"
        title="Visitors"
        subtitle={visitorsSheetOh ? `${formatStreetAndCity(visitorsSheetOh.address, visitorsSheetOh.city)}${visitorsSheetOh.price ? ` · $${Number(visitorsSheetOh.price).toLocaleString()}` : ''}` : undefined}
        image={visitorsSheetOh?.coverImageUrl || null}
        badge={visitorsSheetOh ? (
          <span className="shrink-0 rounded-full bg-[#111827] px-2 py-0.5 text-[10px] font-black tabular-nums text-[#e8c97a] dark:bg-[#e8c97a] dark:text-[#111827]">{visitorsSheetOh.visitorCount ?? 0}</span>
        ) : undefined}
      >
        {visitorsSheetId && (
          <OpenHouseVisitors
            openHouseEventId={visitorsSheetId}
            onClose={closeVisitors}
            showcasesOn={visitorsSheetOh ? visitorsSheetOh.autoShowcase !== false || !!visitorsSheetOh.passShowcase : true}
          />
        )}
      </OhSheet>

      <ShowcasesOffSheet
        openHouse={showcasesOffFor}
        onClose={() => setShowcasesOffFor(null)}
        onSave={handleGuestSettings}
      />

      <AnimatePresence>
        {showDeleteDialog && openHouseToDelete && (
          <DeleteConfirmationDialog
            key="delete-oh"
            openHouse={openHouseToDelete}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setShowDeleteDialog(false)}
            isDeleting={isDeleting}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
