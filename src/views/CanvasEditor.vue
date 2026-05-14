<script setup lang="ts">
import { ref, onMounted, markRaw, watch, onUnmounted, computed, provide, shallowRef, nextTick, unref, type Ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'
import { useArtStyleStore } from '@/stores/artStyleStore'
import { useUserStore } from '@/stores/userStore'
import { VueFlow, useVueFlow, Position, Panel, ConnectionLineType } from '@vue-flow/core'
import type { Node, Edge, NodeChange } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import {
  ElMessage,
  ElMessageBox,
  ElButton,
  ElDialog,
  ElInput,
  ElTable,
  ElTableColumn,
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem,
  ElPopover
} from 'element-plus'
import {
  ArrowLeft,
  FolderOpened,
  Plus,
  Delete,
  Edit,
  Clock,
  RefreshRight,
  ArrowLeftBold,
  ArrowRightBold,
  ArrowDown,
  Picture,
  Brush,
  Key,
  Setting,
  Document,
  VideoCamera,
  Box,
  VideoPlay,
  Grid,
  Microphone,
  MagicStick,
  User as MenuUserIcon,
  OfficeBuilding,
  Goods,
  EditPen,
  Operation
} from '@element-plus/icons-vue'
import { useNodesData, useNodeConnections, useHandleConnections, useHistory } from '@/composables'
import CanvasNode from '@/components/canvas/CanvasNode.vue'
import GroupNode from '@/components/canvas/GroupNode.vue'
import ImageCanvasNode from '@/components/canvas/ImageCanvasNode.vue'
import ImageSplitResultNode from '@/components/canvas/ImageSplitResultNode.vue'
import VR360CanvasNode from '@/components/canvas/VR360CanvasNode.vue'
import Viewport3DCanvasNode from '@/components/canvas/Viewport3DCanvasNode.vue'
import TextProcessCanvasNode from '@/components/canvas/TextProcessCanvasNode.vue'
import FreeDrawCanvasNode from '@/components/canvas/FreeDrawCanvasNode.vue'
import TextChapterResultCanvasNode from '@/components/canvas/TextChapterResultCanvasNode.vue'
import TextAssetResultCanvasNode from '@/components/canvas/TextAssetResultCanvasNode.vue'
import TextAssetDetailCanvasNode from '@/components/canvas/TextAssetDetailCanvasNode.vue'
import VideoCanvasNode from '@/components/canvas/VideoCanvasNode.vue'
import UpscaleCanvasNode from '@/components/canvas/UpscaleCanvasNode.vue'
import StoryboardGenCanvasNode from '@/components/canvas/StoryboardGenCanvasNode.vue'
import AssetExtractTemplateNode from '@/components/canvas/AssetExtractTemplateNode.vue'
import StoryboardTemplateNode from '@/components/canvas/StoryboardTemplateNode.vue'
import CanvasWorkbenchParamDrawer from '@/components/canvas/CanvasWorkbenchParamDrawer.vue'

import { useApiConfigStore } from '@/stores/apiConfigStore'
import { usePromptsStore } from '@/stores/promptsStore'
import { cloneGraphStateForSnapshot } from '@/utils/graphSnapshot'
import { vueFlowEdgeTypeForSetting } from '@/utils/canvasEdgeType'
import { canvasEdgeStyleFromWidth } from '@/utils/canvasEdgeStyle'
import { useI18n } from 'vue-i18n'
import type { ArtStyle } from '@/stores/artStyleStore'
import { resolveArtStyleLabel } from '@/utils/artStyleLocale'
import {
  mergeTextAssetDetailIntoTotal,
  baselineGroupedAssetsFromTotalData,
  inferAssetCategoryFromDetailData,
  patchTextAssetResultNodeInNodesList,
  removeDetailNodeFromTotalAssets,
  pruneOrphanedAssetDetailLinkedEntriesInTotals,
  type TextGroupedAssetsInput
} from '@/utils/mergeTextAssetDetailIntoTotal'
import CanvasControls from '@/components/canvas/CanvasControls.vue'
import ImageViewer from '@/components/canvas/ImageViewer.vue'
import SettingsDialog from '@/components/SettingsDialog.vue'
import WorkflowTemplateManager from '@/components/canvas/WorkflowTemplateManager.vue'
import type { WorkflowTemplate } from '@/composables/useWorkflowTemplate'
import {
  canvasLodLevelKey,
  canvasViewportZoomKey,
  CANVAS_LOD_SHELL_ZOOM_THRESHOLD,
  type CanvasLodLevel
} from '@/composables/useCanvasLodLevel'
import {
  useCanvasPerformance,
  canvasPerformanceKey
} from '@/composables/useCanvasPerformance'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/minimap/dist/style.css'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const artStyleStore = useArtStyleStore()
const apiConfigStore = useApiConfigStore()
const promptsStoreForCanvasWorkbench = usePromptsStore()
const userStore = useUserStore()
const { t } = useI18n()

function artStyleListLabel(style: ArtStyle) {
  return resolveArtStyleLabel(style, t)
}

/** 旧版快照里「图片」canvasNode 的常见 label，不受当前界面语言影响 */
const LEGACY_IMAGE_CANVAS_NODE_LABELS = new Set(['图片生成', 'Image generation'])

const projectId = ref(route.params.id as string)
const projectName = ref('')

// 消息相关
interface Message {
  id: number
  text: string
  type: 'success' | 'warning' | 'error' | 'info'
}
const messages = ref<Message[]>([])
const messageSet = ref<Set<string>>(new Set())

const addMessage = (text: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
  if (messageSet.value.has(text)) {
    return // 消息去重
  }
  messageSet.value.add(text)
  const id = Date.now()
  messages.value.unshift({ id, text, type })
  
  // 5秒后移除消息
  setTimeout(() => {
    const index = messages.value.findIndex(m => m.id === id)
    if (index !== -1) {
      messages.value.splice(index, 1)
      messageSet.value.delete(text)
    }
  }, 5000)
}

const {
  onConnect,
  addEdges,
  addNodes,
  fitView,
  getViewport,
  setViewport,
  screenToFlowCoordinate,
  getNodes,
  findNode,
  updateNode,
  updateNodeData,
  removeNodes,
  onNodeDragStart,
  onNodeDragStop,
  onSelectionDragStart,
  onSelectionDragStop,
  zoomTo,
  onNodesChange,
  viewport
} = useVueFlow()

// 节点菜单相关
const showNodeMenu = ref(false)
const nodeMenuPosition = ref({ x: 0, y: 0 })
/** 画布右键：人物/场景/道具资产组合（详情 + 图片，与文本资产提取链路一致） */
const showAssetComboMenu = ref(false)
const assetComboMenuPosition = ref({ x: 0, y: 0 })
const assetComboAnchorFlow = ref({ x: 0, y: 0 })
let lastClickTime = 0
let lastClickPosition = { x: 0, y: 0 }
const edgeDeleteMenuVisible = ref(false)
const edgeDeleteMenuPosition = ref({ x: 0, y: 0 })
const edgeDeleteTargetId = ref<string | null>(null)

function hideEdgeDeleteMenu() {
  edgeDeleteMenuVisible.value = false
  edgeDeleteTargetId.value = null
}

/** 点击画布空白或其他节点时，收起图片/文本节点外部工具栏（保留当前点击节点自身展开状态） */
function collapseOtherExternalToolbars(keepExpandedNodeId?: string) {
  let changed = false
  const next = nodes.value.map((n: any) => {
    const isToolbarNode = n.type === 'imageCanvas' || n.type === 'textProcess' || n.type === 'videoCanvas' || n.type === 'storyboardGen'
    if (!isToolbarNode || !n.data?.toolbarExpanded) {
      return n
    }
    if (keepExpandedNodeId && n.id === keepExpandedNodeId) {
      return n
    }
    changed = true
    return { ...n, data: { ...n.data, toolbarExpanded: false } }
  })
  if (changed) {
    nodes.value = next
  }
}

function handleFlowNodeClick(payload: { node: { id: string } }) {
  hideEdgeDeleteMenu()
  showAssetComboMenu.value = false
  collapseOtherExternalToolbars(payload.node.id)
}

function resolvePointerClient(event: unknown): { x: number; y: number } | null {
  const e = event as MouseEvent | TouchEvent | undefined
  if (!e) return null
  if ('clientX' in e && typeof e.clientX === 'number' && typeof e.clientY === 'number') {
    return { x: e.clientX, y: e.clientY }
  }
  const touch =
    ('touches' in e ? e.touches?.[0] : undefined) ||
    ('changedTouches' in e ? e.changedTouches?.[0] : undefined)
  if (touch) {
    return { x: touch.clientX, y: touch.clientY }
  }
  return null
}

function handleFlowEdgeClick(payload: { edge?: { id?: string }; event?: unknown }) {
  const event = payload.event
  const pointer = resolvePointerClient(event)
  if (!pointer || !payload.edge?.id) return
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const buttonRadius = 20
  edgeDeleteMenuPosition.value = {
    x: Math.max(buttonRadius, Math.min(pointer.x, viewportWidth - buttonRadius)),
    y: Math.max(buttonRadius, Math.min(pointer.y, viewportHeight - buttonRadius))
  }
  edgeDeleteTargetId.value = payload.edge.id
  edgeDeleteMenuVisible.value = true
  showNodeMenu.value = false
  showAssetComboMenu.value = false
  collapseOtherExternalToolbars()
}

/** 需绑定在 <VueFlow> 上，与 useVueFlow 内的 pane 监听器解耦，确保点击画布空白时必达 */
/**
 * 默认：滚轮缩放（使用 X-tapnow 的指数缩放逻辑，以鼠标位置为中心）。
 * Ctrl+滚轮：纵向平移。Vue Flow 在 zoomOnPinch 为 false 时会过滤掉 ctrl+wheel，故在此捕获并自行平移。
 */
function handleCanvasFlowWheel(e: WheelEvent) {
  const t = e.target as HTMLElement | null
  if (!t) return
  if (t.closest('input, textarea, [contenteditable="true"]')) {
    return
  }
  // 如果滚轮事件发生在三维视图节点内，不拦截，让 OrbitControls 处理
  if (t.closest('.viewport3d-viewer, .viewport3d-card')) {
    return
  }
  e.preventDefault()
  e.stopImmediatePropagation()
  e.stopPropagation()

  const v = getViewport()
  const deltaNormalize = e.deltaMode === 1 ? 20 : 1
  const rawDelta = e.deltaY * deltaNormalize

  if (e.ctrlKey) {
    // Ctrl+滚轮：纵向平移
    const speed = 0.5
    setViewport(
      { x: v.x, y: v.y - (rawDelta / v.zoom) * speed, zoom: v.zoom },
      { duration: 0 }
    )
  } else {
    // 普通滚轮：以鼠标位置为中心的指数缩放
    // X-tapnow 的指数缩放因子
    const zoomFactor = Math.pow(1.001, -rawDelta)
    const newZoom = Math.min(4, Math.max(0.2, v.zoom * zoomFactor))
    
    // 计算鼠标在画布中的位置
    const mouseX = e.clientX
    const mouseY = e.clientY
    
    // 计算缩放前鼠标指向的画布坐标
    const canvasX = (mouseX - v.x) / v.zoom
    const canvasY = (mouseY - v.y) / v.zoom
    
    // 计算新的视口位置，使鼠标指向的画布坐标保持不变
    const newX = mouseX - canvasX * newZoom
    const newY = mouseY - canvasY * newZoom
    
    setViewport(
      { x: newX, y: newY, zoom: newZoom },
      { duration: 0 }
    )
  }
}

function handleFlowPaneContextMenu(event: MouseEvent) {
  event.preventDefault()
  hideEdgeDeleteMenu()
  showNodeMenu.value = false
  const x = event.clientX
  const y = event.clientY
  const pad = 8
  assetComboMenuPosition.value = {
    x: Math.max(pad, Math.min(x, window.innerWidth - 260)),
    y: Math.max(pad, Math.min(y, window.innerHeight - 220))
  }
  assetComboAnchorFlow.value = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  showAssetComboMenu.value = true
}

function handleFlowPaneClick(event: MouseEvent) {
  hideEdgeDeleteMenu()
  showAssetComboMenu.value = false
  const now = Date.now()
  const currentPos = { x: event.clientX, y: event.clientY }

  if (
    now - lastClickTime < 300 &&
    Math.abs(currentPos.x - lastClickPosition.x) < 10 &&
    Math.abs(currentPos.y - lastClickPosition.y) < 10
  ) {
    nodeMenuPosition.value = { x: event.clientX, y: event.clientY }
    showNodeMenu.value = true
    lastClickTime = 0
  } else {
    showNodeMenu.value = false
    collapseOtherExternalToolbars()
    lastClickTime = now
    lastClickPosition = currentPos
  }
}

function handleDeleteEdgeFromMenu() {
  if (!edgeDeleteTargetId.value) return
  pushStateBeforeChange()
  const targetId = edgeDeleteTargetId.value
  const edge = edges.value.find((e) => e.id === targetId)
  if (edge) {
    syncTotalAssetRemoveDetailForEdgeEndpoints(edge.source, edge.target)
  }
  edges.value = edges.value.filter((e) => e.id !== targetId)
  hideEdgeDeleteMenu()
  addMessage(t('canvas.toast.edgeDeleted'), 'success')
}

/** 边为总资产 ↔ 资产详情时，拆线后从总资产列表移除该详情对应条目 */
function syncTotalAssetRemoveDetailForEdgeEndpoints(source: string, target: string) {
  const a = nodes.value.find((n) => n.id === source)
  const b = nodes.value.find((n) => n.id === target)
  let detailId: string | null = null
  let totalId: string | null = null
  if (a?.type === 'textAssetResult' && b?.type === 'textAssetDetail') {
    totalId = source
    detailId = target
  } else if (a?.type === 'textAssetDetail' && b?.type === 'textAssetResult') {
    detailId = source
    totalId = target
  }
  if (!detailId || !totalId) return
  const totalNode = nodes.value.find((n) => n.id === totalId)
  if (!totalNode || totalNode.type !== 'textAssetResult') return
  const next = removeDetailNodeFromTotalAssets(totalNode.data, detailId)
  if (next) {
    patchTextAssetResultNodeInNodesList(nodes, totalId, next.groupedAssets, next.assets)
  }
}

function findTextAssetTotalIdForDetail(detailId: string, edgeList: Edge[]): string | null {
  const byId = new Map(nodes.value.map((n) => [n.id, n]))
  for (const e of edgeList) {
    if (e.target === detailId) {
      const src = byId.get(e.source)
      if (src?.type === 'textAssetResult') return e.source
    }
    if (e.source === detailId) {
      const tgt = byId.get(e.target)
      if (tgt?.type === 'textAssetResult') return e.target
    }
  }
  return null
}

/**
 * Vue Flow 内置删除会先 apply 再同步 v-model，window 里的 deleteSelected 可能拿不到节点或漏掉同步。
 * 在 applyNodeChanges 之前注册的 listener 内可读到即将删除的详情与当前边表（与 store 监听顺序：先订阅者后 apply）。
 */
onNodesChange((changes: NodeChange[]) => {
  const byId = new Map(nodes.value.map((n) => [n.id, n]))
  const edgesSnapshot = [...edges.value]
  const detailIds: string[] = []
  for (const ch of changes) {
    if (ch.type !== 'remove') continue
    const n = byId.get(ch.id)
    if (n?.type === 'textAssetDetail') detailIds.push(ch.id)
  }
  if (detailIds.length === 0) return
  for (const detailId of detailIds) {
    const totalId = findTextAssetTotalIdForDetail(detailId, edgesSnapshot)
    if (!totalId) continue
    const totalNode = nodes.value.find((n) => n.id === totalId)
    if (!totalNode || totalNode.type !== 'textAssetResult') continue
    const next = removeDetailNodeFromTotalAssets(totalNode.data, detailId)
    if (next) {
      patchTextAssetResultNodeInNodesList(nodes, totalId, next.groupedAssets, next.assets)
    }
  }
})

function buildNewImageCanvasNodeData() {
  return {
    label: t('canvas.nodeDefaults.imageLabel'),
    type: 'image',
    status: 'pending' as const,
    description: t('canvas.nodeDefaults.imageDesc'),
    prompt: '',
    referenceImages: [] as string[],
    uploadedMainImageUrl: null as string | null,
    generatedImageUrl: null as string | null,
    toolbarExpanded: false,
    imageQuality: '1K' as const,
    aspectRatio: '16:9',
    imageModelGroup: apiConfigStore.imageModelGroup,
    imageModel: apiConfigStore.imageModel
  }
}

function buildNewTextProcessNodeData() {
  return {
    label: t('canvas.nodeDefaults.textLabel'),
    nodeTitleI18n: { key: 'canvas.nodeDefaults.textLabel' },
    type: 'text',
    status: 'pending' as const,
    description: t('canvas.nodeDefaults.textDesc'),
    textContent: '',
    storyPrompt: '',
    toolbarExpanded: false,
    textModelGroup: 'youshang' as const,
    textModel: apiConfigStore.currentConfig.selectedModel,
    selectedExtractAssetPromptId: '1',
    selectedGenerateStoryboardPromptId: '3',
    chapters: [] as Array<{ id: string; title: string; content: string; selected?: boolean }>,
    selectedChapterIds: [] as string[],
    chapterNodeId: undefined as string | undefined,
    totalAssetNodeId: undefined as string | undefined,
    characterAssetNodeId: undefined as string | undefined,
    sceneAssetNodeId: undefined as string | undefined,
    propAssetNodeId: undefined as string | undefined
  }
}

function buildNewVideoCanvasNodeData() {
  return {
    label: t('canvas.nodeDefaults.videoLabel'),
    type: 'video',
    status: 'pending' as const,
    description: t('canvas.nodeDefaults.videoDesc'),
    toolbarExpanded: false,
    prompt: '',
    referenceImages: [null, null] as Array<string | null>,
    generatedVideoUrl: null as string | null,
    videoModel: apiConfigStore.videoModel,
    aspectRatio: '16:9' as const,
    videoDuration: '4'
  }
}

function buildNewStoryboardGenNodeData() {
  return {
    label: t('canvas.nodeDefaults.storyboardLabel'),
    type: 'storyboard',
    status: 'pending' as const,
    description: t('canvas.nodeDefaults.storyboardDesc'),
    gridRows: 2,
    gridCols: 2,
    frames: [
      { id: 'frame-1', description: '' },
      { id: 'frame-2', description: '' },
      { id: 'frame-3', description: '' },
      { id: 'frame-4', description: '' }
    ],
    storyboardPrompt: '',
    referenceImages: [] as string[],
    generatedImageUrl: null as string | null,
    imageQuality: '1K' as const,
    aspectRatio: '16:9',
    imageModelGroup: apiConfigStore.imageModelGroup,
    imageModel: apiConfigStore.imageModel
  }
}

function buildNewUpscaleCanvasNodeData() {
  return {
    label: t('canvas.nodeDefaults.upscaleLabel') || '图片超分辨率',
    type: 'upscale',
    status: 'pending' as const,
    description: t('canvas.nodeDefaults.upscaleDesc') || 'AI 图片超分辨率放大',
    inputImagePath: null as string | null,
    outputImagePath: null as string | null,
    selectedModel: 'upscayl-standard-4x',
    scale: '4',
    format: 'png' as const,
    tileSize: undefined as number | undefined,
    compression: undefined as string | undefined,
    ttaMode: false,
    customWidth: undefined as string | undefined,
    gpuId: undefined as string | undefined,
    toolbarExpanded: false
  }
}

function buildNewFreeDrawNodeData() {
  return {
    label: t('canvas.nodeDefaults.freeDrawLabel'),
    nodeTitleI18n: { key: 'canvas.nodeDefaults.freeDrawLabel' },
    type: 'freeDraw',
    status: 'pending' as const,
    description: t('canvas.nodeDefaults.freeDrawDesc'),
    toolbarExpanded: false,
    canvasWidth: 430,
    canvasHeight: 260,
    backgroundColor: 'rgba(24, 27, 39, 0.96)',
    penColor: '#4da3ff',
    penSize: 3,
    mode: 'pen' as const,
    strokes: [] as Array<{ id: string; color: string; size: number; points: Array<{ x: number; y: number }> }>
  }
}

// 在点击位置添加节点
const addNodeAtPosition = (type: string) => {
  pushStateBeforeChange()
  
  const flowPosition = screenToFlowCoordinate({
    x: nodeMenuPosition.value.x,
    y: nodeMenuPosition.value.y
  })

  if (type === 'group') {
    // 创建空分组
    const groupId = `group-${Date.now()}`
    addNodes({
      id: groupId,
      type: 'group',
      position: {
        x: flowPosition.x - 120,
        y: flowPosition.y - 75
      },
      width: 240,
      height: 150,
      style: {
        width: '240px',
        height: '150px'
      },
      data: {
        label: t('canvas.nodeDefaults.newGroupLabel')
      },
      draggable: true,
      selectable: true
    })
  } else if (type === 'image') {
    const nodeId = `image-${Date.now()}`
    addNodes({
      id: nodeId,
      type: 'imageCanvas',
      position: {
        x: flowPosition.x - 100,
        y: flowPosition.y - 40
      },
      data: buildNewImageCanvasNodeData()
    })
  } else if (type === 'vr360') {
    const nodeId = `vr360-${Date.now()}`
    addNodes({
      id: nodeId,
      type: 'vr360',
      position: {
        x: flowPosition.x - 260,
        y: flowPosition.y - 180
      },
      style: { width: '520px' },
      data: {
        label: t('canvas.nodeDefaults.vr360Label'),
        type: 'vr360',
        imageUrl: null,
        previewImageUrl: null,
        autoRotate: false
      }
    })
  } else if (type === 'viewport3d') {
    const nodeId = `viewport3d-${Date.now()}`
    addNodes({
      id: nodeId,
      type: 'viewport3d',
      position: {
        x: flowPosition.x - 260,
        y: flowPosition.y - 180
      },
      style: { width: '520px' },
      data: {
        label: t('canvas.nodeDefaults.view3dLabel'),
        type: 'viewport3d',
        imageUrl: null,
        previewImageUrl: null,
        objects: []
      }
    })

  } else if (type === 'text') {
    const nodeId = `text-${Date.now()}`
    addNodes({
      id: nodeId,
      type: 'textProcess',
      position: {
        x: flowPosition.x - 120,
        y: flowPosition.y - 60
      },
      data: buildNewTextProcessNodeData()
    })
  } else if (type === 'video') {
    const nodeId = `video-${Date.now()}`
    addNodes({
      id: nodeId,
      type: 'videoCanvas',
      position: {
        x: flowPosition.x - 120,
        y: flowPosition.y - 60
      },
      data: buildNewVideoCanvasNodeData()
    })
  } else if (type === 'storyboardGen') {
    const nodeId = `storyboard-${Date.now()}`
    addNodes({
      id: nodeId,
      type: 'storyboardGen',
      position: {
        x: flowPosition.x - 120,
        y: flowPosition.y - 60
      },
      data: buildNewStoryboardGenNodeData()
    })
  } else if (type === 'freeDraw') {
    const nodeId = `free-draw-${Date.now()}`
    addNodes({
      id: nodeId,
      type: 'freeDrawCanvas',
      position: {
        x: flowPosition.x - 220,
        y: flowPosition.y - 160
      },
      data: buildNewFreeDrawNodeData()
    })
  } else if (type === 'upscale') {
    const nodeId = `upscale-${Date.now()}`
    addNodes({
      id: nodeId,
      type: 'upscaleCanvas',
      position: {
        x: flowPosition.x - 160,
        y: flowPosition.y - 100
      },
      data: buildNewUpscaleCanvasNodeData()
    })
  } else {
    const nodeId = `${type}-${Date.now()}`
    let label = ''
    let description = ''

    switch (type) {
      case 'text':
        label = t('canvas.nodeDefaults.textLabel')
        description = t('canvas.nodeDefaults.textDesc')
        break
      case 'video':
        label = t('canvas.nodeDefaults.videoLabel')
        description = t('canvas.nodeDefaults.videoDesc')
        break
      case 'audio':
        label = t('canvas.nodeDefaults.audioLabel')
        description = t('canvas.nodeDefaults.audioDesc')
        break
    }

    addNodes({
      id: nodeId,
      type: 'canvasNode',
      position: {
        x: flowPosition.x - 100,
        y: flowPosition.y - 40
      },
      data: {
        label,
        type,
        status: 'pending',
        description
      }
    })
  }

  showNodeMenu.value = false
}

/** 与 TextProcessCanvasNode 中资产详情 → 图片节点的纵向间距一致 */
const ASSET_COMBO_DETAIL_TO_IMAGE_GAP_Y = 360
const ASSET_COMBO_DETAIL_NODE_W = 430

type AssetComboCategory = 'character' | 'scene' | 'prop'

function buildAssetComboImagePrompt(name: string, description: string) {
  const n = String(name ?? '').trim()
  const d = String(description ?? '').trim()
  const lines: string[] = []
  if (n) lines.push(t('canvas.nodeDefaults.assetNameLine', { name: n }))
  if (d) lines.push(t('canvas.nodeDefaults.assetDescLine', { desc: d }))
  return lines.join('\n')
}

function resolveAssetComboDetailLabel(category: AssetComboCategory) {
  if (category === 'character') return t('canvas.comboDetailLabels.character')
  if (category === 'scene') return t('canvas.comboDetailLabels.scene')
  return t('canvas.comboDetailLabels.prop')
}

function defaultAssetNameForCombo(category: AssetComboCategory) {
  if (category === 'character') return t('canvas.newAssetDefaults.character')
  if (category === 'scene') return t('canvas.newAssetDefaults.scene')
  return t('canvas.newAssetDefaults.prop')
}

function addAssetComboAtCursor(category: AssetComboCategory) {
  pushStateBeforeChange()
  const flow = assetComboAnchorFlow.value
  const now = Date.now()
  const assetName = defaultAssetNameForCombo(category)
  const assetDescription = ''
  const detailNodeId = `asset-detail-${category}-combo-${now}`
  const imageNodeId = `asset-image-${category}-combo-${now}`
  const columnX = flow.x - ASSET_COMBO_DETAIL_NODE_W / 2
  const detailY = flow.y - 48
  const imageY = detailY + ASSET_COMBO_DETAIL_TO_IMAGE_GAP_Y
  const detailLabel = resolveAssetComboDetailLabel(category)

  addNodes({
    id: detailNodeId,
    type: 'textAssetDetail',
    position: { x: columnX, y: detailY },
    data: {
      label: detailLabel,
      type: 'textAssetDetail',
      status: 'completed',
      description: t('canvas.nodeDefaults.assetDetailDesc'),
      nodeTitleI18n: {
        key:
          category === 'character'
            ? 'canvas.comboDetailLabels.character'
            : category === 'scene'
              ? 'canvas.comboDetailLabels.scene'
              : 'canvas.comboDetailLabels.prop'
      },
      assetCategory: category,
      assetName,
      assetDescription,
      linkedImageNodeId: imageNodeId,
      generatedByTextProcess: true
    }
  })

  addNodes({
    id: imageNodeId,
    type: 'imageCanvas',
    position: { x: columnX, y: imageY },
    data: {
      label: t('canvas.nodeDefaults.imageNameWithAsset', { name: assetName }),
      type: 'image',
      status: 'pending',
      description: t('canvas.nodeDefaults.imageGenDescWithAsset', { name: assetName }),
      prompt: buildAssetComboImagePrompt(assetName, assetDescription),
      referenceImages: [],
      uploadedMainImageUrl: null,
      generatedImageUrl: null,
      toolbarExpanded: false,
      imageQuality: '1K',
      aspectRatio: '16:9',
      imageModelGroup: apiConfigStore.imageModelGroup,
      imageModel: apiConfigStore.imageModel,
      assetCategory: category,
      sourceAssetDetailNodeId: detailNodeId,
      generatedByTextProcess: true
    }
  })

  addEdges({
    id: `e-${detailNodeId}-${imageNodeId}-${now}`,
    source: detailNodeId,
    target: imageNodeId,
    animated: true,
    type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
    style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
  })

  showAssetComboMenu.value = false
  addMessage(t('canvas.toast.addedComboDetail', { label: detailLabel }), 'success')
}

// 点击其他地方关闭菜单
const handleMenuClose = () => {
  showNodeMenu.value = false
  showAssetComboMenu.value = false
}

// 删除选中的节点
const deleteSelected = () => {
  const selectedNodes = nodes.value.filter(n => n.selected)
  if (selectedNodes.length === 0) {
    addMessage(t('canvas.toast.selectNodesToDelete'), 'warning')
    return
  }
  
  pushStateBeforeChange()
  
  const selectedIds = selectedNodes.map(n => n.id)
  const edgesSnapshot = [...edges.value]
  const detailNodesBeingRemoved = selectedNodes.filter((n) => n.type === 'textAssetDetail')
  for (const d of detailNodesBeingRemoved) {
    const totalId = findTextAssetTotalIdForDetail(d.id, edgesSnapshot)
    if (!totalId) continue
    const totalNode = nodes.value.find((n) => n.id === totalId)
    if (!totalNode || totalNode.type !== 'textAssetResult') continue
    const next = removeDetailNodeFromTotalAssets(totalNode.data, d.id)
    if (next) {
      patchTextAssetResultNodeInNodesList(nodes, totalId, next.groupedAssets, next.assets)
    }
  }
  // 删除节点和相关的边
  nodes.value = nodes.value.filter(n => !selectedIds.includes(n.id))
  edges.value = edges.value.filter(e => !selectedIds.includes(e.source) && !selectedIds.includes(e.target))
  addMessage(t('canvas.toast.nodesDeleted', { count: selectedNodes.length }), 'success')
}

// === 分组功能 ===
/** 与 GroupNode 标题栏占位一致：createGroup 时上移组框并增高，子节点相对 Y 自动含此留白，避免盖住「分组」标题 */
const GROUP_NODE_HEADER_RESERVE_PX = 40

/** 与 CanvasNode.vue 中 min-width / min-height 一致，用于未测量且无 style 时的包围盒 */
const CANVAS_NODE_FALLBACK_W = 300
const CANVAS_NODE_FALLBACK_H = 300
/** 与 ImageCanvasNode.vue 主区域大致尺寸一致，用于打组时尚未测量 dimensions 的包围盒 */
const IMAGE_CANVAS_FALLBACK_W = 380
const IMAGE_CANVAS_FALLBACK_H = 300
const IMAGE_SPLIT_RESULT_FALLBACK_W = 520
const IMAGE_SPLIT_RESULT_FALLBACK_H = 480
const VIDEO_CANVAS_FALLBACK_W = 430
const VIDEO_CANVAS_FALLBACK_H = 320
const STORYBOARD_GEN_FALLBACK_W = 430
const STORYBOARD_GEN_FALLBACK_H = 420
const GROUP_NODE_FALLBACK_W = 220
const GROUP_NODE_FALLBACK_H = 160

function migrateLegacyNodes(rawNodes: any[]): any[] {
  if (!Array.isArray(rawNodes)) return []
  return rawNodes.map((n) => {
    if (n?.type === 'canvasNode' && n.data?.type === 'image') {
      const d = n.data
      return {
        ...n,
        type: 'imageCanvas',
        data: {
          label: LEGACY_IMAGE_CANVAS_NODE_LABELS.has(String(d.label))
            ? t('canvas.nodeDefaults.imageLabel')
            : (d.label || t('canvas.nodeDefaults.imageLabel')),
          type: 'image',
          status: d.status ?? 'pending',
          description: d.description ?? t('canvas.nodeDefaults.imageDesc'),
          prompt: d.prompt ?? '',
          referenceImages: Array.isArray(d.referenceImages) ? d.referenceImages : [],
          uploadedMainImageUrl: d.uploadedMainImageUrl ?? null,
          generatedImageUrl: d.generatedImageUrl ?? d.outputUrl ?? null,
          toolbarExpanded: d.toolbarExpanded ?? false,
          imageQuality: d.imageQuality ?? '1K',
          aspectRatio: d.aspectRatio ?? '16:9',
          imageModelGroup: d.imageModelGroup,
          imageModel: d.imageModel
        }
      }
    }
    if (n?.type === 'canvasNode' && n.data?.type === 'text') {
      const d = n.data
      return {
        ...n,
        type: 'textProcess',
        data: {
          ...buildNewTextProcessNodeData(),
          label: d.label || t('canvas.nodeDefaults.textLabel'),
          type: 'text',
          status: d.status ?? 'pending',
          description: d.description ?? t('canvas.nodeDefaults.textDesc'),
          textContent: d.textContent ?? d.content ?? '',
          storyPrompt: d.storyPrompt ?? '',
          toolbarExpanded: d.toolbarExpanded ?? false,
          textModel: d.textModel ?? apiConfigStore.currentConfig.selectedModel,
          chapters: Array.isArray(d.chapters) ? d.chapters : [],
          selectedChapterIds: Array.isArray(d.selectedChapterIds) ? d.selectedChapterIds : [],
          chapterNodeId: d.chapterNodeId,
          totalAssetNodeId: d.totalAssetNodeId,
          characterAssetNodeId: d.characterAssetNodeId,
          sceneAssetNodeId: d.sceneAssetNodeId,
          propAssetNodeId: d.propAssetNodeId
        }
      }
    }
    if (n?.type === 'canvasNode' && n.data?.type === 'video') {
      const d = n.data
      return {
        ...n,
        type: 'videoCanvas',
        data: {
          ...buildNewVideoCanvasNodeData(),
          label: d.label || t('canvas.nodeDefaults.videoLabel'),
          type: 'video',
          status: d.status ?? 'pending',
          description: d.description ?? t('canvas.nodeDefaults.videoDesc'),
          toolbarExpanded: d.toolbarExpanded ?? false,
          prompt: d.prompt ?? '',
          referenceImages: Array.isArray(d.referenceImages)
            ? [d.referenceImages[0] ?? null, d.referenceImages[1] ?? null]
            : [d.referenceImage ?? null, null],
          generatedVideoUrl: d.generatedVideoUrl ?? d.outputUrl ?? null,
          videoModel: d.videoModel ?? apiConfigStore.videoModel,
          aspectRatio: d.aspectRatio ?? '16:9',
          videoDuration: d.videoDuration ?? '4'
        }
      }
    }
    if (n?.type === 'videoCanvas') {
      const d = n.data ?? {}
      return {
        ...n,
        type: 'videoCanvas',
        data: {
          ...buildNewVideoCanvasNodeData(),
          ...d,
          referenceImages: Array.isArray(d.referenceImages)
            ? [d.referenceImages[0] ?? null, d.referenceImages[1] ?? null]
            : [d.referenceImage ?? null, null]
        }
      }
    }
    if (n?.type === 'storyboardGen') {
      const d = n.data ?? {}
      return {
        ...n,
        type: 'storyboardGen',
        data: {
          ...buildNewStoryboardGenNodeData(),
          ...d,
          gridRows: Number.isFinite(d.gridRows) ? d.gridRows : 2,
          gridCols: Number.isFinite(d.gridCols) ? d.gridCols : 2,
          frames: Array.isArray(d.frames) ? d.frames : buildNewStoryboardGenNodeData().frames,
          referenceImages: Array.isArray(d.referenceImages) ? d.referenceImages : []
        }
      }
    }
    return n
  })
}

function parseCssSize(val: unknown): number {
  if (val == null) return NaN
  if (typeof val === 'number') return val
  const n = parseFloat(String(val))
  return Number.isFinite(n) ? n : NaN
}

/** 子节点 position 为相对父级，换算为画布绝对坐标（用于打组包围盒与重挂父节点） */
function getAbsoluteNodePosition(node: any, nodeList: any[]): { x: number, y: number } {
  let x = node.position.x
  let y = node.position.y
  let pid: string | undefined = node.parentNode
  while (pid) {
    const p = nodeList.find(n => n.id === pid)
    if (!p) break
    x += p.position.x
    y += p.position.y
    pid = p.parentNode
  }
  return { x, y }
}

function getNodeVisualSize(node: any): { w: number, h: number } {
  const dw = node.dimensions?.width
  const dh = node.dimensions?.height
  if (typeof dw === 'number' && typeof dh === 'number' && dw > 0 && dh > 0) {
    return { w: dw, h: dh }
  }

  const style = node.style || {}
  let w = parseCssSize(style.width)
  let h = parseCssSize(style.height)
  if (w > 0 && h > 0) return { w, h }

  w = parseCssSize(node.width)
  h = parseCssSize(node.height)
  if (w > 0 && h > 0) return { w, h }

  if (node.type === 'canvasNode') {
    return { w: CANVAS_NODE_FALLBACK_W, h: CANVAS_NODE_FALLBACK_H }
  }
  if (node.type === 'imageCanvas') {
    return { w: IMAGE_CANVAS_FALLBACK_W, h: IMAGE_CANVAS_FALLBACK_H }
  }
  if (node.type === 'textProcess') {
    return { w: 430, h: 320 }
  }
  if (node.type === 'freeDrawCanvas') {
    return { w: 430, h: 320 }
  }
  if (node.type === 'videoCanvas') {
    return { w: VIDEO_CANVAS_FALLBACK_W, h: VIDEO_CANVAS_FALLBACK_H }
  }
  if (node.type === 'storyboardGen') {
    return { w: STORYBOARD_GEN_FALLBACK_W, h: STORYBOARD_GEN_FALLBACK_H }
  }
  if (node.type === 'textChapterResult') {
    return { w: 300, h: 260 }
  }
  if (node.type === 'textAssetResult') {
    return { w: 280, h: 240 }
  }
  if (node.type === 'textAssetDetail') {
    return { w: 320, h: 230 }
  }
  if (node.type === 'imageSplitResult') {
    return { w: IMAGE_SPLIT_RESULT_FALLBACK_W, h: IMAGE_SPLIT_RESULT_FALLBACK_H }
  }
  if (node.type === 'group') {
    return { w: GROUP_NODE_FALLBACK_W, h: GROUP_NODE_FALLBACK_H }
  }
  return { w: 180, h: 80 }
}

// 创建分组
const createGroup = (selectedNodeIds: string[]) => {
  if (selectedNodeIds.length === 0) {
    addMessage(t('canvas.toast.selectNodesGroup'), 'warning')
    return
  }

  const list = nodes.value
  const selectedNodes = list.filter(
    n => selectedNodeIds.includes(n.id) && n.type !== 'group'
  )

  if (selectedNodes.length === 0) {
    addMessage(t('canvas.toast.groupNeedNonGroup'), 'warning')
    return
  }

  pushStateBeforeChange()

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  selectedNodes.forEach(node => {
    const { x: ax, y: ay } = getAbsoluteNodePosition(node, list)
    const { w, h } = getNodeVisualSize(node)
    minX = Math.min(minX, ax)
    minY = Math.min(minY, ay)
    maxX = Math.max(maxX, ax + w)
    maxY = Math.max(maxY, ay + h)
  })

  /** 分组虚线框与内部节点外沿之间的统一间距 */
  const GROUP_NODE_EDGE_GAP_PX = 35
  const groupId = `group-${Date.now()}`
  const groupPos = {
    x: minX - GROUP_NODE_EDGE_GAP_PX,
    y: minY - GROUP_NODE_EDGE_GAP_PX - GROUP_NODE_HEADER_RESERVE_PX
  }
  const groupWidth = Math.max(220, maxX - minX + GROUP_NODE_EDGE_GAP_PX * 2)
  const groupHeight = Math.max(
    160,
    maxY - minY + GROUP_NODE_EDGE_GAP_PX * 2 + GROUP_NODE_HEADER_RESERVE_PX
  )

  const selectedIdSet = new Set(selectedNodes.map(n => n.id))

  const groupNode = {
    id: groupId,
    type: 'group',
    position: groupPos,
    width: groupWidth,
    height: groupHeight,
    style: {
      width: `${groupWidth}px`,
      height: `${groupHeight}px`
    },
    data: {
      label: t('canvas.nodeDefaults.groupLabel')
    },
    draggable: true,
    selectable: true,
    isParent: true
  }

  // 打组子节点不要带 extent:'parent'：父节点尚未测量时 dimensions 为 0，会把所有子节点 clamp 到左上角重合
  const graphInternals = new Set([
    'computedPosition',
    'dimensions',
    'handleBounds',
    'initialized',
    'isParent',
    'dragging',
    'resizing',
    'extent'
  ])

  // 必须一次写入完整数组：若先 addNodes 再 nodes.value = list.map，list 不含新组节点，会覆盖掉分组导致子节点 parent 丢失
  const rest: typeof list = []
  const children: typeof list = []
  for (const node of list) {
    if (selectedIdSet.has(node.id)) {
      const abs = getAbsoluteNodePosition(node, list)
      const child: Record<string, any> = {}
      for (const [k, v] of Object.entries(node)) {
        if (graphInternals.has(k) || k === 'parentNode') continue
        child[k] = v
      }
      child.parentNode = groupId
      child.position = {
        x: abs.x - groupPos.x,
        y: abs.y - groupPos.y
      }
      child.draggable = true
      child.selected = false
      children.push(child as (typeof list)[number])
    } else {
      rest.push(node)
    }
  }

  nodes.value = [...rest, groupNode, ...children]

  // 使用双重 requestAnimationFrame 确保分组节点完全测量后再设置 extent
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      nodes.value = nodes.value.map(n => {
        if (n.parentNode === groupId) {
          return {
            ...n,
            extent: 'parent'
          }
        }
        return n
      })
    })
  })

  addMessage(t('canvas.toast.groupCreated'), 'success')
}

// 取消分组
const ungroup = (groupId: string) => {
  const groupNode = nodes.value.find(n => n.id === groupId)
  if (!groupNode) return

  pushStateBeforeChange()

  const childNodes = nodes.value.filter(n => n.parentNode === groupId)

  // 把子节点从分组中移出，更新位置
  nodes.value = nodes.value.map(node => {
    if (node.parentNode === groupId) {
      return {
        ...node,
        parentNode: undefined,
        position: {
          x: node.position.x + groupNode.position.x,
          y: node.position.y + groupNode.position.y
        },
        draggable: true,
        extent: undefined,
        hidden: false  // 取消打组时确保子节点显示
      }
    }
    return node
  })

  // 删除分组节点
  nodes.value = nodes.value.filter(n => n.id !== groupId)

  addMessage(t('canvas.toast.groupRemoved'), 'success')
}

provide('canvasUngroup', ungroup)
provide('canvasGetNodes', () => nodes.value)

// 快捷键监听
const setupKeyboardShortcuts = () => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // 忽略在输入框中的按键
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return
    }

    // Delete/Backspace - 删除选中的节点
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      deleteSelected()
      return
    }

    // Ctrl+Z - 撤销
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault()
      undo()
      return
    }

    // Ctrl+Shift+Z - 重做
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      redo()
      return
    }

    // Ctrl+Shift+G 取消分组（优先判断）
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
      e.preventDefault()
      const selectedGroups = nodes.value.filter(n => n.type === 'group' && n.selected).map(n => n.id)
      if (selectedGroups.length > 0) {
        selectedGroups.forEach(groupId => ungroup(groupId))
      }
      return
    }

    // Ctrl+G 创建分组
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
      e.preventDefault()
      const selectedNodes = nodes.value
        .filter(n => n.selected && n.type !== 'group')
        .map(n => n.id)
      if (selectedNodes.length > 0) {
        createGroup(selectedNodes)
      } else {
        addMessage(t('canvas.toast.selectForGroup'), 'warning')
      }
      return
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}

const nodes = shallowRef<any[]>([])

const edges = shallowRef<Edge[]>([])

const nodeCount = computed(() => nodes.value.length)
const canvasPerformance = useCanvasPerformance(nodeCount, viewport)
provide(canvasPerformanceKey, canvasPerformance)

/** 内置删除漏同步时，下一帧剔除已无对应节点的 asset-detail-* 总资产条目 */
let pendingPruneOrphansAfterDrag = false
watch(
  () => nodes.value.map((n) => n.id).join('\0'),
  () => {
    if (isCanvasDragging.value) {
      pendingPruneOrphansAfterDrag = true
      return
    }
    void nextTick(() => {
      pruneOrphanedAssetDetailLinkedEntriesInTotals(nodes)
    })
  }
)

const { canUndo, canRedo, undo, redo, pushState, pushStateBeforeChange, pushUndoSnapshot } = useHistory({
  /** 每步撤销为整图 JSON 深拷贝，大图节点多时略减档位数可降低主线程尖峰占用 */
  maxHistory: 10,
  nodes,
  edges
})

const CANVAS_DRAWER_CHAR_DEFAULT = '5'
const CANVAS_DRAWER_SCENE_DEFAULT = '6'
const CANVAS_DRAWER_PROPS_DEFAULT = '7'
const CANVAS_DRAWER_SB_DEFAULT = '8'
const CANVAS_DRAWER_VID_DEFAULT = '9'
const CANVAS_DRAWER_ASSET_EXTRACT_DEFAULT = '1'
const CANVAS_DRAWER_STORYBOARD_GEN_DEFAULT = '3'
const CANVAS_DRAWER_STORYBOARD_GRID_DEFAULT = '4grid'

/** 画布工坊全局：人物类资产图片节点共用的「生成人物」模板 id（generate-character） */
const canvasWorkbenchCharacterAssetPromptTemplateId = ref(CANVAS_DRAWER_CHAR_DEFAULT)
/** 画布工坊全局：场景类资产图片节点共用的「生成场景」模板 id（generate-scene） */
const canvasWorkbenchSceneAssetPromptTemplateId = ref(CANVAS_DRAWER_SCENE_DEFAULT)
/** 画布工坊全局：道具类资产图片节点共用的「生成道具」模板 id（generate-props） */
const canvasWorkbenchPropsAssetPromptTemplateId = ref(CANVAS_DRAWER_PROPS_DEFAULT)
/** 画布工坊全局：所有分镜生成节点共用的「生成分镜图」模板 id（generate-storyboard-image） */
const canvasWorkbenchStoryboardImagePromptId = ref(CANVAS_DRAWER_SB_DEFAULT)
/** 画布工坊全局：所有视频生成节点共用的「生成视频」模板 id（generate-video） */
const canvasWorkbenchVideoPromptTemplateId = ref(CANVAS_DRAWER_VID_DEFAULT)
/** 画布工坊全局：资产提取模板节点共用的「提取资产」模板 id（extract-assets） */
const canvasWorkbenchAssetExtractPromptTemplateId = ref(CANVAS_DRAWER_ASSET_EXTRACT_DEFAULT)
/** 画布工坊全局：生成分镜模板节点共用的「生成分镜」模板 id（generate-storyboard） */
const canvasWorkbenchStoryboardGenPromptTemplateId = ref(CANVAS_DRAWER_STORYBOARD_GEN_DEFAULT)
/** 画布工坊全局：分镜生成节点共用的宫格格式 */
const canvasWorkbenchStoryboardGridFormat = ref(CANVAS_DRAWER_STORYBOARD_GRID_DEFAULT)

const canvasParamDrawerVisible = ref(false)

type CanvasWorkbenchPromptSubCat =
  | 'generate-character'
  | 'generate-scene'
  | 'generate-props'
  | 'generate-storyboard-image'
  | 'generate-video'
  | 'extract-assets'
  | 'generate-storyboard'

function normalizeCanvasWorkbenchTplBySubcategory(
  targetRef: Ref<string>,
  subCategory: CanvasWorkbenchPromptSubCat,
  defaultId: string
) {
  const list = promptsStoreForCanvasWorkbench.getSubCategoryPrompts(subCategory)
  if (list.length === 0) return
  const cur = String(targetRef.value ?? '').trim()
  if (!list.some((p) => p.id === cur)) {
    targetRef.value = list.find((p) => p.id === defaultId)?.id ?? list[0]!.id
  }
}

function normalizeCanvasWorkbenchCharacterAssetTplId() {
  normalizeCanvasWorkbenchTplBySubcategory(
    canvasWorkbenchCharacterAssetPromptTemplateId,
    'generate-character',
    CANVAS_DRAWER_CHAR_DEFAULT
  )
}

function normalizeCanvasWorkbenchSceneAssetTplId() {
  normalizeCanvasWorkbenchTplBySubcategory(
    canvasWorkbenchSceneAssetPromptTemplateId,
    'generate-scene',
    CANVAS_DRAWER_SCENE_DEFAULT
  )
}

function normalizeCanvasWorkbenchPropsAssetTplId() {
  normalizeCanvasWorkbenchTplBySubcategory(
    canvasWorkbenchPropsAssetPromptTemplateId,
    'generate-props',
    CANVAS_DRAWER_PROPS_DEFAULT
  )
}

function normalizeCanvasWorkbenchStoryboardTplId() {
  normalizeCanvasWorkbenchTplBySubcategory(
    canvasWorkbenchStoryboardImagePromptId,
    'generate-storyboard-image',
    CANVAS_DRAWER_SB_DEFAULT
  )
}

function normalizeCanvasWorkbenchVideoTplId() {
  normalizeCanvasWorkbenchTplBySubcategory(
    canvasWorkbenchVideoPromptTemplateId,
    'generate-video',
    CANVAS_DRAWER_VID_DEFAULT
  )
}

function normalizeCanvasWorkbenchAssetExtractTplId() {
  normalizeCanvasWorkbenchTplBySubcategory(
    canvasWorkbenchAssetExtractPromptTemplateId,
    'extract-assets',
    CANVAS_DRAWER_ASSET_EXTRACT_DEFAULT
  )
}

function normalizeCanvasWorkbenchStoryboardGenTplId() {
  normalizeCanvasWorkbenchTplBySubcategory(
    canvasWorkbenchStoryboardGenPromptTemplateId,
    'generate-storyboard',
    CANVAS_DRAWER_STORYBOARD_GEN_DEFAULT
  )
}

function applyCanvasWorkbenchFromSnapshot(snapshot: Record<string, unknown> | undefined) {
  const wb = snapshot?.canvasWorkbench as Record<string, unknown> | undefined
  const charRaw = wb?.characterAssetPromptTemplateId
  const sceneRaw = wb?.sceneAssetPromptTemplateId
  const propsRaw = wb?.propsAssetPromptTemplateId
  const sbRaw = wb?.storyboardImagePromptTemplateId
  const vidRaw = wb?.videoPromptTemplateId
  const assetExtractRaw = wb?.assetExtractPromptTemplateId
  const storyboardGenRaw = wb?.storyboardGenPromptTemplateId
  const storyboardGridRaw = wb?.storyboardGridFormat
  canvasWorkbenchCharacterAssetPromptTemplateId.value =
    typeof charRaw === 'string' && charRaw.trim() !== ''
      ? charRaw.trim()
      : CANVAS_DRAWER_CHAR_DEFAULT
  canvasWorkbenchSceneAssetPromptTemplateId.value =
    typeof sceneRaw === 'string' && sceneRaw.trim() !== ''
      ? sceneRaw.trim()
      : CANVAS_DRAWER_SCENE_DEFAULT
  canvasWorkbenchPropsAssetPromptTemplateId.value =
    typeof propsRaw === 'string' && propsRaw.trim() !== ''
      ? propsRaw.trim()
      : CANVAS_DRAWER_PROPS_DEFAULT
  canvasWorkbenchStoryboardImagePromptId.value =
    typeof sbRaw === 'string' && sbRaw.trim() !== '' ? sbRaw.trim() : CANVAS_DRAWER_SB_DEFAULT
  canvasWorkbenchVideoPromptTemplateId.value =
    typeof vidRaw === 'string' && vidRaw.trim() !== '' ? vidRaw.trim() : CANVAS_DRAWER_VID_DEFAULT
  canvasWorkbenchAssetExtractPromptTemplateId.value =
    typeof assetExtractRaw === 'string' && assetExtractRaw.trim() !== ''
      ? assetExtractRaw.trim()
      : CANVAS_DRAWER_ASSET_EXTRACT_DEFAULT
  canvasWorkbenchStoryboardGenPromptTemplateId.value =
    typeof storyboardGenRaw === 'string' && storyboardGenRaw.trim() !== ''
      ? storyboardGenRaw.trim()
      : CANVAS_DRAWER_STORYBOARD_GEN_DEFAULT
  canvasWorkbenchStoryboardGridFormat.value =
    typeof storyboardGridRaw === 'string' && storyboardGridRaw.trim() !== ''
      ? storyboardGridRaw.trim()
      : CANVAS_DRAWER_STORYBOARD_GRID_DEFAULT
  normalizeCanvasWorkbenchCharacterAssetTplId()
  normalizeCanvasWorkbenchSceneAssetTplId()
  normalizeCanvasWorkbenchPropsAssetTplId()
  normalizeCanvasWorkbenchStoryboardTplId()
  normalizeCanvasWorkbenchVideoTplId()
  normalizeCanvasWorkbenchAssetExtractTplId()
  normalizeCanvasWorkbenchStoryboardGenTplId()
}

function buildCanvasWorkbenchSnapshotPayload() {
  return {
    characterAssetPromptTemplateId: canvasWorkbenchCharacterAssetPromptTemplateId.value,
    sceneAssetPromptTemplateId: canvasWorkbenchSceneAssetPromptTemplateId.value,
    propsAssetPromptTemplateId: canvasWorkbenchPropsAssetPromptTemplateId.value,
    storyboardImagePromptTemplateId: canvasWorkbenchStoryboardImagePromptId.value,
    videoPromptTemplateId: canvasWorkbenchVideoPromptTemplateId.value,
    assetExtractPromptTemplateId: canvasWorkbenchAssetExtractPromptTemplateId.value,
    storyboardGenPromptTemplateId: canvasWorkbenchStoryboardGenPromptTemplateId.value,
    storyboardGridFormat: canvasWorkbenchStoryboardGridFormat.value
  }
}

/** 节点数超过此阈值时不再为连线开启动画，减轻多节点下的 GPU/CSS 压力 */
const EDGE_ANIM_MAX_NODES = 20

function shouldAnimateCanvasEdges() {
  return canvasPerformance.shouldAnimateEdges.value
}

watch(
  () => nodes.value.length,
  () => canvasPerformance.checkNodeCount()
)

const canvasLodLevel = computed<CanvasLodLevel>(() =>
  canvasPerformance.shouldUseShellMode.value ? 'shell' : 'full'
)

const canvasViewportZoomRef = computed(() => viewport.value.zoom)

provide(canvasLodLevelKey, canvasLodLevel)
provide(canvasViewportZoomKey, canvasViewportZoomRef)
provide('canvasCharacterAssetPromptTemplateId', canvasWorkbenchCharacterAssetPromptTemplateId)
provide('canvasSceneAssetPromptTemplateId', canvasWorkbenchSceneAssetPromptTemplateId)
provide('canvasPropsAssetPromptTemplateId', canvasWorkbenchPropsAssetPromptTemplateId)
provide('canvasStoryboardImageTemplateId', canvasWorkbenchStoryboardImagePromptId)
provide('canvasVideoPromptTemplateId', canvasWorkbenchVideoPromptTemplateId)
provide('canvasAssetExtractPromptTemplateId', canvasWorkbenchAssetExtractPromptTemplateId)
provide('canvasStoryboardGenPromptTemplateId', canvasWorkbenchStoryboardGenPromptTemplateId)
provide('canvasStoryboardGridFormat', canvasWorkbenchStoryboardGridFormat)

const defaultEdgeOptions = computed(() => ({
  animated: false,
  type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
  style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor),
  pathOptions: {
    endCaps: false
  }
}))

/** 拖拽连线预览：与「直线/曲线/直角阶梯/平滑阶梯」设置一致 */
const connectionLineType = computed(
  () => {
    switch (userStore.edgeStyle) {
      case 'straight': return ConnectionLineType.Straight
      case 'smooth': return ConnectionLineType.Bezier
      case 'step': return ConnectionLineType.Step
      case 'smoothstep': return ConnectionLineType.SmoothStep
    }
  }
)

let edgeStyleSyncRafId: number | null = null
let pendingEdgeStyleSync = false

function applyCanvasSettingsToAllEdgesNow() {
  const t = vueFlowEdgeTypeForSetting(userStore.edgeStyle)
  const s = canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
  const anim = shouldAnimateCanvasEdges()
  let changed = false
  const nextEdges = edges.value.map((e) => {
    if (e.type === t && e.animated === anim && e.style === s) return e
    changed = true
    return { ...e, type: t, style: s, animated: anim }
  })
  if (changed) edges.value = nextEdges
}

function scheduleApplyCanvasSettingsToAllEdges() {
  if (isCanvasDragging.value) {
    pendingEdgeStyleSync = true
    return
  }
  if (edgeStyleSyncRafId !== null) {
    window.cancelAnimationFrame(edgeStyleSyncRafId)
  }
  edgeStyleSyncRafId = window.requestAnimationFrame(() => {
    edgeStyleSyncRafId = null
    applyCanvasSettingsToAllEdgesNow()
  })
}

const snapToGrid = ref(true)
const showMiniMap = ref(false)

/**
 * 小地图尺寸：节点多时用更小 SVG 减少像素与 transform 重算；仅 CanvasEditor 一处渲染 MiniMap（避免与工具栏内重复双实例）
 */
const miniMapLayout = computed(() => {
  const n = nodes.value.length
  if (n > 50) return { width: 132, height: 84 }
  if (n > 24) return { width: 152, height: 98 }
  return { width: 172, height: 110 }
})

/**
 * 拖拽节点、框选多节点移动时暂时卸载 MiniMap（v-if），避免与主视口同帧双份「全图 rect」更新。
 * 未在视口平移/滚轮缩放时卸载，以免 d3 zoom 的 move 事件过密导致小地图闪烁。
 */
const miniMapSuspendNodeDrag = ref(false)
const miniMapSuspendSelection = ref(false)
const isCanvasDragging = ref(false)

const showMiniMapActive = computed(
  () =>
    showMiniMap.value && !miniMapSuspendNodeDrag.value && !miniMapSuspendSelection.value
)

onSelectionDragStart(() => {
  miniMapSuspendSelection.value = true
  isCanvasDragging.value = true
})
onSelectionDragStop(() => {
  miniMapSuspendSelection.value = false
  isCanvasDragging.value = false
  if (pendingPruneOrphansAfterDrag) {
    pendingPruneOrphansAfterDrag = false
    void nextTick(() => {
      pruneOrphanedAssetDetailLinkedEntriesInTotals(nodes)
    })
  }
  if (pendingEdgeStyleSync) {
    pendingEdgeStyleSync = false
    scheduleApplyCanvasSettingsToAllEdges()
  }
  if (pendingAutoSaveWhileDragging) {
    pendingAutoSaveWhileDragging = false
    triggerAutoSave()
  }
})

const nodeTypes: Record<string, any> = {
  canvasNode: markRaw(CanvasNode),
  group: markRaw(GroupNode),
  imageCanvas: markRaw(ImageCanvasNode),
  upscaleCanvas: markRaw(UpscaleCanvasNode),
  storyboardGen: markRaw(StoryboardGenCanvasNode),
  videoCanvas: markRaw(VideoCanvasNode),
  imageSplitResult: markRaw(ImageSplitResultNode),
  vr360: markRaw(VR360CanvasNode),
  viewport3d: markRaw(Viewport3DCanvasNode),
  textProcess: markRaw(TextProcessCanvasNode),
  freeDrawCanvas: markRaw(FreeDrawCanvasNode),
  textChapterResult: markRaw(TextChapterResultCanvasNode),
  textAssetResult: markRaw(TextAssetResultCanvasNode),
  textAssetDetail: markRaw(TextAssetDetailCanvasNode),
  assetExtractTemplate: markRaw(AssetExtractTemplateNode),
  storyboardTemplate: markRaw(StoryboardTemplateNode)
}

const showSaveDialog = ref(false)
const snapshotName = ref('')
const showHistoryDialog = ref(false)
const showShortcutsDialog = ref(false)
const showSettingsDialog = ref(false)
const showWorkflowTemplateDialog = ref(false)
const settingsDialogDefaultTab = ref<'profile' | 'storage' | 'api' | 'model' | 'interface' | 'about'>('storage')
const snapshotList = ref<any[]>([])

function openCanvasSettings() {
  settingsDialogDefaultTab.value = 'storage'
  showSettingsDialog.value = true
}

interface Shortcut {
  key: string
  description: string
  category: 'catEdit' | 'catGroup' | 'catSelect' | 'catView'
}

const shortcutCategories: Shortcut['category'][] = ['catEdit', 'catGroup', 'catSelect', 'catView']

const shortcutsList = computed<Shortcut[]>(() => [
    { key: t('canvas.shortcutsMeta.keyDel'), description: t('canvas.shortcuts.delNodes'), category: 'catEdit' },
    { key: t('canvas.shortcutsMeta.keyCtrlZ'), description: t('canvas.shortcuts.undo'), category: 'catEdit' },
    { key: t('canvas.shortcutsMeta.keyCtrlShiftZ'), description: t('canvas.shortcuts.redo'), category: 'catEdit' },
    { key: t('canvas.shortcutsMeta.keyCtrlG'), description: t('canvas.shortcuts.createGroup'), category: 'catGroup' },
    { key: t('canvas.shortcutsMeta.keyCtrlShiftG'), description: t('canvas.shortcuts.ungroup'), category: 'catGroup' },
    { key: t('canvas.shortcutsMeta.keyCtrlClick'), description: t('canvas.shortcuts.multiSelect'), category: 'catSelect' },
    { key: t('canvas.shortcutsMeta.keyDelAlt'), description: t('canvas.shortcuts.delNodes2'), category: 'catSelect' },
    { key: t('canvas.shortcutsMeta.keyCtrlDrag'), description: t('canvas.shortcuts.boxSelect'), category: 'catSelect' },
    { key: t('canvas.shortcutsMeta.keyWheel'), description: t('canvas.shortcuts.wheelZoom'), category: 'catView' },
    { key: t('canvas.shortcutsMeta.keyCtrlWheel'), description: t('canvas.shortcuts.ctrlWheelPan'), category: 'catView' },
  ])

const showImageViewer = ref(false)
const currentImageUrl = ref<string | null>(null)
const imageList = ref<string[]>([])
const currentImageIndex = ref(0)

// 风格选择相关
const showStylePopover = ref(false)
const showAddStyleDialog = ref(false)
const newStyle = ref({
  value: '',
  label: '',
  image: '',
  description: ''
})

// 右键菜单相关
const showStyleContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const rightClickedStyle = ref<any>(null)

const handleSelectStyle = (styleValue: string) => {
  artStyleStore.setSelectedStyle(styleValue)
  showStylePopover.value = false
  ElMessage.success(t('canvas.style.selectedStyle', { name: artStyleStore.selectedStyleLabel }))
}

function normalizeArtStyleKey(v: string) {
  return String(v ?? '').trim().toLowerCase().replace(/\s+/g, '-')
}

function isUserCustomStyle(style: { value: string }) {
  const key = normalizeArtStyleKey(style.value)
  return artStyleStore.customStyles.some((s) => normalizeArtStyleKey(String(s.value)) === key)
}

const handleStyleRightClick = (style: { value: string }, event: MouseEvent) => {
  event.stopPropagation()
  if (!isUserCustomStyle(style)) return
  event.preventDefault()
  rightClickedStyle.value = style
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  showStyleContextMenu.value = true
}

const handleDeleteCustomStyle = (explicit?: { value: string; label: string }) => {
  const style = explicit ?? rightClickedStyle.value
  if (!style) return
  const styleLabel = style.label
  const success = artStyleStore.removeStyle(style.value)
  if (success) {
    ElMessage.success(t('canvas.style.deletedStyle', { name: styleLabel }))
    if (normalizeArtStyleKey(artStyleStore.selectedStyle) === normalizeArtStyleKey(style.value)) {
      artStyleStore.setSelectedStyle('none')
    }
  }
  showStyleContextMenu.value = false
  rightClickedStyle.value = null
}

const confirmDeleteCustomStyle = async (style: { value: string; label: string }) => {
  try {
    await ElMessageBox.confirm(
      t('canvas.style.deleteConfirm', { label: style.label }),
      t('canvas.style.deleteTitle'),
      {
        confirmButtonText: t('canvas.style.deleteBtn'),
        cancelButtonText: t('canvas.dialogs.cancel'),
        type: 'warning'
      }
    )
    handleDeleteCustomStyle(style)
  } catch {
    /* 取消 */
  }
}

const closeContextMenu = () => {
  showStyleContextMenu.value = false
  rightClickedStyle.value = null
}

const handleAddStyle = () => {
  if (!newStyle.value.value || !newStyle.value.label) {
    ElMessage.warning(t('canvas.style.warnFillFields'))
    return
  }
  const success = artStyleStore.addStyle({
    value: newStyle.value.value.toLowerCase().replace(/\s+/g, '-'),
    label: newStyle.value.label,
    description: newStyle.value.description
  })
  if (success) {
    ElMessage.success(t('canvas.style.addSuccess'))
    showAddStyleDialog.value = false
    newStyle.value = {
      value: '',
      label: '',
      image: '',
      description: ''
    }
  } else {
    ElMessage.warning(t('canvas.style.duplicateStyle'))
  }
}

const openImageViewer = (imageUrl: string, images?: string[]) => {
  currentImageUrl.value = imageUrl
  if (images) {
    imageList.value = images
    currentImageIndex.value = images.indexOf(imageUrl)
  } else {
    imageList.value = [imageUrl]
    currentImageIndex.value = 0
  }
  showImageViewer.value = true
}

provide('openCanvasImageViewer', openImageViewer)

/** 子组件（如图片节点内删除）在撤销栈中记录一次后删除节点与连线 */
const removeNodeById = (nodeId: string) => {
  if (!nodes.value.some((n) => n.id === nodeId)) {
    return
  }
  pushStateBeforeChange()
  nodes.value = nodes.value.filter((n) => n.id !== nodeId)
  edges.value = edges.value.filter((e) => e.source !== nodeId && e.target !== nodeId)
  addMessage(t('canvas.toast.nodeRemoved'), 'success')
}
provide('removeCanvasNodeById', removeNodeById)
provide('canvasPushStateBeforeChange', pushStateBeforeChange)

/** 画布节点将 AI 生成的媒体落盘到当前画布项目目录时需项目 id / 名称 */
provide('canvasProjectContext', {
  projectId,
  projectName,
  projectType: computed(() => projectStore.currentProject?.type || 'canvas')
} as { projectId: Ref<string>; projectName: Ref<string>; projectType: Ref<'creative' | 'canvas'> })

const freeDrawReferenceImageProviders = new Map<string, () => Promise<string | null> | string | null>()
const freeDrawReferenceImageRequestMap = {
  get: (nodeId: string) => freeDrawReferenceImageProviders.get(nodeId) ?? null,
  has: (nodeId: string) => freeDrawReferenceImageProviders.has(nodeId)
}
function registerFreeDrawReferenceImageProvider(nodeId: string, provider: () => Promise<string | null> | string | null) {
  freeDrawReferenceImageProviders.set(nodeId, provider)
}
function unregisterFreeDrawReferenceImageProvider(nodeId: string) {
  freeDrawReferenceImageProviders.delete(nodeId)
}
async function requestFreeDrawReferenceImage(nodeId: string): Promise<string | null> {
  const provider = freeDrawReferenceImageProviders.get(nodeId)
  if (!provider) return null
  try {
    const result = await provider()
    return result && String(result).trim() ? String(result) : null
  } catch {
    return null
  }
}
provide('registerFreeDrawReferenceImageProvider', registerFreeDrawReferenceImageProvider)
provide('unregisterFreeDrawReferenceImageProvider', unregisterFreeDrawReferenceImageProvider)
provide('freeDrawReferenceImageRequestMap', freeDrawReferenceImageRequestMap)
provide('requestFreeDrawReferenceImage', requestFreeDrawReferenceImage)

const handleImagePrev = () => {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--
    currentImageUrl.value = imageList.value[currentImageIndex.value]
  }
}

const handleImageNext = () => {
  if (currentImageIndex.value < imageList.value.length - 1) {
    currentImageIndex.value++
    currentImageUrl.value = imageList.value[currentImageIndex.value]
  }
}

const saveSnapshot = async () => {
    if (!window.electronAPI?.canvasSaveSnapshot) {
      addMessage(t('canvas.toast.saveUnavailable'), 'error')
      return
    }

    const viewport = getViewport()
    const snapshot = {
      nodes: cloneGraphStateForSnapshot(nodes.value),
      edges: cloneGraphStateForSnapshot(edges.value),
      viewport: {
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom
      },
      canvasWorkbench: buildCanvasWorkbenchSnapshotPayload(),
      savedAt: new Date().toISOString()
    }

    const result = await window.electronAPI.canvasSaveSnapshot(projectId.value, projectName.value, snapshot)
    if (result.success) {
      addMessage(t('canvas.toast.snapshotSaved'), 'success')
    } else {
      addMessage(t('canvas.toast.saveFailedPrefix') + result.message, 'error')
    }
  }

// 防抖保存，避免频繁操作
const debouncedSaveSnapshot = useDebounceFn(saveSnapshot, 980)

const loadSnapshot = async () => {
  if (!window.electronAPI?.canvasLoadSnapshot) {
    return
  }

  const result = await window.electronAPI.canvasLoadSnapshot(projectId.value, projectName.value)
  if (result.success && result.snapshot) {
    const snapshot = result.snapshot as Record<string, unknown>
    nodes.value = migrateLegacyNodes((snapshot.nodes as any[]) || [])
    const edgeT = vueFlowEdgeTypeForSetting(userStore.edgeStyle)
    const s = canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
    edges.value = ((snapshot.edges as Edge[]) || []).map((e: Edge) => ({ ...e, type: edgeT, style: s }))

    if (snapshot.viewport) {
      const vp = snapshot.viewport as { x: number; y: number; zoom: number }
      setViewport({ x: vp.x, y: vp.y, zoom: vp.zoom })
    }

    applyCanvasWorkbenchFromSnapshot(snapshot)

    addMessage(t('canvas.toast.restoreLastOk'), 'success')
  } else {
    applyCanvasWorkbenchFromSnapshot(undefined)
  }
}

const saveNamedSnapshot = async () => {
    if (!snapshotName.value.trim()) {
      addMessage(t('canvas.toast.enterSnapshotName'), 'warning')
      return
    }

    if (!window.electronAPI?.canvasSaveNamedSnapshot) {
      addMessage(t('canvas.toast.saveUnavailable'), 'error')
      return
    }

    const viewport = getViewport()
    const snapshotId = `snapshot_${Date.now()}`
    const snapshot = {
      id: snapshotId,
      name: snapshotName.value,
      nodes: cloneGraphStateForSnapshot(nodes.value),
      edges: cloneGraphStateForSnapshot(edges.value),
      viewport: {
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom
      },
      canvasWorkbench: buildCanvasWorkbenchSnapshotPayload(),
      savedAt: new Date().toISOString()
    }

    const result = await window.electronAPI.canvasSaveNamedSnapshot(projectId.value, projectName.value, snapshotId, snapshot)
    if (result.success) {
      addMessage(t('canvas.toast.snapshotSaved'), 'success')
      showSaveDialog.value = false
      snapshotName.value = ''
      loadSnapshotList()
    } else {
      addMessage(t('canvas.toast.saveFailedPrefix') + result.message, 'error')
    }
  }

const loadSnapshotList = async () => {
  if (!window.electronAPI?.canvasListSnapshots) {
    return
  }

  const result = await window.electronAPI.canvasListSnapshots(projectId.value, projectName.value)
  if (result.success) {
    snapshotList.value = result.snapshots || []
  }
}

const restoreNamedSnapshot = async (snapshotId: string) => {
  if (!window.electronAPI?.canvasLoadNamedSnapshot) {
    addMessage(t('canvas.toast.restoreUnavailable'), 'error')
    return
  }

  const result = await window.electronAPI.canvasLoadNamedSnapshot(projectId.value, projectName.value, snapshotId)
  if (result.success && result.snapshot) {
    const snapshot = result.snapshot as Record<string, unknown>
    nodes.value = migrateLegacyNodes((snapshot.nodes as any[]) || [])
    const edgeT = vueFlowEdgeTypeForSetting(userStore.edgeStyle)
    const s = canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
    edges.value = ((snapshot.edges as Edge[]) || []).map((e: Edge) => ({ ...e, type: edgeT, style: s }))

    if (snapshot.viewport) {
      const vp = snapshot.viewport as { x: number; y: number; zoom: number }
      setViewport({ x: vp.x, y: vp.y, zoom: vp.zoom })
    }

    applyCanvasWorkbenchFromSnapshot(snapshot)

    showHistoryDialog.value = false
    addMessage(t('canvas.toast.namedRestoredOk'), 'success')
  } else {
    addMessage(t('canvas.toast.restoreFailedPrefix') + result.message, 'error')
  }
}

const handleGoBack = async () => {
  try {
    await saveSnapshot()
  } catch (e) {
    console.error('保存快照失败:', e)
  }
  projectStore.setCurrentProject(null)
  router.push('/canvas-projects')
}

function handleLoadWorkflowTemplate(template: WorkflowTemplate) {
  pushStateBeforeChange()
  
  // 计算当前视口中心
  const currentViewport = getViewport()
  const centerX = window.innerWidth / 2 / currentViewport.zoom - currentViewport.x / currentViewport.zoom
  const centerY = window.innerHeight / 2 / currentViewport.zoom - currentViewport.y / currentViewport.zoom
  
  // 计算模板节点的中心点
  if (template.nodes.length === 0) return
  
  const minX = Math.min(...template.nodes.map(n => n.position.x))
  const maxX = Math.max(...template.nodes.map(n => n.position.x + (n.width || 220)))
  const minY = Math.min(...template.nodes.map(n => n.position.y))
  const maxY = Math.max(...template.nodes.map(n => n.position.y + (n.height || 160)))
  
  const templateCenterX = (minX + maxX) / 2
  const templateCenterY = (minY + maxY) / 2
  
  // 计算偏移量
  const offsetX = centerX - templateCenterX
  const offsetY = centerY - templateCenterY
  
  // 生成新的节点 ID 映射
  const nodeIdMap = new Map<string, string>()
  template.nodes.forEach(n => {
    nodeIdMap.set(n.id, `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  })
  
  // 添加节点
  const newNodes = template.nodes.map(n => ({
    ...n,
    id: nodeIdMap.get(n.id) || n.id,
    position: {
      x: n.position.x + offsetX,
      y: n.position.y + offsetY
    }
  }))
  
  addNodes(newNodes)
  
  // 添加边
  const newEdges = template.edges.map(e => ({
    ...e,
    id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    source: nodeIdMap.get(e.source) || e.source,
    target: nodeIdMap.get(e.target) || e.target
  }))
  
  addEdges(newEdges)
  
  addMessage('工作流模板加载成功', 'success')
}

const selectedNodeData = useNodesData(['start-1'])

const getNodeInfo = (nodeId: string) => {
  const nodeData = useNodesData(nodeId)
  return nodeData
}

const getImageNodeConnections = () => {
  const { connections: imageSourceConnections, findNodeConnections } = useNodeConnections({
    handleType: 'source',
    nodeId: 'image-1'
  })
  return {
    sourceConnections: imageSourceConnections,
    findNodeConnections
  }
}

const addImageNode = () => {
  pushStateBeforeChange()
  const newId = `image-${Date.now()}`
  addNodes({
    id: newId,
    type: 'imageCanvas',
    position: { x: 300, y: 200 },
    data: buildNewImageCanvasNodeData()
  })
  const edgeType = vueFlowEdgeTypeForSetting(userStore.edgeStyle)
  addEdges({
    id: `e-${newId}`,
    source: nodes.value[nodes.value.length - 1].id,
    target: newId,
    animated: shouldAnimateCanvasEdges(),
    type: edgeType,
    style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
  })
}

const addVideoNode = () => {
  pushStateBeforeChange()
  const newId = `video-${Date.now()}`
  addNodes({
    id: newId,
    type: 'videoCanvas',
    position: { x: 300, y: 200 },
    data: buildNewVideoCanvasNodeData()
  })
  const edgeType = vueFlowEdgeTypeForSetting(userStore.edgeStyle)
  addEdges({
    id: `e-${newId}`,
    source: nodes.value[nodes.value.length - 1].id,
    target: newId,
    animated: shouldAnimateCanvasEdges(),
    type: edgeType,
    style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
  })
}

const addStoryboardGenNode = () => {
  pushStateBeforeChange()
  const newId = `storyboard-${Date.now()}`
  addNodes({
    id: newId,
    type: 'storyboardGen',
    position: { x: 300, y: 200 },
    data: buildNewStoryboardGenNodeData()
  })
  const edgeType = vueFlowEdgeTypeForSetting(userStore.edgeStyle)
  addEdges({
    id: `e-${newId}`,
    source: nodes.value[nodes.value.length - 1].id,
    target: newId,
    animated: shouldAnimateCanvasEdges(),
    type: edgeType,
    style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
  })
}

const addTextNode = () => {
  pushStateBeforeChange()
  const newId = `text-${Date.now()}`
  addNodes({
    id: newId,
    type: 'textProcess',
    position: { x: 300, y: 200 },
    data: buildNewTextProcessNodeData()
  })
  const edgeType = vueFlowEdgeTypeForSetting(userStore.edgeStyle)
  addEdges({
    id: `e-${newId}`,
    source: nodes.value[nodes.value.length - 1].id,
    target: newId,
    animated: shouldAnimateCanvasEdges(),
    type: edgeType,
    style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
  })
}

const clearCanvas = () => {
  pushStateBeforeChange()
  nodes.value = []
  edges.value = []
}

function syncTextAssetDetailConnectionToTotal(params: { source: string; target: string }) {
  const a = findNode(params.source)
  const b = findNode(params.target)
  if (!a || !b) return

  let totalId: string | null = null
  let detailId: string | null = null

  if (a.type === 'textAssetResult' && b.type === 'textAssetDetail') {
    totalId = a.id
    detailId = b.id
  } else if (a.type === 'textAssetDetail' && b.type === 'textAssetResult') {
    totalId = b.id
    detailId = a.id
  }
  if (!totalId || !detailId) return

  const detailNode = findNode(detailId)
  const totalNode = findNode(totalId)
  if (!detailNode || !totalNode || detailNode.type !== 'textAssetDetail' || totalNode.type !== 'textAssetResult') {
    return
  }

  const d = detailNode.data as Record<string, unknown>
  const cat = inferAssetCategoryFromDetailData(d)
  if (!cat) return

  const prevGrouped = baselineGroupedAssetsFromTotalData(totalNode.data as { groupedAssets?: TextGroupedAssetsInput; assets?: unknown })
  const { groupedAssets, assets } = mergeTextAssetDetailIntoTotal(
    prevGrouped,
    detailId,
    cat,
    String(d.assetName ?? ''),
    String(d.assetDescription ?? '')
  )
  patchTextAssetResultNodeInNodesList(nodes, totalId, groupedAssets, assets)
}

onConnect((params) => {
  pushStateBeforeChange()
  const edgeType = vueFlowEdgeTypeForSetting(userStore.edgeStyle)
  addEdges([
    {
      ...params,
      animated: shouldAnimateCanvasEdges(),
      type: edgeType,
      style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
    }
  ])

  void nextTick(() => {
    syncTextAssetDetailConnectionToTotal(params)
    triggerAutoSave()
  })
})

/** 边列表变化时补跑同步（含从快照恢复后仅有边、未触发 connect 的情况）；合并幂等 */
watch(
  () => edges.value.map((e) => `${e.id ?? ''}:${e.source}:${e.target}`).join('|'),
  () => {
    void nextTick(() => {
      for (const e of edges.value) {
        syncTextAssetDetailConnectionToTotal({ source: e.source, target: e.target })
      }
    })
  }
)

/** 拖拽开始只记录坐标，避免 dragStart 时全图 JSON 克隆导致卡顿 */
const nodeDragStartPositions = ref<Map<string, { x: number; y: number }> | null>(null)

onNodeDragStart(() => {
  miniMapSuspendNodeDrag.value = true
  isCanvasDragging.value = true
  nodeDragStartPositions.value = new Map(
    unref(getNodes).map((n) => [n.id, { x: n.position.x, y: n.position.y }])
  )
})

onNodeDragStop(() => {
  miniMapSuspendNodeDrag.value = false
  isCanvasDragging.value = false
  const startMap = nodeDragStartPositions.value
  nodeDragStartPositions.value = null
  if (pendingPruneOrphansAfterDrag) {
    pendingPruneOrphansAfterDrag = false
    void nextTick(() => {
      pruneOrphanedAssetDetailLinkedEntriesInTotals(nodes)
    })
  }
  if (pendingEdgeStyleSync) {
    pendingEdgeStyleSync = false
    scheduleApplyCanvasSettingsToAllEdges()
  }
  if (pendingAutoSaveWhileDragging) {
    pendingAutoSaveWhileDragging = false
    triggerAutoSave()
  }
  if (!startMap || startMap.size === 0) return

  const current = unref(getNodes)
  const moved = current.some((n) => {
    const s = startMap.get(n.id)
    return !s || s.x !== n.position.x || s.y !== n.position.y
  })
  if (!moved) return

  const preNodes = cloneGraphStateForSnapshot(nodes.value) as any[]
  for (const n of preNodes) {
    const s = startMap.get(n.id)
    if (s) n.position = { ...s }
  }
  pushUndoSnapshot(
    {
      nodes: preNodes,
      edges: cloneGraphStateForSnapshot(edges.value)
    },
    { skipDeepClone: true }
  )
  triggerAutoSave()
})

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

const getAutoSaveDelay = () => {
  return Math.max(30000, userStore.autoSaveInterval * 1000)
}

const triggerAutoSave = () => {
  if (isCanvasDragging.value) {
    pendingAutoSaveWhileDragging = true
    return
  }
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
  autoSaveTimer = setTimeout(() => {
    debouncedSaveSnapshot()
  }, getAutoSaveDelay())
}

/** 子节点在仅改 data 时可调用，避免再对整图做 deep 监听 */
function scheduleCanvasAutoSave() {
  triggerAutoSave()
}
provide('scheduleCanvasAutoSave', scheduleCanvasAutoSave)

watch(
  [
    canvasWorkbenchCharacterAssetPromptTemplateId,
    canvasWorkbenchSceneAssetPromptTemplateId,
    canvasWorkbenchPropsAssetPromptTemplateId,
    canvasWorkbenchStoryboardImagePromptId,
    canvasWorkbenchVideoPromptTemplateId
  ],
  () => {
    triggerAutoSave()
  }
)

watch(
  () => [userStore.edgeStyle, userStore.edgeStrokeWidth, userStore.edgeColor] as const,
  () => {
    scheduleApplyCanvasSettingsToAllEdges()
  }
)

/**
 * 仅监听节点/边条数，避免 deep 跟踪全图（拖拽时 position 高频变更会极卡）。
 * 仅改节点 data、条数不变时由 scheduleCanvasAutoSave 或定时节流兜底。
 */
watch(
  () => [nodes.value.length, edges.value.length] as const,
  () => {
    if (isCanvasDragging.value) return
    triggerAutoSave()
  }
)

/** 节点增删时同步已有边的 type/style/animated（含跨动画阈值） */
watch(
  () => nodes.value.length,
  () => {
    if (isCanvasDragging.value) {
      pendingEdgeStyleSync = true
      return
    }
    if (edges.value.length === 0) return
    scheduleApplyCanvasSettingsToAllEdges()
  }
)

let autoSaveIntervalId: ReturnType<typeof setInterval> | null = null
let pendingAutoSaveWhileDragging = false

const startAutoSaveInterval = () => {
  if (autoSaveIntervalId) {
    clearInterval(autoSaveIntervalId)
    autoSaveIntervalId = null
  }
  const intervalMs = Math.max(30000, userStore.autoSaveInterval * 1000)
  autoSaveIntervalId = setInterval(() => {
    triggerAutoSave()
  }, intervalMs)
}

onMounted(async () => {
  pushState()
  const project = projectStore.projects.find(p => p.id === projectId.value)
  if (project) {
    projectStore.setCurrentProject(project)
    projectName.value = project.name
    await loadSnapshot()
    await nextTick()
    scheduleApplyCanvasSettingsToAllEdges()
    zoomTo(1)
  } else {
    addMessage(t('canvas.toast.projectMissing'), 'error')
    router.push('/canvas-projects')
  }
  setupKeyboardShortcuts()
  startAutoSaveInterval()
})

watch(() => userStore.autoSaveInterval, () => {
  startAutoSaveInterval()
})

onUnmounted(async () => {
  // 卸载前先保存一次，确保数据不丢失
  try {
    await saveSnapshot()
  } catch (e) {
    console.error('卸载时保存快照失败:', e)
  }
  
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
  if (autoSaveIntervalId) {
    clearInterval(autoSaveIntervalId)
    autoSaveIntervalId = null
  }
})
</script>

<template>
  <div class="canvas-editor-container">
    <div class="canvas-header">
      <div class="canvas-header-back-frost">
        <el-button :icon="ArrowLeft" text @click="handleGoBack" class="header-button header-button-back">
          {{ t('canvas.header.back') }}
        </el-button>
      </div>
      <div class="header-title-section">
        <h2 class="editor-title">
          {{ t('canvas.header.editorTitle') }} - {{ projectStore.currentProject?.name }}
        </h2>
        <div class="style-selector">
          <el-popover
            v-model:visible="showStylePopover"
            placement="bottom"
            :width="275"
            trigger="click"
            popper-class="style-prompt-popover"
          >
            <div class="prompt-panel">
              <div class="prompt-group extract-grid">
                <button
                  v-for="style in artStyleStore.artStyles"
                  :key="style.value"
                  type="button"
                  class="prompt-btn"
                  :class="{ active: artStyleStore.selectedStyle === style.value }"
                  @click="handleSelectStyle(style.value)"
                  @contextmenu.prevent="handleStyleRightClick(style, $event)"
                >
                  <span class="prompt-btn-icon" :class="isUserCustomStyle(style) ? 'icon-custom' : 'icon-official'">
                    {{ isUserCustomStyle(style) ? '自' : '官' }}
                  </span>
                  <span class="prompt-btn-text">{{ artStyleListLabel(style) }}</span>
                  <button
                    v-if="isUserCustomStyle(style)"
                    type="button"
                    class="prompt-btn-delete nodrag nopan"
                    :title="t('canvas.style.deleteCustom')"
                    :aria-label="t('canvas.style.deleteCustom')"
                    @click.stop.prevent="confirmDeleteCustomStyle(style)"
                  >
                    <el-icon><Delete /></el-icon>
                  </button>
                </button>
              </div>
            </div>
            <div class="add-style-section">
              <el-button :icon="Plus" type="primary" text @click="showAddStyleDialog = true">
                {{ t('canvas.header.addCustomStyle') }}
              </el-button>
            </div>
            <template #reference>
              <div class="style-trigger">
                <el-icon><Brush /></el-icon>
                <span>{{ artStyleStore.selectedStyleLabel }}</span>
                <el-icon class="arrow-icon"><ArrowDown /></el-icon>
              </div>
            </template>
          </el-popover>
        </div>
      </div>
      <div class="header-actions">
      <div class="canvas-header-back-frost">
        <el-button text class="header-button" @click="canvasParamDrawerVisible = !canvasParamDrawerVisible">
          <el-icon><Operation /></el-icon>
          <span>{{ t('canvas.header.paramSettings') }}</span>
        </el-button>
      </div>
      <el-dropdown>
        <div class="canvas-header-back-frost">
          <el-button text class="header-button">
            {{ t('canvas.header.moreActions') }}
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
        </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :icon="Edit" @click="showSaveDialog = true">{{ t('canvas.header.saveSnapshot') }}</el-dropdown-item>
              <el-dropdown-item :icon="Clock" @click="loadSnapshotList(); showHistoryDialog = true">{{ t('canvas.header.historySnapshots') }}</el-dropdown-item>
              <el-dropdown-item :icon="Setting" @click="openCanvasSettings">{{ t('canvas.header.settings') }}</el-dropdown-item>
              <el-dropdown-item :icon="FolderOpened" @click="showWorkflowTemplateDialog = true">工作流模板</el-dropdown-item>
              <el-dropdown-item :icon="Key" @click="showShortcutsDialog = true">{{ t('canvas.header.shortcuts') }}</el-dropdown-item>
              <el-dropdown-item :icon="Delete" @click="clearCanvas">{{ t('canvas.header.clearCanvas') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    <div class="canvas-flow" @wheel.capture="handleCanvasFlowWheel">
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        :node-types="nodeTypes"
        :default-edge-options="defaultEdgeOptions"
        :connection-line-type="connectionLineType"
        :elevate-nodes-on-select="false"
        :elevate-edges-on-select="false"
        :snap-to-grid="snapToGrid"
        :snap-grid="[16, 16]"
        :zoom-on-double-click="false"
        :min-zoom="0.2"
        :max-zoom="4"
        :only-render-visible-elements="false"
        :pan-on-drag="true"
        :pan-on-scroll="false"
        :zoom-on-scroll="false"
        :selection-key-code="'Control'"
        :delete-key-code="null"
        :multi-selection-key-code="'Control'"
        :fit-view-on-init="false"
        class="vue-flow-container"
        @pane-click="handleFlowPaneClick"
        @pane-context-menu="handleFlowPaneContextMenu"
        @node-click="handleFlowNodeClick"
        @edge-click="handleFlowEdgeClick"
      >
        <Background
          :bg-color="'var(--canvas-flow-bg)'"
          :pattern-color="'var(--canvas-flow-dot)'"
          :gap="16"
        />
        <CanvasControls v-model:snap-to-grid="snapToGrid" v-model:show-mini-map="showMiniMap" />
        
        <!--
          MiniMap 仅在别处渲染此一处；pannable/zoomable 关闭以省 d3 zoom 在拖拽/滚轮时与主画布叠加重算；
          细描边+直角遮罩+较小 offset 减轻 path/SVG 开销；node-color 用字符串避免每节点再包一层函数
        -->
        <MiniMap
          v-if="showMiniMapActive"
          class="canvas-editor-minimap"
          :width="miniMapLayout.width"
          :height="miniMapLayout.height"
          :pannable="false"
          :zoomable="false"
          :node-stroke-width="1"
          node-color="rgba(64, 158, 255, 0.55)"
          node-stroke-color="rgba(20, 30, 50, 0.4)"
          :node-border-radius="2"
          :mask-color="'rgba(0, 0, 0, 0.38)'"
          :mask-stroke-width="0"
          :mask-border-radius="0"
          :offset-scale="2"
        />
      </VueFlow>
      <!-- 固定在视口中央：勿放在 VueFlow 内，否则会随 pan/zoom 漂移 -->
      <div
        v-if="nodes.length === 0"
        class="empty-canvas-hint"
        aria-hidden="true"
      >
        <div class="hint-text">
          {{ t('canvas.emptyHint') }}
        </div>
      </div>

      <!-- 性能警告 -->
      <div
        v-if="canvasPerformance.warnings.length > 0"
        class="performance-warnings"
      >
        <div
          v-for="warning in canvasPerformance.warnings"
          :key="warning.type"
          class="performance-warning"
          :class="`warning-level-${warning.level}`"
        >
          <span class="warning-icon">⚠️</span>
          <span class="warning-text">{{ warning.message }}</span>
        </div>
      </div>

      <!-- FPS 显示 (可选，开发时显示) -->
      <div
        v-if="true"
        class="fps-indicator"
      >
        <span class="fps-value">{{ canvasPerformance.fps }} FPS</span>
        <span class="node-count">{{ nodeCount }} 节点</span>
      </div>
    </div>

    <el-dialog v-model="showSaveDialog" :title="t('canvas.dialogs.namedSnapshotTitle')" width="400px">
      <el-input v-model="snapshotName" :placeholder="t('canvas.dialogs.snapshotNamePlaceholder')" />
      <template #footer>
        <el-button @click="showSaveDialog = false">{{ t('canvas.dialogs.cancel') }}</el-button>
        <el-button type="primary" @click="saveNamedSnapshot">{{ t('canvas.dialogs.save') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showHistoryDialog" :title="t('canvas.dialogs.historyTitle')" width="600px">
      <el-table v-if="snapshotList.length > 0" :data="snapshotList" style="width: 100%">
        <el-table-column prop="name" :label="t('canvas.dialogs.colName')" width="200" />
        <el-table-column prop="savedAt" :label="t('canvas.dialogs.colSavedAt')" width="200">
          <template #default="{ row }">
            {{ new Date(row.savedAt).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column :label="t('canvas.dialogs.colAction')">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="restoreNamedSnapshot(row.id)">{{ t('canvas.dialogs.restore') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else :description="t('canvas.dialogs.emptyHistory')" />
      <template #footer>
        <el-button @click="showHistoryDialog = false">{{ t('canvas.dialogs.close') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showShortcutsDialog" :title="t('canvas.dialogs.shortcutsTitle')" width="500px">
      <div class="shortcuts-container">
        <div v-for="category in shortcutCategories" :key="category" class="shortcut-category">
          <h4 class="shortcut-category-title">{{ t(`canvas.shortcuts.${category}`) }}</h4>
          <div v-for="shortcut in shortcutsList.filter(s => s.category === category)" :key="shortcut.key" class="shortcut-item">
            <span class="shortcut-key">{{ shortcut.key }}</span>
            <span class="shortcut-desc">{{ shortcut.description }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showShortcutsDialog = false">{{ t('canvas.dialogs.close') }}</el-button>
      </template>
    </el-dialog>

    <SettingsDialog
      v-model="showSettingsDialog"
      :default-tab="settingsDialogDefaultTab"
    />

    <WorkflowTemplateManager
      v-model:visible="showWorkflowTemplateDialog"
      @load-template="handleLoadWorkflowTemplate"
    />

    <ImageViewer
      v-model:visible="showImageViewer"
      :image-url="currentImageUrl"
      :image-list="imageList"
      :current-index="currentImageIndex"
      @prev="handleImagePrev"
      @next="handleImageNext"
    />

    <el-dialog v-model="showAddStyleDialog" :title="t('canvas.dialogs.addStyleTitle')" width="450px">
      <el-form label-position="top">
        <el-form-item :label="t('canvas.dialogs.styleIdLabel')">
          <el-input v-model="newStyle.value" :placeholder="t('canvas.dialogs.styleIdPh')" />
        </el-form-item>
        <el-form-item :label="t('canvas.dialogs.styleNameLabel')">
          <el-input v-model="newStyle.label" :placeholder="t('canvas.dialogs.styleNamePh')" />
        </el-form-item>
        <el-form-item :label="t('canvas.dialogs.styleDescLabel')">
          <el-input v-model="newStyle.description" type="textarea" :rows="3" :placeholder="t('canvas.dialogs.styleDescPh')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddStyleDialog = false">{{ t('canvas.dialogs.cancel') }}</el-button>
        <el-button type="primary" @click="handleAddStyle">{{ t('canvas.dialogs.add') }}</el-button>
      </template>
    </el-dialog>

    <!-- 自定义风格右键菜单 -->
    <div
      v-if="showStyleContextMenu"
      class="style-context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
      @click.stop
    >
      <div
        class="context-menu-item danger"
        @click="rightClickedStyle && confirmDeleteCustomStyle(rightClickedStyle)"
      >
        <span class="menu-icon">🗑️</span>
        <span>{{ t('canvas.style.deleteCustom') }}</span>
      </div>
    </div>

    <!-- 右键菜单遮罩层 -->
    <div
      v-if="showStyleContextMenu"
      class="context-menu-overlay"
      @click="closeContextMenu"
    ></div>

    <!-- 双击添加节点菜单 -->
    <div 
      v-if="showNodeMenu" 
      class="node-menu"
      :style="{ left: nodeMenuPosition.x + 'px', top: nodeMenuPosition.y + 'px' }"
      @click.stop
    >
      <div class="menu-header">{{ t('canvas.menus.addNodesHeader') }}</div>
      <div class="menu-item" @click="addNodeAtPosition('text')">
        <el-icon class="menu-type-icon menu-type-icon--text"><Document /></el-icon>
        <div class="menu-item-body">
          <span class="menu-item-title">{{ t('canvas.menus.textTitle') }}</span>
          <span class="menu-item-hint">{{ t('canvas.menus.textHint') }}</span>
        </div>
      </div>

      <div class="menu-item" @click="addNodeAtPosition('freeDraw')">
        <el-icon class="menu-type-icon menu-type-icon--freeDraw"><EditPen /></el-icon>
        <div class="menu-item-body">
          <span class="menu-item-title">{{ t('canvas.menus.freeDrawTitle') }}</span>
          <span class="menu-item-hint">{{ t('canvas.menus.freeDrawHint') }}</span>
        </div>
      </div>

      <div class="menu-item" @click="addNodeAtPosition('image')">
        <el-icon class="menu-type-icon menu-type-icon--image"><Picture /></el-icon>
        <div class="menu-item-body">
          <span class="menu-item-title">{{ t('canvas.menus.imageTitle') }}</span>
          <span class="menu-item-hint">{{ t('canvas.menus.imageHint') }}</span>
        </div>
      </div>
      <div class="menu-item" @click="addNodeAtPosition('vr360')">
        <el-icon class="menu-type-icon menu-type-icon--vr360"><VideoCamera /></el-icon>
        <div class="menu-item-body">
          <span class="menu-item-title">{{ t('canvas.menus.vrTitle') }}</span>
          <span class="menu-item-hint">{{ t('canvas.menus.vrHint') }}</span>
        </div>
      </div>
      <div class="menu-item" @click="addNodeAtPosition('viewport3d')">
        <el-icon class="menu-type-icon menu-type-icon--viewport3d"><Box /></el-icon>
        <div class="menu-item-body">
          <span class="menu-item-title">{{ t('canvas.menus.view3dTitle') }}</span>
          <span class="menu-item-hint">{{ t('canvas.menus.view3dHint') }}</span>
        </div>
      </div>
      <div class="menu-item" @click="addNodeAtPosition('video')">
        <el-icon class="menu-type-icon menu-type-icon--video"><VideoPlay /></el-icon>
        <div class="menu-item-body">
          <span class="menu-item-title">{{ t('canvas.menus.videoTitle') }}</span>
          <span class="menu-item-hint">{{ t('canvas.menus.videoHint') }}</span>
        </div>
      </div>
      <div class="menu-item" @click="addNodeAtPosition('storyboardGen')">
        <el-icon class="menu-type-icon menu-type-icon--storyboard"><Grid /></el-icon>
        <div class="menu-item-body">
          <span class="menu-item-title">{{ t('canvas.menus.sbTitle') }}</span>
          <span class="menu-item-hint">{{ t('canvas.menus.sbHint') }}</span>
        </div>
      </div>
      <div class="menu-item" @click="addNodeAtPosition('audio')">
        <el-icon class="menu-type-icon menu-type-icon--audio"><Microphone /></el-icon>
        <div class="menu-item-body">
          <span class="menu-item-title">{{ t('canvas.menus.audioTitle') }}</span>
          <span class="menu-item-hint">{{ t('canvas.menus.audioHint') }}</span>
        </div>
      </div>
      <div class="menu-item" @click="addNodeAtPosition('upscale')">
        <el-icon class="menu-type-icon menu-type-icon--upscale"><MagicStick /></el-icon>
        <div class="menu-item-body">
          <span class="menu-item-title">{{ t('canvas.menus.upscaleTitle') || '图片超分辨率' }}</span>
          <span class="menu-item-hint">{{ t('canvas.menus.upscaleHint') || 'AI 放大图片' }}</span>
        </div>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" @click="addNodeAtPosition('group')">
        <el-icon class="menu-type-icon menu-type-icon--group"><FolderOpened /></el-icon>
        <div class="menu-item-body">
          <span class="menu-item-title">{{ t('canvas.menus.emptyGroupTitle') }}</span>
        </div>
      </div>
    </div>

    <!-- 画布右键：组合节点（资产详情 + 图片，与资产提取链路一致） -->
    <div
      v-if="showAssetComboMenu"
      class="node-menu asset-combo-menu"
      :style="{ left: assetComboMenuPosition.x + 'px', top: assetComboMenuPosition.y + 'px' }"
      @click.stop
    >
      <div class="menu-header">
        {{ t('canvas.menus.comboHeader') }}
      </div>
      <div class="menu-item" @click="addAssetComboAtCursor('character')">
        <el-icon class="menu-type-icon menu-type-icon--text"><MenuUserIcon /></el-icon>
        <div class="menu-item-body">
          <span class="menu-item-title">{{ t('canvas.menus.charComboTitle') }}</span>
          <span class="menu-item-hint">{{ t('canvas.menus.charComboHint') }}</span>
        </div>
      </div>
      <div class="menu-item" @click="addAssetComboAtCursor('scene')">
        <el-icon class="menu-type-icon menu-type-icon--image"><OfficeBuilding /></el-icon>
        <div class="menu-item-body">
          <span class="menu-item-title">{{ t('canvas.menus.sceneComboTitle') }}</span>
          <span class="menu-item-hint">{{ t('canvas.menus.sceneComboHint') }}</span>
        </div>
      </div>
      <div class="menu-item" @click="addAssetComboAtCursor('prop')">
        <el-icon class="menu-type-icon menu-type-icon--video"><Goods /></el-icon>
        <div class="menu-item-body">
          <span class="menu-item-title">{{ t('canvas.menus.propComboTitle') }}</span>
          <span class="menu-item-hint">{{ t('canvas.menus.propComboHint') }}</span>
        </div>
      </div>
    </div>

    <div
      v-if="edgeDeleteMenuVisible"
      class="edge-delete-menu"
      :style="{ left: `${edgeDeleteMenuPosition.x}px`, top: `${edgeDeleteMenuPosition.y}px` }"
      @click.stop
    >
      <button type="button" class="edge-delete-btn" @click="handleDeleteEdgeFromMenu">
        <el-icon><Delete /></el-icon>
      </button>
    </div>

    <!-- 消息区域 -->
    <div class="messages-container">
      <div v-for="message in messages" :key="message.id" :class="['message-item', message.type]">
        {{ message.text }}
      </div>
    </div>

    <!-- 点击其他地方关闭菜单 -->
    <div 
      v-if="showNodeMenu || showAssetComboMenu" 
      class="menu-overlay"
      @click="handleMenuClose"
    ></div>
    <div
      v-if="edgeDeleteMenuVisible"
      class="menu-overlay"
      @click="hideEdgeDeleteMenu"
    ></div>

    <CanvasWorkbenchParamDrawer
        v-model:visible="canvasParamDrawerVisible"
        v-model:character-asset-template-id="canvasWorkbenchCharacterAssetPromptTemplateId"
        v-model:scene-asset-template-id="canvasWorkbenchSceneAssetPromptTemplateId"
        v-model:props-asset-template-id="canvasWorkbenchPropsAssetPromptTemplateId"
        v-model:storyboard-template-id="canvasWorkbenchStoryboardImagePromptId"
        v-model:video-template-id="canvasWorkbenchVideoPromptTemplateId"
        v-model:asset-extract-template-id="canvasWorkbenchAssetExtractPromptTemplateId"
        v-model:storyboard-gen-template-id="canvasWorkbenchStoryboardGenPromptTemplateId"
        v-model:storyboard-grid-format="canvasWorkbenchStoryboardGridFormat"
      />
  </div>
</template>

<style scoped>
.canvas-editor-container {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: var(--canvas-flow-bg, var(--bg-color));
}

.canvas-header-back-frost {
  background: #141010;
    border: 1px solid rgb(255 255 255 / 38%);
    border-radius: 8px;
}

.header-button-back {
  border-radius: 8px;
}

.canvas-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 5px 20px;
  background: transparent;
  z-index: 10;
  pointer-events: none;
}

.header-title-section {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 16px;
  pointer-events: none;
}

.editor-title {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
  pointer-events: none;
}

.header-button {
  color: #fff !important;
  pointer-events: auto;
}

.header-button .el-icon {
  color: #fff !important;
}

.header-button:hover {
  background-color: rgba(255, 255, 255, 0.15) !important;
}

.style-selector {
  display: flex;
  align-items: center;
  pointer-events: auto;
}

.header-actions > * {
  pointer-events: auto;
}

.style-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  color: #fff;
  background-color: rgba(255, 255, 255, 0.1);
  transition: all 0.3s;
  font-size: 13px;
}

.style-trigger:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.style-trigger .arrow-icon {
  font-size: 12px;
  transition: transform 0.3s;
}

.style-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 12px;
  max-height: 360px;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-right: 8px;
}

.style-grid::-webkit-scrollbar {
  display: none;
}

.style-item {
  position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 8px;
}

.style-item-delete {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 4;
  width: 26px;
  height: 26px;
  padding: 0;
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.95);
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: background 0.15s ease, color 0.15s ease;
}

.style-item-delete:hover {
  background: rgba(245, 108, 108, 0.92);
  color: #fff;
}

.style-item-delete .el-icon {
  font-size: 15px;
}

.style-item:hover {
  background-color: #5e5e5e;
}

.style-item.active {
  border-color: #409eff;
  background-color: #ecf5ff;
}

.style-image {
  width: 100%;
  height: 100px;
  object-fit: cover;
  border-radius: 6px;
  margin-bottom: 6px;
}

.style-label {
  font-size: 12px;
  color: #333;
  text-align: center;
  font-weight: 500;
}

.add-style-section {
  display: flex;
  justify-content: center;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;
}

.prompt-btn-delete {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.08);
  transition: all 0.15s ease;
}

.prompt-btn-delete:hover {
  background: rgba(245, 108, 108, 0.8);
  color: #fff;
}

.prompt-btn-delete .el-icon {
  font-size: 13px;
}

.style-context-menu {
  position: fixed;
  z-index: 9999;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 160px;
  overflow: hidden;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s ease;
  font-size: 13px;
  color: #e0e4ee;
}

.context-menu-item:hover {
  background-color: rgba(64, 158, 255, 0.12);
}

.context-menu-item.danger {
  color: #f56c6c;
}

.context-menu-item.danger:hover {
  background-color: rgba(245, 108, 108, 0.12);
}

.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9998;
}

.canvas-flow {
  position: relative;
  width: 100%;
  height: 100%;
}

.vue-flow-container {
  width: 100%;
  height: 100%;
}

/* 与 Comfy 系接近的暗色工作区 + 拖拽时 GPU 合成，减少抖动 */
.vue-flow-container :deep(.vue-flow__viewport) {
  background: var(--canvas-flow-bg);
}

.vue-flow-container :deep(.vue-flow__node.dragging) {
  will-change: transform;
  contain: layout style;
}

.vue-flow-container :deep(.vue-flow__edge-path) {
  vector-effect: non-scaling-stroke;
}

/* 小地图：单实例 + 小尺寸 SVG；contain 隔离合成，降低与主视口同帧竞争 */
.vue-flow-container :deep(.canvas-editor-minimap) {
  contain: paint;
  border-radius: 8px;
  background: rgb(0, 0, 0);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.28);
  opacity: 0.92;
  max-width: 100%;
  bottom: 45px !important;
}

.vue-flow-container :deep(.canvas-editor-minimap svg) {
  display: block;
}

/* 空画布提示：覆盖在 flow 区域之上，不拦截双击（pointer-events: none） */
.empty-canvas-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  user-select: none;
  z-index: 10;
}

.hint-text {
  font-size: 20px;
  color: rgba(200, 206, 222, 0.92);
  font-weight: bold;
  letter-spacing: 2px;
  text-align: center;
}

/* 节点菜单样式 */
.node-menu {
  position: fixed;
  z-index: 1000;
  background: #1e1e2e;
  border: 1px solid #3a3a4c;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  min-width: 260px;
  max-width: min(420px, 92vw);
  overflow: hidden;
}

.menu-header {
  padding: 10px 16px;
  background: #2d2d44;
  color: #a0a0c0;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.menu-item {
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #e0e0e0;
  cursor: pointer;
  transition: all 0.2s;
}

.menu-item:hover {
  background: #3a3a4c;
}

.menu-type-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.menu-item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.menu-item-title {
  font-size: 14px;
  font-weight: 500;
  color: #e8e8ef;
  line-height: 1.3;
  flex-shrink: 0;
}

.menu-item-hint {
  font-size: 11px;
  line-height: 1.35;
  color: rgba(160, 165, 188, 0.82);
  text-align: right;
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.menu-type-icon--text {
  color: #b37feb;
}



.menu-type-icon--freeDraw {
  color: #4da3ff;
}

.menu-type-icon--image {
  color: #409eff;
}

.menu-type-icon--vr360 {
  color: #5b8def;
}

.menu-type-icon--viewport3d {
  color: #67c23a;
}

.menu-type-icon--video {
  color: #e6a23c;
}

.menu-type-icon--storyboard {
  color: #7c6cf0;
}

.menu-type-icon--audio {
  color: #36cfc9;
}

.menu-type-icon--upscale {
  color: #9c27b0;
}

.menu-type-icon--group {
  color: #8ab4f8;
}

.menu-divider {
  height: 1px;
  background: #3a3a4c;
  margin: 4px 0;
}

.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}

.edge-delete-menu {
  position: fixed;
  z-index: 1001;
  transform: translate(-50%, -50%);
}

.edge-delete-btn {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 1px solid rgba(255, 85, 85, 0.95);
  background: #f23b3b;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
  box-shadow: 0 8px 16px rgba(242, 59, 59, 0.35);
  transition: transform 0.12s ease, box-shadow 0.15s ease, background 0.15s ease;
}

.edge-delete-btn:hover {
  transform: scale(1.06);
  background: #ff4a4a;
  box-shadow: 0 10px 18px rgba(242, 59, 59, 0.45);
}

/* 消息区域 */
.messages-container {
  position: absolute;
  bottom: 20px;
  right: 220px; /* 在FPS左侧 */
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
  pointer-events: none;
}

.message-item {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  border-radius: 8px;
  background: rgba(22, 24, 40, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  animation: slideUp 0.3s ease-out;
}

.message-item.success {
  color: #67c23a;
  border-left: 3px solid #67c23a;
}

.message-item.warning {
  color: #e6a23c;
  border-left: 3px solid #e6a23c;
}

.message-item.error {
  color: #f56c6c;
  border-left: 3px solid #f56c6c;
}

.message-item.info {
  color: #409eff;
  border-left: 3px solid #409eff;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.shortcuts-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.shortcut-category {
  background: rgba(40, 40, 60, 0.5);
  border-radius: 8px;
  padding: 12px 16px;
}

.shortcut-category-title {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #409eff;
  border-bottom: 1px solid rgba(64, 158, 255, 0.3);
  padding-bottom: 8px;
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
}

.shortcut-key {
  background: rgba(64, 158, 255, 0.2);
  color: #409eff;
  padding: 3px 10px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  border: 1px solid rgba(64, 158, 255, 0.3);
}

.shortcut-desc {
  color: #e0e0e0;
}

/* 性能警告 */
.performance-warnings {
  position: absolute;
  bottom: 20px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
  pointer-events: none;
}

.performance-warning {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid;
}

.warning-level-warning {
  background: rgba(255, 170, 0, 0.15);
  border-color: rgba(255, 170, 0, 0.4);
  color: #ffaa00;
}

.warning-level-info {
  background: rgba(64, 158, 255, 0.15);
  border-color: rgba(64, 158, 255, 0.4);
  color: #409eff;
}

.warning-icon {
  font-size: 14px;
}

/* FPS 指示器 */
.fps-indicator {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  border-radius: 8px;
  background: rgba(22, 24, 40, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  z-index: 10;
  pointer-events: none;
}

.fps-value {
  font-weight: 600;
  min-width: 60px;
}

.node-count {
  color: rgba(255, 255, 255, 0.5);
}
</style>

<style>
/* 画面风格弹出框样式 - 全局样式，因为 popover 挂载到 body */
.style-prompt-popover .prompt-group.extract-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.style-prompt-popover .prompt-group.extract-grid .prompt-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(248, 250, 255, 0.9);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
  min-height: auto;
}

.style-prompt-popover .prompt-group.extract-grid .prompt-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.style-prompt-popover .prompt-group.extract-grid .prompt-btn.active {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.5);
  color: rgba(96, 165, 250, 1);
}

.style-prompt-popover .prompt-group.extract-grid .prompt-btn-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.style-prompt-popover .prompt-group.extract-grid .prompt-btn-icon.icon-official {
  background: rgba(59, 130, 246, 0.2);
  color: rgba(96, 165, 250, 1);
}

.style-prompt-popover .prompt-group.extract-grid .prompt-btn-icon.icon-custom {
  background: rgba(168, 85, 247, 0.2);
  color: rgba(192, 132, 252, 1);
}

.style-prompt-popover .prompt-group.extract-grid .prompt-btn-text {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
</style>
