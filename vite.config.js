import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, proxy /api/* to the FreelanceOS API server (server/index.js, port 8787)
// so the frontend can call the AI proxy, payments and cross-border endpoints
// without CORS. In production, host the API behind the same domain or set
// VITE_API_BASE. Override the target with VITE_API_BASE if needed.
const API_TARGET = process.env.VITE_API_BASE || 'http://localhost:8787'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
})
