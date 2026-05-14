import { app, BrowserWindow, ipcMain, shell, dialog, net } from 'electron'
import { join } from 'path'
import { app as electronApp } from 'electron'
import { pathToFileURL } from 'url'
import Store from 'electron-store'
import log from 'electron-log'
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, writeFileSync, readFileSync, writeFile } from 'fs'
import { dirname } from 'path'
import { updateService, VersionInfo } from './updateService'
import { setupUpdaterIPC, updaterManager } from './updaterManager'

log.transports.file.level = 'info'
log.transports.console.level = 'debug'
log.transports.file.encoding = 'utf-8'

log.transports.file.fileName = 'main.log'
log.transports.file.maxSize = 5 * 1024 * 1024

log.info('='.repeat(50))
log.info('')
log.info('='.repeat(50))

let mainWindow: BrowserWindow | null = null

const settingsStore = new Store({ name: 'settings' })

function getStorePath(): string {
  const customDataPath = settingsStore.get('customDataPath') as string | undefined
  if (customDataPath && existsSync(customDataPath)) {
    return customDataPath
  }
  return electronApp.getPath('userData')
}

function createStore(): Store {
  const storePath = getStorePath()
  log.info(':', storePath)

  return new Store({
    cwd: storePath !== electronApp.getPath('userData') ? storePath : undefined
  })
}

let store = createStore()
const isDev = !app.isPackaged

function getDefaultDataPath(): string {
  return electronApp.getPath('userData')
}

function getDataPath(): string {
  return getStorePath()
}

function setDataPath(newPath: string): { success: boolean; message: string } {
  try {
    if (!existsSync(newPath)) {
      mkdirSync(newPath, { recursive: true })
    }

    const testFile = join(newPath, '.test_write')
    writeFileSync(testFile, 'test')
    existsSync(testFile) && require('fs').unlinkSync(testFile)

    const oldPath = getStorePath()
    const oldConfigFile = join(oldPath, 'config.json')
    const newConfigFile = join(newPath, 'config.json')

    if (existsSync(oldConfigFile) && oldPath !== newPath) {
      copyFileSync(oldConfigFile, newConfigFile)
      log.info(':', newPath)
    }

    settingsStore.set('customDataPath', newPath)
    store = new Store({ cwd: newPath })

    log.info(':', newPath)

    return { success: true, message: '' }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
}

function resetDataPath(): { success: boolean; message: string } {
  try {
    settingsStore.delete('customDataPath')
    store = new Store()
    log.info('')
    return { success: true, message: '' }
  } catch (error) {
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
}

function setupUpdateService(): void {
  log.info('...')
  updateService.setOssConfig({
    region: 'oss-cn-hangzhou',
    bucket: 'your-bucket',
    accessKeyId: '',
    accessKeySecret: ''
  })
  checkForOssUpdate()
}

function checkForOssUpdate(): void {
  const ossEndpoint = settingsStore.get('ossEndpoint') as string
  const ossVersionPath = settingsStore.get('ossVersionPath') as string

  if (!ossEndpoint || !ossVersionPath) {
    log.info('OSS')
    return
  }

  log.info('OSS...')
  mainWindow?.webContents.send('update-status', { status: 'checking' })

  updateService.checkForUpdate(ossEndpoint, ossVersionPath).then(result => {
    if (result.hasUpdate && result.versionInfo) {
      log.info(':', result.versionInfo.version)
      mainWindow?.webContents.send('update-status', {
        status: 'available',
        version: result.versionInfo.version,
        buildNumber: result.versionInfo.buildNumber,
        releaseDate: result.versionInfo.releaseDate,
        releaseNotes: result.versionInfo.releaseNotes,
        downloadUrl: result.versionInfo.downloadUrl
      })
    } else if (!result.hasUpdate) {
      log.info('')
      mainWindow?.webContents.send('update-status', { status: 'not-available' })
    } else if (result.error) {
      log.error(':', result.error)
      mainWindow?.webContents.send('update-status', { status: 'error', message: result.error })
    }
  })
}

function createWindow(): void {
  log.info('...')

  mainWindow = new BrowserWindow({
    width: 1350,
    height: 860,
    minWidth: 1350,
    minheight: 860,
    show: false,
    frame: false,
    backgroundColor: '#0d0d0d',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    log.info('')
  })

  mainWindow.on('close', (event) => {
    if (mainWindow?.isDestroyed()) return

    event.preventDefault()
    mainWindow.webContents.send('window-close-requested')
  })

  ipcMain.on('window-close-cancelled', () => {
    log.info('')
  })

  ipcMain.on('window-close-confirmed', () => {
    log.info('')
    mainWindow?.destroy()
  })

  mainWindow.on('closed', () => {
    log.info('')
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    log.info(':', details.url)
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev) {
    const url = process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173'
    log.info('URL:', url)
    mainWindow.loadURL(url)
    mainWindow.webContents.openDevTools()
  } else {
    log.info('')
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  log.info('')

  // OSS
  updateService.setOssConfig({
    region: 'oss-cn-beijing',
    bucket: 'xingmengai',
    accessKeyId: 'LTAI5tHuESQ1X4zMyKdZrL1e',
    accessKeySecret: 'jY4NCG7baZwbHGLbuRIkirJsCpr4Hs'
  })

  //
  createWindow()

  //  IPC
  setupUpdaterIPC(mainWindow!)

  // 2
  if (!isDev) {
    setTimeout(() => {
      log.info('...')
      updaterManager.checkForUpdates()
    }, 2000)
  }

  app.on('activate', () => {
    log.info('')
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch((error) => {
  log.error(':', error)
})

async function performUpdateBeforeLaunch(): Promise<boolean> {
  const apiUrl = 'https://xmdm.ussn.cn/version?action=check'

  log.info('...')

  try {
    const result = await updateService.checkForUpdateViaApi(apiUrl)

    if (result.hasUpdate && result.versionInfo) {
      log.info(`: ${result.versionInfo.version}...`)

      //
      const downloadResult = await updateService.downloadUpdate(result.versionInfo, (progress) => {
        log.info(`[] ${progress.percent.toFixed(1)}% (${progress.transferred}/${progress.total})`)
      })

      if (downloadResult.success && downloadResult.filePath) {
        log.info('...')

        //
        const extractResult = await updateService.extractUpdate(downloadResult.filePath, app.getAppPath())

        if (extractResult.success) {
          log.info('')
          return true
        }
      }
    } else {
      log.info('')
    }
  } catch (error) {
    log.error('/:', error)
  }

  return false
}

app.on('window-all-closed', () => {
  log.info('')
  if (process.platform !== 'darwin') {
    log.info('')
    app.quit()
  }
})

app.on('before-quit', () => {
  log.info('')
})

ipcMain.on('window-minimize', () => {
  log.debug('')
  mainWindow?.minimize()
})

ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    log.debug('')
    mainWindow.unmaximize()
  } else {
    log.debug('')
    mainWindow?.maximize()
  }
})

ipcMain.on('window-close', () => {
  log.debug('')
  if (!mainWindow) return
  mainWindow.webContents.send('window-close-requested')
})

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() ?? false
})

ipcMain.on('window-set-always-on-top', (_event, isAlwaysOnTop: boolean) => {
  log.debug(':', isAlwaysOnTop)
  mainWindow?.setAlwaysOnTop(isAlwaysOnTop)
})

ipcMain.handle('store-get', async (_event, key: string) => {
  log.debug('Store:', key)
  return store.get(key)
})

ipcMain.handle('store-set', async (_event, key: string, value: unknown) => {
  log.debug('Store:', key)
  store.set(key, value)
})

ipcMain.handle('store-delete', async (_event, key: string) => {
  log.debug('Store:', key)
  store.delete(key)
})

ipcMain.handle('store-clear', async () => {
  log.info('Store')
  store.clear()
})

ipcMain.on('store-get-sync', (event, key: string) => {
  log.debug('Store:', key, ':', getStorePath())
  event.returnValue = store.get(key)
})

ipcMain.on('store-set-sync', (event, key: string, value: unknown) => {
  log.debug('Store:', key, ':', getStorePath())
  store.set(key, value)
  event.returnValue = true
})

ipcMain.on('log-info', (_event, ...args) => {
  log.info('[]', ...args)
})

ipcMain.on('log-warn', (_event, ...args) => {
  log.warn('[]', ...args)
})

ipcMain.on('log-error', (_event, ...args) => {
  log.error('[]', ...args)
})

ipcMain.on('log-debug', (_event, ...args) => {
  log.debug('[]', ...args)
})

ipcMain.handle('data-get-default-path', () => {
  return getDefaultDataPath()
})

ipcMain.handle('data-get-current-path', () => {
  return getDataPath()
})

ipcMain.handle('data-set-path', async (_event, newPath: string) => {
  return setDataPath(newPath)
})

ipcMain.handle('data-reset-path', async () => {
  return resetDataPath()
})

ipcMain.handle('dialog-select-folder', async (_event, options?: { title?: string; message?: string }) => {
  if (!mainWindow) return { canceled: true, filePaths: [] }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: options?.title ?? '选择数据存储位置',
    message: options?.message ?? '选择一个文件夹来存储项目数据',
    properties: ['openDirectory', 'createDirectory']
  })

  return result
})

function bufferFromImageDataUrl(imageData: string): Buffer {
  if (!imageData.startsWith('data:')) {
    throw new Error('仅支持 data URL 格式的图片')
  }
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
  return Buffer.from(base64Data, 'base64')
}

ipcMain.handle('write-data-url-to-file', async (_event, filePath: string, dataUrl: string) => {
  try {
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const buffer = bufferFromImageDataUrl(dataUrl)
    writeFileSync(filePath, buffer)
    return { success: true as const }
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存失败'
    log.error('write-data-url-to-file:', message)
    return { success: false as const, message }
  }
})

ipcMain.handle(
  'write-data-urls-to-directory',
  async (_event, dirPath: string, files: { fileName: string; dataUrl: string }[]) => {
    try {
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true })
      }
      for (const f of files) {
        const safe =
          f.fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'image.png'
        const fp = join(dirPath, safe)
        const buffer = bufferFromImageDataUrl(f.dataUrl)
        writeFileSync(fp, buffer)
      }
      return { success: true as const, count: files.length }
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败'
      log.error('write-data-urls-to-directory:', message)
      return { success: false as const, message }
    }
  }
)

ipcMain.handle('shell-open-path', async (_event, path: string) => {
  log.info(':', path)
  return shell.openPath(path)
})

function getProjectsPath(): string {
  const storePath = getStorePath()
  const projectsPath = join(storePath, 'projects')
  if (!existsSync(projectsPath)) {
    mkdirSync(projectsPath, { recursive: true })
  }
  return projectsPath
}

function getCanvasProjectsPath(): string {
  const storePath = getStorePath()
  const canvasProjectsPath = join(storePath, 'projects-huabu')
  if (!existsSync(canvasProjectsPath)) {
    mkdirSync(canvasProjectsPath, { recursive: true })
  }
  return canvasProjectsPath
}

function getRecycleBinPath(): string {
  const storePath = getStorePath()
  const recycleBinPath = join(storePath, 'recycle-bin')
  if (!existsSync(recycleBinPath)) {
    mkdirSync(recycleBinPath, { recursive: true })
  }
  return recycleBinPath
}

function getProjectPath(projectId: string, projectName: string, projectType?: 'creative' | 'canvas'): string {
  const projectsPath = projectType === 'canvas' ? getCanvasProjectsPath() : getProjectsPath()
  const safeName = projectName.replace(/[<>:"/\\|?*]/g, '_')
  const projectPath = join(projectsPath, `${projectId}_${safeName}`)
  return projectPath
}

function getRecycleBinProjectPath(projectId: string, projectName: string): string {
  const recycleBinPath = getRecycleBinPath()
  const safeName = projectName.replace(/[<>:"/\\|?*]/g, '_')
  const projectPath = join(recycleBinPath, `${projectId}_${safeName}`)
  return projectPath
}

function createProjectFolders(projectPath: string): void {
  const folders = [
    projectPath,
    join(projectPath, 'assets'),
    join(projectPath, 'assets', 'characters'),
    join(projectPath, 'assets', 'scenes'),
    join(projectPath, 'assets', 'props'),
    join(projectPath, 'storyboards'),
    join(projectPath, 'videos')
  ]

  folders.forEach(folder => {
    if (!existsSync(folder)) {
      mkdirSync(folder, { recursive: true })
    }
  })
}

ipcMain.handle('project-create', async (_event, projectData: { id: string; name: string; type?: 'creative' | 'canvas'; description?: string }) => {
  try {
    const projectPath = getProjectPath(projectData.id, projectData.name, projectData.type)

    if (existsSync(projectPath)) {
      return { success: false, message: '' }
    }

    createProjectFolders(projectPath)

    const projectJson = {
      id: projectData.id,
      name: projectData.name,
      type: projectData.type || 'creative',
      description: projectData.description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    writeFileSync(join(projectPath, 'project.json'), JSON.stringify(projectJson, null, 2))
    writeFileSync(join(projectPath, 'assets.json'), JSON.stringify([], null, 2))
    writeFileSync(join(projectPath, 'storyboard.json'), JSON.stringify([], null, 2))
    writeFileSync(join(projectPath, 'novel.json'), JSON.stringify({ content: '' }, null, 2))

    log.info(':', projectPath)
    return { success: true, path: projectPath }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('project-get-path', async (_event, projectId: string, projectName: string) => {
  return getProjectPath(projectId, projectName)
})

ipcMain.handle('project-load', async (_event, projectId: string, projectName: string) => {
  try {
    const projectPath = getProjectPath(projectId, projectName)
    const projectFile = join(projectPath, 'project.json')
    const assetsFile = join(projectPath, 'assets.json')
    const storyboardFile = join(projectPath, 'storyboard.json')
    const novelFile = join(projectPath, 'novel.json')

    if (!existsSync(projectFile)) {
      return { success: false, message: '' }
    }

    const projectData = JSON.parse(readFileSync(projectFile, 'utf-8'))
    const assetsData = existsSync(assetsFile) ? JSON.parse(readFileSync(assetsFile, 'utf-8')) : []
    const storyboardData = existsSync(storyboardFile) ? JSON.parse(readFileSync(storyboardFile, 'utf-8')) : []
    const novelData = existsSync(novelFile) ? JSON.parse(readFileSync(novelFile, 'utf-8')) : null

    return {
      success: true,
      data: {
        project: projectData,
        assets: assetsData,
        storyboard: storyboardData,
        novelContent: novelData?.content || ''
      }
    }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('project-save-data', async (_event, projectId: string, projectName: string, dataType: string, data: unknown) => {
  try {
    const projectPath = getProjectPath(projectId, projectName)

    if (!existsSync(projectPath)) {
      createProjectFolders(projectPath)
    }

    const fileName = dataType === 'project' ? 'project.json' :
                     dataType === 'assets' ? 'assets.json' :
                     dataType === 'storyboard' ? 'storyboard.json' : null

    if (!fileName) {
      return { success: false, message: '' }
    }

    const filePath = join(projectPath, fileName)

    console.log('[Electron] project-save-data:', { projectId, projectName, dataType, filePath, dataLength: Array.isArray(data) ? data.length : 'not array' })

    if (dataType === 'project') {
      const existingData = existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf-8')) : {}
      data = { ...existingData, ...data, updatedAt: new Date().toISOString() }
    }

    writeFileSync(filePath, JSON.stringify(data, null, 2))
    log.info(':', fileName)

    const savedContent = readFileSync(filePath, 'utf-8')
    console.log('[Electron] :', savedContent.length, '100:', savedContent.substring(0, 100))

    return { success: true }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('project-list', async () => {
  try {
    const projectsPath = getProjectsPath()
    const projects: Array<{ id: string; name: string; type: 'creative' | 'canvas'; path: string; createdAt: string; updatedAt: string }> = []

    const dirs = readdirSync(projectsPath)

    for (const dir of dirs) {
      const projectPath = join(projectsPath, dir)
      const stat = statSync(projectPath)

      if (stat.isDirectory()) {
        const projectFile = join(projectPath, 'project.json')
        if (existsSync(projectFile)) {
          try {
            const projectData = JSON.parse(readFileSync(projectFile, 'utf-8'))

            let projectName = projectData.name
            if (!projectName) {
              const match = dir.match(/^proj_\d+_(.+)$/)
              projectName = match ? match[1] : dir

              projectData.name = projectName
              writeFileSync(projectFile, JSON.stringify(projectData, null, 2))
              log.info(':', projectName)
            }

            projects.push({
              id: projectData.id,
              name: projectName,
              type: projectData.type || 'creative',
              path: projectPath,
              createdAt: projectData.createdAt,
              updatedAt: projectData.updatedAt
            })
          } catch (e) {
            log.warn(':', projectFile, e)
          }
        }
      }
    }

ipcMain.handle('project-list-canvas', async () => {
  try {
    const projectsPath = getCanvasProjectsPath()
    const projects: Array<{ id: string; name: string; type: 'creative' | 'canvas'; path: string; createdAt: string; updatedAt: string }> = []

    if (!existsSync(projectsPath)) {
      return { success: true, projects }
    }

    const dirs = readdirSync(projectsPath)

    for (const dir of dirs) {
      const projectPath = join(projectsPath, dir)
      const stat = statSync(projectPath)

      if (stat.isDirectory()) {
        const projectFile = join(projectPath, 'project.json')
        if (existsSync(projectFile)) {
          try {
            const projectData = JSON.parse(readFileSync(projectFile, 'utf-8'))

            let projectName = projectData.name
            if (!projectName) {
              const match = dir.match(/^proj_\d+_(.+)$/)
              projectName = match ? match[1] : dir

              projectData.name = projectName
              writeFileSync(projectFile, JSON.stringify(projectData, null, 2))
              log.info(':', projectName)
            }

            projects.push({
              id: projectData.id,
              name: projectName,
              type: projectData.type || 'canvas',
              path: projectPath,
              createdAt: projectData.createdAt,
              updatedAt: projectData.updatedAt
            })
          } catch (e) {
            log.warn(':', projectFile, e)
          }
        }
      }
    }

    return { success: true, projects }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('project-delete', async (_event, projectId: string, projectName: string, fromRecycleBin: boolean = false, projectType?: 'creative' | 'canvas') => {
  try {
    const projectPath = fromRecycleBin
      ? getRecycleBinProjectPath(projectId, projectName)
      : getProjectPath(projectId, projectName, projectType)

    if (!existsSync(projectPath)) {
      return { success: false, message: '' }
    }

    const fs = require('fs')
    fs.rmSync(projectPath, { recursive: true, force: true })

    log.info(':', projectPath)
    return { success: true }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('project-move-to-recycle-bin', async (_event, projectId: string, projectName: string, projectType?: 'creative' | 'canvas') => {
  try {
    const projectPath = getProjectPath(projectId, projectName, projectType)
    const recycleBinPath = getRecycleBinProjectPath(projectId, projectName)

    if (!existsSync(projectPath)) {
      return { success: false, message: '' }
    }

    if (existsSync(recycleBinPath)) {
      const fs = require('fs')
      fs.rmSync(recycleBinPath, { recursive: true, force: true })
    }

    const fs = require('fs')
    fs.renameSync(projectPath, recycleBinPath)

    log.info(':', projectPath, '->', recycleBinPath)
    return { success: true }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('project-restore-from-recycle-bin', async (_event, projectId: string, projectName: string) => {
  try {
    const recycleBinPath = getRecycleBinProjectPath(projectId, projectName)
    const projectPath = getProjectPath(projectId, projectName)

    if (!existsSync(recycleBinPath)) {
      return { success: false, message: '' }
    }

    if (existsSync(projectPath)) {
      const fs = require('fs')
      fs.rmSync(projectPath, { recursive: true, force: true })
    }

    const fs = require('fs')
    fs.renameSync(recycleBinPath, projectPath)

    log.info(':', recycleBinPath, '->', projectPath)
    return { success: true }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('project-list-recycle-bin', async () => {
  try {
    const recycleBinPath = getRecycleBinPath()
    const projects: Array<{ id: string; name: string; type: 'creative' | 'canvas'; path: string; createdAt: string; updatedAt: string }> = []

    if (!existsSync(recycleBinPath)) {
      return { success: true, projects }
    }

    const dirs = readdirSync(recycleBinPath)

    for (const dir of dirs) {
      const projectPath = join(recycleBinPath, dir)
      const stat = statSync(projectPath)

      if (stat.isDirectory()) {
        const projectFile = join(projectPath, 'project.json')
        if (existsSync(projectFile)) {
          try {
            const projectData = JSON.parse(readFileSync(projectFile, 'utf-8'))

            let projectName = projectData.name
            if (!projectName) {
              const match = dir.match(/^proj_\d+_(.+)$/)
              projectName = match ? match[1] : dir
            }

            projects.push({
              id: projectData.id || dir.split('_')[1] || '',
              name: projectName,
              type: projectData.type || 'creative',
              path: projectPath,
              createdAt: projectData.createdAt || stat.birthtime.toISOString(),
              updatedAt: projectData.updatedAt || stat.mtime.toISOString()
            })
          } catch (e) {
            log.error(':', projectFile, e)
          }
        }
      }
    }

    return { success: true, projects }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}`, projects: [] }
  }
})

ipcMain.handle('project-rename', async (_event, projectId: string, oldName: string, newName: string) => {
  try {
    const oldPath = getProjectPath(projectId, oldName)
    const newPath = getProjectPath(projectId, newName)

    if (!existsSync(oldPath)) {
      return { success: false, message: '' }
    }

    if (existsSync(newPath) && oldPath !== newPath) {
      return { success: false, message: '' }
    }

    const fs = require('fs')
    fs.renameSync(oldPath, newPath)

    const projectFile = join(newPath, 'project.json')
    if (existsSync(projectFile)) {
      const projectData = JSON.parse(readFileSync(projectFile, 'utf-8'))
      projectData.name = newName
      projectData.updatedAt = new Date().toISOString()
      writeFileSync(projectFile, JSON.stringify(projectData, null, 2))
    }

    log.info(':', oldPath, '->', newPath)
    return { success: true, newPath }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('project-clear-data', async (_event, projectId: string, projectName: string) => {
  try {
    const projectPath = getProjectPath(projectId, projectName)

    if (!existsSync(projectPath)) {
      return { success: false, message: '' }
    }

    const projectFile = join(projectPath, 'project.json')
    const storyboardFile = join(projectPath, 'storyboard.json')
    const assetsFile = join(projectPath, 'assets.json')

    if (existsSync(projectFile)) {
      const projectData = JSON.parse(readFileSync(projectFile, 'utf-8'))
      projectData.storyboards = []
      projectData.updatedAt = new Date().toISOString()
      writeFileSync(projectFile, JSON.stringify(projectData, null, 2))
    }

    if (existsSync(storyboardFile)) {
      writeFileSync(storyboardFile, JSON.stringify([], null, 2))
    }

    if (existsSync(assetsFile)) {
      writeFileSync(assetsFile, JSON.stringify({ characters: [], scenes: [], props: [] }, null, 2))
    }

    const storyboardsPath = join(projectPath, 'storyboards')
    if (existsSync(storyboardsPath)) {
      const fs = require('fs')
      const files = readdirSync(storyboardsPath)
      for (const file of files) {
        fs.unlinkSync(join(storyboardsPath, file))
      }
    }

    log.info(':', projectPath)
    return { success: true }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('project-save-image', async (_event, projectId: string, projectName: string, category: string, fileName: string, imageData: string) => {
  try {
    const projectPath = getProjectPath(projectId, projectName)

    let folderPath: string
    switch (category) {
      case 'character':
        folderPath = join(projectPath, 'assets', 'characters')
        break
      case 'scene':
        folderPath = join(projectPath, 'assets', 'scenes')
        break
      case 'prop':
        folderPath = join(projectPath, 'assets', 'props')
        break
      case 'storyboard':
        folderPath = join(projectPath, 'storyboards')
        break
      default:
        return { success: false, message: '' }
    }

    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true })
    }

    const filePath = join(folderPath, fileName)

    if (imageData.startsWith('data:')) {
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      writeFileSync(filePath, buffer)
    } else if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      log.info(':', imageData)
      const buffer = await downloadFile(imageData)
      writeFileSync(filePath, buffer)
      log.info(':', filePath)
    } else {
      copyFileSync(imageData, filePath)
    }

    log.info(':', filePath)
    return { success: true, path: filePath }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('project-load-image', async (_event, projectId: string, projectName: string, category: string, fileName: string) => {
  try {
    const projectPath = getProjectPath(projectId, projectName)

    let folderPath: string
    switch (category) {
      case 'character':
        folderPath = join(projectPath, 'assets', 'characters')
        break
      case 'scene':
        folderPath = join(projectPath, 'assets', 'scenes')
        break
      case 'prop':
        folderPath = join(projectPath, 'assets', 'props')
        break
      case 'storyboard':
        folderPath = join(projectPath, 'storyboards')
        break
      default:
        return { success: false, message: '' }
    }

    const filePath = join(folderPath, fileName)

    if (!existsSync(filePath)) {
      return { success: false, message: '' }
    }

    const buffer = require('fs').readFileSync(filePath)
    const base64 = buffer.toString('base64')
    const ext = fileName.split('.').pop()?.toLowerCase() || 'png'
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`

    return { success: true, data: `data:${mimeType};base64,${base64}` }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('project-save-video', async (_event, projectId: string, projectName: string, fileName: string, videoData: string) => {
  try {
    const projectPath = getProjectPath(projectId, projectName)
    const videosPath = join(projectPath, 'videos')

    if (!existsSync(videosPath)) {
      mkdirSync(videosPath, { recursive: true })
    }

    const filePath = join(videosPath, fileName)

    if (videoData.startsWith('data:')) {
      const base64Data = videoData.replace(/^data:video\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      writeFileSync(filePath, buffer)
    } else if (videoData.startsWith('http://') || videoData.startsWith('https://')) {
      log.info(':', videoData)
      const buffer = await downloadFile(videoData)
      writeFileSync(filePath, buffer)
      log.info(':', filePath)
    } else {
      copyFileSync(videoData, filePath)
    }

    const fileUrl = pathToFileURL(filePath).href
    log.info(':', fileUrl)
    return { success: true, path: fileUrl }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('project-save-local-video', async (_event, projectId: string, projectName: string, fileName: string, fileData: string) => {
  try {
    const projectPath = getProjectPath(projectId, projectName)
    const videosPath = join(projectPath, 'videos')

    if (!existsSync(videosPath)) {
      mkdirSync(videosPath, { recursive: true })
    }

    const filePath = join(videosPath, fileName)

    const base64Data = fileData.replace(/^data:video\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    writeFileSync(filePath, buffer)

    const fileUrl = pathToFileURL(filePath).href
    log.info(':', fileUrl)
    return { success: true, path: fileUrl }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

async function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const request = net.request(url)
    const chunks: Buffer[] = []

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        chunks.push(Buffer.from(chunk))
      })

      response.on('end', () => {
        resolve(Buffer.concat(chunks))
      })

      response.on('error', (error) => {
        reject(error)
      })
    })

    request.on('error', (error) => {
      reject(error)
    })

    request.end()
  })
}

ipcMain.handle('project-load-video', async (_event, projectId: string, projectName: string, fileName: string) => {
  try {
    const projectPath = getProjectPath(projectId, projectName)
    const filePath = join(projectPath, 'videos', fileName)

    if (!existsSync(filePath)) {
      return { success: false, message: '' }
    }

    return { success: true, path: filePath }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('project-export', async (_event, projectId: string, projectName: string) => {
  try {
    if (!mainWindow) return { success: false, message: '' }

    const projectPath = getProjectPath(projectId, projectName)

    if (!existsSync(projectPath)) {
      return { success: false, message: '' }
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      title: '',
      defaultPath: `${projectName}.zip`,
      filters: [{ name: 'ZIP', extensions: ['zip'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, message: '' }
    }

    const archiver = require('archiver')
    const output = require('fs').createWriteStream(result.filePath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    return new Promise((resolve) => {
      output.on('close', () => {
        log.info(':', result.filePath)
        resolve({ success: true, path: result.filePath })
      })

      archive.on('error', (err: Error) => {
        log.error(':', err)
        resolve({ success: false, message: `: ${err.message}` })
      })

      archive.pipe(output)
      archive.directory(projectPath, false)
      archive.finalize()
    })
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('project-import', async () => {
  try {
    if (!mainWindow) return { success: false, message: '' }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: '',
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: '' }
    }

    const zipPath = result.filePaths[0]
    const projectsPath = getProjectsPath()
    const AdmZip = require('adm-zip')
    const zip = new AdmZip(zipPath)

    const tempDir = join(projectsPath, '_temp_import')
    if (existsSync(tempDir)) {
      require('fs').rmSync(tempDir, { recursive: true, force: true })
    }
    mkdirSync(tempDir, { recursive: true })

    zip.extractAllTo(tempDir, true)

    const projectFile = join(tempDir, 'project.json')
    if (!existsSync(projectFile)) {
      require('fs').rmSync(tempDir, { recursive: true, force: true })
      return { success: false, message: '' }
    }

    const projectData = JSON.parse(readFileSync(projectFile, 'utf-8'))
    const newProjectId = Date.now().toString()
    const newProjectPath = getProjectPath(newProjectId, projectData.name)

    require('fs').renameSync(tempDir, newProjectPath)

    const updatedProjectData = {
      ...projectData,
      id: newProjectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    writeFileSync(join(newProjectPath, 'project.json'), JSON.stringify(updatedProjectData, null, 2))

    log.info(':', newProjectPath)
    return { success: true, project: updatedProjectData }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('get-update-logs', () => {
  return updateService.getUpdateLogs()
})

interface CanvasSnapshot {
  nodes: any[]
  edges: any[]
  viewport: {
    x: number
    y: number
    zoom: number
  }
  savedAt: string
}

ipcMain.handle('canvas-save-snapshot', async (_event, projectId: string, projectName: string, snapshot: CanvasSnapshot) => {
  try {
    const projectPath = getProjectPath(projectId, projectName, 'canvas')

    if (!existsSync(projectPath)) {
      return { success: false, message: '' }
    }

    const snapshotPath = join(projectPath, 'canvas_snapshot.json')
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))
    log.info(':', snapshotPath)

    return { success: true }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('canvas-load-snapshot', async (_event, projectId: string, projectName: string) => {
  try {
    const projectPath = getProjectPath(projectId, projectName, 'canvas')
    const snapshotPath = join(projectPath, 'canvas_snapshot.json')

    if (!existsSync(snapshotPath)) {
      return { success: true, snapshot: null }
    }

    const snapshotData = JSON.parse(readFileSync(snapshotPath, 'utf-8'))
    log.info(':', snapshotPath)

    return { success: true, snapshot: snapshotData }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('canvas-list-snapshots', async (_event, projectId: string, projectName: string) => {
  try {
    const projectPath = getProjectPath(projectId, projectName, 'canvas')
    const snapshotsFolder = join(projectPath, 'snapshots')

    if (!existsSync(snapshotsFolder)) {
      return { success: true, snapshots: [] }
    }

    const files = readdirSync(snapshotsFolder).filter(f => f.endsWith('.json'))
    const snapshots = files.map(file => {
      const content = JSON.parse(readFileSync(join(snapshotsFolder, file), 'utf-8'))
      return {
        id: file.replace('.json', ''),
        name: content.name || file.replace('.json', ''),
        savedAt: content.savedAt,
        thumbnail: content.thumbnail || null
      }
    }).sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())

    return { success: true, snapshots }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('canvas-save-named-snapshot', async (_event, projectId: string, projectName: string, snapshotId: string, snapshot: CanvasSnapshot & { name: string }) => {
  try {
    const projectPath = getProjectPath(projectId, projectName, 'canvas')
    const snapshotsFolder = join(projectPath, 'snapshots')

    if (!existsSync(snapshotsFolder)) {
      mkdirSync(snapshotsFolder, { recursive: true })
    }

    const snapshotPath = join(snapshotsFolder, `${snapshotId}.json`)
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))
    log.info(':', snapshotPath)

    return { success: true }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('canvas-load-named-snapshot', async (_event, projectId: string, projectName: string, snapshotId: string) => {
  try {
    const projectPath = getProjectPath(projectId, projectName, 'canvas')
    const snapshotPath = join(projectPath, 'snapshots', `${snapshotId}.json`)

    if (!existsSync(snapshotPath)) {
      return { success: false, message: '' }
    }

    const snapshotData = JSON.parse(readFileSync(snapshotPath, 'utf-8'))
    log.info(':', snapshotPath)

    return { success: true, snapshot: snapshotData }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: `: ${error instanceof Error ? error.message : ''}` }
  }
})

ipcMain.handle('set-oss-config', (_event, config: {
  ossEndpoint: string
  ossVersionPath: string
  ossAccessKeyId?: string
  ossAccessKeySecret?: string
}) => {
  try {
    settingsStore.set('ossEndpoint', config.ossEndpoint)
    settingsStore.set('ossVersionPath', config.ossVersionPath)
    if (config.ossAccessKeyId) {
      settingsStore.set('ossAccessKeyId', config.ossAccessKeyId)
    }
    if (config.ossAccessKeySecret) {
      settingsStore.set('ossAccessKeySecret', config.ossAccessKeySecret)
    }
    updateService.setOssConfig({
      region: 'oss-cn-hangzhou',
      bucket: new URL(config.ossEndpoint).hostname.split('.')[0],
      accessKeyId: config.ossAccessKeyId || '',
      accessKeySecret: config.ossAccessKeySecret || ''
    })
    log.info('OSS')
    return { success: true }
  } catch (error) {
    log.error('OSS:', error)
    return { success: false, message: error instanceof Error ? error.message : '' }
  }
})

ipcMain.handle('get-oss-config', () => {
  return {
    ossEndpoint: settingsStore.get('ossEndpoint') as string || '',
    ossVersionPath: settingsStore.get('ossVersionPath') as string || '',
    ossAccessKeyId: settingsStore.get('ossAccessKeyId') as string || '',
    ossAccessKeySecret: settingsStore.get('ossAccessKeySecret') as string || ''
  }
})

interface ExportToJianYingOptions {
  draftPath: string
  projectName: string
  videoUrls: string[]
  videoDurations: number[]
}

ipcMain.handle('export-to-jianying', async (_event, options: ExportToJianYingOptions) => {
  try {
    const { draftPath, projectName, videoUrls, videoDurations } = options

    const draftFolder = join(draftPath, projectName)
    const draftId = generateUUID().toUpperCase()

    if (!existsSync(draftPath)) {
      return { success: false, message: '' }
    }

    mkdirSync(draftFolder, { recursive: true })

    const videos: any[] = []
    const videoSegments: any[] = []
    let totalDurationMicroseconds = 0

    for (let i = 0; i < videoUrls.length; i++) {
      const videoUrl = videoUrls[i]
      const materialId = generateUUID()
      const videoFileName = `video_${i}.mp4`
      const videoPath = join(draftFolder, videoFileName)

      if (videoUrl.startsWith('data:')) {
        const base64Data = videoUrl.split(',')[1]
        const buffer = Buffer.from(base64Data, 'base64')
        writeFileSync(videoPath, buffer)
      } else if (videoUrl.startsWith('blob:') || videoUrl.startsWith('http:') || videoUrl.startsWith('https:')) {
        try {
          const buffer = await downloadFile(videoUrl)
          writeFileSync(videoPath, buffer)
        } catch (error) {
          log.error(':', videoUrl, error)
          throw new Error(`: ${videoUrl}`)
        }
      } else if (videoUrl.startsWith('file://')) {
        const localPath = decodeURIComponent(videoUrl.replace('file:///', '').replace(/\//g, '\\'))
        if (existsSync(localPath)) {
          copyFileSync(localPath, videoPath)
        } else {
          log.error(':', localPath)
          throw new Error(`: ${localPath}`)
        }
      } else {
        if (existsSync(videoUrl)) {
          copyFileSync(videoUrl, videoPath)
        } else {
          log.error(':', videoUrl)
          throw new Error(`: ${videoUrl}`)
        }
      }

      const videoDurationMicroseconds = videoDurations && videoDurations[i]
        ? Math.round(videoDurations[i] * 1000000)
        : 5000000

      videos.push({
        aigc_type: 'none',
        audio_fade: null,
        cartoon_path: '',
        category_id: '',
        category_name: '',
        check_flag: 65535,
        crop: {
          lower_left_x: 0.0,
          lower_left_y: 1.0,
          lower_right_x: 1.0,
          lower_right_y: 1.0,
          upper_left_x: 0.0,
          upper_left_y: 0.0,
          upper_right_x: 1.0,
          upper_right_y: 0.0
        },
        crop_ratio: 'free',
        crop_scale: 1.0,
        duration: videoDurationMicroseconds,
        extra_type_option: 0,
        formula_id: '',
        freeze: null,
        has_audio: true,
        height: 1080,
        id: materialId,
        intensifies_audio_path: '',
        intensifies_path: '',
        is_ai_generate_content: false,
        is_copyright: false,
        is_text_edit_overdub: false,
        is_unified_beauty_mode: false,
        local_id: '',
        local_material_id: '',
        material_id: '',
        material_name: '',
        material_url: '',
        matting: {
          flag: 0,
          has_use_quick_brush: false,
          has_use_quick_eraser: false,
          interactiveTime: [],
          path: '',
          strokes: []
        },
        media_path: '',
        object_locked: null,
        origin_material_id: '',
        path: videoPath,
        picture_from: 'none',
        picture_set_category_id: '',
        picture_set_category_name: '',
        request_id: '',
        reverse_intensifies_path: '',
        reverse_path: '',
        smart_motion: null,
        source: 0,
        source_platform: 0,
        stable: {
          matrix_path: '',
          stable_level: 0,
          time_range: {
            duration: 0,
            start: 0
          }
        },
        team_id: '',
        type: 'video',
        video_algorithm: {
          algorithms: [],
          complement_frame_config: null,
          deflicker: null,
          gameplay_configs: [],
          motion_blur_config: null,
          noise_reduction: null,
          path: '',
          quality_enhance: null,
          time_range: null
        },
        width: 1920
      })

      videoSegments.push({
        caption_info: null,
        cartoon: false,
        clip: {
          alpha: 1.0,
          flip: {
            horizontal: false,
            vertical: false
          },
          rotation: 0.0,
          scale: {
            x: 1.0,
            y: 1.0
          },
          transform: {
            x: 0.0,
            y: 0.0
          }
        },
        common_keyframes: [],
        enable_adjust: true,
        enable_color_correct_adjust: false,
        enable_color_curves: true,
        enable_color_match_adjust: false,
        enable_color_wheels: true,
        enable_lut: true,
        enable_smart_color_adjust: false,
        extra_material_refs: [],
        group_id: '',
        hdr_settings: null,
        id: generateUUID(),
        intensifies_audio: false,
        is_placeholder: false,
        is_tone_modify: false,
        keyframe_refs: [],
        last_nonzero_volume: 1.0,
        material_id: materialId,
        render_index: 0,
        responsive_layout: {
          enable: false,
          horizontal_pos_layout: 0,
          size_layout: 0,
          target_follow: '',
          vertical_pos_layout: 0
        },
        reverse: false,
        source_timerange: {
          duration: videoDurationMicroseconds,
          start: 0
        },
        speed: 1.0,
        target_timerange: {
          duration: videoDurationMicroseconds,
          start: totalDurationMicroseconds
        },
        template_id: '',
        template_scene: 'default',
        track_attribute: 0,
        track_render_index: 0,
        uniform_scale: {
          on: true,
          value: 1.0
        },
        visible: true,
        volume: 1.0
      })

      totalDurationMicroseconds += videoDurationMicroseconds
    }

    const tracks = [
      {
        attribute: 0,
        flag: 0,
        id: generateUUID(),
        is_default_name: false,
        name: '',
        segments: videoSegments,
        type: 'video'
      }
    ]

    const draftContent = {
      canvas_config: {
        height: 1080,
        ratio: 'original',
        width: 1920
      },
      color_space: 0,
      config: {
        adjust_max_index: 1,
        attachment_info: [],
        combination_max_index: 1,
        export_range: null,
        extract_audio_last_index: 1,
        lyrics_recognition_id: '',
        lyrics_sync: true,
        lyrics_taskinfo: [],
        maintrack_adsorb: true,
        material_save_mode: 0,
        multi_language_current: 'none',
        multi_language_list: [],
        multi_language_main: 'none',
        multi_language_mode: 'none',
        original_sound_last_index: 1,
        record_audio_last_index: 1,
        sticker_max_index: 1,
        subtitle_keywords_config: null,
        subtitle_recognition_id: '',
        subtitle_sync: true,
        subtitle_taskinfo: [],
        system_font_list: [],
        video_mute: false,
        zoom_info_params: null
      },
      cover: null,
      create_time: 0,
      duration: totalDurationMicroseconds,
      extra_info: null,
      fps: 30.0,
      free_render_index_mode_on: false,
      group_container: null,
      id: draftId,
      keyframe_graph_list: [],
      keyframes: {
        adjusts: [],
        audios: [],
        effects: [],
        filters: [],
        handwrites: [],
        stickers: [],
        texts: [],
        videos: []
      },
      last_modified_platform: {
        app_id: 3704,
        app_source: 'lv',
        app_version: '5.9.0',
        device_id: '55f825afbc6f549e9dd796149c802c89',
        hard_disk_id: '619a00ae101a35b13bae75fe4a664ed0',
        mac_address: 'ff18d8d7307733e8efef7c78c69e5c11',
        os: 'windows',
        os_version: '10.0.22631'
      },
      platform: {
        app_id: 3704,
        app_source: 'lv',
        app_version: '5.9.0',
        os: 'windows'
      },
      materials: {
        ai_translates: [],
        audio_balances: [],
        audio_effects: [],
        audio_fades: [],
        audio_track_indexes: [],
        audios: [],
        beats: [],
        canvases: [],
        chromas: [],
        color_curves: [],
        digital_humans: [],
        drafts: [],
        effects: [],
        flowers: [],
        green_screens: [],
        handwrites: [],
        hsl: [],
        images: [],
        log_color_wheels: [],
        loudnesses: [],
        manual_deformations: [],
        masks: [],
        material_animations: [],
        material_colors: [],
        multi_language_refs: [],
        placeholders: [],
        plugin_effects: [],
        primary_color_wheels: [],
        realtime_denoises: [],
        shapes: [],
        smart_crops: [],
        smart_relights: [],
        sound_channel_mappings: [],
        speeds: [],
        stickers: [],
        tail_leaders: [],
        text_templates: [],
        texts: [],
        time_marks: [],
        transitions: [],
        video_effects: [],
        video_trackings: [],
        videos: videos,
        vocal_beautifys: [],
        vocal_separations: []
      },
      mutable_config: null,
      name: projectName,
      new_version: '110.0.0',
      relationships: [],
      render_index_track_mode_on: false,
      retouch_cover: null,
      source: 'default',
      static_cover_image_path: '',
      time_marks: null,
      tracks: tracks,
      update_time: 0,
      version: 360000
    }

    writeFileSync(join(draftFolder, 'draft_content.json'), JSON.stringify(draftContent))

    const draftMetaInfo = {
      cloud_package_completed_time: '',
      draft_cloud_capcut_purchase_info: '',
      draft_cloud_last_action_download: false,
      draft_cloud_materials: [],
      draft_cloud_purchase_info: '',
      draft_cloud_template_id: '',
      draft_cloud_tutorial_info: '',
      draft_cloud_videocut_purchase_info: '',
      draft_cover: '',
      draft_deeplink_url: '',
      draft_enterprise_info: {
        draft_enterprise_extra: '',
        draft_enterprise_id: '',
        draft_enterprise_name: '',
        enterprise_material: []
      },
      draft_fold_path: draftFolder.replace(/\\/g, '/'),
      draft_id: draftId,
      draft_is_ai_packaging_used: false,
      draft_is_ai_shorts: false,
      draft_is_ai_translate: false,
      draft_is_article_video_draft: false,
      draft_is_from_deeplink: 'false',
      draft_is_invisible: false,
      draft_materials: [
        { type: 0, value: [] },
        { type: 1, value: [] },
        { type: 2, value: [] },
        { type: 3, value: [] },
        { type: 6, value: [] },
        { type: 7, value: [] },
        { type: 8, value: [] }
      ],
      draft_materials_copied_info: [],
      draft_name: projectName,
      draft_new_version: '',
      draft_removable_storage_device: '',
      draft_root_path: draftPath.replace(/\\/g, '/'),
      draft_segment_extra_info: [],
      draft_timeline_materials_size_: 0,
      draft_type: '',
      tm_draft_cloud_completed: '',
      tm_draft_cloud_modified: 0,
      tm_draft_create: Date.now() * 1000,
      tm_draft_modified: Date.now() * 1000000,
      tm_draft_removed: 0,
      tm_duration: totalDurationMicroseconds
    }
    writeFileSync(join(draftFolder, 'draft_meta_info.json'), JSON.stringify(draftMetaInfo))

    const attachmentPcCommon = {
      ai_packaging_infos: [],
      ai_packaging_report_info: {
        caption_id_list: [],
        task_id: '',
        text_style: '',
        tos_id: '',
        video_category: ''
      },
      commercial_music_category_ids: [],
      pc_feature_flag: 0,
      recognize_tasks: [],
      template_item_infos: [],
      unlock_template_ids: []
    }
    writeFileSync(join(draftFolder, 'attachment_pc_common.json'), JSON.stringify(attachmentPcCommon))

    const draftAgencyConfig = {
      materials: null,
      use_converter: false,
      video_resolution: 1080
    }
    writeFileSync(join(draftFolder, 'draft_agency_config.json'), JSON.stringify(draftAgencyConfig))

    writeFileSync(join(draftFolder, 'draft_biz_config.json'), '{}')

    log.info(':', draftFolder)
    return { success: true, message: ` ${videoUrls.length} : ${projectName}` }
  } catch (error) {
    log.error(':', error)
    return { success: false, message: error instanceof Error ? error.message : '' }
  }
})

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

