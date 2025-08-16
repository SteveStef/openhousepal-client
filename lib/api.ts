import { Property, SignInFormData, ApiResponse } from '@/types'

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
  async getPropertyByQR(qrCode: string): Promise<ApiResponse<{ property: Property; openHouse: any }>> {
    return this.request(`/open-houses/qr/${qrCode}`)
  }

  async getProperty(id: number): Promise<ApiResponse<Property>> {
    return this.request(`/properties/${id}`)
  }

  // Customer endpoints
  async submitSignIn(data: {
    formData: SignInFormData
    propertyId: number
    qrCode: string
  }): Promise<ApiResponse<{ customerId: number; collectionId?: number }>> {
    return this.request('/customers/sign-in', {
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
  getById: (id: number) => api.getProperty(id),
}

export const customerApi = {
  signIn: (formData: SignInFormData, propertyId: number, qrCode: string) => 
    api.submitSignIn({ formData, propertyId, qrCode }),
  updateCollectionPreference: (customerId: number, interested: boolean) =>
    api.updateCollectionPreference(customerId, interested),
}

export const agentApi = {
  getCollections: (agentId: number) => api.getAgentCollections(agentId),
  getCollectionProperties: (collectionId: number) => api.getCollectionProperties(collectionId),
}

export const analyticsApi = {
  trackView: (propertyId: number, customerId?: number) => 
    api.trackPropertyView(propertyId, customerId),
}

export default api
