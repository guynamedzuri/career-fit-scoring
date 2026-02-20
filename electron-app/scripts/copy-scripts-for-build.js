#!/usr/bin/env node
/**
 * 빌드 전에 상위 디렉터리(career-fit-scoring/)의 파일을 electron-app/ 안으로 복사.
 * asar: true일 때 files의 "../" 경로가 제대로 패키징되지 않을 수 있으므로,
 * 로컬에 복사한 뒤 electron-builder가 asar에 포함하도록 함.
 *
 * 복사 대상:
 *   ../scripts/*.py       → electron-app/py-scripts/    (asarUnpack — python.exe가 직접 읽음)
 *   ../certificate_official.txt → electron-app/build-env/certificate_official.txt (asar 안)
 *   (.env는 사용하지 않음 — API 키는 인증서 .enc 파일로만 로드)
 */
const fs = require('fs');
const path = require('path');

const electronAppRoot = path.resolve(__dirname, '..');
const projectRoot = path.join(electronAppRoot, '..');

// ──────────────────────────────────────────────
// 1. Python 스크립트 복사
// ──────────────────────────────────────────────
const scriptsSrc = path.join(projectRoot, 'scripts');
const scriptsDest = path.join(electronAppRoot, 'py-scripts');

console.log('[copy-build-assets] === Python 스크립트 ===');
console.log('[copy-build-assets] source:', scriptsSrc, '존재:', fs.existsSync(scriptsSrc));

if (!fs.existsSync(scriptsSrc)) {
  console.error('[copy-build-assets] ERROR: scripts 디렉터리를 찾을 수 없습니다:', scriptsSrc);
  process.exit(1);
}

if (fs.existsSync(scriptsDest)) {
  fs.rmSync(scriptsDest, { recursive: true });
}
fs.mkdirSync(scriptsDest, { recursive: true });

const scriptFiles = fs.readdirSync(scriptsSrc);
let scriptCount = 0;
for (const file of scriptFiles) {
  if (file.endsWith('.py')) {
    fs.copyFileSync(path.join(scriptsSrc, file), path.join(scriptsDest, file));
    scriptCount++;
  }
}
console.log(`[copy-build-assets] OK: ${scriptCount}개 .py 파일 → ${scriptsDest}`);

// ──────────────────────────────────────────────
// 2. .env + certificate_official.txt 복사
// ──────────────────────────────────────────────
const buildEnvDest = path.join(electronAppRoot, 'build-env');
if (fs.existsSync(buildEnvDest)) {
  fs.rmSync(buildEnvDest, { recursive: true });
}
fs.mkdirSync(buildEnvDest, { recursive: true });

console.log('[copy-build-assets] === certificate_official.txt ===');

const certOfficialSrc = path.join(projectRoot, 'certificate_official.txt');
const certOfficialDest = path.join(buildEnvDest, 'certificate_official.txt');
if (fs.existsSync(certOfficialSrc)) {
  fs.copyFileSync(certOfficialSrc, certOfficialDest);
  console.log('[copy-build-assets] OK: certificate_official.txt → ' + buildEnvDest);
} else {
  console.warn('[copy-build-assets] WARN: certificate_official.txt 없음 (' + certOfficialSrc + ') — 건너뜀');
}
