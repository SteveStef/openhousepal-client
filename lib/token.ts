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
 * Set token in cookie (expires in 24 hours)
 */
export function setToken(token: string): void {
  if (typeof document === 'undefined') return;
  
  // Set cookie to expire in 24 hours
  const expires = new Date();
  expires.setTime(expires.getTime() + (24 * 60 * 60 * 1000));
  
  document.cookie = `${TOKEN_COOKIE_NAME}=${token}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

/**
 * Remove token from cookie
 */
export function removeToken(): void {
  if (typeof document === 'undefined') return;
  
  document.cookie = `${TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}
