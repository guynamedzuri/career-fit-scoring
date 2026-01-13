# 자동 업데이트 작동 방식

## 핵심 프로세스

네, 맞습니다! 앱이 실행되면 다음 과정을 거칩니다:

### 1. 앱 시작 시

```
앱 실행
  ↓
setupAutoUpdater() 호출
  ↓
autoUpdater.checkForUpdatesAndNotify() 실행
```

### 2. 업데이트 확인 과정

```
1. GitHub Releases API 호출
   GET https://api.github.com/repos/guynamedzuri/career-fit-scoring/releases/latest
   
2. 최신 릴리스 정보 가져오기
   - tag_name: "v1.0.2"
   - assets: [설치 파일들]
   
3. latest.yml 파일 찾기
   - assets 배열에서 "latest.yml" 파일 찾기
   - latest.yml 다운로드
   
4. 버전 비교
   - latest.yml의 version: "1.0.2"
   - 현재 앱 버전: app.getVersion() → "1.0.1"
   - 비교: "1.0.2" > "1.0.1" → 업데이트 필요!
   
5. 업데이트 다운로드
   - latest.yml의 files[0].url에서 설치 파일 다운로드
   - SHA512 해시로 무결성 검증
   
6. 사용자에게 알림
   - 다운로드 완료 후 대화상자 표시
   - "지금 재시작" 옵션 제공
```

## 정확한 검증 과정

### Step 1: GitHub API 호출

```javascript
// electron-updater 내부 동작
GET https://api.github.com/repos/{owner}/{repo}/releases/latest

// 응답 예시
{
  "tag_name": "v1.0.2",
  "name": "v1.0.2 - 자동 업데이트 테스트",
  "assets": [
    {
      "name": "이력서 적합도 평가 시스템 Setup 1.0.2.exe",
      "browser_download_url": "https://github.com/.../Setup-1.0.2.exe"
    },
    {
      "name": "latest.yml",
      "browser_download_url": "https://github.com/.../latest.yml"
    }
  ]
}
```

### Step 2: latest.yml 다운로드 및 파싱

```yaml
# latest.yml 내용
version: 1.0.2
files:
  - url: 이력서 적합도 평가 시스템 Setup 1.0.2.exe
    sha512: abc123...
    size: 150000000
path: 이력서 적합도 평가 시스템 Setup 1.0.2.exe
sha512: abc123...
releaseDate: '2025-01-09T12:00:00.000Z'
```

### Step 3: 버전 비교

```javascript
// electron-updater 내부 로직
const currentVersion = app.getVersion();  // "1.0.1"
const latestVersion = latestYml.version;   // "1.0.2"

if (compareVersions(latestVersion, currentVersion) > 0) {
  // 새 버전 발견!
  downloadUpdate();
}
```

### Step 4: 업데이트 다운로드

```javascript
// latest.yml의 files[0].url에서 다운로드
const downloadUrl = latestYml.files[0].url;
downloadFile(downloadUrl);

// SHA512 해시로 무결성 검증
const downloadedHash = calculateSHA512(downloadedFile);
if (downloadedHash !== latestYml.files[0].sha512) {
  throw new Error('File integrity check failed');
}
```

## 왜 작동하지 않을 수 있는가?

### 문제 1: latest.yml이 없음

**증상**: GitHub API는 호출되지만 latest.yml을 찾을 수 없음

**확인 방법**:
- GitHub Release 페이지에서 latest.yml 파일 확인
- Release assets에 latest.yml이 있는지 확인

### 문제 2: 버전 형식 불일치

**증상**: 버전 비교가 제대로 안 됨

**확인 사항**:
- latest.yml: `version: 1.0.2` (v 없음)
- package.json: `"version": "1.0.2"` (v 없음)
- Release tag: `v1.0.2` (v 있음) ← 이건 괜찮음

### 문제 3: GitHub API 접근 실패

**증상**: 네트워크 에러 또는 인증 문제

**확인 방법**:
- 인터넷 연결 확인
- 저장소가 Public인지 확인 (Private이면 인증 필요)

### 문제 4: latest.yml 형식 오류

**증상**: latest.yml을 다운로드했지만 파싱 실패

**확인 방법**:
- latest.yml 파일 내용 확인
- YAML 형식이 올바른지 확인

## 디버깅 방법

### 1. GitHub API 직접 확인

브라우저에서:
```
https://api.github.com/repos/guynamedzuri/career-fit-scoring/releases/latest
```

응답에서 확인:
- `tag_name`이 `v1.0.2`인지
- `assets` 배열에 `latest.yml`이 있는지

### 2. latest.yml 직접 확인

Release 페이지에서 `latest.yml` 다운로드:
- 파일이 존재하는지
- `version: 1.0.2`인지
- 형식이 올바른지

### 3. 앱 로그 확인

프로덕션 빌드된 앱에서:
- 콘솔 로그는 볼 수 없지만
- 업데이트 다운로드 시 파일 시스템에 임시 파일 생성됨
- 또는 에러가 발생하면 사용자에게 표시될 수 있음

## 체크리스트

자동 업데이트가 작동하려면:

- [ ] GitHub Release에 v1.0.2가 Published 상태
- [ ] Release assets에 `latest.yml` 파일 존재
- [ ] `latest.yml`의 `version`이 `1.0.2`
- [ ] `latest.yml`의 `files[0].url`이 올바른 설치 파일 경로
- [ ] GitHub 저장소가 Public (또는 인증 토큰 설정)
- [ ] 앱이 프로덕션 빌드로 실행됨
- [ ] 인터넷 연결 정상

## 요약

**핵심 프로세스:**
1. GitHub Releases API 호출 → 최신 릴리스 정보 가져오기
2. latest.yml 다운로드 → 버전 정보 읽기
3. 버전 비교 → 현재 버전 vs latest.yml의 version
4. 새 버전 발견 시 → 설치 파일 다운로드
5. 무결성 검증 → SHA512 해시 확인
6. 사용자 알림 → 재시작 옵션 제공

**가장 중요한 것:**
- ✅ `latest.yml` 파일이 GitHub Release에 있어야 함
- ✅ `latest.yml`의 `version`이 현재 앱 버전보다 높아야 함
- ✅ `latest.yml`의 형식이 올바르게 작성되어야 함
