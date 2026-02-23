/**
 * Career Fit Scoring — Core Module
 *
 * 이력서(DOCX/PDF) 파싱·매핑, 자격증 파싱, (선택) 알고리즘 점수·커리어넷/Q-Net API 클라이언트.
 * Electron 앱에서는 평가에 AI 결과를 사용하며, 알고리즘 점수·API는 라이브러리/설정 데이터용.
 */

// 점수 계산 함수들
export {
  calculateCertificationScore,
  calculateCareerScore,
  calculateEducationScore,
  calculateTotalScore,
  calculateAllScores,
  calculateRelatedMajorScore,
  calculateGpaScore,
  extractCertifications,
  extractCareers,
  extractEducations,
  type CertificationScoreParams,
  type ScoringWeights,
  type CareerInfo,
  type EducationInfo,
} from './scoring';

// API 연동 함수들
export {
  searchJobs,
  getJobDetail,
  searchMajors,
  type CareerNetJob,
  type CareerNetJobDetail,
  type CareerNetMajor,
} from './api/careernet';

export {
  searchCertifications,
  type QNetCertification,
} from './api/qnet';

// 자격증 파싱 함수들
export {
  parseOfficialCertificates,
  parseAdditionalNationalCertificates,
  ADDITIONAL_NATIONAL_CERTIFICATES,
} from './certificateParser';

// DOCX 파싱 함수들
export {
  extractTablesFromDocx,
  getCellValue,
  findRowByText,
  findColumnByText,
  type RawTableData,
  type RawTableRow,
  type RawTableCell,
} from './docxParser';

// 이력서 매핑 함수들
export {
  mapResumeDataToApplicationData,
  DEFAULT_RESUME_MAPPING,
  type ResumeMappingConfig,
} from './resumeMapping';
