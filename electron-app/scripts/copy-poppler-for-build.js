#!/usr/bin/env node
/**
 * 빌드 전에 career-fit-scoring/poppler-windows를 electron-app/poppler-windows로 복사.
 * extraResources의 from은 프로젝트(electron-app) 기준이라 상위(../) 경로가 누락될 수 있으므로,
 * 로컬에 복사한 뒤 electron-builder가 복사하도록 함.
 * 실행 위치: electron-app (npm run build:win:installer 등)
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, '..', 'poppler-windows');
const dest = path.join(projectRoot, 'poppler-windows');
const requiredFile = path.join(source, 'bin', process.platform === 'win32' ? 'pdftotext.exe' : 'pdftotext');

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
