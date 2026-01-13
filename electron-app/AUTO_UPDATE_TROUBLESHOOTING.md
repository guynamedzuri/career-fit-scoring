# 자동 업데이트 문제 해결 가이드

## 현재 상황

1.0.3 앱 실행 → 1.0.4 Release 확인 → 아무 반응 없음

## 가능한 원인들

### 1. electron-updater가 GitHub Releases를 찾지 못함

**확인 방법**: 에러 메시지 확인 (2초 후 표시됨)

**해결**: `autoUpdater.setFeedURL()`이 이미 설정되어 있음

### 2. 태그 형식 문제

GitHub Release 태그: `1.0.4` (v 없음)
일반적인 형식: `v1.0.4` (v 있음)

**해결**: Release 태그를 `v1.0.4` 형식으로 변경

### 3. latest.yml 문제

- 파일이 없음
- 파일 이름 불일치
- 형식 오류

**확인**: GitHub Release에서 `latest.yml` 다운로드하여 확인

### 4. 앱이 업데이트를 체크하지 않음

- `setupAutoUpdater()`가 호출되지 않음
- `autoUpdater`가 null
- 개발 모드로 인식됨

## 디버깅 방법

### 1. 에러 메시지 확인

앱 실행 후 2초 후에 에러 메시지가 표시될 수 있습니다.

### 2. 수동 업데이트 체크 (향후 UI 추가 가능)

현재는 IPC 핸들러만 추가되어 있습니다. UI에서 호출하려면:

```typescript
// React 컴포넌트에서
const handleCheckUpdate = async () => {
  const result = await (window as any).electron.checkForUpdates();
  console.log('Update check result:', result);
};
```

### 3. GitHub API 직접 확인

브라우저에서:
```
https://api.github.com/repos/guynamedzuri/career-fit-scoring/releases/latest
```

응답 확인:
- `tag_name`이 올바른지
- `assets`에 `latest.yml`이 있는지

### 4. latest.yml 직접 확인

Release 페이지에서 `latest.yml` 다운로드:
- `version: 1.0.4`인지
- `url` 필드가 실제 파일 이름과 일치하는지

## 즉시 확인할 사항

### 1. Release 태그 형식

현재: `1.0.4`
변경: `v1.0.4` (v 접두사 추가)

**방법**:
1. GitHub Release 페이지
2. v1.0.4 Release 편집
3. 태그를 `v1.0.4`로 변경 (또는 새 Release 생성)

### 2. latest.yml 확인

Release 페이지에서:
- `latest.yml` 파일 다운로드
- 내용 확인:
  ```yaml
  version: 1.0.4
  files:
    - url: Setup.1.0.4.exe  # 실제 파일 이름과 일치해야 함
  ```

### 3. 앱 재시작

앱을 완전히 종료 후 다시 실행

## 추가 개선 사항

### 향후 추가 가능한 기능

1. **수동 업데이트 체크 버튼** (UI에 추가)
2. **업데이트 상태 표시** (체크 중, 업데이트 있음, 없음)
3. **로그 파일 저장** (에러 추적용)

## 체크리스트

- [ ] Release 태그가 `v1.0.4` 형식인지 확인
- [ ] `latest.yml` 파일이 Release에 있는지 확인
- [ ] `latest.yml`의 `version`이 `1.0.4`인지 확인
- [ ] `latest.yml`의 `url`이 실제 파일 이름과 일치하는지 확인
- [ ] 앱을 완전히 종료 후 다시 실행
- [ ] 에러 메시지 확인 (2초 후 표시될 수 있음)

## 가장 가능성 높은 원인

**Release 태그 형식**: `1.0.4` → `v1.0.4`로 변경 필요

electron-updater는 기본적으로 `v` 접두사를 기대할 수 있습니다.
