# latest.yml 파일 생성 방법

`latest.yml` 파일은 자동 업데이트를 위해 필수입니다. 이 파일이 없으면 자동 업데이트가 작동하지 않습니다.

## 문제

로컬에서 `npm run build:win`으로 빌드하면 `latest.yml` 파일이 생성되지 않을 수 있습니다.

## 해결 방법

### 방법 1: 수동 생성 스크립트 사용 (가장 확실)

빌드 후 자동으로 `latest.yml`을 생성하는 스크립트를 실행:

```bash
npm run build:win:publish
npm run generate-latest
```

또는 한 번에:

```bash
npm run build:win:complete
```

이 방법이 가장 확실하게 `latest.yml` 파일을 생성합니다.

### 방법 2: publish onTag로 빌드

```bash
npm run build:win:publish
```

또는 직접 실행:

```bash
npm run build:all && electron-builder --win --publish onTag
```

**중요**: `--publish onTag`는 Git 태그가 있을 때만 실제로 publish합니다. 태그가 없으면 `latest.yml`만 생성하고 실제로는 publish하지 않습니다.

이 방법이 `latest.yml` 파일을 생성하면서도 실제로 GitHub에 publish하지 않습니다.

### 방법 2: 수동으로 latest.yml 생성

`dist-installer` 폴더에 `latest.yml` 파일을 생성하고 다음 내용을 입력:

```yaml
version: 1.0.1
files:
  - url: 이력서 적합도 평가 시스템 Setup 1.0.1.exe
    sha512: [SHA512 해시값]
    size: [파일 크기 (바이트)]
path: 이력서 적합도 평가 시스템 Setup 1.0.1.exe
sha512: [SHA512 해시값]
releaseDate: '2025-01-09T00:00:00.000Z'
```

**주의**: SHA512 해시값을 직접 계산해야 합니다.

### 방법 3: electron-builder가 자동 생성하도록 설정

`electron-builder.yml`에 `publish` 설정이 있으면 빌드 시 자동으로 생성됩니다.

현재 설정:
```yaml
publish:
  provider: github
  owner: guynamedzuri
  repo: career-fit-scoring
```

이 설정이 있으면 `--publish never` 옵션으로 빌드해도 `latest.yml`이 생성됩니다.

## 확인 방법

빌드 후 다음 명령으로 확인:

```bash
# Windows PowerShell
dir dist-installer\latest.yml

# 또는 탐색기에서
# dist-installer 폴더에 latest.yml 파일이 있는지 확인
```

## 자동 생성 확인

`latest.yml` 파일이 자동으로 생성되면 다음과 같은 내용이 포함됩니다:

- `version`: 현재 버전 번호
- `files`: 다운로드할 파일 정보
- `path`: 파일 경로
- `sha512`: 파일 무결성 검증용 해시값
- `releaseDate`: 릴리스 날짜

## 문제 해결

여전히 `latest.yml`이 생성되지 않으면:

1. `electron-builder.yml`에 `publish` 설정이 있는지 확인
2. `--publish never` 옵션으로 빌드 시도
3. `dist-installer` 폴더 권한 확인
