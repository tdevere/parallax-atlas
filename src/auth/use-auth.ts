/**
 * useAuth — React hook for SWA authentication state.
 *
 * Fetches the current user on mount and provides login/logout actions.
 * In local dev mode, provides a mock user for development.
 */

import { useCallback, useEffect, useState } from 'react'
import type { AuthUser } from './swa-auth'
import { fetchCurrentUser, isLocalDev, loginWithMicrosoft, logout } from './swa-auth'

export interface AuthState {
  /** Current user, or null if not logged in */
  user: AuthUser | null
  /** Whether auth state is still loading */
  loading: boolean
  /** Trigger Microsoft login redirect */
  login: () => void
  /** Trigger logout redirect */
  logOut: () => void
  /** Whether the user is authenticated */
  isAuthenticated: boolean
}

const LOCAL_DEV_USER: AuthUser = {
  userId: 'local-dev-user',
  displayName: 'Local Dev',
  provider: 'dev',
  roles: ['anonymous', 'authenticated'],
  isAuthenticated: true,
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (isLocalDev()) {
        // In local dev, provide a mock authenticated user
        if (!cancelled) {
          setUser(LOCAL_DEV_USER)
          setLoading(false)
        }
        return
      }

      const currentUser = await fetchCurrentUser()
      if (!cancelled) {
        setUser(currentUser)
        setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  const login = useCallback(() => {
    loginWithMicrosoft()
  }, [])

  const logOut = useCallback(() => {
    logout()
  }, [])

  return {
    user,
    loading,
    login,
    logOut,
    isAuthenticated: user?.isAuthenticated ?? false,
  }
}
