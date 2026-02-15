import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/food-choice/',
  plugins: [react()],
  optimizeDeps: {
    include: ['sql.js']
  }
})
