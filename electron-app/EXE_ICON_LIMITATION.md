# 실행 파일 아이콘 설정의 한계

## 현재 상황

- ✅ 설치 프로그램(Setup.exe) 아이콘: 작동함 (`nsis.installerIcon`)
- ✅ 제거 프로그램 아이콘: 작동함 (`nsis.uninstallerIcon`)
- ❌ 실행 파일(.exe) 아이콘: 작동하지 않음 (`win.icon`)

## 문제 분석

electron-builder의 `win.icon` 설정이 실행 파일 아이콘을 제대로 설정하지 못하는 경우가 있습니다.

## 가능한 원인

1. **electron-builder 버전 문제**: 일부 버전에서 `win.icon`이 작동하지 않음
2. **아이콘 파일 형식**: Windows 실행 파일 아이콘은 특정 형식이 필요할 수 있음
3. **빌드 프로세스**: electron-builder가 아이콘을 실행 파일에 포함하지 않음

## 해결 방법

### 방법 1: Resource Hacker로 수동 변경 (임시)

1. Resource Hacker 다운로드
2. 빌드된 실행 파일 열기
3. Icon 그룹에서 기본 아이콘 삭제
4. 새 아이콘 추가 (icon.ico에서 추출)

### 방법 2: post-build 스크립트 사용

빌드 후 Resource Hacker를 사용하여 아이콘을 자동으로 변경하는 스크립트 작성

### 방법 3: electron-builder 대신 다른 도구 사용

- electron-forge
- electron-packager + 별도 아이콘 설정

### 방법 4: 아이콘 파일 재생성

여러 크기를 포함한 올바른 형식의 .ico 파일 생성:
- 16x16 (256 colors)
- 32x32 (256 colors)
- 48x48 (256 colors)
- 256x256 (True Color)

## 현재 상태

- 설치 프로그램 아이콘: ✅ 작동
- 제거 프로그램 아이콘: ✅ 작동
- 실행 파일 아이콘: ❌ 작동하지 않음 (electron-builder 제한)

## 권장 사항

실행 파일 아이콘이 필수라면:
1. Resource Hacker로 수동 변경
2. 또는 post-build 스크립트로 자동화
3. 또는 electron-builder 대신 다른 빌드 도구 고려

실행 파일 아이콘이 필수가 아니라면:
- 설치 프로그램과 제거 프로그램 아이콘만으로도 충분할 수 있음
- 바로가기 아이콘은 실행 파일 아이콘을 자동으로 사용
