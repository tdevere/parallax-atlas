/**
 * LandingPage — visually stunning entry point with mouse-driven parallax,
 * cosmic learning-journey theme, and sign-in / guest-entry CTAs.
 *
 * Layers (back → front):
 *   1. Deep-space gradient background
 *   2. Animated star field (CSS keyframes)
 *   3. Floating timeline era "cards" that parallax with mouse
 *   4. Central hero text + CTA buttons
 *   5. Subtle radial glow that follows cursor
 *
 * No external dependencies — pure React + CSS transforms.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/* ── Types ─────────────────────────────────────────────────────────── */

interface LandingPageProps {
  /** Trigger Microsoft login */
  onLogin: () => void
  /** Enter the app without signing in */
  onGuestEntry: () => void
  /** Whether auth state is still resolving */
  authLoading?: boolean
}

interface ParallaxState {
  /** Normalized mouse X: -1 (left) → 1 (right) */
  x: number
  /** Normalized mouse Y: -1 (top) → 1 (bottom) */
  y: number
}

/* ── Floating era data (decorative) ────────────────────────────────── */

const FLOATING_ERAS = [
  { label: 'Big Bang', emoji: '💥', x: 12, y: 18, depth: 0.9, size: 'lg' },
  { label: 'First Stars', emoji: '⭐', x: 78, y: 14, depth: 0.7, size: 'md' },
  { label: 'Solar System', emoji: '☀️', x: 22, y: 72, depth: 0.5, size: 'md' },
  { label: 'Life Begins', emoji: '🧬', x: 85, y: 65, depth: 0.8, size: 'lg' },
  { label: 'Dinosaurs', emoji: '🦕', x: 55, y: 82, depth: 0.4, size: 'sm' },
  { label: 'Human Era', emoji: '🏛️', x: 68, y: 35, depth: 0.6, size: 'md' },
  { label: 'Renaissance', emoji: '🎨', x: 30, y: 42, depth: 0.3, size: 'sm' },
  { label: 'Space Age', emoji: '🚀', x: 90, y: 45, depth: 0.85, size: 'md' },
  { label: 'Digital Era', emoji: '💻', x: 8, y: 50, depth: 0.55, size: 'sm' },
  { label: 'Quantum Future', emoji: '🔮', x: 48, y: 15, depth: 0.75, size: 'sm' },
] as const

/* ── Component ─────────────────────────────────────────────────────── */

export function LandingPage({ onLogin, onGuestEntry, authLoading }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mouse, setMouse] = useState<ParallaxState>({ x: 0, y: 0 })
  const [entered, setEntered] = useState(false)
  const animFrame = useRef(0)

  /* Track mouse for parallax */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (animFrame.current) cancelAnimationFrame(animFrame.current)
    animFrame.current = requestAnimationFrame(() => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
      setMouse({ x: nx, y: ny })
    })
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('mousemove', handleMouseMove)
    return () => {
      el.removeEventListener('mousemove', handleMouseMove)
      if (animFrame.current) cancelAnimationFrame(animFrame.current)
    }
  }, [handleMouseMove])

  /* Entrance animation trigger */
  useEffect(() => {
    const timer = setTimeout(() => setEntered(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      ref={containerRef}
      className="landing-root"
      style={{ perspective: '1200px' }}
    >
      {/* ── Layer 1: Star field ──────────────────────────────────── */}
      <div className="landing-stars" aria-hidden="true">
        <div className="landing-stars-layer landing-stars-small" />
        <div className="landing-stars-layer landing-stars-medium" />
        <div className="landing-stars-layer landing-stars-large" />
      </div>

      {/* ── Layer 2: Radial glow follows cursor ──────────────────── */}
      <div
        className="landing-cursor-glow"
        aria-hidden="true"
        style={{
          transform: `translate(${mouse.x * 30}%, ${mouse.y * 30}%)`,
        }}
      />

      {/* ── Layer 3: Floating era cards (parallax) ───────────────── */}
      <div className="landing-eras" aria-hidden="true">
        {FLOATING_ERAS.map((era) => {
          const offsetX = mouse.x * era.depth * 40
          const offsetY = mouse.y * era.depth * 40
          const scale = era.size === 'lg' ? 1.1 : era.size === 'md' ? 0.9 : 0.72
          return (
            <div
              key={era.label}
              className={`landing-era-card ${entered ? 'landing-era-visible' : ''}`}
              style={{
                left: `${era.x}%`,
                top: `${era.y}%`,
                transform: `translate3d(${offsetX}px, ${offsetY}px, ${era.depth * 120}px) scale(${scale})`,
                transitionDelay: `${era.depth * 600}ms`,
              }}
            >
              <span className="landing-era-emoji">{era.emoji}</span>
              <span className="landing-era-label">{era.label}</span>
            </div>
          )
        })}
      </div>

      {/* ── Layer 4: Timeline journey line (decorative) ──────────── */}
      <svg
        className={`landing-journey-line ${entered ? 'landing-journey-visible' : ''}`}
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{
          transform: `translate3d(${mouse.x * 10}px, ${mouse.y * 5}px, 20px)`,
        }}
      >
        <defs>
          <linearGradient id="journey-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
            <stop offset="15%" stopColor="#6366f1" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.8" />
            <stop offset="85%" stopColor="#a78bfa" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M 0,100 C 200,60 400,140 600,100 C 800,60 1000,140 1200,100"
          fill="none"
          stroke="url(#journey-grad)"
          strokeWidth="2"
          className="landing-journey-path"
        />
        {/* Milestone dots along path */}
        {[150, 350, 600, 850, 1050].map((cx, i) => (
          <circle
            key={i}
            cx={cx}
            cy={100 + Math.sin((cx / 1200) * Math.PI * 2) * 40}
            r="4"
            fill="#22d3ee"
            opacity="0.7"
            className="landing-milestone-dot"
            style={{ animationDelay: `${i * 200 + 800}ms` }}
          />
        ))}
      </svg>

      {/* ── Layer 5: Hero content ────────────────────────────────── */}
      <div
        className={`landing-hero ${entered ? 'landing-hero-visible' : ''}`}
        style={{
          transform: `translate3d(${mouse.x * -8}px, ${mouse.y * -8}px, 60px)`,
        }}
      >
        <div className="landing-badge">
          <span className="landing-badge-dot" />
          Parallax Atlas
        </div>

        <h1 className="landing-title">
          Explore the
          <br />
          <span className="landing-title-accent">Timeline of Knowledge</span>
        </h1>

        <p className="landing-subtitle">
          Journey from the Big Bang to the Digital Age.
          <br />
          Track what you learn. See how far you&apos;ve come.
        </p>

        <div className="landing-cta-group">
          <button
            className="landing-cta-primary"
            onClick={onLogin}
            disabled={authLoading}
            data-testid="landing-sign-in"
          >
            {authLoading ? (
              <span className="landing-spinner" />
            ) : (
              <>
                <svg viewBox="0 0 21 21" fill="currentColor" className="landing-ms-icon" aria-hidden="true">
                  <rect x="1" y="1" width="9" height="9" />
                  <rect x="11" y="1" width="9" height="9" />
                  <rect x="1" y="11" width="9" height="9" />
                  <rect x="11" y="11" width="9" height="9" />
                </svg>
                Sign in with Microsoft
              </>
            )}
          </button>

          <button
            className="landing-cta-secondary"
            onClick={onGuestEntry}
            data-testid="landing-guest-entry"
          >
            Explore as Guest
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-1" aria-hidden="true">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <p className="landing-footer-note">
          Free &amp; open-source learning timeline · No account required
        </p>
      </div>

      {/* ── Corner decoration: version badge ─────────────────────── */}
      <div className="landing-version" aria-hidden="true">
        v0.1 · Built with ❤️
      </div>
    </div>
  )
}
