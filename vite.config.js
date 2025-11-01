import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Allow overriding backend port at runtime (start-website.sh will export BACKEND_PORT)
const backendPort = Number(process.env.BACKEND_PORT) || 3001;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow external connections
    port: Number(process.env.FRONTEND_DEV_PORT) || 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
        secure: false,
      }
    }
  }
})