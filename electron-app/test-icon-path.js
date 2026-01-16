// electron-builder가 아이콘을 찾는지 테스트
const path = require('path');
const fs = require('fs');

console.log('현재 작업 디렉토리:', process.cwd());
console.log('__dirname:', __dirname);

// buildResources: . 일 때 icon.ico 경로
const iconPath1 = path.join(process.cwd(), 'icon.ico');
const iconPath2 = path.resolve('icon.ico');
const iconPath3 = './icon.ico';

console.log('\n가능한 icon.ico 경로:');
console.log('1. process.cwd() + icon.ico:', iconPath1, '->', fs.existsSync(iconPath1) ? 'EXISTS' : 'NOT FOUND');
console.log('2. resolve(icon.ico):', iconPath2, '->', fs.existsSync(iconPath2) ? 'EXISTS' : 'NOT FOUND');
console.log('3. ./icon.ico:', iconPath3, '->', fs.existsSync(iconPath3) ? 'EXISTS' : 'NOT FOUND');

// electron-builder가 사용할 경로 (buildResources: . 기준)
const buildResourcesPath = process.cwd();
const expectedIconPath = path.join(buildResourcesPath, 'icon.ico');
console.log('\nbuildResources 경로:', buildResourcesPath);
console.log('예상 icon.ico 경로:', expectedIconPath);
console.log('존재 여부:', fs.existsSync(expectedIconPath) ? 'EXISTS ✓' : 'NOT FOUND ✗');

if (fs.existsSync(expectedIconPath)) {
  const stats = fs.statSync(expectedIconPath);
  console.log('파일 크기:', stats.size, 'bytes');
  console.log('수정 시간:', stats.mtime);
}
