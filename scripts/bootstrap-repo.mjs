#!/usr/bin/env node
/**
 * bootstrap-repo.mjs — Generate agent profiles, copilot instructions,
 * security infrastructure, and CI workflows for any repo.
 *
 * Usage:
 *   node scripts/bootstrap-repo.mjs --repo /path/to/target-repo [--owner tdevere] [--dry-run]
 *
 * What it does:
 *   1. Scans the target repo to understand its stack, structure, and existing CI.
 *   2. Copies universal files that don't need customization.
 *   3. Generates repo-specific files from templates + scanned context.
 *   4. Reports what was created and what needs manual follow-up.
 *
 * What it does NOT do:
 *   - Overwrite existing files without confirmation.
 *   - Commit or push anything (you review first).
 *   - Set up secrets or branch protection (prints instructions instead).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, basename, extname, relative } from 'path'

// ── CLI args ───────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2)
  const result = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace(/^--/, '')
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        result[key] = next
        i++
      } else {
        result[key] = true
      }
    }
  }
  return result
}

const args = parseArgs()
const TARGET_REPO = args.repo
const OWNER = args.owner ?? 'tdevere'
const DRY_RUN = !!args['dry-run']

if (!TARGET_REPO) {
  console.error('Usage: node scripts/bootstrap-repo.mjs --repo /path/to/repo [--owner name] [--dry-run]')
  process.exit(1)
}

if (!existsSync(TARGET_REPO)) {
  console.error(`ERROR: Target repo not found: ${TARGET_REPO}`)
  process.exit(1)
}

// ── Repo scanner ───────────────────────────────────────────────────────

function scanRepo(root) {
  const result = {
    name: basename(root),
    hasPackageJson: false,
    hasTsConfig: false,
    hasPython: false,
    hasDotNet: false,
    hasGo: false,
    hasDockerfile: false,
    frameworks: [],
    testFrameworks: [],
    existingWorkflows: [],
    existingAgents: [],
    existingCopilotInstructions: false,
    existingCodeowners: false,
    existingSecurityInstructions: false,
    srcDirs: [],
    keyFiles: [],
    defaultBranch: 'main',
    packageManager: 'npm',
    nodeVersion: '22',
  }

  // Package.json analysis
  const pkgPath = join(root, 'package.json')
  if (existsSync(pkgPath)) {
    result.hasPackageJson = true
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }

      if (allDeps.react) result.frameworks.push('React')
      if (allDeps.vue) result.frameworks.push('Vue')
      if (allDeps.angular || allDeps['@angular/core']) result.frameworks.push('Angular')
      if (allDeps.next) result.frameworks.push('Next.js')
      if (allDeps.vite) result.frameworks.push('Vite')
      if (allDeps.express) result.frameworks.push('Express')
      if (allDeps.fastify) result.frameworks.push('Fastify')
      if (allDeps.typescript) result.frameworks.push('TypeScript')
      if (allDeps.tailwindcss) result.frameworks.push('Tailwind CSS')

      if (allDeps.playwright || allDeps['@playwright/test']) result.testFrameworks.push('Playwright')
      if (allDeps.jest) result.testFrameworks.push('Jest')
      if (allDeps.vitest) result.testFrameworks.push('Vitest')
      if (allDeps.mocha) result.testFrameworks.push('Mocha')
      if (allDeps.cypress) result.testFrameworks.push('Cypress')

      if (pkg.engines?.node) result.nodeVersion = pkg.engines.node.replace(/[^0-9.]/g, '').split('.')[0] || '22'

      // Scripts
      result.scripts = pkg.scripts ?? {}
    } catch { /* skip parse errors */ }
  }

  // TypeScript
  if (existsSync(join(root, 'tsconfig.json'))) result.hasTsConfig = true

  // Python
  if (existsSync(join(root, 'requirements.txt')) || existsSync(join(root, 'pyproject.toml')) || existsSync(join(root, 'setup.py'))) {
    result.hasPython = true
    result.frameworks.push('Python')
  }

  // .NET
  const csprojFiles = findFiles(root, '*.csproj', 2)
  if (csprojFiles.length > 0) {
    result.hasDotNet = true
    result.frameworks.push('.NET')
  }

  // Go
  if (existsSync(join(root, 'go.mod'))) {
    result.hasGo = true
    result.frameworks.push('Go')
  }

  // Docker
  if (existsSync(join(root, 'Dockerfile')) || existsSync(join(root, 'docker-compose.yml'))) {
    result.hasDockerfile = true
  }

  // Existing GitHub infrastructure
  const workflowDir = join(root, '.github', 'workflows')
  if (existsSync(workflowDir)) {
    result.existingWorkflows = readdirSync(workflowDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
  }

  const agentDir = join(root, '.github', 'agents')
  if (existsSync(agentDir)) {
    result.existingAgents = readdirSync(agentDir).filter(f => f.endsWith('.agent.md'))
  }

  result.existingCopilotInstructions = existsSync(join(root, '.github', 'copilot-instructions.md'))
  result.existingCodeowners = existsSync(join(root, '.github', 'CODEOWNERS'))
  result.existingSecurityInstructions = existsSync(join(root, '.github', 'instructions', 'security.instructions.md'))

  // Source directories
  for (const dir of ['src', 'app', 'lib', 'components', 'pages', 'api', 'server', 'client', 'packages']) {
    if (existsSync(join(root, dir))) result.srcDirs.push(dir)
  }

  // Key files (top-level config/entry points)
  const topFiles = readdirSync(root).filter(f => {
    const s = statSync(join(root, f))
    return s.isFile() && !f.startsWith('.') && f !== 'package-lock.json' && f !== 'yarn.lock'
  })
  result.keyFiles = topFiles.slice(0, 20)

  // Default branch detection
  try {
    const headRef = readFileSync(join(root, '.git', 'HEAD'), 'utf-8').trim()
    const match = headRef.match(/ref: refs\/heads\/(.+)/)
    if (match) result.defaultBranch = match[1]
  } catch { /* skip */ }

  return result
}

function findFiles(dir, pattern, maxDepth, depth = 0) {
  if (depth > maxDepth) return []
  const results = []
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist') continue
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isFile() && entry.match(pattern.replace('*', '.*'))) {
        results.push(full)
      } else if (stat.isDirectory()) {
        results.push(...findFiles(full, pattern, maxDepth, depth + 1))
      }
    }
  } catch { /* skip */ }
  return results
}

function buildFileTree(dir, prefix = '', depth = 2) {
  if (depth <= 0) return ''
  let tree = ''
  try {
    const entries = readdirSync(dir).filter(e => !e.startsWith('.') && e !== 'node_modules' && e !== 'dist' && e !== 'bin' && e !== 'obj')
    for (const entry of entries.slice(0, 30)) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        tree += `${prefix}${entry}/\n`
        tree += buildFileTree(full, prefix + '  ', depth - 1)
      } else {
        tree += `${prefix}${entry}\n`
      }
    }
  } catch { /* skip */ }
  return tree
}

// ── File generators ────────────────────────────────────────────────────

function generateSecurityInstructions() {
  // This is 100% universal — copy as-is
  return `---
applyTo: "**"
---

## Security policy

Follow the **Security and safety policy** in \`.github/copilot-instructions.md\`.

Key rules:
- Never hardcode API keys, tokens, passwords, or connection strings in source files.
- Never interpolate user-controlled input directly into shell commands in GitHub Actions workflows — use \`env:\` indirection.
- AI-generated code must never auto-deploy to production without human review.
- Never introduce \`eval()\`, \`Function()\`, \`dangerouslySetInnerHTML\`, or dynamic \`<script>\` injection.
- Never add, remove, or weaken authentication/authorization checks.
- No analytics or telemetry without explicit user consent.
- User credentials in localStorage must never be logged or sent to unintended endpoints.
- When in doubt, prefer the safer option and explain why.
`
}

function generateCodeowners(scan) {
  return `# Require review for security-sensitive files
.github/workflows/                   @${OWNER}
.github/agents/                      @${OWNER}
.github/copilot-instructions.md      @${OWNER}
.github/CODEOWNERS                   @${OWNER}
`
}

function generateCopilotInstructions(scan) {
  const stack = scan.frameworks.length > 0 ? scan.frameworks.join(' + ') : 'Unknown stack'
  const testInfo = scan.testFrameworks.length > 0 ? scan.testFrameworks.join(', ') : 'No test framework detected'
  const srcList = scan.srcDirs.map(d => `\`${d}/\``).join(', ') || 'Not detected'

  const lintCmd = scan.scripts?.lint ? 'npm run lint' : '# TODO: add lint command'
  const buildCmd = scan.scripts?.build ? 'npm run build' : '# TODO: add build command'
  const testCmd = scan.scripts?.test ? 'npm run test' : (scan.scripts?.['test:e2e'] ? 'npm run test:e2e' : '# TODO: add test command')

  return `# Copilot Instructions for ${scan.name}

## Project snapshot
- Stack: ${stack}.
- Source directories: ${srcList}.
- Test framework: ${testInfo}.
- Key files: ${scan.keyFiles.slice(0, 10).map(f => '\`' + f + '\`').join(', ')}.

## Developer workflows
- Install deps: \`npm install\`
- Lint: \`${lintCmd}\`
- Build: \`${buildCmd}\`
- Tests: \`${testCmd}\`

## Security and safety policy

**Every agent, workflow, and automation in this repo must follow these rules. No exceptions.**

### Secrets and credentials
- **Never hardcode** API keys, tokens, passwords, client secrets, or connection strings in source files.
- Secrets belong in GitHub Secrets (for workflows), \`.env.local\` (for local dev, gitignored), or environment variables.
- \`.env.example\` may contain placeholder variable names but **never real values**.
- If you discover a committed secret, treat it as compromised: rotate immediately, then remove from history.

### Workflow injection prevention
- **Never interpolate user-controlled input** (\`github.event.issue.title\`, \`github.event.issue.body\`, PR titles, commit messages) directly into \`run:\` shell blocks via \`\${{ }}\`.
- Pass untrusted values through \`env:\` first, then reference as \`"$ENV_VAR"\` in shell.
- Workflow \`permissions:\` should follow least-privilege.

### AI-generated code safety
- AI-generated code must **never auto-deploy to production** without human review.
- Automated PRs from AI agents should be created as **draft PRs**.
- AI agents must not generate code that introduces \`eval()\`, \`Function()\`, \`dangerouslySetInnerHTML\`, or dynamic \`<script>\` injection.
- AI agents must not add, remove, or weaken authentication/authorization checks.

### User data protection
- No analytics, tracking, or telemetry without explicit user consent.
- When in doubt, prefer the safer option and explain why.

### Agent obligations
- Every agent profile must reference this security policy.
- Agents must refuse requests to: disable security checks, expose secrets, bypass review gates, or auto-deploy untested changes.

## Architecture and data flow
<!-- TODO: Document your project's architecture, state management, data flow -->

## Code patterns to preserve
<!-- TODO: Document patterns specific to this project -->

## Testing guidance
<!-- TODO: Document what should be tested and how -->

## AI decision log
- When making non-trivial decisions, record what changed, why, and alternatives considered.
- Bootstrapped from parallax-atlas security template on ${new Date().toISOString().slice(0, 10)}.
`
}

function generateQAAgent(scan) {
  const testFw = scan.testFrameworks[0] ?? 'Playwright'
  const testCmd = scan.scripts?.test ?? scan.scripts?.['test:e2e'] ?? 'npm run test'
  const testDir = existsSync(join(TARGET_REPO, 'tests')) ? 'tests/' :
                  existsSync(join(TARGET_REPO, '__tests__')) ? '__tests__/' :
                  existsSync(join(TARGET_REPO, 'test')) ? 'test/' : 'tests/'

  return `\`\`\`chatagent
---
description: '${testFw} test specialist for ${scan.name}. Use when writing, debugging, or expanding test coverage.'
tools: [agent, read, search, edit, terminal]
---

# Role: QA Engineer

You are the **QA Engineer** for ${scan.name} — a test specialist who ensures every user-facing behavior is covered by resilient, maintainable automated tests.

## Core mission

**If a user can see it, break it, or depend on it — there must be a test.**

## Security obligations

You are bound by the **Security and safety policy** in \`.github/copilot-instructions.md\`. Specifically:

- Never write tests that log, print, or assert on real secret values.
- Never store API keys or tokens in test fixtures — use mocks or environment-variable stubs.
- If you discover a test that depends on a real credential, flag it immediately and replace with a mock.
- Never approve or write test code that disables security checks to make tests pass.

## Testing philosophy

### What to test
- User-observable outcomes: visible text, button states, navigation, data persistence.
- Error states and edge cases: invalid input, network failures, empty states.
- Authentication flows: login/logout, permission gates, session handling.

### What NOT to test
- Implementation-private state (internal component state, store internals).
- Styling details that don't affect user behavior.
- Third-party library internals.

## Guardrails

- Never delete existing passing tests without equivalent replacement coverage.
- Never assert on timing-dependent values — use proper waits.
- Always run \`${testCmd}\` after changes and report pass/fail counts.
- If a test is flaky, fix the flakiness rather than skipping it.

## Validation gate

\`\`\`bash
${testCmd}
\`\`\`

## Workflow

When invoked:
1. Read test files in \`${testDir}\` to understand current coverage.
2. Identify the highest-value gap or the specific area requested.
3. Write new test(s) following project patterns.
4. Run tests and iterate until all pass.
5. Report: what's covered, what passed, what gaps remain.
\`\`\`
`
}

function generateOrchestratorAgent(scan) {
  const lintCmd = scan.scripts?.lint ? 'npm run lint' : '# lint'
  const buildCmd = scan.scripts?.build ? 'npm run build' : '# build'
  const testCmd = scan.scripts?.test ?? scan.scripts?.['test:e2e'] ?? 'npm run test'

  return `\`\`\`chatagent
---
description: 'Task decomposition and quality gate coordinator for ${scan.name}. Use for complex multi-step requests that span multiple concerns.'
tools: [agent, read, search, edit, terminal, browser]
---

# Role: Orchestrator

You are the **Orchestrator** for ${scan.name} — a coordinator who decomposes complex requests into specialist-scoped subtasks, sequences them correctly, and ensures the final result passes all quality gates.

## Core mission

**No change ships without passing all quality gates. No specialist works on the wrong thing.**

## Security obligations

You are bound by the **Security and safety policy** in \`.github/copilot-instructions.md\`. Specifically:

- Never instruct specialists to disable security checks, weaken auth, or bypass review gates.
- When delegating tasks that touch authentication, authorization, or secrets, explicitly flag the security implications.
- If a requested task would require committing credentials, stop and explain the safe alternative.

## Decomposition framework

When you receive a complex request:

### 1. Classify the work
- **Single-concern**: Route directly to the appropriate specialist or handle yourself.
- **Multi-concern, sequential**: Plan an ordered pipeline with dependencies.
- **Multi-concern, parallel-safe**: Identify file-scope isolation to avoid conflicts.

### 2. Define the task list
For each subtask, specify:
- **What**: One-sentence deliverable.
- **Who**: Which specialist or self.
- **Files**: Exact scope.
- **Depends on**: Prior subtask dependencies.

### 3. Final validation gate

After all subtasks complete:

\`\`\`bash
${lintCmd} && ${buildCmd} && ${testCmd}
\`\`\`

## Quality standards

- Every change must pass all quality gates before considering it complete.
- Non-trivial decisions must be logged in \`.github/copilot-instructions.md\`.

## Reporting format

After completing a multi-step task, report:

- What was done per subtask
- Validation results (lint/build/test)
- Decisions logged
- Next priorities
\`\`\`
`
}

function generateCIWorkflow(scan) {
  if (!scan.hasPackageJson) return null // Only generate for Node.js projects for now

  const lintStep = scan.scripts?.lint ? `      - name: Lint
        run: npm run lint\n` : ''

  const buildStep = scan.scripts?.build ? `      - name: Build
        run: npm run build\n` : ''

  const playwrightInstall = scan.testFrameworks.includes('Playwright') ?
    `      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium\n` : ''

  const testStep = scan.scripts?.test ? `      - name: Test
        run: npm run test\n` :
    scan.scripts?.['test:e2e'] ? `      - name: E2E tests
        run: npm run test:e2e\n` : ''

  const reportUpload = scan.testFrameworks.includes('Playwright') ? `
      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 14` : ''

  return `name: CI

on:
  pull_request:
  push:
    branches:
      - ${scan.defaultBranch}

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${scan.nodeVersion}
          cache: npm

      - name: Install dependencies
        run: npm ci

${playwrightInstall}${lintStep}${buildStep}${testStep}${reportUpload}
`
}

// ── Main ───────────────────────────────────────────────────────────────

function main() {
  console.log(`\n🔍 Scanning ${TARGET_REPO}...\n`)
  const scan = scanRepo(TARGET_REPO)

  console.log(`📦 Project: ${scan.name}`)
  console.log(`🔧 Stack: ${scan.frameworks.join(', ') || 'Unknown'}`)
  console.log(`🧪 Tests: ${scan.testFrameworks.join(', ') || 'None detected'}`)
  console.log(`🌿 Branch: ${scan.defaultBranch}`)
  console.log(`📂 Source dirs: ${scan.srcDirs.join(', ') || 'None detected'}`)
  console.log(`📋 Existing workflows: ${scan.existingWorkflows.join(', ') || 'None'}`)
  console.log(`🤖 Existing agents: ${scan.existingAgents.join(', ') || 'None'}`)
  console.log('')

  const files = []

  // ── Universal files (always create) ──────────────────────────────
  if (!scan.existingSecurityInstructions) {
    files.push({
      path: '.github/instructions/security.instructions.md',
      content: generateSecurityInstructions(),
      reason: 'Universal security policy for GitHub Copilot',
    })
  } else {
    console.log('⏭️  Skipping security.instructions.md (already exists)')
  }

  if (!scan.existingCodeowners) {
    files.push({
      path: '.github/CODEOWNERS',
      content: generateCodeowners(scan),
      reason: 'Require review for security-sensitive files',
    })
  } else {
    console.log('⏭️  Skipping CODEOWNERS (already exists)')
  }

  // ── Repo-specific generated files ────────────────────────────────
  if (!scan.existingCopilotInstructions) {
    files.push({
      path: '.github/copilot-instructions.md',
      content: generateCopilotInstructions(scan),
      reason: 'Project instructions with security policy (TODO sections need filling in)',
    })
  } else {
    console.log('⏭️  Skipping copilot-instructions.md (already exists — review for security policy)')
  }

  // Agents
  const hasQA = scan.existingAgents.some(a => a.toLowerCase().includes('qa'))
  if (!hasQA) {
    files.push({
      path: '.github/agents/QA Engineer.agent.md',
      content: generateQAAgent(scan),
      reason: 'Test specialist agent customized for detected test framework',
    })
  }

  const hasOrch = scan.existingAgents.some(a => a.toLowerCase().includes('orchestrat'))
  if (!hasOrch) {
    files.push({
      path: '.github/agents/Orchestrator.agent.md',
      content: generateOrchestratorAgent(scan),
      reason: 'Task coordination agent with quality gates',
    })
  }

  // CI workflow
  const hasCI = scan.existingWorkflows.some(w => w.toLowerCase().includes('ci'))
  if (!hasCI && scan.hasPackageJson) {
    const ciContent = generateCIWorkflow(scan)
    if (ciContent) {
      files.push({
        path: '.github/workflows/ci.yml',
        content: ciContent,
        reason: 'Standard CI pipeline: lint → build → test',
      })
    }
  } else if (hasCI) {
    console.log('⏭️  Skipping ci.yml (already exists)')
  }

  // ── Write files ──────────────────────────────────────────────────
  console.log(`\n📝 ${DRY_RUN ? 'Would create' : 'Creating'} ${files.length} files:\n`)

  for (const file of files) {
    const fullPath = join(TARGET_REPO, file.path)
    console.log(`  ${DRY_RUN ? '🔍' : '✅'} ${file.path}`)
    console.log(`     ${file.reason}`)

    if (!DRY_RUN) {
      const dir = join(fullPath, '..')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(fullPath, file.content, 'utf-8')
    }
  }

  // ── Manual follow-up instructions ────────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 MANUAL FOLLOW-UP REQUIRED

1. Fill in TODO sections in .github/copilot-instructions.md:
   - Architecture and data flow
   - Code patterns to preserve
   - Testing guidance

2. Enable branch protection on '${scan.defaultBranch}':
   gh api repos/${OWNER}/${scan.name}/branches/${scan.defaultBranch}/protection \\
     --method PUT --input - <<< '{
       "required_status_checks": { "strict": true, "contexts": ["test"] },
       "enforce_admins": false,
       "required_pull_request_reviews": { "required_approving_review_count": 1 },
       "restrictions": null
     }'

3. Add domain-specific agent profiles:
   - Read the codebase and create agents scoped to YOUR architecture.
   - Use the QA Engineer and Orchestrator as structural templates.
   - Each agent needs: Role, Security obligations, Scope, Guardrails, Workflow.

4. Run security audit:
   - Copy docs/SECURITY-REVIEW-PLAYBOOK.md to the target repo.
   - Work through Phase 1 (secret scan) and Phase 2 (workflow audit).

5. Verify .gitignore covers credential files:
   grep -E '\\.env|\\.local|\\.pem|\\.key' ${TARGET_REPO}/.gitignore

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

main()
