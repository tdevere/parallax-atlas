# Security Review Playbook

> A repeatable checklist for auditing any project's security posture — especially projects using GitHub Actions, AI agents, Azure services, and client-side credential handling.
>
> Created from a real audit of [parallax-atlas](https://github.com/tdevere/parallax-atlas). Adapt per-project.

---

## When to Run This Review

- Before any new project goes public or accepts external contributions.
- Before adding CI/CD automation that touches secrets or deploys.
- Before integrating AI code-generation agents into workflows.
- After any incident involving credential exposure or unexpected deploys.
- Quarterly, for active projects with automation pipelines.

---

## Phase 1: Secret Scan (Priority: CRITICAL)

**Goal:** Confirm no credentials are committed to the repo — now or historically.

### 1.1 Scan working tree for credential patterns

```bash
# Common secret patterns (adapt regex per project)
grep -rn --include="*.ts" --include="*.js" --include="*.json" --include="*.yml" --include="*.yaml" --include="*.env" --include="*.md" \
  -E '(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AKIA[A-Z0-9]{16}|AIza[a-zA-Z0-9_-]{35}|-----BEGIN (RSA |EC )?PRIVATE KEY)' .

# Azure/cloud specific
grep -rn -E '(DefaultEndpointsProtocol=|AccountKey=|SharedAccessSignature=|Password=.{8,})' .

# Generic high-entropy strings in config files
grep -rn -E '[A-Za-z0-9+/]{40,}={0,2}' .env* *.config.* 2>/dev/null
```

### 1.2 Check git history for past credential commits

```bash
# Search history for common secret prefixes
git log --all -p -S 'sk-' --diff-filter=A
git log --all -p -S 'ghp_' --diff-filter=A
git log --all -p -S 'AKIA' --diff-filter=A
git log --all -p -S 'Password=' --diff-filter=A
git log --all -p -S 'AccountKey=' --diff-filter=A

# Check if .env files were ever committed
git log --all -- ".env" ".env.local" ".env.production"
git log --all -- "*.pem" "*.key" "*.p12"
```

### 1.3 Verify .gitignore coverage

```bash
# Must include at minimum:
cat .gitignore | grep -E '\.env|\.local|\.pem|\.key|\.p12'

# Verify specific files are NOT tracked
git ls-files --cached ".env" ".env.local" ".env.production"
# (empty output = good)
```

### 1.4 If a secret IS found in history

```bash
# 1. Rotate the credential IMMEDIATELY (provider console)
# 2. Remove from history using git-filter-repo (preferred) or BFG
pip install git-filter-repo
git filter-repo --invert-paths --path <file-with-secret>

# 3. Force-push all branches
git push --force --all

# 4. Notify collaborators to re-clone
```

### Checklist

- [ ] No API keys, tokens, or passwords in working tree
- [ ] No credentials in git history
- [ ] `.gitignore` covers `.env*`, `*.local`, `*.pem`, `*.key`
- [ ] `.env.example` has placeholder names only (no real values)
- [ ] Local credential files are confirmed untracked (`git ls-files --cached`)

---

## Phase 2: GitHub Actions Workflow Audit (Priority: HIGH)

**Goal:** Ensure workflows can't be exploited via injection, over-permissioning, or unreviewed auto-deploy.

### 2.1 Command injection check

Search for user-controlled values interpolated directly into `run:` blocks:

```bash
# DANGEROUS patterns — these allow shell injection:
grep -rn '\${{ github\.event\.issue\.' .github/workflows/
grep -rn '\${{ github\.event\.pull_request\.' .github/workflows/
grep -rn '\${{ github\.event\.comment\.' .github/workflows/
grep -rn '\${{ github\.event\.review\.' .github/workflows/
grep -rn '\${{ github\.event\.head_commit\.message' .github/workflows/
```

**Fix pattern:** Move untrusted values to `env:` and reference as `"$ENV_VAR"` in shell:

```yaml
# ❌ DANGEROUS — allows injection via crafted issue title
- run: |
    echo "Title: ${{ github.event.issue.title }}"

# ✅ SAFE — env indirection prevents shell interpretation
- env:
    ISSUE_TITLE: ${{ github.event.issue.title }}
  run: |
    echo "Title: $ISSUE_TITLE"
```

### 2.2 Permission audit

```bash
# List all permission blocks
grep -A5 'permissions:' .github/workflows/*.yml
```

Apply least-privilege:

| Permission | When to grant |
|---|---|
| `contents: read` | Default for checkout |
| `contents: write` | Only if workflow pushes branches/tags |
| `pull-requests: write` | Only if workflow creates/modifies PRs |
| `issues: write` | Only if workflow comments on issues |
| `id-token: write` | Only for OIDC/Azure AD token exchange |
| `actions: read` | Only if workflow reads other workflow runs |
| `deployments: write` | Only if workflow creates deployment records |

**Remove any permission not actively used.** Add inline comments explaining each.

### 2.3 Auto-merge / auto-deploy audit

```bash
grep -rn 'auto-merge\|auto_merge\|--merge\|--auto' .github/workflows/
grep -rn 'deploy\|upload' .github/workflows/
```

**Rules:**
- AI-generated PRs → must be **draft PRs**, never auto-merged.
- `workflow_dispatch` → must not combine `auto_merge` + `deploy` in a single trigger.
- Deploy steps → should only run on protected branches after human-reviewed merge.

### 2.4 Third-party action audit

```bash
# List all uses: lines
grep -rn 'uses:' .github/workflows/
```

For each:
- [ ] Is it pinned to a specific version/SHA? (e.g., `actions/checkout@v4` minimum, `@sha` ideal)
- [ ] Is it from a trusted publisher? (`actions/*`, `azure/*`, `github/*`)
- [ ] If community action — has the source been reviewed?

### Checklist

- [ ] No user-controlled input in `run:` blocks via `${{ }}`
- [ ] All permissions follow least-privilege with comments
- [ ] No auto-merge of AI-generated or bot PRs
- [ ] No auto-deploy without human-reviewed merge
- [ ] All third-party actions pinned to known versions
- [ ] `CODEOWNERS` protects `.github/workflows/` changes

---

## Phase 3: AI Agent / Automation Safety (Priority: HIGH)

**Goal:** Ensure AI code-generation pipelines can't produce or deploy unsafe code without oversight.

### 3.1 Agent output constraints

Every AI agent profile (Copilot agents, autonomous scripts, workflow bots) must have explicit rules:

```
MUST NOT:
- Introduce eval(), Function(), new Function(), dangerouslySetInnerHTML
- Add dynamic <script> injection
- Hardcode credentials in source files
- Disable or weaken authentication/authorization
- Remove security-related tests
- Auto-deploy without human review

MUST:
- Create draft PRs (not ready-to-merge)
- Pass quality gates (lint, build, tests) before PR creation
- Respect diff-size limits (configurable: e.g., max 500 lines, 10 files)
- Log decisions for human audit trail
```

### 3.2 Code generation script audit

For scripts like `resolve-issue.mjs`:

- [ ] AI temperature is low (0.1–0.3) for code generation
- [ ] Response format is constrained (e.g., `response_format: { type: 'json_object' }`)
- [ ] Generated code is written to disk, not piped to `eval()`
- [ ] There's a "no changes" exit path when the AI is uncertain
- [ ] Deletions are blocked or flagged for review
- [ ] File writes are scoped to project directories (no `../../` escapes)

### 3.3 Prompt injection resistance

- [ ] System prompts explicitly instruct the AI to ignore conflicting user instructions
- [ ] Issue body / user input is passed as a separate `user` message, not interpolated into the system prompt
- [ ] AI output is parsed as data (JSON), not executed as code

### Checklist

- [ ] All agent profiles have explicit security constraints
- [ ] AI PRs are always draft PRs
- [ ] Code generation scripts have bounded output
- [ ] No `eval()` of AI-generated strings
- [ ] Diff-size circuit breaker exists or is planned

---

## Phase 4: Client-Side Credential Handling (Priority: MEDIUM)

**Goal:** User-owned credentials (API keys entered in the UI) are handled safely.

### 4.1 Storage audit

```bash
# Find all localStorage/sessionStorage usage
grep -rn 'localStorage\|sessionStorage' src/
```

For each credential stored:
- [ ] Stored with clear user disclosure (visible text near input)
- [ ] Input uses `type="password"` to prevent shoulder-surfing
- [ ] Never logged to console
- [ ] Never included in analytics/telemetry payloads
- [ ] Only sent to the user's chosen provider endpoint
- [ ] Exportable/deletable by the user

### 4.2 XSS prevention

```bash
# Check for dangerous rendering patterns
grep -rn 'dangerouslySetInnerHTML' src/
grep -rn 'innerHTML' src/
grep -rn 'document\.write' src/
grep -rn 'v-html' src/           # Vue
grep -rn '\[innerHTML\]' src/    # Angular
```

For any hits:
- [ ] Input is sanitized (DOMPurify or equivalent)
- [ ] Or the content is developer-controlled (not user-supplied)

### 4.3 Network request audit

```bash
# Find all fetch/axios/API calls
grep -rn 'fetch(\|axios\.\|\.post(\|\.get(' src/
```

For each:
- [ ] Credentials are only sent to expected endpoints
- [ ] HTTPS is enforced (no `http://` endpoints)
- [ ] No credentials are sent as URL query parameters (use headers)
- [ ] CORS is properly configured on backend endpoints

### Checklist

- [ ] User credentials in `type="password"` inputs with disclosure
- [ ] No `dangerouslySetInnerHTML` with user-supplied content
- [ ] All API calls use HTTPS
- [ ] Credentials sent in headers, not URLs
- [ ] No telemetry/analytics includes credential data

---

## Phase 5: Infrastructure & Access Control (Priority: MEDIUM)

**Goal:** Deployment infrastructure follows defense-in-depth.

### 5.1 Branch protection

```bash
# Check via GitHub CLI
gh api repos/{owner}/{repo}/branches/main/protection 2>/dev/null
gh api repos/{owner}/{repo}/branches/master/protection 2>/dev/null
```

Required settings:
- [ ] Require PR reviews before merge (≥1 reviewer)
- [ ] Require status checks to pass (lint, build, E2E)
- [ ] Require branches to be up-to-date before merge
- [ ] Do not allow force pushes
- [ ] Do not allow branch deletion

### 5.2 CODEOWNERS

```bash
cat .github/CODEOWNERS 2>/dev/null || echo "MISSING — create one"
```

Minimum coverage:

```
# Require review for workflow and security-sensitive changes
.github/workflows/     @owner
.github/agents/        @owner
.github/copilot-instructions.md  @owner
staticwebapp.config.json         @owner
```

### 5.3 Service principal / managed identity audit

For Azure projects:
- [ ] Service principal has minimum required roles (no Owner/Contributor on subscription level)
- [ ] Client secrets have expiry dates set
- [ ] Consider migrating from client secrets to federated credentials (OIDC)
- [ ] Service principal is scoped to specific resource groups

### 5.4 Deployment environment audit

- [ ] Production deployments require environment approval in GitHub Actions
- [ ] Staging/preview environments are isolated from production data
- [ ] Production secrets are only available to production environment

### Checklist

- [ ] Branch protection enabled on all deploy-target branches
- [ ] CODEOWNERS file covers security-sensitive paths
- [ ] Service principals are least-privilege and time-bounded
- [ ] Production deploys require explicit approval

---

## Phase 6: Dependency Audit (Priority: LOW-MEDIUM)

### 6.1 Known vulnerability scan

```bash
npm audit              # Node.js
pip audit              # Python (pip-audit)
dotnet list package --vulnerable   # .NET
gh api repos/{owner}/{repo}/vulnerability-alerts  # GitHub Dependabot
```

### 6.2 Supply chain

- [ ] Lock files (`package-lock.json`, `yarn.lock`) are committed
- [ ] Dependabot or Renovate is enabled for automated updates
- [ ] No `postinstall` scripts from untrusted packages run arbitrary code
- [ ] Consider `npm audit signatures` for package provenance

### Checklist

- [ ] `npm audit` / equivalent shows no critical/high vulnerabilities
- [ ] Lock file is committed and up to date
- [ ] Automated dependency updates are configured
- [ ] No suspicious `postinstall` scripts in dependencies

---

## Quick Reference: Fix Patterns

### Shell injection → env indirection
```yaml
# Before (vulnerable)
- run: echo "${{ github.event.issue.title }}"

# After (safe)
- env:
    TITLE: ${{ github.event.issue.title }}
  run: echo "$TITLE"
```

### Auto-merge → draft PR
```yaml
# Before (risky)
gh pr create --title "..." --body "..."
gh pr merge "$URL" --merge --auto

# After (safe)
gh pr create --title "..." --body "..." --draft
# Human reviews and merges manually
```

### Hardcoded secret → environment variable
```typescript
// Before (vulnerable)
const key = 'sk-abc123...'

// After (safe)
const key = process.env.API_KEY ?? import.meta.env.VITE_API_KEY
```

---

## Audit Report Template

After completing the review, fill in this summary:

```markdown
# Security Audit Report — [Project Name]
**Date:** YYYY-MM-DD
**Reviewer:** [name]
**Scope:** [what was reviewed]

## Findings Summary
| Phase | Status | Critical Issues | Notes |
|-------|--------|----------------|-------|
| Secret Scan | ✅/❌ | N | |
| Workflow Audit | ✅/❌ | N | |
| AI Agent Safety | ✅/❌ | N | |
| Client Credentials | ✅/❌ | N | |
| Infrastructure | ✅/❌ | N | |
| Dependencies | ✅/❌ | N | |

## Critical Findings (fix immediately)
1. ...

## High Findings (fix this sprint)
1. ...

## Medium Findings (backlog)
1. ...

## Actions Taken
1. ...

## Recommendations
1. ...
```

---

## Automation Ideas

- **GitHub Action:** Run `grep` injection checks on every PR that modifies `.github/workflows/`
- **Pre-commit hook:** Block commits containing patterns like `sk-`, `ghp_`, `AKIA`
- **Scheduled audit:** Monthly `npm audit` + secret scan via GitHub Actions
- **Dependabot:** Enable for all supported ecosystems

---

*This playbook is a living document. Update it when you discover new patterns or tools.*
