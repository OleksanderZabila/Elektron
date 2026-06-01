import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  startAgent: () => ipcRenderer.invoke('agent:start'),
  cancelAgent: () => ipcRenderer.invoke('agent:cancel'),
  onAgentEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('agent:event', handler);
    return () => ipcRenderer.removeListener('agent:event', handler);
  },
});
