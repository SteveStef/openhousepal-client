import { ApiResponse, User, OpenHouse, OpenHouseFormRequest, SearchPreferences, Notification, NotificationResponse, AgentFormConfig, PublicFormConfig, PublicFormSummary, FormSubmissionListItem, MyListingsResponse, MyListingItem, ManualListingPayload, HostRequest, CreateHostRequestPayload, CreateHostRequestResult, ListingDetail, ListingHostNote, CounterHostRequestPayload, AgentSearchResult, TeamMember, Broadcast, IncomingBroadcast, CreateBroadcastPayload, NearbyAmenitiesResponse, BrandKit, DesignProject, DesignProjectCreatePayload, DesignBlock, Site, SiteDomain, SiteBlock, SitePage, SiteTheme, FeaturedSettings, MediaSettings, Blog, BlogListItem, BlogBlock, BlogAnalytics, PublicBlogSummary, PublicBlogDetail, LinkedProperty, Lead, LeadDetail, LeadOpenHouse, LeadStatus, LeadRepresented, LeadSourceFilter, LeadSort, LeadNote, StatSummary, StatHistory, StatMetric, FormStats, CmaReport, CmaReportListItem, CmaMode, CmaStatus, CmaSubjectProperty, CmaComparable, CmaPricing, CmaMarketContext, CmaImprovement, CmaPresentationSettings, CmaCompSearchParams, CmaCompCandidate, CmaShareResponse, CmaPublicResponse, FinancialToolStatus,
  SellerNetSheet, SellerNetSheetListItem, SnsProperty, SnsScenario, SnsLineItem, SnsCompensation, SnsTaxProration, SellerNetSheetPublicResponse,
  BuyerCashNeeded, BuyerCashNeededListItem, BcnProperty, BcnAmount, BcnDownPaymentScenario, BcnLoanType, BcnLineItem, BcnCredits, BcnMonthlyContext, BuyerCashNeededPublicResponse,
  AIConversationListItem, AIConversation, AISendMessageResponse, AIInsightsResponse, DailyDigest,
  AIAdminOverview, AIAdminAgentSummary, AIAdminAgentDetail,
  AIRealtimeSessionOut, AIRealtimeToolCallResult, AgentMarketArea, CollectionPreferences } from '@/types';
import { getToken, removeToken } from './token';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Uploaded media (brand logos, blog covers, design photos, etc.) is stored as a
// backend-relative path like "/uploads/studio-media/xxx.png". The frontend and
// backend run on different origins/ports, so it must be resolved against the API
// host before use as an <img src>. Absolute URLs (MLS photos, data URLs) pass through.
export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) return url;
  return `${API_BASE_URL}${url}`;
}

class ApiService {

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
      title: backend.title,
      message: backend.message,
      visitorName: backend.visitor_name || 'Unknown',
      propertyAddress: backend.property_address || 'Unknown',
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

    verifyBundleCode: (code: string) => this.request<{ plan_id: string }>('/auth/verify-bundle-code', {
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
    brokerages: async (brokerage: string) => this.request<{results: string[]}>(`/api/properties/brokerages?query=${brokerage}`),
    cities: async (city: string) => this.request<{results: string[]}>(`/api/properties/cities?query=${city}`),
    townships: async (township: string) => this.request<{results: string[]}>(`/api/properties/townships?query=${township}`),
    counties: async (query: string) => this.request<{results: string[]}>(`/api/properties/counties?query=${encodeURIComponent(query)}`),
    // Unauthenticated variants for public-facing forms (visitors aren't logged in)
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
      const response = await this.request<{ property: any, agentName: string }>(`/api/properties/agent/${agentId}/listing/${propertyId}`, {}, false);
      if (response.success && response.data?.property) {
        return { 
          ...response, 
          data: { 
            ...response.data.property, 
            agentName: response.data.agentName 
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
      message: string
    }) => this.request<{ success: boolean; message: string }>('/api/properties/message-agent', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: data.agentId,
        property_id: data.propertyId,
        property_address: data.propertyAddress,
        visitor_name: data.visitorName,
        visitor_contact: data.visitorContact,
        message: data.message
      }),
    }),

    scheduleTour: (data: any & { agentId: string }) => 
      this.request<{ success: boolean; message: string }>('/api/properties/schedule-tour', {
        method: 'POST',
        body: JSON.stringify({
          agent_id: data.agentId,
          property_id: data.propertyId,
          property_address: data.propertyAddress,
          visitor_name: data.visitorName,
          visitor_contact: data.visitorContact,
          preferred_date: data.preferredDate,
          preferred_time: data.preferredTime,
          preferred_date_2: data.preferredDate2,
          preferred_time_2: data.preferredTime2,
          preferred_date_3: data.preferredDate3,
          preferred_time_3: data.preferredTime3,
          message: data.message
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

    counterRequest: (requestId: string, payload: CounterHostRequestPayload) => this.request<HostRequest>(`/api/open-house-manager/host-requests/${requestId}/counter`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

    acceptCounter: (requestId: string, slot: 1 | 2 = 1) => this.request<HostRequest>(`/api/open-house-manager/host-requests/${requestId}/counter/accept?slot=${slot}`, {
      method: 'POST',
    }),

    declineCounter: (requestId: string) => this.request<HostRequest>(`/api/open-house-manager/host-requests/${requestId}/counter/decline`, {
      method: 'POST',
    }),

    searchAgents: (q: string) => this.request<AgentSearchResult[]>(`/api/open-house-manager/team/search-agents?q=${encodeURIComponent(q)}`),

    getTeamMembers: () => this.request<TeamMember[]>('/api/open-house-manager/team/members'),

    addTeamMember: (identifier: string) => this.request<TeamMember>('/api/open-house-manager/team/members', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    }),

    removeTeamMember: (memberId: string) => this.request<null>(`/api/open-house-manager/team/members/${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
    }),

    getMyBroadcasts: () => this.request<Broadcast[]>('/api/open-house-manager/team/broadcasts/mine'),

    getIncomingBroadcasts: () => this.request<IncomingBroadcast[]>('/api/open-house-manager/team/broadcasts/incoming'),

    createBroadcast: (payload: CreateBroadcastPayload) => this.request<Broadcast>('/api/open-house-manager/team/broadcasts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

    respondToBroadcast: (broadcastId: string) => this.request<HostRequest>(`/api/open-house-manager/team/broadcasts/${broadcastId}/respond`, {
      method: 'POST',
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

    upgrade: () => this.request<any>('/subscriptions/upgrade', { method: 'POST' }),

    downgrade: () => this.request<any>('/subscriptions/downgrade', { method: 'POST' }),

    cancel: () => this.request<{ message: string }>('/subscriptions/cancel', { method: 'POST' }),

    reactivate: () => this.request('/subscriptions/reactivate', { method: 'POST' }),

    createNew: (planTier: 'BASIC' | 'PREMIUM') => this.request<any>('/subscriptions/create-new', {
      method: 'POST',
      body: JSON.stringify({ plan_tier: planTier }),
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
  };

  /**
   * Collections Namespace
   */
  public collections = {
    getAll: () => this.request<any[]>('/collections/'),

    getPendingRefineRequestsCount: () => this.request<{ count: number }>('/collections/refine-requests/count'),

    getAgentCollections: (agentId: string) => this.request<any[]>(`/agents/${agentId}/collections`),

    getById: (id: string) => this.request<any>(`/collections/${id}`),

    updateCollectionPreference: (customerId: string, interested: boolean) =>
      this.request(`/customers/${customerId}/collection-preference`, {
        method: 'PUT',
        body: JSON.stringify({ interestedInSimilar: interested }),
      }),

    getProperties: (id: string) => this.request<any>(`/collections/${id}/properties`),

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
    getAll: async (unreadOnly: boolean = false, maxAgeDays?: number) => {
      const params: string[] = [];
      if (unreadOnly) params.push('unread_only=true');
      if (maxAgeDays) params.push(`max_age_days=${maxAgeDays}`);
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
  };

  /**
   * Agent Hub Namespace
   */
  public agentHub = {
    getMine: () => this.request<{ id: string; slug: string; status: string; config?: Record<string, any> } | null>('/agent-hub/me'),

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
    }>>(`/agent-hub/me/recent-sales?limit=24${reLicenseNumber ? `&re_license_number=${encodeURIComponent(reLicenseNumber)}` : ''}`),

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
  };

  /**
   * Agent Hub Forms (Buying / Selling / What's My Home Worth) — authenticated
   */
  public forms = {
    getMine: () => this.request<AgentFormConfig[]>('/agent-hub/forms/me'),

    createForm: (title: string) =>
      this.request<AgentFormConfig>('/agent-hub/forms', {
        method: 'POST',
        body: JSON.stringify({ title }),
      }),

    deleteForm: (formId: string) =>
      this.request<null>(`/agent-hub/forms/${formId}`, { method: 'DELETE' }),

    deleteSubmission: (submissionId: string) =>
      this.request<null>(`/agent-hub/forms/submissions/${submissionId}`, { method: 'DELETE' }),

    updateForm: (formId: string, data: Partial<Pick<AgentFormConfig, 'title' | 'headline' | 'subtitle' | 'description' | 'questions' | 'success_heading' | 'success_message' | 'accent_color' | 'show_branding' | 'dark_mode' | 'redirect_to_agent_hub' | 'property_photo_carousel' | 'background_effects' | 'welcome_text_effects' | 'branding_layout' | 'linked_property'>>) =>
      this.request<AgentFormConfig>(`/agent-hub/forms/${formId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

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

    getStats: (formId: string) =>
      this.request<FormStats>(`/agent-hub/forms/${formId}/stats`),

    getStatsSummary: () =>
      this.request<FormStats>('/agent-hub/forms/stats/summary'),

    getSubmissions: (formId: string) =>
      this.request<FormSubmissionListItem[]>(`/agent-hub/forms/${formId}/submissions`),

    markReviewed: (submissionId: string, isReviewed: boolean) =>
      this.request<FormSubmissionListItem>(`/agent-hub/forms/submissions/${submissionId}/reviewed`, {
        method: 'PATCH',
        body: JSON.stringify({ is_reviewed: isReviewed }),
      }),
  };

  /**
   * Studio: shared Brand Kit + media upload
   */
  public studio = {
    getBrandKit: () => this.request<BrandKit>('/studio/brand-kit'),

    updateBrandKit: (data: Partial<Pick<BrandKit, 'primary_color' | 'secondary_color' | 'accent_color' | 'heading_font' | 'body_font' | 'disclaimer_text'>>) =>
      this.request<BrandKit>('/studio/brand-kit', { method: 'PUT', body: JSON.stringify(data) }),

    uploadBrandLogo: (slot: 'personal' | 'team' | 'brokerage', file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return this.request<BrandKit>(`/studio/brand-kit/logo/${slot}`, { method: 'POST', body: formData });
    },

    deleteBrandLogo: (slot: 'personal' | 'team' | 'brokerage') =>
      this.request<BrandKit>(`/studio/brand-kit/logo/${slot}`, { method: 'DELETE' }),

    uploadMedia: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return this.request<{ url: string }>('/studio/media', { method: 'POST', body: formData });
    },
  };

  /**
   * Design Studio
   */
  public designs = {
    getMine: (filters?: { status?: string; design_type?: string; campaign_id?: string }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.design_type) params.set('design_type', filters.design_type);
      if (filters?.campaign_id) params.set('campaign_id', filters.campaign_id);
      const query = params.toString();
      return this.request<DesignProject[]>(`/studio/designs/me${query ? `?${query}` : ''}`);
    },

    create: (data: DesignProjectCreatePayload) =>
      this.request<DesignProject>('/studio/designs', { method: 'POST', body: JSON.stringify(data) }),

    get: (designId: string) => this.request<DesignProject>(`/studio/designs/${designId}`),

    update: (designId: string, data: Partial<Pick<DesignProject, 'name' | 'linked_property' | 'blocks' | 'branding_mode' | 'template_id'>>) =>
      this.request<DesignProject>(`/studio/designs/${designId}`, { method: 'PUT', body: JSON.stringify(data) }),

    updateStatus: (designId: string, statusValue: DesignProject['status']) =>
      this.request<DesignProject>(`/studio/designs/${designId}/status`, { method: 'PATCH', body: JSON.stringify({ status: statusValue }) }),

    duplicate: (designId: string) =>
      this.request<DesignProject>(`/studio/designs/${designId}/duplicate`, { method: 'POST' }),

    delete: (designId: string) => this.request<null>(`/studio/designs/${designId}`, { method: 'DELETE' }),
  };

  /**
   * Website Builder - a separate, standalone system from Agent Hub.
   */
  public sites = {
    getMine: () => this.request<Site>('/studio/sites/me'),

    // Feeds the editor's Form/Showcase block pickers - see backend site_routes.get_my_site_content_options.
    getContentOptions: () => this.request<{ forms: { id: string; title: string; form_type: string }[]; showcases: { id: string; name: string; description: string | null; share_token: string }[] }>('/studio/sites/me/content-options'),

    getAreas: () => this.request<AgentMarketArea[]>('/studio/sites/me/areas'),

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

    updateDraft: (data: { pages?: SitePage[]; theme?: SiteTheme; featured_settings?: FeaturedSettings; media_settings?: MediaSettings }) =>
      this.request<Site>('/studio/sites/me/draft', { method: 'PATCH', body: JSON.stringify(data) }),

    publish: () => this.request<Site>('/studio/sites/me/publish', { method: 'POST' }),

    getDomains: () => this.request<SiteDomain[]>('/studio/sites/me/domains'),

    addDomain: (hostname: string) =>
      this.request<SiteDomain>('/studio/sites/me/domains', { method: 'POST', body: JSON.stringify({ hostname }) }),

    updateDomainStatus: (domainId: string, statusValue: SiteDomain['status']) =>
      this.request<SiteDomain>(`/studio/sites/me/domains/${domainId}/status`, { method: 'PATCH', body: JSON.stringify({ status: statusValue }) }),

    checkDomain: (domainId: string) =>
      this.request<SiteDomain>(`/studio/sites/me/domains/${domainId}/check`, { method: 'POST' }),

    makeDomainPrimary: (domainId: string) =>
      this.request<SiteDomain>(`/studio/sites/me/domains/${domainId}/primary`, { method: 'POST' }),

    deleteDomain: (domainId: string) =>
      this.request<null>(`/studio/sites/me/domains/${domainId}`, { method: 'DELETE' }),
  };

  /**
   * Blogs
   */
  public blogs = {
    getMine: (statusFilter?: string) =>
      this.request<BlogListItem[]>(`/studio/blogs/me${statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ''}`),

    create: (title: string, category?: string, starterBlocks?: BlogBlock[]) =>
      this.request<Blog>('/studio/blogs', { method: 'POST', body: JSON.stringify({ title, category, starter_blocks: starterBlocks }) }),

    get: (blogId: string) => this.request<Blog>(`/studio/blogs/${blogId}`),

    update: (blogId: string, data: Partial<Pick<Blog, 'title' | 'subtitle' | 'cover_image_url' | 'category' | 'tags' | 'blocks' | 'linked_properties' | 'seo_title' | 'meta_description' | 'focus_keyword' | 'social_title' | 'social_description' | 'social_image_url' | 'is_indexed'>>) =>
      this.request<Blog>(`/studio/blogs/${blogId}`, { method: 'PUT', body: JSON.stringify(data) }),

    updateStatus: (blogId: string, statusValue: Blog['status'], scheduledAt?: string) =>
      this.request<Blog>(`/studio/blogs/${blogId}/status`, { method: 'PATCH', body: JSON.stringify({ status: statusValue, scheduled_at: scheduledAt }) }),

    updateHubVisibility: (blogId: string, data: { agent_hub_visible?: boolean; agent_hub_featured?: boolean }) =>
      this.request<Blog>(`/studio/blogs/${blogId}/agent-hub-visibility`, { method: 'PATCH', body: JSON.stringify(data) }),

    checkSlug: (blogId: string, slug: string) =>
      this.request<{ slug: string; available: boolean }>(`/studio/blogs/${blogId}/slug/check?slug=${encodeURIComponent(slug)}`),

    updateSlug: (blogId: string, slug: string) =>
      this.request<Blog>(`/studio/blogs/${blogId}/slug`, { method: 'PUT', body: JSON.stringify({ slug }) }),

    getAnalytics: (blogId: string) => this.request<BlogAnalytics>(`/studio/blogs/${blogId}/analytics`),

    delete: (blogId: string) => this.request<null>(`/studio/blogs/${blogId}`, { method: 'DELETE' }),
  };

  /**
   * Leads (centralized CRM merged from open house visitors, form submissions, showcase
   * activity, showing requests, and property comments - see backend app/api/lead_routes.py)
   */
  public leads = {
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

    downloadCsv: async (filters?: { source?: LeadSourceFilter; status?: string; represented?: string; search?: string; sort?: LeadSort; openHouseEventId?: string; hidden?: boolean }) => {
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
      market_context: CmaMarketContext, improvements: CmaImprovement[], presentation: CmaPresentationSettings,
    }>) => this.request<CmaReport>(`/api/cma/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

    remove: (id: string) => this.request<void>(`/api/cma/${id}`, { method: 'DELETE' }),

    searchComparables: (payload: CmaCompSearchParams) =>
      this.request<CmaCompCandidate[]>('/api/cma/comparables/search', { method: 'POST', body: JSON.stringify(payload) }),

    share: (id: string) => this.request<CmaShareResponse>(`/api/cma/${id}/share`, { method: 'POST' }),

    generateAiAnalysis: (id: string, payload: { max_photos_per_property?: number, include_map_images?: boolean, force_regenerate?: boolean } = {}) =>
      this.request<CmaReport>(`/api/cma/${id}/generate-ai-analysis`, { method: 'POST', body: JSON.stringify(payload) }),
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
    getCmaReport: (slug: string) => this.request<CmaPublicResponse>(`/api/cma/public/${encodeURIComponent(slug)}`, {}, false),

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

    getSharedShowcase: (shareToken: string) =>
      this.request<any>(`/collections/shared/${shareToken}`, {}, false),

    // Visitor self-serve: address/radius/price/beds/baths only (narrower than the
    // agent-side api.collections.updatePreferencesAndRefresh) - re-runs the real match
    // and returns the same shape as getSharedShowcase, refreshed.
    updateShowcasePreferences: (shareToken: string, preferences: Partial<CollectionPreferences>) =>
      this.request<any>(`/collections/shared/${shareToken}/update-preferences-and-refresh`, {
        method: 'PUT',
        body: JSON.stringify(preferences),
      }, false),

    interactWithProperty: (collectionId: string, propertyId: string, interactionType: 'like' | 'dislike', value: boolean) =>
      this.request<any>(`/collections/${collectionId}/properties/${propertyId}/interact`, {
        method: 'POST',
        body: JSON.stringify({ interaction_type: interactionType, value }),
      }, false),

    addPropertyComment: (collectionId: string, propertyId: string, content: string, visitorName: string) =>
      this.request<any>(`/collections/${collectionId}/properties/${propertyId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content, visitor_name: visitorName }),
      }, false),

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
      }, false),

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
      }, true),

    getPublicForms: (agentSlug: string) =>
      this.request<PublicFormSummary[]>(`/agent-hub/forms/public/${encodeURIComponent(agentSlug)}`, {}, false),

    getPublicForm: (agentSlug: string, formSlug: string) =>
      this.request<PublicFormConfig>(`/agent-hub/forms/public/${encodeURIComponent(agentSlug)}/${encodeURIComponent(formSlug)}`, {}, false),

    submitPublicForm: (agentSlug: string, formSlug: string, answers: { questionId: string; value: unknown }[]) =>
      this.request<{ success: boolean; message: string; submissionId?: string; redirectUrl?: string }>(
        `/agent-hub/forms/public/${encodeURIComponent(agentSlug)}/${encodeURIComponent(formSlug)}/submit`,
        { method: 'POST', body: JSON.stringify({ answers }) },
        false,
      ),

    trackFormProgress: (agentSlug: string, formSlug: string, data: { sessionKey: string; stepIndex: number; questionId?: string | null; completed?: boolean }) =>
      this.request<{ success: boolean }>(
        `/agent-hub/forms/public/${encodeURIComponent(agentSlug)}/${encodeURIComponent(formSlug)}/progress`,
        { method: 'POST', body: JSON.stringify(data) },
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
    getPublicBlog: (agentSlug: string, blogSlug: string) =>
      this.request<PublicBlogDetail>(`/studio/blogs/public/${encodeURIComponent(agentSlug)}/${encodeURIComponent(blogSlug)}`, {}, true),

    trackBlogEvent: (agentSlug: string, blogSlug: string, eventType: 'link_click' | 'property_click' | 'contact_click' | 'video_play' | 'qr_scan' | 'lead_submit', meta?: Record<string, unknown>) =>
      this.request<null>(
        `/studio/blogs/public/${encodeURIComponent(agentSlug)}/${encodeURIComponent(blogSlug)}/event`,
        { method: 'POST', body: JSON.stringify({ event_type: eventType, meta }) },
        false,
      ),
  };
}

export const api = new ApiService();
export default api;
