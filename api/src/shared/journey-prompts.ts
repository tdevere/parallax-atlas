/**
 * Server-side prompt engineering for journey generation.
 *
 * Enhanced version of the client-side lesson-prompts.ts with:
 * - subtopics and keyLocations in the era schema
 * - refined pedagogical guidance
 * - refinement prompt support
 */

import type { DifficultyLevel, GenerateJourneyRequest, JourneyPackPayload, RefineJourneyRequest } from './journey-types.js'

/**
 * System prompt instructing the LLM to generate a valid JourneyPackPayload.
 * Includes the full JSON schema with subtopics and keyLocations.
 */
export function buildGenerateSystemPrompt(): string {
  return `You are an expert curriculum designer and educational content architect.
Your task is to generate a structured learning timeline for any given subject.
The timeline will be loaded into an interactive visualization app.

OUTPUT FORMAT:
You must return ONLY valid JSON (no markdown, no explanation) matching this exact schema:

{
  "id": "<kebab-case-subject-id>",
  "name": "<Human Readable Subject Name>",
  "description": "<2-3 sentence overview of the learning journey>",
  "context": {
    "persistence": "memory",
    "eras": [
      {
        "id": "<unique-kebab-id>",
        "content": "<Short display label (2-5 words)>",
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
        "subtopics": [
          { "id": "<subtopic-kebab-id>", "label": "<Subtopic Label>", "description": "<1-2 sentences>", "start": <years-ago>, "end": <years-ago> }
        ],
        "keyLocations": [
          { "label": "<Location Name>", "latitude": <number>, "longitude": <number>, "description": "<Why this place matters>" }
        ],
        "geoCenter": { "latitude": <number>, "longitude": <number>, "zoom": <number> },
        "region": "<Asia|Europe|Africa|Americas|Middle East|Australasia|Global>",
        "payload": {
          "taskType": "<concept-sorting|synthesis-challenge|active-recall|guided-reading|quiz|reflection>",
          "missionTitle": "<Engaging task title>",
          "prompt": "<Specific learning task prompt for the learner>",
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
1. "start" and "end" are YEARS AGO from today (not calendar years). For recent topics: 2025 CE = ~0 years ago, 1990 CE = ~35 years ago, 1776 CE = ~249 years ago. start must be >= end (earlier events have larger start values).
2. Every era MUST have a unique "id" in kebab-case.
3. "prerequisiteIds" should form a DAG (no cycles). Earlier eras are prerequisites for later ones.
4. "connections" express semantic relationships between eras (analogy, influence, contrast, application). Include at least 2-3 cross-era connections.
5. "group" names are track labels. Use 2-4 tracks that reflect the subject's natural structure.
6. Every era MUST have at least 2 real sources with valid URLs. Prefer Wikipedia, Stanford Encyclopedia, Khan Academy, Coursera, YouTube educational channels, arXiv, DOI links, and official documentation.
7. "payload" tasks should follow Bloom's taxonomy progression: intro→remember/understand, intermediate→apply/analyze, advanced→evaluate/create.
8. Each era's "estimatedMinutes" should be realistic (5-30 minutes per era).
9. "progress" object must include every era id initialized to 0.
10. "subtopics" break each era into 2-4 sub-concepts the learner should explore within that era.
11. "keyLocations" identify 1-3 real-world geographic locations relevant to the era (where events happened, where key people worked, where artifacts are found). Include valid lat/lng coordinates.
12. "geoCenter" should point to the most representative geographic location for the era. If the topic is not geographic, use the location most associated with the subject (lab, institution, origin city).
13. "region" should reflect the primary geographic region for the era.`
}

/** Build the user prompt for generation. */
export function buildGenerateUserPrompt(request: GenerateJourneyRequest): string {
  const parts: string[] = []

  parts.push(`Generate a comprehensive learning timeline for: "${request.topic}"`)
  parts.push(`Difficulty level: ${request.level ?? 'intro'}`)
  parts.push(`Number of eras to generate: ${request.eraCount ?? 8}`)

  if (request.priorKnowledge) {
    parts.push(`\nThe learner says about their prior knowledge: "${request.priorKnowledge}"`)
  }

  parts.push(getDifficultyGuidance(request.level ?? 'intro'))

  return parts.join('\n')
}

/** System prompt for the refine phase. */
export function buildRefineSystemPrompt(): string {
  return `You are an expert curriculum designer refining an existing learning timeline.
You will receive:
1. The current learning timeline (JSON pack)
2. A natural language instruction from the learner

Your task is to modify the timeline according to the instruction while following these rules:
- PRESERVE existing era IDs whenever possible (so learner progress is retained)
- You may add new eras, remove eras, or modify era content
- If adding new eras, use unique kebab-case IDs
- If removing eras, ensure no dangling prerequisiteIds remain
- Keep the same JSON schema as the original pack
- Return ONLY valid JSON (no markdown, no explanation)
- The "progress" object must include every era id (new eras at 0, preserved eras keep their current progress value)`
}

/** Build the user prompt for refinement. */
export function buildRefineUserPrompt(
  currentPack: JourneyPackPayload,
  request: RefineJourneyRequest,
): string {
  const parts: string[] = []

  parts.push('Current learning timeline:')
  parts.push('```json')
  parts.push(JSON.stringify(currentPack, null, 2))
  parts.push('```')
  parts.push('')
  parts.push(`Learner's instruction: "${request.instruction}"`)
  parts.push('')
  parts.push('Return the modified timeline as a complete JSON pack. Preserve era IDs where content is unchanged.')

  return parts.join('\n')
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
- Use taskTypes: active-recall, guided-reading, concept-sorting
- Subtopics should be concrete and tangible
- Key locations should include well-known landmarks or institutions`

    case 'intermediate':
      return `\nDIFFICULTY GUIDANCE (Intermediate):
- Assume foundational knowledge, focus on applying and analyzing
- Include mix of source formats including some papers
- Build moderate prerequisite chains (2-4 deep)
- 10-20 minute estimated time per era
- Use taskTypes: synthesis-challenge, active-recall, quiz
- Include cross-era connections to build conceptual bridges
- Subtopics should explore causal relationships
- Key locations should include research sites and institutions`

    case 'advanced':
      return `\nDIFFICULTY GUIDANCE (Advanced):
- Target evaluation and creation (Bloom's higher levels)
- Emphasize primary sources, papers, and original texts
- Complex prerequisite graphs with branching paths
- 15-30 minute estimated time per era
- Use taskTypes: synthesis-challenge, reflection, quiz
- Include deep connections (contrast, analogy) across tracks
- Reference cutting-edge or foundational primary literature
- Subtopics should probe open questions and ongoing debates
- Key locations should include archives, labs, and field sites`
  }
}
