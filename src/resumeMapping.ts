/**
 * 이력서 데이터 매핑 설정 및 변환 유틸리티
 * 
 * DOCX에서 추출한 원시 데이터를 점수 계산 로직에 사용할 수 있는 형식으로 변환합니다.
 * 이력서 폼이 바뀌면 이 파일의 매핑 설정만 수정하면 됩니다.
 */

import { RawTableData, getCellValue, findRowByText, findColumnByText } from './docxParser';

/**
 * 매핑 설정 인터페이스
 * 이력서 폼이 바뀌면 이 설정만 수정하면 됩니다.
 */
export interface ResumeMappingConfig {
  // 기본 정보
  basicInfo: {
    tableIndex: number;
    name?: { rowIndex: number; cellIndex: number } | { searchRow: string; searchCol: string };
    nameEnglish?: { rowIndex: number; cellIndex: number } | { searchRow: string; searchCol: string };
    birthDate?: { rowIndex: number; cellIndex: number } | { searchRow: string; searchCol: string };
    email?: { rowIndex: number; cellIndex: number } | { searchRow: string; searchCol: string };
    phone?: { rowIndex: number; cellIndex: number } | { searchRow: string; searchCol: string };
    phoneHome?: { rowIndex: number; cellIndex: number } | { searchRow: string; searchCol: string };
    address?: { rowIndex: number; cellIndex: number } | { searchRow: string; searchCol: string };
    desiredSalary?: { rowIndex: number; cellIndex: number } | { searchRow: string; searchCol: string };
    photo?: { rowIndex: number; cellIndex: number }; // 증명사진 위치
    militaryService?: { rowIndex: number; cellIndexStart: number; cellIndexEnd: number }; // 병역 정보 (여러 셀)
  };
  
  // 자격증 정보
  certificates: {
    tableIndex: number;
    headerRowIndex?: number; // 헤더 행 인덱스 (없으면 0)
    dataStartRowIndex?: number; // 데이터 시작 행 인덱스 (없으면 headerRowIndex + 1)
    dataEndRowIndex?: number; // 데이터 종료 행 인덱스
    nameColumn?: number | { searchText: string }; // 자격증명 열
    gradeColumn?: number | { searchText: string }; // 등급/점수 열
    issuerColumn?: number | { searchText: string }; // 발행기관 열
    dateColumn?: number | { searchText: string }; // 취득일 열
    maxCount?: number; // 최대 개수 (기본값: 10)
  };
  
  // 어학 정보
  languageTests?: {
    tableIndex: number;
    headerRowIndex?: number;
    dataStartRowIndex?: number;
    dataEndRowIndex?: number;
    nameColumn?: number | { searchText: string }; // 어학종류명
    scoreColumn?: number | { searchText: string }; // 점수/등급
    dateColumn?: number | { searchText: string }; // 취득일자
    maxCount?: number;
  };
  
  // 해외연수 정보
  overseasTraining?: {
    tableIndex: number;
    headerRowIndex?: number;
    dataStartRowIndex?: number;
    dataEndRowIndex?: number;
    countryColumn?: number | { searchText: string }; // 연수 국가
    durationColumn?: number | { searchText: string }; // 거주기간
    purposeColumn?: number | { searchText: string }; // 거주목적
    maxCount?: number;
  };
  
  // 수상경력 정보
  awards?: {
    tableIndex: number;
    headerRowIndex?: number;
    dataStartRowIndex?: number;
    dataEndRowIndex?: number;
    nameColumn?: number | { searchText: string }; // 수상명
    organizationColumn?: number | { searchText: string }; // 수상기관
    detailColumn?: number | { searchText: string }; // 수상내역
    maxCount?: number;
  };
  
  // 자기소개서
  selfIntroduction?: {
    tableIndex: number;
    answers: Array<{ rowIndex: number; cellIndex: number }>; // 각 답안의 위치
  };
  
  // 경력 정보
  careers: {
    tableIndex: number;
    headerRowIndex?: number;
    dataStartRowIndex?: number;
    companyNameColumn?: number | { searchText: string };
    startDateColumn?: number | { searchText: string };
    endDateColumn?: number | { searchText: string };
    jobTypeColumn?: number | { searchText: string };
    employmentStatusColumn?: number | { searchText: string };
    maxCount?: number; // 최대 개수 (기본값: 5)
  };
  
  // 학력 정보
  education: {
    tableIndex: number;
    headerRowIndex?: number;
    dataStartRowIndex?: number;
    schoolNameColumn?: number | { searchText: string };
    degreeTypeColumn?: number | { searchText: string };
    graduationTypeColumn?: number | { searchText: string };
    majorColumn?: number | { searchText: string };
    gpaColumn?: number | { searchText: string };
    maxGpaColumn?: number | { searchText: string };
    maxCount?: number; // 최대 개수 (기본값: 5)
  };
  
  // 경력기술 상세 (테이블 6)
  careerDetails?: {
    tableIndex: number;
    blocks: Array<{
      headerRowIndex: number; // 입사년월 등 헤더 행 (row 1, 5, 9, 13)
      dataRowIndex: number; // 실제 데이터 행 (row 2, 6, 10, 14)
      detailRowIndex: number; // 상세내용 행 (row 4, 8, 12, 16)
    }>;
    startDateColumn: number; // cell 0
    endDateColumn: number; // cell 1
    companyNameColumn: number; // cell 2
    departmentColumn: number; // cell 3
    positionColumn: number; // cell 4
    salaryColumn: number; // cell 5
    reasonColumn: number; // cell 6
    detailColumn: number; // cell 0 (상세내용)
    maxCount?: number;
  };
}

/**
 * 기본 매핑 설정
 * resume_form.docx 양식에 맞게 설정됨
 */
export const DEFAULT_RESUME_MAPPING: ResumeMappingConfig = {
  basicInfo: {
    tableIndex: 0, // 테이블 0: 기본 인적사항 (기존 table1에서 변경)
    // (1,1): 한글이름 + 한문이름
    name: { rowIndex: 1, cellIndex: 1 },
    // (2,1): 영문이름
    nameEnglish: { rowIndex: 2, cellIndex: 1 },
    // (1,5): 희망연봉
    desiredSalary: { rowIndex: 1, cellIndex: 5 },
    // (2,5): 증명사진
    photo: { rowIndex: 2, cellIndex: 5 },
    // (3,1): 생년월일
    birthDate: { rowIndex: 3, cellIndex: 1 },
    // (3,4): 이메일
    email: { rowIndex: 3, cellIndex: 4 },
    // (4,1): 현재 주소지
    address: { rowIndex: 4, cellIndex: 1 },
    // (5,1): 연락처 (기존 자택전화번호 자리, 이제 하나만 사용)
    phone: { rowIndex: 5, cellIndex: 1 },
    // (6,1): 병역사항 (필/미필/면제/해당없음) - 기존 이동전화번호 자리
    militaryService: { rowIndex: 6, cellIndexStart: 1, cellIndexEnd: 1 }, // 단일 셀
  },
  certificates: {
    tableIndex: 3, // 테이블 3: 자격사항 (기존 table4에서 변경)
    headerRowIndex: 1,
    dataStartRowIndex: 2, // row 2~4
    dataEndRowIndex: 4,
    // (2~4,3): 자격증 이름
    nameColumn: 3,
    // (2~4,4): 등급/점수
    gradeColumn: 4,
    // (2~4,5): 발행기관
    issuerColumn: 5,
    maxCount: 3,
  },
  languageTests: {
    tableIndex: 3, // 테이블 3: 어학 정보 (기존 table4에서 변경)
    headerRowIndex: 1,
    dataStartRowIndex: 2, // row 2~4
    dataEndRowIndex: 4,
    // (2~4,0): 어학종류명
    nameColumn: 0,
    // (2~4,1): 점수/등급
    scoreColumn: 1,
    // (2~4,2): 취득일자
    dateColumn: 2,
    maxCount: 3,
  },
  careers: {
    tableIndex: 2, // 테이블 2: 경력사항 (기존 table3에서 변경)
    headerRowIndex: 1,
    dataStartRowIndex: 2, // row 2~6
    // (2~6,2): 회사명
    companyNameColumn: 2,
    // (2~6,0): 입사년월
    startDateColumn: 0,
    // (2~6,1): 퇴사년월
    endDateColumn: 1,
    // (2~6,4): 직위
    jobTypeColumn: 4,
    // (2~6,6): 이직사유
    employmentStatusColumn: 6,
    maxCount: 5,
  },
  education: {
    tableIndex: 1, // 테이블 1: 학력사항 (기존 table2에서 변경)
    headerRowIndex: 1,
    dataStartRowIndex: 2, // row 2~7
    // (2~7,2): 학교명
    schoolNameColumn: 2,
    // (2~7,6): 졸업구분
    graduationTypeColumn: 6,
    // (2~7,3): 전공명
    majorColumn: 3,
    // (2~7,4): 학점 (평균점수/총점수 형식)
    gpaColumn: 4,
    maxCount: 6,
  },
  overseasTraining: {
    tableIndex: 3, // 테이블 3: 해외연수 (기존 table4에서 변경)
    headerRowIndex: 5,
    dataStartRowIndex: 6, // row 6~8
    dataEndRowIndex: 8,
    // (6~8,0): 연수 국가
    countryColumn: 0,
    // (6~8,1): 거주기간
    durationColumn: 1,
    // (6~8,2): 거주목적
    purposeColumn: 2,
    maxCount: 3,
  },
  awards: {
    tableIndex: 3, // 테이블 3: 수상경력 (기존 table4에서 변경)
    headerRowIndex: 5,
    dataStartRowIndex: 6, // row 6~8
    dataEndRowIndex: 8,
    // (6~8,3): 수상명
    nameColumn: 3,
    // (6~8,4): 수상기관
    organizationColumn: 4,
    // (6~8,5): 수상내역
    detailColumn: 5,
    maxCount: 3,
  },
  selfIntroduction: {
    tableIndex: 4, // 테이블 4: 자기소개서 (기존 table5에서 변경)
    answers: [
      { rowIndex: 1, cellIndex: 1 }, // 자기소개서 답안 1
      { rowIndex: 3, cellIndex: 1 }, // 자기소개서 답안 2
      { rowIndex: 5, cellIndex: 1 }, // 자기소개서 답안 3
      { rowIndex: 7, cellIndex: 1 }, // 자기소개서 답안 4
    ],
  },
  careerDetails: {
    tableIndex: 5, // 테이블 5: 경력기술 상세 (기존 table6에서 변경)
    blocks: [
      { headerRowIndex: 1, dataRowIndex: 2, detailRowIndex: 4 }, // 첫 번째 경력 (row 1~4)
      { headerRowIndex: 5, dataRowIndex: 6, detailRowIndex: 8 }, // 두 번째 경력 (row 5~8)
      { headerRowIndex: 9, dataRowIndex: 10, detailRowIndex: 12 }, // 세 번째 경력 (row 9~12)
      { headerRowIndex: 13, dataRowIndex: 14, detailRowIndex: 16 }, // 네 번째 경력 (row 13~16)
    ],
    startDateColumn: 0, // 입사년월
    endDateColumn: 1, // 퇴사년월
    companyNameColumn: 2, // 회사명
    departmentColumn: 3, // 근무부서
    positionColumn: 4, // 직위
    salaryColumn: 5, // 연봉
    reasonColumn: 6, // 이직사유
    detailColumn: 0, // 상세내용 (cell 0)
    maxCount: 4,
  },
};

/**
 * 셀 위치 해석 (직접 인덱스 또는 검색 텍스트)
 */
function resolveCellPosition(
  tables: RawTableData[],
  tableIndex: number,
  position: { rowIndex: number; cellIndex: number } | { searchRow: string; searchCol: string } | undefined,
  defaultRowIndex?: number
): { rowIndex: number; cellIndex: number } | null {
  if (!position) return null;
  
  if ('rowIndex' in position && 'cellIndex' in position) {
    // 직접 인덱스
    return { rowIndex: position.rowIndex, cellIndex: position.cellIndex };
  }
  
  if ('searchRow' in position && 'searchCol' in position) {
    // 검색 텍스트로 찾기
    const rowIndex = findRowByText(tables, tableIndex, position.searchRow);
    if (rowIndex === -1) return null;
    
    const cellIndex = findColumnByText(tables, tableIndex, position.searchCol, rowIndex);
    if (cellIndex === -1) return null;
    
    return { rowIndex, cellIndex };
  }
  
  return null;
}

/**
 * 열 위치 해석 (직접 인덱스 또는 검색 텍스트)
 */
function resolveColumnIndex(
  tables: RawTableData[],
  tableIndex: number,
  position: number | { searchText: string } | undefined,
  headerRowIndex: number = 0
): number {
  if (position === undefined) return -1;
  
  if (typeof position === 'number') {
    return position;
  }
  
  if ('searchText' in position) {
    return findColumnByText(tables, tableIndex, position.searchText, headerRowIndex);
  }
  
  return -1;
}

/**
 * 셀 값 안전하게 추출 (탐지 실패 시 undefined)
 */
function safeGetCellValue(
  tables: RawTableData[],
  tableIndex: number,
  rowIndex: number,
  cellIndex: number
): string | undefined {
  try {
    const value = getCellValue(tables, tableIndex, rowIndex, cellIndex);
    return value || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 주소 문자열을 거주지 카테고리로 분류
 * 
 * @param address 주소 문자열
 * @returns 거주지 카테고리 (서울, 수도권, 시흥, 안산, 지방)
 */
export function classifyResidence(address: string | undefined): string | undefined {
  if (!address) return undefined;
  
  const addressLower = address.toLowerCase();
  
  // 시흥시 체크 (가장 가까운 도시)
  if (addressLower.includes('시흥') || addressLower.includes('시흥시')) {
    return '시흥';
  }
  
  // 안산시 체크 (가장 가까운 도시)
  if (addressLower.includes('안산') || addressLower.includes('안산시')) {
    return '안산';
  }
  
  // 서울 체크
  if (addressLower.includes('서울') || addressLower.includes('서울시') || addressLower.includes('서울특별시')) {
    return '서울';
  }
  
  // 수도권 체크 (경기도, 인천 등)
  if (
    addressLower.includes('경기') ||
    addressLower.includes('경기도') ||
    addressLower.includes('인천') ||
    addressLower.includes('인천시') ||
    addressLower.includes('인천광역시') ||
    addressLower.includes('수원') ||
    addressLower.includes('성남') ||
    addressLower.includes('고양') ||
    addressLower.includes('용인') ||
    addressLower.includes('부천') ||
    addressLower.includes('안양') ||
    addressLower.includes('평택') ||
    addressLower.includes('의정부') ||
    addressLower.includes('광명') ||
    addressLower.includes('과천') ||
    addressLower.includes('구리') ||
    addressLower.includes('남양주') ||
    addressLower.includes('오산') ||
    addressLower.includes('의왕') ||
    addressLower.includes('이천') ||
    addressLower.includes('하남') ||
    addressLower.includes('화성')
  ) {
    return '수도권';
  }
  
  // 그 외는 지방
  return '지방';
}

/**
 * DOCX에서 추출한 테이블 데이터를 점수 계산 로직에 사용할 수 있는 형식으로 변환
 * 
 * @param tables DOCX에서 추출한 원시 테이블 데이터
 * @param mappingConfig 매핑 설정 (기본값: DEFAULT_RESUME_MAPPING)
 * @returns 점수 계산 로직에 사용할 수 있는 applicationData 형식
 */
export function mapResumeDataToApplicationData(
  tables: RawTableData[],
  mappingConfig: ResumeMappingConfig = DEFAULT_RESUME_MAPPING
): any {
  const applicationData: any = {};
  
  // 1. 기본 정보 추출
  const basicInfo = mappingConfig.basicInfo;
  if (basicInfo.tableIndex >= 0 && basicInfo.tableIndex < tables.length) {
    const namePos = resolveCellPosition(tables, basicInfo.tableIndex, basicInfo.name);
    applicationData.name = namePos ? safeGetCellValue(tables, basicInfo.tableIndex, namePos.rowIndex, namePos.cellIndex) : undefined;
    
    const nameEnglishPos = resolveCellPosition(tables, basicInfo.tableIndex, basicInfo.nameEnglish);
    applicationData.nameEnglish = nameEnglishPos ? safeGetCellValue(tables, basicInfo.tableIndex, nameEnglishPos.rowIndex, nameEnglishPos.cellIndex) : undefined;
    
    const birthDatePos = resolveCellPosition(tables, basicInfo.tableIndex, basicInfo.birthDate);
    applicationData.birthDate = birthDatePos ? safeGetCellValue(tables, basicInfo.tableIndex, birthDatePos.rowIndex, birthDatePos.cellIndex) : undefined;
    
    const emailPos = resolveCellPosition(tables, basicInfo.tableIndex, basicInfo.email);
    applicationData.email = emailPos ? safeGetCellValue(tables, basicInfo.tableIndex, emailPos.rowIndex, emailPos.cellIndex) : undefined;
    
    const phonePos = resolveCellPosition(tables, basicInfo.tableIndex, basicInfo.phone);
    applicationData.phone = phonePos ? safeGetCellValue(tables, basicInfo.tableIndex, phonePos.rowIndex, phonePos.cellIndex) : undefined;
    
    const phoneHomePos = resolveCellPosition(tables, basicInfo.tableIndex, basicInfo.phoneHome);
    applicationData.phoneHome = phoneHomePos ? safeGetCellValue(tables, basicInfo.tableIndex, phoneHomePos.rowIndex, phoneHomePos.cellIndex) : undefined;
    
    const addressPos = resolveCellPosition(tables, basicInfo.tableIndex, basicInfo.address);
    const addressValue = addressPos ? safeGetCellValue(tables, basicInfo.tableIndex, addressPos.rowIndex, addressPos.cellIndex) : undefined;
    applicationData.address = addressValue;
    applicationData.residence = classifyResidence(addressValue);
    
    const desiredSalaryPos = resolveCellPosition(tables, basicInfo.tableIndex, basicInfo.desiredSalary);
    applicationData.desiredSalary = desiredSalaryPos ? safeGetCellValue(tables, basicInfo.tableIndex, desiredSalaryPos.rowIndex, desiredSalaryPos.cellIndex) : undefined;
    
    // 병역 정보 (단일 셀: 필/미필/면제/해당없음)
    if (basicInfo.militaryService) {
      const milRow = basicInfo.militaryService.rowIndex;
      const milStart = basicInfo.militaryService.cellIndexStart;
      const milEnd = basicInfo.militaryService.cellIndexEnd;
      // 단일 셀만 읽기
      const milValue = safeGetCellValue(tables, basicInfo.tableIndex, milRow, milStart);
      applicationData.militaryService = milValue || undefined;
    }
  }
  
  // 2. 학력 정보 추출
  const education = mappingConfig.education;
  if (education.tableIndex >= 0 && education.tableIndex < tables.length) {
    const headerRowIndex = education.headerRowIndex ?? 0;
    const dataStartRowIndex = education.dataStartRowIndex ?? headerRowIndex + 1;
    const dataEndRowIndex = education.dataStartRowIndex !== undefined ? (education.maxCount ? dataStartRowIndex + education.maxCount - 1 : undefined) : undefined;
    const schoolNameCol = resolveColumnIndex(tables, education.tableIndex, education.schoolNameColumn, headerRowIndex);
    const graduationTypeCol = resolveColumnIndex(tables, education.tableIndex, education.graduationTypeColumn, headerRowIndex);
    const majorCol = resolveColumnIndex(tables, education.tableIndex, education.majorColumn, headerRowIndex);
    const gpaCol = resolveColumnIndex(tables, education.tableIndex, education.gpaColumn, headerRowIndex);
    const maxCount = education.maxCount ?? 6;
    
    const table = tables[education.tableIndex];
    let eduIndex = 1;
    
    const endRow = dataEndRowIndex !== undefined ? Math.min(dataEndRowIndex + 1, table.rows.length) : table.rows.length;
    for (let rowIdx = dataStartRowIndex; rowIdx < endRow && eduIndex <= maxCount; rowIdx++) {
      const row = table.rows[rowIdx];
      
      // 빈 행이면 건너뛰기
      if (row.cells.every(cell => !cell.text.trim())) {
        continue;
      }
      
      // 입학년월 (cell 0)
      const startDate = safeGetCellValue(tables, education.tableIndex, rowIdx, 0);
      if (startDate) applicationData[`educationStartDate${eduIndex}`] = startDate;
      
      // 졸업년월 (cell 1)
      const endDate = safeGetCellValue(tables, education.tableIndex, rowIdx, 1);
      if (endDate) applicationData[`educationEndDate${eduIndex}`] = endDate;
      
      // 학교명 (cell 2)
      if (schoolNameCol >= 0 && schoolNameCol < row.cells.length) {
        const schoolName = safeGetCellValue(tables, education.tableIndex, rowIdx, schoolNameCol);
        if (schoolName) {
          applicationData[`universityName${eduIndex}`] = schoolName;
          
          // 전공명 (cell 3)
          if (majorCol >= 0 && majorCol < row.cells.length) {
            const major = safeGetCellValue(tables, education.tableIndex, rowIdx, majorCol);
            if (major) applicationData[`universityMajor${eduIndex}_1`] = major;
          }
          
          // 학점 (cell 4) - 평균점수/총점수 형식
          if (gpaCol >= 0 && gpaCol < row.cells.length) {
            const gpa = safeGetCellValue(tables, education.tableIndex, rowIdx, gpaCol);
            if (gpa) {
              applicationData[`universityGPA${eduIndex}`] = gpa;
              // 평균점수/총점수 파싱
              const parts = gpa.split('/');
              if (parts.length === 2) {
                applicationData[`universityGPA${eduIndex}`] = parts[0].trim();
                applicationData[`universityGPAMax${eduIndex}`] = parts[1].trim();
              }
            }
          }
          
          // 소재지 (cell 5)
          const location = safeGetCellValue(tables, education.tableIndex, rowIdx, 5);
          if (location) applicationData[`universityLocation${eduIndex}`] = location;
          
          // 졸업구분 (cell 6)
          if (graduationTypeCol >= 0 && graduationTypeCol < row.cells.length) {
            const graduationType = safeGetCellValue(tables, education.tableIndex, rowIdx, graduationTypeCol);
            if (graduationType) applicationData[`universityGraduationType${eduIndex}`] = graduationType;
          }
          
          eduIndex++;
        }
      }
    }
  }
  
  // 3. 경력 정보 추출 (테이블 3)
  const careers = mappingConfig.careers;
  if (careers.tableIndex >= 0 && careers.tableIndex < tables.length) {
    const headerRowIndex = careers.headerRowIndex ?? 0;
    const dataStartRowIndex = careers.dataStartRowIndex ?? headerRowIndex + 1;
    const companyCol = resolveColumnIndex(tables, careers.tableIndex, careers.companyNameColumn, headerRowIndex);
    const startDateCol = resolveColumnIndex(tables, careers.tableIndex, careers.startDateColumn, headerRowIndex);
    const endDateCol = resolveColumnIndex(tables, careers.tableIndex, careers.endDateColumn, headerRowIndex);
    const jobTypeCol = resolveColumnIndex(tables, careers.tableIndex, careers.jobTypeColumn, headerRowIndex);
    const employmentStatusCol = resolveColumnIndex(tables, careers.tableIndex, careers.employmentStatusColumn, headerRowIndex);
    const maxCount = careers.maxCount ?? 5;
    
    const table = tables[careers.tableIndex];
    let careerIndex = 1;
    
    for (let rowIdx = dataStartRowIndex; rowIdx < table.rows.length && careerIndex <= maxCount; rowIdx++) {
      const row = table.rows[rowIdx];
      
      // 빈 행이면 건너뛰기
      if (row.cells.every(cell => !cell.text.trim())) {
        continue;
      }
      
      if (companyCol >= 0 && companyCol < row.cells.length) {
        const companyName = safeGetCellValue(tables, careers.tableIndex, rowIdx, companyCol);
        if (companyName) {
          applicationData[`careerCompanyName${careerIndex}`] = companyName;
          
          if (startDateCol >= 0 && startDateCol < row.cells.length) {
            const startDate = safeGetCellValue(tables, careers.tableIndex, rowIdx, startDateCol);
            if (startDate) applicationData[`careerStartDate${careerIndex}`] = startDate;
          }
          
          if (endDateCol >= 0 && endDateCol < row.cells.length) {
            const endDate = safeGetCellValue(tables, careers.tableIndex, rowIdx, endDateCol);
            if (endDate) applicationData[`careerEndDate${careerIndex}`] = endDate;
          }
          
          // 근무부서 (cell 3)
          const department = safeGetCellValue(tables, careers.tableIndex, rowIdx, 3);
          if (department) applicationData[`careerDepartment${careerIndex}`] = department;
          
          if (jobTypeCol >= 0 && jobTypeCol < row.cells.length) {
            const jobType = safeGetCellValue(tables, careers.tableIndex, rowIdx, jobTypeCol);
            if (jobType) applicationData[`careerJobType${careerIndex}`] = jobType;
          }
          
          // 연봉 (cell 5)
          const salary = safeGetCellValue(tables, careers.tableIndex, rowIdx, 5);
          if (salary) applicationData[`careerSalary${careerIndex}`] = salary;
          
          if (employmentStatusCol >= 0 && employmentStatusCol < row.cells.length) {
            const employmentStatus = safeGetCellValue(tables, careers.tableIndex, rowIdx, employmentStatusCol);
            if (employmentStatus) applicationData[`careerEmploymentStatus${careerIndex}`] = employmentStatus;
          }
          
          careerIndex++;
        }
      }
    }
  }
  
  // 4. 자격증 정보 추출
  const certs = mappingConfig.certificates;
  if (certs.tableIndex >= 0 && certs.tableIndex < tables.length) {
    const headerRowIndex = certs.headerRowIndex ?? 0;
    const dataStartRowIndex = certs.dataStartRowIndex ?? headerRowIndex + 1;
    const dataEndRowIndex = certs.dataEndRowIndex ?? dataStartRowIndex;
    const nameCol = resolveColumnIndex(tables, certs.tableIndex, certs.nameColumn, headerRowIndex);
    const gradeCol = resolveColumnIndex(tables, certs.tableIndex, certs.gradeColumn, headerRowIndex);
    const issuerCol = resolveColumnIndex(tables, certs.tableIndex, certs.issuerColumn, headerRowIndex);
    const maxCount = certs.maxCount ?? 3;
    
    const table = tables[certs.tableIndex];
    let certIndex = 1;
    
    for (let rowIdx = dataStartRowIndex; rowIdx <= dataEndRowIndex && rowIdx < table.rows.length && certIndex <= maxCount; rowIdx++) {
      const row = table.rows[rowIdx];
      
      if (nameCol >= 0 && nameCol < row.cells.length) {
        const certName = safeGetCellValue(tables, certs.tableIndex, rowIdx, nameCol);
        if (certName) {
          applicationData[`certificateName${certIndex}`] = certName;
          
          if (gradeCol >= 0 && gradeCol < row.cells.length) {
            const grade = safeGetCellValue(tables, certs.tableIndex, rowIdx, gradeCol);
            if (grade) applicationData[`certificateGrade${certIndex}`] = grade;
          }
          
          if (issuerCol >= 0 && issuerCol < row.cells.length) {
            const issuer = safeGetCellValue(tables, certs.tableIndex, rowIdx, issuerCol);
            if (issuer) applicationData[`certificateIssuer${certIndex}`] = issuer;
          }
          
          certIndex++;
        }
      }
    }
  }
  
  // 5. 어학 정보 추출
  if (mappingConfig.languageTests) {
    const langTests = mappingConfig.languageTests;
    if (langTests.tableIndex >= 0 && langTests.tableIndex < tables.length) {
      const headerRowIndex = langTests.headerRowIndex ?? 0;
      const dataStartRowIndex = langTests.dataStartRowIndex ?? headerRowIndex + 1;
      const dataEndRowIndex = langTests.dataEndRowIndex ?? dataStartRowIndex;
      const nameCol = resolveColumnIndex(tables, langTests.tableIndex, langTests.nameColumn, headerRowIndex);
      const scoreCol = resolveColumnIndex(tables, langTests.tableIndex, langTests.scoreColumn, headerRowIndex);
      const dateCol = resolveColumnIndex(tables, langTests.tableIndex, langTests.dateColumn, headerRowIndex);
      const maxCount = langTests.maxCount ?? 3;
      
      const table = tables[langTests.tableIndex];
      let langIndex = 1;
      
      for (let rowIdx = dataStartRowIndex; rowIdx <= dataEndRowIndex && rowIdx < table.rows.length && langIndex <= maxCount; rowIdx++) {
        const row = table.rows[rowIdx];
        
        if (nameCol >= 0 && nameCol < row.cells.length) {
          const langName = safeGetCellValue(tables, langTests.tableIndex, rowIdx, nameCol);
          if (langName) {
            applicationData[`languageTestName${langIndex}`] = langName;
            
            if (scoreCol >= 0 && scoreCol < row.cells.length) {
              const score = safeGetCellValue(tables, langTests.tableIndex, rowIdx, scoreCol);
              if (score) applicationData[`languageTestScore${langIndex}`] = score;
            }
            
            if (dateCol >= 0 && dateCol < row.cells.length) {
              const date = safeGetCellValue(tables, langTests.tableIndex, rowIdx, dateCol);
              if (date) applicationData[`languageTestDate${langIndex}`] = date;
            }
            
            langIndex++;
          }
        }
      }
    }
  }
  
  // 6. 해외연수 정보 추출
  if (mappingConfig.overseasTraining) {
    const training = mappingConfig.overseasTraining;
    if (training.tableIndex >= 0 && training.tableIndex < tables.length) {
      const headerRowIndex = training.headerRowIndex ?? 0;
      const dataStartRowIndex = training.dataStartRowIndex ?? headerRowIndex + 1;
      const dataEndRowIndex = training.dataEndRowIndex ?? dataStartRowIndex;
      const countryCol = resolveColumnIndex(tables, training.tableIndex, training.countryColumn, headerRowIndex);
      const durationCol = resolveColumnIndex(tables, training.tableIndex, training.durationColumn, headerRowIndex);
      const purposeCol = resolveColumnIndex(tables, training.tableIndex, training.purposeColumn, headerRowIndex);
      const maxCount = training.maxCount ?? 3;
      
      const table = tables[training.tableIndex];
      let trainingIndex = 1;
      
      for (let rowIdx = dataStartRowIndex; rowIdx <= dataEndRowIndex && rowIdx < table.rows.length && trainingIndex <= maxCount; rowIdx++) {
        const row = table.rows[rowIdx];
        
        if (countryCol >= 0 && countryCol < row.cells.length) {
          const country = safeGetCellValue(tables, training.tableIndex, rowIdx, countryCol);
          if (country) {
            applicationData[`overseasTrainingCountry${trainingIndex}`] = country;
            
            if (durationCol >= 0 && durationCol < row.cells.length) {
              const duration = safeGetCellValue(tables, training.tableIndex, rowIdx, durationCol);
              if (duration) applicationData[`overseasTrainingDuration${trainingIndex}`] = duration;
            }
            
            if (purposeCol >= 0 && purposeCol < row.cells.length) {
              const purpose = safeGetCellValue(tables, training.tableIndex, rowIdx, purposeCol);
              if (purpose) applicationData[`overseasTrainingPurpose${trainingIndex}`] = purpose;
            }
            
            trainingIndex++;
          }
        }
      }
    }
  }
  
  // 7. 수상경력 정보 추출
  if (mappingConfig.awards) {
    const awards = mappingConfig.awards;
    if (awards.tableIndex >= 0 && awards.tableIndex < tables.length) {
      const headerRowIndex = awards.headerRowIndex ?? 0;
      const dataStartRowIndex = awards.dataStartRowIndex ?? headerRowIndex + 1;
      const dataEndRowIndex = awards.dataEndRowIndex ?? dataStartRowIndex;
      const nameCol = resolveColumnIndex(tables, awards.tableIndex, awards.nameColumn, headerRowIndex);
      const orgCol = resolveColumnIndex(tables, awards.tableIndex, awards.organizationColumn, headerRowIndex);
      const detailCol = resolveColumnIndex(tables, awards.tableIndex, awards.detailColumn, headerRowIndex);
      const maxCount = awards.maxCount ?? 3;
      
      const table = tables[awards.tableIndex];
      let awardIndex = 1;
      
      for (let rowIdx = dataStartRowIndex; rowIdx <= dataEndRowIndex && rowIdx < table.rows.length && awardIndex <= maxCount; rowIdx++) {
        const row = table.rows[rowIdx];
        
        if (nameCol >= 0 && nameCol < row.cells.length) {
          const awardName = safeGetCellValue(tables, awards.tableIndex, rowIdx, nameCol);
          if (awardName) {
            applicationData[`awardName${awardIndex}`] = awardName;
            
            if (orgCol >= 0 && orgCol < row.cells.length) {
              const org = safeGetCellValue(tables, awards.tableIndex, rowIdx, orgCol);
              if (org) applicationData[`awardOrganization${awardIndex}`] = org;
            }
            
            if (detailCol >= 0 && detailCol < row.cells.length) {
              const detail = safeGetCellValue(tables, awards.tableIndex, rowIdx, detailCol);
              if (detail) applicationData[`awardDetail${awardIndex}`] = detail;
            }
            
            awardIndex++;
          }
        }
      }
    }
  }
  
  // 8. 자기소개서 추출
  if (mappingConfig.selfIntroduction) {
    const selfIntro = mappingConfig.selfIntroduction;
    if (selfIntro.tableIndex >= 0 && selfIntro.tableIndex < tables.length) {
      selfIntro.answers.forEach((answer, index) => {
        const answerText = safeGetCellValue(tables, selfIntro.tableIndex, answer.rowIndex, answer.cellIndex);
        applicationData[`selfIntroduction${index + 1}`] = answerText;
      });
    }
  }
  
  // 9. 경력기술 상세 추출 (테이블 6)
  if (mappingConfig.careerDetails) {
    const careerDetails = mappingConfig.careerDetails;
    if (careerDetails.tableIndex >= 0 && careerDetails.tableIndex < tables.length) {
      const maxCount = careerDetails.maxCount ?? 4;
      const table = tables[careerDetails.tableIndex];
      
      careerDetails.blocks.slice(0, maxCount).forEach((block, index) => {
        const detailIndex = index + 1;
        
        // 데이터 행에서 정보 추출 (row 2, 6, 10, 14)
        if (block.dataRowIndex < table.rows.length) {
          const dataRow = table.rows[block.dataRowIndex];
          
          const startDate = safeGetCellValue(tables, careerDetails.tableIndex, block.dataRowIndex, careerDetails.startDateColumn);
          if (startDate) applicationData[`careerDetailStartDate${detailIndex}`] = startDate;
          
          const endDate = safeGetCellValue(tables, careerDetails.tableIndex, block.dataRowIndex, careerDetails.endDateColumn);
          if (endDate) applicationData[`careerDetailEndDate${detailIndex}`] = endDate;
          
          const companyName = safeGetCellValue(tables, careerDetails.tableIndex, block.dataRowIndex, careerDetails.companyNameColumn);
          if (companyName) applicationData[`careerDetailCompanyName${detailIndex}`] = companyName;
          
          const department = safeGetCellValue(tables, careerDetails.tableIndex, block.dataRowIndex, careerDetails.departmentColumn);
          if (department) applicationData[`careerDetailDepartment${detailIndex}`] = department;
          
          const position = safeGetCellValue(tables, careerDetails.tableIndex, block.dataRowIndex, careerDetails.positionColumn);
          if (position) applicationData[`careerDetailPosition${detailIndex}`] = position;
          
          const salary = safeGetCellValue(tables, careerDetails.tableIndex, block.dataRowIndex, careerDetails.salaryColumn);
          if (salary) applicationData[`careerDetailSalary${detailIndex}`] = salary;
          
          const reason = safeGetCellValue(tables, careerDetails.tableIndex, block.dataRowIndex, careerDetails.reasonColumn);
          if (reason) applicationData[`careerDetailReason${detailIndex}`] = reason;
        }
        
        // 상세내용 행에서 정보 추출 (row 4, 8, 12, 16)
        if (block.detailRowIndex < table.rows.length) {
          const detailRow = table.rows[block.detailRowIndex];
          const detail = safeGetCellValue(tables, careerDetails.tableIndex, block.detailRowIndex, careerDetails.detailColumn);
          if (detail) applicationData[`careerDetailDescription${detailIndex}`] = detail;
        }
      });
    }
  }
  
  return applicationData;
}
