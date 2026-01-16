// 빌드 후 실행 파일 아이콘을 설정하는 스크립트
// Resource Hacker CLI를 사용하여 아이콘 변경

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const exePath = path.join(__dirname, '..', 'dist-installer', 'win-unpacked', '이력서 적합도 평가 시스템.exe');
const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');

console.log('실행 파일 아이콘 설정 스크립트');
console.log('EXE:', exePath);
console.log('Icon:', iconPath);

if (!fs.existsSync(exePath)) {
  console.error('ERROR: 실행 파일을 찾을 수 없습니다:', exePath);
  process.exit(1);
}

if (!fs.existsSync(iconPath)) {
  console.error('ERROR: 아이콘 파일을 찾을 수 없습니다:', iconPath);
  process.exit(1);
}

// Resource Hacker CLI 경로 (설치되어 있어야 함)
// 일반적으로 Program Files에 설치됨
const resourceHackerPaths = [
  'C:\\Program Files\\Resource Hacker\\ResourceHacker.exe',
  'C:\\Program Files (x86)\\Resource Hacker\\ResourceHacker.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Resource Hacker', 'ResourceHacker.exe'),
];

let resourceHacker = null;
for (const rhPath of resourceHackerPaths) {
  if (fs.existsSync(rhPath)) {
    resourceHacker = rhPath;
    break;
  }
}

if (!resourceHacker) {
  console.warn('WARNING: Resource Hacker를 찾을 수 없습니다.');
  console.warn('다운로드: http://www.angusj.com/resourcehacker/');
  console.warn('수동으로 아이콘을 변경해야 합니다.');
  process.exit(0);
}

console.log('Resource Hacker 발견:', resourceHacker);

try {
  // Resource Hacker CLI 명령어
  // -open: 파일 열기
  // -save: 저장
  // -action: 작업 (addoverwrite, delete 등)
  // -resource: 리소스 경로
  // -mask: 마스크 (ICON,1 등)
  
  // 임시 스크립트 파일 생성
  const scriptPath = path.join(__dirname, '..', 'dist-installer', 'set-icon.txt');
  const scriptContent = `[FILENAMES]
Exe="${exePath}"
SaveAs="${exePath}"
Log="${path.join(__dirname, '..', 'dist-installer', 'icon-log.txt')}"
[COMMANDS]
-delete ICON,1,
-addoverwrite "${iconPath}", ICON,1,
`;
  
  fs.writeFileSync(scriptPath, scriptContent, 'utf-8');
  console.log('스크립트 파일 생성:', scriptPath);
  
  // Resource Hacker 실행
  const command = `"${resourceHacker}" -script "${scriptPath}"`;
  console.log('실행 명령:', command);
  
  execSync(command, { stdio: 'inherit' });
  
  console.log('✓ 실행 파일 아이콘이 설정되었습니다!');
  
  // 임시 파일 삭제
  fs.unlinkSync(scriptPath);
  
} catch (error) {
  console.error('ERROR: 아이콘 설정 실패:', error.message);
  process.exit(1);
}
