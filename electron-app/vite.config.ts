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
  define: {
    // 브라우저 환경에서 process.env를 사용할 수 있도록 정의
    'process.env.CAREERNET_API_KEY': JSON.stringify(process.env.CAREERNET_API_KEY || '83ae558eb34c7d75e2bde972db504fd5'),
    'process.env.QNET_API_KEY': JSON.stringify(process.env.QNET_API_KEY || '62577f38999a14613f5ded0c9b01b6ce6349e437323ebb4422825c429189ae5f'),
    // package.json의 버전을 주입
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
});
