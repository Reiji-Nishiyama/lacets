/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Lacets',
        short_name: 'Lacets',
        description: '実在のルートをスマートトレーナーで再現するインドアサイクリングアプリ',
        lang: 'ja',
        theme_color: '#1f2933',
        background_color: '#1f2933',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: {
    // MapLibre（約 1 MB）は地図を表示するときだけ動的に読み込むため、警告のしきい値を上げる
    chunkSizeWarningLimit: 1200,
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'test/**/*.test.ts'],
    environment: 'node',
  },
})
