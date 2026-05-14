<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { IconPencil, IconPhoto, IconTrash, IconArrowsMove, IconSquare, IconCircle, IconArrowRight, IconEraser, IconZoomIn } from '@tabler/icons-vue'
import { ElMessage } from 'element-plus'
import { useCanvasNodeTitle } from '@/composables/useCanvasNodeUiI18n'
import { useCanvasLodLevel } from '@/composables/useCanvasLodLevel'
import { useI18n } from 'vue-i18n'

interface Point {
  x: number
  y: number
}

interface Stroke {
  id: string
  color: string
  size: number
  points: Point[]
}

interface ShapeStroke {
  id: string
  kind: 'rectangle' | 'ellipse' | 'arrow'
  arrowStyle?: 'solid' | 'outline' | 'double'
  color: string
  size: number
  start: Point
  end: Point
}

interface FreeDrawNodeData {
  label: string
  type: string
  status?: 'pending' | 'running' | 'completed' | 'error'
  description?: string
  nodeTitleI18n?: { key: string; params?: Record<string, string | number> }
  selected?: boolean
  toolbarExpanded?: boolean
  canvasWidth?: number
  canvasHeight?: number
  backgroundColor?: string
  penColor?: string
  penSize?: number
  mode?: 'pen' | 'eraser' | 'rectangle' | 'ellipse' | 'arrow' | 'move'
  arrowStyle?: 'solid' | 'outline' | 'double'
  strokes?: Stroke[]
  shapeStrokes?: ShapeStroke[]
  activeStroke?: Stroke | null
  activeShapeStroke?: ShapeStroke | null
  resizeMode?: boolean
  referenceImageUrl?: string | null
  selectedStrokeId?: string | null
  selectedShapeId?: string | null
}

interface Props {
  id: string
  selected?: boolean
  data: FreeDrawNodeData
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
})

const { t } = useI18n()
const lodLevel = useCanvasLodLevel()
const { updateNodeData, addNodes, addEdges, findNode, edges } = useVueFlow()
const { canvasNodeDisplayTitle } = useCanvasNodeTitle()
const pushStateBeforeChange = inject<(() => void) | undefined>('canvasPushStateBeforeChange', undefined)
const scheduleCanvasAutoSave = inject<(() => void) | undefined>('scheduleCanvasAutoSave', undefined)
const registerFreeDrawReferenceImageProvider = inject<((nodeId: string, provider: () => Promise<string | null> | string | null) => void) | undefined>('registerFreeDrawReferenceImageProvider', undefined)
const unregisterFreeDrawReferenceImageProvider = inject<((nodeId: string) => void) | undefined>('unregisterFreeDrawReferenceImageProvider', undefined)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const previewCanvasRef = ref<HTMLCanvasElement | null>(null)
const drawing = ref(false)
const pointerId = ref<number | null>(null)
const currentStroke = ref<Stroke | null>(null)
const currentShapeStroke = ref<ShapeStroke | null>(null)
const shapeStartPoint = ref<Point | null>(null)
const arrowMenuOpen = ref(false)
const resizeMode = ref(false)
let referenceSnapshotTimer: number | null = null
const referenceImageDirty = ref(true)
const selectedStrokeId = ref<string | null>(null)
const selectedShapeId = ref<string | null>(null)
const dragging = ref(false)
const dragStartPoint = ref<Point | null>(null)

const BOARD_WIDTH = 430
const BOARD_HEIGHT = 400
const DEFAULT_CANVAS_WIDTH = BOARD_WIDTH
const DEFAULT_CANVAS_HEIGHT = 300
const MIN_BOARD_WIDTH = 280
const MAX_BOARD_WIDTH = 960
const MIN_BOARD_HEIGHT = 180
const MAX_BOARD_HEIGHT = 720

const title = computed(() =>
  canvasNodeDisplayTitle(props.data, 'canvas.nodeDefaults.freeDrawLabel', {
    preferFallbackOverPersisted: true
  })
)

const strokes = computed(() => props.data.strokes ?? [])
const shapeStrokes = computed(() => props.data.shapeStrokes ?? [])
const penColor = computed({
  get: () => props.data.penColor || '#4da3ff',
  set: (value: string) => updateNodeData(props.id, { penColor: value })
})
const penSize = computed({
  get: () => props.data.penSize || 3,
  set: (value: number) => updateNodeData(props.id, { penSize: value })
})
const mode = computed({
  get: () => props.data.mode || 'pen',
  set: (value: 'pen' | 'eraser' | 'rectangle' | 'ellipse' | 'arrow' | 'move') => updateNodeData(props.id, { mode: value })
})
const arrowStyle = computed({
  get: () => props.data.arrowStyle || 'solid',
  set: (value: 'solid' | 'outline' | 'double') => updateNodeData(props.id, { arrowStyle: value })
})
const toolbarExpanded = computed({
  get: () => props.data.toolbarExpanded ?? false,
  set: (value: boolean) => updateNodeData(props.id, { toolbarExpanded: value })
})

const linkedReferenceImage = computed(() => props.data.referenceImageUrl ?? null)
const activeShapeStroke = ref<ShapeStroke | null>(null)

const nodeWidth = computed(() => props.data.canvasWidth || DEFAULT_CANVAS_WIDTH)
const nodeHeight = computed(() => props.data.canvasHeight || DEFAULT_CANVAS_HEIGHT)
const isEnlarged = computed(() => nodeWidth.value > BOARD_WIDTH || nodeHeight.value > BOARD_HEIGHT)
const nodeStyle = computed(() => ({
  width: `${nodeWidth.value}px`
}))

function ensureDefaults() {
  const patch: Partial<FreeDrawNodeData> = {}
  if (!props.data.canvasWidth) patch.canvasWidth = DEFAULT_CANVAS_WIDTH
  if (!props.data.canvasHeight) patch.canvasHeight = DEFAULT_CANVAS_HEIGHT
  if (!props.data.backgroundColor) patch.backgroundColor = 'rgba(24, 27, 39, 0.96)'
  if (!props.data.penColor) patch.penColor = '#4da3ff'
  if (!props.data.penSize) patch.penSize = 3
  if (!props.data.mode) patch.mode = 'pen'
  if (!props.data.strokes) patch.strokes = []
  if (!props.data.resizeMode) patch.resizeMode = false
  if (Object.keys(patch).length > 0) updateNodeData(props.id, patch)
}

// 初始化同步选中状态
watch(() => props.data.selectedStrokeId, (val) => {
  selectedStrokeId.value = val ?? null
}, { immediate: true })

watch(() => props.data.selectedShapeId, (val) => {
  selectedShapeId.value = val ?? null
}, { immediate: true })

// 检测点是否在线条上
function isPointNearStroke(point: Point, stroke: Stroke, tolerance = 10): boolean {
  for (let i = 0; i < stroke.points.length - 1; i++) {
    const p1 = stroke.points[i]
    const p2 = stroke.points[i + 1]
    const dist = pointToLineDistance(point, p1, p2)
    if (dist <= tolerance) {
      return true
    }
  }
  return false
}

// 计算点到线段的距离
function pointToLineDistance(p: Point, a: Point, b: Point): number {
  const A = p.x - a.x
  const B = p.y - a.y
  const C = b.x - a.x
  const D = b.y - a.y

  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1

  if (lenSq !== 0) param = dot / lenSq

  let xx: number, yy: number

  if (param < 0) {
    xx = a.x
    yy = a.y
  } else if (param > 1) {
    xx = b.x
    yy = b.y
  } else {
    xx = a.x + param * C
    yy = a.y + param * D
  }

  const dx = p.x - xx
  const dy = p.y - yy

  return Math.sqrt(dx * dx + dy * dy)
}

// 检测点是否在形状上
function isPointNearShape(point: Point, shape: ShapeStroke, tolerance = 10): boolean {
  if (shape.kind === 'rectangle') {
    const left = Math.min(shape.start.x, shape.end.x)
    const top = Math.min(shape.start.y, shape.end.y)
    const right = Math.max(shape.start.x, shape.end.x)
    const bottom = Math.max(shape.start.y, shape.end.y)
    
    // 检查是否在矩形边界附近
    return (
      (point.x >= left - tolerance && point.x <= right + tolerance &&
       Math.min(Math.abs(point.y - top), Math.abs(point.y - bottom)) <= tolerance) ||
      (point.y >= top - tolerance && point.y <= bottom + tolerance &&
       Math.min(Math.abs(point.x - left), Math.abs(point.x - right)) <= tolerance)
    )
  } else if (shape.kind === 'ellipse') {
    const centerX = (shape.start.x + shape.end.x) / 2
    const centerY = (shape.start.y + shape.end.y) / 2
    const radiusX = Math.abs(shape.end.x - shape.start.x) / 2
    const radiusY = Math.abs(shape.end.y - shape.start.y) / 2
    
    const normalizedX = (point.x - centerX) / (radiusX || 1)
    const normalizedY = (point.y - centerY) / (radiusY || 1)
    const distSq = normalizedX * normalizedX + normalizedY * normalizedY
    
    return Math.abs(distSq - 1) < 0.3
  } else if (shape.kind === 'arrow') {
    return isPointNearStroke(point, { ...shape, points: [shape.start, shape.end] } as Stroke, tolerance)
  }
  return false
}

// 获取线条的边界框
function getStrokeBounds(stroke: Stroke): { minX: number, minY: number, maxX: number, maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const point of stroke.points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return { minX, minY, maxX, maxY }
}

// 获取形状的边界框
function getShapeBounds(shape: ShapeStroke): { minX: number, minY: number, maxX: number, maxY: number } {
  return {
    minX: Math.min(shape.start.x, shape.end.x),
    minY: Math.min(shape.start.y, shape.end.y),
    maxX: Math.max(shape.start.x, shape.end.x),
    maxY: Math.max(shape.start.y, shape.end.y)
  }
}

function clampPoint(point: Point, width = props.data.canvasWidth || BOARD_WIDTH, height = props.data.canvasHeight || BOARD_HEIGHT): Point {
  return {
    x: Math.max(0, Math.min(width, point.x)),
    y: Math.max(0, Math.min(height, point.y))
  }
}

function rescalePoint(point: Point, fromWidth: number, fromHeight: number, toWidth: number, toHeight: number): Point {
  return {
    x: fromWidth > 0 ? (point.x * toWidth) / fromWidth : point.x,
    y: fromHeight > 0 ? (point.y * toHeight) / fromHeight : point.y
  }
}

function rescaleStrokes(fromWidth: number, fromHeight: number, toWidth: number, toHeight: number): Stroke[] {
  return strokes.value.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((pt) => clampPoint(rescalePoint(pt, fromWidth, fromHeight, toWidth, toHeight), toWidth, toHeight))
  }))
}

function rescaleShapeStrokes(fromWidth: number, fromHeight: number, toWidth: number, toHeight: number): ShapeStroke[] {
  return shapeStrokes.value.map((stroke) => ({
    ...stroke,
    start: clampPoint(rescalePoint(stroke.start, fromWidth, fromHeight, toWidth, toHeight), toWidth, toHeight),
    end: clampPoint(rescalePoint(stroke.end, fromWidth, fromHeight, toWidth, toHeight), toWidth, toHeight)
  }))
}

function canvasPoint(event: PointerEvent): Point {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  const width = canvas.width || rect.width || props.data.canvasWidth || BOARD_WIDTH
  const height = canvas.height || rect.height || props.data.canvasHeight || BOARD_HEIGHT
  const x = (event.clientX - rect.left) * (width / rect.width)
  const y = (event.clientY - rect.top) * (height / rect.height)
  return clampPoint({ x, y }, props.data.canvasWidth || BOARD_WIDTH, props.data.canvasHeight || BOARD_HEIGHT)
}

async function captureCanvasReferenceImage(): Promise<string | null> {
  const canvas = canvasRef.value
  if (!canvas) return null
  try {
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

async function ensureReferenceImageForGenerate(): Promise<string | null> {
  return await captureCanvasReferenceImage()
}

function drawArrowHead(ctx: CanvasRenderingContext2D, from: Point, to: Point, size: number, outlined = false) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const headLength = Math.max(10, size * 3)
  const left = {
    x: to.x - headLength * Math.cos(angle - Math.PI / 6),
    y: to.y - headLength * Math.sin(angle - Math.PI / 6)
  }
  const right = {
    x: to.x - headLength * Math.cos(angle + Math.PI / 6),
    y: to.y - headLength * Math.sin(angle + Math.PI / 6)
  }
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(left.x, left.y)
  ctx.lineTo(right.x, right.y)
  ctx.closePath()
  if (outlined) {
    ctx.stroke()
  } else {
    ctx.fill()
  }
}

function drawShapeStroke(ctx: CanvasRenderingContext2D, stroke: ShapeStroke) {
  const left = Math.min(stroke.start.x, stroke.end.x)
  const top = Math.min(stroke.start.y, stroke.end.y)
  const right = Math.max(stroke.start.x, stroke.end.x)
  const bottom = Math.max(stroke.start.y, stroke.end.y)
  const width = right - left
  const height = bottom - top
  ctx.strokeStyle = stroke.color
  ctx.fillStyle = stroke.color
  ctx.lineWidth = stroke.size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (stroke.kind === 'rectangle') {
    ctx.strokeRect(left, top, width, height)
    return
  }
  if (stroke.kind === 'ellipse') {
    ctx.beginPath()
    ctx.ellipse(left + width / 2, top + height / 2, Math.max(1, width / 2), Math.max(1, height / 2), 0, 0, Math.PI * 2)
    ctx.stroke()
    return
  }
  const start = stroke.start
  const end = stroke.end
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  ctx.lineTo(end.x, end.y)
  ctx.stroke()
  if (stroke.arrowStyle === 'double') {
    drawArrowHead(ctx, end, start, stroke.size)
  }
  if (stroke.arrowStyle === 'outline') {
    drawArrowHead(ctx, start, end, stroke.size, true)
  } else {
    drawArrowHead(ctx, start, end, stroke.size, false)
  }
}

function redraw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const ratio = window.devicePixelRatio || 1
  const width = props.data.canvasWidth || BOARD_WIDTH
  const height = props.data.canvasHeight || BOARD_HEIGHT
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = props.data.backgroundColor || 'rgba(24, 27, 39, 0.96)'
  ctx.fillRect(0, 0, width, height)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const stroke of strokes.value) {
    if (!stroke.points.length) continue
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.size
    ctx.beginPath()
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
    }
    ctx.stroke()
  }
  for (const shape of shapeStrokes.value) {
    drawShapeStroke(ctx, shape)
  }
  if (currentStroke.value?.points.length) {
    const stroke = currentStroke.value
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.size
    ctx.beginPath()
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
    }
    ctx.stroke()
  }
  if (currentShapeStroke.value) {
    drawShapeStroke(ctx, currentShapeStroke.value)
  }
  
  // 绘制选中框
  if (selectedStrokeId.value) {
    const stroke = strokes.value.find(s => s.id === selectedStrokeId.value)
    if (stroke) {
      const bounds = getStrokeBounds(stroke)
      ctx.strokeStyle = '#4da3ff'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.strokeRect(
        bounds.minX - 5,
        bounds.minY - 5,
        bounds.maxX - bounds.minX + 10,
        bounds.maxY - bounds.minY + 10
      )
      ctx.setLineDash([])
    }
  } else if (selectedShapeId.value) {
    const shape = shapeStrokes.value.find(s => s.id === selectedShapeId.value)
    if (shape) {
      const bounds = getShapeBounds(shape)
      ctx.strokeStyle = '#4da3ff'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.strokeRect(
        bounds.minX - 5,
        bounds.minY - 5,
        bounds.maxX - bounds.minX + 10,
        bounds.maxY - bounds.minY + 10
      )
      ctx.setLineDash([])
    }
  }
}

function commitStroke(stroke: Stroke) {
  const nextStrokes = [...strokes.value, stroke]
  updateNodeData(props.id, { strokes: nextStrokes, activeStroke: null })
  scheduleCanvasAutoSave?.()
}

function closeArrowMenu() {
  arrowMenuOpen.value = false
}

function handlePointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  closeArrowMenu()
  event.preventDefault()
  event.stopPropagation()
  pointerId.value = event.pointerId
  const point = canvasPoint(event)
  
  if (mode.value === 'move') {
    // 移动模式：先检查是否点击到已选中的元素
    let foundTarget = false
    
    if (selectedStrokeId.value) {
      const stroke = strokes.value.find(s => s.id === selectedStrokeId.value)
      if (stroke && isPointNearStroke(point, stroke)) {
        foundTarget = true
      }
    }
    if (selectedShapeId.value && !foundTarget) {
      const shape = shapeStrokes.value.find(s => s.id === selectedShapeId.value)
      if (shape && isPointNearShape(point, shape)) {
        foundTarget = true
      }
    }
    
    if (!foundTarget) {
      // 尝试选择新的元素
      selectedStrokeId.value = null
      selectedShapeId.value = null
      
      // 优先检查形状（从后往前）
      for (let i = shapeStrokes.value.length - 1; i >= 0; i--) {
        const shape = shapeStrokes.value[i]
        if (isPointNearShape(point, shape)) {
          selectedShapeId.value = shape.id
          foundTarget = true
          break
        }
      }
      
      // 再检查线条（从后往前）
      if (!foundTarget) {
        for (let i = strokes.value.length - 1; i >= 0; i--) {
          const stroke = strokes.value[i]
          if (isPointNearStroke(point, stroke)) {
            selectedStrokeId.value = stroke.id
            foundTarget = true
            break
          }
        }
      }
    }
    
    // 更新数据到 props
    updateNodeData(props.id, { 
      selectedStrokeId: selectedStrokeId.value, 
      selectedShapeId: selectedShapeId.value 
    })
    
    // 如果找到了目标，开始拖拽
    if (selectedStrokeId.value || selectedShapeId.value) {
      pushStateBeforeChange?.()
      dragging.value = true
      dragStartPoint.value = point
    }
  } else if (mode.value === 'rectangle' || mode.value === 'ellipse' || mode.value === 'arrow') {
    pushStateBeforeChange?.()
    shapeStartPoint.value = point
    currentShapeStroke.value = {
      id: `shape-${Date.now()}`,
      kind: mode.value,
      arrowStyle: mode.value === 'arrow' ? arrowStyle.value : undefined,
      color: penColor.value,
      size: penSize.value,
      start: point,
      end: point
    }
    updateNodeData(props.id, { activeShapeStroke: currentShapeStroke.value, toolbarExpanded: false })
  } else {
    pushStateBeforeChange?.()
    drawing.value = true
    currentStroke.value = {
      id: `stroke-${Date.now()}`,
      color: mode.value === 'eraser' ? 'rgba(24, 27, 39, 0.96)' : penColor.value,
      size: mode.value === 'eraser' ? Math.max(8, penSize.value * 4) : penSize.value,
      points: [point]
    }
    updateNodeData(props.id, { activeStroke: currentStroke.value, toolbarExpanded: false })
  }
  ;(event.currentTarget as HTMLCanvasElement | null)?.setPointerCapture(event.pointerId)
  redraw()
}

function handlePointerMove(event: PointerEvent) {
  if (pointerId.value !== event.pointerId) return
  event.preventDefault()
  event.stopPropagation()
  closeArrowMenu()
  const point = canvasPoint(event)
  
  if (dragging.value && dragStartPoint.value) {
    const dx = point.x - dragStartPoint.value.x
    const dy = point.y - dragStartPoint.value.y
    
    if (selectedStrokeId.value) {
      const newStrokes = strokes.value.map(stroke => {
        if (stroke.id === selectedStrokeId.value) {
          return {
            ...stroke,
            points: stroke.points.map(p => ({
              x: p.x + dx,
              y: p.y + dy
            }))
          }
        }
        return stroke
      })
      updateNodeData(props.id, { strokes: newStrokes })
    } else if (selectedShapeId.value) {
      const newShapeStrokes = shapeStrokes.value.map(shape => {
        if (shape.id === selectedShapeId.value) {
          return {
            ...shape,
            start: { x: shape.start.x + dx, y: shape.start.y + dy },
            end: { x: shape.end.x + dx, y: shape.end.y + dy }
          }
        }
        return shape
      })
      updateNodeData(props.id, { shapeStrokes: newShapeStrokes })
    }
    
    dragStartPoint.value = point
  } else if (drawing.value && currentStroke.value) {
    currentStroke.value.points.push(point)
    updateNodeData(props.id, { activeStroke: currentStroke.value })
  } else if (currentShapeStroke.value) {
    currentShapeStroke.value.end = point
    updateNodeData(props.id, { activeShapeStroke: currentShapeStroke.value })
  } else {
    return
  }
  redraw()
}

function finishStroke(event: PointerEvent) {
  if (pointerId.value !== event.pointerId) return
  event.preventDefault()
  event.stopPropagation()
  closeArrowMenu()
  
  if (dragging.value) {
    dragging.value = false
    dragStartPoint.value = null
    scheduleCanvasAutoSave?.()
  } else if (drawing.value && currentStroke.value) {
    const stroke = currentStroke.value
    drawing.value = false
    pointerId.value = null
    currentStroke.value = null
    commitStroke(stroke)
    updateNodeData(props.id, { activeStroke: null })
    redraw()
    return
  } else if (currentShapeStroke.value) {
    const shape = currentShapeStroke.value
    currentShapeStroke.value = null
    shapeStartPoint.value = null
    updateNodeData(props.id, {
      shapeStrokes: [...shapeStrokes.value, shape],
      activeShapeStroke: null
    })
    scheduleCanvasAutoSave?.()
    redraw()
  }
  pointerId.value = null
}

function clearCanvas() {
  pushStateBeforeChange?.()
  selectedStrokeId.value = null
  selectedShapeId.value = null
  updateNodeData(props.id, { 
    strokes: [], 
    shapeStrokes: [], 
    activeStroke: null, 
    activeShapeStroke: null, 
    referenceImageUrl: null,
    selectedStrokeId: null,
    selectedShapeId: null
  })
  scheduleCanvasAutoSave?.()
}


function enlargeCanvasBy2x() {
  const fromWidth = props.data.canvasWidth || DEFAULT_CANVAS_WIDTH
  const fromHeight = props.data.canvasHeight || DEFAULT_CANVAS_HEIGHT
  const nextWidth = Math.min(MAX_BOARD_WIDTH, Math.round(fromWidth * 2))
  const nextHeight = Math.min(MAX_BOARD_HEIGHT, Math.round(fromHeight * 2))
  const scaledStrokes = rescaleStrokes(fromWidth, fromHeight, nextWidth, nextHeight)
  const scaledShapeStrokes = rescaleShapeStrokes(fromWidth, fromHeight, nextWidth, nextHeight)
  pushStateBeforeChange?.()
  updateNodeData(props.id, {
    canvasWidth: nextWidth,
    canvasHeight: nextHeight,
    strokes: scaledStrokes,
    shapeStrokes: scaledShapeStrokes,
    activeStroke: null,
    activeShapeStroke: null,
    resizeMode: false
  })
  resizeMode.value = false
  scheduleCanvasAutoSave?.()
}

function restoreCanvasSize() {
  const fromWidth = props.data.canvasWidth || DEFAULT_CANVAS_WIDTH
  const fromHeight = props.data.canvasHeight || DEFAULT_CANVAS_HEIGHT
  const scaledStrokes = rescaleStrokes(fromWidth, fromHeight, DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT)
  const scaledShapeStrokes = rescaleShapeStrokes(fromWidth, fromHeight, DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT)
  pushStateBeforeChange?.()
  updateNodeData(props.id, {
    canvasWidth: DEFAULT_CANVAS_WIDTH,
    canvasHeight: DEFAULT_CANVAS_HEIGHT,
    strokes: scaledStrokes,
    shapeStrokes: scaledShapeStrokes,
    activeStroke: null,
    activeShapeStroke: null,
    resizeMode: false
  })
  resizeMode.value = false
  scheduleCanvasAutoSave?.()
}

function toggleResizeMode() {
  if (isEnlarged.value) {
    restoreCanvasSize()
    return
  }
  enlargeCanvasBy2x()
}

function exportCanvasToImageNode() {
  const canvas = canvasRef.value
  if (!canvas) {
    ElMessage.warning(t('canvas.nodeUi.freeDraw.boardNotReady'))
    return
  }
  const dataUrl = canvas.toDataURL('image/png')
  const newId = `free-draw-image-${Date.now()}`
  const self = findSelfNode()
  const x = (self?.position.x ?? 0) + (self?.dimensions?.width ?? nodeWidth.value) + 48
  const y = self?.position.y ?? 0
  updateNodeData(props.id, { toolbarExpanded: false, referenceImageUrl: dataUrl })
  referenceImageDirty.value = false
  scheduleCanvasAutoSave?.()
  addNodes({
    id: newId,
    type: 'imageCanvas',
    position: { x, y },
    data: {
      label: t('canvas.nodeUi.freeDraw.outputImageLabel'),
      type: 'image',
      status: 'completed' as const,
      description: t('canvas.nodeUi.freeDraw.outputImageDesc'),
      uploadedMainImageUrl: dataUrl,
      generatedImageUrl: null,
      toolbarExpanded: false,
      imageQuality: '1K',
      aspectRatio: '16:9'
    }
  })
  addEdges({
    id: `e-${props.id}-export-${newId}`,
    source: props.id,
    target: newId,
    animated: true
  })
  ElMessage.success(t('canvas.nodeUi.freeDraw.exportSuccess'))
}

function findSelfNode() {
  return findNode(props.id)
}

function drawPreview() {
  const canvas = previewCanvasRef.value
  if (!canvas || (strokes.value.length === 0 && shapeStrokes.value.length === 0)) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const originalWidth = props.data.canvasWidth || BOARD_WIDTH
  const originalHeight = props.data.canvasHeight || BOARD_HEIGHT
  const previewWidth = canvas.width
  const previewHeight = canvas.height
  const scaleX = previewWidth / originalWidth
  const scaleY = previewHeight / originalHeight
  const scale = Math.min(scaleX, scaleY)
  ctx.clearRect(0, 0, previewWidth, previewHeight)
  ctx.fillStyle = props.data.backgroundColor || 'rgba(24, 27, 39, 0.96)'
  ctx.fillRect(0, 0, previewWidth, previewHeight)
  ctx.save()
  ctx.scale(scale, scale)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const stroke of strokes.value) {
    if (!stroke.points.length) continue
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = Math.max(1, stroke.size)
    ctx.beginPath()
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
    }
    ctx.stroke()
  }
  for (const shape of shapeStrokes.value) {
    ctx.lineWidth = Math.max(1, shape.size)
    drawShapeStroke(ctx, shape)
  }
  ctx.restore()
}

watch(
  () => [props.data.strokes, props.data.shapeStrokes, props.data.backgroundColor, props.data.penColor, props.data.penSize, props.data.mode, props.data.arrowStyle],
  () => {
    nextTick(redraw)
    if (lodLevel.value === 'shell') {
      nextTick(drawPreview)
    }
  },
  { deep: true }
)

watch(
  () => lodLevel.value,
  () => {
    if (lodLevel.value === 'shell') {
      nextTick(drawPreview)
    }
  }
)

onMounted(() => {
  ensureDefaults()
  if (registerFreeDrawReferenceImageProvider) {
    registerFreeDrawReferenceImageProvider(props.id, async () => ensureReferenceImageForGenerate())
  }
  nextTick(() => {
    redraw()
    if (lodLevel.value === 'shell') {
      drawPreview()
    }
  })
})

onBeforeUnmount(() => {
  if (pointerId.value !== null) {
    pointerId.value = null
  }
  if (unregisterFreeDrawReferenceImageProvider) {
    unregisterFreeDrawReferenceImageProvider(props.id)
  }
})
</script>

<template>
  <div class="free-draw-node-root" :class="{ 'is-selected': selected, 'is-resize-mode': resizeMode, 'lod-shell': lodLevel === 'shell' }" :style="nodeStyle">
    <Handle type="target" :position="Position.Left" class="handle handle-target" />
    <div v-if="lodLevel === 'shell'" class="free-draw-node free-draw-node-shell">
      <div class="node-header">
        <div class="node-title-wrap">
          <IconPencil class="node-type-icon node-type-icon--text" />
          <span class="node-label">{{ title }}</span>
          <span v-if="(strokes?.length || 0) > 0" class="stroke-count-badge">{{ t('canvas.nodeUi.freeDraw.strokesCount', { n: strokes.length }) }}</span>
        </div>
      </div>
      <div class="shell-body nodrag nopan">
        <div v-if="(strokes?.length || 0) > 0" class="shell-has-content">
          <canvas
            ref="previewCanvasRef"
            class="preview-canvas"
            width="200"
            height="100"
          />
        </div>
        <div v-else class="shell-empty">
          <span class="empty-text">{{ t('canvas.nodeUi.freeDraw.empty') }}</span>
        </div>
      </div>
    </div>
    <div v-else class="free-draw-node">
      <div class="node-header">
        <div class="node-title-wrap">
          <IconPencil class="node-type-icon node-type-icon--text" />
          <span class="node-label">{{ title }}</span>
        </div>
      </div>

      <div class="canvas-shell nodrag nopan" :class="{ 'is-enlarged': isEnlarged }">
        <canvas
          ref="canvasRef"
          class="drawing-canvas"
          :width="nodeWidth"
          :height="nodeHeight"
          :style="{ width: `${nodeWidth}px`, height: `${nodeHeight}px` }"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="finishStroke"
          @pointercancel="finishStroke"
          @pointerleave="finishStroke"
        />
        <div class="expand-float-group nodrag nopan">
          <button type="button" class="expand-float-btn" :class="{ active: toolbarExpanded }" @click.stop="toolbarExpanded = !toolbarExpanded" :title="t('canvas.nodeUi.freeDraw.expandSettings')">
            <span class="palette-icon" aria-hidden="true">
              <span class="palette-dot palette-dot-a"></span>
              <span class="palette-dot palette-dot-b"></span>
              <span class="palette-dot palette-dot-c"></span>
            </span>
          </button>
          <transition name="fade">
            <div v-if="toolbarExpanded" class="expand-float-panel" @click.stop>
              <label class="tool-field tool-field-inline">
                <span>{{ t('canvas.nodeUi.freeDraw.color') }}</span>
                <input v-model="penColor" type="color" class="color-input" />
              </label>
              <label class="tool-field tool-field-inline">
                <span>{{ t('canvas.nodeUi.freeDraw.thickness') }}</span>
                <input v-model.number="penSize" type="range" min="1" max="18" step="1" />
              </label>
            </div>
          </transition>
        </div>
      </div>

      <div class="node-footer-actions nodrag nopan">
        <div class="node-toolbar">
          <button type="button" class="toolbar-btn icon-btn" :class="{ active: mode === 'move' }" @click.stop="mode = 'move'" :title="t('canvas.nodeUi.freeDraw.move')">
            <IconArrowsMove />
          </button>
          <button type="button" class="toolbar-btn icon-btn" :class="{ active: mode === 'pen' }" @click.stop="mode = 'pen'" :title="t('canvas.nodeUi.freeDraw.pen')">
            <IconPencil />
          </button>
          <button type="button" class="toolbar-btn icon-btn" :class="{ active: mode === 'rectangle' }" @click.stop="mode = 'rectangle'" :title="t('canvas.nodeUi.freeDraw.rect')">
            <IconSquare />
          </button>
          <button type="button" class="toolbar-btn icon-btn" :class="{ active: mode === 'ellipse' }" @click.stop="mode = 'ellipse'" :title="t('canvas.nodeUi.freeDraw.ellipse')">
            <IconCircle />
          </button>
          <div class="shape-menu-wrap">
            <button type="button" class="toolbar-btn icon-btn" :class="{ active: mode === 'arrow' }" @click.stop="mode = 'arrow'; arrowMenuOpen = !arrowMenuOpen" :title="t('canvas.nodeUi.freeDraw.arrow')">
              <IconArrowRight />
            </button>
            <transition name="fade">
              <div v-if="arrowMenuOpen && mode === 'arrow'" class="shape-menu nodrag nopan" @click.stop>
                <button type="button" class="shape-menu-item" :class="{ active: arrowStyle === 'solid' }" @click.stop="arrowStyle = 'solid'">{{ t('canvas.nodeUi.freeDraw.solidArrow') }}</button>
                <button type="button" class="shape-menu-item" :class="{ active: arrowStyle === 'outline' }" @click.stop="arrowStyle = 'outline'">{{ t('canvas.nodeUi.freeDraw.outlineArrow') }}</button>
                <button type="button" class="shape-menu-item" :class="{ active: arrowStyle === 'double' }" @click.stop="arrowStyle = 'double'">{{ t('canvas.nodeUi.freeDraw.doubleArrow') }}</button>
              </div>
            </transition>
          </div>
          <button type="button" class="toolbar-btn icon-btn" :class="{ active: mode === 'eraser' }" @click.stop="closeArrowMenu(); mode = 'eraser'" :title="t('canvas.nodeUi.freeDraw.eraser')">
            <IconEraser />
          </button>
          <button type="button" class="toolbar-btn icon-btn" @click.stop="closeArrowMenu(); clearCanvas()" :title="t('canvas.nodeUi.freeDraw.clear')">
            <IconTrash />
          </button>
          <button type="button" class="toolbar-btn icon-btn" :class="{ active: isEnlarged }" @click.stop="closeArrowMenu(); toggleResizeMode()" :title="isEnlarged ? t('canvas.nodeUi.freeDraw.restoreSize') : t('canvas.nodeUi.freeDraw.resize')">
            <IconZoomIn />
          </button>
          <div class="toolbar-spacer"></div>
          <button type="button" class="toolbar-btn icon-btn primary export-btn" @click.stop="exportCanvasToImageNode" title="输出一张绘图">
            <IconPhoto />
          </button>
        </div>
      </div>
    </div>
    <Handle type="source" :position="Position.Right" class="handle handle-source" />
  </div>
</template>

<style scoped>
.free-draw-node-root {
  position: relative;
  min-width: 0;
  box-sizing: border-box;
}

.free-draw-node {
  width: 100%;
  _min-height: 400px;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary, #1a1a2e);
  border: 2px solid var(--border-color, #3a3a4a);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  cursor: default;
}

.free-draw-node-root.is-selected .free-draw-node {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.4), 0 4px 14px rgba(64, 158, 255, 0.22);
}

.node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 5px;
  background: var(--bg-tertiary, #25253a);
  border-bottom: 1px solid var(--border-color, #3a3a4a);
}

.node-title-wrap {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.node-type-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.node-type-icon--text {
  color: #4da3ff;
}

.node-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #ffffff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-toolbar,
.toolbar-expanded,
.node-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.node-footer-actions {
  padding: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.node-toolbar {
  flex-wrap: wrap;
}


.toolbar-btn {
  border: none;
  background: transparent;
  color: #e8e8ef;
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
}

.toolbar-btn.icon-btn {
  width: 30px;
  height: 30px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  color: #d6d9e3;
}

.toolbar-btn.icon-btn.active {
  background: rgba(64, 158, 255, 0.12);
  color: #7db7ff;
}

.btn-icon {
  position: relative;
  display: inline-block;
  width: 20px;
  height: 20px;
  color: currentColor;
}

.toolbar-btn .el-icon {
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pen-icon::before,
.rect-icon::before,
.ellipse-icon::before,
.eraser-icon::before,
.clear-icon::before,
.resize-icon::before,
.arrow-icon::before {
  content: '';
  position: absolute;
  inset: 0;
  border-color: currentColor;
}

.pen-icon::before {
  width: 14px;
  height: 2px;
  left: 2px;
  top: 8px;
  background: currentColor;
  transform: rotate(-35deg);
  border-radius: 999px;
}

.rect-icon::before {
  left: 2px;
  top: 2px;
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-radius: 3px;
}

.ellipse-icon::before {
  left: 2px;
  top: 3px;
  width: 12px;
  height: 10px;
  border: 2px solid currentColor;
  border-radius: 50%;
}

.arrow-icon::before {
  left: 2px;
  top: 8px;
  width: 12px;
  height: 2px;
  background: currentColor;
}

.arrow-icon::after {
  content: '';
  position: absolute;
  right: 1px;
  top: 5px;
  width: 7px;
  height: 7px;
  border-top: 2px solid currentColor;
  border-right: 2px solid currentColor;
  transform: rotate(45deg);
}

.eraser-icon::before {
  left: 3px;
  top: 3px;
  width: 11px;
  height: 11px;
  background: linear-gradient(135deg, transparent 0 30%, currentColor 30% 60%, transparent 60% 100%);
  transform: rotate(-45deg);
  border-radius: 2px;
}

.clear-icon::before {
  left: 4px;
  top: 3px;
  width: 10px;
  height: 12px;
  border: 2px solid currentColor;
  border-top: 3px solid currentColor;
  border-radius: 2px 2px 3px 3px;
}

.clear-icon::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 8px;
  height: 2px;
  background: currentColor;
  border-radius: 999px;
}

.resize-icon::before {
  left: 2px;
  top: 2px;
  width: 5px;
  height: 5px;
  border-left: 2px solid currentColor;
  border-top: 2px solid currentColor;
}

.resize-icon::after {
  content: '';
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 5px;
  height: 5px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
}

.toolbar-spacer {
  flex: 1;
}

.export-btn {
  border: 1px solid rgba(64, 158, 255, 0.4);
  background: rgba(64, 158, 255, 0.12);
  color: #7db7ff;
}

.export-btn:hover {
  background: rgba(64, 158, 255, 0.2);
  border-color: rgba(64, 158, 255, 0.6);
}

.toolbar-btn.active {
  color: #7db7ff;
}



.shape-menu-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.shape-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  z-index: 12;
  min-width: 220px;
  padding: 8px;
  border-radius: 12px;
  border: 1px solid rgba(77, 163, 255, 0.2);
  background: rgba(14, 18, 30, 0.96);
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
  display: flex;
  flex-direction: row;
  gap: 6px;
}

.shape-menu-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.05);
  color: #e8e8ef;
  cursor: pointer;
  text-align: center;
}

.shape-menu-item.active {
  border-color: #409eff;
  color: #7db7ff;
  background: rgba(64, 158, 255, 0.12);
}

.toolbar-btn.danger {
  border-color: rgba(245, 108, 108, 0.35);
  color: #f56c6c;
}

.tool-field {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #c8c8d6;
  font-size: 12px;
}

.color-input {
  width: 42px;
  height: 28px;
  border: none;
  background: transparent;
  padding: 0;
}

.canvas-shell {
  position: relative;
}

.expand-float-group {
  position: absolute;
  left: 12px;
  bottom: 10px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.expand-float-btn {
  width: 25px;
  height: 25px;
  border-radius: 30%;
  border: 1px solid rgba(77, 163, 255, 0.35);
  background: rgba(14, 18, 30, 0.86);
  backdrop-filter: blur(10px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.22);
}

.expand-float-btn.active {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.18), 0 8px 18px rgba(64, 158, 255, 0.22);
}

.expand-float-panel {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 0 15px;
  border-radius: 5px;
  border: 1px solid rgba(77, 163, 255, 0.24);
  background: rgba(14, 18, 30, 0.9);
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
}

.tool-field-inline {
  color: #d8def0;
}

.palette-icon {
  position: relative;
  width: 22px;
  height: 22px;
  display: inline-block;
}

.palette-dot {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.palette-dot-a { left: 2px; top: 8px; background: #ff6b6b; }
.palette-dot-b { left: 7px; top: 0; background: #ffd93d; }
.palette-dot-c { left: 13px; top: 10px; background: #4da3ff; }

.drawing-canvas {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 276px;
  touch-action: none;
  border-radius: 8px;
  background: rgba(10, 12, 20, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
}


.handle {
  z-index: 2;
  width: 10px !important;
  height: 10px !important;
  min-width: 10px;
  min-height: 10px;
  box-sizing: border-box;
  border-radius: 50% !important;
  background: #409eff !important;
  border: 2px solid #ffffff !important;
}

.handle-target {
  left: 0px !important;
}

.handle-source {
  right: 0px !important;
}

.free-draw-node-shell {
  min-height: 90px;
}

.shell-body {
  padding: 10px 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60px;
}

.shell-has-content {
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-canvas {
  display: block;
  border-radius: 6px;
  background: rgba(10, 12, 20, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.06);
  max-width: 100%;
  height: auto;
}

.shell-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-text {
  color: rgba(255, 255, 255, 0.35);
  font-size: 12px;
}

.stroke-count-badge {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(64, 158, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
}
</style>
