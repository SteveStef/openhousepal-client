// Authentication utilities for handling API requests and redirects

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

// Base API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Token management
const TOKEN_COOKIE_NAME = 'auth_token';

/**
 * Get token from cookie
 */
export function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === TOKEN_COOKIE_NAME) {
      return value;
    }
  }
  return null;
}

/**
 * Set token in cookie
 */
function setToken(token: string): void {
  if (typeof document === 'undefined') return;
  
  // Set cookie to expire in 24 hours
  const expires = new Date();
  expires.setTime(expires.getTime() + (24 * 60 * 60 * 1000));
  
  document.cookie = `${TOKEN_COOKIE_NAME}=${token}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

/**
 * Remove token from cookie
 */
function removeToken(): void {
  if (typeof document === 'undefined') return;
  
  document.cookie = `${TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

/**
 * Make authenticated API request with automatic error handling
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = getToken();
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    // Add Authorization header if token exists
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    const response = await fetch(url, {
      headers,
      ...options,
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    // Handle authentication errors
    if (response.status === 401) {
      handleAuthError();
      return { status: response.status, error: 'Authentication required' };
    }

    return {
      status: response.status,
      data: response.ok ? data : undefined,
      error: !response.ok ? (data?.detail || 'Request failed') : undefined,
    };
  } catch (error) {
    console.error('API Request failed:', error);
    return {
      status: 0,
      error: 'Network error. Please check your connection.',
    };
  }
}

/**
 * Handle authentication errors by redirecting to login
 */
export function handleAuthError() {
  // Clear the auth token
  removeToken();
  
  // Redirect to login page
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    // Don't redirect if already on auth pages
    if (!currentPath.startsWith('/login') && !currentPath.startsWith('/register')) {
      window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
    }
  }
}

/**
 * Check if user is authenticated by testing a protected endpoint
 * This version doesn't automatically remove the token on failure
 */
export async function checkAuth(): Promise<boolean> {
  try {
    // Check if we have a token first
    const token = getToken();
    console.log('🔍 Auth check - Token exists:', !!token);
    console.log('🔍 Auth check - Token preview:', token ? token.substring(0, 20) + '...' : 'none');
    
    if (!token) {
      console.log('❌ Auth check - No token found');
      return false;
    }
    
    // Make a direct fetch request to avoid automatic token removal
    const url = `${API_BASE_URL}/auth/me`;
    console.log('🌐 Auth check - Making request to:', url);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('📊 Auth check - Response status:', response.status);
    
    if (response.status === 200) {
      const data = await response.json();
      console.log('✅ Auth check - Success! User data:', data);
      return true;
    } else {
      const errorText = await response.text();
      console.log('❌ Auth check - Failed with status:', response.status);
      console.log('❌ Auth check - Error response:', errorText);
      return false;
    }
  } catch (error) {
    console.log('💥 Auth check - Network/parsing error:', error);
    return false;
  }
}

/**
 * Get current user information
 * This version doesn't automatically remove the token on failure
 */
export async function getCurrentUser(): Promise<any> {
  try {
    const token = getToken();
    if (!token) {
      console.log('👤 getCurrentUser - No token found');
      return null;
    }
    
    // Make a direct fetch request to avoid automatic token removal
    const url = `${API_BASE_URL}/auth/me`;
    console.log('👤 getCurrentUser - Making request to:', url);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('👤 getCurrentUser - Response status:', response.status);
    
    if (response.status === 200) {
      const data = await response.json();
      console.log('✅ getCurrentUser - Success:', data);
      return data;
    } else {
      const errorText = await response.text();
      console.log('❌ getCurrentUser - Failed with status:', response.status);
      console.log('❌ getCurrentUser - Error response:', errorText);
      return null;
    }
  } catch (error) {
    console.log('💥 getCurrentUser - Error:', error);
    return null;
  }
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (error) {
    console.error('Logout error:', error);
  }
  
  // Remove token from cookie
  removeToken();
  
  // Redirect to login page
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

/**
 * Login user with credentials
 */
export async function login(email: string, password: string): Promise<ApiResponse> {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  
  // If login successful, store the token
  if (response.status === 200 && response.data?.access_token) {
    setToken(response.data.access_token);
  }
  
  return response;
}

/**
 * Register new user
 */
export async function register(userData: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}): Promise<ApiResponse> {
  const response = await apiRequest('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
  
  // If signup successful, store the token
  if (response.status === 201 && response.data?.access_token) {
    setToken(response.data.access_token);
  }
  
  return response;
}

/**
 * Update collection preferences
 */
export async function updateCollectionPreferences(
  collectionId: string, 
  preferences: {
    min_beds?: number | null;
    max_beds?: number | null;
    min_baths?: number | null;
    max_baths?: number | null;
    min_price?: number | null;
    max_price?: number | null;
    lat?: number | null;
    long?: number | null;
    diameter?: number;
    special_features?: string;
  }
): Promise<ApiResponse> {
  return await apiRequest(`/collection-preferences/collection/${collectionId}`, {
    method: 'PUT',
    body: JSON.stringify(preferences),
  });
}
