/**
 * 生成分镜「线框格」垫图（白底 + 内部分割线），作为生图 API 的参考图之一，约束宫格结构。
 * 与 F:\\8.gongzuoliu StoryboardGenNode 中 generateGridImageDataUrl 行为对齐。
 */

/**
 * 从单格内长文本推断「Grid」条数（如 Grid1…Grid4；兼容旧文「镜头 N」）。
 * 取到的最大编号 ≥2 时认为需多格线框；否则返回 0（不覆盖物理格子）。
 */
export function inferShotsFromStoryboardText(text: string): number {
  const t = String(text ?? '').trim()
  if (!t) return 0
  let maxN = 0
  let m: RegExpExecArray | null

  const reGrid = /Grid\s*[\s:：*＊]?\s*(\d{1,2})/gi
  while ((m = reGrid.exec(t)) !== null) {
    const n = parseInt(m[1], 10)
    if (n >= 1 && n <= 32) maxN = Math.max(maxN, n)
  }
  if (maxN >= 2) return maxN

  const reShot = /镜头[\s:：*＊]?\s*(\d{1,2})/g
  while ((m = reShot.exec(t)) !== null) {
    const n = parseInt(m[1], 10)
    if (n >= 1 && n <= 32) maxN = Math.max(maxN, n)
  }
  if (maxN >= 2) return maxN
  return 0
}

/**
 * 将 Grid（格子）条数映射为线框垫图行列（与画布多格时的 computeGridShape 思路一致，与 8.gongzuoliu 观感对齐）。
 */
export function computePadGridForShotCount(shotCount: number): { rows: number; cols: number } {
  const n = Math.max(2, Math.min(36, Math.round(shotCount)))
  const cols = Math.max(1, Math.min(6, n <= 3 ? n : Math.ceil(Math.sqrt(n))))
  const rows = Math.max(1, Math.min(6, Math.ceil(n / cols)))
  return { rows, cols }
}

const DEFAULT_LINE_THICKNESS_PERCENT = 0.4

function resolveQualityToBaseWidthPx(quality: '1K' | '2K' | '4K'): number {
  const map: Record<string, number> = { '1K': 1024, '2K': 2048, '4K': 4096 }
  return map[quality] ?? 1024
}

/**
 * @param aspectRatio 如 16:9、1:1
 * @param rows 行数 1~6
 * @param cols 列数 1~6
 * @param quality 与分镜节点画质一致，决定画布长边基准像素
 */
export function generateStoryboardGridDataUrl(
  aspectRatio: string,
  rows: number,
  cols: number,
  quality: '1K' | '2K' | '4K',
  lineThicknessPercent: number = DEFAULT_LINE_THICKNESS_PERCENT
): string {
  const safeRows = Math.max(1, Math.min(6, Math.round(rows)))
  const safeCols = Math.max(1, Math.min(6, Math.round(cols)))

  const [wStr, hStr] = aspectRatio.split(':')
  const rw = parseFloat(String(wStr ?? '16'))
  const rh = parseFloat(String(hStr ?? '9'))
  const ratioW = Number.isFinite(rw) && rw > 0 ? rw : 16
  const ratioH = Number.isFinite(rh) && rh > 0 ? rh : 9

  const totalPixels = resolveQualityToBaseWidthPx(quality)
  const canvasWidth = totalPixels
  const canvasHeight = Math.round(totalPixels * (ratioH / ratioW))

  const thickness = Math.max(
    1,
    Math.round((Math.min(canvasWidth, canvasHeight) * lineThicknessPercent) / 100)
  )
  const cellWidth = canvasWidth / safeCols
  const cellHeight = canvasHeight / safeRows

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('无法创建 canvas 2d 上下文')
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = thickness

  for (let i = 1; i < safeCols; i += 1) {
    const x = i * cellWidth
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, canvasHeight)
    ctx.stroke()
  }
  for (let i = 1; i < safeRows; i += 1) {
    const y = i * cellHeight
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(canvasWidth, y)
    ctx.stroke()
  }

  return canvas.toDataURL('image/png')
}
