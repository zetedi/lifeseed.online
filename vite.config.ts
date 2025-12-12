import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const cwd = (process as any).cwd();
    const envFileVars = loadEnv(mode, cwd, '');
    const combinedEnv = { ...process.env, ...envFileVars };

    // Selectively expose variables
    const clientEnv = {
        API_KEY: combinedEnv.API_KEY,
        VITE_FIREBASE_API_KEY: combinedEnv.VITE_FIREBASE_API_KEY,
        VITE_FIREBASE_AUTH_DOMAIN: combinedEnv.VITE_FIREBASE_AUTH_DOMAIN,
        VITE_FIREBASE_PROJECT_ID: combinedEnv.VITE_FIREBASE_PROJECT_ID,
        VITE_FIREBASE_STORAGE_BUCKET: combinedEnv.VITE_FIREBASE_STORAGE_BUCKET,
        VITE_FIREBASE_MESSAGING_SENDER_ID: combinedEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
        VITE_FIREBASE_APP_ID: combinedEnv.VITE_FIREBASE_APP_ID,
    };

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // We define __STATIC_ENV__ instead of process.env.
        // This allows the polyfill (in utils/polyfill.ts) to merge these build-time vars
        // with the runtime vars (window.process.env) injected by the AI Studio UI.
        '__STATIC_ENV__': JSON.stringify(clientEnv),
      },
      resolve: {
        alias: {
          '@': path.resolve(cwd, '.'),
        }
      }
    };
});