import { Property, SignInFormData, ApiResponse, CollectionPreferences } from '@/types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'

class ApiClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `HTTP error! status: ${response.status}`,
        }
      }

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      }
    }
  }

  // Property endpoints
  async getProperty(id: string): Promise<ApiResponse<Property>> {
    return this.request(`/properties/${id}`)
  }

  // Property endpoints
  async getPropertyByQR(qrCode: string): Promise<ApiResponse<{ property: any; openHouse: any }>> {
    return this.request(`/open-house/property/${qrCode}`)
  }

  // Open house form submission
  async submitSignIn(data: {
    formData: SignInFormData
    openHouseEventId: string
  }): Promise<ApiResponse<{ success: boolean; message: string; visitor_id?: string; collection_created?: boolean }>> {
    return this.request('/open-house/submit', {
      method: 'POST',
      body: JSON.stringify({
        ...data.formData,
        open_house_event_id: data.openHouseEventId
      }),
    })
  }

  // Property visit endpoints (legacy)
  async submitPropertyVisit(data: {
    full_name: string
    email: string
    phone: string
    visiting_reason: string
    timeframe: string
    has_agent: string
    property_id: string
    agent_id?: string
    interested_in_similar: boolean
  }): Promise<ApiResponse<{ success: boolean; message: string; collection_id?: string }>> {
    return this.request('/property-visit/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCollectionPreference(customerId: number, interestedInSimilar: boolean): Promise<ApiResponse<void>> {
    return this.request(`/customers/${customerId}/collection-preference`, {
      method: 'PUT',
      body: JSON.stringify({ interestedInSimilar }),
    })
  }

  // Agent endpoints
  async getAgentCollections(agentId: number): Promise<ApiResponse<any[]>> {
    return this.request(`/agents/${agentId}/collections`)
  }

  async getCollectionProperties(collectionId: number): Promise<ApiResponse<Property[]>> {
    return this.request(`/collections/${collectionId}/properties`)
  }

  // Collection preferences endpoints
  async getCollectionPreferences(collectionId: string): Promise<ApiResponse<CollectionPreferences>> {
    return this.request(`/collection-preferences/collection/${collectionId}`)
  }

  async updateCollectionPreferences(collectionId: string, preferences: Partial<CollectionPreferences>): Promise<ApiResponse<CollectionPreferences>> {
    return this.request(`/collection-preferences/collection/${collectionId}`, {
      method: 'PUT',
      body: JSON.stringify(preferences),
    })
  }

  // Analytics endpoints
  async trackPropertyView(propertyId: number, customerId?: number): Promise<ApiResponse<void>> {
    return this.request('/analytics/property-view', {
      method: 'POST',
      body: JSON.stringify({ propertyId, customerId }),
    })
  }
}

// Create and export the API client instance
export const api = new ApiClient(API_BASE_URL)

// Utility functions for common operations
export const propertyApi = {
  getByQR: (qrCode: string) => api.getPropertyByQR(qrCode),
  getById: (id: string) => api.getProperty(id),
}

export const customerApi = {
  signIn: (formData: SignInFormData, openHouseEventId: string) => 
    api.submitSignIn({ formData, openHouseEventId }),
  updateCollectionPreference: (customerId: number, interested: boolean) =>
    api.updateCollectionPreference(customerId, interested),
}

export const propertyVisitApi = {
  submit: (data: {
    full_name: string
    email: string
    phone: string
    visiting_reason: string
    timeframe: string
    has_agent: string
    property_id: string
    agent_id?: string
    interested_in_similar: boolean
  }) => api.submitPropertyVisit(data),
}

export const agentApi = {
  getCollections: (agentId: number) => api.getAgentCollections(agentId),
  getCollectionProperties: (collectionId: number) => api.getCollectionProperties(collectionId),
}

export const collectionPreferencesApi = {
  get: (collectionId: string) => api.getCollectionPreferences(collectionId),
  update: (collectionId: string, preferences: Partial<CollectionPreferences>) => 
    api.updateCollectionPreferences(collectionId, preferences),
}

export const analyticsApi = {
  trackView: (propertyId: number, customerId?: number) => 
    api.trackPropertyView(propertyId, customerId),
}

export default api
