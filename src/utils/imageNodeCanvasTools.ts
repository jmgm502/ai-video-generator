/** 图片节点工具：裁剪 / 切割（Canvas，对齐 gongzuoliu toolProcessor 本地回退逻辑） */

export function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png')
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('无法加载图片'))
    img.src = src
  })
}

export function parseAspectRatioString(aspect: string): number {
  if (!aspect || aspect === 'free') return Number.NaN
  const [rawW, rawH] = aspect.split(':').map((s) => Number(s.trim()))
  if (!Number.isFinite(rawW) || !Number.isFinite(rawH) || rawW <= 0 || rawH <= 0) {
    return Number.NaN
  }
  return rawW / rawH
}

/** 按中心区域裁成目标比例（与 gongzuoliu crop 回退一致） */
export async function cropImageCenterByAspect(
  source: string,
  aspect: string
): Promise<string> {
  const image = await loadImageElement(source)
  const targetRatio = parseAspectRatioString(aspect)
  let cropWidth = image.naturalWidth
  let cropHeight = image.naturalHeight
  let offsetX = 0
  let offsetY = 0

  if (aspect === 'free' || !Number.isFinite(targetRatio)) {
    offsetX = 0
    offsetY = 0
    cropWidth = image.naturalWidth
    cropHeight = image.naturalHeight
  } else {
    const sourceRatio = image.naturalWidth / image.naturalHeight
    if (sourceRatio > targetRatio) {
      cropWidth = image.naturalHeight * targetRatio
    } else {
      cropHeight = image.naturalWidth / targetRatio
    }
    offsetX = (image.naturalWidth - cropWidth) / 2
    offsetY = (image.naturalHeight - cropHeight) / 2
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(cropWidth))
  canvas.height = Math.max(1, Math.floor(cropHeight))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法初始化画布')
  ctx.drawImage(
    image,
    offsetX,
    offsetY,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height
  )
  return canvasToDataUrl(canvas)
}

/** 按像素矩形裁剪（自然尺寸坐标） */
export async function cropImagePixelRect(
  source: string,
  cropX: number,
  cropY: number,
  cropWidth: number,
  cropHeight: number
): Promise<string> {
  const image = await loadImageElement(source)
  const offsetX = Math.min(image.naturalWidth - 1, Math.max(0, Math.floor(cropX)))
  const offsetY = Math.min(image.naturalHeight - 1, Math.max(0, Math.floor(cropY)))
  const cw = Math.max(1, Math.min(Math.floor(cropWidth), image.naturalWidth - offsetX))
  const ch = Math.max(1, Math.min(Math.floor(cropHeight), image.naturalHeight - offsetY))

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法初始化画布')
  ctx.drawImage(image, offsetX, offsetY, cw, ch, 0, 0, cw, ch)
  return canvasToDataUrl(canvas)
}

function splitIntoSegments(totalSize: number, segmentCount: number): number[] {
  const baseSize = Math.floor(totalSize / segmentCount)
  const remainder = totalSize % segmentCount
  return Array.from(
    { length: segmentCount },
    (_item, index) => baseSize + (index < remainder ? 1 : 0)
  )
}

function resolveMaxAllowedLineThickness(
  imageWidth: number,
  imageHeight: number,
  rows: number,
  cols: number
): number {
  const maxLineByWidth = cols > 1 ? Math.floor((imageWidth - cols) / (cols - 1)) : Number.MAX_SAFE_INTEGER
  const maxLineByHeight = rows > 1 ? Math.floor((imageHeight - rows) / (rows - 1)) : Number.MAX_SAFE_INTEGER
  return Math.max(0, Math.min(maxLineByWidth, maxLineByHeight))
}

function resolveSplitLineThicknessPx(
  imageWidth: number,
  imageHeight: number,
  rows: number,
  cols: number,
  lineThicknessPercent: number
): number {
  if (!Number.isFinite(lineThicknessPercent) || lineThicknessPercent <= 0) return 0
  const basis = Math.max(1, Math.min(imageWidth, imageHeight))
  const raw = Math.max(1, Math.round((basis * lineThicknessPercent) / 100))
  const maxAllowed = resolveMaxAllowedLineThickness(imageWidth, imageHeight, rows, cols)
  return Math.max(0, Math.min(raw, maxAllowed))
}

/**
 * 目标分割线约 targetPx 像素时对应的百分比（与 resolveSplitLineThicknessPx 同 basis：短边）。
 * 用于切割弹窗默认「约 2px」；限制在 0~3 与滑块一致。
 */
export function lineThicknessPercentForTargetLinePx(
  imageWidth: number,
  imageHeight: number,
  targetPx: number
): number {
  const basis = Math.max(1, Math.min(imageWidth, imageHeight))
  if (!Number.isFinite(targetPx) || targetPx <= 0) return 0.2
  const p = (targetPx * 100) / basis
  return Math.max(0, Math.min(3, Math.round(p * 100) / 100))
}

export interface SplitGridLayout {
  lineThickness: number
  columnWidths: number[]
  rowHeights: number[]
  xOffsets: number[]
  yOffsets: number[]
  naturalWidth: number
  naturalHeight: number
}

/** 计算切割网格（与 splitImageToCells 一致），供弹窗预览与说明 */
export function computeSplitGridLayout(
  iw: number,
  ih: number,
  rows: number,
  cols: number,
  lineThicknessPercent: number
): SplitGridLayout {
  const safeRows = Math.max(1, Math.floor(rows))
  const safeCols = Math.max(1, Math.floor(cols))
  const natW = Math.max(1, Math.floor(iw))
  const natH = Math.max(1, Math.floor(ih))

  const lineThickness = resolveSplitLineThicknessPx(natW, natH, safeRows, safeCols, lineThicknessPercent)
  const usableWidth = natW - (safeCols - 1) * lineThickness
  const usableHeight = natH - (safeRows - 1) * lineThickness
  if (usableWidth < safeCols || usableHeight < safeRows) {
    throw new Error('分割线过粗，无法完成切割')
  }

  const columnWidths = splitIntoSegments(usableWidth, safeCols)
  const rowHeights = splitIntoSegments(usableHeight, safeRows)

  const yOffsets: number[] = []
  let yCursor = 0
  for (let row = 0; row < safeRows; row += 1) {
    yOffsets.push(yCursor)
    yCursor += rowHeights[row]
    if (row < safeRows - 1) yCursor += lineThickness
  }

  const xOffsets: number[] = []
  let xCursor = 0
  for (let col = 0; col < safeCols; col += 1) {
    xOffsets.push(xCursor)
    xCursor += columnWidths[col]
    if (col < safeCols - 1) xCursor += lineThickness
  }

  return {
    lineThickness,
    columnWidths,
    rowHeights,
    xOffsets,
    yOffsets,
    naturalWidth: natW,
    naturalHeight: natH
  }
}

/** 九宫格切割，返回每格 data URL（与 gongzuoliu localSplit 一致） */
export async function splitImageToCells(
  sourceImage: string,
  rows: number,
  cols: number,
  lineThicknessPercent: number
): Promise<string[]> {
  const image = await loadImageElement(sourceImage)
  const safeRows = Math.max(1, Math.floor(rows))
  const safeCols = Math.max(1, Math.floor(cols))
  const iw = Math.max(1, image.naturalWidth)
  const ih = Math.max(1, image.naturalHeight)

  const { lineThickness, columnWidths, rowHeights, xOffsets, yOffsets } = computeSplitGridLayout(
    iw,
    ih,
    safeRows,
    safeCols,
    lineThicknessPercent
  )

  const results: string[] = []
  for (let row = 0; row < safeRows; row += 1) {
    for (let col = 0; col < safeCols; col += 1) {
      const targetWidth = columnWidths[col]
      const targetHeight = rowHeights[row]
      const canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = targetHeight
      const context = canvas.getContext('2d')
      if (!context) throw new Error('无法初始化画布')
      context.drawImage(
        image,
        xOffsets[col],
        yOffsets[row],
        targetWidth,
        targetHeight,
        0,
        0,
        targetWidth,
        targetHeight
      )
      results.push(canvasToDataUrl(canvas))
    }
  }
  return results
}

/**
 * 与 ImageSplitResultNode 中栅格 + `.split-cell-img` 一致：
 * 根宽 520（border-box）、卡片左右各 1px 边框、正文 padding 12×2 → 内容宽 494；列 gap 10；图片区高度 140、`object-fit: contain`。
 * 合并时每格尺寸统一，任意替换图按「在格内完整显示、等比缩放、居中、余量背景 #0a0a0c」绘制，与界面一致。
 */
export const SPLIT_RESULT_MERGE_CONTENT_WIDTH = 494
export const SPLIT_RESULT_MERGE_GRID_GAP_PX = 10
export const SPLIT_RESULT_MERGE_CELL_MAX_HEIGHT_PX = 140

/** 在矩形内按 CSS `object-fit: contain` 绘制（居中、等比缩放） */
function drawImageObjectFitContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
): void {
  const sw = img.naturalWidth
  const sh = img.naturalHeight
  if (!sw || !sh) return
  const scale = Math.min(dw / sw, dh / sh)
  const w = sw * scale
  const h = sh * scale
  const x = dx + (dw - w) / 2
  const y = dy + (dh - h) / 2
  ctx.drawImage(img, x, y, w, h)
}

/**
 * 将各分镜格拼成一张图，布局与切割结果节点内展示逻辑一致（见上方面积常量）。
 * 各格原始分辨率可不同，导出效果与节点内「宽度铺满列、高度不超过 140、contain」一致。
 */
export async function mergeCellsToGridImage(
  cellDataUrls: string[],
  cols: number,
  rows: number,
  gap: number = SPLIT_RESULT_MERGE_GRID_GAP_PX
): Promise<string> {
  const images = await Promise.all(cellDataUrls.map((u) => loadImageElement(u)))
  if (images.length === 0) throw new Error('无切割结果')
  const safeCols = Math.max(1, Math.floor(cols))
  const safeRows = Math.max(1, Math.floor(rows))
  const innerW = SPLIT_RESULT_MERGE_CONTENT_WIDTH
  const cellH = SPLIT_RESULT_MERGE_CELL_MAX_HEIGHT_PX
  const totalGapW = (safeCols - 1) * gap
  const cellW = (innerW - totalGapW) / safeCols
  if (cellW <= 0) throw new Error('列数过多，单格宽度无效')

  const outW = Math.max(1, Math.round(safeCols * cellW + totalGapW))
  const outH = Math.max(1, Math.round(safeRows * cellH + (safeRows - 1) * gap))

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法初始化画布')
  ctx.fillStyle = '#0a0a0c'
  ctx.fillRect(0, 0, outW, outH)

  let i = 0
  for (let row = 0; row < safeRows; row += 1) {
    for (let col = 0; col < safeCols; col += 1) {
      if (i >= images.length) break
      const x = col * (cellW + gap)
      const y = row * (cellH + gap)
      drawImageObjectFitContain(ctx, images[i], x, y, cellW, cellH)
      i += 1
    }
  }
  return canvasToDataUrl(canvas)
}
