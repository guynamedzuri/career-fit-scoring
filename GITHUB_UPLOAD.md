# GitHub 업로드 가이드

## 현재 상태
✅ 로컬 git 저장소 초기화 완료
✅ 모든 파일 커밋 완료
✅ main 브랜치로 변경 완료

## GitHub에 업로드하는 방법

### 1단계: GitHub에서 새 저장소 생성
1. https://github.com/new 접속
2. 저장소 이름 입력 (예: `career-fit-scoring`)
3. Public 또는 Private 선택
4. **README, .gitignore, license 추가하지 않기** (이미 있음)
5. "Create repository" 클릭

### 2단계: 원격 저장소 추가 및 푸시

#### HTTPS 사용 (권장):
```bash
cd /home/zuri/dev/app/main/ats-system/career-fit-scoring
git remote add origin https://github.com/YOUR_USERNAME/career-fit-scoring.git
git push -u origin main
```

#### SSH 사용:
```bash
cd /home/zuri/dev/app/main/ats-system/career-fit-scoring
git remote add origin git@github.com:YOUR_USERNAME/career-fit-scoring.git
git push -u origin main
```

### 3단계: 확인
GitHub 저장소 페이지에서 모든 파일이 업로드되었는지 확인하세요.

## 포함된 파일
- ✅ README.md - 프로젝트 소개
- ✅ EXAMPLES.md - 상세 사용 예제
- ✅ CHANGELOG.md - 변경 이력
- ✅ LICENSE - MIT 라이선스
- ✅ package.json - npm 패키지 설정
- ✅ tsconfig.json - TypeScript 설정
- ✅ src/ - 모든 소스 코드
  - scoring.ts - 점수 계산 알고리즘
  - api/ - API 연동 모듈
  - server/ - 서버 사이드 버전
  - certificateParser.ts - 자격증 파싱
- ✅ .github/workflows/ci.yml - CI/CD 설정

