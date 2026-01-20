const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const srcDir = path.join(__dirname, '..', 'src');

if (!fs.existsSync(distDir)) {
  console.error('[Copy] dist directory not found');
  process.exit(1);
}

function copyRecursive(src, dst) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    
    if (entry.isDirectory()) {
      if (!fs.existsSync(dstPath)) {
        fs.mkdirSync(dstPath, { recursive: true });
      }
      copyRecursive(srcPath, dstPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      // JavaScript 파일만 복사
      const dstDir = path.dirname(dstPath);
      if (!fs.existsSync(dstDir)) {
        fs.mkdirSync(dstDir, { recursive: true });
      }
      fs.copyFileSync(srcPath, dstPath);
      console.log(`[Copy] ${path.relative(srcDir, dstPath)}`);
    }
  }
}

console.log('[Copy] Copying dist/**/*.js to src/**/*.js');
copyRecursive(distDir, srcDir);
console.log('[Copy] Done');
