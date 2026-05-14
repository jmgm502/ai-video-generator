<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch, withDefaults } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { ElMessage } from 'element-plus'
import { Upload, Tickets, Box, Promotion, Document } from '@element-plus/icons-vue'
import { useApiConfigStore } from '@/stores/apiConfigStore'
import { usePromptsStore } from '@/stores/promptsStore'
import { useUserStore } from '@/stores/userStore'
import { canvasEdgeStyleFromWidth } from '@/utils/canvasEdgeStyle'
import { vueFlowEdgeTypeForSetting } from '@/utils/canvasEdgeType'
import { getModelPlatformBadge } from '@/utils/modelPlatformBadge'
import { apiService } from '@/services/apiService'
import { useCanvasLodLevel, useCanvasDragging } from '@/composables/useCanvasLodLevel'
import { useCanvasNodeCommon, useCanvasNodeTitle } from '@/composables/useCanvasNodeUiI18n'
import {
  parseStoryboardResult,
  normalizeStoryboardGridTexts as normalizeStoryboardGridTextsFromAi,
  computeGridShape,
  buildStoryboardFrames,
  resolveStoryboardFlowStartPosition,
  safeParseJsonObject,
  type AiStoryboardItem
} from '@/utils/canvasStoryboardAi'

interface ChapterItem {
  id: string
  title: string
  content: string
  selected?: boolean
}

interface AssetItem {
  id: string
  name: string
  description: string
  imageUrl?: string | null
  category?: AssetCategory
}

type AssetCategory = 'character' | 'scene' | 'prop'
interface GroupedAssets {
  character: AssetItem[]
  scene: AssetItem[]
  prop: AssetItem[]
}
const ASSET_TOTAL_NODE_OFFSET_X = 380
const ASSET_DETAIL_CHAIN_OFFSET_X = 80
const ASSET_CHAIN_COLUMN_STEP_X = 520
const ASSET_DETAIL_TO_IMAGE_GAP_Y = 360
const ASSET_CATEGORY_SECTION_GAP_Y = 220
const ASSET_IMAGE_NODE_HEIGHT = 300
const ASSET_CATEGORY_SECTION_SPAN_Y = ASSET_DETAIL_TO_IMAGE_GAP_Y + ASSET_IMAGE_NODE_HEIGHT

interface TextProcessNodeData {
  label: string
  type: string
  status?: 'pending' | 'running' | 'completed' | 'error'
  description?: string
  textContent?: string
  storyPrompt?: string
  toolbarExpanded?: boolean
  textModelGroup?: 'youshang' | 'flow2'
  textModel?: string
  chapters?: ChapterItem[]
  selectedChapterIds?: string[]
  chapterNodeId?: string
  totalAssetNodeId?: string
  assetReextractTrigger?: number
  nodeTitleI18n?: { key: string; params?: Record<string, string | number> }
  // 提示词选择
  selectedExtractAssetPromptId?: string
  selectedGenerateStoryboardPromptId?: string
  // 兼容历史数据（旧版三总资产节点）
  characterAssetNodeId?: string
  sceneAssetNodeId?: string
  propAssetNodeId?: string
}

interface Props {
  id: string
  selected?: boolean
  data: TextProcessNodeData
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
})

const { t, apiGroupLabelMap, notChosenModel, modelGroupFallback } = useCanvasNodeCommon()
const { canvasNodeDisplayTitle } = useCanvasNodeTitle()

const { updateNodeData: rawUpdateNodeData, addNodes, addEdges, findNode, removeNodes, edges } = useVueFlow()
const apiStore = useApiConfigStore()
const promptsStore = usePromptsStore()
const userStore = useUserStore()

const lodLevel = useCanvasLodLevel()
const lodIsShell = computed(() => lodLevel.value === 'shell')

const pushStateBeforeChange = inject<(() => void) | undefined>('canvasPushStateBeforeChange', undefined)
const scheduleCanvasAutoSave = inject<(() => void) | undefined>('scheduleCanvasAutoSave', undefined)

function updateNodeData(nodeId: string, data: Partial<TextProcessNodeData>) {
  rawUpdateNodeData(nodeId, data)
  scheduleCanvasAutoSave?.()
}

const textFileInputRef = ref<HTMLInputElement | null>(null)
const generatingStory = ref(false)
const extractingAssets = ref(false)
const textModelPopoverVisible = ref(false)
const textModelPanelGroup = ref<TextProcessNodeData['textModelGroup'] | null>(null)
const generatingStoryboards = ref(false)
const storyboardGenerateStartedAt = ref<number | null>(null)
const storyboardGenerateNow = ref(Date.now())
let storyboardGenerateTimer: number | null = null

const storyboardProgressPercent = computed(() => {
  if (!generatingStoryboards.value) return 0
  const startedAt = storyboardGenerateStartedAt.value ?? Date.now()
  const elapsed = Math.max(0, storyboardGenerateNow.value - startedAt)
  const duration = 60_000
  const progress = Math.min(elapsed / duration, 0.96)
  return Math.round(progress * 100)
})

function startStoryboardGeneratingFeedback() {
  storyboardGenerateStartedAt.value = Date.now()
  storyboardGenerateNow.value = Date.now()
  if (storyboardGenerateTimer !== null) {
    window.clearInterval(storyboardGenerateTimer)
  }
  storyboardGenerateTimer = window.setInterval(() => {
    storyboardGenerateNow.value = Date.now()
  }, 180)
}

function stopStoryboardGeneratingFeedback() {
  if (storyboardGenerateTimer !== null) {
    window.clearInterval(storyboardGenerateTimer)
    storyboardGenerateTimer = null
  }
  storyboardGenerateStartedAt.value = null
}

const statusColor = computed(() => {
  switch (props.data.status) {
    case 'running': return '#409eff'
    case 'completed': return '#67c23a'
    case 'error': return '#f56c6c'
    default: return '#909399'
  }
})

const textProcessHeaderTitle = computed(() =>
  canvasNodeDisplayTitle(props.data, 'canvas.nodeDefaults.textLabel', {
    preferFallbackOverPersisted: true
  })
)

const textModel = computed({
  get: () => props.data.textModel || apiStore.documentUploadModel || apiStore.textModels[0]?.id || '',
  set: (value: string) => updateNodeData(props.id, { textModel: value })
})
const mergedTextModelOptions = computed(() => {
  const m = apiGroupLabelMap.value
  return [
    { value: 'youshang', label: m.youshang, models: apiStore.textModels }
  ] as const
})
const currentTextModelGroupOption = computed(() => {
  const currentGroup = props.data.textModelGroup || 'youshang'
  return mergedTextModelOptions.value.find(group => group.value === currentGroup) || mergedTextModelOptions.value[0]
})
const activeTextModelGroup = computed(() => {
  const fallback = currentTextModelGroupOption.value?.value || 'youshang'
  return textModelPanelGroup.value || fallback
})
const panelTextModels = computed(() => {
  const hit = mergedTextModelOptions.value.find(item => item.value === activeTextModelGroup.value)
  return hit?.models || []
})
const panelTextModelsWithBadge = computed(() =>
  panelTextModels.value.map((model) => ({
    ...model,
    badge: getModelPlatformBadge(model.id, model.name)
  }))
)
const currentTextModelMeta = computed(() => {
  const group = currentTextModelGroupOption.value
  const hit = group.models.find(item => item.id === textModel.value) || group.models[0]
  return {
    modelName: hit?.name || notChosenModel(),
    groupLabel: group?.label || modelGroupFallback()
  }
})

// 提示词相关
const extractAssetPrompts = computed(() => promptsStore.getSubCategoryPrompts('extract-assets'))
const generateStoryboardPrompts = computed(() => promptsStore.getSubCategoryPrompts('generate-storyboard'))

const selectedExtractAssetPromptId = computed({
  get: () => props.data.selectedExtractAssetPromptId || '1',
  set: (value: string) => updateNodeData(props.id, { selectedExtractAssetPromptId: value })
})

const selectedGenerateStoryboardPromptId = computed({
  get: () => props.data.selectedGenerateStoryboardPromptId || '3',
  set: (value: string) => updateNodeData(props.id, { selectedGenerateStoryboardPromptId: value })
})

const textContent = ref(props.data.textContent ?? '')

watch(
  () => props.data.textContent,
  (value) => {
    const next = value ?? ''
    if (next !== textContent.value) {
      textContent.value = next
    }
  },
  { immediate: true }
)

const storyPrompt = computed({
  get: () => props.data.storyPrompt ?? '',
  set: (value: string) => updateNodeData(props.id, { storyPrompt: value })
})
const toolbarPromptPlaceholder = computed(() =>
  t('canvas.nodeUi.common.toolbarPromptPlaceholder')
)

const toolbarExpanded = computed({
  get: () => props.data.toolbarExpanded ?? false,
  set: (value: boolean) => updateNodeData(props.id, { toolbarExpanded: value })
})

const selectedChapterIds = computed(() => props.data.selectedChapterIds ?? [])

function ensureDefaults() {
  const patch: Partial<TextProcessNodeData> = {}
  const validTextModelIds = new Set(
    mergedTextModelOptions.value.flatMap(group => group.models.map(model => model.id))
  )
  const validExtractPromptIds = new Set(extractAssetPrompts.value.map(prompt => prompt.id))
  const validStoryboardPromptIds = new Set(generateStoryboardPrompts.value.map(prompt => prompt.id))
  const fallbackModel = apiStore.documentUploadModel || apiStore.textModels[0]?.id || ''
  if (!props.data.textModelGroup) patch.textModelGroup = 'youshang'
  if (!props.data.textModel || !validTextModelIds.has(props.data.textModel)) {
    if (fallbackModel) patch.textModel = fallbackModel
  }
  if (!props.data.selectedExtractAssetPromptId || !validExtractPromptIds.has(props.data.selectedExtractAssetPromptId)) {
    patch.selectedExtractAssetPromptId = extractAssetPrompts.value[0]?.id || '1'
  }
  if (!props.data.selectedGenerateStoryboardPromptId || !validStoryboardPromptIds.has(props.data.selectedGenerateStoryboardPromptId)) {
    patch.selectedGenerateStoryboardPromptId = generateStoryboardPrompts.value[0]?.id || '3'
  }
  if (props.data.toolbarExpanded === undefined) patch.toolbarExpanded = false
  if (!props.data.chapters) patch.chapters = []
  if (!props.data.selectedChapterIds) patch.selectedChapterIds = []
  if (Object.keys(patch).length > 0) updateNodeData(props.id, patch)
}

onMounted(() => {
  ensureDefaults()
})

onBeforeUnmount(() => {
  stopStoryboardGeneratingFeedback()
})

function expandToolbar() {
  toolbarExpanded.value = true
}

function onTextModelPopoverShow() {
  textModelPanelGroup.value = (props.data.textModelGroup || 'youshang') as TextProcessNodeData['textModelGroup']
  const validTextModelIds = new Set(
    mergedTextModelOptions.value.flatMap(group => group.models.map(model => model.id))
  )
  if (!textModel.value || !validTextModelIds.has(textModel.value)) {
    textModel.value = apiStore.documentUploadModel || apiStore.textModels[0]?.id || ''
  }
}

function selectTextModelGroup(group: TextProcessNodeData['textModelGroup']) {
  textModelPanelGroup.value = group
  updateNodeData(props.id, { textModelGroup: group })
  const groupModels = mergedTextModelOptions.value.find(item => item.value === group)?.models || []
  if (groupModels.length === 0) return
  if (!groupModels.some(item => item.id === textModel.value)) {
    textModel.value = groupModels[0]?.id || ''
  }
}

function selectTextModel(modelId: string) {
  textModel.value = modelId
  updateNodeData(props.id, { textModelGroup: activeTextModelGroup.value })
  textModelPopoverVisible.value = false
}

function openUploadDialog() {
  textFileInputRef.value?.click()
}

function onTextFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const lowerName = file.name.toLowerCase()
  if (!lowerName.endsWith('.txt') && !lowerName.endsWith('.md')) {
    ElMessage.warning(t('canvas.nodeUi.textProcess.warnTxtMdOnly'))
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const content = String(reader.result ?? '')
    pushStateBeforeChange?.()
    updateNodeData(props.id, {
      textContent: content,
      status: 'completed'
    })
    ElMessage.success(t('canvas.nodeUi.textProcess.txtUploadOk'))
  }
  reader.onerror = () => ElMessage.error(t('canvas.nodeUi.textProcess.txtReadFail'))
  reader.readAsText(file, 'utf-8')
}

function splitChapters(text: string): ChapterItem[] {
  const lines = text.split('\n')
  const chapterList: ChapterItem[] = []
  let currentChapter: { title: string; content: string[] } | null = null
  const chapterRegex = /^(?:第\s*)?([0-9０-９零一二三四五六七八九十百千万〇]+)\s*[章节回节部卷集]\s*([^\n\r]*?)\s*$/
  const pureNumRegex = /^(?:第\s*)?(\d{1,4})[\.\s、：:]\s*([^\n\r]*?)\s*$/
  const englishRegex = /^(?:chapter|ch\.?)\s*(\d+)\s*[:\-]?\s*([^\n\r]*)$/i

  const isChapterTitle = (line: string): boolean => {
    const trimmed = line.trim()
    if (!trimmed) return false
    return chapterRegex.test(trimmed) || pureNumRegex.test(trimmed) || englishRegex.test(trimmed)
  }

  for (const line of lines) {
    if (isChapterTitle(line)) {
      if (currentChapter) {
        chapterList.push({
          id: `chapter_${chapterList.length + 1}`,
          title: currentChapter.title,
          content: currentChapter.content.join('\n'),
          selected: false
        })
      }
      currentChapter = { title: line.trim(), content: [] }
    } else if (currentChapter) {
      currentChapter.content.push(line)
    }
  }

  if (currentChapter) {
    chapterList.push({
      id: `chapter_${chapterList.length + 1}`,
      title: currentChapter.title,
      content: currentChapter.content.join('\n'),
      selected: false
    })
  }

  if (chapterList.length === 0 && text.trim()) {
    chapterList.push({
      id: 'chapter_1',
      title: t('canvas.nodeUi.textProcess.chapterUnknownTitle'),
      content: text.trim(),
      selected: false
    })
  }
  return chapterList
}

function ensureChapterNode(chapters: ChapterItem[]) {
  const selfNode = findNode(props.id)
  if (!selfNode) return

  const nextChapterNodeId = props.data.chapterNodeId || `text-chapter-${Date.now()}`
  const targetX = selfNode.position.x + (selfNode.dimensions?.width ?? 430) + 40
  const targetY = selfNode.position.y
  const exists = Boolean(findNode(nextChapterNodeId))

  if (!exists) {
    addNodes({
      id: nextChapterNodeId,
      type: 'textChapterResult',
      position: { x: targetX, y: targetY },
      data: {
        label: t('canvas.nodeUi.textProcess.chapterDetectLabel'),
        type: 'textChapterResult',
        status: 'completed',
        sourceNodeId: props.id,
        chapters,
        nodeTitleI18n: { key: 'canvas.nodeUi.textProcess.chapterDetectLabel' }
      }
    })
    addEdges({
      id: `e-${props.id}-${nextChapterNodeId}-${Date.now()}`,
      source: props.id,
      target: nextChapterNodeId,
      animated: true,
      type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
      style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
    })
  } else {
    updateNodeData(nextChapterNodeId, {
      status: 'completed',
      sourceNodeId: props.id,
      chapters
    })
  }

  updateNodeData(props.id, { chapterNodeId: nextChapterNodeId })
}

function handleExtractChapters() {
  const content = textContent.value.trim()
  if (!content) {
    ElMessage.warning(t('canvas.nodeUi.textProcess.noContentForChapter'))
    return
  }
  const chapters = splitChapters(content)
  pushStateBeforeChange?.()
  updateNodeData(props.id, {
    chapters,
    selectedChapterIds: [],
    status: 'completed'
  })
  ensureChapterNode(chapters)
  ElMessage.success(t('canvas.nodeUi.textProcess.chapterParsed', { count: chapters.length }))
}

function getExtractionSourceText(): string {
  const chapters = props.data.chapters ?? []
  const selectedSet = new Set(selectedChapterIds.value)
  if (selectedSet.size > 0) {
    return chapters
      .filter(chapter => selectedSet.has(chapter.id))
      .map(chapter => `${chapter.title}\n${chapter.content}`)
      .join('\n\n')
  }
  return textContent.value.trim()
}

function buildAssetNodeData(sourceNodeId: string) {
  return {
    label: t('canvas.nodeUi.textProcess.totalAssetsLabel'),
    type: 'textAssetResult',
    status: 'running' as const,
    description: t('canvas.nodeUi.textProcess.totalAssetsDesc'),
    sourceNodeId,
    nodeTitleI18n: { key: 'canvas.nodeUi.textProcess.totalAssetsLabel' },
    assets: [] as AssetItem[],
    groupedAssets: {
      character: [] as AssetItem[],
      scene: [] as AssetItem[],
      prop: [] as AssetItem[]
    },
    groupCollapse: {
      character: false,
      scene: false,
      prop: false
    }
  }
}

function removeLegacyAssetTotalNodes() {
  const legacyIds = [
    props.data.characterAssetNodeId,
    props.data.sceneAssetNodeId,
    props.data.propAssetNodeId
  ]
    .filter((id): id is string => Boolean(id))
  if (!legacyIds.length) return
  const uniqueIds = Array.from(new Set(legacyIds))
  removeNodes(uniqueIds)
}

function ensureTotalAssetNode(
  nodeId: string | undefined,
  targetX: number,
  targetY: number
): string {
  const nextId = nodeId || `text-asset-total-${Date.now()}`
  const exists = Boolean(findNode(nextId))
  if (!exists) {
    addNodes({
      id: nextId,
      type: 'textAssetResult',
      position: { x: targetX, y: targetY },
      data: buildAssetNodeData(props.id)
    })
    addEdges({
      id: `e-${props.id}-${nextId}-${Date.now()}`,
      source: props.id,
      target: nextId,
      animated: true,
      type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
      style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
    })
  } else {
    updateNodeData(nextId, buildAssetNodeData(props.id))
  }
  return nextId
}

function upsertAssetNodesAsWaiting() {
  const selfNode = findNode(props.id)
  if (!selfNode) return null
  removeLegacyAssetTotalNodes()
  const rightX = selfNode.position.x + (selfNode.dimensions?.width ?? 430) + ASSET_TOTAL_NODE_OFFSET_X
  const baseY = selfNode.position.y
  const totalAssetNodeId = ensureTotalAssetNode(props.data.totalAssetNodeId, rightX, baseY)

  updateNodeData(props.id, {
    totalAssetNodeId,
    characterAssetNodeId: undefined,
    sceneAssetNodeId: undefined,
    propAssetNodeId: undefined
  })

  return { totalAssetNodeId }
}

function buildAssetImagePrompt(name: string, description: string) {
  const n = String(name ?? '').trim()
  const d = String(description ?? '').trim()
  return [
    n ? `${t('canvas.nodeUi.textProcess.assetNamePrefix')}${n}` : '',
    d ? `${t('canvas.nodeUi.textProcess.assetDescPrefix')}${d}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

function resolveAssetDetailNodeLabel(category: AssetCategory): string {
  if (category === 'character') return t('canvas.nodeUi.textProcess.assetCatCharacterLabel')
  if (category === 'scene') return t('canvas.nodeUi.textProcess.assetCatSceneLabel')
  return t('canvas.nodeUi.textProcess.assetCatPropLabel')
}

function assetDetailNodeTitleKey(category: AssetCategory):
  | 'canvas.nodeUi.textProcess.assetCatCharacterLabel'
  | 'canvas.nodeUi.textProcess.assetCatSceneLabel'
  | 'canvas.nodeUi.textProcess.assetCatPropLabel' {
  if (category === 'character') return 'canvas.nodeUi.textProcess.assetCatCharacterLabel'
  if (category === 'scene') return 'canvas.nodeUi.textProcess.assetCatSceneLabel'
  return 'canvas.nodeUi.textProcess.assetCatPropLabel'
}

function removeExistingAssetDetailChains(totalNodeId: string) {
  const removableIds = new Set<string>()
  edges.value.forEach((edge) => {
    if (edge.source !== totalNodeId) return
    const detailNode = findNode(edge.target)
    if (!detailNode || detailNode.type !== 'textAssetDetail') return
    if (!(detailNode.data as any)?.generatedByTextProcess) return
    removableIds.add(detailNode.id)
    const linkedImageNodeId = String((detailNode.data as any)?.linkedImageNodeId ?? '').trim()
    if (linkedImageNodeId) {
      removableIds.add(linkedImageNodeId)
    }
  })
  if (removableIds.size > 0) {
    removeNodes(Array.from(removableIds))
  }
}

function createGroupedAssetDetailChains(totalNodeId: string, groupedAssets: GroupedAssets) {
  removeExistingAssetDetailChains(totalNodeId)
  const totalNode = findNode(totalNodeId)
  const textProcessNode = findNode(props.id)
  if (!totalNode) return
  const baseX = totalNode.position.x + (totalNode.dimensions?.width ?? 300) + ASSET_DETAIL_CHAIN_OFFSET_X
  const categories: AssetCategory[] = ['character', 'scene', 'prop']
  const textCenterY = (textProcessNode?.position.y ?? totalNode.position.y)
    + ((textProcessNode?.dimensions?.height ?? 360) / 2)
  const categoryCenterOffsetY = ASSET_CATEGORY_SECTION_SPAN_Y / 2
  const sceneDetailY = textCenterY - categoryCenterOffsetY
  const sectionStartByCategory: Record<AssetCategory, number> = {
    character: sceneDetailY - ASSET_CATEGORY_SECTION_SPAN_Y - ASSET_CATEGORY_SECTION_GAP_Y,
    scene: sceneDetailY,
    prop: sceneDetailY + ASSET_CATEGORY_SECTION_SPAN_Y + ASSET_CATEGORY_SECTION_GAP_Y
  }
  const now = Date.now()

  categories.forEach((category) => {
    const assets = groupedAssets[category] ?? []
    if (assets.length === 0) return
    const detailY = sectionStartByCategory[category]
    const imageY = detailY + ASSET_DETAIL_TO_IMAGE_GAP_Y
    assets.forEach((asset, index) => {
      const assetName =
        String(asset.name ?? '').trim() ||
        t('canvas.nodeUi.textProcess.assetTpl', { n: index + 1 })
      const assetDescription = String(asset.description ?? '').trim()
      const detailNodeId = `asset-detail-${category}-${now}-${index}`
      const imageNodeId = `asset-image-${category}-${now}-${index}`
      const columnX = baseX + (index * ASSET_CHAIN_COLUMN_STEP_X)

      addNodes({
        id: detailNodeId,
        type: 'textAssetDetail',
        position: { x: columnX, y: detailY },
        data: {
          label: resolveAssetDetailNodeLabel(category),
          type: 'textAssetDetail',
          status: 'completed',
          description: t('canvas.nodeUi.textProcess.detailDesc'),
          assetCategory: category,
          assetName,
          assetDescription,
          linkedImageNodeId: imageNodeId,
          generatedByTextProcess: true,
          nodeTitleI18n: { key: assetDetailNodeTitleKey(category) }
        }
      })

      addEdges({
        id: `e-${totalNodeId}-${detailNodeId}-${now}-${index}`,
        source: totalNodeId,
        target: detailNodeId,
        animated: true,
        type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
        style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
      })

      addNodes({
        id: imageNodeId,
        type: 'imageCanvas',
        position: { x: columnX, y: imageY },
        data: {
          label: t('canvas.nodeUi.textProcess.assetImageLabelTpl', { name: assetName }),
          type: 'image',
          status: 'pending',
          description: t('canvas.nodeUi.textProcess.assetImageGenDescTpl', { name: assetName }),
          prompt: buildAssetImagePrompt(assetName, assetDescription),
          referenceImages: [],
          uploadedMainImageUrl: null,
          generatedImageUrl: null,
          toolbarExpanded: false,
          imageQuality: '1K',
          aspectRatio: '16:9',
          imageModelGroup: apiStore.imageModelGroup,
          imageModel: apiStore.imageModel,
          assetCategory: category,
          sourceAssetDetailNodeId: detailNodeId,
          generatedByTextProcess: true,
          nodeTitleI18n: {
            key: 'canvas.nodeUi.textProcess.assetImageLabelTpl',
            params: { name: assetName }
          }
        }
      })

      addEdges({
        id: `e-${detailNodeId}-${imageNodeId}-${now}-${index}`,
        source: detailNodeId,
        target: imageNodeId,
        animated: true,
        type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
        style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
      })
    })
  })
}

function normalizeStoryboardGridTexts(item: AiStoryboardItem): string[] {
  return normalizeStoryboardGridTextsFromAi(item, t('canvas.nodeUi.textProcess.sbGridPlaceholder'))
}

function resolveStoryboardStartPosition(selfNode: {
  position: { x: number; y: number }
  dimensions?: { width?: number; height?: number }
}) {
  return resolveStoryboardFlowStartPosition({
    findNode,
    edges: edges.value,
    totalAssetNodeId: props.data.totalAssetNodeId,
    selfNode,
    assetDetailChainOffsetX: ASSET_DETAIL_CHAIN_OFFSET_X,
    assetCategorySectionGapY: ASSET_CATEGORY_SECTION_GAP_Y,
    assetImageNodeHeight: ASSET_IMAGE_NODE_HEIGHT
  })
}

async function handleGenerateStoryboardNodes(promptId: string = selectedGenerateStoryboardPromptId.value) {
  const selectedChapters = (props.data.chapters ?? []).filter(chapter => selectedChapterIds.value.includes(chapter.id))
  const sourceText = selectedChapters.length > 0
    ? selectedChapters.map(chapter => `${chapter.title}\n${chapter.content}`).join('\n\n')
    : textContent.value.trim()
  if (!sourceText) {
    ElMessage.warning(t('canvas.nodeUi.textProcess.noChapterForSb'))
    return
  }
  const tg = props.data.textModelGroup || 'youshang'
  if (!apiStore.isApiReadyForGroup(tg)) {
    ElMessage.warning(
      tg === 'flow2' ? t('settings.msg.enterApiUrlFirst') : t('canvas.nodeUi.textProcess.needApiFirst')
    )
    return
  }

  const selfNode = findNode(props.id)
  if (!selfNode) {
    ElMessage.warning(t('canvas.nodeUi.textProcess.noSelfNodeSb'))
    return
  }

  generatingStoryboards.value = true
  startStoryboardGeneratingFeedback()
  updateNodeData(props.id, { status: 'running' })
  try {
    const selectedCount = selectedChapters.length
    const chapterConstraint =
      selectedCount > 0
        ? t('canvas.nodeUi.textProcess.sbChapterConstraint', { count: selectedCount })
        : ''

    const selectedPrompt = promptsStore.getPromptById(promptId)
    let promptContent = selectedPrompt?.content || promptsStore.getGenerateStoryboardPrompt()

    if (selectedPrompt?.isCustom) {
      promptContent = `${promptContent}\n\n${promptsStore.getGenerateStoryboardStandardConstraint()}`
    }

    const generatePrompt = `${promptContent}${t('canvas.nodeUi.textProcess.sbPromptNovelLabel')}${sourceText}\n\n${t('canvas.nodeUi.textProcess.sbPromptFollow')}${chapterConstraint}`

    const cfg = apiStore.configForModelGroup(tg)
    let storyboardMaxTokens: number | undefined
    if (
      selectedCount >= 2 &&
      !cfg.unlimitedTokens &&
      typeof cfg.maxTokens === 'number' &&
      cfg.maxTokens > 0
    ) {
      storyboardMaxTokens = Math.min(32768, cfg.maxTokens * Math.min(4, selectedCount))
    }

    const result = await apiService.generateText(generatePrompt, {
      model: textModel.value,
      systemPrompt: t('canvas.nodeUi.textProcess.sbSystemPrompt'),
      ...(storyboardMaxTokens ? { maxTokens: storyboardMaxTokens } : {}),
      modelGroup: tg
    })

    const storyboardItems = parseStoryboardResult(result)
    if (!storyboardItems.length) {
      throw new Error(t('canvas.nodeUi.textProcess.sbAiNoParsed'))
    }

    if (selectedCount > 0 && storyboardItems.length < selectedCount) {
      ElMessage.warning(
        t('canvas.nodeUi.textProcess.sbWarnTooFew', {
          got: storyboardItems.length,
          need: selectedCount
        })
      )
    }

    const storyboardStart = resolveStoryboardStartPosition(selfNode)
    const baseX = storyboardStart.x
    const baseY = storyboardStart.y
    const verticalGap = 460
    const now = Date.now()

    pushStateBeforeChange?.()

    storyboardItems.forEach((item, index) => {
      const gridTextsRaw = normalizeStoryboardGridTexts(item)
      const gridTexts = gridTextsRaw.slice(0, 36)
      const shape = computeGridShape(gridTexts.length)
      const frames = buildStoryboardFrames(gridTexts, shape.rows, shape.cols)
      const nodeId = `storyboard-gen-${now}-${index}`
      const nodeLabel =
        String(item.title || t('canvas.nodeUi.textProcess.totalNodeLabel', { n: index + 1 })).trim() ||
        t('canvas.nodeUi.textProcess.totalNodeLabel', { n: index + 1 })

      addNodes({
        id: nodeId,
        type: 'storyboardGen',
        position: {
          x: baseX,
          y: baseY + (index * verticalGap)
        },
        data: {
          label: nodeLabel,
          storyboardSequence: index + 1,
          storyboardTitle: nodeLabel,
          type: 'storyboard',
          status: 'pending',
          description: t('canvas.nodeUi.textProcess.sbNodeDesc'),
          toolbarExpanded: false,
          gridRows: shape.rows,
          gridCols: shape.cols,
          frames,
          storyboardPrompt: '',
          referenceImages: [],
          generatedImageUrl: null,
          imageQuality: '1K',
          aspectRatio: '16:9',
          imageModelGroup: apiStore.imageModelGroup,
          imageModel: apiStore.imageModel
        }
      })

      addEdges({
        id: `e-${props.id}-${nodeId}-${now}`,
        source: props.id,
        target: nodeId,
        animated: true,
        type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
        style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
      })
    })

    updateNodeData(props.id, { status: 'completed' })
    ElMessage.success(
      t('canvas.nodeUi.textProcess.genSbOk', { count: storyboardItems.length })
    )
  } catch (error) {
    updateNodeData(props.id, { status: 'error' })
    ElMessage.error(
      error instanceof Error ? error.message : t('canvas.nodeUi.textProcess.genSbFail')
    )
  } finally {
    generatingStoryboards.value = false
    stopStoryboardGeneratingFeedback()
  }
}

function showExtractAssetDialog() {
  const selfNode = findNode(props.id)
  if (!selfNode) return
  
  const rightX = selfNode.position.x + (selfNode.dimensions?.width ?? 430) + 60
  const templateNodeId = `asset-extract-template-${Date.now()}`
  
  addNodes({
    id: templateNodeId,
    type: 'assetExtractTemplate',
    position: { x: rightX, y: selfNode.position.y },
    data: {
      label: t('canvas.nodeUi.textProcess.assetExtractTemplateLabel'),
      type: 'assetExtract',
      status: 'pending',
      textProcessNodeId: props.id,
      selectedExtractAssetPromptId: props.data.selectedExtractAssetPromptId || '1'
    }
  })

  addEdges({
    id: `e-${props.id}-${templateNodeId}`,
    source: props.id,
    target: templateNodeId,
    type: vueFlowEdgeTypeForSetting(userStore.edgeStyle)
  })
}

function showStoryboardTemplateDialog() {
  const selfNode = findNode(props.id)
  if (!selfNode) return
  
  const rightX = selfNode.position.x + (selfNode.dimensions?.width ?? 430) + 60
  const templateNodeId = `storyboard-template-${Date.now()}`
  
  addNodes({
    id: templateNodeId,
    type: 'storyboardTemplate',
    position: { x: rightX, y: selfNode.position.y },
    data: {
      label: t('canvas.nodeUi.textProcess.storyboardTemplateLabel'),
      type: 'storyboard',
      status: 'pending',
      textProcessNodeId: props.id,
      selectedGenerateStoryboardPromptId: props.data.selectedGenerateStoryboardPromptId || '3'
    }
  })

  addEdges({
    id: `e-${props.id}-${templateNodeId}`,
    source: props.id,
    target: templateNodeId,
    type: vueFlowEdgeTypeForSetting(userStore.edgeStyle)
  })
}

async function handleExtractAssets(promptId: string = selectedExtractAssetPromptId.value) {
  const sourceText = getExtractionSourceText()
  if (!sourceText) {
    ElMessage.warning(t('canvas.nodeUi.textProcess.noContentAssets'))
    return
  }
  const tg = props.data.textModelGroup || 'youshang'
  if (!apiStore.isApiReadyForGroup(tg)) {
    ElMessage.warning(
      tg === 'flow2' ? t('settings.msg.enterApiUrlFirst') : t('canvas.nodeUi.textProcess.needApiFirst')
    )
    return
  }

  const nodeIds = upsertAssetNodesAsWaiting()
  if (!nodeIds) return
  extractingAssets.value = true
  updateNodeData(props.id, { status: 'running' })

  const selectedPrompt = promptsStore.getPromptById(promptId)
  let promptContent = selectedPrompt?.content || promptsStore.getExtractAssetsPrompt()

  if (selectedPrompt?.isCustom) {
    promptContent = `${promptContent}\n\n${promptsStore.getExtractAssetsStandardConstraint()}`
  }

  const extractPromptBody = '\n\n请提取所有重要的人物、场景和道具。\n只返回 JSON，格式如下：\n{\n  "characters": [{ "name": "人物名", "description": "人物描述" }],\n  "scenes": [{ "name": "场景名", "description": "场景描述" }],\n  "props": [{ "name": "道具名", "description": "道具描述" }]\n}'
  const extractPrompt = `${promptContent}${t('canvas.nodeUi.textProcess.extractPromptNovelLabel')}${sourceText}${extractPromptBody}`

  try {
    const result = await apiService.generateText(extractPrompt, {
      model: textModel.value,
      systemPrompt: t('canvas.nodeUi.textProcess.extractSystemPrompt'),
      modelGroup: tg
    })
    const parsed = safeParseJsonObject(result) as Record<string, unknown> | null
    if (!parsed) {
      throw new Error(t('canvas.nodeUi.textProcess.aiAssetsJsonFail'))
    }

    const characters: AssetItem[] = (Array.isArray(parsed.characters) ? parsed.characters : []).map(
      (item: unknown, index: number) => {
        const row = item as { name?: unknown; description?: unknown }
        return {
          id: `char_${Date.now()}_${index}`,
          name: String(row.name || t('canvas.nodeUi.textProcess.fallbackCharName', { n: index + 1 })),
          description: String(row.description || ''),
          imageUrl: null,
          category: 'character' as const
        }
      }
    )
    const scenes: AssetItem[] = (Array.isArray(parsed.scenes) ? parsed.scenes : []).map((item: unknown, index: number) => {
      const row = item as { name?: unknown; description?: unknown }
      return {
        id: `scene_${Date.now()}_${index}`,
        name: String(row.name || t('canvas.nodeUi.textProcess.fallbackSceneName', { n: index + 1 })),
        description: String(row.description || ''),
        imageUrl: null,
        category: 'scene' as const
      }
    })
    const propsAssets: AssetItem[] = (Array.isArray(parsed.props) ? parsed.props : []).map((item: unknown, index: number) => {
      const row = item as { name?: unknown; description?: unknown }
      return {
        id: `prop_${Date.now()}_${index}`,
        name: String(row.name || t('canvas.nodeUi.textProcess.fallbackPropName', { n: index + 1 })),
        description: String(row.description || ''),
        imageUrl: null,
        category: 'prop' as const
      }
    })
    const groupedAssets: GroupedAssets = {
      character: characters,
      scene: scenes,
      prop: propsAssets
    }
    const flattenedAssets = [...characters, ...scenes, ...propsAssets]

    pushStateBeforeChange?.()
    updateNodeData(nodeIds.totalAssetNodeId, {
      status: 'completed',
      assets: flattenedAssets,
      groupedAssets
    })
    createGroupedAssetDetailChains(nodeIds.totalAssetNodeId, groupedAssets)
    updateNodeData(props.id, { status: 'completed' })

    ElMessage.success(
      t('canvas.nodeUi.textProcess.assetsOk', {
        a: characters.length,
        b: scenes.length,
        c: propsAssets.length
      })
    )
  } catch (error) {
    updateNodeData(nodeIds.totalAssetNodeId, { status: 'error' })
    updateNodeData(props.id, { status: 'error' })
    ElMessage.error(
      error instanceof Error ? error.message : t('canvas.nodeUi.textProcess.assetsFail')
    )
  } finally {
    extractingAssets.value = false
  }
}

async function handleGenerateStory() {
  const prompt = storyPrompt.value.trim()
  if (!prompt) {
    ElMessage.warning(t('canvas.nodeUi.textProcess.needPlotPrompt'))
    return
  }
  const tg = props.data.textModelGroup || 'youshang'
  if (!apiStore.isApiReadyForGroup(tg)) {
    ElMessage.warning(
      tg === 'flow2' ? t('settings.msg.enterApiUrlFirst') : t('canvas.nodeUi.textProcess.needApiFirst')
    )
    return
  }
  generatingStory.value = true
  updateNodeData(props.id, { status: 'running' })
  try {
    const result = await apiService.generateText(prompt, {
      model: textModel.value,
      systemPrompt: t('canvas.nodeUi.textProcess.plotSystemPrompt'),
      modelGroup: tg
    })
    pushStateBeforeChange?.()
    updateNodeData(props.id, {
      textContent: result,
      status: 'completed'
    })
    ElMessage.success(t('canvas.nodeUi.textProcess.plotOk'))
  } catch (error) {
    updateNodeData(props.id, { status: 'error' })
    ElMessage.error(error instanceof Error ? error.message : t('canvas.nodeUi.textProcess.plotFail'))
  } finally {
    generatingStory.value = false
  }
}

watch(
  () => props.data.assetReextractTrigger,
  (next, prev) => {
    if (next === undefined || next === prev) return
    if (extractingAssets.value) return
    handleExtractAssets()
  }
)
</script>

<template>
  <div class="text-process-node-root">
    <Handle type="target" :position="Position.Left" class="handle handle-target" />
    <div class="text-process-node" :class="{ 'is-selected': selected }" @mousedown="expandToolbar">
      <div class="node-header">
        <el-icon class="node-type-icon node-type-icon--text"><Document /></el-icon>
        <span class="node-label">{{ textProcessHeaderTitle }}</span>
      </div>

      <div
        v-if="lodIsShell"
        class="text-process-lod-shell nodrag nopan"
      >
        <el-icon class="text-process-lod-icon"><Document /></el-icon>
        <div class="text-process-lod-lines">
          <span class="text-process-lod-title">{{ textProcessHeaderTitle }}</span>
          <span class="text-process-lod-sub">{{ t('canvas.nodeUi.textProcess.lodSub') }}</span>
        </div>
      </div>

      <template v-else>
      <div class="node-body nodrag nopan">
        <div class="text-area-wrap" @wheel.stop>
          <el-input
            v-model="textContent"
            type="textarea"
            :rows="8"
            :placeholder="t('canvas.nodeUi.textProcess.mainPh')"
            class="text-area"
            :disabled="generatingStory"
            @wheel.stop
            @input="(value) => updateNodeData(props.id, { textContent: String(value ?? '') })"
          />
          <transition name="fade-overlay">
            <div v-if="generatingStory" class="text-area-loading-overlay" aria-live="polite" aria-busy="true">
              <div class="text-area-loading-panel">
                <div class="text-area-loading-spinner" />
                <div class="text-area-loading-text">{{ t('canvas.nodeUi.textProcess.genStoryRunning') }}</div>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <div class="node-actions nodrag nopan">
        <button type="button" class="node-action-btn" @click.stop="openUploadDialog">
          <el-icon><Upload /></el-icon>
          <span>{{ t('canvas.nodeUi.textProcess.uploadText') }}</span>
        </button>
        <button type="button" class="node-action-btn" @click.stop="handleExtractChapters">
          <el-icon><Tickets /></el-icon>
          <span>{{ t('canvas.nodeUi.textProcess.parseChapters') }}</span>
        </button>
        <button
          type="button"
          class="node-action-btn"
          :disabled="extractingAssets"
          @click.stop="handleExtractAssets"
        >
          <el-icon><Box /></el-icon>
          <span>{{ extractingAssets ? t('canvas.nodeUi.textProcess.extractingAssets') : t('canvas.nodeUi.textProcess.extractAssets') }}</span>
        </button>
        <button
          type="button"
          class="node-action-btn"
          :disabled="generatingStoryboards"
          @click.stop="handleGenerateStoryboardNodes"
        >
          <el-icon :class="{ 'is-spinning': generatingStoryboards }"><Promotion /></el-icon>
          <span>{{ generatingStoryboards ? t('canvas.nodeUi.textProcess.genStoryboardsRunning') : t('canvas.nodeUi.textProcess.genStoryboards') }}</span>
        </button>
      </div>

      </template>

      <transition name="fade-overlay">
        <div v-if="generatingStoryboards" class="storyboard-generating-overlay nodrag nopan">
          <div class="storyboard-generating-panel">
            <div class="storyboard-generating-title">{{ t('canvas.nodeUi.textProcess.sbOverlayTitle') }}</div>
            <div class="storyboard-generating-desc">{{ t('canvas.nodeUi.textProcess.sbOverlayDesc') }}</div>
            <div class="storyboard-generating-progress">
              <div class="storyboard-generating-progress-bar" :style="{ width: `${storyboardProgressPercent}%` }" />
            </div>
            <div class="storyboard-generating-meta">{{ t('canvas.nodeUi.textProcess.sbOverlayMeta', { p: storyboardProgressPercent }) }}</div>
          </div>
        </div>
      </transition>

      <div class="node-status" :style="{ backgroundColor: statusColor }" />
    </div>
    <Handle type="source" :position="Position.Right" class="handle handle-source" />

    <input
      ref="textFileInputRef"
      type="file"
      accept=".txt,.md,text/plain"
      style="display: none"
      @change="onTextFileChange"
    >

    <transition name="fade-slide">
      <div v-if="toolbarExpanded && !lodIsShell" class="node-float-bottom text-toolbar nodrag nopan">
        <div
          role="group"
          class="prompt-toolbar-group"
          :aria-label="t('canvas.nodeUi.common.promptToolbarAria')"
        >
        <div class="toolbar-row">
          <el-input
            v-model="storyPrompt"
            type="textarea"
            :rows="4"
            :placeholder="toolbarPromptPlaceholder"
            @wheel.stop
          />
        </div>
        </div>
        <div class="toolbar-row toolbar-actions">
          <el-popover
            v-model:visible="textModelPopoverVisible"
            placement="top-start"
            :width="360"
            trigger="click"
            popper-class="text-node-model-popover"
            @show="onTextModelPopoverShow"
          >
            <template #reference>
              <button type="button" class="model-chip nodrag nopan">
                <span class="model-chip-name">{{ currentTextModelMeta.modelName }}</span>
                <span class="model-chip-group">{{ currentTextModelMeta.groupLabel }}</span>
              </button>
            </template>
            <div class="model-panel">
              <div class="model-panel-label">{{ t('canvas.nodeUi.common.supplier') }}</div>
              <div class="provider-group">
                <button
                  v-for="group in mergedTextModelOptions"
                  :key="group.value"
                  type="button"
                  class="provider-btn"
                  :class="{ active: activeTextModelGroup === group.value }"
                  @click="selectTextModelGroup(group.value)"
                >
                  {{ group.label }}
                </button>
              </div>
              <div class="model-panel-label">{{ t('canvas.nodeUi.common.model') }}</div>
              <div class="model-group">
                <button
                  v-for="model in panelTextModelsWithBadge"
                  :key="model.id"
                  type="button"
                  class="model-btn"
                  :class="{ active: textModel === model.id }"
                  @click="selectTextModel(model.id)"
                >
                  <span class="model-btn-icon" :class="`platform-${model.badge.key}`">
                    <svg v-if="model.badge.key === 'kling'" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                      <path d="M5.4 13.8A23.2 23.2 0 017.4 9.3c3.2-5.5 7.8-8.8 10.3-7.3C12-1.3 4.6 1 1.1 7a13.4 13.4 0 00-1 2.2c-.3.8.1 1.6.8 2l4.6 2.6z" fill="#04A6F0"></path>
                      <path d="M18.6 10.2a23.2 23.2 0 01-2 4.5c-3.2 5.5-7.8 8.8-10.3 7.3 5.7 3.3 13.1 1.1 16.6-4.9a13.4 13.4 0 001-2.3c.3-.8-.1-1.6-.8-2l-4.5-2.6z" fill="#0DF35E"></path>
                      <path d="M16.6 14.6c3.2-5.5 3.7-11.1 1.2-12.6C15.2.6 10.6 3.8 7.4 9.3c2-3.6 5.8-5.3 8.3-3.8 2.6 1.5 2.9 5.6.9 9.1z" fill="#003EFF"></path>
                      <path d="M7.4 9.3c-3.2 5.5-3.7 11.1-1.2 12.6 2.6 1.5 7.2-1.8 10.4-7.3-2.1 3.6-5.9 5.3-8.4 3.9-2.5-1.4-2.9-5.6-.8-9.2z" fill="#0BFFE7"></path>
                    </svg>
                    <svg v-else-if="model.badge.key === 'jimeng'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;">
                      <path d="M5.31 15.756c.172-3.75 1.883-5.999 2.549-6.739-3.26 2.058-5.425 5.658-6.358 8.308v1.12C1.501 21.513 4.226 24 7.59 24a6.59 6.59 0 002.2-.375c.353-.12.7-.248 1.039-.378.913-.899 1.65-1.91 2.243-2.992-4.877 2.431-7.974.072-7.763-4.5l.002.001z" fill="#1E37FC"/>
                      <path d="M22.57 10.283c-1.212-.901-4.109-2.404-7.397-2.8.295 3.792.093 8.766-2.1 12.773a12.782 12.782 0 01-2.244 2.992c3.764-1.448 6.746-3.457 8.596-5.219 2.82-2.683 3.353-5.178 3.361-6.66a2.737 2.737 0 00-.216-1.084v-.002z" fill="#37E1BE"/>
                      <path d="M14.303 1.867C12.955.7 11.248 0 9.39 0 7.532 0 5.883.677 4.545 1.807 2.791 3.29 1.627 5.557 1.5 8.125v9.201c.932-2.65 3.097-6.25 6.357-8.307.5-.318 1.025-.595 1.569-.829 1.883-.801 3.878-.932 5.746-.706-.222-2.83-.718-5.002-.87-5.617h.001z" fill="#A569FF"/>
                      <path d="M17.305 4.961a199.47 199.47 0 01-1.08-1.094c-.202-.213-.398-.419-.586-.622l-1.333-1.378c.151.615.648 2.786.869 5.617 3.288.395 6.185 1.898 7.396 2.8-1.306-1.275-3.475-3.487-5.266-5.323z" fill="#1E37FC"/>
                    </svg>
                    <svg v-else-if="model.badge.key === 'gpt'" fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                      <title>OpenAI</title>
                      <path d="M21.55 10.004a5.417 5.417 0 00-.478-4.502c-1.217-2.09-3.662-3.165-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.545 5.473 4.838A5.554 5.554 0 001.76 7.495a5.488 5.488 0 00.692 6.5 5.417 5.417 0 00.477 4.501c1.217 2.09 3.662 3.166 6.05 2.66a5.59 5.59 0 003.907 1.18c2.443.005 4.61-1.546 5.361-3.84a5.554 5.554 0 003.714-2.66 5.488 5.488 0 00-.692-6.5v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.073l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216a4.15 4.15 0 012.175-1.807l-.002.15v5.06a.71.71 0 00.364.623l5.42 3.088-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h-.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h-.001zm-11.741 3.81l-1.877-1.069a.065.065 0 01-.036-.05V6.559c.003-2.274 1.87-4.12 4.174-4.123.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.364.623v6.176l1.877-1.069c.02-.01.033-.029.036-.05zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"></path>
                    </svg>
                    
                    <svg v-else-if="model.badge.key === 'banana'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;" aria-hidden="true">
                      <path d="M1.5 19.824c0-.548.444-.992.991-.992h.744a.991.991 0 010 1.983H2.49a.991.991 0 01-.991-.991z" fill="#F3AD61"></path>
                      <path d="M14.837 13.5h7.076c.522 0 .784-.657.413-1.044l-1.634-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044zM3.587 13.5h7.076c.521 0 .784-.659.414-1.044l-1.635-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044z" fill="#F9C23C"></path>
                      <path d="M12.525 1.521c3.69-.53 5.97 8.923 4.309 12.744-1.662 3.82-5.248 4.657-9.053 6.152a3.49 3.49 0 01-1.279.244c-1.443 0-2.227 1.187-2.774-.282-.707-1.9.22-4.031 2.069-4.757 2.014-.79 3.084-2.308 3.89-4.364.82-2.096.877-2.956.873-5.241-.003-1.827-.123-4.195 1.965-4.496z" fill="#FEEFC2"></path>
                      <path d="M16.834 14.264l-7.095-3.257c-.815 1.873-2.29 3.308-4.156 4.043-2.16.848-3.605 3.171-2.422 5.54 2.364 4.727 13.673-.05 13.673-6.325z" fill="#FCD53F"></path>
                      <path d="M13.68 12.362c.296.094.46.41.365.707-1.486 4.65-5.818 6.798-9.689 6.997a.562.562 0 11-.057-1.124c3.553-.182 7.372-2.138 8.674-6.216a.562.562 0 01.707-.364z" fill="#F9C23C"></path>
                      <path d="M17.43 19.85l-7.648-8.835h6.753c1.595.08 2.846 1.433 2.846 3.073v5.664c0 .997-.898 1.302-1.95.098z" fill="#FFF478"></path>
                    </svg>
                    <svg v-else-if="model.badge.key === 'gemini'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;">
                      <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF"></path>
                    </svg>
                    <svg v-else-if="model.badge.key === 'deepseek'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;">
                      <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.005-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.003-.17.034-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE"></path>
                    </svg>
                    <template v-else>{{ model.badge.short }}</template>
                  </span>
                  <span class="model-btn-text">{{ model.name }}</span>
                </button>
              </div>
              <div v-if="panelTextModelsWithBadge.length === 0" class="model-empty">
                {{ t('canvas.nodeUi.common.noModelsInGroup') }}
              </div>
            </div>
          </el-popover>
          <button
            type="button"
            class="btn-generate"
            :disabled="generatingStory"
            @click="handleGenerateStory"
          >
            <el-icon v-if="!generatingStory" class="btn-generate-icon"><Promotion /></el-icon>
            <span v-if="generatingStory" class="gen-loading">{{ t('canvas.nodeUi.textProcess.genStoryRunning') }}</span>
            <span v-else>{{ t('canvas.nodeUi.textProcess.genStory') }}</span>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.text-process-lod-shell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 180px;
  margin: 0 12px 12px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  background: rgba(10, 12, 22, 0.45);
  box-sizing: border-box;
}

.text-process-lod-icon {
  font-size: 24px;
  color: rgba(130, 200, 255, 0.88);
  flex-shrink: 0;
}

.text-process-lod-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.text-process-lod-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(240, 244, 255, 0.95);
}

.text-process-lod-sub {
  font-size: 11px;
  color: rgba(180, 192, 220, 0.75);
  line-height: 1.35;
}

.text-process-node-root {
  position: relative;
  --text-toolbar-width: 420px;
  --canvas-toolbar-prompt-min-height: 125px;
  --canvas-toolbar-prompt-bg: rgba(8, 12, 20, 0.62);
  --canvas-toolbar-prompt-border: rgba(255, 255, 255, 0.12);
  --canvas-toolbar-prompt-color: rgba(241, 245, 252, 0.94);
  --canvas-toolbar-prompt-placeholder: rgba(167, 176, 196, 0.55);
  --canvas-toolbar-prompt-font-size: 11px;
  --canvas-toolbar-prompt-line-height: 1.5;
  --canvas-toolbar-prompt-padding: 8px 10px;
  --canvas-toolbar-prompt-font-family: "Noto Sans SC", "Noto Sans CJK SC", "Noto Sans CJK JP", "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, "Segoe UI", sans-serif;
}

.text-process-node {
  position: relative;
  min-width: 420px;
  max-width: 480px;
  min-height: 320px;
  background: var(--bg-secondary, #1a1a2e);
  border: 2px solid var(--border-color, #3a3a4a);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.text-process-node.is-selected {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.4), 0 4px 14px rgba(64, 158, 255, 0.22);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-tertiary, #25253a);
  border-bottom: 1px solid var(--border-color, #3a3a4a);
}

.node-type-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.node-type-icon--text {
  color: #b37feb;
}

.node-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.node-body {
  padding: 10px;
}

.text-area-wrap {
  position: relative;
}

.text-area-loading-overlay {
  position: absolute;
  inset: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(10, 12, 20, 0.72), rgba(10, 12, 20, 0.4));
  backdrop-filter: blur(1px);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.text-area-loading-panel {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-radius: 14px;
  background: rgba(18, 24, 40, 0.78);
  border: 1px solid rgba(102, 177, 255, 0.22);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
}

.text-area-loading-spinner {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid rgba(125, 183, 255, 0.2);
  border-top-color: #7db7ff;
  animation: text-area-spin 0.9s linear infinite;
}

.text-area-loading-text {
  color: rgba(236, 245, 255, 0.9);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.text-area :deep(.el-textarea__inner) {
  min-height: 259px !important;
  resize: none;
  overflow-y: auto !important;
  overscroll-behavior: contain;
}

/* 深色模式下确保输入文字与背景有足够对比度（主输入框 + 底部弹窗输入框） */
.text-process-node :deep(.el-textarea__inner),
.text-toolbar :deep(.el-textarea__inner) {
  background-color: var(--bg-color, #141423) !important;
  color: var(--text-primary, #e6e8ee) !important;
  border-color: var(--border-color, #3a3a4a) !important;
}

.text-process-node :deep(.el-textarea__inner::placeholder),
.text-toolbar :deep(.el-textarea__inner::placeholder) {
  color: var(--text-secondary, #8f94a4) !important;
}

.text-process-node :deep(.el-textarea__inner:focus),
.text-toolbar :deep(.el-textarea__inner:focus) {
  border-color: #409eff !important;
}

.text-area-wrap {
  position: relative;
}

.text-area-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border-radius: 8px;
  background: rgba(9, 12, 20, 0.45);
  backdrop-filter: blur(1px);
  pointer-events: none;
}

.text-area-loading-panel {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(15, 20, 32, 0.9);
  border: 1px solid rgba(64, 158, 255, 0.3);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
}

.text-area-loading-spinner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(125, 183, 255, 0.28);
  border-top-color: #7db7ff;
  animation: text-area-spin 0.9s linear infinite;
}

.text-area-loading-text {
  color: rgba(233, 241, 255, 0.92);
  font-size: 12px;
  font-weight: 600;
}

.text-toolbar :deep(.el-textarea__inner) {
  min-height: var(--canvas-toolbar-prompt-min-height) !important;
  background: var(--canvas-toolbar-prompt-bg) !important;
  color: var(--canvas-toolbar-prompt-color) !important;
  border-color: var(--canvas-toolbar-prompt-border) !important;
  padding: var(--canvas-toolbar-prompt-padding) !important;
  font-size: var(--canvas-toolbar-prompt-font-size) !important;
  line-height: var(--canvas-toolbar-prompt-line-height) !important;
  font-family: var(--canvas-toolbar-prompt-font-family) !important;
  font-weight: 500 !important;
}

.text-toolbar :deep(.el-textarea__inner::placeholder) {
  color: var(--canvas-toolbar-prompt-placeholder) !important;
}

.node-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 0 10px 10px;
  min-height: 44px;
  align-items: center;
  box-sizing: border-box;
}

.node-action-btn {
  width: 100%;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: #409eff;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease;
}

.node-action-btn .el-icon {
  font-size: 16px;
}

.node-action-btn .el-icon.is-spinning {
  animation: icon-spin 1s linear infinite;
}

.node-action-btn:hover:not(:disabled) {
  background: #58abff;
  color: #fff;
}

.node-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  color: #fff;
}

.node-status {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.storyboard-generating-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(8, 12, 24, 0.62);
  backdrop-filter: blur(2px);
}

.storyboard-generating-panel {
  width: 100%;
  max-width: 360px;
  border: 1px solid rgba(102, 177, 255, 0.42);
  border-radius: 12px;
  background: rgba(15, 24, 44, 0.92);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
  padding: 14px 14px 12px;
}

.storyboard-generating-title {
  color: #ecf5ff;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.storyboard-generating-desc {
  margin-top: 4px;
  color: rgba(223, 236, 255, 0.75);
  font-size: 12px;
  line-height: 1.45;
}

.storyboard-generating-progress {
  margin-top: 10px;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.12);
}

.storyboard-generating-progress-bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #409eff 0%, #66b1ff 100%);
  transition: width 0.16s linear;
}

.storyboard-generating-meta {
  margin-top: 7px;
  color: rgba(218, 231, 255, 0.82);
  font-size: 11px;
  line-height: 1.4;
}

.node-float-bottom {
  position: absolute;
    left: 0;
    top: calc(100% + 11px);
    width: var(--text-toolbar-width);
    max-width: var(--text-toolbar-width);
    border: 1px solid #ba00f7;
    border-radius: 8px;
    background: #35003b6b;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
    padding: 10px;
}

.toolbar-row {
  margin-bottom: 10px;
}

.toolbar-row:last-child {
  margin-bottom: 5px;
}

.toolbar-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  min-height: 44px;
}

.model-chip {
  min-width: 170px;
  max-width: 230px;
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

.btn-generate {
  flex-shrink: 0;
  margin-left: auto;
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

.btn-generate-icon {
  font-size: 14px;
}

.btn-generate:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.gen-loading {
  font-size: 16px;
  line-height: 1;
}

.handle {
  z-index: 2;
  width: 10px !important;
  height: 10px !important;
  min-width: 10px;
  min-height: 10px;
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

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
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
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes text-area-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

<style>
.text-node-model-popover.el-popper,
.text-node-model-popover {
  padding: 12px !important;
  background: #17181c !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 14px !important;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.5) !important;
}

.text-node-model-popover .model-panel-label {
  margin: 2px 0 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.58);
}

.text-node-model-popover .model-group {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
}

.text-node-model-popover .model-group::-webkit-scrollbar {
  width: 6px;
}

.text-node-model-popover .model-group::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.text-node-model-popover .model-group::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.text-node-model-popover .model-group::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

.text-node-model-popover .model-btn {
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

.text-node-model-popover .model-btn-icon {
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

.text-node-model-popover .model-btn-text {
  min-width: 0;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.text-node-model-popover .model-btn-icon.platform-jimeng { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.text-node-model-popover .model-btn-icon.platform-gpt { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.text-node-model-popover .model-btn-icon.platform-banana { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.text-node-model-popover .model-btn-icon.platform-qwen { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.text-node-model-popover .model-btn-icon.platform-grok { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.text-node-model-popover .model-btn-icon.platform-sora { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.text-node-model-popover .model-btn-icon.platform-veo { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.text-node-model-popover .model-btn-icon.platform-deepseek { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.text-node-model-popover .model-btn-icon.platform-kling { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.text-node-model-popover .model-btn-icon.platform-gemini { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.text-node-model-popover .model-btn-icon.platform-other { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }

.text-node-model-popover .provider-group {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.text-node-model-popover .provider-btn {
  min-height: 32px;
  width: 100%;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: #101114;
  color: rgba(220, 228, 242, 0.82);
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
}

.text-node-model-popover .provider-btn.active {
  border-color: rgba(64, 158, 255, 0.65);
  background: rgba(64, 158, 255, 0.2);
  color: #e8f1ff;
  font-weight: 600;
}

.text-node-model-popover .model-btn.active {
  border-color: rgba(64, 158, 255, 0.65);
  background: rgba(64, 158, 255, 0.2);
  color: #e8f1ff;
  font-weight: 600;
}

.text-node-model-popover .model-empty {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.52);
}
</style>
