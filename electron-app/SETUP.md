# Electron 앱 실행 가이드

## 사전 준비

### 1. 루트 모듈 빌드

먼저 `career-fit-scoring` 모듈을 빌드해야 합니다:

```bash
# career-fit-scoring 루트 디렉토리에서
cd /home/zuri/dev/app/main/ats-system/career-fit-scoring
npm install
npm run build
```

### 2. Electron 앱 의존성 설치

```bash
# electron-app 디렉토리로 이동
cd electron-app
npm install
```

## 개발 모드 실행

개발 모드에서는 Vite 개발 서버와 Electron을 동시에 실행합니다:

```bash
npm run dev
```

이 명령은:
1. Vite 개발 서버를 `http://localhost:5173`에서 시작
2. Electron 앱을 실행하여 개발 서버에 연결

## 빌드

### Electron 메인 프로세스 빌드

```bash
npm run build:electron
```

### 전체 빌드 (프론트엔드 + Electron)

```bash
npm run build
```

## 문제 해결

### 1. `career-fit-scoring` 모듈을 찾을 수 없는 경우

```bash
# 루트 모듈이 빌드되었는지 확인
cd ..
npm run build

# electron-app으로 돌아와서 다시 설치
cd electron-app
npm install
```

### 2. Electron이 실행되지 않는 경우

```bash
# node_modules 재설치
rm -rf node_modules
npm install
```

### 3. 포트 충돌

Vite 개발 서버가 다른 포트를 사용하려면 `vite.config.ts`에서 포트를 변경하세요:

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174, // 다른 포트로 변경
  },
  // ...
});
```

그리고 `package.json`의 `dev:electron` 스크립트도 해당 포트로 변경:

```json
"dev:electron": "wait-on http://localhost:5174 && electron ."
```

## 파일 구조

```
electron-app/
├── electron/          # Electron 메인 프로세스
│   ├── main.ts       # Electron 메인 프로세스 코드
│   └── preload.ts    # Preload 스크립트
├── src/              # React 앱 소스
│   ├── components/   # React 컴포넌트
│   ├── styles/       # CSS 스타일
│   ├── App.tsx       # 메인 앱 컴포넌트
│   └── main.tsx      # React 진입점
├── package.json      # 프로젝트 설정
└── vite.config.ts    # Vite 설정
```
