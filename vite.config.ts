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
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // 書体（unicode-range ごとに分割された woff2）は使った分だけ端末に残し、オフラインでも表示できるようにする
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      manifest: {
        name: 'Lacets',
        short_name: 'Lacets',
        description: '実在のルートをスマートトレーナーで再現するインドアサイクリングアプリ',
        lang: 'ja',
        theme_color: '#e3f1f8',
        background_color: '#e3f1f8',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        // ロゴは src/ui/brand/logo.ts（npm run brand で書き出す）。maskable は風景を全面に描いた四角
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
