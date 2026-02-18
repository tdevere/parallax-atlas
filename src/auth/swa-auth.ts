/**
 * SWA Auth client — uses Azure Static Web Apps built-in authentication.
 *
 * SWA provides:
 *   /.auth/login/aad   — Microsoft login redirect
 *   /.auth/logout       — logout redirect
 *   /.auth/me           — current user principal (JSON)
 *
 * No MSAL SDK needed — auth is handled at the SWA infrastructure layer.
 */

export interface SwaClientPrincipal {
  identityProvider: string
  userId: string
  userDetails: string
  userRoles: string[]
  claims?: Array<{ typ: string; val: string }>
}

export interface AuthUser {
  /** Stable user ID from identity provider */
  userId: string
  /** Display name (email or name) */
  displayName: string
  /** Identity provider ('aad' for Microsoft) */
  provider: string
  /** Roles assigned by SWA */
  roles: string[]
  /** Whether the user has the 'authenticated' role */
  isAuthenticated: boolean
}

const AUTH_ME_ENDPOINT = '/.auth/me'
const AUTH_LOGIN_AAD = '/.auth/login/aad'
const AUTH_LOGOUT = '/.auth/logout'

/**
 * Fetch the current authenticated user from SWA.
 * Returns null if not authenticated.
 */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const response = await fetch(AUTH_ME_ENDPOINT)
    if (!response.ok) return null

    const payload = await response.json() as { clientPrincipal: SwaClientPrincipal | null }
    if (!payload.clientPrincipal) return null

    const principal = payload.clientPrincipal
    return {
      userId: principal.userId,
      displayName: principal.userDetails || 'User',
      provider: principal.identityProvider,
      roles: principal.userRoles,
      isAuthenticated: principal.userRoles.includes('authenticated'),
    }
  } catch {
    return null
  }
}

/**
 * Redirect to Microsoft login.
 * After login, user is redirected back to the given path (defaults to current page).
 */
export function loginWithMicrosoft(postLoginRedirect?: string): void {
  const redirect = postLoginRedirect ?? window.location.pathname + window.location.search
  window.location.href = `${AUTH_LOGIN_AAD}?post_login_redirect_uri=${encodeURIComponent(redirect)}`
}

/**
 * Redirect to SWA logout.
 */
export function logout(postLogoutRedirect?: string): void {
  const redirect = postLogoutRedirect ?? '/'
  window.location.href = `${AUTH_LOGOUT}?post_logout_redirect_uri=${encodeURIComponent(redirect)}`
}

/**
 * Check if running in local dev (not on SWA — /.auth/me will 404).
 */
export function isLocalDev(): boolean {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}
