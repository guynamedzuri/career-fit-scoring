import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // career-fit-scoring 모듈을 소스에서 직접 참조 (개발 모드)
      'career-fit-scoring': path.resolve(__dirname, '../src'),
    },
  },
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
  },
  optimizeDeps: {
    exclude: ['career-fit-scoring'],
  },
});
