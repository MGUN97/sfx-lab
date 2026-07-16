import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Lets the service worker register in `npm run dev` too, not just production
      // builds, so you can test the "installable app" behavior without building first.
      devOptions: {
        enabled: true,
      },
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'SFX Lab — Variator',
        short_name: 'SFX Lab',
        description:
          '메인 사운드 + 레이어를 랜덤 조합해 사운드 베리에이션을 대량 생성하는 브라우저 기반 사운드 디자인 툴',
        theme_color: '#15161a',
        background_color: '#15161a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache everything the app needs so it also opens (with previously loaded
        // data) when offline — nothing here talks to a server anyway.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
