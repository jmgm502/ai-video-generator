<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElDialog, ElButton, ElIcon, ElInputNumber, ElSlider, ElMessage, ElMessageBox } from 'element-plus'
import { RefreshLeft, RefreshRight, Delete, EditPen } from '@element-plus/icons-vue'
import {
  computeSplitGridLayout,
  cropImageCenterByAspect,
  cropImagePixelRect,
  lineThicknessPercentForTargetLinePx,
  loadImageElement,
  parseAspectRatioString,
  splitImageToCells,
  canvasToDataUrl
} from '@/utils/imageNodeCanvasTools'
import {
  cloneAnnotations,
  createAnnotationId,
  drawAnnotations,
  drawDraft,
  drawSelectionBox,
  hitTestTopAnnotationId,
  translateAnnotationByDelta,
  type AnnotationItem,
  type AnnotationToolType,
  type DraftShape
} from '@/utils/annotationDraw'

const props = defineProps<{
  modelValue: boolean
  mode: 'crop' | 'annotate' | 'split' | null
  imageUrl: string
}>()

export type ImageToolApplyPayload =
  | { mode: 'crop'; dataUrl: string }
  | { mode: 'annotate'; dataUrl: string }
  | { mode: 'split'; cells: string[]; rows: number; cols: number }

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  apply: [payload: ImageToolApplyPayload]
}>()

const { t } = useI18n()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

const dialogTitle = computed(() => {
  switch (props.mode) {
    case 'crop':
      return t('canvas.nodeUi.imageTools.titleCrop')
    case 'annotate':
      return t('canvas.nodeUi.imageTools.titleAnnotate')
    case 'split':
      return t('canvas.nodeUi.imageTools.titleSplit')
    default:
      return t('canvas.nodeUi.imageTools.titleFallback')
  }
})

const dialogWidth = computed(() => {
  switch (props.mode) {
    case 'annotate':
      return 'min(680px, 96vw)'
    case 'crop':
      return 'min(560px, 96vw)'
    case 'split':
      return 'min(960px, 98vw)'
    default:
      return 'min(520px, 96vw)'
  }
})

/** 切割模式标题拆到 #header 自定义，此处留空避免重复 */
const elDialogTitle = computed(() => (props.mode === 'split' ? '' : dialogTitle.value))

/* ---------- 裁剪 ---------- */
const cropAspect = ref('free')
const cropImgRef = ref<HTMLImageElement | null>(null)
const cropDragging = ref(false)
const cropStart = ref<{ x: number; y: number } | null>(null)
const cropNow = ref<{ x: number; y: number } | null>(null)
/** 随图片加载/缩放刷新固定比例裁剪框（触发 computed） */
const cropLayoutTick = ref(0)
let cropResizeObserver: ResizeObserver | null = null

function bumpCropLayout() {
  cropLayoutTick.value += 1
}

function disconnectCropResizeObserver() {
  cropResizeObserver?.disconnect()
  cropResizeObserver = null
}

/** 在显示区域内求目标比例下的最大内接矩形（居中），与 cropImageCenterByAspect 几何一致 */
function fitAspectRectInDisplay(iw: number, ih: number, aspectStr: string) {
  const targetRatio = parseAspectRatioString(aspectStr)
  if (!Number.isFinite(targetRatio) || iw < 2 || ih < 2) {
    return { left: 0, top: 0, width: 0, height: 0 }
  }
  const sourceRatio = iw / ih
  let width: number
  let height: number
  let left: number
  let top: number
  if (sourceRatio > targetRatio) {
    height = ih
    width = ih * targetRatio
    left = (iw - width) / 2
    top = 0
  } else {
    width = iw
    height = iw / targetRatio
    left = 0
    top = (ih - height) / 2
  }
  return { left, top, width, height }
}

/**
 * 固定比例初始框：略小于最大内接矩形（约 92%），保证横纵都有平移余量；
 * 否则竖图/方图选 16:9 时宽贴满 iw，left 无法变化，只能上下动。
 */
function createInitialFixedAspectRect(iw: number, ih: number, aspectStr: string) {
  const maxR = fitAspectRectInDisplay(iw, ih, aspectStr)
  const targetRatio = parseAspectRatioString(aspectStr)
  if (!Number.isFinite(targetRatio) || maxR.width < 4 || maxR.height < 4) {
    return maxR
  }
  const shrink = 0.92
  let w = maxR.width * shrink
  let h = w / targetRatio
  if (h > maxR.height * shrink) {
    h = maxR.height * shrink
    w = h * targetRatio
  }
  const cx = maxR.left + maxR.width / 2
  const cy = maxR.top + maxR.height / 2
  const left = cx - w / 2
  const top = cy - h / 2
  return clampFixedAspectRect(left, top, w, h, iw, ih, aspectStr)
}

/** 固定比例裁剪框：钳制在图内且保持目标宽高比 */
function clampFixedAspectRect(
  left: number,
  top: number,
  width: number,
  height: number,
  iw: number,
  ih: number,
  aspectStr: string
): { left: number; top: number; width: number; height: number } {
  const targetRatio = parseAspectRatioString(aspectStr)
  if (!Number.isFinite(targetRatio) || iw < 2 || ih < 2) {
    return { left: 0, top: 0, width: 0, height: 0 }
  }
  const maxR = fitAspectRectInDisplay(iw, ih, aspectStr)
  const minW = Math.max(24, Math.min(56, maxR.width * 0.12))
  let w = width
  let h = height
  if (Math.abs(w / h - targetRatio) > 0.001) {
    h = w / targetRatio
  }
  w = Math.max(minW, Math.min(w, maxR.width))
  h = w / targetRatio
  if (h > maxR.height) {
    h = maxR.height
    w = h * targetRatio
  }
  if (w > iw) {
    w = iw
    h = w / targetRatio
  }
  if (h > ih) {
    h = ih
    w = h * targetRatio
  }
  let l = left
  let t = top
  l = Math.max(0, Math.min(l, iw - w))
  t = Math.max(0, Math.min(t, ih - h))
  if (l + w > iw) l = Math.max(0, iw - w)
  if (t + h > ih) t = Math.max(0, ih - h)
  return { left: l, top: t, width: w, height: h }
}

/** 固定比例下：可拖拽移动、滚轮同比缩放的裁剪框（显示坐标，相对当前 img client 尺寸） */
const cropStageRef = ref<HTMLElement | null>(null)
const cropFixedRect = ref<{ left: number; top: number; width: number; height: number } | null>(null)
const lastCropDisplaySize = ref<{ w: number; h: number } | null>(null)
const cropFixedDrag = ref<{
  pointerId: number
  startClientX: number
  startClientY: number
  origLeft: number
  origTop: number
} | null>(null)

function clientDeltaToImgDelta(dxClient: number, dyClient: number) {
  const img = cropImgRef.value
  if (!img) return { dx: 0, dy: 0 }
  const br = img.getBoundingClientRect()
  if (br.width < 1 || br.height < 1) return { dx: 0, dy: 0 }
  return {
    dx: (dxClient / br.width) * img.clientWidth,
    dy: (dyClient / br.height) * img.clientHeight
  }
}

function clientToImgLocal(clientX: number, clientY: number) {
  const img = cropImgRef.value
  if (!img) return { x: 0, y: 0 }
  const br = img.getBoundingClientRect()
  if (br.width < 1 || br.height < 1) return { x: 0, y: 0 }
  return {
    x: ((clientX - br.left) / br.width) * img.clientWidth,
    y: ((clientY - br.top) / br.height) * img.clientHeight
  }
}

function cropMarqueePointerDown(e: PointerEvent) {
  if (cropAspect.value === 'free' || !cropFixedRect.value) return
  e.stopPropagation()
  cropFixedDrag.value = {
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startClientY: e.clientY,
    origLeft: cropFixedRect.value.left,
    origTop: cropFixedRect.value.top
  }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function cropMarqueePointerMove(e: PointerEvent) {
  const d = cropFixedDrag.value
  if (!d || d.pointerId !== e.pointerId || !cropFixedRect.value || !cropImgRef.value) return
  const img = cropImgRef.value
  const { dx, dy } = clientDeltaToImgDelta(e.clientX - d.startClientX, e.clientY - d.startClientY)
  const r = cropFixedRect.value
  cropFixedRect.value = clampFixedAspectRect(
    d.origLeft + dx,
    d.origTop + dy,
    r.width,
    r.height,
    img.clientWidth,
    img.clientHeight,
    cropAspect.value
  )
}

function cropMarqueePointerUp(e: PointerEvent) {
  const d = cropFixedDrag.value
  if (d && d.pointerId === e.pointerId) {
    cropFixedDrag.value = null
  }
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
}

function onCropStageWheel(e: WheelEvent) {
  if (cropAspect.value === 'free' || !cropFixedRect.value || !cropImgRef.value) return
  const img = cropImgRef.value
  const iw = img.clientWidth
  const ih = img.clientHeight
  const r = cropFixedRect.value
  const { x: mx, y: my } = clientToImgLocal(e.clientX, e.clientY)
  // 按滚轮幅度连续缩放（触控板 delta 大、鼠标单次小），同比放大缩小
  const dy = e.deltaY
  const sens = Math.min(0.22, Math.max(0.035, Math.abs(dy) / 280))
  let factor = dy > 0 ? 1 - sens : 1 + sens
  factor = Math.min(1.28, Math.max(0.72, factor))
  let newW = r.width * factor
  let newH = r.height * factor
  const ax = r.width > 0.5 ? (mx - r.left) / r.width : 0.5
  const ay = r.height > 0.5 ? (my - r.top) / r.height : 0.5
  let newL = mx - ax * newW
  let newT = my - ay * newH
  cropFixedRect.value = clampFixedAspectRect(newL, newT, newW, newH, iw, ih, cropAspect.value)
  bumpCropLayout()
}

const cropDisplayRect = computed(() => {
  void cropLayoutTick.value
  const img = cropImgRef.value
  if (!img || img.clientWidth < 2 || img.clientHeight < 2) {
    return { left: 0, top: 0, width: 0, height: 0 }
  }

  if (cropAspect.value !== 'free') {
    const fx = cropFixedRect.value
    if (fx && fx.width > 2 && fx.height > 2) {
      return { ...fx }
    }
    return fitAspectRectInDisplay(img.clientWidth, img.clientHeight, cropAspect.value)
  }

  const a = cropStart.value
  const b = cropNow.value
  if (!a || !b) return { left: 0, top: 0, width: 0, height: 0 }
  const maxW = img.clientWidth
  const maxH = img.clientHeight
  let x1 = Math.max(0, Math.min(a.x, b.x))
  let y1 = Math.max(0, Math.min(a.y, b.y))
  let x2 = Math.min(maxW, Math.max(a.x, b.x))
  let y2 = Math.min(maxH, Math.max(a.y, b.y))
  return {
    left: x1,
    top: y1,
    width: Math.max(0, x2 - x1),
    height: Math.max(0, y2 - y1)
  }
})

/** 图片在 crop-stage 内因 margin:auto 产生的偏移，裁剪框需与图像像素坐标对齐 */
const cropImgLayoutOffset = computed(() => {
  void cropLayoutTick.value
  const stage = cropStageRef.value
  const img = cropImgRef.value
  if (!stage || !img) return { x: 0, y: 0 }
  const sr = stage.getBoundingClientRect()
  const ir = img.getBoundingClientRect()
  return { x: ir.left - sr.left, y: ir.top - sr.top }
})

const cropBoxStyle = computed(() => {
  const r = cropDisplayRect.value
  const o = cropImgLayoutOffset.value
  return {
    left: `${r.left + o.x}px`,
    top: `${r.top + o.y}px`,
    width: `${r.width}px`,
    height: `${r.height}px`
  }
})

function onCropImgLoad() {
  cropStart.value = null
  cropNow.value = null
  const img = cropImgRef.value
  if (img && cropAspect.value !== 'free') {
    cropFixedRect.value = createInitialFixedAspectRect(img.clientWidth, img.clientHeight, cropAspect.value)
    lastCropDisplaySize.value = { w: img.clientWidth, h: img.clientHeight }
  }
  bumpCropLayout()
}

function cropPointerDown(e: PointerEvent) {
  if (cropAspect.value !== 'free') return
  const img = cropImgRef.value
  if (!img) return
  const rect = img.getBoundingClientRect()
  cropDragging.value = true
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  cropStart.value = { x, y }
  cropNow.value = { x, y }
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
}

function cropPointerMove(e: PointerEvent) {
  if (!cropDragging.value || !cropImgRef.value || !cropStart.value) return
  const rect = cropImgRef.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(e.clientX - rect.left, cropImgRef.value.clientWidth))
  const y = Math.max(0, Math.min(e.clientY - rect.top, cropImgRef.value.clientHeight))
  cropNow.value = { x, y }
}

function cropPointerUp() {
  cropDragging.value = false
}

watch(cropAspect, () => {
  cropStart.value = null
  cropNow.value = null
  cropDragging.value = false
  cropFixedDrag.value = null
  if (cropAspect.value === 'free') {
    cropFixedRect.value = null
    lastCropDisplaySize.value = null
  } else {
    void nextTick(() => {
      const el = cropImgRef.value
      if (el && el.clientWidth > 0) {
        cropFixedRect.value = createInitialFixedAspectRect(el.clientWidth, el.clientHeight, cropAspect.value)
        lastCropDisplaySize.value = { w: el.clientWidth, h: el.clientHeight }
      }
      bumpCropLayout()
    })
  }
})

const cropAspectOptions = computed<{ value: string; label: string }[]>(() => [
  { value: 'free', label: t('canvas.nodeUi.imageTools.aspectFree') },
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' }
])

async function confirmCrop() {
  if (!props.imageUrl) return
  try {
    const img = cropImgRef.value
    const r = cropDisplayRect.value
    if (img && r.width > 4 && r.height > 4) {
      const scaleX = img.naturalWidth / img.clientWidth
      const scaleY = img.naturalHeight / img.clientHeight
      const dataUrl = await cropImagePixelRect(
        props.imageUrl,
        Math.round(r.left * scaleX),
        Math.round(r.top * scaleY),
        Math.round(r.width * scaleX),
        Math.round(r.height * scaleY)
      )
      emit('apply', { dataUrl, mode: 'crop' })
      visible.value = false
      return
    }
    if (cropAspect.value === 'free') {
      const dataUrl = await cropImageCenterByAspect(props.imageUrl, 'free')
      emit('apply', { dataUrl, mode: 'crop' })
      visible.value = false
      return
    }
    ElMessage.warning(t('canvas.nodeUi.imageTools.waitImageLoad'))
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : t('canvas.nodeUi.imageTools.cropFail'))
  }
}

/* ---------- 标注（矩形 / 圆形 / 箭头 / 文本，撤销重做删除选中） ---------- */
const annotateCanvasRef = ref<HTMLCanvasElement | null>(null)
const annotateBaseImageRef = ref<HTMLImageElement | null>(null)
const annotateTool = ref<AnnotationToolType>('rect')
const annotateItems = ref<AnnotationItem[]>([])
const annotateDraft = ref<DraftShape | null>(null)
const annotatePenDraft = ref<number[] | null>(null)
/** 拖拽移动已选中的标注（参考 gongzuoliu Konva draggable） */
const annotateDrag = ref<{ lastX: number; lastY: number; didPushUndo: boolean } | null>(null)
const undoStack = ref<AnnotationItem[][]>([])
const redoStack = ref<AnnotationItem[][]>([])
const selectedId = ref<string | null>(null)
const annotateColor = ref('#ff4d4f')
/** 线宽占画布短边的百分比，与参考项目一致（展示如 0.3%） */
const annotateLineWidthPercent = ref(0.3)
const annotateTextSizePercent = ref(10)

const annotateCanvasCursor = computed(() => 'crosshair')

function getAnnotateBaseSize(): number {
  const c = annotateCanvasRef.value
  if (!c?.width) return 1000
  return Math.max(320, Math.min(c.width, c.height))
}

function getLineWidthPx(): number {
  return Math.max(1, Math.round(getAnnotateBaseSize() * (annotateLineWidthPercent.value / 100)))
}

function getTextFontSize(): number {
  return Math.max(10, Math.round(getAnnotateBaseSize() * (annotateTextSizePercent.value / 100)))
}

const lineWidthPercentDisplay = computed(() => `${annotateLineWidthPercent.value.toFixed(1)}%`)

function redrawAnnotateCanvas() {
  const canvas = annotateCanvasRef.value
  const img = annotateBaseImageRef.value
  if (!canvas || !img) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  drawAnnotations(ctx, annotateItems.value)
  if (annotateDraft.value) {
    drawDraft(ctx, annotateDraft.value, annotateColor.value, getLineWidthPx())
  }
  if (annotatePenDraft.value && annotatePenDraft.value.length >= 4) {
    const pts = annotatePenDraft.value
    ctx.save()
    ctx.strokeStyle = annotateColor.value
    ctx.lineWidth = getLineWidthPx()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(pts[0], pts[1])
    for (let i = 2; i < pts.length; i += 2) {
      ctx.lineTo(pts[i], pts[i + 1])
    }
    ctx.stroke()
    ctx.restore()
  }
  if (selectedId.value) {
    const it = annotateItems.value.find((i) => i.id === selectedId.value)
    if (it) drawSelectionBox(ctx, it)
  }
}

function pushUndoSnapshot() {
  undoStack.value.push(cloneAnnotations(annotateItems.value))
  redoStack.value = []
}

function commitDraft(d: DraftShape) {
  if (d.tool === 'rect' || d.tool === 'ellipse') {
    const left = Math.min(d.x0, d.x1)
    const top = Math.min(d.y0, d.y1)
    const width = Math.abs(d.x1 - d.x0)
    const height = Math.abs(d.y1 - d.y0)
    if (width < 4 || height < 4) return
    pushUndoSnapshot()
    const id = createAnnotationId()
    const stroke = annotateColor.value
    const lineWidth = getLineWidthPx()
    if (d.tool === 'rect') {
      annotateItems.value.push({ id, type: 'rect', x: left, y: top, width, height, stroke, lineWidth })
    } else {
      annotateItems.value.push({ id, type: 'ellipse', x: left, y: top, width, height, stroke, lineWidth })
    }
    return
  }
  const dist = Math.hypot(d.x1 - d.x0, d.y1 - d.y0)
  if (dist < 5) return
  pushUndoSnapshot()
  annotateItems.value.push({
    id: createAnnotationId(),
    type: 'arrow',
    points: [d.x0, d.y0, d.x1, d.y1],
    stroke: annotateColor.value,
    lineWidth: getLineWidthPx()
  })
}

function annotateClientToCanvas(e: PointerEvent): { x: number; y: number } {
  const canvas = annotateCanvasRef.value!
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  }
}

async function setupAnnotateCanvas() {
  await nextTick()
  const canvas = annotateCanvasRef.value
  if (!canvas || !props.imageUrl) return
  const img = await loadImageElement(props.imageUrl)
  annotateBaseImageRef.value = img
  const maxEdge = 1600
  let w = img.naturalWidth
  let h = img.naturalHeight
  if (w > maxEdge || h > maxEdge) {
    const s = maxEdge / Math.max(w, h)
    w = Math.round(w * s)
    h = Math.round(h * s)
  }
  canvas.width = w
  canvas.height = h
  annotateItems.value = []
  undoStack.value = []
  redoStack.value = []
  selectedId.value = null
  annotateDraft.value = null
  annotatePenDraft.value = null
  annotateDrag.value = null
  redrawAnnotateCanvas()
}

async function annotatePointerDown(e: PointerEvent) {
  const canvas = annotateCanvasRef.value
  if (!canvas || !annotateBaseImageRef.value) return
  const { x, y } = annotateClientToCanvas(e)

  const hitId = hitTestTopAnnotationId(x, y, annotateItems.value)

  if (annotateTool.value === 'text') {
    if (hitId) {
      selectedId.value = hitId
      annotateDrag.value = { lastX: x, lastY: y, didPushUndo: false }
      canvas.setPointerCapture(e.pointerId)
      redrawAnnotateCanvas()
      return
    }
    try {
      const { value } = await ElMessageBox.prompt(
        t('canvas.nodeUi.imageTools.textPromptMessage'),
        t('canvas.nodeUi.imageTools.textPromptTitle'),
        {
          confirmButtonText: t('canvas.nodeUi.imageTools.btnOk'),
          cancelButtonText: t('canvas.nodeUi.imageTools.btnCancelDialog'),
          inputPlaceholder: t('canvas.nodeUi.imageTools.textareaPlaceholder'),
          inputType: 'textarea'
        }
      )
      const text = value != null ? String(value).trim() : ''
      if (text) {
        pushUndoSnapshot()
        annotateItems.value.push({
          id: createAnnotationId(),
          type: 'text',
          x,
          y,
          text,
          color: annotateColor.value,
          fontSize: getTextFontSize()
        })
        selectedId.value = null
        redrawAnnotateCanvas()
      }
    } catch {
      /* 取消 */
    }
    return
  }

  if (hitId) {
    selectedId.value = hitId
    annotateDrag.value = { lastX: x, lastY: y, didPushUndo: false }
    canvas.setPointerCapture(e.pointerId)
    redrawAnnotateCanvas()
    return
  }

  selectedId.value = null
  const tool = annotateTool.value
  if (tool === 'pen') {
    annotatePenDraft.value = [x, y]
    canvas.setPointerCapture(e.pointerId)
    redrawAnnotateCanvas()
    return
  }
  if (tool === 'rect' || tool === 'ellipse') {
    annotateDraft.value = { tool, x0: x, y0: y, x1: x, y1: y }
    canvas.setPointerCapture(e.pointerId)
  } else if (tool === 'arrow') {
    annotateDraft.value = { tool: 'arrow', x0: x, y0: y, x1: x, y1: y }
    canvas.setPointerCapture(e.pointerId)
  }
  redrawAnnotateCanvas()
}

function annotatePointerMove(e: PointerEvent) {
  if (annotateDrag.value && selectedId.value) {
    const { x, y } = annotateClientToCanvas(e)
    const d = annotateDrag.value
    const dx = x - d.lastX
    const dy = y - d.lastY
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return
    const item = annotateItems.value.find((i) => i.id === selectedId.value)
    if (!item) {
      annotateDrag.value = null
      return
    }
    if (!d.didPushUndo) {
      pushUndoSnapshot()
    }
    translateAnnotationByDelta(item, dx, dy)
    annotateDrag.value = { lastX: x, lastY: y, didPushUndo: true }
    redrawAnnotateCanvas()
    return
  }
  if (annotatePenDraft.value) {
    const { x, y } = annotateClientToCanvas(e)
    annotatePenDraft.value = [...annotatePenDraft.value, x, y]
    redrawAnnotateCanvas()
    return
  }
  if (!annotateDraft.value) return
  const { x, y } = annotateClientToCanvas(e)
  const d = annotateDraft.value
  annotateDraft.value = { ...d, x1: x, y1: y }
  redrawAnnotateCanvas()
}

function annotatePointerUp(e: PointerEvent) {
  const canvas = annotateCanvasRef.value
  if (canvas?.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId)
  }
  if (annotateDrag.value) {
    annotateDrag.value = null
    redrawAnnotateCanvas()
    return
  }
  if (annotatePenDraft.value) {
    const pts = annotatePenDraft.value
    annotatePenDraft.value = null
    if (pts.length >= 4) {
      pushUndoSnapshot()
      annotateItems.value.push({
        id: createAnnotationId(),
        type: 'pen',
        points: pts,
        stroke: annotateColor.value,
        lineWidth: getLineWidthPx()
      })
    }
    redrawAnnotateCanvas()
    return
  }
  if (annotateDraft.value) {
    commitDraft(annotateDraft.value)
    annotateDraft.value = null
    redrawAnnotateCanvas()
  }
}

function annotateDiscardDraft() {
  if (!annotateDraft.value && !annotatePenDraft.value && !annotateDrag.value) return
  annotateDraft.value = null
  annotatePenDraft.value = null
  annotateDrag.value = null
  redrawAnnotateCanvas()
}

function annotateUndo() {
  if (!undoStack.value.length) return
  redoStack.value.push(cloneAnnotations(annotateItems.value))
  annotateItems.value = undoStack.value.pop()!
  selectedId.value = null
  redrawAnnotateCanvas()
}

function annotateRedo() {
  if (!redoStack.value.length) return
  undoStack.value.push(cloneAnnotations(annotateItems.value))
  annotateItems.value = redoStack.value.pop()!
  selectedId.value = null
  redrawAnnotateCanvas()
}

function annotateDeleteSelected() {
  if (!selectedId.value) return
  pushUndoSnapshot()
  annotateItems.value = annotateItems.value.filter((i) => i.id !== selectedId.value)
  selectedId.value = null
  redrawAnnotateCanvas()
}

function annotateClearAll() {
  if (!annotateItems.value.length) return
  pushUndoSnapshot()
  annotateItems.value = []
  selectedId.value = null
  redrawAnnotateCanvas()
}

function onAnnotateKeydown(e: KeyboardEvent) {
  if (props.mode !== 'annotate' || !visible.value) return
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedId.value && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault()
      annotateDeleteSelected()
    }
  }
}

function confirmAnnotate() {
  const canvas = annotateCanvasRef.value
  if (!canvas) return
  try {
    redrawAnnotateCanvas()
    emit('apply', { dataUrl: canvasToDataUrl(canvas), mode: 'annotate' })
    visible.value = false
  } catch {
    ElMessage.error(t('canvas.nodeUi.imageTools.annotateExportFail'))
  }
}

/* ---------- 切割：默认 2×2、分割线目标约 2px；预览为纯红明显线 ------------ */
const SPLIT_DEFAULT_ROWS = 2
const SPLIT_DEFAULT_COLS = 2
const SPLIT_DEFAULT_LINE_PX = 1

const splitRows = ref(SPLIT_DEFAULT_ROWS)
const splitCols = ref(SPLIT_DEFAULT_COLS)
const splitLinePercent = ref(0.2)
const splitPreviewNat = ref({ w: 0, h: 0 })
const splitPreviewImgRef = ref<HTMLImageElement | null>(null)

function onSplitPreviewLoad(e: Event) {
  const img = e.target as HTMLImageElement
  const w = img.naturalWidth
  const h = img.naturalHeight
  splitPreviewNat.value = { w, h }
  splitLinePercent.value = lineThicknessPercentForTargetLinePx(w, h, SPLIT_DEFAULT_LINE_PX)
}

watch(
  () => props.imageUrl,
  () => {
    splitPreviewNat.value = { w: 0, h: 0 }
  }
)

watch(
  () => [props.modelValue, props.mode, props.imageUrl] as const,
  ([open, m]) => {
    if (!open || m !== 'split') return
    splitRows.value = SPLIT_DEFAULT_ROWS
    splitCols.value = SPLIT_DEFAULT_COLS
    void nextTick(() => {
      const el = splitPreviewImgRef.value
      if (el?.complete && el.naturalWidth > 0) {
        splitPreviewNat.value = { w: el.naturalWidth, h: el.naturalHeight }
        splitLinePercent.value = lineThicknessPercentForTargetLinePx(
          el.naturalWidth,
          el.naturalHeight,
          SPLIT_DEFAULT_LINE_PX
        )
      }
    })
  }
)

const splitLayoutPreview = computed(() => {
  const { w, h } = splitPreviewNat.value
  if (w < 2 || h < 2) return null
  try {
    return computeSplitGridLayout(w, h, splitRows.value, splitCols.value, splitLinePercent.value)
  } catch {
    return null
  }
})

const splitCellPolygons = computed(() => {
  const L = splitLayoutPreview.value
  if (!L) return []
  const { xOffsets, yOffsets, columnWidths, rowHeights } = L
  const rows = splitRows.value
  const cols = splitCols.value
  const out: string[] = []
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = xOffsets[c]
      const y = yOffsets[r]
      const w = columnWidths[c]
      const h = rowHeights[r]
      out.push(`${x},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`)
    }
  }
  return out
})

const splitRedRects = computed(() => {
  const L = splitLayoutPreview.value
  if (!L) return []
  const W = L.naturalWidth
  const H = L.naturalHeight
  const { xOffsets, yOffsets, columnWidths, rowHeights, lineThickness: t } = L
  const rows = splitRows.value
  const cols = splitCols.value
  const rects: { x: number; y: number; w: number; h: number }[] = []
  for (let c = 0; c < cols - 1; c += 1) {
    const x = xOffsets[c] + columnWidths[c]
    rects.push({ x, y: 0, w: t, h: H })
  }
  for (let r = 0; r < rows - 1; r += 1) {
    const y = yOffsets[r] + rowHeights[r]
    rects.push({ x: 0, y, w: W, h: t })
  }
  return rects
})

const splitSummary = computed(() => {
  const L = splitLayoutPreview.value
  if (!L) return null
  const cw = L.columnWidths
  const rh = L.rowHeights
  return {
    cellCount: splitRows.value * splitCols.value,
    minCellW: Math.min(...cw),
    maxCellW: Math.max(...cw),
    minCellH: Math.min(...rh),
    maxCellH: Math.max(...rh),
    linePx: L.lineThickness
  }
})

async function confirmSplit() {
  if (!props.imageUrl) return
  try {
    const cells = await splitImageToCells(
      props.imageUrl,
      splitRows.value,
      splitCols.value,
      splitLinePercent.value
    )
    emit('apply', { mode: 'split', cells, rows: splitRows.value, cols: splitCols.value })
    visible.value = false
    ElMessage.success(t('canvas.nodeUi.imageTools.splitOkCells', { n: cells.length }))
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : t('canvas.nodeUi.imageTools.splitFail'))
  }
}

function bindCropResizeObserver() {
  disconnectCropResizeObserver()
  const img = cropImgRef.value
  if (!img) return
  bumpCropLayout()
  cropResizeObserver = new ResizeObserver(() => {
    const el = cropImgRef.value
    if (!el) return
    const iw = el.clientWidth
    const ih = el.clientHeight
    if (iw < 2 || ih < 2) return
    if (cropAspect.value !== 'free' && cropFixedRect.value) {
      const prev = lastCropDisplaySize.value
      if (prev && prev.w > 0 && prev.h > 0 && (prev.w !== iw || prev.h !== ih)) {
        const sx = iw / prev.w
        const sy = ih / prev.h
        const r = cropFixedRect.value
        cropFixedRect.value = clampFixedAspectRect(
          r.left * sx,
          r.top * sy,
          r.width * sx,
          r.height * sy,
          iw,
          ih,
          cropAspect.value
        )
      }
    }
    lastCropDisplaySize.value = { w: iw, h: ih }
    bumpCropLayout()
  })
  cropResizeObserver.observe(img)
  const stage = cropStageRef.value
  if (stage) cropResizeObserver.observe(stage)
}

function onDialogOpened() {
  if (props.mode === 'crop') {
    cropStart.value = null
    cropNow.value = null
    cropDragging.value = false
    cropFixedDrag.value = null
    void nextTick(() => {
      bindCropResizeObserver()
      const el = cropImgRef.value
      if (el && el.complete && el.naturalWidth > 0 && cropAspect.value !== 'free') {
        cropFixedRect.value = createInitialFixedAspectRect(el.clientWidth, el.clientHeight, cropAspect.value)
        lastCropDisplaySize.value = { w: el.clientWidth, h: el.clientHeight }
        bumpCropLayout()
      }
    })
  }
  if (props.mode === 'annotate') {
    void setupAnnotateCanvas()
  }
}

function onDialogClosed() {
  cropPointerUp()
  cropFixedDrag.value = null
  annotateDiscardDraft()
  disconnectCropResizeObserver()
}
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="elDialogTitle"
    :width="dialogWidth"
    class="image-node-tool-dialog"
    :class="{
      'image-node-tool-dialog--annotate': mode === 'annotate',
      'image-node-tool-dialog--split': mode === 'split'
    }"
    append-to-body
    destroy-on-close
    @opened="onDialogOpened"
    @closed="onDialogClosed"
  >
    <template #header="{ titleId, titleClass }">
      <span
        v-if="mode === 'split'"
        :id="titleId"
        :class="[titleClass, 'split-dialog-header-title']"
      >
        <span class="split-header-part">{{ t('canvas.nodeUi.imageTools.splitHeaderTool') }}</span>
        <span class="split-header-part">{{ t('canvas.nodeUi.imageTools.splitHeaderPreview') }}</span>
      </span>
      <span v-else :id="titleId" :class="titleClass">{{ dialogTitle }}</span>
    </template>
    <!-- 裁剪 -->
    <div v-if="mode === 'crop'" class="tool-body tool-body--crop">
      <div class="crop-aspect-block">
        <span class="crop-aspect-label">{{ t('canvas.nodeUi.imageTools.cropTargetAspect') }}</span>
        <div class="aspect-chip-grid">
          <button
            v-for="opt in cropAspectOptions"
            :key="opt.value"
            type="button"
            class="aspect-chip aspect-chip--crop"
            :class="{ active: cropAspect === opt.value }"
            @click="cropAspect = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
      <p class="tool-hint" v-html="t('canvas.nodeUi.imageTools.cropHint')" />
      <div ref="cropStageRef" class="crop-stage" @wheel.prevent="onCropStageWheel">
        <img
          ref="cropImgRef"
          :src="imageUrl"
          class="crop-img"
          alt=""
          draggable="false"
          @load="onCropImgLoad"
        >
        <div
          class="crop-interaction"
          :class="{ 'crop-interaction--free': cropAspect === 'free' }"
          @pointerdown="cropPointerDown"
          @pointermove="cropPointerMove"
          @pointerup="cropPointerUp"
          @pointercancel="cropPointerUp"
        />
        <div
          v-show="cropDisplayRect.width > 2 && cropDisplayRect.height > 2"
          class="crop-marquee"
          :class="{ 'crop-marquee--movable': cropAspect !== 'free' }"
          :style="cropBoxStyle"
          @pointerdown="cropMarqueePointerDown"
          @pointermove="cropMarqueePointerMove"
          @pointerup="cropMarqueePointerUp"
          @pointercancel="cropMarqueePointerUp"
        />
      </div>
    </div>

    <!-- 标注（深色工具栏样式对齐设计稿） -->
    <div v-else-if="mode === 'annotate'" class="tool-body annotate-tool-body">
      <div class="annotate-toolbar">
        <div class="annotate-toolbar-row annotate-toolbar-tools">
          <button
            type="button"
            class="annotate-tb-btn"
            :class="{ active: annotateTool === 'rect' }"
            @click="annotateTool = 'rect'"
          >
            <span class="annotate-tb-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                <rect x="5" y="5" width="14" height="14" rx="1.5" />
              </svg>
            </span>
            <span>{{ t('canvas.nodeUi.imageTools.toolRect') }}</span>
          </button>
          <button
            type="button"
            class="annotate-tb-btn"
            :class="{ active: annotateTool === 'ellipse' }"
            @click="annotateTool = 'ellipse'"
          >
            <span class="annotate-tb-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                <circle cx="12" cy="12" r="7" />
              </svg>
            </span>
            <span>{{ t('canvas.nodeUi.imageTools.toolEllipse') }}</span>
          </button>
          <button
            type="button"
            class="annotate-tb-btn"
            :class="{ active: annotateTool === 'arrow' }"
            @click="annotateTool = 'arrow'"
          >
            <span class="annotate-tb-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 12h11" />
                <path d="M13 8l5 4-5 4" />
              </svg>
            </span>
            <span>{{ t('canvas.nodeUi.imageTools.toolArrow') }}</span>
          </button>
          <button
            type="button"
            class="annotate-tb-btn"
            :class="{ active: annotateTool === 'pen' }"
            @click="annotateTool = 'pen'"
          >
            <span class="annotate-tb-ico annotate-tb-ico-el">
              <ElIcon :size="18">
                <EditPen />
              </ElIcon>
            </span>
            <span>{{ t('canvas.nodeUi.imageTools.toolPen') }}</span>
          </button>
          <button
            type="button"
            class="annotate-tb-btn"
            :class="{ active: annotateTool === 'text' }"
            @click="annotateTool = 'text'"
          >
            <span class="annotate-tb-ico annotate-tb-ico-text" aria-hidden="true">T</span>
            <span>{{ t('canvas.nodeUi.imageTools.toolText') }}</span>
          </button>
        </div>
        <div class="annotate-toolbar-row annotate-toolbar-styles">
          <label class="annotate-color-swatch" :title="t('canvas.nodeUi.imageTools.colorPickerTitle')">
            <input v-model="annotateColor" type="color" class="annotate-color-input">
          </label>
          <ElSlider
            v-model="annotateLineWidthPercent"
            class="annotate-pct-slider"
            :min="0.1"
            :max="3"
            :step="0.05"
            :show-tooltip="false"
          />
          <span class="annotate-pct-value">{{ lineWidthPercentDisplay }}</span>
          <span class="annotate-toolbar-spacer" />
          <button
            type="button"
            class="annotate-action-btn"
            :disabled="!undoStack.length"
            @click="annotateUndo"
          >
            <ElIcon class="annotate-action-ico">
              <RefreshLeft />
            </ElIcon>
            <span>{{ t('canvas.nodeUi.imageTools.undo') }}</span>
          </button>
          <button
            type="button"
            class="annotate-action-btn"
            :disabled="!redoStack.length"
            @click="annotateRedo"
          >
            <ElIcon class="annotate-action-ico">
              <RefreshRight />
            </ElIcon>
            <span>{{ t('canvas.nodeUi.imageTools.redo') }}</span>
          </button>
          <button
            type="button"
            class="annotate-action-btn annotate-action-btn--danger"
            :disabled="!selectedId"
            @click="annotateDeleteSelected"
          >
            <ElIcon class="annotate-action-ico">
              <Delete />
            </ElIcon>
            <span>{{ t('canvas.nodeUi.imageTools.deleteSelected') }}</span>
          </button>
          <button
            type="button"
            class="annotate-action-btn"
            :disabled="!annotateItems.length"
            @click="annotateClearAll"
          >
            <ElIcon class="annotate-action-ico">
              <Delete />
            </ElIcon>
            <span>{{ t('canvas.nodeUi.imageTools.clearAll') }}</span>
          </button>
        </div>
      </div>
      <div
        class="annotate-stage"
        tabindex="0"
        @keydown="onAnnotateKeydown"
      >
        <canvas
          ref="annotateCanvasRef"
          class="annotate-canvas"
          :style="{ cursor: annotateCanvasCursor }"
          @pointerdown="annotatePointerDown"
          @pointermove="annotatePointerMove"
          @pointerup="annotatePointerUp"
          @pointercancel="annotatePointerUp"
        />
      </div>
    </div>

    <!-- 切割（对齐设计：左预览 + 右参数） -->
    <div v-else-if="mode === 'split'" class="tool-body split-tool-body">
      <div class="split-tool-layout">
        <div class="split-preview-col">
          <div class="split-preview-stage">
            <div class="split-preview-wrap">
              <img
                ref="splitPreviewImgRef"
                :src="imageUrl"
                alt=""
                class="split-preview-img"
                draggable="false"
                @load="onSplitPreviewLoad"
              >
              <svg
                v-if="splitLayoutPreview"
                class="split-preview-svg"
                :viewBox="`0 0 ${splitLayoutPreview.naturalWidth} ${splitLayoutPreview.naturalHeight}`"
                preserveAspectRatio="xMidYMid meet"
              >
                <polygon
                  v-for="(pts, i) in splitCellPolygons"
                  :key="'cell-' + i"
                  fill="none"
                  stroke="#ff0000"
                  stroke-width="4"
                  :points="pts"
                />
                <rect
                  v-for="(r, i) in splitRedRects"
                  :key="'red-' + i"
                  fill="rgba(255,0,0,0.45)"
                  :x="r.x"
                  :y="r.y"
                  :width="r.w"
                  :height="r.h"
                />
              </svg>
            </div>
          </div>
          <div class="split-legend-row">
            <div class="split-legend-left">
              <span class="split-legend-swatch" aria-hidden="true" />
              <span>{{ t('canvas.nodeUi.imageTools.splitLegendRed') }}</span>
            </div>
            <span v-if="splitPreviewNat.w" class="split-legend-dim">{{ splitPreviewNat.w }} × {{ splitPreviewNat.h }}px</span>
          </div>
        </div>
        <div class="split-params-col">
          <div class="split-params-title">
            {{ t('canvas.nodeUi.imageTools.splitParamsTitle') }}
          </div>
          <div class="split-param-row">
            <span class="split-param-label">{{ t('canvas.nodeUi.imageTools.rowsLabel') }}</span>
            <ElInputNumber v-model="splitRows" :min="1" :max="8" size="small" controls-position="right" class="split-input-num" />
          </div>
          <div class="split-param-row">
            <span class="split-param-label">{{ t('canvas.nodeUi.imageTools.colsLabel') }}</span>
            <ElInputNumber v-model="splitCols" :min="1" :max="8" size="small" controls-position="right" class="split-input-num" />
          </div>
          <div class="split-param-row split-param-row--slider">
            <span class="split-param-label">{{ t('canvas.nodeUi.imageTools.lineThickness') }}</span>
            <ElSlider v-model="splitLinePercent" :min="0" :max="3" :step="0.05" class="split-line-slider" :show-tooltip="false" />
            <span v-if="splitSummary" class="split-line-meta">{{ t('canvas.nodeUi.imageTools.splitLineMeta', { pct: splitLinePercent.toFixed(1), px: splitSummary.linePx }) }}</span>
            <span v-else class="split-line-meta">{{ t('canvas.nodeUi.imageTools.splitLinePctOnly', { pct: splitLinePercent.toFixed(1) }) }}</span>
          </div>
          <div v-if="splitSummary" class="split-info-box">
            <div class="split-info-line">
              <span class="split-info-k">{{ t('canvas.nodeUi.imageTools.splitInfoCellCount') }}</span>
              <span class="split-info-v">{{ splitSummary.cellCount }}</span>
            </div>
            <div class="split-info-line">
              <span class="split-info-k">{{ t('canvas.nodeUi.imageTools.splitInfoCellW') }}</span>
              <span class="split-info-v">{{ splitSummary.minCellW === splitSummary.maxCellW ? splitSummary.minCellW : `${splitSummary.minCellW} – ${splitSummary.maxCellW}` }}</span>
            </div>
            <div class="split-info-line">
              <span class="split-info-k">{{ t('canvas.nodeUi.imageTools.splitInfoCellH') }}</span>
              <span class="split-info-v">{{ splitSummary.minCellH === splitSummary.maxCellH ? splitSummary.minCellH : `${splitSummary.minCellH} – ${splitSummary.maxCellH}` }}</span>
            </div>
          </div>
          <p v-else-if="splitPreviewNat.w && !splitLayoutPreview" class="split-warn">
            {{ t('canvas.nodeUi.imageTools.splitWarnTooThick') }}
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="tool-dialog-footer">
        <p v-if="mode === 'annotate'" class="annotate-footer-hint">{{ t('canvas.nodeUi.imageTools.annotateFooterHint') }}</p>
        <div class="tool-dialog-footer-btns">
          <ElButton @click="visible = false">
            {{ t('canvas.nodeUi.imageTools.btnCancelFooter') }}
          </ElButton>
          <ElButton
            v-if="mode === 'crop'"
            type="primary"
            class="apply-main-btn"
            @click="confirmCrop"
          >
            {{ t('canvas.nodeUi.imageTools.btnApplyCrop') }}
          </ElButton>
          <ElButton
            v-else-if="mode === 'annotate'"
            type="primary"
            class="apply-main-btn"
            @click="confirmAnnotate"
          >
            {{ t('canvas.nodeUi.imageTools.btnApplyAnnotate') }}
          </ElButton>
          <ElButton
            v-else-if="mode === 'split'"
            type="primary"
            class="apply-main-btn"
            @click="confirmSplit"
          >
            {{ t('canvas.nodeUi.imageTools.btnApplySplit') }}
          </ElButton>
        </div>
      </div>
    </template>
  </ElDialog>
</template>

<style scoped>
.tool-body {
  min-height: 120px;
}

.tool-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

:deep(.apply-main-btn.el-button) {
  flex-shrink: 0;
  padding: 6px 12px;
  min-height: 32px;
  border-radius: 6px;
  border: none;
  background: #409eff;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
}

:deep(.apply-main-btn.el-button:hover) {
  background: #58abff;
}

:deep(.apply-main-btn.el-button.is-disabled) {
  opacity: 0.6;
  cursor: not-allowed;
}

.tool-body--crop {
  width: 100%;
  box-sizing: border-box;
}

.crop-aspect-block {
  width: 100%;
  margin-bottom: 12px;
}

.crop-aspect-label {
  display: block;
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}

.aspect-chip-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(4.25rem, 1fr));
  gap: 8px;
  width: 100%;
}

.aspect-chip {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-regular);
  cursor: pointer;
  line-height: 1.4;
}

.aspect-chip--crop {
  width: 100%;
  min-width: 0;
  min-height: 32px;
  padding: 6px 8px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.aspect-chip:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
}

.aspect-chip.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.split-row {
  align-items: center;
}

.tool-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}

.tool-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin: 0 0 12px;
  line-height: 1.5;
}

.crop-stage {
  position: relative;
  display: block;
  width: 100%;
  max-width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #111;
}

.crop-img {
  display: block;
  max-width: 100%;
  max-height: 360px;
  width: auto;
  height: auto;
  margin: 0 auto;
  vertical-align: top;
  user-select: none;
  pointer-events: none;
}

.crop-interaction {
  position: absolute;
  z-index: 1;
  inset: 0;
  cursor: default;
  touch-action: none;
}

.crop-interaction--free {
  cursor: crosshair;
}

.crop-marquee {
  position: absolute;
  z-index: 2;
  pointer-events: none;
  border: 2px solid #409eff;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
  box-sizing: border-box;
}

.crop-marquee--movable {
  pointer-events: auto;
  cursor: move;
  touch-action: none;
}

.annotate-tool-body {
  margin-top: -4px;
}

.image-node-tool-dialog--annotate :deep(.el-dialog__body) {
  padding-bottom: 16px;
}

.annotate-toolbar {
  background: #2b2b2d;
  border-radius: 6px;
  padding: 12px 14px 14px;
  margin-bottom: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.annotate-toolbar-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.annotate-toolbar-tools {
  margin-bottom: 10px;
}

.annotate-tb-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  line-height: 1.2;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.annotate-tb-btn:hover {
  border-color: #409eff;
  color: #79bbff;
}

.annotate-tb-btn.active {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.22);
  color: #a0cfff;
}

.annotate-tb-ico {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.annotate-tb-ico svg {
  width: 100%;
  height: 100%;
}

.annotate-tb-ico-el {
  color: currentColor;
}

.annotate-tb-ico-text {
  font-size: 15px;
  font-weight: 700;
  font-family: system-ui, sans-serif;
  line-height: 1;
}

.annotate-toolbar-styles {
  align-items: center;
}

.annotate-color-swatch {
  display: block;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;
}

.annotate-color-input {
  width: 48px;
  height: 48px;
  padding: 0;
  border: none;
  cursor: pointer;
  transform: translate(-8px, -8px);
}

.annotate-pct-slider {
  width: 160px;
  max-width: 42vw;
}

.annotate-pct-slider :deep(.el-slider__runway) {
  background-color: rgba(255, 255, 255, 0.35);
  height: 4px;
}

.annotate-pct-slider :deep(.el-slider__bar) {
  background-color: #409eff;
  height: 4px;
}

.annotate-pct-slider :deep(.el-slider__button) {
  width: 14px;
  height: 14px;
  border: 2px solid #409eff;
  background: #fff;
}

.annotate-pct-value {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  min-width: 38px;
}

.annotate-toolbar-spacer {
  flex: 1;
  min-width: 8px;
}

.annotate-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  transition: opacity 0.15s, border-color 0.15s, color 0.15s;
}

.annotate-action-btn:hover:not(:disabled) {
  border-color: #409eff;
  color: #a0cfff;
}

.annotate-action-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.annotate-action-btn--danger:hover:not(:disabled) {
  border-color: #f56c6c;
  color: #fab6b6;
}

.annotate-action-ico {
  font-size: 16px;
}

.tool-dialog-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  flex-wrap: wrap;
}

.annotate-footer-hint {
  flex: 1;
  min-width: 160px;
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.45;
  text-align: left;
}

.tool-dialog-footer-btns {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}

.annotate-stage {
  max-height: 360px;
  overflow: auto;
  border-radius: 8px;
  background: #111;
  text-align: center;
  outline: none;
}

.annotate-canvas {
  max-width: 100%;
  height: auto;
  vertical-align: top;
  cursor: crosshair;
  touch-action: none;
}

/* ---------- 切割工具（深色双栏） ---------- */
.image-node-tool-dialog--split :deep(.el-dialog__header) {
  background: #252528;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin: 0;
  padding: 14px 18px;
}

.image-node-tool-dialog--split :deep(.el-dialog__title) {
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
}

.image-node-tool-dialog--split :deep(.el-dialog__body) {
  padding: 16px 18px 18px;
  background: #1e1e22;
}

.image-node-tool-dialog--split :deep(.el-dialog__footer) {
  background: #252528;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px 18px;
}

.image-node-tool-dialog--split :deep(.el-dialog__headerbtn .el-dialog__close) {
  color: rgba(255, 255, 255, 0.65);
}

.split-dialog-header-title {
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 10px;
}

.split-header-part {
  font-size: var(--el-dialog-title-font-size, 16px);
  font-weight: var(--el-dialog-title-font-weight, 600);
  line-height: 1.4;
  color: inherit;
}

.split-tool-body {
  width: 100%;
  box-sizing: border-box;
}

.split-tool-layout {
  display: flex;
  gap: 20px;
  align-items: stretch;
  flex-wrap: wrap;
}

.split-preview-col {
  flex: 1 1 320px;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.split-preview-stage {
  flex: 1;
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #121214;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 10px;
  text-align: center;
}

.split-preview-wrap {
  position: relative;
  display: inline-block;
  max-width: 100%;
  vertical-align: top;
}

.split-preview-img {
  display: block;
  max-width: 100%;
  max-height: 320px;
  width: auto;
  height: auto;
  vertical-align: top;
}

.split-preview-svg {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.split-legend-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  flex-shrink: 0;
}

.split-legend-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.4;
}

.split-legend-dim {
  flex-shrink: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
}

.split-legend-swatch {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: #ff0000;
  flex-shrink: 0;
}

.split-params-col {
  flex: 0 1 280px;
  min-width: 240px;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  background: #252528;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 14px 16px;
  box-sizing: border-box;
}

.split-params-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  margin-bottom: 14px;
}

.split-param-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.split-param-row--slider {
  flex-wrap: wrap;
}

.split-param-label {
  width: 72px;
  flex-shrink: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
}

.split-input-num {
  flex: 1;
  min-width: 120px;
}

.split-input-num :deep(.el-input__wrapper) {
  background: #1a1a1d;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.split-line-slider {
  flex: 1;
  min-width: 100px;
}

.split-line-slider :deep(.el-slider__runway) {
  background: rgba(255, 255, 255, 0.25);
}

.split-line-slider :deep(.el-slider__bar) {
  background: #409eff;
}

.split-line-slider :deep(.el-slider__button) {
  border-color: #409eff;
  background: #fff;
}

.split-line-meta {
  width: 100%;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  margin-top: -4px;
  margin-left: 84px;
}

.split-info-box {
  margin-top: 8px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
}

.split-info-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  margin-bottom: 8px;
}

.split-info-line:last-child {
  margin-bottom: 0;
}

.split-info-k {
  color: rgba(255, 255, 255, 0.5);
}

.split-info-v {
  color: rgba(255, 255, 255, 0.88);
  font-weight: 500;
}

.split-warn {
  margin: 8px 0 0;
  font-size: 12px;
  color: #f56c6c;
}
</style>
