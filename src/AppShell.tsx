/**
 * AppShell — entry gate that shows the Landing Page or the main App.
 *
 * Transition rules:
 *   1. If the user is already authenticated (SWA cookie), skip landing → show App.
 *   2. If a session flag (`entered`) exists, skip landing → show App (guest revisit).
 *   3. If `?subjectPack=` or `window.__TIMELINE_VIEWER_CONFIG__` is set
 *      (embedded / provided-context), skip landing → show App.
 *   4. Otherwise show LandingPage with Sign-In + Guest Entry CTAs.
 */

import { useCallback, useMemo, useState } from 'react'
import App from './App'
import { useAuth } from './auth'
import { LandingPage } from './components/LandingPage'
import type { RuntimeNotice, SubjectPackEntry, TimelineViewerConfig, ViewerMode } from './viewer/types'

declare global {
  interface Window {
    /** Test-only: force the landing page to display on localhost */
    __FORCE_LANDING_PAGE__?: boolean
  }
}

const SESSION_ENTERED_KEY = 'parallax-atlas-entered'

interface AppShellProps {
  config?: TimelineViewerConfig
  availablePacks?: SubjectPackEntry[]
  notices?: RuntimeNotice[]
  bingMapsApiKey?: string
  onSwitchContext: (mode: ViewerMode, subjectPackId?: string) => void
}

/**
 * Non-auth, non-dynamic reasons to skip the landing page.
 * Evaluated once at module load.
 */
function computeSkipLandingStatic(): boolean {
  // Test override: force landing page to display
  if (window.__FORCE_LANDING_PAGE__) return false
  // Embedded / provided-context mode
  if (window.__TIMELINE_VIEWER_CONFIG__) return true
  // Subject pack query (direct link to a pack)
  if (new URLSearchParams(window.location.search).has('subjectPack')) return true
  // Guest previously entered this session
  if (sessionStorage.getItem(SESSION_ENTERED_KEY) === '1') return true
  return false
}

const SKIP_LANDING_STATIC = computeSkipLandingStatic()

export function AppShell({ config, availablePacks, notices, bingMapsApiKey, onSwitchContext }: AppShellProps) {
  const auth = useAuth()
  const [enteredAsGuest, setEnteredAsGuest] = useState(false)

  /** Derive showApp from auth state + guest flag — no effect needed */
  const showApp = useMemo(() => {
    if (SKIP_LANDING_STATIC) return true
    if (enteredAsGuest) return true
    // Don't auto-skip when force-landing is set (for testing)
    if (!window.__FORCE_LANDING_PAGE__ && !auth.loading && auth.isAuthenticated) return true
    return false
  }, [auth.loading, auth.isAuthenticated, enteredAsGuest])

  const handleGuestEntry = useCallback(() => {
    sessionStorage.setItem(SESSION_ENTERED_KEY, '1')
    setEnteredAsGuest(true)
  }, [])

  const handleLogin = useCallback(() => {
    auth.login()
  }, [auth])

  /* Still resolving auth — show minimal loading */
  if (auth.loading && !showApp) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-sm text-slate-300">
        Loading…
      </div>
    )
  }

  /* Show landing page */
  if (!showApp) {
    return (
      <LandingPage
        onLogin={handleLogin}
        onGuestEntry={handleGuestEntry}
        authLoading={auth.loading}
      />
    )
  }

  /* Show main app */
  return (
    <App
      availablePacks={availablePacks}
      bingMapsApiKey={bingMapsApiKey}
      config={config}
      notices={notices}
      onSwitchContext={onSwitchContext}
    />
  )
}
