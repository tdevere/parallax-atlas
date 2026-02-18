import { useCallback, useState } from 'react'

export interface FeedbackModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Close handler */
  onClose: () => void
  /** Whether user is signed in (affects messaging) */
  isAuthenticated: boolean
  /** Current app context info for the report */
  appContext?: string
}

type FeedbackType = 'bug' | 'feature'

interface SubmitResult {
  success: boolean
  issueNumber?: number
  issueUrl?: string
  error?: string
}

export function FeedbackModal({ open, onClose, isAuthenticated, appContext }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)

  const reset = useCallback(() => {
    setType('bug')
    setTitle('')
    setDescription('')
    setResult(null)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !description.trim()) return

    setSubmitting(true)
    setResult(null)

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          context: appContext,
          userAgent: navigator.userAgent,
        }),
      })

      if (res.ok) {
        const data = (await res.json()) as SubmitResult
        setResult({ success: true, issueNumber: data.issueNumber, issueUrl: data.issueUrl })
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setResult({ success: false, error: err.error ?? `Server error (${res.status})` })
      }
    } catch {
      setResult({ success: false, error: 'Network error — please try again' })
    } finally {
      setSubmitting(false)
    }
  }, [type, title, description, appContext])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Submit feedback"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
      onKeyDown={(e) => { if (e.key === 'Escape') handleClose() }}
    >
      <div className="mx-4 w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
          <h2 className="text-base font-semibold text-white">
            💬 Send Feedback
          </h2>
          <button
            aria-label="Close feedback form"
            className="text-slate-400 hover:text-white transition-colors text-lg"
            onClick={handleClose}
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          {/* Success state */}
          {result?.success ? (
            <div className="space-y-3 text-center py-4">
              <div className="text-3xl">🎉</div>
              <p className="text-sm text-green-300">
                Thanks! Issue #{result.issueNumber} was created.
              </p>
              {result.issueUrl && (
                <a
                  href={result.issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-blue-400 underline hover:text-blue-300"
                >
                  View on GitHub →
                </a>
              )}
              <div className="pt-2">
                <button
                  className="rounded border border-slate-600 px-4 py-1.5 text-xs text-slate-300 hover:border-cyan-500 hover:text-cyan-300 transition"
                  onClick={handleClose}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Type selector */}
              <fieldset>
                <legend className="mb-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">
                  Type
                </legend>
                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-pressed={type === 'bug'}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      type === 'bug'
                        ? 'border-rose-500 bg-rose-900/30 text-rose-200'
                        : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-rose-600 hover:text-rose-300'
                    }`}
                    onClick={() => setType('bug')}
                  >
                    🐛 Bug Report
                  </button>
                  <button
                    type="button"
                    aria-pressed={type === 'feature'}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      type === 'feature'
                        ? 'border-emerald-500 bg-emerald-900/30 text-emerald-200'
                        : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-emerald-600 hover:text-emerald-300'
                    }`}
                    onClick={() => setType('feature')}
                  >
                    ✨ Feature Request
                  </button>
                </div>
              </fieldset>

              {/* Title */}
              <div>
                <label htmlFor="feedback-title" className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">
                  Title
                </label>
                <input
                  id="feedback-title"
                  type="text"
                  maxLength={200}
                  placeholder={type === 'bug' ? "What went wrong?" : "What would you like to see?"}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="feedback-desc" className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">
                  Description
                </label>
                <textarea
                  id="feedback-desc"
                  rows={4}
                  maxLength={5000}
                  placeholder={type === 'bug'
                    ? "Steps to reproduce, expected vs. actual behavior…"
                    : "Describe the feature, why it matters, and how you'd use it…"
                  }
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full resize-y rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                />
                <div className="mt-0.5 text-right text-[10px] text-slate-500">{description.length}/5000</div>
              </div>

              {/* Auth warning */}
              {!isAuthenticated && (
                <p className="text-xs text-amber-400">
                  ⚠️ Sign in to attach your identity to the report. Anonymous submissions are still accepted.
                </p>
              )}

              {/* Error */}
              {result && !result.success && (
                <p className="text-xs text-rose-400">
                  ❌ {result.error}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!result?.success && (
          <div className="flex justify-end gap-2 border-t border-slate-700 px-5 py-3">
            <button
              type="button"
              className="rounded border border-slate-600 px-4 py-1.5 text-xs text-slate-300 hover:border-slate-500 transition"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!title.trim() || !description.trim() || submitting}
              className="rounded border border-cyan-600 bg-cyan-900/40 px-4 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-800/50 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleSubmit}
            >
              {submitting ? 'Submitting…' : 'Submit to GitHub'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
