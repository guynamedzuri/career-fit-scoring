# Career Fit Scoring Algorithm

커리어넷 API를 활용한 지원자 적합도 점수 산출 알고리즘 모듈입니다.

## 프로젝트 개요

이 모듈은 **Electron 기반 데스크톱 애플리케이션**에서 사용하기 위해 개발되었습니다. 로컬 폴더에 저장된 DOCX 형식의 이력서 파일들을 분석하여, 채용 공고와의 적합도를 알고리즘 기반으로 점수화합니다.

### 주요 특징

- **로컬 파일 기반**: 인터넷 연결 없이도 작동 가능 (API 호출 제외)
- **DOCX 파싱**: Microsoft Word 이력서 파일 직접 분석
- **알고리즘 기반 평가**: AI 비용 절감을 위한 순수 알고리즘 점수 산출
- **커리어넷 API 연동**: 직종, 학과, 자격증 데이터 활용
- **유연한 데이터 매핑**: 다양한 이력서 형식에 대응 가능한 구조

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

## 사용법

### 기본 사용

```typescript
import { calculateAllScores } from 'career-fit-scoring';

// DOCX 파일에서 파싱한 이력서 데이터
const applicationData = {
  birthDate: '1990-01-01',
  certificateName1: '정보처리기사',
  certificateName2: 'SQLD',
  careerStartDate1: '2020-01-01',
  careerEndDate1: '2024-12-31',
  careerJobType1: '소프트웨어 개발자', // 자유 입력 (나중에 매핑)
  careerEmploymentStatus1: '퇴사',
  universityDegreeType1: '학사',
  universityGraduationType1: '졸업',
  universityMajor1_1: '컴퓨터공학과',
  universityGPA1: '3.8',
  universityGPAMax1: '4.5',
};

// 채용 공고 메타데이터
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

## 데이터 매핑

### 현재 상태

이 모듈은 **점수 계산 알고리즘**에 집중되어 있으며, 이력서 파싱 및 데이터 매핑은 **추후 구현 예정**입니다.

### 계획된 기능

1. **DOCX 파싱**: `mammoth` 또는 `docx` 라이브러리를 사용하여 이력서 파일에서 텍스트 추출
2. **자유 형식 경력 분석**: 
   - 자연어 처리(NLP)를 통한 경력 정보 추출
   - 커리어넷 API를 활용한 직종 자동 매칭
   - 사용자 확인/수정 기능 제공
3. **데이터 정규화**: 다양한 형식의 이력서를 표준 형식으로 변환

### 데이터 구조

이력서에서 추출해야 하는 주요 정보:

```typescript
interface ResumeData {
  // 기본 정보
  birthDate?: string;
  name?: string;
  email?: string;
  phone?: string;
  
  // 자격증 (최대 10개)
  certificateName1?: string;
  // ... certificateName10
  
  // 경력 (최대 5개)
  // 주의: 자유 형식 입력이므로 매핑 필요
  careerStartDate1?: string;
  careerEndDate1?: string;
  careerJobType1?: string; // 자유 입력 → 커리어넷 API로 매핑 필요
  careerJobTypeCode1?: string; // 매핑 후 자동 설정
  careerJobTypeAptdCode1?: string; // 매핑 후 자동 설정
  careerEmploymentStatus1?: string;
  careerCompanyName1?: string;
  // ... careerStartDate5 ~ careerCompanyName5
  
  // 학력
  highSchoolName?: string;
  highSchoolGraduationType?: string;
  universityName1?: string;
  universityDegreeType1?: string;
  universityGraduationType1?: string;
  universityMajor1_1?: string;
  universityMajorSeq1_1?: string;
  universityMajorNm1_1?: string;
  universityGPA1?: string;
  universityGPAMax1?: string;
  // ... (최대 5개)
  
  // 대학원
  graduateSchoolName1?: string;
  graduateSchoolDegreeType1?: string;
  // ... (최대 5개)
}
```

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

## 개발 로드맵

### Phase 1: 핵심 알고리즘 ✅ (완료)
- [x] 점수 계산 알고리즘 구현
- [x] 커리어넷 API 연동
- [x] Q-Net API 연동
- [x] 서버 사이드 지원

### Phase 2: 이력서 파싱 (진행 예정)
- [ ] DOCX 파일 파싱 모듈
- [ ] 텍스트 추출 및 구조화
- [ ] 기본 정보 추출 (이름, 연락처, 생년월일 등)

### Phase 3: 경력 매핑 (진행 예정)
- [ ] 자연어 처리 기반 경력 정보 추출
- [ ] 커리어넷 API를 활용한 직종 자동 매핑
- [ ] 사용자 확인/수정 UI
- [ ] 매핑 결과 저장

### Phase 4: Electron 앱 통합 (진행 예정)
- [ ] Electron 프로젝트 설정
- [ ] 폴더 선택 및 파일 스캔
- [ ] 배치 처리 기능
- [ ] 결과 시각화

## 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

## 참고 문서

- [EXAMPLES.md](./EXAMPLES.md) - 상세 사용 예제 및 데이터 구조
- [CHANGELOG.md](./CHANGELOG.md) - 변경 이력
