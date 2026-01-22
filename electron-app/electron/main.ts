import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
// career-fit-scoring 패키지에서 함수 import
// 빌드 시에는 컴파일된 파일을 사용하므로 career-fit-scoring 패키지로 import
let extractTablesFromDocx: any;
let mapResumeDataToApplicationData: any;

// 동적 import로 처리 (개발/프로덕션 환경 모두 지원)
async function loadCareerFitScoring() {
  try {
    // 먼저 패키지로 시도 (프로덕션 빌드)
    const module = require('career-fit-scoring');
    extractTablesFromDocx = module.extractTablesFromDocx;
    mapResumeDataToApplicationData = module.mapResumeDataToApplicationData;
    writeLog('[Main] Loaded career-fit-scoring from package', 'info');
  } catch (e: any) {
    try {
      // 패키지 실패 시 상대 경로로 시도 (개발 모드)
      const module = require('../../src/index');
      extractTablesFromDocx = module.extractTablesFromDocx;
      mapResumeDataToApplicationData = module.mapResumeDataToApplicationData;
      writeLog('[Main] Loaded career-fit-scoring from relative path', 'info');
    } catch (e2: any) {
      writeLog(`[Main] Failed to load career-fit-scoring: ${e2.message || e2}`, 'error');
      throw e2;
    }
  }
}

// electron-updater는 동적 import로 처리 (타입 에러 방지)
let autoUpdater: any = null;

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let splashServer: http.Server | null = null;

/**
 * 로그 파일에 기록 (프로덕션 빌드에서 디버깅용)
 */
function writeLog(message: string, level: 'info' | 'error' | 'warn' = 'info') {
  // writeLog가 호출되기 전에 app이 준비되지 않았을 수 있으므로 안전하게 처리
  if (!app || !app.isReady()) {
    console.log(message);
    return;
  }
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, 'app.log');
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    fs.appendFileSync(logFile, logMessage, 'utf-8');
  } catch (error) {
    // 로그 파일 쓰기 실패해도 앱은 계속 실행
    console.error('[Log] Failed to write log:', error);
  }
}

/**
 * electron-updater 모듈 로드 (프로덕션 빌드에서 올바른 경로 찾기)
 */
function loadElectronUpdater(): any {
  // 개발 환경에서는 일반 require 사용
  if (!app.isPackaged) {
    try {
      return require('electron-updater');
    } catch (e) {
      console.error('[AutoUpdater] Failed to load electron-updater in dev mode:', e);
      return null;
    }
  }

  // 프로덕션 환경: 먼저 상대 경로로 시도 (가장 간단하고 확실함)
  // app.getAppPath()는 app.asar를 반환하므로, 그 안의 node_modules를 참조
  try {
    writeLog(`[AutoUpdater] Trying relative path require from asar...`, 'info');
    const updaterModule = require('electron-updater');
    if (updaterModule && updaterModule.autoUpdater) {
      writeLog(`[AutoUpdater] Successfully loaded electron-updater using relative require!`, 'info');
      return updaterModule;
    }
  } catch (e: any) {
    writeLog(`[AutoUpdater] Relative require failed: ${e.message || e}`, 'info');
    // 계속 다른 방법 시도
  }

  // 프로덕션 환경: 여러 경로 시도
  const pathsToTry: string[] = [];
  
  // 1. 기본 경로 (app.asar 내부)
  try {
    const appPath = app.getAppPath();
    pathsToTry.push(path.join(appPath, 'node_modules', 'electron-updater'));
  } catch (e) {
    // app.getAppPath() 실패 시 무시
  }

  // 2. app.asar.unpacked 경로 (가장 가능성 높음)
  try {
    const appPath = app.getAppPath();
    if (appPath.includes('.asar')) {
      const unpackedPath = appPath.replace('.asar', '.asar.unpacked');
      pathsToTry.push(path.join(unpackedPath, 'node_modules', 'electron-updater'));
    }
  } catch (e) {
    // 무시
  }

  // 3. resources/app.asar.unpacked 경로
  try {
    const appPath = app.getAppPath();
    const resourcesDir = path.dirname(appPath);
    pathsToTry.push(path.join(resourcesDir, 'app.asar.unpacked', 'node_modules', 'electron-updater'));
  } catch (e) {
    // 무시
  }

  // 4. __dirname 기준 경로
  try {
    const electronDir = __dirname;
    const appDir = path.dirname(electronDir);
    pathsToTry.push(path.join(appDir, 'node_modules', 'electron-updater'));
    // app.asar.unpacked 버전
    if (appDir.includes('.asar')) {
      const unpackedDir = appDir.replace('.asar', '.asar.unpacked');
      pathsToTry.push(path.join(unpackedDir, 'node_modules', 'electron-updater'));
    }
  } catch (e) {
    // 무시
  }

  // 5. process.resourcesPath 사용 (Electron 내장)
  try {
    if (process.resourcesPath) {
      pathsToTry.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'electron-updater'));
    }
  } catch (e) {
    // 무시
  }

  // 6. 실제 설치된 앱의 루트에서 찾기 (win-unpacked 구조)
  try {
    if (process.resourcesPath) {
      // win-unpacked 구조: resources 폴더의 상위 디렉토리
      const appRoot = path.dirname(process.resourcesPath);
      pathsToTry.push(path.join(appRoot, 'node_modules', 'electron-updater'));
      pathsToTry.push(path.join(appRoot, 'resources', 'app.asar.unpacked', 'node_modules', 'electron-updater'));
    }
  } catch (e) {
    // 무시
  }

  // 디버깅: 모든 시도할 경로 로그
  writeLog(`[AutoUpdater] Will try ${pathsToTry.length} paths`, 'info');
  for (let i = 0; i < pathsToTry.length; i++) {
    writeLog(`[AutoUpdater] Path ${i + 1}: ${pathsToTry[i]}`, 'info');
  }

  // 각 경로 시도
  for (const updaterPath of pathsToTry) {
    try {
      // asar 내부 경로는 fs.existsSync가 false를 반환할 수 있으므로
      // 직접 require를 시도해봐야 함
      if (updaterPath.includes('.asar') && !updaterPath.includes('.unpacked')) {
        // asar 내부 경로는 직접 require 시도
        try {
          writeLog(`[AutoUpdater] Trying asar path (direct require): ${updaterPath}`, 'info');
          const updaterModule = require(updaterPath);
          if (updaterModule && updaterModule.autoUpdater) {
            writeLog(`[AutoUpdater] Successfully loaded from asar: ${updaterPath}`, 'info');
            return updaterModule;
          }
        } catch (e: any) {
          writeLog(`[AutoUpdater] Failed to require from asar path: ${e.message || e}`, 'info');
        }
      } else {
        // 일반 파일 시스템 경로는 존재 여부 확인 후 require
        if (fs.existsSync(updaterPath)) {
          writeLog(`[AutoUpdater] Trying path: ${updaterPath}`, 'info');
          // package.json이 있는지 확인 (올바른 모듈인지)
          const packageJsonPath = path.join(updaterPath, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            const updaterModule = require(updaterPath);
            writeLog(`[AutoUpdater] Successfully loaded from: ${updaterPath}`, 'info');
            return updaterModule;
          } else {
            writeLog(`[AutoUpdater] Path exists but no package.json: ${updaterPath}`, 'info');
          }
        } else {
          writeLog(`[AutoUpdater] Path does not exist: ${updaterPath}`, 'info');
        }
      }
    } catch (e: any) {
      writeLog(`[AutoUpdater] Failed to load from ${updaterPath}: ${e.message || e}`, 'info');
      // 다음 경로 시도
    }
  }

  // 추가 디버깅: resources 폴더 구조 확인
  try {
    if (process.resourcesPath) {
      writeLog(`[AutoUpdater] Checking resources directory structure...`, 'info');
      const resourcesContents = fs.readdirSync(process.resourcesPath);
      writeLog(`[AutoUpdater] Resources directory contents: ${resourcesContents.join(', ')}`, 'info');
      
      // app.asar.unpacked가 있는지 확인
      const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked');
      if (fs.existsSync(unpackedPath)) {
        writeLog(`[AutoUpdater] app.asar.unpacked exists`, 'info');
        const unpackedContents = fs.readdirSync(unpackedPath);
        writeLog(`[AutoUpdater] app.asar.unpacked contents: ${unpackedContents.join(', ')}`, 'info');
        
        // node_modules가 있는지 확인
        const nodeModulesPath = path.join(unpackedPath, 'node_modules');
        if (fs.existsSync(nodeModulesPath)) {
          writeLog(`[AutoUpdater] node_modules exists in unpacked`, 'info');
          const nodeModulesContents = fs.readdirSync(nodeModulesPath);
          writeLog(`[AutoUpdater] node_modules contents: ${nodeModulesContents.join(', ')}`, 'info');
          
          // electron-updater가 있는지 확인
          const updaterPath = path.join(nodeModulesPath, 'electron-updater');
          if (fs.existsSync(updaterPath)) {
            writeLog(`[AutoUpdater] electron-updater found in unpacked/node_modules`, 'info');
          } else {
            writeLog(`[AutoUpdater] electron-updater NOT found in unpacked/node_modules`, 'error');
          }
        } else {
          writeLog(`[AutoUpdater] node_modules does NOT exist in unpacked`, 'error');
        }
      } else {
        writeLog(`[AutoUpdater] app.asar.unpacked does NOT exist - asarUnpack may not be working`, 'error');
        writeLog(`[AutoUpdater] This means electron-updater was not unpacked from asar archive`, 'error');
        writeLog(`[AutoUpdater] Check electron-builder.yml asarUnpack configuration`, 'error');
        
        // 대체 방법: app.asar 내부에서 직접 require 시도
        // asar 아카이브 내부의 파일도 require할 수 있음
        try {
          writeLog(`[AutoUpdater] Trying to require electron-updater from asar archive...`, 'info');
          // asar 내부 경로로 직접 require 시도 (상대 경로 사용)
          // app.getAppPath()는 app.asar를 반환하므로, 그 안의 node_modules를 참조
          const asarUpdaterPath = 'node_modules/electron-updater';
          writeLog(`[AutoUpdater] Attempting to require (relative): ${asarUpdaterPath}`, 'info');
          const updaterModule = require(asarUpdaterPath);
          if (updaterModule && updaterModule.autoUpdater) {
            writeLog(`[AutoUpdater] Successfully loaded electron-updater from asar archive!`, 'info');
            return updaterModule;
          }
        } catch (e: any) {
          writeLog(`[AutoUpdater] Failed to load from asar (relative): ${e.message || e}`, 'error');
          
          // 절대 경로로도 시도
          try {
            const asarUpdaterPath = path.join(app.getAppPath(), 'node_modules', 'electron-updater');
            writeLog(`[AutoUpdater] Attempting to require (absolute): ${asarUpdaterPath}`, 'info');
            const updaterModule = require(asarUpdaterPath);
            if (updaterModule && updaterModule.autoUpdater) {
              writeLog(`[AutoUpdater] Successfully loaded electron-updater from asar archive (absolute)!`, 'info');
              return updaterModule;
            }
          } catch (e2: any) {
            writeLog(`[AutoUpdater] Failed to load from asar (absolute): ${e2.message || e2}`, 'error');
          }
        }
        
        // app.asar 내부 구조 확인 및 require.resolve 시도
        try {
          writeLog(`[AutoUpdater] Checking app.asar internal structure...`, 'info');
          const asarPath = path.join(process.resourcesPath, 'app.asar');
          if (fs.existsSync(asarPath)) {
            const asarStats = fs.statSync(asarPath);
            writeLog(`[AutoUpdater] app.asar size: ${asarStats.size} bytes`, 'info');
            writeLog(`[AutoUpdater] app.asar path exists: ${asarPath}`, 'info');
            try {
              fs.accessSync(asarPath, fs.constants.R_OK);
              writeLog(`[AutoUpdater] app.asar readable: YES`, 'info');
            } catch (accessError: any) {
              writeLog(`[AutoUpdater] app.asar readable: NO - ${accessError.message || accessError}`, 'info');
            }
            
            // asar 내용물 직접 확인 (리스트 없이 크기만)
            try {
              const appPath = app.getAppPath();
              writeLog(`[AutoUpdater] app.getAppPath(): ${appPath}`, 'info');
              writeLog(`[AutoUpdater] appPath exists: ${fs.existsSync(appPath) ? 'YES' : 'NO'}`, 'info');
            } catch (pathError: any) {
              writeLog(`[AutoUpdater] Error checking app path: ${pathError.message || pathError}`, 'error');
            }
            
            // require.resolve로 electron-updater 경로 확인
            try {
              writeLog(`[AutoUpdater] Trying require.resolve('electron-updater')...`, 'info');
              const resolvedPath = require.resolve('electron-updater');
              writeLog(`[AutoUpdater] require.resolve('electron-updater') found: ${resolvedPath}`, 'info');
              
              // 경로가 app.asar 내부인지 확인
              if (resolvedPath.includes('.asar')) {
                writeLog(`[AutoUpdater] electron-updater is in app.asar!`, 'info');
                // 직접 require 시도
                const updaterModule = require('electron-updater');
                if (updaterModule && updaterModule.autoUpdater) {
                  writeLog(`[AutoUpdater] Successfully loaded via require.resolve!`, 'info');
                  return updaterModule;
                }
              } else if (resolvedPath.includes('.asar.unpacked')) {
                writeLog(`[AutoUpdater] electron-updater is in app.asar.unpacked!`, 'info');
                const updaterModule = require('electron-updater');
                if (updaterModule && updaterModule.autoUpdater) {
                  writeLog(`[AutoUpdater] Successfully loaded from unpacked!`, 'info');
                  return updaterModule;
                }
              } else {
                writeLog(`[AutoUpdater] electron-updater path is unexpected: ${resolvedPath}`, 'info');
                // 그래도 시도
                const updaterModule = require('electron-updater');
                if (updaterModule && updaterModule.autoUpdater) {
                  writeLog(`[AutoUpdater] Successfully loaded anyway!`, 'info');
                  return updaterModule;
                }
              }
            } catch (resolveError: any) {
              writeLog(`[AutoUpdater] require.resolve failed: ${resolveError.message || resolveError}`, 'error');
              writeLog(`[AutoUpdater] This means electron-updater is NOT in the build!`, 'error');
              writeLog(`[AutoUpdater] Check electron-builder.yml files configuration`, 'error');
            }
          }
        } catch (e: any) {
          writeLog(`[AutoUpdater] Error checking asar structure: ${e.message || e}`, 'error');
        }
      }
      
      // 추가 디버깅: 전체 앱 구조 확인
      try {
        const appRoot = path.dirname(process.resourcesPath);
        writeLog(`[AutoUpdater] App root directory: ${appRoot}`, 'info');
        if (fs.existsSync(appRoot)) {
          const appRootContents = fs.readdirSync(appRoot);
          writeLog(`[AutoUpdater] App root contents: ${appRootContents.join(', ')}`, 'info');
        }
      } catch (e: any) {
        writeLog(`[AutoUpdater] Error checking app root: ${e.message || e}`, 'error');
      }
    }
  } catch (e: any) {
    writeLog(`[AutoUpdater] Error checking resources structure: ${e.message || e}`, 'error');
  }

  return null;
}

/**
 * 자동 업데이트 설정 및 체크
 */
async function setupAutoUpdater() {
  // electron-updater 로드 시도
  if (!autoUpdater) {
    const updaterModule = loadElectronUpdater();
    
    if (updaterModule && updaterModule.autoUpdater) {
      autoUpdater = updaterModule.autoUpdater;
      const msg = '[AutoUpdater] electron-updater loaded successfully';
      console.log(msg);
      writeLog(msg, 'info');
    } else {
      const errorMsg = '[AutoUpdater] electron-updater could not be loaded';
      console.error(errorMsg);
      writeLog(errorMsg, 'error');
      writeLog(`[AutoUpdater] __dirname: ${__dirname}`, 'error');
      writeLog(`[AutoUpdater] process.cwd(): ${process.cwd()}`, 'error');
      if (app.isReady()) {
        writeLog(`[AutoUpdater] app.getAppPath(): ${app.getAppPath()}`, 'error');
        writeLog(`[AutoUpdater] process.resourcesPath: ${process.resourcesPath || 'undefined'}`, 'error');
      }
      
      if (mainWindow) {
        dialog.showErrorBox('자동 업데이트 오류', 'electron-updater를 로드할 수 없습니다.\n자동 업데이트가 비활성화됩니다.');
      }
      return;
    }
  }

  // 개발 환경에서는 자동 업데이트 비활성화
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    const msg = '[AutoUpdater] Development mode - auto update disabled';
    console.log(msg);
    writeLog(msg, 'info');
    return;
  }

  // 현재 버전 로그
  const currentVersion = app.getVersion();
  const msg1 = `[AutoUpdater] Current app version: ${currentVersion}`;
  const msg2 = '[AutoUpdater] Checking for updates from GitHub...';
  console.log(msg1);
  console.log(msg2);
  writeLog(msg1, 'info');
  writeLog(msg2, 'info');

  // GitHub Releases URL 명시적으로 설정
  try {
    const msg1 = '[AutoUpdater] Configuring update server...';
    console.log(msg1);
    writeLog(msg1, 'info');
    
    // electron-updater 6.x에서는 electron-builder.yml의 publish 설정을 자동으로 읽음
    // 하지만 명시적으로 설정하는 것이 더 안전함
    if (autoUpdater && typeof autoUpdater.setFeedURL === 'function') {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'guynamedzuri',
        repo: 'career-fit-scoring'
      });
      const msg2 = '[AutoUpdater] Feed URL set: guynamedzuri/career-fit-scoring';
      console.log(msg2);
      writeLog(msg2, 'info');
    } else {
      const msg2 = '[AutoUpdater] Using electron-builder.yml publish configuration';
      console.log(msg2);
      writeLog(msg2, 'info');
    }
  } catch (error: any) {
    const errorMsg = `[AutoUpdater] Failed to configure update server: ${error.message || error}`;
    console.error(errorMsg);
    writeLog(errorMsg, 'error');
    if (mainWindow) {
      dialog.showErrorBox('업데이트 설정 오류', `업데이트 서버를 설정하는 중 오류가 발생했습니다:\n\n${error.message || error}`);
    }
  }

  // 업데이트 체크 간격 설정 (기본값: 앱 시작 시 + 5분마다)
  const msg = '[AutoUpdater] Starting update check...';
  console.log(msg);
  writeLog(msg, 'info');
  
  // 즉시 업데이트 체크
  autoUpdater.checkForUpdatesAndNotify().catch((error: any) => {
    const errorMsg = `[AutoUpdater] Initial check failed: ${error.message || error}`;
    console.error(errorMsg);
    writeLog(errorMsg, 'error');
    if (mainWindow) {
      dialog.showErrorBox('업데이트 확인 실패', `업데이트를 확인하는 중 오류가 발생했습니다:\n\n${error.message || error}\n\n로그 파일: ${path.join(app.getPath('userData'), 'logs', 'app.log')}`);
    }
  });

  // 업데이트 체크 주기 설정 (5분마다)
  setInterval(() => {
    const msg = '[AutoUpdater] Periodic update check...';
    console.log(msg);
    writeLog(msg, 'info');
    autoUpdater.checkForUpdatesAndNotify().catch((error: any) => {
      const errorMsg = `[AutoUpdater] Periodic check failed: ${error.message || error}`;
      console.error(errorMsg);
      writeLog(errorMsg, 'error');
    });
  }, 5 * 60 * 1000); // 5분

  // 업데이트 이벤트 핸들러
  autoUpdater.on('checking-for-update', () => {
    const msg = '[AutoUpdater] Checking for update...';
    console.log(msg);
    writeLog(msg, 'info');
    if (mainWindow) {
      mainWindow.webContents.send('update-checking');
    }
  });

  autoUpdater.on('update-available', (info: any) => {
    const msg = `[AutoUpdater] Update available: ${info.version}`;
    console.log(msg);
    writeLog(msg, 'info');
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info);
      // 사용자에게 알림
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '업데이트 발견',
        message: `새 버전 ${info.version}이 사용 가능합니다.`,
        detail: '업데이트를 다운로드하는 중입니다...',
        buttons: ['확인']
      });
    }
  });

  autoUpdater.on('update-not-available', (info: any) => {
    const msg = `[AutoUpdater] Update not available. Current version is latest. Info: ${JSON.stringify(info)}`;
    console.log(msg);
    writeLog(msg, 'info');
  });

  autoUpdater.on('error', (err: any) => {
    const errorMessage = err.message || err.toString() || '알 수 없는 오류';
    const errorDetails = JSON.stringify(err, null, 2);
    const errorMsg = `[AutoUpdater] Error: ${errorMessage}\nDetails: ${errorDetails}`;
    console.error(errorMsg);
    writeLog(errorMsg, 'error');
    
    if (mainWindow) {
      mainWindow.webContents.send('update-error', errorMessage);
    }
    
    // 에러를 사용자에게도 표시 (비동기로 표시하여 앱 시작을 막지 않음)
    setTimeout(() => {
      const logPath = path.join(app.getPath('userData'), 'logs', 'app.log');
      dialog.showErrorBox(
        '업데이트 확인 오류', 
        `업데이트를 확인하는 중 오류가 발생했습니다:\n\n${errorMessage}\n\n자세한 내용은 로그 파일을 확인하세요:\n${logPath}`
      );
    }, 2000); // 2초 후 표시하여 앱 시작을 방해하지 않음
  });

  autoUpdater.on('download-progress', (progressObj: any) => {
    const message = `[AutoUpdater] 다운로드 중: ${Math.round(progressObj.percent)}%`;
    console.log(message);
    writeLog(message, 'info');
    if (mainWindow) {
      mainWindow.webContents.send('update-download-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info: any) => {
    const msg = `[AutoUpdater] Update downloaded: ${info.version}`;
    console.log(msg);
    writeLog(msg, 'info');
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', info);
    }
    
    // 조용한 자동 업데이트: 사용자에게 알림 없이 즉시 재시작
    writeLog(`[AutoUpdater] Update downloaded: ${info.version}, restarting silently...`, 'info');
    
    // 2초 후 조용히 재시작 (사용자가 작업 중일 가능성 대비)
    setTimeout(() => {
      writeLog('[AutoUpdater] Performing silent restart with update', 'info');
      autoUpdater.quitAndInstall(true, false); // silent mode
    }, 2000);
  });
}

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

function createSplashWindow() {
  // 스플래시 스크린 생성
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  // 아이콘 경로 설정
  let iconPath: string | undefined;
  if (app.isPackaged) {
    const appPath = app.getAppPath();
    if (appPath.includes('resources/app')) {
      iconPath = path.join(path.dirname(path.dirname(appPath)), 'icon.ico');
    } else {
      iconPath = path.join(path.dirname(appPath), 'icon.ico');
    }
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(process.resourcesPath || path.dirname(appPath), 'icon.ico');
    }
  } else {
    iconPath = path.join(__dirname, '..', 'icon.ico');
  }
  
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false, // 프레임 없음
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  
  // 스플래시 HTML 로드
  const splashHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    }
    .logo {
      font-size: 48px;
      font-weight: bold;
      margin-bottom: 20px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    .message {
      font-size: 18px;
      margin-bottom: 30px;
      opacity: 0.9;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255,255,255,0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .version {
      position: absolute;
      bottom: 20px;
      font-size: 12px;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="logo">이력서 AI 분석</div>
  <div class="message">준비 중...</div>
  <div class="spinner"></div>
  <div class="version">Version ${process.env.VITE_APP_VERSION || '1.0.78'}</div>
</body>
</html>
  `;
  
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
  splashWindow.show();
  
  // 중앙에 배치
  splashWindow.center();
}

function createWindow() {
  // 개발 환경에서는 Vite 개발 서버, 프로덕션에서는 빌드된 파일
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  console.log('isDev:', isDev, 'isPackaged:', app.isPackaged);
  
  // 아이콘 경로 설정 (프로덕션과 개발 환경 모두 처리)
  let iconPath: string | undefined;
  if (app.isPackaged) {
    // 프로덕션: 앱 루트 디렉토리의 icon.ico 사용 (256x256 포함)
    // extraResources로 루트에 복사된 icon.ico 사용
    const appPath = app.getAppPath();
    // asar: false일 때 appPath는 resources/app이므로, 상위로 올라가서 루트 찾기
    if (appPath.includes('resources/app')) {
      iconPath = path.join(path.dirname(path.dirname(appPath)), 'icon.ico');
    } else {
      iconPath = path.join(path.dirname(appPath), 'icon.ico');
    }
    // 루트에 없으면 resources에서 찾기
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(process.resourcesPath || path.dirname(appPath), 'icon.ico');
    }
  } else {
    // 개발 환경: electron-app 디렉토리의 icon.ico 사용
    iconPath = path.join(__dirname, '..', 'icon.ico');
  }
  
  // 개발 환경과 프로덕션 환경에 따라 다른 창 설정
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 1000,
    height: 700,
    show: false, // 준비될 때까지 숨김
    autoHideMenuBar: true, // 메뉴바 자동 숨김
    // 창 아이콘 설정 (창 타이틀바 아이콘)
    icon: iconPath,
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
    
    // 메인 윈도우 로드 시작
    mainWindow.loadURL(viteUrl);
    mainWindow.webContents.openDevTools();
    
    // 메인 윈도우가 표시될 준비가 되면 표시하고 신호 전송
    mainWindow.once('ready-to-show', () => {
      console.log('[Main] Window ready-to-show event fired');
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    
    // HTTP 서버가 이미 시작되어 있으므로, 스플래시 프로세스가 자동으로 감지함
    // 메인 프로세스의 스플래시 닫기
    setTimeout(() => {
      if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
      }
    }, 500);
    
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
    
    // 메인 윈도우 로드 시작
    mainWindow.loadFile(indexPath);
    
    // 메인 윈도우가 표시될 준비가 되면 표시
    mainWindow.once('ready-to-show', () => {
      console.log('[Main] Window ready-to-show event fired');
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    
    // HTTP 서버가 이미 시작되어 있으므로, 스플래시 프로세스가 자동으로 감지함
    // 메인 프로세스의 스플래시 닫기
    setTimeout(() => {
      if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
      }
    }, 500);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 앱이 준비되기 전에 스플래시를 먼저 표시
// app.whenReady() 전에 스플래시를 띄우면 더 빠르게 사용자에게 피드백 제공
if (app.isReady()) {
  createSplashWindow();
} else {
  app.once('ready', () => {
    createSplashWindow();
  });
}

// 스플래시 프로세스와 통신하기 위한 HTTP 서버 시작
function startSplashServer(): number {
  console.log('[Main] ===== startSplashServer() called =====');
  if (splashServer) {
    const existingPort = (splashServer.address() as net.AddressInfo)?.port || 0;
    console.log(`[Main] Splash server already running on port ${existingPort}`);
    return existingPort;
  }
  
  console.log('[Main] Creating new HTTP server for splash communication...');
  const server = http.createServer((req, res) => {
    console.log(`[Main] Splash server: received ${req.method} ${req.url}`);
    if (req.url === '/ready' && req.method === 'GET') {
      console.log('[Main] Splash server: ready signal received');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ready' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  
  // 사용 가능한 포트 자동 할당
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    console.log(`[Main] Splash server listen callback, address:`, address);
    const port = (address as net.AddressInfo)?.port || 0;
    console.log(`[Main] Splash server started on port ${port}`);
    
    if (port === 0) {
      console.error('[Main] ERROR: Port is 0, server may not have started correctly');
      return;
    }
    
    // 포트 번호를 파일에 저장 (스플래시 프로세스가 읽을 수 있도록)
    const os = require('os');
    const tmpDir = os.tmpdir();
    console.log(`[Main] os.tmpdir() returned: ${tmpDir}`);
    const portFile = path.join(tmpDir, 'career-fit-scoring-splash-port');
    console.log(`[Main] Port file path: ${portFile}`);
    try {
      fs.writeFileSync(portFile, port.toString(), 'utf-8');
      console.log(`[Main] Port number (${port}) saved to: ${portFile}`);
      console.log(`[Main] Port file exists: ${fs.existsSync(portFile)}`);
      const savedContent = fs.readFileSync(portFile, 'utf-8');
      console.log(`[Main] Port file content: "${savedContent}"`);
    } catch (e: any) {
      console.error('[Main] Failed to save port number:', e);
      console.error('[Main] Error details:', e?.message, e?.stack);
    }
  });
  
  server.on('error', (err) => {
    console.error('[Main] Splash server error:', err);
  });
  
  splashServer = server;
  // listen이 비동기이므로 즉시 포트를 반환할 수 없음
  return 0;
}

app.whenReady().then(async () => {
  console.log('[Main] ===== app.whenReady() executed =====');
  writeLog('[Main] ===== app.whenReady() executed =====', 'info');
  // 애플리케이션 메뉴 제거 (File, Edit, View, Window 등)
  Menu.setApplicationMenu(null);
  
  // 스플래시 서버 시작 (메인 프로세스가 시작되자마자)
  console.log('[Main] Calling startSplashServer()...');
  writeLog('[Main] Calling startSplashServer()...', 'info');
  startSplashServer();
  console.log('[Main] startSplashServer() call completed');
  writeLog('[Main] startSplashServer() call completed', 'info');
  
  try {
    // career-fit-scoring 모듈 로드
    await loadCareerFitScoring();
    writeLog('[Main] career-fit-scoring module loaded', 'info');
  } catch (error: any) {
    const errorMsg = `[Main] Failed to load career-fit-scoring: ${error?.message || error}`;
    console.error(errorMsg);
    writeLog(errorMsg, 'error');
    if (error?.stack) {
      writeLog(`[Main] Stack trace: ${error.stack}`, 'error');
    }
  }
  
  // 스플래시가 아직 없으면 생성 (이미 위에서 생성했을 수도 있음)
  if (!splashWindow) {
    createSplashWindow();
  }
  
  // 초기화 작업 (비동기로 진행)
  try {
    // 자동 업데이트 설정
    await setupAutoUpdater();
    
    // 약간의 지연을 두어 스플래시가 보이도록 함
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 메인 윈도우 생성
    createWindow();
  } catch (error: any) {
    const errorMsg = `[Init] Initialization error: ${error?.message || error}`;
    console.error(errorMsg);
    writeLog(errorMsg, 'error');
    if (error?.stack) {
      writeLog(`[Init] Stack trace: ${error.stack}`, 'error');
    }
    // 에러가 발생해도 메인 윈도우는 표시
    createWindow();
    if (mainWindow) {
      mainWindow.show();
    }
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
  }

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

// 에러 핸들러 추가 (모든 에러를 로그 파일에 기록)
process.on('uncaughtException', (error: Error) => {
  const errorMsg = `[Main] Uncaught Exception: ${error.message}`;
  console.error(errorMsg);
  writeLog(errorMsg, 'error');
  if (error.stack) {
    writeLog(`[Main] Stack trace: ${error.stack}`, 'error');
  }
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  const errorMsg = `[Main] Unhandled Rejection: ${reason?.message || reason}`;
  console.error(errorMsg);
  writeLog(errorMsg, 'error');
  if (reason?.stack) {
    writeLog(`[Main] Stack trace: ${reason.stack}`, 'error');
  }
});

// 폴더 선택 IPC 핸들러
// 수동 업데이트 체크 IPC 핸들러
// React 앱이 준비되었을 때 호출되는 IPC 핸들러
let appReadySignalSent = false;
const sendAppReadySignal = () => {
  if (appReadySignalSent) {
    console.log('[Main] App ready signal already sent, skipping...');
    return;
  }
  appReadySignalSent = true;
  console.log('[Main] Sending app ready signal to splash screen');
  
  // sendReadySignal 함수 호출 (개발/프로덕션 모드 모두에서 사용)
  if (mainWindow) {
    const os = require('os');
    const signalFile = path.join(os.tmpdir(), 'career-fit-scoring-main-ready');
    try {
      fs.writeFileSync(signalFile, 'ready', 'utf-8');
      console.log('[Main] Signal file created at:', signalFile);
      if (fs.existsSync(signalFile)) {
        console.log('[Main] Signal file verified to exist');
      } else {
        console.error('[Main] Signal file was not created!');
      }
    } catch (e) {
      console.error('[Main] Failed to create signal file:', e);
    }
    
    // 메인 프로세스의 스플래시 닫기
    setTimeout(() => {
      if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
      }
    }, 300);
  }
};

ipcMain.handle('app-ready', async () => {
  console.log('[Main] App ready signal received from React app');
  sendAppReadySignal();
});

ipcMain.handle('check-for-updates', async () => {
  try {
    const msg = '[AutoUpdater] Manual update check requested';
    console.log(msg);
    writeLog(msg, 'info');
    
    if (!autoUpdater) {
      const error = 'AutoUpdater not available';
      writeLog(`[AutoUpdater] ${error}`, 'error');
      return { success: false, error };
    }
    
    const result = await autoUpdater.checkForUpdates();
    const resultMsg = `[AutoUpdater] Manual check result: ${JSON.stringify(result)}`;
    console.log(resultMsg);
    writeLog(resultMsg, 'info');
    return { success: true, updateInfo: result?.updateInfo };
  } catch (error: any) {
    const errorMsg = `[AutoUpdater] Manual check error: ${error.message || error}`;
    console.error(errorMsg);
    writeLog(errorMsg, 'error');
    return { success: false, error: error.message || error.toString() };
  }
});

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
      
      // Windows에서 경로 표기(\ vs /)나 normalize 차이로 키 매칭이 실패하는 경우가 있어
      // 여러 형태로 lookup 한 뒤, 최종적으로는 "요청 받은 filePath" 키로 반환한다.
      const normalized = path.normalize(filePath);
      const swappedSlashes = filePath.includes('\\') ? filePath.replace(/\\/g, '/') : filePath.replace(/\//g, '\\');
      const altNormalized = path.normalize(swappedSlashes);

      const cacheEntry =
        cacheData.entries[filePath] ||
        cacheData.entries[normalized] ||
        cacheData.entries[swappedSlashes] ||
        cacheData.entries[altNormalized];
      
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

// 이력서 처리 IPC 핸들러
ipcMain.handle('process-resume', async (event, filePath: string) => {
  try {
    // DOCX 파일에서 테이블 추출
    const tables = await extractTablesFromDocx(filePath);
    
    // 매핑 설정으로 applicationData 변환
    const applicationData = mapResumeDataToApplicationData(tables);
    
    // 추가 정보 추출 (이름, 나이, 직전 회사, 연봉 등)
    const name = applicationData.name || undefined;
    const birthDate = applicationData.birthDate || undefined;
    const age = birthDate ? calculateAge(birthDate) : undefined;
    const lastCompany = applicationData.careerCompanyName1 || undefined;
    const lastSalary = applicationData.careerSalary1 || undefined;
    const residence = applicationData.residence || undefined;
    
    // 검색 가능한 텍스트 생성
    const searchableText = [
      name,
      lastCompany,
      applicationData.universityName1,
      applicationData.certificateName1,
      applicationData.certificateName2,
      applicationData.certificateName3,
    ].filter(Boolean).join(' ');
    
    return {
      success: true,
      applicationData,
      name,
      age,
      lastCompany,
      lastSalary,
      residence,
      searchableText,
    };
  } catch (error: any) {
    console.error('[Process Resume] Error:', error);
    return {
      success: false,
      error: error.message || '이력서 처리 실패',
    };
  }
});

// 생년월일로 나이 계산
function calculateAge(birthDate: string): number | undefined {
  try {
    // YYYY-MM-DD, YYYY.MM.DD, 또는 YYYYMMDD 형식 파싱
    let year: number, month: number, day: number;
    
    if (birthDate.includes('-')) {
      // YYYY-MM-DD 형식
      const parts = birthDate.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
      day = parseInt(parts[2]);
    } else if (birthDate.includes('.')) {
      // YYYY.MM.DD 형식
      const parts = birthDate.split('.');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
      day = parseInt(parts[2]);
    } else if (birthDate.length === 8) {
      // YYYYMMDD 형식
      year = parseInt(birthDate.substring(0, 4));
      month = parseInt(birthDate.substring(4, 6));
      day = parseInt(birthDate.substring(6, 8));
    } else {
      return undefined;
    }
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return undefined;
    }
    
    const today = new Date();
    const birth = new Date(year, month - 1, day);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    // 만나이 계산: 생일이 지나지 않았으면 1살 빼기
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  } catch {
    return undefined;
  }
}

// Azure OpenAI API 호출 IPC 핸들러
ipcMain.handle('ai-check-resume', async (event, data: {
  applicationData: any;
  userPrompt: {
    jobDescription: string;
    requiredQualifications: string;
    preferredQualifications: string;
    requiredCertifications: string[];
    gradeCriteria: {
      최상: string;
      상: string;
      중: string;
      하: string;
      최하: string;
    };
    scoringWeights: {
      career: number;
      requirements: number;
      preferred: number;
      certifications: number;
    };
  };
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
    
    // userPrompt 검증
    if (!data.userPrompt) {
      throw new Error('userPrompt가 제공되지 않았습니다.');
    }
    
    // 안전한 접근을 위한 기본값 설정 (검증 전에 먼저 설정)
    const userPrompt = {
      jobDescription: (data.userPrompt.jobDescription && typeof data.userPrompt.jobDescription === 'string') ? data.userPrompt.jobDescription : '',
      requiredQualifications: (data.userPrompt.requiredQualifications && typeof data.userPrompt.requiredQualifications === 'string') ? data.userPrompt.requiredQualifications : '',
      preferredQualifications: (data.userPrompt.preferredQualifications && typeof data.userPrompt.preferredQualifications === 'string') ? data.userPrompt.preferredQualifications : '',
      requiredCertifications: Array.isArray(data.userPrompt.requiredCertifications) ? data.userPrompt.requiredCertifications : [],
      gradeCriteria: data.userPrompt.gradeCriteria || {},
      scoringWeights: data.userPrompt.scoringWeights || {},
    };
    
    // jobDescription 검증 (안전한 userPrompt 객체 사용)
    if (!userPrompt.jobDescription || !userPrompt.jobDescription.trim()) {
      throw new Error('jobDescription이 비어있습니다.');
    }
    
    // AI 프롬프트 구성
    const systemPrompt = `당신은 채용 담당자입니다. 이력서의 경력을 분석하여 업무 내용과의 적합도를 평가하고 등급을 부여해야 합니다.

등급 체계:
- 최상: ${userPrompt.gradeCriteria?.최상 || '하위 등급의 모든 조건을 만족하는 경우'}
- 상: ${userPrompt.gradeCriteria?.상 || '중 등급 조건을 만족하면서 추가 조건을 충족하는 경우'}
- 중: ${userPrompt.gradeCriteria?.중 || '하 등급 조건을 만족하면서 추가 조건을 충족하는 경우'}
- 하: ${userPrompt.gradeCriteria?.하 || '기본 조건을 만족하는 경우'}
- 최하: ${userPrompt.gradeCriteria?.최하 || '기본 조건을 만족하지 못하는 경우'}

응답 형식:
1. 등급: [최상/상/중/하/최하 중 하나]
2. 평가 요약: [한 문장으로 요약]
3. 주요 강점: [3-5개 항목]
4. 주요 약점: [3-5개 항목]
5. 종합 의견: [2-3문단으로 상세 분석]`;

    let userPromptText = `업무 내용:
${userPrompt.jobDescription || '업무 내용이 없습니다.'}

`;

    if (userPrompt.requiredQualifications && userPrompt.requiredQualifications.trim()) {
      userPromptText += `필수 요구사항:
${userPrompt.requiredQualifications}

`;
    }

    if (userPrompt.preferredQualifications && userPrompt.preferredQualifications.trim()) {
      userPromptText += `우대 사항:
${userPrompt.preferredQualifications}

`;
    }

    if (userPrompt.requiredCertifications && userPrompt.requiredCertifications.length > 0) {
      userPromptText += `필수 자격증:
${userPrompt.requiredCertifications.join(', ')}

`;
    }

    userPromptText += `이력서 경력 정보:
${resumeText}

위 업무 내용과 이력서의 경력을 비교하여, 제공된 등급 기준에 따라 적합도를 평가하고 등급을 부여해주세요.`;

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
            content: userPromptText,
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
          // XML 또는 JSON 응답 처리
          if (data.trim().startsWith('<?xml') || data.trim().startsWith('<')) {
            // XML 파싱 (간단한 정규식 방식)
            const result: any = {};
            
            // capacity_major 추출
            const capacityMajorMatches = data.match(/<capacity_major[^>]*>([\s\S]*?)<\/capacity_major>/g);
            if (capacityMajorMatches) {
              const capacities: string[] = [];
              capacityMajorMatches.forEach(match => {
                const capacityMatches = match.match(/<capacity[^>]*>([^<]*)<\/capacity>/g);
                if (capacityMatches) {
                  capacityMatches.forEach(capMatch => {
                    const capacity = capMatch.replace(/<\/?capacity[^>]*>/g, '').trim();
                    if (capacity) {
                      capacities.push(capacity);
                    }
                  });
                }
              });
              
              if (capacities.length > 0) {
                result.capacity_major = {
                  content: capacities.map(cap => ({ capacity: cap })),
                };
              }
            }
            
            resolve(result);
          } else {
            // JSON 파싱
            const jsonData = JSON.parse(data);
            
            if (jsonData.dataSearch?.content) {
              const content = Array.isArray(jsonData.dataSearch.content)
                ? jsonData.dataSearch.content[0]
                : jsonData.dataSearch.content;
              
              resolve(content);
            } else {
              resolve(null);
            }
          }
        } catch (error) {
          console.error('[CareerNet IPC] Parse error:', error);
          console.error('[CareerNet IPC] Data preview:', data.substring(0, 200));
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
