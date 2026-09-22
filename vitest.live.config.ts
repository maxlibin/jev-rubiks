import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.live.test.ts'],
    env: loadEnv('development', process.cwd(), ''),
    testTimeout: 60_000,
  },
});
