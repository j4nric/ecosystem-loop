import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/tests/**/*.test.ts', 'apps/*/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/herde/src/**/*.ts'],
      // Einstiege und Konsolen-Werkzeuge (nur Node, interaktiv) zählen nicht.
      exclude: ['packages/herde/src/index.ts', 'packages/herde/src/node/cli/**'],
      reporter: ['text-summary', 'text'],
      // Die Regel-Engine ist das Herz des Spiels – sie muss gut getestet bleiben.
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
