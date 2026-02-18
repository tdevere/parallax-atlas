# Parallel `copilot-auto` execution plan

Use this to run multiple autonomous agents at once with minimal merge conflicts.

## Goal
Maintain a fallback parallel plan, but prefer a single consolidated autonomous stream until coverage/priorities are rebaselined.

## Current execution preference
- Preferred now: one consolidated stream (lower merge churn, clearer validation ownership).
- Use parallel streams only when there is strong file-scope isolation and active backlog pressure.

## Consolidated stream prompt (preferred)
read this directory, understand the project; then follow instructions in AGENT.md; do not interrupt; prioritize reliability/coverage work first: (1) strengthen E2E for injected `window.__TIMELINE_VIEWER_CONFIG__` provided-context boot behavior, (2) strengthen E2E for context-selector journey and active mode/pack status visibility, (3) update planning/docs to keep P0/P1/P2 current; run lint/build/test:e2e; report files changed and validation output

## Guardrails
- Each agent must follow `AGENT.md` and `.github/copilot-instructions.md`.
- One agent per workstream branch/worktree.
- No shared file editing across streams unless explicitly coordinated.
- Every stream runs: `npm run lint; npm run build; npm run test:e2e` before handoff.

## Workstream A — Runtime notices UX polish
**Scope:** `src/App.tsx`, `src/index.css`, `tests/e2e/timeline.spec.ts`

Prompt:
read this directory, understand the project; then follow instructions in AGENT.md; do not interrupt; implement runtime notice UX polish in App (severity-aware warning/error styles, dismiss button, non-intrusive layout); update/add E2E coverage for dismiss behavior and warning visibility; update docs/instructions if behavior changes; run lint/build/test:e2e; report files changed and validation output

## Workstream B — Timeline interaction polish
**Scope:** `src/components/Timeline.tsx`, `src/App.tsx`, `src/index.css`, `tests/e2e/timeline.spec.ts`

Prompt:
read this directory, understand the project; then follow instructions in AGENT.md; do not interrupt; improve focus-mode feel (subtle motion timing, clearer active selection treatment, optional onboarding hint for first selection) without changing data model; keep selectors resilient; update tests for user-observable outcomes; run lint/build/test:e2e; report files changed and validation output

## Workstream C — Subject-pack resilience + docs
**Scope:** `src/viewer/pack-loader.ts`, `tests/e2e/timeline.spec.ts`, `README.md`, `.github/copilot-instructions.md`

Prompt:
read this directory, understand the project; then follow instructions in AGENT.md; do not interrupt; harden subject-pack loading UX/resilience for edge cases (maintain fallback behavior, improve user-visible messaging where useful), extend E2E for at least one additional manifest/payload edge case, and update docs/instructions/decision log; run lint/build/test:e2e; report files changed and validation output

## Workstream D — Learner-delight UI designer
**Scope:** `src/App.tsx`, `src/components/ProgressSidebar.tsx`, `src/components/Timeline.tsx`, `src/index.css`, `tests/e2e/timeline.spec.ts`, `AGENT-UI-DESIGNER.md`

Prompt:
read this directory, understand the project; then follow AGENT-UI-DESIGNER.md; do not interrupt; implement motivation-first learner UI polish with small reversible changes, reinforce interactive feedback, and keep runtime behavior unchanged; update resilient user-observable E2E assertions; run lint/build/test:e2e; report files changed and validation output

## Suggested orchestration command (manual)
Run each stream in its own terminal from its own branch/worktree:

- `copilot-auto --model gpt-5.3-codex -p "<Workstream A prompt>"`
- `copilot-auto --model gpt-5.3-codex -p "<Workstream B prompt>"`
- `copilot-auto --model gpt-5.3-codex -p "<Workstream C prompt>"`

Then merge streams one by one, rerunning full validation after each merge.

Compatibility note:
- If a runner invocation fails with `unknown option '--no-warnings'`, remove that flag and rerun.
- If warning suppression is still required on GitHub runners, prefer `NODE_NO_WARNINGS=1` in runner environment settings.
