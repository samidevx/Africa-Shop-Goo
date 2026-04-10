import { defineConfig } from 'vite'

export default defineConfig({
  base: '/', // Updated for linanightwear.com
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
        admin: './admin.html'
      }
    }
  }
})
