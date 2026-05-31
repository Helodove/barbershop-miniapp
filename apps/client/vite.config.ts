import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/',
  envDir: '../../',
  resolve: {
    alias: {
      '@barbershop/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
})
