import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadRuntimeViewerConfig, updateViewerQuery } from './viewer/pack-loader'
import type { TimelineViewerConfig } from './viewer/types'

declare global {
  interface Window {
    __TIMELINE_VIEWER_CONFIG__?: TimelineViewerConfig
  }
}

const root = createRoot(document.getElementById('root')!)

root.render(
  <StrictMode>
    <div className="flex min-h-screen items-center justify-center px-4 text-sm text-slate-300">Loading timeline context...</div>
  </StrictMode>,
)

const bootstrap = async () => {
  const baseConfig: TimelineViewerConfig = {
    ...window.__TIMELINE_VIEWER_CONFIG__,
  }
  const envBingMapsApiKey = (import.meta.env.VITE_BING_MAPS_API_KEY ?? '').trim()
  const runtimeBingMapsApiKey = baseConfig.bingMapsApiKey?.trim() ?? ''
  const bingMapsApiKey = runtimeBingMapsApiKey || envBingMapsApiKey || undefined

  const { config, notices, packs } = await loadRuntimeViewerConfig(baseConfig)

  root.render(
    <StrictMode>
      <App
        availablePacks={packs}
        bingMapsApiKey={bingMapsApiKey}
        config={config}
        notices={notices}
        onSwitchContext={updateViewerQuery}
      />
    </StrictMode>,
  )
}

void bootstrap()
