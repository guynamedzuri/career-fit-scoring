# 빌드된 앱 구조 확인 가이드

## 문제: electron-updater가 로드되지 않음

`app.asar.unpacked` 디렉토리가 생성되지 않는 경우, 다음을 확인하세요.

## 1. 빌드된 앱 구조 확인

### Windows에서 확인:

```powershell
# 설치된 앱 경로로 이동
cd "C:\Program Files\career-fit-scoring-app"

# resources 폴더 확인
dir resources

# app.asar.unpacked 존재 여부 확인
dir resources\app.asar.unpacked

# app.asar.unpacked 내부 확인 (존재하는 경우)
dir resources\app.asar.unpacked\node_modules
```

### 예상되는 구조:

```
career-fit-scoring-app/
├── resources/
│   ├── app.asar                    # 앱 파일 (압축됨)
│   ├── app.asar.unpacked/          # unpacked 파일들 (필수!)
│   │   └── node_modules/
│   │       └── electron-updater/   # 여기에 있어야 함
│   ├── app-update.yml
│   └── elevate.exe
└── ...
```

## 2. asarUnpack이 작동하지 않는 경우

### 확인 사항:

1. **electron-builder.yml의 asarUnpack 설정**
   ```yaml
   asarUnpack:
     - "**/node_modules/electron-updater/**/*"
   ```

2. **files 설정에 electron-updater 포함 확인**
   ```yaml
   files:
     - "node_modules/electron-updater/**/*"
   ```

3. **빌드 시 실제 포함 여부 확인**
   - `dist-installer/win-unpacked/resources/app.asar.unpacked` 확인
   - 빌드 후 이 경로에 `electron-updater`가 있는지 확인

## 3. 디버깅 방법

### 방법 1: asar 비활성화로 확인

`electron-builder.yml`에서 임시로:
```yaml
asar: false
```

이렇게 하면 모든 파일이 압축되지 않아 구조를 쉽게 확인할 수 있습니다.

### 방법 2: 빌드 로그 확인

빌드 시 다음 메시지 확인:
```
• unpacking     path=resources/app.asar.unpacked/node_modules/electron-updater
```

이 메시지가 없으면 `asarUnpack`이 작동하지 않는 것입니다.

## 4. 해결 방법

### 방법 A: asarUnpack 경로 수정

```yaml
asarUnpack:
  - "node_modules/electron-updater/**/*"  # ** 제거
```

### 방법 B: files 설정 확인

모든 필요한 파일이 `files`에 포함되어 있는지 확인:
```yaml
files:
  - "node_modules/electron-updater/**/*"
  - "node_modules/builder-util-runtime/**/*"
  - "node_modules/fs-extra/**/*"
  # ... 기타 의존성
```

### 방법 C: 빌드 캐시 클리어

```bash
npm run clean
rm -rf node_modules/.cache
npm run build:win
```

## 5. 최종 확인

빌드 후 다음 경로 확인:
- `dist-installer/win-unpacked/resources/app.asar.unpacked/node_modules/electron-updater/package.json`

이 파일이 존재하면 정상입니다.
