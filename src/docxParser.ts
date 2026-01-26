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
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  const path = require('path');
  const fs = require('fs');
  
  try {
    // Python 스크립트 경로 찾기 (여러 경로 시도)
    const projectRoot = findProjectRoot();
    const scriptPaths: string[] = [];
    
    // 1. 프로젝트 루트 기준
    if (projectRoot) {
      scriptPaths.push(path.join(projectRoot, 'scripts', 'extract_resume_form_structure.py'));
    }
    
    // 2. __dirname 기준 (개발 모드)
    scriptPaths.push(path.join(__dirname, '..', 'scripts', 'extract_resume_form_structure.py'));
    
    // 3. __dirname 기준 (빌드된 앱: resources/app/src -> resources/app/scripts)
    scriptPaths.push(path.join(__dirname, '..', '..', 'scripts', 'extract_resume_form_structure.py'));
    
    // 4. app.getAppPath() 기준 (Electron 앱)
    try {
      const { app } = require('electron');
      if (app && app.getAppPath) {
        const appPath = app.getAppPath();
        scriptPaths.push(path.join(appPath, 'scripts', 'extract_resume_form_structure.py'));
        scriptPaths.push(path.join(appPath, '..', 'scripts', 'extract_resume_form_structure.py'));
      }
    } catch (e) {
      // electron 모듈이 없으면 무시 (Node.js 환경)
    }
    
    // 5. 현재 디렉토리 기준
    scriptPaths.push(path.join(process.cwd(), 'scripts', 'extract_resume_form_structure.py'));
    
    // 첫 번째로 존재하는 경로 사용
    let scriptPath: string | null = null;
    for (const candidatePath of scriptPaths) {
      if (fs.existsSync(candidatePath)) {
        scriptPath = candidatePath;
        break;
      }
    }
    
    if (!scriptPath) {
      throw new Error(`Python script not found. Tried paths:\n${scriptPaths.join('\n')}`);
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
    // Windows에서 경로에 공백이 있으면 따옴표로 감싸기
    // exec를 사용하여 경로 문제 해결
    const isWindows = process.platform === 'win32';
    const pythonCmdQuoted = isWindows ? `"${pythonCmd}"` : pythonCmd;
    const scriptPathQuoted = isWindows ? `"${scriptPath}"` : scriptPath;
    const filePathQuoted = isWindows ? `"${filePath}"` : filePath;
    const command = `${pythonCmdQuoted} ${scriptPathQuoted} ${filePathQuoted}`;
    
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB 버퍼
      shell: true, // shell 사용하여 경로 문제 해결
    });
    
    // stderr에 에러가 있으면 확인
    if (stderr && stderr.trim() && !stderr.includes('INFO')) {
      console.warn('[DOCX Parser] Python stderr:', stderr);
    }
    
    // JSON 파싱
    let structure: any;
    try {
      // stdout이 비어있으면 stderr에서 에러 확인
      if (!stdout || stdout.trim() === '') {
        if (stderr) {
          try {
            const stderrStr = stderr.toString();
            const jsonMatch = stderrStr.match(/\{[\s\S]*"error"[\s\S]*\}/);
            if (jsonMatch) {
              const errorJson = JSON.parse(jsonMatch[0]);
              if (errorJson.error) {
                throw new Error(errorJson.error);
              }
            }
          } catch (e) {
            // JSON 파싱 실패 시 원본 에러 사용
          }
          throw new Error(`Python 스크립트 실행 실패: ${stderr.toString().trim()}`);
        }
        throw new Error('Python 스크립트가 출력을 생성하지 않았습니다.');
      }
      
      structure = JSON.parse(stdout);
    } catch (parseError: any) {
      // JSON 파싱 실패 시 stderr 확인
      if (stderr) {
        try {
          const stderrStr = stderr.toString();
          const jsonMatch = stderrStr.match(/\{[\s\S]*"error"[\s\S]*\}/);
          if (jsonMatch) {
            const errorJson = JSON.parse(jsonMatch[0]);
            if (errorJson.error) {
              throw new Error(errorJson.error);
            }
          }
        } catch (e) {
          // JSON 파싱 실패 시 원본 에러 사용
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
    
    // Python 스크립트에서 반환한 에러 메시지 확인
    if (error.stderr) {
      try {
        // stderr에서 JSON 에러 메시지 추출 시도
        const stderrStr = error.stderr.toString();
        // JSON 객체 찾기 (중괄호로 시작하고 끝나는 부분)
        const jsonMatch = stderrStr.match(/\{[\s\S]*"error"[\s\S]*\}/);
        if (jsonMatch) {
          const errorJson = JSON.parse(jsonMatch[0]);
          if (errorJson.error) {
            // 에러 메시지가 이미 상세하므로 그대로 사용
            throw new Error(`DOCX 파싱 실패: ${errorJson.error}`);
          }
        }
      } catch (e: any) {
        // JSON 파싱 실패 시 원본 에러 사용
        console.warn('[DOCX Parser] Failed to parse error JSON:', e);
        // stderr의 원본 메시지 사용
        if (error.stderr) {
          const stderrStr = error.stderr.toString().trim();
          if (stderrStr) {
            throw new Error(`DOCX 파싱 실패: ${stderrStr}`);
          }
        }
      }
    }
    
    // Windows에서 python 명령어가 없을 때 더 명확한 에러 메시지
    if (error.code === 9009 || (error.message && error.message.includes('python') && process.platform === 'win32')) {
      throw new Error(`DOCX 파싱 실패: Python이 설치되어 있지 않거나 PATH에 없습니다. Python을 설치하고 PATH에 추가해주세요. (사용된 명령어: ${error.message && error.message.includes('python3') ? 'python3' : 'python'})`);
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
