import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  startAgent: (missionText) => ipcRenderer.invoke('agent:start', missionText),
  cancelAgent: () => ipcRenderer.invoke('agent:cancel'),
  onAgentEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('agent:event', handler);
    return () => ipcRenderer.removeListener('agent:event', handler);
  },
  getKeyStatus: () => ipcRenderer.invoke('settings:getKeyStatus'),
  setApiKey: (key) => ipcRenderer.invoke('settings:setApiKey', key),
});
