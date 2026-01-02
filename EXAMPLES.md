# 사용 예제

## 기본 사용법

### 1. 점수 계산

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

### 2. 개별 점수 계산

```typescript
import {
  calculateCertificationScore,
  calculateCareerScore,
  calculateEducationScore,
  extractCertifications,
  extractCareers,
  extractEducations,
} from 'career-fit-scoring';

// 자격증 점수만 계산
const certScore = calculateCertificationScore({
  applicantCertifications: ['정보처리기사', 'SQLD'],
  requiredCertifications: ['정보처리기사'],
  relatedCertifications: ['SQLD', 'OCP']
});

// 경력 점수만 계산
const careers = extractCareers(applicationData);
const careerScore = calculateCareerScore(
  careers,
  'A001', // jobAptdCode
  '12345', // jobdicSeq
  30 // applicantAge
);

// 학력 점수만 계산
const educations = extractEducations(applicationData);
const educationScore = calculateEducationScore(
  educations,
  '컴퓨터공학과', // jobMajorNm
  '255', // jobMajorSeq
  [{ majorNm: '컴퓨터공학과', majorSeq: '255' }] // jobRelatedMajors
);
```

### 3. 커리어넷 API 사용

```typescript
import { searchJobs, getJobDetail, searchMajors } from 'career-fit-scoring';

// 직종 검색
const jobs = await searchJobs();
console.log('총 직종 수:', jobs.length);

// 특정 직종 상세 정보 조회
const jobDetail = await getJobDetail('12345');
console.log('관련 자격증:', jobDetail?.capacity_major?.content?.[0]?.capacity);
console.log('관련 학과:', jobDetail?.capacity_major?.content?.[0]?.major);

// 학과 검색
const majors = await searchMajors('univ_list');
console.log('총 학과 수:', majors.length);
```

### 4. Q-Net API 사용

```typescript
import { searchCertifications } from 'career-fit-scoring';

// 국가자격증 검색 (서버 프록시 필요)
const certifications = await searchCertifications(
  undefined, // API 키 (기본값 사용)
  '/api/proxy/qnet' // 프록시 URL
);
console.log('총 자격증 수:', certifications.length);
```

### 5. 자격증 파싱

```typescript
import {
  parseOfficialCertificates,
  parseAdditionalNationalCertificates,
  ADDITIONAL_NATIONAL_CERTIFICATES,
} from 'career-fit-scoring';

// 공인민간자격증 파일 파싱
const fileContent = `...`; // 탭으로 구분된 파일 내용
const officialCerts = parseOfficialCertificates(fileContent);

// 추가 국가자격증 파싱
const additionalCerts = parseAdditionalNationalCertificates(ADDITIONAL_NATIONAL_CERTIFICATES);

// 모든 자격증 통합
const allCerts = [...officialCerts, ...additionalCerts];
```

## 데이터 구조

### applicationData 구조

```typescript
interface ApplicationData {
  // 기본 정보
  birthDate?: string; // 'YYYY-MM-DD'
  
  // 자격증 (최대 10개)
  certificateName1?: string;
  certificateName2?: string;
  // ... certificateName10
  
  // 경력 (최대 5개)
  careerStartDate1?: string;
  careerEndDate1?: string;
  careerJobType1?: string; // 직종명
  careerJobTypeCode1?: string; // jobdicSeq
  careerJobTypeAptdCode1?: string; // aptd_type_code
  careerEmploymentStatus1?: string; // '재직중' | '퇴사' 등
  careerCompanyName1?: string;
  careerDepartment1?: string;
  careerPosition1?: string;
  // ... careerStartDate5 ~ careerPosition5
  
  // 학력
  // 고등학교
  highSchoolName?: string;
  highSchoolGraduationType?: string; // '졸업' | '검정고시'
  
  // 대학교 (최대 5개)
  universityName1?: string;
  universityDegreeType1?: string; // '전문학사' | '학사'
  universityGraduationType1?: string; // '졸업' | '졸업예정' | '재학중' 등
  universityGPA1?: string;
  universityGPAMax1?: string;
  universityMajor1_1?: string; // 전공명 (최대 4개)
  universityMajorSeq1_1?: string; // 전공 코드
  universityMajorNm1_1?: string; // 전공명 (정확한 이름)
  // ... universityName5 ~ universityMajor5_4
  
  // 대학원 (최대 5개)
  graduateSchoolName1?: string;
  graduateSchoolDegreeType1?: string; // '석사' | '박사'
  graduateSchoolGraduationType1?: string;
  graduateSchoolGPA1?: string;
  graduateSchoolGPAMax1?: string;
  graduateSchoolMajor1_1?: string;
  graduateSchoolMajorSeq1_1?: string;
  graduateSchoolMajorNm1_1?: string;
  // ... graduateSchoolName5 ~ graduateSchoolMajor5_4
}
```

### jobMetadata 구조

```typescript
interface JobMetadata {
  jobdicSeq?: string; // 직종 코드
  jobAptdCode?: string; // 직종 aptd_type_code
  requiredCertifications?: string[]; // 필수 자격증 목록
  relatedCertifications?: string[]; // 관련 자격증 목록
  relatedMajors?: Array<{ // 관련 학과 목록
    majorNm: string;
    majorSeq: string;
  }>;
  relatedMajorNm?: string; // 하위 호환성용
  relatedMajorSeq?: string; // 하위 호환성용
  scoringWeights?: { // 점수 비중
    certification: number;
    career: number;
    education: number;
  };
}
```

## 서버 프록시 예제 (Node.js/Express)

Q-Net API는 HTTP만 지원하므로, HTTPS 환경에서는 서버 프록시가 필요합니다.

```javascript
// server/index.js
app.post('/api/proxy/qnet', async (req, res) => {
  try {
    const { url } = req.body;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```
