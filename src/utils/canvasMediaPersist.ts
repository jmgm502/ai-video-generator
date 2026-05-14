import { projectFileService } from '@/services/projectFileService'

/** 画布项目落盘分类：`canvas` → canvas-media/images；资产链人物/场景/道具 → assets 下对应目录 */
export type CanvasPersistGeneratedImageCategory =
  | 'canvas'
  | 'character'
  | 'scene'
  | 'prop'

/** 与 Step2 一致：磁盘绝对路径 → 供界面使用的 file URL */
export function toFileUrlFromDiskPath(savedPath: string): string {
  const normalized = savedPath.replace(/\\/g, '/')
  if (normalized.startsWith('file://')) return normalized
  return `file://${normalized}`
}

function guessImageExtFromDataUrl(dataUrl: string): string {
  const m = /^data:image\/([a-zA-Z0-9.+-]+);/i.exec(dataUrl)
  if (!m) return 'png'
  const t = m[1].toLowerCase()
  if (t === 'jpeg' || t === 'jpg') return 'jpg'
  if (t === 'webp') return 'webp'
  if (t === 'gif') return 'gif'
  return 'png'
}

function safeNodeIdForFile(nodeId: string): string {
  return nodeId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'node'
}

/**
 * 将 AI 返回的 data URL / 远程 URL 写入画布项目目录，返回 file://。
 * - 默认 `canvas`：canvas-media/images
 * - 人物/场景/道具资产链：`assets/characters|scenes|props`（与创作项目资产目录一致）
 * 已是 file:// 则不再写入；非 Electron 或保存失败时返回原始 url。
 */
export async function persistCanvasGeneratedImage(
  projectId: string,
  projectName: string,
  nodeId: string,
  imageUrl: string,
  saveCategory: CanvasPersistGeneratedImageCategory = 'canvas'
): Promise<string> {
  if (!imageUrl || !window.electronAPI?.project?.saveImage) return imageUrl
  const trimmedName = projectName.trim()
  if (!projectId || !trimmedName) return imageUrl
  if (imageUrl.startsWith('file://')) return imageUrl

  const extFromData = imageUrl.startsWith('data:') ? guessImageExtFromDataUrl(imageUrl) : ''
  const extFromUrl = !extFromData
    ? imageUrl.split('?')[0].split('.').pop()?.toLowerCase() || 'png'
    : extFromData
  const safeExt = extFromUrl === 'jpeg' ? 'jpg' : extFromUrl
  const prefix =
    saveCategory === 'canvas' ? 'canvas-img' : `canvas-asset-${saveCategory}`
  const fileName = `${prefix}-${safeNodeIdForFile(nodeId)}-${Date.now()}.${safeExt}`

  const res = await projectFileService.saveImage(
    projectId,
    trimmedName,
    saveCategory,
    fileName,
    imageUrl,
    'canvas'
  )
  if (res.success && res.path) return toFileUrlFromDiskPath(res.path)
  return imageUrl
}

/**
 * 将视频 data URL / 远程 URL 写入画布项目 `canvas-media/videos`，返回 file://。
 */
export async function persistCanvasGeneratedVideo(
  projectId: string,
  projectName: string,
  nodeId: string,
  videoUrl: string
): Promise<string> {
  if (!videoUrl || !window.electronAPI?.project?.saveVideo) return videoUrl
  const trimmedName = projectName.trim()
  if (!projectId || !trimmedName) return videoUrl
  if (videoUrl.startsWith('file://')) return videoUrl

  const fileName = `canvas-vid-${safeNodeIdForFile(nodeId)}-${Date.now()}.mp4`
  const res = await projectFileService.saveVideo(projectId, trimmedName, fileName, videoUrl, 'canvas')
  if (res.success && res.path) {
    return res.path.startsWith('file://') ? res.path : toFileUrlFromDiskPath(res.path)
  }
  return videoUrl
}
