# Windows 아이콘 캐시 문제 해결

## 문제: win.icon은 인식되지만 실행 파일 아이콘이 바뀌지 않음

## 원인

Windows는 아이콘 캐시를 사용합니다. 실행 파일을 다시 빌드해도 이전 아이콘이 캐시되어 보일 수 있습니다.

## 해결 방법

### 방법 1: Windows 아이콘 캐시 클리어 (가장 중요!)

**PowerShell을 관리자 권한으로 실행** 후:

```powershell
# Windows 탐색기 종료
Stop-Process -Name explorer -Force

# 아이콘 캐시 삭제
Remove-Item "$env:LOCALAPPDATA\IconCache.db" -ErrorAction SilentlyContinue
Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\Windows\Explorer" -Filter "iconcache*" -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue

# 탐색기 재시작
Start-Process explorer
```

또는 스크립트 사용:
```powershell
# 관리자 권한으로 실행
.\CLEAR_ICON_CACHE.ps1
```

또는 간단하게:
```powershell
ie4uinit.exe -show
```

### 방법 2: 실행 파일 위치 변경 후 테스트

다른 경로에 설치하거나 다른 이름으로 빌드:
```yaml
productName: "이력서 적합도 평가 시스템 Test"
```

### 방법 3: 아이콘 파일에 256x256 포함 확인

현재 `favicon.ico`는 16x16, 32x32만 포함되어 있을 수 있습니다.
Windows 실행 파일 아이콘은 **256x256**이 필요합니다.

온라인 도구로 256x256을 포함한 새 아이콘 생성:
- https://convertio.co/kr/png-ico/
- 여러 크기(16, 32, 48, 256) PNG를 하나의 ICO로 변환

### 방법 4: 빌드된 실행 파일 직접 확인

```powershell
# 빌드된 실행 파일의 아이콘 리소스 확인
$exe = "dist-installer\win-unpacked\이력서 적합도 평가 시스템.exe"

# 파일 속성에서 아이콘 확인
$shell = New-Object -ComObject Shell.Application
$folder = $shell.Namespace((Get-Item $exe).DirectoryName)
$file = $folder.ParseName((Get-Item $exe).Name)
$file | Select-Object Name
```

### 방법 5: 완전 클린 빌드

```powershell
# 모든 빌드 파일 삭제
Remove-Item -Recurse -Force dist-installer
Remove-Item -Recurse -Force dist
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue

# Windows 임시 파일 삭제
Remove-Item -Recurse -Force $env:TEMP\electron-* -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $env:TEMP\electron-builder-* -ErrorAction SilentlyContinue

# 재빌드
npm run build:win
```

### 방법 6: 다른 아이콘 파일로 테스트

`icon.ico`로 테스트:
```yaml
win:
  icon: icon.ico  # favicon.ico 대신 icon.ico 사용
```

## 확인 사항

1. **아이콘 파일 크기**: 256x256 포함 여부
2. **Windows 아이콘 캐시**: 가장 흔한 원인
3. **빌드 캐시**: electron-builder 캐시
4. **실행 파일 위치**: 다른 위치에 설치해보기

## 가장 가능성 높은 원인

**Windows 아이콘 캐시**입니다. 방법 1을 먼저 시도하세요!
