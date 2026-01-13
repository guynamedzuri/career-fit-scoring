# 빌드 포함 여부 디버깅 가이드

## 문제: electron-updater가 빌드에 포함되지 않음

로그를 보면 `app.asar` 내부에도 `electron-updater`가 없습니다. 이는 빌드 시 포함되지 않았다는 의미입니다.

## 확인 방법

### 1. 빌드 전 확인

```bash
# electron-updater가 node_modules에 있는지 확인
cd electron-app
ls node_modules/electron-updater

# package.json에 있는지 확인
cat package.json | grep electron-updater
```

### 2. 빌드된 앱 구조 확인

#### 방법 A: win-unpacked 폴더 확인 (빌드 후)

```powershell
# 빌드 후
cd dist-installer\win-unpacked\resources

# app.asar 파일 크기 확인 (너무 작으면 node_modules가 없을 수 있음)
Get-Item app.asar | Select-Object Name, Length

# asar 내용 확인 (asar 유틸리티 필요)
npx asar list app.asar | Select-String "electron-updater"
```

#### 방법 B: asar 비활성화로 확인

`electron-builder.yml`에서 임시로:
```yaml
asar: false
```

이렇게 하면 모든 파일이 압축되지 않아 구조를 쉽게 확인할 수 있습니다.

### 3. 빌드 로그 확인

빌드 시 다음을 확인:
- `packaging` 단계에서 `electron-updater` 관련 메시지
- 파일 크기 (너무 작으면 포함되지 않았을 수 있음)

## 해결 방법

### 방법 1: files 설정 확인

`electron-builder.yml`의 `files` 설정에서:
1. `node_modules/electron-updater/**/*`가 명시적으로 포함되어 있는지
2. 제외 규칙(`!**/...`)이 `electron-updater`를 제외하지 않는지

### 방법 2: 빌드 캐시 클리어

```bash
npm run clean
rm -rf node_modules/.cache
rm -rf dist-installer
npm install
npm run build:win
```

### 방법 3: asar 비활성화로 테스트

임시로 `asar: false`로 설정하여:
1. `electron-updater`가 실제로 포함되는지 확인
2. 포함되면 `asarUnpack` 설정 문제
3. 포함되지 않으면 `files` 설정 문제

### 방법 4: verbose 빌드

```bash
DEBUG=electron-builder npm run build:win
```

더 자세한 로그를 확인할 수 있습니다.

## 예상 원인

1. **제외 규칙 문제**: `!**/node_modules/**/*` 같은 규칙이 `electron-updater`를 제외
2. **파일 크기 제한**: electron-builder가 큰 파일을 제외
3. **의존성 문제**: `electron-updater`가 `devDependencies`에 있음 (하지만 확인했을 때 `dependencies`에 있음)
4. **빌드 캐시**: 이전 빌드 캐시가 문제

## 최종 확인

빌드 후 다음 명령으로 확인:

```powershell
# asar 내용 확인
npx asar extract dist-installer\win-unpacked\resources\app.asar temp-asar
Get-ChildItem -Recurse temp-asar\node_modules\electron-updater
Remove-Item -Recurse temp-asar
```

이 명령으로 `app.asar` 내부에 `electron-updater`가 있는지 확인할 수 있습니다.
