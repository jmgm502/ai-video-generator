import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'

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

export interface UpscaleProgress {
  type: 'progress' | 'error' | 'done' | 'scaling'
  message?: string
  progress?: number
  outputPath?: string
}

export type UpscaleCallback = (progress: UpscaleProgress) => void

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

let childProcess: ChildProcess | null = null

function getUpscaylBinPath(): string {
  if (import.meta.env.DEV) {
    return path.join(process.cwd(), 'resources', 'upscayl', 'bin', 'upscayl-bin.exe')
  }
  const appPath = process.resourcesPath
  return path.join(appPath, 'upscayl', 'bin', 'upscayl-bin.exe')
}

function getModelsPath(): string {
  if (import.meta.env.DEV) {
    return path.join(process.cwd(), 'resources', 'upscayl', 'models')
  }
  const appPath = process.resourcesPath
  return path.join(appPath, 'upscayl', 'models')
}

function getModelScale(model: string): string {
  const modelScaleMap: Record<string, string> = {
    'upscayl-standard-4x': '4',
    'upscayl-lite-4x': '4',
    'high-fidelity-4x': '4',
    'remacri-4x': '4',
    'ultramix-balanced-4x': '4',
    'ultrasharp-4x': '4',
    'digital-art-4x': '4',
  }
  return modelScaleMap[model] || '4'
}

function buildCommand(options: UpscaleOptions): string[] {
  const modelScale = getModelScale(options.model)
  const includeScale = modelScale !== (options.scale || '4') && !options.customWidth

  const args: string[] = [
    '-i', options.inputPath,
    '-o', options.outputPath,
    includeScale ? '-s' : '',
    includeScale ? (options.scale || '4') : '',
    '-m', getModelsPath(),
    '-n', options.model,
    options.gpuId ? '-g' : '',
    options.gpuId || '',
    '-f', options.format || 'png',
    options.customWidth ? '-w' : '',
    options.customWidth || '',
    '-c', options.compression || '0',
    options.tileSize ? '-t' : '',
    options.tileSize ? options.tileSize.toString() : '',
    options.ttaMode ? '-x' : '',
  ]

  return args.filter(arg => arg !== '')
}

export function upscaleImage(options: UpscaleOptions, callback: UpscaleCallback): Promise<string> {
  return new Promise((resolve, reject) => {
    const binPath = getUpscaylBinPath()
    
    if (!fs.existsSync(binPath)) {
      callback({ type: 'error', message: '找不到 Upscayl 二进制文件' })
      reject(new Error('Upscayl binary not found'))
      return
    }

    if (!fs.existsSync(options.inputPath)) {
      callback({ type: 'error', message: '输入文件不存在' })
      reject(new Error('Input file not found'))
      return
    }

    const outputDir = path.dirname(options.outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const args = buildCommand(options)
    console.log('🚀 Upscayl Command:', binPath, args.join(' '))

    childProcess = spawn(binPath, args)

    let progress = 0
    let finishedNormally = false

    const handleOutput = (raw: string, stream: 'stdout' | 'stderr') => {
      const output = raw.toString()
      console.log(stream === 'stderr' ? '📤 Upscayl STDERR:' : '📤 Upscayl STDOUT:', output)

      if (output.includes('Resizing')) {
        callback({ type: 'scaling', message: '正在缩放和转换...' })
      }

      const progressMatch = output.match(/(\d+(?:\.\d+)?)%/)
      if (progressMatch) {
        progress = Math.max(progress, Number.parseFloat(progressMatch[1]))
        callback({ type: 'progress', progress, message: `处理中... ${progressMatch[1]}%` })
      }
    }

    childProcess.stdout?.on('data', (data) => {
      handleOutput(data.toString(), 'stdout')
    })

    childProcess.stderr?.on('data', (data) => {
      handleOutput(data.toString(), 'stderr')
    })

    childProcess.on('close', (code) => {
      childProcess = null
      if (code === 0) {
        finishedNormally = true
        callback({ type: 'done', message: 'Upscayled Successfully!', outputPath: options.outputPath })
        resolve(options.outputPath)
      } else {
        callback({ type: 'error', message: `Upscayl process exited with code ${code}` })
        reject(new Error(`Upscayl failed with code ${code}`))
      }
    })

    childProcess.on('error', (err) => {
      childProcess = null
      callback({ type: 'error', message: `启动失败: ${err.message}` })
      reject(err)
    })
  })
}

export function stopUpscale(): void {
  if (childProcess) {
    childProcess.kill()
    childProcess = null
  }
}

export function isUpscaling(): boolean {
  return childProcess !== null
}

export function checkUpscaylAvailable(): boolean {
  const binPath = getUpscaylBinPath()
  return fs.existsSync(binPath)
}
