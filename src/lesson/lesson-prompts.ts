import type { DifficultyLevel } from '../data/timeline-data'
import type { LearnerProfile, LessonGeneratorRequest } from './lesson-types'

/**
 * Build the system prompt that instructs the LLM to generate a valid SubjectPackPayload.
 * This is the pedagogical intelligence of the system — it encodes:
 * - Bloom's taxonomy progression per difficulty level
 * - Pack schema constraints (so output is directly loadable)
 * - Learner personalization from profile snapshot
 */
export function buildSystemPrompt(): string {
  return `You are an expert curriculum designer and educational content architect.
Your task is to generate a structured learning timeline for a given subject.

OUTPUT FORMAT:
You must return ONLY valid JSON (no markdown, no explanation) matching this exact schema:

{
  "id": "<kebab-case-subject-id>",
  "name": "<Human Readable Subject Name>",
  "description": "<2-3 sentence overview>",
  "context": {
    "persistence": "memory",
    "eras": [
      {
        "id": "<unique-kebab-id>",
        "content": "<Short display label>",
        "start": <years-ago-number>,
        "end": <years-ago-number>,
        "group": "<Track Name>",
        "description": "<2-3 sentence learning description>",
        "difficulty": "<intro|intermediate|advanced>",
        "learningObjectives": ["<objective-1>", "<objective-2>"],
        "estimatedMinutes": <number>,
        "skillTags": ["<tag-1>", "<tag-2>"],
        "prerequisiteIds": ["<era-id>"],
        "connections": [
          { "targetEraId": "<era-id>", "kind": "<analogy|influence|contrast|application>", "strength": 0.8 }
        ],
        "payload": {
          "taskType": "<concept-sorting|synthesis-challenge|active-recall|guided-reading|quiz|reflection>",
          "missionTitle": "<Task title>",
          "prompt": "<Specific learning task prompt>",
          "completionEvidenceHint": "<What successful completion looks like>"
        },
        "sources": [
          {
            "id": "<source-id>",
            "title": "<Source title>",
            "url": "<Real, valid URL>",
            "format": "<paper|video|overview|book|lecture|report|dataset>",
            "author": "<Author name>",
            "year": <year>,
            "domain": "<domain.com>",
            "snippet": "<Why this source matters for this era>"
          }
        ]
      }
    ],
    "progress": { "<era-id>": 0 }
  }
}

CRITICAL RULES:
1. "start" and "end" are YEARS AGO from today (not calendar years). For recent topics: 2024 CE = ~1 year ago, 1990 CE = ~35 years ago. start must be >= end.
2. Every era MUST have a unique "id" in kebab-case.
3. "prerequisiteIds" should form a DAG (no cycles). Earlier eras are prerequisites for later ones.
4. "connections" express semantic relationships between eras (analogy, influence, contrast, application).
5. "group" names are track labels. Use 2-4 tracks that reflect the subject's natural structure.
6. Every era MUST have at least 2 real sources with valid URLs. Prefer Wikipedia, Stanford Encyclopedia, Khan Academy, Coursera, YouTube educational channels, arXiv, DOI links, and official documentation.
7. "payload" tasks should follow Bloom's taxonomy progression: intro→remember/understand, intermediate→apply/analyze, advanced→evaluate/create.
8. Each era's "estimatedMinutes" should be realistic (5-30 minutes per era).
9. "progress" object must include every era id initialized to 0.`
}

export function buildUserPrompt(request: LessonGeneratorRequest): string {
  const parts: string[] = []

  parts.push(`Generate a learning timeline for: "${request.subject}"`)
  parts.push(`Difficulty level: ${request.level}`)
  parts.push(`Number of eras to generate: ${request.eraCount ?? 8}`)

  if (request.priorKnowledge) {
    parts.push(`\nThe learner says about their prior knowledge: "${request.priorKnowledge}"`)
  }

  if (request.learnerProfile) {
    parts.push(`\nLearner profile:`)
    parts.push(formatLearnerContext(request.learnerProfile))
  }

  parts.push(getDifficultyGuidance(request.level))

  return parts.join('\n')
}

function formatLearnerContext(profile: LearnerProfile): string {
  const lines: string[] = []
  const topics = Object.entries(profile.topicsExplored)
  if (topics.length > 0) {
    lines.push(`- Previously explored topics: ${topics.map(([t, c]) => `${t} (${c}x)`).join(', ')}`)
  }
  if (profile.formatPreferences.length > 0) {
    lines.push(`- Preferred source formats: ${profile.formatPreferences.slice(0, 3).join(', ')}`)
  }
  lines.push(`- Average mastery across known eras: ${profile.averageProgress}%`)
  lines.push(`- Learning days active: ${profile.learningDaysActive}`)
  lines.push(`- Inferred level: ${profile.inferredLevel}`)
  if (profile.strengths.length > 0) {
    lines.push(`- Strong areas (IDs): ${profile.strengths.slice(0, 5).join(', ')}`)
  }
  if (profile.knowledgeGaps.length > 0) {
    lines.push(`- Knowledge gaps (IDs): ${profile.knowledgeGaps.slice(0, 5).join(', ')}`)
  }
  if (profile.personalConnections.length > 0) {
    lines.push(`- Personal cross-era connections made: ${profile.personalConnections.length}`)
  }
  return lines.join('\n')
}

function getDifficultyGuidance(level: DifficultyLevel): string {
  switch (level) {
    case 'intro':
      return `\nDIFFICULTY GUIDANCE (Intro):
- Use simple, accessible language in descriptions
- Tasks should focus on remembering and understanding (Bloom's lower levels)
- Prefer video and overview sources over dense papers
- Keep prerequisite chains short (max 2 deep)
- 5-15 minute estimated time per era
- Use taskTypes: active-recall, guided-reading, concept-sorting`

    case 'intermediate':
      return `\nDIFFICULTY GUIDANCE (Intermediate):
- Assume foundational knowledge, focus on applying and analyzing
- Include mix of source formats including some papers
- Build moderate prerequisite chains (2-4 deep)
- 10-20 minute estimated time per era
- Use taskTypes: synthesis-challenge, active-recall, quiz
- Include cross-era connections to build conceptual bridges`

    case 'advanced':
      return `\nDIFFICULTY GUIDANCE (Advanced):
- Target evaluation and creation (Bloom's higher levels)
- Emphasize primary sources, papers, and original texts
- Complex prerequisite graphs with branching paths
- 15-30 minute estimated time per era
- Use taskTypes: synthesis-challenge, reflection, quiz
- Include deep connections (contrast, analogy) across tracks
- Reference cutting-edge or foundational primary literature`
  }
}
