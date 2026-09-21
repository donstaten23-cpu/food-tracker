import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works under GitHub Pages' /<repo>/
  // subpath without hardcoding the repo name.
  base: './',
})
