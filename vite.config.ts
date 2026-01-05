import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          const isWindows = id.includes('\\');
          const nmFirebase = isWindows ? '\\node_modules\\firebase\\' : '/node_modules/firebase/';
          const nmAtFirebase = isWindows ? '\\node_modules\\@firebase\\' : '/node_modules/@firebase/';

          const matchChunk = (needle: string, chunk: string) => {
            if (id.includes(needle)) return chunk;
            return undefined;
          };

          // Firebase: split by product so Firestore/Storage/Functions are lazy-loaded.
          const firebaseChunk =
            matchChunk(isWindows ? '\\firebase\\app' : '/firebase/app', 'firebase-core') ||
            matchChunk(isWindows ? '\\@firebase\\app' : '/@firebase/app', 'firebase-core') ||
            matchChunk(isWindows ? '\\firebase\\auth' : '/firebase/auth', 'firebase-auth') ||
            matchChunk(isWindows ? '\\@firebase\\auth' : '/@firebase/auth', 'firebase-auth') ||
            matchChunk(isWindows ? '\\firebase\\firestore' : '/firebase/firestore', 'firebase-firestore') ||
            matchChunk(isWindows ? '\\@firebase\\firestore' : '/@firebase/firestore', 'firebase-firestore') ||
            matchChunk(isWindows ? '\\firebase\\storage' : '/firebase/storage', 'firebase-storage') ||
            matchChunk(isWindows ? '\\@firebase\\storage' : '/@firebase/storage', 'firebase-storage') ||
            matchChunk(isWindows ? '\\firebase\\functions' : '/firebase/functions', 'firebase-functions') ||
            matchChunk(isWindows ? '\\@firebase\\functions' : '/@firebase/functions', 'firebase-functions') ||
            (id.includes(nmAtFirebase) ? 'firebase-core' : undefined) ||
            (id.includes(nmFirebase) ? 'firebase-core' : undefined);

          if (firebaseChunk) return firebaseChunk;
          if (id.includes('/react-router') || id.includes('\\react-router')) return 'router';
          if (id.includes('/@mui/') || id.includes('\\@mui\\')) return 'mui';
          if (id.includes('/@emotion/') || id.includes('\\@emotion\\')) return 'emotion';
          if (id.includes('/recharts/') || id.includes('\\recharts\\')) return 'charts';
          if (id.includes('/date-fns/') || id.includes('\\date-fns\\')) return 'date-fns';
          if (id.includes('/lucide-react/') || id.includes('\\lucide-react\\')) return 'icons';
          if (
            id.includes('/react/') ||
            id.includes('\\react\\') ||
            id.includes('/react-dom/') ||
            id.includes('\\react-dom\\') ||
            id.includes('react/jsx-runtime')
          ) {
            return 'react';
          }
          // React dependencies that must live with React to avoid chunk cycles (vendor <-> react).
          if (id.includes('/scheduler/') || id.includes('\\scheduler\\')) return 'react';
          if (id.includes('/use-sync-external-store/') || id.includes('\\use-sync-external-store\\')) return 'react';

          return 'vendor';
        },
      },
    },
  },
});
