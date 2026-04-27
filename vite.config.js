import { defineConfig } from 'vite'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  base: '/', // Updated for linanightwear.com
  build: {
    outDir: 'dist',
  },
  plugins: [cloudflare()], // 👈 now valid
})