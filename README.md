# Career Fit Scoring Algorithm

커리어넷 API를 활용한 지원자 적합도 점수 산출 알고리즘 모듈입니다.

## 개요

이 모듈은 채용 공고와 지원자의 자격증, 경력, 학력을 비교하여 알고리즘 기반으로 적합도 점수를 산출합니다. AI 비용을 절감하기 위해 순수 알고리즘으로만 작동하며, 커리어넷 API와 Q-Net API를 활용하여 정확한 매칭을 수행합니다.

## 주요 기능

- **자격증 점수 계산** (10점 만점): 필수/관련 자격증 매칭 및 개수 평가
- **경력 점수 계산** (20점 만점): 직종 일치도 및 경력 기간 평가
- **학력 점수 계산** (20점 만점): 학력 수준, 관련 학과, 학점 평가
- **총점 계산**: 가중 평균을 통한 최종 적합도 점수 산출
- **커리어넷 API 연동**: 직종 검색, 학과 검색, 직종 상세 정보 조회
- **Q-Net API 연동**: 국가자격증 검색
- **서버 사이드 지원**: Node.js 환경에서도 사용 가능

## 설치

```bash
npm install
npm run build
```

## 빠른 시작

```typescript
import { calculateAllScores } from 'career-fit-scoring';

const applicationData = {
  birthDate: '1990-01-01',
  certificateName1: '정보처리기사',
  certificateName2: 'SQLD',
  careerStartDate1: '2020-01-01',
  careerEndDate1: '2024-12-31',
  careerJobTypeCode1: '12345',
  careerJobTypeAptdCode1: 'A001',
  careerEmploymentStatus1: '퇴사',
  universityDegreeType1: '학사',
  universityGraduationType1: '졸업',
  universityMajor1_1: '컴퓨터공학과',
  universityMajorSeq1_1: '255',
  universityMajorNm1_1: '컴퓨터공학과',
  universityGPA1: '3.8',
  universityGPAMax1: '4.5',
};

const jobMetadata = {
  jobdicSeq: '12345',
  jobAptdCode: 'A001',
  requiredCertifications: ['정보처리기사'],
  relatedCertifications: ['SQLD', 'OCP', 'AWS'],
  relatedMajors: [
    { majorNm: '컴퓨터공학과', majorSeq: '255' }
  ],
  scoringWeights: {
    certification: 1,
    career: 2,
    education: 1
  }
};

const scores = calculateAllScores(applicationData, { aiMetadata: jobMetadata });
console.log(scores);
// {
//   certificationScore: 8,
//   careerScore: 15,
//   educationScore: 12,
//   totalScore: 45.5
// }
```

## 상세 문서

- [EXAMPLES.md](./EXAMPLES.md) - 상세 사용 예제 및 데이터 구조
- [CHANGELOG.md](./CHANGELOG.md) - 변경 이력

## 점수 체계

### 자격증 점수 (10점 만점)
- **필수 자격증**: 없음 시 5점, 1개 시 1개 일치하면 5점, 2개 이상 시 2개 이상 일치하면 5점, 1개 일치하면 3점
- **관련 자격증**: 3개 이상 일치 시 3점, 2개 일치 시 2점, 1개 일치 시 1점
- **자격증 개수**: 7개 이상 시 2점, 4개 이상 시 1점

### 경력 점수 (20점 만점)
- **관련 직종 점수** (10점):
  - 완전 동일 직종 (jobdicSeq 일치): 10점
  - 관련 직종 (aptd_type_code 일치): 5점
- **경력 기간 점수** (10점):
  - 80% 이상: 10점
  - 60% 이상 80% 미만: 8점
  - 30% 이상 60% 미만: 6점
  - 0% 초과 30% 미만: 3점
  - 0% (무경력): 0점

### 학력 점수 (20점 만점)
- **학력 점수** (5점): 고졸 1점, 대졸(전문학사/학사) 3점, 석사/박사 5점
- **관련 학과 점수** (10점): MAJOR_NM 일치 10점, MAJOR_SEQ만 일치 7점
- **학점 점수** (5점): 88% 이상 5점, 66% 이상 88% 미만 2점

## API 키 설정

커리어넷 API와 Q-Net API는 기본 키가 포함되어 있지만, 프로덕션 환경에서는 환경 변수로 설정하는 것을 권장합니다.

```bash
# .env
CAREERNET_API_KEY=your_api_key
QNET_API_KEY=your_api_key
```

## 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.
