# 빌드 전 정리 가이드

빌드 오류가 발생할 때 기존 빌드 파일을 삭제하면 해결될 수 있습니다.

## 문제

```
⨯ remove ...\d3dcompiler_47.dll: Access is denied.
```

이 오류는 이전 빌드 파일이 사용 중이거나 잠겨있을 때 발생합니다.

## 해결 방법

### 방법 1: dist-installer 폴더 삭제 (권장)

PowerShell에서:

```powershell
# dist-installer 폴더 삭제
Remove-Item -Recurse -Force "dist-installer" -ErrorAction SilentlyContinue

# 빌드 재시도
npm run build:win:publish
```

명령 프롬프트에서:

```cmd
rmdir /s /q dist-installer
npm run build:win:publish
```

### 방법 2: 전체 정리 후 빌드

```powershell
# 모든 빌드 파일 삭제
Remove-Item -Recurse -Force "dist-installer" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue

# 빌드 재시도
npm run build:win:publish
```

### 방법 3: 앱이 실행 중인지 확인

빌드된 앱이 실행 중이면 파일이 잠겨있을 수 있습니다:

1. 실행 중인 앱 종료
2. `dist-installer` 폴더 삭제
3. 빌드 재시도

## 예방 방법

빌드 전에 항상 이전 빌드 파일을 삭제하는 습관을 들이면 좋습니다:

```powershell
# 빌드 전 정리 스크립트
Remove-Item -Recurse -Force "dist-installer" -ErrorAction SilentlyContinue
npm run build:win:publish
```

## 참고

- `dist-installer` 폴더는 빌드 결과물이므로 삭제해도 소스 코드에는 영향 없습니다
- 삭제 후 다시 빌드하면 새로 생성됩니다
