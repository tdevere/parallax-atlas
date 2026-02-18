/**
 * resolve-issue.mjs — AI-powered autonomous issue resolution agent.
 *
 * Reads a GitHub issue, gathers relevant source context from the repo,
 * asks Azure OpenAI (gpt-4o) to generate a fix or implementation,
 * and writes the changes to disk so the workflow can create a PR.
 *
 * Auth: Uses Azure AD token (az account get-access-token) since API keys
 * are disabled by tenant policy.
 *
 * Usage (from CI):
 *   node scripts/resolve-issue.mjs --issue-number 1 --issue-title "[Bug] ..."
 *       --issue-body "..." --issue-type bug
 *
 * Environment:
 *   AZURE_OPENAI_ENDPOINT — e.g. https://parallax-atlas-ai.openai.azure.com
 *   AZURE_OPENAI_DEPLOYMENT — e.g. gpt-4o
 *   AZURE_AD_TOKEN — AAD bearer token for Cognitive Services
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

// ── CLI args ───────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const result = {}
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '')
    result[key] = args[i + 1] ?? ''
  }
  return result
}

const args = parseArgs()
const ISSUE_NUMBER = args['issue-number'] ?? '0'
const ISSUE_TITLE = args['issue-title'] ?? ''
const ISSUE_BODY = args['issue-body'] ?? ''
const ISSUE_TYPE = args['issue-type'] ?? 'bug' // 'bug' | 'feature'

const ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT ?? 'https://parallax-atlas-ai.openai.azure.com'
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o'
const TOKEN = process.env.AZURE_AD_TOKEN ?? ''

if (!TOKEN) {
  console.error('ERROR: AZURE_AD_TOKEN not set')
  process.exit(1)
}

// ── Source context gathering ───────────────────────────────────────────

const REPO_ROOT = process.cwd()
const MAX_FILE_SIZE = 12_000 // chars per file
const CORE_FILES = [
  'src/App.tsx',
  'src/components/Timeline.tsx',
  'src/components/ProgressSidebar.tsx',
  'src/components/FeedbackModal.tsx',
  'src/components/EraDetailModal.tsx',
  'src/data/timeline-data.ts',
  'src/viewer/context.ts',
  'src/viewer/types.ts',
  'src/viewer/progress-store.ts',
  'src/viewer/pack-loader.ts',
  'src/auth/swa-auth.ts',
  'src/auth/use-auth.ts',
  'src/api/api-client.ts',
  'src/knowledge-tree/tree-types.ts',
  'src/knowledge-tree/tree-engine.ts',
  'src/index.css',
  'staticwebapp.config.json',
  'package.json',
  'tests/e2e/timeline.spec.ts',
]

function gatherSourceContext() {
  const files = {}
  for (const rel of CORE_FILES) {
    const abs = join(REPO_ROOT, rel)
    if (existsSync(abs)) {
      const content = readFileSync(abs, 'utf-8')
      files[rel] = content.length > MAX_FILE_SIZE
        ? content.slice(0, MAX_FILE_SIZE) + '\n// ... (truncated)'
        : content
    }
  }
  return files
}

function buildFileTree(dir, prefix = '', depth = 3) {
  if (depth <= 0) return ''
  let tree = ''
  try {
    const entries = readdirSync(dir).filter(e => !e.startsWith('.') && e !== 'node_modules' && e !== 'dist')
    for (const entry of entries) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        tree += `${prefix}${entry}/\n`
        tree += buildFileTree(full, prefix + '  ', depth - 1)
      } else {
        tree += `${prefix}${entry}\n`
      }
    }
  } catch { /* skip unreadable */ }
  return tree
}

// ── Azure OpenAI call ──────────────────────────────────────────────────

async function callAzureOpenAI(messages) {
  const url = `${ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=2024-08-01-preview`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      temperature: 0.2,
      max_tokens: 16000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Azure OpenAI ${res.status}: ${text}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log(`🤖 Resolving issue #${ISSUE_NUMBER} (${ISSUE_TYPE}): ${ISSUE_TITLE}`)

  // 1. Gather context
  const sourceFiles = gatherSourceContext()
  const fileTree = buildFileTree(REPO_ROOT)

  const contextBlock = Object.entries(sourceFiles)
    .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
    .join('\n\n')

  // 2. Build prompt
  const systemPrompt = `You are an expert full-stack developer working on "Parallax Atlas" — a React 19 + TypeScript + Vite + Tailwind CSS learning timeline app.

Your job is to autonomously resolve GitHub issues by generating code changes.

RULES:
- Output valid JSON with this exact schema:
  {
    "analysis": "Brief analysis of the issue and approach",
    "changes": [
      {
        "file": "relative/path/to/file.ts",
        "action": "create" | "modify" | "delete",
        "content": "Full file content for create/modify, empty for delete",
        "description": "What this change does"
      }
    ],
    "testSuggestions": "Any new E2E test assertions to add",
    "commitMessage": "Conventional commit message for the changes"
  }
- For "modify" actions, provide the COMPLETE new file content (not a diff).
- Keep changes minimal and focused on the issue.
- Maintain TypeScript strict mode, Tailwind classes, existing patterns.
- Do NOT modify test files unless the issue specifically requires test changes.
- Prefer small, safe changes over ambitious rewrites.
- If the issue is unclear or too risky to auto-resolve, set changes to an empty array and explain in analysis.`

  const userPrompt = `## Issue #${ISSUE_NUMBER}
**Type:** ${ISSUE_TYPE}
**Title:** ${ISSUE_TITLE}

**Description:**
${ISSUE_BODY}

## Repository Structure
\`\`\`
${fileTree}
\`\`\`

## Source Files
${contextBlock}

---

Analyze this issue and generate the minimal code changes needed to resolve it. Return valid JSON.`

  // 3. Call AI
  console.log('📡 Calling Azure OpenAI...')
  let response
  try {
    response = await callAzureOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])
  } catch (err) {
    console.error('❌ AI call failed:', err.message)
    // Write empty result
    writeFileSync(join(REPO_ROOT, '.ai-resolution.json'), JSON.stringify({
      analysis: `AI call failed: ${err.message}`,
      changes: [],
      testSuggestions: '',
      commitMessage: '',
    }, null, 2))
    process.exit(0) // Don't fail the workflow — just report no changes
  }

  // 4. Parse response
  let result
  try {
    result = JSON.parse(response)
  } catch {
    console.error('❌ Failed to parse AI response as JSON')
    console.error('Raw response:', response.slice(0, 500))
    writeFileSync(join(REPO_ROOT, '.ai-resolution.json'), JSON.stringify({
      analysis: 'AI response was not valid JSON',
      changes: [],
      testSuggestions: '',
      commitMessage: '',
    }, null, 2))
    process.exit(0)
  }

  console.log(`📋 Analysis: ${result.analysis}`)
  console.log(`📝 Changes: ${result.changes?.length ?? 0} files`)

  // 5. Apply changes
  const changes = result.changes ?? []
  let applied = 0

  for (const change of changes) {
    const filePath = join(REPO_ROOT, change.file)

    if (change.action === 'delete') {
      console.log(`🗑️  Delete: ${change.file}`)
      // Don't actually delete in autonomous mode — too risky
      console.log('   (skipped — deletion requires manual review)')
      continue
    }

    if (change.action === 'create' || change.action === 'modify') {
      const dir = join(filePath, '..')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(filePath, change.content, 'utf-8')
      console.log(`✏️  ${change.action}: ${change.file} — ${change.description}`)
      applied++
    }
  }

  // 6. Write metadata for the workflow
  writeFileSync(join(REPO_ROOT, '.ai-resolution.json'), JSON.stringify({
    ...result,
    appliedCount: applied,
    issueNumber: ISSUE_NUMBER,
    issueType: ISSUE_TYPE,
  }, null, 2))

  console.log(`\n✅ Applied ${applied} changes. Metadata written to .ai-resolution.json`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
