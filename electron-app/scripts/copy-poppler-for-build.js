#!/usr/bin/env node
/**
 * 빌드 전에 career-fit-scoring/poppler-windows를 electron-app/poppler-windows로 복사.
 * extraResources의 from은 프로젝트(electron-app) 기준이라 상위(../) 경로가 누락될 수 있으므로,
 * 로컬에 복사한 뒤 electron-builder가 복사하도록 함.
 * 실행 위치: electron-app (npm run build:win:installer 등)
 */
const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, '..', 'poppler-windows');
const dest = path.join(projectRoot, 'poppler-windows');
const requiredFile = path.join(source, 'bin', process.platform === 'win32' ? 'pdftotext.exe' : 'pdftotext');

console.log('[copy-poppler] cwd:', cwd);
console.log('[copy-poppler] projectRoot (electron-app):', projectRoot);
console.log('[copy-poppler] source (../poppler-windows):', source);
console.log('[copy-poppler] source 존재:', fs.existsSync(source));
console.log('[copy-poppler] dest (electron-app/poppler-windows):', dest);
if (fs.existsSync(source)) {
  try {
    const srcContents = fs.readdirSync(source);
    console.log('[copy-poppler] source 내용:', srcContents.join(', '));
    const binPath = path.join(source, 'bin');
    if (fs.existsSync(binPath)) {
      const binContents = fs.readdirSync(binPath);
      console.log('[copy-poppler] source/bin 내용:', binContents.join(', '));
    }
  } catch (e) {
    console.log('[copy-poppler] source 읽기 실패:', e.message);
  }
}
console.log('[copy-poppler] requiredFile (pdftotext):', requiredFile);
console.log('[copy-poppler] requiredFile 존재:', fs.existsSync(requiredFile));

if (!fs.existsSync(requiredFile)) {
  console.error('[copy-poppler] ERROR: pdftotext not found at:', requiredFile);
  console.error('[copy-poppler] 프로젝트 루트(career-fit-scoring)에 poppler-windows/bin/pdftotext.exe 가 있어야 합니다.');
  process.exit(1);
}

function copyDirRecursive(src, dst) {
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(dst, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) {
      copyDirRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

if (fs.existsSync(dest)) {
  try {
    fs.rmSync(dest, { recursive: true });
  } catch (err) {
    console.error('[copy-poppler] 기존 poppler-windows 삭제 실패:', err.message);
    process.exit(1);
  }
}

copyDirRecursive(source, dest);
console.log('[copy-poppler] OK: poppler-windows 복사 완료 →', dest);
console.log('[copy-poppler] dest 존재:', fs.existsSync(dest));
const destBin = path.join(dest, 'bin');
if (fs.existsSync(destBin)) {
  const destBinContents = fs.readdirSync(destBin);
  console.log('[copy-poppler] dest/bin 내용:', destBinContents.join(', '));
  const pdftotextDest = path.join(destBin, process.platform === 'win32' ? 'pdftotext.exe' : 'pdftotext');
  console.log('[copy-poppler] dest/bin/pdftotext 존재:', fs.existsSync(pdftotextDest));
}
