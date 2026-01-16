# Windows 빌드 캐시 클리어 가이드

## PowerShell 명령어

### 빌드 캐시 클리어

```powershell
# dist-installer 폴더 삭제
Remove-Item -Recurse -Force dist-installer

# 또는 짧게
rm -r -fo dist-installer

# node_modules 캐시 삭제 (있는 경우)
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue

# dist 폴더 삭제 (있는 경우)
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
```

### 한 번에 모두 클리어

```powershell
# npm clean 스크립트 실행
npm run clean

# 추가로 dist-installer 삭제
Remove-Item -Recurse -Force dist-installer -ErrorAction SilentlyContinue

# node_modules 캐시 삭제
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
```

## CMD (명령 프롬프트) 명령어

```cmd
rmdir /s /q dist-installer
rmdir /s /q dist
rmdir /s /q node_modules\.cache
```

## 완전 클린 빌드

```powershell
# 1. 빌드 폴더들 삭제
npm run clean
Remove-Item -Recurse -Force dist-installer -ErrorAction SilentlyContinue

# 2. 캐시 삭제
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue

# 3. 다시 빌드
npm run build:win
```

## 참고

- PowerShell의 `rm`은 `Remove-Item`의 별칭입니다
- `-Recurse` (또는 `-r`): 하위 디렉토리 포함
- `-Force` (또는 `-fo`): 강제 삭제
- `-ErrorAction SilentlyContinue`: 오류 무시 (파일이 없어도 계속 진행)
