param(
  [string]$Model = 'gpt-5.3-codex'
)

$root = 'c:\Users\TempAdmin\repos\knowledge-timeline-map'

$prompts = @(
  @{
    Name = 'A-NoticesUX'
    Prompt = 'read this directory, understand the project; then follow instructions in AGENT.md; do not interrupt; implement runtime notice UX polish in App (severity-aware warning/error styles, dismiss button, non-intrusive layout); update/add E2E coverage for dismiss behavior and warning visibility; update docs/instructions if behavior changes; run lint/build/test:e2e; report files changed and validation output'
  },
  @{
    Name = 'B-TimelinePolish'
    Prompt = 'read this directory, understand the project; then follow instructions in AGENT.md; do not interrupt; improve focus-mode feel (subtle motion timing, clearer active selection treatment, optional onboarding hint for first selection) without changing data model; keep selectors resilient; update tests for user-observable outcomes; run lint/build/test:e2e; report files changed and validation output'
  },
  @{
    Name = 'C-PackResilience'
    Prompt = 'read this directory, understand the project; then follow instructions in AGENT.md; do not interrupt; harden subject-pack loading UX/resilience for edge cases (maintain fallback behavior, improve user-visible messaging where useful), extend E2E for at least one additional manifest/payload edge case, and update docs/instructions/decision log; run lint/build/test:e2e; report files changed and validation output'
  }
)

foreach ($item in $prompts) {
  $cmd = "Set-Location '$root'; copilot-auto --model $Model -p '$($item.Prompt)'"
  Start-Process -FilePath 'pwsh' -ArgumentList '-NoExit', '-Command', $cmd -WindowStyle Normal
  Write-Host "Started stream: $($item.Name)"
}

Write-Host 'All parallel copilot-auto streams launched.'
