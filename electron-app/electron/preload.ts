import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  qnetSearchCertifications: () => ipcRenderer.invoke('qnet-search-certifications'),
  readOfficialCertificates: () => ipcRenderer.invoke('read-official-certificates'),
  parseOfficialCertificates: (fileContent: string) => ipcRenderer.invoke('parse-official-certificates', fileContent),
  parseAdditionalNationalCertificates: (content: string) => ipcRenderer.invoke('parse-additional-national-certificates', content),
  getAdditionalNationalCertificates: () => ipcRenderer.invoke('get-additional-national-certificates'),
  getDocxFiles: (folderPath: string, documentType?: 'docx' | 'pdf') => ipcRenderer.invoke('get-docx-files', folderPath, documentType),
  aiCheckResume: (data: { applicationData: any; userPrompt: any; fileName: string }) =>
    ipcRenderer.invoke('ai-check-resume', data),
  aiCheckResumeBatch: (data: { userPrompt: any; items: Array<{ applicationData: any; fileName: string }>; debugFolder?: string }) =>
    ipcRenderer.invoke('ai-check-resume-batch', data),
  getAiPromptsPreview: (data: { userPrompt: any; applicationData?: any }) =>
    ipcRenderer.invoke('get-ai-prompts-preview', data),
  generateGradeCriteria: (jobDescription: string) =>
    ipcRenderer.invoke('generate-grade-criteria', jobDescription),
  processResume: (filePath: string, documentType?: 'docx' | 'pdf') =>
    ipcRenderer.invoke('process-resume', filePath, documentType),
  loadCache: (folderPath: string, filePaths: string[]) =>
    ipcRenderer.invoke('load-cache', folderPath, filePaths),
  saveCache: (folderPath: string, results: Array<{ filePath: string; fileName: string; data: any }>) =>
    ipcRenderer.invoke('save-cache', folderPath, results),
  exportCandidatesExcel: (payload: { headers: string[]; rows: string[][] }) =>
    ipcRenderer.invoke('export-candidates-excel', payload),
  careernetSearchJobs: () => ipcRenderer.invoke('careernet-search-jobs'),
  careernetGetJobDetail: (jobdicSeq: string) => ipcRenderer.invoke('careernet-get-job-detail', jobdicSeq),
  // 자동 업데이트 관련
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateChecking: (callback: () => void) => {
    ipcRenderer.on('update-checking', callback);
  },
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-available', (_, info) => callback(info));
  },
  onUpdateError: (callback: (error: string) => void) => {
    ipcRenderer.on('update-error', (_, error) => callback(error));
  },
  onUpdateDownloadProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('update-download-progress', (_, progress) => callback(progress));
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    ipcRenderer.on('update-downloaded', (_, info) => callback(info));
  },
  onUpdateNotAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-not-available', (_, info) => callback(info));
  },
  // 스플래시 닫기 신호
  notifyAppReady: () => ipcRenderer.invoke('app-ready'),
  // 파일 열기
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
  // 이미지 파일을 base64로 읽기
  readImageAsBase64: (imagePath: string) => ipcRenderer.invoke('read-image-as-base64', imagePath),
});
