# 문제 해결 가이드

## 하얀 화면 문제

### 증상
- Electron 앱이 실행되지만 하얀 화면만 표시됨
- 개발자 도구에서 `index.html` 로드 실패 (X 마크)

### 해결 방법

#### 1. Vite 서버가 실행 중인지 확인

터미널에서 다음 메시지가 보여야 합니다:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

만약 이 메시지가 없다면:
```bash
# Vite 서버를 별도로 실행
npm run dev:vite
```

#### 2. 포트 충돌 확인

다른 프로세스가 5173 포트(Vite)를 사용 중일 수 있습니다. **프로세스로 먼저 탐색**하는 것을 권장합니다:
```bash
# Linux/Mac: Vite/Node 프로세스로 탐색
pgrep -af "vite"
pgrep -af "5173"
ps aux | grep vite | grep -v grep

# 사용 중인 Vite 프로세스 종료
pkill -f "vite"

# Windows: 포트로 확인
netstat -ano | findstr :5173
```

포트가 사용 중이면:
- `vite.config.ts`에서 다른 포트로 변경
- 또는 위처럼 프로세스로 찾아서 종료

#### 3. Electron 재빌드

```bash
# Electron 파일 재빌드
npm run build:electron:dev

# 그 다음 실행
npm run dev
```

#### 4. 의존성 재설치

```bash
# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install
```

#### 5. 수동으로 확인

1. **터미널 1**: Vite 서버 실행
   ```bash
   npm run dev:vite
   ```
   브라우저에서 `http://localhost:5173` 접속하여 페이지가 로드되는지 확인

2. **터미널 2**: Electron 실행
   ```bash
   npm run build:electron:dev
   cross-env NODE_ENV=development electron .
   ```

#### 6. 개발자 도구 확인

Electron 창에서 `Ctrl+Shift+I` (또는 `Cmd+Option+I`)로 개발자 도구를 열고:
- Console 탭에서 에러 메시지 확인
- Network 탭에서 실패한 요청 확인
- `http://localhost:5173`에 직접 접속 가능한지 확인

## 기타 문제

### "Cannot find module" 오류

```bash
# 루트 모듈 재빌드
cd ..
npm run build
cd electron-app
npm install
```

### TypeScript 빌드 오류

```bash
# TypeScript 재설치
npm install typescript --save-dev
npm run build:electron:dev
```

### Electron이 실행되지 않음

```bash
# Electron 재설치
npm install electron --save-dev
```
