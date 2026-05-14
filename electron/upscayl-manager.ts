import { spawn, ChildProcess } from 'child_process'
import { join, dirname } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { app } from 'electron'
import log from 'electron-log'

export interface UpscaleOptions {
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

export interface UpscaleModel {
  id: string
  name: string
  description: string
  scale: string
}

export const UPSCALE_MODELS: UpscaleModel[] = [
  { id: 'upscayl-standard-4x', name: 'Upscayl Standard 4x', description: '通用标准模型', scale: '4' },
  { id: 'upscayl-lite-4x', name: 'Upscayl Lite 4x', description: '轻量快速模型', scale: '4' },
  { id: 'high-fidelity-4x', name: 'High Fidelity 4x', description: '高保真模型', scale: '4' },
  { id: 'remacri-4x', name: 'Remacri 4x', description: '锐化增强模型', scale: '4' },
  { id: 'ultramix-balanced-4x', name: 'Ultramix Balanced 4x', description: '平衡混合模型', scale: '4' },
  { id: 'ultrasharp-4x', name: 'Ultrasharp 4x', description: '超锐利模型', scale: '4' },
  { id: 'digital-art-4x', name: 'Digital Art 4x', description: '数字艺术/动漫模型', scale: '4' },
]

function getModelScale(model: string): string {
  const modelName = model.toLowerCase()
  if (modelName.includes('x2') || modelName.includes('2x')) return '2'
  if (modelName.includes('x3') || modelName.includes('3x')) return '3'
  return '4'
}

let childProcess: ChildProcess | null = null

function getUpscaylBinPath(): string {
  const isDev = !app.isPackaged
  if (isDev) {
    return join(process.cwd(), 'resources', 'upscayl', 'bin', 'upscayl-bin.exe')
  }
  const appPath = process.resourcesPath
  return join(appPath, 'upscayl', 'bin', 'upscayl-bin.exe')
}

function getModelsPath(): string {
  const isDev = !app.isPackaged
  if (isDev) {
    return join(process.cwd(), 'resources', 'upscayl', 'models')
  }
  const appPath = process.resourcesPath
  return join(appPath, 'upscayl', 'models')
}

function buildCommand(options: UpscaleOptions): string[] {
  const modelScale = getModelScale(options.model)
  const userScale = options.scale || '4'
  const includeScale = modelScale !== userScale && !options.customWidth

  const args: string[] = [
    '-i', options.inputPath,
    '-o', options.outputPath,
    '-m', getModelsPath(),
    '-n', options.model,
  ]

  if (includeScale) {
    args.push('-s', userScale)
  }

  args.push('-f', options.format || 'png')

  if (options.gpuId) {
    args.push('-g', options.gpuId)
  }

  if (options.tileSize) {
    args.push('-t', options.tileSize.toString())
  }

  if (options.compression) {
    args.push('-c', options.compression)
  }

  if (options.ttaMode) {
    args.push('-x')
  }

  if (options.customWidth) {
    args.push('-w', options.customWidth)
  }

  return args.filter(arg => arg !== '')
}

export function upscaleImage(
  options: UpscaleOptions,
  onProgress: (data: { type: string; message?: string; progress?: number; outputPath?: string }) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const binPath = getUpscaylBinPath()
    
    log.info('🔍 Upscayl binary path:', binPath)
    
    if (!existsSync(binPath)) {
      onProgress({ type: 'error', message: '找不到 Upscayl 二进制文件' })
      reject(new Error('Upscayl binary not found'))
      return
    }

    if (!existsSync(options.inputPath)) {
      onProgress({ type: 'error', message: '输入文件不存在' })
      reject(new Error('Input file not found'))
      return
    }

    const outputDir = dirname(options.outputPath)
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }

    const args = buildCommand(options)
    log.info('🚀 Upscayl Command:', binPath, args.join(' '))

    childProcess = spawn(binPath, args)

    childProcess.stdout?.on('data', (data) => {
      const output = data.toString()
      log.info('📤 Upscayl Output:', output)

      if (output.includes('Resizing')) {
        onProgress({ type: 'scaling', message: '正在缩放和转换...' })
      }

      const progressMatch = output.match(/(\d+)%/)
      if (progressMatch) {
        const progress = parseInt(progressMatch[1])
        onProgress({ type: 'progress', progress, message: `处理中... ${progress}%` })
      }
    })

    childProcess.stderr?.on('data', (data) => {
      const output = data.toString()
      
      if (output.includes('queueC=') || output.includes('fp16=') || 
          output.includes('GPU') || output.includes('vulkan') ||
          output.includes('NVIDIA') || output.includes('AMD') ||
          output.includes('Intel') || output.match(/^[\s\-\|0-9]+$/)) {
        log.info('🔧 Upscayl GPU Info:', output.trim())
        return
      }
      
      const progressMatch = output.match(/(\d+\.?\d*)\s*%/)
      if (progressMatch) {
        const progress = parseFloat(progressMatch[1])
        if (progress >= 0 && progress <= 100) {
          onProgress({ type: 'progress', progress, message: `处理中... ${Math.floor(progress)}%` })
          return
        }
      }
      
      if (output.includes('Error') || output.includes('failed') || output.includes('ERROR')) {
        log.error('❌ Upscayl Error:', output)
        onProgress({ type: 'error', message: output })
        return
      }
      
      if (output.includes('Upscayled Successfully')) {
        log.info('✅ Upscayl Success:', output.trim())
        return
      }
      
      log.info('📤 Upscayl Info:', output.trim())
    })

    childProcess.on('close', (code) => {
      childProcess = null
      if (code === 0) {
        onProgress({ type: 'done', message: '处理完成', outputPath: options.outputPath })
        resolve(options.outputPath)
      } else {
        onProgress({ type: 'error', message: `处理失败，退出码: ${code}` })
        reject(new Error(`Upscayl failed with code ${code}`))
      }
    })

    childProcess.on('error', (err) => {
      childProcess = null
      onProgress({ type: 'error', message: `启动失败: ${err.message}` })
      reject(err)
    })
  })
}

export function stopUpscale(): void {
  if (childProcess) {
    childProcess.kill()
    childProcess = null
    log.info('⏹️ Upscayl process stopped')
  }
}

export function isUpscaling(): boolean {
  return childProcess !== null
}

export function checkUpscaylAvailable(): boolean {
  const binPath = getUpscaylBinPath()
  return existsSync(binPath)
}

export function getAvailableModels(): UpscaleModel[] {
  return UPSCALE_MODELS
}
