import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy API calls to the FastAPI backend during development. This keeps
    // requests same-origin, so the browser never needs a CORS preflight and
    // the backend's allowed-origin list does not have to change to match
    // whichever port Vite happens to pick.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
