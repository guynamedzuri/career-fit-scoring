# 중복 빌드 파일 제외 가이드

## 문제

빌드된 파일이 400MB 이상으로 매우 큰 이유:

**`career-fit-scoring` 패키지가 `node_modules`에 포함되면서, 이전에 빌드된 파일(`dist`, `dist-installer`, `electron-app`)까지 함께 포함됨**

## 원인

```
win-unpacked/resources/app.asar.unpacked/node_modules/career-fit-scoring/
├── dist/                    ← 이전 빌드 결과물
├── dist-installer/          ← 이전 빌드 결과물
├── electron-app/            ← 이전 빌드 결과물
├── node_modules/            ← 중복 의존성
└── src/                     ← 소스 파일 (필요)
```

이전 빌드 결과물까지 포함되어 파일 크기가 2배가 됩니다.

## 해결 방법

### electron-builder.yml에 제외 규칙 추가

```yaml
files:
  # career-fit-scoring 패키지의 빌드 결과물 제외
  - "!**/node_modules/career-fit-scoring/dist/**/*"
  - "!**/node_modules/career-fit-scoring/dist-installer/**/*"
  - "!**/node_modules/career-fit-scoring/electron-app/**/*"
  - "!**/node_modules/career-fit-scoring/.git/**/*"
  - "!**/node_modules/career-fit-scoring/node_modules/**/*"
```

### package.json에도 동일하게 적용

`package.json`의 `build.files` 배열에도 동일한 제외 규칙을 추가합니다.

## 제외해야 할 항목

### career-fit-scoring 패키지 내:

- ❌ `dist/` - 빌드 결과물
- ❌ `dist-installer/` - 설치 파일
- ❌ `electron-app/` - Electron 앱 소스 (이미 컴파일됨)
- ❌ `.git/` - Git 저장소
- ❌ `node_modules/` - 중복 의존성 (이미 상위에 있음)

### 포함해야 할 항목:

- ✅ `src/` - 소스 파일 (컴파일된 결과만 사용)
- ✅ `package.json` - 패키지 정보
- ✅ 컴파일된 `.js` 파일들

## 확인 방법

빌드 후 확인:

```powershell
# win-unpacked 폴더에서 career-fit-scoring 확인
Get-ChildItem dist-installer\win-unpacked\resources\app.asar.unpacked\node_modules\career-fit-scoring -Recurse | 
  Select-Object FullName
```

다음 폴더들이 **없어야** 합니다:
- `dist/`
- `dist-installer/`
- `electron-app/`
- `.git/`

## 예상 효과

- **제외 전**: ~400-443MB (빌드 결과물 중복 포함)
- **제외 후**: ~150-200MB (예상)

## 추가 최적화

만약 `career-fit-scoring` 패키지가 로컬 파일 링크(`file:..`)로 설치되어 있다면:

1. **npm pack**으로 패키지 생성
2. **필요한 파일만 포함**하도록 `package.json`의 `files` 필드 설정
3. 또는 **npm publish** 후 일반 패키지로 설치

## 체크리스트

- [ ] `electron-builder.yml`에 career-fit-scoring 빌드 결과물 제외 규칙 추가
- [ ] `package.json`에도 동일한 규칙 추가
- [ ] 다시 빌드
- [ ] `win-unpacked`에서 `dist`, `dist-installer`, `electron-app` 폴더가 없는지 확인
- [ ] 파일 크기 확인 (예상: 150-200MB)
