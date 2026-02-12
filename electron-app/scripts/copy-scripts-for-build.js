#!/usr/bin/env node
/**
 * 빌드 전에 career-fit-scoring/scripts/*.py를 electron-app/py-scripts/로 복사.
 * asarUnpack은 electron-app 디렉터리 안의 파일만 처리할 수 있으므로,
 * 상위(../)의 Python 스크립트를 로컬에 복사한 뒤 asar + asarUnpack이 동작하도록 함.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, '..', 'scripts');
const dest = path.join(projectRoot, 'py-scripts');

console.log('[copy-scripts] source:', source);
console.log('[copy-scripts] source 존재:', fs.existsSync(source));
console.log('[copy-scripts] dest:', dest);

if (!fs.existsSync(source)) {
  console.error('[copy-scripts] ERROR: scripts 디렉터리를 찾을 수 없습니다:', source);
  process.exit(1);
}

// 기존 dest 삭제
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true });
}
fs.mkdirSync(dest, { recursive: true });

// .py 파일만 복사
const files = fs.readdirSync(source);
let copied = 0;
for (const file of files) {
  if (file.endsWith('.py')) {
    fs.copyFileSync(path.join(source, file), path.join(dest, file));
    copied++;
  }
}

console.log(`[copy-scripts] OK: ${copied}개 .py 파일 복사 완료 → ${dest}`);
const destContents = fs.readdirSync(dest);
console.log('[copy-scripts] dest 내용:', destContents.join(', '));
