import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';

// package.json에서 버전 읽기
const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
const appVersion = packageJson.version;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // career-fit-scoring 모듈을 소스에서 직접 참조 (개발 모드)
      'career-fit-scoring': path.resolve(__dirname, '../src/index.ts'),
    },
  },
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    commonjsOptions: {
      include: [/certificateParser\.js$/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    include: ['career-fit-scoring'],
    esbuildOptions: {
      target: 'es2020',
    },
  },
  define: {
    // API 키는 메인 프로세스에서 cert로만 로드. 렌더러에는 주입하지 않음
    'process.env.CAREERNET_API_KEY': JSON.stringify(process.env.CAREERNET_API_KEY || ''),
    'process.env.QNET_API_KEY': JSON.stringify(process.env.QNET_API_KEY || ''),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
});
