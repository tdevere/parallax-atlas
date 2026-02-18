# Parallax Atlas

An interactive knowledge-exploration app that maps humanity's deepest eras on a logarithmic timeline — from the Big Bang to today — and tracks your learning progress with personalized AI-driven lesson plans.

## Stack
- React 19 + TypeScript + Vite
- Tailwind CSS
- vis-timeline + vis-data
- Playwright for E2E testing

## Local development
1. Install dependencies:
   - `npm install`
2. Start dev server:
   - `npm run dev`
3. Build production bundle:
   - `npm run build`
4. Lint:
   - `npm run lint`
5. Preview production build:
   - `npm run preview`

## Bing Maps API key setup
1. Copy `.env.example` to `.env.local`.
2. Set `VITE_BING_MAPS_API_KEY` in `.env.local`.
3. Restart the dev server.

Environment variable used by app boot:
- `VITE_BING_MAPS_API_KEY`

Optional runtime override (before app boot):

```html
<script>
  window.__TIMELINE_VIEWER_CONFIG__ = {
    bingMapsApiKey: 'YOUR_BING_MAPS_KEY'
  }
</script>
```

If you are already authenticated in Azure CLI, you can keep secrets out of git by setting the key via shell env before starting Vite:
- PowerShell: `$env:VITE_BING_MAPS_API_KEY = '<your-key>'; npm run dev`

## Testing
- Install Playwright browser once:
  - `npm run test:e2e:install`
- Run E2E tests (default test command):
  - `npm run test`
  - `npm run test:e2e`
- Run headed E2E mode:
  - `npm run test:e2e:headed`
- Open HTML report after a run:
  - `npm run test:e2e:report`

### Current E2E coverage
- Timeline item click enters focused timeline context and returns to full view.
- First-selection onboarding tip appears and then clears after entering focus mode.
- Sidebar slider progress persists via `localStorage` after refresh.
- Export button triggers `parallax-atlas-progress.json` download.
- Mobile controls toggle sidebar visibility.
- Malformed `localStorage` progress falls back safely to defaults.

## Core architecture notes
- App state is centralized in `src/App.tsx`:
  - `progress: Record<string, number>`
  - `selectedEra: Era | null`
  - `sidebarOpen: boolean`
- Canonical era metadata and formatting/color helpers live in `src/data/timeline-data.ts`.
- Timeline rendering and logarithmic axis conversion are in `src/components/Timeline.tsx`.
- Selecting an era shifts into a focused, zoomed group context with Previous/Next/Back timeline navigation.
- Focus mode shows breadcrumb orientation, position (current/total), and start/end edge messages.

## Viewer modes and context loading
- `default-context` (default): bundled eras + `localStorage` persistence.
- `no-context`: viewer-only mode with no persisted prior context.
- `provided-context`: caller-supplied eras/progress/context (in-memory by default).

Subject packs for runtime loading are served from:
- `public/subject-packs/index.json` (manifest)
- `public/subject-packs/*.json` (pack payloads)
- Invalid or missing pack payloads automatically fall back to built-in timeline data with a visible warning banner.
- Runtime notices are severity-aware (warning/error) and can be dismissed per notice.
- If no packs are available, the app shows an empty-state hint and continues in built-in mode.
- If the manifest is malformed or unavailable, the app shows an explicit warning and continues in built-in mode.

Built-in sample pack:
- `world-history-survey` (`public/subject-packs/world-history-survey.json`)
- `quantum-physics-survey` (`public/subject-packs/quantum-physics-survey.json`)

Use query mode switch:
- `?viewerMode=default-context`
- `?viewerMode=no-context`
- `?viewerMode=provided-context`

Load a subject pack:
- `?viewerMode=provided-context&subjectPack=world-history-survey`
- `?viewerMode=provided-context&subjectPack=quantum-physics-survey`
- `?viewerMode=provided-context` without `subjectPack` will show a warning and fall back to built-in mode.

Non-developer runtime switching:
- Use the **Context** dropdown in the top bar to switch between built-in, no-context, and available subject packs.
- Use the top-bar mode/pack badge to confirm the currently active runtime context.
- Use the side handle (`<<`) on the sidebar edge to collapse controls on desktop.
- Use the side handle (`>>`) on the left edge of the timeline area to expand controls again.

Inject provided context before app boot:

```html
<script>
  window.__TIMELINE_VIEWER_CONFIG__ = {
    mode: 'provided-context',
    providedContext: {
      persistence: 'memory',
      eras: [
        {
          id: 'example-era',
          content: 'Example Era',
          start: 1000,
          end: 100,
          group: 'Custom',
          description: 'Injected context example.'
        }
      ],
      progress: { 'example-era': 30 }
    }
  }
</script>
```

## CI
- GitHub Actions workflow: `.github/workflows/ci.yml`
- Pipeline runs:
  - `npm ci`
  - `npm run lint`
  - `npm run build`
  - `npm run test:e2e`

## Demo runbook and troubleshooting

### Recommended demo sequence (5-7 minutes)
1. Start in default mode (`/`) and confirm baseline eras are visible (for example, Big Bang).
2. Click a timeline item to enter focus mode; demonstrate Previous/Next/Back navigation.
3. Change 1-2 progress values in sidebar and show immediate percentage updates.
4. Refresh page in default mode and confirm progress persistence.
5. Switch to no-context mode (`?viewerMode=no-context`) and confirm persisted default data is not applied.
6. Switch to provided pack mode (`?viewerMode=provided-context&subjectPack=world-history-survey` or `quantum-physics-survey`).
7. Export JSON and confirm download filename `parallax-atlas-progress.json`.

### Quick verification checklist
- Header mode/pack badge matches expected runtime context.
- Focus breadcrumb and position indicator appear after timeline selection.
- Sidebar collapse/expand handles (`<<` and `>>`) work on desktop.
- Warning banner appears for invalid/missing subject-pack query.
- Warning notices can be dismissed without affecting loaded timeline data.
- Warning banner appears when subject-pack manifest JSON is malformed.

### Common issues
- **Subject pack does not load**
  - Check `public/subject-packs/index.json` has the pack entry and correct file name.
  - Open URL with query: `?viewerMode=provided-context&subjectPack=<pack-id>`.
  - If payload is invalid, app should show warning and fall back to built-in timeline.
  - If manifest has malformed entries, app ignores invalid entries and keeps valid packs available.
  - If manifest JSON is malformed, app warns that the manifest is invalid JSON and keeps built-in options active.

- **Provided context does not activate from URL**
  - Ensure both query values are present: `viewerMode=provided-context` and `subjectPack=<pack-id>`.
  - If `subjectPack` is missing, app intentionally warns and falls back to built-in timeline.

- **E2E appears to hang after failures**
  - This repo uses HTML report with `open: 'never'`; failed runs should exit.
  - Open report manually with `npm run test:e2e:report`.

- **Unexpected persisted progress in default mode**
  - Clear browser localStorage key `knowledge-timeline-progress` and reload.

- **No-context mode still looks like default data**
  - This is expected for era content (built-in eras still render).
  - Difference is persistence policy: no-context ignores prior saved progress.

- **`copilot-auto` fails with `unknown option '--no-warnings'` (often on runners)**
  - Treat this as CLI compatibility mismatch, not app-code failure.
  - Log versions first (`copilot-auto`, Node, OS).
  - Remove unsupported CLI flags and rerun with minimal command.
  - If warning suppression is needed on CI/runners, set `NODE_NO_WARNINGS=1` at environment level.
  - Then continue normal checks: `npm run lint`, `npm run build`, `npm run test:e2e`.

## Parallel autonomous execution (copilot-auto)

For faster delivery, run multiple autonomous streams in parallel with scoped file ownership.

- Planning doc: `AGENT-PARALLEL.md`
- Launcher script (PowerShell): `scripts/run-parallel-agents.ps1`

Example:
- `pwsh -File scripts/run-parallel-agents.ps1`

Recommended practice:
- One stream per branch/worktree.
- Merge one stream at a time.
- After each merge run: `npm run lint; npm run build; npm run test:e2e`.
