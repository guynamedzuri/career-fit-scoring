# Windows .exe 빌드 가이드

## 사전 준비

### 1. 루트 모듈 빌드

```bash
# 프로젝트 루트에서
cd /path/to/career-fit-scoring
npm install
npm run build
```

### 2. Electron 앱 의존성 설치

```bash
cd electron-app
npm install
```

## Windows .exe 빌드

### 기본 빌드 (모든 플랫폼)

```bash
npm run build
```

### Windows 전용 빌드

```bash
npm run build:win
```

이 명령은:
1. Electron 메인 프로세스 TypeScript 파일 빌드
2. React 앱 빌드 (Vite)
3. electron-builder로 Windows 설치 프로그램 생성

## 빌드 결과

빌드가 완료되면 `dist-installer` 폴더에 다음 파일이 생성됩니다:

- **Windows**: `이력서 적합도 평가 시스템 Setup x.x.x.exe` (NSIS 설치 프로그램)

## 빌드 옵션

### 빌드 스크립트

- `npm run build` - 모든 플랫폼 빌드
- `npm run build:win` - Windows만 빌드
- `npm run build:mac` - macOS만 빌드
- `npm run build:linux` - Linux만 빌드
- `npm run build:all` - 프론트엔드 + Electron 빌드만 (설치 프로그램 생성 안 함)

### electron-builder 옵션

특정 아키텍처만 빌드:
```bash
npm run build:all
electron-builder --win --x64
```

디버그 빌드:
```bash
npm run build:all
electron-builder --win --debug
```

## 아이콘 설정

아이콘 파일을 `build/` 폴더에 추가하세요:

- `build/icon.ico` - Windows 아이콘 (256x256 권장)
- `build/icon.icns` - macOS 아이콘
- `build/icon.png` - Linux 아이콘

아이콘이 없으면 기본 Electron 아이콘이 사용됩니다.

## 빌드 설정 커스터마이징

`electron-builder.yml` 파일을 수정하여 빌드 설정을 변경할 수 있습니다:

- 앱 이름, 버전, 설명
- 설치 프로그램 옵션
- 파일 포함/제외 규칙
- 코드 서명 설정

## 문제 해결

### 빌드 실패

1. **의존성 확인**
   ```bash
   npm install
   ```

2. **루트 모듈 빌드 확인**
   ```bash
   cd ..
   npm run build
   cd electron-app
   ```

3. **캐시 정리**
   ```bash
   rm -rf node_modules dist dist-installer
   npm install
   ```

### 빌드 시간이 오래 걸림

- `electron-builder`가 처음 실행될 때 Electron 바이너리를 다운로드하므로 시간이 걸릴 수 있습니다.
- 이후 빌드는 더 빠릅니다.

### 파일 크기가 큼

- `electron-builder.yml`의 `files` 섹션에서 불필요한 파일을 제외하세요.
- `node_modules`의 불필요한 패키지를 제거하세요.

## 배포

빌드된 설치 프로그램은 `dist-installer` 폴더에 있습니다.

사용자에게 배포할 때:
1. `.exe` 파일을 제공
2. 사용자가 다운로드하여 실행
3. 설치 마법사가 자동으로 앱을 설치

## 자동 업데이트 (선택사항)

나중에 자동 업데이트 기능을 추가하려면:
- `electron-updater` 패키지 사용
- 업데이트 서버 설정
- 코드 서명 설정
