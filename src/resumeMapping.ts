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
    birthDate?: { rowIndex: number; cellIndex: number } | { searchRow: string; searchCol: string };
    email?: { rowIndex: number; cellIndex: number } | { searchRow: string; searchCol: string };
    phone?: { rowIndex: number; cellIndex: number } | { searchRow: string; searchCol: string };
  };
  
  // 자격증 정보
  certificates: {
    tableIndex: number;
    headerRowIndex?: number; // 헤더 행 인덱스 (없으면 0)
    dataStartRowIndex?: number; // 데이터 시작 행 인덱스 (없으면 headerRowIndex + 1)
    nameColumn?: number | { searchText: string }; // 자격증명 열
    dateColumn?: number | { searchText: string }; // 취득일 열
    maxCount?: number; // 최대 개수 (기본값: 10)
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
}

/**
 * 기본 매핑 설정 (예시)
 * 실제 이력서 폼에 맞게 수정해야 합니다.
 */
export const DEFAULT_RESUME_MAPPING: ResumeMappingConfig = {
  basicInfo: {
    tableIndex: 0, // 첫 번째 테이블
    name: { searchRow: '이름', searchCol: '이름' },
    birthDate: { searchRow: '생년월일', searchCol: '생년월일' },
    email: { searchRow: '이메일', searchCol: '이메일' },
    phone: { searchRow: '전화번호', searchCol: '전화번호' },
  },
  certificates: {
    tableIndex: 1, // 두 번째 테이블
    headerRowIndex: 0,
    dataStartRowIndex: 1,
    nameColumn: { searchText: '자격증명' },
    dateColumn: { searchText: '취득일' },
    maxCount: 10,
  },
  careers: {
    tableIndex: 2, // 세 번째 테이블
    headerRowIndex: 0,
    dataStartRowIndex: 1,
    companyNameColumn: { searchText: '회사명' },
    startDateColumn: { searchText: '입사일' },
    endDateColumn: { searchText: '퇴사일' },
    jobTypeColumn: { searchText: '직종' },
    employmentStatusColumn: { searchText: '재직상태' },
    maxCount: 5,
  },
  education: {
    tableIndex: 3, // 네 번째 테이블
    headerRowIndex: 0,
    dataStartRowIndex: 1,
    schoolNameColumn: { searchText: '학교명' },
    degreeTypeColumn: { searchText: '학위' },
    graduationTypeColumn: { searchText: '졸업여부' },
    majorColumn: { searchText: '전공' },
    gpaColumn: { searchText: '학점' },
    maxGpaColumn: { searchText: '만점' },
    maxCount: 5,
  },
  graduateSchool: {
    tableIndex: 4, // 다섯 번째 테이블
    headerRowIndex: 0,
    dataStartRowIndex: 1,
    schoolNameColumn: { searchText: '학교명' },
    degreeTypeColumn: { searchText: '학위' },
    graduationTypeColumn: { searchText: '졸업여부' },
    majorColumn: { searchText: '전공' },
    gpaColumn: { searchText: '학점' },
    maxGpaColumn: { searchText: '만점' },
    maxCount: 5,
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
  
  return applicationData;
}
