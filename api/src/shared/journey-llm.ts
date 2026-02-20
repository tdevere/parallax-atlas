/**
 * Server-side LLM API calls for journey generation.
 *
 * Uses the server's own API key (from environment variables) — not the user's.
 * Supports OpenAI and Anthropic providers.
 */

export type LLMProvider = 'openai' | 'anthropic'

export interface LLMConfig {
  provider: LLMProvider
  apiKey: string
  model: string
}

/**
 * Resolve LLM configuration from environment variables.
 * Priority: OPENAI_API_KEY > ANTHROPIC_API_KEY
 * Returns null if no API key is configured.
 */
export function resolveLLMConfig(): LLMConfig | null {
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    return {
      provider: 'openai',
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL ?? 'gpt-4o',
    }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    return {
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
    }
  }

  return null
}

/** Call OpenAI Chat Completions API. */
async function callOpenAI(
  config: LLMConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
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
    throw new Error(`OpenAI API error ${response.status}: ${body.slice(0, 300)}`)
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>
  }
  return data.choices[0]?.message?.content ?? ''
}

/** Call Anthropic Messages API. */
async function callAnthropic(
  config: LLMConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${body.slice(0, 300)}`)
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>
  }
  const textBlock = data.content.find((block) => block.type === 'text')
  return textBlock?.text ?? ''
}

/** Send a prompt pair to the configured LLM and return the raw response text. */
export async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  if (config.provider === 'openai') {
    return callOpenAI(config, systemPrompt, userPrompt)
  }
  if (config.provider === 'anthropic') {
    return callAnthropic(config, systemPrompt, userPrompt)
  }
  throw new Error(`Unsupported LLM provider: ${config.provider}`)
}

/** Extract JSON from an LLM response that may include markdown fences. */
export function extractJSON(raw: string): string {
  const trimmed = raw.trim()

  // Direct JSON
  if (trimmed.startsWith('{')) return trimmed

  // Markdown code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim()

  // Fallback: first { to last }
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  return trimmed
}
