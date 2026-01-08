import { contextBridge, ipcRenderer } from 'electron';

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
