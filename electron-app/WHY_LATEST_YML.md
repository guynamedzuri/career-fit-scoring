# latest.yml이 필요한 이유

## 간단한 답변

**`latest.yml`이 없으면 자동 업데이트가 작동하지 않습니다.**

## 자세한 설명

### 1. electron-updater가 어떻게 작동하는가?

`electron-updater`는 GitHub Releases API를 통해 업데이트를 확인합니다:

1. **앱 실행 시**: GitHub Releases에서 최신 릴리스를 확인
2. **버전 비교**: 현재 앱 버전 vs GitHub의 최신 릴리스 버전
3. **업데이트 발견**: 새 버전이 있으면 다운로드

### 2. latest.yml의 역할

`latest.yml` 파일은 **업데이트 메타데이터**입니다:

```yaml
version: 1.0.1                    # 현재 릴리스 버전
files:
  - url: Setup 1.0.1.exe         # 다운로드할 파일
    sha512: abc123...             # 파일 무결성 검증용 해시
    size: 123456789               # 파일 크기
path: Setup 1.0.1.exe            # 파일 경로
sha512: abc123...                 # 전체 해시
releaseDate: '2025-01-09...'     # 릴리스 날짜
```

### 3. 왜 필요한가?

#### ❌ latest.yml 없이:
- electron-updater가 GitHub Releases API를 호출
- 하지만 **어떤 파일을 다운로드해야 하는지 모름**
- **파일의 무결성을 검증할 수 없음**
- **자동 업데이트 실패**

#### ✅ latest.yml 있으면:
- electron-updater가 `latest.yml`을 읽음
- 버전 정보 확인
- 다운로드할 파일 정보 확인
- SHA512 해시로 파일 무결성 검증
- **자동 업데이트 성공**

### 4. GitHub Releases의 다른 파일들

#### Source Code (zip/tar.gz)
- GitHub가 **자동으로 생성**
- 소스 코드 아카이브
- **자동 업데이트와 무관**

#### Setup.exe
- 우리가 **수동으로 업로드**
- 사용자가 설치할 파일
- **자동 업데이트에 필요**

#### latest.yml
- 우리가 **수동으로 업로드** (또는 스크립트로 생성)
- 업데이트 메타데이터
- **자동 업데이트에 필수**

## 실제 작동 과정

### 사용자가 앱을 실행하면:

1. `electron-updater`가 GitHub Releases API 호출
2. 최신 릴리스의 `latest.yml` 파일 다운로드
3. `latest.yml`에서 버전 정보 읽기
4. 현재 앱 버전과 비교
5. 새 버전이 있으면:
   - `latest.yml`의 `files[0].url`에서 설치 파일 다운로드
   - `sha512` 해시로 파일 무결성 검증
   - 다운로드 완료 후 사용자에게 재시작 옵션 제공

### latest.yml이 없으면?

- GitHub Releases API는 호출되지만
- **어떤 파일을 다운로드해야 하는지 모름**
- **자동 업데이트 실패**

## 결론

### latest.yml은 필수입니다!

- ✅ **있으면**: 자동 업데이트 작동
- ❌ **없으면**: 자동 업데이트 작동 안 함

### 업로드해야 할 파일

GitHub Release에 다음 2개만 업로드하면 됩니다:

1. **Setup.exe** - 사용자가 설치할 파일
2. **latest.yml** - 자동 업데이트 메타데이터

Source Code 파일들은 GitHub가 자동으로 생성하므로 신경 쓸 필요 없습니다.

## 참고

- `latest.yml`은 `electron-builder`가 자동 생성하거나
- 우리가 만든 `generate-latest-yml.js` 스크립트로 생성할 수 있습니다
- GitHub Release에 업로드해야 자동 업데이트가 작동합니다
