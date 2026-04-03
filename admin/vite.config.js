import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      // Rule 1: Forwards all API data calls (e.g., /api/admin/plants)
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      // Rule 2: FORWARDS ASSET REQUESTS (e.g., /uploads/image.jpg) 
      // This is crucial for images to load from the backend's static directory.
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
