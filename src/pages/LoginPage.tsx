/**
 * Login Page — Premium authentication experience
 * 
 * Features:
 * - Cohesive design with landing page
 * - Animated journey illustration on left
 * - Glass-card login form on right
 * - Subtle parallax background
 * - Keyboard navigable with visible focus states
 * - Reduced-motion mode support
 */

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginWithMicrosoft } from '../auth/swa-auth'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  
  // Mouse position for parallax
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  
  // Smooth spring animation for mouse movement
  const smoothMouseX = useSpring(mouseX, { damping: 30, stiffness: 200 })
  const smoothMouseY = useSpring(mouseY, { damping: 30, stiffness: 200 })
  
  // Subtle parallax for background
  const backgroundX = useTransform(smoothMouseX, [0, 1], [-10, 10])
  const backgroundY = useTransform(smoothMouseY, [0, 1], [-10, 10])
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])
  
  useEffect(() => {
    if (reducedMotion) return
    
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e
      const { innerWidth, innerHeight } = window
      
      mouseX.set(clientX / innerWidth)
      mouseY.set(clientY / innerHeight)
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [mouseX, mouseY, reducedMotion])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    // Simulate auth check (in real implementation, this would call an API)
    setTimeout(() => {
      if (email && password) {
        // Navigate to the app on successful login
        navigate('/app')
      } else {
        setError('Please enter both email and password')
        setIsLoading(false)
      }
    }, 1000)
  }
  
  const handleMicrosoftLogin = () => {
    loginWithMicrosoft()
  }
  
  const handleBack = () => {
    navigate('/')
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Background Layer with subtle parallax */}
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          x: reducedMotion ? 0 : backgroundX,
          y: reducedMotion ? 0 : backgroundY,
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:72px_72px]" />
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-cyan-600/20 blur-[120px]" />
      </motion.div>
      
      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        onClick={handleBack}
        className="absolute left-6 top-6 z-50 flex items-center gap-2 rounded-lg bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-300 backdrop-blur-sm transition-all hover:bg-slate-800/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </motion.button>
      
      <div className="relative z-10 flex w-full flex-col lg:flex-row">
        {/* Left Side - Journey Illustration */}
        <div className="flex flex-1 items-center justify-center p-8 lg:p-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="max-w-lg space-y-8"
          >
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mb-4 text-4xl font-bold text-white md:text-5xl"
              >
                Welcome back to your
                <span className="block bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  learning journey
                </span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-lg text-slate-400"
              >
                Continue building skills and tracking your progress through the atlas of knowledge.
              </motion.p>
            </div>
            
            {/* Animated Journey Path Visualization */}
            <div className="relative h-64">
              {!reducedMotion ? (
                <>
                  {/* Connecting path */}
                  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 250">
                    <motion.path
                      d="M 50 200 Q 150 50, 250 120 T 350 80"
                      fill="none"
                      stroke="url(#pathGradient)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2, ease: 'easeInOut', delay: 0.5 }}
                    />
                    <defs>
                      <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  
                  {/* Milestone nodes */}
                  {[
                    { x: 50, y: 200, delay: 0.6 },
                    { x: 150, y: 100, delay: 0.9 },
                    { x: 250, y: 120, delay: 1.2 },
                    { x: 350, y: 80, delay: 1.5 },
                  ].map((node, i) => (
                    <motion.div
                      key={i}
                      className="absolute h-4 w-4 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/50"
                      style={{
                        left: `${node.x - 8}px`,
                        top: `${node.y - 8}px`,
                      }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.4, delay: node.delay }}
                    >
                      <motion.div
                        className="absolute inset-0 rounded-full bg-cyan-400"
                        animate={{
                          scale: [1, 1.5, 1],
                          opacity: [0.8, 0, 0.8],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: node.delay,
                        }}
                      />
                    </motion.div>
                  ))}
                </>
              ) : (
                <div className="flex h-full items-center justify-center space-x-4">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="h-4 w-4 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500"
                    />
                  ))}
                </div>
              )}
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Eras Explored', value: '12' },
                { label: 'Progress', value: '68%' },
                { label: 'Streak', value: '7d' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 + i * 0.1 }}
                  className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 backdrop-blur-sm"
                >
                  <div className="text-2xl font-bold text-cyan-400">{stat.value}</div>
                  <div className="text-xs text-slate-400">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
        
        {/* Right Side - Login Form */}
        <div className="flex flex-1 items-center justify-center p-8 lg:p-16">
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="w-full max-w-md"
          >
            <div className="rounded-3xl border border-slate-700/50 bg-slate-800/40 p-8 backdrop-blur-xl shadow-2xl">
              <h2 className="mb-6 text-2xl font-bold text-white">Sign in to continue</h2>
              
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400"
                >
                  {error}
                </motion.div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-300">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-3 text-white placeholder-slate-500 transition-all focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                    placeholder="you@example.com"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-3 pr-12 text-white placeholder-slate-500 transition-all focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                    >
                      {showPassword ? (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900/50 text-cyan-500 focus:ring-2 focus:ring-cyan-400/50 focus:ring-offset-0"
                    />
                    Remember me
                  </label>
                  <a href="#" className="text-sm text-cyan-400 transition-colors hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 rounded">
                    Forgot password?
                  </a>
                </div>
                
                <motion.button
                  type="submit"
                  disabled={isLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-500/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </motion.button>
              </form>
              
              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-700/50" />
                <span className="text-sm text-slate-500">or</span>
                <div className="h-px flex-1 bg-slate-700/50" />
              </div>
              
              <div className="space-y-3">
                <motion.button
                  onClick={handleMicrosoftLogin}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-600/50 bg-slate-900/50 px-6 py-3 font-medium text-slate-300 transition-all hover:border-slate-500/50 hover:bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                >
                  <svg className="h-5 w-5" viewBox="0 0 21 21">
                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                  </svg>
                  Continue with Microsoft
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-600/50 bg-slate-900/50 px-6 py-3 font-medium text-slate-300 transition-all hover:border-slate-500/50 hover:bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </motion.button>
              </div>
              
              <p className="mt-6 text-center text-sm text-slate-400">
                Don't have an account?{' '}
                <a href="#" className="font-medium text-cyan-400 transition-colors hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 rounded">
                  Sign up
                </a>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
