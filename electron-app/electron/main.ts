import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';

let mainWindow: BrowserWindow | null = null;

/**
 * .env 파일 로드
 */
function loadEnvFile(): void {
  try {
    // 프로젝트 루트 찾기
    const projectRoot = findProjectRoot();
    if (!projectRoot) {
      console.warn('[Load Env] Project root not found, trying current directory');
    }
    
    // .env 파일 경로들 시도
    const envPaths = [
      projectRoot ? path.join(projectRoot, '.env') : null,
      path.join(__dirname, '../../.env'),
      path.join(__dirname, '../../../.env'),
      path.join(process.cwd(), '.env'),
    ].filter((p): p is string => p !== null);
    
    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        console.log('[Load Env] Loading .env from:', envPath);
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const lines = envContent.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          // 주석이나 빈 줄 건너뛰기
          if (!trimmedLine || trimmedLine.startsWith('#')) continue;
          
          // KEY=VALUE 형식 파싱
          const match = trimmedLine.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            
            // 따옴표 제거
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            
            // 환경 변수에 설정 (이미 있으면 덮어쓰지 않음)
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
        return;
      }
    }
    
    console.warn('[Load Env] .env file not found in:', envPaths);
  } catch (error) {
    console.warn('[Load Env] Error loading .env file:', error);
  }
}

/**
 * 프로젝트 루트 디렉토리 찾기
 * certificate_official.txt 파일이 있는 디렉토리를 찾습니다.
 */
function findProjectRoot(): string | null {
  let currentDir = __dirname;
  const maxDepth = 10; // 최대 탐색 깊이
  
  for (let i = 0; i < maxDepth; i++) {
    const certFile = path.join(currentDir, 'certificate_official.txt');
    if (fs.existsSync(certFile)) {
      console.log('[Find Project Root] Found at:', currentDir);
      return currentDir;
    }
    
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // 루트 디렉토리에 도달
      break;
    }
    currentDir = parentDir;
  }
  
  // process.cwd()에서도 시도
  currentDir = process.cwd();
  for (let i = 0; i < maxDepth; i++) {
    const certFile = path.join(currentDir, 'certificate_official.txt');
    if (fs.existsSync(certFile)) {
      console.log('[Find Project Root] Found at (cwd):', currentDir);
      return currentDir;
    }
    
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  
  console.warn('[Find Project Root] Project root not found');
  return null;
}

function createWindow() {
  // 개발 환경에서는 Vite 개발 서버, 프로덕션에서는 빌드된 파일
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  console.log('isDev:', isDev, 'isPackaged:', app.isPackaged);
  
  // 개발 환경과 프로덕션 환경에 따라 다른 창 설정
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 1000,
    height: 700,
    show: false, // 준비될 때까지 숨김
    autoHideMenuBar: true, // 메뉴바 자동 숨김
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  };
  
  if (isDev) {
    // 개발 환경: 창 크기 조절 가능
    windowOptions.resizable = true;
    windowOptions.minWidth = 600;
    windowOptions.minHeight = 500;
    // maxWidth, maxHeight는 제한 없음
  } else {
    // 프로덕션 환경: 창 크기 고정
    windowOptions.resizable = false;
    windowOptions.minWidth = 1000;
    windowOptions.minHeight = 700;
    windowOptions.maxWidth = 1000;
    windowOptions.maxHeight = 700;
  }
  
  mainWindow = new BrowserWindow(windowOptions);
  
  // 메뉴바 완전히 제거
  mainWindow.setMenuBarVisibility(false);
  
  // 프로덕션 환경에서 개발자 도구 비활성화
  if (!isDev) {
    // 개발자 도구가 열리려고 하면 즉시 닫기
    mainWindow.webContents.on('devtools-opened', () => {
      console.warn('[Security] DevTools opened in production, closing...');
      if (mainWindow) {
        mainWindow.webContents.closeDevTools();
      }
    });
    
    // 키보드 단축키로 개발자 도구 열기 시도 차단 (프로덕션만)
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U 등 차단
      if (
        input.key === 'F12' ||
        (input.control && input.shift && (input.key === 'I' || input.key === 'J')) ||
        (input.control && input.key === 'U')
      ) {
        event.preventDefault();
      }
    });
  } else {
    // 개발 환경: F12로 개발자 도구 열기 허용
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // F12로 개발자 도구 열기/닫기
      if (input.key === 'F12') {
        if (mainWindow) {
          if (mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools();
          } else {
            mainWindow.webContents.openDevTools();
          }
        }
        event.preventDefault();
      }
    });
    
    // 우클릭 컨텍스트 메뉴에서 "검사" 옵션 제거 (preload에서도 처리 필요)
    mainWindow.webContents.on('context-menu', (event) => {
      event.preventDefault();
    });
  }
  
  if (isDev) {
    // Vite 개발 서버 URL
    const viteUrl = 'http://localhost:5173';
    console.log('Loading Vite dev server:', viteUrl);
    
    // 페이지가 로드되면 창 표시
    mainWindow.webContents.once('did-finish-load', () => {
      console.log('Page loaded successfully');
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    
    mainWindow.loadURL(viteUrl);
    mainWindow.webContents.openDevTools();
    
    // Vite 서버가 준비될 때까지 대기
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription);
      if (errorCode === -106 && mainWindow) {
        // ERR_INTERNET_DISCONNECTED 또는 연결 실패
        console.log('Waiting for Vite server to start...');
        setTimeout(() => {
          if (mainWindow) {
            mainWindow.loadURL(viteUrl);
          }
        }, 1000);
      }
    });
  } else {
    // 프로덕션: 빌드된 파일 로드
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('Loading production file:', indexPath);
    mainWindow.loadFile(indexPath);
    mainWindow.show();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // 애플리케이션 메뉴 제거 (File, Edit, View, Window 등)
  Menu.setApplicationMenu(null);
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 폴더 선택 IPC 핸들러
ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return null;
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  return result.filePaths[0];
});

// 캐시 파일 인터페이스
interface CacheEntry {
  filePath: string;
  fileName: string;
  size: number;
  mtime: number; // 수정 시간 (timestamp)
  data: {
    totalScore: number;
    name?: string;
    age?: number;
    lastCompany?: string;
    lastSalary?: string;
    applicationData?: any;
    aiGrade?: string;
    aiReport?: string;
    aiChecked?: boolean;
    candidateStatus?: 'pending' | 'review' | 'rejected';
  };
}

interface CacheData {
  folderPath: string;
  lastUpdated: number;
  entries: { [filePath: string]: CacheEntry };
}

// 캐시 파일 경로 가져오기
function getCacheFilePath(folderPath: string): string {
  return path.join(folderPath, '.career-fit-cache.json');
}

// 캐시 파일 읽기
function loadCache(folderPath: string): CacheData | null {
  try {
    const cachePath = getCacheFilePath(folderPath);
    if (!fs.existsSync(cachePath)) {
      return null;
    }
    
    const cacheContent = fs.readFileSync(cachePath, 'utf-8');
    const cacheData: CacheData = JSON.parse(cacheContent);
    
    // 폴더 경로가 일치하는지 확인
    if (cacheData.folderPath !== folderPath) {
      console.warn('[Cache] Folder path mismatch, ignoring cache');
      return null;
    }
    
    return cacheData;
  } catch (error) {
    console.error('[Cache] Error loading cache:', error);
    return null;
  }
}

// 캐시 파일 저장
function saveCache(folderPath: string, cacheData: CacheData): void {
  try {
    const cachePath = getCacheFilePath(folderPath);
    cacheData.folderPath = folderPath;
    cacheData.lastUpdated = Date.now();
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf-8');
    console.log('[Cache] Cache saved to:', cachePath);
  } catch (error) {
    console.error('[Cache] Error saving cache:', error);
  }
}

// 파일 메타데이터 가져오기
function getFileMetadata(filePath: string): { size: number; mtime: number } | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      mtime: stats.mtime.getTime(),
    };
  } catch (error) {
    console.error('[Cache] Error getting file metadata:', error);
    return null;
  }
}

// 폴더 내 DOCX 파일 목록 가져오기 IPC 핸들러
ipcMain.handle('get-docx-files', async (event, folderPath: string) => {
  try {
    if (!folderPath || !fs.existsSync(folderPath)) {
      return [];
    }
    
    const files = fs.readdirSync(folderPath);
    const docxFiles = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ext === '.docx';
      })
      .map(file => ({
        name: file,
        path: path.join(folderPath, file),
      }));
    
    return docxFiles;
  } catch (error) {
    console.error('[Get DOCX Files] Error:', error);
    return [];
  }
});

// 캐시 데이터 로드 IPC 핸들러
ipcMain.handle('load-cache', async (event, folderPath: string, filePaths: string[]) => {
  try {
    if (!folderPath || !fs.existsSync(folderPath)) {
      return { cached: {}, toProcess: filePaths };
    }
    
    const cacheData = loadCache(folderPath);
    if (!cacheData) {
      return { cached: {}, toProcess: filePaths };
    }
    
    const cached: { [filePath: string]: any } = {};
    const toProcess: string[] = [];
    
    for (const filePath of filePaths) {
      const metadata = getFileMetadata(filePath);
      if (!metadata) {
        toProcess.push(filePath);
        continue;
      }
      
      const cacheEntry = cacheData.entries[filePath];
      
      // 캐시에 있고, 파일이 변경되지 않았는지 확인
      if (cacheEntry && 
          cacheEntry.size === metadata.size && 
          cacheEntry.mtime === metadata.mtime) {
        // 캐시 데이터 사용
        cached[filePath] = cacheEntry.data;
        console.log('[Cache] Using cached data for:', path.basename(filePath));
      } else {
        // 새로 처리 필요
        toProcess.push(filePath);
        console.log('[Cache] File changed or not cached:', path.basename(filePath));
      }
    }
    
    return { cached, toProcess };
  } catch (error) {
    console.error('[Cache] Error loading cache:', error);
    return { cached: {}, toProcess: filePaths };
  }
});

// 캐시 데이터 저장 IPC 핸들러
ipcMain.handle('save-cache', async (event, folderPath: string, results: Array<{
  filePath: string;
  fileName: string;
  data: any;
}>) => {
  try {
    if (!folderPath || !fs.existsSync(folderPath)) {
      return;
    }
    
    let cacheData = loadCache(folderPath);
    if (!cacheData) {
      cacheData = {
        folderPath,
        lastUpdated: Date.now(),
        entries: {},
      };
    }
    
    // 결과를 캐시에 저장
    for (const result of results) {
      const metadata = getFileMetadata(result.filePath);
      if (!metadata) continue;
      
      cacheData.entries[result.filePath] = {
        filePath: result.filePath,
        fileName: result.fileName,
        size: metadata.size,
        mtime: metadata.mtime,
        data: result.data,
      };
    }
    
    saveCache(folderPath, cacheData);
    console.log('[Cache] Saved', results.length, 'entries to cache');
  } catch (error) {
    console.error('[Cache] Error saving cache:', error);
  }
});

// Q-Net 비상용 로컬 데이터 파일 경로
function getQNetBackupPath(): string {
  const projectRoot = findProjectRoot();
  if (projectRoot) {
    return path.join(projectRoot, 'qnet_certifications_backup.json');
  }
  // 프로젝트 루트를 찾지 못한 경우
  return path.join(__dirname, '../../qnet_certifications_backup.json');
}

// CareerNet 비상용 로컬 데이터 파일 경로
function getCareerNetBackupPath(): string {
  const projectRoot = findProjectRoot();
  if (projectRoot) {
    return path.join(projectRoot, 'careernet_jobs_backup.json');
  }
  return path.join(__dirname, '../../careernet_jobs_backup.json');
}

// Q-Net 비상용 로컬 데이터 저장
function saveQNetBackup(certifications: string[]): void {
  try {
    const backupPath = getQNetBackupPath();
    const backupData = {
      lastUpdated: new Date().toISOString(),
      count: certifications.length,
      certifications: certifications,
    };
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log('[Q-Net Backup] Saved', certifications.length, 'certifications to:', backupPath);
  } catch (error) {
    console.error('[Q-Net Backup] Error saving backup:', error);
  }
}

// CareerNet 비상용 로컬 데이터 저장
function saveCareerNetBackup(jobs: any[]): void {
  try {
    const backupPath = getCareerNetBackupPath();
    const backupData = {
      lastUpdated: new Date().toISOString(),
      count: jobs.length,
      jobs: jobs,
    };
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log('[CareerNet Backup] Saved', jobs.length, 'jobs to:', backupPath);
  } catch (error) {
    console.error('[CareerNet Backup] Error saving backup:', error);
  }
}

// CareerNet 비상용 로컬 데이터 로드
function loadCareerNetBackup(): any[] | null {
  try {
    const backupPath = getCareerNetBackupPath();
    if (!fs.existsSync(backupPath)) {
      console.log('[CareerNet Backup] Backup file not found:', backupPath);
      return null;
    }
    
    const backupContent = fs.readFileSync(backupPath, 'utf-8');
    const backupData = JSON.parse(backupContent);
    
    if (backupData.jobs && Array.isArray(backupData.jobs)) {
      console.log('[CareerNet Backup] Loaded', backupData.jobs.length, 'jobs from backup');
      console.log('[CareerNet Backup] Last updated:', backupData.lastUpdated);
      return backupData.jobs;
    }
    
    return null;
  } catch (error) {
    console.error('[CareerNet Backup] Error loading backup:', error);
    return null;
  }
}

// Q-Net 비상용 로컬 데이터 로드
function loadQNetBackup(): string[] | null {
  try {
    const backupPath = getQNetBackupPath();
    if (!fs.existsSync(backupPath)) {
      console.log('[Q-Net Backup] Backup file not found:', backupPath);
      return null;
    }
    
    const backupContent = fs.readFileSync(backupPath, 'utf-8');
    const backupData = JSON.parse(backupContent);
    
    if (backupData.certifications && Array.isArray(backupData.certifications)) {
      console.log('[Q-Net Backup] Loaded', backupData.certifications.length, 'certifications from backup');
      console.log('[Q-Net Backup] Last updated:', backupData.lastUpdated);
      return backupData.certifications;
    }
    
    return null;
  } catch (error) {
    console.error('[Q-Net Backup] Error loading backup:', error);
    return null;
  }
}

// Q-Net API 호출 IPC 핸들러
ipcMain.handle('qnet-search-certifications', async () => {
  return new Promise((resolve, reject) => {
    // .env 파일 로드 (이미 loadEnvFile이 호출되었을 수 있지만, 안전하게 다시 로드)
    loadEnvFile();
    
    const apiKey = process.env.QNET_API_KEY || '62577f38999a14613f5ded0c9b01b6ce6349e437323ebb4422825c429189ae5f';
    const url = `http://openapi.q-net.or.kr/api/service/rest/InquiryListNationalQualifcationSVC/getList?ServiceKey=${apiKey}`;
    
    console.log('[Q-Net IPC] Calling API:', url);
    
    const request = http.get(url, {
      timeout: 10000, // 10초 타임아웃
    }, (res) => {
      let data = '';
      
      console.log('[Q-Net IPC] Response status:', res.statusCode);
      console.log('[Q-Net IPC] Response headers:', res.headers);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          console.log('[Q-Net IPC] Response data length:', data.length);
          console.log('[Q-Net IPC] Response data preview:', data.substring(0, 200));
          
          const certifications: string[] = [];
          
          // XML 또는 JSON 응답 처리
          if (data.trim().startsWith('<?xml') || data.trim().startsWith('<')) {
            // XML 파싱 (간단한 정규식 방식)
            // 에러 응답 확인
            const errorMatch = data.match(/<resultCode>(\d+)<\/resultCode>/);
            const errorMsgMatch = data.match(/<resultMsg>([^<]*)<\/resultMsg>/);
            
            if (errorMatch && errorMatch[1] !== '00') {
              const errorCode = errorMatch[1];
              const errorMsg = errorMsgMatch ? errorMsgMatch[1] : 'Unknown error';
              console.error(`[Q-Net IPC] API Error: Code ${errorCode}, Message: ${errorMsg}`);
              
              // API 오류 시 비상용 백업 데이터 사용
              console.log('[Q-Net IPC] API failed, trying to load backup data...');
              const backupData = loadQNetBackup();
              if (backupData && backupData.length > 0) {
                console.log('[Q-Net IPC] Using backup data:', backupData.length, 'certifications');
                resolve(backupData);
                return;
              }
              
              reject(new Error(`Q-Net API 오류 (코드: ${errorCode}): ${errorMsg}`));
              return;
            }
            
            const jmfldnmMatches = data.match(/<jmfldnm[^>]*>([^<]*)<\/jmfldnm>/g);
            if (jmfldnmMatches) {
              jmfldnmMatches.forEach((match: string) => {
                const name = match.replace(/<\/?jmfldnm[^>]*>/g, '').trim();
                if (name) {
                  certifications.push(name);
                }
              });
            }
          } else {
            // JSON 파싱
            const jsonData = JSON.parse(data);
            
            // 에러 응답 확인
            if (jsonData.response?.header?.resultCode && jsonData.response.header.resultCode !== '00') {
              const errorCode = jsonData.response.header.resultCode;
              const errorMsg = jsonData.response.header.resultMsg || 'Unknown error';
              console.error(`[Q-Net IPC] API Error: Code ${errorCode}, Message: ${errorMsg}`);
              
              // API 오류 시 비상용 백업 데이터 사용
              console.log('[Q-Net IPC] API failed, trying to load backup data...');
              const backupData = loadQNetBackup();
              if (backupData && backupData.length > 0) {
                console.log('[Q-Net IPC] Using backup data:', backupData.length, 'certifications');
                resolve(backupData);
                return;
              }
              
              reject(new Error(`Q-Net API 오류 (코드: ${errorCode}): ${errorMsg}`));
              return;
            }
            
            const items = jsonData.response?.body?.items?.item || [];
            const itemList = Array.isArray(items) ? items : (items ? [items] : []);
            
            itemList.forEach((item: any) => {
              if (item.jmfldnm) {
                certifications.push(item.jmfldnm.trim());
              }
            });
          }
          
          // API 호출 성공 시 비상용 백업 저장
          if (certifications.length > 0) {
            saveQNetBackup(certifications);
          }
          
          console.log('[Q-Net IPC] Successfully parsed', certifications.length, 'certifications');
          resolve(certifications);
        } catch (error) {
          console.error('[Q-Net IPC] Parse error:', error);
          console.error('[Q-Net IPC] Data that failed to parse:', data.substring(0, 500));
          
          // 파싱 오류 시에도 비상용 백업 데이터 시도
          console.log('[Q-Net IPC] Parse failed, trying to load backup data...');
          const backupData = loadQNetBackup();
          if (backupData && backupData.length > 0) {
            console.log('[Q-Net IPC] Using backup data:', backupData.length, 'certifications');
            resolve(backupData);
            return;
          }
          
          reject(error);
        }
      });
    });
    
    request.on('error', (error) => {
      console.error('[Q-Net IPC] Request error:', error);
      console.error('[Q-Net IPC] Error details:', error.message, (error as any).code);
      
      // 네트워크 오류 시 비상용 백업 데이터 사용
      console.log('[Q-Net IPC] Network error, trying to load backup data...');
      const backupData = loadQNetBackup();
      if (backupData && backupData.length > 0) {
        console.log('[Q-Net IPC] Using backup data:', backupData.length, 'certifications');
        resolve(backupData);
        return;
      }
      
      reject(error);
    });
    
    request.on('timeout', () => {
      console.error('[Q-Net IPC] Request timeout');
      request.destroy();
      
      // 타임아웃 시 비상용 백업 데이터 사용
      console.log('[Q-Net IPC] Timeout, trying to load backup data...');
      const backupData = loadQNetBackup();
      if (backupData && backupData.length > 0) {
        console.log('[Q-Net IPC] Using backup data:', backupData.length, 'certifications');
        resolve(backupData);
        return;
      }
      
      reject(new Error('Q-Net API 요청 시간 초과'));
    });
  });
});

// 공인민간자격증 파일 읽기 IPC 핸들러
ipcMain.handle('read-official-certificates', async () => {
  try {
    console.log('[Official Certs IPC] Starting file search...');
    console.log('[Official Certs IPC] __dirname:', __dirname);
    console.log('[Official Certs IPC] process.cwd():', process.cwd());
    console.log('[Official Certs IPC] app.getAppPath():', app.getAppPath());
    
    // 프로젝트 루트 찾기
    const projectRoot = findProjectRoot();
    
    if (projectRoot) {
      const filePath = path.join(projectRoot, 'certificate_official.txt');
      if (fs.existsSync(filePath)) {
        console.log('[Official Certs IPC] Reading file from:', filePath);
        // 여러 인코딩 시도
        let fileContent: string | null = null;
        const encodings = ['utf-8', 'utf8', 'euc-kr', 'cp949'] as const;
        
        for (const encoding of encodings) {
          try {
            const buffer = fs.readFileSync(filePath);
            if (encoding === 'utf-8' || encoding === 'utf8') {
              fileContent = buffer.toString('utf-8');
            } else {
              // iconv-lite 같은 라이브러리가 필요하지만, 일단 기본 방법 시도
              fileContent = buffer.toString('utf-8');
            }
            
            // UTF-8 BOM 제거 (EF BB BF)
            if (fileContent.charCodeAt(0) === 0xFEFF) {
              fileContent = fileContent.slice(1);
            }
            
            // 깨진 문자 확인 (Replacement Character가 많으면 다른 인코딩 시도)
            const brokenCharCount = (fileContent.match(/\uFFFD/g) || []).length;
            if (brokenCharCount < fileContent.length * 0.01) { // 1% 미만이면 OK
              console.log(`[Official Certs IPC] File read with encoding: ${encoding}, broken chars: ${brokenCharCount}`);
              break;
            } else {
              console.warn(`[Official Certs IPC] Too many broken characters with ${encoding}, trying next...`);
              fileContent = null;
            }
          } catch (error) {
            console.warn(`[Official Certs IPC] Failed to read with ${encoding}:`, error);
            fileContent = null;
          }
        }
        
        if (!fileContent) {
          // 마지막 시도: 기본 UTF-8
          fileContent = fs.readFileSync(filePath, 'utf-8');
          if (fileContent.charCodeAt(0) === 0xFEFF) {
            fileContent = fileContent.slice(1);
          }
        }
        
        // 깨진 문자 제거
        fileContent = fileContent.replace(/\uFFFD+/g, ''); // Replacement Character 제거
        console.log('[Official Certs IPC] File read successfully, size:', fileContent.length, 'bytes');
        return fileContent;
      } else {
        console.error('[Official Certs IPC] File not found at expected path:', filePath);
      }
    }
    
    // 프로젝트 루트를 찾지 못한 경우, 여러 경로 시도
    const possiblePaths = [
      path.join(__dirname, '../../..', 'certificate_official.txt'),
      path.join(__dirname, '../..', 'certificate_official.txt'),
      path.join(__dirname, '..', 'certificate_official.txt'),
      path.join(process.cwd(), 'certificate_official.txt'),
      path.join(process.cwd(), '..', 'certificate_official.txt'),
      path.join(process.cwd(), '../..', 'certificate_official.txt'),
      path.join(process.cwd(), '../../..', 'certificate_official.txt'),
    ];
    
    console.log('[Official Certs IPC] Trying fallback paths:');
    for (const filePath of possiblePaths) {
      const exists = fs.existsSync(filePath);
      console.log('  -', filePath, exists ? '✓' : '✗');
      if (exists) {
        console.log('[Official Certs IPC] Found file at:', filePath);
        // 여러 인코딩 시도
        let fileContent: string | null = null;
        const encodings = ['utf-8', 'utf8', 'euc-kr', 'cp949'] as const;
        
        for (const encoding of encodings) {
          try {
            const buffer = fs.readFileSync(filePath);
            if (encoding === 'utf-8' || encoding === 'utf8') {
              fileContent = buffer.toString('utf-8');
            } else {
              // iconv-lite 같은 라이브러리가 필요하지만, 일단 기본 방법 시도
              fileContent = buffer.toString('utf-8');
            }
            
            // UTF-8 BOM 제거 (EF BB BF)
            if (fileContent.charCodeAt(0) === 0xFEFF) {
              fileContent = fileContent.slice(1);
            }
            
            // 깨진 문자 확인 (Replacement Character가 많으면 다른 인코딩 시도)
            const brokenCharCount = (fileContent.match(/\uFFFD/g) || []).length;
            if (brokenCharCount < fileContent.length * 0.01) { // 1% 미만이면 OK
              console.log(`[Official Certs IPC] File read with encoding: ${encoding}, broken chars: ${brokenCharCount}`);
              break;
            } else {
              console.warn(`[Official Certs IPC] Too many broken characters with ${encoding}, trying next...`);
              fileContent = null;
            }
          } catch (error) {
            console.warn(`[Official Certs IPC] Failed to read with ${encoding}:`, error);
            fileContent = null;
          }
        }
        
        if (!fileContent) {
          // 마지막 시도: 기본 UTF-8
          fileContent = fs.readFileSync(filePath, 'utf-8');
          if (fileContent.charCodeAt(0) === 0xFEFF) {
            fileContent = fileContent.slice(1);
          }
        }
        
        // 깨진 문자 제거
        fileContent = fileContent.replace(/\uFFFD+/g, ''); // Replacement Character 제거
        console.log('[Official Certs IPC] File read successfully, size:', fileContent.length, 'bytes');
        return fileContent;
      }
    }
    
    console.warn('[Official Certs IPC] File not found in any path');
    return null;
  } catch (error) {
    console.error('[Official Certs IPC] Read error:', error);
    return null;
  }
});

// Azure OpenAI API 호출 IPC 핸들러
ipcMain.handle('ai-check-resume', async (event, data: {
  applicationData: any;
  jobMetadata: any;
  fileName: string;
}) => {
  try {
    // Azure OpenAI 설정 (.env 파일에서 읽기)
    // .env 파일 로드 (빌드 시 포함됨)
    loadEnvFile();
    
    const API_KEY = process.env.AZURE_OPENAI_API_KEY;
    
    if (!API_KEY) {
      throw new Error(
        'Azure OpenAI API 키가 설정되지 않았습니다.\n' +
        '.env 파일에 AZURE_OPENAI_API_KEY를 설정하세요.'
      );
    }
    
    const ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || 'https://roar-mjm4cwji-swedencentral.openai.azure.com/';
    const DEPLOYMENT_NAME = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
    const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
    
    console.log('[AI Check] Using endpoint:', ENDPOINT);
    console.log('[AI Check] Using deployment:', DEPLOYMENT_NAME);

    const apiUrl = `${ENDPOINT}openai/deployments/${DEPLOYMENT_NAME}/chat/completions?api-version=${API_VERSION}`;

    // 이력서 데이터를 텍스트로 변환
    const resumeText = formatResumeDataForAI(data.applicationData);
    
    // 채용 공고 정보
    const jobInfo = data.jobMetadata ? `
채용 직종: ${data.jobMetadata.jobName || 'N/A'}
관련 전공: ${data.jobMetadata.relatedMajor || 'N/A'}
필수 자격증: ${data.jobMetadata.requiredCertifications?.join(', ') || '없음'}
관련 자격증: ${data.jobMetadata.relatedCertifications?.join(', ') || '없음'}
` : '';

    // AI 프롬프트 구성
    const systemPrompt = `당신은 채용 담당자입니다. 이력서를 분석하여 후보자의 적합도를 평가하고 등급을 부여해야 합니다.

평가 기준:
- A등급: 채용 공고 요구사항을 완벽히 충족하고, 우수한 경력과 자격을 보유한 후보자
- B등급: 채용 공고 요구사항을 대부분 충족하고, 적절한 경력과 자격을 보유한 후보자
- C등급: 채용 공고 요구사항을 부분적으로 충족하지만, 일부 부족한 점이 있는 후보자
- D등급: 채용 공고 요구사항을 충족하지 못하거나, 경력/자격이 부족한 후보자

응답 형식:
1. 등급: [A/B/C/D 중 하나]
2. 평가 요약: [한 문장으로 요약]
3. 주요 강점: [3-5개 항목]
4. 주요 약점: [3-5개 항목]
5. 종합 의견: [2-3문단으로 상세 분석]`;

    const userPrompt = `다음 채용 공고 정보와 이력서 데이터를 분석해주세요.

${jobInfo}

이력서 정보:
${resumeText}

위 정보를 바탕으로 후보자를 평가하고 등급을 부여해주세요.`;

    console.log('[AI Check] Calling Azure OpenAI API for:', data.fileName);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': API_KEY,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: 2000,
        temperature: 0.7,
        top_p: 1.0,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[AI Check] API Error:', response.status, errorData);
      throw new Error(`AI API 호출 실패: ${response.status}`);
    }

    const responseData = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    const aiContent = responseData.choices?.[0]?.message?.content || '';

    // 등급 추출 (A, B, C, D)
    const gradeMatch = aiContent.match(/등급:\s*([A-D])/i) || aiContent.match(/\[([A-D])\]/i);
    const grade = gradeMatch ? gradeMatch[1].toUpperCase() : 'C';

    console.log('[AI Check] Success for:', data.fileName, 'Grade:', grade);

    return {
      success: true,
      grade,
      report: aiContent,
    };
  } catch (error) {
    console.error('[AI Check] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
});

// 이력서 데이터를 AI 분석용 텍스트로 변환
function formatResumeDataForAI(applicationData: any): string {
  if (!applicationData) return '이력서 데이터가 없습니다.';

  let text = '';

  // 기본 정보
  if (applicationData.name) text += `이름: ${applicationData.name}\n`;
  if (applicationData.birthDate) text += `생년월일: ${applicationData.birthDate}\n`;
  if (applicationData.email) text += `이메일: ${applicationData.email}\n`;
  if (applicationData.phone) text += `전화번호: ${applicationData.phone}\n`;
  text += '\n';

  // 자격증
  const certificates: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const certName = applicationData[`certificateName${i}`];
    const certDate = applicationData[`certificateDate${i}`];
    if (certName) {
      certificates.push(`${certName}${certDate ? ` (${certDate})` : ''}`);
    }
  }
  if (certificates.length > 0) {
    text += `자격증:\n${certificates.join('\n')}\n\n`;
  }

  // 경력
  const careers: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const company = applicationData[`careerCompanyName${i}`];
    const startDate = applicationData[`careerStartDate${i}`];
    const endDate = applicationData[`careerEndDate${i}`];
    const jobType = applicationData[`careerJobType${i}`];
    if (company) {
      careers.push(`${company} | ${startDate || ''} ~ ${endDate || '현재'} | ${jobType || ''}`);
    }
  }
  if (careers.length > 0) {
    text += `경력:\n${careers.join('\n')}\n\n`;
  }

  // 학력
  const educations: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const school = applicationData[`universityName${i}`];
    const degree = applicationData[`universityDegreeType${i}`];
    const major = applicationData[`universityMajor${i}_1`];
    const gpa = applicationData[`universityGPA${i}`];
    if (school) {
      educations.push(`${school} | ${degree || ''} | ${major || ''} | GPA: ${gpa || 'N/A'}`);
    }
  }
  if (educations.length > 0) {
    text += `학력:\n${educations.join('\n')}\n\n`;
  }

  // 대학원
  const gradSchools: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const school = applicationData[`graduateSchoolName${i}`];
    const degree = applicationData[`graduateSchoolDegreeType${i}`];
    const major = applicationData[`graduateSchoolMajor${i}_1`];
    if (school) {
      gradSchools.push(`${school} | ${degree || ''} | ${major || ''}`);
    }
  }
  if (gradSchools.length > 0) {
    text += `대학원:\n${gradSchools.join('\n')}\n\n`;
  }

    return text || '이력서 정보가 없습니다.';
}

// CareerNet API 호출 IPC 핸들러
ipcMain.handle('careernet-search-jobs', async () => {
  return new Promise((resolve, reject) => {
    // .env 파일 로드
    loadEnvFile();
    
    const apiKey = process.env.CAREERNET_API_KEY || '83ae558eb34c7d75e2bde972db504fd5';
    const url = `https://www.career.go.kr/cnet/openapi/getOpenApi?apiKey=${apiKey}&svcType=api&svcCode=JOB&contentType=json&thisPage=1&perPage=9999`;
    
    console.log('[CareerNet IPC] Calling API:', url);
    
    const request = https.get(url, {
      timeout: 10000, // 10초 타임아웃
    }, (res) => {
      let data = '';
      
      console.log('[CareerNet IPC] Response status:', res.statusCode);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          console.log('[CareerNet IPC] Response data length:', data.length);
          
          const jsonData = JSON.parse(data);
          const jobs: any[] = [];
          
          if (jsonData.dataSearch?.content) {
            const contentList = Array.isArray(jsonData.dataSearch.content) 
              ? jsonData.dataSearch.content 
              : [jsonData.dataSearch.content];
            
            contentList.forEach((item: any) => {
              const job = item.job?.trim();
              const jobdicSeq = item.jobdicSeq?.trim();
              
              if (job && jobdicSeq) {
                jobs.push({
                  job: job,
                  jobdicSeq: jobdicSeq,
                  aptd_type_code: item.aptd_type_code?.trim(),
                  summary: item.summary?.trim(),
                  profession: item.profession?.trim(),
                  similarJob: item.similarJob?.trim(),
                });
              }
            });
          }
          
          // API 호출 성공 시 비상용 백업 저장
          if (jobs.length > 0) {
            saveCareerNetBackup(jobs);
          }
          
          console.log('[CareerNet IPC] Successfully parsed', jobs.length, 'jobs');
          resolve(jobs);
        } catch (error) {
          console.error('[CareerNet IPC] Parse error:', error);
          console.error('[CareerNet IPC] Data that failed to parse:', data.substring(0, 500));
          
          // 파싱 오류 시에도 비상용 백업 데이터 시도
          console.log('[CareerNet IPC] Parse failed, trying to load backup data...');
          const backupData = loadCareerNetBackup();
          if (backupData && backupData.length > 0) {
            console.log('[CareerNet IPC] Using backup data:', backupData.length, 'jobs');
            resolve(backupData);
            return;
          }
          
          reject(error);
        }
      });
    });
    
    request.on('error', (error) => {
      console.error('[CareerNet IPC] Request error:', error);
      console.error('[CareerNet IPC] Error details:', error.message, (error as any).code);
      
      // 네트워크 오류 시 비상용 백업 데이터 사용
      console.log('[CareerNet IPC] Network error, trying to load backup data...');
      const backupData = loadCareerNetBackup();
      if (backupData && backupData.length > 0) {
        console.log('[CareerNet IPC] Using backup data:', backupData.length, 'jobs');
        resolve(backupData);
        return;
      }
      
      reject(error);
    });
    
    request.on('timeout', () => {
      console.error('[CareerNet IPC] Request timeout');
      request.destroy();
      
      // 타임아웃 시 비상용 백업 데이터 사용
      console.log('[CareerNet IPC] Timeout, trying to load backup data...');
      const backupData = loadCareerNetBackup();
      if (backupData && backupData.length > 0) {
        console.log('[CareerNet IPC] Using backup data:', backupData.length, 'jobs');
        resolve(backupData);
        return;
      }
      
      reject(new Error('CareerNet API 요청 시간 초과'));
    });
  });
});

// CareerNet 직종 상세 정보 조회 IPC 핸들러
ipcMain.handle('careernet-get-job-detail', async (event, jobdicSeq: string) => {
  return new Promise((resolve, reject) => {
    // .env 파일 로드
    loadEnvFile();
    
    const apiKey = process.env.CAREERNET_API_KEY || '83ae558eb34c7d75e2bde972db504fd5';
    const url = `https://www.career.go.kr/cnet/openapi/getOpenApi?apiKey=${apiKey}&svcType=api&svcCode=JOB_VIEW&jobdicSeq=${jobdicSeq}`;
    
    console.log('[CareerNet IPC] Getting job detail:', url);
    
    const request = https.get(url, {
      timeout: 10000,
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          
          if (jsonData.dataSearch?.content) {
            const content = Array.isArray(jsonData.dataSearch.content)
              ? jsonData.dataSearch.content[0]
              : jsonData.dataSearch.content;
            
            resolve(content);
          } else {
            resolve(null);
          }
        } catch (error) {
          console.error('[CareerNet IPC] Parse error:', error);
          reject(error);
        }
      });
    });
    
    request.on('error', (error) => {
      console.error('[CareerNet IPC] Request error:', error);
      reject(error);
    });
    
    request.on('timeout', () => {
      console.error('[CareerNet IPC] Request timeout');
      request.destroy();
      reject(new Error('CareerNet API 요청 시간 초과'));
    });
  });
});
