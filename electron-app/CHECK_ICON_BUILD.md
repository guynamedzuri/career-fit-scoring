# 아이콘 빌드 확인 가이드

## 문제: favicon.ico가 루트에 없고 실행 파일 아이콘이 바뀌지 않음

## 확인 사항

### 1. 빌드 로그 확인

빌드 시 다음 메시지 확인:
```
• default Electron icon is used  reason=application icon is not set
```

이 메시지가 나오면 아이콘을 찾지 못한 것입니다.

### 2. 빌드된 파일 확인

빌드 후 다음 경로 확인:
```
dist-installer/win-unpacked/이력서 적합도 평가 시스템.exe
dist-installer/win-unpacked/favicon.ico  (있어야 함)
dist-installer/win-unpacked/resources/favicon.ico  (extraResources에 있으면 여기)
```

### 3. favicon.ico 파일 형식 확인

Windows 실행 파일 아이콘은 여러 크기를 포함해야 합니다:
- 16x16
- 32x32  
- 48x48
- 256x256

단일 크기만 있으면 적용되지 않을 수 있습니다.

### 4. buildResources 경로 확인

`electron-builder.yml`에서:
```yaml
directories:
  buildResources: .  # electron-app 디렉토리
```

`favicon.ico`가 `electron-app/` 디렉토리에 있어야 합니다.

### 5. win.icon 경로 확인

```yaml
win:
  icon: favicon.ico  # buildResources 기준 상대 경로
```

## 해결 방법

### 방법 1: 아이콘 파일 재생성

여러 크기를 포함한 `.ico` 파일 생성:
- 온라인 도구 사용
- 또는 ImageMagick: `convert icon-16.png icon-32.png icon-48.png icon-256.png favicon.ico`

### 방법 2: 절대 경로 사용 (테스트용)

```yaml
win:
  icon: ${process.cwd()}/electron-app/favicon.ico
```

### 방법 3: 빌드 캐시 클리어

```powershell
Remove-Item -Recurse -Force dist-installer
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
npm run build:win
```

### 방법 4: files 설정 확인

`favicon.ico`가 `files` 목록에 포함되어 있는지 확인:
```yaml
files:
  - favicon.ico
```

## 디버깅

빌드 후 실제 파일 확인:
```powershell
# 빌드된 앱 구조 확인
Get-ChildItem -Recurse dist-installer\win-unpacked | Where-Object {$_.Name -like "*ico*"}

# 실행 파일 아이콘 확인
$exe = Get-Item "dist-installer\win-unpacked\이력서 적합도 평가 시스템.exe"
$exe | Select-Object Name, LastWriteTime
```
