const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('vrlink', {
  navigate: (value) => ipcRenderer.invoke('browser:navigate', value),
  back: () => ipcRenderer.invoke('browser:back'),
  forward: () => ipcRenderer.invoke('browser:forward'),
  reload: () => ipcRenderer.invoke('browser:reload'),
  home: () => ipcRenderer.invoke('browser:home'),
  copy: (url) => ipcRenderer.invoke('browser:copy-media', url),
  openVRChat: (url) => ipcRenderer.invoke('browser:open-vrchat', url),
  onState: (callback) => ipcRenderer.on('browser:state', (_event, state) => callback(state)),
  onError: (callback) => ipcRenderer.on('browser:error', (_event, state) => callback(state))
});
