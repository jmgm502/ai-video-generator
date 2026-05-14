import { BrowserWindow, ipcMain, app } from 'electron'
import log from 'electron-log'
import https from 'https'
import http from 'http'
import { URL } from 'url'
import fs from 'fs'
import path from 'path'

interface LatestJson {
  version: string
  files: Array<{
    url: string
    sha512: string
    size: number
  }>
  path: string
  sha512: string
  releaseDate: string
  releaseNotes: string
}

interface UpdateInfo {
  version: string
  releaseDate: string
  releaseNotes: string
  downloadUrl: string
  fileSize: number
  sha512: string
}

interface DownloadProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

class UpdaterManager {
  private mainWindow: BrowserWindow | null = null
  private updateInfo: UpdateInfo | null = null
  private downloadedFilePath: string | null = null
  private updateUrl: string = 'https://xingmengai.oss-cn-beijing.aliyuncs.com/latest.json'
  private onPrepareQuitForUpdate: (() => void) | null = null

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  setPrepareQuitCallback(callback: () => void) {
    this.onPrepareQuitForUpdate = callback
  }

  setUpdateUrl(url: string) {
    this.updateUrl = url
    log.info(`更新地址已设置为: ${url}`)
  }

  private sendStatus(status: string, data: any = {}) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update-status', { status, ...data })
    }
  }

  private parseUrl(urlStr: string): { protocol: string; hostname: string; port: string; path: string } {
    const url = new URL(urlStr)
    return {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? '443' : '80'),
      path: url.pathname + url.search
    }
  }

  private async fetchJson<T>(urlStr: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const urlInfo = this.parseUrl(urlStr)
      const protocol = urlInfo.protocol === 'https:' ? https : http

      const options = {
        hostname: urlInfo.hostname,
        port: urlInfo.port,
        path: urlInfo.path,
        method: 'GET',
        headers: {
          'User-Agent': 'StarDreamAnimation'
        }
      }

      const req = protocol.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(new Error(`Parse JSON failed: ${data.substring(0, 100)}`))
          }
        })
      })

      req.on('error', reject)
      req.setTimeout(30000, () => {
        req.destroy()
        reject(new Error('Request timeout'))
      })
      req.end()
    })
  }

  private async downloadFile(urlStr: string, destPath: string, onProgress?: (progress: DownloadProgress) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const urlInfo = this.parseUrl(urlStr)
      const protocol = urlInfo.protocol === 'https:' ? https : http

      const options = {
        hostname: urlInfo.hostname,
        port: urlInfo.port,
        path: urlInfo.path,
        method: 'GET',
        headers: {
          'User-Agent': 'StarDreamAnimation'
        }
      }

      const req = protocol.request(options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed, status code: ${res.statusCode}`))
          return
        }

        const totalSize = parseInt(res.headers['content-length'] || '0', 10)
        let downloadedSize = 0
        const fileStream = fs.createWriteStream(destPath)
        let lastSampleAt = Date.now()
        let lastSampleBytes = 0
        let smoothedBps = 0

        res.on('data', (chunk: Buffer) => {
          downloadedSize += chunk.length
          if (onProgress && totalSize > 0) {
            const now = Date.now()
            const dt = (now - lastSampleAt) / 1000
            if (dt >= 0.25) {
              const instant = (downloadedSize - lastSampleBytes) / Math.max(dt, 1e-6)
              smoothedBps = smoothedBps === 0 ? instant : smoothedBps * 0.65 + instant * 0.35
              lastSampleAt = now
              lastSampleBytes = downloadedSize
            }
            onProgress({
              percent: (downloadedSize / totalSize) * 100,
              transferred: downloadedSize,
              total: totalSize,
              bytesPerSecond: smoothedBps
            })
          }
        })

        res.pipe(fileStream)
        fileStream.on('finish', () => {
          fileStream.close()
          resolve()
        })
      })

      req.on('error', reject)
      req.setTimeout(300000, () => {
        req.destroy()
        reject(new Error('Download timeout'))
      })
      req.end()
    })
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(p => parseInt(p, 10) || 0)
    const parts2 = v2.split('.').map(p => parseInt(p, 10) || 0)

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0
      const p2 = parts2[i] || 0
      if (p1 > p2) return 1
      if (p1 < p2) return -1
    }
    return 0
  }

  async checkForUpdates(): Promise<{ success: boolean; message?: string }> {
    try {
      log.info('开始检查更新...')
      this.sendStatus('checking')

      const latestJson = await this.fetchJson<LatestJson>(this.updateUrl)
      log.info(`获取到最新版本信息: ${JSON.stringify(latestJson)}`)

      const currentVersion = app.getVersion()
      log.info(`当前版本: ${currentVersion}, 最新版本: ${latestJson.version}`)

      if (this.compareVersions(latestJson.version, currentVersion) > 0) {
        const baseUrl = this.updateUrl.substring(0, this.updateUrl.lastIndexOf('/') + 1)
        this.updateInfo = {
          version: latestJson.version,
          releaseDate: latestJson.releaseDate,
          releaseNotes: latestJson.releaseNotes,
          downloadUrl: baseUrl + latestJson.files[0].url,
          fileSize: latestJson.files[0].size,
          sha512: latestJson.files[0].sha512
        }

        log.info('发现新版本:', this.updateInfo.version)
        this.sendStatus('available', {
          version: this.updateInfo.version,
          releaseDate: this.updateInfo.releaseDate,
          releaseNotes: this.updateInfo.releaseNotes
        })

        return { success: true, message: `发现新版本 ${this.updateInfo.version}` }
      } else {
        log.info('已是最新版本')
        this.sendStatus('not-available')
        return { success: true, message: '已是最新版本' }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '检查更新失败'
      log.error('检查更新失败:', message)
      this.sendStatus('error', { message })
      return { success: false, message }
    }
  }

  async downloadUpdate(): Promise<{ success: boolean; message?: string }> {
    if (!this.updateInfo) {
      return { success: false, message: '没有可用更新' }
    }

    try {
      log.info('开始下载更新...')
      this.sendStatus('downloading', { percent: 0, transferred: 0, total: this.updateInfo.fileSize, bytesPerSecond: 0 })

      const tempDir = path.join(app.getPath('temp'), 'ai-video-generator-updater')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      this.downloadedFilePath = path.join(tempDir, 'update-installer.exe')

      await this.downloadFile(this.updateInfo.downloadUrl, this.downloadedFilePath, (progress) => {
        this.sendStatus('downloading', {
          percent: progress.percent,
          transferred: progress.transferred,
          total: progress.total,
          bytesPerSecond: progress.bytesPerSecond
        })
      })

      log.info('下载完成')
      this.sendStatus('downloaded', { version: this.updateInfo!.version })
      return { success: true, message: '下载完成' }
    } catch (error) {
      const message = error instanceof Error ? error.message : '下载失败'
      log.error('下载更新失败:', message)
      this.sendStatus('error', { message })
      return { success: false, message }
    }
  }

  quitAndInstall() {
    if (!this.downloadedFilePath || !this.updateInfo) {
      log.error('安装失败：文件路径不存在')
      return
    }

    log.info('退出并安装更新（图形安装向导）...')
    
    // 先设置标志，告诉主进程这是更新操作，不要显示确认对话框
    if (this.onPrepareQuitForUpdate) {
      this.onPrepareQuitForUpdate()
    }
    
    // 给一点时间确保标志被设置
    setTimeout(() => {
      const { spawn } = require('child_process')
      // 勿使用 NSIS `/S`，否则为静默安装，用户看不到安装界面
      spawn(this.downloadedFilePath, [], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      }).unref()
      app.quit()
    }, 100)
  }

  getCurrentVersion(): { version: string; buildNumber: number } {
    return {
      version: app.getVersion(),
      buildNumber: 1
    }
  }
}

export const updaterManager = new UpdaterManager()

export function setupUpdaterIPC(mainWindow: BrowserWindow, onPrepareQuitForUpdate?: () => void) {
  updaterManager.setMainWindow(mainWindow)
  if (onPrepareQuitForUpdate) {
    updaterManager.setPrepareQuitCallback(onPrepareQuitForUpdate)
  }

  ipcMain.handle('check-for-updates', async () => {
    return await updaterManager.checkForUpdates()
  })

  ipcMain.handle('download-update', async () => {
    return await updaterManager.downloadUpdate()
  })

  ipcMain.handle('install-update', () => {
    updaterManager.quitAndInstall()
  })

  ipcMain.handle('get-current-version', () => {
    return updaterManager.getCurrentVersion()
  })
}

export default updaterManager