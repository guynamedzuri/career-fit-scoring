import { contextBridge, ipcRenderer } from 'electron';

// 자동 업데이트 관련 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 기존 API들...
  // ... (기존 코드 유지)
  
  // 자동 업데이트 체크
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // 업데이트 이벤트 리스너
  onUpdateChecking: (callback: () => void) => {
    ipcRenderer.on('update-checking', callback);
  },
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-available', (_, info) => callback(info));
  },
  onUpdateError: (callback: (error: string) => void) => {
    ipcRenderer.on('update-error', (_, error) => callback(error));
  },
  
  // 기존 API들 (기존 코드와 병합 필요)
});

contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  qnetSearchCertifications: () => ipcRenderer.invoke('qnet-search-certifications'),
  readOfficialCertificates: () => ipcRenderer.invoke('read-official-certificates'),
  getDocxFiles: (folderPath: string) => ipcRenderer.invoke('get-docx-files', folderPath),
  aiCheckResume: (data: { applicationData: any; jobMetadata: any; fileName: string }) =>
    ipcRenderer.invoke('ai-check-resume', data),
  loadCache: (folderPath: string, filePaths: string[]) =>
    ipcRenderer.invoke('load-cache', folderPath, filePaths),
  saveCache: (folderPath: string, results: Array<{ filePath: string; fileName: string; data: any }>) =>
    ipcRenderer.invoke('save-cache', folderPath, results),
  careernetSearchJobs: () => ipcRenderer.invoke('careernet-search-jobs'),
  careernetGetJobDetail: (jobdicSeq: string) => ipcRenderer.invoke('careernet-get-job-detail', jobdicSeq),
});
