/**
 * Landing Page — Premium learning journey entry point
 * 
 * Features:
 * - Mouse-driven parallax across multiple depth layers
 * - Interactive milestone journey with zoom-to-detail
 * - Smooth animations with Framer Motion
 * - Responsive from mobile to ultrawide
 * - Reduced-motion mode support
 */

import { motion, useTransform, useMotionValue, useSpring, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Milestone {
  id: string
  title: string
  description: string
  icon: string
  progress: number
}

const milestones: Milestone[] = [
  { id: '1', title: 'Onboard', description: 'Start your learning journey with guided orientation', icon: '🚀', progress: 0 },
  { id: '2', title: 'Fundamentals', description: 'Build core knowledge and mental models', icon: '📚', progress: 0 },
  { id: '3', title: 'Practice', description: 'Apply concepts through hands-on exercises', icon: '💪', progress: 0 },
  { id: '4', title: 'Projects', description: 'Create real-world applications', icon: '🔨', progress: 0 },
  { id: '5', title: 'Feedback', description: 'Refine skills with expert guidance', icon: '💡', progress: 0 },
  { id: '6', title: 'Ship', description: 'Deploy and share your work', icon: '🚢', progress: 0 },
  { id: '7', title: 'Mastery', description: 'Achieve deep expertise and teach others', icon: '🏆', progress: 0 },
]

// Generate stable particle positions outside component
const particles = [...Array(15)].map(() => ({
  left: Math.random() * 100,
  top: Math.random() * 100,
  duration: 3 + Math.random() * 2,
  delay: Math.random() * 2,
}))

export function LandingPage() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Mouse position for parallax
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  
  // Smooth spring animation for mouse movement
  const smoothMouseX = useSpring(mouseX, { damping: 30, stiffness: 200 })
  const smoothMouseY = useSpring(mouseY, { damping: 30, stiffness: 200 })
  
  // Parallax transforms for different layers
  const backgroundX = useTransform(smoothMouseX, [0, 1], [-20, 20])
  const backgroundY = useTransform(smoothMouseY, [0, 1], [-20, 20])
  const midgroundX = useTransform(smoothMouseX, [0, 1], [-40, 40])
  const midgroundY = useTransform(smoothMouseY, [0, 1], [-40, 40])
  const foregroundX = useTransform(smoothMouseX, [0, 1], [-60, 60])
  const foregroundY = useTransform(smoothMouseY, [0, 1], [-60, 60])
  
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null)
  const [hoveredMilestone, setHoveredMilestone] = useState<string | null>(null)
  
  // Check for reduced motion preference
  const [reducedMotion, setReducedMotion] = useState(() => 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])
  
  // Track mouse position
  useEffect(() => {
    if (reducedMotion) return
    
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e
      const { innerWidth, innerHeight } = window
      
      // Normalize to 0-1 range
      mouseX.set(clientX / innerWidth)
      mouseY.set(clientY / innerHeight)
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [mouseX, mouseY, reducedMotion])
  
  const handleStartLearning = () => {
    navigate('/login')
  }
  
  const handleViewMap = () => {
    navigate('/app')
  }
  
  const handleMilestoneClick = (milestone: Milestone) => {
    setSelectedMilestone(milestone)
  }
  
  const closeMilestoneModal = () => {
    setSelectedMilestone(null)
  }

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Background Layer - Slowest parallax */}
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          x: reducedMotion ? 0 : backgroundX,
          y: reducedMotion ? 0 : backgroundY,
        }}
      >
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:72px_72px]" />
        
        {/* Ambient orbs */}
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-cyan-600/20 blur-[120px]" />
      </motion.div>
      
      {/* Midground Layer - Medium parallax */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          x: reducedMotion ? 0 : midgroundX,
          y: reducedMotion ? 0 : midgroundY,
        }}
      >
        {/* Floating particles */}
        {!reducedMotion && (
          <>
            {particles.map((particle, i) => (
              <motion.div
                key={i}
                className="absolute h-1 w-1 rounded-full bg-cyan-400/30"
                style={{
                  left: `${particle.left}%`,
                  top: `${particle.top}%`,
                }}
                animate={{
                  y: [0, -30, 0],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: particle.duration,
                  repeat: Infinity,
                  delay: particle.delay,
                }}
              />
            ))}
          </>
        )}
      </motion.div>
      
      {/* Foreground Content */}
      <motion.div
        className="relative z-10"
        style={{
          x: reducedMotion ? 0 : foregroundX,
          y: reducedMotion ? 0 : foregroundY,
        }}
      >
        {/* Navigation */}
        <nav className="absolute left-0 right-0 top-0 z-50 p-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent"
            >
              Parallax Atlas
            </motion.div>
            
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              onClick={handleStartLearning}
              className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-300 backdrop-blur-sm transition-all hover:bg-cyan-500/30 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            >
              Sign in
            </motion.button>
          </div>
        </nav>
        
        {/* Hero Section */}
        <section className="flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-5xl space-y-8"
          >
            <h1 className="text-6xl font-bold leading-tight tracking-tight text-white md:text-7xl lg:text-8xl">
              Begin a new
              <span className="block bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                learning journey
              </span>
            </h1>
            
            <p className="mx-auto max-w-2xl text-xl text-slate-300 md:text-2xl">
              Track progress, build skills, and ship real projects—one milestone at a time.
            </p>
            
            <div className="flex flex-col items-center justify-center gap-4 pt-8 sm:flex-row">
              <motion.button
                onClick={handleStartLearning}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-xl shadow-cyan-500/25 transition-shadow hover:shadow-2xl hover:shadow-cyan-500/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
              >
                <span className="relative z-10">Start learning</span>
                <div className="absolute inset-0 -z-0 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 transition-opacity group-hover:opacity-100" />
              </motion.button>
              
              <motion.button
                onClick={handleViewMap}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-xl border-2 border-cyan-400/30 bg-slate-900/50 px-8 py-4 text-lg font-semibold text-cyan-300 backdrop-blur-sm transition-all hover:border-cyan-400/50 hover:bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
              >
                View the map
              </motion.button>
            </div>
          </motion.div>
        </section>
        
        {/* Journey Path Section */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="mb-16 text-center"
            >
              <h2 className="mb-4 text-4xl font-bold text-white md:text-5xl">Your Learning Path</h2>
              <p className="text-xl text-slate-400">Seven milestones to guide your journey from novice to mastery</p>
            </motion.div>
            
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {milestones.map((milestone, index) => (
                <motion.div
                  key={milestone.id}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{
                    scale: 1.05,
                    rotateY: reducedMotion ? 0 : 5,
                    rotateX: reducedMotion ? 0 : 5,
                  }}
                  onHoverStart={() => setHoveredMilestone(milestone.id)}
                  onHoverEnd={() => setHoveredMilestone(null)}
                  onClick={() => handleMilestoneClick(milestone)}
                  className="group relative cursor-pointer rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm transition-all hover:border-cyan-400/50 hover:shadow-xl hover:shadow-cyan-500/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                  style={{
                    transformStyle: 'preserve-3d',
                    perspective: '1000px',
                  }}
                >
                  <div className="mb-4 text-5xl">{milestone.icon}</div>
                  <h3 className="mb-2 text-xl font-semibold text-white group-hover:text-cyan-400 transition-colors">
                    {milestone.title}
                  </h3>
                  <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                    {milestone.description}
                  </p>
                  
                  {/* Progress indicator */}
                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/50">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-600"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${milestone.progress}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: index * 0.1 + 0.5 }}
                    />
                  </div>
                  
                  {/* Hover glow effect */}
                  {hoveredMilestone === milestone.id && !reducedMotion && (
                    <motion.div
                      className="pointer-events-none absolute -inset-0.5 -z-10 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-blue-600/20 blur-xl"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
        
        {/* How it Works Section */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="mb-16 text-center"
            >
              <h2 className="mb-4 text-4xl font-bold text-white md:text-5xl">How It Works</h2>
              <p className="text-xl text-slate-400">Three simple steps to accelerate your learning</p>
            </motion.div>
            
            <div className="grid gap-12 md:grid-cols-3">
              {[
                {
                  step: '01',
                  title: 'Choose Your Path',
                  description: 'Select from curated learning paths or create your own journey through knowledge domains.',
                  icon: '🎯',
                },
                {
                  step: '02',
                  title: 'Track Progress',
                  description: 'Visualize your advancement through interactive timelines and milestone completion.',
                  icon: '📈',
                },
                {
                  step: '03',
                  title: 'Master Skills',
                  description: 'Build deep expertise through spaced repetition, practice, and real-world application.',
                  icon: '⚡',
                },
              ].map((item, index) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                  className="relative text-center"
                >
                  <div className="mb-6 text-6xl">{item.icon}</div>
                  <div className="mb-4 text-sm font-bold tracking-wider text-cyan-400">{item.step}</div>
                  <h3 className="mb-3 text-2xl font-semibold text-white">{item.title}</h3>
                  <p className="text-slate-400">{item.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
        
        {/* Progress Preview Section */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="rounded-3xl border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/30 p-8 backdrop-blur-sm md:p-12"
            >
              <div className="mb-8 text-center">
                <h2 className="mb-4 text-4xl font-bold text-white md:text-5xl">Track Every Achievement</h2>
                <p className="text-xl text-slate-400">
                  Your progress is always visible, motivating you forward
                </p>
              </div>
              
              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-4">
                  {['Cosmology', 'Ancient History', 'Modern Era', 'Future Tech'].map((topic, i) => (
                    <div key={topic} className="flex items-center justify-between">
                      <span className="text-slate-300">{topic}</span>
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-700/50">
                          <motion.div
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-600"
                            initial={{ width: 0 }}
                            whileInView={{ width: `${25 + i * 20}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, delay: i * 0.1 }}
                          />
                        </div>
                        <span className="w-12 text-right text-sm text-slate-400">{25 + i * 20}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <svg className="h-40 w-40 -rotate-90 transform">
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="rgba(71, 85, 105, 0.3)"
                        strokeWidth="12"
                        fill="transparent"
                      />
                      <motion.circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="url(#gradient)"
                        strokeWidth="12"
                        fill="transparent"
                        strokeLinecap="round"
                        initial={{ strokeDasharray: '0 440' }}
                        whileInView={{ strokeDasharray: '308 440' }}
                        viewport={{ once: true }}
                        transition={{ duration: 2, ease: 'easeOut' }}
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#06b6d4" />
                          <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-white">70%</div>
                        <div className="text-sm text-slate-400">Overall</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
        
        {/* Social Proof Section */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center"
            >
              <p className="mb-12 text-sm uppercase tracking-wider text-slate-500">Trusted by learners worldwide</p>
              <div className="flex flex-wrap items-center justify-center gap-12 opacity-40 grayscale">
                {/* Placeholder logos */}
                {['University', 'Tech Corp', 'Institute', 'Academy', 'Lab'].map((name) => (
                  <div key={name} className="text-2xl font-bold text-slate-400">
                    {name}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
        
        {/* Footer */}
        <footer className="border-t border-slate-800/50 px-6 py-12">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <div className="text-slate-400">
                © 2026 Parallax Atlas. All rights reserved.
              </div>
              <div className="flex gap-6 text-sm text-slate-400">
                <a href="#" className="transition-colors hover:text-cyan-400">About</a>
                <a href="#" className="transition-colors hover:text-cyan-400">Privacy</a>
                <a href="#" className="transition-colors hover:text-cyan-400">Terms</a>
                <a href="#" className="transition-colors hover:text-cyan-400">Contact</a>
              </div>
            </div>
          </div>
        </footer>
      </motion.div>
      
      {/* Milestone Detail Modal */}
      <AnimatePresence>
        {selectedMilestone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeMilestoneModal}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-2xl w-full rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-slate-800 to-slate-900 p-8 shadow-2xl"
            >
              <button
                onClick={closeMilestoneModal}
                className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <div className="mb-6 text-6xl">{selectedMilestone.icon}</div>
              <h3 className="mb-4 text-3xl font-bold text-white">{selectedMilestone.title}</h3>
              <p className="mb-6 text-lg text-slate-300">{selectedMilestone.description}</p>
              
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-slate-400">Progress</span>
                  <span className="font-semibold text-cyan-400">{selectedMilestone.progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700/50">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${selectedMilestone.progress}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>
              
              <motion.button
                onClick={handleStartLearning}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/25 transition-shadow hover:shadow-xl hover:shadow-cyan-500/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
              >
                Begin This Milestone
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
