# 빌드 문제 해결 가이드

## Windows 빌드 시 심볼릭 링크 오류

### 문제
```
ERROR: Cannot create symbolic link : 클라이언트가 필요한 권한을 가지고 있지 않습니다
```

### 원인
- Windows에서 관리자 권한 없이 심볼릭 링크 생성 시도
- `winCodeSign` 도구 압축 해제 중 macOS 파일들을 심볼릭 링크로 만들려고 시도

### 해결 방법

#### 방법 1: 코드 서명 비활성화 (권장 - 개발/테스트용)
`electron-builder.yml`에 다음 설정이 이미 추가되어 있습니다:
```yaml
win:
  sign: null
  signAndEditExecutable: false
```

이 설정으로 코드 서명을 건너뛰고 빌드할 수 있습니다.

#### 방법 2: 관리자 권한으로 실행
1. PowerShell 또는 명령 프롬프트를 **관리자 권한으로 실행**
2. 빌드 명령 실행:
   ```bash
   npm run build:win
   ```

#### 방법 3: 캐시 삭제 후 재시도
```bash
# electron-builder 캐시 삭제
rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign"

# 또는 전체 캐시 삭제
rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache"

# 빌드 재시도
npm run build:win
```

#### 방법 4: 코드 서명 인증서 사용 (프로덕션용)
프로덕션 배포 시에는 코드 서명 인증서가 필요합니다:
```yaml
win:
  certificateFile: path/to/certificate.pfx
  certificatePassword: your-password
```

## 기타 빌드 문제

### 빌드가 느린 경우
- 첫 빌드 시 Electron 바이너리 다운로드로 시간이 걸릴 수 있습니다
- 이후 빌드는 캐시를 사용하여 더 빠릅니다

### 메모리 부족 오류
- Node.js 메모리 제한 증가:
  ```bash
   set NODE_OPTIONS=--max-old-space-size=4096
   npm run build:win
   ```

### 경로에 한글이 있는 경우
- 프로젝트 경로에 한글이 있으면 일부 도구에서 문제가 발생할 수 있습니다
- 가능하면 영문 경로를 사용하는 것을 권장합니다
