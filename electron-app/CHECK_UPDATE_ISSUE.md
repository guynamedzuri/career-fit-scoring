# 자동 업데이트 작동 안 함 문제 분석

## 사용자 관찰

- 1.0.2를 릴리스함
- 1.0.1 앱 실행 → 아무 반응 없음
- latest.yml은 존재함
- 버전 비교는 파일 이름과 무관하게 작동해야 함

## 가능한 원인들

### 1. electron-updater가 GitHub Releases를 찾지 못함

**원인**: `electron-builder.yml`의 `publish` 설정이 빌드 시에만 적용되고, 런타임에는 적용되지 않을 수 있음

**확인**: electron-updater가 어디서 업데이트를 확인하는지 명시적으로 설정 필요

### 2. 태그 이름 형식 문제

GitHub Release 태그: `1.0.2` (v 없음)
일반적인 형식: `v1.0.2` (v 있음)

electron-updater는 기본적으로 `v` 접두사를 기대할 수 있음

### 3. 앱이 실제로 업데이트를 체크하지 않음

- `setupAutoUpdater()`가 호출되지 않음
- `autoUpdater`가 null
- 개발 모드로 인식됨

### 4. 에러가 발생했지만 표시되지 않음

- 네트워크 에러
- GitHub API 접근 실패
- latest.yml 파싱 실패

## 해결 방법

### 방법 1: electron-updater에 명시적으로 GitHub URL 설정

`main.ts`에서:

```typescript
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'guynamedzuri',
  repo: 'career-fit-scoring'
});
```

### 방법 2: 태그 형식 확인

Release 태그를 `v1.0.2` 형식으로 변경 (v 접두사 추가)

### 방법 3: 에러 로깅 강화

모든 이벤트와 에러를 콘솔에 출력하여 문제 파악
