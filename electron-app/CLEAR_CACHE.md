# 캐시 삭제 가이드

빌드 오류가 발생할 때 캐시를 삭제하면 해결될 수 있습니다.

## Windows에서 캐시 삭제

### PowerShell에서 실행:

```powershell
# winCodeSign 캐시만 삭제
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign" -ErrorAction SilentlyContinue

# 또는 전체 electron-builder 캐시 삭제
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache" -ErrorAction SilentlyContinue
```

### 명령 프롬프트에서 실행:

```cmd
rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign"
```

또는

```cmd
rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache"
```

## 캐시 삭제 후 빌드

```bash
npm run build:win
```
