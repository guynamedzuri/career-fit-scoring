# 빌드 검증 가이드

## 빌드 후 확인 사항

### 1. 빌드 로그 확인

빌드 로그에서 다음 메시지를 확인하세요:

```
• unpacking     path=resources/app.asar.unpacked/node_modules/electron-updater
```

이 메시지가 **없으면** `asarUnpack`이 작동하지 않는 것입니다.

### 2. 빌드된 앱 구조 확인

빌드 후 다음 경로를 확인하세요:

#### Windows (빌드 후):
```
dist-installer/win-unpacked/resources/app.asar.unpacked/node_modules/electron-updater/package.json
```

이 파일이 **존재해야** 합니다.

#### 확인 방법 (PowerShell):
```powershell
# 빌드 후
cd dist-installer\win-unpacked\resources

# app.asar.unpacked 존재 확인
Test-Path app.asar.unpacked

# electron-updater 존재 확인
Test-Path app.asar.unpacked\node_modules\electron-updater\package.json

# 전체 구조 확인
Get-ChildItem -Recurse app.asar.unpacked\node_modules\electron-updater | Select-Object FullName
```

### 3. app.asar 내부 확인

`app.asar.unpacked`가 없어도 `app.asar` 내부에 `electron-updater`가 있을 수 있습니다.

#### 확인 방법:
```powershell
# asar 파일 내용 확인 (asar 유틸리티 필요)
npx asar list dist-installer\win-unpacked\resources\app.asar | Select-String "electron-updater"
```

또는 앱 실행 시 로그에서:
```
[AutoUpdater] Successfully loaded electron-updater from asar archive!
```

이 메시지가 나오면 `app.asar` 내부에서 로드된 것입니다.

### 4. 문제 해결

#### 문제: `unpacking` 메시지가 없음

**원인**: `asarUnpack` 설정이 무시되고 있음

**해결**:
1. `electron-builder.yml`의 `asarUnpack` 설정 확인
2. `files` 설정에서 `node_modules/**/*`가 포함되어 있는지 확인
3. 빌드 캐시 클리어: `npm run clean`

#### 문제: `app.asar.unpacked`가 생성되지 않음

**원인**: 
- `electron-updater`가 빌드에 포함되지 않음
- `asarUnpack` 패턴이 잘못됨

**해결**:
1. `node_modules/electron-updater`가 실제로 존재하는지 확인
2. `asarUnpack` 패턴을 `node_modules/electron-updater/**/*`로 확인
3. `files` 설정에서 제외 규칙이 `electron-updater`를 제외하지 않는지 확인

#### 문제: `app.asar` 내부에도 없음

**원인**: `electron-updater`가 빌드에서 완전히 제외됨

**해결**:
1. `package.json`의 `dependencies`에 `electron-updater`가 있는지 확인
2. `npm install` 실행
3. `files` 설정에서 `node_modules/**/*`가 포함되어 있는지 확인
4. 제외 규칙(`!**/...`)이 `electron-updater`를 제외하지 않는지 확인

### 5. 최종 확인 체크리스트

- [ ] 빌드 로그에 `unpacking` 메시지가 있음
- [ ] `dist-installer/win-unpacked/resources/app.asar.unpacked` 디렉토리 존재
- [ ] `app.asar.unpacked/node_modules/electron-updater/package.json` 파일 존재
- [ ] 앱 실행 시 `[AutoUpdater] electron-updater loaded successfully` 메시지

모든 항목이 체크되면 정상입니다!
