# Agent Briefing: Repository Onboarding

> **Format:** Machine-readable task specification for AI coding agents.
> **Source repo:** [parallax-atlas](https://github.com/tdevere/parallax-atlas) (branch: `feature/progressive-map`)
> **Guide file:** `docs/CROSS-REPO-ONBOARDING.md`
> **Security playbook:** `docs/SECURITY-REVIEW-PLAYBOOK.md`
> **Bootstrap script:** `scripts/bootstrap-repo.mjs`

---

## Task Definition

```yaml
goal: Onboard a target repository with security infrastructure, agent profiles, and CI quality gates
input: A locally cloned target repository
output: A commit (or PR) adding all infrastructure files and a completed security audit
time_budget: 60-90 minutes
```

---

## Execution Steps

### Step 1: Reconnaissance (read-only)

Read the target repo to understand:
- **Stack:** What languages, frameworks, package managers are present?
- **Tests:** What test framework(s) exist? Where do tests live?
- **CI:** Is there an existing workflow? What does it run?
- **Auth:** How does the app handle authentication/authorization?
- **Secrets:** What environment variables / config files does it use?
- **Default branch:** `main` or `master` or other?
- **Owner:** GitHub username that should go in CODEOWNERS.

Capture these as structured facts before proceeding.

### Step 2: Run Bootstrap Script

```bash
# From the parallax-atlas clone
node scripts/bootstrap-repo.mjs --repo <absolute-path-to-target> --owner <github-username> --dry-run
```

Review the dry-run output. If it looks correct:

```bash
node scripts/bootstrap-repo.mjs --repo <absolute-path-to-target> --owner <github-username>
```

### Step 3: Security Audit

Execute the secret scan, workflow injection audit, and auto-deploy audit commands from Phase 2 of `docs/CROSS-REPO-ONBOARDING.md`. Fix any findings before continuing.

### Step 4: Fill copilot-instructions.md

Open the generated `.github/copilot-instructions.md` in the target repo. Replace all `TODO` sections with real project knowledge gathered in Step 1:

1. **Project snapshot** — stack, purpose, core files
2. **Architecture and data flow** — state management, API patterns, data models
3. **Code patterns to preserve** — naming, imports, error handling
4. **Testing guidance** — frameworks, commands, coverage targets
5. **Developer workflows** — install, dev, build, test, deploy commands

### Step 5: Create Domain Agents

Based on the codebase, create 1–3 additional agent profiles under `.github/agents/`. Use the structural template from `docs/CROSS-REPO-ONBOARDING.md` Phase 4. Every agent must include a Security obligations section.

### Step 6: Infrastructure Hardening

- Enable branch protection on the default branch (require PR review, status checks)
- Verify CODEOWNERS paths match actual sensitive file locations
- Verify .gitignore covers credential patterns

### Step 7: Validate

Run all quality gates:
```bash
# Adjust these to the target repo's actual commands
npm run lint    # or pylint, flake8, etc.
npm run build   # or python -m build, dotnet build, etc.
npm run test    # or pytest, dotnet test, etc.
```

Verify the validation checklist from `docs/CROSS-REPO-ONBOARDING.md`.

### Step 8: Commit

```bash
cd <target-repo>
git checkout -b infrastructure/agent-onboarding
git add .github/ docs/ .gitignore
git commit -m "feat: add AI agent infrastructure, security policy, and CI quality gates

- Security instructions (universal Copilot policy)
- CODEOWNERS for security-sensitive paths
- Project-specific copilot-instructions.md
- Agent profiles: QA Engineer, Orchestrator, [domain agents]
- CI workflow (if created)
- Security audit: [summary of findings/fixes]"
git push origin infrastructure/agent-onboarding
```

---

## Decision Principles

When making choices during onboarding:

1. **Security first** — if a finding is ambiguous, treat it as a vulnerability
2. **Don't over-engineer** — generate the minimum viable infrastructure, not everything at once
3. **Preserve existing patterns** — if the repo already has conventions, document them rather than replacing them
4. **Skip what exists** — never overwrite existing files; augment or leave alone
5. **Record decisions** — add an AI decision log section to copilot-instructions.md for non-trivial choices

---

## Success Criteria

The onboarding is complete when:

1. No secrets in tree or git history
2. No workflow injection vulnerabilities
3. No AI auto-deploy paths without human review
4. Security policy exists and is referenced by all agents
5. copilot-instructions.md has real project knowledge (no TODOs)
6. At least 3 agent profiles exist with security obligations
7. Branch protection is enabled
8. All quality gates pass
