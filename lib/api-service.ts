import { ApiResponse, SignInFormData, User } from '@/types';
import { getToken, removeToken } from './token';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

class ApiService {

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = getToken();

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

      console.log("Request Function", endpoint, data);
      console.log("Used auth:", token ? true : false);

      if (response.status === 401) {
        this.handleUnauthorized();
        return { success: false, error: 'Session expired. Please log in again.' };
      }

      if (!response.ok) {
        return {
          success: false,
          error: data?.detail || data?.message || `Error: ${response.status}`,
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

    signupWithSubscription: (data: any, subscriptionId: string, planId: string, bundleCode?: string) => {
      let url = `/auth/signup-with-subscription?subscription_id=${encodeURIComponent(subscriptionId)}&plan_id=${encodeURIComponent(planId)}`;
      if (bundleCode) url += `&bundle_code=${encodeURIComponent(bundleCode)}`;
      return this.request<{ access_token: string }>(url, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  };

  /**
   * Properties Namespace
   */
  public properties = {
    getById: (id: string) => this.request<any>(`/api/properties/${id}`),
    getByQR: (qrCode: string) => this.request<any>(`/api/open-house/property/${qrCode}`),
  };

  /**
   * Collections Namespace
   */
  public collections = {
    // We'll add methods here as we migrate
  };
}

export const api = new ApiService();
export default api;
