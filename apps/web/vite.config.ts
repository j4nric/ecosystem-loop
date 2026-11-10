import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Statischer Build mit relativen Pfaden: läuft in jedem Unterverzeichnis des vServers.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      // Nur Typ-Importe – der Vertrag Engine ↔ Oberfläche.
      '@core/api': fileURLToPath(new URL('../../packages/core/src/api.ts', import.meta.url)),
    },
  },
  server: { host: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Bibliotheken in eigene, selten wechselnde Chunks: Ein App-Update lädt dann nur den kleinen App-Teil neu.
        codeSplitting: {
          groups: [
            {
              name: 'three',
              test: /[\\/]node_modules[\\/](three|@react-three|three-stdlib|troika-[^\\/]+|camera-controls|maath|meshline|zustand|its-fine|suspend-react|stats-gl|@monogrid|@use-gesture|hls\.js|tunnel-rat)[\\/]/,
              priority: 2,
            },
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 1 },
            { name: 'vendor', test: /[\\/]node_modules[\\/]/, priority: 0 },
          ],
        },
      },
    },
  },
});
