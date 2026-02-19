# Copilot Instructions for parallax-atlas

> These instructions guide GitHub Copilot and its coding agent when working on this repository. They cover code style, architecture, testing practices, and development workflows specific to this project.

## Project snapshot
- Stack: React 19 + TypeScript + Vite + Tailwind CSS + vis-timeline + Radix Slider.
- App purpose: visualize major eras (cosmology → human history) on a logarithmic time axis and track per-era learning progress.
- Core files: `src/App.tsx`, `src/components/Timeline.tsx`, `src/components/ProgressSidebar.tsx`, `src/components/EraDetailModal.tsx`, `src/data/timeline-data.ts`, `tests/e2e/timeline.spec.ts`.
- Runtime subject-pack files: `src/viewer/pack-loader.ts`, `public/subject-packs/index.json`, `public/subject-packs/*.json`.

## Architecture and data flow
- Single state owner: `App` holds `progress`, `selectedEra`, and `sidebarOpen`.
- Runtime behavior is resolved via viewer context modules:
  - `src/viewer/types.ts`
  - `src/viewer/context.ts`
  - `src/viewer/progress-store.ts`
  - `src/viewer/pack-loader.ts`
- `progress` shape is `Record<string, number>` keyed by `Era.id`.
- Viewer supports three boot modes:
  - `default-context` (built-in eras + localStorage persistence)
  - `no-context` (no prior persisted context)
  - `provided-context` (caller-provided eras/progress/context)
- Provided packs can be loaded dynamically from `public/subject-packs` via query (`subjectPack`) and switched from the header context selector.
- Pack payloads are validated at runtime; invalid/missing packs fall back to built-in timeline with warning notices.
- Empty/missing pack manifests surface warnings and retain built-in timeline behavior.
- Malformed manifest entries are ignored with explicit warning notices while valid packs remain available.
- `ProgressSidebar` updates progress via `onChange(id, value)` and exports JSON via `onExport`.
- Sidebar supports mobile open/close and desktop collapse/expand from header controls.
- `Timeline` renders vis.js items/groups from `eras` + `progress`; selecting an item triggers focus mode (`onSelectEra`) and timeline zoom.
- Focus mode narrows timeline/sidebar context to the selected group and shows in/out/around navigation controls.

## Timeline-specific implementation rules
- Keep logarithmic mapping helpers in sync in `Timeline.tsx`:
  - `yearsAgoToDate(yearsAgo)`
  - `dateToYearsAgo(date)`
- Vis timeline item colors must come from `colorForProgress()` in `timeline-data.ts`.
- Axis labels use `formatYearsAgo()`; preserve this for consistent “Bya/Mya/ya/Today” formatting.

## Styling conventions
- Prefer Tailwind utility classes in TSX.
- Global base/theme + vis-timeline overrides live in `src/index.css`.
- If editing vis-timeline visuals, change `src/index.css` (`.vis-*` rules), not inline component styles unless dynamic.

## Developer workflows
- Install deps: `npm install`
- Dev server: `npm run dev`
- Production build: `npm run build` (runs `tsc -b && vite build`)
- Lint: `npm run lint`
- Preview build: `npm run preview`
- E2E tests (default): `npm run test` or `npm run test:e2e`
- E2E headed mode: `npm run test:e2e:headed`
- Install Playwright browser: `npm run test:e2e:install`
- View HTML report: `npm run test:e2e:report`
- CI workflow: `.github/workflows/ci.yml` (lint + build + Playwright E2E)
- Parallel autonomous planning doc: `AGENT-PARALLEL.md`
- Parallel launcher script: `scripts/run-parallel-agents.ps1`

### Branching strategy (environment-promotion)
- **Branch model:** `feature/*` → `dev` → `uat` → `main`
- **`main`** — production-ready code. Deploys to Azure SWA. Protected: PR required (1 reviewer), status checks, no force push, no deletion.
- **`uat`** — staging / QA validation. Protected: PR required, status checks. PRs to `main` generate SWA preview environments.
- **`dev`** — integration branch. All feature branches merge here first. CI runs on push.
- **`feature/*`** — individual work branches. CI runs on PR to any target.
- AI-generated PRs from issue-evaluation always target `dev` (never `main` or `uat`).
- Promotion path: `dev` → PR to `uat` → PR to `main`. Never skip a tier.
- Production deploy only triggers on push to `main` (after PR merge).

### Runner/CLI compatibility fallback
- If `copilot-auto` (or related runner tooling) fails with `unknown option '--no-warnings'`, treat it as a CLI version compatibility issue, not a product-code failure.
- First capture environment details in logs (CLI version + Node version + OS).
- Remove unsupported flags and rerun with the minimal compatible command.
- If warning suppression is still required on CI/GitHub runners, prefer environment-level suppression (`NODE_NO_WARNINGS=1`) over unsupported CLI flags.
- After command repair, continue normal validation gates (`npm run lint`, `npm run build`, `npm run test:e2e`) and report results.

## Security and safety policy

**Every agent, workflow, and automation in this repo must follow these rules. No exceptions.**

### Secrets and credentials
- **Never hardcode** API keys, tokens, passwords, client secrets, or connection strings in source files.
- Secrets belong in GitHub Secrets (for workflows), `.env.local` (for local dev, gitignored via `*.local`), or browser localStorage (user-owned keys only).
- `.env.example` may contain placeholder variable names but **never real values**.
- If you discover a committed secret, treat it as compromised: rotate it immediately, then remove from history with `git filter-repo` or BFG.
- Audit: run `git log --all -p -S '<suspected-key>'` to confirm whether a value was ever committed.

### Workflow injection prevention
- **Never interpolate user-controlled input** (`github.event.issue.title`, `github.event.issue.body`, PR titles, commit messages) directly into `run:` shell blocks via `${{ }}`.
- Pass untrusted values through `env:` first, then reference as `"$ENV_VAR"` in shell. This prevents command injection.
- Use `actions/github-script` with proper escaping for dynamic GitHub API calls.
- Workflow `permissions:` should follow least-privilege — only request what the job actually needs.

### AI-generated code safety
- AI-generated code (from `resolve-issue.mjs` or any future agent) must **never auto-deploy to production** without human review.
- Automated PRs from AI agents should be created as **draft PRs** or require explicit approval before merge.
- Quality gates (lint, build, E2E) are necessary but not sufficient — they catch syntax and known regressions, not novel security issues or logic errors.
- AI agents must not generate code that introduces new `eval()`, `Function()`, `dangerouslySetInnerHTML`, or dynamic `<script>` injection.
- AI agents must not add, remove, or weaken authentication/authorization checks.

### User data protection
- User API keys (LessonLauncher) are stored in localStorage with clear disclosure. They are never logged, telemetered, or sent to any endpoint other than the user's chosen AI provider.
- Progress data in localStorage is user-owned. Export produces a local file download — no server upload.
- No analytics, tracking, or telemetry SDKs without explicit user consent and decision-log entry.

### Automation scope limits
- `workflow_dispatch` workflows must not include `auto_merge` + `deploy` paths that bypass human review.
- Any workflow that creates PRs must make them reviewable (not auto-merged) by default.
- Autonomous agent loops (AGENT.md) operate locally and require manual `git push` — they do not have direct production access.
- Branch protection rules on `main` and `master` should require PR review before merge.

### Agent-specific obligations
- Every agent profile (`.github/agents/*.agent.md`, root-level `AGENT*.md`) must reference this security policy.
- Agents must refuse requests to: disable security checks, expose secrets, bypass review gates, or auto-deploy untested changes.
- When in doubt, prefer the safer option and explain why.

## Code patterns to preserve
- Use explicit exported types from data modules (`Era`) rather than duplicating interfaces.
- Keep IDs stable in `eras`; progress persistence depends on exact `id` strings.
- When adding eras, include `id`, `content`, `start`, `end`, `group`; add `description` for modal UX.
- Use functional state updates in React handlers (example: `setProgress((current) => ({ ...current, [id]: value }))`).
- Maintain strict TypeScript compatibility (project has `strict`, `noUnusedLocals`, `noUnusedParameters`).
- For long-lived behavior checks, prefer Playwright E2E over brittle DOM-only unit tests for vis-timeline interactions.

## Testing guidance (project-specific)
- High-value coverage targets:
  - Timeline item selection enters focus mode with navigation controls.
  - Progress changes in `ProgressSidebar` persist via `localStorage`.
  - Export button triggers `parallax-atlas-progress.json` download.
  - `no-context` mode does not depend on localStorage state.
  - `provided-context` mode can render caller-supplied eras.
  - Query-driven provided pack loading renders pack-specific eras.
  - Caller-injected `window.__TIMELINE_VIEWER_CONFIG__` provided-context renders custom eras/progress and initial focused selection.
  - Header context selector can switch runtime mode/pack.
  - Header mode/pack status reflects default → no-context → provided-context transitions.
  - Provided-context mode without `subjectPack` warns and falls back safely.
  - Invalid subject-pack query falls back safely to built-in timeline with a visible warning.
  - Invalid subject-pack payload schema falls back safely with a visible warning.
  - Empty subject-pack manifest shows warning and keeps built-in options available.
  - Malformed subject-pack manifest JSON falls back safely with a visible warning.
  - Malformed manifest entries are ignored while valid packs continue to load.
  - Desktop collapse control hides/shows the sidebar without affecting timeline data.
- Additional E2E coverage includes mobile sidebar toggle and malformed `localStorage` fallback behavior.
- In Playwright tests, prefer resilient selectors and user-observable outcomes over precise vis item geometry.
- Keep E2E tests focused on user-observable outcomes (modal visibility, percentage text, downloads), not vis internals.

## Demonstration agent playbook

### Purpose
- Deliver clear, reproducible demos of timeline navigation, focus mode, progress tracking, and context switching.
- Prioritize user-visible behavior over internal implementation details.
- Keep demos grounded in current app behavior and testable outcomes.

### Demo flow
- Start in default mode and verify baseline timeline + sidebar state.
- Select an era to enter focus mode and demonstrate Previous/Next/Back timeline controls.
- Change progress in sidebar and confirm visible updates.
- Show mode switching: default → no-context → provided-context pack.
- End with export flow and concrete “next to explore” recommendations.

### Interaction style
- Keep narration short, concrete, and step-based.
- State intent before each action (for example persistence check, then pack switch check).
- If behavior fails, report impact first, then likely cause, then next action.

### Accuracy and reliability
- Do not claim behavior unless observed in app or verified by tests.
- Separate facts from assumptions.
- Avoid hype/competitor framing in implementation notes; keep guidance practical.
- Prefer observable checks over speculative claims.

### Demo verification gate
- Before sign-off, run: `npm run lint; npm run build; npm run test:e2e`.
- Keep assertions resilient and user-facing in `tests/e2e/timeline.spec.ts`.
- Update this file when navigation, context-loading, or sidebar UX changes.

## AI decision log requirement
- When making non-trivial decisions (architecture, dependency, test strategy, data model, styling policy), record:
  - what changed,
  - why this option was chosen,
  - alternatives considered.
- Update this file (or linked docs) in the same PR so future agents can follow prior reasoning.
- Current recorded decisions:
  - Playwright is the primary test framework because core UX depends on vis-timeline browser behavior that is better validated in real browser E2E flows (chosen over jsdom-first testing).
  - E2E assertions should prioritize user-observable outcomes (modal open/close, persisted percentages, downloads) over exact vis item positions because vis range items can overlap and make target-specific clicks brittle.
  - `Timeline` axis label conversion accepts `Date | number | string` to match vis callback payloads and avoid runtime crashes from assuming a strict `Date`.
  - Playwright HTML reporter is configured with `open: 'never'` so failed `npm run test:e2e` runs exit cleanly instead of blocking the terminal; reports remain available through `npm run test:e2e:report`.
  - Playwright uses `line` + HTML reporters together so CI/local logs stay readable in terminal while retaining artifact reports.
  - CI runs Playwright E2E (not unit tests) to validate real browser behavior of vis-timeline interactions.
  - Viewer context and persistence policy are separated from subject data so the timeline can load with no context, default context, or provided context.
  - Timeline selection no longer writes progress directly; updates remain in sidebar/app state pathways to keep control responsibilities explicit.
  - Subject packs are loaded through static JSON manifest/payloads so non-developers can add or swap learning domains without code changes.
  - Sidebar visibility controls are treated as viewer UI state, separate from subject-pack content and progress data.
  - Desktop sidebar expansion is exposed as a side-mounted handle so users can discover recovery after collapsing controls.
  - Desktop sidebar collapse is also exposed on the sidebar edge (not just header) to keep the interaction local to the panel.
  - Timeline selection uses zoomed focus context (not modal popups) so learners can navigate temporally within a subject slice.
  - Added a demo playbook and prioritized backlog in this file to standardize walkthrough quality and reduce ad-hoc demo drift.
  - Focus mode now includes breadcrumb orientation, position indicators, and start/end edge-state messaging so timeline navigation remains clear while moving in/out/around.
  - Added active mode/pack status near the selector so users can quickly confirm current runtime context while switching views.
  - Added subject-pack schema validation + warning fallback so bad pack payloads fail safely to built-in timeline instead of breaking runtime flow.
  - Added a second non-history sample pack (`quantum-physics-survey`) to demonstrate cross-domain runtime context switching.
  - Added a demo runbook/troubleshooting section in `README.md` to standardize walkthrough execution and speed up issue triage.
  - Added `AGENT.md` with an autonomous continuation loop so personal coding agents can proceed in uninterrupted, validated increments.
  - Added explicit Vite `manualChunks` that split `vis-timeline` graph2d, timeline core, and `moment` into separate vendor chunks to remove >500k bundle warnings (chosen over raising `chunkSizeWarningLimit`, which would only hide the warning).
  - Added boot-time loading and subject-pack empty-state warnings so context-loading behavior is explicit instead of silent fallback.
  - Added malformed-manifest entry warnings so bad pack entries are visible and safely ignored rather than silently dropped.
  - Runtime notices in `App` are severity-aware and dismissible so warning/error feedback stays visible but non-intrusive.
  - Added parallel `copilot-auto` orchestration guidance (`AGENT-PARALLEL.md` + script launcher) to speed delivery while keeping file-scope boundaries explicit.
  - Focus mode now uses short eased timeline animations, stronger selected-era highlighting in both timeline/sidebar, and a dismissible first-selection hint to improve orientation without changing the data model.
  - Added explicit malformed manifest JSON warnings so manifest parse failures are distinguishable from intentionally empty pack lists.
  - Standardized autonomous-runner fallback for `unknown option '--no-warnings'`: remove unsupported CLI flags, prefer environment-based warning suppression on runners, and continue quality gates.
  - Prioritized reliability-first autonomous cycles (coverage before UX polish) to reduce regression risk while architecture continues to evolve.
  - Preferred a consolidated autonomous stream over parallel streams for the current cycle to reduce merge churn and keep validation ownership clear.
  - Added a dedicated `AGENT-UI-DESIGNER.md` profile to drive motivation-first, learner-delight UI iterations with explicit guardrails and validation gates (chosen over ad-hoc prompt text, which was less repeatable).
  - Shifted to a coach-first mission panel in `App` (recommended era + why-it-matters + next 10-minute action) so primary value is guided learning, not control-heavy timeline operations (chosen over style-only polish, which improved visuals but not learner utility).
  - Added continuity CTAs (sidebar Focus actions, resume-last-focus, and focus-mode jump-to-recommended-era) to prevent drill-in dead ends while preserving group-focus architecture (chosen over removing focus scoping entirely, which would reduce orientation clarity).
  - Added explicit interaction-state types (`SubgraphSortMode`, `GhostLayerMode`, `ZoomBand`) so recursive drill/ghost/zoom features can evolve without coupling to component-local strings.
  - Implemented ghost prerequisites as interactive vis items that invoke jump-to-context callbacks (chosen over non-clickable overlays, which would fail continuity expectations).
  - Added an `ai-genesis-history` stress-test pack with recursive nodes, cross-track prerequisites, and high-density AI milestones to validate drill-down + prerequisite-order sorting + ghost jumps under realistic complexity.
  - Added conditional return-to-origin chip near zoom status that snapshots era + zoom context before ghost jumps and restores both on return (chosen over adding another global breadcrumb row, which would add header clutter).
  - Focus mode now keeps all track labels visible while collapsing non-active tracks to thin label bars, preserving orientation without visual distraction from off-track items.
  - Timeline axis now adapts tick scale (`year`/`month`/`day`) from zoom band plus local data density; micro drill contexts use relative labels (`t0`, `+Ny`, `+Nmo`, `+Nd`) instead of static absolute ticks.
  - Added a subtle drill-context chip near zoom status (`Drill t0: <era>`) to indicate re-zero anchor location without introducing additional navigation rows.
  - Added a guided first-run welcome experience in the coach panel when all progress is 0%: warm greeting, Quick Start CTA (selects recommended era + completes first mission step), and subject-pack suggestion cards (chosen over defaulting new users to a specific pack via URL redirect, which would break existing E2E tests and add redirect complexity).
  - Added `AGENT-LEAD-DESIGNER.md` as a combined design + development + business engagement agent profile with prioritized Tier 1–3 backlog (chosen over expanding the existing UI Designer profile, which has a narrower visual-polish scope).
  - Added comprehensive security and safety policy to copilot-instructions (single source of truth) and referenced it from all 9 agent profiles. Fixed command injection vulnerability in issue-evaluation.yml where `github.event.issue.title` and `github.event.issue.body` were interpolated directly into shell `run:` blocks — moved to `env:` indirection. Converted AI auto-resolve PRs from auto-merge to draft PRs requiring human review, per policy that AI-generated code must not auto-deploy without review. Chosen over keeping auto-merge because quality gates (lint/build/E2E) are necessary but not sufficient to catch security issues or logic errors in AI-generated code.

## File naming and organization
- Use PascalCase for React component files: `Timeline.tsx`, `ProgressSidebar.tsx`
- Use kebab-case for utility/config files: `timeline-data.ts`, `pack-loader.ts`
- Place React components in `src/components/`
- Place data/types/utilities in `src/data/`, `src/viewer/`, or top-level `src/`
- Place E2E tests in `tests/e2e/` with `.spec.ts` extension
- Place subject packs in `public/subject-packs/` with `.json` extension

## Commit and PR guidelines
- Write clear, descriptive commit messages in present tense
- Focus commits on single logical changes
- Reference issue numbers in commits when applicable (e.g., "Fix #123: ...")
- Keep PRs focused and atomic - one feature/fix per PR
- Ensure all tests pass before submitting PR
- Run `npm run lint` and fix any issues before committing
- Update relevant documentation when changing APIs or behavior

## Security guidelines
- Never commit API keys, secrets, or credentials to git
- Use environment variables for sensitive configuration (see `.env.example`)
- Validate all user inputs and external data (e.g., subject pack JSON)
- Sanitize data before rendering in UI to prevent XSS
- Use TypeScript strict mode to catch type-related security issues
- Review dependencies for known vulnerabilities before adding

## Dependency management
- Prefer existing dependencies over adding new ones
- Before adding a new dependency:
  - Check if existing dependencies can solve the problem
  - Verify the package is actively maintained
  - Check for known security vulnerabilities
  - Consider bundle size impact
- Use exact versions in `package.json` for critical dependencies
- Document why new dependencies were added in the AI decision log
- Run `npm audit` to check for vulnerabilities after adding dependencies

## Known repo context
- `src/App.css` appears to be template leftover; active styling is primarily in `src/index.css` + Tailwind classes.
- `AGENT.md` contains an autonomous continuation prompt for personal coding-agent workflows.
- `AGENT-PARALLEL.md` contains scoped multi-stream prompts for parallel autonomous execution.
- `AGENT-UI-DESIGNER.md` contains a specialized profile for high-impact learner engagement and visual polish cycles.

## AGENT BEHAVIOR INSTRUCTIONS
- Complete as much work as possible, choosing wisest next steps, without stopping to ask for confirmation.
- Only stop to ask when truly blocked by ambiguity that could lead to destructive or incorrect behavior.
- When stopping, clearly explain the ambiguity and what information is needed to proceed safely.
- When making non-trivial decisions, record what changed, why it was chosen, and alternatives considered in the AI decision log section above.
