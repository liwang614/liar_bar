/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { gameServerPlugin } from './server/vitePlugin';

export default defineConfig({
  plugins: [react(), gameServerPlugin()],
  server: {
    host: true, // 监听 0.0.0.0，手机可通过电脑局域网 IP 访问
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
