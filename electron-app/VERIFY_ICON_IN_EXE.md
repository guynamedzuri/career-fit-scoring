# 실행 파일 아이콘 확인 방법

## 문제: win.icon은 인식되지만 실행 파일 아이콘이 바뀌지 않음

## 확인 방법

### 1. 빌드된 실행 파일 확인

```powershell
cd electron-app
.\CHECK_EXE_ICON.ps1
```

### 2. Resource Hacker로 아이콘 리소스 확인

1. Resource Hacker 다운로드: http://www.angusj.com/resourcehacker/
2. 실행 파일 열기: `dist-installer\win-unpacked\이력서 적합도 평가 시스템.exe`
3. Icon 그룹 확인:
   - 아이콘이 포함되어 있는지 확인
   - 아이콘 ID 확인 (보통 32512, 32513 등)

### 3. 실행 파일 속성에서 확인

1. 파일 탐색기에서 실행 파일 우클릭
2. 속성 > 아이콘 변경
3. 현재 아이콘 확인

### 4. 다른 위치에 설치하여 테스트

```powershell
# 다른 경로에 설치
.\dist-installer\이력서 적합도 평가 시스템 Setup 1.0.78.exe /S /D=C:\TestApp
```

### 5. 빌드 로그에서 아이콘 처리 확인

빌드 로그에서 다음을 확인:
- `• default Electron icon is used` 메시지가 있는지
- 아이콘 관련 경고나 오류가 있는지

## 가능한 원인

1. **Windows 아이콘 캐시**: 이미 클리어했지만 재부팅 필요할 수 있음
2. **실행 파일 아이콘 리소스 미포함**: 빌드 시 아이콘이 포함되지 않음
3. **아이콘 파일 형식 문제**: icon.ico가 올바른 형식이 아님
4. **빌드 캐시**: electron-builder 캐시 문제

## 해결 시도

### 시도 1: 완전 클린 빌드

```powershell
# 모든 캐시 삭제
Remove-Item -Recurse -Force dist-installer
Remove-Item -Recurse -Force dist
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $env:APPDATA\electron-builder -ErrorAction SilentlyContinue

# 재빌드
npm run build:win
```

### 시도 2: 다른 아이콘 파일로 테스트

온라인에서 여러 크기를 포함한 새 icon.ico 생성 후 테스트

### 시도 3: 재부팅

Windows 아이콘 캐시는 재부팅 후 완전히 클리어될 수 있습니다.

### 시도 4: 실행 파일 이름 변경

```yaml
productName: "TestApp"  # 다른 이름으로 테스트
```

다른 이름으로 빌드하면 Windows가 새로운 아이콘을 로드합니다.
