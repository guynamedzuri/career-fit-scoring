# 빌드 스크립트 가이드

## 사용 가능한 빌드 명령어

### 1. `npm run build:win:complete` (권장)

**가장 완전한 빌드** - 빌드 + latest.yml 생성

```bash
npm run build:win:complete
```

**동작:**
1. `build:win:publish` 실행 (빌드)
2. `generate-latest` 실행 (latest.yml 생성)

**장점:**
- 한 번에 빌드 + latest.yml 생성
- GitHub Release 업로드 준비 완료

**단점:**
- 이전 빌드 파일이 남아있을 수 있음

---

### 2. `npm run clean:build` (완전 정리 후 빌드)

**정리 + 빌드 + latest.yml 생성**

```bash
npm run clean:build
```

**동작:**
1. `clean` 실행 (이전 빌드 파일 삭제)
2. `build:win:publish` 실행 (빌드)
3. `generate-latest` 실행 (latest.yml 생성)

**장점:**
- 이전 빌드 파일 완전 정리
- 깨끗한 상태에서 빌드
- latest.yml 자동 생성

**단점:**
- 시간이 조금 더 걸림 (정리 시간)

---

### 3. `npm run build:win:publish`

**빌드만** (latest.yml 생성 안 함)

```bash
npm run build:win:publish
```

**동작:**
- 빌드만 실행
- latest.yml은 생성되지 않음

**사용 시나리오:**
- 테스트 빌드
- latest.yml이 필요 없는 경우

---

### 4. `npm run build:win`

**기본 빌드** (publish 설정 없음)

```bash
npm run build:win
```

**동작:**
- 기본 빌드만 실행
- latest.yml 생성 안 함

---

## 추천 사용법

### 일반적인 빌드 (권장)

```bash
npm run build:win:complete
```

### 이전 빌드 파일 문제가 있을 때

```bash
npm run clean:build
```

### 단계별로 실행

```bash
# 1. 정리
npm run clean

# 2. 빌드
npm run build:win:publish

# 3. latest.yml 생성
npm run generate-latest
```

## 비교표

| 명령어 | 정리 | 빌드 | latest.yml | 추천 상황 |
|--------|------|------|------------|-----------|
| `build:win:complete` | ❌ | ✅ | ✅ | 일반 빌드 |
| `clean:build` | ✅ | ✅ | ✅ | 완전 정리 후 빌드 |
| `build:win:publish` | ❌ | ✅ | ❌ | 테스트 빌드 |
| `build:win` | ❌ | ✅ | ❌ | 기본 빌드 |

## 요약

**가장 간단한 방법:**
```bash
npm run build:win:complete
```

**가장 확실한 방법:**
```bash
npm run clean:build
```

둘 다 사용 가능하며, 상황에 맞게 선택하시면 됩니다!
