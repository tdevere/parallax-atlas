# Cross-Repository Onboarding Guide

> **Audience:** AI coding agents (Copilot, copilot-auto, or equivalent).
> **Purpose:** Bootstrap security infrastructure, agent profiles, and CI quality gates for any repository using patterns proven in [parallax-atlas](https://github.com/tdevere/parallax-atlas).

---

## Prerequisites

The bootstrap script lives in the parallax-atlas repo:

```
parallax-atlas/scripts/bootstrap-repo.mjs
parallax-atlas/docs/SECURITY-REVIEW-PLAYBOOK.md
```

The target repo must be cloned locally. The bootstrap script requires Node.js 18+.

---

## Phase 1: Automated Scaffold (5 minutes)

Run from the parallax-atlas repo root:

```bash
# Dry-run first — see what would be generated
node scripts/bootstrap-repo.mjs --repo /path/to/target-repo --owner <github-username> --dry-run

# Apply
node scripts/bootstrap-repo.mjs --repo /path/to/target-repo --owner <github-username>
```

This creates (if they don't already exist):

| File | Type | Purpose |
|---|---|---|
| `.github/instructions/security.instructions.md` | Universal | Security policy applied to all files by GitHub Copilot |
| `.github/CODEOWNERS` | Semi-universal | Require PR review for workflow/agent/security file changes |
| `.github/copilot-instructions.md` | Generated + TODO | Project-specific instructions with embedded security policy |
| `.github/agents/QA Engineer.agent.md` | Generated | Test specialist agent customized to detected test framework |
| `.github/agents/Orchestrator.agent.md` | Generated | Task decomposition + quality gate coordinator |
| `.github/workflows/ci.yml` | Generated | Lint → build → test pipeline (only if no CI exists) |

**The script skips any file that already exists** — it never overwrites.

---

## Phase 2: Security Audit (15–30 minutes)

Follow the 6-phase checklist in `docs/SECURITY-REVIEW-PLAYBOOK.md`. Prioritize in order:

### Phase 2a — Secret Scan (CRITICAL)

```bash
cd /path/to/target-repo

# Scan working tree for common secret patterns
grep -rn --include="*.ts" --include="*.js" --include="*.json" --include="*.yml" --include="*.yaml" --include="*.env" --include="*.py" --include="*.cs" \
  -E '(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AKIA[A-Z0-9]{16}|AIza[a-zA-Z0-9_-]{35}|-----BEGIN (RSA |EC )?PRIVATE KEY|DefaultEndpointsProtocol=|AccountKey=)' .

# Check git history
git log --all -p -S 'sk-' --diff-filter=A
git log --all -p -S 'ghp_' --diff-filter=A
git log --all -p -S 'Password=' --diff-filter=A
git log --all -- ".env" ".env.local" ".env.production"

# Verify .gitignore
grep -E '\.env|\.local|\.pem|\.key' .gitignore

# Check nothing sensitive is tracked
git ls-files --cached ".env" ".env.local" ".env.production" "*.pem" "*.key"
```

**If any secret is found:** rotate it immediately, remove from history, then continue.

### Phase 2b — Workflow Injection Audit (HIGH)

```bash
# Find user-controlled values in run: blocks
grep -rn '\${{ github\.event\.issue\.\|github\.event\.pull_request\.\|github\.event\.comment\.\|github\.event\.head_commit\.message' .github/workflows/
```

For every match: move the value to `env:` and reference as `"$ENV_VAR"` in shell.

### Phase 2c — Auto-deploy Audit (HIGH)

```bash
grep -rn 'auto-merge\|auto_merge\|--merge.*--auto\|deploy' .github/workflows/
```

Ensure: no AI-generated PRs auto-merge; no deploy without human-reviewed merge.

---

## Phase 3: Fill in Project-Specific Knowledge (30–60 minutes)

The bootstrap generates `.github/copilot-instructions.md` with TODO sections. An agent must read the target codebase and fill these in:

### 3a — Architecture and Data Flow

Read the main entry points, configuration, and data models. Document:
- State management pattern (Redux, Zustand, Context, server state, etc.)
- API/backend communication (REST, GraphQL, gRPC, etc.)
- Data models and their relationships
- Authentication/authorization flow
- Key environment variables and what they configure

### 3b — Code Patterns to Preserve

Identify and document:
- Naming conventions (file names, component names, variable casing)
- Import organization patterns
- Error handling patterns
- Logging conventions
- Type definitions vs interfaces vs schemas

### 3c — Testing Guidance

Document:
- What test framework(s) are used and where tests live
- What's well-covered vs what has gaps
- How to run tests (exact commands)
- What constitutes a "good" test in this project

---

## Phase 4: Domain-Specific Agent Profiles (30–60 minutes)

The bootstrap gives you QA Engineer and Orchestrator. You likely need 1–3 more agents specific to the project's domain.

### How to identify what agents are needed

Read the codebase and look for separable concerns:

| Signal | Suggested Agent |
|---|---|
| Frontend components + styling system | **UI/UX Specialist** |
| API routes + database models | **Backend Engineer** |
| Infrastructure-as-code, Docker, deploy configs | **DevOps Specialist** |
| Schema files, data migrations, seed data | **Data Architect** |
| ML models, training pipelines, prompts | **AI/ML Engineer** |
| Third-party integrations (auth, payments, email) | **Integration Specialist** |

### Agent profile template

Every agent profile must include these sections:

```markdown
---
description: '<One sentence: what this agent does and when to invoke it>'
tools: [agent, read, search, edit, terminal]
---

# Role: <Name>

You are the **<Name>** for <project> — <one sentence identity>.

## Core mission
**<What success looks like in one sentence.>**

## Security obligations
You are bound by the **Security and safety policy** in `.github/copilot-instructions.md`. Specifically:
- <2-4 rules specific to this agent's scope>

## Scope
- Files: <list of file paths/patterns this agent owns>
- Concerns: <list of technical concerns>

## Guardrails
- <What this agent must NOT do>
- <What this agent must ALWAYS do>

## Validation gate
```bash
<exact commands to run>
```

## Workflow
When invoked:
1. <step>
2. <step>
3. Run validation gate
4. Report results
```

---

## Phase 5: Infrastructure Hardening (10 minutes)

### Branch protection

```bash
# Replace {owner}, {repo}, {branch} with actual values
gh api repos/{owner}/{repo}/branches/{branch}/protection \
  --method PUT --input - <<< '{
    "required_status_checks": { "strict": true, "contexts": ["test"] },
    "enforce_admins": false,
    "required_pull_request_reviews": { "required_approving_review_count": 1 },
    "restrictions": null
  }'
```

### Verify CODEOWNERS paths

The generated CODEOWNERS covers `.github/workflows/` and `.github/agents/`. Review and add project-specific sensitive paths (deploy configs, auth modules, etc.).

### Verify .gitignore

Ensure these patterns exist:

```
*.local
.env
.env.*
!.env.example
*.pem
*.key
*.p12
```

---

## Validation Checklist

Before considering onboarding complete:

- [ ] `security.instructions.md` exists and applies to `**`
- [ ] `CODEOWNERS` exists and covers `.github/workflows/`, `.github/agents/`
- [ ] `copilot-instructions.md` has security policy section (not just TODOs)
- [ ] Architecture section in copilot-instructions is filled in (not TODO)
- [ ] At least 2 agent profiles exist (QA + Orchestrator minimum)
- [ ] All agent profiles have Security obligations section
- [ ] Branch protection is enabled on default branch
- [ ] Secret scan passed (no credentials in tree or history)
- [ ] Workflow injection audit passed (no `${{ }}` user input in `run:` blocks)
- [ ] `.gitignore` covers credential file patterns
- [ ] CI workflow exists and runs lint + build + test
- [ ] All quality gates pass: lint ✅ build ✅ tests ✅

---

## Reference: What Transfers vs What's Custom

| Layer | Transfers 1:1 | Needs per-repo customization |
|---|---|---|
| Security policy text | ✅ | — |
| CODEOWNERS structure | ✅ | Paths and usernames |
| Security instructions file | ✅ | — |
| copilot-instructions.md | Security section only | Architecture, patterns, testing |
| QA Engineer agent | Structure + security | Test framework, selectors, scope |
| Orchestrator agent | Structure + security | Specialist list, gate commands |
| Domain agents | Nothing | Written from scratch per repo |
| CI workflow | Pattern | Commands, branch, Node version |
| issue-evaluation.yml | Pattern only | Endpoints, prompts, file lists, branch names |
| resolve-issue.mjs | Pattern only | CORE_FILES, system prompt, domain knowledge |

---

## Appendix: Source Files

These are the source-of-truth files in the parallax-atlas repo:

| File | Purpose |
|---|---|
| `scripts/bootstrap-repo.mjs` | Automated scaffold generator |
| `docs/SECURITY-REVIEW-PLAYBOOK.md` | 6-phase security audit checklist |
| `.github/instructions/security.instructions.md` | Universal Copilot security policy |
| `.github/copilot-instructions.md` | Full project instructions (parallax-specific, as reference) |
| `.github/agents/*.agent.md` | Agent profiles (parallax-specific, as structural templates) |
| `.github/workflows/issue-evaluation.yml` | AI issue resolution pipeline (parallax-specific, as pattern) |
| `scripts/resolve-issue.mjs` | AI code generation script (parallax-specific, as pattern) |
