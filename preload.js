const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pt', {
  sendState: (s) => ipcRenderer.send('state', s),
  onState: (cb) => ipcRenderer.on('state', (e, s) => cb(s)),
  openOutput: (displayId) => ipcRenderer.send('open-output', displayId),
  sendToDisplay: (displayId) => ipcRenderer.send('send-to-display', displayId),
  closeOutput: () => ipcRenderer.send('close-output'),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  exitFullscreen: () => ipcRenderer.send('exit-fullscreen'),
  setOnTop: (flag) => ipcRenderer.send('ctl-on-top', flag),
  getDisplays: () => ipcRenderer.invoke('displays'),
  isOutputOpen: () => ipcRenderer.invoke('output-open'),
  getNetworkInfo: () => ipcRenderer.invoke('network-info'),
  onDisplays: (cb) => ipcRenderer.on('displays', (e, list) => cb(list)),
  onOutputState: (cb) => ipcRenderer.on('output-state', (e, open) => cb(open)),
  onNetworkInfo: (cb) => ipcRenderer.on('network-info', (e, info) => cb(info)),
  onRemoteCmd: (cb) => ipcRenderer.on('remote-cmd', (e, cmd) => cb(cmd))
});
