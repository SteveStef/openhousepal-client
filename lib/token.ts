/**
 * Utility for managing authentication tokens in cookies.
 */

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
 * Set token in cookie - kept as long as the sign-in itself: 30 days with Remember me (renewed each
 * day the app is used - lib/sessionRefresh), 1 day without (owner, 11/01: signed out every 24 hours).
 */
export function setToken(token: string, days: number = 30): void {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${TOKEN_COOKIE_NAME}=${token}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

/** What the sign-in token says about itself (expiry, Remember me) - read only, no checking. */
export function tokenInfo(token: string | null): { exp: number; remember: boolean } | null {
  try {
    const part = (token || '').split('.')[1]
    if (!part) return null
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    return { exp: Number(json.exp) * 1000, remember: json.rm !== false }
  } catch {
    return null
  }
}

/**
 * Remove token from cookie
 */
export function removeToken(): void {
  if (typeof document === 'undefined') return;
  
  document.cookie = `${TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}
