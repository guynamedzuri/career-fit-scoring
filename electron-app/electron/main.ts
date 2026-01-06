import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // 준비될 때까지 숨김
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 개발 환경에서는 Vite 개발 서버, 프로덕션에서는 빌드된 파일
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  console.log('isDev:', isDev, 'isPackaged:', app.isPackaged);
  
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
          const jsonData = JSON.parse(data);
          const items = jsonData.response?.body?.items?.item || [];
          const itemList = Array.isArray(items) ? items : (items ? [items] : []);
          
          const certifications: string[] = [];
          itemList.forEach((item: any) => {
            if (item.jmfldnm) {
              certifications.push(item.jmfldnm.trim());
            }
          });
          
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
    // 루트 디렉토리에서 certificate_official.txt 찾기
    const rootPath = path.join(__dirname, '../../..');
    const filePath = path.join(rootPath, 'certificate_official.txt');
    
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      return fileContent;
    } else {
      console.warn('[Official Certs IPC] File not found:', filePath);
      return null;
    }
  } catch (error) {
    console.error('[Official Certs IPC] Read error:', error);
    return null;
  }
});
