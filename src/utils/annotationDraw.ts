/** 与参考项目 gongzuoliu 标注结构对齐的 2D 画布绘制与命中测试 */

export type AnnotationToolType = 'rect' | 'ellipse' | 'arrow' | 'pen' | 'text'

export interface AnnotationStyle {
  stroke: string
  lineWidth: number
}

export interface RectAnnotation extends AnnotationStyle {
  id: string
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
}

export interface EllipseAnnotation extends AnnotationStyle {
  id: string
  type: 'ellipse'
  x: number
  y: number
  width: number
  height: number
}

export interface ArrowAnnotation extends AnnotationStyle {
  id: string
  type: 'arrow'
  points: [number, number, number, number]
}

export interface PenAnnotation extends AnnotationStyle {
  id: string
  type: 'pen'
  points: number[]
}

export interface TextAnnotation {
  id: string
  type: 'text'
  x: number
  y: number
  text: string
  color: string
  fontSize: number
}

export type AnnotationItem =
  | RectAnnotation
  | EllipseAnnotation
  | ArrowAnnotation
  | PenAnnotation
  | TextAnnotation

function drawArrowHead(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number
) {
  const headLength = Math.max(10, lineWidth * 4)
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const leftX = x2 - headLength * Math.cos(angle - Math.PI / 6)
  const leftY = y2 - headLength * Math.sin(angle - Math.PI / 6)
  const rightX = x2 - headLength * Math.cos(angle + Math.PI / 6)
  const rightY = y2 - headLength * Math.sin(angle + Math.PI / 6)

  context.beginPath()
  context.moveTo(x2, y2)
  context.lineTo(leftX, leftY)
  context.lineTo(rightX, rightY)
  context.closePath()
  context.fillStyle = color
  context.fill()
}

export function drawAnnotations(context: CanvasRenderingContext2D, items: AnnotationItem[]): void {
  for (const item of items) {
    if (item.type === 'rect') {
      context.save()
      context.strokeStyle = item.stroke
      context.lineWidth = item.lineWidth
      context.strokeRect(item.x, item.y, item.width, item.height)
      context.restore()
      continue
    }

    if (item.type === 'ellipse') {
      context.save()
      context.strokeStyle = item.stroke
      context.lineWidth = item.lineWidth
      context.beginPath()
      context.ellipse(
        item.x + item.width / 2,
        item.y + item.height / 2,
        Math.max(1, item.width / 2),
        Math.max(1, item.height / 2),
        0,
        0,
        Math.PI * 2
      )
      context.stroke()
      context.restore()
      continue
    }

    if (item.type === 'arrow') {
      const [ax1, ay1, ax2, ay2] = item.points
      context.save()
      context.strokeStyle = item.stroke
      context.lineWidth = item.lineWidth
      context.beginPath()
      context.moveTo(ax1, ay1)
      context.lineTo(ax2, ay2)
      context.stroke()
      drawArrowHead(context, ax1, ay1, ax2, ay2, item.stroke, item.lineWidth)
      context.restore()
      continue
    }

    if (item.type === 'pen') {
      if (item.points.length < 4) continue
      context.save()
      context.strokeStyle = item.stroke
      context.lineWidth = item.lineWidth
      context.lineJoin = 'round'
      context.lineCap = 'round'
      context.beginPath()
      context.moveTo(item.points[0], item.points[1])
      for (let i = 2; i < item.points.length; i += 2) {
        context.lineTo(item.points[i], item.points[i + 1])
      }
      context.stroke()
      context.restore()
      continue
    }

    if (item.type === 'text') {
      context.save()
      context.fillStyle = item.color
      context.font = `600 ${item.fontSize}px sans-serif`
      context.textBaseline = 'top'
      const lines = item.text.split('\n')
      const lineHeight = Math.max(1, Math.round(item.fontSize * 1.2))
      lines.forEach((line, index) => {
        context.fillText(line, item.x, item.y + index * lineHeight)
      })
      context.restore()
    }
  }
}

export type DraftShape =
  | { tool: 'rect' | 'ellipse'; x0: number; y0: number; x1: number; y1: number }
  | { tool: 'arrow'; x0: number; y0: number; x1: number; y1: number }

export function drawDraft(
  context: CanvasRenderingContext2D,
  draft: DraftShape,
  stroke: string,
  lineWidth: number
): void {
  const x0 = draft.x0
  const y0 = draft.y0
  const x1 = draft.x1
  const y1 = draft.y1
  const left = Math.min(x0, x1)
  const top = Math.min(y0, y1)
  const w = Math.abs(x1 - x0)
  const h = Math.abs(y1 - y0)

  context.save()
  context.strokeStyle = stroke
  context.lineWidth = lineWidth
  context.setLineDash([6, 4])

  if (draft.tool === 'rect') {
    context.strokeRect(left, top, w, h)
  } else if (draft.tool === 'ellipse') {
    context.beginPath()
    context.ellipse(left + w / 2, top + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2)
    context.stroke()
  } else {
    context.setLineDash([])
    context.beginPath()
    context.moveTo(x0, y0)
    context.lineTo(x1, y1)
    context.stroke()
    drawArrowHead(context, x0, y0, x1, y1, stroke, lineWidth)
  }
  context.restore()
}

function boundsFromPoints(points: number[]): { x: number; y: number; w: number; h: number } {
  const xs = points.filter((_, index) => index % 2 === 0)
  const ys = points.filter((_, index) => index % 2 === 1)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  return { x: minX, y: minY, w: Math.max(0, maxX - minX), h: Math.max(0, maxY - minY) }
}

export function getAnnotationBounds(item: AnnotationItem): { x: number; y: number; w: number; h: number } {
  if (item.type === 'rect' || item.type === 'ellipse') {
    return { x: item.x, y: item.y, w: item.width, h: item.height }
  }
  if (item.type === 'pen') {
    if (item.points.length < 2) return { x: 0, y: 0, w: 0, h: 0 }
    return boundsFromPoints(item.points)
  }
  if (item.type === 'arrow') {
    const [x1, y1, x2, y2] = item.points
    const minX = Math.min(x1, x2)
    const minY = Math.min(y1, y2)
    return { x: minX, y: minY, w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
  }
  const lines = item.text.split('\n')
  const lineHeight = Math.max(1, Math.round(item.fontSize * 1.2))
  let maxW = 0
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.font = `600 ${item.fontSize}px sans-serif`
    for (const line of lines) {
      maxW = Math.max(maxW, ctx.measureText(line || ' ').width)
    }
  } else {
    maxW = item.text.length * item.fontSize * 0.6
  }
  return {
    x: item.x,
    y: item.y,
    w: maxW,
    h: lines.length * lineHeight
  }
}

function distPointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-6) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const qx = x1 + t * dx
  const qy = y1 + t * dy
  return Math.hypot(px - qx, py - qy)
}

export function hitTestAnnotation(px: number, py: number, item: AnnotationItem, pad = 6): boolean {
  if (item.type === 'rect') {
    return (
      px >= item.x - pad &&
      py >= item.y - pad &&
      px <= item.x + item.width + pad &&
      py <= item.y + item.height + pad
    )
  }
  if (item.type === 'ellipse') {
    const cx = item.x + item.width / 2
    const cy = item.y + item.height / 2
    const rx = Math.max(1, item.width / 2) + pad
    const ry = Math.max(1, item.height / 2) + pad
    if (rx < 1e-6 || ry < 1e-6) return false
    const nx = (px - cx) / rx
    const ny = (py - cy) / ry
    return nx * nx + ny * ny <= 1
  }
  if (item.type === 'arrow') {
    const [x1, y1, x2, y2] = item.points
    const thresh = Math.max(10, item.lineWidth * 3)
    return distPointToSegment(px, py, x1, y1, x2, y2) <= thresh
  }
  if (item.type === 'pen') {
    const pts = item.points
    if (pts.length < 4) return false
    const thresh = Math.max(8, item.lineWidth * 2)
    for (let i = 0; i < pts.length - 2; i += 2) {
      if (distPointToSegment(px, py, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]) <= thresh) {
        return true
      }
    }
    return false
  }
  const b = getAnnotationBounds(item)
  return px >= b.x - pad && py >= b.y - pad && px <= b.x + b.w + pad && py <= b.y + b.h + pad
}

/** 从后往前命中（后绘制的在上层） */
export function hitTestTopAnnotationId(px: number, py: number, items: AnnotationItem[]): string | null {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (hitTestAnnotation(px, py, items[i])) {
      return items[i].id
    }
  }
  return null
}

export function drawSelectionBox(
  context: CanvasRenderingContext2D,
  item: AnnotationItem,
  pad = 4
): void {
  const b = getAnnotationBounds(item)
  context.save()
  context.strokeStyle = '#409eff'
  context.lineWidth = 1
  context.setLineDash([4, 3])
  context.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2)
  context.restore()
}

export function cloneAnnotations(items: AnnotationItem[]): AnnotationItem[] {
  return JSON.parse(JSON.stringify(items)) as AnnotationItem[]
}

export function createAnnotationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 按增量平移标注（与 gongzuoliu updateAnnotationPosition 的拖拽语义一致） */
export function translateAnnotationByDelta(item: AnnotationItem, dx: number, dy: number): void {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6)) {
    return
  }
  if (item.type === 'rect' || item.type === 'ellipse' || item.type === 'text') {
    item.x += dx
    item.y += dy
    return
  }
  const pts = item.points
  for (let i = 0; i < pts.length; i += 2) {
    pts[i] += dx
    pts[i + 1] += dy
  }
}
