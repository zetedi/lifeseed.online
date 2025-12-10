import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Use process.cwd() to ensure we look in the project root for .env
    // Casting process to any to avoid TS errors if types are incomplete
    const cwd = (process as any).cwd();
    const env = loadEnv(mode, cwd, '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Expose loaded env vars as a global constant
        '__STATIC_ENV__': JSON.stringify(env),
        // Remap process.env to window.process.env
        // The index.html shim ensures window.process exists at runtime.
        'process.env': 'window.process.env',
      },
      resolve: {
        alias: {
          '@': path.resolve(cwd, '.'),
        }
      }
    };
});