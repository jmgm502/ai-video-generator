<script setup lang="ts">
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch, withDefaults, type Component, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Plus,
  Upload,
  Promotion,
  Coordinate,
  Box,
  Grid as GridIcon,
  Download,
  FullScreen,
  Scissor,
  Pointer,
  VideoCamera,
  Operation,
  Picture,
  VideoPlay,
  Document,
  Microphone,
  Close,
  SwitchButton,
  Link,
  MagicStick,
  WarningFilled,
  QuestionFilled
} from '@element-plus/icons-vue'
import { useApiConfigStore, type ApiModelGroup } from '@/stores/apiConfigStore'
import { useArtStyleStore } from '@/stores/artStyleStore'
import { usePromptsStore } from '@/stores/promptsStore'
import { useUserStore } from '@/stores/userStore'
import { buildArtStylePromptPrefix } from '@/utils/artStylePrompt'
import { buildImageModelGenerateOptions } from '@/utils/imageModelGenerateOptions'
import { persistCanvasGeneratedImage, type CanvasPersistGeneratedImageCategory } from '@/utils/canvasMediaPersist'
import { vueFlowEdgeTypeForSetting } from '@/utils/canvasEdgeType'
import { canvasEdgeStyleFromWidth } from '@/utils/canvasEdgeStyle'
import { getModelPlatformBadge } from '@/utils/modelPlatformBadge'
import { apiService } from '@/services/apiService'
import ImageNodeImageToolsDialog, { type ImageToolApplyPayload } from '@/components/canvas/ImageNodeImageToolsDialog.vue'
import ViewpointCamera3D from '@/components/canvas/ViewpointCamera3D.vue'
import { useSimulatedGenerationProgress } from '@/composables/useSimulatedGenerationProgress'
import CanvasGeneratingOverlay from '@/components/canvas/CanvasGeneratingOverlay.vue'
import { useCanvasLodLevel, useCanvasDragging } from '@/composables/useCanvasLodLevel'
import { useCanvasNodeCommon, useCanvasNodeTitle } from '@/composables/useCanvasNodeUiI18n'

/**
 * 图片节点「视角」工具栏入口是否展示。为 false 时仅隐藏 UI，视角相关逻辑保留；若要重新开放入口，仅此处置 true（勿删下游代码）。
 */
const VIEWPOINT_UI_ENABLED = true

type ImageToolMode = 'crop' | 'annotate' | 'split'

export interface ImageNodeData {
  label: string
  type: string
  status?: 'pending' | 'running' | 'completed' | 'error'
  description?: string
  /** 提示词 */
  prompt?: string
  /** 参考图 dataURL 或 http(s)，仅用于 AI 生成时的参考 */
  referenceImages?: string[]
  /** 主区域直接上传展示的图片（与生成结果独立） */
  uploadedMainImageUrl?: string | null
  /** 生成结果，优先于 uploadedMainImageUrl 显示在主区域 */
  generatedImageUrl?: string | null
  /** 是否展开底部工具栏 */
  toolbarExpanded?: boolean
  imageQuality?: '1K' | '2K' | '4K'
  aspectRatio?: string
  imageModelGroup?: 'youshang' | 'flow2' | 'aliyun'
  imageModel?: string
  /** 画布资产链：与提示词管理中「生成人物/场景/道具提示词」对应 */
  assetCategory?: 'character' | 'scene' | 'prop'
  sourceAssetDetailNodeId?: string
  generatedByTextProcess?: boolean
  /** 分镜生成节点输出的图片：分镜序号（与 #1 #2 一致） */
  storyboardOutputStoryIndex?: number
  /** 分镜生成节点输出的图片：该分镜已连线输出图中的序号（01 起，按当前入边计数） */
  storyboardOutputImageIndex?: number
  /** 分镜占位：远端生图未完成时 true，参见 F:\\8.gongzuoliu StoryboardGen 先于 API 右侧建图动画 */
  storyboardGenerating?: boolean
  generationStartedAt?: number | null
  generationDurationMs?: number
  /** 分镜输出占位失败后的人类可读错误 */
  generationError?: string
  /** 旋转编辑模式：新建节点后在自身上方显示工具栏 */
  rotateEditing?: boolean
  rotateAngle?: number
  rotateMirrorX?: boolean
  rotateMirrorY?: boolean
  rotateOriginalImageUrl?: string | null
  /** 随界面语言刷新的标题（如云资产链「{name}图片」） */
  nodeTitleI18n?: { key: string; params?: Record<string, string | number> }
  /** 是否将当前图片作为参考图 */
  useCurrentAsReference?: boolean
}

const props = withDefaults(
  defineProps<{
    id: string
    selected?: boolean
    data: ImageNodeData
  }>(),
  { selected: false }
)

const { t, apiGroupLabelMap, notChosenModel, modelGroupFallback } = useCanvasNodeCommon()
const { canvasNodeDisplayTitle } = useCanvasNodeTitle()

const { updateNodeData: rawUpdateNodeData, addNodes, addEdges, findNode, edges } = useVueFlow()
const apiStore = useApiConfigStore()
const artStyleStore = useArtStyleStore()
const promptsStore = usePromptsStore()
const userStore = useUserStore()

const DEFAULT_CANVAS_CHAR_ASSET_PROMPT_ID = '5'
const DEFAULT_CANVAS_SCENE_ASSET_PROMPT_ID = '6'
const DEFAULT_CANVAS_PROPS_ASSET_PROMPT_ID = '7'

const canvasWorkbenchCharacterTplRef = inject<Ref<string> | undefined>(
  'canvasCharacterAssetPromptTemplateId',
  undefined
)
const canvasWorkbenchSceneTplRef = inject<Ref<string> | undefined>(
  'canvasSceneAssetPromptTemplateId',
  undefined
)
const canvasWorkbenchPropsTplRef = inject<Ref<string> | undefined>(
  'canvasPropsAssetPromptTemplateId',
  undefined
)

const lodLevel = useCanvasLodLevel()
const lodIsShell = computed(() => lodLevel.value === 'shell')

// 节点缩放功能
const { getViewport, updateNode } = useVueFlow()
const isResizing = ref(false)
const MIN_NODE_W = 360
const MIN_NODE_H = 320

const handleResizeStart = (direction: string, event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()
  isResizing.value = true

  const startX = event.clientX
  const startY = event.clientY
  const nodeData = findNode(props.id)
  if (!nodeData) return

  const startWidth = nodeData.dimensions?.width || 420
  const startHeight = nodeData.dimensions?.height || 480

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.value) return

    const zoom = getViewport().zoom || 1
    const dx = (e.clientX - startX) / zoom
    const dy = (e.clientY - startY) / zoom

    let newWidth = startWidth
    let newHeight = startHeight

    if (direction.includes('e')) {
      newWidth = Math.max(MIN_NODE_W, startWidth + dx)
    }
    if (direction.includes('s')) {
      newHeight = Math.max(MIN_NODE_H, startHeight + dy)
    }

    updateNode(props.id, {
      style: {
        width: `${newWidth}px`,
        height: `${newHeight}px`
      }
    })
  }

  const handleMouseUp = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const openCanvasImageViewer = inject<((url: string, list?: string[]) => void) | undefined>(
  'openCanvasImageViewer',
  undefined
)
const pushStateBeforeChange = inject<(() => void) | undefined>('canvasPushStateBeforeChange', undefined)
const scheduleCanvasAutoSave = inject<(() => void) | undefined>('scheduleCanvasAutoSave', undefined)

function updateNodeData(nodeId: string, data: Partial<ImageNodeData>) {
  rawUpdateNodeData(nodeId, data)
  scheduleCanvasAutoSave?.()
}
const canvasProjectContext = inject<{ projectId: Ref<string>; projectName: Ref<string> } | null>(
  'canvasProjectContext',
  null
)
const freeDrawReferenceImageRequestMap = inject<{
  get: (nodeId: string) => (() => Promise<string | null> | string | null) | null;
  has: (nodeId: string) => boolean;
} | null>('freeDrawReferenceImageRequestMap', null)

async function persistGeneratedImageUrl(url: string): Promise<string> {
  const ctx = canvasProjectContext
  if (!ctx) return url
  const pid = ctx.projectId.value
  const pname = String(ctx.projectName.value ?? '').trim()
  if (!pid || !pname) return url
  const ac = props.data.assetCategory
  const saveCategory: CanvasPersistGeneratedImageCategory =
    ac === 'character' || ac === 'scene' || ac === 'prop' ? ac : 'canvas'
  return persistCanvasGeneratedImage(pid, pname, props.id, url, saveCategory)
}

/** 将生成图落盘到指定节点 id（用于从当前节点「分出」的新节点，避免文件名与父节点混淆） */
async function persistGeneratedImageUrlWithNodeId(targetNodeId: string, url: string): Promise<string> {
  const ctx = canvasProjectContext
  if (!ctx) return url
  const pid = ctx.projectId.value
  const pname = String(ctx.projectName.value ?? '').trim()
  if (!pid || !pname) return url
  const ac = props.data.assetCategory
  const saveCategory: CanvasPersistGeneratedImageCategory =
    ac === 'character' || ac === 'scene' || ac === 'prop' ? ac : 'canvas'
  return persistCanvasGeneratedImage(pid, pname, targetNodeId, url, saveCategory)
}

const mainFileInputRef = ref<HTMLInputElement | null>(null)
const refFileInputRef = ref<HTMLInputElement | null>(null)
const qualityPopoverVisible = ref(false)
const modelPopoverVisible = ref(false)
const panelModelGroup = ref<ImageNodeData['imageModelGroup'] | null>(null)

const imageToolDialogVisible = ref(false)
const imageToolDialogMode = ref<ImageToolMode | null>(null)

const rotateAngle = computed({
  get: () => props.data.rotateAngle ?? 0,
  set: (v: number) => updateNodeData(props.id, { rotateAngle: v })
})
const rotateMirrorX = computed({
  get: () => props.data.rotateMirrorX ?? false,
  set: (v: boolean) => updateNodeData(props.id, { rotateMirrorX: v })
})
const rotateMirrorY = computed({
  get: () => props.data.rotateMirrorY ?? false,
  set: (v: boolean) => updateNodeData(props.id, { rotateMirrorY: v })
})
const rotateSaving = ref(false)
const rotatePanelOpen = computed(() => !!props.data.rotateEditing)

/** 底部「视角」操作区；接口始终使用千问 qwen-image-edit-2509 */
const viewpointPanelOpen = ref(false)
/** 入口关闭时不展示视角面板（避免占满底部工具条） */
const isViewpointPanelUiVisible = computed(() => VIEWPOINT_UI_ENABLED && viewpointPanelOpen.value)
const viewpointGenerating = ref(false)
/** 3D 摄像机：水平环视 0–360 */
const vpCamYaw = ref(0)
/** 俯仰，度 */
const vpCamPitch = ref(0)
/** 与主体距离，倍率 0.5–2 */
const vpCamDistance = ref(1)
/** 视角调整模块使用的独立模型状态 */
const viewpointSelectedModelId = ref<string>('qwen-image-edit-max-2026-01-16')

const viewpointSelectedModelName = computed(() => {
  const models = imageModelsByGroup.value.aliyun || []
  const m = models.find(m => m.id === viewpointSelectedModelId.value)
  return m?.name || viewpointSelectedModelId.value
})
/** 相机视角模式 */
const viewpointCameraView = ref(false)

/** 预设角度配置 */
const horizontalPresets = [
  { label: '正面', value: 0 },
  { label: '左前', value: 45 },
  { label: '左侧', value: 90 },
  { label: '左后', value: 135 },
  { label: '背面', value: 180 },
  { label: '右后', value: 225 },
  { label: '右侧', value: 270 },
  { label: '右前', value: 315 }
]

const verticalPresets = [
  { label: '仰视', value: -45 },
  { label: '平视', value: 0 },
  { label: '俯视', value: 45 },
  { label: '鸟瞰', value: 90 }
]

const distancePresets = [
  { label: '特写', value: 0.5 },
  { label: '中景', value: 1 },
  { label: '远景', value: 1.5 },
  { label: '全景', value: 2 }
]

function isHorizontalPresetActive(value: number): boolean {
  return Math.abs(vpCamYaw.value - value) < 5 || 
         (value === 0 && (vpCamYaw.value < 5 || vpCamYaw.value > 355))
}

function isVerticalPresetActive(value: number): boolean {
  return Math.abs(vpCamPitch.value - value) < 5
}

function isDistancePresetActive(value: number): boolean {
  return Math.abs(vpCamDistance.value - value) < 0.1
}

function applyHorizontalPreset(value: number) {
  vpCamYaw.value = value
}

function applyVerticalPreset(value: number) {
  vpCamPitch.value = value
}

function applyDistancePreset(value: number) {
  vpCamDistance.value = value
}

const toolbarPromptPlaceholder = computed(() =>
  t('canvas.nodeUi.common.toolbarPromptPlaceholder')
)

const imageModelsByGroup = computed(() => ({
  youshang: apiStore.imageModels,
  flow2: apiStore.flow2ImageModels as typeof apiStore.imageModels,
  aliyun: apiStore.imageModels.filter(m => m.id.startsWith('qwen-image'))
}))

const mergedModelOptions = computed(() => {
  const m = apiGroupLabelMap.value
  const groups: { value: 'youshang' | 'flow2' | 'aliyun'; label: string; models: typeof apiStore.imageModels }[] = [
    { value: 'youshang', label: m.youshang, models: imageModelsByGroup.value.youshang },
    { value: 'flow2', label: m.flow2, models: imageModelsByGroup.value.flow2 },
    { value: 'aliyun', label: m.aliyun, models: imageModelsByGroup.value.aliyun }
  ]
  return groups
})

const currentModelGroupOption = computed(() => {
  const currentGroup = props.data.imageModelGroup || apiStore.imageModelGroup
  return mergedModelOptions.value.find(group => group.value === currentGroup) || mergedModelOptions.value[0]
})
const currentModelMeta = computed(() => {
  const group = currentModelGroupOption.value
  const modelId = props.data.imageModel || apiStore.imageModel
  const hit = group?.models.find(item => item.id === modelId) || group?.models[0]
  return {
    modelName: hit?.name || notChosenModel(),
    groupLabel: group?.label || modelGroupFallback()
  }
})
const activePanelGroup = computed(() => {
  const fallback = currentModelGroupOption.value?.value || 'youshang'
  return panelModelGroup.value || fallback
})
const panelGroupModels = computed(() => {
  const hit = mergedModelOptions.value.find(item => item.value === activePanelGroup.value)
  return hit?.models || []
})
const panelGroupModelsWithBadge = computed(() =>
  panelGroupModels.value.map((model) => ({
    ...model,
    badge: getModelPlatformBadge(model.id, model.name)
  }))
)

const promptModel = computed({
  get: () => props.data.prompt ?? '',
  set: (v: string) => updateNodeData(props.id, { prompt: v })
})

const imageQuality = computed({
  get: () => props.data.imageQuality ?? '1K',
  set: (v: '1K' | '2K' | '4K') => updateNodeData(props.id, { imageQuality: v })
})

const aspectRatio = computed({
  get: () => props.data.aspectRatio ?? '16:9',
  set: (v: string) => updateNodeData(props.id, { aspectRatio: v })
})

const referenceImages = computed(() => props.data.referenceImages ?? [])

const toolbarExpanded = computed({
  get: () => props.data.toolbarExpanded ?? false,
  set: (v: boolean) => updateNodeData(props.id, { toolbarExpanded: v })
})

watch(toolbarExpanded, (open) => {
  if (!open) viewpointPanelOpen.value = false
})

/** 主预览区：生成图优先，否则为直接上传的图 */
const previewDisplayUrl = computed(
  () => props.data.generatedImageUrl ?? props.data.uploadedMainImageUrl ?? null
)

const hasImage = computed(() => !!previewDisplayUrl.value)

/** 分镜连线输出占位：先于 API 在右侧建空白图节点时的从左向右伪进度扫光 */
const isStoryboardSweep = computed(
  () =>
    props.data.storyboardGenerating === true &&
    !(props.data.generatedImageUrl ?? props.data.uploadedMainImageUrl)
)

const storyboardGenFailed = computed(() => {
  if (previewDisplayUrl.value) return false
  if (props.data.status !== 'error') return false
  const msg = String(props.data.generationError ?? '').trim()
  return msg.length > 0
})

const storyboardGenFailMessage = computed(() => String(props.data.generationError ?? '').trim())

const storyboardSweepNow = ref(Date.now())
/** 浏览器与 Node 类型对 setInterval 返回值定义不一致，画布仅跑在浏览器中用 number */
let storyboardSweepTicker: number | null = null

watch(
  isStoryboardSweep,
  (on) => {
    if (on) {
      storyboardSweepNow.value = Date.now()
      if (storyboardSweepTicker != null) {
        window.clearInterval(storyboardSweepTicker)
      }
      storyboardSweepTicker = window.setInterval(() => {
        storyboardSweepNow.value = Date.now()
      }, 120)
    } else if (storyboardSweepTicker != null) {
      window.clearInterval(storyboardSweepTicker)
      storyboardSweepTicker = null
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (storyboardSweepTicker != null) {
    window.clearInterval(storyboardSweepTicker)
    storyboardSweepTicker = null
  }
})

const storyboardSweepProgress = computed(() => {
  if (!isStoryboardSweep.value) return 0
  const startedRaw = props.data.generationStartedAt
  const started =
    typeof startedRaw === 'number' && Number.isFinite(startedRaw)
      ? startedRaw
      : storyboardSweepNow.value
  const duration = Math.max(3000, props.data.generationDurationMs ?? 90_000)
  const elapsed = Math.max(0, storyboardSweepNow.value - started)
  return Math.min(elapsed / duration, 0.96)
})

const storyboardSweepPercentDisplay = computed(() =>
  Math.round(storyboardSweepProgress.value * 100)
)

/** 分镜输出图标题：绿色加粗 #N；与「分镜图片」留白由 `.node-label-storyboard { gap }` 控制（与 StoryboardGen 标题一致） */
const storyboardImageHeaderParts = computed(() => {
  const si = props.data.storyboardOutputStoryIndex
  const ii = props.data.storyboardOutputImageIndex
  if (typeof si === 'number' && si > 0 && typeof ii === 'number' && ii > 0) {
    return {
      seq: `#${si}`,
      rest: t('canvas.nodeUi.imageNode.storyboardShotImgTpl', { n: String(ii).padStart(2, '0') })
    }
  }
  return null
})

const plainImageNodeTitle = computed(() =>
  canvasNodeDisplayTitle(props.data, 'canvas.nodeUi.imageNode.defaultTitle')
)

const imageLodShellTitle = computed(() => {
  const sb = storyboardImageHeaderParts.value
  if (sb) return `${sb.seq} ${sb.rest}`.trim()
  return plainImageNodeTitle.value
})

const qualityAspectSummary = computed(() => `${aspectRatio.value} · ${imageQuality.value}`)

const ratioOptions = [
  { id: '16:9', label: '16:9' },
  { id: '1:1', label: '1:1' },
  { id: '9:16', label: '9:16' },
  { id: '3:4', label: '3:4' },
  { id: '4:3', label: '4:3' },
  { id: '21:9', label: '21:9' }
]

const statusColor = computed(() => {
  switch (props.data.status) {
    case 'running': return '#409eff'
    case 'completed': return '#67c23a'
    case 'error': return '#f56c6c'
    default: return '#909399'
  }
})

const imageHeaderIcon = computed((): Component => {
  const t = props.data.type
  if (t === 'video') return VideoPlay
  if (t === 'text') return Document
  if (t === 'audio') return Microphone
  return Picture
})

const imageHeaderIconClass = computed(() => {
  const t = props.data.type
  if (t === 'video') return 'node-type-icon--video'
  if (t === 'text') return 'node-type-icon--text'
  if (t === 'audio') return 'node-type-icon--audio'
  return 'node-type-icon--image'
})

const useCurrentAsReference = computed({
  get: () => props.data.useCurrentAsReference ?? false,
  set: (v: boolean) => updateNodeData(props.id, { useCurrentAsReference: v })
})

function ensureDefaults() {
  const patch: Partial<ImageNodeData> = {}
  const validModelIds = new Set(mergedModelOptions.value.flatMap(group => group.models.map(model => model.id)))
  if (!props.data.imageModelGroup) patch.imageModelGroup = apiStore.imageModelGroup as ImageNodeData['imageModelGroup']
  if (!props.data.imageModel || !validModelIds.has(props.data.imageModel)) patch.imageModel = apiStore.imageModel
  if (props.data.toolbarExpanded === undefined) patch.toolbarExpanded = false
  if (!props.data.imageQuality) patch.imageQuality = '1K'
  if (!props.data.aspectRatio) patch.aspectRatio = '16:9'
  if (!props.data.referenceImages) patch.referenceImages = []
  if (props.data.useCurrentAsReference === undefined) patch.useCurrentAsReference = false
  if (Object.keys(patch).length) updateNodeData(props.id, patch)
}

onMounted(() => {
  ensureDefaults()
})

function expandToolbar() {
  updateNodeData(props.id, { toolbarExpanded: true })
}

function onModelPopoverShow() {
  const fallback = (props.data.imageModelGroup || apiStore.imageModelGroup || 'youshang') as ImageNodeData['imageModelGroup']
  panelModelGroup.value = fallback
}

function selectModelGroup(group: ImageNodeData['imageModelGroup']) {
  panelModelGroup.value = group
  const groupModels = mergedModelOptions.value.find(item => item.value === group)?.models || []
  const currentId = props.data.imageModel || apiStore.imageModel
  const currentExists = groupModels.some(item => item.id === currentId)
  const fallbackModel = currentExists ? currentId : groupModels[0]?.id
  if (fallbackModel) {
    updateNodeData(props.id, {
      imageModelGroup: group,
      imageModel: fallbackModel
    })
  } else {
    updateNodeData(props.id, { imageModelGroup: group })
  }
}

function selectModel(modelId: string) {
  const group = activePanelGroup.value as ImageNodeData['imageModelGroup']
  updateNodeData(props.id, {
    imageModelGroup: group,
    imageModel: modelId
  })
  modelPopoverVisible.value = false
}

/** 点击图片区域：展开底部工具栏；有图时上方为操作胶囊条（不再打开大图预览） */
function onPreviewClick() {
  expandToolbar()
}

function openImageTool(mode: ImageToolMode) {
  if (!previewDisplayUrl.value) {
    ElMessage.warning(t('canvas.nodeUi.imageNode.needImageFirst'))
    return
  }
  imageToolDialogMode.value = mode
  imageToolDialogVisible.value = true
}

/** 裁剪结果输出为新节点，原节点主图不变（与生成图逻辑独立，仍显示原 uploaded / 原生成图） */
function createCroppedOutputNode(dataUrl: string) {
  const self = findNode(props.id)
  const w = self?.dimensions?.width ?? 360
  const gap = 48
  const newId = `image-crop-${Date.now()}`
  addNodes({
    id: newId,
    type: 'imageCanvas',
    position: {
      x: (self?.position.x ?? 0) + w + gap,
      y: self?.position.y ?? 0
    },
    data: {
      label: t('canvas.nodeUi.imageNode.cropLabel'),
      type: 'image',
      status: 'completed' as const,
      description: t('canvas.nodeUi.imageNode.cropDesc'),
      prompt: '',
      referenceImages: [] as string[],
      uploadedMainImageUrl: dataUrl,
      generatedImageUrl: null as string | null,
      toolbarExpanded: false,
      imageQuality: (props.data.imageQuality ?? '1K') as ImageNodeData['imageQuality'],
      aspectRatio: props.data.aspectRatio ?? '16:9',
      imageModelGroup: props.data.imageModelGroup ?? apiStore.imageModelGroup,
      imageModel: props.data.imageModel ?? apiStore.imageModel
    } satisfies ImageNodeData
  })
  addEdges({
    id: `e-${props.id}-crop-${newId}`,
    source: props.id,
    target: newId,
    type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
    animated: true,
    style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
  })
  ElMessage.success(t('canvas.nodeUi.imageNode.cropNodeOk'))
}

function createAnnotateOutputNode(dataUrl: string) {
  const self = findNode(props.id)
  const w = self?.dimensions?.width ?? 360
  const gap = 48
  const newId = `image-annotate-${Date.now()}`
  addNodes({
    id: newId,
    type: 'imageCanvas',
    position: {
      x: (self?.position.x ?? 0) + w + gap,
      y: self?.position.y ?? 0
    },
    data: {
      label: t('canvas.nodeUi.imageNode.annotateLabel'),
      type: 'image',
      status: 'completed' as const,
      description: t('canvas.nodeUi.imageNode.annotateDesc'),
      prompt: '',
      referenceImages: [] as string[],
      uploadedMainImageUrl: dataUrl,
      generatedImageUrl: null as string | null,
      toolbarExpanded: false,
      imageQuality: (props.data.imageQuality ?? '1K') as ImageNodeData['imageQuality'],
      aspectRatio: props.data.aspectRatio ?? '16:9',
      imageModelGroup: props.data.imageModelGroup ?? apiStore.imageModelGroup,
      imageModel: props.data.imageModel ?? apiStore.imageModel
    } satisfies ImageNodeData
  })
  addEdges({
    id: `e-${props.id}-annotate-${newId}`,
    source: props.id,
    target: newId,
    type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
    animated: true,
    style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
  })
  ElMessage.success(t('canvas.nodeUi.imageNode.annotateNodeOk'))
}

/** 视角调整结果：右侧新建图片节点展示，不修改当前节点主图（与裁剪/标注一致） */
async function createViewpointOutputNode(imageUrl: string) {
  const self = findNode(props.id)
  const w = self?.dimensions?.width ?? 360
  const gap = 48
  const newId = `image-viewpoint-${Date.now()}`
  const displayUrl = await persistGeneratedImageUrlWithNodeId(newId, imageUrl)
  pushStateBeforeChange?.()
  addNodes({
    id: newId,
    type: 'imageCanvas',
    position: {
      x: (self?.position.x ?? 0) + w + gap,
      y: self?.position.y ?? 0
    },
    data: {
      label: t('canvas.nodeUi.imageNode.viewpointLabel'),
      type: 'image',
      status: 'completed' as const,
      description: t('canvas.nodeUi.imageNode.viewpointDesc'),
      prompt: '',
      referenceImages: [] as string[],
      uploadedMainImageUrl: displayUrl,
      generatedImageUrl: null as string | null,
      toolbarExpanded: false,
      imageQuality: (props.data.imageQuality ?? '1K') as ImageNodeData['imageQuality'],
      aspectRatio: props.data.aspectRatio ?? '16:9',
      imageModelGroup: props.data.imageModelGroup ?? apiStore.imageModelGroup,
      imageModel: props.data.imageModel ?? apiStore.imageModel
    } satisfies ImageNodeData
  })
  addEdges({
    id: `e-${props.id}-viewpoint-${newId}`,
    source: props.id,
    target: newId,
    type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
    animated: true,
    style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
  })
  ElMessage.success(t('canvas.nodeUi.imageNode.viewpointNodeOk'))
}

function createSplitResultOutputNode(cells: string[], rows: number, cols: number) {
  const self = findNode(props.id)
  const w = self?.dimensions?.width ?? 360
  const gap = 48
  const count = cells.length
  const captions = cells.map((_, i) => {
    const n = String(i + 1).padStart(2, '0')
    return t('canvas.nodeUi.imageNode.storyboardShotDescTpl', { n })
  })
  const newId = `image-split-${Date.now()}`
  addNodes({
    id: newId,
    type: 'imageSplitResult',
    position: {
      x: (self?.position.x ?? 0) + w + gap,
      y: self?.position.y ?? 0
    },
    data: {
      label: t('canvas.nodeUi.imageSplit.defaultTitle'),
      type: 'splitResult',
      cells,
      gridRows: rows,
      gridCols: cols,
      captions,
      nodeTitleI18n: { key: 'canvas.nodeUi.imageSplit.defaultTitle' }
    }
  })
  addEdges({
    id: `e-${props.id}-split-${newId}`,
    source: props.id,
    target: newId,
    type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
    animated: true,
    style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
  })
  ElMessage.success(t('canvas.nodeUi.imageNode.splitNodesOk', { count }))
}

function onToolDialogApply(payload: ImageToolApplyPayload) {
  if (payload.mode === 'crop') {
    createCroppedOutputNode(payload.dataUrl)
    return
  }
  if (payload.mode === 'annotate') {
    createAnnotateOutputNode(payload.dataUrl)
    return
  }
  if (payload.mode === 'split') {
    createSplitResultOutputNode(payload.cells, payload.rows, payload.cols)
    return
  }
}

/** 远程图或 dataURL 统一为 dataURL，便于桌面端写入文件 */
async function imageUrlToDataUrlForSave(url: string): Promise<string> {
  if (url.startsWith('data:')) {
    return url
  }
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) {
    throw new Error(t('canvas.nodeUi.imageNode.fetchFail'))
  }
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error(t('canvas.nodeUi.imageNode.readBlobFail')))
    r.readAsDataURL(blob)
  })
}

function defaultDownloadFileName(): string {
  const label = props.data.label?.trim() ?? ''
  if (/\.(png|jpe?g|gif|webp)$/i.test(label)) {
    return label.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
  }
  return `image-${Date.now()}.png`
}

async function downloadImageToLocal() {
  const url = previewDisplayUrl.value
  if (!url) {
    ElMessage.warning('没有可下载的图片')
    return
  }
  const defaultName = defaultDownloadFileName()
  try {
    const dataUrl = await imageUrlToDataUrlForSave(url)
    const api = window.electronAPI
    if (api?.dialog?.saveFile && api?.file?.writeDataUrlToFile) {
      const result = await api.dialog.saveFile({
        defaultPath: defaultName,
        filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
      })
      if (result.canceled || !result.filePath) {
        return
      }
      const w = await api.file.writeDataUrlToFile(result.filePath, dataUrl)
      if (w.success) {
        ElMessage.success('已保存到本地')
      } else {
        ElMessage.error(w.message || '保存失败')
      }
      return
    }
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = defaultName
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    ElMessage.success('已开始下载')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '下载失败')
  }
}

function openFullscreenPreview() {
  const url = previewDisplayUrl.value
  if (!url) {
    ElMessage.warning('没有可查看的图片')
    return
  }
  if (openCanvasImageViewer) {
    openCanvasImageViewer(url, [url])
  } else {
    ElMessage.warning('预览未就绪')
  }
}

function createVr360PanoNodeFromCurrent() {
  const u = previewDisplayUrl.value
  if (!u) {
    ElMessage.warning(t('canvas.nodeUi.imageNode.needImageFirst'))
    return
  }
  const self = findNode(props.id)
  const w = self?.dimensions?.width ?? 360
  const newId = `vr360-${Date.now()}`
  const edgeT = vueFlowEdgeTypeForSetting(userStore.edgeStyle)
  const st = canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
  pushStateBeforeChange?.()
  addNodes({
    id: newId,
    type: 'vr360',
    position: { x: (self?.position.x ?? 0) + w + 48, y: self?.position.y ?? 0 },
    style: { width: '520px' },
    data: {
      label: '三维全景',
      type: 'vr360',
      imageUrl: u,
      previewImageUrl: u,
      autoRotate: false
    }
  })
  addEdges({
    id: `e-${props.id}-vr360-${newId}`,
    source: props.id,
    target: newId,
    type: edgeT,
    animated: true,
    style: st
  })
  ElMessage.success('已添加 三维全景节点')
}

function openRotateTool() {
  if (!hasImage.value) {
    ElMessage.warning('请先上传或生成主图')
    return
  }
  updateNodeData(props.id, { 
    rotateEditing: true, 
    rotateAngle: 0, 
    rotateMirrorX: false, 
    rotateMirrorY: false,
    rotateOriginalImageUrl: previewDisplayUrl.value
  })
}

async function openRotateNodeFromCurrent() {
  const src = previewDisplayUrl.value
  if (!src) {
    ElMessage.warning('没有可旋转的图片')
    return
  }
  const self = findNode(props.id)
  const w = self?.dimensions?.width ?? 360
  const gap = 48
  const newId = `image-rotate-${Date.now()}`
  pushStateBeforeChange?.()
  addNodes({
    id: newId,
    type: 'imageCanvas',
    position: { x: (self?.position.x ?? 0) + w + gap, y: self?.position.y ?? 0 },
    data: {
      label: t('canvas.nodeUi.imageNode.defaultTitle'),
      type: 'image',
      status: 'pending' as const,
      description: '旋转中的图片',
      prompt: '',
      referenceImages: [] as string[],
      uploadedMainImageUrl: src,
      generatedImageUrl: null,
      toolbarExpanded: true,
      rotateEditing: true,
      rotateAngle: 0,
      rotateMirrorX: false,
      rotateMirrorY: false,
      rotateOriginalImageUrl: src,
      imageQuality: (props.data.imageQuality ?? '1K') as ImageNodeData['imageQuality'],
      aspectRatio: props.data.aspectRatio ?? '16:9',
      imageModelGroup: props.data.imageModelGroup ?? apiStore.imageModelGroup,
      imageModel: props.data.imageModel ?? apiStore.imageModel
    } satisfies ImageNodeData
  })
  addEdges({
    id: `e-${props.id}-rotate-${newId}`,
    source: props.id,
    target: newId,
    type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
    animated: true,
    style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
  })
}

function handleRotateRight90() {
  const newAngle = (rotateAngle.value + 90) % 360
  rotateAngle.value = newAngle < 0 ? newAngle + 360 : newAngle
  renderRotatePreview()
}

function handleAngleInput() {
  // 确保角度在 0-359 度之间
  let newAngle = rotateAngle.value
  if (newAngle < 0) {
    newAngle = 0
  } else if (newAngle >= 360) {
    newAngle = newAngle % 360
  }
  if (newAngle !== rotateAngle.value) {
    rotateAngle.value = newAngle
  }
  renderRotatePreview()
}

function toggleRotateMirrorX() {
  rotateMirrorX.value = !rotateMirrorX.value
  renderRotatePreview()
}

function toggleRotateMirrorY() {
  rotateMirrorY.value = !rotateMirrorY.value
  renderRotatePreview()
}

function closeRotatePanel() {
  updateNodeData(props.id, { 
    rotateEditing: false, 
    rotateAngle: 0, 
    rotateMirrorX: false, 
    rotateMirrorY: false 
  })
}

function resetRotateState() {
  rotateAngle.value = 0
  rotateMirrorX.value = false
  rotateMirrorY.value = false
}

function renderRotatePreview() {
  const src = props.data.rotateOriginalImageUrl || previewDisplayUrl.value
  if (!src) return
  const img = document.createElement('img')
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const angleRad = (rotateAngle.value * Math.PI) / 180
    const sx = rotateMirrorX.value ? -1 : 1
    const sy = rotateMirrorY.value ? -1 : 1
    
    // 计算旋转后图片的边界框尺寸（适配任意角度）
    const cosTheta = Math.abs(Math.cos(angleRad))
    const sinTheta = Math.abs(Math.sin(angleRad))
    const newWidth = img.width * cosTheta + img.height * sinTheta
    const newHeight = img.width * sinTheta + img.height * cosTheta
    
    canvas.width = newWidth
    canvas.height = newHeight
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate(angleRad)
    ctx.scale(sx, sy)
    ctx.drawImage(img, -img.width / 2, -img.height / 2)
    const dataUrl = canvas.toDataURL('image/png')
    updateNodeData(props.id, {
      uploadedMainImageUrl: dataUrl,
      generatedImageUrl: null,
      status: 'pending'
    })
  }
  img.src = src
}

async function saveRotateOutput() {
  rotateSaving.value = true
  try {
    const src = props.data.rotateOriginalImageUrl || previewDisplayUrl.value
    if (!src) {
      ElMessage.warning('没有可旋转的图片')
      return
    }
    const img = document.createElement('img')
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('load'))
      img.src = src
    })
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const angleRad = (rotateAngle.value * Math.PI) / 180
    const sx = rotateMirrorX.value ? -1 : 1
    const sy = rotateMirrorY.value ? -1 : 1
    
    // 计算旋转后图片的边界框尺寸（适配任意角度）
    const cosTheta = Math.abs(Math.cos(angleRad))
    const sinTheta = Math.abs(Math.sin(angleRad))
    const newWidth = img.width * cosTheta + img.height * sinTheta
    const newHeight = img.width * sinTheta + img.height * cosTheta
    
    canvas.width = newWidth
    canvas.height = newHeight
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate(angleRad)
    ctx.scale(sx, sy)
    ctx.drawImage(img, -img.width / 2, -img.height / 2)
    const dataUrl = canvas.toDataURL('image/png')
    const displayUrl = await persistGeneratedImageUrl(dataUrl)
    updateNodeData(props.id, {
      uploadedMainImageUrl: displayUrl,
      generatedImageUrl: null,
      status: 'completed',
      toolbarExpanded: true,
      rotateEditing: false,
      rotateOriginalImageUrl: null
    })
    ElMessage.success('旋转图片已保存')
  } catch {
    ElMessage.error('旋转图片失败')
  } finally {
    rotateSaving.value = false
  }
}

/** 顶部图片操作条 */
const showReferenceLines = ref(false)

/** 是否显示模型不支持参考图的提示 */
const showModelRefNotSupported = ref(false)

/** 宫格切分相关状态 */
const gridSplitMode = ref(false)
const gridSplitRows = ref(2)
const gridSplitCols = ref(2)
const gridSplitPopoverVisible = ref(false)
const selectedGridCells = ref<number[]>([])

/** 宫格切分选项 */
const gridOptions = [
  { rows: 2, cols: 2, labelKey: 'grid4' },
  { rows: 3, cols: 3, labelKey: 'grid9' },
  { rows: 4, cols: 4, labelKey: 'grid16' },
  { rows: 5, cols: 5, labelKey: 'grid25' }
]

/** 切换到宫格切分模式 */
function enterGridSplitMode(rows: number, cols: number) {
  if (!hasImage.value) {
    ElMessage.warning(t('canvas.nodeUi.imageNode.needMainImg'))
    return
  }
  gridSplitRows.value = rows
  gridSplitCols.value = cols
  gridSplitMode.value = true
  selectedGridCells.value = []
  gridSplitPopoverVisible.value = false
}

/** 退出宫格切分模式 */
function exitGridSplitMode() {
  gridSplitMode.value = false
  selectedGridCells.value = []
}

/** 切换宫格选择 */
function toggleGridCell(index: number) {
  const idx = selectedGridCells.value.indexOf(index)
  if (idx === -1) {
    selectedGridCells.value.push(index)
  } else {
    selectedGridCells.value.splice(idx, 1)
  }
}

/** 宫格选择数量的计算属性 */
const gridSelectionCount = computed(() => selectedGridCells.value.length)

/** 宫格切分方法显示文本 */
const gridSplitLabel = computed(() => {
  return t(`canvas.nodeUi.imageNode.grid${gridSplitRows.value * gridSplitCols.value}` as any)
})

/** 切分图片成多个宫格 */
function splitImageIntoGrids(imgUrl: string, rows: number, cols: number): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const cellWidth = img.width / cols
      const cellHeight = img.height / rows
      const cells: string[] = []

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const canvas = document.createElement('canvas')
          canvas.width = cellWidth
          canvas.height = cellHeight
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(
              img,
              c * cellWidth, r * cellHeight,
              cellWidth, cellHeight,
              0, 0,
              cellWidth, cellHeight
            )
            cells.push(canvas.toDataURL('image/png'))
          }
        }
      }
      resolve(cells)
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = imgUrl
  })
}

/** 根据选择的宫格创建图片节点 */
async function createGridImageNodes() {
  if (selectedGridCells.value.length === 0) {
    ElMessage.warning('请先选择宫格')
    return
  }
  if (!previewDisplayUrl.value) {
    ElMessage.warning(t('canvas.nodeUi.imageNode.needMainImg'))
    return
  }

  try {
    const rows = gridSplitRows.value
    const cols = gridSplitCols.value
    const cells = await splitImageIntoGrids(previewDisplayUrl.value, rows, cols)
    const self = findNode(props.id)
    const sourceX = self?.position.x ?? 0
    const sourceY = self?.position.y ?? 0
    const sourceWidth = self?.dimensions?.width ?? 360
    const sourceHeight = self?.dimensions?.height ?? 360
    const gapX = 56
    const gapY = 36
    const cellWidth = self?.dimensions?.width ?? 430
    const cellHeight = self?.dimensions?.height ?? 360
    const edgeT = vueFlowEdgeTypeForSetting(userStore.edgeStyle)
    const st = canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)

    const orderedCells = [...selectedGridCells.value].sort((a, b) => a - b)
    const baseX = sourceX + sourceWidth + gapX
    const baseY = sourceY

    for (const cellIndex of orderedCells) {
      const row = Math.floor(cellIndex / cols)
      const col = cellIndex % cols
      const newId = `grid-split-${Date.now()}-${cellIndex}`
      const displayUrl = await persistGeneratedImageUrlWithNodeId(newId, cells[cellIndex])

      addNodes({
        id: newId,
        type: 'imageCanvas',
        position: {
          x: baseX + (col * (cellWidth + gapX)),
          y: baseY + (row * (cellHeight + gapY))
        },
        data: {
          label: t('canvas.nodeUi.imageNode.defaultTitle'),
          type: 'image',
          status: 'completed',
          description: t('canvas.nodeUi.imageNode.cropDesc'),
          prompt: '',
          referenceImages: [],
          uploadedMainImageUrl: displayUrl,
          generatedImageUrl: null,
          toolbarExpanded: false,
          imageQuality: (props.data.imageQuality ?? '1K') as ImageNodeData['imageQuality'],
          aspectRatio: props.data.aspectRatio ?? '16:9',
          imageModelGroup: props.data.imageModelGroup ?? apiStore.imageModelGroup,
          imageModel: props.data.imageModel ?? apiStore.imageModel
        } satisfies ImageNodeData
      })
      addEdges({
        id: `e-${props.id}-grid-${newId}`,
        source: props.id,
        target: newId,
        type: edgeT,
        animated: true,
        style: st
      })
    }

    ElMessage.success(t('canvas.nodeUi.imageNode.splitNodesOk', { count: selectedGridCells.value.length }))
    exitGridSplitMode()
  } catch (err) {
    ElMessage.error('切分图片失败')
  }
}

/** 根据选择的宫格生成高清图片 */
async function generateHighResImage() {
  if (selectedGridCells.value.length === 0) {
    ElMessage.warning('请先选择宫格')
    return
  }
  if (!previewDisplayUrl.value) {
    ElMessage.warning(t('canvas.nodeUi.imageNode.needMainImg'))
    return
  }

  const ig = (props.data.imageModelGroup ?? apiStore.imageModelGroup) as ApiModelGroup
  if (!apiStore.isApiReadyForGroup(ig)) {
    ElMessage.warning(
      ig === 'flow2' ? t('settings.msg.enterApiUrlFirst') : t('canvas.nodeUi.imageNode.needApiKey')
    )
    return
  }

  let modelId = props.data.imageModel || apiStore.imageModel
  if (!modelId) {
    ElMessage.warning(t('canvas.nodeUi.imageNode.needModel'))
    return
  }
  
  if (ig === 'flow2') {
    modelId = apiStore.resolveFlow2ImageModelId(modelId, imageQuality.value)
  }

  const prompt = (props.data.prompt || '').trim()

  const q = imageQuality.value
  const ar = aspectRatio.value
  const extra = buildImageModelGenerateOptions(modelId, q, ar)

  const stylePrefix = buildArtStylePromptPrefix(artStyleStore.artStyles, artStyleStore.selectedStyle)
  const bodyPrompt = prompt ? buildImageGeneratePromptBody(prompt) : ''
  
  // 硬编码的高清增强提示词
  const hardcodedPrompt = `超高清画质，无损画质增强，超清修复，细节极致强化，锐化清晰，去除模糊，去噪点，保留原图构图、色彩、轮廓、人物样貌和场景原样，质感升级，高清放大，细节拉满，4K画质\n`
  
  // 构建最终提示词：艺术风格前缀 + 硬编码提示词 + 可选底部工具栏提示词
  const finalPrompt = `${stylePrefix}${hardcodedPrompt}${bodyPrompt}`

  try {
    const cells = await splitImageIntoGrids(previewDisplayUrl.value, gridSplitRows.value, gridSplitCols.value)
    const self = findNode(props.id)
    const w = self?.dimensions?.width ?? 360
    const gap = 48
    const edgeT = vueFlowEdgeTypeForSetting(userStore.edgeStyle)
    const st = canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)

    // 设置生成状态
    generating.value = true
    startImageGeneratingFeedback()

    for (let i = 0; i < selectedGridCells.value.length; i++) {
      const cellIndex = selectedGridCells.value[i]
      const newId = `grid-hd-${Date.now()}-${i}`

      // 创建待处理节点
      addNodes({
        id: newId,
        type: 'imageCanvas',
        position: {
          x: (self?.position.x ?? 0) + w + gap + (i * 380),
          y: self?.position.y ?? 0
        },
        data: {
          label: t('canvas.nodeUi.imageNode.defaultTitle'),
          type: 'image',
          status: 'running' as const,
          description: t('canvas.nodeUi.imageNode.cropDesc'),
          prompt: finalPrompt,
          referenceImages: [],
          uploadedMainImageUrl: null,
          generatedImageUrl: null,
          toolbarExpanded: false,
          imageQuality: q,
          aspectRatio: ar,
          imageModelGroup: props.data.imageModelGroup ?? apiStore.imageModelGroup,
          imageModel: modelId,
          storyboardGenerating: true,
          generationStartedAt: Date.now(),
          generationDurationMs: 90_000
        } satisfies ImageNodeData
      })
      addEdges({
        id: `e-${props.id}-grid-hd-${newId}`,
        source: props.id,
        target: newId,
        type: edgeT,
        animated: true,
        style: st
      })

      try {
        // 使用宫格图片作为参考图生成高清图
        const refs = [cells[cellIndex]]
        const url = await apiService.generateImage(finalPrompt, {
          model: modelId,
          referenceImages: refs,
          ...extra,
          modelGroup: ig
        })

        if (url) {
          const displayUrl = await persistGeneratedImageUrlWithNodeId(newId, url)
          updateNodeData(newId, {
            generatedImageUrl: displayUrl,
            status: 'completed',
            storyboardGenerating: false,
            generationStartedAt: null,
            generationDurationMs: undefined,
            generationError: undefined,
            prompt: finalPrompt,
            imageModel: modelId,
            imageQuality: q,
            aspectRatio: ar
          })
        } else {
          throw new Error(t('canvas.nodeUi.imageNode.noReturned'))
        }
      } catch (err) {
        // 单个宫格失败，更新该节点状态
        updateNodeData(newId, {
          status: 'error',
          storyboardGenerating: false,
          generationStartedAt: null,
          generationDurationMs: undefined,
          generationError: err instanceof Error ? err.message : t('canvas.nodeUi.imageNode.genFail')
        })
      }
    }

    ElMessage.success(t('canvas.nodeUi.imageNode.genOk'))
    exitGridSplitMode()
  } catch (err) {
    ElMessage.error(t('canvas.nodeUi.imageNode.genFail'))
  } finally {
    generating.value = false
    stopImageGeneratingFeedback()
  }
}

function onImageEditAction(action: string) {
  switch (action) {
    case 'crop':
      openImageTool('crop')
      break
    case 'annotate':
      openImageTool('annotate')
      break
    case 'split':
      openImageTool('split')
      break
    case 'edit':
      ElMessage.info('编辑功能开发中')
      break
    case 'download':
      void downloadImageToLocal()
      break
    case 'fullscreen':
      openFullscreenPreview()
      break
    case 'reupload':
      triggerMainFilePick()
      break
    case 'delete':
      triggerMainFilePick()
      break
    case 'preview3d':
      createVr360PanoNodeFromCurrent()
      break
    case 'rotate':
      openRotateNodeFromCurrent()
      break
    case 'viewpoint': {
      expandToolbar()
      if (!hasImage.value) {
        ElMessage.warning('请先上传或生成主图')
        return
      }
      viewpointPanelOpen.value = !viewpointPanelOpen.value
      // 打开面板时，如果没有选中的模型且有阿里云模型可用，选择第一个
      if (viewpointPanelOpen.value && imageModelsByGroup.value.aliyun.length > 0) {
        const firstModel = imageModelsByGroup.value.aliyun[0]
        viewpointSelectedModelId.value = firstModel.id
      }
      break
    }
    case 'referenceLines':
      showReferenceLines.value = !showReferenceLines.value
      break
    case 'hd':
    case 'matting':
    case 'lighting':
    case 'advancedSplit':
    case 'splitGrid':
      ElMessage.info('功能开发中')
      break
    default:
      break
  }
}

function triggerMainFilePick() {
  mainFileInputRef.value?.click()
}

function triggerRefFilePick() {
  refFileInputRef.value?.click()
}

/** 顶部按钮：仅填充主预览区，不参与参考图 */
async function onMainFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !file.type.startsWith('image/')) {
    input.value = ''
    return
  }
  try {
    const url = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(new Error('read'))
      r.readAsDataURL(file)
    })
    updateNodeData(props.id, {
      uploadedMainImageUrl: url,
      generatedImageUrl: null,
      status: 'pending',
      label: file.name
    })
  } catch {
    ElMessage.error('读取图片失败')
  }
  input.value = ''
}

/** 工具栏：仅追加参考图，供生成接口使用 */
async function onRefFilesChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files?.length) return
  const max = 6
  let base = [...referenceImages.value]
  const picked = Array.from(files).filter(f => f.type.startsWith('image/'))
  for (const f of picked) {
    if (base.length >= max) break
    const url = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(new Error('read'))
      r.readAsDataURL(f)
    })
    base.push(url)
  }
  updateNodeData(props.id, { referenceImages: base })
  input.value = ''
}

function removeRef(idx: number) {
  const next = referenceImages.value.filter((_, i) => i !== idx)
  updateNodeData(props.id, { referenceImages: next })
}

const generating = ref(false)
const {
  progressPercent: imageGeneratingProgressPercent,
  start: startImageGeneratingFeedback,
  stop: stopImageGeneratingFeedback
} = useSimulatedGenerationProgress({ durationMs: 90_000 })

function resolveImageNodeAssetCategory(): 'character' | 'scene' | 'prop' | null {
  const direct = props.data.assetCategory
  if (direct === 'character' || direct === 'scene' || direct === 'prop') return direct
  const sid = String(props.data.sourceAssetDetailNodeId ?? '').trim()
  if (!sid) return null
  const detail = findNode(sid)
  if (!detail || detail.type !== 'textAssetDetail') return null
  const cat = (detail.data as { assetCategory?: string }).assetCategory
  if (cat === 'character' || cat === 'scene' || cat === 'prop') return cat
  return null
}

function resolveCanvasWorkbenchCharacterAssetTemplate(): string {
  const idRaw = canvasWorkbenchCharacterTplRef?.value?.trim?.()
  const id =
    idRaw && idRaw.length > 0 ? idRaw : DEFAULT_CANVAS_CHAR_ASSET_PROMPT_ID
  const content = promptsStore.getPromptContentById(id)
  if (content && content.trim()) return content.trim()
  return promptsStore.getPromptContentById(DEFAULT_CANVAS_CHAR_ASSET_PROMPT_ID).trim()
}

function resolveCanvasWorkbenchSceneAssetTemplate(): string {
  const idRaw = canvasWorkbenchSceneTplRef?.value?.trim?.()
  const id =
    idRaw && idRaw.length > 0 ? idRaw : DEFAULT_CANVAS_SCENE_ASSET_PROMPT_ID
  const content = promptsStore.getPromptContentById(id)
  if (content && content.trim()) return content.trim()
  return promptsStore.getPromptContentById(DEFAULT_CANVAS_SCENE_ASSET_PROMPT_ID).trim()
}

function resolveCanvasWorkbenchPropsAssetTemplate(): string {
  const idRaw = canvasWorkbenchPropsTplRef?.value?.trim?.()
  const id =
    idRaw && idRaw.length > 0 ? idRaw : DEFAULT_CANVAS_PROPS_ASSET_PROMPT_ID
  const content = promptsStore.getPromptContentById(id)
  if (content && content.trim()) return content.trim()
  return promptsStore.getPromptContentById(DEFAULT_CANVAS_PROPS_ASSET_PROMPT_ID).trim()
}

function getCategoryAssetImageTemplate(category: 'character' | 'scene' | 'prop'): string {
  if (category === 'character') return resolveCanvasWorkbenchCharacterAssetTemplate()
  if (category === 'scene') return resolveCanvasWorkbenchSceneAssetTemplate()
  return resolveCanvasWorkbenchPropsAssetTemplate()
}

/** 资产类图片节点：在用户编辑的「资产名称/描述」前拼接提示词设置中的生成模板（与 Step1 一致） */
function buildImageGeneratePromptBody(userPrompt: string): string {
  const cat = resolveImageNodeAssetCategory()
  if (!cat) return userPrompt
  const template = getCategoryAssetImageTemplate(cat)
  if (!template) return userPrompt
  return `${template}\n\n${userPrompt}`
}

/** 与 VideoCanvasNode 一致：从连入本节点的上游解析可作为参考图的 URL */
async function extractImageUrlFromSourceNode(node: ReturnType<typeof findNode>): Promise<string | null> {
  if (!node?.data) return null
  const t = node.type
  const d = node.data as Record<string, unknown>
  if (t === 'imageCanvas') {
    const u = (d.generatedImageUrl ?? d.uploadedMainImageUrl) as string | undefined | null
    return u && String(u).trim() ? String(u) : null
  }
  if (t === 'freeDrawCanvas') {
    const u = d.referenceImageUrl as string | undefined | null
    if (u && String(u).trim()) return String(u)
    const requestFn = freeDrawReferenceImageRequestMap.get(node.id)
    if (!requestFn) return null
    const generated = await requestFn()
    return generated && String(generated).trim() ? String(generated) : null
  }
  if (t === 'storyboardGen') {
    const u = d.generatedImageUrl as string | undefined | null
    return u && String(u).trim() ? String(u) : null
  }
  if (t === 'imageSplitResult') {
    const cells = d.cells as string[] | undefined
    const first = Array.isArray(cells) ? cells.find((c) => c && String(c).trim()) : undefined
    return first ? String(first) : null
  }
  return null
}

const MAX_IMAGE_GENERATE_REFS = 12

async function collectIncomingReferenceImageUrls(): Promise<string[]> {
  const urls: string[] = []
  const seen = new Set<string>()
  for (const e of edges.value) {
    if (e.target !== props.id) continue
    const sourceNode = findNode(e.source)
    const u = await extractImageUrlFromSourceNode(sourceNode)
    if (!u || seen.has(u)) continue
    seen.add(u)
    urls.push(u)
  }
  return urls
}

/** 入边参考图优先 → 当前节点图片 → 节点内手动参考图；去重并限制张数 */
function mergeRefsForApi(incoming: string[], manual: string[]): string[] | undefined {
  const seen = new Set<string>()
  const out: string[] = []
  
  // 1. 先加入边参考图
  for (const u of incoming) {
    const s = String(u || '').trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(u)
    if (out.length >= MAX_IMAGE_GENERATE_REFS) break
  }
  
  // 2. 加入当前节点的图片（根据开关决定）
  const currentImage = previewDisplayUrl.value
  if (useCurrentAsReference.value && currentImage) {
    const s = String(currentImage).trim()
    if (s && !seen.has(s)) {
      seen.add(s)
      out.push(s)
      if (out.length >= MAX_IMAGE_GENERATE_REFS) return out
    }
  }
  
  // 3. 加入节点内手动参考图
  for (const u of manual) {
    const s = String(u || '').trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(u)
    if (out.length >= MAX_IMAGE_GENERATE_REFS) break
  }
  
  return out.length > 0 ? out : undefined
}

/** 先于 API 在右侧建立占位图节点（与分镜生成逻辑一致） */
function createPendingGeneratedOutputNode(prompt: string, modelId: string): string {
  const self = findNode(props.id)
  const w = self?.dimensions?.width ?? 360
  const gap = 48
  const newId = `image-gen-${Date.now()}`
  pushStateBeforeChange?.()
  addNodes({
    id: newId,
    type: 'imageCanvas',
    position: {
      x: (self?.position.x ?? 0) + w + gap,
      y: self?.position.y ?? 0
    },
    data: {
      label: t('canvas.nodeUi.imageNode.defaultTitle'),
      type: 'image',
      status: 'running' as const,
      description: t('canvas.nodeUi.imageNode.cropDesc'),
      prompt,
      referenceImages: [] as string[],
      uploadedMainImageUrl: null as string | null,
      generatedImageUrl: null as string | null,
      toolbarExpanded: false,
      imageQuality: (props.data.imageQuality ?? '1K') as ImageNodeData['imageQuality'],
      aspectRatio: props.data.aspectRatio ?? '16:9',
      imageModelGroup: props.data.imageModelGroup ?? apiStore.imageModelGroup,
      imageModel: modelId,
      storyboardGenerating: true,
      generationStartedAt: Date.now(),
      generationDurationMs: 90_000
    } satisfies ImageNodeData
  })
  addEdges({
    id: `e-${props.id}-gen-${newId}`,
    source: props.id,
    target: newId,
    type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
    animated: true,
    style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
  })
  return newId
}

/** 完成生成，更新输出节点 */
function finalizeGeneratedOutputNode(outputId: string, displayUrl: string, promptFinal: string, modelId: string) {
  updateNodeData(outputId, {
    generatedImageUrl: displayUrl,
    status: 'completed',
    storyboardGenerating: false,
    generationStartedAt: null,
    generationDurationMs: undefined,
    generationError: undefined,
    prompt: promptFinal,
    imageModel: modelId,
    imageQuality: (props.data.imageQuality ?? '1K') as ImageNodeData['imageQuality'],
    aspectRatio: props.data.aspectRatio ?? '16:9'
  })
}

/** 生成失败，更新输出节点状态 */
function failGeneratedOutputNode(outputId: string | null, message: string) {
  if (!outputId) return
  updateNodeData(outputId, {
    status: 'error',
    storyboardGenerating: false,
    generationStartedAt: null,
    generationDurationMs: undefined,
    generationError: message
  })
}

async function handleGenerate() {
  const ig = (props.data.imageModelGroup ?? apiStore.imageModelGroup) as ApiModelGroup
  if (!apiStore.isApiReadyForGroup(ig)) {
    ElMessage.warning(
      ig === 'flow2' ? t('settings.msg.enterApiUrlFirst') : t('canvas.nodeUi.imageNode.needApiKey')
    )
    return
  }

  let modelId = props.data.imageModel || apiStore.imageModel
  if (!modelId) {
    ElMessage.warning(t('canvas.nodeUi.imageNode.needModel'))
    return
  }
  
  if (ig === 'flow2') {
    modelId = apiStore.resolveFlow2ImageModelId(modelId, imageQuality.value)
  }

  const prompt = (props.data.prompt || '').trim()
  if (!prompt) {
    ElMessage.warning(t('canvas.nodeUi.imageNode.needPrompt'))
    return
  }

  // 检查是否是 gpt-image-2 模型且打开了参考图开关
  const isGptImage2Model = modelId === 'gpt-image-2' || modelId === 'z-image-turbo'
  const incomingRefs = await collectIncomingReferenceImageUrls()
  const hasReferenceConfig = useCurrentAsReference.value || (referenceImages.value.length > 0) || (incomingRefs.length > 0)
  
  if (isGptImage2Model && hasReferenceConfig && hasImage.value) {
    showModelRefNotSupported.value = true
    setTimeout(() => {
      showModelRefNotSupported.value = false
    }, 3000)
    ElMessage.warning('当前模型不支持上传参考图，请更换其他模型再进行生图')
    return
  }

  const q = imageQuality.value
  const ar = aspectRatio.value
  const extra = buildImageModelGenerateOptions(modelId, q, ar)

  const refs = mergeRefsForApi(incomingRefs, referenceImages.value)
  const stylePrefix = buildArtStylePromptPrefix(artStyleStore.artStyles, artStyleStore.selectedStyle)
  const bodyPrompt = buildImageGeneratePromptBody(prompt)
  const finalPrompt = `${stylePrefix}${bodyPrompt}`

  let pendingOutputId: string | null = null
  let originalNodeWasUpdated = false

  try {
    if (hasImage.value) {
      // 已有图片：在右侧创建新节点，原节点不显示动画
      pendingOutputId = createPendingGeneratedOutputNode(finalPrompt, modelId)
    } else {
      // 无图片：在当前节点显示动画
      generating.value = true
      startImageGeneratingFeedback()
      updateNodeData(props.id, { status: 'running' })
      originalNodeWasUpdated = true
    }

    const url = await apiService.generateImage(finalPrompt, {
      model: modelId,
      referenceImages: refs,
      ...extra,
      modelGroup: ig
    })

    if (url) {
      if (hasImage.value) {
        // 已有图片：完成新节点
        const displayUrl = await persistGeneratedImageUrlWithNodeId(pendingOutputId!, url)
        finalizeGeneratedOutputNode(pendingOutputId!, displayUrl, finalPrompt, modelId)
        ElMessage.success(t('canvas.nodeUi.imageNode.genOk'))
      } else {
        // 无图片：完成当前节点
        const displayUrl = await persistGeneratedImageUrl(url)
        updateNodeData(props.id, {
          generatedImageUrl: displayUrl,
          uploadedMainImageUrl: null,
          status: 'completed',
          label: t('canvas.nodeUi.imageNode.defaultTitle')
        })
        ElMessage.success(t('canvas.nodeUi.imageNode.genOk'))
      }
    } else {
      throw new Error(t('canvas.nodeUi.imageNode.noReturned'))
    }
  } catch (err) {
    if (hasImage.value) {
      failGeneratedOutputNode(pendingOutputId, err instanceof Error ? err.message : t('canvas.nodeUi.imageNode.genFail'))
    } else {
      updateNodeData(props.id, { status: 'error' })
    }
    ElMessage.error(err instanceof Error ? err.message : t('canvas.nodeUi.imageNode.genFail'))
  } finally {
    if (!hasImage.value) {
      generating.value = false
      stopImageGeneratingFeedback()
    }
  }
}

function buildViewpointPrompt() {
  const yaw = vpCamYaw.value
  const pitch = vpCamPitch.value
  const d = vpCamDistance.value
  
  // 水平角度转换为专业术语
  let horizontalTerm = ''
  if (yaw >= 350 || yaw < 10) {
    horizontalTerm = 'front view'
  } else if (yaw >= 10 && yaw < 80) {
    horizontalTerm = 'front-left quarter view'
  } else if (yaw >= 80 && yaw < 100) {
    horizontalTerm = 'left side view'
  } else if (yaw >= 100 && yaw < 170) {
    horizontalTerm = 'back-left quarter view'
  } else if (yaw >= 170 && yaw < 190) {
    horizontalTerm = 'back view'
  } else if (yaw >= 190 && yaw < 260) {
    horizontalTerm = 'back-right quarter view'
  } else if (yaw >= 260 && yaw < 280) {
    horizontalTerm = 'right side view'
  } else {
    horizontalTerm = 'front-right quarter view'
  }
  
  // 垂直角度转换为专业术语
  let verticalTerm = ''
  if (pitch <= -60) {
    verticalTerm = 'bird\'s-eye view'
  } else if (pitch > -60 && pitch <= -20) {
    verticalTerm = 'high-angle shot'
  } else if (pitch > -20 && pitch < 20) {
    verticalTerm = 'eye-level shot'
  } else if (pitch >= 20 && pitch < 60) {
    verticalTerm = 'low-angle shot'
  } else {
    verticalTerm = 'worm\'s-eye view'
  }
  
  // 距离转换为专业术语
  let distanceTerm = ''
  if (d <= 0.6) {
    distanceTerm = 'close-up'
  } else if (d > 0.6 && d <= 1.2) {
    distanceTerm = 'medium shot'
  } else if (d > 1.2 && d <= 1.6) {
    distanceTerm = 'wide shot'
  } else {
    distanceTerm = 'extreme wide shot'
  }
  
  return [
    'Please redraw the input image with a different camera angle and composition, keeping the main subject, content details, overall style, lighting, and color relationships consistent. Only change the shooting angle and lens relationship.',
    `Camera position: ${horizontalTerm}, ${verticalTerm}, ${distanceTerm}.`,
    'Output a single image, complete frame, no black borders.'
  ].join(' ')
}

async function applyViewpointEdit() {
  const ig = 'aliyun' as ApiModelGroup
  if (!apiStore.isApiReadyForGroup(ig)) {
    ElMessage.warning('请先在设置中配置阿里云 API 密钥')
    return
  }
  const src = previewDisplayUrl.value
  if (!src) {
    ElMessage.warning('没有可用的主图')
    return
  }

  viewpointGenerating.value = true
  const prompt = buildViewpointPrompt()
  try {
    const url = await apiService.generateQwenImageEdit2509(prompt, src, ig, viewpointSelectedModelId.value)
    if (url) {
      await createViewpointOutputNode(url)
    }
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '视角调整失败')
  } finally {
    viewpointGenerating.value = false
  }
}

function selectViewpointModel(modelId: string) {
  viewpointSelectedModelId.value = modelId
}

function closeViewpointPanel() {
  viewpointPanelOpen.value = false
}
</script>

<template>
  <div
    class="image-canvas-node-root"
    :class="`status-${data.status || 'pending'}`"
  >
    <!-- Handle 须在此层：卡片 overflow:hidden 会裁掉半个圆点 -->
    <Handle type="target" :position="Position.Left" class="handle handle-target" />
    <!-- 仅卡片参与布局，节点在画布上的位置不因上下浮动层改变 -->
    <div
      class="image-canvas-node"
      :class="[
        `node-${data.type || 'image'}`,
        { 'is-selected': selected }
      ]"
    >
      <div class="node-header">
        <el-icon class="node-type-icon" :class="imageHeaderIconClass">
          <component :is="imageHeaderIcon" />
        </el-icon>
        <span v-if="storyboardImageHeaderParts" class="node-label node-label-storyboard">
          <span class="node-label-seq">{{ storyboardImageHeaderParts.seq }}</span>
          <span class="node-label-title-text">{{ storyboardImageHeaderParts.rest }}</span>
        </span>
        <span v-else class="node-label">{{ plainImageNodeTitle }}</span>
      </div>
      <div class="node-status" :style="{ backgroundColor: statusColor }" />

      <div
        v-if="lodIsShell"
        class="canvas-node-lod-shell nodrag nopan"
      >
        <el-icon class="canvas-node-lod-shell-icon"><Picture /></el-icon>
        <div class="canvas-node-lod-shell-lines">
          <span class="canvas-node-lod-shell-title">{{ imageLodShellTitle }}</span>
          <span class="canvas-node-lod-shell-sub">{{ hasImage ? t('canvas.nodeUi.imageNode.lodHasImg') : t('canvas.nodeUi.imageNode.lodShell') }}</span>
        </div>
      </div>

      <template v-else>
      <div class="img-preview-wrap nodrag nopan" @mousedown.stop>
        <div class="img-preview" @click.stop="onPreviewClick">
          <div v-if="hasImage" class="preview-hover-actions" @click.stop>
            <button
              type="button"
              class="preview-corner-btn"
              title="下载"
              @click.stop="onImageEditAction('download')"
            >
              <el-icon><Download /></el-icon>
            </button>
            <button
              type="button"
              class="preview-corner-btn"
              title="全屏查看"
              @click.stop="onImageEditAction('fullscreen')"
            >
              <el-icon><FullScreen /></el-icon>
            </button>
            <button
              type="button"
              class="preview-corner-btn"
              title="重新上传"
              @click.stop="onImageEditAction('reupload')"
            >
              <el-icon><Upload /></el-icon>
            </button>
          </div>
          <img
            v-if="hasImage"
            :src="previewDisplayUrl!"
            alt="预览"
            class="preview-img"
            loading="lazy"
            decoding="async"
          >
          <div v-if="hasImage && showReferenceLines" class="reference-lines-overlay">
            <div class="ref-line ref-line-h" style="top: 33.333%;" />
            <div class="ref-line ref-line-h" style="top: 66.666%;" />
            <div class="ref-line ref-line-v" style="left: 33.333%;" />
            <div class="ref-line ref-line-v" style="left: 66.666%;" />
          </div>
          <div v-if="hasImage && gridSplitMode" class="grid-split-overlay">
            <div class="grid-lines">
              <div
                v-for="r in gridSplitRows"
                :key="`h-${r}`"
                class="grid-line grid-line-h"
                :style="{ top: `${(100 / gridSplitRows) * r}%` }"
              />
              <div
                v-for="c in gridSplitCols"
                :key="`v-${c}`"
                class="grid-line grid-line-v"
                :style="{ left: `${(100 / gridSplitCols) * c}%` }"
              />
            </div>
            <div class="grid-cells">
              <div
                v-for="(cell, index) in gridSplitRows * gridSplitCols"
                :key="index"
                class="grid-cell"
                :class="{ 'is-selected': selectedGridCells.includes(index) }"
                :style="{
                  left: `${(index % gridSplitCols) * (100 / gridSplitCols)}%`,
                  top: `${Math.floor(index / gridSplitCols) * (100 / gridSplitRows)}%`,
                  width: `${100 / gridSplitCols}%`,
                  height: `${100 / gridSplitRows}%`
                }"
                @click.stop="toggleGridCell(index)"
              >
                <span class="grid-cell-label">{{ index + 1 }}</span>
              </div>
            </div>
          </div>
          <template v-if="!hasImage">
            <div v-if="isStoryboardSweep" class="preview-storyboard-sweep-wrap">
              <div
                class="storyboard-gen-sweep-layer"
                aria-hidden="true"
              >
                <div class="storyboard-gen-sweep-dim" />
                <div
                  class="storyboard-gen-sweep-gradient"
                  :style="{ width: `${storyboardSweepProgress * 100}%`, transition: 'width 0.1s linear' }"
                />
              </div>
              <div class="preview-storyboard-sweep-center">
                <el-icon class="preview-sweep-icon-lg"><Picture /></el-icon>
                <span class="preview-sweep-meta">{{ t('canvas.nodeUi.imageNode.storyboardSweepMeta', { p: storyboardSweepPercentDisplay }) }}</span>
              </div>
            </div>
            <div v-else-if="storyboardGenFailed" class="preview-empty preview-gen-fail">
              <span class="preview-gen-fail-text">{{ storyboardGenFailMessage }}</span>
            </div>
            <div v-else class="preview-empty">
              {{ t('canvas.nodeUi.imageNode.clickExpandToolbar') }}
            </div>
          </template>
          <transition name="fade-overlay">
            <CanvasGeneratingOverlay
              v-if="generating && !isStoryboardSweep"
              :title="t('canvas.nodeUi.imageNode.genOverlayTitle')"
              :description="t('canvas.nodeUi.imageNode.genOverlayDesc')"
              :percent="imageGeneratingProgressPercent"
              :meta-line="t('canvas.nodeUi.imageNode.genOverlayMeta', { p: imageGeneratingProgressPercent })"
            />
          </transition>
          <transition name="fade-overlay">
            <div v-if="showModelRefNotSupported" class="model-ref-not-supported-overlay">
              <div class="model-ref-not-supported-content">
                <el-icon class="model-ref-not-supported-icon"><WarningFilled /></el-icon>
                <span class="model-ref-not-supported-text">当前模型不支持上传参考图</span>
                <span class="model-ref-not-supported-text">请更换其他模型再进行生图</span>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <input
        ref="mainFileInputRef"
        type="file"
        class="hidden-input"
        accept="image/*"
        @change="onMainFileChange"
      >

      <div class="node-inline-actions nodrag nopan">
        <div class="toolbar-actions-main nodrag nopan">
          <el-popover
            v-model:visible="modelPopoverVisible"
            placement="top-start"
            :width="360"
            trigger="click"
            popper-class="image-node-model-popover"
            @show="onModelPopoverShow"
          >
            <template #reference>
              <button type="button" class="model-chip nodrag nopan">
                <span class="model-chip-name">{{ currentModelMeta.modelName }}</span>
                <span class="model-chip-group">{{ currentModelMeta.groupLabel }}</span>
              </button>
            </template>
            <div class="model-panel">
              <div class="model-panel-label">{{ t('canvas.nodeUi.common.supplier') }}</div>
              <div class="provider-group">
                <button
                  v-for="group in mergedModelOptions"
                  :key="group.value"
                  type="button"
                  class="provider-btn"
                  :class="{ active: activePanelGroup === group.value }"
                  @click="selectModelGroup(group.value)"
                >
                  {{ group.label }}
                </button>
              </div>
              <div class="model-panel-label">{{ t('canvas.nodeUi.common.model') }}</div>
              <div class="model-group">
                <button
                  v-for="model in panelGroupModelsWithBadge"
                  :key="model.id"
                  type="button"
                  class="model-btn"
                  :class="{ active: (props.data.imageModel || apiStore.imageModel) === model.id }"
                  @click="selectModel(model.id)"
                >
                  <span class="model-btn-icon" :class="`platform-${model.badge.key}`">
                    <svg v-if="model.badge.key === 'kling'" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                      <path d="M5.4 13.8A23.2 23.2 0 017.4 9.3c3.2-5.5 7.8-8.8 10.3-7.3C12-1.3 4.6 1 1.1 7a13.4 13.4 0 00-1 2.2c-.3.8.1 1.6.8 2l4.6 2.6z" fill="#04A6F0"/>
                      <path d="M18.6 10.2a23.2 23.2 0 01-2 4.5c-3.2 5.5-7.8 8.8-10.3 7.3 5.7 3.3 13.1 1.1 16.6-4.9a13.4 13.4 0 001-2.3c.3-.8-.1-1.6-.8-2l-4.5-2.6z" fill="#0DF35E"/>
                      <path d="M16.6 14.6c3.2-5.5 3.7-11.1 1.2-12.6C15.2.6 10.6 3.8 7.4 9.3c2-3.6 5.8-5.3 8.3-3.8 2.6 1.5 2.9 5.6.9 9.1z" fill="#003EFF"/>
                      <path d="M7.4 9.3c-3.2 5.5-3.7 11.1-1.2 12.6 2.6 1.5 7.2-1.8 10.4-7.3-2.1 3.6-5.9 5.3-8.4 3.9-2.5-1.4-2.9-5.6-.8-9.2z" fill="#0BFFE7"/>
                    </svg>
                    <svg v-else-if="model.badge.key === 'jimeng'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;">
                      <path d="M5.31 15.756c.172-3.75 1.883-5.999 2.549-6.739-3.26 2.058-5.425 5.658-6.358 8.308v1.12C1.501 21.513 4.226 24 7.59 24a6.59 6.59 0 002.2-.375c.353-.12.7-.248 1.039-.378.913-.899 1.65-1.91 2.243-2.992-4.877 2.431-7.974.072-7.763-4.5l.002.001z" fill="#1E37FC"/>
                      <path d="M22.57 10.283c-1.212-.901-4.109-2.404-7.397-2.8.295 3.792.093 8.766-2.1 12.773a12.782 12.782 0 01-2.244 2.992c3.764-1.448 6.746-3.457 8.596-5.219 2.82-2.683 3.353-5.178 3.361-6.66a2.737 2.737 0 00-.216-1.084v-.002z" fill="#37E1BE"/>
                      <path d="M14.303 1.867C12.955.7 11.248 0 9.39 0 7.532 0 5.883.677 4.545 1.807 2.791 3.29 1.627 5.557 1.5 8.125v9.201c.932-2.65 3.097-6.25 6.357-8.307.5-.318 1.025-.595 1.569-.829 1.883-.801 3.878-.932 5.746-.706-.222-2.83-.718-5.002-.87-5.617h.001z" fill="#A569FF"/>
                      <path d="M17.305 4.961a199.47 199.47 0 01-1.08-1.094c-.202-.213-.398-.419-.586-.622l-1.333-1.378c.151.615.648 2.786.869 5.617 3.288.395 6.185 1.898 7.396 2.8-1.306-1.275-3.475-3.487-5.266-5.323z" fill="#1E37FC"/>
                    </svg>
                    <svg v-else-if="model.badge.key === 'gpt'" fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                      <title>OpenAI</title>
                      <path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.71.71 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h-.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h-.001zm-11.741 3.81l-1.877-1.069a.065.065 0 01-.036-.051V6.559c.003-2.274 1.87-4.12 4.174-4.123.976 0 1.92.338 2.671.954-.034.018-.093.05-.132.074l-4.44 2.53a.71.71 0 00-.364.623v6.176l1.877-1.069c.02-.01.033-.029.036-.05zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"/>
                    </svg>
                    
                    <svg v-else-if="model.badge.key === 'banana'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;" aria-hidden="true">
                      <path d="M1.5 19.824c0-.548.444-.992.991-.992h.744a.991.991 0 010 1.983H2.49a.991.991 0 01-.991-.991z" fill="#F3AD61"/>
                      <path d="M14.837 13.5h7.076c.522 0 .784-.657.413-1.044l-1.634-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044zM3.587 13.5h7.076c.521 0 .784-.659.414-1.044l-1.635-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044z" fill="#F9C23C"/>
                      <path d="M12.525 1.521c3.69-.53 5.97 8.923 4.309 12.744-1.662 3.82-5.248 4.657-9.053 6.152a3.49 3.49 0 01-1.279.244c-1.443 0-2.227 1.187-2.774-.282-.707-1.9.22-4.031 2.069-4.757 2.014-.79 3.084-2.308 3.89-4.364.82-2.096.877-2.956.873-5.241-.003-1.827-.123-4.195 1.965-4.496z" fill="#FEEFC2"/>
                      <path d="M16.834 14.264l-7.095-3.257c-.815 1.873-2.29 3.308-4.156 4.043-2.16.848-3.605 3.171-2.422 5.54 2.364 4.727 13.673-.05 13.673-6.325z" fill="#FCD53F"/>
                      <path d="M13.68 12.362c.296.094.46.41.365.707-1.486 4.65-5.818 6.798-9.689 6.997a.562.562 0 11-.057-1.124c3.553-.182 7.372-2.138 8.674-6.216a.562.562 0 01.707-.364z" fill="#F9C23C"/>
                      <path d="M17.43 19.85l-7.648-8.835h6.753c1.595.08 2.846 1.433 2.846 3.073v5.664c0 .997-.898 1.302-1.95.098z" fill="#FFF478"/>
                    </svg>
                    <svg v-else-if="model.badge.key === 'gemini'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;">
                      <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF"/>
                    </svg>
                    <template v-else>{{ model.badge.short }}</template>
                  </span>
                  <span class="model-btn-text">{{ model.name }}</span>
                </button>
              </div>
              <div v-if="panelGroupModelsWithBadge.length === 0" class="model-empty">
                {{ t('canvas.nodeUi.common.noModelsInGroup') }}
              </div>
            </div>
          </el-popover>

          <el-popover
            v-model:visible="qualityPopoverVisible"
            placement="top-start"
            :width="280"
            trigger="click"
            popper-class="image-node-quality-popover"
          >
            <template #reference>
              <button type="button" class="qa-trigger nodrag nopan">
                <el-icon class="qa-trigger-icon"><Operation /></el-icon>
                <span>{{ qualityAspectSummary }}</span>
              </button>
            </template>
            <div class="qa-panel">
              <div class="qa-label">
                {{ t('canvas.nodeUi.imageNode.quality') }}
              </div>
              <div class="qa-segment">
                <button
                  v-for="q in (['1K', '2K', '4K'] as const)"
                  :key="q"
                  type="button"
                  class="seg-btn"
                  :class="{ active: imageQuality === q }"
                  @click="imageQuality = q"
                >
                  {{ q }}
                </button>
              </div>
              <div class="qa-label">
                {{ t('canvas.nodeUi.imageNode.aspect') }}
              </div>
              <div class="qa-ratios">
                <button
                  v-for="r in ratioOptions"
                  :key="r.id"
                  type="button"
                  class="ratio-btn"
                  :class="[`ar-${r.id.replace(':', '-')}`, { active: aspectRatio === r.id }]"
                  @click="aspectRatio = r.id"
                >
                  <span class="ratio-shape" />
                  <span class="ratio-text">{{ r.label }}</span>
                </button>
              </div>
            </div>
          </el-popover>
        </div>

        <div class="generate-row nodrag nopan">
          <div v-if="hasImage" class="generate-left-controls">
            <div class="image-action-switch nodrag nopan">
              <span class="switch-text">参考图</span>
              <el-switch
                v-model="useCurrentAsReference"
                class="nodrag nopan"
              />
              <el-popover
                placement="top"
                width="280"
                trigger="click"
                popper-class="reference-help-popover"
              >
                <div class="reference-help-content">
                  <div class="reference-help-title">参考图功能说明</div>
                  <div class="reference-help-text">开启后，AI生图会将当前图片作为参考图使用，通过增加文字描述达到修改图片内容的效果。</div>
                </div>
                <template #reference>
                  <span class="reference-help-icon" @click.stop>
                    <el-icon><QuestionFilled /></el-icon>
                  </span>
                </template>
              </el-popover>
            </div>
          </div>
          <div v-else class="generate-left-controls-placeholder"></div>

          <button
            type="button"
            class="btn-generate btn-generate-full nodrag nopan"
            :disabled="generating"
            @click="handleGenerate"
          >
            <el-icon class="btn-generate-icon" :class="{ 'is-spinning': generating }"><Promotion /></el-icon>
            <span v-if="generating" class="gen-loading">{{ t('canvas.nodeUi.imageNode.genImageRunning') }}</span>
            <span v-else>{{ t('canvas.nodeUi.imageNode.genImage') }}</span>
          </button>
        </div>
      </div>
      </template>
    </div>
    <Handle type="source" :position="Position.Right" class="handle handle-source" />

    <Transition name="img-node-top">
      <div
        v-if="toolbarExpanded && hasImage && !lodIsShell && !gridSplitMode && !rotatePanelOpen"
        key="actions-strip-above"
        class="node-float-top node-image-actions-above nodrag nopan"
        @mousedown.stop
      >
        <div class="image-actions-pill">
          <button type="button" class="image-action-btn" @click="onImageEditAction('crop')">
            <el-icon><Scissor /></el-icon>
            <span>{{ t('canvas.nodeUi.imageNode.crop') }}</span>
          </button>
          <button type="button" class="image-action-btn" @click="onImageEditAction('annotate')">
            <el-icon><Pointer /></el-icon>
            <span>{{ t('canvas.nodeUi.imageNode.annotate') }}</span>
          </button>
          <button type="button" class="image-action-btn" @click="onImageEditAction('split')">
            <el-icon><GridIcon /></el-icon>
            <span>{{ t('canvas.nodeUi.imageNode.split') }}</span>
          </button>
          <el-popover
            v-model:visible="gridSplitPopoverVisible"
            placement="bottom"
            width="200"
            trigger="hover"
            popper-class="grid-split-popover"
          >
            <div class="grid-split-menu">
              <button
                v-for="option in gridOptions"
                :key="option.labelKey"
                type="button"
                class="grid-menu-item"
                @click.stop="enterGridSplitMode(option.rows, option.cols)"
              >
                {{ t(`canvas.nodeUi.imageNode.${option.labelKey}`) }}
              </button>
            </div>
            <template #reference>
              <button type="button" class="image-action-btn">
                <el-icon><GridIcon /></el-icon>
                <span>{{ t('canvas.nodeUi.imageNode.gridSplit') }}</span>
              </button>
            </template>
          </el-popover>
          <button
            v-if="VIEWPOINT_UI_ENABLED"
            type="button"
            class="image-action-btn"
            :class="{ 'is-active': viewpointPanelOpen }"
            @click="onImageEditAction('viewpoint')"
          >
            <el-icon><Coordinate /></el-icon>
            <span>{{ t('canvas.nodeUi.imageNode.viewpoint') }}</span>
          </button>
          <button type="button" class="image-action-btn" @click="onImageEditAction('preview3d')">
            <el-icon><Box /></el-icon>
            <span>{{ t('canvas.nodeUi.imageNode.preview3d') }}</span>
          </button>
          <button type="button" class="image-action-btn" @click="onImageEditAction('rotate')">
            <el-icon><SwitchButton /></el-icon>
            <span>旋转</span>
          </button>
        </div>
      </div>
    </Transition>

    <Transition name="img-node-top">
      <div v-if="gridSplitMode && hasImage" class="node-float-top node-grid-split-actions nodrag nopan" @mousedown.stop>
        <div class="image-actions-pill">
          <button type="button" class="image-action-btn" @click="exitGridSplitMode">
            <el-icon><Close /></el-icon>
          </button>
          <button type="button" class="image-action-btn" disabled>
            <el-icon><SwitchButton /></el-icon>
            <span>{{ gridSplitLabel }}</span>
          </button>
          <button type="button" class="image-action-btn" disabled>
            <el-icon><GridIcon /></el-icon>
            <span>{{ t('canvas.nodeUi.imageNode.selectedGrids', { count: gridSelectionCount }) }}</span>
          </button>
          <button type="button" class="image-action-btn primary" @click="createGridImageNodes" :disabled="gridSelectionCount === 0">
            <el-icon><Link /></el-icon>
            <span>{{ t('canvas.nodeUi.imageNode.createImageNodes') }}</span>
          </button>
          <button type="button" class="image-action-btn primary" @click="generateHighResImage" :disabled="gridSelectionCount === 0 || generating">
            <el-icon :class="{ 'is-spinning': generating }"><MagicStick /></el-icon>
            <span>生成高清图片</span>
          </button>
        </div>
      </div>
    </Transition>

    <Transition name="img-node-top">
      <div
        v-if="toolbarExpanded && !hasImage && !lodIsShell && !rotatePanelOpen"
        key="upload-strip-above"
        class="node-float-top node-upload-above nodrag nopan"
        @mousedown.stop
      >
        <div class="image-actions-pill">
          <button type="button" class="image-action-btn nodrag nopan" @click.stop="triggerMainFilePick">
            <el-icon><Upload /></el-icon>
            <span>上传图片</span>
          </button>
        </div>
      </div>
    </Transition>

    <Transition name="img-node-top">
      <div v-if="rotatePanelOpen && !lodIsShell" class="node-float-top node-rotate-above nodrag nopan" @mousedown.stop>
        <div class="rotate-panel image-actions-pill">
          <button type="button" class="rotate-toolbar-close" @click="closeRotatePanel" title="关闭">×</button>
          <label class="rotate-angle-field">
            <span>度数</span>
            <input v-model.number="rotateAngle" type="number" min="0" max="359" step="90" class="rotate-angle-input" @input="handleAngleInput" />
            <span>°</span>
          </label>
          <button type="button" class="image-action-btn rotate-action-btn" @click="handleRotateRight90" :disabled="rotateSaving">
            <el-icon><SwitchButton /></el-icon>
            <span>右转90°</span>
          </button>
          <button type="button" class="image-action-btn rotate-action-btn" @click="toggleRotateMirrorX" :class="{ 'is-active': rotateMirrorX }" :disabled="rotateSaving">
            <el-icon><Link /></el-icon>
            <span>左右镜像</span>
          </button>
          <button type="button" class="image-action-btn rotate-action-btn" @click="toggleRotateMirrorY" :class="{ 'is-active': rotateMirrorY }" :disabled="rotateSaving">
            <el-icon><Link /></el-icon>
            <span>上下镜像</span>
          </button>
          <button type="button" class="vp-btn vp-btn-primary" :disabled="rotateSaving" @click="saveRotateOutput">
            <span v-if="rotateSaving">保存中…</span>
            <span v-else>保存</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- 从节点下方滑入（不占文档流） -->
    <Transition name="img-node-bottom">
      <div
        v-if="toolbarExpanded && !lodIsShell"
        key="editor-toolbar"
        class="node-float-bottom img-toolbar img-toolbar-external nodrag nopan"
        :class="{ 'is-viewpoint-open': isViewpointPanelUiVisible }"
        @mousedown.stop
      >
      <div
        v-if="isViewpointPanelUiVisible"
        class="viewpoint-panel nodrag nopan"
        @click.stop
      >
        <div class="viewpoint-head">
          <span class="viewpoint-title">视角调整</span>
          <div class="viewpoint-model-inline">
            <span class="viewpoint-model-inline-label">阿里云直连</span>
            <span class="viewpoint-model-inline-name">{{ viewpointSelectedModelName }}</span>
          </div>
          <div class="viewpoint-head-actions">
            <button
              type="button"
              class="viewpoint-cam-toggle"
              :class="{ active: viewpointCameraView }"
              :title="viewpointCameraView ? '退出相机视角' : '进入相机视角'"
              @click="viewpointCameraView = !viewpointCameraView"
            >
              <el-icon><VideoCamera /></el-icon>
              <span>{{ viewpointCameraView ? '退出相机视角' : '相机视角' }}</span>
            </button>
          </div>
        </div>

        <div class="viewpoint-body">
          <div class="viewpoint-cam-block">
            <ViewpointCamera3D
              v-model:horizontal="vpCamYaw"
              v-model:vertical="vpCamPitch"
              v-model:zoom="vpCamDistance"
              :image-url="previewDisplayUrl"
              :camera-view="viewpointCameraView"
            />
          </div>

          <!-- 预设角度快速选择 -->
          <div class="viewpoint-presets">
            <div class="preset-section">
              <span class="preset-label">水平角度</span>
              <div class="preset-buttons">
                <button
                  v-for="preset in horizontalPresets"
                  :key="preset.value"
                  type="button"
                  class="preset-btn"
                  :class="{ active: isHorizontalPresetActive(preset.value) }"
                  @click="applyHorizontalPreset(preset.value)"
                >
                  {{ preset.label }}
                </button>
              </div>
            </div>
            <div class="preset-section">
              <span class="preset-label">垂直角度</span>
              <div class="preset-buttons">
                <button
                  v-for="preset in verticalPresets"
                  :key="preset.value"
                  type="button"
                  class="preset-btn"
                  :class="{ active: isVerticalPresetActive(preset.value) }"
                  @click="applyVerticalPreset(preset.value)"
                >
                  {{ preset.label }}
                </button>
              </div>
           </div>
            <div class="preset-section preset-section--distance">
              <span class="preset-label">相机距离</span>
              <div class="preset-buttons">
                <button
                  v-for="preset in distancePresets"
                  :key="preset.value"
                  type="button"
                  class="preset-btn"
                  :class="{ active: isDistancePresetActive(preset.value) }"
                  @click="applyDistancePreset(preset.value)"
                >
                  {{ preset.label }}
                </button>
              </div>
              <button
                type="button"
                class="vp-btn vp-btn-primary vp-btn-apply-viewpoint"
                :disabled="viewpointGenerating"
                @click="applyViewpointEdit"
              >
                <span v-if="viewpointGenerating">处理中…</span>
                <span v-else>应用视角</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <template v-if="!isViewpointPanelUiVisible">
      <input
        ref="refFileInputRef"
        type="file"
        class="hidden-input"
        accept="image/*"
        multiple
        @change="onRefFilesChange"
      >
      <div
        class="prompt-toolbar-group"
        role="group"
        :aria-label="t('canvas.nodeUi.common.promptToolbarAria')"
      >
      <div class="toolbar-row toolbar-refs">
        <button
          type="button"
          class="ref-add nodrag nopan"
          :title="t('canvas.nodeUi.imageNode.addRefAria')"
          @click="triggerRefFilePick"
        >
          <el-icon><Plus /></el-icon>
        </button>
        <div
          v-for="(url, idx) in referenceImages"
          :key="idx"
          class="ref-thumb"
        >
          <img :src="url" alt="">
          <button
            type="button"
            class="ref-remove nodrag nopan"
            @click="removeRef(idx)"
          >
            ×
          </button>
        </div>
      </div>

      <div class="toolbar-row toolbar-prompt">
        <textarea
          v-model="promptModel"
          class="prompt-input nodrag nopan"
          :placeholder="toolbarPromptPlaceholder"
          rows="6"
          @wheel.stop
        />
      </div>
      </div>

      </template>
      </div>
    </Transition>

    <ImageNodeImageToolsDialog
      v-model="imageToolDialogVisible"
      :mode="imageToolDialogMode"
      :image-url="previewDisplayUrl ?? ''"
      @apply="onToolDialogApply"
    />

    <!-- 节点缩放手柄 -->
    <div
      v-if="selected"
      class="node-resize-handle nodrag nopan"
      @mousedown.stop.prevent="handleResizeStart('se', $event)"
    >
      <div class="resize-handle-icon"></div>
    </div>
  </div>
</template>

<style scoped>
.canvas-node-lod-shell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: var(--image-main-area-height);
  margin: 0 12px 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  background: rgba(10, 12, 22, 0.45);
  box-sizing: border-box;
}

.canvas-node-lod-shell-icon {
  font-size: 22px;
  color: rgba(180, 200, 255, 0.85);
  flex-shrink: 0;
}

.canvas-node-lod-shell-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.canvas-node-lod-shell-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(240, 244, 255, 0.95);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.canvas-node-lod-shell-sub {
  font-size: 11px;
  color: rgba(180, 192, 220, 0.75);
  line-height: 1.35;
}

.image-canvas-node-root {
  --image-node-card-width: 420px;
  --image-main-area-height: 220px;
  --image-bottom-actions-height: 44px;
  --canvas-toolbar-prompt-min-height: 130px;
  --canvas-toolbar-prompt-bg: rgba(8, 12, 20, 0.62);
  --canvas-toolbar-prompt-border: rgba(255, 255, 255, 0.12);
  --canvas-toolbar-prompt-color: rgba(241, 245, 252, 0.94);
  --canvas-toolbar-prompt-placeholder: rgba(167, 176, 196, 0.55);
  --canvas-toolbar-prompt-font-size: 11px;
  --canvas-toolbar-prompt-line-height: 1.5;
  --canvas-toolbar-prompt-padding: 8px 10px;
  --canvas-toolbar-prompt-font-family: "Noto Sans SC", "Noto Sans CJK SC", "Noto Sans CJK JP", "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, "Segoe UI", sans-serif;
  /* 底部工具栏固定宽：原 1.5× 卡片宽约 570px，缩小一倍 */
  --image-toolbar-width: 420px;
  /* 模型选择：约为工具栏宽度一半，固定不占满行 */
  --image-model-select-width: 180px;
  position: relative;
  width: var(--image-node-card-width);
  min-width: 360px;
  max-width: 800px;
  overflow: visible;
  cursor: grab;
  box-sizing: border-box;
}

/* 浮动在卡片上方，不占布局；与卡片间距 10px */
.node-float-top {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 10px);
  z-index: 5;
  display: flex;
  justify-content: center;
  max-width: calc(100vw - 32px);
  pointer-events: auto;
  transform: translateX(-50%);
  transform-origin: center bottom;
}

/* 浮动在卡片下方，不占布局；与卡片间距 12px */
.node-float-bottom {
  position: absolute;
  left: 50%;
  top: calc(100% + 12px);
  z-index: 5;
  pointer-events: auto;
  transform: translateX(-50%);
  transform-origin: center top;
}

.node-upload-above {
  width: max-content;
}

.node-image-actions-above {
  width: max-content;
  max-width: calc(100vw - 32px);
}

.image-actions-pill {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 12px 6px 14px;
  max-width: min(720px, calc(var(--image-node-card-width) * 2.2));
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
  background: rgba(22, 22, 30, 0.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  box-sizing: border-box;
}

.image-actions-pill::-webkit-scrollbar {
  height: 4px;
}

.image-actions-pill::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.22);
  border-radius: 4px;
}

.image-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 9px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease;
}

.image-action-btn .el-icon {
  font-size: 16px;
}

.image-action-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.image-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  color: rgba(255, 255, 255, 0.45);
}

.image-action-btn.icon-only {
  padding: 8px;
}

.image-action-btn.icon-only .el-icon {
  font-size: 18px;
}

.image-action-btn.danger:hover:not(:disabled) {
  background: rgba(245, 108, 108, 0.2);
  color: #f89898;
}

.image-actions-divider {
  width: 1px;
  height: 20px;
  margin: 0 4px 0 6px;
  background: rgba(255, 255, 255, 0.18);
  flex-shrink: 0;
}

.image-canvas-node {
  position: relative;
  min-height: 320px;
  width: 100%;
  background: var(--bg-secondary, #1a1a2e);
  border: 2px solid var(--border-color, #3a3a4a);
  border-radius: 8px;
  /* 与 CanvasNode 一致：裁剪子元素，标题栏顶角随 8px 圆角过渡 */
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  box-sizing: border-box;
}

.image-canvas-node:hover:not(.is-selected) {
  border-color: rgba(255, 255, 255, 0.58);
  box-shadow: 0 2px 12px rgba(255, 255, 255, 0.07);
}

.image-canvas-node.is-selected {
  border-color: #409eff;
  box-shadow:
    0 0 0 1px rgba(64, 158, 255, 0.4),
    0 4px 14px rgba(64, 158, 255, 0.22);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 5px;
  min-width: 0;
  background: var(--bg-tertiary, #25253a);
  border-bottom: 1px solid var(--border-color, #3a3a4a);
}

.node-type-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.node-type-icon--image {
  color: #409eff;
}

.node-type-icon--video {
  color: #e6a23c;
}

.node-type-icon--text {
  color: #b37feb;
}

.node-type-icon--audio {
  color: #36cfc9;
}

.node-label {
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #ffffff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.node-label-storyboard {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: nowrap;
  min-width: 0;
}

.node-label-seq {
  color: #22c55e;
  font-weight: 800;
  flex-shrink: 0;
}

.node-label-title-text {
  font-weight: 600;
  color: var(--text-primary, #ffffff);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-status {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.img-preview-wrap {
  padding: 10px;
}

.hidden-input {
  display: none;
}

.img-preview {
  position: relative;
  /* height: var(--image-main-area-height); */
  min-height: var(--image-main-area-height);
  /* max-height: var(--image-main-area-height); */
  background: #12121c;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
}

.reference-lines-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 2;
}

.ref-line {
  position: absolute;
  background: rgba(255, 255, 255, 0.5);
}

.ref-line-h {
  left: 0;
  right: 0;
  height: 1px;
}

.ref-line-v {
  top: 0;
  bottom: 0;
  width: 1px;
}

.grid-split-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
}

.grid-lines {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.grid-line {
  position: absolute;
  background: rgba(64, 158, 255, 0.6);
}

.grid-line-h {
  left: 0;
  right: 0;
  height: 1px;
}

.grid-line-v {
  top: 0;
  bottom: 0;
  width: 1px;
}

.grid-cells {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.grid-cell {
  position: absolute;
  cursor: pointer;
  transition: background 0.15s ease;
}

.grid-cell:hover {
  background: rgba(64, 158, 255, 0.15);
}

.grid-cell.is-selected {
  background: rgba(64, 158, 255, 0.3);
  box-shadow: inset 0 0 0 2px rgba(64, 158, 255, 0.8);
}

.grid-cell-label {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(17, 19, 28, 0.85);
  color: #fff;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  pointer-events: none;
}

.grid-split-popover {
  z-index: 1000;
}

.grid-split-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.grid-menu-item {
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: none;
  color: #fff;
  text-align: left;
  cursor: pointer;
  border-radius: 6px;
  font-size: 14px;
  transition: background 0.15s ease;
}

.grid-menu-item:hover {
  background: rgba(64, 158, 255, 0.18);
}

.node-inline-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 10px 10px;
  box-sizing: border-box;
}

.preview-hover-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  gap: 6px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 2;
}

.img-preview:hover .preview-hover-actions {
  opacity: 1;
  pointer-events: auto;
}

.preview-hover-actions:hover {
  opacity: 1;
  pointer-events: auto;
}

.preview-corner-btn {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 7px;
  background: rgba(17, 19, 28, 0.82);
  color: rgba(255, 255, 255, 0.92);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.preview-corner-btn:hover {
  background: rgba(64, 158, 255, 0.18);
  border-color: rgba(64, 158, 255, 0.45);
  color: #fff;
}

.preview-storyboard-sweep-wrap {
  position: relative;
  align-self: stretch;
  flex: 1 1 auto;
  width: 100%;
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
  overflow: hidden;
  user-select: none;
}

.preview-storyboard-sweep-center {
  position: relative;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 16px;
  text-align: center;
  pointer-events: none;
  box-sizing: border-box;
}

.preview-sweep-icon-lg {
  font-size: 28px;
  opacity: 0.92;
  color: rgba(220, 230, 248, 0.95);
}

.preview-sweep-meta {
  font-size: 13px;
  line-height: 1.5;
  letter-spacing: 0.02em;
  color: rgba(220, 230, 248, 0.92);
  max-width: 22em;
}

.preview-gen-fail {
  padding: 12px;
  border: 1px solid rgba(245, 108, 108, 0.45);
  background: rgba(127, 29, 29, 0.18);
  color: rgba(255, 200, 200, 0.95);
  font-size: 12px;
  line-height: 1.45;
}

.preview-gen-fail-text {
  word-break: break-word;
  text-align: center;
}

.storyboard-gen-sweep-layer {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  overflow: hidden;
  border-radius: inherit;
}

.storyboard-gen-sweep-dim {
  position: absolute;
  inset: 0;
  background: rgba(12, 12, 20, 0.48);
}

.storyboard-gen-sweep-gradient {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: linear-gradient(
    to right,
    rgba(255, 255, 255, 0.35) 0%,
    rgba(255, 255, 255, 0.08) 100%
  );
  box-shadow: 0 0 24px rgba(120, 180, 255, 0.12);
}

.preview-empty {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  user-select: none;
}

.preview-img {
  width: 100%;
  height: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}

.img-toolbar {
  padding: 10px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
}

.img-toolbar-external {
  width: var(--image-toolbar-width);
    max-width: var(--image-toolbar-width);
    box-sizing: border-box;
    background: #35003b6b;
    border: 1px solid #ba00f7;
    border-radius: 8px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
}

.img-toolbar-external.is-viewpoint-open {
  width: min(470px, calc(100vw - 32px));
  max-width: min(470px, calc(100vw - 32px));
}

.rotate-panel {
  width: max-content;
  max-width: min(720px, calc(var(--image-node-card-width) * 2.2), calc(100vw - 32px));
  padding: 6px 12px 6px 10px;
}

.rotate-panel .rotate-toolbar-close {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}

.rotate-panel .rotate-toolbar-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.rotate-panel .rotate-angle-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  flex-shrink: 0;
}

.rotate-panel .rotate-angle-input {
  width: 72px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #101114;
  color: #fff;
  padding: 0 8px;
}

.rotate-panel .rotate-action-btn {
  border-radius: 10px;
}

.rotate-panel .image-action-btn.is-active {
  background: rgba(64, 158, 255, 0.25);
  color: #9fceff;
}

.viewpoint-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 4px;
  margin-bottom: 2px;
}

.viewpoint-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.viewpoint-model-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.viewpoint-model-inline-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}

.viewpoint-model-inline-name {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.viewpoint-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.viewpoint-cam-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition: all 0.15s ease;
}

.viewpoint-cam-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.viewpoint-cam-toggle.active {
  border-color: rgba(64, 158, 255, 0.65);
  background: rgba(64, 158, 255, 0.2);
  color: #e8f1ff;
}

.viewpoint-cam-toggle .el-icon {
  font-size: 14px;
}

.viewpoint-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.viewpoint-model-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  cursor: help;
  flex: 0 1 auto;
  min-width: 0;
  text-align: left;
  line-height: 1.35;
}

.viewpoint-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.viewpoint-cam-block {
  margin-top: 0;
  padding: 10px 8px 8px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.viewpoint-cam-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 2px;
}

.viewpoint-cam-title .el-icon {
  font-size: 16px;
  color: #79bbff;
}

.viewpoint-cam-hint {
  margin: 0 0 4px;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.45);
}

/* 预设角度样式 */
.viewpoint-presets {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 8px;
}

.preset-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.preset-section--distance {
  justify-content: flex-end;
}

.preset-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.58);
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.preset-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.preset-btn {
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: #101114;
  color: rgba(220, 228, 242, 0.85);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.preset-btn:hover {
  border-color: rgba(255, 255, 255, 0.28);
  color: #fff;
}

.preset-btn.active {
  border-color: rgba(64, 158, 255, 0.65);
  background: rgba(64, 158, 255, 0.2);
  color: #e8f1ff;
  font-weight: 600;
}

.vp-btn-apply-viewpoint {
  flex-shrink: 0;
  margin-left: 8px;
}

.vp-btn {
  padding: 6px 14px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.vp-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.vp-btn-ghost {
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
}

.vp-btn-ghost:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.vp-btn-primary {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
  font-weight: 600;
}

.vp-btn-primary:hover:not(:disabled) {
  background: #66b1ff;
  border-color: #66b1ff;
}

.image-action-btn.is-active {
  background: rgba(64, 158, 255, 0.25);
  color: #9fceff;
}

/* 上方条：自略高处滑入并淡入 */
.img-node-top-enter-active,
.img-node-top-leave-active {
  transition:
    opacity 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}

.img-node-top-enter-from,
.img-node-top-leave-to {
  opacity: 0;
  transform: translate(-50%, -12px);
}

.img-node-top-enter-to,
.img-node-top-leave-from {
  opacity: 1;
  transform: translate(-50%, 0);
}

/* 下方面板：自略低处滑入并淡入 */
.img-node-bottom-enter-active,
.img-node-bottom-leave-active {
  transition:
    opacity 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}

.img-node-bottom-enter-from,
.img-node-bottom-leave-to {
  opacity: 0;
  transform: translate(-50%, 14px);
}

.img-node-bottom-enter-to,
.img-node-bottom-leave-from {
  opacity: 1;
  transform: translate(-50%, 0);
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-refs {
  min-height: 44px;
}

.image-action-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-right: 4px;
}

.switch-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.92);
  white-space: nowrap;
}

.ref-add {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.25);
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ref-thumb {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.ref-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ref-remove {
  position: absolute;
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  padding: 0;
  font-size: 11px;
  line-height: 14px;
  border: none;
  border-radius: 0 0 0 4px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  cursor: pointer;
}

.prompt-input {
  width: 100%;
  resize: vertical;
  min-height: var(--canvas-toolbar-prompt-min-height);
  padding: var(--canvas-toolbar-prompt-padding);
  font-size: var(--canvas-toolbar-prompt-font-size);
  line-height: var(--canvas-toolbar-prompt-line-height);
  font-family: var(--canvas-toolbar-prompt-font-family);
  font-weight: 500;
  color: var(--canvas-toolbar-prompt-color);
  background: var(--canvas-toolbar-prompt-bg);
  border: 1px solid var(--canvas-toolbar-prompt-border);
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
}

.prompt-input::placeholder {
  color: var(--canvas-toolbar-prompt-placeholder);
}

.prompt-input:focus {
  border-color: #409eff;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  width: 100%;
}

.toolbar-actions-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}

.model-chip {
  width: auto;
  min-width: 290px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 5px;
  background: #101114;
  color: rgba(248, 250, 255, 0.95);
  font-size: 12px;
  padding: 0 10px;
  cursor: pointer;
  overflow: hidden;
}

.model-chip:hover {
  border-color: rgba(255, 255, 255, 0.22);
}

.model-chip-name {
  min-width: 0;
  flex: 1;
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.model-chip-group {
  flex-shrink: 0;
  font-size: 11px;
  color: rgba(142, 154, 179, 0.9);
}

.qa-trigger {
  flex-shrink: 0;
  margin-left: auto;
  min-width: 90px;
  height: 32px;
  padding: 0 8px;
  font-size: 12px;
  color: rgba(248, 250, 255, 0.95);
  background: #101114;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 5px;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.qa-trigger-icon {
  font-size: 13px;
  color: rgba(178, 193, 219, 0.86);
}

.image-action-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  position: relative;
  flex-wrap: nowrap;
}

.switch-text {
  order: 1;
}

.image-action-switch :deep(.el-switch) {
  order: 3;
  flex-shrink: 0;
}

.reference-help-icon {
  order: 2;
  position: static;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 14px;
  color: #909399;
  cursor: pointer;
  transition: color 0.2s;
  flex-shrink: 0;
}

.reference-help-icon:hover {
  color: #409eff;
}

.switch-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.92);
  white-space: nowrap;
}

.reference-help-content {
  padding: 4px;
}

.reference-help-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.reference-help-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}

.generate-row {
  display: flex;
  align-items: center;
  width: 100%;
}

.generate-left-controls {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  width: 50%;
}

.generate-left-controls-placeholder {
  display: flex;
  flex-shrink: 0;
  width: 50%;
}

.btn-generate {
  flex-shrink: 0;
  padding: 6px 12px;
  min-height: 32px;
  border-radius: 6px;
  border: none;
  background: #409eff;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
}

.btn-generate-full {
  width: 50%;
  padding: 8px 12px;
  min-height: 36px;
}

.btn-generate-icon {
  font-size: 14px;
}

.btn-generate-icon.is-spinning {
  animation: icon-spin 1s linear infinite;
}

.btn-generate:hover:not(:disabled) {
  background: #58abff;
}

.btn-generate:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.gen-loading {
  font-size: 16px;
  line-height: 1;
}

.fade-overlay-enter-active,
.fade-overlay-leave-active {
  transition: opacity 0.16s ease;
}

.fade-overlay-enter-from,
.fade-overlay-leave-to {
  opacity: 0;
}

@keyframes icon-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
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
  left: 0 !important;
}

.handle-source {
  right: 0 !important;
}

.status-running .handle {
  background: #409eff !important;
  animation: pulse 1.5s infinite;
}

.status-completed .handle {
  background: #67c23a !important;
}

.status-error .handle {
  background: #f56c6c !important;
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(64, 158, 255, 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(64, 158, 255, 0);
  }
}

/* 模型不支持参考图的提示覆盖层 */
.model-ref-not-supported-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  pointer-events: none;
}

.model-ref-not-supported-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  padding: 20px 24px;
  background: rgba(245, 108, 108, 0.12);
  border: 1px solid rgba(245, 108, 108, 0.45);
  border-radius: 12px;
}

.model-ref-not-supported-icon {
  font-size: 32px;
  color: #f56c6c;
}

.model-ref-not-supported-text {
  font-size: 13px;
  color: #ffcfcf;
  font-weight: 500;
  line-height: 1.4;
}

/* 节点缩放手柄 */
.node-resize-handle {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
}

.resize-handle-icon {
  width: 8px;
  height: 8px;
  border-right: 2px solid #409eff;
  border-bottom: 2px solid #409eff;
  border-radius: 0 0 2px 0;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.node-resize-handle:hover .resize-handle-icon {
  opacity: 1;
}
</style>

<style>
/* 模型选择：供应商 + 模型按钮面板（与分镜节点统一） */
.image-node-model-popover.el-popper,
.image-node-model-popover {
  padding: 12px !important;
  background: #17181c !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 14px !important;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.5) !important;
}

.image-node-model-popover .model-panel-label {
  margin: 2px 0 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.58);
}

.image-node-model-popover .provider-group,
.image-node-model-popover .model-group {
  display: grid;
  gap: 8px;
}

.image-node-model-popover .provider-group {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 10px;
}

.image-node-model-popover .model-group {
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
}

.image-node-model-popover .model-group::-webkit-scrollbar {
  width: 6px;
}

.image-node-model-popover .model-group::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.image-node-model-popover .model-group::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.image-node-model-popover .model-group::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

.image-node-model-popover .provider-btn {
  height: 34px;
  min-width: 84px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: #101114;
  color: rgba(220, 228, 242, 0.85);
  font-size: 13px;
  cursor: pointer;
}

.image-node-model-popover .provider-btn.active {
  border-color: rgba(64, 158, 255, 0.65);
  background: rgba(64, 158, 255, 0.2);
  color: #e8f1ff;
  font-weight: 600;
}

.image-node-model-popover .model-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: #101114;
  color: rgba(220, 228, 242, 0.85);
  font-size: 13px;
  line-height: 1.2;
  cursor: pointer;
}

.image-node-model-popover .model-btn-icon {
  width: 28px;
  height: 20px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: #fff;
  flex-shrink: 0;
}

.image-node-model-popover .model-btn-text {
  min-width: 0;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-node-model-popover .model-btn-icon.platform-jimeng { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.image-node-model-popover .model-btn-icon.platform-gpt { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.image-node-model-popover .model-btn-icon.platform-banana { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.image-node-model-popover .model-btn-icon.platform-qwen { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.image-node-model-popover .model-btn-icon.platform-grok { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.image-node-model-popover .model-btn-icon.platform-sora { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.image-node-model-popover .model-btn-icon.platform-veo { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.image-node-model-popover .model-btn-icon.platform-deepseek { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.image-node-model-popover .model-btn-icon.platform-kling { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.image-node-model-popover .model-btn-icon.platform-gemini { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.image-node-model-popover .model-btn-icon.platform-other { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }

.image-node-model-popover .model-btn.active {
  border-color: rgba(64, 158, 255, 0.65);
  background: rgba(64, 158, 255, 0.2);
  color: #e8f1ff;
  font-weight: 600;
}

.image-node-model-popover .model-group {
  grid-template-columns: repeat(1, minmax(0, 1fr));
}

.image-node-model-popover .model-empty {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.52);
}

/* 画质 / 比例：深色面板，选中为灰底白字（与参考 UI 一致）；比例区无边框 */
.image-node-quality-popover.el-popper,
.image-node-quality-popover {
  padding: 14px 14px 16px !important;
  background: #1a1a1a !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 14px !important;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55) !important;
}

.image-node-quality-popover .qa-panel {
  padding: 0;
}

.image-node-quality-popover .qa-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin: 14px 0 10px;
  font-weight: 500;
}

.image-node-quality-popover .qa-label:first-child {
  margin-top: 0;
}

.image-node-quality-popover .qa-segment {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #252525;
  border-radius: 10px;
  border: none;
}

.image-node-quality-popover .seg-btn {
  flex: 1;
  padding: 8px 0;
  font-size: 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.45);
  font-weight: 500;
  transition: background 0.15s ease, color 0.15s ease;
}

.image-node-quality-popover .seg-btn:hover:not(.active) {
  color: rgba(255, 255, 255, 0.65);
}

.image-node-quality-popover .seg-btn.active {
  background: #333333;
  color: #ffffff;
  font-weight: 700;
}

.image-node-quality-popover .qa-ratios {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  border: none;
}

.image-node-quality-popover .ratio-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 6px;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
  font-weight: 500;
  transition: background 0.15s ease, color 0.15s ease;
}

.image-node-quality-popover .ratio-btn:hover:not(.active) {
  color: rgba(255, 255, 255, 0.65);
}

.image-node-quality-popover .ratio-btn.active {
  background: #333333;
  color: #ffffff;
  font-weight: 600;
}

.image-node-quality-popover .ratio-shape {
  display: block;
  border: none;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.22);
  flex-shrink: 0;
}

.image-node-quality-popover .ratio-btn.active .ratio-shape {
  background: rgba(255, 255, 255, 0.95);
}

.image-node-quality-popover .ar-1-1 .ratio-shape {
  width: 22px;
  height: 22px;
}

.image-node-quality-popover .ar-16-9 .ratio-shape {
  width: 28px;
  height: 16px;
}

.image-node-quality-popover .ar-9-16 .ratio-shape {
  width: 16px;
  height: 28px;
}

.image-node-quality-popover .ar-3-4 .ratio-shape {
  width: 18px;
  height: 24px;
}

.image-node-quality-popover .ar-4-3 .ratio-shape {
  width: 24px;
  height: 18px;
}

.image-node-quality-popover .ar-21-9 .ratio-shape {
  width: 32px;
  height: 14px;
}

.reference-help-popover.el-popper,
.reference-help-popover {
  padding: 12px !important;
  background: #17181c !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 12px !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4) !important;
}

.reference-help-popover .reference-help-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(248, 250, 255, 0.95);
  margin-bottom: 10px;
}

.reference-help-popover .reference-help-text {
  font-size: 13px;
  color: rgba(220, 228, 242, 0.8);
  line-height: 1.7;
}

.reference-help-popover .reference-help-content {
  padding: 4px;
}
</style>
