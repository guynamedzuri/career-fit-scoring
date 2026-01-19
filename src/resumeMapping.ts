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
  
  // 대학원 정보
  graduateSchool?: {
    tableIndex: number;
    headerRowIndex?: number;
    dataStartRowIndex?: number;
    schoolNameColumn?: number | { searchText: string };
    degreeTypeColumn?: number | { searchText: string };
    graduationTypeColumn?: number | { searchText: string };
    majorColumn?: number | { searchText: string };
    gpaColumn?: number | { searchText: string };
    maxGpaColumn?: number | { searchText: string };
    maxCount?: number;
  };
  
  // 주소 정보
  address?: {
    tableIndex: number;
    addressColumn?: number | { searchText: string };
    rowIndex?: number | { searchRow: string; searchCol: string };
  };
}

/**
 * 기본 매핑 설정
 * resume_form.docx 양식에 맞게 설정됨
 */
export const DEFAULT_RESUME_MAPPING: ResumeMappingConfig = {
  basicInfo: {
    tableIndex: 1, // 테이블 1: 기본 인적사항
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
    // (5,1): 자택전화번호
    phoneHome: { rowIndex: 5, cellIndex: 1 },
    // (6,1): 이동전화번호
    phone: { rowIndex: 6, cellIndex: 1 },
    // (8,1~5): 병역 관련 (5개 셀)
    militaryService: { rowIndex: 8, cellIndexStart: 1, cellIndexEnd: 5 },
  },
  certificates: {
    tableIndex: 4, // 테이블 4: 자격사항
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
    tableIndex: 4, // 테이블 4: 어학 정보
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
    tableIndex: 3, // 테이블 3: 경력사항
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
    tableIndex: 2, // 테이블 2: 학력사항
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
    // (2~7,0): 입학년월
    // (2~7,1): 졸업년월
    // (2~7,5): 학교 소재지
    maxCount: 6,
  },
  overseasTraining: {
    tableIndex: 4, // 테이블 4: 해외연수
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
    tableIndex: 4, // 테이블 4: 수상경력
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
    tableIndex: 5, // 테이블 5: 자기소개서
    answers: [
      { rowIndex: 1, cellIndex: 1 }, // 자기소개서 답안 1
      { rowIndex: 3, cellIndex: 1 }, // 자기소개서 답안 2
      { rowIndex: 5, cellIndex: 1 }, // 자기소개서 답안 3
      { rowIndex: 7, cellIndex: 1 }, // 자기소개서 답안 4
    ],
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
    if (namePos) {
      // 이름은 applicationData에 직접 저장하지 않음 (필요시 추가)
    }
    
    const birthDatePos = resolveCellPosition(tables, basicInfo.tableIndex, basicInfo.birthDate);
    if (birthDatePos) {
      applicationData.birthDate = getCellValue(
        tables,
        basicInfo.tableIndex,
        birthDatePos.rowIndex,
        birthDatePos.cellIndex
      );
    }
    
    const emailPos = resolveCellPosition(tables, basicInfo.tableIndex, basicInfo.email);
    if (emailPos) {
      applicationData.email = getCellValue(
        tables,
        basicInfo.tableIndex,
        emailPos.rowIndex,
        emailPos.cellIndex
      );
    }
    
    const phonePos = resolveCellPosition(tables, basicInfo.tableIndex, basicInfo.phone);
    if (phonePos) {
      applicationData.phone = getCellValue(
        tables,
        basicInfo.tableIndex,
        phonePos.rowIndex,
        phonePos.cellIndex
      );
    }
  }
  
  // 2. 자격증 정보 추출
  const certs = mappingConfig.certificates;
  if (certs.tableIndex >= 0 && certs.tableIndex < tables.length) {
    const headerRowIndex = certs.headerRowIndex ?? 0;
    const dataStartRowIndex = certs.dataStartRowIndex ?? headerRowIndex + 1;
    const nameCol = resolveColumnIndex(tables, certs.tableIndex, certs.nameColumn, headerRowIndex);
    const dateCol = resolveColumnIndex(tables, certs.tableIndex, certs.dateColumn, headerRowIndex);
    const maxCount = certs.maxCount ?? 10;
    
    const table = tables[certs.tableIndex];
    let certIndex = 1;
    
    for (let rowIdx = dataStartRowIndex; rowIdx < table.rows.length && certIndex <= maxCount; rowIdx++) {
      const row = table.rows[rowIdx];
      
      // 빈 행이면 건너뛰기
      if (row.cells.every(cell => !cell.text.trim())) {
        continue;
      }
      
      if (nameCol >= 0 && nameCol < row.cells.length) {
        const certName = row.cells[nameCol].text.trim();
        if (certName) {
          applicationData[`certificateName${certIndex}`] = certName;
          
          if (dateCol >= 0 && dateCol < row.cells.length) {
            const certDate = row.cells[dateCol].text.trim();
            if (certDate) {
              applicationData[`certificateDate${certIndex}`] = certDate;
            }
          }
          
          certIndex++;
        }
      }
    }
  }
  
  // 3. 경력 정보 추출
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
        const companyName = row.cells[companyCol].text.trim();
        if (companyName) {
          applicationData[`careerCompanyName${careerIndex}`] = companyName;
          
          if (startDateCol >= 0 && startDateCol < row.cells.length) {
            const startDate = row.cells[startDateCol].text.trim();
            if (startDate) {
              applicationData[`careerStartDate${careerIndex}`] = startDate;
            }
          }
          
          if (endDateCol >= 0 && endDateCol < row.cells.length) {
            const endDate = row.cells[endDateCol].text.trim();
            if (endDate) {
              applicationData[`careerEndDate${careerIndex}`] = endDate;
            }
          }
          
          if (jobTypeCol >= 0 && jobTypeCol < row.cells.length) {
            const jobType = row.cells[jobTypeCol].text.trim();
            if (jobType) {
              applicationData[`careerJobType${careerIndex}`] = jobType;
            }
          }
          
          if (employmentStatusCol >= 0 && employmentStatusCol < row.cells.length) {
            const employmentStatus = row.cells[employmentStatusCol].text.trim();
            if (employmentStatus) {
              applicationData[`careerEmploymentStatus${careerIndex}`] = employmentStatus;
            }
          }
          
          careerIndex++;
        }
      }
    }
  }
  
  // 4. 학력 정보 추출 (대학교)
  const education = mappingConfig.education;
  if (education.tableIndex >= 0 && education.tableIndex < tables.length) {
    const headerRowIndex = education.headerRowIndex ?? 0;
    const dataStartRowIndex = education.dataStartRowIndex ?? headerRowIndex + 1;
    const schoolNameCol = resolveColumnIndex(tables, education.tableIndex, education.schoolNameColumn, headerRowIndex);
    const degreeTypeCol = resolveColumnIndex(tables, education.tableIndex, education.degreeTypeColumn, headerRowIndex);
    const graduationTypeCol = resolveColumnIndex(tables, education.tableIndex, education.graduationTypeColumn, headerRowIndex);
    const majorCol = resolveColumnIndex(tables, education.tableIndex, education.majorColumn, headerRowIndex);
    const gpaCol = resolveColumnIndex(tables, education.tableIndex, education.gpaColumn, headerRowIndex);
    const maxGpaCol = resolveColumnIndex(tables, education.tableIndex, education.maxGpaColumn, headerRowIndex);
    const maxCount = education.maxCount ?? 5;
    
    const table = tables[education.tableIndex];
    let eduIndex = 1;
    
    for (let rowIdx = dataStartRowIndex; rowIdx < table.rows.length && eduIndex <= maxCount; rowIdx++) {
      const row = table.rows[rowIdx];
      
      // 빈 행이면 건너뛰기
      if (row.cells.every(cell => !cell.text.trim())) {
        continue;
      }
      
      if (schoolNameCol >= 0 && schoolNameCol < row.cells.length) {
        const schoolName = row.cells[schoolNameCol].text.trim();
        if (schoolName) {
          applicationData[`universityName${eduIndex}`] = schoolName;
          
          if (degreeTypeCol >= 0 && degreeTypeCol < row.cells.length) {
            const degreeType = row.cells[degreeTypeCol].text.trim();
            if (degreeType) {
              applicationData[`universityDegreeType${eduIndex}`] = degreeType;
            }
          }
          
          if (graduationTypeCol >= 0 && graduationTypeCol < row.cells.length) {
            const graduationType = row.cells[graduationTypeCol].text.trim();
            if (graduationType) {
              applicationData[`universityGraduationType${eduIndex}`] = graduationType;
            }
          }
          
          // 전공은 여러 개일 수 있으므로 (최대 4개)
          if (majorCol >= 0 && majorCol < row.cells.length) {
            const major = row.cells[majorCol].text.trim();
            if (major) {
              applicationData[`universityMajor${eduIndex}_1`] = major;
            }
          }
          
          if (gpaCol >= 0 && gpaCol < row.cells.length) {
            const gpa = row.cells[gpaCol].text.trim();
            if (gpa) {
              applicationData[`universityGPA${eduIndex}`] = gpa;
            }
          }
          
          if (maxGpaCol >= 0 && maxGpaCol < row.cells.length) {
            const maxGpa = row.cells[maxGpaCol].text.trim();
            if (maxGpa) {
              applicationData[`universityGPAMax${eduIndex}`] = maxGpa;
            }
          }
          
          eduIndex++;
        }
      }
    }
  }
  
  // 5. 대학원 정보 추출
  if (mappingConfig.graduateSchool) {
    const gradSchool = mappingConfig.graduateSchool;
    if (gradSchool.tableIndex >= 0 && gradSchool.tableIndex < tables.length) {
      const headerRowIndex = gradSchool.headerRowIndex ?? 0;
      const dataStartRowIndex = gradSchool.dataStartRowIndex ?? headerRowIndex + 1;
      const schoolNameCol = resolveColumnIndex(tables, gradSchool.tableIndex, gradSchool.schoolNameColumn, headerRowIndex);
      const degreeTypeCol = resolveColumnIndex(tables, gradSchool.tableIndex, gradSchool.degreeTypeColumn, headerRowIndex);
      const graduationTypeCol = resolveColumnIndex(tables, gradSchool.tableIndex, gradSchool.graduationTypeColumn, headerRowIndex);
      const majorCol = resolveColumnIndex(tables, gradSchool.tableIndex, gradSchool.majorColumn, headerRowIndex);
      const gpaCol = resolveColumnIndex(tables, gradSchool.tableIndex, gradSchool.gpaColumn, headerRowIndex);
      const maxGpaCol = resolveColumnIndex(tables, gradSchool.tableIndex, gradSchool.maxGpaColumn, headerRowIndex);
      const maxCount = gradSchool.maxCount ?? 5;
      
      const table = tables[gradSchool.tableIndex];
      let gradIndex = 1;
      
      for (let rowIdx = dataStartRowIndex; rowIdx < table.rows.length && gradIndex <= maxCount; rowIdx++) {
        const row = table.rows[rowIdx];
        
        // 빈 행이면 건너뛰기
        if (row.cells.every(cell => !cell.text.trim())) {
          continue;
        }
        
        if (schoolNameCol >= 0 && schoolNameCol < row.cells.length) {
          const schoolName = row.cells[schoolNameCol].text.trim();
          if (schoolName) {
            applicationData[`graduateSchoolName${gradIndex}`] = schoolName;
            
            if (degreeTypeCol >= 0 && degreeTypeCol < row.cells.length) {
              const degreeType = row.cells[degreeTypeCol].text.trim();
              if (degreeType) {
                applicationData[`graduateSchoolDegreeType${gradIndex}`] = degreeType;
              }
            }
            
            if (graduationTypeCol >= 0 && graduationTypeCol < row.cells.length) {
              const graduationType = row.cells[graduationTypeCol].text.trim();
              if (graduationType) {
                applicationData[`graduateSchoolGraduationType${gradIndex}`] = graduationType;
              }
            }
            
            // 전공은 여러 개일 수 있으므로 (최대 4개)
            if (majorCol >= 0 && majorCol < row.cells.length) {
              const major = row.cells[majorCol].text.trim();
              if (major) {
                applicationData[`graduateSchoolMajor${gradIndex}_1`] = major;
              }
            }
            
            if (gpaCol >= 0 && gpaCol < row.cells.length) {
              const gpa = row.cells[gpaCol].text.trim();
              if (gpa) {
                applicationData[`graduateSchoolGPA${gradIndex}`] = gpa;
              }
            }
            
            if (maxGpaCol >= 0 && maxGpaCol < row.cells.length) {
              const maxGpa = row.cells[maxGpaCol].text.trim();
              if (maxGpa) {
                applicationData[`graduateSchoolGPAMax${gradIndex}`] = maxGpa;
              }
            }
            
            gradIndex++;
          }
        }
      }
    }
  }
  
  // 6. 주소 정보 추출 및 거주지 분류
  if (mappingConfig.address) {
    const addressInfo = mappingConfig.address;
    if (addressInfo.tableIndex >= 0 && addressInfo.tableIndex < tables.length) {
      let addressText = '';
      
      if (addressInfo.rowIndex !== undefined) {
        // 직접 인덱스로 찾기
        if (typeof addressInfo.rowIndex === 'number') {
          const col = typeof addressInfo.addressColumn === 'number' 
            ? addressInfo.addressColumn 
            : resolveColumnIndex(tables, addressInfo.tableIndex, addressInfo.addressColumn, addressInfo.rowIndex);
          if (col >= 0) {
            addressText = getCellValue(tables, addressInfo.tableIndex, addressInfo.rowIndex, col);
          }
        } else {
          // 검색으로 찾기
          const pos = resolveCellPosition(tables, addressInfo.tableIndex, addressInfo.rowIndex);
          if (pos) {
            addressText = getCellValue(tables, addressInfo.tableIndex, pos.rowIndex, pos.cellIndex);
          }
        }
      } else if (addressInfo.addressColumn !== undefined) {
        // 열만 지정된 경우 (첫 번째 행에서 찾기)
        const col = resolveColumnIndex(tables, addressInfo.tableIndex, addressInfo.addressColumn, 0);
        if (col >= 0) {
          addressText = getCellValue(tables, addressInfo.tableIndex, 0, col);
        }
      }
      
      if (addressText) {
        const residence = classifyResidence(addressText);
        if (residence) {
          applicationData.residence = residence;
        }
      }
    }
  }
  
  return applicationData;
}
