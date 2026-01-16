# 실행 파일(.exe) 아이콘 설정 가이드

## 문제
실행 파일(`이력서 적합도 평가 시스템.exe`)의 아이콘이 기본 Electron 아이콘으로 표시됨

## 원인
- `installerIcon`: 설치 프로그램(Setup.exe)의 아이콘
- `uninstallerIcon`: 제거 프로그램의 아이콘
- `win.icon`: **실제 앱 실행 파일(.exe)의 아이콘** ← 이게 중요!

## 해결 방법

### 1. icon.ico 파일 확인

아이콘 파일이 올바른 형식인지 확인:
- Windows `.ico` 파일은 여러 크기(16x16, 32x32, 48x48, 256x256)를 포함해야 함
- 단일 크기만 있으면 적용되지 않을 수 있음

### 2. electron-builder.yml 설정 확인

```yaml
win:
  icon: icon.ico  # 실행 파일 아이콘
  # buildResources 디렉토리 기준 상대 경로

directories:
  buildResources: .  # icon.ico가 electron-app/ 디렉토리에 있어야 함
```

### 3. 빌드 로그 확인

빌드 시 다음 메시지 확인:
```
• default Electron icon is used  reason=application icon is not set
```

이 메시지가 나오면 아이콘을 찾지 못한 것입니다.

### 4. 아이콘 파일 위치 확인

`icon.ico` 파일이 다음 위치에 있어야 함:
```
electron-app/icon.ico
```

### 5. 아이콘 파일 재생성

아이콘이 올바른 형식이 아닐 수 있습니다:
- 온라인 도구로 여러 크기를 포함한 `.ico` 파일 생성
- 또는 `png2icons` 같은 도구 사용
- 권장 크기: 16x16, 32x32, 48x48, 256x256 모두 포함

### 6. 빌드 캐시 클리어

```powershell
Remove-Item -Recurse -Force dist-installer
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
npm run build:win
```

### 7. 절대 경로로 시도 (필요시)

```yaml
win:
  icon: ${process.cwd()}/electron-app/icon.ico
```

## 확인 방법

빌드 후 실행 파일 확인:
```
dist-installer/win-unpacked/이력서 적합도 평가 시스템.exe
```

이 파일을 우클릭 → 속성 → 아이콘 변경에서 확인

## 참고

- `installerIcon`: 설치 프로그램 아이콘 (별도 설정)
- `uninstallerIcon`: 제거 프로그램 아이콘 (별도 설정)
- `win.icon`: **실제 앱 실행 파일 아이콘** (가장 중요!)
