#!/usr/bin/env node
/**
 * electron-builder 실행 직후: 빌드 결과물(resources)에 poppler-windows가 들어갔는지 확인.
 * win-unpacked 기준: dist-installer/win-unpacked/resources/poppler-windows
 * 실행 위치: electron-app
 */
const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'dist-installer', 'win-unpacked');
const resourcesDir = path.join(outputDir, 'resources');
const popplerInResources = path.join(resourcesDir, 'poppler-windows');
const popplerBin = path.join(popplerInResources, 'bin');
const pdftotext = path.join(popplerBin, process.platform === 'win32' ? 'pdftotext.exe' : 'pdftotext');

console.log('[verify-poppler-after] cwd:', cwd);
console.log('[verify-poppler-after] outputDir (dist-installer/win-unpacked):', outputDir);
console.log('[verify-poppler-after] outputDir 존재:', fs.existsSync(outputDir));
console.log('[verify-poppler-after] resources 경로:', resourcesDir);
console.log('[verify-poppler-after] resources 존재:', fs.existsSync(resourcesDir));

if (fs.existsSync(resourcesDir)) {
  try {
    const list = fs.readdirSync(resourcesDir);
    console.log('[verify-poppler-after] resources 내용:', list.join(', '));
  } catch (e) {
    console.log('[verify-poppler-after] resources 읽기 실패:', e.message);
  }
}

console.log('[verify-poppler-after] resources/poppler-windows 경로:', popplerInResources);
console.log('[verify-poppler-after] resources/poppler-windows 존재:', fs.existsSync(popplerInResources));
console.log('[verify-poppler-after] resources/poppler-windows/bin 존재:', fs.existsSync(popplerBin));
console.log('[verify-poppler-after] pdftotext 존재:', fs.existsSync(pdftotext));

if (fs.existsSync(popplerBin)) {
  try {
    const list = fs.readdirSync(popplerBin);
    console.log('[verify-poppler-after] resources/poppler-windows/bin 내용:', list.join(', '));
  } catch (e) {
    console.log('[verify-poppler-after] bin 읽기 실패:', e.message);
  }
}

if (!fs.existsSync(pdftotext)) {
  console.error('[verify-poppler-after] ERROR: 빌드 결과물에 poppler-windows가 없습니다. resources:', resourcesDir);
  process.exit(1);
}
console.log('[verify-poppler-after] OK: 빌드 결과물에 poppler-windows 포함됨.');
