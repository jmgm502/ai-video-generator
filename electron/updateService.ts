import axios from 'axios'
import log from 'electron-log'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, createWriteStream, unlinkSync } from 'fs'
import * as fs from 'fs'
import * as path from 'path'
import https from 'https'
import http from 'http'

export interface VersionInfo {
  version: string
  buildNumber: number
  releaseDate: string
  releaseNotes: string
  downloadUrl: string
  fileList: string[]
  checksum: string
}

export interface DownloadProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

class UpdateService {
  private ossConfig: {
    region: string
    bucket: string
    accessKeyId: string
    accessKeySecret: string
  } | null = null

  private currentVersion: string = '1.0.0'
  private currentBuildNumber: number = 1

  constructor() {
    this.currentVersion = app.getVersion()
    try {
      const versionFile = join(app.getAppPath(), 'version.json')
      if (existsSync(versionFile)) {
        const content = fs.readFileSync(versionFile, 'utf-8')
        const versionInfo = JSON.parse(content)
        this.currentBuildNumber = versionInfo.buildNumber || 1
      }
    } catch (error) {
      log.error('读取版本文件失败:', error)
    }
  }

  private getVersionInfo(): { version: string; buildNumber: number } {
    try {
      const versionFile = join(app.getAppPath(), 'version.json')
      if (existsSync(versionFile)) {
        const content = fs.readFileSync(versionFile, 'utf-8')
        const versionInfo = JSON.parse(content)
        return {
          version: app.getVersion(),
          buildNumber: versionInfo.buildNumber || 1
        }
      }
    } catch (error) {
      log.error('读取版本文件失败:', error)
    }
    return {
      version: app.getVersion(),
      buildNumber: 1
    }
  }

  setOssConfig(config: {
    region: string
    bucket: string
    accessKeyId: string
    accessKeySecret: string
  }) {
    this.ossConfig = config
    log.info('OSS配置已更新')
  }

  getCurrentVersion(): { version: string; buildNumber: number } {
    return this.getVersionInfo()
  }

  getUpdateLogs(): { version: string; date: string; notes: string }[] {
    try {
      const logsFile = join(app.getAppPath(), 'update-logs.json')
      if (existsSync(logsFile)) {
        const content = fs.readFileSync(logsFile, 'utf-8')
        const logs = JSON.parse(content)
        const result: { version: string; date: string; notes: string }[] = []
        for (const [version, info] of Object.entries(logs)) {
          const logInfo = info as { date?: string; notes?: string }
          result.push({
            version,
            date: logInfo.date || '',
            notes: logInfo.notes || ''
          })
        }
        return result.sort((a, b) => {
          const partsA = a.version.split('.').map(Number)
          const partsB = b.version.split('.').map(Number)
          for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const pA = partsA[i] || 0
            const pB = partsB[i] || 0
            if (pA > pB) return -1
            if (pA < pB) return 1
          }
          return 0
        })
      }
    } catch (error) {
      log.error('读取更新日志失败:', error)
    }
    return []
  }

  getUpdateNotesForVersion(version: string): string {
    try {
      const logsFile = join(app.getAppPath(), 'update-logs.json')
      if (existsSync(logsFile)) {
        const content = fs.readFileSync(logsFile, 'utf-8')
        const logs = JSON.parse(content)
        const logInfo = logs[version] as { notes?: string } | undefined
        return logInfo?.notes || ''
      }
    } catch (error) {
      log.error('读取更新日志失败:', error)
    }
    return ''
  }

  async checkForUpdate(ossEndpoint: string, versionPath: string): Promise<{
    hasUpdate: boolean
    versionInfo?: VersionInfo
    error?: string
  }> {
    if (!ossEndpoint || !versionPath) {
      return { hasUpdate: false, error: 'OSS配置不完整' }
    }

    try {
      const versionUrl = this.buildOssUrl(ossEndpoint, versionPath)
      log.info('检查更新，版本文件URL:', versionUrl)

      const response = await axios.get(versionUrl, { timeout: 10000 })
      const remoteVersion: VersionInfo = response.data

      log.info('远程版本:', remoteVersion.version, '本地版本:', this.currentVersion)
      log.info('远程构建号:', remoteVersion.buildNumber, '本地构建号:', this.currentBuildNumber)

      const hasUpdate = this.compareVersion(remoteVersion.version, this.currentVersion) > 0 ||
        (remoteVersion.version === this.currentVersion && remoteVersion.buildNumber > this.currentBuildNumber)

      if (hasUpdate) {
        return { hasUpdate: true, versionInfo: remoteVersion }
      }

      return { hasUpdate: false }
    } catch (error) {
      log.error('检查更新失败:', error)
      return { hasUpdate: false, error: error instanceof Error ? error.message : '检查更新失败' }
    }
  }

  async checkForUpdateViaApi(apiUrl: string): Promise<{
    hasUpdate: boolean
    versionInfo?: VersionInfo
    error?: string
  }> {
    try {
      const currentVersion = this.getVersionInfo()
      const separator = apiUrl.includes('?') ? '&' : '?'
      const fullUrl = `${apiUrl}${separator}version=${currentVersion.version}&buildNumber=${currentVersion.buildNumber}`

      log.info('=== 检查更新调试信息 ===')
      log.info('API URL:', fullUrl)
      log.info('当前版本:', currentVersion.version, '构建号:', currentVersion.buildNumber)

      const response = await axios.get(fullUrl, { timeout: 10000 })
      const data = response.data

      log.info('API响应:', JSON.stringify(data))

      if (data.success && data.data && data.data.versionInfo) {
        const remoteVersion = data.data.versionInfo
        log.info('远程版本:', remoteVersion.version, '远程构建号:', remoteVersion.buildNumber)
        log.info('hasUpdate:', data.data.hasUpdate)

        return {
          hasUpdate: data.data.hasUpdate,
          versionInfo: remoteVersion
        }
      }

      return { hasUpdate: false, error: '无效的响应格式' }
    } catch (error) {
      log.error('API检查更新失败:', error)
      return { hasUpdate: false, error: error instanceof Error ? error.message : '检查更新失败' }
    }
  }

  private buildOssUrl(endpoint: string, key: string): string {
    endpoint = endpoint.replace(/\/$/, '')
    key = key.replace(/^\//, '')
    return `${endpoint}/${key}`
  }

  private compareVersion(remote: string, local: string): number {
    const remoteParts = remote.split('.').map(Number)
    const localParts = local.split('.').map(Number)

    for (let i = 0; i < Math.max(remoteParts.length, localParts.length); i++) {
      const remoteNum = remoteParts[i] || 0
      const localNum = localParts[i] || 0

      if (remoteNum > localNum) return 1
      if (remoteNum < localNum) return -1
    }

    return 0
  }

  async downloadUpdate(
    versionInfo: VersionInfo,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    if (!versionInfo.downloadUrl) {
      return { success: false, error: '下载链接无效' }
    }

    const tempDir = join(app.getPath('temp'), 'app-update')
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true })
    }

    const zipFileName = `update-${versionInfo.version}.zip`
    const zipFilePath = join(tempDir, zipFileName)

    try {
      log.info('开始下载更新包:', versionInfo.downloadUrl)

      await this.downloadFile(versionInfo.downloadUrl, zipFilePath, onProgress)

      log.info('下载完成，验证文件...')

      if (versionInfo.checksum) {
        const fileChecksum = await this.calculateChecksum(zipFilePath)
        if (fileChecksum !== versionInfo.checksum) {
          log.error('文件校验失败')
          log.error('期望:', versionInfo.checksum)
          log.error('实际:', fileChecksum)
          unlinkSync(zipFilePath)
          return { success: false, error: '文件校验失败' }
        }
        log.info('文件校验通过')
      }

      return { success: true, filePath: zipFilePath }
    } catch (error) {
      log.error('下载更新失败:', error)
      if (existsSync(zipFilePath)) {
        try { unlinkSync(zipFilePath) } catch {}
      }
      return { success: false, error: error instanceof Error ? error.message : '下载失败' }
    }
  }

  private async downloadFile(
    url: string,
    destPath: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http

      const request = protocol.get(url, {
        timeout: 30000
      }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            log.info('重定向到:', redirectUrl)
            this.downloadFile(redirectUrl, destPath, onProgress).then(resolve).catch(reject)
            return
          }
          reject(new Error('重定向但无location'))
          return
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`))
          return
        }

        const total = parseInt(response.headers['content-length'] || '0', 10)
        let downloaded = 0
        const file = createWriteStream(destPath)

        response.on('data', (chunk: Buffer) => {
          downloaded += chunk.length
          if (onProgress && total > 0) {
            onProgress({
              percent: (downloaded / total) * 100,
              transferred: downloaded,
              total,
              bytesPerSecond: 0
            })
          }
        })

        response.pipe(file)

        file.on('finish', () => {
          file.close()
          resolve()
        })

        response.on('error', (err) => {
          file.close()
          if (existsSync(destPath)) {
            try { unlinkSync(destPath) } catch {}
          }
          reject(err)
        })
      })

      request.on('error', reject)
      request.on('timeout', () => {
        request.destroy()
        reject(new Error('请求超时'))
      })
    })
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const crypto = require('crypto')
      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(filePath)

      stream.on('data', (data: Buffer) => hash.update(data))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  async extractUpdate(zipPath: string, targetDir: string): Promise<{ success: boolean; error?: string }> {
    try {
      log.info('解压更新包到:', targetDir)

      const extractDir = join(app.getPath('temp'), 'app-update-extract')
      const versionFile = join(extractDir, 'version.json')

      if (existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true })
      }
      if (!existsSync(extractDir)) {
        mkdirSync(extractDir, { recursive: true })
      }

      const AdmZip = require('adm-zip')
      const zip = new AdmZip(zipPath)
      zip.extractAllTo(extractDir, true)

      const appPath = app.getAppPath()
      log.info('复制文件到应用目录:', appPath)

      const entries = fs.readdirSync(extractDir, { withFileTypes: true })
      for (const entry of entries) {
        const srcPath = join(extractDir, entry.name)
        const destPath = join(appPath, entry.name)

        if (entry.isDirectory()) {
          if (!existsSync(destPath)) {
            mkdirSync(destPath, { recursive: true })
          }
          this.copyDirectoryRecursive(srcPath, destPath)
        } else {
          try {
            fs.copyFileSync(srcPath, destPath)
            log.info(`已更新: ${entry.name}`)
          } catch (error) {
            log.error(`复制文件失败 ${srcPath} -> ${destPath}:`, error)
          }
        }
      }

      log.info('更新文件复制完成')

      try {
        if (existsSync(zipPath)) {
          unlinkSync(zipPath)
          log.info('已删除临时zip文件')
        }
      } catch {}

      try {
        if (existsSync(extractDir)) {
          fs.rmSync(extractDir, { recursive: true, force: true })
          log.info('已删除临时解压目录')
        }
      } catch {}

      return { success: true }
    } catch (error) {
      log.error('解压更新失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '解压失败' }
    }
  }

  private copyDirectoryRecursive(src: string, dest: string) {
    if (!existsSync(src)) return

    const entries = fs.readdirSync(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        if (!existsSync(destPath)) {
          mkdirSync(destPath, { recursive: true })
        }
        this.copyDirectoryRecursive(srcPath, destPath)
      } else {
        try {
          fs.copyFileSync(srcPath, destPath)
        } catch (error) {
          log.error(`复制文件失败 ${srcPath} -> ${destPath}:`, error)
        }
      }
    }
  }
}

export const updateService = new UpdateService()
export default updateService