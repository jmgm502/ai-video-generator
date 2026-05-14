/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  electronAPI: {
    window: {
      minimize: () => void
      maximize: () => void
      close: () => void
      isMaximized: () => Promise<boolean>
      setAlwaysOnTop: (flag: boolean) => void
      onCloseRequested: (callback: () => void) => void
      cancelClose: () => void
      confirmClose: () => void
    }
    store: {
      get: (key: string) => Promise<unknown>
      set: (key: string, value: unknown) => Promise<boolean>
      delete: (key: string) => Promise<boolean>
      clear: () => Promise<boolean>
    }
    storeSync?: {
      get: (key: string) => string | null
      set: (key: string, value: string) => boolean
    }
    dialog: {
      openFile: (options?: Record<string, unknown>) => Promise<{ canceled: boolean; filePaths: string[] }>
      saveFile: (options?: Record<string, unknown>) => Promise<{ canceled: boolean; filePath: string }>
      selectFolder: (options?: { title?: string; message?: string }) => Promise<{ canceled: boolean; filePaths: string[] }>
    }
    file?: {
      writeDataUrlToFile: (filePath: string, dataUrl: string) => Promise<{ success: boolean; message?: string }>
      writeDataUrlsToDirectory: (
        dirPath: string,
        files: Array<{ fileName: string; dataUrl: string }>
      ) => Promise<{ success: boolean; message?: string; count?: number }>
      readLocalFileAsDataUrl: (
        fileUrl: string
      ) => Promise<{ success: boolean; data?: string; message?: string }>
      copyFile: (srcPath: string, destPath: string) => Promise<{ success: boolean; message?: string }>
    }
    upscayl?: {
      upscaleImage: (options: {
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
      }) => Promise<{ success: boolean; outputPath?: string; message?: string }>
      cancelUpscale: () => Promise<{ success: boolean; message?: string }>
      getAvailableModels: () => Promise<Array<{ id: string; name: string; description: string; scale: string }>>
      checkAvailable: () => Promise<boolean>
      onProgress: (callback: (data: { type: string; message?: string; progress?: number; outputPath?: string }) => void) => () => void
    }
    app: {
      getVersion: () => Promise<string>
      getPath: (name: string) => Promise<string>
    }
    dataPath: {
      getCurrent: () => Promise<string>
      getDefault: () => Promise<string>
      set: (path: string) => Promise<{ success: boolean; message: string }>
      reset: () => Promise<{ success: boolean; message: string }>
    }
    shell: {
      openExternal: (url: string) => Promise<void>
      openPath: (path: string) => Promise<string>
    }
    updater: {
      checkForUpdates: () => Promise<{ success: boolean; message?: string }>
      downloadUpdate: () => Promise<{ success: boolean; message?: string }>
      installUpdate: () => void
      getCurrentVersion: () => Promise<{ version: string; buildNumber: number }>
      getUpdateLogs: () => Promise<Array<{ version: string; date: string; notes: string }>>
      setOssConfig: (config: any) => Promise<void>
      getOssConfig: () => Promise<any>
      onUpdateStatus: (callback: (status: any) => void) => () => void
    }
    project?: {
      create: (projectData: { id: string; name: string; type?: 'creative' | 'canvas'; description?: string }) =>
        Promise<{ success: boolean; path?: string; message?: string }>
      getPath: (projectId: string, projectName: string) => Promise<string>
      load: (projectId: string, projectName: string) =>
        Promise<{ success: boolean; data?: any; message?: string }>
      saveData: (projectId: string, projectName: string, dataType: string, data: unknown) =>
        Promise<{ success: boolean; message?: string }>
      list: () => Promise<{ success: boolean; projects?: any[]; message?: string }>
      listCanvas: () => Promise<{ success: boolean; projects?: any[]; message?: string }>
      delete: (projectId: string, projectName: string, fromRecycleBin?: boolean, projectType?: 'creative' | 'canvas') =>
        Promise<{ success: boolean; message?: string }>
      moveToRecycleBin: (projectId: string, projectName: string, projectType?: 'creative' | 'canvas') =>
        Promise<{ success: boolean; message?: string }>
      restoreFromRecycleBin: (projectId: string, projectName: string) =>
        Promise<{ success: boolean; message?: string }>
      listRecycleBin: () => Promise<{ success: boolean; projects?: any[]; message?: string }>
      rename: (projectId: string, oldName: string, newName: string) =>
        Promise<{ success: boolean; newPath?: string; message?: string }>
      clearData: (projectId: string, projectName: string) =>
        Promise<{ success: boolean; message?: string }>
      saveImage: (
        projectId: string,
        projectName: string,
        category: string,
        fileName: string,
        imageData: string,
        projectType?: 'creative' | 'canvas'
      ) => Promise<{ success: boolean; path?: string; message?: string }>
      loadImage: (
        projectId: string,
        projectName: string,
        category: string,
        fileName: string,
        projectType?: 'creative' | 'canvas'
      ) => Promise<{ success: boolean; data?: string; message?: string }>
      saveVideo: (
        projectId: string,
        projectName: string,
        fileName: string,
        videoData: string,
        projectType?: 'creative' | 'canvas'
      ) => Promise<{ success: boolean; path?: string; message?: string }>
      saveLocalVideo: (projectId: string, projectName: string, fileName: string, fileData: string) =>
        Promise<{ success: boolean; path?: string; message?: string }>
      loadVideo: (projectId: string, projectName: string, fileName: string) =>
        Promise<{ success: boolean; data?: string; message?: string }>
      export: (projectId: string, projectName: string) =>
        Promise<{ success: boolean; path?: string; message?: string }>
      import: () => Promise<{ success: boolean; project?: any; message?: string }>
    }
    log?: {
      info: (...args: unknown[]) => void
      warn: (...args: unknown[]) => void
      error: (...args: unknown[]) => void
      debug: (...args: unknown[]) => void
    }
    exportToJianYing?: (options: {
      draftPath: string
      projectName: string
      videoUrls: string[]
      videoDurations: number[]
    }) => Promise<{ success: boolean; message?: string }>
    /** 打包后由渲染进程在首屏就绪时调用，主进程再执行 BrowserWindow.show，减少黑屏时间 */
    notifyShellReady?: () => void
    canvasSaveSnapshot?: (projectId: string, projectName: string, snapshot: any) => Promise<{ success: boolean; message?: string }>
    canvasLoadSnapshot?: (projectId: string, projectName: string) => Promise<{ success: boolean; snapshot?: any; message?: string }>
    canvasListSnapshots?: (projectId: string, projectName: string) => Promise<{ success: boolean; snapshots?: any[]; message?: string }>
    canvasSaveNamedSnapshot?: (projectId: string, projectName: string, snapshotId: string, snapshot: any) => Promise<{ success: boolean; message?: string }>
    canvasLoadNamedSnapshot?: (projectId: string, projectName: string, snapshotId: string) => Promise<{ success: boolean; snapshot?: any; message?: string }>
  }
}
