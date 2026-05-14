<script setup lang="ts">
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { computed, inject, onMounted, ref, watch, withDefaults, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Upload, Promotion, VideoPlay, Operation } from '@element-plus/icons-vue'
import { useApiConfigStore } from '@/stores/apiConfigStore'
import { usePromptsStore } from '@/stores/promptsStore'
import { useArtStyleStore } from '@/stores/artStyleStore'
import { getModelPlatformBadge } from '@/utils/modelPlatformBadge'
import { buildArtStylePromptPrefix } from '@/utils/artStylePrompt'
import { persistCanvasGeneratedVideo } from '@/utils/canvasMediaPersist'
import { apiService } from '@/services/apiService'
import { useSimulatedGenerationProgress } from '@/composables/useSimulatedGenerationProgress'
import CanvasGeneratingOverlay from '@/components/canvas/CanvasGeneratingOverlay.vue'
import { useCanvasLodLevel } from '@/composables/useCanvasLodLevel'
import { useCanvasNodeCommon } from '@/composables/useCanvasNodeUiI18n'

export interface VideoNodeData {
  label: string
  type: string
  status?: 'pending' | 'running' | 'completed' | 'error'
  description?: string
  toolbarExpanded?: boolean
  prompt?: string
  /** 遗留：画布工坊已改用全局模板注入；仅在缺少注入时作为回退读取 */
  selectedVideoPromptTemplateId?: string
  referenceImages?: Array<string | null>
  generatedVideoUrl?: string | null
  videoModelGroup?: 'youshang' | 'flow2'
  videoModel?: string
  aspectRatio?: '16:9' | '9:16'
  videoDuration?: string
}

interface Props {
  id: string
  selected?: boolean
  data: VideoNodeData
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
})

const { t, apiGroupLabelMap, notChosenModel, modelGroupFallback } = useCanvasNodeCommon()

const { updateNodeData: rawUpdateNodeData, edges, findNode } = useVueFlow()
const apiStore = useApiConfigStore()
const promptsStore = usePromptsStore()
const artStyleStore = useArtStyleStore()
const lodLevel = useCanvasLodLevel()
const lodIsShell = computed(() => lodLevel.value === 'shell')

const DEFAULT_VIDEO_PROMPT_TEMPLATE_ID = '9'

const canvasWorkbenchVidTplIdRef = inject<Ref<string> | undefined>(
  'canvasVideoPromptTemplateId',
  undefined
)

const pushStateBeforeChange = inject<(() => void) | undefined>('canvasPushStateBeforeChange', undefined)
const scheduleCanvasAutoSave = inject<(() => void) | undefined>('scheduleCanvasAutoSave', undefined)

function updateNodeData(nodeId: string, data: Partial<VideoNodeData>) {
  rawUpdateNodeData(nodeId, data)
  scheduleCanvasAutoSave?.()
}

function resolveCanvasVideoPromptTemplate(): string {
  const fromWorkbench = canvasWorkbenchVidTplIdRef?.value?.trim?.()
  const fromNode = props.data.selectedVideoPromptTemplateId?.trim?.()
  const id =
    (fromWorkbench && fromWorkbench.length > 0 ? fromWorkbench : '') ||
    (fromNode && fromNode.length > 0 ? fromNode : '') ||
    DEFAULT_VIDEO_PROMPT_TEMPLATE_ID
  const content = promptsStore.getPromptContentById(id)
  if (content && content.trim()) return content.trim()
  return promptsStore.getPromptContentById(DEFAULT_VIDEO_PROMPT_TEMPLATE_ID).trim()
}
const canvasProjectContext = inject<{ projectId: Ref<string>; projectName: Ref<string> } | null>(
  'canvasProjectContext',
  null
)

async function persistGeneratedVideoUrl(url: string): Promise<string> {
  const ctx = canvasProjectContext
  if (!ctx) return url
  const pid = ctx.projectId.value
  const pname = String(ctx.projectName.value ?? '').trim()
  if (!pid || !pname) return url
  return persistCanvasGeneratedVideo(pid, pname, props.id, url)
}

const refFileInputRef = ref<HTMLInputElement | null>(null)
/** 与节点 data.status 同步：重挂载或画布刷新后仍能显示生成中，直至任务结束改为 completed/error */
const isVideoGenerating = computed(() => props.data.status === 'running')
const videoSettingsPopoverVisible = ref(false)
const videoModelPopoverVisible = ref(false)
const panelModelGroup = ref<VideoNodeData['videoModelGroup'] | null>(null)
const activeUploadSlot = ref<number>(0)
const {
  progressPercent: videoGeneratingProgressPercent,
  start: startVideoGeneratingFeedback,
  stop: stopVideoGeneratingFeedback
} = useSimulatedGenerationProgress({ durationMs: 90_000 })

watch(
  isVideoGenerating,
  (running) => {
    if (running) startVideoGeneratingFeedback()
    else stopVideoGeneratingFeedback()
  },
  { immediate: true }
)

const toolbarExpanded = computed({
  get: () => props.data.toolbarExpanded ?? false,
  set: (v: boolean) => updateNodeData(props.id, { toolbarExpanded: v })
})

const promptModel = computed({
  get: () => props.data.prompt ?? '',
  set: (v: string) => updateNodeData(props.id, { prompt: v })
})

const videoModel = computed({
  get: () => props.data.videoModel ?? apiStore.videoModel,
  set: (v: string) => updateNodeData(props.id, { videoModel: v })
})
const mergedModelOptions = computed(() => {
  const m = apiGroupLabelMap.value
  return [
    { value: 'youshang', label: m.youshang, models: apiStore.videoModels },
    { value: 'flow2', label: m.flow2, models: apiStore.flow2VideoModels as typeof apiStore.videoModels }
  ] as const
})
const currentModelGroupOption = computed(() => {
  const currentGroup = props.data.videoModelGroup || 'youshang'
  return mergedModelOptions.value.find(group => group.value === currentGroup) || mergedModelOptions.value[0]
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

const aspectRatio = computed({
  get: () => props.data.aspectRatio ?? '16:9',
  set: (v: '16:9' | '9:16') => updateNodeData(props.id, { aspectRatio: v })
})

const videoDuration = computed({
  get: () => props.data.videoDuration ?? '4',
  set: (v: string) => updateNodeData(props.id, { videoDuration: v })
})

const referenceImages = computed<Array<string | null>>(() => {
  const raw = props.data.referenceImages
  if (Array.isArray(raw)) {
    return [raw[0] ?? null, raw[1] ?? null]
  }
  const legacy = (props.data as any).referenceImage
  return [legacy ?? null, null]
})

/** 从指向本节点的连线上解析上游可当作参考图的 URL（与手动上传槽位无关） */
function extractImageUrlFromSourceNode(node: ReturnType<typeof findNode>): string | null {
  if (!node?.data) return null
  const t = node.type
  const d = node.data as Record<string, unknown>
  if (t === 'imageCanvas') {
    const u = (d.generatedImageUrl ?? d.uploadedMainImageUrl) as string | undefined | null
    return u && String(u).trim() ? String(u) : null
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

function extractStoryboardGenPromptText(data: Record<string, unknown>): string {
  const frames = data.frames as Array<{ description?: string }> | undefined
  const storyboardPrompt = String(data.storyboardPrompt ?? '').trim()
  const parts: string[] = []
  if (Array.isArray(frames)) {
    frames.forEach((f, i) => {
      const t = String(f?.description ?? '').trim()
      if (t) parts.push(`Grid${i + 1}：${t}`)
    })
  }
  if (storyboardPrompt) parts.push(storyboardPrompt)
  return parts.filter(Boolean).join('\n')
}

function formatAssetDetailChunk(d: Record<string, unknown>): string {
  const name = String(d.assetName ?? '').trim()
  const desc = String(d.assetDescription ?? '').trim()
  const catRaw = d.assetCategory
  const cat =
    catRaw === 'character'
      ? t('canvas.nodeUi.video.upstreamCatChar')
      : catRaw === 'scene'
        ? t('canvas.nodeUi.video.upstreamCatScene')
        : catRaw === 'prop'
          ? t('canvas.nodeUi.video.upstreamCatProp')
          : t('canvas.nodeUi.video.upstreamCatAsset')
  const lines: string[] = [t('canvas.nodeUi.video.assetCatBracket', { cat })]
  if (name) lines.push(`${t('canvas.nodeUi.video.upstreamNamePrefix')}${name}`)
  if (desc) lines.push(`${t('canvas.nodeUi.video.upstreamDescPrefix')}${desc}`)
  return lines.length > 1 ? lines.join('\n') : ''
}

/**
 * 沿入边向上查找：人物/场景/道具资产节点、分镜生成节点；可跨图片/切割节点链。
 */
function collectUpstreamContextForImageNode(imageNodeId: string, visitedImages: Set<string>): string[] {
  const chunks: string[] = []
  if (visitedImages.has(imageNodeId)) return chunks
  visitedImages.add(imageNodeId)
  for (const e of edges.value) {
    if (e.target !== imageNodeId) continue
    const src = findNode(e.source)
    if (!src?.data) continue
    if (src.type === 'textAssetDetail') {
      const s = formatAssetDetailChunk(src.data as Record<string, unknown>)
      if (s) chunks.push(s)
    } else if (src.type === 'storyboardGen') {
      const sb = extractStoryboardGenPromptText(src.data as Record<string, unknown>)
      if (sb) chunks.push(`${t('canvas.nodeUi.video.ctxStoryboardSuffix')}\n${sb}`)
    } else if (src.type === 'textProcess' && src.data) {
      // 处理文本处理节点
      const d = src.data as Record<string, unknown>
      const textContent = String(d.textContent ?? '').trim()
      const storyPrompt = String(d.storyPrompt ?? '').trim()
      const chapters = d.chapters as Array<{ title?: string; content?: string }> | undefined
      
      if (textContent) {
        chunks.push(textContent)
      }
      if (storyPrompt) {
        chunks.push(storyPrompt)
      }
      if (Array.isArray(chapters)) {
        const selectedIds = d.selectedChapterIds as string[] | undefined
        const filteredChapters = selectedIds && selectedIds.length > 0 
          ? chapters.filter(ch => selectedIds.includes((ch as any).id))
          : chapters
        
        filteredChapters.forEach((ch) => {
          const title = String(ch.title ?? '').trim()
          const content = String(ch.content ?? '').trim()
          if (content) {
            chunks.push(title ? `${title}：\n${content}` : content)
          }
        })
      }
    } else if (src.type === 'imageCanvas' || src.type === 'imageSplitResult') {
      chunks.push(...collectUpstreamContextForImageNode(src.id, visitedImages))
    }
  }
  return chunks
}

interface VideoIncomingFeed {
  imageUrl: string | null
  contextTexts: string[]
}

function buildIncomingFeed(sourceId: string): VideoIncomingFeed {
  const n = findNode(sourceId)
  const imageUrl = extractImageUrlFromSourceNode(n)
  const contextTexts: string[] = []
  if (n?.type === 'imageCanvas') {
    contextTexts.push(...collectUpstreamContextForImageNode(n.id, new Set<string>()).filter(Boolean))
  } else if (n?.type === 'storyboardGen' && n.data) {
    const sb = extractStoryboardGenPromptText(n.data as Record<string, unknown>)
    if (sb) contextTexts.push(`${t('canvas.nodeUi.video.ctxStoryboardSuffix')}\n${sb}`)
  } else if (n?.type === 'textProcess' && n.data) {
    // 处理文本处理节点
    const d = n.data as Record<string, unknown>
    const textContent = String(d.textContent ?? '').trim()
    const storyPrompt = String(d.storyPrompt ?? '').trim()
    const chapters = d.chapters as Array<{ title?: string; content?: string }> | undefined
    
    if (textContent) {
      contextTexts.push(textContent)
    }
    if (storyPrompt) {
      contextTexts.push(storyPrompt)
    }
    if (Array.isArray(chapters)) {
      const selectedIds = d.selectedChapterIds as string[] | undefined
      const filteredChapters = selectedIds && selectedIds.length > 0 
        ? chapters.filter(ch => selectedIds.includes((ch as any).id))
        : chapters
      
      filteredChapters.forEach((ch, i) => {
        const title = String(ch.title ?? '').trim()
        const content = String(ch.content ?? '').trim()
        if (content) {
          contextTexts.push(title ? `${title}：\n${content}` : content)
        }
      })
    }
  }
  return { imageUrl, contextTexts }
}

const incomingFeeds = computed(() =>
  edges.value.filter((e) => e.target === props.id).map((e) => buildIncomingFeed(e.source))
)

const upstreamReferenceUrls = computed(() =>
  incomingFeeds.value
    .map((f) => f.imageUrl)
    .filter((u): u is string => !!u && String(u).trim().length > 0)
)

const mergedUpstreamContextBlock = computed(() => {
  const chunks = incomingFeeds.value.flatMap((f) => f.contextTexts).filter(Boolean)
  const seen = new Set<string>()
  const unique = chunks.filter((c) => {
    const k = c.trim()
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
  if (unique.length === 0) return ''
  return `${t('canvas.nodeUi.video.canvasContextBlock')}\n${unique.join('\n\n')}`
})

/** 手动上传槽在前，再按连线顺序拼接多路参考图（人物/场景/道具等多线） */
const allReferenceImagesForApi = computed(() => {
  const fromSlots = referenceImages.value.filter((u): u is string => !!u && String(u).trim().length > 0)
  const fromEdges = upstreamReferenceUrls.value
  const merged = [...fromSlots, ...fromEdges]
  return [...new Set(merged)]
})

const incomingLinkSummary = computed(() => {
  const n = incomingFeeds.value.length
  const imgs = upstreamReferenceUrls.value.length
  const ctx = incomingFeeds.value.some((f) => f.contextTexts.length > 0)
  return { n, imgs, ctx }
})

const incomingLinkHintLine = computed(() => {
  const { n, imgs, ctx } = incomingLinkSummary.value
  if (n <= 0) return ''
  let s = t('canvas.nodeUi.video.inboundSummary', { n })
  if (imgs) s += t('canvas.nodeUi.video.inboundImgsSuffix', { n: imgs })
  if (ctx) s += t('canvas.nodeUi.video.inboundCtxSuffix')
  return s
})

const hasVideo = computed(() => !!(props.data.generatedVideoUrl ?? null))
const toolbarPromptPlaceholder = computed(() => t('canvas.nodeUi.common.toolbarPromptPlaceholder'))

const statusColor = computed(() => {
  switch (props.data.status) {
    case 'running': return '#409eff'
    case 'completed': return '#67c23a'
    case 'error': return '#f56c6c'
    default: return '#909399'
  }
})

const ratioOptions = computed(() =>
  [
    { value: '16:9' as const, label: t('canvas.nodeUi.video.ratio169') },
    { value: '9:16' as const, label: t('canvas.nodeUi.video.ratio916') }
  ] as const
)

const MODEL_DURATION_VALUES: Record<string, string[]> = {
  'sora-2': ['4', '8', '12'],
  'sora-2-all': ['10', '15'],
  'sora-2-pro': ['4', '8', '12'],
  'grok-video-3': ['6', '10'],
  'grok-video-3-10s': ['10'],
  'veo_3_1-fast': ['4', '5', '8'],
  'veo_3_1-fast-4K': ['6', '10'],
  'kling-video': ['5', '10'],
  'kling-omni-video': ['5', '10']
}

const DEFAULT_DURATION_VALUES = ['4', '8', '12']

const durationOptions = computed(() => {
  const values = MODEL_DURATION_VALUES[videoModel.value] ?? DEFAULT_DURATION_VALUES
  return values.map((value) => ({
    value,
    label: t('canvas.nodeUi.video.secTpl', { n: value })
  }))
})
const videoSettingSummary = computed(
  () =>
    `${aspectRatio.value} · ${t('canvas.nodeUi.video.secTpl', { n: videoDuration.value })}`
)
const currentVideoModelMeta = computed(() => {
  const group = currentModelGroupOption.value
  const hit = group.models.find(item => item.id === videoModel.value) || group.models[0]
  return {
    modelName: hit?.name || notChosenModel(),
    groupLabel: group?.label || modelGroupFallback()
  }
})

function onVideoModelPopoverShow() {
  panelModelGroup.value = (props.data.videoModelGroup || 'youshang') as VideoNodeData['videoModelGroup']
  const validModelIds = new Set(
    mergedModelOptions.value.flatMap(group => group.models.map(model => model.id))
  )
  if (!videoModel.value || !validModelIds.has(videoModel.value)) {
    videoModel.value = apiStore.videoModel || apiStore.videoModels[0]?.id || ''
  }
}

function selectVideoModelGroup(group: VideoNodeData['videoModelGroup']) {
  panelModelGroup.value = group
  updateNodeData(props.id, { videoModelGroup: group })
  const groupModels = mergedModelOptions.value.find(item => item.value === group)?.models || []
  if (groupModels.length === 0) return
  if (!groupModels.some(item => item.id === videoModel.value)) {
    videoModel.value = groupModels[0]?.id || ''
  }
}

function selectVideoModel(modelId: string) {
  videoModel.value = modelId
  updateNodeData(props.id, { videoModelGroup: activePanelGroup.value })
  videoModelPopoverVisible.value = false
}

watch(videoModel, () => {
  if (!durationOptions.value.some(opt => opt.value === videoDuration.value)) {
    videoDuration.value = durationOptions.value[durationOptions.value.length - 1].value
  }
})

function ensureDefaults() {
  const patch: Partial<VideoNodeData> = {}
  const validVideoModelIds = new Set(
    mergedModelOptions.value.flatMap(group => group.models.map(model => model.id))
  )
  if (props.data.toolbarExpanded === undefined) patch.toolbarExpanded = false
  if (!props.data.prompt) patch.prompt = ''
  if (!props.data.videoModelGroup) patch.videoModelGroup = 'youshang'
  if (!props.data.videoModel || !validVideoModelIds.has(props.data.videoModel)) {
    patch.videoModel = apiStore.videoModel || apiStore.videoModels[0]?.id || ''
  }
  if (!props.data.aspectRatio) patch.aspectRatio = '16:9'
  if (!props.data.videoDuration) patch.videoDuration = '4'
  if (!Array.isArray(props.data.referenceImages)) {
    const legacy = (props.data as any).referenceImage
    patch.referenceImages = [legacy ?? null, null]
  }
  if (props.data.generatedVideoUrl === undefined) patch.generatedVideoUrl = null

  if (Object.keys(patch).length) updateNodeData(props.id, patch)
}

onMounted(() => {
  ensureDefaults()
})

function onPreviewClick() {
  toolbarExpanded.value = true
}

function triggerRefFilePick(slotIndex: number) {
  activeUploadSlot.value = slotIndex
  refFileInputRef.value?.click()
}

async function onRefFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !file.type.startsWith('image/')) {
    input.value = ''
    return
  }
  try {
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('read'))
      reader.readAsDataURL(file)
    })
    const next = [...referenceImages.value]
    const idx = activeUploadSlot.value >= 0 && activeUploadSlot.value <= 1 ? activeUploadSlot.value : 0
    next[idx] = url
    updateNodeData(props.id, { referenceImages: next })
    ElMessage.success(t('canvas.nodeUi.video.refUpdated'))
  } catch {
    ElMessage.error(t('canvas.nodeUi.video.refReadFail'))
  }
  input.value = ''
}

function clearReferenceImage(slotIndex: number) {
  const next = [...referenceImages.value]
  next[slotIndex] = null
  updateNodeData(props.id, { referenceImages: next })
}

async function handleGenerateVideo() {
  const prompt = promptModel.value.trim()
  const refs = allReferenceImagesForApi.value
  if (!prompt && refs.length === 0) {
    ElMessage.warning(t('canvas.nodeUi.video.needPromptOrRef'))
    return
  }
  if (prompt.length > 2500) {
    ElMessage.warning('视频提示词过长，系统会自动截断到 2500 字符后再发送。')
  }
  if (props.data.status === 'running') {
    ElMessage.warning(t('canvas.nodeUi.video.genBusy'))
    return
  }
  const vg = props.data.videoModelGroup || 'youshang'
  if (!apiStore.isApiReadyForGroup(vg)) {
    ElMessage.warning(
      vg === 'flow2' ? t('settings.msg.enterApiUrlFirst') : t('canvas.nodeUi.textProcess.needApiFirst')
    )
    return
  }
  
  // 验证并修正Kling模型的时长
  let finalDuration = videoDuration.value
  if (videoModel.value === 'kling-video' || videoModel.value === 'kling-omni-video') {
    const validDurations = ['5', '10']
    if (!validDurations.includes(finalDuration)) {
      finalDuration = validDurations[0] // 默认选5秒
      updateNodeData(props.id, { videoDuration: finalDuration })
      ElMessage.warning(`Kling模型仅支持5秒或10秒视频，已自动切换为${finalDuration}秒`)
    }
  }
  
  updateNodeData(props.id, { status: 'running' })
  try {
    const tpl = resolveCanvasVideoPromptTemplate()
    const userBlock =
      (prompt || t('canvas.nodeUi.video.defaultPrompt')) + mergedUpstreamContextBlock.value
    const marker = t('editorWorkshop.step2.markerShotPrompt')
    const videoPrompt = `${tpl}\n\n${marker}\n${userBlock}`
    const stylePrefix = buildArtStylePromptPrefix(artStyleStore.artStyles, artStyleStore.selectedStyle)
    const finalPrompt = `${stylePrefix}${videoPrompt}`
    if (videoModel.value === 'kling-omni-video' && finalPrompt.length > 2500) {
      ElMessage.warning('Kling Omni 的提示词超过 2500 字符，系统会自动截断后提交。')
    }
    const url = await apiService.generateVideo(finalPrompt, {
      model: videoModel.value,
      aspectRatio: aspectRatio.value,
      duration: finalDuration,
      referenceImages: refs.length > 0 ? refs : undefined,
      nodeId: props.id,
      modelGroup: vg
    })
    const displayUrl = url ? await persistGeneratedVideoUrl(url) : url
    updateNodeData(props.id, {
      generatedVideoUrl: displayUrl,
      status: 'completed'
    })
    ElMessage.success(t('canvas.nodeUi.video.genOk'))
  } catch (e) {
    updateNodeData(props.id, { status: 'error' })
    ElMessage.error(e instanceof Error ? e.message : t('canvas.nodeUi.video.genFail'))
  }
}
</script>

<template>
  <div class="video-canvas-node-root">
    <Handle type="target" :position="Position.Left" class="handle handle-target" />

    <div class="video-canvas-node" :class="[{ 'is-selected': selected }]">
      <div class="node-header">
        <el-icon class="node-type-icon node-type-icon--video"><VideoPlay /></el-icon>
        <span class="node-label">{{ data.label || t('canvas.nodeUi.video.defaultTitle') }}</span>
      </div>
      <div class="node-status" :style="{ backgroundColor: statusColor }" />

      <div
        v-if="lodIsShell"
        class="canvas-node-lod-shell nodrag nopan"
      >
        <el-icon class="canvas-node-lod-shell-icon"><VideoPlay /></el-icon>
        <div class="canvas-node-lod-shell-lines">
          <span class="canvas-node-lod-shell-title">{{ data.label || t('canvas.nodeUi.video.defaultTitle') }}</span>
          <span class="canvas-node-lod-shell-sub">{{ hasVideo ? t('canvas.nodeUi.video.lodHasVideo') : t('canvas.nodeUi.video.lodShell') }}</span>
        </div>
      </div>

      <template v-else>
      <div class="video-preview-wrap nodrag nopan" @mousedown.stop>
        <div class="video-preview" @click.stop="onPreviewClick">
          <video
            v-if="hasVideo"
            :src="data.generatedVideoUrl || ''"
            class="preview-video"
            controls
            preload="none"
            playsinline
          />
          <div v-else class="preview-empty">
            <span class="preview-empty-title">{{ t('canvas.nodeUi.video.expandToolbar') }}</span>
            <div class="preview-empty-meta">
              <span class="preview-empty-line">
                {{ t('canvas.nodeUi.video.inboundHintLeft') }}
              </span>
              <span
                v-if="incomingLinkSummary.n > 0"
                class="preview-empty-line preview-empty-link"
              >
                {{ incomingLinkHintLine }}
              </span>
            </div>
          </div>

          <transition name="fade-overlay">
            <CanvasGeneratingOverlay
              v-if="isVideoGenerating"
              :title="t('canvas.nodeUi.video.genOverlayTitle')"
              :description="t('canvas.nodeUi.video.genOverlayDesc')"
              :percent="videoGeneratingProgressPercent"
              :meta-line="t('canvas.nodeUi.video.genOverlayMeta', { p: videoGeneratingProgressPercent })"
            />
          </transition>
        </div>
      </div>

      <div class="node-inline-actions nodrag nopan">
        <div class="toolbar-actions-main nodrag nopan">
          <el-popover
            v-model:visible="videoModelPopoverVisible"
            placement="top-start"
            :width="360"
            trigger="click"
            popper-class="video-node-model-popover"
            @show="onVideoModelPopoverShow"
          >
            <template #reference>
              <button type="button" class="model-chip nodrag nopan">
                <span class="model-chip-name">{{ currentVideoModelMeta.modelName }}</span>
                <span class="model-chip-group">{{ currentVideoModelMeta.groupLabel }}</span>
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
                  @click="selectVideoModelGroup(group.value)"
                >
                  {{ group.label }}
                </button>
              </div>
              <div class="model-panel-label">{{ t('canvas.nodeUi.common.model') }}</div>
              <div class="model-group">
                <button
                  v-for="m in panelGroupModelsWithBadge"
                  :key="m.id"
                  type="button"
                  class="model-btn"
                  :class="{ active: videoModel === m.id }"
                  @click="selectVideoModel(m.id)"
                >
                  <span class="model-btn-icon" :class="`platform-${m.badge.key}`">
                    <svg v-if="m.badge.key === 'kling'" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                      <path d="M5.4 13.8A23.2 23.2 0 017.4 9.3c3.2-5.5 7.8-8.8 10.3-7.3C12-1.3 4.6 1 1.1 7a13.4 13.4 0 00-1 2.2c-.3.8.1 1.6.8 2l4.6 2.6z" fill="#04A6F0"/>
                      <path d="M18.6 10.2a23.2 23.2 0 01-2 4.5c-3.2 5.5-7.8 8.8-10.3 7.3 5.7 3.3 13.1 1.1 16.6-4.9a13.4 13.4 0 001-2.3c.3-.8-.1-1.6-.8-2l-4.5-2.6z" fill="#0DF35E"/>
                      <path d="M16.6 14.6c3.2-5.5 3.7-11.1 1.2-12.6C15.2.6 10.6 3.8 7.4 9.3c2-3.6 5.8-5.3 8.3-3.8 2.6 1.5 2.9 5.6.9 9.1z" fill="#003EFF"/>
                      <path d="M7.4 9.3c-3.2 5.5-3.7 11.1-1.2 12.6 2.6 1.5 7.2-1.8 10.4-7.3-2.1 3.6-5.9 5.3-8.4 3.9-2.5-1.4-2.9-5.6-.8-9.2z" fill="#0BFFE7"/>
                    </svg>
                    <svg v-else-if="m.badge.key === 'gpt'" fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                      <title>OpenAI</title>
                      <path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"></path>
                    </svg>
                    
                    <svg v-else-if="m.badge.key === 'banana'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;" aria-hidden="true"><path d="M1.5 19.824c0-.548.444-.992.991-.992h.744a.991.991 0 010 1.983H2.49a.991.991 0 01-.991-.991z" fill="#F3AD61"></path><path d="M14.837 13.5h7.076c.522 0 .784-.657.413-1.044l-1.634-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044zM3.587 13.5h7.076c.521 0 .784-.659.414-1.044l-1.635-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044z" fill="#F9C23C"></path><path d="M12.525 1.521c3.69-.53 5.97 8.923 4.309 12.744-1.662 3.82-5.248 4.657-9.053 6.152a3.49 3.49 0 01-1.279.244c-1.443 0-2.227 1.187-2.774-.282-.707-1.9.22-4.031 2.069-4.757 2.014-.79 3.084-2.308 3.89-4.364.82-2.096.877-2.956.873-5.241-.003-1.827-.123-4.195 1.965-4.496z" fill="#FEEFC2"></path><path d="M16.834 14.264l-7.095-3.257c-.815 1.873-2.29 3.308-4.156 4.043-2.16.848-3.605 3.171-2.422 5.54 2.364 4.727 13.673-.05 13.673-6.325z" fill="#FCD53F"></path><path d="M13.68 12.362c.296.094.46.41.365.707-1.486 4.65-5.818 6.798-9.689 6.997a.562.562 0 11-.057-1.124c3.553-.182 7.372-2.138 8.674-6.216a.562.562 0 01.707-.364z" fill="#F9C23C"></path><path d="M17.43 19.85l-7.648-8.835h6.753c1.595.08 2.846 1.433 2.846 3.073v5.664c0 .997-.898 1.302-1.95.098z" fill="#FFF478"></path></svg>
                    <template v-else>{{ m.badge.short }}</template>
                  </span>
                  <span class="model-btn-text">{{ m.name }}</span>
                </button>
              </div>
              <div v-if="panelGroupModelsWithBadge.length === 0" class="model-empty">
                {{ t('canvas.nodeUi.common.noModelsInGroup') }}
              </div>
            </div>
          </el-popover>

          <el-popover
            v-model:visible="videoSettingsPopoverVisible"
            placement="top-start"
            :width="280"
            trigger="click"
            popper-class="video-node-settings-popover"
          >
            <template #reference>
              <button type="button" class="qa-trigger nodrag nopan">
                <el-icon class="qa-trigger-icon"><Operation /></el-icon>
                <span>{{ videoSettingSummary }}</span>
              </button>
            </template>
            <div class="qa-panel">
              <div class="qa-label">
                {{ t('canvas.nodeUi.video.duration') }}
              </div>
              <div class="qa-segment">
                <button
                  v-for="d in durationOptions"
                  :key="d.value"
                  type="button"
                  class="seg-btn"
                  :class="{ active: videoDuration === d.value }"
                  @click="videoDuration = d.value"
                >
                  {{ d.label }}
                </button>
              </div>
              <div class="qa-label">
                {{ t('canvas.nodeUi.video.ratio') }}
              </div>
              <div class="qa-ratios">
                <button
                  v-for="r in ratioOptions"
                  :key="r.value"
                  type="button"
                  class="ratio-btn"
                  :class="[`ar-${r.value.replace(':', '-')}`, { active: aspectRatio === r.value }]"
                  @click="aspectRatio = r.value"
                >
                  <span class="ratio-shape" />
                  <span class="ratio-text">{{ r.label }}</span>
                </button>
              </div>
            </div>
          </el-popover>
        </div>

        <button
          type="button"
          class="btn-generate btn-generate-full nodrag nopan"
          :disabled="isVideoGenerating"
          @click="handleGenerateVideo"
        >
          <el-icon class="btn-generate-icon" :class="{ 'is-spinning': isVideoGenerating }"><Promotion /></el-icon>
          <span v-if="isVideoGenerating" class="gen-loading">{{ t('canvas.nodeUi.common.generating') }}</span>
          <span v-else>{{ t('canvas.nodeUi.video.genVideo') }}</span>
        </button>
      </div>
      </template>
    </div>

    <Handle type="source" :position="Position.Right" class="handle handle-source" />

    <Transition name="video-node-bottom">
      <div
        v-if="toolbarExpanded && !lodIsShell"
        key="video-toolbar"
        class="node-float-bottom video-toolbar nodrag nopan"
        @mousedown.stop
      >
        <input
          ref="refFileInputRef"
          type="file"
          class="hidden-input"
          accept="image/*"
          @change="onRefFileChange"
        >

        <div
          role="group"
          class="prompt-toolbar-group"
          :aria-label="t('canvas.nodeUi.common.promptToolbarAria')"
        >
        <div class="toolbar-row toolbar-refs">
          <button
            v-for="(url, idx) in referenceImages"
            :key="`slot-${idx}`"
            type="button"
            class="ref-slot nodrag nopan"
            :class="{ 'is-filled': !!url }"
            :title="t('canvas.nodeUi.video.refUploadTitle', { n: idx + 1 })"
            @click="triggerRefFilePick(idx)"
          >
            <img v-if="url" :src="url" alt="" loading="lazy" decoding="async">
            <span v-else class="ref-slot-placeholder">
              <el-icon><Upload /></el-icon>
            </span>
            <span
              v-if="url"
              class="ref-slot-clear"
              @click.stop="clearReferenceImage(idx)"
            >×</span>
          </button>
          <span class="refs-tip">{{ t('canvas.nodeUi.video.refTip012') }}</span>
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
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.canvas-node-lod-shell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: var(--video-main-area-height);
  margin: 0 12px 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  background: rgba(10, 12, 22, 0.45);
  box-sizing: border-box;
}

.canvas-node-lod-shell-icon {
  font-size: 22px;
  color: rgba(255, 149, 128, 0.9);
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

.video-canvas-node-root {
  --video-node-card-width: 430px;
  --video-main-area-height: 220px;
  --video-toolbar-width: 430px;
  --video-model-select-width: 180px;
  --canvas-toolbar-prompt-min-height: 130px;
  --canvas-toolbar-prompt-bg: rgba(8, 12, 20, 0.62);
  --canvas-toolbar-prompt-border: rgba(255, 255, 255, 0.12);
  --canvas-toolbar-prompt-color: rgba(241, 245, 252, 0.94);
  --canvas-toolbar-prompt-placeholder: rgba(167, 176, 196, 0.55);
  --canvas-toolbar-prompt-font-size: 11px;
  --canvas-toolbar-prompt-line-height: 1.5;
  --canvas-toolbar-prompt-padding: 8px 10px;
  --canvas-toolbar-prompt-font-family: "Noto Sans SC", "Noto Sans CJK SC", "Noto Sans CJK JP", "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, "Segoe UI", sans-serif;
  position: relative;
  width: var(--video-node-card-width);
  min-width: 360px;
  max-width: 800px;
  overflow: visible;
  cursor: grab;
  box-sizing: border-box;
}

.video-canvas-node {
  position: relative;
  min-height: 360px;
  width: 100%;
  background: var(--bg-secondary, #1a1a2e);
  border: 2px solid var(--border-color, #3a3a4a);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  box-sizing: border-box;
}

.video-canvas-node:hover:not(.is-selected) {
  border-color: rgba(255, 255, 255, 0.58);
  box-shadow: 0 2px 12px rgba(255, 255, 255, 0.07);
}

.video-canvas-node.is-selected {
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

.node-type-icon--video {
  color: #e6a23c;
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

.node-status {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.video-preview-wrap { padding: 12px; }

.video-preview {
  height: var(--video-main-area-height);
  min-height: var(--video-main-area-height);
  max-height: var(--video-main-area-height);
  border-radius: 8px;
  background: #12121c;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
}

.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 14px;
  max-width: 100%;
  text-align: center;
  user-select: none;
  box-sizing: border-box;
}

.preview-empty-title {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  font-weight: 500;
}

.preview-empty-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.38);
}

.preview-empty-line {
  display: block;
}

.preview-empty-link {
  color: #95d475;
}

.preview-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.node-inline-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 10px 10px;
  box-sizing: border-box;
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

.video-toolbar {
  width: var(--video-toolbar-width);
  max-width: var(--video-toolbar-width);
  box-sizing: border-box;
  background: #35003b6b;
  border: 1px solid #ba00f7;
  border-radius: 8px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
  padding: 10px 10px 12px;
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-refs { min-height: 44px; }

.hidden-input { display: none; }

.ref-slot {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.02);
  overflow: hidden;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.ref-slot:hover {
  border-color: rgba(64, 158, 255, 0.6);
  background: rgba(64, 158, 255, 0.08);
}

.ref-slot.is-filled {
  border-style: solid;
  border-color: rgba(255, 255, 255, 0.24);
  background: transparent;
}

.ref-slot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ref-slot-placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
}

.ref-slot-placeholder .el-icon {
  font-size: 16px;
}

.ref-slot-clear {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  font-size: 11px;
  line-height: 1;
}

.refs-tip {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
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
  line-height: var(--canvas-toolbar-prompt-line-height);
  font-family: var(--canvas-toolbar-prompt-font-family);
  font-weight: 500;
  box-sizing: border-box;
}

.prompt-input::placeholder {
  color: var(--canvas-toolbar-prompt-placeholder);
}

.prompt-input:focus {
  outline: none;
  border-color: #409eff;
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
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.16);
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

.qa-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qa-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 600;
}

.qa-segment {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
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

.qa-ratios {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.ratio-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px;
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
  width: 22px;
  height: 14px;
  border: 1px solid currentColor;
  border-radius: 3px;
  display: inline-block;
  box-sizing: border-box;
}

.ratio-btn.ar-9-16 .ratio-shape {
  width: 12px;
  height: 18px;
}

.ratio-text {
  font-size: 12px;
  line-height: 1;
}

.btn-generate {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  min-height: 32px;
  border-radius: 6px;
  border: none;
  background: #409eff;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
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

.btn-generate-full {
  width: 100%;
  padding: 5px 10px;
  min-height: 36px;
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

.handle-target { left: 0 !important; }
.handle-source { right: 0 !important; }

.video-node-bottom-enter-active,
.video-node-bottom-leave-active {
  transition:
    opacity 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}

.video-node-bottom-enter-from,
.video-node-bottom-leave-to {
  opacity: 0;
  transform: translate(-50%, 14px);
}

.video-node-bottom-enter-to,
.video-node-bottom-leave-from {
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

@keyframes icon-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

<style>
.video-node-model-popover.el-popper,
.video-node-model-popover {
  padding: 12px !important;
  background: #17181c !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 14px !important;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.5) !important;
}

.video-node-model-popover .model-panel-label {
  margin: 2px 0 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.58);
}

.video-node-model-popover .model-group {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
}

.video-node-model-popover .model-group::-webkit-scrollbar {
  width: 6px;
}

.video-node-model-popover .model-group::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.video-node-model-popover .model-group::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.video-node-model-popover .model-group::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

.video-node-model-popover .model-btn {
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

.video-node-model-popover .model-btn-icon {
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

.video-node-model-popover .model-btn-text {
  min-width: 0;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.video-node-model-popover .model-btn-icon.platform-jimeng { background: #f56c6c; }
.video-node-model-popover .model-btn-icon.platform-gpt { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.video-node-model-popover .model-btn-icon.platform-banana { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.video-node-model-popover .model-btn-icon.platform-qwen { background: #7c4dff; }
.video-node-model-popover .model-btn-icon.platform-grok { background: #444bff; }
.video-node-model-popover .model-btn-icon.platform-sora { background: #111827; }
.video-node-model-popover .model-btn-icon.platform-veo { background: #0ea5e9; }
.video-node-model-popover .model-btn-icon.platform-deepseek { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.video-node-model-popover .model-btn-icon.platform-kling { background: transparent; display: flex; align-items: center; justify-content: center; padding: 0; }
.video-node-model-popover .model-btn-icon.platform-other { background: #6b7280; }

.video-node-model-popover .provider-group {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.video-node-model-popover .provider-btn {
  min-height: 32px;
  width: 100%;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: #101114;
  color: rgba(220, 228, 242, 0.85);
  font-size: 12px;
  cursor: pointer;
}

.video-node-model-popover .provider-btn.active {
  border-color: rgba(64, 158, 255, 0.65);
  background: rgba(64, 158, 255, 0.2);
  color: #e8f1ff;
  font-weight: 600;
}

.video-node-model-popover .model-btn.active {
  border-color: rgba(64, 158, 255, 0.65);
  background: rgba(64, 158, 255, 0.2);
  color: #e8f1ff;
  font-weight: 600;
}

.video-node-model-popover .model-empty {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.52);
}

.video-node-settings-popover.el-popper,
.video-node-settings-popover {
  padding: 14px !important;
  background: #1a1a1a !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 14px !important;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55) !important;
}

.video-node-settings-popover .qa-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin: 12px 0 8px;
  font-weight: 500;
}

.video-node-settings-popover .qa-label:first-child {
  margin-top: 0;
}

.video-node-settings-popover .qa-segment {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #252525;
  border-radius: 10px;
}

.video-node-settings-popover .seg-btn {
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

.video-node-settings-popover .seg-btn.active {
  background: #333333;
  color: #ffffff;
  font-weight: 700;
}

.video-node-settings-popover .qa-ratios {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.video-node-settings-popover .ratio-btn {
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

.video-node-settings-popover .ratio-btn.active {
  background: #333333;
  color: #ffffff;
  font-weight: 600;
}

.video-node-settings-popover .ratio-shape {
  display: block;
  border: none;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.22);
}

.video-node-settings-popover .ratio-btn.active .ratio-shape {
  background: rgba(255, 255, 255, 0.95);
}
</style>
