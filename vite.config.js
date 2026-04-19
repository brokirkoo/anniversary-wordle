import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Must match your GitHub repo name exactly.
  // e.g. github.com/james/anniversary-wordle → '/anniversary-wordle/'
  // If you use a custom domain, change this to '/'
  base: '/anniversary-wordle/',
})
