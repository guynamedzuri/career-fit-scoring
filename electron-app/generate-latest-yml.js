/**
 * latest.yml 파일을 수동으로 생성하는 스크립트
 * electron-builder가 자동 생성하지 않을 때 사용
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const distInstallerPath = path.join(__dirname, 'dist-installer');
const version = require('./package.json').version;

// 설치 파일 찾기
const files = fs.readdirSync(distInstallerPath);
const exeFile = files.find(f => f.endsWith('.exe') && f.includes('Setup'));

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

// latest.yml 생성
const latestYml = {
  version: version,
  files: [
    {
      url: exeFile,
      sha512: sha512,
      size: fileSize
    }
  ],
  path: exeFile,
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
console.log(`파일: ${exeFile}`);
console.log(`크기: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
