import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';

let mainWindow: BrowserWindow | null = null;

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
  mainWindow = new BrowserWindow({
    width: 700,
    height: 900,
    minWidth: 700,
    minHeight: 900,
    maxWidth: 700,
    maxHeight: 900,
    resizable: false, // 창 크기 조절 불가능
    show: false, // 준비될 때까지 숨김
    autoHideMenuBar: true, // 메뉴바 자동 숨김
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  
  // 메뉴바 완전히 제거
  mainWindow.setMenuBarVisibility(false);

  // 개발 환경에서는 Vite 개발 서버, 프로덕션에서는 빌드된 파일
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  console.log('isDev:', isDev, 'isPackaged:', app.isPackaged);
  
  // 프로덕션 환경에서 개발자 도구 비활성화
  if (!isDev) {
    // 개발자 도구가 열리려고 하면 즉시 닫기
    mainWindow.webContents.on('devtools-opened', () => {
      console.warn('[Security] DevTools opened in production, closing...');
      if (mainWindow) {
        mainWindow.webContents.closeDevTools();
      }
    });
    
    // 키보드 단축키로 개발자 도구 열기 시도 차단
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

// Q-Net API 호출 IPC 핸들러
ipcMain.handle('qnet-search-certifications', async () => {
  return new Promise((resolve, reject) => {
    const apiKey = '62577f38999a14613f5ded0c9b01b6ce6349e437323ebb4422825c429189ae5f';
    const url = `http://openapi.q-net.or.kr/api/service/rest/InquiryListNationalQualifcationSVC/getList?ServiceKey=${apiKey}`;
    
    http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const certifications: string[] = [];
          
          // XML 또는 JSON 응답 처리
          if (data.trim().startsWith('<?xml') || data.trim().startsWith('<')) {
            // XML 파싱 (간단한 정규식 방식)
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
            const items = jsonData.response?.body?.items?.item || [];
            const itemList = Array.isArray(items) ? items : (items ? [items] : []);
            
            itemList.forEach((item: any) => {
              if (item.jmfldnm) {
                certifications.push(item.jmfldnm.trim());
              }
            });
          }
          
          resolve(certifications);
        } catch (error) {
          console.error('[Q-Net IPC] Parse error:', error);
          reject(error);
        }
      });
    }).on('error', (error) => {
      console.error('[Q-Net IPC] Request error:', error);
      reject(error);
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
