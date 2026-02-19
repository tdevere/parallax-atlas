---
applyTo: "**"
---

## Security policy

Follow the **Security and safety policy** in `.github/copilot-instructions.md`.

Key rules:
- Never hardcode API keys, tokens, passwords, or connection strings in source files.
- Never interpolate user-controlled input directly into shell commands in GitHub Actions workflows — use `env:` indirection.
- AI-generated code must never auto-deploy to production without human review.
- Never introduce `eval()`, `Function()`, `dangerouslySetInnerHTML`, or dynamic `<script>` injection.
- Never add, remove, or weaken authentication/authorization checks.
- No analytics or telemetry without explicit user consent.
- User credentials in localStorage must never be logged or sent to unintended endpoints.
- When in doubt, prefer the safer option and explain why.
