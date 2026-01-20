const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const venvDir = path.join(projectRoot, '.venv');
const isWindows = process.platform === 'win32';
const pythonCmd = isWindows ? 'python' : 'python3';
const venvPython = isWindows 
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python3');

console.log('[Python Env] Checking Python virtual environment...');

// Python이 설치되어 있는지 확인
try {
  const versionCmd = isWindows ? `"${pythonCmd}" --version` : `${pythonCmd} --version`;
  execSync(versionCmd, { 
    stdio: 'ignore',
    shell: isWindows // Windows에서 shell 사용
  });
  console.log(`[Python Env] Python found: ${pythonCmd}`);
} catch (error) {
  console.error(`[Python Env] ERROR: Python (${pythonCmd}) is not installed or not in PATH`);
  console.error('[Python Env] Please install Python from https://www.python.org/downloads/');
  process.exit(1);
}

// 가상환경이 없으면 생성
if (!fs.existsSync(venvPython)) {
  console.log('[Python Env] Virtual environment not found. Creating...');
  try {
    // Windows에서 경로에 공백이 있으면 따옴표로 감싸기
    const venvCmd = isWindows 
      ? `"${pythonCmd}" -m venv .venv`
      : `${pythonCmd} -m venv .venv`;
    execSync(venvCmd, {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: isWindows // Windows에서 shell 사용
    });
    console.log('[Python Env] Virtual environment created successfully');
  } catch (error) {
    console.error('[Python Env] ERROR: Failed to create virtual environment');
    console.error(error.message);
    process.exit(1);
  }
} else {
  console.log('[Python Env] Virtual environment found');
}

// python-docx가 설치되어 있는지 확인
console.log('[Python Env] Checking python-docx package...');
try {
  // Windows에서 경로에 공백이 있으면 따옴표로 감싸기
  const checkCmd = isWindows
    ? `"${venvPython}" -c "import docx"`
    : `${venvPython} -c "import docx"`;
  execSync(checkCmd, { 
    stdio: 'ignore',
    shell: isWindows
  });
  console.log('[Python Env] python-docx is already installed');
} catch (error) {
  console.log('[Python Env] python-docx not found. Installing...');
  try {
    // Windows에서 경로에 공백이 있으면 따옴표로 감싸기
    const installCmd = isWindows
      ? `"${venvPython}" -m pip install python-docx`
      : `${venvPython} -m pip install python-docx`;
    execSync(installCmd, {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: isWindows // Windows에서 shell 사용
    });
    console.log('[Python Env] python-docx installed successfully');
  } catch (error) {
    console.error('[Python Env] ERROR: Failed to install python-docx');
    console.error(error.message);
    process.exit(1);
  }
}

console.log('[Python Env] Setup complete!');
