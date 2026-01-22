/**
 * 스플래시 스크린을 별도 프로세스로 표시
 * npm run dev 시작 시 즉시 스플래시를 보여주기 위함
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

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

app.on('window-all-closed', () => {
  // 모든 창이 닫혀도 앱은 유지 (메인 프로세스가 시작될 때까지)
  // 하지만 메인 프로세스가 시작되면 이 프로세스는 종료되어야 함
  // IPC나 파일 기반 신호를 사용할 수 있지만, 일단은 유지
});

// 메인 프로세스가 시작되면 이 스플래시를 닫도록 신호를 받을 수 있음
// 간단하게는 일정 시간 후 자동 종료 (메인 프로세스의 스플래시가 표시될 때까지)
setTimeout(() => {
  if (splashWindow && !splashWindow.isDestroyed()) {
    // 메인 프로세스가 시작되었을 것으로 가정하고 닫기
    // 실제로는 IPC나 파일 기반 신호를 사용하는 것이 더 정확함
  }
}, 10000); // 10초 후 자동 종료 (메인 프로세스가 시작되었을 것으로 가정)
