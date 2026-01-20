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
  // Python 스크립트를 사용하여 DOCX 파싱
  const { execFile } = require('child_process');
  const { promisify } = require('util');
  const execFileAsync = promisify(execFile);
  const path = require('path');
  const fs = require('fs');
  
  try {
    // Python 스크립트 경로 찾기
    const projectRoot = findProjectRoot();
    const scriptPath = projectRoot 
      ? path.join(projectRoot, 'scripts', 'extract_resume_form_structure.py')
      : path.join(__dirname, '..', 'scripts', 'extract_resume_form_structure.py');
    
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Python script not found: ${scriptPath}`);
    }
    
    // Python 가상환경 활성화 스크립트 경로
    // Windows: .venv\Scripts\python.exe
    // Linux/Mac: .venv/bin/python3
    let venvPython: string | null = null;
    if (projectRoot) {
      const isWindows = process.platform === 'win32';
      if (isWindows) {
        venvPython = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
      } else {
        venvPython = path.join(projectRoot, '.venv', 'bin', 'python3');
      }
    }
    
    // Python 명령어 결정 (Windows는 python, Linux/Mac는 python3)
    let pythonCmd: string;
    if (venvPython && fs.existsSync(venvPython)) {
      pythonCmd = venvPython;
    } else {
      pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    }
    
    // Python 스크립트 실행하여 JSON 출력 받기
    const { stdout, stderr } = await execFileAsync(pythonCmd, [scriptPath, filePath], {
      maxBuffer: 10 * 1024 * 1024, // 10MB 버퍼
    });
    
    // stderr에 에러가 있으면 확인
    if (stderr && stderr.trim() && !stderr.includes('INFO')) {
      console.warn('[DOCX Parser] Python stderr:', stderr);
    }
    
    // JSON 파싱
    let structure: any;
    try {
      structure = JSON.parse(stdout);
    } catch (parseError: any) {
      // JSON 파싱 실패 시 stderr 확인
      if (stderr) {
        const errorMatch = stderr.match(/"error":\s*"([^"]+)"/);
        if (errorMatch) {
          throw new Error(errorMatch[1]);
        }
      }
      throw new Error(`JSON 파싱 실패: ${parseError.message}`);
    }
    
    // 에러 체크
    if (structure.error) {
      throw new Error(structure.error);
    }
    
    // RawTableData 형식으로 변환
    const tables: RawTableData[] = structure.tables.map((table: any) => ({
      tableIndex: table.table_index,
      rows: table.rows.map((row: any) => ({
        cells: row.cells.map((cell: any) => ({
          text: cell.text || '',
          rowIndex: cell.position.row_index,
          cellIndex: cell.position.cell_index,
        })),
      })),
    }));
    
    return tables;
  } catch (error: any) {
    console.error('[DOCX Parser] Error:', error);
    // Windows에서 python 명령어가 없을 때 더 명확한 에러 메시지
    if (error.message && error.message.includes('python') && process.platform === 'win32') {
      throw new Error(`DOCX 파싱 실패: Python이 설치되어 있지 않거나 PATH에 없습니다. Python을 설치하고 PATH에 추가해주세요. (사용된 명령어: ${error.message.includes('python3') ? 'python3' : 'python'})`);
    }
    throw new Error(`DOCX 파싱 실패: ${error.message || error}`);
  }
}

// 프로젝트 루트 찾기
function findProjectRoot(): string | null {
  const path = require('path');
  const fs = require('fs');
  let currentDir = __dirname;
  
  // 최대 10단계 상위로 올라가면서 package.json 찾기
  for (let i = 0; i < 10; i++) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  
  return null;
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
