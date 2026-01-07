/**
 * DOCX 파일 파싱 유틸리티
 * 
 * DOCX 파일에서 테이블 데이터를 추출하는 기능을 제공합니다.
 * 이력서 폼이 바뀌어도 매핑 설정만 수정하면 되도록 구조화되어 있습니다.
 */

/**
 * DOCX 파일에서 추출한 원시 테이블 데이터
 */
export interface RawTableData {
  tableIndex: number; // 테이블 인덱스 (0부터 시작)
  rows: RawTableRow[];
}

export interface RawTableRow {
  cells: RawTableCell[];
}

export interface RawTableCell {
  text: string; // 셀의 텍스트 내용
  rowIndex: number; // 행 인덱스
  cellIndex: number; // 열 인덱스
}

/**
 * DOCX 파일에서 모든 테이블 데이터 추출
 * 
 * @param filePath DOCX 파일 경로
 * @returns 추출된 테이블 데이터 배열
 */
export async function extractTablesFromDocx(filePath: string): Promise<RawTableData[]> {
  // TODO: 실제 DOCX 파싱 라이브러리 사용 (docx 또는 mammoth)
  // 현재는 구조만 정의
  
  // 예시 구조:
  // const docx = require('docx');
  // const fs = require('fs');
  // const fileBuffer = fs.readFileSync(filePath);
  // const doc = await docx.Document.load(fileBuffer);
  // 
  // const tables: RawTableData[] = [];
  // doc.body.forEach((element, index) => {
  //   if (element.type === 'table') {
  //     const rows: RawTableRow[] = element.rows.map((row, rowIdx) => ({
  //       cells: row.cells.map((cell, cellIdx) => ({
  //         text: cell.text || '',
  //         rowIndex: rowIdx,
  //         cellIndex: cellIdx,
  //       })),
  //     }));
  //     tables.push({ tableIndex: index, rows });
  //   }
  // });
  // return tables;
  
  throw new Error('DOCX 파싱 라이브러리 설치 필요');
}

/**
 * 테이블에서 특정 위치의 셀 값 추출
 * 
 * @param tables 추출된 테이블 데이터
 * @param tableIndex 테이블 인덱스
 * @param rowIndex 행 인덱스 (0부터 시작)
 * @param cellIndex 열 인덱스 (0부터 시작)
 * @returns 셀의 텍스트 값 (없으면 빈 문자열)
 */
export function getCellValue(
  tables: RawTableData[],
  tableIndex: number,
  rowIndex: number,
  cellIndex: number
): string {
  if (tableIndex < 0 || tableIndex >= tables.length) {
    return '';
  }
  
  const table = tables[tableIndex];
  if (rowIndex < 0 || rowIndex >= table.rows.length) {
    return '';
  }
  
  const row = table.rows[rowIndex];
  if (cellIndex < 0 || cellIndex >= row.cells.length) {
    return '';
  }
  
  return row.cells[cellIndex].text.trim();
}

/**
 * 테이블에서 특정 텍스트를 가진 행 찾기
 * 
 * @param tables 추출된 테이블 데이터
 * @param tableIndex 테이블 인덱스
 * @param searchText 검색할 텍스트
 * @param searchCellIndex 검색할 열 인덱스 (기본값: 0)
 * @returns 찾은 행의 인덱스 (없으면 -1)
 */
export function findRowByText(
  tables: RawTableData[],
  tableIndex: number,
  searchText: string,
  searchCellIndex: number = 0
): number {
  if (tableIndex < 0 || tableIndex >= tables.length) {
    return -1;
  }
  
  const table = tables[tableIndex];
  const normalizedSearch = searchText.trim().toLowerCase();
  
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    if (searchCellIndex < row.cells.length) {
      const cellText = row.cells[searchCellIndex].text.trim().toLowerCase();
      if (cellText.includes(normalizedSearch) || normalizedSearch.includes(cellText)) {
        return i;
      }
    }
  }
  
  return -1;
}

/**
 * 테이블에서 특정 텍스트를 가진 열 찾기
 * 
 * @param tables 추출된 테이블 데이터
 * @param tableIndex 테이블 인덱스
 * @param searchText 검색할 텍스트
 * @param searchRowIndex 검색할 행 인덱스 (기본값: 0, 보통 헤더 행)
 * @returns 찾은 열의 인덱스 (없으면 -1)
 */
export function findColumnByText(
  tables: RawTableData[],
  tableIndex: number,
  searchText: string,
  searchRowIndex: number = 0
): number {
  if (tableIndex < 0 || tableIndex >= tables.length) {
    return -1;
  }
  
  const table = tables[tableIndex];
  if (searchRowIndex < 0 || searchRowIndex >= table.rows.length) {
    return -1;
  }
  
  const headerRow = table.rows[searchRowIndex];
  const normalizedSearch = searchText.trim().toLowerCase();
  
  for (let i = 0; i < headerRow.cells.length; i++) {
    const cellText = headerRow.cells[i].text.trim().toLowerCase();
    if (cellText.includes(normalizedSearch) || normalizedSearch.includes(cellText)) {
      return i;
    }
  }
  
  return -1;
}
