# 아이콘 빌드 디버깅 가이드

## 문제: 실행 파일에 기본 Electron 아이콘이 포함됨

Resource Hacker로 확인한 결과 실행 파일에 기본 아이콘이 들어있다는 것은 `win.icon` 설정이 작동하지 않았다는 의미입니다.

## 확인 사항

### 1. 빌드 시 아이콘 파일 위치 확인

빌드 명령을 실행할 때 `electron-app` 디렉토리에서 실행해야 합니다:

```powershell
cd electron-app
npm run build:win
```

### 2. icon.ico 파일 위치 확인

```powershell
# electron-app 디렉토리에서
Test-Path icon.ico
Get-Item icon.ico | Select-Object FullName, Length
```

### 3. 빌드 로그 확인

빌드 로그에서 다음 메시지 확인:
```
• default Electron icon is used  reason=application icon is not set
```

이 메시지가 있으면 아이콘을 찾지 못한 것입니다.

### 4. buildResources 경로 확인

`electron-builder.yml`에서:
```yaml
directories:
  buildResources: .  # 현재 디렉토리 (electron-app)
```

빌드 시 현재 작업 디렉토리가 `electron-app`이어야 합니다.

### 5. 빌드 스크립트 확인

`package.json`의 빌드 스크립트가 올바른 디렉토리에서 실행되는지 확인:
```json
"build:win": "npm run build:all && electron-builder --win"
```

## 해결 방법

### 방법 1: 빌드 디렉토리 확인

빌드를 `electron-app` 디렉토리에서 실행:

```powershell
cd "D:\1. 2025년 노경지원팀 업무\1. 총무업무\260102 이력서 AI 분석\career-fit-scoring\electron-app"
npm run build:win
```

### 방법 2: 절대 경로 사용 (테스트)

임시로 절대 경로 시도:

```yaml
win:
  icon: D:/1. 2025년 노경지원팀 업무/1. 총무업무/260102 이력서 AI 분석/career-fit-scoring/electron-app/icon.ico
```

### 방법 3: build 폴더 사용

```yaml
directories:
  buildResources: build

# 그리고 build/icon.ico에 파일 복사
```

### 방법 4: 빌드 전 아이콘 파일 확인 스크립트

`package.json`에 추가:
```json
"prebuild": "node -e \"const fs = require('fs'); if (!fs.existsSync('icon.ico')) { console.error('ERROR: icon.ico not found!'); process.exit(1); }\""
```

## 가장 가능성 높은 원인

**빌드 시 작업 디렉토리 문제**: `electron-builder`가 실행될 때 `icon.ico`를 찾지 못함

해결: `electron-app` 디렉토리에서 빌드 실행 확인
