import type { SubjectPackPayload } from '../viewer/types'
import { buildSystemPrompt, buildUserPrompt } from './lesson-prompts'
import type {
  LessonGeneratorConfig,
  LessonGeneratorRequest,
  LessonGeneratorResult,
  LessonPlan,
  LessonStep,
} from './lesson-types'

// ── Pack validation (mirrors pack-loader.ts rules) ───────────────────────────

function isValidGeneratedEra(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const era = value as Record<string, unknown>
  return (
    typeof era.id === 'string' && era.id.length > 0 &&
    typeof era.content === 'string' && era.content.length > 0 &&
    typeof era.group === 'string' && era.group.length > 0 &&
    typeof era.start === 'number' && typeof era.end === 'number' &&
    Number.isFinite(era.start) && Number.isFinite(era.end) &&
    era.start >= era.end
  )
}

function validateGeneratedPayload(payload: SubjectPackPayload): string | null {
  if (!payload.id || typeof payload.id !== 'string') return 'Missing pack id'
  if (!payload.name || typeof payload.name !== 'string') return 'Missing pack name'
  if (!payload.context) return 'Missing context'
  if (!Array.isArray(payload.context.eras) || payload.context.eras.length === 0) return 'No eras generated'
  for (const era of payload.context.eras) {
    if (!isValidGeneratedEra(era)) {
      return `Invalid era: ${JSON.stringify(era).slice(0, 100)}`
    }
  }
  // Verify progress object covers all eras
  if (payload.context.progress) {
    for (const era of payload.context.eras) {
      if (typeof payload.context.progress[era.id] !== 'number') {
        // Auto-fix: seed missing progress
        payload.context.progress[era.id] = 0
      }
    }
  } else {
    // Auto-fix: create progress object
    payload.context.progress = payload.context.eras.reduce<Record<string, number>>((acc, era) => {
      acc[era.id] = 0
      return acc
    }, {})
  }
  return null
}

// ── LLM API calls ────────────────────────────────────────────────────────────

async function callOpenAI(
  config: LessonGeneratorConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const model = config.model ?? 'gpt-4o'
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${body.slice(0, 200)}`)
  }

  const data = (await response.json()) as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

async function callAnthropic(
  config: LessonGeneratorConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const model = config.model ?? 'claude-sonnet-4-20250514'
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${body.slice(0, 200)}`)
  }

  const data = (await response.json()) as { content: Array<{ type: string; text: string }> }
  const textBlock = data.content.find((block) => block.type === 'text')
  return textBlock?.text ?? ''
}

// ── Extract JSON from LLM response ──────────────────────────────────────────

function extractJSON(raw: string): string {
  // Try direct parse first
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) return trimmed

  // Extract from markdown code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim()

  // Last resort: find first { to last }
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  return trimmed
}

// ── Build LessonPlan from generated pack ─────────────────────────────────────

function buildLessonPlan(
  request: LessonGeneratorRequest,
  pack: SubjectPackPayload,
  generatorModel: string,
): LessonPlan {
  const steps: LessonStep[] = pack.context.eras!.map((era, index) => ({
    eraId: era.id,
    order: index + 1,
    prompt: era.payload?.prompt,
    objective: era.learningObjectives?.[0] ?? era.description ?? `Understand ${era.content}`,
    taskType: era.payload?.taskType ?? 'active-recall',
    estimatedMinutes: era.estimatedMinutes ?? 10,
    gateProgress: 25,
  }))

  const totalMinutes = steps.reduce((sum, step) => sum + step.estimatedMinutes, 0)

  return {
    id: `lesson-${pack.id}-${Date.now()}`,
    title: pack.name,
    subject: request.subject,
    level: request.level,
    description: pack.description ?? `A ${request.level}-level learning path for ${request.subject}.`,
    totalEstimatedMinutes: totalMinutes,
    steps,
    pack,
    generatedAt: new Date().toISOString(),
    generatorModel,
    learnerSnapshot: request.learnerProfile,
  }
}

// ── Main generator ───────────────────────────────────────────────────────────

export async function generateLesson(
  request: LessonGeneratorRequest,
  config: LessonGeneratorConfig,
): Promise<LessonGeneratorResult> {
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(request)
  const model = config.model ?? (config.provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-20250514')

  try {
    let rawResponse: string

    if (config.provider === 'openai') {
      rawResponse = await callOpenAI(config, systemPrompt, userPrompt)
    } else if (config.provider === 'anthropic') {
      rawResponse = await callAnthropic(config, systemPrompt, userPrompt)
    } else {
      return { success: false, error: `Unsupported provider: ${config.provider}` }
    }

    const jsonString = extractJSON(rawResponse)
    let parsed: SubjectPackPayload

    try {
      parsed = JSON.parse(jsonString) as SubjectPackPayload
    } catch {
      return {
        success: false,
        error: `Failed to parse LLM response as JSON. Raw response start: ${rawResponse.slice(0, 200)}`,
      }
    }

    // Validate against pack schema
    const validationError = validateGeneratedPayload(parsed)
    if (validationError) {
      return { success: false, error: `Generated pack validation failed: ${validationError}` }
    }

    // Ensure persistence mode
    parsed.context.persistence = 'memory'

    const lesson = buildLessonPlan(request, parsed, model)
    return { success: true, lesson }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}

// ── API key persistence ──────────────────────────────────────────────────────

const API_CONFIG_KEY = 'knowledge-timeline-llm-config'

export function saveGeneratorConfig(config: LessonGeneratorConfig): void {
  window.localStorage.setItem(API_CONFIG_KEY, JSON.stringify(config))
}

export function loadGeneratorConfig(): LessonGeneratorConfig | null {
  try {
    const raw = window.localStorage.getItem(API_CONFIG_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LessonGeneratorConfig
    if (!parsed.provider || !parsed.apiKey) return null
    return parsed
  } catch {
    return null
  }
}
