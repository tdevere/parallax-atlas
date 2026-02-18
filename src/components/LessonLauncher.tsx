import { useCallback, useState } from 'react'
import type { DifficultyLevel } from '../data/timeline-data'
import type {
  LessonGeneratorConfig,
  LessonPlan,
  LLMProvider,
  SavedLessonReference,
} from '../lesson/lesson-types'
import { deleteLessonPlan, loadLessonIndex, loadLessonPlan } from '../lesson/lesson-types'
import { generateLesson, loadGeneratorConfig, saveGeneratorConfig } from '../lesson/lesson-generator'
import type { LearnerProfile } from '../lesson/lesson-types'

interface LessonLauncherProps {
  onLessonReady: (lesson: LessonPlan) => void
  onClose: () => void
  learnerProfile?: LearnerProfile
}

type LauncherView = 'form' | 'config' | 'generating' | 'error' | 'history'

const LEVEL_DESCRIPTIONS: Record<DifficultyLevel, { label: string; description: string; icon: string }> = {
  intro: {
    label: 'Introduction',
    description: 'No prior knowledge needed. Focuses on understanding core concepts.',
    icon: '🌱',
  },
  intermediate: {
    label: 'Intermediate',
    description: 'Builds on foundations. Applies and analyzes concepts across eras.',
    icon: '🔬',
  },
  advanced: {
    label: 'Advanced',
    description: 'Deep dive. Evaluates primary sources and synthesizes original insights.',
    icon: '🧠',
  },
}

const SUGGESTED_SUBJECTS = [
  'The History of Computing',
  'Evolutionary Biology',
  'Renaissance Art',
  'Climate Science',
  'Ancient Philosophy',
  'Cryptography',
  'The Space Race',
  'Music Theory',
]

export function LessonLauncher({ onLessonReady, onClose, learnerProfile }: LessonLauncherProps) {
  const [view, setView] = useState<LauncherView>('form')
  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState<DifficultyLevel>(learnerProfile?.inferredLevel ?? 'intro')
  const [eraCount, setEraCount] = useState(8)
  const [priorKnowledge, setPriorKnowledge] = useState('')
  const [error, setError] = useState('')
  const [generatingStatus, setGeneratingStatus] = useState('')
  const [savedLessons, setSavedLessons] = useState<SavedLessonReference[]>(() => loadLessonIndex())

  // API config state (lazy-initialized from localStorage)
  const [provider, setProvider] = useState<LLMProvider>(() => {
    const saved = loadGeneratorConfig()
    return saved?.provider ?? 'openai'
  })
  const [apiKey, setApiKey] = useState(() => {
    const saved = loadGeneratorConfig()
    return saved?.apiKey ?? ''
  })
  const [model, setModel] = useState(() => {
    const saved = loadGeneratorConfig()
    return saved?.model ?? ''
  })

  const hasValidConfig = apiKey.trim().length > 0

  const handleGenerate = useCallback(async () => {
    if (!subject.trim()) return

    const config: LessonGeneratorConfig = {
      provider,
      apiKey: apiKey.trim(),
      model: model.trim() || undefined,
    }

    // Save config for future use
    saveGeneratorConfig(config)

    setView('generating')
    setGeneratingStatus('Constructing curriculum prompt...')

    // Small delay so the UI renders the status
    await new Promise((resolve) => setTimeout(resolve, 100))
    setGeneratingStatus(`Calling ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API...`)

    const result = await generateLesson(
      {
        subject: subject.trim(),
        level,
        eraCount,
        priorKnowledge: priorKnowledge.trim() || undefined,
        learnerProfile,
      },
      config,
    )

    if (result.success && result.lesson) {
      setGeneratingStatus('Lesson plan generated! Loading timeline...')
      await new Promise((resolve) => setTimeout(resolve, 400))
      onLessonReady(result.lesson)
    } else {
      setError(result.error ?? 'Unknown error during generation.')
      setView('error')
    }
  }, [subject, level, eraCount, priorKnowledge, learnerProfile, provider, apiKey, model, onLessonReady])

  const handleLoadSaved = (lessonId: string) => {
    const lesson = loadLessonPlan(lessonId)
    if (lesson) {
      onLessonReady(lesson)
    } else {
      setError('Could not load saved lesson plan.')
      setView('error')
    }
  }

  const handleDeleteSaved = (lessonId: string) => {
    deleteLessonPlan(lessonId)
    setSavedLessons(loadLessonIndex())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {view === 'config' ? '⚙️ API Configuration' : view === 'history' ? '📋 Saved Lessons' : '🚀 Start Learning'}
            </h2>
            <p className="text-xs text-slate-400">
              {view === 'config' ? 'Configure your AI provider' : view === 'history' ? 'Resume a previous lesson' : 'Generate a personalized lesson plan'}
            </p>
          </div>
          <button className="rounded border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Form View ──────────────────────────────────────── */}
          {view === 'form' && (
            <div className="space-y-5 px-5 py-4">
              {/* Subject input */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200" htmlFor="lesson-subject">
                  What do you want to learn?
                </label>
                <input
                  autoFocus
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                  id="lesson-subject"
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., The History of Computing"
                  type="text"
                  value={subject}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SUGGESTED_SUBJECTS.map((suggestion) => (
                    <button
                      className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] text-slate-300 transition hover:border-cyan-600 hover:text-cyan-200"
                      key={suggestion}
                      onClick={() => setSubject(suggestion)}
                      type="button"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Level selector */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">Difficulty Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(LEVEL_DESCRIPTIONS) as Array<[DifficultyLevel, typeof LEVEL_DESCRIPTIONS.intro]>).map(
                    ([key, info]) => (
                      <button
                        className={`rounded-lg border p-3 text-left transition ${
                          level === key
                            ? 'border-cyan-500 bg-cyan-950/40 ring-1 ring-cyan-500/30'
                            : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                        }`}
                        key={key}
                        onClick={() => setLevel(key)}
                        type="button"
                      >
                        <span className="block text-lg">{info.icon}</span>
                        <span className="block text-xs font-semibold text-slate-100">{info.label}</span>
                        <span className="block text-[10px] text-slate-400">{info.description}</span>
                      </button>
                    ),
                  )}
                </div>
                {learnerProfile && (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Suggested for you: <span className="text-cyan-300">{LEVEL_DESCRIPTIONS[learnerProfile.inferredLevel].label}</span> based on your learning history
                  </p>
                )}
              </div>

              {/* Era count */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200" htmlFor="era-count">
                  Number of Topics: {eraCount}
                </label>
                <input
                  className="w-full accent-cyan-500"
                  id="era-count"
                  max="15"
                  min="4"
                  onChange={(e) => setEraCount(Number(e.target.value))}
                  type="range"
                  value={eraCount}
                />
                <div className="mt-0.5 flex justify-between text-[10px] text-slate-500">
                  <span>Quick (4)</span>
                  <span>Standard (8)</span>
                  <span>Deep (15)</span>
                </div>
              </div>

              {/* Prior knowledge (optional) */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200" htmlFor="prior-knowledge">
                  What do you already know? <span className="text-slate-500">(optional)</span>
                </label>
                <textarea
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                  id="prior-knowledge"
                  onChange={(e) => setPriorKnowledge(e.target.value)}
                  placeholder="e.g., I took an intro CS class and know basic Python..."
                  rows={2}
                  value={priorKnowledge}
                />
              </div>
            </div>
          )}

          {/* ── Config View ────────────────────────────────────── */}
          {view === 'config' && (
            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">AI Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`rounded-lg border p-3 text-left ${
                      provider === 'openai' ? 'border-cyan-500 bg-cyan-950/40' : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                    }`}
                    onClick={() => setProvider('openai')}
                    type="button"
                  >
                    <span className="block text-sm font-semibold text-slate-100">OpenAI</span>
                    <span className="block text-[10px] text-slate-400">GPT-4o, GPT-4o-mini</span>
                  </button>
                  <button
                    className={`rounded-lg border p-3 text-left ${
                      provider === 'anthropic' ? 'border-cyan-500 bg-cyan-950/40' : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                    }`}
                    onClick={() => setProvider('anthropic')}
                    type="button"
                  >
                    <span className="block text-sm font-semibold text-slate-100">Anthropic</span>
                    <span className="block text-[10px] text-slate-400">Claude Sonnet, Opus</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200" htmlFor="api-key-input">
                  API Key
                </label>
                <input
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
                  id="api-key-input"
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                  type="password"
                  value={apiKey}
                />
                <p className="mt-1 text-[10px] text-slate-500">Stored locally in your browser. Never sent anywhere except the provider API.</p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200" htmlFor="model-input">
                  Model Override <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
                  id="model-input"
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-20250514'}
                  type="text"
                  value={model}
                />
              </div>

              <button
                className="w-full rounded-lg border border-cyan-600 bg-cyan-900/30 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-800/40"
                onClick={() => {
                  saveGeneratorConfig({ provider, apiKey: apiKey.trim(), model: model.trim() || undefined })
                  setView('form')
                }}
                type="button"
              >
                Save & Continue
              </button>
            </div>
          )}

          {/* ── Generating View ────────────────────────────────── */}
          {view === 'generating' && (
            <div className="flex flex-col items-center justify-center gap-4 px-5 py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500/30 border-t-cyan-400" />
              <p className="text-sm text-slate-200">{generatingStatus}</p>
              <p className="text-xs text-slate-500">This usually takes 10-30 seconds...</p>
            </div>
          )}

          {/* ── Error View ─────────────────────────────────────── */}
          {view === 'error' && (
            <div className="space-y-4 px-5 py-6">
              <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-4">
                <h3 className="mb-1 text-sm font-semibold text-rose-200">Generation Failed</h3>
                <p className="text-xs text-rose-300/80">{error}</p>
              </div>
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-lg border border-slate-600 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  onClick={() => setView('form')}
                  type="button"
                >
                  Try Again
                </button>
                <button
                  className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800"
                  onClick={() => setView('config')}
                  type="button"
                >
                  ⚙️ Check Config
                </button>
              </div>
            </div>
          )}

          {/* ── History View ───────────────────────────────────── */}
          {view === 'history' && (
            <div className="px-5 py-4">
              {savedLessons.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <span className="text-2xl">📋</span>
                  <p className="mt-2 text-sm">No saved lessons yet.</p>
                  <p className="text-xs">Generate your first lesson to see it here.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {savedLessons.map((ref) => (
                    <li className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 p-3" key={ref.id}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100">{ref.title}</p>
                        <p className="text-[11px] text-slate-400">
                          {LEVEL_DESCRIPTIONS[ref.level].icon} {ref.level} · {ref.stepCount} topics · {new Date(ref.generatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          className="rounded border border-cyan-700 px-2.5 py-1 text-xs text-cyan-200 hover:bg-cyan-900/30"
                          onClick={() => handleLoadSaved(ref.id)}
                          type="button"
                        >
                          Resume
                        </button>
                        <button
                          className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-400 hover:border-rose-600 hover:text-rose-300"
                          onClick={() => handleDeleteSaved(ref.id)}
                          type="button"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {view === 'form' && (
          <div className="border-t border-slate-800 px-5 py-4">
            <div className="mb-3 flex gap-2">
              <button
                className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                onClick={() => setView('config')}
                type="button"
              >
                ⚙️ API Config {hasValidConfig && <span className="text-emerald-400">✓</span>}
              </button>
              {savedLessons.length > 0 && (
                <button
                  className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                  onClick={() => setView('history')}
                  type="button"
                >
                  📋 Saved ({savedLessons.length})
                </button>
              )}
            </div>
            <button
              className={`w-full rounded-lg py-3 text-sm font-semibold transition ${
                subject.trim() && hasValidConfig
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/40 hover:from-cyan-500 hover:to-blue-500'
                  : 'cursor-not-allowed bg-slate-800 text-slate-500'
              }`}
              disabled={!subject.trim() || !hasValidConfig}
              onClick={handleGenerate}
              type="button"
            >
              {!hasValidConfig ? '⚙️ Configure API Key First' : !subject.trim() ? 'Enter a Subject to Continue' : `🚀 Generate ${LEVEL_DESCRIPTIONS[level].label} Lesson Plan`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
