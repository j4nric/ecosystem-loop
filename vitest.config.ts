import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/tests/**/*.test.ts', 'apps/*/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts'],
      exclude: ['packages/core/src/index.ts'],
      reporter: ['text-summary', 'text'],
      // Die Regel-Engine ist das Herz des Spiels – sie muss gut getestet bleiben.
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
});
