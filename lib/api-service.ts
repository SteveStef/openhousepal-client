import type { MarketingMoments, SiteSeo, ShowingStatus, ShowcaseInbox, EmailPerson, ClientEmailRow } from '@/types'
import type { DomainContact, DomainSearch, DomainShop, OneClick, PurchasedDomain } from '@/lib/domainShop'

// One "which home?" suggestion for a public showing request (any on-market listing, the agent's first).
export type PublicHomeSuggestion = {
  address: string; street?: string; city?: string | null; state?: string | null; zipcode?: string | null
  price?: number | null; status?: string | null; photo?: string | null; mine?: boolean; listing_key?: string
  beds?: number | null; baths?: number | null; sqft?: number | null
}
import { ApiResponse, User, OpenHouse, OpenHouseFormRequest, SearchPreferences, Notification, NotificationResponse, NotificationPreferences, AgentFormConfig, FormCampaign, CampaignLookup, PublicFormConfig, PublicFormSummary, FormSubmissionListItem, MyListingsResponse, MyListingItem, ManualListingPayload, HostRequest, CreateHostRequestPayload, CreateHostRequestResult, ListingDetail, ListingHostNote, CounterHostRequestPayload, AgentSearchResult, TeamMember, TeamMembership, Broadcast, IncomingBroadcast, CreateBroadcastPayload, IncomingTeamInvite, TrustedHost, HostRequestEvent, CounterBackPayload, RespondToBroadcastPayload, NearbyAmenitiesResponse, BrandKit, DesignProject, DesignProjectCreatePayload, DesignBlock, Site, SiteDomain, SiteBlock, SitePage, SiteTheme, FeaturedSettings, MediaSettings, PropertyWebsite, PropertyWebsiteDraft, PropertyWebsiteAnalytics, Blog, BlogListItem, BlogBlock, BlogAnalytics, PublicBlogSummary, PublicBlogDetail, LinkedProperty, Lead, LeadDetail, LeadOpenHouse, LeadStatus, LeadRepresented, LeadSourceFilter, LeadSort, LeadNote, StatSummary, StatHistory, StatMetric, FormStats, UnfinishedFormResponse, CmaReport, CmaReportListItem, CmaMode, CmaStatus, CmaSubjectProperty, CmaComparable, CmaPricing, CmaMarketContext, CmaImprovement, CmaPresentationSettings, CmaCompSearchParams, CmaCompCandidate, CmaShareResponse, CmaPublicResponse, CmaSubjectArea, CmaLocatedAddress, FinancialToolStatus,
  SellerNetSheet, SellerNetSheetListItem, SnsProperty, SnsScenario, SnsLineItem, SnsCompensation, SnsTaxProration, SellerNetSheetPublicResponse,
  BuyerCashNeeded, BuyerCashNeededListItem, BcnProperty, BcnAmount, BcnDownPaymentScenario, BcnLoanType, BcnLineItem, BcnCredits, BcnMonthlyContext, BuyerCashNeededPublicResponse,
  AIConversationListItem, AIConversation, AISendMessageResponse, AIInsightsResponse, DailyDigest,
  AIAdminOverview, AIAdminAgentSummary, AIAdminAgentDetail,
  AdminStorageAgentSummary, AdminActivityOverview, AdminActivityAgentDetail, BillingGroup, BillingGroupInput, PromoCode, PromoCodeInput, PayPalPlanTerms, CheckoutCode, AdminStorageAgentDetail,
  AIRealtimeSessionOut, AIRealtimeToolCallResult, AgentMarketArea, CollectionPreferences,
  SupportTicketDetail, SupportTicketListItem, AdminSupportTicketListItem, SupportTicketCategory, SupportTicketDetails, SavedManualProperty, PublicQuestion,
  StudioMediaAsset, StudioMediaGeneratePayload, StudioVideoTestGridPayload, StudioVideoTestGridResponse, MonthlyAiUsage,
  AgentTask, TaskCounts, TaskCreateInput, TaskUpdateInput, CalendarFeedInfo, AutoFollowupRule, FollowupSettings, FollowupAlerts, PublicFollowup, PublicFollowupText,
  IntegrationsInfo, CrmTestResult,
  TitleCardOptions, BrandingOptions, BlogAiContext, BlogAiBrief, BlogAiGenerateResult, BlogAiRefineAction, LinkDomainState } from '@/types';
import { getToken, removeToken } from './token';
import { tidyAllCaps } from './cheatSheetContent';

/** Something wrong with an agent's own domain right now, in plain words + the fix (domain_health_service). */
export type DomainIssue = { hostname: string; code: string; title: string; fix: string; since: string }
export type OldLink = {
  id: string; source_path: string; target_path: string | null; confidence: number; match_reason: string | null
  is_enabled: boolean; agent_approved: boolean; last_seen_at: string | null
}
export type OldLinksPayload = {
  domain: string | null
  scan: { status?: 'running' | 'done' | 'failed'; found?: number | null; matched?: number | null; error?: string | null; finished_at?: string | null } | null
  redirects: OldLink[]
  targets: { path: string; label: string; group: string }[]
}
export type AdminDomainIssue = DomainIssue & { agent_id: string; agent_name: string; agent_email: string; brokerage?: string | null }

export interface PlanImpact {
  active_showcases: number;
  showcase_clients: number;
  forms: number;
  open_houses: number;
  agent_hub_slug: string | null;
  has_signature: boolean;
  idx_site_published: boolean;
  spotlights_published: number;
  blogs_published: number;
  designs: number;
  media_assets: number;
  reviews: number;
  calendar_connected: boolean;
}

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Uploaded media (brand logos, blog covers, design photos, etc.) is stored as a
// backend-relative path like "/uploads/studio-media/xxx.png". The frontend and
// backend run on different origins/ports, so it must be resolved against the API
// host before use as an <img src>. Absolute URLs (MLS photos, data URLs) pass through.
export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) return url;
  // The site's own static files (public/demos - homepage demo photos) live on the frontend, not the API.
  if (url.startsWith('/demos/')) return url;
  return `${API_BASE_URL}${url}`;
}

class ApiService {
  // The Showcase's own agent opened the client link while signed in: their likes / comments /
  // requests there go out signed (the server files them as the agent's, not the client's).
  private publicAsOwner = false

  private async request<T>(endpoint: string, options: RequestInit = {}, includeToken: boolean = true): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = includeToken ? getToken() : null;
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    const headers: HeadersInit = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });

      // Attempt to parse JSON, handle empty responses
      let data;
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (response.status === 401) {
        const isAuthPage = typeof window !== 'undefined' &&
          (window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/register'));

        if (!isAuthPage) {
          this.handleUnauthorized();
          return { success: false, error: 'Session expired. Please log in again.' };
        }
      }

      if (!response.ok) {
        let errorMessage = 'Request failed';

        if (typeof data?.detail === 'string') {
          errorMessage = data.detail;
        } else if (Array.isArray(data?.detail)) {
          // Handle Pydantic validation errors: [{msg: '...', loc: [...]}]
          errorMessage = data.detail.map((err: any) => err.msg).join(', ');
        } else if (data?.message) {
          errorMessage = data.message;
        } else {
          errorMessage = `Error: ${response.status}`;
        }

        return {
          success: false,
          error: errorMessage,
          status: response.status,
        };
      }

      return { success: true, data };
    } catch (error) {
      console.error(`API Request failed [${endpoint}]:`, error);
      return {
        success: false,
        error: 'Network error. Please check your connection.',
      };
    }
  }

  private handleUnauthorized() {
    removeToken();
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (!path.startsWith('/login') && !path.startsWith('/register')) {
        window.location.href = `/login?redirect=${encodeURIComponent(path)}`;
      }
    }
  }

  private transformNotification(backend: NotificationResponse): Notification {
    return {
      id: backend.id,
      type: backend.type,
      referenceId: backend.reference_id,
      title: backend.title,
      message: backend.message,
      visitorName: backend.visitor_name || undefined,
      propertyAddress: tidyAllCaps(backend.property_address) || undefined,
      collectionId: backend.collection_id || '',
      collectionName: backend.collection_name || undefined,
      propertyId: backend.property_id || undefined,
      link: backend.link || undefined,
      isRead: backend.is_read,
      readAt: backend.read_at || undefined,
      timestamp: backend.created_at,
    };
  }

  /**
   * Authentication Namespace
   */
  public auth = {
    me: () => this.request<User>('/auth/me'),

    login: (credentials: any) => this.request<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

    sendVerificationCode: (formData: any) => this.request('/auth/send-verification-code', {
      method: 'POST',
      body: JSON.stringify(formData),
    }),

    verifyCode: (email: string, code: string) => this.request<{ access_token: string }>('/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

    resendVerificationCode: (email: string) => this.request('/auth/resend-verification-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

    verifyBundleCode: (code: string) => this.request<CheckoutCode>('/auth/verify-bundle-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

    // A "billed by us" code: switches the account on with no PayPal.
    redeemCode: (code: string) => this.request<{ success: boolean; plan_tier: string; subscription_status: string }>('/auth/redeem-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

    linkSubscription: (subscriptionId: string, planId: string, bundleCode?: string) => {
      let url = `/auth/link-subscription?subscription_id=${encodeURIComponent(subscriptionId)}&plan_id=${encodeURIComponent(planId)}`;
      if (bundleCode) url += `&bundle_code=${encodeURIComponent(bundleCode)}`;
      return this.request(url, { method: 'POST' });
    },

    logout: () => {
      removeToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    },

    requestPasswordReset: (email: string) => this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

    resetPassword: (password: string, token: string) => this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ new_password: password, token }),
    }),

    changePassword: (currentPassword: string, newPassword: string) =>
      this.request<{ message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      }),
  };

  /**
   * Properties Namespace
   */
  public properties = {
    getById: async (id: string) => {
      const response = await this.request<{ property: any }>(`/api/properties/${id}/cache`);
      if (response.success && response.data?.property) {
        return { ...response, data: response.data.property };
      }
      return response;
    },
    getByQR: (qrCode: string) => this.request<any>(`/api/open-house/property/${qrCode}`),

    lookup: (query: string | { listingKey: string }) => this.request<any>('/api/properties/lookup', {
      method: 'POST',
      body: JSON.stringify(typeof query === 'string' ? { address: query } : { listing_key: query.listingKey }),
    }),

    getNearbyAmenities: (listingKey: string) =>
      this.request<NearbyAmenitiesResponse>(`/api/properties/${encodeURIComponent(listingKey)}/nearby-amenities`),

    // this is used for the OHP kit
    address: async (address: string, opts?: { activeOnly?: boolean; excludeRentals?: boolean }) => {
      const params = new URLSearchParams({ query: address });
      if (opts?.activeOnly) params.set('active_only', 'true');
      if (opts?.excludeRentals) params.set('exclude_rentals', 'true');
      return this.request<{ results: { address: string, lat: number, lng: number, image?: string | null, status?: string | null, price?: number | null }[] }>(`/api/properties/address?${params.toString()}`);
    },
    // this is for searching brokerages
    brokerages: async (brokerage: string) => this.request<{results: string[]}>(`/api/properties/brokerages?query=${encodeURIComponent(brokerage)}`),
    cities: async (city: string) => this.request<{results: string[]}>(`/api/properties/cities?query=${encodeURIComponent(city)}`),
    townships: async (township: string) => this.request<{results: string[]}>(`/api/properties/townships?query=${encodeURIComponent(township)}`),
    counties: async (query: string) => this.request<{results: string[]}>(`/api/properties/counties?query=${encodeURIComponent(query)}`),
    // Real Census lines for a Showcase's towns / school districts / counties (the editor map highlight).
    // A client editing their own search (no sign-in) - same lines, public route.
    areaShapesPublic: async (sel: { cities?: string[]; school_districts?: string[]; counties?: string[] }) => {
      const q = new URLSearchParams()
      ;(sel.cities || []).forEach(v => q.append('cities', v))
      ;(sel.school_districts || []).forEach(v => q.append('school_districts', v))
      ;(sel.counties || []).forEach(v => q.append('counties', v))
      return this.request<{ shapes: { kind: 'town' | 'school_district' | 'county'; label: string; query: string; rings: number[][][]; zips?: string[] | null }[] }>(`/api/properties/area-shapes/public?${q.toString()}`, {}, false)
    },
    // One home's township / neighbours / school district for a property map (components/maps/HomeAreaMap).
    homeAreasPublic: async (lat: number, lng: number) =>
      this.request<{ municipality: { name: string; geoid: string; rings: number[][][] } | null; neighbors: { name: string; geoid: string; rings: number[][][] }[]; school_districts: { name: string; geoid: string; rings: number[][][] }[] }>(
        `/api/properties/home-areas/public?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`, {}, false),
    areaShapes: async (sel: { cities?: string[]; school_districts?: string[]; counties?: string[] }) => {
      const q = new URLSearchParams()
      ;(sel.cities || []).forEach(v => q.append('cities', v))
      ;(sel.school_districts || []).forEach(v => q.append('school_districts', v))
      ;(sel.counties || []).forEach(v => q.append('counties', v))
      return this.request<{ shapes: { kind: 'town' | 'school_district' | 'county'; label: string; query: string; rings: number[][][]; zips?: string[] | null }[] }>(`/api/properties/area-shapes?${q.toString()}`)
    },
    // Unauthenticated variants for public-facing forms (visitors aren't logged in)
    // Public "which home?" suggestions (Schedule a Showing) - any on-market listing, the form owner's first.
    addressesPublic: async (query: string, formId?: string) => this.request<{ results: PublicHomeSuggestion[] }>(`/api/properties/addresses/public?query=${encodeURIComponent(query)}${formId ? `&form_id=${encodeURIComponent(formId)}` : ''}`, {}, false),
    citiesPublic: async (city: string) => this.request<{results: string[]}>(`/api/properties/cities/public?query=${encodeURIComponent(city)}`),
    schoolDistrictsPublic: async (query: string) => this.request<{results: string[]}>(`/api/properties/school-districts/public?query=${encodeURIComponent(query)}`),
    countiesPublic: async (query: string) => this.request<{results: string[]}>(`/api/properties/counties/public?query=${encodeURIComponent(query)}`),
    // Listing search-by-address for the "compare to a different property" picker on the public
    // showcase page - includes listingKey/city/beds/baths/sqft in one shot (see /address/public).
    addressPublic: async (address: string) => this.request<{ results: { listingKey: string, address: string, city?: string | null, lat: number, lng: number, image?: string | null, status?: string | null, price?: number | null, beds?: number | null, baths?: number | null, squareFeet?: number | null }[] }>(`/api/properties/address/public?query=${encodeURIComponent(address)}`),

    findSimilar: (params: SearchPreferences & { listingKey?: string, city?: string, state?: string, zipcode?: string, price?: number, bedrooms?: number, lat?: number, lng?: number }) =>
      this.request<{ properties: any[] }>('/api/properties/similar', {
        method: 'POST',
        body: JSON.stringify(params),
      }),

    searchSchoolDistricts: (query: string) =>
      this.request<{ results: string[] }>(`/api/properties/school-districts?query=${encodeURIComponent(query)}`),

    submitPropertyVisit: (data: any) => this.request('/property-visit/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

    getPropertyForAgent: async (propertyId: string, agentId: string) => {
      const response = await this.request<{ property: any, agentName: string, agentPhotoUrl?: string | null, agentBrokerage?: string | null, spotlightUrl?: string | null, expectedOnMarketDate?: string | null, priceHistory?: any[] }>(`/api/properties/agent/${agentId}/listing/${propertyId}`, {}, false);
      if (response.success && response.data?.property) {
        return {
          ...response,
          data: {
            ...response.data.property,
            agentName: response.data.agentName,
            agentPhotoUrl: response.data.agentPhotoUrl ?? null,
            agentBrokerage: response.data.agentBrokerage ?? undefined,
            spotlightUrl: response.data.spotlightUrl ?? undefined,
            expectedOnMarketDate: response.data.expectedOnMarketDate ?? null,
            priceHistory: response.data.priceHistory ?? [],
          }
        };
      }
      return response;
    },

    sendMessageToAgent: (data: {
      agentId: string,
      propertyId: string,
      propertyAddress: string,
      visitorName: string,
      visitorContact: string,
      visitorPhone?: string,
      message: string,
      cameFrom?: { src?: string; oh?: string; ref?: string }
    }) => this.request<{ success: boolean; message: string }>('/api/properties/message-agent', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: data.agentId,
        property_id: data.propertyId,
        property_address: data.propertyAddress,
        visitor_name: data.visitorName,
        visitor_contact: data.visitorContact,
        visitor_phone: data.visitorPhone || undefined,
        message: data.message,
        came_from: data.cameFrom,
      }),
    }),

    /** An agent's busy blocks (start/end only) for the Listing Page's showing window. */
    getAgentBusy: async (agentId: string) => {
      const r = await this.request<{ busy: { start: string; end: string }[] }>(`/api/properties/agent/${agentId}/busy`, {}, false)
      return r.success && r.data ? r.data.busy : []
    },

    scheduleTour: (data: any & { agentId: string }) =>
      this.request<{ success: boolean; message: string }>('/api/properties/schedule-tour', {
        method: 'POST',
        body: JSON.stringify({
          agent_id: data.agentId,
          property_id: data.propertyId,
          property_address: data.propertyAddress,
          visitor_name: data.visitorName,
          visitor_contact: data.visitorContact,
          visitor_phone: data.visitorPhone || undefined,
          preferred_date: data.preferredDate,
          preferred_time: data.preferredTime,
          preferred_date_2: data.preferredDate2,
          preferred_time_2: data.preferredTime2,
          preferred_date_3: data.preferredDate3,
          preferred_time_3: data.preferredTime3,
          message: data.message,
          came_from: data.cameFrom,
        }),
      }),
  };

  public discovery = {
    get: () => this.request<{ success: boolean; data: any[]; preferences: any }>('/api/discovery'),
    patchPreferences: (preferences: any) => this.request<{ success: boolean; data: any[]; preferences: any }>('/api/discovery/preferences', {
      method: 'PATCH',
      body: JSON.stringify(preferences),
    }),
  }

  /**
   * Open Houses Namespace
   */
  public openHouses = {
    getAll: () => this.request<OpenHouse[]>('/api/open-houses'),

    getByListingKey: (listingKey: string) => this.request<OpenHouse[]>(`/api/open-houses?listing_key=${encodeURIComponent(listingKey)}`),

    getById: (id: string) => this.request<OpenHouse>(`/api/open-houses/${id}`),

    create: (data: Partial<OpenHouse>) => this.request<OpenHouse>('/api/open-houses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

    // What a new kit's Showcases + Similar Homes start at for this home: off when you're its
    // listing (or co-listing) agent, on otherwise.
    guestDefaults: (listingKey?: string | null) => this.request<{ own_listing: boolean; auto_showcase: boolean; similar_homes: boolean }>(
      `/api/open-houses/guest-defaults${listingKey ? `?listing_key=${encodeURIComponent(listingKey)}` : ''}`),

    delete: (id: string) => this.request(`/api/open-houses/${id}`, {
      method: 'DELETE',
    }),

    updateNote: (id: string, notes: string) => this.request(`/api/open-houses/${id}/note`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    }),

    updateQrDarkMode: (id: string, qrDarkMode: boolean) => this.request(`/api/open-houses/${id}/qr-dark-mode`, {
      method: 'PUT',
      body: JSON.stringify({ qr_dark_mode: qrDarkMode }),
    }),

    // Hosting-agent-only, per open house: whether the listing agent (when different from the
    // host) can see actual guest name/email/phone on top of the basic anonymous counts they
    // always see. Off by default.
    updateShareGuests: (id: string, shareGuestsWithListingAgent: boolean) => this.request<{ success: boolean; share_guests_with_listing_agent: boolean }>(`/api/open-houses/${id}/share-guests`, {
      method: 'PUT',
      body: JSON.stringify({ share_guests_with_listing_agent: shareGuestsWithListingAgent }),
    }),

    // Per open house: auto-build Showcases for guests without an agent, and where a guest's phone
    // goes after they sign in (their Spotlight / Agent Hub / nothing). Either field alone is fine.
    updateGuestSettings: (id: string, settings: { auto_showcase?: boolean; similar_homes?: boolean; after_signin?: 'hub' | 'none'; guest_pass?: boolean; pass_signature?: boolean; followups_mode?: 'on' | 'no_calendar' | 'off' }) =>
      this.request<{ success: boolean; auto_showcase: boolean; similar_homes: boolean; after_signin: string | null; guest_pass: boolean; pass_signature: boolean }>(`/api/open-houses/${id}/guest-settings`, {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),

    updateSnapshot: (id: string, snapshot: any[]) => this.request(`/api/open-houses/${id}/snapshot`, {
      method: 'PATCH',
      body: JSON.stringify({ similar_properties_snapshot: snapshot }),
    }),

    refreshSnapshot: (id: string) => this.request<{ success: boolean; similarPropertiesSnapshot: any[]; removedCount: number; updatedCount: number }>(`/api/open-houses/${id}/snapshot/refresh`, {
      method: 'POST',
    }),

    updateCheatSheetSnapshot: (id: string, snapshot: any) => this.request(`/api/open-houses/${id}/cheat-sheet-snapshot`, {
      method: 'PATCH',
      body: JSON.stringify({ cheat_sheet_snapshot: snapshot }),
    }),

    // Clears the frozen cheat-sheet-snapshot server-side too, so the next preview rebuilds fresh
    // from these photos instead of serving the old frozen one.
    updateCheatSheetPhotos: (id: string, photos: any[]) => this.request(`/api/open-houses/${id}/cheat-sheet-photos`, {
      method: 'PATCH',
      body: JSON.stringify({ cheat_sheet_photos: photos }),
    }),

    getVisitors: (id: string) => this.request<any[]>(`/api/open-houses/${id}/visitors`),

    getFormRequests: () => this.request<OpenHouseFormRequest[]>('/api/open-houses/form-requests'),

    // Basic agents: guests without an agent (last 90 days) who'd have gotten a Showcase + invite
    // on Premium - and do get one automatically the moment the agent upgrades.
    getMissedShowcases: () => this.request<{
      count: number;
      recent: { visitor_id: string; name: string; email: string; property_address?: string; signed_in_at?: string }[];
      window_days: number;
      upgrade_eligible: boolean;
      backfilling: boolean;
    }>('/api/open-houses/missed-showcases'),

    completeFormRequest: (requestId: string) => this.request<OpenHouseFormRequest>(`/api/open-houses/form-requests/${requestId}/complete`, {
      method: 'PATCH',
    }),

    updateVisitorNote: (visitorId: string, notes: string) => this.request(`/api/visitors/${visitorId}/note`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    }),

    getVisitorNotes: (visitorId: string) => this.request<LeadNote[]>(`/api/visitors/${visitorId}/notes`),
    addVisitorNote: (visitorId: string, data: { text: string; open_house_event_id?: string }) =>
      this.request<LeadNote>(`/api/visitors/${visitorId}/notes`, { method: 'POST', body: JSON.stringify(data) }),
    updateVisitorNoteThread: (noteId: string, text: string) =>
      this.request<LeadNote>(`/api/visitors/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify({ text }) }),
    deleteVisitorNoteThread: (noteId: string) =>
      this.request<{ success: boolean }>(`/api/visitors/notes/${noteId}`, { method: 'DELETE' }),
  };

  /**
   * Open House Manager Namespace (My Listings, host requests, per-listing insights/notes)
   */
  public openHouseManager = {
    getMyListings: () => this.request<MyListingsResponse>('/api/open-house-manager/my-listings'),

    getListingStatuses: (listingKeys: string[]) =>
      this.request<Record<string, { status: 'needs_host' | 'scheduled', scheduled_date?: string | null, scheduled_start_time?: string | null, scheduled_end_time?: string | null }>>(`/api/open-house-manager/listing-status?listing_keys=${encodeURIComponent(listingKeys.join(','))}`),

    getHostRequests: (statusFilter: string = 'pending') =>
      this.request<HostRequest[]>(`/api/open-house-manager/host-requests?status=${encodeURIComponent(statusFilter)}`),

    getMyRequests: () => this.request<HostRequest[]>('/api/open-house-manager/my-requests'),

    getActionCounts: () => this.request<{ pending_as_listing_agent: number, countered_as_host: number, listing_agent_unseen_updates: number, host_unseen_updates: number, pending_incoming_broadcasts: number }>('/api/open-house-manager/action-counts'),

    createRequest: (payload: CreateHostRequestPayload) => this.request<CreateHostRequestResult>('/api/open-house-manager/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

    approveRequest: (requestId: string) => this.request<HostRequest>(`/api/open-house-manager/host-requests/${requestId}/approve`, {
      method: 'POST',
    }),

    declineRequest: (requestId: string) => this.request<HostRequest>(`/api/open-house-manager/host-requests/${requestId}/decline`, {
      method: 'POST',
    }),

    // Cancels an already-approved date - identified by (listing, host, date) rather than a
    // request id, since the Scheduled Opens list mixes built-kit previews (id = the
    // OpenHouseEvent) with kit-less previews (id = the request).
    cancelApprovedOpen: (listingKey: string, hostingAgentId: string, scheduledDate: string, scheduledStartTime?: string | null, scheduledEndTime?: string | null) =>
      this.request<{ success: boolean }>(`/api/open-house-manager/listings/${encodeURIComponent(listingKey)}/cancel-approved`, {
        method: 'POST',
        body: JSON.stringify({
          hosting_agent_id: hostingAgentId,
          scheduled_date: scheduledDate,
          scheduled_start_time: scheduledStartTime || undefined,
          scheduled_end_time: scheduledEndTime || undefined,
        }),
      }),

    counterRequest: (requestId: string, payload: CounterHostRequestPayload) => this.request<HostRequest>(`/api/open-house-manager/host-requests/${requestId}/counter`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

    acceptCounter: (requestId: string) => this.request<HostRequest>(`/api/open-house-manager/host-requests/${requestId}/counter/accept`, {
      method: 'POST',
    }),

    declineCounter: (requestId: string) => this.request<HostRequest>(`/api/open-house-manager/host-requests/${requestId}/counter/decline`, {
      method: 'POST',
    }),
    // The host takes back a request, or backs out of an open they were confirmed for.
    withdrawRequest: (requestId: string) => this.request<HostRequest>(`/api/open-house-manager/host-requests/${requestId}/withdraw`, {
      method: 'POST',
    }),
    // Asked directly to host and can't.
    declineDirectAsk: (broadcastId: string) => this.request<null>(`/api/open-house-manager/team/broadcasts/${broadcastId}/decline`, {
      method: 'POST',
    }),

    counterBack: (requestId: string, payload: CounterBackPayload) => this.request<HostRequest>(`/api/open-house-manager/host-requests/${requestId}/counter-back`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

    getRequestHistory: (requestId: string) => this.request<HostRequestEvent[]>(`/api/open-house-manager/host-requests/${requestId}/history`),

    searchAgents: (q: string) => this.request<AgentSearchResult[]>(`/api/open-house-manager/team/search-agents?q=${encodeURIComponent(q)}`),

    getTeamMembers: () => this.request<TeamMember[]>('/api/open-house-manager/team/members'),

    // Every OTHER agent's team the current agent is an accepted member of - can be more than one,
    // there's no cap on how many teams an agent can join. Powers Discovery's Team filter.
    getMyTeamMemberships: () => this.request<TeamMembership[]>('/api/open-house-manager/team/memberships'),

    addTeamMember: (identifier: string) => this.request<TeamMember>('/api/open-house-manager/team/members', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    }),

    removeTeamMember: (memberId: string) => this.request<null>(`/api/open-house-manager/team/members/${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
    }),

    getIncomingTeamInvites: () => this.request<IncomingTeamInvite[]>('/api/open-house-manager/team/invites/incoming'),

    acceptTeamInvite: (memberId: string) => this.request<IncomingTeamInvite>(`/api/open-house-manager/team/invites/${encodeURIComponent(memberId)}/accept`, {
      method: 'POST',
    }),

    declineTeamInvite: (memberId: string) => this.request<IncomingTeamInvite>(`/api/open-house-manager/team/invites/${encodeURIComponent(memberId)}/decline`, {
      method: 'POST',
    }),

    updateRestriction: (restrictHostRequestsToTeam: boolean) => this.request<null>('/api/open-house-manager/team/restriction', {
      method: 'PUT',
      body: JSON.stringify({ restrict_host_requests_to_team: restrictHostRequestsToTeam }),
    }),

    getHostedBefore: () => this.request<TrustedHost[]>('/api/open-house-manager/team/hosted-before'),

    // windowDate = one hosted day's sign-ins (a host reuses one evergreen kit for every date).
    getSharedGuests: (eventId: string, windowDate?: string | null) => this.request<any[]>(`/api/open-house-manager/events/${encodeURIComponent(eventId)}/guests${windowDate ? `?date=${windowDate}` : ''}`),

    getMyBroadcasts: () => this.request<Broadcast[]>('/api/open-house-manager/team/broadcasts/mine'),

    getIncomingBroadcasts: () => this.request<IncomingBroadcast[]>('/api/open-house-manager/team/broadcasts/incoming'),

    createBroadcast: (payload: CreateBroadcastPayload) => this.request<Broadcast>('/api/open-house-manager/team/broadcasts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

    respondToBroadcast: (broadcastId: string, payload?: RespondToBroadcastPayload) => this.request<HostRequest>(`/api/open-house-manager/team/broadcasts/${broadcastId}/respond`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),

    cancelBroadcast: (broadcastId: string) => this.request<null>(`/api/open-house-manager/team/broadcasts/${broadcastId}`, {
      method: 'DELETE',
    }),

    getListingDetail: (listingKey: string) => this.request<ListingDetail>(`/api/open-house-manager/listings/${encodeURIComponent(listingKey)}`),

    saveListingNotes: (listingKey: string, payload: { notes?: string; is_priority_override?: boolean }) =>
      this.request<ListingHostNote>(`/api/open-house-manager/listings/${encodeURIComponent(listingKey)}/notes`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),

    uploadManualListingPhoto: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return this.request<{ photo_url: string }>('/api/open-house-manager/my-listings/manual/photo', {
        method: 'POST',
        body: formData,
      });
    },

    addManualListing: (payload: ManualListingPayload) => this.request<MyListingItem>('/api/open-house-manager/my-listings/manual', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

    removeManualListing: (listingKey: string) => this.request<null>(`/api/open-house-manager/my-listings/manual/${encodeURIComponent(listingKey)}`, {
      method: 'DELETE',
    }),

    refreshListings: () => this.request<{ status: 'started' }>('/api/open-house-manager/refresh-listings', {
      method: 'POST',
    }),
  };

  /**
   * PayPal & Subscription Namespace
   */
  public paypal = {
    completeNew: (subscriptionId: string) => this.request<{ message: string }>('/subscriptions/complete-new', {
      method: 'POST',
      body: JSON.stringify({ subscription_id: subscriptionId }),
    }),

    // Generalized plan change (was separate /upgrade and /downgrade endpoints for
    // Basic<->Premium only) - targetTier is a PlanTier value ('NO_MLS' | 'PRO_NO_MLS' |
    // 'BASIC' | 'PREMIUM' | 'IDX').
    changePlan: (targetTier: string, code?: string | null) => this.request<any>('/subscriptions/change-plan', {
      method: 'POST',
      body: JSON.stringify({ target_tier: targetTier, code: code || undefined }),
    }),

    cancel: () => this.request<{ message: string }>('/subscriptions/cancel', { method: 'POST' }),

    // Live, client-facing footprint used to warn concretely before a downgrade/cancel.
    getImpact: () => this.request<PlanImpact>('/subscriptions/impact'),

    reactivate: () => this.request('/subscriptions/reactivate', { method: 'POST' }),

    // The plan's real terms from PayPal (trial days, monthly price, setup fee).
    planTerms: (planId: string) => this.request<{ trial_days: number; price: number | null; setup_fee: number; status?: string }>(`/subscriptions/plan-terms?plan_id=${encodeURIComponent(planId)}`),

    // Re-read the subscription from PayPal now (back from approving a plan change).
    sync: () => this.request<{ success: boolean; plan_tier?: string; status?: string }>('/subscriptions/sync', { method: 'POST' }),

    createNew: (planTier: 'NO_MLS' | 'PRO_NO_MLS' | 'BASIC' | 'PREMIUM' | 'IDX', code?: string | null) => this.request<any>('/subscriptions/create-new', {
      method: 'POST',
      body: JSON.stringify({ plan_tier: planTier, code: code || undefined }),
    }),
  };

  /**
   * Admin Namespace
   */
  public admin = {
    getUsers: () => this.request<User[]>('/admin/users'),

    toggleAuthorization: (userId: string, currentStatus: boolean) =>
      this.request<{ success: boolean }>(`/admin/users/${userId}/authorize?authorized=${!currentStatus}`, {
        method: 'PATCH',
      }),

    updatePlanTier: (userId: string, planTier: string) =>
      this.request<{ success: boolean }>(`/admin/users/${userId}/plan?plan_tier=${planTier}`, {
        method: 'PATCH',
      }),

    getAIOverview: () => this.request<AIAdminOverview>('/admin/ai/overview'),

    getAIAgents: (period: 'month' | 'all' = 'month') =>
      this.request<AIAdminAgentSummary[]>(`/admin/ai/agents?period=${period}`),

    getAIAgentDetail: (ownerId: string) => this.request<AIAdminAgentDetail>(`/admin/ai/agents/${ownerId}`),

    // Every feature failure we already record (AI calls, CMA generations, AI Media, emails,
    // connections) - see backend admin_failures_service.py.
    getRecentFailures: (days = 14, includeLimits = false) =>
      this.request<import('@/types').AdminFailuresResponse>(`/admin/ai/failures?days=${days}&include_limits=${includeLimits}`),

    getStorageAgents: () => this.request<AdminStorageAgentSummary[]>('/admin/storage/agents'),
    /** Agent activity tracker - every agent's usage (counts only, never their clients' details). */
    getActivity: () => this.request<AdminActivityOverview>('/admin/activity'),
    /** Agents whose own domain isn't working right now. */
    getDomainIssues: () => this.request<{ issues: AdminDomainIssue[] }>('/admin/domain-issues'),
    getActivityAgent: (agentId: string) => this.request<AdminActivityAgentDetail>(`/admin/activity/agents/${agentId}`),
    /** Brokerage groups - agents paid for by their brokerage on a custom deal. */
    getGroups: () => this.request<BillingGroup[]>('/admin/groups'),
    createGroup: (data: BillingGroupInput) => this.request<BillingGroup>('/admin/groups', { method: 'POST', body: JSON.stringify(data) }),
    updateGroup: (id: string, data: BillingGroupInput) => this.request<BillingGroup>(`/admin/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteGroup: (id: string) => this.request<{ success: boolean }>(`/admin/groups/${id}`, { method: 'DELETE' }),
    addGroupMembers: (id: string, userIds: string[], applyPlan = true) =>
      this.request<BillingGroup>(`/admin/groups/${id}/members`, { method: 'POST', body: JSON.stringify({ user_ids: userIds, apply_plan: applyPlan }) }),
    removeGroupMember: (id: string, userId: string) => this.request<BillingGroup>(`/admin/groups/${id}/members/${userId}`, { method: 'DELETE' }),
    applyGroupPlan: (id: string) => this.request<BillingGroup>(`/admin/groups/${id}/apply-plan`, { method: 'POST' }),

    getPromoCodes: () => this.request<PromoCode[]>('/admin/promo-codes'),
    getPromoPlans: () => this.request<{ plan_tier: string; plan_id: string; label: string }[]>('/admin/promo-codes/plans'),
    checkPromoPlan: (planId: string) => this.request<PayPalPlanTerms>(`/admin/promo-codes/plan-check?plan_id=${encodeURIComponent(planId)}`),
    createPromoCode: (data: PromoCodeInput) => this.request<PromoCode>('/admin/promo-codes', { method: 'POST', body: JSON.stringify(data) }),
    updatePromoCode: (id: string, data: PromoCodeInput) => this.request<PromoCode>(`/admin/promo-codes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deletePromoCode: (id: string) => this.request<{ success: boolean }>(`/admin/promo-codes/${id}`, { method: 'DELETE' }),

    getStorageAgentDetail: (ownerId: string) => this.request<AdminStorageAgentDetail>(`/admin/storage/agents/${ownerId}`),

    getSupportTickets: () => this.request<AdminSupportTicketListItem[]>('/admin/support/tickets'),

    getSupportTicket: (ticketId: string) => this.request<SupportTicketDetail>(`/admin/support/tickets/${ticketId}`),

    replySupportTicket: (ticketId: string, body: string) =>
      this.request<SupportTicketDetail>(`/admin/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),

    updateSupportTicketStatus: (ticketId: string, status: 'open' | 'closed') =>
      this.request<SupportTicketDetail>(`/admin/support/tickets/${ticketId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    getSupportUnreadCount: () => this.request<{ unread_count: number }>('/admin/support/tickets/unread-count'),

    getPublicQuestions: () => this.request<PublicQuestion[]>('/admin/public-questions'),

    getPublicQuestionsUnreadCount: () => this.request<{ unread_count: number }>('/admin/public-questions/unread-count'),

    // CMA accuracy test (admin only) - see backend app/api/cma_backtest_routes.py
    cmaBacktestOptions: () => this.request<any>('/admin/cma-backtest/options'),
    cmaBacktestPreview: (body: Record<string, unknown>) =>
      this.request<any>('/admin/cma-backtest/preview', { method: 'POST', body: JSON.stringify(body) }),
    cmaBacktestStart: (body: Record<string, unknown>) =>
      this.request<any>('/admin/cma-backtest/batches', { method: 'POST', body: JSON.stringify(body) }),
    cmaBacktestBatches: () => this.request<any[]>('/admin/cma-backtest/batches'),
    cmaBacktestBatch: (id: string) => this.request<any>(`/admin/cma-backtest/batches/${encodeURIComponent(id)}`),
    cmaBacktestStop: (id: string) => this.request<any>(`/admin/cma-backtest/batches/${encodeURIComponent(id)}/stop`, { method: 'POST' }),
    cmaBacktestResume: (id: string) => this.request<any>(`/admin/cma-backtest/batches/${encodeURIComponent(id)}/resume`, { method: 'POST' }),
    cmaBacktestDelete: (id: string) => this.request<void>(`/admin/cma-backtest/batches/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    cmaBacktestDeleteAllReports: () => this.request<{ deleted: number }>('/admin/cma-backtest/reports', { method: 'DELETE' }),
    cmaBacktestReview: (id: string) => this.request<any>(`/admin/cma-backtest/batches/${encodeURIComponent(id)}/review`),

    lookupCmaReportByCode: (code: string) =>
      this.request<CmaReport & { owner_name?: string | null; owner_email?: string | null }>(
        `/admin/cma-reports/lookup/${encodeURIComponent(code)}`
      ),

    markPublicQuestionRead: (questionId: string) =>
      this.request<PublicQuestion>(`/admin/public-questions/${questionId}/read`, { method: 'PATCH' }),
  };

  /**
   * Support Tickets Namespace (agent-facing)
   */
  public support = {
    create: (subject: string, message: string, extra: { category?: SupportTicketCategory; details?: SupportTicketDetails; attachments?: string[] } = {}) =>
      this.request<SupportTicketDetail>('/api/v1/support/tickets', {
        method: 'POST',
        body: JSON.stringify({ subject, message, ...extra }),
      }),

    /** A screenshot for a ticket that's about to be sent - returns its URL for `attachments`. */
    uploadScreenshot: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return this.request<{ url: string }>('/api/v1/support/screenshots', { method: 'POST', body: formData });
    },

    getAll: () => this.request<SupportTicketListItem[]>('/api/v1/support/tickets'),

    getById: (ticketId: string) => this.request<SupportTicketDetail>(`/api/v1/support/tickets/${ticketId}`),

    reply: (ticketId: string, body: string) =>
      this.request<SupportTicketDetail>(`/api/v1/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),

    getUnreadCount: () => this.request<{ unread_count: number }>('/api/v1/support/tickets/unread-count'),

    updateStatus: (ticketId: string, status: 'open' | 'closed') =>
      this.request<SupportTicketDetail>(`/api/v1/support/tickets/${ticketId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  };

  /**
   * Saved Manual Properties Namespace - an agent's personal library of hand-typed properties,
   * reusable across any picker that links a property (Forms, Design Studio, Blogs) without
   * retyping it. Saving here never creates a real listing or sale by itself.
   */
  public savedProperties = {
    getAll: () => this.request<SavedManualProperty[]>('/api/v1/saved-properties'),

    create: (property: Omit<SavedManualProperty, 'id' | 'created_at'>) =>
      this.request<SavedManualProperty>('/api/v1/saved-properties', {
        method: 'POST',
        body: JSON.stringify(property),
      }),

    remove: (propertyId: string) =>
      this.request<void>(`/api/v1/saved-properties/${propertyId}`, { method: 'DELETE' }),
  };

  /**
   * Public Questions Namespace - the signed-out homepage's "Ask Us a Question" form. Public
   * (no auth token required, though `request` will send one if the visitor happens to have one).
   */
  public publicQuestions = {
    submit: (email: string, message: string) =>
      this.request<{ success: boolean }>('/api/v1/public-questions', {
        method: 'POST',
        body: JSON.stringify({ email, message }),
      }, false),
  };

  /**
   * Collections Namespace
   */
  public collections = {
    getAll: () => this.request<any[]>('/collections/'),

    getPendingRefineRequestsCount: () => this.request<{ count: number }>('/collections/refine-requests/count'),

    /** A home's page, agent side: every Showcase of theirs, and whether it already has this home. */
    membership: (home: { propertyId?: string | null; listingKey?: string | null }) => {
      const q = new URLSearchParams()
      if (home.propertyId) q.set('property_id', home.propertyId)
      if (home.listingKey) q.set('listing_key', home.listingKey)
      return this.request<{ home_ids: string[]; showcases: { id: string; name: string; client: string | null; status: string; homes: number; contains: boolean; recommended: boolean }[] }>(`/collections/membership?${q}`)
    },
    /** Put this home into one of the agent's Showcases (as their pick). */
    addHome: (collectionId: string, home: { propertyId?: string | null; listingKey?: string | null }) =>
      this.request<{ success: boolean; added: boolean; property_id: string }>(`/collections/${collectionId}/add-home`, {
        method: 'POST', body: JSON.stringify({ property_id: home.propertyId || null, listing_key: home.listingKey || null }),
      }),

    // The Showcases page header's Tour requests + Activity inboxes.
    getInbox: () => this.request<ShowcaseInbox>('/collections/inbox'),
    markInboxRead: () => this.request<{ success: boolean }>('/collections/inbox/read', { method: 'POST' }),
    getDeletePreview: (id: string) => this.request<{ followups: string[] }>(`/collections/${id}/delete-preview`),

    getAgentCollections: (agentId: string) => this.request<any[]>(`/agents/${agentId}/collections`),

    getById: (id: string) => this.request<any>(`/collections/${id}`),

    updateCollectionPreference: (customerId: string, interested: boolean) =>
      this.request(`/customers/${customerId}/collection-preference`, {
        method: 'PUT',
        body: JSON.stringify({ interestedInSimilar: interested }),
      }),

    getProperties: (id: string) => this.request<any>(`/collections/${id}/properties`),

    /** The agent's "I recommend this home" on one home in a client's Showcase (or taking it back). */
    recommend: (collectionId: string, propertyId: string, recommended: boolean) =>
      this.request<{ success: boolean; recommended: boolean }>(`/collections/${collectionId}/properties/${propertyId}/recommend`, {
        method: 'PUT',
        body: JSON.stringify({ recommended }),
      }),

    interact: (collectionId: string, propertyId: string, interactionType: 'like' | 'dislike', value: boolean) =>
      this.request<any>(`/collections/${collectionId}/properties/${propertyId}/interact`, {
        method: 'POST',
        body: JSON.stringify({ interaction_type: interactionType, value }),
      }),

    addComment: (collectionId: string, propertyId: string, content: string, visitorName?: string) =>
      this.request<any>(`/collections/${collectionId}/properties/${propertyId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content, visitor_name: visitorName }),
      }),

    getPropertyComments: (collectionId: string, propertyId: string) =>
      this.request<any[]>(`/collections/${collectionId}/properties/${propertyId}/comments`),

    getTours: (collectionId: string) =>
      this.request<any[]>(`/collections/${collectionId}/tours`),

    updateTourCompletion: (tourId: string, isCompleted: boolean) =>
      this.request<any>(`/collections/tours/${tourId}/completion`, {
        method: 'PATCH',
        body: JSON.stringify({ is_completed: isCompleted }),
      }),

    confirmTour: (tourId: string, confirmedDate: string, confirmedTime: string) =>
      this.request<any>(`/collections/tours/${tourId}/confirm`, {
        method: 'PATCH',
        body: JSON.stringify({ confirmed_date: confirmedDate, confirmed_time: confirmedTime }),
      }),

    unconfirmTour: (tourId: string) =>
      this.request<any>(`/collections/tours/${tourId}/unconfirm`, {
        method: 'PATCH',
      }),

    share: (collectionId: string, data: { share_with_visitor?: boolean, extra_emails?: string, message?: string, make_public?: boolean, force_regenerate?: boolean }) =>
      this.request<{ success: boolean; share_token: string; is_public: boolean; share_url: string }>(`/collections/${collectionId}/share`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (collectionId: string) =>
      this.request(`/collections/${collectionId}`, {
        method: 'DELETE',
      }),

    dismiss: (collectionId: string) =>
      this.request<{ success: boolean }>(`/collections/${collectionId}/dismiss`, {
        method: 'PATCH',
      }),

    updateStatus: (collectionId: string, status: string) =>
      this.request(`/collections/${collectionId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    updateNotifications: (collectionId: string, notifyVisitor: boolean, notifyAgent: boolean) =>
      this.request<{ success: boolean; message: string; notify_visitor: boolean; notify_agent: boolean }>(`/collections/${collectionId}/notifications`, {
        method: 'PATCH',
        body: JSON.stringify({ notify_visitor: notifyVisitor, notify_agent: notifyAgent }),
      }),

    createManually: (data: any) =>
      this.request<any>('/collections/create-manually', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    trackPropertyView: (collectionId: string, propertyId: string) =>
      this.request(`/collections/${collectionId}/properties/${propertyId}/view`, {
        method: 'POST',
      }),

    markSeen: (collectionId: string) =>
      this.request<any>(`/collections/${collectionId}/mark-seen`, {
        method: 'POST',
      }),

    dismissRefineRequest: (collectionId: string) =>
      this.request<any>(`/collections/${collectionId}/refine-request/dismiss`, {
        method: 'POST',
      }),

    updatePreferencesAndRefresh: (collectionId: string, preferences: any) =>
      this.request<{ preferences: any, properties_count: number }>(`/collections/${collectionId}/update-preferences-and-refresh`, {
        method: 'PUT',
        body: JSON.stringify(preferences),
      }),

    // Live, unsaved preview for the map-first Showcase editor - calls the exact same
    // PropertyService function the real save path uses, so the preview never drifts from what
    // Save actually produces. Nothing is persisted by this call.
    previewMatches: (preferences: Partial<CollectionPreferences>) =>
      this.request<{ properties: any[], count: number }>(`/collections/preview-matches`, {
        method: 'POST',
        body: JSON.stringify(preferences),
      }),
  };

  /**
   * Notifications Namespace
   */
  public notifications = {
    getAll: async (unreadOnly: boolean = false, maxAgeDays?: number, offset?: number) => {
      const params: string[] = [];
      if (unreadOnly) params.push('unread_only=true');
      if (maxAgeDays) params.push(`max_age_days=${maxAgeDays}`);
      if (offset) params.push(`offset=${offset}`);
      const queryParam = params.length ? `?${params.join('&')}` : '';
      const response = await this.request<NotificationResponse[]>(`/api/v1/notifications${queryParam}`);

      if (response.success && response.data) {
        return {
          ...response,
          data: response.data.map(n => this.transformNotification(n))
        };
      }
      return {
        success: response.success,
        error: response.error,
        message: response.message
      } as ApiResponse<Notification[]>;
    },

    getUnreadCount: (filters?: { referenceType?: string | string[]; type?: string | string[] }) => {
      const params: string[] = [];
      const referenceTypes = filters?.referenceType ? (Array.isArray(filters.referenceType) ? filters.referenceType : [filters.referenceType]) : [];
      const types = filters?.type ? (Array.isArray(filters.type) ? filters.type : [filters.type]) : [];
      referenceTypes.forEach(t => params.push(`reference_type=${encodeURIComponent(t)}`));
      types.forEach(t => params.push(`type=${encodeURIComponent(t)}`));
      return this.request<{ unread_count: number }>(`/api/v1/notifications/unread-count${params.length ? `?${params.join('&')}` : ''}`);
    },

    markAsRead: async (notificationId: string) => {
      const response = await this.request<NotificationResponse>(`/api/v1/notifications/${notificationId}/mark-as-read`, {
        method: 'PATCH',
      });
      if (response.success && response.data) {
        return {
          ...response,
          data: this.transformNotification(response.data)
        };
      }
      return {
        success: response.success,
        error: response.error,
        message: response.message
      } as ApiResponse<Notification>;
    },

    markAllAsRead: () => this.request<{ success: boolean; message: string }>('/api/v1/notifications/mark-all-as-read', {
      method: 'POST',
    }),

    markTypesAsRead: (types: string[]) => this.request<{ success: boolean; message: string }>(
      `/api/v1/notifications/mark-types-as-read?${types.map(t => `types=${encodeURIComponent(t)}`).join('&')}`,
      { method: 'POST' }
    ),

    getPreferences: () => this.request<NotificationPreferences>('/api/v1/notifications/preferences'),

    updatePreferences: (preferences: NotificationPreferences['preferences']) =>
      this.request<NotificationPreferences>('/api/v1/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({ preferences }),
      }),
  };

  /**
   * Email Signature Namespace
   */
  public emailSignature = {
    getMine: () => this.request<{ id: string; config: Record<string, any> }>('/email-signature/me'),

    saveConfig: (config: Record<string, any>) =>
      this.request<{ config: Record<string, any> }>('/email-signature/me', {
        method: 'PUT',
        body: JSON.stringify({ config }),
      }),

    getHtml: () => this.request<{ html: string; asset_base_url: string; html_hash: string; assets_hash: string; installed: boolean; installed_client: string | null; needs_recopy: boolean; recopy_reason: 'edits' | 'images' | null; public_ready: boolean }>('/email-signature/me/html'),
    markInstalled: (htmlHash: string, assetsHash: string, client: string) =>
      this.request<{ ok: boolean }>('/email-signature/me/installed', {
        method: 'POST',
        body: JSON.stringify({ html_hash: htmlHash, assets_hash: assetsHash, client }),
      }),
  };

  /**
   * Agent Hub Namespace
   */
  public agentHub = {
    // no-store: this feeds the Brag/Cheat Sheet's live bio + contact fields (bragSheetData.ts) -
    // every open/refresh of those PDFs must show what's actually saved in Settings/Agent Hub right
    // now, never a browser-cached response from an earlier visit to this page.
    getMine: () => this.request<{ id: string; slug: string; status: string; config?: Record<string, any> } | null>('/agent-hub/me', { cache: 'no-store' }),
    // What deserves marketing now (synced MLS data): listings without a Spotlight, newest listing, latest sale.
    marketingMoments: () => this.request<MarketingMoments>('/agent-hub/me/marketing-moments', { cache: 'no-store' }),
    // Studio's recommendation for this listing/sale is handled (design made, or dismissed) - for good.
    markMomentDone: (key: string) => this.request<{ ok: boolean }>('/agent-hub/me/marketing-moments/done', { method: 'POST', body: JSON.stringify({ key }) }),

    saveConfig: (config: Record<string, any>) =>
      this.request<{ config: Record<string, any> }>('/agent-hub/me/config', {
        method: 'PUT',
        body: JSON.stringify({ config }),
      }),

    getRecentSales: (reLicenseNumber?: string) => this.request<Array<{
      id: string;
      address: string;
      city: string;
      state: string;
      price?: number;
      status?: string;
      image?: string;
      sold_date?: string;
      beds?: number;
      baths?: number;
      sqft?: number;
      acres?: number;
    }>>(`/agent-hub/me/recent-sales?limit=24${reLicenseNumber ? `&re_license_number=${encodeURIComponent(reLicenseNumber)}` : ''}`),

    getListingRouting: () => this.request<{ listings: Array<{
      id: string;
      address: string;
      city?: string;
      state?: string;
      status?: string;
      overrideKey: string | null;
      spotlightAvailable: boolean;
      spotlightSlug?: string | null;
      overridden: boolean;
      routing: { source: 'spotlight' | 'property_page' | 'none'; url: string | null };
    }> }>('/agent-hub/me/listing-routing'),

    updateListingRoutingOverride: (overrideKey: string, override: 'auto' | 'property_page') =>
      this.request<{ listingLinkOverrides: Record<string, string> }>('/agent-hub/me/listing-routing', {
        method: 'PUT',
        body: JSON.stringify({ override_key: overrideKey, override }),
      }),

    getLinkPreview: (url: string) =>
      this.request<{ title: string; image: string }>(`/agent-hub/link-preview?url=${encodeURIComponent(url)}`),

    getYoutubeChannelVideos: (channelUrl: string) =>
      this.request<{ channel_url: string; videos: Array<{ id: string; title: string; description?: string; image?: string; link: string }> }>(`/agent-hub/youtube/videos?channel_url=${encodeURIComponent(channelUrl)}`),

    getYoutubePlaylistVideos: (playlistUrl: string) =>
      this.request<{ playlist_url: string; videos: Array<{ id: string; title: string; description?: string; image?: string; link: string }> }>(`/agent-hub/youtube/playlist-videos?playlist_url=${encodeURIComponent(playlistUrl)}`),

    checkSlug: (slug: string) =>
      this.request<{ slug: string; available: boolean; owned_by_current_user: boolean }>(`/agent-hub/slug/check?slug=${encodeURIComponent(slug)}`),

    updateSlug: (slug: string) => this.request<{ id: string; slug: string; status: string }>('/agent-hub/me/slug', {
      method: 'PUT',
      body: JSON.stringify({ slug }),
    }),

    updateProfile: (data: { title?: string; market?: string; name?: string; brokerage?: string }) =>
      this.request<{ title: string | null; market: string | null; name: string; brokerage: string | null }>('/agent-hub/me/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    updateOpenHouseRequestTheme: (data: { accent_color: string; dark_mode: boolean }) =>
      this.request<{ accentColor: string; darkMode: boolean }>('/agent-hub/me/open-house-request-theme', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    uploadPhoto: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return this.request<{ photo_url: string }>('/agent-hub/me/photo', {
        method: 'POST',
        body: formData,
      });
    },

    deletePhoto: () => this.request<{ photo_url: null }>('/agent-hub/me/photo', {
      method: 'DELETE',
    }),

    uploadSalePhoto: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return this.request<{ photo_url: string }>('/agent-hub/me/sale-photo', {
        method: 'POST',
        body: formData,
      });
    },

    getAnalytics: () => this.request<{ type: 'visit' | 'qr' | 'form'; timestamp: string }[]>('/agent-hub/me/analytics'),

    // --- Client reviews (agent side) ---
    listReviews: () => this.request<{
      summary: { count: number; average: number | null }
      reviews: { id: string; reviewer_name: string; reviewer_email?: string | null; rating: number; body: string; status: string; source?: string; posted_google_at?: string | null; posted_zillow_at?: string | null; created_at: string }[]
      settings: { google_place_id: string; google_review_url: string; zillow_review_url: string; show_on_hub: boolean; show_on_idx: boolean; min_rating: number }
    }>('/agent-hub/reviews'),
    updateReviewSettings: (data: { google_place_id?: string; google_review_url?: string; zillow_review_url?: string; show_on_hub?: boolean; show_on_idx?: boolean; min_rating?: number }) =>
      this.request<{ google_place_id: string; google_review_url: string; zillow_review_url: string; show_on_hub: boolean; show_on_idx: boolean; min_rating: number }>('/agent-hub/reviews/settings', { method: 'PATCH', body: JSON.stringify(data) }),
    importGoogleReviews: () => this.request<{ imported: number; skipped: number; available: number; google_total: number | null; note: string | null }>('/agent-hub/reviews/import-google', { method: 'POST' }),
    /** Read reviews out of text copied from Zillow / Google / Realtor.com - nothing is saved yet. */
    parseReviews: (text: string) => this.request<{ reviews: { name: string; rating: number | null; date: string | null; body: string; already_here?: boolean }[]; dropped: number }>(
      '/agent-hub/reviews/parse', { method: 'POST', body: JSON.stringify({ text }) }),
    /** Save reviews brought over from another site (or typed in by hand). */
    importReviews: (source: string, reviews: { name: string; rating: number; body: string; date?: string | null }[], confirmReal: boolean) =>
      this.request<{ imported: number; skipped: number }>('/agent-hub/reviews/import', { method: 'POST', body: JSON.stringify({ source, reviews, confirm_real: confirmReal }) }),
    setReviewStatus: (id: string, status: 'published' | 'hidden') =>
      this.request<{ id: string; status: string }>(`/agent-hub/reviews/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    deleteReview: (id: string) => this.request<null>(`/agent-hub/reviews/${id}`, { method: 'DELETE' }),
  };

  // Public client-review flow (no auth). Keyed by the agent's hub slug.
  public reviews = {
    get: (slug: string) => this.request<{
      agent_name: string
      agent_first_name: string
      agent_photo_url: string | null
      agent_title: string | null
      agent_brokerage: string | null
      show_on_hub: boolean
      min_rating?: number
      summary: { count: number; average: number | null }
      reviews: { id: string; reviewer_name: string; rating: number; body: string; created_at: string; source?: string }[]
      destinations: { google_place_id: string | null; google_review_url: string | null; zillow_review_url: string | null }
    }>(`/agent-hub/public/${encodeURIComponent(slug)}/reviews`, {}, false),
    submit: (slug: string, body: { reviewer_name: string; reviewer_email?: string; rating: number; body: string }) =>
      this.request<{ id: string; rating: number; is_public: boolean; destinations: { google_place_id: string | null; google_review_url: string | null; zillow_review_url: string | null } }>(
        `/agent-hub/public/${encodeURIComponent(slug)}/reviews`, { method: 'POST', body: JSON.stringify(body) }, false,
      ),
    markPosted: (slug: string, reviewId: string, where: 'google' | 'zillow') =>
      this.request<null>(`/agent-hub/public/${encodeURIComponent(slug)}/reviews/${reviewId}/posted?where=${where}`, { method: 'POST' }, false),
  };

  /**
   * Agent Hub Forms (Buying / Selling / What's My Home Worth) — authenticated
   */
  public forms = {
    getMine: () => this.request<AgentFormConfig[]>('/agent-hub/forms/me'),

    getOne: (formId: string) => this.request<AgentFormConfig>(`/agent-hub/forms/${formId}`),

    duplicate: (formId: string) =>
      this.request<AgentFormConfig>(`/agent-hub/forms/${formId}/duplicate`, { method: 'POST' }),

    getCampaigns: (formId: string) => this.request<FormCampaign[]>(`/agent-hub/forms/${formId}/campaigns`),

    getCampaignInfo: (campaignId: string) => this.request<CampaignLookup>(`/agent-hub/forms/campaigns/${campaignId}`),

    createCampaign: (formId: string, name: string, redirect?: { redirect_mode: string | null; redirect_url: string | null }) =>
      this.request<FormCampaign>(`/agent-hub/forms/${formId}/campaigns`, {
        method: 'POST',
        body: JSON.stringify({ name, ...(redirect || {}) }),
      }),

    updateCampaign: (formId: string, campaignId: string, redirect: { redirect_mode: string | null; redirect_url: string | null }) =>
      this.request<FormCampaign>(`/agent-hub/forms/${formId}/campaigns/${campaignId}`, {
        method: 'PATCH',
        body: JSON.stringify(redirect),
      }),

    deleteCampaign: (formId: string, campaignId: string) =>
      this.request<null>(`/agent-hub/forms/${formId}/campaigns/${campaignId}`, { method: 'DELETE' }),

    getCampaignStats: (formId: string, campaignId: string, days = 30) =>
      this.request<FormStats>(`/agent-hub/forms/${formId}/campaigns/${campaignId}/stats?days=${days}`),

    getGeneralStats: (formId: string, days = 30) =>
      this.request<FormStats>(`/agent-hub/forms/${formId}/campaigns/general/stats?days=${days}`),

    // Visitors who started the form but never pressed Submit (campaign: unset = all, 'general', or an id).
    getUnfinished: (formId: string, campaign?: string | null) =>
      this.request<{ items: UnfinishedFormResponse[]; retentionDays: number }>(
        `/agent-hub/forms/${formId}/unfinished${campaign ? `?campaign=${encodeURIComponent(campaign)}` : ''}`),

    dismissUnfinished: (formId: string, sessionId: string) =>
      this.request<{ success: boolean }>(`/agent-hub/forms/${formId}/unfinished/${sessionId}/dismiss`, { method: 'POST' }),

    addUnfinishedToLeads: (formId: string, sessionId: string) =>
      this.request<{ leadId: string; alreadyAdded: boolean; followup: { created: boolean; reason: 'rule_off' | 'has_agent' | 'already_open' | 'not_created' | null; rule: string } | null }>(
        `/agent-hub/forms/${formId}/unfinished/${sessionId}/add-to-leads`, { method: 'POST' }),

    createForm: (title: string) =>
      this.request<AgentFormConfig>('/agent-hub/forms', {
        method: 'POST',
        body: JSON.stringify({ title }),
      }),

    deleteForm: (formId: string) =>
      this.request<null>(`/agent-hub/forms/${formId}`, { method: 'DELETE' }),

    deleteSubmission: (submissionId: string) =>
      this.request<null>(`/agent-hub/forms/submissions/${submissionId}`, { method: 'DELETE' }),

    updateForm: (formId: string, data: Partial<Pick<AgentFormConfig, 'title' | 'headline' | 'subtitle' | 'description' | 'questions' | 'success_heading' | 'success_message' | 'accent_color' | 'show_branding' | 'dark_mode' | 'redirect_to_agent_hub' | 'property_photo_carousel' | 'background_effects' | 'welcome_text_effects' | 'branding_layout' | 'linked_property' | 'look_mode' | 'look_theme' | 'luxe_metal'>>) =>
      this.request<AgentFormConfig>(`/agent-hub/forms/${formId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    /** One look on every form (setup flow / "Use on all my forms"). */
    updateAllLook: (data: { look_mode: 'hub' | 'custom'; look_theme?: 'classic' | 'luxe'; accent_color?: string; luxe_metal?: string; dark_mode?: boolean }) =>
      this.request<AgentFormConfig[]>('/agent-hub/forms/look', { method: 'PATCH', body: JSON.stringify(data) }),

    checkSlug: (formId: string, slug: string) =>
      this.request<{ slug: string; available: boolean }>(`/agent-hub/forms/${formId}/slug/check?slug=${encodeURIComponent(slug)}`),

    updateSlug: (formId: string, slug: string) =>
      this.request<AgentFormConfig>(`/agent-hub/forms/${formId}/slug`, {
        method: 'PUT',
        body: JSON.stringify({ slug }),
      }),

    resetToDefault: (formId: string) =>
      this.request<AgentFormConfig>(`/agent-hub/forms/${formId}/reset`, { method: 'POST' }),

    getUnreadSubmissionsCount: () =>
      this.request<{ count: number }>('/agent-hub/forms/submissions/unread-count'),

    getStats: (formId: string, days = 30) =>
      this.request<FormStats>(`/agent-hub/forms/${formId}/stats?days=${days}`),

    getStatsSummary: () =>
      this.request<FormStats>('/agent-hub/forms/stats/summary'),

    getSubmissions: (formId: string) =>
      this.request<FormSubmissionListItem[]>(`/agent-hub/forms/${formId}/submissions`),

    markReviewed: (submissionId: string, isReviewed: boolean) =>
      this.request<FormSubmissionListItem>(`/agent-hub/forms/submissions/${submissionId}/reviewed`, {
        method: 'PATCH',
        body: JSON.stringify({ is_reviewed: isReviewed }),
      }),

    // Schedule a Showing: confirm one time (the visitor's link turns Confirmed + they're emailed);
    // nulls clear it back to Pending.
    confirmShowing: (submissionId: string, confirmedDate: string | null, confirmedTime: string | null) =>
      this.request<FormSubmissionListItem>(`/agent-hub/forms/submissions/${submissionId}/showing`, {
        method: 'PUT',
        body: JSON.stringify({ confirmed_date: confirmedDate, confirmed_time: confirmedTime }),
      }),
  };

  /**
   * Studio: shared Brand Kit + media upload
   */
  public studio = {
    getBrandKit: () => this.request<BrandKit>('/studio/brand-kit'),

    // The short "about this home" lines a design prints - this agent's saved ones for the listing,
    // else written once by AI (cheap) and saved; saveListingBlurb keeps an agent's edit for next time.
    listingBlurb: (p: { listing_key?: string | null; address?: string | null; city?: string | null; remarks?: string | null; facts?: string | null }) =>
      this.request<{ text: string; source: 'saved' | 'ai' | 'remarks' | 'none' }>('/studio/listing-blurb', { method: 'POST', body: JSON.stringify(p) }),
    saveListingBlurb: (p: { listing_key?: string | null; address?: string | null; city?: string | null; text: string }) =>
      this.request<{ text: string; source: string }>('/studio/listing-blurb', { method: 'PUT', body: JSON.stringify(p) }),

    updateBrandKit: (data: Partial<Pick<BrandKit, 'primary_color' | 'secondary_color' | 'accent_color' | 'heading_font' | 'body_font' | 'disclaimer_text'>>) =>
      this.request<BrandKit>('/studio/brand-kit', { method: 'PUT', body: JSON.stringify(data) }),

    uploadBrandLogo: (slot: 'personal' | 'team' | 'brokerage', file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return this.request<BrandKit>(`/studio/brand-kit/logo/${slot}`, { method: 'POST', body: formData });
    },

    deleteBrandLogo: (slot: 'personal' | 'team' | 'brokerage') =>
      this.request<BrandKit>(`/studio/brand-kit/logo/${slot}`, { method: 'DELETE' }),

    uploadMedia: (file: File, category?: 'blog' | 'design' | 'brand_logo') => {
      const formData = new FormData();
      formData.append('file', file);
      const qs = category ? `?category=${category}` : '';
      return this.request<{ url: string }>(`/studio/media${qs}`, { method: 'POST', body: formData });
    },

    getStorage: () => this.request<{
      used_bytes: number; cap_bytes: number; percent: number;
      by_category: Record<string, { bytes: number; count: number }>;
    }>('/studio/storage'),
  };

  /**
   * Design Studio
   */
  public designs = {
    getMine: (filters?: { status?: string; design_type?: string; situation?: string; campaign_id?: string }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.design_type) params.set('design_type', filters.design_type);
      if (filters?.situation) params.set('situation', filters.situation);
      if (filters?.campaign_id) params.set('campaign_id', filters.campaign_id);
      const query = params.toString();
      return this.request<DesignProject[]>(`/studio/designs/me${query ? `?${query}` : ''}`);
    },

    create: (data: DesignProjectCreatePayload) =>
      this.request<DesignProject>('/studio/designs', { method: 'POST', body: JSON.stringify(data) }),

    get: (designId: string) => this.request<DesignProject>(`/studio/designs/${designId}`),

    update: (designId: string, data: Partial<Pick<DesignProject, 'name' | 'linked_property' | 'blocks' | 'branding_mode' | 'style_id' | 'color_mode' | 'campaign_id' | 'template_id'>>) =>
      this.request<DesignProject>(`/studio/designs/${designId}`, { method: 'PUT', body: JSON.stringify(data) }),

    updateStatus: (designId: string, statusValue: DesignProject['status']) =>
      this.request<DesignProject>(`/studio/designs/${designId}/status`, { method: 'PATCH', body: JSON.stringify({ status: statusValue }) }),

    duplicate: (designId: string) =>
      this.request<DesignProject>(`/studio/designs/${designId}/duplicate`, { method: 'POST' }),

    delete: (designId: string) => this.request<null>(`/studio/designs/${designId}`, { method: 'DELETE' }),

    // Binary PDF response, not JSON - can't go through the generic `request` helper. Real,
    // physically-sized print quality (server-side Playwright render), not a screenshot.
    exportPdf: async (designId: string): Promise<{ success: boolean; blob?: Blob; error?: string }> => {
      try {
        const response = await fetch(`${API_BASE_URL}/studio/designs/${designId}/export-pdf`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken() || ''}` },
        });
        if (!response.ok) {
          const detail = await response.json().catch(() => null);
          return { success: false, error: detail?.detail || `Export failed (${response.status})` };
        }
        return { success: true, blob: await response.blob() };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Export failed' };
      }
    },

    // Full-resolution PNG at the format's exact publishing size - same server-side headless render
    // as exportPdf, so it matches the editor pixel for pixel.
    exportPng: async (designId: string): Promise<{ success: boolean; blob?: Blob; error?: string }> => {
      try {
        const response = await fetch(`${API_BASE_URL}/studio/designs/${designId}/export-png`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken() || ''}` },
        });
        if (!response.ok) {
          const detail = await response.json().catch(() => null);
          return { success: false, error: detail?.detail || `Export failed (${response.status})` };
        }
        return { success: true, blob: await response.blob() };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Export failed' };
      }
    },
  };

  /**
   * Studio AI Property Media (twilight / lights-on / virtual staging / enhance / animate).
   */
  public mediaLab = {
    generate: (payload: StudioMediaGeneratePayload) =>
      this.request<StudioMediaAsset>('/studio/media-lab/generate', { method: 'POST', body: JSON.stringify(payload) }),

    videoTestGrid: (payload: StudioVideoTestGridPayload) =>
      this.request<StudioVideoTestGridResponse>('/studio/media-lab/video-test-grid', {
        method: 'POST', body: JSON.stringify(payload),
      }),

    usage: () => this.request<{
      today_cost_usd: number; month_cost_usd: number; today_count: number; month_count: number;
      month_ai_used_usd: number | null; month_ai_budget_usd: number | null; month_ai_percent: number | null;
      video_est_usd: number | null; image_est_usd: number | null; studio_soft_capped: boolean;
      storage_used_bytes: number; storage_cap_bytes: number;
      video_clip_price_usd: number | null; video_upscale_price_per_second_usd: number | null;
      video_seconds_per_clip: number | null; video_photo_enhance_price_usd: number | null;
    }>('/studio/media-lab/usage'),

    listAssets: (params?: { group_id?: string; limit?: number; kind?: 'upload' }) => {
      const q = new URLSearchParams();
      if (params?.group_id) q.set('group_id', params.group_id);
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.kind) q.set('kind', params.kind);
      const query = q.toString();
      return this.request<{ assets: StudioMediaAsset[] }>(`/studio/media-lab/assets${query ? `?${query}` : ''}`);
    },

    uploadPhoto: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return this.request<StudioMediaAsset>('/studio/media-lab/upload', { method: 'POST', body: fd });
    },

    getAsset: (assetId: string) => this.request<StudioMediaAsset>(`/studio/media-lab/assets/${assetId}`),

    regenerate: (assetId: string, options?: StudioMediaGeneratePayload['options'], effects?: string[]) =>
      this.request<StudioMediaAsset>(`/studio/media-lab/assets/${assetId}/regenerate`, {
        method: 'POST', body: JSON.stringify({ options: options ?? null, effects: effects ?? null }),
      }),

    rename: (assetId: string, name: string) =>
      this.request<StudioMediaAsset>(`/studio/media-lab/assets/${assetId}/name`, {
        method: 'PATCH', body: JSON.stringify({ name }),
      }),

    setStagingTag: (assetId: string, position: 'bottom-right' | 'bottom-middle' | 'off') =>
      this.request<StudioMediaAsset>(`/studio/media-lab/assets/${assetId}/staging-tag`, {
        method: 'PATCH', body: JSON.stringify({ position }),
      }),

    // Opt-in 4K upscale of a finished video - returns a new processing child asset to poll.
    upscale: (assetId: string) =>
      this.request<StudioMediaAsset>(`/studio/media-lab/assets/${assetId}/upscale`, { method: 'POST' }),

    remove: (assetId: string) => this.request<null>(`/studio/media-lab/assets/${assetId}`, { method: 'DELETE' }),

    // Binary (png/mp4) with an attachment header - can't go through the generic JSON helper.
    // `ratio` (video only): '9:16' | '1:1' | '4:5' re-crops the single render on the server;
    // omit or '16:9' for the base.
    download: async (assetId: string, ratio?: string): Promise<{ success: boolean; blob?: Blob; error?: string }> => {
      try {
        const qs = ratio && ratio !== '16:9' ? `?ratio=${encodeURIComponent(ratio)}` : '';
        const response = await fetch(`${API_BASE_URL}/studio/media-lab/assets/${assetId}/download${qs}`, {
          headers: { Authorization: `Bearer ${getToken() || ''}` },
        });
        if (!response.ok) return { success: false, error: `Download failed (${response.status})` };
        return { success: true, blob: await response.blob() };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Download failed' };
      }
    },

    // Autosaved from the Overlay editor - a plain options write, no AI cost - so a configured
    // title card / branding survives a reload without a regenerate.
    updateOverlay: (assetId: string, data: { title_card?: TitleCardOptions | null; branding?: BrandingOptions | null }) =>
      this.request<StudioMediaAsset>(`/studio/media-lab/assets/${assetId}/overlay`, { method: 'PATCH', body: JSON.stringify(data) }),

    // Same one-render-many-exports model as download() above, plus optionally burning in the
    // title card and/or agent branding overlays. Used whenever either overlay is enabled.
    exportVideo: async (
      assetId: string, data: { ratio?: string; title_card?: TitleCardOptions | null; branding?: BrandingOptions | null },
    ): Promise<{ success: boolean; blob?: Blob; error?: string }> => {
      try {
        const response = await fetch(`${API_BASE_URL}/studio/media-lab/assets/${assetId}/export`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken() || ''}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!response.ok) return { success: false, error: `Export failed (${response.status})` };
        return { success: true, blob: await response.blob() };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Export failed' };
      }
    },
  };

  /**
   * Website Builder - a separate, standalone system from Agent Hub.
   */
  public sites = {
    getMine: () => this.request<Site>('/studio/sites/me'),

    // Feeds the editor's Form/Showcase block pickers - see backend site_routes.get_my_site_content_options.
    getContentOptions: () => this.request<{ forms: { id: string; title: string; form_type: string }[]; showcases: { id: string; name: string; description: string | null; share_token: string }[] }>('/studio/sites/me/content-options'),

    // Everything the Google tab previews every page from - see backend site_routes.get_my_seo_pages.
    getSeoPages: () => this.request<SeoPagesData>('/studio/sites/me/seo-pages'),

    // "Show up on Google" card - the site is put in Google/Bing automatically (backend google_search_service).
    getGoogleStatus: () => this.request<GoogleSearchStatus>('/studio/sites/me/google'),
    getGoogleReport: () => this.request<GoogleReport>('/studio/sites/me/google/report'),
    retryGoogle: () => this.request<GoogleSearchStatus>('/studio/sites/me/google/retry', { method: 'POST' }),
    setGoogleCode: (code: string) => this.request<GoogleSearchStatus>('/studio/sites/me/google/code', { method: 'PUT', body: JSON.stringify({ code }) }),

    getAreas: (lite = false) => this.request<AgentMarketArea[]>(`/studio/sites/me/areas${lite ? '?lite=true' : ''}`),

    addArea: (name: string, state: string, areaType: 'city' | 'neighborhood' = 'city') =>
      this.request<AgentMarketArea>('/studio/sites/me/areas', { method: 'POST', body: JSON.stringify({ name, state, area_type: areaType }) }),

    removeArea: (linkId: string) =>
      this.request<null>(`/studio/sites/me/areas/${linkId}`, { method: 'DELETE' }),

    applyTemplate: () => this.request<Site>('/studio/sites/me/apply-template', { method: 'POST' }),

    // Hydrates unsaved editor blocks the same way the public renderer hydrates a published page
    // (real rotating hero photos, agent profile, featured listings, etc.) so the live preview
    // matches the real site instead of showing raw unresolved block data. featuredSettings is the
    // editor's current (possibly unsaved) Featured-tab state - the featured_listings block reads
    // from it directly now, so the preview needs it too, not just the last-saved copy.
    previewBlocks: (blocks: SiteBlock[], featuredSettings?: FeaturedSettings) =>
      this.request<{ blocks: SiteBlock[] }>('/studio/sites/me/preview', { method: 'POST', body: JSON.stringify({ blocks, featured_settings: featuredSettings }) }),

    updateDraft: (data: { pages?: SitePage[]; theme?: SiteTheme; featured_settings?: FeaturedSettings; media_settings?: MediaSettings; seo?: SiteSeo }) =>
      this.request<Site>('/studio/sites/me/draft', { method: 'PATCH', body: JSON.stringify(data) }),

    publish: () => this.request<Site>('/studio/sites/me/publish', { method: 'POST' }),

    getDomains: () => this.request<SiteDomain[]>('/studio/sites/me/domains'),

    // Old pages from the agent's previous website on their domain (backend old_links_service)
    getOldLinks: () => this.request<OldLinksPayload>('/studio/sites/me/old-links'),
    scanOldLinks: () => this.request<OldLinksPayload>('/studio/sites/me/old-links/scan', { method: 'POST' }),
    updateOldLink: (id: string, body: { target_path?: string | null; is_enabled?: boolean }) =>
      this.request<{ id: string; target_path: string | null; is_enabled: boolean; match_reason: string | null }>(`/studio/sites/me/old-links/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

    getDomainHealth: () => this.request<{ issues: DomainIssue[] }>('/studio/sites/me/domains/health'),

    /** Which company runs a domain (from its nameservers) - the setup guide opens on its steps. */
    getDomainProvider: (hostname: string) => this.request<{ provider: string | null }>(`/studio/sites/me/domains/provider?hostname=${encodeURIComponent(hostname)}`),

    addDomain: (hostname: string) =>
      this.request<SiteDomain>('/studio/sites/me/domains', { method: 'POST', body: JSON.stringify({ hostname }) }),

    checkDomain: (domainId: string) =>
      this.request<SiteDomain>(`/studio/sites/me/domains/${domainId}/check`, { method: 'POST' }),

    makeDomainPrimary: (domainId: string) =>
      this.request<SiteDomain>(`/studio/sites/me/domains/${domainId}/primary`, { method: 'POST' }),

    deleteDomain: (domainId: string) =>
      this.request<null>(`/studio/sites/me/domains/${domainId}`, { method: 'DELETE' }),

    /** One-click connect: can their domain company add the records for them? */
    getOneClick: (domainId: string, back = 'website') =>
      this.request<OneClick>(`/studio/sites/me/domains/${domainId}/one-click?back=${back}`),
    oneClickReturn: (domainId: string, body: { state: string; error?: string | null; back?: string }) =>
      this.request<{ done: boolean; error: string | null; next_url: string | null; status?: string }>(`/studio/sites/me/domains/${domainId}/one-click/return`, { method: 'POST', body: JSON.stringify(body) }),

    /** Buy a domain (Name.com + PayPal) - see lib/domainShop.ts */
    getDomainShop: () => this.request<DomainShop>('/studio/sites/me/domain-shop'),
    searchDomains: (q: string) => this.request<DomainSearch>(`/studio/sites/me/domain-shop/search?q=${encodeURIComponent(q)}`),
    buyDomain: (domain: string, contact: DomainContact, back: string) =>
      this.request<{ purchase_id: string; approve_url: string | null }>('/studio/sites/me/domain-shop/buy', { method: 'POST', body: JSON.stringify({ domain, contact, back }) }),
    getDomainPurchase: (id: string) => this.request<PurchasedDomain>(`/studio/sites/me/domain-shop/purchases/${id}`),
    cancelDomainCheckout: (id: string) => this.request<{ status: string }>(`/studio/sites/me/domain-shop/purchases/${id}/cancel-checkout`, { method: 'POST' }),
    stopDomainRenewal: (id: string) => this.request<PurchasedDomain>(`/studio/sites/me/domain-shop/purchases/${id}/stop-renewing`, { method: 'POST' }),
    getDomainTransferCode: (id: string) => this.request<{ code: string }>(`/studio/sites/me/domain-shop/purchases/${id}/transfer-code`, { method: 'POST' }),
    resendDomainEmail: (id: string) => this.request<{ sent: boolean }>(`/studio/sites/me/domain-shop/purchases/${id}/resend-email`, { method: 'POST' }),

    getPublicBaseUrl: () => this.request<{ base_url: string; is_idx_site?: boolean }>('/studio/sites/me/public-base-url'),

    getLinkDomain: () => this.request<LinkDomainState>('/studio/sites/me/link-domain'),
    setLinkDomain: (useOwnDomain: boolean) =>
      this.request<LinkDomainState>('/studio/sites/me/link-domain', {
        method: 'PUT',
        body: JSON.stringify({ use_own_domain: useOwnDomain }),
      }),
    // IDX website on/off - off = the public site isn't served and links fall back to openhousepal.com.
    setSiteEnabled: (enabled: boolean) =>
      this.request<LinkDomainState>('/studio/sites/me/site-enabled', { method: 'PUT', body: JSON.stringify({ enabled }) }),

    agreeToIdxDomainMigration: () =>
      this.request<{ agreed_at: string }>('/studio/sites/me/idx-domain-migration/agree', { method: 'POST' }),
  };

  /**
   * Single Property Websites - one standalone cinematic marketing site per listing, separate
   * from the whole-agent Website Builder above (many per owner, not one).
   */
  public propertySites = {
    list: () => this.request<PropertyWebsite[]>('/studio/property-sites'),

    // Visitor stats (unique visitors + total visits) for every Spotlight site this agent owns -
    // per site and de-duplicated overall. The agent's own views are never counted.
    analytics: () => this.request<PropertyWebsiteAnalytics>('/studio/property-sites/analytics'),

    create: (payload: { listing_key?: string; manual_property?: Record<string, unknown>; template_id?: string }) =>
      this.request<PropertyWebsite>('/studio/property-sites', { method: 'POST', body: JSON.stringify(payload) }),

    get: (id: string) => this.request<PropertyWebsite>(`/studio/property-sites/${id}`),

    // The open houses this page shows right now (Open House Manager + MLS + dates added here).
    openHouses: (id: string) => this.request<{ open_houses: { id: string; date: string; start_time: string | null; end_time: string | null; source: 'open_house_manager' | 'mls' | 'manual' }[] }>(`/studio/property-sites/${id}/open-houses`),

    updateDraft: (id: string, patch: Partial<PropertyWebsiteDraft>) =>
      this.request<PropertyWebsite>(`/studio/property-sites/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

    publish: (id: string) => this.request<PropertyWebsite>(`/studio/property-sites/${id}/publish`, { method: 'POST' }),

    unpublish: (id: string) => this.request<PropertyWebsite>(`/studio/property-sites/${id}/unpublish`, { method: 'POST' }),

    remove: (id: string) => this.request<null>(`/studio/property-sites/${id}`, { method: 'DELETE' }),

    uploadDocument: (id: string, file: File) => {
      const formData = new FormData(); formData.append('file', file)
      return this.request<{ url: string }>(`/studio/property-sites/${id}/documents`, { method: 'POST', body: formData })
    },

    uploadFloorPlan: (id: string, file: File) => {
      const formData = new FormData(); formData.append('file', file)
      return this.request<{ url: string }>(`/studio/property-sites/${id}/floor-plans`, { method: 'POST', body: formData })
    },
    // The unpublished draft, rendered exactly like the live page (site_id comes back 'preview').
    preview: (id: string) => this.request<any>(`/studio/property-sites/${id}/preview`),
    // "Living photo" header - see backend spotlight_header_service.py.
    headerEstimate: (id: string) => this.request<{
      styles: Record<'dusk', { usd: number; percent: number | null }>
      limit_usd: number | null
      used_percent: number | null
      rooms?: { usd: number; percent: number | null }
    }>(`/studio/property-sites/${id}/header-video/estimate`),
    createHeaderVideo: (id: string, photo_url: string, note?: string) =>
      this.request<{ asset_id: string; status: string }>(`/studio/property-sites/${id}/header-video`, {
        method: 'POST', body: JSON.stringify({ photo_url, style: 'dusk', note: note || null }),
      }),
    buildHeaderLoop: (id: string, asset_id: string) =>
      this.request<{ url: string; poster: string | null; cost_usd: number }>(`/studio/property-sites/${id}/header-video/loop`, {
        method: 'POST', body: JSON.stringify({ asset_id }),
      }),
    // Room by room: AI picks the 3-4 spaces that sell the home (nothing saved until the agent
    // keeps them). The photo pass is cached per site - fresh=true asks the AI again.
    autoRooms: (id: string, fresh = false) =>
      this.request<{
        chapters: { type: string; label: string | null; photos: string[] }[]
        questions: { question: string; photos: string[]; choices: string[] }[]
        rooms: Record<string, string>; cost_usd: number
      }>(
        `/studio/property-sites/${id}/rooms/auto${fresh ? '?fresh=true' : ''}`, { method: 'POST' }),
    // The AI's pick for the photo beside the story (saved to the draft unless one is already chosen).
    autoStoryPhoto: (id: string) =>
      this.request<{ story_photo: string | null; cost_usd: number }>(`/studio/property-sites/${id}/story-photo/auto`, { method: 'POST' }),
    townPhotos: (id: string, name?: string) =>
      this.request<{ photos: { url: string; thumb: string; caption: string; credit: string; source_url: string | null }[] }>(
        `/studio/property-sites/${id}/town-photos${name ? `?name=${encodeURIComponent(name)}` : ''}`),
  };

  /**
   * Blogs
   */
  public blogs = {
    getMine: (statusFilter?: string) =>
      this.request<BlogListItem[]>(`/studio/blogs/me${statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ''}`),

    create: (title: string, category?: string, starterBlocks?: BlogBlock[], theme?: string) =>
      this.request<Blog>('/studio/blogs', { method: 'POST', body: JSON.stringify({ title, category, starter_blocks: starterBlocks, ...(theme ? { theme } : {}) }) }),

    get: (blogId: string) => this.request<Blog>(`/studio/blogs/${blogId}`),

    update: (blogId: string, data: Partial<Pick<Blog, 'title' | 'subtitle' | 'cover_image_url' | 'category' | 'theme' | 'tags' | 'blocks' | 'linked_properties' | 'seo_title' | 'meta_description' | 'focus_keyword' | 'social_title' | 'social_description' | 'social_image_url' | 'is_indexed' | 'luxe_metal'>>) =>
      this.request<Blog>(`/studio/blogs/${blogId}`, { method: 'PUT', body: JSON.stringify(data) }),

    updateStatus: (blogId: string, statusValue: Blog['status'], scheduledAt?: string) =>
      this.request<Blog>(`/studio/blogs/${blogId}/status`, { method: 'PATCH', body: JSON.stringify({ status: statusValue, scheduled_at: scheduledAt }) }),

    linkableAreas: () => this.request<LinkableAreas>('/studio/blogs/linkable-areas'),
    updateHubVisibility: (blogId: string, data: { agent_hub_visible?: boolean; agent_hub_featured?: boolean; idx_visible?: boolean; use_signature_card?: boolean; linked_areas?: string[] }) =>
      this.request<Blog>(`/studio/blogs/${blogId}/agent-hub-visibility`, { method: 'PATCH', body: JSON.stringify(data) }),

    checkSlug: (blogId: string, slug: string) =>
      this.request<{ slug: string; available: boolean }>(`/studio/blogs/${blogId}/slug/check?slug=${encodeURIComponent(slug)}`),

    updateSlug: (blogId: string, slug: string) =>
      this.request<Blog>(`/studio/blogs/${blogId}/slug`, { method: 'PUT', body: JSON.stringify({ slug }) }),

    getAnalytics: (blogId: string) => this.request<BlogAnalytics>(`/studio/blogs/${blogId}/analytics`),

    delete: (blogId: string) => this.request<null>(`/studio/blogs/${blogId}`, { method: 'DELETE' }),

    // AI Blog Writer - guided interview -> full DRAFT article, metered on the monthly AI allowance.
    aiContext: () => this.request<BlogAiContext>('/studio/blogs/ai/context'),
    // Roughly what one AI-written article costs, shown before the agent spends it.
    aiEstimate: (length: string = 'standard') => this.request<{ usd: number; percent: number | null }>(`/studio/blogs/ai/estimate?length=${encodeURIComponent(length)}`),
    aiGenerateJob: (brief: BlogAiBrief) =>
      this.request<{ blog_id: string; status: 'running'; stage: string; engine: string }>('/studio/blogs/ai/generate-job', { method: 'POST', body: JSON.stringify(brief) }),
    aiFinished: (blogId: string) => this.request<Blog>(`/studio/blogs/${blogId}/ai-finished`, { method: 'POST' }),
    aiJob: (blogId: string) =>
      this.request<{ status: 'interview' | 'running' | 'done' | 'failed'; stage?: string; error?: string; brief?: any; step?: number; result?: BlogAiGenerateResult }>(`/studio/blogs/ai/jobs/${blogId}`),
    // Town Spotlight for any town (shared town database; a new town is researched once - poll).
    townCard: (body: { name: string; state?: string }) =>
      this.request<{ status: 'ready' | 'researching'; card?: any; slug?: string; name?: string }>('/studio/blogs/ai/town-card', { method: 'POST', body: JSON.stringify(body) }),
    // AI cover picture: what one costs, then make it ({idea}) or change the last one ({comment}, 2x).
    aiCoverEstimate: () => this.request<{ usd: number; percent: number | null; allowed: boolean; max_revisions: number }>('/studio/blogs/ai/cover-estimate'),
    aiCover: (blogId: string, body: { idea?: string; comment?: string }) =>
      this.request<{ url: string; revisions_left: number; cost_usd: number }>(`/studio/blogs/${blogId}/ai-cover`, { method: 'POST', body: JSON.stringify(body) }),
    // Autosave of the writer's answers - the first save creates the DRAFT article it belongs to.
    saveAiBrief: (body: { blog_id?: string | null; brief: any; step: number; category_hint?: string }) =>
      this.request<{ blog_id: string | null; saved_at?: string }>('/studio/blogs/ai/brief-draft', { method: 'PUT', body: JSON.stringify(body) }),
    aiGenerate: (brief: BlogAiBrief) =>
      this.request<BlogAiGenerateResult>('/studio/blogs/ai/generate', { method: 'POST', body: JSON.stringify(brief) }),
    aiRefineSection: (body: { title: string; section_blocks: BlogBlock[]; article_blocks: BlogBlock[]; action: BlogAiRefineAction; instruction?: string }) =>
      this.request<{ blocks: BlogBlock[]; numbers_to_verify: string[] }>('/studio/blogs/ai/refine-section', { method: 'POST', body: JSON.stringify(body) }),
  };

  /**
   * Leads (centralized CRM merged from open house visitors, form submissions, showcase
   * activity, showing requests, and property comments - see backend app/api/lead_routes.py)
   */
  public leads = {
    /** Clear every lead's red 'new since you last looked' dot (Leads -> Mark all seen). */
    markAllSeen: () => this.request<{ success: boolean; count: number }>('/leads/mark-all-seen', { method: 'POST' }),
    list: (filters?: { source?: LeadSourceFilter; status?: string; represented?: string; search?: string; sort?: LeadSort; limit?: number; openHouseEventId?: string; hidden?: boolean; needsAttention?: boolean }) => {
      const params = new URLSearchParams();
      if (filters?.source) params.set('source', filters.source);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.represented) params.set('represented', filters.represented);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.sort) params.set('sort', filters.sort);
      if (filters?.limit) params.set('limit', String(filters.limit));
      if (filters?.openHouseEventId) params.set('open_house_event_id', filters.openHouseEventId);
      if (filters?.hidden) params.set('hidden', 'true');
      if (filters?.needsAttention !== undefined) params.set('needs_attention', String(filters.needsAttention));
      const query = params.toString();
      return this.request<Lead[]>(`/leads${query ? `?${query}` : ''}`);
    },

    get: (leadId: string) => this.request<LeadDetail>(`/leads/${leadId}`),

    /** Clear one kind of waiting request from the lead's to-dos (booked it, replied, looked...). */
    markHandled: (leadId: string, kind: string) =>
      this.request<LeadDetail>(`/leads/${leadId}/handled`, { method: 'POST', body: JSON.stringify({ kind }) }),

    update: (leadId: string, data: { name?: string; email?: string; phone?: string; status?: LeadStatus; represented?: LeadRepresented; tags?: string[]; notes?: string; mark_contacted?: boolean }) =>
      this.request<LeadDetail>(`/leads/${leadId}`, { method: 'PATCH', body: JSON.stringify(data) }),

    hide: (lead: Pick<Lead, 'id' | 'email' | 'phone' | 'open_houses'>) =>
      this.request<LeadDetail>('/leads/hide', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: lead.id,
          email: lead.email,
          phone: lead.phone,
          open_house_event_ids: lead.open_houses?.map(openHouse => openHouse.id) ?? [],
        }),
      }),

    delete: (leadId: string) =>
      this.request<{ success: boolean }>(`/leads/${leadId}`, { method: 'DELETE' }),

    getOpenHouseHistory: async (search?: string) => {
      const response = await this.request<LeadOpenHouse[]>(`/leads/open-houses/history${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      if (response.success && response.data) {
        return {
          ...response,
          data: response.data.map(openHouse => ({
            ...openHouse,
            visitorCount: openHouse.visitor_count ?? openHouse.visitorCount ?? 0,
          })),
        }
      }
      return response
    },

    downloadCsv: async (filters?: { source?: LeadSourceFilter; status?: string; represented?: string; search?: string; sort?: LeadSort; openHouseEventId?: string; hidden?: boolean; ids?: string[] }) => {
      if (filters?.ids) {
        // The exact leads on screen, in that order.
        const response = await fetch(`${API_BASE_URL}/leads/export.csv`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken() || ''}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: filters.ids, hidden: !!filters.hidden }),
        });
        if (!response.ok) throw new Error('Failed to export leads');
        const url = window.URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = url;
        link.download = 'leads.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        return;
      }
      const params = new URLSearchParams();
      if (filters?.source) params.set('source', filters.source);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.represented) params.set('represented', filters.represented);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.sort) params.set('sort', filters.sort);
      if (filters?.openHouseEventId) params.set('open_house_event_id', filters.openHouseEventId);
      if (filters?.hidden) params.set('hidden', 'true');
      const response = await fetch(`${API_BASE_URL}/leads/export.csv?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getToken() || ''}` },
      });
      if (!response.ok) throw new Error('Failed to export leads');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'leads.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },

    getNotes: (leadId: string) => this.request<LeadNote[]>(`/leads/${leadId}/notes`),
    addNote: (leadId: string, data: { text: string; open_house_event_id?: string }) =>
      this.request<LeadNote>(`/leads/${leadId}/notes`, { method: 'POST', body: JSON.stringify(data) }),
    updateNote: (noteId: string, text: string) =>
      this.request<LeadNote>(`/leads/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify({ text }) }),
    deleteNote: (noteId: string) =>
      this.request<{ success: boolean }>(`/leads/notes/${noteId}`, { method: 'DELETE' }),
  };

  /**
   * AI Assistant
   */
  // Emails sent to clients: open / click tracking + the daily / weekly / off rules (backend client_email_routes).
  public clientEmails = {
    people: () => this.request<{ people: EmailPerson[]; totals: { people: number; daily: number; weekly: number; off: number };
      rules: { strike_days: number; weekly_strikes: number; max_auto_per_day: number } }>('/client-emails/people'),
    log: (params: { email?: string; q?: string; limit?: number; offset?: number } = {}) => {
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)) })
      return this.request<{ emails: ClientEmailRow[]; total: number;
        stats_30d: { sent: number; opened: number; clicked: number; open_rate: number | null; click_rate: number | null } }>(`/client-emails${qs.toString() ? `?${qs}` : ''}`)
    },
    setPerson: (email: string, on: boolean) =>
      this.request<EmailPerson>('/client-emails/people', { method: 'PUT', body: JSON.stringify({ email, on }) }),
  };

  // The middle of the agent's QR codes (backend qr_brand_routes).
  public qrBrand = {
    get: () => this.request<{ kind: string; choice: 'ohp' | 'logo' | 'initials'; allowed: boolean; initials?: string; logo?: string; has_logo: boolean }>('/me/qr-brand', { cache: 'no-store' }),
    set: (choice: 'ohp' | 'logo' | 'initials') => this.request<{ kind: string; choice: 'ohp' | 'logo' | 'initials'; allowed: boolean; initials?: string; logo?: string; has_logo: boolean }>('/me/qr-brand', { method: 'PUT', body: JSON.stringify({ choice }) }),
  };

  // Studio -> Email: this agent's own email settings (backend email_settings_service).
  public emailSettings = {
    get: () => this.request<EmailSettings>('/api/v1/email-settings', { cache: 'no-store' }),
    update: (patch: EmailSettingsPatch) => this.request<EmailSettings>('/api/v1/email-settings', { method: 'PUT', body: JSON.stringify(patch) }),
  };

  public ai = {
    listConversations: () => this.request<AIConversationListItem[]>('/ai/conversations'),

    createConversation: () => this.request<AIConversationListItem>('/ai/conversations', { method: 'POST' }),

    getConversation: (conversationId: string) => this.request<AIConversation>(`/ai/conversations/${conversationId}`),

    deleteConversation: (conversationId: string) =>
      this.request<{ success: boolean }>(`/ai/conversations/${conversationId}`, { method: 'DELETE' }),

    sendMessage: (conversationId: string, message: string, voiceMode?: boolean) =>
      this.request<AISendMessageResponse>(`/ai/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message, voice_mode: !!voiceMode }),
      }),

    getInsights: () => this.request<AIInsightsResponse>('/ai/insights'),

    // Dashboard's Daily Digest panel - open to every user (not the admin-gated assistant).
    getDigest: () => this.request<DailyDigest>('/ai/digest'),

    // "Monthly AI Usage" meter - month-to-date spend across every AI tool vs the plan's
    // monthly AI budget. Open to every user; percent is null when the tier isn't metered.
    monthlyUsage: () => this.request<MonthlyAiUsage>('/ai/usage/monthly'),

    // Roughly what one copywrite call will cost (% of the monthly AI budget) - shown before spending it.
    copywriteEstimate: (purpose: string, chars: number) =>
      this.request<{ purpose: string; usd: number; percent: number | null }>(`/ai/copywrite/estimate?purpose=${encodeURIComponent(purpose)}&chars=${chars}`),
    // AI copywriter - Design Studio text, Blogs AI mode, Agent Hub bio polish, caption/email drafts.
    // Metered against the shared Monthly AI Usage allowance.
    copywrite: (body: { purpose: string; context?: string; tone?: string; instruction?: string }) =>
      this.request<{ text: string }>('/ai/copywrite', { method: 'POST', body: JSON.stringify(body) }),

    // Advisory Fair-Housing / MLS phrase check - returns risky phrases + a suggested swap.
    complianceCheck: (text: string) =>
      this.request<{ flags: { phrase: string; issue: string; suggestion: string }[] }>(
        '/ai/compliance-check', { method: 'POST', body: JSON.stringify({ text }) },
      ),

    dismissDigestItem: (itemId: string) =>
      this.request<{ ok: boolean }>('/ai/digest/dismiss', { method: 'POST', body: JSON.stringify({ item_id: itemId }) }),

    // Read Aloud - raw authenticated fetch (not the JSON request<T>() helper) since the
    // response is an audio/mpeg blob, not JSON. Mirrors leads.downloadCsv's blob pattern.
    getSpeechAudio: async (conversationId: string | undefined, text: string): Promise<Blob> => {
      const response = await fetch(`${API_BASE_URL}/ai/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken() || ''}`,
        },
        body: JSON.stringify({ text, conversation_id: conversationId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || 'Read Aloud is temporarily unavailable.');
      }
      return response.blob();
    },

    // Talk to OHP (OpenAI Realtime) - the backend endpoints TalkToOHP.tsx calls around the
    // browser's direct WebRTC connection to OpenAI. See ai_realtime_service.py.
    startRealtimeSession: () => this.request<AIRealtimeSessionOut>('/ai/realtime/session', { method: 'POST' }),

    realtimeToolCall: (sessionId: string, toolName: string, args: Record<string, unknown>) =>
      this.request<AIRealtimeToolCallResult>('/ai/realtime/tool-call', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, tool_name: toolName, args }),
      }),

    realtimeUsage: (sessionId: string, usage: Record<string, unknown>) =>
      this.request<{ should_end: boolean }>('/ai/realtime/usage', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, usage }),
      }),

    realtimeHeartbeat: (sessionId: string) =>
      this.request<{ ok: boolean }>('/ai/realtime/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
      }),

    realtimeEnd: (sessionId: string, reason: string) =>
      this.request<{ ok: boolean }>('/ai/realtime/end', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, reason }),
      }),
  };

  /**
   * Stats (trailing-30d-vs-prior-30d summary + full history for the Dash stat cards)
   */
  public stats = {
    getSummary: () => this.request<StatSummary>('/stats/summary'),

    getHistory: (metric: StatMetric) => this.request<StatHistory>(`/stats/${encodeURIComponent(metric)}/history`),
  };

  public cma = {
    list: () => this.request<CmaReportListItem[]>('/api/cma'),

    create: (payload: { client_name?: string, mode?: CmaMode, subject?: Partial<CmaSubjectProperty> }) =>
      this.request<CmaReport>('/api/cma', { method: 'POST', body: JSON.stringify(payload) }),

    get: (id: string) => this.request<CmaReport>(`/api/cma/${id}`),

    update: (id: string, payload: Partial<{
      client_name: string | null, mode: CmaMode, status: CmaStatus,
      subject: CmaSubjectProperty, comparables: CmaComparable[], pricing: CmaPricing,
      market_context: CmaMarketContext, improvements: CmaImprovement[], presentation: CmaPresentationSettings, use_signature_card: boolean,
    }>) => this.request<CmaReport>(`/api/cma/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

    remove: (id: string) => this.request<void>(`/api/cma/${id}`, { method: 'DELETE' }),

    // Merges just default_theme server-side instead of a full presentation replace - used from
    // the CMA list card, which only knows this one field, not the report's full presentation
    // settings (hidden_sections/hidden_comp_ids/cover_photo_url).
    updateTheme: (id: string, theme: 'light' | 'dark') =>
      this.request<void>(`/api/cma/${id}/theme`, { method: 'PATCH', body: JSON.stringify({ default_theme: theme }) }),

    searchComparables: (payload: CmaCompSearchParams) =>
      this.request<CmaCompCandidate[]>('/api/cma/comparables/search', { method: 'POST', body: JSON.stringify(payload) }),

    share: (id: string) => this.request<CmaShareResponse>(`/api/cma/${id}/share`, { method: 'POST' }),

    /** What one AI analysis usually uses of the monthly AI allowance (shown by the button). */
    aiEstimate: () => this.request<{ usd: number; percent: number | null; max_percent: number | null }>('/api/cma/ai-estimate'),
    generateAiAnalysis: (id: string, payload: { max_photos_per_property?: number, include_map_images?: boolean, force_regenerate?: boolean, background?: boolean } = {}) =>
      this.request<CmaReport>(`/api/cma/${id}/generate-ai-analysis`, { method: 'POST', body: JSON.stringify(payload) }),

    // Re-runs the deterministic evidence/confidence/value-drivers pipeline plus one lightweight
    // (no-photo) AI call to keep the value/methodology text consistent with any comp overrides
    // (reclassify / Mark Irrelevant) made since the initial generation - see cma_ai_service.
    // recompute_valuation. Repeatable, unlike generateAiAnalysis above.
    recomputeValuation: (id: string) =>
      this.request<CmaReport>(`/api/cma/${id}/recompute-valuation`, { method: 'POST' }),

    // Free re-stamp for a report whose only problem is a stale artifact hash (e.g. an agent
    // filled in a required rating after generation, or a save round-tripped) with nothing about
    // the content actually needing to change - no AI call, no cost. 409s if a real content
    // finding is also present; use recomputeValuation (paid) for that instead. See
    // cma_service.resync_qa.
    resyncQa: (id: string) =>
      this.request<CmaReport>(`/api/cma/${id}/resync-qa`, { method: 'POST' }),

    // The full subject for an MLS listing from our Bright record (location, school district,
    // township, county, lot, basement, garage, utilities, taxes, description, every photo).
    subjectFromListing: (listingKey: string) =>
      this.request<CmaSubjectProperty>(`/api/cma/subject-from-listing/${encodeURIComponent(listingKey)}`),

    // Manual subject (a home not on the MLS yet) - see backend cma_manual_subject_service.py.
    subjectArea: (lat: number, lng: number) =>
      this.request<CmaSubjectArea>(`/api/cma/subject-area?lat=${lat}&lng=${lng}`),

    locateAddress: (address: string) =>
      this.request<CmaLocatedAddress>(`/api/cma/locate?address=${encodeURIComponent(address)}`),

    uploadSubjectPhoto: (id: string, file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return this.request<{ photo_url: string }>(`/api/cma/${id}/subject-photo`, { method: 'POST', body: formData })
    },

    googleSubjectPhoto: (id: string, payload: { kind: 'street_view' | 'aerial', latitude?: number | null, longitude?: number | null }) =>
      this.request<{ photo_url: string, kind: string }>(`/api/cma/${id}/subject-photo/google`, { method: 'POST', body: JSON.stringify(payload) }),
  };

  public sellerNetSheet = {
    list: () => this.request<SellerNetSheetListItem[]>('/api/seller-net-sheets'),

    create: (payload: { client_name?: string, property?: Partial<SnsProperty> }) =>
      this.request<SellerNetSheet>('/api/seller-net-sheets', { method: 'POST', body: JSON.stringify(payload) }),

    get: (id: string) => this.request<SellerNetSheet>(`/api/seller-net-sheets/${id}`),

    update: (id: string, payload: Partial<{
      client_name: string | null, status: FinancialToolStatus, property: SnsProperty, scenarios: SnsScenario[],
      mortgage_payoffs: SnsLineItem[], compensation: SnsCompensation, closing_costs: SnsLineItem[],
      tax_proration: SnsTaxProration, repairs: SnsLineItem[], notes: string | null, disclaimer: string | null,
    }>) => this.request<SellerNetSheet>(`/api/seller-net-sheets/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

    remove: (id: string) => this.request<void>(`/api/seller-net-sheets/${id}`, { method: 'DELETE' }),

    share: (id: string) => this.request<{ share_slug: string, status: FinancialToolStatus, public_path: string }>(`/api/seller-net-sheets/${id}/share`, { method: 'POST' }),
  };

  public buyerCashNeeded = {
    list: () => this.request<BuyerCashNeededListItem[]>('/api/buyer-cash-needed'),

    create: (payload: { client_name?: string, property?: Partial<BcnProperty> }) =>
      this.request<BuyerCashNeeded>('/api/buyer-cash-needed', { method: 'POST', body: JSON.stringify(payload) }),

    get: (id: string) => this.request<BuyerCashNeeded>(`/api/buyer-cash-needed/${id}`),

    update: (id: string, payload: Partial<{
      client_name: string | null, status: FinancialToolStatus, property: BcnProperty, purchase_price: BcnAmount,
      down_payment_scenarios: BcnDownPaymentScenario[], loan_type: BcnLoanType, closing_costs: BcnLineItem[],
      prepaid_expenses: BcnLineItem[], inspections: BcnLineItem[], earnest_money: BcnAmount, credits: BcnCredits,
      monthly_context: BcnMonthlyContext, notes: string | null, disclaimer: string | null,
    }>) => this.request<BuyerCashNeeded>(`/api/buyer-cash-needed/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

    remove: (id: string) => this.request<void>(`/api/buyer-cash-needed/${id}`, { method: 'DELETE' }),

    share: (id: string) => this.request<{ share_slug: string, status: FinancialToolStatus, public_path: string }>(`/api/buyer-cash-needed/${id}/share`, { method: 'POST' }),
  };

  /**
   * Public / Visitor Namespace (Does NOT include JWT)
   */
  public public = {
    getCmaReport: (slug: string) => this.request<CmaPublicResponse>(`/api/cma/public/${encodeURIComponent(slug)}`, { cache: 'no-store' }, false),

    getSellerNetSheet: (slug: string) => this.request<SellerNetSheetPublicResponse>(`/api/seller-net-sheets/public/${encodeURIComponent(slug)}`, {}, false),

    getBuyerCashNeeded: (slug: string) => this.request<BuyerCashNeededPublicResponse>(`/api/buyer-cash-needed/public/${encodeURIComponent(slug)}`, {}, false),

    getOpenHouseProperty: async (id: string) => {
      const response = await this.request<any>(`/open-house/property/${id}`, {}, false);

      if (response.success && response.data?.property) {
        const p = response.data.property;
        // Standardize the response to match the Property interface
        return {
          ...response,
          data: {
            id: p.id,
            ListingKey: p.listingKey || '',
            FullStreetAddress: p.address || '',
            City: p.city || '',
            StateOrProvince: p.state || '',
            PostalCode: p.zipCode || '',
            ListPrice: p.price || 0,
            BedroomsTotal: p.beds || 0,
            BathroomsTotal: p.baths || 0,
            LivingArea: p.squareFeet || 0,
            LotSizeSquareFeet: p.lotSize || 0,
            PropertyType: p.propertyType || '',
            MlsStatus: p.homeStatus || 'ACTIVE',
            ListPictureURL: p.imageSrc || '',
            photos: Array.isArray(p.photos) && p.photos.length ? p.photos : (p.imageSrc ? [p.imageSrc] : []),
            agentName: p.agentName || '',
            agentBrokerage: p.agentBrokerage || '',
            agentPhotoUrl: p.agentPhotoUrl ? resolveMediaUrl(p.agentPhotoUrl) : null,
            // Where the host sends the guest's phone after signing in ({kind, url}) - their Spotlight
            // for this home or their Agent Hub; absent = just the thank-you.
            afterSignin: p.afterSignin || null,
            // Off = this open house shows no similar homes (sign-in thank-you wording).
            similarHomes: p.similarHomes !== false,
          },
          theme: response.data?.theme || null,
          qrDarkMode: Boolean(response.data?.qrDarkMode),
        };
      }
      return response;
    },

    submitSignIn: (data: {
      full_name: string,
      email: string,
      phone: string,
      has_agent: string,
      open_house_event_id: string,
      interested_in_similar: boolean
    }) => this.request('/open-house/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    }, false),

    // Fire-and-forget: records that the sign-in form was actually shown to someone, so the
    // "Completion %" stat has a denominator (started) to compare completed submissions against.
    trackSignInView: (openHouseEventId: string) =>
      this.request(`/open-house/${openHouseEventId}/track-view`, { method: 'POST' }, false),

    submitOpenHouseFormRequest: (openHouseEventId: string, data: {
      form_type: 'disclosure' | 'second_visit',
      full_name: string,
      email: string,
      phone: string,
      wants_another_tour?: boolean,
      another_tour_time?: string,
      preferred_visit_time?: string,
      wants_disclosure?: boolean,
    }) => this.request<any>(`/open-house/${openHouseEventId}/request`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, false),

    // Guest Pass - the page a guest's phone opens right after signing in at an open house.
    // `token` is the signed link the sign-in hands back (backend services/guest_pass_service.py).
    getGuestPass: (token: string) => this.request<any>(`/guest-pass/${encodeURIComponent(token)}`, {}, false),
    guestPassRequest: (token: string, kind: 'disclosure' | 'second_visit', preferredTime?: string) =>
      this.request<{ sent: boolean; already: boolean }>(`/guest-pass/${encodeURIComponent(token)}/request`, {
        method: 'POST',
        body: JSON.stringify({ kind, ...(preferredTime ? { preferred_time: preferredTime } : {}) }),
      }, false),
    guestPassQuestion: (token: string, message: string) =>
      this.request<{ sent: boolean }>(`/guest-pass/${encodeURIComponent(token)}/question`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      }, false),
    guestPassShowcase: (token: string) =>
      this.request<{ url: string }>(`/guest-pass/${encodeURIComponent(token)}/showcase`, { method: 'POST' }, false),

    setActingAsOwner: (v: boolean) => { this.publicAsOwner = v },

    /** A personal email's Showcase link was opened (?ce=<id>) - one click on that email. */
    trackEmailVisit: (trackId: string) =>
      this.request<any>(`/e/v/${encodeURIComponent(trackId)}`, { method: 'POST' }, false),

    getSharedShowcase: (shareToken: string) =>
      this.request<any>(`/collections/shared/${shareToken}`, {}, false),

    // Visitor self-serve: address/radius/price/beds/baths only (narrower than the
    // agent-side api.collections.updatePreferencesAndRefresh) - re-runs the real match
    // and returns the same shape as getSharedShowcase, refreshed.
    // What the visitor's unsaved search changes would match - count + where (nothing saved).
    previewShowcaseMatches: (shareToken: string, preferences: Partial<CollectionPreferences>) =>
      this.request<{ count: number; points: { id: string; lat: number; lng: number }[] }>(`/collections/shared/${shareToken}/preview-matches`, {
        method: 'POST',
        body: JSON.stringify(preferences),
      }, false),
    updateShowcasePreferences: (shareToken: string, preferences: Partial<CollectionPreferences>) =>
      this.request<any>(`/collections/shared/${shareToken}/update-preferences-and-refresh`, {
        method: 'PUT',
        body: JSON.stringify(preferences),
      }, false),

    interactWithProperty: (collectionId: string, propertyId: string, interactionType: 'like' | 'dislike', value: boolean) =>
      this.request<any>(`/collections/${collectionId}/properties/${propertyId}/interact`, {
        method: 'POST',
        body: JSON.stringify({ interaction_type: interactionType, value }),
      }, this.publicAsOwner),

    addPropertyComment: (collectionId: string, propertyId: string, content: string, visitorName: string) =>
      this.request<any>(`/collections/${collectionId}/properties/${propertyId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content, visitor_name: visitorName }),
      }, this.publicAsOwner),

    getPropertyComments: (collectionId: string, propertyId: string) =>
      this.request<any[]>(`/collections/${collectionId}/properties/${propertyId}/comments`, {}, false),

    getTours: (collectionId: string) =>
      this.request<any[]>(`/collections/${collectionId}/tours/shared`, {}, false),

    trackPropertyView: (collectionId: string, propertyId: string) =>
      this.request<any>(`/collections/${collectionId}/properties/${propertyId}/view`, {
        method: 'POST',
      }, false),

    submitRefineRequest: (collectionId: string, message: string) =>
      this.request<any>(`/collections/${collectionId}/refine-request`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      }, this.publicAsOwner),

    /** An Agent Hub agent's busy blocks - the "Schedule a Showing" form only offers free times. */
    getHubBusy: async (agentSlug: string) => {
      const r = await this.request<{ busy: { start: string; end: string }[] }>(`/agent-hub/forms/public/${encodeURIComponent(agentSlug)}/agent-busy`, {}, false)
      return r.success && r.data ? r.data.busy : []
    },

    /** The agent behind a Guest Pass - its second-tour times skip ones they're busy. */
    getGuestPassBusy: async (token: string) => {
      const r = await this.request<{ busy: { start: string; end: string }[] }>(`/guest-pass/${encodeURIComponent(token)}/agent-busy`, {}, false)
      return r.success && r.data ? r.data.busy : []
    },

    /** The Showcase agent's busy blocks (start/end only) for the showing window. */
    getShowcaseBusy: async (collectionId: string) => {
      const r = await this.request<{ busy: { start: string; end: string }[] }>(`/collections/${collectionId}/busy`, {}, false)
      return r.success && r.data ? r.data.busy : []
    },

    scheduleTour: (collectionId: string, data: any) =>
      this.request<any>(`/collections/${collectionId}/properties/${data.propertyId}/schedule-tour`, {
        method: 'POST',
        body: JSON.stringify({
          preferred_date: data.preferredDate,
          preferred_time: data.preferredTime,
          preferred_date_2: data.preferredDate2,
          preferred_time_2: data.preferredTime2,
          preferred_date_3: data.preferredDate3,
          preferred_time_3: data.preferredTime3,
          message: data.message,
          visitor_name: data.visitorName,
          visitor_email: data.visitorContact?.includes('@') ? data.visitorContact : undefined,
          visitor_phone: !data.visitorContact?.includes('@') ? data.visitorContact : undefined
        }),
      }, false),

    toggleNotifications: (shareToken: string, notifyVisitor: boolean) =>
      this.request(`/collections/shared/${shareToken}/notifications`, {
        method: 'PATCH',
        body: JSON.stringify({ notify_visitor: notifyVisitor }),
      }, false),

    unsubscribe: (email: string) => this.request(`/collections/unsubscribe?email=${encodeURIComponent(email)}`, {
      method: 'POST',
    }, false),

    checkAgentHub: (agentSlug: string) =>
      this.request<{ slug: string; config?: Record<string, any> }>(`/agent-hub/public/${encodeURIComponent(agentSlug)}`, {}, false),

    // Sends the auth token (if present) so the backend can skip counting the visit/scan when
    // the viewer is logged in (e.g. the owner previewing their own page) - only anonymous
    // traffic counts as a real guest.
    trackAgentHubEvent: (agentSlug: string, eventType: 'visit' | 'qr_scan' | 'interaction', visitorId?: string) =>
      this.request<null>(`/agent-hub/public/${encodeURIComponent(agentSlug)}/track`, {
        method: 'POST',
        body: JSON.stringify({ event_type: eventType, visitor_id: visitorId }),
        // Most hub clicks leave the page (a form, a listing, YouTube) - keepalive lets the ping
        // finish instead of being cancelled by the navigation, which left "Interacted" at 0.
        keepalive: true,
      }, true),

    getPublicForms: (agentSlug: string) =>
      this.request<PublicFormSummary[]>(`/agent-hub/forms/public/${encodeURIComponent(agentSlug)}`, {}, false),

    getPublicForm: (agentSlug: string, formSlug: string, campaignToken?: string | null, preview = false) => {
      const q = new URLSearchParams()
      if (campaignToken) q.set('c', campaignToken)
      // an editor's live preview - not counted as a visit
      if (preview) q.set('preview', '1')
      const qs = q.toString()
      return this.request<PublicFormConfig>(`/agent-hub/forms/public/${encodeURIComponent(agentSlug)}/${encodeURIComponent(formSlug)}${qs ? `?${qs}` : ''}`, {}, false)
    },

    submitPublicForm: (
      agentSlug: string,
      formSlug: string,
      answers: { questionId: string; value: unknown }[],
      // Both optional and both new - session attribution is authoritative (see forms_service.py):
      // sessionKey lets the submission inherit the campaign its FormViewSession was already
      // attributed to; campaignToken is only a fallback used when no session exists at all.
      opts?: { sessionKey?: string; campaignToken?: string | null },
    ) =>
      this.request<{ success: boolean; message: string; submissionId?: string; redirectUrl?: string }>(
        `/agent-hub/forms/public/${encodeURIComponent(agentSlug)}/${encodeURIComponent(formSlug)}/submit`,
        { method: 'POST', body: JSON.stringify({ answers, sessionKey: opts?.sessionKey, campaignToken: opts?.campaignToken }) },
        false,
      ),

    // A visitor's own showing request (remembered on their device) - Pending or Confirmed.
    getShowingStatus: (agentSlug: string, formSlug: string, submissionId: string) =>
      this.request<ShowingStatus>(`/agent-hub/forms/public/${encodeURIComponent(agentSlug)}/${encodeURIComponent(formSlug)}/showing/${encodeURIComponent(submissionId)}`, {}, false),

    trackFormProgress: (agentSlug: string, formSlug: string, data: {
      sessionKey: string; stepIndex: number; questionId?: string | null; completed?: boolean; campaignToken?: string | null
      answers?: Record<string, unknown>; source?: string; device?: string; referrer?: string | null
    }) =>
      this.request<{ success: boolean }>(
        `/agent-hub/forms/public/${encodeURIComponent(agentSlug)}/${encodeURIComponent(formSlug)}/progress`,
        // keepalive: the last ping is often sent as the page is closing
        { method: 'POST', body: JSON.stringify(data), keepalive: true },
        false,
      ),

    getPublicBlogs: (agentSlug: string, category?: string) =>
      this.request<PublicBlogSummary[]>(
        `/studio/blogs/public/${encodeURIComponent(agentSlug)}${category ? `?category=${encodeURIComponent(category)}` : ''}`,
        {}, false,
      ),

    // Sends the auth token (if the visitor happens to be logged in) unlike the other public.*
    // calls - the backend uses it to skip counting a view for any logged-in viewer, so only
    // anonymous visitors count as real reads.
    // A reader's question from an article's Contact Form block -> a lead for the agent.
    submitBlogLead: (agentSlug: string, blogSlug: string, payload: { name: string; email?: string; phone?: string; message?: string }) =>
      this.request<{ sent: boolean }>(`/studio/blogs/public/${encodeURIComponent(agentSlug)}/${encodeURIComponent(blogSlug)}/lead`, { method: 'POST', body: JSON.stringify(payload) }, false),
    getPublicBlog: (agentSlug: string, blogSlug: string) =>
      this.request<PublicBlogDetail>(`/studio/blogs/public/${encodeURIComponent(agentSlug)}/${encodeURIComponent(blogSlug)}`, {}, true),

    trackBlogEvent: (agentSlug: string, blogSlug: string, eventType: 'view' | 'link_click' | 'property_click' | 'contact_click' | 'video_play' | 'qr_scan' | 'lead_submit', meta?: Record<string, unknown>) =>
      this.request<null>(
        `/studio/blogs/public/${encodeURIComponent(agentSlug)}/${encodeURIComponent(blogSlug)}/event`,
        { method: 'POST', body: JSON.stringify({ event_type: eventType, meta }), keepalive: true },
        // Reads send the token (when there is one) so the agent opening their own article isn't counted.
        eventType === 'view',
      ),
  };

  // Agent tasks / follow-ups + the private calendar (.ics) feed. Backend: app/api/task_routes.py
  public tasks = {
    list: (opts?: { leadId?: string; includeDone?: boolean; bucket?: string }) => {
      const p = new URLSearchParams();
      if (opts?.leadId) p.set('lead_id', opts.leadId);
      if (opts?.includeDone) p.set('include_done', 'true');
      if (opts?.bucket) p.set('bucket', opts.bucket);
      const q = p.toString();
      return this.request<AgentTask[]>(`/tasks${q ? `?${q}` : ''}`);
    },
    counts: () => this.request<TaskCounts>('/tasks/counts'),
    create: (data: TaskCreateInput) =>
      this.request<AgentTask>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: TaskUpdateInput) =>
      this.request<AgentTask>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    complete: (id: string) =>
      this.request<AgentTask>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ completed: true }) }),
    reopen: (id: string) =>
      this.request<AgentTask>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ completed: false }) }),
    remove: (id: string) => this.request<null>(`/tasks/${id}`, { method: 'DELETE' }),
    calendarFeed: () => this.request<CalendarFeedInfo>('/tasks/calendar-feed'),
    rotateCalendarFeed: () => this.request<CalendarFeedInfo>('/tasks/calendar-feed/rotate', { method: 'POST' }),
    // Situations that create a follow-up automatically, each switchable per agent.
    autoRules: () => this.request<FollowupSettings>('/tasks/auto-rules'),
    // The calendar alert a situation makes, for a sample lead, with an unsaved message.
    previewAlert: (key: string, body: { template?: string; pitch?: string; seller?: boolean }) =>
      this.request<{ summary: string; description: string; all_day?: boolean }>(`/tasks/auto-rules/${encodeURIComponent(key)}/preview`, { method: 'POST', body: JSON.stringify(body) }),
    setAutoRules: (body: { enabled?: boolean; rules?: Record<string, Partial<Pick<AutoFollowupRule, 'enabled' | 'when' | 'style' | 'template' | 'pitch' | 'seller_template'>>>; color?: string; alerts?: Partial<FollowupAlerts> }) =>
      this.request<FollowupSettings>('/tasks/auto-rules', { method: 'PUT', body: JSON.stringify(body) }),
    // One-tap "Mark as done" page linked from calendar events - no login, the code is the key.
    publicGet: (code: string) => this.request<PublicFollowup>(`/public/followups/${encodeURIComponent(code)}`),
    publicText: (code: string) => this.request<PublicFollowupText>(`/public/followups/${encodeURIComponent(code)}/text`),
    publicDone: (code: string) => this.request<PublicFollowup>(`/public/followups/${encodeURIComponent(code)}/done`, { method: 'POST' }),
    publicUndo: (code: string) => this.request<PublicFollowup>(`/public/followups/${encodeURIComponent(code)}/undo`, { method: 'POST' }),
    publicView: (code: string) => this.request<PublicFollowup>(`/public/followups/${encodeURIComponent(code)}`),
  };

  /**
   * The one-time setup flow (/setup) - see backend setup_routes.py. Answers are written where
   * every feature already reads them; this only adds the flow's own bookkeeping.
   */
  public setup = {
    get: () => this.request<SetupData>('/setup', { cache: 'no-store' }),
    patchInfo: (patch: SetupInfoPatch) => this.request<SetupData>('/setup/info', { method: 'PATCH', body: JSON.stringify(patch) }),
    setState: (body: { last_step?: string; skip?: string; unskip?: string; confirm?: string; seen?: string[] }) =>
      this.request<SetupData>('/setup/state', { method: 'PUT', body: JSON.stringify(body) }),
    uploadPhoto: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return this.request<SetupData>('/setup/photo', { method: 'POST', body: formData })
    },
  };

  /**
   * Integrations - push new leads OUT to the agent's real CRM (FollowUpBoss / Lofty / kvCORE),
   * and pull portal leads IN via a unique forwarding address (Zillow / Realtor.com / etc.).
   */
  public integrations = {
    get: () => this.request<IntegrationsInfo>('/integrations'),
    update: (data: {
      crm_push_enabled: boolean
      crm_webhook_url?: string | null
      crm_parse_email?: string | null
      crm_fub_api_key?: string | null
    }) => this.request<IntegrationsInfo>('/integrations', { method: 'PUT', body: JSON.stringify(data) }),
    testCrm: () => this.request<CrmTestResult>('/integrations/crm/test', { method: 'POST' }),
    rotateInbound: () => this.request<IntegrationsInfo>('/integrations/inbound/rotate', { method: 'POST' }),
    // Google Calendar: connect() returns the consent URL to send the browser to; the backend
    // callback finishes the OAuth and redirects to /settings?calendar=connected#integrations.
    googleConnectUrl: (back?: 'setup') => this.request<{ auth_url: string }>(`/integrations/google/connect${back ? `?back=${back}` : ''}`),
    disconnectGoogle: () => this.request<IntegrationsInfo>('/integrations/google', { method: 'DELETE' }),
    resyncGoogle: () => this.request<IntegrationsInfo>('/integrations/google/resync', { method: 'POST' }),
    // Microsoft/Outlook Calendar - same shape as Google, a second provider on the same
    // calendar_connections table.
    microsoftConnectUrl: (back?: 'setup') => this.request<{ auth_url: string }>(`/integrations/microsoft/connect${back ? `?back=${back}` : ''}`),
    disconnectMicrosoft: () => this.request<IntegrationsInfo>('/integrations/microsoft', { method: 'DELETE' }),
    resyncMicrosoft: () => this.request<IntegrationsInfo>('/integrations/microsoft/resync', { method: 'POST' }),
    // Send guest emails from the agent's own Gmail / Outlook (backend agent_mailbox_service).
    mailbox: () => this.request<MailboxInfo>('/integrations/mailbox', { cache: 'no-store' }),
    mailboxConnectUrl: (provider: 'google' | 'microsoft', back?: 'setup' | 'emails') =>
      this.request<{ auth_url: string }>(`/integrations/mailbox/${provider}/connect${back ? `?back=${back}` : ''}`),
    setMailboxEnabled: (enabled: boolean) => this.request<MailboxInfo>('/integrations/mailbox', { method: 'PUT', body: JSON.stringify({ enabled }) }),
    testMailbox: () => this.request<MailboxInfo & { ok: boolean; detail: string }>('/integrations/mailbox/test', { method: 'POST' }),
    disconnectMailbox: () => this.request<MailboxInfo>('/integrations/mailbox', { method: 'DELETE' }),
  };
}

export type SetupStepId = 'about' | 'contact' | 'license' | 'photo' | 'story' | 'socials' | 'sales' | 'reviews' | 'brand' | 'hub' | 'forms' | 'signature' | 'alerts' | 'calendar' | 'mailbox' | 'crm' | 'areas' | 'homes' | 'website' | 'domain'
export interface MailboxInfo {
  connected: boolean
  provider: 'google' | 'microsoft' | null
  account_email: string | null
  enabled: boolean
  status: 'ok' | 'needs_reconnect' | 'unavailable' | 'blocked' | null
  last_sent_at: string | null
  total_sent: number
  last_error: string | null
  google_available?: boolean
  microsoft_available?: boolean
}
export interface SetupData {
  plan: string | null
  approved: boolean
  has_mls: boolean
  steps: { id: SetupStepId; status: 'done' | 'skipped' | 'todo'; required: boolean }[]
  last_step: SetupStepId | null
  seen: string[]
  finished: boolean
  complete: boolean
  required_missing: SetupStepId[]
  info: {
    name: string; title: string; brokerage: string; team: string; market: string; about: string; licenseNumber: string
    call: string; text: string; email: string; brokeragePhone: string; officePhone: string; officeAddress: string; linkedin: string
    photoUrl: string; photoPosition: { x: number; y: number }
  }
  slug: string
  social_links: { id: string; label?: string; url: string; enabled: boolean }[]
  look: Record<string, string | boolean>
  reviews: Record<string, any>
}
export interface SetupInfoPatch {
  profile?: Partial<Record<'name' | 'title' | 'brokerage' | 'team' | 'market' | 'about' | 'licenseNumber' | 'brokeragePhone', string>>
  contact?: Partial<Record<'call' | 'text' | 'email', string>>
  card?: Partial<Record<'officePhone' | 'officeAddress' | 'linkedin', string>>
  socialLinks?: { id: string; label?: string; url: string; enabled?: boolean }[]
  photoPosition?: { x: number; y: number }
  look?: Record<string, string | boolean>
}

export const api = new ApiService();
export default api;

/** The IDX neighborhood pages an article can link to (GET /studio/blogs/linkable-areas). */
/** Is the agent's IDX site in Google yet - see backend google_search_service.status_for. */
export interface GoogleSearchStatus {
  state: 'not_live' | 'hidden' | 'unavailable' | 'working' | 'error' | 'done'
  host: string
  site_url: string
  sitemap_url: string
  verified_at: string | null
  sitemap_submitted_at: string | null
  indexnow_pinged_at: string | null
  last_error: string | null
  manual_code: string | null
}

/** The last 28 days in Google - see backend google_search_service.report_for. */
export interface GoogleReportTotals { impressions: number; clicks: number; ctr: number | null; position: number | null }
export interface GoogleReport {
  ready: boolean
  reason?: string
  host?: string
  start?: string
  end?: string
  totals?: GoogleReportTotals
  previous?: GoogleReportTotals
  days?: { date: string; impressions: number; clicks: number }[]
  queries?: { query: string; impressions: number; clicks: number; position: number }[]
  pages?: { path: string; impressions: number; clicks: number }[]
  fetched_at?: string
}

export interface SeoPagesData {
  agent: { name?: string; brokerage?: string; market?: string; phone?: string; title?: string; bio?: string }
  areas: { slug: string; name: string; state?: string; photo?: string | null; median_price?: number | null; active_count?: number | null; school_districts?: string[]; summary?: string }[]
  posts: { id: string; slug: string; title: string; subtitle?: string | null; seo_title?: string | null; meta_description?: string | null; is_indexed?: boolean; cover_image_url?: string | null; published_at?: string | null }[]
  featured: { listing_key: string; address?: string; city?: string; state?: string; zipcode?: string; price?: number; bedrooms?: number; bathrooms?: number; living_area?: number; status?: string; photo?: string | null }[]
  reviews: { count: number; average: number | null } | null
  google_rating?: { count: number; average: number | null } | null
  review_filter_on?: boolean
  published: boolean
}

export interface LinkableAreas {
  ready: boolean
  reason: 'no_plan' | 'no_site' | 'site_off' | 'not_published' | 'no_areas' | null
  site_url: string | null
  areas: { slug: string; name: string; state?: string | null; photo?: string | null; median_price?: number | null; active_count?: number | null; url?: string | null }[]
}

export interface EmailSettingsClientRow {
  key: string; tier: 1 | 2; label: string; help: string; delay?: boolean; modes?: string[]
  on: boolean; via: 'mine' | 'openhousepal'; mode?: 'daily' | 'weekly'
}
export interface EmailSettings {
  client: EmailSettingsClientRow[]
  invite_delay: number; invite_delays: number[]
  briefing_time: string; briefing_times: string[]
  mailbox: { connected: boolean; account_email: string | null; provider: 'google' | 'microsoft' | null; status: string | null }
  receive: { tier: number; title: string; blurb: string; categories: { id: string; label: string; help: string; email: boolean }[] }[]
  always_on: string[]
}
export interface EmailSettingsPatch {
  client?: Record<string, Partial<Pick<EmailSettingsClientRow, 'on' | 'via' | 'mode'>>>
  invite_delay?: number
  briefing_time?: string
  receive?: Record<string, boolean>
}
