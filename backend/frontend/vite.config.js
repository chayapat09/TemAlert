import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // build.outDir is 'dist' by default, which is what server.js expects
  // build: {
  //   outDir: 'dist'
  // },
  server: {
    port: 3000, // Frontend dev server port
    proxy: {
      // Proxy API requests from frontend dev server to our backend server
      '/myapi': {
        target: 'http://localhost:5001', // Your backend server
        changeOrigin: true,
      }
    }
  }
})
