import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('hanterm', {
  // PTY
  createPty: (panelId: string, cwd?: string) => ipcRenderer.invoke('pty-create', panelId, cwd),
  writePty: (panelId: string, data: string) => ipcRenderer.send('pty-write', panelId, data),
  resizePty: (panelId: string, cols: number, rows: number) => ipcRenderer.send('pty-resize', panelId, cols, rows),
  killPty: (panelId: string) => ipcRenderer.invoke('pty-kill', panelId),

  // Events
  onPtyData: (callback: (panelId: string, data: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, panelId: string, data: string) => callback(panelId, data);
    ipcRenderer.on('pty-data', handler);
    return () => ipcRenderer.removeListener('pty-data', handler);
  },
  onPtyExit: (callback: (panelId: string, exitCode: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, panelId: string, exitCode: number) => callback(panelId, exitCode);
    ipcRenderer.on('pty-exit', handler);
    return () => ipcRenderer.removeListener('pty-exit', handler);
  },
  onInitConfig: (callback: (config: { layout: string; theme: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, config: { layout: string; theme: string }) => callback(config);
    ipcRenderer.on('init-config', handler);
    return () => ipcRenderer.removeListener('init-config', handler);
  },

  // Clipboard
  checkClipboardImage: () => ipcRenderer.invoke('clipboard-check-image'),
  saveClipboardImage: () => ipcRenderer.invoke('clipboard-save-image'),

  // PTY info
  getPtyCwd: (panelId: string) => ipcRenderer.invoke('pty-get-cwd', panelId),

  // Bookmarks
  saveBookmark: (bookmark: { id: string; name: string; cwd: string; content: string; createdAt: string }) =>
    ipcRenderer.invoke('bookmark-save', bookmark),
  listBookmarks: () => ipcRenderer.invoke('bookmark-list'),
  deleteBookmark: (id: string) => ipcRenderer.invoke('bookmark-delete', id),
});
