#!/usr/bin/env node
/**
 * electron-builder 실행 직전: electron-app/poppler-windows가 있는지 확인.
 * extraResources가 이 경로를 참조하므로, 없으면 resources에 포함되지 않음.
 * 실행 위치: electron-app
 */
const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const projectRoot = path.resolve(__dirname, '..');
const popplerDir = path.join(projectRoot, 'poppler-windows');
const popplerBin = path.join(popplerDir, 'bin');
const pdftotext = path.join(popplerBin, process.platform === 'win32' ? 'pdftotext.exe' : 'pdftotext');

console.log('[verify-poppler-before] cwd:', cwd);
console.log('[verify-poppler-before] projectRoot:', projectRoot);
console.log('[verify-poppler-before] poppler-windows 경로:', popplerDir);
console.log('[verify-poppler-before] poppler-windows 존재:', fs.existsSync(popplerDir));
console.log('[verify-poppler-before] poppler-windows/bin 존재:', fs.existsSync(popplerBin));
console.log('[verify-poppler-before] pdftotext 존재:', fs.existsSync(pdftotext));

if (fs.existsSync(popplerBin)) {
  try {
    const list = fs.readdirSync(popplerBin);
    console.log('[verify-poppler-before] poppler-windows/bin 내용:', list.join(', '));
  } catch (e) {
    console.log('[verify-poppler-before] bin 읽기 실패:', e.message);
  }
}

if (!fs.existsSync(pdftotext)) {
  console.error('[verify-poppler-before] ERROR: electron-app/poppler-windows/bin/pdftotext 없음. extraResources에 포함되지 않습니다.');
  process.exit(1);
}
console.log('[verify-poppler-before] OK: electron-builder가 참조할 poppler-windows 준비됨.');
