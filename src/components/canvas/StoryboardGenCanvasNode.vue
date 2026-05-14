<script setup lang="ts">
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { computed, inject, onBeforeUnmount, onMounted, ref, withDefaults, type Component, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Minus,
  Plus,
  Upload,
  Promotion,
  Operation,
  Picture,
  VideoPlay,
  Document,
  Microphone,
  Grid
} from '@element-plus/icons-vue'
import { useApiConfigStore, type ApiModelGroup } from '@/stores/apiConfigStore'
import { usePromptsStore } from '@/stores/promptsStore'
import { useArtStyleStore } from '@/stores/artStyleStore'
import { useUserStore } from '@/stores/userStore'
import { buildArtStylePromptPrefix } from '@/utils/artStylePrompt'
import { persistCanvasGeneratedImage } from '@/utils/canvasMediaPersist'
import { vueFlowEdgeTypeForSetting } from '@/utils/canvasEdgeType'
import { canvasEdgeStyleFromWidth } from '@/utils/canvasEdgeStyle'
import { getModelPlatformBadge } from '@/utils/modelPlatformBadge'
import { apiService } from '@/services/apiService'
import {
  computePadGridForShotCount,
  generateStoryboardGridDataUrl,
  inferShotsFromStoryboardText
} from '@/utils/storyboardGridReference'
import { buildImageModelGenerateOptions } from '@/utils/imageModelGenerateOptions'
import { useCanvasLodLevel } from '@/composables/useCanvasLodLevel'
import { useCanvasNodeCommon } from '@/composables/useCanvasNodeUiI18n'

interface StoryboardFrameItem {
  id: string
  description: string
}

interface AssetItem {
  id: string
  name: string
  description: string
  imageUrl?: string | null
  category?: AssetCategory
}

interface GroupedAssets {
  character?: AssetItem[]
  scene?: AssetItem[]
  prop?: AssetItem[]
}

interface TextAssetResultNodeData {
  label?: string
  assets?: AssetItem[]
  groupedAssets?: GroupedAssets
}

export interface StoryboardGenNodeData {
  label: string
  type: string
  status?: 'pending' | 'running' | 'completed' | 'error'
  description?: string
  toolbarExpanded?: boolean
  gridRows?: number
  gridCols?: number
  gridFormat?: 'single' | '4grid' | '6grid' | '9grid' | '16grid' | '25grid'
  frames?: StoryboardFrameItem[]
  storyboardPrompt?: string
  /** 遗留：画布工坊已改用全局模板注入；仅在缺少注入时作为回退读取 */
  selectedStoryboardImagePromptId?: string
  referenceImages?: string[]
  generatedImageUrl?: string | null
  imageQuality?: '1K' | '2K' | '4K'
  aspectRatio?: string
  imageModelGroup?: 'youshang' | 'flow2'
  imageModel?: string
  /** 分镜顺序号（文本节点生成分镜时写入，与创梦工坊 #1 #2 一致） */
  storyboardSequence?: number
  /** 分镜标题文案（如「教室初醒」），与 storyboardSequence 组合展示 */
  storyboardTitle?: string
}

interface Props {
  id: string
  selected?: boolean
  data: StoryboardGenNodeData
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
})

const { updateNodeData: rawUpdateNodeData, addNodes, addEdges, findNode, edges, getNodes } = useVueFlow()
const apiStore = useApiConfigStore()
const promptsStore = usePromptsStore()
const artStyleStore = useArtStyleStore()
const userStore = useUserStore()
const { t, apiGroupLabelMap, notChosenModel, modelGroupFallback } = useCanvasNodeCommon()
const lodLevel = useCanvasLodLevel()
const lodIsShell = computed(() => lodLevel.value === 'shell')

const DEFAULT_SB_IMG_PROMPT_ID = '8'

const canvasWorkbenchSbTplIdRef = inject<Ref<string> | undefined>(
  'canvasStoryboardImageTemplateId',
  undefined
)
const canvasWorkbenchStoryboardGridFormatRef = inject<Ref<string> | undefined>(
  'canvasStoryboardGridFormat',
  undefined
)

function resolveCanvasStoryboardImageTemplate(): string {
  const fromWorkbench = canvasWorkbenchSbTplIdRef?.value?.trim?.()
  const fromNode = props.data.selectedStoryboardImagePromptId?.trim?.()
  const id =
    (fromWorkbench && fromWorkbench.length > 0 ? fromWorkbench : '') ||
    (fromNode && fromNode.length > 0 ? fromNode : '') ||
    DEFAULT_SB_IMG_PROMPT_ID
  const content = promptsStore.getPromptContentById(id)
  if (content && content.trim()) return content.trim()
  return promptsStore.getPromptContentById(DEFAULT_SB_IMG_PROMPT_ID).trim()
}
const pushStateBeforeChange = inject<(() => void) | undefined>('canvasPushStateBeforeChange', undefined)
const scheduleCanvasAutoSave = inject<(() => void) | undefined>('scheduleCanvasAutoSave', undefined)

function updateNodeData(nodeId: string, data: Partial<StoryboardGenNodeData>) {
  rawUpdateNodeData(nodeId, data)
  scheduleCanvasAutoSave?.()
}
const canvasProjectContext = inject<{ projectId: Ref<string>; projectName: Ref<string> } | null>(
  'canvasProjectContext',
  null
)

async function persistStoryboardOutputImage(url: string): Promise<string> {
  const ctx = canvasProjectContext
  if (!ctx) return url
  const pid = ctx.projectId.value
  const pname = String(ctx.projectName.value ?? '').trim()
  if (!pid || !pname) return url
  return persistCanvasGeneratedImage(pid, pname, props.id, url)
}

function getGridConfig(format: string): { rows: number; cols: number } {
  switch (format) {
    case 'single':
      return { rows: 1, cols: 1 }
    case '4grid':
      return { rows: 2, cols: 2 }
    case '6grid':
      return { rows: 2, cols: 3 }
    case '9grid':
      return { rows: 3, cols: 3 }
    case '16grid':
      return { rows: 4, cols: 4 }
    case '25grid':
      return { rows: 5, cols: 5 }
    default:
      return { rows: 2, cols: 2 }
  }
}

const gridFormat = computed({
  get: () => props.data.gridFormat ?? canvasWorkbenchStoryboardGridFormatRef?.value ?? '4grid',
  set: (v: 'single' | '4grid' | '6grid' | '9grid' | '16grid' | '25grid') => {
    const config = getGridConfig(v)
    updateNodeData(props.id, { gridFormat: v, gridRows: config.rows, gridCols: config.cols })
  }
})

const rows = computed(() => getGridConfig(gridFormat.value).rows)
const cols = computed(() => getGridConfig(gridFormat.value).cols)
const totalFrames = computed(() => rows.value * cols.value)
const MAX_STORYBOARD_PROMPT_CHARS = 20000
const frameGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${cols.value}, minmax(0, 1fr))`,
  gridTemplateRows: `repeat(${rows.value}, minmax(0, 1fr))`,
  minHeight: `${Math.max(220, rows.value * 64)}px`
}))

const frames = computed<StoryboardFrameItem[]>(() => {
  const current = Array.isArray(props.data.frames) ? props.data.frames : []
  const next: StoryboardFrameItem[] = []
  for (let i = 0; i < totalFrames.value; i += 1) {
    const existing = current[i]
    next.push({
      id: existing?.id ?? `frame-${i + 1}`,
      description: existing?.description ?? ''
    })
  }
  return next
})
const totalPromptChars = computed(() =>
  frames.value.reduce((sum, frame) => sum + String(frame.description ?? '').length, 0)
)

const storyboardPrompt = computed({
  get: () => props.data.storyboardPrompt ?? '',
  set: (v: string) => updateNodeData(props.id, { storyboardPrompt: v })
})

const referenceImages = computed(() => props.data.referenceImages ?? [])
const toolbarPromptPlaceholder = computed(() =>
  t('canvas.nodeUi.common.toolbarPromptPlaceholder')
)
const qaPopoverVisible = ref(false)
const modelPopoverVisible = ref(false)
const gridFormatPopoverVisible = ref(false)
const panelModelGroup = ref<StoryboardGenNodeData['imageModelGroup'] | null>(null)

const gridFormatOptions = computed(() => [
  { value: 'single', label: t('editorWorkshop.step2.grid1') },
  { value: '4grid', label: t('editorWorkshop.step2.grid4') },
  { value: '6grid', label: t('editorWorkshop.step2.grid6') },
  { value: '9grid', label: t('editorWorkshop.step2.grid9') },
  { value: '16grid', label: t('editorWorkshop.step2.grid16') },
  { value: '25grid', label: t('editorWorkshop.step2.grid25') }
])

const currentGridFormatLabel = computed(() => {
  const option = gridFormatOptions.value.find(o => o.value === gridFormat.value)
  return option?.label || ''
})
const toolbarExpanded = computed({
  get: () => props.data.toolbarExpanded ?? false,
  set: (v: boolean) => updateNodeData(props.id, { toolbarExpanded: v })
})
const imageQuality = computed({
  get: () => props.data.imageQuality ?? '1K',
  set: (v: '1K' | '2K' | '4K') => updateNodeData(props.id, { imageQuality: v })
})
const aspectRatio = computed({
  get: () => props.data.aspectRatio ?? '16:9',
  set: (v: string) => updateNodeData(props.id, { aspectRatio: v })
})
const qualityAspectSummary = computed(() => `${aspectRatio.value} · ${imageQuality.value}`)

const mergedModelOptions = computed(() => {
  const m = apiGroupLabelMap.value
  const groups: {
    value: 'youshang' | 'flow2'
    label: string
    models: typeof apiStore.imageModels
  }[] = [
    { value: 'youshang', label: m.youshang, models: apiStore.imageModels },
    { value: 'flow2', label: m.flow2, models: apiStore.flow2ImageModels as typeof apiStore.imageModels }
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

const statusColor = computed(() => {
  switch (props.data.status) {
    case 'running': return '#409eff'
    case 'completed': return '#67c23a'
    case 'error': return '#f56c6c'
    default: return '#909399'
  }
})

const generating = computed(() => props.data.status === 'running')

function ensureDefaults() {
  const patch: Partial<StoryboardGenNodeData> = {}
  const defaultGridFormat = canvasWorkbenchStoryboardGridFormatRef?.value ?? '4grid'
  const defaultGridConfig = getGridConfig(defaultGridFormat)
  
  if (props.data.toolbarExpanded === undefined) patch.toolbarExpanded = false
  if (!props.data.gridFormat) {
    patch.gridFormat = defaultGridFormat
    patch.gridRows = defaultGridConfig.rows
    patch.gridCols = defaultGridConfig.cols
  } else if (!props.data.gridRows || !props.data.gridCols) {
    const config = getGridConfig(props.data.gridFormat)
    patch.gridRows = config.rows
    patch.gridCols = config.cols
  }
  if (!Array.isArray(props.data.frames)) patch.frames = frames.value
  if (!props.data.storyboardPrompt) patch.storyboardPrompt = ''
  if (!props.data.referenceImages) patch.referenceImages = []
  if (props.data.generatedImageUrl === undefined) patch.generatedImageUrl = null
  if (!props.data.imageQuality) patch.imageQuality = '1K'
  if (!props.data.aspectRatio) patch.aspectRatio = '16:9'
  if (!props.data.imageModelGroup) patch.imageModelGroup = apiStore.imageModelGroup as StoryboardGenNodeData['imageModelGroup']
  if (!props.data.imageModel) patch.imageModel = apiStore.imageModel

  if (Object.keys(patch).length > 0) updateNodeData(props.id, patch)
}

onMounted(() => {
  ensureDefaults()
})

onBeforeUnmount(() => {
  clearMentionHideTimer()
})

function onNodeMainClick() {
  toolbarExpanded.value = true
}

function updateFrames(nextFrames: StoryboardFrameItem[]) {
  updateNodeData(props.id, { frames: nextFrames })
}

function applyGrid(nextRows: number, nextCols: number) {
  const r = Math.max(1, Math.min(6, nextRows))
  const c = Math.max(1, Math.min(6, nextCols))
  const count = r * c
  const current = frames.value
  const next: StoryboardFrameItem[] = []
  for (let i = 0; i < count; i += 1) {
    const existing = current[i]
    next.push({
      id: existing?.id ?? `frame-${Date.now()}-${i}`,
      description: existing?.description ?? ''
    })
  }
  updateNodeData(props.id, { gridRows: r, gridCols: c, frames: next })
}

function normalizeFrameDescriptionByTotalLimit(index: number, value: string) {
  const nextValue = String(value ?? '')
  const otherChars = frames.value.reduce((sum, frame, frameIndex) => {
    if (frameIndex === index) return sum
    return sum + String(frame.description ?? '').length
  }, 0)
  const allow = Math.max(0, MAX_STORYBOARD_PROMPT_CHARS - otherChars)
  return nextValue.length > allow ? nextValue.slice(0, allow) : nextValue
}

function updateFrameDescription(index: number, value: string) {
  const normalized = normalizeFrameDescriptionByTotalLimit(index, value)
  const next = [...frames.value]
  next[index] = { ...next[index], description: normalized }
  updateFrames(next)
  return normalized
}

function onModelPopoverShow() {
  const fallback = (props.data.imageModelGroup || apiStore.imageModelGroup || 'youshang') as StoryboardGenNodeData['imageModelGroup']
  panelModelGroup.value = fallback
}

function selectModelGroup(group: StoryboardGenNodeData['imageModelGroup']) {
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
  const group = activePanelGroup.value as StoryboardGenNodeData['imageModelGroup']
  updateNodeData(props.id, {
    imageModelGroup: group,
    imageModel: modelId
  })
  modelPopoverVisible.value = false
}

/**
 * 单格时禁止使用「1x1」字样——多模态模型常将其理解为 1:1 方形出图，覆盖 generationConfig 的 16:9 等设置。
 * 多格用「行/列」中文，避免「2x3」与分辨率写法混淆。
 */
function storyboardIntroLine(introRows: number, introCols: number) {
  const r = Math.max(1, introRows)
  const c = Math.max(1, introCols)
  if (r === 1 && c === 1) {
    return '请生成一张单格分镜整图（一整幅画面），保持角色与场景风格一致。画面宽高比须与参考线框图一致，勿自行裁成方形。'
  }
  return `请生成一张共 ${r} 行 ${c} 列宫格的分镜图，每格与正文 Grid 序号一一对应，保持角色与场景风格一致。整体宽高比须与参考线框图一致。`
}

/**
 * @param overrideIntroGrid 当单格内写出「Grid1…GridN」时，用推断出的行列表覆盖首行，与线框垫图一致
 */
function buildStoryboardDescription(overrideIntroGrid?: { rows: number; cols: number }) {
  const extra = storyboardPrompt.value.trim()

  if (userStore.enableCinemaStoryboard) {
    const frameText = frames.value
      .map((f, i) => ({ idx: i + 1, text: f.description.trim() }))
      .filter(item => item.text.length > 0)
      .map(item => `Scene${item.idx}：${item.text}`)
      .join('\n')
    return [frameText, extra].filter(Boolean).join('\n')
  }

  const r = overrideIntroGrid?.rows ?? rows.value
  const c = overrideIntroGrid?.cols ?? cols.value
  const intro = storyboardIntroLine(r, c)
  const frameText = frames.value
    .map((f, i) => ({ idx: i + 1, text: f.description.trim() }))
    .filter(item => item.text.length > 0)
    .map(item => `Grid${item.idx}：${item.text}`)
    .join('\n')
  return [intro, frameText, extra].filter(Boolean).join('\n')
}

/**
 * 与 `Step2Page` 分镜出图拼接顺序一致：模板 → 【画面风格】→ 【分镜提示词内容】→ 正文。
 * 原先把风格放在最前、其后才是 id=8 的长模板，多模态模型易跟模板走、弱化「画面风格」。
 */
function composeCanvasStoryboardImagePrompt(description: string): string {
  const template = resolveCanvasStoryboardImageTemplate()
  const styleBlock = buildArtStylePromptPrefix(artStyleStore.artStyles, artStyleStore.selectedStyle)
  const desc = description.trim()
  if (!template) {
    if (!styleBlock) return desc
    return `${styleBlock}【分镜提示词内容】\n${desc}`
  }
  if (template.includes('{description}')) {
    return `${template.replace(/\{description\}/g, desc)}\n\n${styleBlock}`
  }
  return `${template}\n\n${styleBlock}【分镜提示词内容】\n${desc}`
}

type AssetCategory = 'character' | 'scene' | 'prop' | 'other'

interface ConnectedAssetInfo {
  id: string
  name: string
  description: string
  imageUrl: string | null
  category: AssetCategory
}

const MAX_MODEL_REFERENCE_IMAGES = 12
const INLINE_MENTION_REGEX = /@([^\s@，。,.；;！!？?、：:（）()【】\[\]{}"'“”‘’]*)$/

function normalizeUrl(url: unknown): string | null {
  const text = String(url ?? '').trim()
  return text ? text : null
}

function resolveAssetCategory(label: unknown): AssetCategory {
  const text = String(label ?? '')
  if (text.includes('人物') || /\bcharacter\b/i.test(text)) return 'character'
  if (text.includes('场景') || /\bscene\b/i.test(text)) return 'scene'
  if (text.includes('道具') || /\bprop\b/i.test(text)) return 'prop'
  return 'other'
}

function normalizeAssetItems(input: unknown): AssetItem[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((asset): asset is Record<string, unknown> => Boolean(asset) && typeof asset === 'object')
    .map((asset) => {
      const categoryRaw = asset.category
      let category: AssetItem['category']
      if (categoryRaw === 'character' || categoryRaw === 'scene' || categoryRaw === 'prop') {
        category = categoryRaw
      }
      return {
        id: String(asset.id ?? ''),
        name: String(asset.name ?? '').trim(),
        description: String(asset.description ?? '').trim(),
        imageUrl: normalizeUrl(asset.imageUrl),
        category
      }
    })
    .filter(asset => asset.name)
}

function extractAssetsFromNode(node: any): ConnectedAssetInfo[] {
  const nodeData = node?.data as TextAssetResultNodeData | undefined
  const results: ConnectedAssetInfo[] = []
  const grouped = nodeData?.groupedAssets
  if (grouped) {
    ;(['character', 'scene', 'prop'] as const).forEach((category) => {
      const groupAssets = normalizeAssetItems(grouped[category])
      if (groupAssets.length === 0) return
      groupAssets.forEach((asset) => {
        results.push({
          id: String(asset.id ?? ''),
          name: String(asset.name ?? '').trim(),
          description: String(asset.description ?? '').trim(),
          imageUrl: normalizeUrl(asset.imageUrl),
          category
        })
      })
    })
  }
  if (results.length > 0) {
    return results.filter(item => item.name)
  }
  const assets = normalizeAssetItems(nodeData?.assets)
  if (assets.length === 0) return []
  const fallbackCategory = resolveAssetCategory(nodeData?.label)
  return assets
    .map((asset) => ({
      id: String(asset.id ?? ''),
      name: String(asset.name ?? '').trim(),
      description: String(asset.description ?? '').trim(),
      imageUrl: normalizeUrl(asset.imageUrl),
      category: asset.category ?? fallbackCategory
    }))
    .filter(item => item.name)
}

function collectIncomingAssets(): ConnectedAssetInfo[] {
  const result: ConnectedAssetInfo[] = []
  edges.value.forEach((edge) => {
    if (edge.target !== props.id) return
    const sourceNode = findNode(edge.source)
    if (!sourceNode?.data) return
    result.push(...extractAssetsFromNode(sourceNode))
  })
  return result.filter(item => item.name)
}

interface MentionRange {
  start: number
  end: number
  name: string
  category: AssetCategory
}

function isMentionTailBoundary(ch: string | undefined) {
  if (!ch) return true
  return /[\s，。,.；;！!？?、：:（）()【】\[\]{}"'“”‘’]/.test(ch)
}

function parseAssetMentionRanges(text: string): MentionRange[] {
  const source = String(text ?? '')
  if (!source) return []
  const nameMap = mentionCategoryByName.value
  const sortedNames = mentionAssetNamesSorted.value
  if (sortedNames.length === 0) return []
  const ranges: MentionRange[] = []
  let index = 0
  while (index < source.length) {
    if (source[index] !== '@') {
      index += 1
      continue
    }
    let matchedRange: MentionRange | null = null
    for (const name of sortedNames) {
      const start = index
      const mentionStart = index + 1
      const mentionEnd = mentionStart + name.length
      if (source.slice(mentionStart, mentionEnd) !== name) continue
      if (!isMentionTailBoundary(source[mentionEnd])) continue
      const category = nameMap.get(name)
      if (!category || category === 'other') continue
      matchedRange = { start, end: mentionEnd, name, category }
      break
    }
    if (matchedRange) {
      ranges.push(matchedRange)
      index = matchedRange.end
      continue
    }
    index += 1
  }
  return ranges
}

function extractMentionNames(text: string): Set<string> {
  const names = new Set<string>()
  parseAssetMentionRanges(text).forEach((range) => names.add(range.name))
  return names
}

function buildMentionedAssetSummary(assets: ConnectedAssetInfo[]): string {
  if (!assets.length) return ''
  const grouped: Record<AssetCategory, ConnectedAssetInfo[]> = {
    character: [],
    scene: [],
    prop: [],
    other: []
  }
  assets.forEach((asset) => grouped[asset.category].push(asset))
  const line = (a: ConnectedAssetInfo) =>
    t('canvas.nodeUi.storyboardGen.assetBulletLine', {
      name: a.name,
      desc: a.description || t('canvas.nodeUi.storyboardGen.assetNoDesc')
    })
  const sections: string[] = []
  if (grouped.character.length) {
    sections.push(`${t('canvas.nodeUi.storyboardGen.assetSummaryChar')}\n${grouped.character.map(line).join('\n')}`)
  }
  if (grouped.scene.length) {
    sections.push(`${t('canvas.nodeUi.storyboardGen.assetSummaryScene')}\n${grouped.scene.map(line).join('\n')}`)
  }
  if (grouped.prop.length) {
    sections.push(`${t('canvas.nodeUi.storyboardGen.assetSummaryProp')}\n${grouped.prop.map(line).join('\n')}`)
  }
  if (grouped.other.length) {
    sections.push(`${t('canvas.nodeUi.storyboardGen.assetSummaryOther')}\n${grouped.other.map(line).join('\n')}`)
  }
  return sections.join('\n')
}

function resolvePrimaryNodeImageUrl(nodeData: Record<string, any>): string | null {
  return normalizeUrl(nodeData.generatedImageUrl)
    ?? normalizeUrl(nodeData.uploadedMainImageUrl)
    ?? normalizeUrl(nodeData.imageUrl)
    ?? normalizeUrl(nodeData.previewImageUrl)
}

function collectIncomingNodeImages(): string[] {
  const urls: string[] = []
  edges.value.forEach((edge) => {
    if (edge.target !== props.id) return
    const sourceNode = findNode(edge.source)
    if (!sourceNode?.data) return
    const nodeData = sourceNode.data as Record<string, any>
    const mainImage = resolvePrimaryNodeImageUrl(nodeData)
    if (mainImage) urls.push(mainImage)
    if (sourceNode.type === 'textAssetResult') {
      const assets = extractAssetsFromNode(sourceNode)
      assets.forEach((asset) => {
        const imageUrl = normalizeUrl(asset.imageUrl)
        if (imageUrl) urls.push(imageUrl)
      })
    }
  })
  return urls
}

function buildGenerationReferencePayload(storyboardDescription: string) {
  const incomingAssets = collectIncomingAssets()
  const mentionNames = extractMentionNames(storyboardDescription)
  const mentionedAssets = incomingAssets.filter(asset => mentionNames.has(asset.name))
  const mentionSummary = buildMentionedAssetSummary(mentionedAssets)
  const descriptionWithMentionAssets = mentionSummary
    ? `${storyboardDescription}\n\n${t('canvas.nodeUi.storyboardGen.citeBlockTitle')}\n${mentionSummary}`
    : storyboardDescription

  const merged: string[] = []
  const seen = new Set<string>()
  const pushUnique = (url: string | null) => {
    if (!url || seen.has(url)) return
    seen.add(url)
    merged.push(url)
  }

  mentionedAssets.forEach(asset => pushUnique(asset.imageUrl))
  collectIncomingNodeImages().forEach(url => pushUnique(normalizeUrl(url)))
  referenceImages.value.forEach(url => pushUnique(normalizeUrl(url)))

  return {
    descriptionWithMentionAssets,
    referenceImages: merged.slice(0, MAX_MODEL_REFERENCE_IMAGES)
  }
}

const frameInputRefs = ref<Array<HTMLTextAreaElement | null>>([])
const frameHighlightRefs = ref<Array<HTMLDivElement | null>>([])
const mentionPickerVisible = ref(false)
const mentionPickerFrameIndex = ref<number | null>(null)
const mentionPickerToken = ref('')
const mentionPickerAnchor = ref({ left: 0, top: 0 })
const mentionPickerHighlight = ref(0)
let mentionHideTimer: number | null = null
const MENTION_PICKER_MIN_WIDTH = 330
const MENTION_PICKER_MAX_WIDTH = 420
const MENTION_PICKER_ITEM_HEIGHT = 32
const MENTION_PICKER_PADDING = 12
const MENTION_PICKER_GAP = 6
const MENTION_PICKER_HEAD_HEIGHT = 26

interface MentionCandidate {
  name: string
  category: AssetCategory
}

const mentionSourceAssets = computed(() => {
  const incomingAssets = collectIncomingAssets()
  if (incomingAssets.length === 0) {
    const fallbackAssets: ConnectedAssetInfo[] = []
    getNodes.value
      .filter(node => node.id !== props.id)
      .forEach((node) => {
        fallbackAssets.push(...extractAssetsFromNode(node))
      })
    return fallbackAssets
  }
  return incomingAssets
})

const mentionPickerOptions = computed<MentionCandidate[]>(() => {
  const token = mentionPickerToken.value.trim().toLowerCase()
  const unique = new Map<string, MentionCandidate>()
  mentionSourceAssets.value.forEach((asset) => {
    const key = `${asset.category}:${asset.name}`
    if (!unique.has(key)) {
      unique.set(key, { name: asset.name, category: asset.category })
    }
  })
  const candidates = Array.from(unique.values())
  const filtered = token
    ? candidates.filter(item => item.name.toLowerCase().includes(token))
    : candidates
  return filtered.slice(0, 24)
})

const mentionPickerFlatOptions = computed(() => mentionPickerOptions.value)

const mentionPickerGroups = computed(() => {
  const grouped: Record<'character' | 'scene' | 'prop', MentionCandidate[]> = {
    character: [],
    scene: [],
    prop: []
  }
  mentionPickerOptions.value.forEach((option) => {
    if (option.category === 'character') grouped.character.push(option)
    else if (option.category === 'scene') grouped.scene.push(option)
    else grouped.prop.push(option)
  })
  return [
    { key: 'character', title: t('canvas.nodeUi.storyboardGen.mentionChar'), items: grouped.character },
    { key: 'scene', title: t('canvas.nodeUi.storyboardGen.mentionScene'), items: grouped.scene },
    { key: 'prop', title: t('canvas.nodeUi.storyboardGen.mentionProp'), items: grouped.prop }
  ] as const
})

const mentionPickerIndexMap = computed(() => {
  const m = new Map<string, number>()
  mentionPickerFlatOptions.value.forEach((option, index) => {
    m.set(`${option.category}:${option.name}`, index)
  })
  return m
})

const mentionCategoryByName = computed(() => {
  const m = new Map<string, AssetCategory>()
  mentionSourceAssets.value.forEach((asset) => {
    if (!m.has(asset.name)) {
      m.set(asset.name, asset.category)
    }
  })
  return m
})

const mentionAssetNamesSorted = computed(() =>
  Array.from(mentionCategoryByName.value.keys()).sort((a, b) => b.length - a.length)
)

function setFrameInputRef(el: HTMLTextAreaElement | null, index: number) {
  frameInputRefs.value[index] = el
}

function setFrameHighlightRef(el: HTMLDivElement | null, index: number) {
  frameHighlightRefs.value[index] = el
}

function syncFrameHighlightScroll(index: number) {
  const textarea = frameInputRefs.value[index]
  const highlight = frameHighlightRefs.value[index]
  if (!textarea || !highlight) return
  highlight.scrollTop = textarea.scrollTop
  highlight.scrollLeft = textarea.scrollLeft
}

function clearMentionHideTimer() {
  if (mentionHideTimer !== null) {
    window.clearTimeout(mentionHideTimer)
    mentionHideTimer = null
  }
}

function hideMentionPicker() {
  clearMentionHideTimer()
  mentionPickerVisible.value = false
  mentionPickerFrameIndex.value = null
  mentionPickerToken.value = ''
  mentionPickerHighlight.value = 0
}

function delayHideMentionPicker() {
  clearMentionHideTimer()
  mentionHideTimer = window.setTimeout(() => {
    hideMentionPicker()
  }, 130)
}

function getTextareaCaretOffset(textarea: HTMLTextAreaElement, caretIndex: number) {
  const mirror = document.createElement('div')
  const computedStyle = window.getComputedStyle(textarea)
  const mirrorStyle = mirror.style

  mirrorStyle.position = 'absolute'
  mirrorStyle.visibility = 'hidden'
  mirrorStyle.pointerEvents = 'none'
  mirrorStyle.whiteSpace = 'pre-wrap'
  mirrorStyle.overflowWrap = 'break-word'
  mirrorStyle.wordBreak = 'break-word'
  mirrorStyle.boxSizing = computedStyle.boxSizing
  mirrorStyle.width = `${textarea.clientWidth}px`
  mirrorStyle.font = computedStyle.font
  mirrorStyle.lineHeight = computedStyle.lineHeight
  mirrorStyle.letterSpacing = computedStyle.letterSpacing
  mirrorStyle.padding = computedStyle.padding
  mirrorStyle.border = computedStyle.border
  mirrorStyle.textTransform = computedStyle.textTransform
  mirrorStyle.textIndent = computedStyle.textIndent

  mirror.textContent = textarea.value.slice(0, caretIndex)
  const marker = document.createElement('span')
  marker.textContent = textarea.value.slice(caretIndex, caretIndex + 1) || ' '
  mirror.appendChild(marker)
  document.body.appendChild(mirror)

  const left = marker.offsetLeft - textarea.scrollLeft
  const top = marker.offsetTop - textarea.scrollTop
  document.body.removeChild(mirror)
  return { left, top }
}

function updateMentionPickerForTextarea(index: number, textarea: HTMLTextAreaElement) {
  const caret = textarea.selectionStart ?? textarea.value.length
  const textBeforeCaret = textarea.value.slice(0, caret)
  const matched = textBeforeCaret.match(INLINE_MENTION_REGEX)
  if (!matched) {
    hideMentionPicker()
    return
  }
  mentionPickerFrameIndex.value = index
  mentionPickerToken.value = String(matched[1] ?? '')
  mentionPickerHighlight.value = 0
  mentionPickerVisible.value = true
  const container = textarea.closest('.node-body') as HTMLElement | null
  if (!container) return
  const hostRect = textarea.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const caretOffset = getTextareaCaretOffset(textarea, caret)
  const groupMaxRows = Math.max(...mentionPickerGroups.value.map(group => group.items.length), 1)
  const pickerHeight = Math.min(
    220,
    groupMaxRows * MENTION_PICKER_ITEM_HEIGHT + MENTION_PICKER_HEAD_HEIGHT + MENTION_PICKER_PADDING
  )
  const relativeLeft = hostRect.left - containerRect.left + (container.scrollLeft || 0) + caretOffset.left
  const relativeTop = hostRect.top - containerRect.top + (container.scrollTop || 0) + caretOffset.top
  const visibleBottom = (container.scrollTop || 0) + container.clientHeight
  const preferBelowTop = relativeTop + 22
  const overflowBottom = preferBelowTop + pickerHeight > visibleBottom
  const placeTop = overflowBottom ? relativeTop - pickerHeight - MENTION_PICKER_GAP : preferBelowTop
  const maxLeft = Math.max(0, (container.scrollLeft || 0) + container.clientWidth - MENTION_PICKER_MAX_WIDTH - 8)
  const clampedLeft = Math.min(Math.max(relativeLeft, (container.scrollLeft || 0) + 4), maxLeft)
  const minTop = (container.scrollTop || 0) + 4
  const clampedTop = Math.max(minTop, placeTop)
  mentionPickerAnchor.value = {
    left: clampedLeft,
    top: clampedTop
  }
}

function onFrameInput(index: number, event: Event) {
  const textarea = event.target as HTMLTextAreaElement
  const normalized = updateFrameDescription(index, textarea.value)
  if (normalized !== textarea.value) {
    const prevCaret = textarea.selectionStart ?? normalized.length
    textarea.value = normalized
    const nextCaret = Math.min(prevCaret, normalized.length)
    textarea.setSelectionRange(nextCaret, nextCaret)
  }
  syncFrameHighlightScroll(index)
  updateMentionPickerForTextarea(index, textarea)
}

function onFrameClick(index: number, event: MouseEvent | KeyboardEvent) {
  const textarea = event.target as HTMLTextAreaElement
  if (!textarea) return
  const tokenSelected = trySelectMentionTokenAtCaret(index, textarea)
  if (tokenSelected) {
    hideMentionPicker()
    return
  }
  updateMentionPickerForTextarea(index, textarea)
}

function escapeHtml(raw: string) {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderFrameHighlight(text: string) {
  const source = String(text ?? '')
  if (!source) return '&nbsp;'
  const mentionRanges = parseAssetMentionRanges(source)
  if (mentionRanges.length === 0) {
    return escapeHtml(source).replace(/\n/g, '<br>')
  }
  let html = ''
  let lastIndex = 0
  for (const range of mentionRanges) {
    html += escapeHtml(source.slice(lastIndex, range.start))
    const tokenText = source.slice(range.start, range.end)
    if (range.category === 'character') {
      html += `<span class="mention-token mention-character">${escapeHtml(tokenText)}</span>`
    } else if (range.category === 'scene') {
      html += `<span class="mention-token mention-scene">${escapeHtml(tokenText)}</span>`
    } else if (range.category === 'prop') {
      html += `<span class="mention-token mention-prop">${escapeHtml(tokenText)}</span>`
    } else {
      html += escapeHtml(tokenText)
    }
    lastIndex = range.end
  }
  html += escapeHtml(source.slice(lastIndex))
  return html.replace(/\n/g, '<br>')
}

function replaceCurrentMention(text: string, caretPos: number, assetName: string) {
  const before = text.slice(0, caretPos)
  const after = text.slice(caretPos)
  const matched = before.match(INLINE_MENTION_REGEX)
  if (!matched || matched.index === undefined) {
    return { text, caret: caretPos }
  }
  const replaceStart = matched.index
  const prefix = before.slice(0, replaceStart)
  const replaced = `${prefix}@${assetName}`
  const needsSpace = !after.startsWith(' ')
  const spacer = needsSpace ? ' ' : ''
  const nextText = `${replaced}${spacer}${after}`
  return { text: nextText, caret: replaced.length + spacer.length }
}

function resolveMentionRangeAtCaret(text: string, caret: number): MentionRange | null {
  const ranges = parseAssetMentionRanges(text)
  for (const range of ranges) {
    if (caret >= range.start && caret <= range.end) return range
  }
  return null
}

function resolveIntersectMentionRanges(text: string, selectionStart: number, selectionEnd: number): MentionRange[] {
  if (selectionStart === selectionEnd) return []
  return parseAssetMentionRanges(text).filter((range) => range.start < selectionEnd && range.end > selectionStart)
}

function applyFrameText(frameIndex: number, textarea: HTMLTextAreaElement, nextText: string, caretPos: number) {
  const normalized = updateFrameDescription(frameIndex, nextText)
  textarea.value = normalized
  textarea.focus()
  const nextCaret = Math.min(caretPos, normalized.length)
  textarea.setSelectionRange(nextCaret, nextCaret)
  syncFrameHighlightScroll(frameIndex)
}

function deleteMentionRange(frameIndex: number, textarea: HTMLTextAreaElement, range: MentionRange) {
  const source = textarea.value
  const removeEnd = source[range.end] === ' ' ? range.end + 1 : range.end
  const nextText = `${source.slice(0, range.start)}${source.slice(removeEnd)}`
  applyFrameText(frameIndex, textarea, nextText, range.start)
}

function trySelectMentionTokenAtCaret(frameIndex: number, textarea: HTMLTextAreaElement) {
  const selectionStart = textarea.selectionStart ?? 0
  const selectionEnd = textarea.selectionEnd ?? selectionStart
  if (selectionStart !== selectionEnd) return false
  const target = resolveMentionRangeAtCaret(textarea.value, selectionStart)
  if (!target) return false
  textarea.setSelectionRange(target.start, target.end)
  syncFrameHighlightScroll(frameIndex)
  return true
}

function applyMentionSelection(assetName: string) {
  const frameIndex = mentionPickerFrameIndex.value
  if (frameIndex === null) return
  const textarea = frameInputRefs.value[frameIndex]
  if (!textarea) return
  const caretPos = textarea.selectionStart ?? textarea.value.length
  const replaced = replaceCurrentMention(textarea.value, caretPos, assetName)
  applyFrameText(frameIndex, textarea, replaced.text, replaced.caret)
  hideMentionPicker()
}

function onMentionOptionMouseDown(option: MentionCandidate) {
  applyMentionSelection(option.name)
}

function isMentionOptionActive(option: MentionCandidate) {
  const optionIndex = mentionPickerIndexMap.value.get(`${option.category}:${option.name}`)
  return optionIndex === mentionPickerHighlight.value
}

function onFrameKeydown(index: number, event: KeyboardEvent) {
  if (!mentionPickerVisible.value || mentionPickerFlatOptions.value.length === 0) {
    // 继续处理 mention token 原子化编辑逻辑
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    mentionPickerHighlight.value = (mentionPickerHighlight.value + 1) % mentionPickerFlatOptions.value.length
    return
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    mentionPickerHighlight.value = (mentionPickerHighlight.value - 1 + mentionPickerFlatOptions.value.length) % mentionPickerFlatOptions.value.length
    return
  } else if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    const picked = mentionPickerFlatOptions.value[Math.max(0, mentionPickerHighlight.value)]
    if (picked) applyMentionSelection(picked.name)
    return
  } else if (event.key === 'Escape') {
    event.preventDefault()
    hideMentionPicker()
    return
  }
  const textarea = event.target as HTMLTextAreaElement | null
  if (!textarea) return
  const selectionStart = textarea.selectionStart ?? 0
  const selectionEnd = textarea.selectionEnd ?? selectionStart
  const currentRange = resolveMentionRangeAtCaret(textarea.value, selectionStart)
  const overlapRanges = resolveIntersectMentionRanges(textarea.value, selectionStart, selectionEnd)
  const isTypingKey = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey

  if (event.key === 'Backspace' || event.key === 'Delete') {
    if (selectionStart !== selectionEnd && overlapRanges.length > 0) {
      event.preventDefault()
      const removeStart = Math.min(selectionStart, overlapRanges[0].start)
      const last = overlapRanges[overlapRanges.length - 1]
      const removeEnd = Math.max(selectionEnd, textarea.value[last.end] === ' ' ? last.end + 1 : last.end)
      const nextText = `${textarea.value.slice(0, removeStart)}${textarea.value.slice(removeEnd)}`
      applyFrameText(index, textarea, nextText, removeStart)
      hideMentionPicker()
      return
    }
    if (currentRange) {
      event.preventDefault()
      deleteMentionRange(index, textarea, currentRange)
      hideMentionPicker()
      return
    }
    return
  }

  if (isTypingKey && (currentRange || overlapRanges.length > 0)) {
    event.preventDefault()
    if (!trySelectMentionTokenAtCaret(index, textarea) && overlapRanges.length > 0) {
      textarea.setSelectionRange(overlapRanges[0].start, overlapRanges[overlapRanges.length - 1].end)
    }
    hideMentionPicker()
    return
  }

  if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && currentRange) {
    event.preventDefault()
    const targetCaret = event.key === 'ArrowLeft' ? currentRange.start : currentRange.end
    textarea.setSelectionRange(targetCaret, targetCaret)
    return
  }

  if (event.key === 'Enter' && currentRange) {
    event.preventDefault()
    textarea.setSelectionRange(currentRange.end, currentRange.end)
    return
  }
}

function countLinkedOutputImagesFromStoryboard(): number {
  return edges.value.filter((e) => {
    if (e.source !== props.id) return false
    const tgt = findNode(e.target)
    return tgt?.type === 'imageCanvas'
  }).length
}

function buildStoryboardOutputPlacement() {
  const self = findNode(props.id)
  const width = self?.dimensions?.width ?? 430
  const gap = 48
  const existingOutCount = countLinkedOutputImagesFromStoryboard()
  const nextOutputN = existingOutCount + 1
  const padded = String(nextOutputN).padStart(2, '0')
  const storyIdx =
    typeof props.data.storyboardSequence === 'number' && props.data.storyboardSequence > 0
      ? props.data.storyboardSequence
      : null
  const imgLabel =
    storyIdx !== null
      ? t('canvas.nodeUi.storyboardGen.shotImageIndexed', { idx: storyIdx, padded })
      : t('canvas.nodeUi.storyboardGen.shotImagePlain', { padded })
  const stackY = existingOutCount * 28
  return {
    nextOutputN,
    imgLabel,
    storyIdx,
    position: {
      x: (self?.position.x ?? 0) + width + gap,
      y: (self?.position.y ?? 0) + stackY
    }
  }
}

/** 先于 API 在右侧建立占位图节点（与 F:\\8.gongzuoliu 分镜生成立即出线动画一致） */
function createPendingStoryboardOutputNode(prompt: string, modelId: string): string {
  const place = buildStoryboardOutputPlacement()
  const newId = `storyboard-image-${Date.now()}`
  pushStateBeforeChange?.()
  addNodes({
    id: newId,
    type: 'imageCanvas',
    position: place.position,
    data: {
      label: place.imgLabel,
      type: 'image',
      status: 'running',
      description: t('canvas.nodeUi.storyboardGen.outputExportDesc'),
      prompt,
      referenceImages: [],
      uploadedMainImageUrl: null,
      generatedImageUrl: null,
      toolbarExpanded: false,
      imageQuality: imageQuality.value,
      aspectRatio: aspectRatio.value,
      imageModelGroup: props.data.imageModelGroup ?? apiStore.imageModelGroup,
      imageModel: modelId,
      storyboardOutputStoryIndex: place.storyIdx ?? undefined,
      storyboardOutputImageIndex: place.nextOutputN,
      storyboardGenerating: true,
      generationStartedAt: Date.now(),
      generationDurationMs: 90_000
    }
  })

  addEdges({
    id: `e-${props.id}-storyboard-image-${newId}`,
    source: props.id,
    target: newId,
    type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
    animated: true,
    style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
  })
  return newId
}

function finalizeStoryboardOutputNode(
  outputId: string,
  displayUrl: string,
  promptFinal: string,
  modelId: string
) {
  updateNodeData(outputId, {
    generatedImageUrl: displayUrl,
    status: 'completed',
    storyboardGenerating: false,
    generationStartedAt: null,
    generationDurationMs: undefined,
    generationError: undefined,
    prompt: promptFinal,
    imageModel: modelId,
    imageQuality: imageQuality.value,
    aspectRatio: aspectRatio.value
  })
}

function failStoryboardOutputNode(outputId: string | null, message: string) {
  if (!outputId) return
  updateNodeData(outputId, {
    status: 'error',
    storyboardGenerating: false,
    generationStartedAt: null,
    generationDurationMs: undefined,
    generationError: message
  })
}

async function handleGenerateStoryboard() {
  const ig = (props.data.imageModelGroup ?? apiStore.imageModelGroup) as ApiModelGroup
  if (!apiStore.isApiReadyForGroup(ig)) {
    ElMessage.warning(
      ig === 'flow2' ? t('settings.msg.enterApiUrlFirst') : t('canvas.nodeUi.storyboardGen.needApiKey')
    )
    return
  }
  let modelId = props.data.imageModel || apiStore.imageModel
  if (!modelId) {
    ElMessage.warning(t('canvas.nodeUi.storyboardGen.needModel'))
    return
  }
  if (ig === 'flow2') {
    modelId = apiStore.resolveFlow2ImageModelId(modelId, imageQuality.value)
  }
  const storyboardDescription = buildStoryboardDescription().trim()
  const introLineOnly = storyboardIntroLine(rows.value, cols.value)
  if (!storyboardDescription || storyboardDescription === introLineOnly) {
    ElMessage.warning(t('canvas.nodeUi.storyboardGen.needPrompt'))
    return
  }
  const {
    descriptionWithMentionAssets,
    referenceImages: mergedReferenceImages
  } = buildGenerationReferencePayload(storyboardDescription)
  const prompt = composeCanvasStoryboardImagePrompt(descriptionWithMentionAssets).trim()

  const extra = buildImageModelGenerateOptions(modelId, imageQuality.value, aspectRatio.value)
  const shouldUseGridReference = !userStore.enableCinemaStoryboard
  const refsWithGrid = shouldUseGridReference
    ? (() => {
        const gridDataUrl = generateStoryboardGridDataUrl(
          aspectRatio.value,
          rows.value,
          cols.value,
          imageQuality.value
        )
        const maxUserRefs = Math.max(0, MAX_MODEL_REFERENCE_IMAGES - 1)
        return [...mergedReferenceImages.slice(0, maxUserRefs), gridDataUrl]
      })()
    : mergedReferenceImages.slice(0, MAX_MODEL_REFERENCE_IMAGES)

  console.log('[StoryboardGen] API payload debug', {
    nodeId: props.id,
    enableCinemaStoryboard: userStore.enableCinemaStoryboard,
    modelGroup: ig,
    modelId,
    imageQuality: imageQuality.value,
    aspectRatio: aspectRatio.value,
    promptPreview: prompt,
    storyboardDescription,
    descriptionWithMentionAssets,
    templateId: props.data.selectedStoryboardImagePromptId ?? canvasWorkbenchSbTplIdRef?.value ?? DEFAULT_SB_IMG_PROMPT_ID,
    referenceImagesCount: refsWithGrid.length,
    referenceImages: refsWithGrid,
    gridMode: shouldUseGridReference ? 'grid' : 'narrative',
    gridRows: shouldUseGridReference ? rows.value : null,
    gridCols: shouldUseGridReference ? cols.value : null,
    storyboardPrompt: props.data.storyboardPrompt ?? '',
    frames: frames.value.map(f => ({ id: f.id, description: f.description })),
    extra
  })

  updateNodeData(props.id, { status: 'running' })
  let pendingOutputId: string | null = null
  try {
    pendingOutputId = createPendingStoryboardOutputNode(prompt, modelId)
    const url = await apiService.generateImage(prompt, {
      model: modelId,
      referenceImages: refsWithGrid,
      ...extra,
      modelGroup: ig
    })
    if (!url) throw new Error(t('canvas.nodeUi.storyboardGen.noImageReturned'))
    const displayUrl = await persistStoryboardOutputImage(url)
    updateNodeData(props.id, {
      generatedImageUrl: displayUrl,
      status: 'completed'
    })
    finalizeStoryboardOutputNode(pendingOutputId, displayUrl, prompt, modelId)
    ElMessage.success(t('canvas.nodeUi.storyboardGen.genOk'))
  } catch (err) {
    updateNodeData(props.id, { status: 'error' })
    const msg = err instanceof Error ? err.message : t('canvas.nodeUi.storyboardGen.genFail')
    failStoryboardOutputNode(pendingOutputId, msg)
    ElMessage.error(msg)
  }
}

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
  updateNodeData(props.id, { referenceImages: referenceImages.value.filter((_, i) => i !== idx) })
}

const storyboardHeaderIcon = computed((): Component => {
  const nodeType = props.data.type
  if (nodeType === 'video') return VideoPlay
  if (nodeType === 'text') return Document
  if (nodeType === 'audio') return Microphone
  if (nodeType === 'image') return Picture
  return Grid
})

const storyboardHeaderIconClass = computed(() => {
  const nodeType = props.data.type
  if (nodeType === 'video') return 'node-type-icon--video'
  if (nodeType === 'text') return 'node-type-icon--text'
  if (nodeType === 'audio') return 'node-type-icon--audio'
  if (nodeType === 'image') return 'node-type-icon--image'
  return 'node-type-icon--storyboard'
})

const storyboardHeaderSeq = computed((): number | null => {
  const s = props.data.storyboardSequence
  return typeof s === 'number' && s > 0 ? s : null
})

const storyboardHeaderTitle = computed(() => {
  const sbTitle = String(props.data.storyboardTitle ?? '').trim()
  if (sbTitle) return sbTitle
  return String(props.data.label ?? t('canvas.nodeUi.storyboardGen.defaultTitle')).trim()
    || t('canvas.nodeUi.storyboardGen.defaultTitle')
})
</script>

<template>
  <div class="storyboard-gen-node-root">
    <Handle type="target" :position="Position.Left" class="handle handle-target" />

    <div class="storyboard-gen-node" :class="{ 'is-selected': selected }">
      <div class="node-header">
        <el-icon class="node-type-icon" :class="storyboardHeaderIconClass">
          <component :is="storyboardHeaderIcon" />
        </el-icon>
        <span v-if="storyboardHeaderSeq !== null" class="node-label node-label-storyboard">
          <span class="node-label-seq">#{{ storyboardHeaderSeq }}</span>
          <span class="node-label-title-text">{{ storyboardHeaderTitle }}</span>
        </span>
        <span v-else class="node-label">{{ data.label || t('canvas.nodeUi.storyboardGen.defaultTitle') }}</span>
      </div>
      <div class="node-status" :style="{ backgroundColor: statusColor }" />

      <div
        v-if="lodIsShell"
        class="storyboard-gen-lod-shell nodrag nopan"
      >
        <el-icon class="storyboard-gen-lod-icon"><Grid /></el-icon>
        <div class="storyboard-gen-lod-lines">
          <span class="storyboard-gen-lod-title">
            <template v-if="storyboardHeaderSeq !== null">#{{ storyboardHeaderSeq }} {{ storyboardHeaderTitle }}</template>
            <template v-else>{{ data.label || t('canvas.nodeUi.storyboardGen.defaultTitle') }}</template>
          </span>
          <span class="storyboard-gen-lod-sub">{{
            t('canvas.nodeUi.storyboardGen.lodHint', { rows: rows, cols: cols, total: totalFrames })
          }}</span>
        </div>
      </div>

      <template v-else>
      <div class="node-body nodrag nopan" @wheel.stop @click.stop="onNodeMainClick">
        <!-- 删除顶部统计 -->
        

        <div class="frame-grid" :style="frameGridStyle">
          <div v-for="(f, idx) in frames" :key="f.id" class="frame-input-wrap">
            <div
              class="frame-input-highlight nodrag nopan"
              :ref="(el) => setFrameHighlightRef(el as HTMLDivElement | null, idx)"
              v-html="renderFrameHighlight(f.description)"
            />
            <textarea
              class="frame-input frame-input-overlay nodrag nopan"
              :placeholder="`Grid${idx + 1}`"
              :value="f.description"
              @input="onFrameInput(idx, $event)"
              @scroll="syncFrameHighlightScroll(idx)"
              @keydown="onFrameKeydown(idx, $event)"
              @focus="updateMentionPickerForTextarea(idx, $event.target as HTMLTextAreaElement)"
              @click="onFrameClick(idx, $event)"
              @keyup="onFrameClick(idx, $event)"
              @blur="delayHideMentionPicker"
              @wheel.stop
              :ref="(el) => setFrameInputRef(el as HTMLTextAreaElement | null, idx)"
            />
          </div>
        </div>
        <div
          v-if="mentionPickerVisible"
          class="asset-mention-picker nodrag nopan"
          :style="{ left: `${mentionPickerAnchor.left}px`, top: `${mentionPickerAnchor.top}px` }"
          @mousedown.stop
        >
          <div class="asset-mention-columns">
            <div v-for="group in mentionPickerGroups" :key="group.key" class="asset-mention-group">
              <div class="asset-mention-group-title">{{ group.title }}</div>
              <button
                v-for="option in group.items"
                :key="`${option.category}:${option.name}`"
                type="button"
                class="asset-mention-option"
                :class="{ active: isMentionOptionActive(option) }"
                @mousedown.prevent="onMentionOptionMouseDown(option)"
              >
                {{ option.name }}
              </button>
            </div>
          </div>
          <div v-if="mentionPickerFlatOptions.length === 0" class="asset-mention-empty">
            {{ t('canvas.nodeUi.storyboardGen.noAssets') }}
          </div>
        </div>

      </div>

      <div class="node-inline-actions nodrag nopan">
        <div class="toolbar-actions-main">
          <el-popover
            v-model:visible="modelPopoverVisible"
            placement="top-start"
            :width="360"
            trigger="click"
            popper-class="storyboard-model-popover"
            @show="onModelPopoverShow"
          >
            <template #reference>
              <button type="button" class="model-chip nodrag nopan">
                <span class="model-chip-name">{{ currentModelMeta.modelName }}</span>
                <span class="model-chip-group">{{ currentModelMeta.groupLabel }}</span>
              </button>
            </template>
            <div class="model-panel">
              <div class="model-panel-label">
                {{ t('canvas.nodeUi.common.supplier') }}
              </div>
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
              <div class="model-panel-label">
                {{ t('canvas.nodeUi.common.model') }}
              </div>
              <div class="model-group">
                <button
                  v-for="model in panelGroupModelsWithBadge"
                  :key="model.id"
                  type="button"
                  class="model-btn"
                  :class="{ active: (props.data.imageModel || apiStore.imageModel) === model.id }"
                  @click="selectModel(model.id)"
                >
                  <span class="model-btn-icon" :class="`platform-${model.badge.key}`">{{ model.badge.short }}</span>
                  <span class="model-btn-text">{{ model.name }}</span>
                </button>
              </div>
              <div v-if="panelGroupModelsWithBadge.length === 0" class="model-empty">
                {{ t('canvas.nodeUi.common.noModelsInGroup') }}
              </div>
            </div>
          </el-popover>
          <el-popover
            v-model:visible="gridFormatPopoverVisible"
            placement="top-start"
            :width="280"
            trigger="click"
            popper-class="storyboard-qa-popover"
          >
            <template #reference>
              <button type="button" class="grid-format-trigger nodrag nopan">
                <span>{{ currentGridFormatLabel }}</span>
              </button>
            </template>
            <div class="qa-panel">
              <div class="qa-label">宫格格式</div>
              <div class="qa-segment grid-format-segment">
                <button
                  v-for="format in gridFormatOptions"
                  :key="format.value"
                  type="button"
                  class="grid-format-seg-btn"
                  :class="{ active: gridFormat === format.value }"
                  @click="gridFormat = format.value; gridFormatPopoverVisible = false"
                >
                  {{ format.label }}
                </button>
              </div>
            </div>
          </el-popover>
          <el-popover
            v-model:visible="qaPopoverVisible"
            placement="top-start"
            :width="280"
            trigger="click"
            popper-class="storyboard-qa-popover"
          >
            <template #reference>
              <button type="button" class="qa-trigger nodrag nopan">
                <el-icon class="qa-trigger-icon"><Operation /></el-icon>
                <span>{{ qualityAspectSummary }}</span>
              </button>
            </template>
            <div class="qa-panel">
              <div class="qa-label">
                {{ t('canvas.nodeUi.storyboardGen.resolution') }}
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
                {{ t('canvas.nodeUi.storyboardGen.aspect') }}
              </div>
              <div class="qa-ratios">
                <button
                  v-for="r in [
                    { id: '1:1', label: '1:1' },
                    { id: '16:9', label: '16:9' },
                    { id: '9:16', label: '9:16' },
                    { id: '4:3', label: '4:3' },
                    { id: '3:4', label: '3:4' }
                  ]"
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
        <button class="btn-generate btn-generate-full" :disabled="generating" @click="handleGenerateStoryboard">
          <el-icon class="btn-generate-icon"><Promotion /></el-icon>
          <span>{{ generating ? t('canvas.nodeUi.common.generating') : t('canvas.nodeUi.storyboardGen.genShot') }}</span>
        </button>
      </div>
      </template>
    </div>

    <Handle type="source" :position="Position.Right" class="handle handle-source" />

    <Transition name="storyboard-node-bottom">
      <div
        v-if="toolbarExpanded && !lodIsShell"
        key="storyboard-toolbar"
        class="node-float-bottom storyboard-toolbar nodrag nopan"
        @mousedown.stop
      >
        <div
          role="group"
          class="prompt-toolbar-group"
          :aria-label="t('canvas.nodeUi.common.promptToolbarAria')"
        >
        <div class="refs-row">
          <label class="ref-add">
            <input type="file" accept="image/*" multiple class="hidden-input" @change="onRefFilesChange">
            <el-icon><Upload /></el-icon>
          </label>
          <div v-for="(url, idx) in referenceImages" :key="idx" class="ref-thumb">
            <img :src="url" alt="" loading="lazy" decoding="async">
            <button type="button" class="ref-remove" @click="removeRef(idx)">×</button>
          </div>
        </div>

        <textarea
          v-model="storyboardPrompt"
          class="prompt-input nodrag nopan"
          :placeholder="toolbarPromptPlaceholder"
          @wheel.stop
        />

        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.storyboard-gen-lod-shell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 200px;
  margin: 0 12px 12px;
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  background: rgba(10, 12, 22, 0.45);
  box-sizing: border-box;
}

.storyboard-gen-lod-icon {
  font-size: 26px;
  color: rgba(100, 200, 255, 0.88);
  flex-shrink: 0;
}

.storyboard-gen-lod-lines {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.storyboard-gen-lod-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(240, 244, 255, 0.95);
  line-height: 1.35;
  word-break: break-word;
}

.storyboard-gen-lod-sub {
  font-size: 11px;
  color: rgba(180, 192, 220, 0.78);
  line-height: 1.4;
}

.storyboard-gen-node-root {
  --storyboard-toolbar-width: 420px;
  --canvas-toolbar-prompt-min-height: 125px;
  --canvas-toolbar-prompt-bg: rgba(8, 12, 20, 0.62);
  --canvas-toolbar-prompt-border: rgba(255, 255, 255, 0.12);
  --canvas-toolbar-prompt-color: rgba(241, 245, 252, 0.94);
  --canvas-toolbar-prompt-placeholder: rgba(167, 176, 196, 0.55);
  --canvas-toolbar-prompt-font-size: 11px;
  --canvas-toolbar-prompt-line-height: 1.5;
  --canvas-toolbar-prompt-padding: 8px 10px;
  --canvas-toolbar-prompt-font-family: "Noto Sans SC", "Noto Sans CJK SC", "Noto Sans CJK JP", "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, "Segoe UI", sans-serif;
  width: 420px;
  min-width: 360px;
  position: relative;
  overflow: visible;
}

.storyboard-gen-node {
  position: relative;
  min-height: 320px;
  background: var(--bg-secondary, #1a1a2e);
  border: 2px solid var(--border-color, #3a3a4a);
  border-radius: 8px;
  overflow: hidden;
}

.storyboard-gen-node.is-selected {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.4), 0 4px 14px rgba(64, 158, 255, 0.22);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px;
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

.node-type-icon--storyboard {
  color: #7c6cf0;
}
.node-label { font-size: 13px; font-weight: 600; color: var(--text-primary, #fff); }
.node-label-storyboard { display: inline-flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.node-label-seq { color: #22c55e; font-weight: 800; flex-shrink: 0; }
.node-label-title-text { font-weight: 600; color: var(--text-primary, #fff); }
.node-status {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.node-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 560px;
  overflow: auto;
  position: relative;
}

.node-inline-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 10px 10px;
  box-sizing: border-box;
}

.toolbar-actions-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}

.node-float-bottom {
  position: absolute;
  left: 50%;
  top: calc(100% + 12px);
  z-index: 5;
  pointer-events: auto;
  transform: translateX(-50%);
  transform-origin: center top;
}

.storyboard-toolbar {
  width: var(--storyboard-toolbar-width);
  max-width: var(--storyboard-toolbar-width);
  box-sizing: border-box;
  background: #35003b6b;
  border: 1px solid #ba00f7;
  border-radius: 8px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
  padding: 10px;

}

.grid-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.prompt-count {
  margin-left: auto;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}

.grid-head-divider {
  width: 1px;
  height: 12px;
  background: rgba(255, 255, 255, 0.24);
  flex-shrink: 0;
}

.stepper {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.04);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
}

.stepper button {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 20%;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  padding: 0;
  font-size: 6px;
}

.grid-format-selector {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 24px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
}

.format-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(248, 250, 255, 0.95);
  font-size: 11px;
  cursor: pointer;
}

.format-chip:hover {
  border-color: rgba(255, 255, 255, 0.26);
}

.format-chip-name {
  text-align: center;
}

.frame-count {
  width: 30px;
  flex: 0 0 30px;
  text-align: right;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
}

.frame-grid {
  display: grid;
  gap: 6px;
  align-items: stretch;
}

.frame-input-wrap {
  position: relative;
  min-height: 0;
  height: 100%;
}

.frame-input {
  min-height: 0;
  height: 100%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(8, 12, 20, 0.62);
  color: rgba(241, 245, 252, 0.96);
  padding: 6px;
  font-size: 11px;
  font-family: "Noto Sans SC", "Noto Sans CJK SC", "Noto Sans CJK JP", "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, "Segoe UI", sans-serif;
  line-height: 1.45;
  font-weight: 500;
  letter-spacing: 0.1px;
  resize: none;
}

.frame-input:focus {
  outline: none;
  border-color: #409eff;
}

.frame-input::placeholder {
  color: rgba(167, 176, 196, 0.55);
}

.frame-input-highlight {
  position: absolute;
  inset: 0;
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(8, 12, 20, 0.62);
  color: rgba(241, 245, 252, 0.96);
  padding: 6px;
  font-size: 11px;
  font-family: "Noto Sans SC", "Noto Sans CJK SC", "Noto Sans CJK JP", "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, "Segoe UI", sans-serif;
  line-height: 1.45;
  font-weight: 500;
  letter-spacing: 0.1px;
  white-space: pre-wrap;
  word-break: break-word;
  pointer-events: none;
  box-sizing: border-box;
  scrollbar-width: none;
}

.frame-input-highlight::-webkit-scrollbar {
  display: none;
}

.frame-input-overlay {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: transparent;
  color: transparent;
  caret-color: rgba(241, 245, 252, 0.96);
  padding: 6px;
  font-size: 11px;
  font-family: "Noto Sans SC", "Noto Sans CJK SC", "Noto Sans CJK JP", "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, "Segoe UI", sans-serif;
  line-height: 1.45;
  font-weight: 500;
  letter-spacing: 0.1px;
  resize: none;
  box-sizing: border-box;
}

.frame-input-overlay::placeholder {
  color: rgba(167, 176, 196, 0.55);
}

.frame-input-overlay:focus {
  outline: none;
  border-color: #409eff;
}

.frame-input-highlight :deep(.mention-token) {
  font-weight: 700;
}

.frame-input-highlight :deep(.mention-character) {
  color: #f56c6c;
}

.frame-input-highlight :deep(.mention-scene) {
  color: #e6a23c;
}

.frame-input-highlight :deep(.mention-prop) {
  color: #409eff;
}

.asset-mention-picker {
  position: absolute;
  z-index: 9;
  min-width: 330px;
  max-width: 420px;
  max-height: 220px;
  overflow-y: auto;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(13, 17, 28, 0.95);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
  padding: 6px;
}

.asset-mention-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.asset-mention-group {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.asset-mention-group-title {
  color: rgba(170, 186, 212, 0.82);
  font-size: 11px;
  line-height: 1.2;
  padding: 2px 6px 4px;
}

.asset-mention-option {
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(235, 241, 255, 0.9);
  font-size: 12px;
  line-height: 1.2;
  text-align: left;
  padding: 6px 8px;
  cursor: pointer;
}

.asset-mention-option:hover,
.asset-mention-option.active {
  background: rgba(64, 158, 255, 0.2);
  color: #eaf3ff;
}

.asset-mention-empty {
  color: rgba(178, 190, 214, 0.72);
  font-size: 11px;
  line-height: 1.35;
  padding: 6px 8px 4px;
}

.refs-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-height: 44px;
}

.ref-add {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 0.7);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.hidden-input { display: none; }

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
  border: none;
  border-radius: 0 0 0 4px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}

.prompt-input {
  width: 100%;
  min-height: var(--canvas-toolbar-prompt-min-height);
  resize: vertical;
  border-radius: 8px;
  border: 1px solid var(--canvas-toolbar-prompt-border);
  background: var(--canvas-toolbar-prompt-bg);
  color: var(--canvas-toolbar-prompt-color);
  padding: var(--canvas-toolbar-prompt-padding);
  font-size: var(--canvas-toolbar-prompt-font-size);
  font-family: var(--canvas-toolbar-prompt-font-family);
  font-weight: 500;
  line-height: var(--canvas-toolbar-prompt-line-height);
}

.prompt-input::placeholder {
  color: var(--canvas-toolbar-prompt-placeholder);
}

.prompt-input:focus {
  outline: none;
  border-color: #409eff;
}

.model-chip {
  width: auto;
  max-width: 200px;
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
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #101114;
  color: rgba(248, 250, 255, 0.95);
  font-size: 12px;
  line-height: 30px;
  white-space: nowrap;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.qa-trigger:hover {
  border-color: rgba(255, 255, 255, 0.22);
}

.qa-trigger-icon {
  font-size: 13px;
  color: rgba(178, 193, 219, 0.86);
}

.grid-format-trigger {
  flex-shrink: 0;
  min-width: 90px;
  height: 32px;
  padding: 0 8px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #101114;
  color: rgba(248, 250, 255, 0.95);
  font-size: 12px;
  line-height: 30px;
  white-space: nowrap;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.grid-format-trigger:hover {
  border-color: rgba(255, 255, 255, 0.22);
}

.qa-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qa-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  font-weight: 600;
}

.qa-segment {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.qa-segment.grid-format-segment {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.seg-btn {
  height: 28px;
  padding: 0 10px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.86);
  font-size: 12px;
  cursor: pointer;
}

.seg-btn.active {
  border-color: rgba(64, 158, 255, 0.9);
  background: rgba(64, 158, 255, 0.24);
  color: #cfe6ff;
}

.grid-format-seg-btn {
  height: 50px;
  padding: 0 10px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.86);
  font-size: 12px;
  cursor: pointer;
}

.grid-format-seg-btn:hover {
  border-color: rgba(255, 255, 255, 0.22);
}

.grid-format-seg-btn.active {
  border-color: rgba(64, 158, 255, 0.9);
  background: rgba(64, 158, 255, 0.24);
  color: #cfe6ff;
}

.qa-ratios {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.ratio-btn {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 80px;
  padding: 0 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.86);
  cursor: pointer;
}

.ratio-btn:hover {
  border-color: rgba(64, 158, 255, 0.5);
}

.ratio-btn.active {
  border-color: rgba(64, 158, 255, 0.9);
  background: rgba(64, 158, 255, 0.24);
  color: #cfe6ff;
}

.ratio-shape {
  width: 18px;
  height: 12px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 3px;
  display: block;
  box-sizing: border-box;
  flex-shrink: 0;
}

.ratio-btn.ar-9-16 .ratio-shape,
.ratio-btn.ar-3-4 .ratio-shape {
  width: 10px;
  height: 14px;
}

.ratio-text {
  font-size: 11px;
  line-height: 1;
}

.btn-generate {
  height: 32px;
  padding: 0 12px;
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
  cursor: pointer;
}

.btn-generate-full {
  width: 100%;
  padding: 8px 12px;
  min-height: 36px;
  justify-content: center;
}

.btn-generate:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.handle {
  z-index: 2;
  width: 10px !important;
  height: 10px !important;
  border-radius: 50% !important;
  background: #409eff !important;
  border: 2px solid #ffffff !important;
}

.handle-target { left: 0 !important; }
.handle-source { right: 0 !important; }

.storyboard-node-bottom-enter-active,
.storyboard-node-bottom-leave-active {
  transition:
    opacity 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}

.storyboard-node-bottom-enter-from,
.storyboard-node-bottom-leave-to {
  opacity: 0;
  transform: translate(-50%, 14px);
}

.storyboard-node-bottom-enter-to,
.storyboard-node-bottom-leave-from {
  opacity: 1;
  transform: translate(-50%, 0);
}

.fade-overlay-enter-active,
.fade-overlay-leave-active {
  transition: opacity 0.16s ease;
}

.fade-overlay-enter-from,
.fade-overlay-leave-to {
  opacity: 0;
}
</style>

<style>
.storyboard-model-popover.el-popper,
.storyboard-model-popover {
  padding: 12px !important;
  background: #17181c !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 14px !important;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.5) !important;
}

.storyboard-model-popover .model-panel-label {
  margin: 2px 0 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.58);
}

.storyboard-model-popover .provider-group,
.storyboard-model-popover .model-group {
  display: grid;
  gap: 8px;
}

.storyboard-model-popover .provider-group {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 10px;
}

.storyboard-model-popover .model-group {
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
}

.storyboard-model-popover .model-group::-webkit-scrollbar {
  width: 6px;
}

.storyboard-model-popover .model-group::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.storyboard-model-popover .model-group::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.storyboard-model-popover .model-group::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

.storyboard-model-popover .provider-btn {
  height: 34px;
  min-width: 84px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: #101114;
  color: rgba(220, 228, 242, 0.85);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.storyboard-model-popover .provider-btn.active {
  border-color: rgba(64, 158, 255, 0.65);
  background: rgba(64, 158, 255, 0.2);
  color: #e8f1ff;
  font-weight: 600;
}

.storyboard-model-popover .model-btn {
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
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.storyboard-model-popover .model-btn-icon {
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

.storyboard-model-popover .model-btn-text {
  min-width: 0;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.storyboard-model-popover .model-btn-icon.platform-jimeng { background: #f56c6c; }
.storyboard-model-popover .model-btn-icon.platform-gpt { background: #10a37f; }
.storyboard-model-popover .model-btn-icon.platform-banana { background: #f6c343; color: #5d4200; }
.storyboard-model-popover .model-btn-icon.platform-qwen { background: #7c4dff; }
.storyboard-model-popover .model-btn-icon.platform-grok { background: #444bff; }
.storyboard-model-popover .model-btn-icon.platform-sora { background: #111827; }
.storyboard-model-popover .model-btn-icon.platform-veo { background: #0ea5e9; }
.storyboard-model-popover .model-btn-icon.platform-deepseek { background: #2563eb; }
.storyboard-model-popover .model-btn-icon.platform-other { background: #6b7280; }

.storyboard-model-popover .model-btn.active {
  border-color: rgba(64, 158, 255, 0.65);
  background: rgba(64, 158, 255, 0.2);
  color: #e8f1ff;
  font-weight: 600;
}

.storyboard-model-popover .model-group {
  grid-template-columns: repeat(1, minmax(0, 1fr));
}

.storyboard-model-popover .model-empty {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.52);
}

.storyboard-qa-popover.el-popper,
.storyboard-qa-popover {
  padding: 14px !important;
  background: #1a1a1a !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 14px !important;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55) !important;
}

.storyboard-qa-popover .qa-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin: 12px 0 8px;
  font-weight: 500;
}

.storyboard-qa-popover .qa-label:first-child {
  margin-top: 0;
}

.storyboard-qa-popover .qa-segment {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #252525;
  border-radius: 10px;
}

.storyboard-qa-popover .seg-btn {
  flex: 1;
  padding: 8px 0;
  font-size: 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.45);
  font-weight: 500;
}

.storyboard-qa-popover .seg-btn.active {
  background: #333333;
  color: #ffffff;
  font-weight: 700;
}

.storyboard-qa-popover .qa-ratios {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.storyboard-qa-popover .ratio-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 6px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
  cursor: pointer;
}

.storyboard-qa-popover .ratio-btn.active {
  background: #333333;
  color: #ffffff;
  font-weight: 600;
}

.storyboard-qa-popover .ratio-shape {
  display: block;
  border: none;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.22);
}

.storyboard-qa-popover .ratio-btn.active .ratio-shape {
  background: rgba(255, 255, 255, 0.95);
}

.storyboard-format-popover.el-popper,
.storyboard-format-popover {
  padding: 12px !important;
  background: #17181c !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 14px !important;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.5) !important;
}

.storyboard-format-popover .format-panel-label {
  margin: 2px 0 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.58);
}

.storyboard-format-popover .format-group {
  display: grid;
  gap: 6px;
}

.storyboard-format-popover .format-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: #101114;
  color: rgba(220, 228, 242, 0.85);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.storyboard-format-popover .format-btn:hover {
  border-color: rgba(255, 255, 255, 0.26);
  background: rgba(255, 255, 255, 0.05);
}

.storyboard-format-popover .format-btn.active {
  border-color: rgba(64, 158, 255, 0.65);
  background: rgba(64, 158, 255, 0.2);
  color: #e8f1ff;
  font-weight: 600;
}

.storyboard-format-popover .format-btn-text {
  text-align: center;
}
</style>
