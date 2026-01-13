# 자동 업데이트 디버깅 가이드

## 문제: 자동 업데이트가 작동하지 않음

1.0.2를 릴리스한 후 1.0.1 앱을 실행했는데 업데이트가 감지되지 않습니다.

## 확인 사항

### 1. GitHub Release 확인

다음 사항을 확인하세요:

#### A. Release가 제대로 생성되었는지
- https://github.com/guynamedzuri/career-fit-scoring/releases
- v1.0.2 Release가 존재하는지 확인
- Release가 "Published" 상태인지 확인 (Draft가 아님)

#### B. 파일이 제대로 업로드되었는지
- `이력서 적합도 평가 시스템 Setup 1.0.2.exe` 파일이 있는지
- `latest.yml` 파일이 있는지 (가장 중요!)

#### C. latest.yml 내용 확인
`latest.yml` 파일을 다운로드하여 내용 확인:

```yaml
version: 1.0.2  # 버전이 1.0.2인지 확인
files:
  - url: 이력서 적합도 평가 시스템 Setup 1.0.2.exe
    sha512: ...
    size: ...
path: 이력서 적합도 평가 시스템 Setup 1.0.2.exe
sha512: ...
releaseDate: '...'
```

### 2. 앱에서 확인

#### A. 개발자 도구 콘솔 확인

1.0.1 앱 실행 후 개발자 도구(F12) 콘솔에서 다음 로그 확인:

```
[AutoUpdater] Checking for update...
[AutoUpdater] Update available: 1.0.2
```

또는 에러 메시지:
```
[AutoUpdater] Error: ...
```

#### B. 네트워크 요청 확인

개발자 도구 → Network 탭에서:
- GitHub API 요청이 있는지 확인
- `https://api.github.com/repos/guynamedzuri/career-fit-scoring/releases/latest` 요청 확인
- 응답 상태 코드 확인 (200이어야 함)

### 3. 설정 확인

#### A. electron-builder.yml 확인

```yaml
publish:
  provider: github
  owner: guynamedzuri
  repo: career-fit-scoring
```

저장소가 **Public**인지 확인 (Private이면 인증 필요)

#### B. package.json 버전 확인

```json
{
  "version": "1.0.2"
}
```

릴리스한 버전과 일치하는지 확인

### 4. 일반적인 문제들

#### 문제 1: latest.yml이 없음

**증상**: Release에 latest.yml 파일이 없음

**해결**:
1. `npm run generate-latest` 실행
2. 생성된 `latest.yml` 파일을 GitHub Release에 업로드

#### 문제 2: 버전 형식 불일치

**증상**: Release 태그는 `v1.0.2`인데 package.json은 `1.0.2`

**해결**: 
- Release 태그: `v1.0.2` (v 접두사)
- package.json: `"version": "1.0.2"` (v 없음)
- latest.yml: `version: 1.0.2` (v 없음)

이 형식은 정상입니다.

#### 문제 3: Private 저장소

**증상**: 저장소가 Private인 경우

**해결**:
- GitHub Personal Access Token 필요
- 또는 저장소를 Public으로 변경

#### 문제 4: 앱이 개발 모드로 실행됨

**증상**: 개발 모드에서는 자동 업데이트가 비활성화됨

**해결**:
- 프로덕션 빌드된 앱으로 테스트해야 함
- 개발 모드(`npm run dev`)에서는 작동하지 않음

#### 문제 5: 네트워크 문제

**증상**: 인터넷 연결 문제 또는 방화벽

**해결**:
- 인터넷 연결 확인
- GitHub 접근 가능한지 확인
- 방화벽 설정 확인

## 디버깅 방법

### 1. 콘솔 로그 확인

앱 실행 후 개발자 도구 콘솔에서:

```javascript
// 자동 업데이트 상태 확인
console.log('AutoUpdater enabled:', autoUpdater !== null);
console.log('Is packaged:', app.isPackaged);
console.log('Current version:', app.getVersion());
```

### 2. 수동 업데이트 체크

개발자 도구 콘솔에서:

```javascript
// 수동으로 업데이트 체크 (개발 모드에서는 작동 안 함)
if (autoUpdater) {
  autoUpdater.checkForUpdates();
}
```

### 3. GitHub API 직접 확인

브라우저에서 다음 URL 접속:

```
https://api.github.com/repos/guynamedzuri/career-fit-scoring/releases/latest
```

응답에서:
- `tag_name`이 `v1.0.2`인지 확인
- `assets` 배열에 `latest.yml`이 있는지 확인

## 체크리스트

자동 업데이트 문제 해결:

- [ ] GitHub Release에 v1.0.2가 Published 상태인지
- [ ] Release에 `latest.yml` 파일이 업로드되었는지
- [ ] `latest.yml`의 `version`이 `1.0.2`인지
- [ ] 앱이 프로덕션 빌드로 실행되었는지 (개발 모드 아님)
- [ ] 개발자 도구 콘솔에 `[AutoUpdater]` 로그가 있는지
- [ ] 네트워크 탭에서 GitHub API 요청이 있는지
- [ ] 저장소가 Public인지 (또는 인증 토큰이 설정되었는지)
- [ ] 인터넷 연결이 정상인지

## 빠른 테스트

### 1. GitHub Release 확인

브라우저에서:
```
https://github.com/guynamedzuri/career-fit-scoring/releases
```

### 2. latest.yml 직접 확인

Release 페이지에서 `latest.yml` 파일 다운로드하여 내용 확인

### 3. 앱 재시작

앱을 완전히 종료 후 다시 실행

### 4. 콘솔 로그 확인

개발자 도구 콘솔에서 에러 메시지 확인

## 추가 디버깅

여전히 작동하지 않으면:

1. **콘솔 에러 메시지** 확인
2. **Network 탭**에서 GitHub API 요청 확인
3. **latest.yml 파일 내용** 확인
4. **버전 번호** 일치 확인

## 참고

- 자동 업데이트는 **프로덕션 빌드**에서만 작동합니다
- 개발 모드(`npm run dev`)에서는 비활성화됩니다
- 첫 업데이트 체크는 앱 시작 시 자동으로 실행됩니다
- 이후 5분마다 자동으로 확인합니다
