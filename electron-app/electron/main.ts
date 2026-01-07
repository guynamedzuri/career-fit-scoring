import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';

let mainWindow: BrowserWindow | null = null;

/**
 * .env 파일 로드
 */
function loadEnvFile(): void {
  try {
    // 프로젝트 루트 찾기
    const projectRoot = findProjectRoot();
    if (!projectRoot) {
      console.warn('[Load Env] Project root not found, trying current directory');
    }
    
    // .env 파일 경로들 시도
    const envPaths = [
      projectRoot ? path.join(projectRoot, '.env') : null,
      path.join(__dirname, '../../.env'),
      path.join(__dirname, '../../../.env'),
      path.join(process.cwd(), '.env'),
    ].filter((p): p is string => p !== null);
    
    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        console.log('[Load Env] Loading .env from:', envPath);
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const lines = envContent.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          // 주석이나 빈 줄 건너뛰기
          if (!trimmedLine || trimmedLine.startsWith('#')) continue;
          
          // KEY=VALUE 형식 파싱
          const match = trimmedLine.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            
            // 따옴표 제거
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            
            // 환경 변수에 설정 (이미 있으면 덮어쓰지 않음)
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
        return;
      }
    }
    
    console.warn('[Load Env] .env file not found in:', envPaths);
  } catch (error) {
    console.warn('[Load Env] Error loading .env file:', error);
  }
}

/**
 * 프로젝트 루트 디렉토리 찾기
 * certificate_official.txt 파일이 있는 디렉토리를 찾습니다.
 */
function findProjectRoot(): string | null {
  let currentDir = __dirname;
  const maxDepth = 10; // 최대 탐색 깊이
  
  for (let i = 0; i < maxDepth; i++) {
    const certFile = path.join(currentDir, 'certificate_official.txt');
    if (fs.existsSync(certFile)) {
      console.log('[Find Project Root] Found at:', currentDir);
      return currentDir;
    }
    
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // 루트 디렉토리에 도달
      break;
    }
    currentDir = parentDir;
  }
  
  // process.cwd()에서도 시도
  currentDir = process.cwd();
  for (let i = 0; i < maxDepth; i++) {
    const certFile = path.join(currentDir, 'certificate_official.txt');
    if (fs.existsSync(certFile)) {
      console.log('[Find Project Root] Found at (cwd):', currentDir);
      return currentDir;
    }
    
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  
  console.warn('[Find Project Root] Project root not found');
  return null;
}

function createWindow() {
  // 개발 환경에서는 Vite 개발 서버, 프로덕션에서는 빌드된 파일
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  console.log('isDev:', isDev, 'isPackaged:', app.isPackaged);
  
  // 개발 환경과 프로덕션 환경에 따라 다른 창 설정
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 1000,
    height: 700,
    show: false, // 준비될 때까지 숨김
    autoHideMenuBar: true, // 메뉴바 자동 숨김
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  };
  
  if (isDev) {
    // 개발 환경: 창 크기 조절 가능
    windowOptions.resizable = true;
    windowOptions.minWidth = 600;
    windowOptions.minHeight = 500;
    // maxWidth, maxHeight는 제한 없음
  } else {
    // 프로덕션 환경: 창 크기 고정
    windowOptions.resizable = false;
    windowOptions.minWidth = 1000;
    windowOptions.minHeight = 700;
    windowOptions.maxWidth = 1000;
    windowOptions.maxHeight = 700;
  }
  
  mainWindow = new BrowserWindow(windowOptions);
  
  // 메뉴바 완전히 제거
  mainWindow.setMenuBarVisibility(false);
  
  // 프로덕션 환경에서 개발자 도구 비활성화
  if (!isDev) {
    // 개발자 도구가 열리려고 하면 즉시 닫기
    mainWindow.webContents.on('devtools-opened', () => {
      console.warn('[Security] DevTools opened in production, closing...');
      if (mainWindow) {
        mainWindow.webContents.closeDevTools();
      }
    });
    
    // 키보드 단축키로 개발자 도구 열기 시도 차단 (프로덕션만)
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U 등 차단
      if (
        input.key === 'F12' ||
        (input.control && input.shift && (input.key === 'I' || input.key === 'J')) ||
        (input.control && input.key === 'U')
      ) {
        event.preventDefault();
      }
    });
  } else {
    // 개발 환경: F12로 개발자 도구 열기 허용
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // F12로 개발자 도구 열기/닫기
      if (input.key === 'F12') {
        if (mainWindow) {
          if (mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools();
          } else {
            mainWindow.webContents.openDevTools();
          }
        }
        event.preventDefault();
      }
    });
    
    // 우클릭 컨텍스트 메뉴에서 "검사" 옵션 제거 (preload에서도 처리 필요)
    mainWindow.webContents.on('context-menu', (event) => {
      event.preventDefault();
    });
  }
  
  if (isDev) {
    // Vite 개발 서버 URL
    const viteUrl = 'http://localhost:5173';
    console.log('Loading Vite dev server:', viteUrl);
    
    // 페이지가 로드되면 창 표시
    mainWindow.webContents.once('did-finish-load', () => {
      console.log('Page loaded successfully');
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    
    mainWindow.loadURL(viteUrl);
    mainWindow.webContents.openDevTools();
    
    // Vite 서버가 준비될 때까지 대기
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription);
      if (errorCode === -106 && mainWindow) {
        // ERR_INTERNET_DISCONNECTED 또는 연결 실패
        console.log('Waiting for Vite server to start...');
        setTimeout(() => {
          if (mainWindow) {
            mainWindow.loadURL(viteUrl);
          }
        }, 1000);
      }
    });
  } else {
    // 프로덕션: 빌드된 파일 로드
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('Loading production file:', indexPath);
    mainWindow.loadFile(indexPath);
    mainWindow.show();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // 애플리케이션 메뉴 제거 (File, Edit, View, Window 등)
  Menu.setApplicationMenu(null);
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 폴더 선택 IPC 핸들러
ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return null;
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  return result.filePaths[0];
});

// 폴더 내 DOCX 파일 목록 가져오기 IPC 핸들러
ipcMain.handle('get-docx-files', async (event, folderPath: string) => {
  try {
    if (!folderPath || !fs.existsSync(folderPath)) {
      return [];
    }
    
    const files = fs.readdirSync(folderPath);
    const docxFiles = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ext === '.docx';
      })
      .map(file => ({
        name: file,
        path: path.join(folderPath, file),
      }));
    
    return docxFiles;
  } catch (error) {
    console.error('[Get DOCX Files] Error:', error);
    return [];
  }
});

// Q-Net API 호출 IPC 핸들러
ipcMain.handle('qnet-search-certifications', async () => {
  return new Promise((resolve, reject) => {
    const apiKey = '62577f38999a14613f5ded0c9b01b6ce6349e437323ebb4422825c429189ae5f';
    const url = `http://openapi.q-net.or.kr/api/service/rest/InquiryListNationalQualifcationSVC/getList?ServiceKey=${apiKey}`;
    
    http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const certifications: string[] = [];
          
          // XML 또는 JSON 응답 처리
          if (data.trim().startsWith('<?xml') || data.trim().startsWith('<')) {
            // XML 파싱 (간단한 정규식 방식)
            const jmfldnmMatches = data.match(/<jmfldnm[^>]*>([^<]*)<\/jmfldnm>/g);
            if (jmfldnmMatches) {
              jmfldnmMatches.forEach((match: string) => {
                const name = match.replace(/<\/?jmfldnm[^>]*>/g, '').trim();
                if (name) {
                  certifications.push(name);
                }
              });
            }
          } else {
            // JSON 파싱
            const jsonData = JSON.parse(data);
            const items = jsonData.response?.body?.items?.item || [];
            const itemList = Array.isArray(items) ? items : (items ? [items] : []);
            
            itemList.forEach((item: any) => {
              if (item.jmfldnm) {
                certifications.push(item.jmfldnm.trim());
              }
            });
          }
          
          resolve(certifications);
        } catch (error) {
          console.error('[Q-Net IPC] Parse error:', error);
          reject(error);
        }
      });
    }).on('error', (error) => {
      console.error('[Q-Net IPC] Request error:', error);
      reject(error);
    });
  });
});

// 공인민간자격증 파일 읽기 IPC 핸들러
ipcMain.handle('read-official-certificates', async () => {
  try {
    console.log('[Official Certs IPC] Starting file search...');
    console.log('[Official Certs IPC] __dirname:', __dirname);
    console.log('[Official Certs IPC] process.cwd():', process.cwd());
    console.log('[Official Certs IPC] app.getAppPath():', app.getAppPath());
    
    // 프로젝트 루트 찾기
    const projectRoot = findProjectRoot();
    
    if (projectRoot) {
      const filePath = path.join(projectRoot, 'certificate_official.txt');
      if (fs.existsSync(filePath)) {
        console.log('[Official Certs IPC] Reading file from:', filePath);
        // 여러 인코딩 시도
        let fileContent: string | null = null;
        const encodings = ['utf-8', 'utf8', 'euc-kr', 'cp949'] as const;
        
        for (const encoding of encodings) {
          try {
            const buffer = fs.readFileSync(filePath);
            if (encoding === 'utf-8' || encoding === 'utf8') {
              fileContent = buffer.toString('utf-8');
            } else {
              // iconv-lite 같은 라이브러리가 필요하지만, 일단 기본 방법 시도
              fileContent = buffer.toString('utf-8');
            }
            
            // UTF-8 BOM 제거 (EF BB BF)
            if (fileContent.charCodeAt(0) === 0xFEFF) {
              fileContent = fileContent.slice(1);
            }
            
            // 깨진 문자 확인 (Replacement Character가 많으면 다른 인코딩 시도)
            const brokenCharCount = (fileContent.match(/\uFFFD/g) || []).length;
            if (brokenCharCount < fileContent.length * 0.01) { // 1% 미만이면 OK
              console.log(`[Official Certs IPC] File read with encoding: ${encoding}, broken chars: ${brokenCharCount}`);
              break;
            } else {
              console.warn(`[Official Certs IPC] Too many broken characters with ${encoding}, trying next...`);
              fileContent = null;
            }
          } catch (error) {
            console.warn(`[Official Certs IPC] Failed to read with ${encoding}:`, error);
            fileContent = null;
          }
        }
        
        if (!fileContent) {
          // 마지막 시도: 기본 UTF-8
          fileContent = fs.readFileSync(filePath, 'utf-8');
          if (fileContent.charCodeAt(0) === 0xFEFF) {
            fileContent = fileContent.slice(1);
          }
        }
        
        // 깨진 문자 제거
        fileContent = fileContent.replace(/\uFFFD+/g, ''); // Replacement Character 제거
        console.log('[Official Certs IPC] File read successfully, size:', fileContent.length, 'bytes');
        return fileContent;
      } else {
        console.error('[Official Certs IPC] File not found at expected path:', filePath);
      }
    }
    
    // 프로젝트 루트를 찾지 못한 경우, 여러 경로 시도
    const possiblePaths = [
      path.join(__dirname, '../../..', 'certificate_official.txt'),
      path.join(__dirname, '../..', 'certificate_official.txt'),
      path.join(__dirname, '..', 'certificate_official.txt'),
      path.join(process.cwd(), 'certificate_official.txt'),
      path.join(process.cwd(), '..', 'certificate_official.txt'),
      path.join(process.cwd(), '../..', 'certificate_official.txt'),
      path.join(process.cwd(), '../../..', 'certificate_official.txt'),
    ];
    
    console.log('[Official Certs IPC] Trying fallback paths:');
    for (const filePath of possiblePaths) {
      const exists = fs.existsSync(filePath);
      console.log('  -', filePath, exists ? '✓' : '✗');
      if (exists) {
        console.log('[Official Certs IPC] Found file at:', filePath);
        // 여러 인코딩 시도
        let fileContent: string | null = null;
        const encodings = ['utf-8', 'utf8', 'euc-kr', 'cp949'] as const;
        
        for (const encoding of encodings) {
          try {
            const buffer = fs.readFileSync(filePath);
            if (encoding === 'utf-8' || encoding === 'utf8') {
              fileContent = buffer.toString('utf-8');
            } else {
              // iconv-lite 같은 라이브러리가 필요하지만, 일단 기본 방법 시도
              fileContent = buffer.toString('utf-8');
            }
            
            // UTF-8 BOM 제거 (EF BB BF)
            if (fileContent.charCodeAt(0) === 0xFEFF) {
              fileContent = fileContent.slice(1);
            }
            
            // 깨진 문자 확인 (Replacement Character가 많으면 다른 인코딩 시도)
            const brokenCharCount = (fileContent.match(/\uFFFD/g) || []).length;
            if (brokenCharCount < fileContent.length * 0.01) { // 1% 미만이면 OK
              console.log(`[Official Certs IPC] File read with encoding: ${encoding}, broken chars: ${brokenCharCount}`);
              break;
            } else {
              console.warn(`[Official Certs IPC] Too many broken characters with ${encoding}, trying next...`);
              fileContent = null;
            }
          } catch (error) {
            console.warn(`[Official Certs IPC] Failed to read with ${encoding}:`, error);
            fileContent = null;
          }
        }
        
        if (!fileContent) {
          // 마지막 시도: 기본 UTF-8
          fileContent = fs.readFileSync(filePath, 'utf-8');
          if (fileContent.charCodeAt(0) === 0xFEFF) {
            fileContent = fileContent.slice(1);
          }
        }
        
        // 깨진 문자 제거
        fileContent = fileContent.replace(/\uFFFD+/g, ''); // Replacement Character 제거
        console.log('[Official Certs IPC] File read successfully, size:', fileContent.length, 'bytes');
        return fileContent;
      }
    }
    
    console.warn('[Official Certs IPC] File not found in any path');
    return null;
  } catch (error) {
    console.error('[Official Certs IPC] Read error:', error);
    return null;
  }
});

// Azure OpenAI API 호출 IPC 핸들러
ipcMain.handle('ai-check-resume', async (event, data: {
  applicationData: any;
  jobMetadata: any;
  fileName: string;
}) => {
  try {
    // Azure OpenAI 설정 (.env 파일에서 읽기)
    // .env 파일 로드 (빌드 시 포함됨)
    loadEnvFile();
    
    const API_KEY = process.env.AZURE_OPENAI_API_KEY;
    
    if (!API_KEY) {
      throw new Error(
        'Azure OpenAI API 키가 설정되지 않았습니다.\n' +
        '.env 파일에 AZURE_OPENAI_API_KEY를 설정하세요.'
      );
    }
    
    const ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || 'https://roar-mjm4cwji-swedencentral.openai.azure.com/';
    const DEPLOYMENT_NAME = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
    const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
    
    console.log('[AI Check] Using endpoint:', ENDPOINT);
    console.log('[AI Check] Using deployment:', DEPLOYMENT_NAME);

    const apiUrl = `${ENDPOINT}openai/deployments/${DEPLOYMENT_NAME}/chat/completions?api-version=${API_VERSION}`;

    // 이력서 데이터를 텍스트로 변환
    const resumeText = formatResumeDataForAI(data.applicationData);
    
    // 채용 공고 정보
    const jobInfo = data.jobMetadata ? `
채용 직종: ${data.jobMetadata.jobName || 'N/A'}
관련 전공: ${data.jobMetadata.relatedMajor || 'N/A'}
필수 자격증: ${data.jobMetadata.requiredCertifications?.join(', ') || '없음'}
관련 자격증: ${data.jobMetadata.relatedCertifications?.join(', ') || '없음'}
` : '';

    // AI 프롬프트 구성
    const systemPrompt = `당신은 채용 담당자입니다. 이력서를 분석하여 후보자의 적합도를 평가하고 등급을 부여해야 합니다.

평가 기준:
- A등급: 채용 공고 요구사항을 완벽히 충족하고, 우수한 경력과 자격을 보유한 후보자
- B등급: 채용 공고 요구사항을 대부분 충족하고, 적절한 경력과 자격을 보유한 후보자
- C등급: 채용 공고 요구사항을 부분적으로 충족하지만, 일부 부족한 점이 있는 후보자
- D등급: 채용 공고 요구사항을 충족하지 못하거나, 경력/자격이 부족한 후보자

응답 형식:
1. 등급: [A/B/C/D 중 하나]
2. 평가 요약: [한 문장으로 요약]
3. 주요 강점: [3-5개 항목]
4. 주요 약점: [3-5개 항목]
5. 종합 의견: [2-3문단으로 상세 분석]`;

    const userPrompt = `다음 채용 공고 정보와 이력서 데이터를 분석해주세요.

${jobInfo}

이력서 정보:
${resumeText}

위 정보를 바탕으로 후보자를 평가하고 등급을 부여해주세요.`;

    console.log('[AI Check] Calling Azure OpenAI API for:', data.fileName);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': API_KEY,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: 2000,
        temperature: 0.7,
        top_p: 1.0,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[AI Check] API Error:', response.status, errorData);
      throw new Error(`AI API 호출 실패: ${response.status}`);
    }

    const responseData = await response.json();
    const aiContent = responseData.choices[0]?.message?.content || '';

    // 등급 추출 (A, B, C, D)
    const gradeMatch = aiContent.match(/등급:\s*([A-D])/i) || aiContent.match(/\[([A-D])\]/i);
    const grade = gradeMatch ? gradeMatch[1].toUpperCase() : 'C';

    console.log('[AI Check] Success for:', data.fileName, 'Grade:', grade);

    return {
      success: true,
      grade,
      report: aiContent,
    };
  } catch (error) {
    console.error('[AI Check] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
});

// 이력서 데이터를 AI 분석용 텍스트로 변환
function formatResumeDataForAI(applicationData: any): string {
  if (!applicationData) return '이력서 데이터가 없습니다.';

  let text = '';

  // 기본 정보
  if (applicationData.name) text += `이름: ${applicationData.name}\n`;
  if (applicationData.birthDate) text += `생년월일: ${applicationData.birthDate}\n`;
  if (applicationData.email) text += `이메일: ${applicationData.email}\n`;
  if (applicationData.phone) text += `전화번호: ${applicationData.phone}\n`;
  text += '\n';

  // 자격증
  const certificates: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const certName = applicationData[`certificateName${i}`];
    const certDate = applicationData[`certificateDate${i}`];
    if (certName) {
      certificates.push(`${certName}${certDate ? ` (${certDate})` : ''}`);
    }
  }
  if (certificates.length > 0) {
    text += `자격증:\n${certificates.join('\n')}\n\n`;
  }

  // 경력
  const careers: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const company = applicationData[`careerCompanyName${i}`];
    const startDate = applicationData[`careerStartDate${i}`];
    const endDate = applicationData[`careerEndDate${i}`];
    const jobType = applicationData[`careerJobType${i}`];
    if (company) {
      careers.push(`${company} | ${startDate || ''} ~ ${endDate || '현재'} | ${jobType || ''}`);
    }
  }
  if (careers.length > 0) {
    text += `경력:\n${careers.join('\n')}\n\n`;
  }

  // 학력
  const educations: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const school = applicationData[`universityName${i}`];
    const degree = applicationData[`universityDegreeType${i}`];
    const major = applicationData[`universityMajor${i}_1`];
    const gpa = applicationData[`universityGPA${i}`];
    if (school) {
      educations.push(`${school} | ${degree || ''} | ${major || ''} | GPA: ${gpa || 'N/A'}`);
    }
  }
  if (educations.length > 0) {
    text += `학력:\n${educations.join('\n')}\n\n`;
  }

  // 대학원
  const gradSchools: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const school = applicationData[`graduateSchoolName${i}`];
    const degree = applicationData[`graduateSchoolDegreeType${i}`];
    const major = applicationData[`graduateSchoolMajor${i}_1`];
    if (school) {
      gradSchools.push(`${school} | ${degree || ''} | ${major || ''}`);
    }
  }
  if (gradSchools.length > 0) {
    text += `대학원:\n${gradSchools.join('\n')}\n\n`;
  }

  return text || '이력서 정보가 없습니다.';
}
