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
    chunkSizeWarningLimit: 1500,
  },
});
