import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  qnetSearchCertifications: () => ipcRenderer.invoke('qnet-search-certifications'),
  readOfficialCertificates: () => ipcRenderer.invoke('read-official-certificates'),
});
