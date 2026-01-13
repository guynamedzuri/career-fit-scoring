/**
 * latest.yml 파일을 수동으로 생성하는 스크립트
 * electron-builder가 자동 생성하지 않을 때 사용
 * 
 * 사용법:
 *   npm run generate-latest
 *   또는
 *   npm run generate-latest Setup.1.0.2.exe
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const distInstallerPath = path.join(__dirname, 'dist-installer');
const packageJson = require('./package.json');
const version = packageJson.version;

// 명령줄 인자로 파일 이름 지정 가능
const customFileName = process.argv[2];

// 설치 파일 찾기
const files = fs.readdirSync(distInstallerPath);
let exeFile = files.find(f => f.endsWith('.exe') && f.includes('Setup'));

if (!exeFile) {
  console.error('설치 파일(.exe)을 찾을 수 없습니다.');
  console.log('dist-installer 폴더의 파일들:', files);
  process.exit(1);
}

const exePath = path.join(distInstallerPath, exeFile);
const stats = fs.statSync(exePath);
const fileSize = stats.size;

// SHA512 해시 계산
console.log('SHA512 해시 계산 중...');
const fileBuffer = fs.readFileSync(exePath);
const hashSum = crypto.createHash('sha512');
hashSum.update(fileBuffer);
const sha512 = hashSum.digest('hex');

// GitHub Release에 업로드할 파일 이름 결정
// 1. 명령줄 인자가 있으면 사용
// 2. 없으면 버전 기반으로 생성: Setup.{version}.exe
let releaseFileName = customFileName;
if (!releaseFileName) {
  // 버전 기반 파일 이름 생성 (예: Setup.1.0.2.exe)
  releaseFileName = `Setup.${version}.exe`;
  console.log(`\n⚠️  파일 이름이 지정되지 않았습니다.`);
  console.log(`   로컬 파일: ${exeFile}`);
  console.log(`   Release 파일 이름: ${releaseFileName}`);
  console.log(`   GitHub Release에 업로드할 때 이 이름을 사용하세요!`);
  console.log(`   또는 다음 명령으로 파일 이름을 지정할 수 있습니다:`);
  console.log(`   npm run generate-latest Setup.${version}.exe\n`);
}

// latest.yml 생성
const latestYml = {
  version: version,
  files: [
    {
      url: releaseFileName,  // GitHub Release의 실제 파일 이름 사용
      sha512: sha512,
      size: fileSize
    }
  ],
  path: releaseFileName,  // GitHub Release의 실제 파일 이름 사용
  sha512: sha512,
  releaseDate: new Date().toISOString()
};

// YAML 형식으로 변환
const yamlContent = `version: ${latestYml.version}
files:
  - url: ${latestYml.files[0].url}
    sha512: ${latestYml.files[0].sha512}
    size: ${latestYml.files[0].size}
path: ${latestYml.path}
sha512: ${latestYml.sha512}
releaseDate: '${latestYml.releaseDate}'
`;

const ymlPath = path.join(distInstallerPath, 'latest.yml');
fs.writeFileSync(ymlPath, yamlContent, 'utf-8');

console.log('✅ latest.yml 파일이 생성되었습니다:');
console.log(`   ${ymlPath}`);
console.log(`\n버전: ${version}`);
console.log(`로컬 파일: ${exeFile}`);
console.log(`Release 파일 이름: ${releaseFileName}`);
console.log(`크기: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`\n📌 중요: GitHub Release에 업로드할 때 파일 이름을 "${releaseFileName}"로 변경하세요!`);
