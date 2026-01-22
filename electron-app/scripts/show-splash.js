/**
 * 스플래시 스크린을 별도 프로세스로 표시
 * npm run dev 시작 시 즉시 스플래시를 보여주기 위함
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let splashWindow = null;

// 앱이 준비되면 스플래시 표시
app.whenReady().then(() => {
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
  <div class="version">Version 1.0.78</div>
</body>
</html>
  `;
  
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
  splashWindow.show();
  splashWindow.center();
  
  // 메인 프로세스가 준비되면 이 스플래시는 닫힘
  // (메인 프로세스의 스플래시가 표시될 때)
});

// 메인 프로세스가 시작되면 이 스플래시를 닫기 위해
// 파일 기반 신호를 확인
const signalFile = path.join(os.tmpdir(), 'career-fit-scoring-main-ready');

// 신호 파일이 이미 있으면 삭제 (이전 실행의 잔여물)
if (fs.existsSync(signalFile)) {
  try {
    fs.unlinkSync(signalFile);
  } catch (e) {
    // 무시
  }
}

console.log('[Splash] Waiting for main process signal at:', signalFile);

// 메인 프로세스 준비 신호 확인 (500ms마다 체크)
let signalDetected = false;
let checkCount = 0;
const checkInterval = setInterval(() => {
  if (signalDetected) {
    return; // 이미 처리됨
  }
  
  checkCount++;
  if (checkCount % 10 === 0) {
    // 5초마다 한 번씩 로그 출력 (디버깅용)
    console.log(`[Splash] Still waiting for signal... (checked ${checkCount} times, file exists: ${fs.existsSync(signalFile)})`);
  }
  
  if (fs.existsSync(signalFile)) {
    signalDetected = true;
    console.log('[Splash] Main process ready signal detected, closing splash...');
    
    // 메인 프로세스가 준비되었음을 알림
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    
    clearInterval(checkInterval);
    
    // 신호 파일 삭제
    try {
      fs.unlinkSync(signalFile);
    } catch (e) {
      // 무시
    }
    
    // 스플래시 프로세스 종료 (별도 프로세스이므로 메인 앱에 영향 없음)
    setTimeout(() => {
      console.log('[Splash] Exiting splash process...');
      app.quit();
    }, 500);
  }
}, 500);

// 최대 60초 후 자동 종료 (안전장치)
// 단, 이 경우에도 메인 앱은 계속 실행되어야 하므로
// 스플래시만 닫고 프로세스는 유지 (메인 앱이 나중에 닫을 수 있도록)
let timeoutReached = false;
setTimeout(() => {
  if (!timeoutReached) {
    timeoutReached = true;
    console.log('[Splash] Timeout reached, closing splash window only (keeping process alive)...');
    clearInterval(checkInterval);
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    // 프로세스는 종료하지 않음 (메인 앱이 실행 중일 수 있음)
    // 대신 창만 닫고 프로세스는 유지
  }
}, 60000);

app.on('window-all-closed', () => {
  // 모든 창이 닫혀도 앱은 유지 (메인 프로세스가 시작될 때까지)
});
