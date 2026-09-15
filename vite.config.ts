/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa.svg'],
      manifest: {
        name: '单词打字练习 · KET/PET',
        short_name: '单词打字',
        description: '练键盘指法，按艾宾浩斯曲线记 KET/PET 单词',
        lang: 'zh-CN',
        display: 'standalone',
        orientation: 'landscape',
        theme_color: '#3b82f6',
        background_color: '#f8fafc',
        icons: [
          { src: 'pwa.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // 词库已 import 进包：预缓存全部构建产物即可完全离线（含打字机音效录音）
        globPatterns: ['**/*.{js,css,html,svg,woff2,ogg}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
