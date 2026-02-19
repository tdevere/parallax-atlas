# Agent Briefing: Security Review Only

> **Format:** Machine-readable task specification for AI coding agents.
> **Scope:** Security audit only — no agent profiles, no CI workflows, no copilot-instructions.
> **Reference playbook:** `docs/SECURITY-REVIEW-PLAYBOOK.md` (full 6-phase checklist with fix patterns)

---

## Task Definition

```yaml
goal: Perform a comprehensive security audit of a target repository and fix all findings
input: A locally cloned repository (any language/framework)
output: An audit report (markdown) plus commits fixing every finding, on a dedicated branch
time_budget: 30-60 minutes
severity_order: CRITICAL → HIGH → MEDIUM → LOW
```

---

## Step 1: Reconnaissance (read-only, ~5 minutes)

Before touching anything, understand the repo. Gather these facts:

```yaml
gather:
  - default_branch: main | master | other
  - languages: [list all from file extensions and config files]
  - package_managers: [npm | pip | dotnet | go mod | cargo | etc.]
  - has_workflows: true/false (check .github/workflows/)
  - has_env_files: true/false (check .env*, *.local)
  - has_gitignore: true/false
  - has_docker: true/false
  - has_deploy_config: true/false (staticwebapp.config.json, Dockerfile, serverless.yml, etc.)
  - credential_storage: [localStorage | sessionStorage | cookies | env vars | vault]
  - api_calls: [list endpoints or fetch/axios patterns found in source]
  - auth_mechanism: [none | API key | OAuth | AAD | JWT | session | etc.]
```

Commands:

```bash
cd <target-repo>

# Languages and structure
find . -type f -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.cs" -o -name "*.go" -o -name "*.rs" -o -name "*.java" -o -name "*.rb" -o -name "*.php" | head -30
cat .gitignore 2>/dev/null
ls .github/workflows/ 2>/dev/null
ls .env* 2>/dev/null

# Quick credential surface scan
grep -rn 'localStorage\|sessionStorage\|fetch(\|axios\.\|process\.env\|import\.meta\.env' src/ lib/ app/ 2>/dev/null | head -20
```

Record the results — every later step depends on accurate recon.

---

## Step 2: Secret Scan (CRITICAL, ~10 minutes)

### 2a — Scan working tree

Run these against the repo root. Adjust `--include` extensions based on recon:

```bash
# Universal secret patterns
grep -rn \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --include="*.json" --include="*.yml" --include="*.yaml" --include="*.env" \
  --include="*.py" --include="*.cs" --include="*.go" --include="*.rs" \
  --include="*.java" --include="*.rb" --include="*.php" --include="*.md" \
  --include="*.toml" --include="*.cfg" --include="*.ini" --include="*.conf" \
  -E '(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AKIA[A-Z0-9]{16}|AIza[a-zA-Z0-9_-]{35}|-----BEGIN (RSA |EC )?PRIVATE KEY)' .

# Cloud/database connection strings
grep -rn -E '(DefaultEndpointsProtocol=|AccountKey=|SharedAccessSignature=|Password=.{8,}|mongodb\+srv://[^"]+@|postgresql://[^"]+@|mysql://[^"]+@)' .

# High-entropy strings in config files (potential secrets)
grep -rn -E '[A-Za-z0-9+/]{40,}={0,2}' .env* *.config.* 2>/dev/null
```

### 2b — Scan git history

```bash
git log --all -p -S 'sk-' --diff-filter=A
git log --all -p -S 'ghp_' --diff-filter=A
git log --all -p -S 'AKIA' --diff-filter=A
git log --all -p -S 'Password=' --diff-filter=A
git log --all -p -S 'AccountKey=' --diff-filter=A
git log --all -- ".env" ".env.local" ".env.production"
git log --all -- "*.pem" "*.key" "*.p12"
```

### 2c — Verify .gitignore

```bash
# Check coverage
grep -E '\.env|\.local|\.pem|\.key|\.p12' .gitignore

# Verify nothing sensitive is tracked
git ls-files --cached ".env" ".env.local" ".env.production" "*.pem" "*.key" "*.p12"
# Expected: empty output
```

### 2d — If a secret IS found

1. **Rotate the credential immediately** (provider console)
2. Remove from history: `git filter-repo --invert-paths --path <file>`
3. Force-push all branches
4. Add the file pattern to `.gitignore`
5. Document the incident in the audit report

### Checklist

```yaml
secret_scan:
  - no_secrets_in_working_tree: true/false
  - no_secrets_in_git_history: true/false
  - gitignore_covers_credential_patterns: true/false
  - env_example_has_no_real_values: true/false  # check .env.example if it exists
  - tracked_credential_files: []  # list any found by git ls-files
  - findings: []  # list each finding with file, line, pattern matched
  - fixes_applied: []  # list each remediation action taken
```

---

## Step 3: Workflow Injection Audit (HIGH, ~10 minutes)

Skip this step if the repo has no `.github/workflows/` directory.

### 3a — Command injection

```bash
# Find user-controlled values interpolated directly into run: blocks
grep -rn '\${{ github\.event\.issue\.' .github/workflows/
grep -rn '\${{ github\.event\.pull_request\.' .github/workflows/
grep -rn '\${{ github\.event\.comment\.' .github/workflows/
grep -rn '\${{ github\.event\.review\.' .github/workflows/
grep -rn '\${{ github\.event\.head_commit\.message' .github/workflows/
```

**Every match is a vulnerability** unless the value is only in `env:`, `if:`, or `with:` (not `run:`).

**Fix pattern** — move to `env:` indirection:

```yaml
# ❌ VULNERABLE
- run: echo "${{ github.event.issue.title }}"

# ✅ SAFE
- env:
    ISSUE_TITLE: ${{ github.event.issue.title }}
  run: echo "$ISSUE_TITLE"
```

### 3b — Permission audit

```bash
grep -B2 -A5 'permissions:' .github/workflows/*.yml
```

For each permission: is it actually used by the workflow steps? Remove unused permissions. Add inline comments explaining each.

### 3c — Auto-deploy / auto-merge

```bash
grep -rn 'auto-merge\|auto_merge\|--merge.*--auto\|deploy' .github/workflows/
```

Rules:
- AI-generated PRs must be **draft PRs**, never auto-merged
- No deploy without human-reviewed merge on a protected branch
- `workflow_dispatch` must not combine auto-merge + deploy

### 3d — Third-party actions

```bash
grep -rn 'uses:' .github/workflows/
```

For each: is it pinned to a version/SHA? Is it from a trusted publisher?

### Checklist

```yaml
workflow_audit:
  - injection_vulnerabilities_found: 0
  - injection_vulnerabilities_fixed: 0
  - permissions_follow_least_privilege: true/false
  - no_auto_merge_of_bot_prs: true/false
  - no_auto_deploy_without_review: true/false
  - all_actions_version_pinned: true/false
  - findings: []
  - fixes_applied: []
```

---

## Step 4: AI Agent / Automation Safety (HIGH, ~5 minutes)

Skip if the repo has no AI agents, automation scripts, or code-generation pipelines.

### 4a — Check for AI code generation scripts

```bash
# Common patterns
find . -name "resolve-issue*" -o -name "agent*" -o -name "*copilot*" -o -name "*ai-*" 2>/dev/null
ls .github/agents/ 2>/dev/null
grep -rn 'openai\|anthropic\|azure.*completions\|ChatCompletion' . --include="*.ts" --include="*.js" --include="*.py" --include="*.mjs" 2>/dev/null
```

### 4b — Audit each script found

- [ ] Does it `eval()` AI-generated output? (CRITICAL — must not)
- [ ] Does it create auto-merged PRs? (HIGH — must be draft)
- [ ] Does it have output size limits / circuit breakers?
- [ ] Is AI output parsed as data (JSON), not executed as code?
- [ ] Are file writes scoped to the project directory (no `../../` escapes)?

### 4c — Check for dangerous code patterns from AI agents

```bash
grep -rn 'eval(\|new Function(\|dangerouslySetInnerHTML\|document\.write\|innerHTML' src/ lib/ app/ 2>/dev/null
```

### Checklist

```yaml
ai_safety:
  - no_eval_of_ai_output: true/false
  - ai_prs_are_draft: true/false
  - diff_size_limits_exist: true/false
  - no_dangerous_rendering: true/false
  - findings: []
  - fixes_applied: []
```

---

## Step 5: Client-Side Credential Handling (MEDIUM, ~5 minutes)

Skip if the repo has no frontend / no user-facing credential inputs.

### 5a — Storage audit

```bash
grep -rn 'localStorage\|sessionStorage' src/ lib/ app/ 2>/dev/null
```

For each credential stored: is it disclosed to the user? Is the input `type="password"`? Is it ever logged or sent to analytics?

### 5b — XSS prevention

```bash
grep -rn 'dangerouslySetInnerHTML\|innerHTML\|document\.write\|v-html\|\[innerHTML\]' src/ lib/ app/ 2>/dev/null
```

For each hit: is the content user-supplied? If so, is it sanitized?

### 5c — Network request audit

```bash
grep -rn 'fetch(\|axios\.\|\.post(\|\.get(\|requests\.\|HttpClient\|http\.Get' src/ lib/ app/ 2>/dev/null
```

Check: HTTPS enforced? Credentials in headers (not URLs)? Only sent to expected endpoints?

### Checklist

```yaml
client_credentials:
  - passwords_use_type_password: true/false
  - no_credentials_logged: true/false
  - no_unsafe_html_rendering: true/false
  - all_api_calls_use_https: true/false
  - credentials_only_sent_to_expected_endpoints: true/false
  - findings: []
  - fixes_applied: []
```

---

## Step 6: Infrastructure & Access Control (MEDIUM, ~5 minutes)

### 6a — Branch protection

```bash
# Check current state (requires gh CLI authenticated)
gh api repos/{owner}/{repo}/branches/{default_branch}/protection 2>/dev/null || echo "NOT PROTECTED"
```

If not protected, enable:

```bash
gh api repos/{owner}/{repo}/branches/{default_branch}/protection \
  --method PUT --input - <<< '{
    "required_status_checks": { "strict": true, "contexts": [] },
    "enforce_admins": false,
    "required_pull_request_reviews": { "required_approving_review_count": 1 },
    "restrictions": null
  }'
```

### 6b — CODEOWNERS

```bash
cat .github/CODEOWNERS 2>/dev/null || echo "MISSING"
```

If missing or incomplete, ensure `.github/workflows/` and other security-sensitive paths are covered.

### 6c — .gitignore completeness

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

### Checklist

```yaml
infrastructure:
  - branch_protection_enabled: true/false
  - requires_pr_review: true/false
  - codeowners_exists: true/false
  - codeowners_covers_workflows: true/false
  - gitignore_complete: true/false
  - findings: []
  - fixes_applied: []
```

---

## Step 7: Dependency Audit (LOW-MEDIUM, ~5 minutes)

```bash
# Node.js
npm audit 2>/dev/null

# Python
pip audit 2>/dev/null

# .NET
dotnet list package --vulnerable 2>/dev/null

# Go
govulncheck ./... 2>/dev/null

# Check lock file is committed
git ls-files --cached "package-lock.json" "yarn.lock" "pnpm-lock.yaml" "Pipfile.lock" "poetry.lock" "go.sum" "Cargo.lock"
```

### Checklist

```yaml
dependencies:
  - no_critical_vulnerabilities: true/false
  - lock_file_committed: true/false
  - findings: []
  - fixes_applied: []
```

---

## Step 8: Generate Audit Report & Commit

Create `docs/SECURITY-AUDIT-REPORT.md` in the target repo using this template:

```markdown
# Security Audit Report — [Project Name]

**Date:** YYYY-MM-DD
**Reviewer:** AI Agent (model: [name])
**Scope:** Full 7-phase security review
**Repository:** [owner/repo]
**Branch audited:** [branch name]

## Summary

| Phase | Status | Critical | High | Medium | Low |
|-------|--------|----------|------|--------|-----|
| Secret Scan | ✅/❌ | 0 | 0 | 0 | 0 |
| Workflow Injection | ✅/❌/⏭️ | 0 | 0 | 0 | 0 |
| AI Agent Safety | ✅/❌/⏭️ | 0 | 0 | 0 | 0 |
| Client Credentials | ✅/❌/⏭️ | 0 | 0 | 0 | 0 |
| Infrastructure | ✅/❌ | 0 | 0 | 0 | 0 |
| Dependencies | ✅/❌ | 0 | 0 | 0 | 0 |

Legend: ✅ = pass, ❌ = findings, ⏭️ = skipped (not applicable)

## Findings

### Critical (fix immediately)
1. [description] — [file:line] — [status: fixed/needs-manual-action]

### High (fix this sprint)
1. ...

### Medium (backlog)
1. ...

### Low (informational)
1. ...

## Fixes Applied in This Audit
1. [commit-message-style description of each fix]

## Manual Follow-ups Required
1. [anything the agent couldn't fix automatically — e.g., secret rotation, branch protection via UI]

## Recommendations
1. [forward-looking improvements]
```

### Commit

```bash
git checkout -b security/audit-YYYY-MM-DD
git add -A
git commit -m "security: complete security audit — [N] findings, [M] fixed

Phases completed:
- Secret scan: [pass/fail]
- Workflow injection audit: [pass/fail/skipped]
- AI agent safety: [pass/fail/skipped]
- Client credential handling: [pass/fail/skipped]
- Infrastructure & access control: [pass/fail]
- Dependency audit: [pass/fail]

Fixes applied: [brief list]
Manual follow-ups: [brief list or 'none']"

git push origin security/audit-YYYY-MM-DD
```

---

## Decision Principles

1. **Severity drives order** — always fix CRITICAL before HIGH before MEDIUM
2. **Rotate first, clean later** — if a secret is found, rotate it before removing from history
3. **Don't break the build** — security fixes must not introduce regressions; run the project's test suite after changes
4. **Document everything** — the audit report is as important as the fixes
5. **Flag what you can't fix** — some things need human action (secret rotation, provider console changes, branch protection UI); list them clearly
6. **Err on the side of caution** — if something looks like a credential, treat it as one until proven otherwise
