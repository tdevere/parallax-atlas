import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedPath = id.replaceAll('\\', '/')
          if (!normalizedPath.includes('/node_modules/')) {
            return undefined
          }

          if (
            normalizedPath.includes('/node_modules/vis-timeline/') &&
            normalizedPath.includes('graph2d')
          ) {
            return 'timeline-graph2d-vendor'
          }

          if (
            normalizedPath.includes('/node_modules/vis-timeline/') ||
            normalizedPath.includes('/node_modules/vis-data/')
          ) {
            return 'timeline-core-vendor'
          }

          if (normalizedPath.includes('/node_modules/moment/')) {
            return 'moment-vendor'
          }

          if (normalizedPath.includes('/node_modules/@radix-ui/')) {
            return 'ui-vendor'
          }

          if (
            normalizedPath.includes('/node_modules/react/') ||
            normalizedPath.includes('/node_modules/react-dom/') ||
            normalizedPath.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor'
          }

          return 'vendor'
        },
      },
    },
  },
})
