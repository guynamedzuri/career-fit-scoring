/**
 * 스플래시 스크린을 별도 프로세스로 표시
 * npm run dev 시작 시 즉시 스플래시를 보여주기 위함
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

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

// 메인 프로세스와 통신하기 위한 HTTP 클라이언트
const portFile = path.join(os.tmpdir(), 'career-fit-scoring-splash-port');
console.log('[Splash] Waiting for main process server...');

// 메인 프로세스 준비 신호 확인 (500ms마다 체크)
let signalDetected = false;
let checkCount = 0;
const checkInterval = setInterval(() => {
  if (signalDetected) {
    return; // 이미 처리됨
  }
  
  checkCount++;
  
  // 포트 번호 파일 확인
  if (fs.existsSync(portFile)) {
    try {
      const portContent = fs.readFileSync(portFile, 'utf-8').trim();
      console.log(`[Splash] Port file found, content: "${portContent}"`);
      const port = parseInt(portContent, 10);
      console.log(`[Splash] Parsed port: ${port} (isNaN: ${isNaN(port)}, > 0: ${port > 0})`);
      
      if (port > 0 && !isNaN(port)) {
        console.log(`[Splash] Attempting HTTP request to http://127.0.0.1:${port}/ready`);
        // HTTP 요청으로 메인 프로세스 준비 여부 확인
        const req = http.get(`http://127.0.0.1:${port}/ready`, (res) => {
          console.log(`[Splash] HTTP response received: status ${res.statusCode}`);
          if (res.statusCode === 200) {
            signalDetected = true;
            console.log('[Splash] Main process ready signal received via HTTP');
            
            // 메인 프로세스가 준비되었음을 알림
            if (splashWindow && !splashWindow.isDestroyed()) {
              splashWindow.close();
              splashWindow = null;
            }
            
            clearInterval(checkInterval);
            
            // 스플래시 프로세스 종료
            setTimeout(() => {
              console.log('[Splash] Exiting splash process...');
              app.quit();
            }, 500);
          }
        });
        
        req.on('error', (err) => {
          // 서버가 아직 준비되지 않음 (정상)
          if (checkCount % 10 === 0) {
            console.log(`[Splash] HTTP request error (server not ready yet): ${err.message} (checked ${checkCount} times)`);
          }
        });
        
        req.setTimeout(1000, () => {
          console.log(`[Splash] HTTP request timeout after 1 second`);
          req.destroy();
        });
      } else {
        if (checkCount % 10 === 0) {
          console.log(`[Splash] Invalid port number: ${port} (checked ${checkCount} times)`);
        }
      }
    } catch (e) {
      // 포트 파일 읽기 실패
      if (checkCount % 10 === 0) {
        console.log(`[Splash] Error reading port file: ${e.message} (checked ${checkCount} times)`);
      }
    }
  } else {
    // 포트 파일이 아직 없음
    if (checkCount % 10 === 0) {
      console.log(`[Splash] Port file does not exist: ${portFile} (checked ${checkCount} times)`);
    }
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
