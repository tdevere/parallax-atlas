/**
 * JourneyCreator — modal for generating AI-powered learning journeys.
 *
 * The user enters a topic and optional details, and the component calls
 * the server-side generation API. On success, it passes the generated
 * pack to the parent for loading into the timeline.
 */

import { useCallback, useState } from 'react'
import type { SubjectPackPayload } from '../viewer/types'
import { createJourney } from '../journey/journey-client'

type DifficultyLevel = 'intro' | 'intermediate' | 'advanced'

interface JourneyCreatorProps {
  onJourneyReady: (pack: SubjectPackPayload, meta: { journeyId: string; generatorModel: string }) => void
  onClose: () => void
}

const DIFFICULTY_OPTIONS: { value: DifficultyLevel; label: string; description: string }[] = [
  { value: 'intro', label: '🌱 Intro', description: 'New to this topic — start from the basics' },
  { value: 'intermediate', label: '📈 Intermediate', description: 'Some background — ready to go deeper' },
  { value: 'advanced', label: '🔬 Advanced', description: 'Strong foundation — explore cutting-edge ideas' },
]

const EXAMPLE_TOPICS = [
  'The history of firefighting',
  'Quantum computing fundamentals',
  'Evolution of jazz music',
  'Climate science and policy',
  'Ancient Mesopotamian civilization',
  'Machine learning in healthcare',
]

export function JourneyCreator({ onJourneyReady, onClose }: JourneyCreatorProps) {
  const [topic, setTopic] = useState('')
  const [level, setLevel] = useState<DifficultyLevel>('intro')
  const [priorKnowledge, setPriorKnowledge] = useState('')
  const [eraCount, setEraCount] = useState(8)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = topic.trim().length >= 3 && !loading

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return

    setLoading(true)
    setError(null)

    try {
      const result = await createJourney({
        topic: topic.trim(),
        level,
        eraCount,
        priorKnowledge: priorKnowledge.trim() || undefined,
      })

      onJourneyReady(result.pack, {
        journeyId: result.journeyId,
        generatorModel: result.generatorModel,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate journey'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [canSubmit, topic, level, eraCount, priorKnowledge, onJourneyReady])

  const handleExampleClick = useCallback((example: string) => {
    setTopic(example)
    setError(null)
  }, [])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-slate-700/50 bg-slate-900 p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-5">
          <h2 className="text-xl font-bold text-white">✨ Create a Learning Journey</h2>
          <p className="mt-1 text-sm text-slate-400">
            Tell us what you want to learn and we'll generate a personalized timeline.
          </p>
        </div>

        {/* Topic input */}
        <div className="mb-4">
          <label htmlFor="journey-topic" className="mb-1.5 block text-sm font-medium text-slate-300">
            What do you want to learn about?
          </label>
          <input
            id="journey-topic"
            type="text"
            value={topic}
            onChange={(e) => { setTopic(e.target.value); setError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit() }}
            placeholder="e.g., The history of firefighting"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            maxLength={200}
            disabled={loading}
            autoFocus
            data-testid="journey-topic-input"
          />

          {/* Example topics */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXAMPLE_TOPICS.map((example) => (
              <button
                key={example}
                onClick={() => handleExampleClick(example)}
                className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs text-slate-400 transition-colors hover:border-indigo-500 hover:text-indigo-300"
                disabled={loading}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty selector */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Difficulty level</label>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLevel(opt.value)}
                className={`rounded-lg border px-3 py-2 text-center text-sm transition-all ${
                  level === opt.value
                    ? 'border-indigo-500 bg-indigo-500/20 text-white'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                }`}
                disabled={loading}
              >
                <div className="font-medium">{opt.label}</div>
                <div className="mt-0.5 text-[10px] leading-tight opacity-70">{opt.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Era count slider */}
        <div className="mb-4">
          <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-300">
            <span>Number of topics</span>
            <span className="text-indigo-400">{eraCount}</span>
          </label>
          <input
            type="range"
            min={3}
            max={16}
            value={eraCount}
            onChange={(e) => setEraCount(Number(e.target.value))}
            className="w-full accent-indigo-500"
            disabled={loading}
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Quick overview (3)</span>
            <span>Deep dive (16)</span>
          </div>
        </div>

        {/* Prior knowledge (collapsible) */}
        <details className="mb-5">
          <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-300">
            + Add context about what you already know
          </summary>
          <textarea
            value={priorKnowledge}
            onChange={(e) => setPriorKnowledge(e.target.value)}
            placeholder="e.g., I took an intro chemistry course in college and know the basics of atomic structure..."
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            rows={3}
            maxLength={500}
            disabled={loading}
          />
        </details>

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-800/50 bg-red-900/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="journey-generate-btn"
        >
          {loading ? (
            <>
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Generating your journey…</span>
            </>
          ) : (
            <>
              <span>🚀</span>
              <span>Generate Journey</span>
            </>
          )}
        </button>

        {loading && (
          <p className="mt-2 text-center text-xs text-slate-500">
            This usually takes 10-20 seconds. An AI is building your personalized timeline.
          </p>
        )}
      </div>
    </div>
  )
}
