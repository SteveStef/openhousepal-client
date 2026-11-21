/**
 * Helper functions for authentication and subscription checks.
 * These functions are logic-only and do not make direct network calls.
 */

import { User } from '@/types'
import { loginUrlForHere } from '@/lib/loginRedirect'

/**
 * Checks if a user has a valid subscription or is within their trial period.
 */
export function hasValidSubscription(user: User | null): boolean {
  if (!user) return false;
  
  // Admin bypass
  if (user.is_admin) return true;
  
  // Status check
  if (user.subscription_status === 'ACTIVE') return true;
  
  // Trial check
  if (user.subscription_status === 'TRIAL') {
    if (!user.trial_ends_at) return true; // Assume valid if no end date
    // A trial that just ended stays open 48 hours while PayPal takes the first payment (same as the API).
    const grace = user.subscription_id ? 48 * 3600 * 1000 : 0;
    return new Date(user.trial_ends_at).getTime() + grace > Date.now();
  }
  
  // Grace period check for cancelled subscriptions
  if (user.subscription_status === 'CANCELLED') {
    const trialValid = user.trial_ends_at && new Date(user.trial_ends_at) > new Date();
    const billingValid = user.next_billing_date && new Date(user.next_billing_date) > new Date();
    return !!(trialValid || billingValid);
  }
  
  return false;
}

/**
 * Handles common API auth errors and redirects if necessary.
 */
export function handleAuthError(error?: any) {
  if (error) console.error('Authentication error:', error);
  
  if (typeof window !== 'undefined') {
    // If no error provided, assume 401 (unauthorized) for explicit redirects
    const isUnauthorized = !error || error?.status === 401 || error?.message?.includes('401') || error?.error?.includes('401');
    
    if (isUnauthorized) {
      const path = window.location.pathname;
      // Don't redirect if we're already on an auth page. The whole link (query + #) comes back after login.
      if (!path.startsWith('/login') && !path.startsWith('/register')) {
        window.location.href = loginUrlForHere();
      }
    }
  }
}
