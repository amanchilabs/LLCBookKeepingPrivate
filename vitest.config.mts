import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx', '**/*.test.mjs'],
    exclude: ['node_modules', 'ios', 'android', '.expo'],
  },
});
