import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { vitePluginBikeImageUpload } from './plugins/vite-plugin-bike-image-upload'
import { vitePluginPartImageUpload } from './plugins/vite-plugin-part-image-upload'
import { vitePluginPasswordOtp } from './plugins/vite-plugin-password-otp'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    vitePluginPartImageUpload(),
    vitePluginBikeImageUpload(),
    vitePluginPasswordOtp(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
