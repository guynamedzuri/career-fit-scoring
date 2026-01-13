# GitHub Release 프로세스 가이드

## 핵심 답변

**새 버전을 릴리스할 때는 기존 Release를 수정하지 않고, 새로운 Release를 생성해야 합니다.**

## 상세 설명

### GitHub Releases 구조

GitHub Releases는 **버전별로 독립적**입니다:

- **v1.0.1** → 별도의 Release
- **v1.0.2** → 별도의 Release (새로 생성)
- **v1.0.3** → 별도의 Release (새로 생성)

각 Release는 고유한 **태그(Tag)**를 가집니다.

### 올바른 프로세스

#### ❌ 잘못된 방법: 기존 Release 수정

```
v1.0.1 Release 수정 → v1.0.2로 변경
```

이렇게 하면:
- 기존 v1.0.1 사용자들이 업데이트를 받을 수 없음
- 버전 히스토리가 사라짐
- 자동 업데이트가 작동하지 않음

#### ✅ 올바른 방법: 새 Release 생성

```
v1.0.1 Release (기존, 그대로 유지)
  ↓
v1.0.2 Release (새로 생성)
```

이렇게 하면:
- v1.0.1 사용자들이 v1.0.2로 업데이트 가능
- 버전 히스토리 유지
- 자동 업데이트 정상 작동

## 실제 작업 방법

### 1. GitHub Releases 페이지로 이동

https://github.com/guynamedzuri/career-fit-scoring/releases

### 2. "Draft a new release" 또는 "Create a new release" 클릭

**기존 Release를 수정하지 마세요!**

### 3. 새 Release 정보 입력

- **Choose a tag**: `v1.0.2` (새 태그 생성)
- **Release title**: `v1.0.2 - [변경사항]`
- **Description**: 변경사항 설명

### 4. 파일 업로드

새 버전의 파일들:
- `이력서 적합도 평가 시스템 Setup 1.0.2.exe`
- `latest.yml` (1.0.2 버전)

### 5. "Publish release" 클릭

## Release 구조 예시

```
Releases
├── v1.0.2 (최신) ← 새로 생성
│   ├── Setup 1.0.2.exe
│   └── latest.yml
│
├── v1.0.1 (이전) ← 그대로 유지
│   ├── Setup 1.0.1.exe
│   └── latest.yml
│
└── v1.0.0 (초기)
    ├── Setup 1.0.0.exe
    └── latest.yml
```

## 자동 업데이트 작동 방식

1. 사용자가 **v1.0.1** 앱 실행
2. 앱이 GitHub Releases에서 **최신 Release 확인**
3. **v1.0.2** Release 발견
4. `latest.yml`에서 버전 정보 확인
5. **v1.0.2** 설치 파일 다운로드
6. 업데이트 완료

## 주의사항

### ❌ 하지 말아야 할 것

1. **기존 Release 수정**
   - v1.0.1 Release를 v1.0.2로 변경
   - 기존 파일을 삭제하고 새 파일로 교체

2. **태그 재사용**
   - v1.0.1 태그를 삭제하고 v1.0.2로 재사용

### ✅ 해야 할 것

1. **새 Release 생성**
   - 항상 "Create a new release" 사용

2. **새 태그 생성**
   - v1.0.2, v1.0.3 등 새 태그 생성

3. **기존 Release 유지**
   - 이전 버전 Release는 그대로 두기

## 요약

| 작업 | 방법 |
|------|------|
| 새 버전 릴리스 | **"Create a new release"** 클릭 |
| 기존 버전 수정 | ❌ 하지 않음 |
| 버전 히스토리 | 모든 버전 Release 유지 |
| 자동 업데이트 | 최신 Release를 자동으로 찾음 |

## 빠른 체크리스트

새 버전 릴리스 시:

- [ ] "Create a new release" 클릭 (기존 Release 수정 아님)
- [ ] 새 태그 생성 (예: `v1.0.2`)
- [ ] 새 버전 파일 업로드
- [ ] 기존 Release는 그대로 유지
- [ ] "Publish release" 클릭

## 참고

- GitHub Releases는 **버전 관리 시스템**입니다
- 각 버전은 **독립적인 Release**입니다
- 자동 업데이트는 **최신 Release**를 찾습니다
- 기존 Release를 수정하면 **버전 히스토리가 깨집니다**
