
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import charter from './node.json';

// THE NODE (ring 2026-09-06): the shell's name, colours and Open Graph card come from the
// charter — index.html reads them as %VITE_NODE_*% at build time.
process.env.VITE_NODE_NAME = charter.name;
process.env.VITE_NODE_SHORT = charter.shortName;
process.env.VITE_NODE_TAGLINE = charter.tagline;
process.env.VITE_NODE_DESCRIPTION = charter.description;
process.env.VITE_NODE_ORIGIN = `https://${charter.domain}`;

export default defineConfig(({ mode }) => {
    const cwd = (process as any).cwd();
    const envFileVars = loadEnv(mode, cwd, '');
    const combinedEnv = { ...process.env, ...envFileVars };

    // Selectively expose variables. NOTE: only Firebase's public config belongs here — anything
    // in clientEnv is inlined into the public JS bundle. Never add a real secret (e.g. a Gemini/
    // Anthropic API_KEY); those live only in Cloud Functions secrets and are used server-side.
    const clientEnv = {
        MODE: mode,
        VITE_FIREBASE_API_KEY: combinedEnv.VITE_FIREBASE_API_KEY,
        VITE_FIREBASE_AUTH_DOMAIN: combinedEnv.VITE_FIREBASE_AUTH_DOMAIN,
        VITE_FIREBASE_PROJECT_ID: combinedEnv.VITE_FIREBASE_PROJECT_ID,
        VITE_FIREBASE_STORAGE_BUCKET: combinedEnv.VITE_FIREBASE_STORAGE_BUCKET,
        VITE_FIREBASE_MESSAGING_SENDER_ID: combinedEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
        VITE_FIREBASE_APP_ID: combinedEnv.VITE_FIREBASE_APP_ID,
        VITE_FIREBASE_MEASUREMENT_ID: combinedEnv.VITE_FIREBASE_MEASUREMENT_ID,
    };

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      build: {
        rollupOptions: {
          // Two doors out of one build: the app shell, and the SSO door a mother site
          // iframes so a seed face can share its sign-in (sso.html → src/sso.ts;
          // domain/ssoDoor.ts is the law). The door stays its own tiny entry so a
          // hidden iframe never pays for the whole forest.
          input: {
            main: path.resolve(cwd, 'index.html'),
            sso: path.resolve(cwd, 'sso.html'),
          },
        },
      },
      plugins: [
        react(),
        // PWA: installable app + offline shell. The service worker precaches the built shell
        // (fingerprinted js/css/html + small images). Live data stays live — Firestore/Storage
        // requests are not cached. 'prompt': a fresh deploy surfaces the UpdateToast ("a new
        // version is ready — refresh") instead of silently swapping shells one visit later.
        VitePWA({
          registerType: 'prompt',
          includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
          manifest: {
            name: `${charter.name} — ${charter.tagline}`,
            short_name: charter.shortName,
            description: charter.description,
            start_url: '/',
            display: 'standalone',
            background_color: charter.theme.background,
            theme_color: charter.theme.color,
            icons: [
              { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
              { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
              { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
          workbox: {
            // The push half of the worker (public/push-sw.js) rides inside the generated one.
            importScripts: ['push-sw.js'],
            globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
            // Leave the media library (webp/mp4) to the network — precaching it would bloat installs.
            maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
            // Never serve the SPA shell for Firebase's reserved paths: /__/* (auth helpers),
            // /u/* (the unsubscribe Cloud Function rewrite), or the SSO door (its own page).
            navigateFallbackDenylist: [/^\/__\//, /^\/u\//, /^\/sso\.html/],
            runtimeCaching: [
              {
                // Satellite tiles: pan/zoom and repeat visits hit the local copy first;
                // imagery this old doesn't change under our feet.
                urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*\/tile\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'map-tiles',
                  expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
              {
                // Tree portraits (webp'd on upload): serve cached, refresh in the background.
                urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'tree-images',
                  expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 14, purgeOnQuotaError: true },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
            ],
          },
        }),
      ],
      define: {
        // We define __STATIC_ENV__ instead of process.env.
        // This allows the polyfill (in utils/polyfill.ts) to merge these build-time vars
        // with the runtime vars (window.process.env) injected by the AI Studio UI.
        '__STATIC_ENV__': JSON.stringify(clientEnv),
      },
      resolve: {
        alias: {
          '@': path.resolve(cwd, 'src'),
        }
      }
    };
});
