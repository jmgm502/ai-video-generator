import './ensure-win-console-utf8'
import { app, BrowserWindow, ipcMain, shell, dialog, net, nativeImage } from 'electron'
import { join } from 'path'
import { app as electronApp } from 'electron'
import { pathToFileURL, fileURLToPath } from 'url'
import Store from 'electron-store'
import log from 'electron-log'
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, writeFileSync, readFileSync, writeFile } from 'fs'
import { dirname } from 'path'
import { updateService, VersionInfo } from './updateService'
import { setupUpdaterIPC, updaterManager } from './updaterManager'
import { buildSplashHtml } from './splashHtml'
import { startFlow2api, stopFlow2api, isFlow2apiRunning, getFlow2apiPath } from './flow2api-manager'
import { upscaleImage, stopUpscale, isUpscaling, checkUpscaylAvailable, getAvailableModels } from './upscayl-manager'

log.transports.file.level = 'info'
log.transports.console.level = 'debug'
;(log.transports.file as { encoding?: string }).encoding = 'utf-8'

log.transports.file.fileName = 'main.log'
log.transports.file.maxSize = 5 * 1024 * 1024

log.info('='.repeat(50))
log.info('应用启动')
log.info('='.repeat(50))

let mainWindow: BrowserWindow | null = null
/** 启动屏：主窗口就绪前展示，减轻黑屏等待体感 */
let splashWindow: BrowserWindow | null = null
/** 是否正在退出以进行更新 */
export let isQuittingForUpdate: boolean = false

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
  log.info('数据存储路径:', storePath)
  
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
      log.info('数据已迁移到新路径:', newPath)
    }
    
    settingsStore.set('customDataPath', newPath)
    store = new Store({ cwd: newPath })
    
    log.info('存储路径已更新为:', newPath)
    
    return { success: true, message: '存储路径设置成功' }
  } catch (error) {
    log.error('设置存储路径失败:', error)
    return { success: false, message: `设置失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
}

function resetDataPath(): { success: boolean; message: string } {
  try {
    settingsStore.delete('customDataPath')
    store = new Store()
    log.info('存储路径已恢复默认')
    return { success: true, message: '已恢复默认存储路径' }
  } catch (error) {
    return { success: false, message: `恢复失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
}

function setupUpdateService(): void {
  log.info('配置更新服务...')
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
    log.info('OSS未配置，跳过更新检查')
    return
  }

  log.info('开始检查OSS更新...')
  mainWindow?.webContents.send('update-status', { status: 'checking' })

  updateService.checkForUpdate(ossEndpoint, ossVersionPath).then(result => {
    if (result.hasUpdate && result.versionInfo) {
      log.info('发现新版本:', result.versionInfo.version)
      mainWindow?.webContents.send('update-status', {
        status: 'available',
        version: result.versionInfo.version,
        buildNumber: result.versionInfo.buildNumber,
        releaseDate: result.versionInfo.releaseDate,
        releaseNotes: result.versionInfo.releaseNotes,
        downloadUrl: result.versionInfo.downloadUrl
      })
    } else if (!result.hasUpdate) {
      log.info('当前已是最新版本')
      mainWindow?.webContents.send('update-status', { status: 'not-available' })
    } else if (result.error) {
      log.error('检查更新失败:', result.error)
      mainWindow?.webContents.send('update-status', { status: 'error', message: result.error })
    }
  })
}

/** 开发与打包后均能解析 `public/icon.ico`（打包见 package.json `build.files`） */
function resolveSplashIconPath(): string | null {
  const candidates = [
    join(process.cwd(), 'public', 'icon.ico'),
    join(app.getAppPath(), 'public', 'icon.ico'),
    join(__dirname, '..', 'public', 'icon.ico'),
  ]
  for (const p of candidates) {
    try {
      if (existsSync(p)) return p
    } catch {
      /* ignore */
    }
  }
  return null
}

/** 将 ICO 转为 PNG data URL，嵌入启动屏 data: HTML，避免 img 走 file:// 被拒 */
function getSplashLogoDataUrl(): string | null {
  const iconPath = resolveSplashIconPath()
  if (!iconPath) {
    log.warn('启动屏 Logo 未找到 public/icon.ico')
    return null
  }
  try {
    const img = nativeImage.createFromPath(iconPath)
    if (img.isEmpty()) {
      log.warn('启动屏 icon.ico 解码为空:', iconPath)
      return null
    }
    const resized = img.resize({ width: 176 })
    const buf = resized.toPNG()
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch (e) {
    log.warn('启动屏 Logo 加载失败:', iconPath, e)
    return null
  }
}

function closeSplashWindow(): void {
  if (!splashWindow || splashWindow.isDestroyed()) {
    splashWindow = null
    return
  }
  try {
    splashWindow.close()
  } catch {
    /* ignore */
  }
  splashWindow = null
}

function createSplashWindow(): void {
  if (splashWindow && !splashWindow.isDestroyed()) return

  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    center: true,
    show: false,
    backgroundColor: '#0d0d0d',
    webPreferences: {
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false,
    },
  })

  const splashHtml = buildSplashHtml(getSplashLogoDataUrl())
  const url = `data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`
  splashWindow.loadURL(url)

  splashWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.show()
  })

  splashWindow.on('closed', () => {
    splashWindow = null
  })
}

function createWindow(): void {
  log.info('创建主窗口...')
  createSplashWindow()

  mainWindow = new BrowserWindow({
    width: 1350,
    height: 860,
    minWidth: 1350,
    minHeight: 860,
    show: false,
    frame: false,
    backgroundColor: '#0d0d0d',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      /** 窗口失焦时仍保持计时器/动画调度接近前台，减少「切回星梦时一顿顿」的体感 */
      backgroundThrottling: false,
    },
  })

  /** 仅在渲染进程宣告首屏就绪后再 show 主窗口，并关闭启动屏 */
  let mainWindowShown = false
  const showMainWindowOnce = () => {
    if (mainWindowShown || mainWindow?.isDestroyed()) return
    mainWindowShown = true
    closeSplashWindow()
    mainWindow?.show()
    mainWindow?.focus()
    log.info('主窗口已显示')
  }
  ipcMain.once('shell-ready', showMainWindowOnce)
  /** 兜底：旧 preload / Web 或未发信号时仍可打开窗口，避免永远不显示 */
  const fallbackShowMs = isDev ? 20000 : 8000
  setTimeout(showMainWindowOnce, fallbackShowMs)

  mainWindow.on('close', (event) => {
    if (mainWindow?.isDestroyed()) return

    if (isQuittingForUpdate) {
      log.info('正在退出以更新，直接关闭窗口')
      return
    }

    event.preventDefault()
    mainWindow?.webContents.send('window-close-requested')
  })

  ipcMain.on('window-close-cancelled', () => {
    log.info('用户取消关闭')
  })

  ipcMain.on('window-close-confirmed', () => {
    log.info('用户确认关闭应用')
    closeSplashWindow()
    mainWindow?.destroy()
  })
  
  mainWindow.on('closed', () => {
    log.info('主窗口已关闭')
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    log.info('打开外部链接:', details.url)
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev) {
    const url = process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173'
    log.info('开发模式，加载URL:', url)
    mainWindow.loadURL(url)
    /** 首屏后再开控制台，避免与 Vue/资源加载抢主线程 */
    setTimeout(() => mainWindow?.webContents.openDevTools(), 1200)
  } else {
    log.info('生产模式，加载本地文件')
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

/**
 * 画布节点 data 中常含多路 Base64 大图；提高渲染进程 V8 堆上限，减轻 Chromium
 * 「在内存不足可能导致崩溃之前已暂停」导致画布冻结（须在 app ready 之前设置）。
 */
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192')

app.whenReady().then(async () => {
  log.info('应用就绪')

  // 预设OSS配置
  updateService.setOssConfig({
    region: 'oss-cn-beijing',
    bucket: 'xingmengai',
    accessKeyId: 'LTAI5tHuESQ1X4zMyKdZrL1e',
    accessKeySecret: 'jY4NCG7baZwbHGLbuRIkirJsCpr4Hs'
  })

  // 创建主窗口
  createWindow()

  // 设置更新 IPC 处理器
  setupUpdaterIPC(mainWindow!, () => {
    isQuittingForUpdate = true
  })

  // 启动 Flow2API（延迟启动，不阻塞主窗口显示）
  setTimeout(async () => {
    try {
      const flow2apiPath = getFlow2apiPath()
      const configPath = join(flow2apiPath, 'config', 'setting.toml')
      const exampleConfigPath = join(flow2apiPath, 'config', 'setting_example.toml')
      
      // 如果没有配置文件，复制示例配置
      if (!existsSync(configPath) && existsSync(exampleConfigPath)) {
        copyFileSync(exampleConfigPath, configPath)
        log.info('已创建 Flow2API 配置文件:', configPath)
      }
      
      // 从 store 读取用户设置的 baseURL
      let port = 8001
      try {
        const customConfig = store.get('customConfig') as any
        if (customConfig && customConfig.baseURL) {
          const baseURL = customConfig.baseURL
          const urlMatch = baseURL.match(/:(\d+)/)
          if (urlMatch) {
            port = parseInt(urlMatch[1])
            log.info('从用户配置中获取 Flow2API 端口:', port)
          }
        }
      } catch {
        // 如果读取失败，使用默认端口
      }
      
      await startFlow2api(port)
    } catch (error) {
      log.warn('Flow2API 启动失败:', error)
    }
  }, 3000)

  // 自动检查更新（延迟2秒确保窗口已就绪）
  if (!isDev) {
    setTimeout(() => {
      log.info('启动时自动检查更新...')
      updaterManager.checkForUpdates()
    }, 2000)
  }

  app.on('activate', () => {
    log.info('应用激活')
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch((error) => {
  log.error('应用启动失败:', error)
})

async function performUpdateBeforeLaunch(): Promise<boolean> {
  const apiUrl = 'https://xmdm.ussn.cn/version?action=check'

  log.info('检查更新...')

  try {
    const result = await updateService.checkForUpdateViaApi(apiUrl)

    if (result.hasUpdate && result.versionInfo) {
      log.info(`发现新版本: ${result.versionInfo.version}，开始下载...`)

      // 下载更新（带进度回调）
      const downloadResult = await updateService.downloadUpdate(result.versionInfo, (progress) => {
        log.info(`[下载进度] ${progress.percent.toFixed(1)}% (${progress.transferred}/${progress.total})`)
      })

      if (downloadResult.success && downloadResult.filePath) {
        log.info('下载完成，正在安装更新...')

        // 解压更新
        const extractResult = await updateService.extractUpdate(downloadResult.filePath, app.getAppPath())

        if (extractResult.success) {
          log.info('更新安装完成')
          return true
        }
      }
    } else {
      log.info('当前已是最新版本')
    }
  } catch (error) {
    log.error('更新检查/下载失败:', error)
  }

  return false
}

app.on('window-all-closed', () => {
  log.info('所有窗口已关闭')
  // 退出前停止 Flow2API
  stopFlow2api().then(() => {
    if (process.platform !== 'darwin') {
      log.info('退出应用')
      app.quit()
    }
  })
})

app.on('before-quit', () => {
  log.info('应用即将退出')
  // 确保 Flow2API
  stopFlow2api()
})

ipcMain.on('window-minimize', () => {
  log.debug('窗口最小化')
  mainWindow?.minimize()
})

ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    log.debug('窗口取消最大化')
    mainWindow.unmaximize()
  } else {
    log.debug('窗口最大化')
    mainWindow?.maximize()
  }
})

ipcMain.on('window-close', () => {
  log.debug('关闭窗口请求')
  if (!mainWindow) return
  mainWindow.webContents.send('window-close-requested')
})

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() ?? false
})

ipcMain.handle('app-getPath', (_event, name: string) => {
  return app.getPath(name as any)
})

ipcMain.handle('get-resource-path', (_event, resourcePath: string) => {
  if (!app.isPackaged) {
    return join(process.cwd(), 'public', resourcePath)
  }
  return join(process.resourcesPath, resourcePath)
})

ipcMain.on('window-set-always-on-top', (_event, isAlwaysOnTop: boolean) => {
  log.debug('设置窗口置顶:', isAlwaysOnTop)
  mainWindow?.setAlwaysOnTop(isAlwaysOnTop)
})

ipcMain.handle('store-get', async (_event, key: string) => {
  log.debug('Store获取:', key)
  return store.get(key)
})

ipcMain.handle('store-set', async (_event, key: string, value: unknown) => {
  log.debug('Store设置:', key)
  store.set(key, value)
})

ipcMain.handle('store-delete', async (_event, key: string) => {
  log.debug('Store删除:', key)
  store.delete(key)
})

ipcMain.handle('store-clear', async () => {
  log.info('Store清空')
  store.clear()
})

ipcMain.on('store-get-sync', (event, key: string) => {
  log.debug('Store同步获取:', key, '路径:', getStorePath())
  event.returnValue = store.get(key)
})

ipcMain.on('store-set-sync', (event, key: string, value: unknown) => {
  log.debug('Store同步设置:', key, '路径:', getStorePath())
  store.set(key, value)
  event.returnValue = true
})

ipcMain.on('log-info', (_event, ...args) => {
  log.info('[渲染进程]', ...args)
})

ipcMain.on('log-warn', (_event, ...args) => {
  log.warn('[渲染进程]', ...args)
})

ipcMain.on('log-error', (_event, ...args) => {
  log.error('[渲染进程]', ...args)
})

ipcMain.on('log-debug', (_event, ...args) => {
  log.debug('[渲染进程]', ...args)
})

// Flow2API 相关 IPC 处理
ipcMain.handle('flow2api-start', async (_event, port?: number) => {
  try {
    await startFlow2api(port || 8001)
    return { success: true, message: 'Flow2API 启动成功' }
  } catch (error) {
    log.error('启动 Flow2API 失败:', error)
    return { success: false, message: error instanceof Error ? error.message : '启动失败' }
  }
})

ipcMain.handle('flow2api-stop', async () => {
  try {
    await stopFlow2api()
    return { success: true, message: 'Flow2API 已停止' }
  } catch (error) {
    log.error('停止 Flow2API 失败:', error)
    return { success: false, message: error instanceof Error ? error.message : '停止失败' }
  }
})

ipcMain.handle('flow2api-isRunning', () => {
  return isFlow2apiRunning()
})

ipcMain.handle('upscayl-upscale', async (event, options: {
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
}) => {
  try {
    const outputPath = await upscaleImage(options, (progress) => {
      event.sender.send('upscayl-progress', progress)
    })
    return { success: true, outputPath }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : '处理失败' }
  }
})

ipcMain.handle('upscayl-cancel', () => {
  try {
    stopUpscale()
    return { success: true }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : '取消失败' }
  }
})

ipcMain.handle('upscayl-get-models', () => {
  return getAvailableModels()
})

ipcMain.handle('upscayl-check-available', () => {
  return checkUpscaylAvailable()
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

ipcMain.handle('dialog-openFile', async (_event, options?: Record<string, unknown>) => {
  if (!mainWindow) return { canceled: true, filePaths: [] }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: (options?.title as string) || '选择文件',
    properties: (options?.properties as Array<'openFile' | 'openDirectory' | 'multiSelections' | 'createDirectory' | 'showHiddenFiles' | 'promptToCreate' | 'noResolveAliases' | 'treatPackageAsDirectory' | 'dontAddToRecent'>) || ['openFile'],
    filters: (options?.filters as Array<{ name: string; extensions: string[] }>) || undefined
  })

  return result
})

ipcMain.handle('dialog-saveFile', async (_event, options?: Record<string, unknown>) => {
  if (!mainWindow) return { canceled: true, filePath: '' }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: (options?.title as string) || '保存文件',
    defaultPath: (options?.defaultPath as string) || '',
    filters: (options?.filters as Array<{ name: string; extensions: string[] }>) || undefined
  })

  return {
    canceled: result.canceled,
    filePath: result.filePath || ''
  }
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

/** 画布等节点引用 file:// 图片时，远端视频 API 无法读取；主进程读盘并转为 data URL 供请求体使用 */
ipcMain.handle('read-local-file-as-data-url', async (_event, fileUrl: string) => {
  try {
    if (!fileUrl || typeof fileUrl !== 'string' || !fileUrl.startsWith('file:')) {
      return { success: false as const, message: '非 file:// 地址' }
    }
    let filePath: string
    try {
      filePath = fileURLToPath(fileUrl)
    } catch {
      return { success: false as const, message: '无法解析本地路径' }
    }
    if (!existsSync(filePath)) {
      return { success: false as const, message: '文件不存在' }
    }
    const buffer = readFileSync(filePath)
    const base64 = buffer.toString('base64')
    const baseName = filePath.split(/[/\\]/).pop() || ''
    const ext = baseName.includes('.') ? baseName.split('.').pop()?.toLowerCase() || 'png' : 'png'
    const mimeType =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'webp'
          ? 'image/webp'
          : ext === 'gif'
            ? 'image/gif'
            : 'image/png'
    return { success: true as const, data: `data:${mimeType};base64,${base64}` }
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取失败'
    log.error('read-local-file-as-data-url:', message)
    return { success: false as const, message }
  }
})

ipcMain.handle('shell-open-path', async (_event, path: string) => {
  log.info('打开文件夹:', path)
  return shell.openPath(path)
})

ipcMain.handle('file-copy', async (_event, srcPath: string, destPath: string) => {
  try {
    if (!existsSync(srcPath)) {
      return { success: false, message: '源文件不存在' }
    }
    const destDir = dirname(destPath)
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true })
    }
    copyFileSync(srcPath, destPath)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : '复制失败'
    log.error('file-copy:', message)
    return { success: false, message }
  }
})

ipcMain.handle('file-read-text', async (_event, filePath: string) => {
  try {
    if (!existsSync(filePath)) {
      return { success: false, message: '文件不存在', content: '' }
    }
    const content = readFileSync(filePath, 'utf-8')
    return { success: true, content }
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取失败'
    log.error('file-read-text:', message)
    return { success: false, message, content: '' }
  }
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

function getRecycleBinProjectPath(projectId: string, projectName: string, _projectType?: 'creative' | 'canvas'): string {
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
      return { success: false, message: '项目文件夹已存在' }
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
    
    if (projectData.type !== 'canvas') {
      writeFileSync(join(projectPath, 'assets.json'), JSON.stringify([], null, 2))
      writeFileSync(join(projectPath, 'storyboard.json'), JSON.stringify([], null, 2))
      writeFileSync(join(projectPath, 'novel.json'), JSON.stringify({ content: '' }, null, 2))
    }

    log.info('项目创建成功:', projectPath)
    return { success: true, path: projectPath }
  } catch (error) {
    log.error('创建项目失败:', error)
    return { success: false, message: `创建失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
})

ipcMain.handle('project-get-path', async (_event, projectId: string, projectName: string, projectType?: 'creative' | 'canvas') => {
  return getProjectPath(projectId, projectName, projectType)
})

ipcMain.handle('project-load', async (_event, projectId: string, projectName: string) => {
  try {
    const projectPath = getProjectPath(projectId, projectName)
    const projectFile = join(projectPath, 'project.json')
    const assetsFile = join(projectPath, 'assets.json')
    const storyboardFile = join(projectPath, 'storyboard.json')
    const novelFile = join(projectPath, 'novel.json')
    
    if (!existsSync(projectFile)) {
      return { success: false, message: '项目不存在' }
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
    log.error('加载项目失败:', error)
    return { success: false, message: `加载失败: ${error instanceof Error ? error.message : '未知错误'}` }
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
      return { success: false, message: '未知的数据类型' }
    }
    
    const filePath = join(projectPath, fileName)
    
    console.log('[Electron] project-save-data:', { projectId, projectName, dataType, filePath, dataLength: Array.isArray(data) ? data.length : 'not array' })
    
    if (dataType === 'project') {
      const existingData = existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf-8')) : {}
      const patch =
        data !== null && typeof data === 'object' && !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : {}
      data = { ...existingData, ...patch, updatedAt: new Date().toISOString() }
    }
    
    writeFileSync(filePath, JSON.stringify(data, null, 2))
    log.info('保存数据成功:', fileName)
    
    const savedContent = readFileSync(filePath, 'utf-8')
    console.log('[Electron] 已保存内容长度:', savedContent.length, '前100字符:', savedContent.substring(0, 100))
    
    return { success: true }
  } catch (error) {
    log.error('保存数据失败:', error)
    return { success: false, message: `保存失败: ${error instanceof Error ? error.message : '未知错误'}` }
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
              log.info('修复项目名称，从文件夹提取:', projectName)
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
            log.warn('无法读取项目文件:', projectFile, e)
          }
        }
      }
    }
    
    return { success: true, projects }
  } catch (error) {
    log.error('获取项目列表失败:', error)
    return { success: false, message: `获取失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
})

ipcMain.handle('project-list-canvas', async () => {
  try {
    const canvasProjectsPath = getCanvasProjectsPath()
    const projects: Array<{ id: string; name: string; type: 'creative' | 'canvas'; path: string; createdAt: string; updatedAt: string }> = []
    
    const dirs = readdirSync(canvasProjectsPath)
    
    for (const dir of dirs) {
      const projectPath = join(canvasProjectsPath, dir)
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
              log.info('修复画布项目名称，从文件夹提取:', projectName)
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
            log.warn('无法读取画布项目文件:', projectFile, e)
          }
        }
      }
    }
    
    return { success: true, projects }
  } catch (error) {
    log.error('获取画布项目列表失败:', error)
    return { success: false, message: `获取失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
})

ipcMain.handle('project-delete', async (_event, projectId: string, projectName: string, fromRecycleBin: boolean = false, projectType?: 'creative' | 'canvas') => {
  try {
    const projectPath = fromRecycleBin 
      ? getRecycleBinProjectPath(projectId, projectName, projectType)
      : getProjectPath(projectId, projectName, projectType)
    
    if (!existsSync(projectPath)) {
      return { success: false, message: '项目不存在' }
    }
    
    const fs = require('fs')
    fs.rmSync(projectPath, { recursive: true, force: true })
    
    log.info('项目删除成功:', projectPath)
    return { success: true }
  } catch (error) {
    log.error('删除项目失败:', error)
    return { success: false, message: `删除失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
})

ipcMain.handle('project-move-to-recycle-bin', async (_event, projectId: string, projectName: string, projectType?: 'creative' | 'canvas') => {
  try {
    const projectPath = getProjectPath(projectId, projectName, projectType)
    const recycleBinPath = getRecycleBinProjectPath(projectId, projectName, projectType)
    
    if (!existsSync(projectPath)) {
      return { success: false, message: '项目不存在' }
    }
    
    if (existsSync(recycleBinPath)) {
      const fs = require('fs')
      fs.rmSync(recycleBinPath, { recursive: true, force: true })
    }
    
    const fs = require('fs')
    fs.renameSync(projectPath, recycleBinPath)
    
    log.info('项目移至回收站:', projectPath, '->', recycleBinPath)
    return { success: true }
  } catch (error) {
    log.error('移至回收站失败:', error)
    return { success: false, message: `移至回收站失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
})

ipcMain.handle('project-restore-from-recycle-bin', async (_event, projectId: string, projectName: string, projectType?: 'creative' | 'canvas') => {
  try {
    const recycleBinPath = getRecycleBinProjectPath(projectId, projectName, projectType)
    const projectPath = getProjectPath(projectId, projectName, projectType)
    
    if (!existsSync(recycleBinPath)) {
      return { success: false, message: '回收站中项目不存在' }
    }
    
    if (existsSync(projectPath)) {
      const fs = require('fs')
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
    
    const fs = require('fs')
    fs.renameSync(recycleBinPath, projectPath)
    
    log.info('项目从回收站恢复:', recycleBinPath, '->', projectPath)
    return { success: true }
  } catch (error) {
    log.error('从回收站恢复失败:', error)
    return { success: false, message: `恢复失败: ${error instanceof Error ? error.message : '未知错误'}` }
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
            log.error('解析回收站项目文件失败:', projectFile, e)
          }
        }
      }
    }
    
    return { success: true, projects }
  } catch (error) {
    log.error('列出回收站项目失败:', error)
    return { success: false, message: `列出回收站项目失败: ${error instanceof Error ? error.message : '未知错误'}`, projects: [] }
  }
})

ipcMain.handle('project-rename', async (_event, projectId: string, oldName: string, newName: string) => {
  try {
    const oldPath = getProjectPath(projectId, oldName)
    const newPath = getProjectPath(projectId, newName)
    
    if (!existsSync(oldPath)) {
      return { success: false, message: '项目不存在' }
    }
    
    if (existsSync(newPath) && oldPath !== newPath) {
      return { success: false, message: '项目名称已存在' }
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
    
    log.info('项目重命名成功:', oldPath, '->', newPath)
    return { success: true, newPath }
  } catch (error) {
    log.error('重命名项目失败:', error)
    return { success: false, message: `重命名失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
})

ipcMain.handle('project-clear-data', async (_event, projectId: string, projectName: string) => {
  try {
    const projectPath = getProjectPath(projectId, projectName)
    
    if (!existsSync(projectPath)) {
      return { success: false, message: '项目不存在' }
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
    
    log.info('项目数据已清空:', projectPath)
    return { success: true }
  } catch (error) {
    log.error('清空项目数据失败:', error)
    return { success: false, message: `清空失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
})

ipcMain.handle(
  'project-save-image',
  async (
    _event,
    projectId: string,
    projectName: string,
    category: string,
    fileName: string,
    imageData: string,
    projectType?: 'creative' | 'canvas'
  ) => {
  try {
    const projectPath = getProjectPath(projectId, projectName, projectType)
    
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
      case 'canvas':
        folderPath = join(projectPath, 'canvas-media', 'images')
        break
      default:
        return { success: false, message: '未知的图片分类' }
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
      log.info('开始下载远程图片:', imageData)
      const buffer = await downloadFile(imageData)
      writeFileSync(filePath, buffer)
      log.info('远程图片下载完成:', filePath)
    } else {
      copyFileSync(imageData, filePath)
    }
    
    log.info('图片保存成功:', filePath)
    return { success: true, path: filePath }
  } catch (error) {
    log.error('保存图片失败:', error)
    return { success: false, message: `保存失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
})

ipcMain.handle(
  'project-load-image',
  async (
    _event,
    projectId: string,
    projectName: string,
    category: string,
    fileName: string,
    projectType?: 'creative' | 'canvas'
  ) => {
  try {
    const projectPath = getProjectPath(projectId, projectName, projectType)
    
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
      case 'canvas':
        folderPath = join(projectPath, 'canvas-media', 'images')
        break
      default:
        return { success: false, message: '未知的图片分类' }
    }
    
    const filePath = join(folderPath, fileName)
    
    if (!existsSync(filePath)) {
      return { success: false, message: '图片不存在' }
    }
    
    const buffer = require('fs').readFileSync(filePath)
    const base64 = buffer.toString('base64')
    const ext = fileName.split('.').pop()?.toLowerCase() || 'png'
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
    
    return { success: true, data: `data:${mimeType};base64,${base64}` }
  } catch (error) {
    log.error('加载图片失败:', error)
    return { success: false, message: `加载失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
})

ipcMain.handle(
  'project-save-video',
  async (
    _event,
    projectId: string,
    projectName: string,
    fileName: string,
    videoData: string,
    projectType?: 'creative' | 'canvas'
  ) => {
  try {
    const projectPath = getProjectPath(projectId, projectName, projectType)
    const videosPath =
      projectType === 'canvas' ? join(projectPath, 'canvas-media', 'videos') : join(projectPath, 'videos')

    if (!existsSync(videosPath)) {
      mkdirSync(videosPath, { recursive: true })
    }

    const filePath = join(videosPath, fileName)

    if (videoData.startsWith('data:')) {
      const base64Data = videoData.replace(/^data:video\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      writeFileSync(filePath, buffer)
    } else if (videoData.startsWith('http://') || videoData.startsWith('https://')) {
      log.info('开始下载远程视频:', videoData)
      const buffer = await downloadFile(videoData)
      writeFileSync(filePath, buffer)
      log.info('远程视频下载完成:', filePath)
    } else {
      copyFileSync(videoData, filePath)
    }

    const fileUrl = pathToFileURL(filePath).href
    log.info('视频保存成功:', fileUrl)
    return { success: true, path: fileUrl }
  } catch (error) {
    log.error('保存视频失败:', error)
    return { success: false, message: `保存失败: ${error instanceof Error ? error.message : '未知错误'}` }
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
    log.info('本地视频保存成功:', fileUrl)
    return { success: true, path: fileUrl }
  } catch (error) {
    log.error('保存本地视频失败:', error)
    return { success: false, message: `保存失败: ${error instanceof Error ? error.message : '未知错误'}` }
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
      
      response.on('error', (error: Error) => {
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
      return { success: false, message: '视频不存在' }
    }
    
    return { success: true, path: filePath }
  } catch (error) {
    log.error('加载视频失败:', error)
    return { success: false, message: `加载失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
})

ipcMain.handle('project-export', async (_event, projectId: string, projectName: string) => {
  try {
    if (!mainWindow) return { success: false, message: '主窗口不存在' }
    
    const projectPath = getProjectPath(projectId, projectName)
    
    if (!existsSync(projectPath)) {
      return { success: false, message: '项目不存在' }
    }
    
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出项目',
      defaultPath: `${projectName}.zip`,
      filters: [{ name: 'ZIP压缩包', extensions: ['zip'] }]
    })
    
    if (result.canceled || !result.filePath) {
      return { success: false, message: '取消导出' }
    }
    
    const archiver = require('archiver')
    const output = require('fs').createWriteStream(result.filePath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    
    return new Promise((resolve) => {
      output.on('close', () => {
        log.info('项目导出成功:', result.filePath)
        resolve({ success: true, path: result.filePath })
      })
      
      archive.on('error', (err: Error) => {
        log.error('导出失败:', err)
        resolve({ success: false, message: `导出失败: ${err.message}` })
      })
      
      archive.pipe(output)
      archive.directory(projectPath, false)
      archive.finalize()
    })
  } catch (error) {
    log.error('导出项目失败:', error)
    return { success: false, message: `导出失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
})

ipcMain.handle('project-import', async () => {
  try {
    if (!mainWindow) return { success: false, message: '主窗口不存在' }
    
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入项目',
      filters: [{ name: 'ZIP压缩包', extensions: ['zip'] }],
      properties: ['openFile']
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: '取消导入' }
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
      return { success: false, message: '无效的项目文件' }
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
    
    log.info('项目导入成功:', newProjectPath)
    return { success: true, project: updatedProjectData }
  } catch (error) {
    log.error('导入项目失败:', error)
    return { success: false, message: `导入失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
})

ipcMain.handle('get-update-logs', () => {
  return updateService.getUpdateLogs()
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
    log.info('OSS配置已保存')
    return { success: true }
  } catch (error) {
    log.error('保存OSS配置失败:', error)
    return { success: false, message: error instanceof Error ? error.message : '保存失败' }
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
      return { success: false, message: '草稿路径不存在' }
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
          log.error('下载视频失败:', videoUrl, error)
          throw new Error(`下载视频失败: ${videoUrl}`)
        }
      } else if (videoUrl.startsWith('file://')) {
        const localPath = decodeURIComponent(videoUrl.replace('file:///', '').replace(/\//g, '\\'))
        if (existsSync(localPath)) {
          copyFileSync(localPath, videoPath)
        } else {
          log.error('视频文件不存在:', localPath)
          throw new Error(`视频文件不存在: ${localPath}`)
        }
      } else {
        if (existsSync(videoUrl)) {
          copyFileSync(videoUrl, videoPath)
        } else {
          log.error('视频文件不存在:', videoUrl)
          throw new Error(`视频文件不存在: ${videoUrl}`)
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
        name: '主视频轨道',
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

    log.info('剪映草稿导出成功:', draftFolder)
    return { success: true, message: `已导出 ${videoUrls.length} 个视频到草稿: ${projectName}` }
  } catch (error) {
    log.error('导出剪映失败:', error)
    return { success: false, message: error instanceof Error ? error.message : '未知错误' }
  }
})

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

ipcMain.handle('canvas-save-snapshot', async (_event, projectId: string, projectName: string, snapshot: any) => {
  try {
    const projectPath = getProjectPath(projectId, projectName, 'canvas')
    const snapshotPath = join(projectPath, 'canvas_snapshot.json')
    const snapshotDir = dirname(snapshotPath)
    if (!existsSync(snapshotDir)) {
      mkdirSync(snapshotDir, { recursive: true })
    }
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))
    log.info('画布快照保存成功:', snapshotPath)
    return { success: true }
  } catch (error) {
    log.error('画布快照保存失败:', error)
    return { success: false, message: `保存失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
})

ipcMain.handle('canvas-load-snapshot', async (_event, projectId: string, projectName: string) => {
  try {
    const projectPath = getProjectPath(projectId, projectName, 'canvas')
    const snapshotPath = join(projectPath, 'canvas_snapshot.json')
    
    if (!existsSync(snapshotPath)) {
      return { success: false, message: '快照不存在' }
    }
    
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'))
    return { success: true, snapshot }
  } catch (error) {
    log.error('画布快照加载失败:', error)
    return { success: false, message: `加载失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
})

ipcMain.handle('canvas-list-snapshots', async (_event, projectId: string, projectName: string) => {
  try {
    const projectPath = getProjectPath(projectId, projectName, 'canvas')
    const snapshotsDir = join(projectPath, 'snapshots')
    
    if (!existsSync(snapshotsDir)) {
      return { success: true, snapshots: [] }
    }
    
    const snapshots: any[] = []
    const files = readdirSync(snapshotsDir)
    
    for (const file of files) {
      if (file.startsWith('snapshot_') && file.endsWith('.json')) {
        try {
          const snapshotPath = join(snapshotsDir, file)
          const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'))
          snapshots.push(snapshot)
        } catch (e) {
          log.warn('无法读取命名快照文件:', file, e)
        }
      }
    }
    
    snapshots.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    
    return { success: true, snapshots }
  } catch (error) {
    log.error('画布快照列表加载失败:', error)
    return { success: false, message: `加载失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
})

ipcMain.handle('canvas-save-named-snapshot', async (_event, projectId: string, projectName: string, snapshotId: string, snapshot: any) => {
  try {
    const projectPath = getProjectPath(projectId, projectName, 'canvas')
    const snapshotsDir = join(projectPath, 'snapshots')
    
    if (!existsSync(snapshotsDir)) {
      mkdirSync(snapshotsDir, { recursive: true })
    }
    
    const snapshotPath = join(snapshotsDir, `${snapshotId}.json`)
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))
    log.info('画布命名快照保存成功:', snapshotPath)
    return { success: true }
  } catch (error) {
    log.error('画布命名快照保存失败:', error)
    return { success: false, message: `保存失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
})

ipcMain.handle('canvas-load-named-snapshot', async (_event, projectId: string, projectName: string, snapshotId: string) => {
  try {
    const projectPath = getProjectPath(projectId, projectName, 'canvas')
    const snapshotPath = join(projectPath, 'snapshots', `${snapshotId}.json`)
    
    if (!existsSync(snapshotPath)) {
      return { success: false, message: '快照不存在' }
    }
    
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'))
    return { success: true, snapshot }
  } catch (error) {
    log.error('画布命名快照加载失败:', error)
    return { success: false, message: `加载失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
})
