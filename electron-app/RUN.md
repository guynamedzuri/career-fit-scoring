# 실행 가이드

## 개발 모드 실행

### 방법 1: npm 스크립트 사용 (권장)

```bash
npm run dev
```

이 명령은 자동으로:
1. Electron 파일 빌드
2. Vite 개발 서버 시작
3. Electron 앱 실행

### 방법 2: 수동 실행 (문제 해결용)

**터미널 1** - Vite 서버:
```bash
npm run dev:vite
```

**터미널 2** - Electron (Vite 서버가 시작된 후):
```bash
# Windows PowerShell
npm run build:electron:dev
$env:NODE_ENV="development"; electron .

# Windows CMD
npm run build:electron:dev
set NODE_ENV=development && electron .

# Linux/Mac
npm run build:electron:dev
NODE_ENV=development electron .
```

또는 npx 사용:
```bash
npm run build:electron:dev
npx cross-env NODE_ENV=development electron .
```

## 문제 해결

### Electron 창이 나타나지 않는 경우

1. **Vite 서버가 실행 중인지 확인**
   - 브라우저에서 `http://localhost:5173` 접속 테스트

2. **Electron 프로세스 확인**
   - 작업 관리자에서 `electron.exe` 확인

3. **로그 확인**
   - 터미널에서 "Loading Vite dev server" 메시지 확인
   - "Page loaded successfully" 메시지 확인

4. **수동 실행**
   - 위의 "방법 2"를 따라 수동으로 실행

### cross-env 오류

Windows PowerShell에서 `cross-env`를 직접 실행할 수 없습니다:
- ❌ `cross-env NODE_ENV=development electron .`
- ✅ `npx cross-env NODE_ENV=development electron .`
- ✅ `$env:NODE_ENV="development"; electron .` (PowerShell)
- ✅ `set NODE_ENV=development && electron .` (CMD)

또는 `npm run dev`를 사용하면 자동으로 처리됩니다.
