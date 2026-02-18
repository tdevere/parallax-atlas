/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BING_MAPS_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
