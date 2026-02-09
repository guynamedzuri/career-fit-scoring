import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
// career-fit-scoring 패키지에서 함수 import
// 빌드 시에는 컴파일된 파일을 사용하므로 career-fit-scoring 패키지로 import
let extractTablesFromDocx: any;
let mapResumeDataToApplicationData: any;

// career-fit-scoring 모듈을 여러 경로에서 시도하여 로드하는 헬퍼 함수
function requireCareerFitScoringModule(): any {
  const path = require('path');
  const appPath = app.getAppPath();
  
  // 시도할 경로 목록
  const pathsToTry: Array<{ name: string; path: string }> = [
    { name: 'package', path: 'career-fit-scoring' },
    { name: 'relative', path: '../../src/index' },
    { name: 'app/electron/src', path: path.join(appPath, 'electron', 'src', 'index') },
    { name: 'app/src', path: path.join(appPath, 'src', 'index') },
    { name: 'app/node_modules', path: path.join(appPath, 'node_modules', 'career-fit-scoring') },
    { name: 'app/node_modules/dist', path: path.join(appPath, 'node_modules', 'career-fit-scoring', 'dist', 'index') },
    { name: 'app/node_modules/src', path: path.join(appPath, 'node_modules', 'career-fit-scoring', 'src', 'index') },
    { name: 'dirname/src', path: path.join(__dirname, 'src', 'index') },
    { name: 'dirname/../src', path: path.join(__dirname, '../src/index') },
    { name: 'dirname/node_modules', path: path.join(__dirname, '../node_modules/career-fit-scoring') },
    { name: 'dirname/node_modules/dist', path: path.join(__dirname, '../node_modules/career-fit-scoring/dist/index') }
  ];
  
  for (const attempt of pathsToTry) {
    try {
      const module = require(attempt.path);
      if (module) {
        writeLog(`[Require Module] Successfully loaded from ${attempt.name}: ${attempt.path}`, 'info');
        return module;
      }
    } catch (e: any) {
      // 다음 경로 시도
      continue;
    }
  }
  
  // 모든 경로 실패
  throw new Error(`Failed to load module from all attempted paths`);
}

// 동적 import로 처리 (개발/프로덕션 환경 모두 지원)
async function loadCareerFitScoring() {
  try {
    const module = requireCareerFitScoringModule();
    
    if (module.extractTablesFromDocx && module.mapResumeDataToApplicationData) {
      extractTablesFromDocx = module.extractTablesFromDocx;
      mapResumeDataToApplicationData = module.mapResumeDataToApplicationData;
      writeLog('[Main] Successfully loaded career-fit-scoring', 'info');
    } else {
      throw new Error('Module loaded but missing required functions');
    }
  } catch (e: any) {
    const errorMsg = `[Main] Failed to load career-fit-scoring: ${e.message || e}`;
    writeLog(errorMsg, 'error');
    writeLog(`[Main] __dirname: ${__dirname}`, 'error');
    writeLog(`[Main] app.getAppPath(): ${app.getAppPath()}`, 'error');
    throw e;
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

  // 앱 시작 시에만 업데이트 체크
  const msg = '[AutoUpdater] Starting initial update check...';
  console.log(msg);
  writeLog(msg, 'info');
  
  // 앱 시작 시 한 번만 업데이트 체크
  autoUpdater.checkForUpdatesAndNotify().catch((error: any) => {
    const errorMsg = `[AutoUpdater] Initial check failed: ${error.message || error}`;
    console.error(errorMsg);
    writeLog(errorMsg, 'error');
    if (mainWindow) {
      dialog.showErrorBox('업데이트 확인 실패', `업데이트를 확인하는 중 오류가 발생했습니다:\n\n${error.message || error}\n\n로그 파일: ${path.join(app.getPath('userData'), 'logs', 'app.log')}`);
    }
  });

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
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available', info);
    }
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
    
    // 업데이트 다운로드 완료 알림
    writeLog(`[AutoUpdater] Update downloaded: ${info.version}, preparing to install...`, 'info');
    
    // 사용자에게 설치 시작 알림 (3초 후 자동 설치)
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '업데이트 준비 완료',
        message: `버전 ${info.version} 업데이트가 준비되었습니다.`,
        detail: '잠시 후 자동으로 설치를 시작합니다...',
        buttons: ['확인']
      });
    }
    
    // 3초 후 자동 설치 및 재시작 (runAfterFinish: true로 설정되어 있어서 자동 실행됨)
    setTimeout(() => {
      writeLog('[AutoUpdater] Performing automatic install and restart', 'info');
      autoUpdater.quitAndInstall(false, true); // silent: false (설치 UI 표시), isForceRunAfter: true (설치 후 자동 실행)
    }, 3000);
  });
}

/**
 * .env 파일 로드
 */
function loadEnvFile(): void {
  try {
    // packaged 환경에서의 경로 확보
    // (main.ts 최상단에서 이미 app/path/fs를 사용하고 있으므로 여기서는 추가 require 없이 사용)
    const exeDir = (() => {
      try {
        return app?.getPath ? path.dirname(app.getPath('exe')) : null;
      } catch {
        return null;
      }
    })();
    const appPath = (() => {
      try {
        return app?.getAppPath ? app.getAppPath() : null;
      } catch {
        return null;
      }
    })();
    const resourcesPath = (process as any).resourcesPath ? (process as any).resourcesPath : null;

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
      // packaged/installer 환경에서 흔한 위치들
      appPath ? path.join(appPath, '.env') : null, // e.g. .../resources/app.asar/.env
      resourcesPath ? path.join(resourcesPath, '.env') : null, // e.g. .../resources/.env
      resourcesPath ? path.join(resourcesPath, 'app.asar', '.env') : null, // 일부 환경에서 appPath 대신 필요
      resourcesPath ? path.join(resourcesPath, 'app', '.env') : null, // asar 비활성/특정 빌드 구조
      exeDir ? path.join(exeDir, '.env') : null, // exe 옆에 두는 운영 방식도 지원
      exeDir ? path.join(exeDir, 'resources', '.env') : null,
    ].filter((p): p is string => p !== null);
    
    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        console.log('[Load Env] Loading .env from:', envPath);
        let envContent = fs.readFileSync(envPath, 'utf-8');
        // Windows에서 UTF-8 BOM 제거 (BOM이 있으면 키가 매칭되지 않아 AZURE_OPENAI_DEPLOYMENT 등이 무시됨)
        if (envContent.charCodeAt(0) === 0xFEFF) {
          envContent = envContent.slice(1);
        }
        const lines = envContent.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          // 주석이나 빈 줄 건너뛰기
          if (!trimmedLine || trimmedLine.startsWith('#')) continue;
          
          // KEY=VALUE 형식 파싱
          const match = trimmedLine.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim().replace(/^\uFEFF/, '');
            let value = match[2].trim();
            
            // 따옴표 제거
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            // Azure OpenAI 등 앱 설정은 .env 값을 항상 우선 (기존 process.env 덮어씀)
            const overwriteFromEnv = key.startsWith('AZURE_OPENAI_') || key.startsWith('CAREERNET_') || key.startsWith('QNET_');
            if (overwriteFromEnv || !process.env[key]) {
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
  <div class="version">Version ${app.getVersion()}</div>
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
    width: 1400,
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
    // 프로덕션 환경: 창 크기 고정 (1400x700)
    windowOptions.resizable = false;
    windowOptions.minWidth = 1400;
    windowOptions.minHeight = 700;
    windowOptions.maxWidth = 1400;
    windowOptions.maxHeight = 700;
  }
  
  mainWindow = new BrowserWindow(windowOptions);
  
  // 메뉴바 완전히 제거
  mainWindow.setMenuBarVisibility(false);
  
  // 개발자 도구: 개발/프로덕션 모두 F12로 열기 허용 (개발 단계)
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
  
  if (!isDev) {
    // 프로덕션 환경에서도 개발자 도구는 F12로 열 수 있음 (개발 단계)
    // 추후 프로덕션 배포 시 아래 주석을 해제하여 보안 강화 가능
    /*
    mainWindow.webContents.on('devtools-opened', () => {
      console.warn('[Security] DevTools opened in production, closing...');
      if (mainWindow) {
        mainWindow.webContents.closeDevTools();
      }
    });
    */
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
      writeLog('[Main] Window ready-to-show event fired', 'info');
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    
    // 페이지 로드 완료 이벤트
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[Main] Page finished loading');
      writeLog('[Main] Page finished loading', 'info');
    });
    
    // 페이지 로드 실패 이벤트
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      const errorMsg = `[Main] Failed to load page: ${errorCode} - ${errorDescription} (${validatedURL})`;
      console.error(errorMsg);
      writeLog(errorMsg, 'error');
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
    // __dirname은 빌드 후 electron/main.js 위치를 가리킴
    // dist 폴더는 electron-app/dist에 있음
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('Loading production file:', indexPath);
    writeLog(`[Main] Loading production file: ${indexPath}`, 'info');
    writeLog(`[Main] __dirname: ${__dirname}`, 'info');
    writeLog(`[Main] File exists: ${fs.existsSync(indexPath)}`, 'info');
    
    // 파일 존재 확인
    if (!fs.existsSync(indexPath)) {
      const errorMsg = `[Main] Production index.html not found at: ${indexPath}`;
      console.error(errorMsg);
      writeLog(errorMsg, 'error');
      
      // 대체 경로 시도
      const altPath = path.join(process.resourcesPath, 'app', 'dist', 'index.html');
      writeLog(`[Main] Trying alternative path: ${altPath}`, 'info');
      if (fs.existsSync(altPath)) {
        console.log('Loading from alternative path:', altPath);
        mainWindow.loadFile(altPath);
      } else {
        writeLog(`[Main] Alternative path also not found`, 'error');
        // 에러 페이지 표시
        mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
          <html>
            <head><title>Error</title></head>
            <body style="font-family: Arial; padding: 20px;">
              <h1>파일을 찾을 수 없습니다</h1>
              <p>예상 경로: ${indexPath}</p>
              <p>대체 경로: ${altPath}</p>
              <p>__dirname: ${__dirname}</p>
              <p>resourcesPath: ${process.resourcesPath}</p>
            </body>
          </html>
        `)}`);
      }
    } else {
      mainWindow.loadFile(indexPath);
    }
    
    // 메인 윈도우가 표시될 준비가 되면 표시
    mainWindow.once('ready-to-show', () => {
      console.log('[Main] Window ready-to-show event fired');
      writeLog('[Main] Window ready-to-show event fired', 'info');
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    
    // 페이지 로드 완료 이벤트
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[Main] Page finished loading');
      writeLog('[Main] Page finished loading', 'info');
    });
    
    // 페이지 로드 실패 이벤트
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      const errorMsg = `[Main] Failed to load page: ${errorCode} - ${errorDescription} (${validatedURL})`;
      console.error(errorMsg);
      writeLog(errorMsg, 'error');
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

// 파일 열기 IPC 핸들러
ipcMain.handle('open-file', async (event, filePath: string) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
    }
    await shell.openPath(filePath);
    writeLog(`[Open File] Opened file: ${filePath}`, 'info');
    return { success: true };
  } catch (error: any) {
    writeLog(`[Open File] Error opening file: ${error.message || error}`, 'error');
    return { success: false, error: error.message || '파일 열기 실패' };
  }
});

// 이미지 파일을 base64로 읽기 IPC 핸들러
ipcMain.handle('read-image-as-base64', async (event, imagePath: string) => {
  try {
    if (!imagePath) {
      return { success: false, error: 'Image path is required' };
    }
    
    // 경로 정규화
    const normalizedPath = path.normalize(imagePath);
    
    if (!fs.existsSync(normalizedPath)) {
      writeLog(`[Read Image] Image file not found: ${normalizedPath}`, 'warn');
      return { success: false, error: 'Image file not found' };
    }
    
    // 이미지 파일 읽기
    const imageBuffer = fs.readFileSync(normalizedPath);
    
    // 확장자로 MIME 타입 결정
    const ext = path.extname(normalizedPath).toLowerCase();
    let mimeType = 'image/jpeg'; // 기본값
    if (ext === '.png') {
      mimeType = 'image/png';
    } else if (ext === '.gif') {
      mimeType = 'image/gif';
    } else if (ext === '.bmp') {
      mimeType = 'image/bmp';
    } else if (ext === '.webp') {
      mimeType = 'image/webp';
    }
    
    // base64로 변환
    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    writeLog(`[Read Image] Successfully read image: ${normalizedPath} (${imageBuffer.length} bytes)`, 'info');
    
    return { success: true, dataUrl };
  } catch (error: any) {
    writeLog(`[Read Image] Error reading image: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
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

// 폴더 내 이력서 파일 목록 가져오기 IPC 핸들러 (documentType: 'docx' | 'pdf')
ipcMain.handle('get-docx-files', async (event, folderPath: string, documentType?: 'docx' | 'pdf') => {
  try {
    if (!folderPath || !fs.existsSync(folderPath)) {
      return [];
    }
    
    const extToMatch = documentType === 'pdf' ? '.pdf' : '.docx';
    const files = fs.readdirSync(folderPath);
    const resumeFiles = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        if (ext !== extToMatch) return false;
        // DOCX: Word 임시/잠금 파일(~$로 시작) 제외
        if (documentType === 'docx' && path.basename(file).startsWith('~$')) return false;
        // PDF 모드일 때는 파일명(확장자 제외)이 '_이력서'로 끝나는 것만
        if (documentType === 'pdf') {
          const base = path.basename(file, ext);
          return base.endsWith('_이력서');
        }
        return true;
      })
      .map(file => ({
        name: file,
        path: path.join(folderPath, file),
      }));
    
    return resumeFiles;
  } catch (error) {
    console.error('[Get Resume Files] Error:', error);
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

// 확장자 → MIME (증명사진 캐시용)
function getMimeFromExt(ext: string): string {
  const e = (ext || '').toLowerCase();
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  if (e === 'png') return 'image/png';
  if (e === 'gif') return 'image/gif';
  if (e === 'webp') return 'image/webp';
  return 'image/jpeg';
}

// 캐시 데이터 저장 IPC 핸들러 (photoPath가 있으면 파일 읽어서 photoDataUrl로 캐시에 포함)
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
    
    for (const result of results) {
      const metadata = getFileMetadata(result.filePath);
      if (!metadata) continue;
      
      const data = { ...result.data };
      // 증명사진 경로가 있으면 파일을 읽어 base64 data URL로 캐시에 포함 (뒤로 갔다 와도 사진 유지)
      if (data.photoPath && typeof data.photoPath === 'string' && fs.existsSync(data.photoPath)) {
        try {
          const buf = fs.readFileSync(data.photoPath);
          const ext = path.extname(data.photoPath).replace(/^\./, '') || 'jpg';
          const mime = getMimeFromExt(ext);
          data.photoDataUrl = `data:${mime};base64,${buf.toString('base64')}`;
        } catch (e: any) {
          console.warn('[Cache] Failed to read photo for cache:', data.photoPath, e?.message);
        }
      }
      
      cacheData.entries[result.filePath] = {
        filePath: result.filePath,
        fileName: result.fileName,
        size: metadata.size,
        mtime: metadata.mtime,
        data,
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
// 자격증 파싱 IPC 핸들러 추가
ipcMain.handle('parse-official-certificates', async (event, fileContent: string) => {
  try {
    if (!extractTablesFromDocx || !mapResumeDataToApplicationData) {
      await loadCareerFitScoring();
    }
    // career-fit-scoring 모듈에서 함수 가져오기
    const { parseOfficialCertificates } = require('career-fit-scoring');
    return parseOfficialCertificates(fileContent);
  } catch (e: any) {
    try {
      const module = requireCareerFitScoringModule();
      return module.parseOfficialCertificates(fileContent);
    } catch (e2: any) {
      writeLog(`[Parse Official Certs] Error: ${e2.message || e2}`, 'error');
      throw e2;
    }
  }
});

ipcMain.handle('parse-additional-national-certificates', async (event, content: string) => {
  try {
    if (!extractTablesFromDocx || !mapResumeDataToApplicationData) {
      await loadCareerFitScoring();
    }
    const { parseAdditionalNationalCertificates } = require('career-fit-scoring');
    return parseAdditionalNationalCertificates(content);
  } catch (e: any) {
    try {
      const module = requireCareerFitScoringModule();
      return module.parseAdditionalNationalCertificates(content);
    } catch (e2: any) {
      writeLog(`[Parse Additional Certs] Error: ${e2.message || e2}`, 'error');
      throw e2;
    }
  }
});

ipcMain.handle('get-additional-national-certificates', async () => {
  try {
    if (!extractTablesFromDocx || !mapResumeDataToApplicationData) {
      await loadCareerFitScoring();
    }
    const { ADDITIONAL_NATIONAL_CERTIFICATES } = require('career-fit-scoring');
    return ADDITIONAL_NATIONAL_CERTIFICATES;
  } catch (e: any) {
    try {
      const module = requireCareerFitScoringModule();
      return module.ADDITIONAL_NATIONAL_CERTIFICATES;
    } catch (e2: any) {
      writeLog(`[Get Additional Certs] Error: ${e2.message || e2}`, 'error');
      throw e2;
    }
  }
});

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
    // packaged 환경에서의 경로 확보
    const exeDir = (() => {
      try {
        return app?.getPath ? path.dirname(app.getPath('exe')) : null;
      } catch {
        return null;
      }
    })();
    const appPath = app.getAppPath();
    const resourcesPath = (process as any).resourcesPath ? (process as any).resourcesPath : null;
    
    const possiblePaths = [
      // 빌드된 앱의 resources/app 경로 (files에 포함된 파일들)
      path.join(appPath, 'certificate_official.txt'),
      path.join(appPath, '..', 'certificate_official.txt'),
      // resources 루트 (extraResources로 복사된 파일들)
      resourcesPath ? path.join(resourcesPath, 'certificate_official.txt') : null,
      resourcesPath ? path.join(resourcesPath, 'app', 'certificate_official.txt') : null,
      resourcesPath ? path.join(resourcesPath, 'app.asar', 'certificate_official.txt') : null,
      // exe 디렉토리 기반 경로
      exeDir ? path.join(exeDir, 'certificate_official.txt') : null,
      exeDir ? path.join(exeDir, 'resources', 'certificate_official.txt') : null,
      // __dirname 기반 경로
      path.join(__dirname, '../../..', 'certificate_official.txt'),
      path.join(__dirname, '../..', 'certificate_official.txt'),
      path.join(__dirname, '..', 'certificate_official.txt'),
      // process.cwd() 기반 경로
      path.join(process.cwd(), 'certificate_official.txt'),
      path.join(process.cwd(), '..', 'certificate_official.txt'),
      path.join(process.cwd(), '../..', 'certificate_official.txt'),
      path.join(process.cwd(), '../../..', 'certificate_official.txt'),
    ].filter((p): p is string => p !== null);
    
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

/** 주소 문자열로 거주지 분류 (DOCX 쪽 classifyResidence와 동일 규칙) */
function classifyResidenceFromAddress(address: string | undefined): string | undefined {
  if (!address || typeof address !== 'string') return undefined;
  const a = address.toLowerCase();
  if (a.includes('시흥') || a.includes('시흥시')) return '시흥';
  if (a.includes('안산') || a.includes('안산시')) return '안산';
  if (a.includes('서울') || a.includes('서울시') || a.includes('서울특별시')) return '서울';
  if (a.includes('경기') || a.includes('경기도') || a.includes('인천') || a.includes('수원') || a.includes('성남') || a.includes('고양') || a.includes('용인') || a.includes('부천') || a.includes('안양') || a.includes('평택') || a.includes('의정부') || a.includes('광명') || a.includes('과천') || a.includes('구리') || a.includes('남양주') || a.includes('오산') || a.includes('의왕') || a.includes('이천') || a.includes('하남') || a.includes('화성')) return '수도권';
  return '지방';
}

/** DOCX와 동일한 applicationData 키 구조. 없는 값은 "" */
function emptyAppKeys(): Record<string, string> {
  const app: Record<string, string> = {};
  const empty = (prefix: string, count: number, suffix = '') => {
    for (let i = 1; i <= count; i++) app[`${prefix}${i}${suffix}`] = '';
  };
  app.name = '';
  app.nameEnglish = '';
  app.birthDate = '';
  app.email = '';
  app.phone = '';
  app.address = '';
  app.residence = '';
  app.desiredSalary = '';
  app.lastSalary = '';
  app.militaryService = '';
  app.supportField = '';
  app.applicationDate = '';
  empty('educationStartDate', 6);
  empty('educationEndDate', 6);
  empty('universityName', 6);
  empty('universityMajor', 6, '_1');
  empty('universityGPA', 6);
  empty('universityGPAMax', 6);
  empty('universityLocation', 6);
  empty('universityGraduationType', 6);
  empty('universityDegreeType', 6);
  empty('careerCompanyName', 5);
  empty('careerStartDate', 5);
  empty('careerEndDate', 5);
  empty('careerDepartment', 5);
  empty('careerPosition', 5);
  empty('careerJobType', 5);
  empty('careerSalary', 5);
  empty('careerEmploymentStatus', 5);
  empty('careerDetailStartDate', 4);
  empty('careerDetailEndDate', 4);
  empty('careerDetailCompanyName', 4);
  empty('careerDetailDepartment', 4);
  empty('careerDetailPosition', 4);
  empty('careerDetailSalary', 4);
  empty('careerDetailReason', 4);
  empty('careerDetailDescription', 4);
  app.careerDetailContent = ''; // PDF 전용: 경력기술서 섹션 통째로 (경력세부내용)
  for (let i = 1; i <= 10; i++) {
    app[`certificateName${i}`] = '';
    app[`certificateGrade${i}`] = '';
    app[`certificateIssuer${i}`] = '';
    app[`certificateDate${i}`] = '';
  }
  empty('selfIntroduction', 4);
  return app;
}

/** PDF 파싱 결과를 applicationData 형식으로 변환 (DOCX와 동일 키, 없으면 "") */
function mapPdfResumeToApplicationData(pdfResult: any): any {
  const app = emptyAppKeys();
  const basic = pdfResult.basicInfo || {};
  const careers = pdfResult.careers || [];
  const education = pdfResult.education || [];
  const certifications = pdfResult.certifications || [];
  const employmentPreference = pdfResult.employmentPreference || {};
  const selfIntroduction = (pdfResult.selfIntroduction || '').trim();

  // 기본 정보
  app.name = basic.name != null ? String(basic.name) : '';
  app.nameEnglish = basic.nameEnglish != null ? String(basic.nameEnglish) : '';
  app.birthDate = basic.birthYear ? `${basic.birthYear}-01-01` : (basic.birthDate != null ? String(basic.birthDate) : '');
  app.email = basic.email != null ? String(basic.email) : '';
  app.phone = basic.phone != null ? String(basic.phone) : '';
  app.address = basic.address != null ? String(basic.address) : '';
  app.residence = basic.residence != null ? String(basic.residence) : (basic.address ? classifyResidenceFromAddress(basic.address) : '') || '';
  app.desiredSalary = basic.desiredSalary != null ? String(basic.desiredSalary) : '';
  app.lastSalary = basic.lastSalary != null ? String(basic.lastSalary) : '';
  app.militaryService = employmentPreference.militaryStatus || employmentPreference.militaryDetail || employmentPreference.militaryPeriod
    ? [employmentPreference.militaryStatus, employmentPreference.militaryDetail, employmentPreference.militaryPeriod].filter(Boolean).join(' ').trim()
    : '';
  app.supportField = basic.supportField != null ? String(basic.supportField) : '';
  app.applicationDate = basic.applicationDate != null ? String(basic.applicationDate) : '';

  // 경력 (1~5) + 경력기술 상세
  careers.forEach((c: any, i: number) => {
    if (i >= 5) return;
    const idx = i + 1;
    const company = c.companyNameAndDepartment ?? c.company ?? '';
    app[`careerCompanyName${idx}`] = String(company);
    app[`careerStartDate${idx}`] = c.startDate != null ? String(c.startDate) : '';
    app[`careerEndDate${idx}`] = c.endDate != null ? String(c.endDate) : '';
    app[`careerDepartment${idx}`] = c.role != null ? String(c.role) : '';
    app[`careerPosition${idx}`] = c.role != null ? String(c.role) : '';
    app[`careerJobType${idx}`] = c.role != null ? String(c.role) : '';
    app[`careerSalary${idx}`] = c.salary != null ? String(c.salary) : '';
    app[`careerEmploymentStatus${idx}`] = c.leaveReason != null ? String(c.leaveReason) : '';
    app[`careerDetailStartDate${idx}`] = c.startDate != null ? String(c.startDate) : '';
    app[`careerDetailEndDate${idx}`] = c.endDate != null ? String(c.endDate) : '';
    app[`careerDetailCompanyName${idx}`] = String(company);
    app[`careerDetailDepartment${idx}`] = c.role != null ? String(c.role) : '';
    app[`careerDetailPosition${idx}`] = c.role != null ? String(c.role) : '';
    app[`careerDetailSalary${idx}`] = c.salary != null ? String(c.salary) : '';
    app[`careerDetailReason${idx}`] = c.leaveReason != null ? String(c.leaveReason) : '';
    app[`careerDetailDescription${idx}`] = c.description != null ? String(c.description) : '';
  });

  // 학력 (1~6): gpa가 "3.46/4.5" 형태면 분리하여 universityGPA / universityGPAMax 설정
  education.forEach((e: any, i: number) => {
    if (i >= 6) return;
    const idx = i + 1;
    writeLog(`[PDF Education] entry ${idx} school=${e.school ?? ''} gpa=${e.gpa ?? '(없음)'}`, 'info');
    app[`educationStartDate${idx}`] = e.startDate != null ? String(e.startDate) : '';
    app[`educationEndDate${idx}`] = e.endDate != null ? String(e.endDate) : '';
    app[`universityName${idx}`] = e.school != null ? String(e.school) : '';
    app[`universityMajor${idx}_1`] = e.major != null ? String(e.major) : '';
    const gpaRaw = e.gpa != null ? String(e.gpa).trim() : '';
    if (gpaRaw && gpaRaw.includes('/')) {
      const parts = gpaRaw.split('/');
      app[`universityGPA${idx}`] = parts[0].trim();
      app[`universityGPAMax${idx}`] = parts.length > 1 ? parts[1].trim() : '';
    } else {
      app[`universityGPA${idx}`] = gpaRaw;
      app[`universityGPAMax${idx}`] = '';
    }
    app[`universityLocation${idx}`] = '';
    app[`universityGraduationType${idx}`] = e.degree != null ? String(e.degree) : '';
    const degreeType = (e.school && String(e.school).indexOf('고등') >= 0) ? '고등학교' : (e.degree || '');
    app[`universityDegreeType${idx}`] = degreeType ? String(degreeType) : '';
  });

  // 자격증 (1~10): PDF certifications → certificateNameN, certificateGradeN, certificateIssuerN, certificateDateN
  certifications.forEach((c: any, i: number) => {
    if (i >= 10) return;
    const idx = i + 1;
    app[`certificateName${idx}`] = c.name != null ? String(c.name) : '';
    app[`certificateGrade${idx}`] = c.grade != null ? String(c.grade) : '';
    app[`certificateIssuer${idx}`] = c.issuer != null ? String(c.issuer) : '';
    app[`certificateDate${idx}`] = c.date != null ? String(c.date) : '';
  });

  // 자기소개서 (1~4): PDF는 하나만 있으면 selfIntroduction1에
  if (selfIntroduction) {
    app.selfIntroduction1 = selfIntroduction;
  }

  // PDF 전용: 경력기술서 섹션 통째로 (경력세부내용)
  const careerDetailContent = pdfResult.careerDetailContent;
  if (careerDetailContent != null && String(careerDetailContent).trim() !== '') {
    app.careerDetailContent = String(careerDetailContent).trim();
  }

  return app;
}

// 이력서 처리 IPC 핸들러 (documentType: 'docx' | 'pdf', 기본값 docx)
ipcMain.handle('process-resume', async (event, filePath: string, documentType?: 'docx' | 'pdf') => {
  try {
    const isPdf = documentType === 'pdf';

    if (isPdf) {
      // PDF: parse_pdf_resume.py 실행 후 applicationData로 매핑
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const scriptPaths = [
        path.join(__dirname, '..', '..', 'scripts', 'parse_pdf_resume.py'),
        path.join(__dirname, '..', 'scripts', 'parse_pdf_resume.py'),
        path.join(process.cwd(), 'scripts', 'parse_pdf_resume.py'),
        path.join(app.getAppPath(), 'scripts', 'parse_pdf_resume.py'),
        path.join(app.getAppPath(), '..', 'scripts', 'parse_pdf_resume.py'),
      ];
      let scriptPath: string | null = null;
      for (const p of scriptPaths) {
        if (fs.existsSync(p)) {
          scriptPath = p;
          break;
        }
      }
      if (!scriptPath) {
        throw new Error('parse_pdf_resume.py 스크립트를 찾을 수 없습니다.');
      }
      const isWindows = process.platform === 'win32';
      let pythonCmd = isWindows ? 'python' : 'python3';
      let pdftotextArg = '';
      // 임베디드 파이썬 우선 사용 (DOCX 사진 추출과 동일 경로)
      try {
        if (app && app.getPath) {
          const exePath = app.getPath('exe');
          const appRoot = path.dirname(exePath);
          const embedPython = path.join(appRoot, 'resources', 'python-embed', isWindows ? 'python.exe' : 'python3');
          if (fs.existsSync(embedPython)) {
            pythonCmd = embedPython;
            writeLog('[Process Resume PDF] Embeddable Python 사용: ' + pythonCmd, 'info');
          } else {
            writeLog('[Process Resume PDF] Embeddable Python 없음, 시스템 Python 사용', 'info');
          }
          // 번들 Poppler pdftotext (extraResources → resources/poppler-windows/bin)
          // win-unpacked 기준: win-unpacked/resources/poppler-windows/bin/pdftotext.exe
          const bundledCandidates = [
            path.join(appRoot, 'resources', 'poppler-windows', 'bin', isWindows ? 'pdftotext.exe' : 'pdftotext'),
            ...(process.resourcesPath ? [path.join(process.resourcesPath, 'poppler-windows', 'bin', isWindows ? 'pdftotext.exe' : 'pdftotext')] : []),
            path.join(appRoot, '..', 'resources', 'poppler-windows', 'bin', isWindows ? 'pdftotext.exe' : 'pdftotext'),
          ].filter(Boolean);
          for (const bundledPdftotext of bundledCandidates) {
            if (bundledPdftotext && fs.existsSync(bundledPdftotext)) {
              pdftotextArg = ` --pdftotext "${bundledPdftotext}"`;
              writeLog('[Process Resume PDF] 번들 pdftotext 사용: ' + bundledPdftotext, 'info');
              break;
            }
          }
          if (!pdftotextArg) {
            writeLog('[Process Resume PDF] 번들 pdftotext 미발견. 시도 경로: ' + bundledCandidates.join(' | '), 'warn');
            writeLog('[Process Resume PDF] exePath=' + exePath + ', appRoot=' + appRoot + ', resourcesPath=' + (process.resourcesPath ?? 'undefined'), 'warn');
          }
        }
      } catch (e: any) {
        writeLog('[Process Resume PDF] Embed 경로 확인 실패, 시스템 Python 사용: ' + (e?.message || ''), 'info');
      }
      // 개발환경: 번들 pdftotext 없으면 프로젝트 루트(career-fit-scoring) poppler-windows 사용 (CLI와 동일 추출)
      if (!pdftotextArg) {
        const devPaths = [
          path.join(__dirname, '..', '..', '..', 'poppler-windows', 'bin', isWindows ? 'pdftotext.exe' : 'pdftotext'),
          path.join(process.cwd(), 'poppler-windows', 'bin', isWindows ? 'pdftotext.exe' : 'pdftotext'),
          path.join(process.cwd(), '..', 'poppler-windows', 'bin', isWindows ? 'pdftotext.exe' : 'pdftotext'),
        ];
        for (const p of devPaths) {
          if (fs.existsSync(p)) {
            pdftotextArg = ` --pdftotext "${p}"`;
            writeLog('[Process Resume PDF] 개발환경 pdftotext 사용: ' + p, 'info');
            break;
          }
        }
      }
      const resumeDir = path.dirname(filePath);
      const debugDir = path.join(resumeDir, 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      if (!pdftotextArg) {
        writeLog('[Process Resume PDF] pdftotext 없음 → 추출 및 AI 분석 건너뜀', 'warn');
        throw new Error(
          'PDF 추출에 pdftotext(poppler)가 필요합니다. pdftotext가 없어 추출 및 AI 분석을 건너뜁니다. 빌드 시 프로젝트 루트에 poppler-windows를 포함한 뒤 재빌드해 주세요.'
        );
      }
      const os = require('os');
      const pdfBaseName = path.basename(filePath, path.extname(filePath));
      const photoTempDir = path.join(os.tmpdir(), 'career-fit-scoring', 'photos', pdfBaseName);
      fs.mkdirSync(photoTempDir, { recursive: true });
      const debugDirArg = ` --debug-dir "${debugDir}"`;
      const corpusHeadersArg = ' --use-corpus-headers';
      const photoDirArg = ` --photo-dir "${photoTempDir}"`;
      const command = `"${pythonCmd}" "${scriptPath}"${pdftotextArg}${debugDirArg}${corpusHeadersArg}${photoDirArg} "${filePath}"`;
      writeLog('[Process Resume PDF] ' + command, 'info');
      const execOpts: any = { maxBuffer: 10 * 1024 * 1024, timeout: 60000 };
      execOpts.env = { ...process.env, PYTHONIOENCODING: 'utf-8' };
      const { stdout, stderr } = await execAsync(command, execOpts);
      if (stderr && stderr.trim()) writeLog(`[Process Resume PDF] stderr: ${stderr}`, 'warn');

      let pdfResult: any;
      try {
        pdfResult = JSON.parse(stdout);
      } catch (e: any) {
        writeLog(`[Process Resume PDF] JSON parse error: ${e.message}`, 'error');
        throw new Error('PDF 파싱 결과를 읽을 수 없습니다.');
      }
      if (pdfResult.error) {
        throw new Error(pdfResult.error);
      }

      const baseName = path.basename(filePath, path.extname(filePath));
      // 디버그: Python 파싱 원본 결과 저장 (2단계 최종 = _python.json, 1·2단계 중간은 --debug-dir로 Python이 저장)
      try {
        const pythonDebugPath = path.join(debugDir, `${baseName}_python.json`);
        fs.writeFileSync(pythonDebugPath, JSON.stringify(pdfResult, null, 2), 'utf-8');
        writeLog(`[Debug] Python 파싱 결과 저장: ${pythonDebugPath}`, 'info');
      } catch (debugError: any) {
        writeLog(`[Debug] Python 결과 저장 실패: ${debugError.message}`, 'warn');
      }

      const applicationData = mapPdfResumeToApplicationData(pdfResult);

      // 디버그: Electron 재매핑 결과 저장 (3단계 = applicationData → _electron.json)
      try {
        const electronDebugPath = path.join(debugDir, `${baseName}_electron.json`);
        fs.writeFileSync(electronDebugPath, JSON.stringify(applicationData, null, 2), 'utf-8');
        writeLog(`[Debug] Electron 매핑 결과 저장: ${electronDebugPath}`, 'info');
      } catch (debugError: any) {
        writeLog(`[Debug] Electron 결과 저장 실패: ${debugError.message}`, 'warn');
      }
      const basic = pdfResult.basicInfo || {};
      const careers = pdfResult.careers || [];
      // 테이블용: name (파일명 폴백), age(숫자), lastCompany, lastSalary, residence
      let name = applicationData.name || basic.name;
      if (!name && filePath) {
        const base = path.basename(filePath, '.pdf').replace(/_이력서$/, '');
        name = base.split('_')[0] || base || undefined;
      }
      const birthDate = applicationData.birthDate ?? (basic.birthYear ? `${basic.birthYear}-01-01` : undefined);
      const ageNum = birthDate ? calculateAge(birthDate) : (basic.age != null ? Number(basic.age) : undefined);
      const age = ageNum != null && !Number.isNaN(ageNum) ? ageNum : undefined;
      const lastCompany =
        applicationData.careerCompanyName1 ??
        (careers[0] && (careers[0].companyNameAndDepartment ?? careers[0].company)) ??
        undefined;
      const lastSalary = applicationData.careerSalary1 ?? basic.lastSalary ?? (careers[0] && careers[0].salary) ?? undefined;
      const residence =
        applicationData.residence ??
        basic.residence ??
        (basic.address || applicationData.address ? classifyResidenceFromAddress(basic.address || applicationData.address) : undefined);

      const searchableText = [
        name,
        lastCompany,
        applicationData.universityName1,
        applicationData.certificateName1,
        applicationData.certificateName2,
        applicationData.certificateName3,
      ].filter(Boolean).join(' ');

      let photoPath: string | undefined = undefined;
      if (pdfResult.profilePhotoFilename) {
        const resolved = path.join(photoTempDir, pdfResult.profilePhotoFilename);
        if (fs.existsSync(resolved)) {
          photoPath = resolved;
          writeLog('[Process Resume PDF] 증명사진 추출: ' + photoPath, 'info');
        }
      }

      return {
        success: true,
        applicationData,
        name,
        age,
        lastCompany,
        lastSalary,
        residence,
        searchableText,
        photoPath,
      };
    }

    // DOCX 경로
    if (!extractTablesFromDocx || !mapResumeDataToApplicationData) {
      writeLog('[Process Resume] Loading career-fit-scoring module...', 'info');
      await loadCareerFitScoring();
    }

    if (!extractTablesFromDocx) {
      const errorMsg = '[Process Resume] extractTablesFromDocx is not available';
      writeLog(errorMsg, 'error');
      throw new Error(errorMsg);
    }

    // DOCX 파일에서 테이블 추출
    const tables = await extractTablesFromDocx(filePath);

    // 매핑 설정으로 applicationData 변환
    const applicationData = mapResumeDataToApplicationData(tables);
    
    // 이미지 추출 (증명사진)
    let photoPath: string | undefined = undefined;
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      const path = require('path');
      const fs = require('fs');
      const os = require('os');
      
      // 임시 디렉토리 생성 (파일명 기반)
      const fileName = path.basename(filePath, path.extname(filePath));
      const tempDir = path.join(os.tmpdir(), 'career-fit-scoring', 'photos', fileName);
      fs.mkdirSync(tempDir, { recursive: true });
      writeLog(`[Photo Extract] 임시 디렉토리 생성: ${tempDir}`, 'info');
      
      // Python 스크립트 경로 찾기
      const scriptPaths = [
        path.join(__dirname, '..', '..', 'scripts', 'extract_images_from_docx.py'),
        path.join(__dirname, '..', 'scripts', 'extract_images_from_docx.py'),
        path.join(process.cwd(), 'scripts', 'extract_images_from_docx.py'),
        path.join(app.getAppPath(), 'scripts', 'extract_images_from_docx.py'),
        path.join(app.getAppPath(), '..', 'scripts', 'extract_images_from_docx.py'),
      ];
      
      let scriptPath: string | null = null;
      for (const candidatePath of scriptPaths) {
        if (fs.existsSync(candidatePath)) {
          scriptPath = candidatePath;
          writeLog(`[Photo Extract] Python 스크립트 찾음: ${scriptPath}`, 'info');
          break;
        }
      }
      
      if (!scriptPath) {
        writeLog(`[Photo Extract] Python 스크립트를 찾을 수 없습니다. 시도한 경로: ${scriptPaths.join(', ')}`, 'warn');
      } else {
        // Python 실행 경로
        const isWindows = process.platform === 'win32';
        let pythonCmd = isWindows ? 'python' : 'python3';
        
        // Python embeddable 우선 시도
        try {
          if (app && app.getPath) {
            const exePath = app.getPath('exe');
            const resourcesPath = path.dirname(exePath);
            const embedPython = path.join(resourcesPath, 'resources', 'python-embed', isWindows ? 'python.exe' : 'python3');
            if (fs.existsSync(embedPython)) {
              pythonCmd = embedPython;
              writeLog(`[Photo Extract] Embeddable Python 사용: ${pythonCmd}`, 'info');
            } else {
              writeLog(`[Photo Extract] Embeddable Python 없음, 시스템 Python 사용: ${pythonCmd}`, 'info');
            }
          }
        } catch (e) {
          writeLog(`[Photo Extract] Electron app 경로 확인 실패, 시스템 Python 사용: ${pythonCmd}`, 'info');
        }
        
        // 이미지 추출 실행
        const command = `"${pythonCmd}" "${scriptPath}" "${filePath}" "${tempDir}"`;
        writeLog(`[Photo Extract] 명령 실행: ${command}`, 'info');
        
        try {
          const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
          
          if (stderr && stderr.trim()) {
            writeLog(`[Photo Extract] Python stderr: ${stderr}`, 'warn');
          }
          
          if (!stdout || !stdout.trim()) {
            writeLog(`[Photo Extract] Python 스크립트 출력이 비어있습니다.`, 'warn');
          } else {
            // JSON 파싱 시도
            let result: any;
            try {
              result = JSON.parse(stdout);
            } catch (parseError: any) {
              writeLog(`[Photo Extract] JSON 파싱 실패: ${parseError.message}`, 'error');
              writeLog(`[Photo Extract] stdout 내용 (처음 500자): ${stdout.substring(0, 500)}`, 'error');
              throw parseError;
            }
            
            writeLog(`[Photo Extract] 추출 결과: success=${result.success}, 이미지 개수=${result.images?.length || 0}`, 'info');
            
            if (result.error) {
              writeLog(`[Photo Extract] Python 스크립트 에러: ${result.error}`, 'error');
            } else if (result.success && result.images && result.images.length > 0) {
              writeLog(`[Photo Extract] ${result.images.length}개 이미지 추출 성공`, 'info');
              
              // 증명사진 위치 (Table 0, Row 2, Cell 4)에 있는 이미지 찾기
              let photoImage = null;
              for (const img of result.images) {
                const cellPositions = img.cell_positions || [];
                writeLog(`[Photo Extract] 이미지 확인: ${img.filename}, 셀 위치 개수=${cellPositions.length}`, 'info');
                
                // Table 0, Row 2, Cell 4 (증명사진 위치)에 있는 이미지 찾기
                const isPhotoCell = cellPositions.some((pos: any) => 
                  pos.table_index === 0 && pos.row_index === 2 && pos.cell_index === 4
                );
                if (isPhotoCell) {
                  photoImage = img;
                  writeLog(`[Photo Extract] 증명사진 위치(Table 0, Row 2, Cell 4)에서 이미지 찾음: ${img.filename}`, 'info');
                  break;
                }
              }
              
              // 증명사진 위치에 있는 이미지가 없으면 첫 번째 이미지 사용
              if (!photoImage) {
                photoImage = result.images[0];
                writeLog(`[Photo Extract] 증명사진 위치에서 이미지를 찾지 못해 첫 번째 이미지 사용: ${photoImage.filename}`, 'info');
              }
              
              // 경로 정규화 (절대 경로로 변환)
              let resolvedPath = photoImage.output_path;
              if (!path.isAbsolute(resolvedPath)) {
                resolvedPath = path.resolve(tempDir, resolvedPath);
              }
              resolvedPath = path.normalize(resolvedPath);
              
              writeLog(`[Photo Extract] 사진 경로 확인: ${resolvedPath}`, 'info');
              
              // 파일이 실제로 존재하는지 확인
              if (fs.existsSync(resolvedPath)) {
                photoPath = resolvedPath;
                writeLog(`[Photo Extract] 사진 경로 설정 성공: ${photoPath}`, 'info');
              } else {
                writeLog(`[Photo Extract] 사진 파일이 존재하지 않음: ${resolvedPath}`, 'warn');
                // 상대 경로로도 시도
                const altPath = path.join(tempDir, photoImage.filename);
                if (fs.existsSync(altPath)) {
                  photoPath = altPath;
                  writeLog(`[Photo Extract] 대체 경로로 사진 찾음: ${photoPath}`, 'info');
                } else {
                  writeLog(`[Photo Extract] 대체 경로도 존재하지 않음: ${altPath}`, 'warn');
                }
              }
            } else {
              writeLog(`[Photo Extract] 이미지가 추출되지 않았습니다. (success=${result.success}, images=${result.images?.length || 0})`, 'warn');
            }
          }
        } catch (execError: any) {
          writeLog(`[Photo Extract] Python 스크립트 실행 실패: ${execError.message}`, 'error');
          if (execError.stdout) {
            writeLog(`[Photo Extract] stdout: ${execError.stdout.substring(0, 500)}`, 'error');
          }
          if (execError.stderr) {
            writeLog(`[Photo Extract] stderr: ${execError.stderr.substring(0, 500)}`, 'error');
          }
        }
      }
    } catch (error: any) {
      // 이미지 추출 실패는 무시 (선택적 기능)
      writeLog(`[Photo Extract] 이미지 추출 중 예외 발생: ${error.message}`, 'error');
      if (error.stack) {
        writeLog(`[Photo Extract] 스택 트레이스: ${error.stack}`, 'error');
      }
    }
    
    if (!photoPath) {
      writeLog(`[Photo Extract] 최종 결과: 사진 경로를 찾지 못했습니다.`, 'warn');
    } else {
      writeLog(`[Photo Extract] 최종 결과: 사진 경로 설정 완료 - ${photoPath}`, 'info');
    }
    
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
      photoPath, // 증명사진 경로
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

// AI API 호출 및 파싱 헬퍼 함수
async function callAIAndParse(
  systemPrompt: string,
  userPromptText: string,
  fileName: string,
  retryCount: number = 0
): Promise<{
  success: boolean;
  grade: string;
  report: any;
  reportParsed: boolean;
  error?: string;
}> {
  loadEnvFile();
  const MAX_RETRIES = 1; // 최대 1회 재시도
  const API_KEY = process.env.AZURE_OPENAI_API_KEY || '';
  const API_ENDPOINT = (process.env.AZURE_OPENAI_ENDPOINT || 'https://roar-mjm4cwji-swedencentral.openai.azure.com/').replace(/\/+$/, '');
  const DEPLOYMENT = (process.env.AZURE_OPENAI_DEPLOYMENT || '').replace(/^\uFEFF/, '').trim() || 'gpt-4o';
  const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
  if (retryCount === 0) {
    console.log('[AI Check] Using deployment:', DEPLOYMENT, '(from AZURE_OPENAI_DEPLOYMENT)');
  }
  const apiUrl = `${API_ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`;

  try {
    console.log(`[AI Check] Calling Azure OpenAI API for: ${fileName}${retryCount > 0 ? ` (재시도 ${retryCount})` : ''}`);

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
      
      // 429 Rate Limit 에러 처리
      if (response.status === 429) {
        let retryAfter = 10;
        try {
          const errorJson = JSON.parse(errorData);
          if (errorJson.error?.message) {
            const retryMatch = errorJson.error.message.match(/after (\d+) seconds?/i);
            if (retryMatch) {
              retryAfter = parseInt(retryMatch[1], 10) + 2;
            }
          }
        } catch (e) {
          // JSON 파싱 실패 시 기본값 사용
        }
        
        writeLog(`[AI Check] Rate limit reached, retrying after ${retryAfter} seconds...`, 'warn');
        throw new Error(`RATE_LIMIT:${retryAfter}`);
      }
      
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

    // JSON 파싱 시도
    let parsedReport: {
      grade: string;
      summary: string;
      strengths: string[];
      weaknesses: string[];
      opinion: string;
      evaluations?: {
        careerFit?: string;
        requiredQual?: string;
        preferredQual?: string;
        certification?: string;
      };
      gradeEvaluations?: {
        최상?: { satisfied: boolean; reason: string };
        상?: { satisfied: boolean; reason: string };
        중?: { satisfied: boolean; reason: string };
        하?: { satisfied: boolean; reason: string };
        최하?: { satisfied: boolean; reason: string };
      };
    } | null = null;
    
    let grade = 'C';
    let reportText = aiContent;
    let parseSuccess = false;

    try {
      // JSON 코드 블록 제거
      let jsonText = aiContent.trim();
      if (jsonText.startsWith('```')) {
        const lines = jsonText.split('\n');
        const startIndex = lines[0].includes('json') ? 1 : 0;
        const endIndex = lines[lines.length - 1].trim() === '```' ? lines.length - 1 : lines.length;
        jsonText = lines.slice(startIndex, endIndex).join('\n').trim();
      }
      
      parsedReport = JSON.parse(jsonText);
      
      // 유효한 객체인지 확인
      if (parsedReport && typeof parsedReport === 'object' && 'grade' in parsedReport) {
        const gradeMap: { [key: string]: string } = {
          '최상': 'A',
          '상': 'B',
          '중': 'C',
          '하': 'D',
          '최하': 'E'
        };
        
        grade = gradeMap[parsedReport.grade] || 'C';
        
        // 필수 필드가 모두 있는지 확인
        if (parsedReport.summary && parsedReport.summary.trim() && 
            parsedReport.opinion && parsedReport.opinion.trim()) {
          parseSuccess = true;
        }
      } else {
        parsedReport = null;
      }
      
      if (parseSuccess) {
        console.log('[AI Check] Successfully parsed JSON for:', fileName, 'Grade:', grade);
      } else {
        console.warn('[AI Check] JSON parsed but missing required fields for:', fileName);
      }
    } catch (parseError: any) {
      console.warn('[AI Check] Failed to parse JSON:', parseError.message);
      console.warn('[AI Check] Raw content:', aiContent.substring(0, 500));
      
      // 등급 추출 시도
      const gradeMatch = aiContent.match(/등급[:\s]*([A-D최상중하])/i) || 
                        aiContent.match(/["']grade["']:\s*["']([A-D최상중하])/i) ||
                        aiContent.match(/\[([A-D])\]/i);
      
      if (gradeMatch) {
        const matchedGrade = gradeMatch[1].toUpperCase();
        const gradeMap: { [key: string]: string } = {
          '최상': 'A',
          '상': 'B',
          '중': 'C',
          '하': 'D',
          '최하': 'E'
        };
        grade = gradeMap[matchedGrade] || (matchedGrade.match(/[A-D]/) ? matchedGrade : 'C');
      }
      
      // evaluations 추출 시도
      try {
        const evaluationsMatch = aiContent.match(/"evaluations"\s*:\s*\{[^}]*\}/s);
        if (evaluationsMatch) {
          const evaluationsJson = `{${evaluationsMatch[0]}}`;
          const evaluationsOnly = JSON.parse(evaluationsJson);
          if (evaluationsOnly.evaluations && typeof evaluationsOnly.evaluations === 'object') {
            if (!parsedReport) {
              parsedReport = {
                grade: grade,
                summary: '',
                strengths: [],
                weaknesses: [],
                opinion: '',
                evaluations: evaluationsOnly.evaluations
              };
            } else {
              parsedReport.evaluations = evaluationsOnly.evaluations;
            }
          }
        } else {
          // 개별 필드 추출
          const extractedEvaluations: any = {};
          const careerFitMatch = aiContent.match(/"careerFit"\s*:\s*["']([◎○X-])["']/);
          if (careerFitMatch) extractedEvaluations.careerFit = careerFitMatch[1];
          const requiredQualMatch = aiContent.match(/"requiredQual"\s*:\s*["']([◎X-])["']/);
          if (requiredQualMatch) extractedEvaluations.requiredQual = requiredQualMatch[1];
          const requiredQualReasonMatch = aiContent.match(/"requiredQualReason"\s*:\s*"([\s\S]*?)"\s*[,}]/);
          if (requiredQualReasonMatch) extractedEvaluations.requiredQualReason = requiredQualReasonMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim();
          const preferredQualMatch = aiContent.match(/"preferredQual"\s*:\s*["']([◎○X-])["']/);
          if (preferredQualMatch) extractedEvaluations.preferredQual = preferredQualMatch[1];
          const certificationMatch = aiContent.match(/"certification"\s*:\s*["']([◎○X-])["']/);
          if (certificationMatch) extractedEvaluations.certification = certificationMatch[1];
          
          if (Object.keys(extractedEvaluations).length > 0) {
            if (!parsedReport) {
              parsedReport = {
                grade: grade,
                summary: '',
                strengths: [],
                weaknesses: [],
                opinion: '',
                evaluations: extractedEvaluations
              };
            } else {
              parsedReport.evaluations = extractedEvaluations;
            }
          }
        }
      } catch (evalError: any) {
        console.warn('[AI Check] Failed to extract evaluations:', evalError.message);
      }
      
      reportText = aiContent;
    }

    // parsedReport가 있지만 필수 필드가 비어있는 경우, aiContent에서 추출 시도
    if (parsedReport && typeof parsedReport === 'object') {
      if ((!parsedReport.summary || parsedReport.summary.trim() === '') || 
          (!parsedReport.opinion || parsedReport.opinion.trim() === '')) {
        try {
          if (!parsedReport.summary || parsedReport.summary.trim() === '') {
            const summaryMatch = aiContent.match(/"summary"\s*:\s*"([^"]+)"/) ||
                                aiContent.match(/'summary'\s*:\s*'([^']+)'/);
            if (summaryMatch && summaryMatch[1]) {
              parsedReport.summary = summaryMatch[1];
            }
          }
          
          if (!parsedReport.opinion || parsedReport.opinion.trim() === '') {
            const opinionMatch = aiContent.match(/"opinion"\s*:\s*"([^"]+)"/s) ||
                                aiContent.match(/'opinion'\s*:\s*'([^']+)'/s);
            if (opinionMatch && opinionMatch[1]) {
              parsedReport.opinion = opinionMatch[1];
            }
          }
          
          if (!parsedReport.strengths || parsedReport.strengths.length === 0) {
            const strengthsMatch = aiContent.match(/"strengths"\s*:\s*\[(.*?)\]/s);
            if (strengthsMatch) {
              try {
                const strengthsArray = JSON.parse(`[${strengthsMatch[1]}]`);
                if (Array.isArray(strengthsArray) && strengthsArray.length > 0) {
                  parsedReport.strengths = strengthsArray;
                }
              } catch (e) {}
            }
          }
          
          if (!parsedReport.weaknesses || parsedReport.weaknesses.length === 0) {
            const weaknessesMatch = aiContent.match(/"weaknesses"\s*:\s*\[(.*?)\]/s);
            if (weaknessesMatch) {
              try {
                const weaknessesArray = JSON.parse(`[${weaknessesMatch[1]}]`);
                if (Array.isArray(weaknessesArray) && weaknessesArray.length > 0) {
                  parsedReport.weaknesses = weaknessesArray;
                }
              } catch (e) {}
            }
          }
          
          if ((!parsedReport.summary || parsedReport.summary.trim() === '') && 
              (!parsedReport.opinion || parsedReport.opinion.trim() === '')) {
            if (!parsedReport.opinion || parsedReport.opinion.trim() === '') {
              const jsonEndMatch = aiContent.match(/\}\s*$/);
              if (jsonEndMatch) {
                const afterJson = aiContent.substring(aiContent.lastIndexOf('}') + 1).trim();
                if (afterJson.length > 50) {
                  parsedReport.opinion = afterJson.substring(0, 1000);
                } else {
                  parsedReport.opinion = aiContent.substring(0, 1000);
                }
              } else {
                parsedReport.opinion = aiContent.substring(0, 1000);
              }
            }
            if (!parsedReport.summary || parsedReport.summary.trim() === '') {
              parsedReport.summary = parsedReport.opinion.substring(0, 200).trim();
            }
          }
        } catch (extractError: any) {
          console.warn('[AI Check] Failed to extract missing fields:', extractError.message);
        }
      }
    }

    // 파싱이 실패했거나 필수 필드가 비어있는 경우 재시도
    if (!parseSuccess && retryCount < MAX_RETRIES) {
      console.log(`[AI Check] Parsing failed or incomplete, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      // 재시도 시 더 명확한 프롬프트 사용 (기존 프롬프트 유지 + 강조 사항 추가)
      const retrySystemPrompt = systemPrompt + '\n\n[재시도 강조 사항]\n1. 반드시 완전한 JSON 형식으로 응답해야 합니다. summary와 opinion 필드는 반드시 채워주세요.\n2. summary와 opinion은 등급 근거가 아닌 이력서 전체에 대한 종합 평가여야 합니다.\n3. 자격증 평가: 이력서의 자격사항 섹션에 명시적으로 기재된 자격증만 인정합니다. 자격증이 없거나 명시되지 않았다면 반드시 "X"로 평가하세요.';
      // 재시도 시 userPromptText에도 자격증 평가 강조 추가
      let retryUserPromptText = userPromptText;
      if (userPromptText.includes('자격증 만족여부')) {
        retryUserPromptText += '\n\n[재시도 강조] 자격증 평가 시 주의: 이력서의 자격사항 섹션을 정확히 확인하세요. 자격증이 명시되지 않았다면 절대 추측하지 말고 반드시 "X"로 평가하세요.';
      }
      return callAIAndParse(retrySystemPrompt, retryUserPromptText, fileName, retryCount + 1);
    }

    console.log('[AI Check] Success for:', fileName, 'Grade:', grade);
    console.log('[AI Check] Parsed report evaluations:', parsedReport?.evaluations);

    // gradeEvaluations는 로그 출력을 위해 보존 (ai-check-resume 핸들러에서 로그 출력 후 제거)
    // 인터페이스로 반환할 때는 gradeEvaluations를 제거하지 않고 그대로 반환
    // (ai-check-resume 핸들러에서 로그 출력 후 제거)

    return {
      success: true,
      grade,
      report: parsedReport || reportText,
      reportParsed: parsedReport !== null,
    };
  } catch (error) {
    console.error('[AI Check] Error:', error);
    return {
      success: false,
      grade: 'C',
      report: '',
      reportParsed: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}

/** userPrompt 정규화 및 AI 프롬프트( system / user ) 생성. resumeText 없으면 플레이스홀더 사용. */
function buildAiPrompts(
  userPrompt: {
    jobDescription: string;
    requiredQualifications: string;
    preferredQualifications: string;
    requiredCertifications: string[];
    gradeCriteria: Record<string, string>;
    scoringWeights?: Record<string, number>;
  },
  resumeText: string
): { systemPrompt: string; userPromptText: string } {
  const systemPrompt = `당신은 채용 담당자입니다. 이력서의 경력을 분석하여 업무 내용과의 적합도를 평가하고 등급을 부여해야 합니다.

등급 체계:
- 최상: ${userPrompt.gradeCriteria?.최상 || '하위 등급의 모든 조건을 만족하는 경우'}
- 상: ${userPrompt.gradeCriteria?.상 || '중 등급 조건을 만족하면서 추가 조건을 충족하는 경우'}
- 중: ${userPrompt.gradeCriteria?.중 || '하 등급 조건을 만족하면서 추가 조건을 충족하는 경우'}
- 하: ${userPrompt.gradeCriteria?.하 || '기본 조건을 만족하는 경우'}
- 최하: ${userPrompt.gradeCriteria?.최하 || '기본 조건을 만족하지 못하는 경우'}

응답 형식:
반드시 다음 JSON 형식으로만 응답해야 합니다. 다른 텍스트나 설명은 포함하지 마세요:
{
  "grade": "최상|상|중|하|최하 중 하나",
  "summary": "이력서 전체를 종합적으로 평가한 요약 (등급 근거가 아닌 전체적인 평가 내용)",
  "strengths": ["강점1", "강점2", "강점3", "강점4", "강점5"],
  "weaknesses": ["약점1", "약점2", "약점3", "약점4", "약점5"],
  "opinion": "2-3문단으로 작성한 종합 의견 (등급 근거가 아닌 전체적인 평가 의견)",
  "evaluations": {
    "careerFit": "◎|○|X|- 중 하나 (경력 적합도: ◎=매우 적합, ○=적합, X=부적합, -=경력 없음)",
    "requiredQual": "◎|X 중 하나 (필수 요구사항 만족여부: ◎=만족, X=불만족). **필수 자격증 보유 여부는 포함하지 않음** - 자격증은 certification 필드로 별도 평가. 필수 요구사항(텍스트)이 있는 경우에만 평가",
    "requiredQualReason": "필수 요구사항(자격증 제외) 만족 여부에 대한 판단 근거. 각 필수 요구사항 항목과 이력서 내용을 대조한 구체적 설명. 필수 자격증은 여기 포함하지 않고 certification으로만 평가. 필수 요구사항이 있는 경우에만 포함",
    "preferredQual": "◎|○|X 중 하나 (우대사항 만족여부: ◎=매우 만족, ○=만족, X=불만족) - 우대 사항이 있는 경우에만 평가",
    "certification": "◎|○|X 중 하나 (자격증 만족여부: ◎=매우 만족, ○=만족, X=불만족) - 필수 자격증이 있는 경우에만 평가"
  },
  "gradeEvaluations": {
    "최상": {
      "satisfied": true|false,
      "reason": "해당 등급 조건을 만족하는지 여부에 대한 구체적인 근거 (조건과 이력서 내용을 비교한 상세 설명)"
    },
    "상": {
      "satisfied": true|false,
      "reason": "해당 등급 조건을 만족하는지 여부에 대한 구체적인 근거 (조건과 이력서 내용을 비교한 상세 설명)"
    },
    "중": {
      "satisfied": true|false,
      "reason": "해당 등급 조건을 만족하는지 여부에 대한 구체적인 근거 (조건과 이력서 내용을 비교한 상세 설명)"
    },
    "하": {
      "satisfied": true|false,
      "reason": "해당 등급 조건을 만족하는지 여부에 대한 구체적인 근거 (조건과 이력서 내용을 비교한 상세 설명)"
    },
    "최하": {
      "satisfied": true|false,
      "reason": "해당 등급 조건을 만족하는지 여부에 대한 구체적인 근거 (조건과 이력서 내용을 비교한 상세 설명)"
    }
  }
}

중요 사항:
1. 반드시 유효한 JSON 형식으로만 응답하고, JSON 외의 다른 텍스트는 포함하지 마세요.
2. summary와 opinion은 등급 근거가 아닌 이력서 전체에 대한 종합 평가여야 합니다. 등급 근거는 gradeEvaluations.reason에만 작성하세요.
3. gradeEvaluations 객체에는 각 등급(최상, 상, 중, 하, 최하)의 조건을 만족하는지 여부(satisfied)와 그 근거(reason)를 반드시 포함해야 합니다. reason은 해당 등급의 조건과 이력서 내용을 구체적으로 비교한 설명이어야 합니다.
4. **업무 적합도 판단 시 참조 범위 (필수)**: 경력 적합도(careerFit), 필수 요구사항(requiredQual), 우대사항(preferredQual), 그리고 등급 조건 중 '업무 내용'과의 관련성을 판단할 때는 **오직 "경력"과 "경력기술서"에 적힌 내용만** 근거로 사용하세요. **자기소개서**에는 참조하지 마세요. 자기소개서에 "이 업무에 적합하다"는 식의 어필만 있고 경력·경력기술서에 해당 업무 경험이 없으면 적합하다고 판단하지 마세요. 학력·자격증·기타 항목도 경력 적합도·필수/우대(경력 관련) 판단에는 사용하지 마세요.`;

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

자격증 평가 가이드 (반드시 준수):
1. **가장 중요**: 이력서의 자격사항 섹션에 명시적으로 기재된 자격증만 인정합니다. 이력서에 자격증이 없거나 명시되지 않았다면, 불확실하다고 느껴도 절대 추측하지 말고 반드시 "X"로 평가해야 합니다.
2. 자격사항 섹션이 비어있거나 "없음"이라고 명시되어 있다면 "X"입니다.
3. 국가기술자격은 가장 낮은 순서부터 기능사, 산업기사, 기사, 기술사로 단계가 나뉩니다(물론 꼭 그렇지 않은 자격증도 있습니다).
4. 요구하는 자격증보다 단계가 높은 자격증을 가진 경우에는 해당 자격증도 보유한 것으로 간주합니다. 예를 들어, 전기기사 자격을 보유하고 있다면 전기산업기사도 보유한 것으로 봅니다. 단, 이력서에 명시되어 있어야 합니다. 반대로, 요구하는 자격증이 전기기사인데 이력서에 전기산업기사만 보유하고 있다면 산업기사는 기사보다 낮은 단계의 자격증이므로 전기기사를 보유한 것으로 인정하지 않습니다.
5. 필수 자격증이 여러 개인 경우, 모든 자격증을 보유해야 "◎" 또는 "○"로 평가됩니다. 하나라도 없으면 "X"입니다.
6. 자격증 이름이 정확히 일치하지 않더라도, 동일한 자격증임이 명확하면 인정합니다 (예: "전기산업기사"와 "전기 산업기사").

`;
  }

  userPromptText += `이력서 경력 정보:
${resumeText}

평가 지침:
1. 등급 부여: 위에 제시된 등급 체계를 참고하여, 이력서가 어느 등급에 해당하는지 판단하세요. 높은 등급 기준을 만족하면 해당 등급으로 평가합니다.

2. summary 작성: 등급 근거가 아닌 이력서 전체에 대한 종합적인 평가 요약을 작성하세요. 예: "이력서는 [전체적인 특징]을 보이며, [주요 강점/약점]이 있습니다."

3. opinion 작성: 등급 근거가 아닌 이력서 전체에 대한 평가 의견을 작성하세요. 등급 근거는 gradeEvaluations.reason에만 작성하세요.

4. gradeEvaluations 작성: 각 등급(최상, 상, 중, 하, 최하)의 조건을 이력서 내용과 비교하여:
   - satisfied: 해당 등급 조건을 만족하는지 true/false
   - reason: 조건과 이력서 내용을 구체적으로 비교한 상세 근거 (예: "최상 등급 조건은 '시설관리 경력 3년 이상, 전기산업기사+소방안전관리자1급 보유'인데, 이력서에는 시설관리 경력이 5년이고 두 자격증 모두 보유하고 있어 조건을 만족합니다.")
   - **등급 조건 중 업무·경력 관련(예: N년 경력, OO 업무 경험)은 "경력"과 "경력기술서"에만 근거를 두고 판단하세요. 자기소개서는 참조하지 마세요.**
   
   각 등급의 조건:
   - 최상: ${userPrompt.gradeCriteria?.최상 || '조건 없음'}
   - 상: ${userPrompt.gradeCriteria?.상 || '조건 없음'}
   - 중: ${userPrompt.gradeCriteria?.중 || '조건 없음'}
   - 하: ${userPrompt.gradeCriteria?.하 || '조건 없음'}
   - 최하: ${userPrompt.gradeCriteria?.최하 || '조건 없음'}

5. 추가 평가 항목 (업무·경력 관련 판단은 경력+경력기술서만 참조, 자기소개서 무시):
${userPrompt.requiredQualifications && userPrompt.requiredQualifications.trim() ? '- 필수 요구사항 만족여부(requiredQual): **자격증 제외** - 위 "필수 요구사항" 텍스트에 적힌 항목(경력·학력·기타 조건 등)만 평가하세요. **경력·업무 관련 조건은 "경력"과 "경력기술서"에만 근거를 두고 판단하세요. 자기소개서는 참조하지 마세요.** 필수 자격증 보유 여부는 requiredQual에 반영하지 말고, certification 필드로만 평가하세요. 필수 요구사항을 모두 만족하면 ◎, 하나라도 불만족하면 X. 이력서에 명시되지 않은 항목은 불만족으로 평가.\n- 필수 요구사항 판단 근거(requiredQualReason): requiredQual이 ◎ 또는 X인 이유를 **필수 요구사항(자격증 제외)** 항목만 기준으로 작성하세요. 위 "필수 요구사항"에 나열된 항목별로 **경력·경력기술서** 대조 내용을 적어주세요. 자격증 관련 내용은 requiredQualReason에 넣지 마세요. 예: "① N년 이상 경력: 경력란에 A사 N년 근무 명시되어 만족. ② OO 관련 경험: 경력기술서에 △△ 프로젝트 기재되어 만족. ③ △△ 불만족: 경력·경력기술서에 해당 경험 없음."' : ''}
${userPrompt.preferredQualifications && userPrompt.preferredQualifications.trim() ? '- 우대사항 만족여부: 우대 사항을 얼마나 만족하는지 평가 (◎=매우 만족, ○=만족, X=불만족). **경력·업무 관련은 경력과 경력기술서만 참조하고 자기소개서는 무시하세요.**' : ''}
${userPrompt.requiredCertifications && userPrompt.requiredCertifications.length > 0 ? '- 자격증 만족여부: **중요** - 이력서의 자격사항 섹션을 정확히 확인하세요. 필수 자격증이 명시적으로 기재되어 있는지 확인하고, 자격증이 없거나 명시되지 않았다면 절대 추측하지 말고 반드시 "X"로 평가하세요. 이력서에 자격증이 없다고 명시되어 있거나 자격사항 섹션이 비어있다면 "X"입니다. 위의 자격증 평가 가이드를 참고하여, 요구하는 자격증보다 단계가 높은 자격증을 보유한 경우에도 만족한 것으로 평가하세요.' : ''}
- 경력 적합도(careerFit): **"경력"과 "경력기술서"에 적힌 실제 경험만** 보고 업무 내용과의 적합도를 평가하세요 (◎=매우 적합, ○=적합, X=부적합, -=경력 없음). **자기소개서의 적합성 어필은 절대 반영하지 마세요.** 경력·경력기술서에 해당 업무 경험이 없으면 ◎/○로 평가하지 마세요.

중요: evaluations 객체에는 위에서 언급된 항목들만 포함하세요. 예를 들어 필수 요구사항이 없으면 requiredQual 필드를 포함하지 마세요.`;

  return { systemPrompt, userPromptText };
}

/** 배치용: 여러 이력서를 하나의 userPrompt로 묶고, 응답은 JSON 배열로 요청. */
function buildAiPromptsForBatch(
  userPrompt: {
    jobDescription: string;
    requiredQualifications: string;
    preferredQualifications: string;
    requiredCertifications: string[];
    gradeCriteria: Record<string, string>;
    scoringWeights?: Record<string, number>;
  },
  items: Array<{ resumeText: string; fileName: string }>
): { systemPrompt: string; userPromptText: string } {
  const singleSystemSuffix = `응답 형식:
반드시 다음 JSON 형식으로만 응답해야 합니다. 다른 텍스트나 설명은 포함하지 마세요:
{
  "grade": "최상|상|중|하|최하 중 하나",
  "summary": "이력서 전체를 종합적으로 평가한 요약 (등급 근거가 아닌 전체적인 평가 내용)",
  "strengths": ["강점1", "강점2", "강점3", "강점4", "강점5"],
  "weaknesses": ["약점1", "약점2", "약점3", "약점4", "약점5"],
  "opinion": "2-3문단으로 작성한 종합 의견 (등급 근거가 아닌 전체적인 평가 의견)",
  "evaluations": {
    "careerFit": "◎|○|X|- 중 하나 (경력 적합도: ◎=매우 적합, ○=적합, X=부적합, -=경력 없음)",
    "requiredQual": "◎|X 중 하나 (필수 요구사항 만족여부: ◎=만족, X=불만족). **필수 자격증 보유 여부는 포함하지 않음** - 자격증은 certification 필드로 별도 평가. 필수 요구사항(텍스트)이 있는 경우에만 평가",
    "requiredQualReason": "필수 요구사항(자격증 제외) 만족 여부에 대한 판단 근거. 각 필수 요구사항 항목과 이력서 내용을 대조한 구체적 설명. 필수 자격증은 여기 포함하지 않고 certification으로만 평가. 필수 요구사항이 있는 경우에만 포함",
    "preferredQual": "◎|○|X 중 하나 (우대사항 만족여부: ◎=매우 만족, ○=만족, X=불만족) - 우대 사항이 있는 경우에만 평가",
    "certification": "◎|○|X 중 하나 (자격증 만족여부: ◎=매우 만족, ○=만족, X=불만족) - 필수 자격증이 있는 경우에만 평가"
  },
  "gradeEvaluations": {
    "최상": { "satisfied": true|false, "reason": "구체적인 근거" },
    "상": { "satisfied": true|false, "reason": "구체적인 근거" },
    "중": { "satisfied": true|false, "reason": "구체적인 근거" },
    "하": { "satisfied": true|false, "reason": "구체적인 근거" },
    "최하": { "satisfied": true|false, "reason": "구체적인 근거" }
  }
}`;

  const systemPrompt = `당신은 채용 담당자입니다. **여러 건의 이력서**가 제시됩니다. 각 이력서를 **순서대로** 평가하고, 응답은 반드시 **동일한 순서의 JSON 배열**로만 주세요. 배열의 각 요소는 아래와 같은 단일 이력서 평가 객체입니다.

등급 체계:
- 최상: ${userPrompt.gradeCriteria?.최상 || '하위 등급의 모든 조건을 만족하는 경우'}
- 상: ${userPrompt.gradeCriteria?.상 || '중 등급 조건을 만족하면서 추가 조건을 충족하는 경우'}
- 중: ${userPrompt.gradeCriteria?.중 || '하 등급 조건을 만족하면서 추가 조건을 충족하는 경우'}
- 하: ${userPrompt.gradeCriteria?.하 || '기본 조건을 만족하는 경우'}
- 최하: ${userPrompt.gradeCriteria?.최하 || '기본 조건을 만족하지 못하는 경우'}

응답 형식:
반드시 **JSON 배열**로만 응답하세요. 배열 길이는 제시된 이력서 개수(${items.length}개)와 같아야 합니다. 각 요소는 다음 구조의 객체입니다:
${singleSystemSuffix}

중요 사항:
1. 반드시 유효한 JSON 배열 형식으로만 응답하고, JSON 외의 다른 텍스트는 포함하지 마세요.
2. 배열의 순서는 이력서 제시 순서(이력서 1, 이력서 2, ...)와 반드시 동일해야 합니다.
3. **반드시 ${items.length}개 이력서 모두에 대한 평가를 배열에 포함하세요. 중간에 끊지 말고 모든 이력서(이력서 1~${items.length})에 대해 한 개씩 객체를 출력하세요.**
4. summary와 opinion은 등급 근거가 아닌 이력서 전체에 대한 종합 평가여야 합니다. 등급 근거는 gradeEvaluations.reason에만 작성하세요.
5. **업무 적합도 판단 시 참조 범위 (필수)**: 경력 적합도(careerFit), 필수 요구사항(requiredQual), 우대사항(preferredQual), 등급 조건 중 '업무 내용'과의 관련성을 판단할 때는 **오직 "경력"과 "경력기술서"에 적힌 내용만** 근거로 사용하세요. **자기소개서는 참조하지 마세요.** 자기소개서에 "이 업무에 적합하다"는 식의 어필만 있고 경력·경력기술서에 해당 업무 경험이 없으면 적합하다고 판단하지 마세요.`;

  // user 쪽: 공통 업무/요구사항/자격증 가이드 + 각 이력서 블록
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

자격증 평가 가이드 (반드시 준수):
1. **가장 중요**: 이력서의 자격사항 섹션에 명시적으로 기재된 자격증만 인정합니다. 이력서에 자격증이 없거나 명시되지 않았다면, 불확실하다고 느껴도 절대 추측하지 말고 반드시 "X"로 평가해야 합니다.
2. 자격사항 섹션이 비어있거나 "없음"이라고 명시되어 있다면 "X"입니다.
3. 국가기술자격은 가장 낮은 순서부터 기능사, 산업기사, 기사, 기술사로 단계가 나뉩니다(물론 꼭 그렇지 않은 자격증도 있습니다).
4. 요구하는 자격증보다 단계가 높은 자격증을 가진 경우에는 해당 자격증도 보유한 것으로 간주합니다. 예를 들어, 전기기사 자격을 보유하고 있다면 전기산업기사도 보유한 것으로 봅니다. 단, 이력서에 명시되어 있어야 합니다. 반대로, 요구하는 자격증이 전기기사인데 이력서에 전기산업기사만 보유하고 있다면 산업기사는 기사보다 낮은 단계의 자격증이므로 전기기사를 보유한 것으로 인정하지 않습니다.
5. 필수 자격증이 여러 개인 경우, 모든 자격증을 보유해야 "◎" 또는 "○"로 평가됩니다. 하나라도 없으면 "X"입니다.
6. 자격증 이름이 정확히 일치하지 않더라도, 동일한 자격증임이 명확하면 인정합니다 (예: "전기산업기사"와 "전기 산업기사").

`;
  }

  userPromptText += `평가 지침:
1. 등급 부여: 위에 제시된 등급 체계를 참고하여, 각 이력서가 어느 등급에 해당하는지 판단하세요.
2. summary/opinion: 등급 근거가 아닌 이력서 전체에 대한 종합 평가 요약·의견을 작성하세요. 등급 근거는 gradeEvaluations.reason에만 작성하세요.
3. gradeEvaluations: 각 등급(최상, 상, 중, 하, 최하)의 조건을 이력서 내용과 비교하여 satisfied와 reason을 작성하세요. **등급 조건 중 업무·경력 관련은 "경력"과 "경력기술서"만 참조하고 자기소개서는 무시하세요.**
4. **경력 적합도·필수/우대(경력 관련)·등급(업무 관련) 판단 시**: **오직 "경력"과 "경력기술서"에 적힌 내용만** 근거로 사용하세요. **자기소개서는 절대 참조하지 마세요.** 자기소개서에 적합성 어필만 있고 경력·경력기술서에 해당 업무 경험이 없으면 적합하다고 판단하지 마세요.
5. 각 이력서 평가 결과를 **제시된 순서와 동일한 순서**로 JSON 배열에 넣어 주세요.

각 등급의 조건:
- 최상: ${userPrompt.gradeCriteria?.최상 || '조건 없음'}
- 상: ${userPrompt.gradeCriteria?.상 || '조건 없음'}
- 중: ${userPrompt.gradeCriteria?.중 || '조건 없음'}
- 하: ${userPrompt.gradeCriteria?.하 || '조건 없음'}
- 최하: ${userPrompt.gradeCriteria?.최하 || '조건 없음'}

아래 이력서들을 **순서대로** 평가한 뒤, 위 형식의 **JSON 배열**로만 응답하세요.

`;

  items.forEach((item, index) => {
    userPromptText += `## 이력서 ${index + 1} (파일명: ${item.fileName})\n${item.resumeText}\n\n`;
  });

  return { systemPrompt, userPromptText };
}

/** 단일 파싱된 보고서 객체를 등급 매핑·유효성 검사 후 반환 (단일/배치 공용) */
function normalizeParsedReport(
  parsed: any,
  _fileName: string
): { grade: string; report: any; reportParsed: boolean } {
  const gradeMap: { [key: string]: string } = {
    '최상': 'A', '상': 'B', '중': 'C', '하': 'D', '최하': 'E'
  };
  let grade = 'C';
  if (parsed && typeof parsed === 'object' && 'grade' in parsed) {
    grade = gradeMap[parsed.grade] || 'C';
  }
  const hasRequired = parsed?.summary?.trim() && parsed?.opinion?.trim();
  const report = parsed && typeof parsed === 'object' ? parsed : {};
  return {
    grade,
    report,
    reportParsed: !!(hasRequired && report.grade),
  };
}

/** 응답 텍스트에서 첫 번째 완전한 JSON 배열 [...] 구간만 추출 (배열 뒤에 설명이 붙는 경우 대비) */
function extractFirstJsonArray(text: string): string | null {
  const start = text.indexOf('[');
  if (start === -1) return null;
  let depth = 0;
  let inDouble = false;
  let inSingle = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inDouble) {
      if (c === '\\') escape = true;
      else if (c === '"') inDouble = false;
      continue;
    }
    if (inSingle) {
      if (c === '\\') escape = true;
      else if (c === "'") inSingle = false;
      continue;
    }
    if (c === '"') { inDouble = true; continue; }
    if (c === "'") { inSingle = true; continue; }
    if (c === '[') { depth++; continue; }
    if (c === ']') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** 배치 AI 호출: 한 번의 API 요청으로 여러 이력서 평가, 응답 JSON 배열 파싱 후 각 항목을 순서대로 반환. debugDir 있으면 원문·파싱 결과 저장 */
async function callAIAndParseBatch(
  systemPrompt: string,
  userPromptText: string,
  fileNames: string[],
  retryCount: number = 0,
  debugDir: string | null = null
): Promise<Array<{ success: boolean; grade: string; report: any; reportParsed: boolean; fileName: string; error?: string }>> {
  loadEnvFile();
  const MAX_RETRIES = 1;
  const API_KEY = process.env.AZURE_OPENAI_API_KEY || '';
  const API_ENDPOINT = (process.env.AZURE_OPENAI_ENDPOINT || 'https://roar-mjm4cwji-swedencentral.openai.azure.com/').replace(/\/+$/, '');
  const DEPLOYMENT = (process.env.AZURE_OPENAI_DEPLOYMENT || '').replace(/^\uFEFF/, '').trim() || 'gpt-4o';
  const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
  const apiUrl = `${API_ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`;
  if (retryCount === 0) {
    console.log('[AI Check Batch] Using deployment:', DEPLOYMENT, '(from AZURE_OPENAI_DEPLOYMENT)');
  }

  const emptyResult = (fileName: string, error: string) => ({
    success: false,
    grade: 'C',
    report: '',
    reportParsed: false,
    fileName,
    error,
  });

  try {
    console.log(`[AI Check Batch] Calling Azure OpenAI API for ${fileNames.length} files${retryCount > 0 ? ` (재시도 ${retryCount})` : ''}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': API_KEY,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPromptText },
        ],
        max_tokens: 16384,
        temperature: 0.7,
        top_p: 1.0,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[AI Check Batch] API Error:', response.status, errorData);
      if (response.status === 429) {
        let retryAfter = 10;
        try {
          const errorJson = JSON.parse(errorData);
          if (errorJson.error?.message) {
            const retryMatch = errorJson.error.message.match(/after (\d+) seconds?/i);
            if (retryMatch) retryAfter = parseInt(retryMatch[1], 10) + 2;
          }
        } catch (_e) {}
        writeLog(`[AI Check Batch] Rate limit, retrying after ${retryAfter}s...`, 'warn');
        throw new Error(`RATE_LIMIT:${retryAfter}`);
      }
      throw new Error(`AI API 호출 실패: ${response.status}`);
    }

    const responseData = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const aiContent = responseData.choices?.[0]?.message?.content || '';

    // 디버그: AI 원문 응답 저장 및 로그
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);
    if (debugDir) {
      try {
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        const rawPath = path.join(debugDir, `ai-response-${ts}.txt`);
        fs.writeFileSync(rawPath, aiContent, 'utf-8');
        console.log('[AI Check Batch] Raw response saved:', rawPath, `(${aiContent.length} chars)`);
        writeLog(`[AI Check Batch] Raw response saved: ${rawPath}`, 'info');
      } catch (e: any) {
        console.warn('[AI Check Batch] Failed to save raw response:', e?.message);
      }
    }
    if (aiContent.length > 0) {
      const preview = aiContent.length <= 600 ? aiContent : aiContent.slice(0, 300) + '\n... (truncated) ...\n' + aiContent.slice(-300);
      console.log('[AI Check Batch] AI response preview:\n', preview);
    }

    let jsonText = aiContent.trim();
    if (jsonText.startsWith('```')) {
      const lines = jsonText.split('\n');
      const startIndex = lines[0].includes('json') ? 1 : 0;
      const endIndex = lines[lines.length - 1].trim() === '```' ? lines.length - 1 : lines.length;
      jsonText = lines.slice(startIndex, endIndex).join('\n').trim();
    }

    // AI가 JSON 배열 뒤에 설명을 붙이는 경우 대비: 첫 번째 완전한 [...] 구간만 추출
    const extracted = extractFirstJsonArray(jsonText);
    if (extracted !== null) {
      jsonText = extracted;
    }

    let arr: any[];
    try {
      arr = JSON.parse(jsonText);
    } catch (parseErr) {
      console.warn('[AI Check Batch] Response is not valid JSON array:', (parseErr as Error).message);
      if (debugDir) {
        try {
          const failPath = path.join(debugDir, `ai-response-${ts}-PARSE_FAILED.txt`);
          fs.writeFileSync(failPath, aiContent, 'utf-8');
          console.log('[AI Check Batch] Raw response (parse failed) saved:', failPath);
        } catch (_e) {}
      }
      return fileNames.map(fn => emptyResult(fn, '배치 응답 JSON 배열 파싱 실패'));
    }

    if (!Array.isArray(arr)) {
      return fileNames.map(fn => emptyResult(fn, '배치 응답이 배열이 아님'));
    }

    // 디버그: 파싱된 배열 저장
    if (debugDir) {
      try {
        const parsedPath = path.join(debugDir, `ai-parsed-${ts}.json`);
        fs.writeFileSync(parsedPath, JSON.stringify(arr, null, 2), 'utf-8');
        console.log('[AI Check Batch] Parsed array saved:', parsedPath, `(${arr.length} items)`);
        writeLog(`[AI Check Batch] Parsed array saved: ${parsedPath}`, 'info');
      } catch (e: any) {
        console.warn('[AI Check Batch] Failed to save parsed JSON:', e?.message);
      }
    }

    const results: Array<{ success: boolean; grade: string; report: any; reportParsed: boolean; fileName: string; error?: string }> = [];
    for (let i = 0; i < fileNames.length; i++) {
      const fileName = fileNames[i];
      const raw = arr[i];
      if (raw == null) {
        results.push(emptyResult(fileName, '배치 응답에 해당 순서의 항목 없음'));
        continue;
      }
      const { grade, report, reportParsed } = normalizeParsedReport(raw, fileName);
      results.push({
        success: true,
        grade,
        report,
        reportParsed,
        fileName,
      });
    }
    console.log('[AI Check Batch] Success for', fileNames.length, 'files');
    return results;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('[AI Check Batch] Error:', errMsg);
    return fileNames.map(fn => emptyResult(fn, errMsg));
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
    const DEPLOYMENT_NAME = (process.env.AZURE_OPENAI_DEPLOYMENT || '').replace(/^\uFEFF/, '').trim() || 'gpt-4o';
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
    
    const { systemPrompt, userPromptText } = buildAiPrompts(userPrompt, resumeText);

    // AI API 호출 및 파싱 (재시도 로직 포함)
    const result = await callAIAndParse(systemPrompt, userPromptText, data.fileName, 0);
    
    if (!result.success) {
      throw new Error(result.error || 'AI 분석 실패');
    }
    
    // 등급별 조건 만족 여부 로그 출력
    if (result.report && typeof result.report === 'object' && 'gradeEvaluations' in result.report) {
      const gradeEvaluations = result.report.gradeEvaluations;
      const gradeNames = ['최상', '상', '중', '하', '최하'];
      const gradeLabels = ['A (최상)', 'B (상)', 'C (중)', 'D (하)', 'E (최하)'];
      
      writeLog(`[AI Check] 등급별 조건 평가 결과 (${data.fileName}):`, 'info');
      
      gradeNames.forEach((gradeName, index) => {
        const evaluation = gradeEvaluations?.[gradeName as keyof typeof gradeEvaluations];
        const criteria = userPrompt.gradeCriteria?.[gradeName as keyof typeof userPrompt.gradeCriteria] || '조건 없음';
        
        if (evaluation) {
          const satisfied = evaluation.satisfied ? '✓ 만족' : '✗ 불만족';
          const reason = evaluation.reason || '근거 없음';
          
          writeLog(`[AI Check] ${gradeLabels[index]} 등급 조건: ${criteria}`, 'info');
          writeLog(`[AI Check] ${gradeLabels[index]} 만족 여부: ${satisfied}`, 'info');
          writeLog(`[AI Check] ${gradeLabels[index]} 근거: ${reason}`, 'info');
        } else {
          writeLog(`[AI Check] ${gradeLabels[index]} 등급 조건: ${criteria}`, 'info');
          writeLog(`[AI Check] ${gradeLabels[index]} 만족 여부: 평가 정보 없음`, 'warn');
        }
      });
    } else {
      writeLog(`[AI Check] 등급별 조건 평가 정보가 없습니다 (${data.fileName})`, 'warn');
    }
    
    // gradeEvaluations는 AI Comment(등급별 판정·근거) 표시를 위해 report에 포함하여 반환
    return {
      ...result,
      report: result.report,
    };
  } catch (error) {
    console.error('[AI Check] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
});

/** 배치 AI 분석: 여러 이력서를 한 번에 API 호출하여 분석 (예: 10건씩). debugFolder 있으면 해당/debug에 AI 원문·파싱 결과 저장 */
ipcMain.handle('ai-check-resume-batch', async (event, data: {
  userPrompt: {
    jobDescription: string;
    requiredQualifications: string;
    preferredQualifications: string;
    requiredCertifications: string[];
    gradeCriteria: { 최상: string; 상: string; 중: string; 하: string; 최하: string };
    scoringWeights?: Record<string, number>;
  };
  items: Array<{ applicationData: any; fileName: string }>;
  debugFolder?: string;
}) => {
  try {
    loadEnvFile();
    const API_KEY = process.env.AZURE_OPENAI_API_KEY;
    if (!API_KEY) {
      throw new Error('Azure OpenAI API 키가 설정되지 않았습니다. .env 파일에 AZURE_OPENAI_API_KEY를 설정하세요.');
    }
    if (!data.userPrompt?.jobDescription?.trim()) {
      throw new Error('jobDescription이 비어있습니다.');
    }
    const userPrompt = {
      jobDescription: (data.userPrompt.jobDescription && typeof data.userPrompt.jobDescription === 'string') ? data.userPrompt.jobDescription : '',
      requiredQualifications: (data.userPrompt.requiredQualifications && typeof data.userPrompt.requiredQualifications === 'string') ? data.userPrompt.requiredQualifications : '',
      preferredQualifications: (data.userPrompt.preferredQualifications && typeof data.userPrompt.preferredQualifications === 'string') ? data.userPrompt.preferredQualifications : '',
      requiredCertifications: Array.isArray(data.userPrompt.requiredCertifications) ? data.userPrompt.requiredCertifications : [],
      gradeCriteria: data.userPrompt.gradeCriteria || {},
      scoringWeights: data.userPrompt.scoringWeights || {},
    };
    const batchItems = data.items.map(({ applicationData, fileName }) => ({
      resumeText: formatResumeDataForAI(applicationData),
      fileName,
    }));
    const { systemPrompt, userPromptText } = buildAiPromptsForBatch(userPrompt, batchItems);
    const fileNames = batchItems.map(i => i.fileName);
    const debugDir = data.debugFolder ? path.join(data.debugFolder, 'debug') : null;
    const results = await callAIAndParseBatch(systemPrompt, userPromptText, fileNames, 0, debugDir);
    return results;
  } catch (error) {
    console.error('[AI Check Batch] IPC Error:', error);
    const errMsg = error instanceof Error ? error.message : '알 수 없는 오류';
    return (data.items || []).map(({ fileName }) => ({
      success: false,
      grade: 'C',
      report: '',
      reportParsed: false,
      fileName,
      error: errMsg,
    }));
  }
});

/** AI 프롬프트 미리보기: systemPrompt / userPromptText 전문 반환. applicationData 없으면 이력서 영역은 플레이스홀더. */
ipcMain.handle('get-ai-prompts-preview', async (event, data: { userPrompt: any; applicationData?: any }) => {
  try {
    if (!data.userPrompt) {
      return { success: false, error: 'userPrompt가 제공되지 않았습니다.' };
    }
    const userPrompt = {
      jobDescription: (data.userPrompt.jobDescription && typeof data.userPrompt.jobDescription === 'string') ? data.userPrompt.jobDescription : '',
      requiredQualifications: (data.userPrompt.requiredQualifications && typeof data.userPrompt.requiredQualifications === 'string') ? data.userPrompt.requiredQualifications : '',
      preferredQualifications: (data.userPrompt.preferredQualifications && typeof data.userPrompt.preferredQualifications === 'string') ? data.userPrompt.preferredQualifications : '',
      requiredCertifications: Array.isArray(data.userPrompt.requiredCertifications) ? data.userPrompt.requiredCertifications : [],
      gradeCriteria: data.userPrompt.gradeCriteria || {},
      scoringWeights: data.userPrompt.scoringWeights || {},
    };
    if (!userPrompt.jobDescription || !userPrompt.jobDescription.trim()) {
      return { success: false, error: 'jobDescription이 비어있습니다.' };
    }
    const resumeText = data.applicationData
      ? formatResumeDataForAI(data.applicationData)
      : '(이력서 텍스트는 분석 시 해당 이력서 데이터로 채워집니다.)';
    const { systemPrompt, userPromptText } = buildAiPrompts(userPrompt, resumeText);
    return { success: true, systemPrompt, userPromptText };
  } catch (error) {
    console.error('[get-ai-prompts-preview] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
});

/** 업무 내용을 바탕으로 경력 적합도 등급 기준(최상~최하) 생성. 각 등급당 공백 포함 약 200자 이내, 이력서만으로 판단 가능한 기준으로 생성 */
ipcMain.handle('generate-grade-criteria', async (event, jobDescription: string) => {
  try {
    loadEnvFile();
    const API_KEY = process.env.AZURE_OPENAI_API_KEY;
    if (!API_KEY) {
      throw new Error('Azure OpenAI API 키가 설정되지 않았습니다. .env 파일에 AZURE_OPENAI_API_KEY를 설정하세요.');
    }
    const desc = (jobDescription && String(jobDescription).trim()) || '';
    if (!desc) {
      throw new Error('업무 내용이 비어있습니다. 업무 내용을 먼저 입력하세요.');
    }
    const ENDPOINT = (process.env.AZURE_OPENAI_ENDPOINT || 'https://roar-mjm4cwji-swedencentral.openai.azure.com/').replace(/\/+$/, '');
    const DEPLOYMENT = (process.env.AZURE_OPENAI_DEPLOYMENT || '').replace(/^\uFEFF/, '').trim() || 'gpt-4o';
    const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
    const apiUrl = `${ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`;

    const systemPrompt = `당신은 채용 담당자입니다. 주어진 "업무 내용"을 바탕으로, 이력서의 경력 적합도를 평가할 때 쓰일 **등급 기준**(최상, 상, 중, 하, 최하)을 생성해 주세요.

규칙:
1. **출력 형식**: 반드시 다음 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.
{"최상":"...","상":"...","중":"...","하":"...","최하":"..."}
2. **각 등급 값**: 공백 포함 200자 내외의 하나의 연속된 문자열로 작성하세요. 줄바꿈 없이 한 문장/문단으로.
3. **경력 햇수로 나누지 마세요**: 신입/경력 구분 없이 후보자들이 업무 경력이 길지 않을 수 있다는 전제로 작성하세요. "경력 10년 이상이면 최상", "경력 5년 이상이면 상"처럼 **관련 업무 경력 연차로 등급을 나누지 마세요**.
4. **이력서만으로 판단 가능하게**: 실제 업무 수행 능력은 알 수 없으므로, **이력서에 기재된 정보**(경력·경력기술서·학력·자격증·지원분야 등)만으로 판단할 수 있는 기준을 세우세요. 예: "이력서의 경력·경력기술서에 업무 내용과 직접 관련된 직무·프로젝트가 구체적으로 기재된 경우", "지원분야·희망직무가 업무 내용과 일치하고 경력 중 관련 키워드가 있는 경우" 등.`;

    const userPrompt = `다음 "업무 내용"을 바탕으로 경력 적합도 등급 기준(최상, 상, 중, 하, 최하)을 생성해 주세요. 위 규칙을 준수하고, JSON만 출력하세요.

업무 내용:
${desc}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': API_KEY },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[generate-grade-criteria] API Error:', response.status, errText);
      throw new Error(`API 호출 실패: ${response.status}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    let content = (data.choices?.[0]?.message?.content || '').trim();
    let jsonText = content;
    if (content.startsWith('```')) {
      const lines = content.split('\n');
      const start = lines[0].includes('json') ? 1 : 0;
      const end = lines[lines.length - 1].trim() === '```' ? lines.length - 1 : lines.length;
      jsonText = lines.slice(start, end).join('\n').trim();
    }
    const parsed = JSON.parse(jsonText) as Record<string, string>;
    const gradeCriteria = {
      최상: (parsed.최상 && String(parsed.최상).trim()) || '',
      상: (parsed.상 && String(parsed.상).trim()) || '',
      중: (parsed.중 && String(parsed.중).trim()) || '',
      하: (parsed.하 && String(parsed.하).trim()) || '',
      최하: (parsed.최하 && String(parsed.최하).trim()) || '',
    };
    return { success: true, gradeCriteria };
  } catch (error) {
    console.error('[generate-grade-criteria] Error:', error);
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
  if (applicationData.birthDate) {
    text += `생년월일: ${applicationData.birthDate}\n`;
    // 만 나이 계산 및 추가
    const age = calculateAge(applicationData.birthDate);
    if (age !== undefined) {
      text += `만 나이: ${age}세\n`;
    }
  }
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

  // 경력 + 경력기술서 (각 경력 아래에 해당 경력기술서 붙임: [경력1]\n[경력기술서1]\n[경력2]\n[경력기술서2]...)
  const careerBlocks: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const company = applicationData[`careerCompanyName${i}`];
    const startDate = applicationData[`careerStartDate${i}`];
    const endDate = applicationData[`careerEndDate${i}`];
    const jobType = applicationData[`careerJobType${i}`];
    const careerLine = company ? `${company} | ${startDate || ''} ~ ${endDate || '현재'} | ${jobType || ''}` : '';
    const detail = applicationData[`careerDetailDescription${i}`];
    const detailTrim = detail && typeof detail === 'string' ? detail.trim() : '';
    if (careerLine || detailTrim) {
      let block = `[경력 ${i}]\n${careerLine || '(경력 정보 없음)'}`;
      if (detailTrim) block += `\n[경력기술서 ${i}]\n${detailTrim}`;
      careerBlocks.push(block);
    }
  }
  if (careerBlocks.length > 0) {
    text += `경력:\n${careerBlocks.join('\n\n')}\n\n`;
  }

  // PDF 전용: 경력세부내용 (경력기술서 섹션 통째로)
  const careerDetailContent = applicationData.careerDetailContent;
  if (careerDetailContent && typeof careerDetailContent === 'string' && careerDetailContent.trim()) {
    text += `경력세부내용:\n${careerDetailContent.trim()}\n\n`;
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

  // 자기소개서
  const selfIntroductions: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const selfIntro = applicationData[`selfIntroduction${i}`];
    if (selfIntro && selfIntro.trim()) {
      selfIntroductions.push(`[자기소개서 ${i}]\n${selfIntro.trim()}`);
    }
  }
  if (selfIntroductions.length > 0) {
    text += `자기소개서:\n${selfIntroductions.join('\n\n')}\n\n`;
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
