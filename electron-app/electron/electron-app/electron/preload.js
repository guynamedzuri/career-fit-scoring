"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electron', {
    selectFolder: () => electron_1.ipcRenderer.invoke('select-folder'),
    qnetSearchCertifications: () => electron_1.ipcRenderer.invoke('qnet-search-certifications'),
    readOfficialCertificates: () => electron_1.ipcRenderer.invoke('read-official-certificates'),
    getDocxFiles: (folderPath) => electron_1.ipcRenderer.invoke('get-docx-files', folderPath),
    aiCheckResume: (data) => electron_1.ipcRenderer.invoke('ai-check-resume', data),
    processResume: (filePath) => electron_1.ipcRenderer.invoke('process-resume', filePath),
    loadCache: (folderPath, filePaths) => electron_1.ipcRenderer.invoke('load-cache', folderPath, filePaths),
    saveCache: (folderPath, results) => electron_1.ipcRenderer.invoke('save-cache', folderPath, results),
    careernetSearchJobs: () => electron_1.ipcRenderer.invoke('careernet-search-jobs'),
    careernetGetJobDetail: (jobdicSeq) => electron_1.ipcRenderer.invoke('careernet-get-job-detail', jobdicSeq),
    // 자동 업데이트 관련
    checkForUpdates: () => electron_1.ipcRenderer.invoke('check-for-updates'),
    onUpdateChecking: (callback) => {
        electron_1.ipcRenderer.on('update-checking', callback);
    },
    onUpdateAvailable: (callback) => {
        electron_1.ipcRenderer.on('update-available', (_, info) => callback(info));
    },
    onUpdateError: (callback) => {
        electron_1.ipcRenderer.on('update-error', (_, error) => callback(error));
    },
});
