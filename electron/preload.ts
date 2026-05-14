import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    setAlwaysOnTop: (isAlwaysOnTop: boolean) => ipcRenderer.send('window-set-always-on-top', isAlwaysOnTop),
    onCloseRequested: (callback: () => void) => ipcRenderer.on('window-close-requested', callback),
    cancelClose: () => ipcRenderer.send('window-close-cancelled'),
    confirmClose: () => ipcRenderer.send('window-close-confirmed'),
  },
  notifyShellReady: () => {
    ipcRenderer.send('shell-ready')
  },
  store: {
    get: (key: string) => ipcRenderer.invoke('store-get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store-set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store-delete', key),
    clear: () => ipcRenderer.invoke('store-clear'),
  },
  storeSync: {
    get: (key: string) => ipcRenderer.sendSync('store-get-sync', key),
    set: (key: string, value: string) => ipcRenderer.sendSync('store-set-sync', key, value),
  },
  dataPath: {
    getDefault: () => ipcRenderer.invoke('data-get-default-path'),
    getCurrent: () => ipcRenderer.invoke('data-get-current-path'),
    set: (newPath: string) => ipcRenderer.invoke('data-set-path', newPath),
    reset: () => ipcRenderer.invoke('data-reset-path'),
  },
  dialog: {
    openFile: (options?: Record<string, unknown>) => ipcRenderer.invoke('dialog-openFile', options),
    saveFile: (options?: Record<string, unknown>) => ipcRenderer.invoke('dialog-saveFile', options),
    selectFolder: (options?: { title?: string; message?: string }) =>
      ipcRenderer.invoke('dialog-select-folder', options),
  },
  file: {
    writeDataUrlToFile: (filePath: string, dataUrl: string) =>
      ipcRenderer.invoke('write-data-url-to-file', filePath, dataUrl),
    writeDataUrlsToDirectory: (dirPath: string, files: { fileName: string; dataUrl: string }[]) =>
      ipcRenderer.invoke('write-data-urls-to-directory', dirPath, files),
    readLocalFileAsDataUrl: (fileUrl: string) =>
      ipcRenderer.invoke('read-local-file-as-data-url', fileUrl),
    copyFile: (srcPath: string, destPath: string) =>
      ipcRenderer.invoke('file-copy', srcPath, destPath),
    readTextFile: (filePath: string) =>
      ipcRenderer.invoke('file-read-text', filePath),
  },
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell-open-path', path),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app-getVersion'),
    getPath: (name: string) => ipcRenderer.invoke('app-getPath', name),
    getResourcePath: (resourcePath: string) => ipcRenderer.invoke('get-resource-path', resourcePath),
  },
  project: {
    create: (projectData: { id: string; name: string; type?: 'creative' | 'canvas'; description?: string }) => 
      ipcRenderer.invoke('project-create', projectData),
    getPath: (projectId: string, projectName: string, projectType?: 'creative' | 'canvas') => 
      ipcRenderer.invoke('project-get-path', projectId, projectName, projectType),
    load: (projectId: string, projectName: string) => 
      ipcRenderer.invoke('project-load', projectId, projectName),
    saveData: (projectId: string, projectName: string, dataType: string, data: unknown) => 
      ipcRenderer.invoke('project-save-data', projectId, projectName, dataType, data),
    list: () => ipcRenderer.invoke('project-list'),
    listCanvas: () => ipcRenderer.invoke('project-list-canvas'),
    delete: (projectId: string, projectName: string, fromRecycleBin: boolean = false, projectType?: 'creative' | 'canvas') =>
      ipcRenderer.invoke('project-delete', projectId, projectName, fromRecycleBin, projectType),
    moveToRecycleBin: (projectId: string, projectName: string, projectType?: 'creative' | 'canvas') =>
      ipcRenderer.invoke('project-move-to-recycle-bin', projectId, projectName, projectType),
    restoreFromRecycleBin: (projectId: string, projectName: string, projectType?: 'creative' | 'canvas') => 
      ipcRenderer.invoke('project-restore-from-recycle-bin', projectId, projectName, projectType),
    listRecycleBin: () => ipcRenderer.invoke('project-list-recycle-bin'),
    rename: (projectId: string, oldName: string, newName: string) => 
      ipcRenderer.invoke('project-rename', projectId, oldName, newName),
    clearData: (projectId: string, projectName: string) => 
      ipcRenderer.invoke('project-clear-data', projectId, projectName),
    saveImage: (
      projectId: string,
      projectName: string,
      category: string,
      fileName: string,
      imageData: string,
      projectType?: 'creative' | 'canvas'
    ) => ipcRenderer.invoke('project-save-image', projectId, projectName, category, fileName, imageData, projectType),
    loadImage: (
      projectId: string,
      projectName: string,
      category: string,
      fileName: string,
      projectType?: 'creative' | 'canvas'
    ) => ipcRenderer.invoke('project-load-image', projectId, projectName, category, fileName, projectType),
    saveVideo: (
      projectId: string,
      projectName: string,
      fileName: string,
      videoData: string,
      projectType?: 'creative' | 'canvas'
    ) => ipcRenderer.invoke('project-save-video', projectId, projectName, fileName, videoData, projectType),
    saveLocalVideo: (projectId: string, projectName: string, fileName: string, fileData: string) =>
      ipcRenderer.invoke('project-save-local-video', projectId, projectName, fileName, fileData),
    loadVideo: (projectId: string, projectName: string, fileName: string) =>
      ipcRenderer.invoke('project-load-video', projectId, projectName, fileName),
    export: (projectId: string, projectName: string) => 
      ipcRenderer.invoke('project-export', projectId, projectName),
    import: () => ipcRenderer.invoke('project-import'),
  },
  log: {
    info: (...args: unknown[]) => ipcRenderer.send('log-info', ...args),
    warn: (...args: unknown[]) => ipcRenderer.send('log-warn', ...args),
    error: (...args: unknown[]) => ipcRenderer.send('log-error', ...args),
    debug: (...args: unknown[]) => ipcRenderer.send('log-debug', ...args),
  },
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    getCurrentVersion: () => ipcRenderer.invoke('get-current-version'),
    getUpdateLogs: () => ipcRenderer.invoke('get-update-logs'),
    setOssConfig: (config: OssConfig) => ipcRenderer.invoke('set-oss-config', config),
    getOssConfig: () => ipcRenderer.invoke('get-oss-config'),
    onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => callback(status)
      ipcRenderer.on('update-status', listener)
      return () => ipcRenderer.removeListener('update-status', listener)
    },
  },
  exportToJianYing: (options: { draftPath: string; projectName: string; videoUrls: string[]; videoDurations: number[] }) =>
    ipcRenderer.invoke('export-to-jianying', options),
  canvasSaveSnapshot: (projectId: string, projectName: string, snapshot: any) =>
    ipcRenderer.invoke('canvas-save-snapshot', projectId, projectName, snapshot),
  canvasLoadSnapshot: (projectId: string, projectName: string) =>
    ipcRenderer.invoke('canvas-load-snapshot', projectId, projectName),
  canvasListSnapshots: (projectId: string, projectName: string) =>
    ipcRenderer.invoke('canvas-list-snapshots', projectId, projectName),
  canvasSaveNamedSnapshot: (projectId: string, projectName: string, snapshotId: string, snapshot: any) =>
    ipcRenderer.invoke('canvas-save-named-snapshot', projectId, projectName, snapshotId, snapshot),
  canvasLoadNamedSnapshot: (projectId: string, projectName: string, snapshotId: string) =>
    ipcRenderer.invoke('canvas-load-named-snapshot', projectId, projectName, snapshotId),
  flow2api: {
    start: (port?: number) => ipcRenderer.invoke('flow2api-start', port),
    stop: () => ipcRenderer.invoke('flow2api-stop'),
    isRunning: () => ipcRenderer.invoke('flow2api-isRunning'),
  },
  upscayl: {
    upscaleImage: (options: UpscaleOptions) => ipcRenderer.invoke('upscayl-upscale', options),
    cancelUpscale: () => ipcRenderer.invoke('upscayl-cancel'),
    getAvailableModels: () => ipcRenderer.invoke('upscayl-get-models'),
    checkAvailable: () => ipcRenderer.invoke('upscayl-check-available'),
    onProgress: (callback: (data: UpscaleProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: UpscaleProgress) => callback(data)
      ipcRenderer.on('upscayl-progress', listener)
      return () => ipcRenderer.removeListener('upscayl-progress', listener)
    },
  },
}

interface UpscaleOptions {
  inputPath: string
  outputPath: string
  model: string
  scale?: string
  gpuId?: string
  format?: 'png' | 'jpg' | 'webp'
  tileSize?: number
  compression?: string
  ttaMode?: boolean
  customWidth?: string
}

interface UpscaleProgress {
  type: string
  message?: string
  progress?: number
  outputPath?: string
}

interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  buildNumber?: number
  releaseDate?: string
  releaseNotes?: string
  percent?: number
  bytesPerSecond?: number
  transferred?: number
  total?: number
  message?: string
  downloadUrl?: string
}

interface UpdateVersionInfo {
  version: string
  buildNumber: number
  releaseDate: string
  releaseNotes: string
  downloadUrl: string
  checksum: string
}

interface OssConfig {
  ossEndpoint: string
  ossVersionPath: string
  ossAccessKeyId?: string
  ossAccessKeySecret?: string
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
