import { ApiResponse, User, OpenHouse, SearchPreferences, Notification, NotificationResponse } from '@/types';
import { getToken, removeToken } from './token';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiService {

  private async request<T>(endpoint: string, options: RequestInit = {}, includeToken: boolean = true): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = includeToken ? getToken() : null;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
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
      body: JSON.stringify({ password, token }),
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
    
    lookup: (address: string) => this.request<any>('/api/properties/lookup', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),

    // this is used for the OHP kit
    address: async (address: string) => this.request<{ results: { address: string, lat: number, lng: number }[] }>(`/api/properties/address?query=${encodeURIComponent(address)}`),
    // this is for searching brokerages
    brokerages: async (brokerage: string) => this.request<{results: string[]}>(`/api/properties/brokerages?query=${brokerage}`),
    cities: async (city: string) => this.request<{results: string[]}>(`/api/properties/cities?query=${city}`),
    townships: async (township: string) => this.request<{results: string[]}>(`/api/properties/townships?query=${township}`),

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

    updateSnapshot: (id: string, snapshot: any[]) => this.request(`/api/open-houses/${id}/snapshot`, {
      method: 'PATCH',
      body: JSON.stringify({ similar_properties_snapshot: snapshot }),
    }),

    getVisitors: (id: string) => this.request<any[]>(`/api/open-houses/${id}/visitors`),

    updateVisitorNote: (visitorId: string, notes: string) => this.request(`/api/visitors/${visitorId}/note`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
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
  };

  /**
   * Collections Namespace
   */
  public collections = {
    getAll: () => this.request<any[]>('/collections/'),

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

    updatePreferencesAndRefresh: (collectionId: string, preferences: any) => 
      this.request<{ preferences: any, properties_count: number }>(`/collections/${collectionId}/update-preferences-and-refresh`, {
        method: 'PUT',
        body: JSON.stringify(preferences),
      }),
  };

  /**
   * Notifications Namespace
   */
  public notifications = {
    getAll: async (unreadOnly: boolean = false) => {
      const queryParam = unreadOnly ? '?unread_only=true' : '';
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

    getUnreadCount: () => this.request<{ unread_count: number }>('/api/v1/notifications/unread-count'),

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
  };

  /**
   * Public / Visitor Namespace (Does NOT include JWT)
   */
  public public = {
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
            ListPictureURL: p.imageSrc || ''
          }
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

    getSharedShowcase: (shareToken: string) => 
      this.request<any>(`/collections/shared/${shareToken}`, {}, false),

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

    trackPropertyView: (collectionId: string, propertyId: string) =>
      this.request<any>(`/collections/${collectionId}/properties/${propertyId}/view`, {
        method: 'POST',
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
  };
}

export const api = new ApiService();
export default api;
