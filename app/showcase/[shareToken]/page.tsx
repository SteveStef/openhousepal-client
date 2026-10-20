'use client'

import { useState, useEffect, useLayoutEffect, useCallback, Suspense, useRef } from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { homeSlug } from '@/lib/showcaseLink'
import { applyAccentRecolor } from '@/lib/accentRecolor'
import { ArrowUpDown, MapPin, Calendar, SlidersHorizontal, Tag, BedDouble, GraduationCap, Home as HomeIcon, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Collection, CollectionPreferences, Property, Comment, TourRequest, PropertyTour } from '@/types'
import { getToken } from '@/lib/token'
import api from '@/lib/api-service'
import PropertyGrid from '@/components/PropertyGrid'
import PropertyDetailsModal, { type HomeMove } from '@/components/PropertyDetailsModal'
import QuickCommentModal from '@/components/QuickCommentModal'
import ScheduleTourModal from '@/components/ScheduleTourModal'
import TourStatusWindow, { tourState } from '@/components/TourStatusWindow'
import EditShowcaseCriteriaModal from '@/components/EditShowcaseCriteriaModal'
import { notify, useToast } from '@/contexts/ToastContext'
import MLSComplianceFooter from '@/components/MLSComplianceFooter'
import LiveIndicator from '@/components/LiveIndicator'
import { isPropertyAvailableStatus, haversineMiles, normalizeImageUrl } from '@/lib/utils'
import { computeMatchScore } from '@/lib/matchScore'
import OhpLoader from '@/components/brand/OhpLoader'
import { todayLocal } from '@/lib/relativeDays'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { Eye } from 'lucide-react'

export default function CustomerShowcasePage() {
  return (
    <Suspense fallback={<OhpLoader guest label="Opening your Showcase" />}>
      <ShowcaseContent />
    </Suspense>
  )
}

function ShowcaseContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  // Opened inside an agent's IDX site ("{first}'s Showcase"): wear the site's accent instead of our gold.
  const [siteAccent] = useState(() => searchParams.get('accent')) // kept: opening a home rewrites the address
  useEffect(() => {
    const hex = siteAccent ? `#${siteAccent.replace(/^#/, '')}` : ''
    return /^#[0-9a-f]{6}$/i.test(hex) ? applyAccentRecolor(hex) : undefined
  }, [siteAccent])
  const { showToast } = useToast()
  const { user } = useAuth()
  const [showcase, setShowcase] = useState<Collection | null>(null)
  const [matchedProperties, setMatchedProperties] = useState<Property[]>([])
  // When the Showcase was last pulled from the server (the header's "Live" chip).
  const [checkedAt, setCheckedAt] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  
  // Property filtering states
  const [activeTab, setActiveTab] = useState<'all' | 'liked' | 'disliked' | 'sold_removed'>('all')
  // Which question the search window asks: the full Refine menu, or just "compare to which home?"
  // / "how far?" when the visitor taps those lines.
  const [criteriaFocus, setCriteriaFocus] = useState<'all' | 'compare' | 'radius'>('all')
  const openCriteria = (f: 'all' | 'compare' | 'radius') => { setCriteriaFocus(f); setIsEditCriteriaOpen(true) }
  const [sortBy, setSortBy] = useState<'price' | 'beds' | 'squareFeet' | 'daysOnMarket' | 'lastUpdated' | 'closest' | 'bestMatch'>('daysOnMarket')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Modal states
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [commentsError, setCommentsError] = useState<string | null>(null)

  // Tour modal states
  const [selectedPropertyForTour, setSelectedPropertyForTour] = useState<Property | null>(null)
  const [isTourModalOpen, setIsTourModalOpen] = useState(false)
  const [tours, setTours] = useState<PropertyTour[]>([])

  // Quick comment popover state - lets the visitor reply from a property card without opening
  // the full details modal.
  const [quickCommentPropertyId, setQuickCommentPropertyId] = useState<string | number | null>(null)
  const [isQuickCommentOpen, setIsQuickCommentOpen] = useState(false)
  const [isLoadingQuickComments, setIsLoadingQuickComments] = useState(false)

  // Visitor "Refine Search" modal - lets the visitor themselves tune address/radius/price/
  // beds/baths and re-run the real match, instead of only the agent being able to.
  const [isEditCriteriaOpen, setIsEditCriteriaOpen] = useState(false)

  const isInternalSyncRef = useRef(false)
  // The homes in the list on screen right now, and the list the open details window steps through.
  const filteredIdsRef = useRef<string[]>([])
  const navIdsRef = useRef<string[]>([])

  // "Change your search" in their email opens straight to it (?search=1).
  const openedFromLinkRef = useRef(false)
  useEffect(() => {
    if (openedFromLinkRef.current || !showcase || searchParams.get('search') !== '1') return
    openedFromLinkRef.current = true
    setCriteriaFocus('all')
    setIsEditCriteriaOpen(true)
  }, [showcase, searchParams])

  const shareToken = params.shareToken as string
  // An open home lives in the path: /showcase/dana-k7q2/732-buck-ln (old links: ?property=<id>).
  const pathname = usePathname()
  const showcaseBase = `/showcase/${encodeURIComponent(shareToken)}`
  const homeInPath = (() => {
    const rest = (pathname || '').split('/').filter(Boolean)
    return rest[0] === 'showcase' && rest[2] ? decodeURIComponent(rest[2]) : null
  })()
  const linkedHome = homeInPath || searchParams.get('property')

  // This Showcase's own agent opened the client link while signed in (e.g. from a calendar
  // follow-up): nothing they do here may count as the client's activity - no view tracking, and
  // likes / comments go out signed so the server files them as the agent's. A slim bar says so and
  // offers the agent view. Anyone else (the client, or whoever they forward it to) sees it normally.
  const ownerViewing = !!(user?.id && (showcase as any)?.ownerId && user.id === (showcase as any).ownerId)
  useEffect(() => {
    api.public.setActingAsOwner(ownerViewing)
    return () => api.public.setActingAsOwner(false)
  }, [ownerViewing])

  // Opened from a personal email's own link (?ce=<id>): report the visit once (a click + open on
  // that email), then take the marker out of the address bar so a copied link stays clean.
  const emailMarker = searchParams.get('ce')
  useEffect(() => {
    if (!emailMarker || !showcase) return
    if (!ownerViewing) api.public.trackEmailVisit(emailMarker)
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('ce')
      window.history.replaceState(window.history.state, '', url.pathname + (url.search || '') + url.hash)
    } catch { /* old browser - harmless */ }
  }, [emailMarker, showcase, ownerViewing])

  // Check authentication status on component mount
  useEffect(() => {
    const checkAuthStatus = () => {
      const token = getToken()
      setIsAuthenticated(!!token)
    }
    
    checkAuthStatus()
  }, [])

  // Always light mode here, regardless of the app-wide next-themes class on <html> - that class
  // is shared per-origin, so if the agent has their own dashboard set to dark and previews this
  // same link in the same browser (or the IDX site's showcase route, which loads this exact page
  // in an iframe on the same origin), it would otherwise inherit their dashboard's dark
  // preference. A visitor's showcase should never depend on what the agent last had toggled.
  // Scoped to just this page's own document (doesn't touch localStorage, so it never overwrites
  // the agent's actual saved dashboard preference) and restored on unmount.
  useLayoutEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    if (hadDark) root.classList.remove('dark')
    return () => { if (hadDark) root.classList.add('dark') }
  }, [])

  useEffect(() => {
    const fetchCollection = async () => {
      setIsLoading(true)
      setError(null)
      
      const { success, data, error: apiError } = await api.public.getSharedShowcase(shareToken)
      
      if (success && data) {
        setShowcase(data)
        setCheckedAt(Date.now())
        if (data.matchedProperties) {
          setMatchedProperties(data.matchedProperties)
        }
      } else {
        setError(apiError || 'Failed to load showcase')
      }
      setIsLoading(false)
    }

    if (shareToken) {
      fetchCollection()
    }
  }, [shareToken])

  // Live: the MLS sync adds new matches and changes prices all day - pull the Showcase again every
  // couple of minutes while it's on screen so they appear without a refresh (the "Live" chip in the
  // header shows when it last checked). This read has no side effects - no view tracking, no alerts.
  useEffect(() => {
    if (!shareToken || !showcase?.id) return
    const t = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      const { success, data } = await api.public.getSharedShowcase(shareToken)
      if (!success || !data) return
      setCheckedAt(Date.now())
      setShowcase((prev: any) => (prev ? { ...prev, ...data } : data))
      if (data.matchedProperties) setMatchedProperties(data.matchedProperties)
    }, 120000)
    return () => window.clearInterval(t)
  }, [shareToken, showcase?.id])

  // Fetch tours separately so "Your Upcoming Tours" can show confirmed ones at the top -
  // doesn't block the initial property list from rendering.
  useEffect(() => {
    if (!showcase?.id) return
    api.public.getTours(showcase.id).then(({ success, data }) => {
      if (success && data) setTours(data)
    })
  }, [showcase?.id])

  const upcomingConfirmedTours = (() => {
    const todayStr = todayLocal()
    return tours
      .filter(t => t.confirmed_date && !t.is_completed && t.confirmed_date >= todayStr)
      .sort((a, b) => `${a.confirmed_date}${a.confirmed_time}`.localeCompare(`${b.confirmed_date}${b.confirmed_time}`))
  })()

  const formatTourDate = (dateString: string) => {
    const date = new Date(`${dateString}T00:00:00`)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const formatTourTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  // originalProperty comes back from the public API in its raw camelCase/lowercase shape
  // (address/latitude/longitude), not the uppercase RESO-style Property shape the `Property`
  // type declares (that remapping only happens in the agent-side showcases/page.tsx transform) -
  // same reason DetailView.tsx casts `preferences` to read show_match_score.
  const referencePoint = showcase?.originalProperty as unknown as {
    listingKey?: string; touredListingKey?: string | null; address?: string; city?: string; latitude?: number; longitude?: number
    image?: string; beds?: number; baths?: number; price?: number; squareFeet?: number
  } | null

  const compareProperty = (showcase?.preferences as any)?.show_match_score !== false
    ? showcase?.originalProperty || undefined
    : undefined
  // The home the search is built around (none once they choose "Stop using a home").
  const builtAround = compareProperty && referencePoint?.address ? referencePoint : null

  // A real radius search (center address + radius). Used to show the visitor the same
  // distance-from-center pill and radius context the agent sees - previously gated behind
  // hasExplicitSearchCenter, so auto-from-open-house showcases hid it from visitors entirely.
  const radiusSearchPrefs = showcase?.preferences && 'diameter' in showcase.preferences && (showcase.preferences as any).address && (showcase.preferences as any).diameter
    ? (showcase.preferences as any as { address: string; diameter: number; lat?: number | null; long?: number | null })
    : null

  // Filter and sort properties based on tabs and sorting
  const getFilteredProperties = () => {
    if (!showcase || !matchedProperties) return []

    let filtered = matchedProperties

    // Apply tab filter - sold/removed listings can't be bought anymore, so they live
    // exclusively in their own tab instead of cluttering All/Liked/Disliked.
    switch (activeTab) {
      case 'liked':
        filtered = filtered.filter(property => property.liked && isPropertyAvailableStatus(property.MlsStatus))
        break
      case 'disliked':
        filtered = filtered.filter(property => property.disliked && isPropertyAvailableStatus(property.MlsStatus))
        break
      case 'sold_removed':
        filtered = filtered.filter(property => !isPropertyAvailableStatus(property.MlsStatus))
        break
      case 'all':
      default:
        // Show all properties except disliked and sold/removed ones
        filtered = filtered.filter(property => !property.disliked && isPropertyAvailableStatus(property.MlsStatus))
        break
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'price':
          aValue = a.ListPrice || 0
          bValue = b.ListPrice || 0
          break
        case 'beds':
          aValue = a.BedroomsTotal || 0
          bValue = b.BedroomsTotal || 0
          break
        case 'squareFeet':
          aValue = a.LivingArea || 0
          bValue = b.LivingArea || 0
          break
        case 'daysOnMarket':
          aValue = a.DaysOnMarket || 0
          bValue = b.DaysOnMarket || 0
          break
        case 'lastUpdated':
          aValue = a.ModificationTimestamp ? new Date(a.ModificationTimestamp).getTime() : 0
          bValue = b.ModificationTimestamp ? new Date(b.ModificationTimestamp).getTime() : 0
          break
        case 'closest': {
          // Distance from the open house property, not from the visitor - "closest match"
          // means closest to what they actually came to see. Ascending (the default toggle
          // state, same as every other field here) = smallest distance first = nearest.
          // Properties missing coordinates sort to the end either way, rather than falsely
          // winning as "closest".
          if (!referencePoint?.latitude || !referencePoint?.longitude) return 0
          const distanceOf = (p: typeof a) =>
            p.Latitude != null && p.Longitude != null
              ? haversineMiles(referencePoint.latitude!, referencePoint.longitude!, p.Latitude, p.Longitude)
              : Infinity
          aValue = distanceOf(a)
          bValue = distanceOf(b)
          break
        }
        case 'bestMatch': {
          // Inverted (negative score) so ascending - the default toggle state - shows the
          // highest match first, same convention as 'closest' above.
          if (!compareProperty) return 0
          aValue = -computeMatchScore(a, compareProperty, matchedProperties)
          bValue = -computeMatchScore(b, compareProperty, matchedProperties)
          break
        }
        default:
          return 0
      }

      // Homes your agent recommends lead, whatever the sort (user, 10/18).
      const rec = (p: typeof a) => (p.agentRecommended && !p.disliked ? 1 : 0)
      if (rec(a) !== rec(b)) return rec(b) - rec(a)
      if (sortOrder === 'asc') {
        return aValue - bValue
      } else {
        return bValue - aValue
      }
    })

    return filtered
  }

  const filteredProperties = getFilteredProperties()
  filteredIdsRef.current = filteredProperties.map(p => String(p.id))

  const getTabCounts = () => {
    if (!showcase || !matchedProperties) return { all: 0, liked: 0, disliked: 0, soldRemoved: 0 }

    const properties = matchedProperties
    return {
      all: properties.filter(p => !p.disliked && isPropertyAvailableStatus(p.MlsStatus)).length,
      liked: properties.filter(p => p.liked && isPropertyAvailableStatus(p.MlsStatus)).length,
      disliked: properties.filter(p => p.disliked && isPropertyAvailableStatus(p.MlsStatus)).length,
      soldRemoved: properties.filter(p => !isPropertyAvailableStatus(p.MlsStatus)).length
    }
  }

  const tabCounts = getTabCounts()

  // "Added to Passed": a small note in the middle of the screen the first 3 times this visitor
  // passes on a home (remembered in this browser), so they know where it went. Never again after.
  const reduceMotion = useReducedMotion()
  const [passHint, setPassHint] = useState<{ key: number; photo: string | null } | null>(null)
  const passHintTimer = useRef<number | undefined>(undefined)
  const maybeShowPassHint = (property: Property | null) => {
    const KEY = 'ohp_pass_hint_seen'
    let seen = 0
    try { seen = parseInt(window.localStorage.getItem(KEY) || '0', 10) || 0 } catch { /* storage blocked */ }
    if (seen >= 3) return
    try { window.localStorage.setItem(KEY, String(seen + 1)) } catch { /* storage blocked - still show it */ }
    const raw = property?.ListPictureURL || null
    setPassHint({ key: Date.now(), photo: raw ? normalizeImageUrl(raw) : null })
    window.clearTimeout(passHintTimer.current)
    passHintTimer.current = window.setTimeout(() => setPassHint(null), 1900)
  }
  useEffect(() => () => window.clearTimeout(passHintTimer.current), [])

  // Handle property interactions
  const handlePropertyLike = async (propertyId: string | number, liked: boolean) => {
    if (!showcase) return

    // Optimistic UI update
    const optimisticProperties = matchedProperties.map(property =>
      String(property.id) === String(propertyId) ? {
        ...property,
        liked: liked,
        disliked: liked ? false : property.disliked
      } : property
    )

    setMatchedProperties(optimisticProperties)

    if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
      setSelectedProperty(prevProperty => ({
        ...prevProperty!,
        liked: liked,
        disliked: liked ? false : prevProperty!.disliked
      }))
    }

    const { success, data, error } = await api.public.interactWithProperty(
      showcase.id,
      String(propertyId),
      'like',
      liked
    )

    if (success && data?.interaction) {
      const updatedProperties = matchedProperties.map(property =>
        String(property.id) === String(propertyId) ? {
          ...property,
          liked: data.interaction.liked,
          disliked: data.interaction.disliked
        } : property
      )

      setMatchedProperties(updatedProperties)

      if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
        setSelectedProperty(prevProperty => ({
          ...prevProperty!,
          liked: data.interaction.liked,
          disliked: data.interaction.disliked
        }))
      }

      showToast(liked ? 'Property added to your likes!' : 'Property removed from your likes', 'success')
    } else {
      // Rollback on error
      setMatchedProperties(matchedProperties)
      showToast(error || 'Failed to update like status', 'error')
    }
  }

  const handlePropertyDislike = async (propertyId: string | number, disliked: boolean) => {
    if (!showcase) return
    // A visitor's first few passes show where the home went ("Added to Passed"); after that the
    // card simply leaving says enough - no toast either way.
    if (disliked) maybeShowPassHint(matchedProperties.find(p => String(p.id) === String(propertyId)) || null)

    // Optimistic UI update
    const optimisticProperties = matchedProperties.map(property =>
      String(property.id) === String(propertyId) ? {
        ...property,
        liked: disliked ? false : property.liked,
        disliked: disliked
      } : property
    )

    setMatchedProperties(optimisticProperties)

    if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
      setSelectedProperty(prevProperty => ({
        ...prevProperty!,
        liked: disliked ? false : prevProperty!.liked,
        disliked: disliked
      }))
    }

    const { success, data, error } = await api.public.interactWithProperty(
      showcase.id,
      String(propertyId),
      'dislike',
      disliked
    )

    if (success && data?.interaction) {
      const updatedProperties = matchedProperties.map(property =>
        String(property.id) === String(propertyId) ? {
          ...property,
          liked: data.interaction.liked,
          disliked: data.interaction.disliked
        } : property
      )

      setMatchedProperties(updatedProperties)

      if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
        setSelectedProperty(prevProperty => ({
          ...prevProperty!,
          liked: data.interaction.liked,
          disliked: data.interaction.disliked
        }))
      }

      if (!disliked) showToast('Property unmarked as not interested', 'success')
    } else {
      // Rollback
      setMatchedProperties(matchedProperties)
      showToast(error || 'Failed to update status', 'error')
    }
  }

  const handleAddComment = async (propertyId: string | number, comment: string) => {
    if (!showcase) return

    const visitorName = `${showcase.customer.firstName} ${showcase.customer.lastName}`
    const newComment: Comment = {
      id: Date.now(),
      author: visitorName,
      isAgent: false,
      content: comment,
      createdAt: new Date().toISOString()
    }

    // Optimistic update
    setMatchedProperties(prev => prev.map(property =>
      String(property.id) === String(propertyId) 
        ? { ...property, comments: [...(property.comments || []), newComment] }
        : property
    ))

    if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
      setSelectedProperty({
        ...selectedProperty,
        comments: [...(selectedProperty.comments || []), newComment]
      })
    }
    
    const { success, data, error } = await api.public.addPropertyComment(
      showcase.id,
      String(propertyId),
      comment,
      visitorName
    )

    if (success && data) {
      const backendComment = data.comment || data
      const serverComment = {
        ...backendComment,
        createdAt: backendComment.created_at || backendComment.createdAt,
        author: backendComment.author || backendComment.visitor_name || 'Anonymous',
        isAgent: !!(backendComment.is_agent ?? backendComment.isAgent)
      }

      const replaceComment = (comments: Comment[]) =>
        comments.map(c => c.id === newComment.id ? serverComment : c)

      setMatchedProperties(prev => prev.map(property =>
        String(property.id) === String(propertyId)
          ? { ...property, comments: replaceComment(property.comments || []) }
          : property
      ))

      if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
        setSelectedProperty(prev => prev ? { ...prev, comments: replaceComment(prev.comments || []) } : prev)
      }
    } else {
      // Rollback
      setMatchedProperties(prev => prev.map(property =>
        String(property.id) === String(propertyId)
          ? { ...property, comments: (property.comments || []).filter(c => c.id !== newComment.id) }
          : property
      ))
      showToast(error || 'Failed to post comment', 'error')
    }
  }

  const fetchPropertyComments = async (propertyId: number) => {
    if (!showcase) return
    setIsLoadingComments(true)
    setCommentsError(null)

    const { success, data, error } = await api.public.getPropertyComments(showcase.id, String(propertyId))

    if (success && data) {
      const transformedComments = data.map((comment: any) => ({
        ...comment,
        createdAt: comment.created_at || comment.createdAt,
        author: comment.author || comment.visitor_name || 'Anonymous',
        isAgent: !!(comment.is_agent ?? comment.isAgent)
      }))

      setSelectedProperty(prev => prev ? { ...prev, comments: transformedComments } : prev)
      // Actually reading the thread clears its unread badge on the card - the server already
      // marked it read, this just keeps the UI in sync without waiting for a refetch.
      setMatchedProperties(prev => prev.map(p => String(p.id) === String(propertyId) ? { ...p, comments: transformedComments, unreadCommentCount: 0 } : p))
    } else {
      setCommentsError(error || 'Failed to load comments')
    }
    setIsLoadingComments(false)
  }

  const handleOpenQuickComment = async (property: Property) => {
    setQuickCommentPropertyId(property.id)
    setIsQuickCommentOpen(true)
    if (!showcase) return
    setIsLoadingQuickComments(true)
    const { success, data } = await api.public.getPropertyComments(showcase.id, String(property.id))
    if (success && data) {
      const transformedComments = data.map((comment: any) => ({
        ...comment,
        createdAt: comment.created_at || comment.createdAt,
        author: comment.author || comment.visitor_name || 'Anonymous',
        isAgent: !!(comment.is_agent ?? comment.isAgent)
      }))
      setMatchedProperties(prev => prev.map(p => String(p.id) === String(property.id) ? { ...p, comments: transformedComments, unreadCommentCount: 0 } : p))
    }
    setIsLoadingQuickComments(false)
  }

  const handleCloseQuickComment = () => {
    setIsQuickCommentOpen(false)
    setQuickCommentPropertyId(null)
  }

  const quickCommentProperty = matchedProperties.find(p => String(p.id) === String(quickCommentPropertyId)) || null

  // Handle the async parts of property viewing (tracking, fetching details)
  const loadPropertyDetails = useCallback(async (property: Property) => {
    // Track property view
    if (showcase?.id && property.id && !ownerViewing) {
      const { success } = await api.public.trackPropertyView(showcase.id, String(property.id))
      if (success) {
        setMatchedProperties(prev => prev.map(p =>
          String(p.id) === String(property.id) ? { ...p, viewed: true, viewCount: (p.viewCount || 0) + 1 } : p
        ))
      }
    }

    setIsLoadingDetails(true)
    setDetailsError(null)
    try {
      const { success, data, error } = await api.properties.getById(property.id as string)
      if (success && data) {
        setSelectedProperty(prev => prev ? { ...prev, ...data } : null)
      } else {
        setDetailsError(error || 'Failed to load details')
      }
    } catch (err) {
      console.error('Error fetching property details:', err)
      setDetailsError('Failed to load additional property details')
    } finally {
      setIsLoadingDetails(false)
    }

    const propertyIdAsNumber = Number(property.id)
    if (property.id && !isNaN(propertyIdAsNumber)) {
      fetchPropertyComments(propertyIdAsNumber)
    }
  }, [showcase?.id, ownerViewing])

  // A home's own address in this Showcase: /showcase/dana-k7q2/732-buck-ln (?property=<id> if it has no street).
  const homeUrl = useCallback((property: Property) => {
    const currentParams = new URLSearchParams(window.location.search)
    currentParams.delete('property')
    const slug = homeSlug(property.FullStreetAddress)
    const target = slug ? `${showcaseBase}/${slug}` : showcaseBase
    if (!slug) currentParams.set('property', String(property.id))
    const q = currentParams.toString()
    return `${target}${q ? `?${q}` : ''}`
  }, [showcaseBase])

  // The homes the details window steps through with its arrows: the list it was opened from, as it
  // was then (a home passed on the way is dropped from it, so the arrows never land on it again).
  const [homeMove, setHomeMove] = useState<HomeMove | null>(null)
  const moveSeq = useRef(0)
  const passedInDetailsRef = useRef(false)

  const handlePropertyClick = useCallback((property: Property) => {
    isInternalSyncRef.current = true

    // Opening a home is one step in the browser's history (marked, so closing it goes back to the
    // list instead of adding another step - Back then leaves the Showcase as expected).
    const url = homeUrl(property)
    if (url !== `${window.location.pathname}${window.location.search}`) {
      window.history.pushState({ ohpHome: true }, '', url)
    }

    navIdsRef.current = filteredIdsRef.current
    setHomeMove(null)
    // Set state immediately
    setSelectedProperty(property)
    setIsModalOpen(true)
    loadPropertyDetails(property)

    setTimeout(() => { isInternalSyncRef.current = false }, 100)
  }, [loadPropertyDetails, homeUrl])

  // Step to another home inside the open window - same history step, new address.
  const goToHome = useCallback((property: Property, dir: 1 | -1, kind: HomeMove['kind'] = 'nav') => {
    isInternalSyncRef.current = true
    window.history.replaceState({ ohpHome: !!window.history.state?.ohpHome }, '', homeUrl(property))
    setHomeMove({ dir, kind, seq: ++moveSeq.current })
    setSelectedProperty(property)
    setIsModalOpen(true)
    loadPropertyDetails(property)
    setTimeout(() => { isInternalSyncRef.current = false }, 100)
  }, [loadPropertyDetails, homeUrl])

  const handleCloseModal = useCallback(() => {
    isInternalSyncRef.current = true

    // Set state immediately
    setIsModalOpen(false)
    setSelectedProperty(null)

    if (window.history.state?.ohpHome) {
      // We opened this home from the list: closing = going back to the list's own history step.
      window.history.back()
    } else {
      const currentParams = new URLSearchParams(window.location.search)
      if (currentParams.has('property') || window.location.pathname !== showcaseBase) {
        currentParams.delete('property')
        window.history.replaceState(null, '', `${showcaseBase}${currentParams.toString() ? `?${currentParams.toString()}` : ''}`)
      }
    }

    setTimeout(() => { isInternalSyncRef.current = false }, 100)
  }, [showcaseBase])

  // While a home is open the page must not be scrolled by the browser's own history restore - the
  // window puts it back exactly where it was when it closes (no jump, no flash).
  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return
    if (isModalOpen) { window.history.scrollRestoration = 'manual'; return }
    const t = window.setTimeout(() => { window.history.scrollRestoration = 'auto' }, 900)
    return () => window.clearTimeout(t)
  }, [isModalOpen])

  // Passed homes from inside the window: once it closes, the Disliked tab's count pops so they see
  // where those homes went.
  const [dislikedPulse, setDislikedPulse] = useState(0)
  useEffect(() => {
    if (isModalOpen || !passedInDetailsRef.current) return
    passedInDetailsRef.current = false
    const t = window.setTimeout(() => setDislikedPulse(n => n + 1), 380)
    return () => window.clearTimeout(t)
  }, [isModalOpen])

  // Handle URL sync for property details (Single Source of Truth)
  useEffect(() => {
    if (isInternalSyncRef.current) return

    const wanted = linkedHome

    if (wanted && matchedProperties.length > 0) {
      const property = matchedProperties.find(p => String(p.id) === wanted)
        || matchedProperties.find(p => homeSlug(p.FullStreetAddress) === wanted)
      if (property) {
        // If it's a new property selection, update state and load details
        if (!selectedProperty || String(selectedProperty.id) !== String(property.id)) {
          setSelectedProperty(property)
          setIsModalOpen(true)
          loadPropertyDetails(property)
        }
      }
    } else if (!wanted && isModalOpen) {
      // If URL cleared, close the modal
      setIsModalOpen(false)
      setSelectedProperty(null)
    }
  }, [linkedHome, matchedProperties, selectedProperty?.id, isModalOpen, loadPropertyDetails])

  // The buyer's newest showing request for a home (cancelled ones don't count).
  const latestTourFor = (propertyId?: string | number | null) =>
    (tours as any[])
      .filter(t => String(t.property_id) === String(propertyId) && t.status !== 'CANCELLED')
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null
  const [tourStatusFor, setTourStatusFor] = useState<Property | null>(null)

  // "Tour" on a home: a home they've already asked about opens that request (pending / confirmed,
  // the times they picked) instead of a blank new one.
  const handleScheduleTourClick = (property: Property, fresh = false) => {
    // Bright MLS: a Coming Soon home can't be shown to anyone until it goes active.
    if (/coming\s*soon/i.test(String((property as any).MlsStatus || (property as any).status || ''))) {
      notify(`${(property as any).FullStreetAddress || 'This home'} is coming soon - showings open the day it goes active. Leave a comment and your agent will line you up first.`, 'success')
      return
    }
    const t = latestTourFor(property.id)
    if (!fresh && (tourState(t) === 'pending' || tourState(t) === 'confirmed')) {
      setTourStatusFor(property)
      return
    }
    setSelectedPropertyForTour(property)
    setIsTourModalOpen(true)
  }
  const refreshTours = () => {
    if (!showcase?.id) return
    api.public.getTours(showcase.id).then(({ success, data }) => { if (success && data) setTours(data) })
  }

  // The showing window plays its own "sent" moment and closes itself - this only sends the request
  // and marks the home; a failure is thrown back so the window can say so and stay open.
  const handleScheduleTourSubmit = async (tourRequest: TourRequest) => {
    if (!showcase) throw new Error('Showcase not available - please refresh the page.')
    const { success, error } = await api.public.scheduleTour(showcase.id, tourRequest)
    if (!success) throw new Error(error || 'That didn’t go through - please try again.')
    setMatchedProperties(prev => prev.map(property =>
      String(property.id) === String(tourRequest.propertyId) ? { ...property, hasTourScheduled: true } : property
    ))
    refreshTours()
    // The open details window's tour button shows the request too.
    setSelectedProperty(prev => prev && String(prev.id) === String(tourRequest.propertyId) ? { ...prev, hasTourScheduled: true } : prev)
  }

  const handleCloseTourModal = () => {
    setIsTourModalOpen(false)
    setSelectedPropertyForTour(null)
  }

  const handleNotificationToggle = async () => {
    if (!showcase || !shareToken) return

    const newNotifyVisitor = !showcase.notifyVisitor

    const { success, error } = await api.public.toggleNotifications(shareToken, newNotifyVisitor)

    if (success) {
      setShowcase(prev => prev ? { ...prev, notifyVisitor: newNotifyVisitor } : null)
      showToast(
        newNotifyVisitor 
          ? 'Notifications enabled! You will be notified of new matches.' 
          : 'Notifications disabled.',
        'success'
      )
    } else {
      showToast(error || 'Failed to update notification settings', 'error')
    }
  }

  // Visitor-driven "Refine Search" - re-runs the real match against the local property mirror
  // (same underlying logic as the agent's own edit) and swaps in the refreshed showcase, which
  // now also carries drive times computed from the (possibly just-changed) search address.
  const handleSaveCriteria = async (preferences: Partial<CollectionPreferences>) => {
    if (!shareToken) return

    const before = new Set(matchedProperties.map(p => String(p.id)))
    const { success, data, error } = await api.public.updateShowcasePreferences(shareToken, preferences)

    if (success && data) {
      const now: Property[] = data.matchedProperties || []
      const after = new Set(now.map(p => String(p.id)))
      const added = now.filter(p => !before.has(String(p.id))).length
      const removed = Array.from(before).filter(id => !after.has(id)).length
      setShowcase(data)
      setMatchedProperties(now)
      const change = [added ? `${added} new home${added === 1 ? '' : 's'} added` : '', removed ? `${removed} removed` : ''].filter(Boolean).join(', ')
      showToast(change ? `Search updated - ${change}` : `Search updated - ${now.length} matching homes`, 'success')
      return { added, removed }
    } else {
      throw new Error(error || 'Failed to update your search')
    }
  }

  // Visitor's alternative to editing criteria themselves - a plain-English message the agent
  // sees on their showcase view and in their notifications (see EditShowcaseCriteriaModal's
  // "Ask My Agent" tab).
  const handleSendRefineRequest = async (message: string) => {
    if (!showcase) return
    const { success, error } = await api.public.submitRefineRequest(showcase.id, message)
    if (!success) throw new Error(error || 'Failed to send your message')
  }

  // What their search is, in a few plain words, with ONE big "Change your search" button - the
  // only way in (it used to be three: Refine, the home card and the distance line).
  const prefsNow = (showcase?.preferences || {}) as any
  const kShort = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M` : `$${Math.round(n / 1000)}k`)
  const searchLine = [
    prefsNow.has_drawn_area ? 'The area your agent drew' : prefsNow.address && prefsNow.diameter ? `Within ${prefsNow.diameter} mi` : '',
    ...((prefsNow.cities || []) as string[]).slice(0, 2).map(c => c.split(',')[0]),
    ((prefsNow.cities || []) as string[]).length > 2 ? `+${prefsNow.cities.length - 2} towns` : '',
    ...((prefsNow.school_districts || []) as string[]).slice(0, 1),
    prefsNow.min_price || prefsNow.max_price
      ? (prefsNow.min_price && prefsNow.max_price ? `${kShort(prefsNow.min_price)} – ${kShort(prefsNow.max_price)}` : prefsNow.max_price ? `Up to ${kShort(prefsNow.max_price)}` : `${kShort(prefsNow.min_price)}+`)
      : '',
    prefsNow.min_beds ? `${prefsNow.min_beds}+ beds` : '',
    prefsNow.min_baths ? `${prefsNow.min_baths}+ baths` : '',
  ].filter(Boolean).join(' · ')
  const nice = (t: string) => (t === t.toUpperCase() ? t.toLowerCase().replace(/(^|\s)([a-z])/g, (_: string, x: string, c: string) => x + c.toUpperCase()) : t)
  const whereTile = prefsNow.has_drawn_area ? 'Area your agent drew'
    : prefsNow.address && prefsNow.diameter ? `Within ${prefsNow.diameter} mi`
    : ((prefsNow.cities || []) as string[]).length ? ((prefsNow.cities as string[]).slice(0, 2).map(c => c.split(',')[0]).join(', ') + ((prefsNow.cities as string[]).length > 2 ? ` +${prefsNow.cities.length - 2}` : ''))
    : ''
  const districtTile = ((prefsNow.school_districts || []) as string[]).length
    ? nice((prefsNow.school_districts as string[])[0].split(',')[0]) + ' schools' : ''
  const builtStreet = (() => {
    const raw = (builtAround?.address || '').split(',')[0]
    return raw === raw.toUpperCase() ? raw.toLowerCase().replace(/(^|\s)([a-z])/g, (_: string, x: string, c: string) => x + c.toUpperCase()) : raw
  })()
  // Each one reads as a short phrase: big value, small plain label under it.
  const searchTiles = ([
    { icon: MapPin, value: whereTile || districtTile || 'Anywhere', label: whereTile ? (prefsNow.has_drawn_area ? 'Search area' : prefsNow.address ? `of ${builtStreet || 'the home'}` : 'Towns') : districtTile ? 'School district' : 'Search area' },
    whereTile && districtTile ? { icon: GraduationCap, value: districtTile.replace(/ schools$/, ''), label: 'Schools only' } : null,
    { icon: Tag, value: prefsNow.min_price && prefsNow.max_price ? `${kShort(prefsNow.min_price)} – ${kShort(prefsNow.max_price)}` : prefsNow.max_price ? `Up to ${kShort(prefsNow.max_price)}` : prefsNow.min_price ? `${kShort(prefsNow.min_price)}+` : 'Any', label: 'Price' },
    { icon: BedDouble, value: prefsNow.min_beds ? `${prefsNow.min_beds}+ beds` : 'Any beds', label: prefsNow.min_baths ? `${prefsNow.min_baths}+ baths` : 'Bedrooms' },
    { icon: HomeIcon, value: `${tabCounts.all} ${tabCounts.all === 1 ? 'home' : 'homes'}`, label: 'Match right now' },
  ].filter(Boolean)) as { icon: typeof MapPin; value: string; label: string }[]
  const searchBar = (
    <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 dark:border-gray-800 sm:flex-row sm:items-center sm:px-6">
      <button type="button" onClick={() => openCriteria('all')} className="flex min-w-0 flex-1 items-center gap-3 text-left xl:max-w-[30%] xl:flex-none">
        {builtAround?.image
          ? <img src={builtAround.image} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#C9A24D]/12 text-[#C9A24D]"><SlidersHorizontal size={20} /></span>}
        <span className="min-w-0 leading-tight">
          <span className="block text-[10px] font-black uppercase tracking-widest text-[#C9A24D]">Your search</span>
          <span className="mt-0.5 block truncate text-base font-black text-[#0B0B0B] dark:text-white">
            {builtAround ? `Homes like ${builtStreet}` : 'Homes that fit your filters'}
          </span>
          {searchLine && <span className="block truncate text-xs font-semibold text-[#6B7280] dark:text-gray-400 xl:hidden">{searchLine}</span>}
        </span>
      </button>
      {/* Wide screens: what the search looks for, centred in the space between the home and the
          button (it was empty) - icon, the value, and a plain word under it. */}
      <div className="hidden min-w-0 flex-1 justify-center px-4 xl:flex">
        <button type="button" onClick={() => openCriteria('all')} aria-label="Change your search"
          className="group flex min-w-0 items-center rounded-2xl border border-[#C9A24D]/20 bg-gradient-to-b from-[#FFFDF7] to-[#FAF6EC] px-1.5 py-1.5 shadow-[0_10px_24px_-20px_rgba(140,110,50,.8)] transition-colors hover:border-[#C9A24D]/45 dark:border-white/10 dark:from-white/[0.04] dark:to-white/[0.02]">
          {searchTiles.map((t, i) => (
            <span key={t.label + i} className="flex min-w-0 items-center">
              {i > 0 && <span aria-hidden className="h-8 w-px shrink-0 bg-[#C9A24D]/20 dark:bg-white/10" />}
              <span className="flex min-w-0 items-center gap-2.5 px-3.5 py-1">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#C9A24D]/12 text-[#a8843a] dark:text-[#e8c97a]"><t.icon size={15} strokeWidth={2.4} /></span>
                <span className="min-w-0 text-left leading-tight">
                  <span className="block truncate text-[13.5px] font-black text-[#0B0B0B] dark:text-white">{t.value}</span>
                  <span className="mt-0.5 block truncate text-[11px] font-semibold text-[#8a8f98] dark:text-gray-400">{t.label}</span>
                </span>
              </span>
            </span>
          ))}
        </button>
      </div>
      <motion.button
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => openCriteria('all')}
        className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e8c97a] to-[#C9A24D] px-6 text-sm font-black text-[#111827] shadow-[0_12px_26px_-12px_rgba(201,162,77,.9)] transition-shadow hover:shadow-lg"
      >
        <SlidersHorizontal size={16} /> Change your search
      </motion.button>
    </div>
  )

  const sortControlNode = (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
      <div className="relative group min-w-0 flex-1 sm:w-44 sm:flex-none">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#C9A24D] transition-colors">
          <ArrowUpDown size={14} />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="w-full pl-9 pr-8 py-2 sm:py-2.5 bg-gray-50/50 dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-800 rounded-xl text-[#0B0B0B] dark:text-white text-sm font-medium focus:outline-none focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/5 transition-all appearance-none cursor-pointer"
        >
          {!!compareProperty && <option value="bestMatch">Best Match</option>}
          <option value="daysOnMarket">Days on Market</option>
          <option value="price">Price</option>
          <option value="beds">Bedrooms</option>
          <option value="squareFeet">Square Feet</option>
          <option value="lastUpdated">Last Updated</option>
          {!!referencePoint?.latitude && !!referencePoint?.longitude && (
            <option value="closest">Closest Match</option>
          )}
        </select>
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-500">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
      {/* Was missing entirely on the visitor side - sortOrder existed in state and the sort logic
          already respected it, but nothing here ever let a visitor actually flip it. */}
      <button
        type="button"
        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        title={sortOrder === 'asc' ? 'Low to high' : 'High to low'}
        aria-label={sortOrder === 'asc' ? 'Sort ascending, click for descending' : 'Sort descending, click for ascending'}
        className="shrink-0 p-2 sm:p-2.5 bg-gray-50/50 dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-500 dark:text-gray-400 hover:text-[#C9A24D] hover:border-[#C9A24D]/40 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/5 transition-all"
      >
        <svg className={`w-3.5 h-3.5 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
      </button>
    </div>
  )

  // Previous / next home for the open details window.
  const navIds = navIdsRef.current.length ? navIdsRef.current : filteredIdsRef.current
  const openId = selectedProperty ? String(selectedProperty.id) : ''
  const navIndex = navIds.indexOf(openId)
  const homeById = (id?: string) => (id ? matchedProperties.find(p => String(p.id) === id) || null : null)
  const prevHome = navIndex > 0 ? homeById(navIds[navIndex - 1]) : null
  const nextHome = navIndex >= 0 ? homeById(navIds[navIndex + 1]) : homeById(navIds[0])
  const detailsNav = isModalOpen && selectedProperty && navIds.length > 1
    ? {
        index: navIndex,
        total: navIds.length,
        onPrev: prevHome ? () => goToHome(prevHome, -1) : null,
        onNext: nextHome ? () => goToHome(nextHome, 1) : null,
      }
    : null

  // Pass from inside the details: the button flips to "Passed" for a beat, then the home slides off
  // and the next one in the list takes its place (the one before it at the end of the list; the
  // window closes if it was the last). The passed home is in the Disliked tab now.
  const openIdRef = useRef('')
  openIdRef.current = openId
  const handleDetailsDislike = (propertyId: string | number, disliked: boolean) => {
    handlePropertyDislike(propertyId, disliked)
    if (!disliked) return
    passedInDetailsRef.current = true
    const id = String(propertyId)
    const ids = navIds
    const i = ids.indexOf(id)
    const after = i >= 0 ? ids.slice(i + 1).map(homeById).find(p => p && !p.disliked) || null : null
    const before = i > 0 ? ids.slice(0, i).reverse().map(homeById).find(p => p && !p.disliked) || null : null
    window.setTimeout(() => {
      if (activeTab !== 'disliked' && activeTab !== 'sold_removed') navIdsRef.current = navIdsRef.current.filter(x => x !== id)
      if (openIdRef.current !== id) return // they already moved on themselves
      if (after) goToHome(after, 1, 'pass')
      else if (before) goToHome(before, -1, 'pass')
      else handleCloseModal()
    }, reduceMotion ? 150 : 430)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B] flex flex-col transition-colors">
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center">
            <OhpLoader guest fullScreen={false} className="!py-0" label="Opening your Showcase" />
          </div>
        </div>
      </div>
    )
  }

  // The agent's plan no longer includes Showcases (downgrade or ended subscription) - the backend
  // returns 410 "showcase_paused". Speak to the client, not about billing.
  if (error === 'showcase_paused') {
    return (
      <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B] flex flex-col transition-colors">
        <div className="flex-1 flex items-center justify-center py-20 px-4">
          <div className="text-center bg-white dark:bg-[#151517] p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 max-w-md mx-auto">
            <div className="w-16 h-16 bg-[#C9A24D]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-black text-[#0B0B0B] dark:text-white mb-2 tracking-tight">This Showcase is paused</h3>
            <p className="text-[#6B7280] dark:text-gray-400">New matches and alerts aren&apos;t being sent right now. Reach out to your agent directly for the latest homes.</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !showcase) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B] flex flex-col transition-colors">
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center bg-white dark:bg-[#151517] p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 max-w-md mx-auto">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-black text-[#0B0B0B] dark:text-white mb-2 tracking-tight">{error || 'Collection not found'}</h3>
            <p className="text-[#6B7280] dark:text-gray-400">Please check the link and try again</p>
          </div>
        </div>
      </div>
    )
  }

  const visitorFirstName = showcase.customer.firstName || ''
  const visitorLastName = showcase.customer.lastName || ''
  const visitorFullName = [visitorFirstName, visitorLastName].filter(Boolean).join(' ')

  return (
    <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B] flex flex-col transition-colors" style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
      {ownerViewing && (
        <div className="sticky top-0 z-40 border-b border-[#C9A24D]/30 bg-[#111827] text-white">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6">
            <Eye className="h-4 w-4 shrink-0 text-[#e8c97a]" />
            <p className="min-w-0 flex-1 text-[12px] font-semibold leading-snug sm:text-[13px]">
              You&apos;re seeing {visitorFirstName && visitorFirstName !== 'Anonymous' ? `${visitorFirstName}'s` : 'this'} Showcase the way they do. <span className="text-white/60">Your clicks here don&apos;t count as theirs.</span>
            </p>
            {/* A full page load, not an in-app switch: opened from Gmail's built-in browser the switch could
                hang on the loader until a refresh (user, 10/18). */}
            <a href={`/showcases?showcase=${showcase.id}`} className="shrink-0 rounded-full bg-[#C9A24D] px-3 py-1.5 text-[11px] font-black text-[#111827] transition hover:bg-[#e8c97a]">
              Agent view
            </a>
          </div>
        </div>
      )}
      <div className="flex-1 p-4 sm:p-6 pb-20">
        <div className="max-w-7xl mx-auto">
          {/* Your Upcoming Tours */}
          {upcomingConfirmedTours.length > 0 && (
            <div className="bg-white dark:bg-[#151517] rounded-2xl shadow-sm border border-[#C9A24D]/30 p-4 sm:p-6 mb-6 relative overflow-hidden transition-colors">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#C9A24D]" />
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-[#C9A24D]/10 rounded-lg">
                  <Calendar size={16} className="text-[#C9A24D]" />
                </div>
                <h2 className="text-base sm:text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight">Your Upcoming Tours</h2>
              </div>
              <div className="space-y-2">
                {upcomingConfirmedTours.map((tour) => {
                  const property = matchedProperties.find(p => String(p.id) === String(tour.property_id))
                  return (
                    <div key={tour.id} className="flex items-center gap-3 p-3 bg-[#FAFAF7] dark:bg-[#0B0B0B] rounded-xl border border-gray-200 dark:border-gray-800">
                      {property?.ListPictureURL && (
                        <img src={property.ListPictureURL} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm text-[#0B0B0B] dark:text-white truncate">
                          {property ? `${property.FullStreetAddress}, ${property.City}` : 'Property'}
                        </div>
                        <div className="text-xs text-[#6B7280] dark:text-gray-400 font-medium">
                          {formatTourDate(tour.confirmed_date!)} at {formatTourTime(tour.confirmed_time!)}
                        </div>
                      </div>
                      <span className="flex-shrink-0 px-2.5 py-1 bg-[#C9A24D]/10 text-[#C9A24D] text-[10px] font-black uppercase tracking-widest rounded-full border border-[#C9A24D]/20">
                        Confirmed
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Customer Header */}
          <div className="bg-white dark:bg-[#151517] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 mb-6 relative overflow-hidden transition-colors animate-step-in">
            {/* Subtle Accent Bar - top edge only, not a left rail */}
            <div className="absolute left-0 right-0 top-0 h-1 bg-[#C9A24D]" />

            <div className="px-4 pb-3 pt-4 sm:px-6 sm:pb-3.5 sm:pt-4">
              {/* One row: the name with its one-line description right under it (left), and Live +
                  Emails side by side at the same height (right). Phones: name, then Live + Emails. */}
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 sm:gap-x-3">
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-lg font-black tracking-tight text-[#0B0B0B] dark:text-white sm:text-2xl">
                    <span className="sm:hidden">{visitorFirstName ? `${visitorFirstName}'s` : 'My'} Showcase</span>
                    <span className="hidden sm:inline">{visitorFullName || 'My'}&apos;s Showcase</span>
                  </h1>
                  <p className="mt-0.5 hidden text-xs font-medium leading-snug text-[#6B7280] dark:text-gray-400 sm:block">
                    A personalized collection of homes matched to your search - new listings and price changes show up here on their own.
                  </p>
                </div>

                {/* Same line as the name on every size - phones get the short two-line Live badge. */}
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  <LiveIndicator checkedAt={checkedAt} compact className="h-9 !px-2 sm:hidden" />
                  <LiveIndicator checkedAt={checkedAt} className="hidden h-9 !rounded-xl !py-0 !pl-2.5 !pr-3 sm:inline-flex" />
                  <div className="flex h-9 items-center gap-1.5 rounded-xl border border-[#C9A24D]/25 bg-[#C9A24D]/10 px-1.5 text-xs shadow-sm dark:border-gray-800/50 dark:bg-white/5 sm:gap-2 sm:px-3">
                    <span className={`font-black uppercase tracking-wide text-[9px] sm:text-[10px] whitespace-nowrap ${showcase.customer?.is_blacklisted ? 'text-[#9CA3AF] dark:text-gray-500' : 'text-[#8b7355] dark:text-[#e8cf8a]'}`}>Emails</span>
                    <button
                      onClick={() => {
                        if (!showcase.customer?.is_blacklisted) {
                          handleNotificationToggle()
                        }
                      }}
                      disabled={showcase.customer?.is_blacklisted}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent shadow-inner transition-colors duration-200 ease-in-out focus:outline-none ${
                        showcase.customer?.is_blacklisted
                          ? 'bg-gray-200 dark:bg-gray-800 cursor-not-allowed'
                          : (showcase.notifyVisitor ? 'bg-[#C9A24D]' : 'bg-gray-200 dark:bg-gray-700')
                      }`}
                      title={showcase.customer?.is_blacklisted ? "You have unsubscribed from property update emails." : (showcase.notifyVisitor ? 'Click to disable property update emails' : 'Click to enable property update emails')}
                    >
                      <motion.span
                        aria-hidden="true"
                        animate={{ x: (showcase.notifyVisitor && !showcase.customer?.is_blacklisted) ? 16 : 0 }}
                        transition={{ type: 'spring', stiffness: 600, damping: 32 }}
                        className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md ring-0"
                      />
                    </button>
                  </div>

                </div>
                {/* Phones: the description gets its own full-width line under the name row. */}
                <p className="basis-full text-xs font-medium leading-snug text-[#6B7280] dark:text-gray-400 sm:hidden">
                  Homes matched to your search - new listings and price changes show up on their own.
                </p>
              </div>
            </div>

            {/* Their search + the one big "Change your search" button, built into this header (it
                was its own card under it - three headers stacked looked busy). */}
            {searchBar}

            {/* Property Status Tabs - a full-width, even 4-column bar built into the very bottom
                edge of the header card (bleeds past the card's own padding via negative margins;
                the card's overflow-hidden + rounded-2xl clip it to match those corners for free),
                instead of a plain row of buttons sitting inside the card like everything else.
                Active-tab line is an inset box-shadow (not a border-collapse -mt-px overlap
                trick) so it can never depend on pixel-rounding across grid columns. */}
            <div className="-mx-px -mb-px grid grid-cols-4 divide-x divide-gray-200 border-t border-gray-200 bg-gray-50/70 dark:divide-gray-800 dark:border-gray-800 dark:bg-white/[0.03]">
              {[
                { key: 'all', label: 'Matches', count: tabCounts.all },
                { key: 'liked', label: 'Liked', count: tabCounts.liked },
                { key: 'disliked', label: 'Disliked', count: tabCounts.disliked },
                { key: 'sold_removed', label: 'Sold/Removed', short: 'Sold', count: tabCounts.soldRemoved }
              ].map((tab) => (
                <motion.button
                  key={tab.key}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`relative flex min-w-0 items-center justify-center gap-1.5 py-2.5 text-[11px] sm:text-sm font-bold transition-colors duration-200 ${
                    activeTab === tab.key
                      ? 'text-[#0B0B0B] dark:text-white'
                      : 'text-[#6B7280] hover:bg-white/60 dark:text-gray-400 dark:hover:bg-white/5'
                  }`}
                >
                  {activeTab === tab.key && (
                    <motion.span layoutId="showcase-tab" className="absolute inset-0 bg-white shadow-[inset_0_3px_0_0_#C9A24D] dark:bg-[#151517]" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
                  )}
                  <span className="relative truncate">{'short' in tab ? <><span className="sm:hidden">{tab.short}</span><span className="hidden sm:inline">{tab.label}</span></> : tab.label}</span>
                  <motion.span key={`${tab.count}-${tab.key === 'disliked' ? dislikedPulse : 0}`} initial={{ scale: 0.6, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }}
                    className={`relative shrink-0 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] ${
                    activeTab === tab.key
                      ? 'bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8cf8a]'
                      : 'bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-gray-400'
                  }`}>
                    {tab.count}
                    {tab.key === 'disliked' && dislikedPulse > 0 && (
                      <motion.span key={`ping-${dislikedPulse}`} aria-hidden className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-rose-400"
                        initial={{ opacity: 0.9, scale: 1 }} animate={{ opacity: 0, scale: 1.9 }} transition={{ duration: 0.9, ease: 'easeOut' }} />
                    )}
                  </motion.span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Professional Separator (desktop only - on a phone the slim sort row says enough) */}
          <div className="relative mb-4 hidden sm:block">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
            </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-[#FAFAF7] dark:bg-[#0B0B0B] px-4 text-[#6B7280] dark:text-gray-500 font-medium uppercase tracking-widest text-xs">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={activeTab} className="inline-block" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                  {activeTab === 'all' ? 'Matches' :
                     activeTab === 'liked' ? 'Liked Properties' :
                     activeTab === 'disliked' ? 'Disliked Properties' :
                     'Sold/Removed Properties'}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
        </div>

          {/* Property Grid - the reference property card and Sort both render on this same
              "Matched Properties" row now (compareInfo/sortControl), instead of as separate
              sections above. */}
          <div className="mb-32">
            <PropertyGrid
              properties={filteredProperties.map(p => {
                const st = tourState(latestTourFor(p.id))
                return st === 'none' ? p : { ...p, hasTourScheduled: true, tourStatus: st }
              })}
              title="Matched Properties"
              emptyState={activeTab === 'all' ? {
                title: 'No homes match your search yet',
                text: 'New listings that fit will show up here the moment they hit the market. Want to see more right away? Widen your search a little.',
                action: { label: 'Change your search', onClick: () => openCriteria('all') },
              } : { title: 'Nothing here yet', text: activeTab === 'liked' ? 'Tap the heart on a home you love and it will show up here.' : activeTab === 'disliked' ? 'Homes you pass on will show up here.' : 'Homes that sell or come off the market move here.' }}
              onLike={handlePropertyLike}
              onDislike={handlePropertyDislike}
              onPropertyClick={handlePropertyClick}
              onScheduleTour={handleScheduleTourClick}
              onCommentClick={handleOpenQuickComment}
              showNewForUnviewed={true}
              destination={radiusSearchPrefs ? { address: radiusSearchPrefs.address, lat: radiusSearchPrefs.lat, lng: radiusSearchPrefs.long } : undefined}
              compareProperty={compareProperty}
              sortControl={sortControlNode}
              phoneCompact
              animationKey={activeTab}
              recommendedBy={(showcase.agentFullName || showcase.agentName || '').split(' ')[0] || null}
            />
          </div>

          {/* Property Details Modal */}
          <PropertyDetailsModal
            tourRequest={selectedProperty ? latestTourFor(selectedProperty.id) : null}
            property={selectedProperty}
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onLike={handlePropertyLike}
            onDislike={handleDetailsDislike}
            onAddComment={handleAddComment}
            nav={detailsNav}
            move={homeMove}
            onScheduleTour={p => handleScheduleTourClick(p)}
            agent={{ name: showcase.agentFullName || showcase.agentName, photoUrl: showcase.agentPhotoUrl }}
            isLoadingDetails={isLoadingDetails}
            detailsError={detailsError}
            isLoadingComments={isLoadingComments}
            commentsError={commentsError}
          />

          {/* Quick Comment Modal - reply from the property card without opening full details */}
          <QuickCommentModal
            property={quickCommentProperty}
            isOpen={isQuickCommentOpen}
            onClose={handleCloseQuickComment}
            onAddComment={handleAddComment}
            isLoading={isLoadingQuickComments}
          />

          {/* Refine Search Modal */}
          <EditShowcaseCriteriaModal
            preferences={showcase.preferences && 'diameter' in showcase.preferences ? showcase.preferences : null}
            isOpen={isEditCriteriaOpen}
            onClose={() => setIsEditCriteriaOpen(false)}
            onSave={handleSaveCriteria}
            onSendMessage={handleSendRefineRequest}
            agent={{ name: showcase.agentFullName || showcase.agentName, email: showcase.agentEmail, phone: showcase.agentPhone, photoUrl: showcase.agentPhotoUrl }}
            // Shows whatever the showcase is actually comparing against right now, whether that's
            // an explicit override (compare_property_listing_key) or just the implicit open-house
            // property it was auto-created from - referencePoint already resolves both cases the
            // same way the backend's match-score badge does, so there's no reason to hide the
            // implicit one here just because no override happens to be set.
            currentCompareProperty={
              builtAround
                ? { listingKey: builtAround.listingKey, touredListingKey: builtAround.touredListingKey ?? null, address: builtAround.address, city: builtAround.city, state: (builtAround as any).state ?? null, image: builtAround.image }
                : null
            }
            hasExplicitCompareOverride={!!(showcase.preferences as any)?.compare_property_listing_key}
            focus={criteriaFocus}
            onRefineFurther={() => setCriteriaFocus('all')}
            preview={async (prefs) => {
              if (!shareToken) return null
              const { success, data } = await api.public.previewShowcaseMatches(shareToken, prefs)
              return success && data ? data : null
            }}
          />

          {/* A home's showing request: waiting on the agent / confirmed, and the times asked for */}
          <TourStatusWindow
            tour={tourStatusFor ? latestTourFor(tourStatusFor.id) : null}
            address={tourStatusFor?.FullStreetAddress?.split(',')[0] || null}
            agentName={showcase.agentFullName || showcase.agentName}
            onClose={() => setTourStatusFor(null)}
            onRequestAnother={() => { const p = tourStatusFor; setTourStatusFor(null); if (p) handleScheduleTourClick(p, true) }}
          />

          {/* Schedule Tour Modal */}
          <ScheduleTourModal
            property={selectedPropertyForTour}
            isOpen={isTourModalOpen}
            onClose={handleCloseTourModal}
            onSubmit={handleScheduleTourSubmit}
            loadBusy={() => api.public.getShowcaseBusy(showcase.id)}
            showContactFields={
              showcase?.customer?.firstName === 'Anonymous' || 
              showcase?.customer?.email === 'anonymous@visitor.com'
            }
          />

        </div>
      </div>

      {/* "Added to Passed" - centre of the screen, over everything, never in the way of a tap. */}
      <AnimatePresence>
        {passHint && (
          <motion.div key={passHint.key} role="status" aria-live="polite" className="pointer-events-none fixed inset-0 z-[130] grid place-items-center px-6"
            initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 1 }}>
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: reduceMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 480, damping: 30 } }}
              exit={reduceMotion ? { opacity: 0, transition: { duration: 0.15 } } : { opacity: 0, scale: 0.94, y: 18, transition: { duration: 0.24, ease: [0.4, 0, 1, 1] } }}
              className="flex items-center gap-3 rounded-2xl bg-[#111827] py-3 pl-3 pr-5 text-white shadow-[0_24px_60px_-18px_rgba(0,0,0,.7)] ring-1 ring-white/10"
            >
              <span className="relative h-11 w-11 shrink-0">
                {passHint.photo
                  ? <img src={passHint.photo} alt="" className="h-full w-full rounded-xl object-cover opacity-80 grayscale-[35%]" />
                  : <span className="grid h-full w-full place-items-center rounded-xl bg-white/10"><HomeIcon className="h-5 w-5 text-white/70" /></span>}
                <motion.span
                  initial={reduceMotion ? false : { scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0, transition: { delay: 0.12, type: 'spring', stiffness: 600, damping: 16 } }}
                  className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-white ring-2 ring-[#111827]"
                >
                  <X size={11} strokeWidth={3.5} />
                </motion.span>
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-black tracking-tight">Added to Passed</span>
                <span className="mt-0.5 block text-[11px] font-semibold text-white/55">Find it any time under Disliked</span>
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <MLSComplianceFooter />
    </div>
  )
}
