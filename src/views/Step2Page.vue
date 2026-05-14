<script setup lang="ts">
defineOptions({
  name: 'Step2Page'
})

import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/stores/projectStore'
import { useStoryboardStore } from '@/stores/storyboardStore'
import { useApiConfigStore, type ApiModelGroup } from '@/stores/apiConfigStore'
import { useStep1Store } from '@/stores/step1Store'
import { useUserStore } from '@/stores/userStore'
import { usePromptsStore } from '@/stores/promptsStore'
import { useLogsStore } from '@/stores/logsStore'
import { useArtStyleStore } from '@/stores/artStyleStore'
import type { ArtStyle } from '@/stores/artStyleStore'
import { resolveArtStyleLabel } from '@/utils/artStyleLocale'
import { buildArtStylePromptPrefix } from '@/utils/artStylePrompt'
import { getModelPlatformBadge } from '@/utils/modelPlatformBadge'
import { generateStoryboardGridDataUrl } from '@/utils/storyboardGridReference'
import { useI18n } from 'vue-i18n'
import { projectFileService, type StoryboardData } from '@/services/projectFileService'
import apiService from '@/services/apiService'
import type { Storyboard } from '@/types'
import ProjectHeader from '@/components/editor/ProjectHeader.vue'
import {
  Plus,
  Picture,
  Film,
  Loading,
  CircleCheck,
  CircleClose,
  VideoPlay,
  CopyDocument,
  Delete,
  ArrowLeft,
  ArrowRight,
  Box,
  Close,
  Document,
  Grid,
  Microphone,
  Clock,
  Setting,
  Timer,
  Upload,
  Refresh,
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const storyboardStore = useStoryboardStore()
const apiConfigStore = useApiConfigStore()
const promptsStore = usePromptsStore()
const step1Store = useStep1Store()
const userStore = useUserStore()
const logsStore = useLogsStore()
const artStyleStore = useArtStyleStore()
const { t } = useI18n()

function artStyleSelectLabel(style: ArtStyle) {
  return resolveArtStyleLabel(style, t)
}

const modelGroupOpts = computed(() => [
  { value: 'youshang' as const, label: t('editorWorkshop.modelGroup.youshang') },
  { value: 'flow2' as const, label: t('editorWorkshop.modelGroup.flow2') }
])

const matchedAssetsSbCount = computed(
  () =>
    storyboardStore.storyboards.filter(
      (s) =>
        s.imagePrompt.characters.length > 0 ||
        s.imagePrompt.scene ||
        s.imagePrompt.props.length > 0
    ).length
)
const generatedImageSbCount = computed(() =>
  storyboardStore.storyboards.filter((s) => s.generatedImage).length
)
const generatedVideoSbCount = computed(() =>
  storyboardStore.storyboards.filter((s) => s.generatedVideo).length
)

const storyboardsContainerRef = ref<HTMLElement | null>(null)
const timelineViewMode = ref<'image' | 'video'>('image')
const propertiesTab = ref<'asset' | 'storyboard' | 'video' | 'audio'>('asset')

const imageSize = ref<'1k' | '2k'>('1k')
const imageFormat = ref<'single' | '4grid' | '6grid' | '9grid' | '16grid' | '25grid'>('single')
const imageAspectRatio = ref<'1:1' | '16:9' | '9:16' | '3:4' | '4:3'>('16:9')
const enableLocalBlend = ref(false)

const showLocalMergeDialog = ref(false)
const canvasImages = ref<Array<{ id: string; url: string; x: number; y: number; width: number; height: number; aspectRatio: number }>>([])
const selectedCanvasImage = ref<string | null>(null)
const isDragging = ref(false)
const isResizing = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const resizeStartData = ref({ width: 0, height: 0, x: 0, y: 0, mouseX: 0, mouseY: 0 })
const resizeDirection = ref<'tl' | 'tr' | 'bl' | 'br'>('br')
const canvasContainerRef = ref<HTMLElement | null>(null)
const localImageInputRef = ref<HTMLInputElement | null>(null)
const localVideoInputRef = ref<HTMLInputElement | null>(null)
const uploadingVideoStoryboardId = ref<string | null>(null)
const SNAP_THRESHOLD = 10

const savedMergeData = ref<Map<string, Array<{ id: string; url: string; x: number; y: number; width: number; height: number; aspectRatio: number }>>>(new Map())

const storyboardGenerateMode = ref<'all' | 'ungenerated' | 'custom'>('ungenerated')
const videoGenerateMode = ref<'all' | 'ungenerated' | 'custom'>('ungenerated')
const storyboardCustomRangeInput = ref('')
const videoCustomRangeInput = ref('')
const isBatchGenerating = ref(false)
const timelineListRef = ref<HTMLElement | null>(null)

const imageConcurrencyLocal = ref(apiConfigStore.imageConcurrency)
const videoConcurrencyLocal = ref(apiConfigStore.videoConcurrency)

const imageModelGroup = computed({
  get: () => apiConfigStore.imageModelGroup,
  set: (val) => apiConfigStore.setImageModelGroup(val)
})

const selectedImageModel = computed({
  get: () => apiConfigStore.imageModel,
  set: (val) => apiConfigStore.setImageModel(val)
})

const imageModelOptions = computed(() => {
  if (imageModelGroup.value === 'youshang') {
    return apiConfigStore.imageModels.map(model => ({
      ...model,
      badge: getModelPlatformBadge(model.id, model.name)
    }))
  }
  if (imageModelGroup.value === 'flow2') {
    return apiConfigStore.flow2ImageModels.map(model => ({
      ...model,
      badge: getModelPlatformBadge(model.id, model.name)
    }))
  }
  return []
})

const videoModelGroup = computed({
  get: () => apiConfigStore.videoModelGroup,
  set: (val) => apiConfigStore.setVideoModelGroup(val)
})
const selectedVideoModel = computed({
  get: () => apiConfigStore.videoModel,
  set: (val) => apiConfigStore.setVideoModel(val)
})

const videoModelOptions = computed(() => {
  if (videoModelGroup.value === 'youshang') {
    return apiConfigStore.videoModels.map(model => ({
      ...model,
      badge: getModelPlatformBadge(model.id, model.name)
    }))
  }
  if (videoModelGroup.value === 'flow2') {
    return apiConfigStore.flow2VideoModels.map(model => ({
      ...model,
      badge: getModelPlatformBadge(model.id, model.name)
    }))
  }
  return []
})

const imageModelGroupPopoverVisible = ref(false)
const imageModelPopoverVisible = ref(false)
const storyboardImagePromptPopoverVisible = ref(false)
const videoPromptTemplatePopoverVisible = ref(false)
const videoModelGroupPopoverVisible = ref(false)
const videoModelPopoverVisible = ref(false)

const currentImageModelGroupLabel = computed(() => {
  const option = modelGroupOpts.value.find(o => o.value === imageModelGroup.value)
  return option?.label || ''
})

const currentImageModel = computed(() => {
  return imageModelOptions.value.find(m => m.id === selectedImageModel.value)
})

const currentVideoModelGroupLabel = computed(() => {
  const option = modelGroupOpts.value.find(o => o.value === videoModelGroup.value)
  return option?.label || ''
})

const currentVideoModel = computed(() => {
  return videoModelOptions.value.find(m => m.id === selectedVideoModel.value)
})

/** 分镜 Tab：生成分镜图提示词（与 promptsStore id 8 默认一致） */
const selectedStep2StoryboardImagePromptId = ref('8')
/** 视频 Tab：生成视频提示词（与 promptsStore id 9 默认一致） */
const selectedStep2VideoPromptTemplateId = ref('9')

const generateStoryboardImagePrompts = computed(() =>
  promptsStore.getSubCategoryPrompts('generate-storyboard-image'),
)
const generateVideoPromptTemplates = computed(() => promptsStore.getSubCategoryPrompts('generate-video'))

const currentStep2StoryboardImagePrompt = computed(() =>
  generateStoryboardImagePrompts.value.find((p) => p.id === selectedStep2StoryboardImagePromptId.value),
)
const currentStep2VideoPromptTemplate = computed(() =>
  generateVideoPromptTemplates.value.find((p) => p.id === selectedStep2VideoPromptTemplateId.value),
)

function resolveStep2StoryboardImageTemplate(): string {
  const id = selectedStep2StoryboardImagePromptId.value
  const content = promptsStore.getPromptContentById(id)
  if (content && content.trim()) return content
  return promptsStore.getPromptContentById('8')
}

function resolveStep2VideoPromptTemplate(): string {
  const id = selectedStep2VideoPromptTemplateId.value
  const content = promptsStore.getPromptContentById(id)
  if (content && content.trim()) return content
  return promptsStore.getPromptContentById('9')
}

const aspectRatioPopoverVisible = ref(false)
const artStylePopoverVisible = ref(false)

const aspectRatioOptions = computed(() => [
  { value: '16:9', label: t('editorWorkshop.step2.ratio169') },
  { value: '1:1', label: t('editorWorkshop.step2.ratio11') },
  { value: '9:16', label: t('editorWorkshop.step2.ratio916') },
  { value: '3:4', label: t('editorWorkshop.step2.ratio34') },
  { value: '4:3', label: t('editorWorkshop.step2.ratio43') }
])

const currentAspectRatioLabel = computed(() => {
  const option = aspectRatioOptions.value.find(o => o.value === imageAspectRatio.value)
  return option?.label || ''
})

const currentArtStyleLabel = computed(() => {
  const style = artStyleStore.artStyles.find(s => s.value === artStyleStore.selectedStyle)
  return style ? artStyleSelectLabel(style) : ''
})

const imageSizePopoverVisible = ref(false)
const imageFormatPopoverVisible = ref(false)
const storyboardGenerateModePopoverVisible = ref(false)
const concurrencyPopoverVisible = ref(false)

const imageSizeOptions = computed(() => [
  { value: '1k', label: '1K' },
  { value: '2k', label: '2K' }
])

const currentImageSizeLabel = computed(() => {
  const option = imageSizeOptions.value.find(o => o.value === imageSize.value)
  return option?.label || ''
})

const imageFormatOptions = computed(() => [
  { value: 'single', label: t('editorWorkshop.step2.grid1') },
  { value: '4grid', label: t('editorWorkshop.step2.grid4') },
  { value: '6grid', label: t('editorWorkshop.step2.grid6') },
  { value: '9grid', label: t('editorWorkshop.step2.grid9') },
  { value: '16grid', label: t('editorWorkshop.step2.grid16') },
  { value: '25grid', label: t('editorWorkshop.step2.grid25') }
])

const currentImageFormatLabel = computed(() => {
  const option = imageFormatOptions.value.find(o => o.value === imageFormat.value)
  return option?.label || ''
})

const storyboardGenerateModeOptions = computed(() => [
  { value: 'all', label: t('editorWorkshop.step2.genModeAll') },
  { value: 'ungenerated', label: t('editorWorkshop.step2.genModeGap') },
  { value: 'custom', label: t('editorWorkshop.step2.genModeCustom') }
])

const currentStoryboardGenerateModeLabel = computed(() => {
  const option = storyboardGenerateModeOptions.value.find(o => o.value === storyboardGenerateMode.value)
  return option?.label || ''
})

const concurrencyOptions = computed(() => [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
  { value: 7, label: '7' },
  { value: 8, label: '8' },
  { value: 9, label: '9' },
  { value: 10, label: '10' }
])

const currentConcurrencyLabel = computed(() => {
  const option = concurrencyOptions.value.find(o => o.value === imageConcurrencyLocal.value)
  return option?.label || ''
})

const videoOrientationPopoverVisible = ref(false)
const videoDurationPopoverVisible = ref(false)
const videoArtStylePopoverVisible = ref(false)
const videoGenerateModePopoverVisible = ref(false)
const videoConcurrencyPopoverVisible = ref(false)

const currentVideoOrientationLabel = computed(() => {
  const option = orientationOptions.value.find(o => o.value === orientation.value)
  return option?.label || ''
})

const currentVideoDurationLabel = computed(() => {
  const option = availableDurationOptions.value.find(o => o.value === videoDuration.value)
  return option?.label || ''
})

const videoConcurrencyOptions = computed(() => [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
  { value: 7, label: '7' },
  { value: 8, label: '8' },
  { value: 9, label: '9' },
  { value: 10, label: '10' }
])

const currentVideoConcurrencyLabel = computed(() => {
  const option = videoConcurrencyOptions.value.find(o => o.value === videoConcurrencyLocal.value)
  return option?.label || ''
})

watch(imageConcurrencyLocal, (val) => {
  apiConfigStore.setImageConcurrency(val)
})

watch(videoConcurrencyLocal, (val) => {
  apiConfigStore.setVideoConcurrency(val)
})

const showScheduledTask = ref(false)
const scheduledStartTime = ref<Date | null>(null)
const scheduledInterval = ref('5')
const scheduledRetryRounds = ref('3')
const isScheduledTaskRunning = ref(false)
const countdownText = ref('')
const scheduledTaskTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const scheduledCountdownTimer = ref<ReturnType<typeof setInterval> | null>(null)
const currentRetryRound = ref(0)

const intervalOptions = computed(() =>
  ['1', '2', '3', '5', '10', '15', '20', '30'].map((v) => ({
    value: v,
    label: t('editorWorkshop.step2.minutes', { n: Number(v) })
  }))
)

const retryRoundOptions = computed(() =>
  ['1', '2', '3', '5', '10'].map((v) => ({
    value: v,
    label: t('editorWorkshop.step2.rounds', { n: Number(v) })
  }))
)

const project = computed(() => projectStore.currentProject)
const projectDataLoaded = computed(() => project.value ? projectStore.isProjectDataLoaded(project.value.id) : false)

const orientation = ref(project.value?.orientation || 'horizontal')

const orientationOptions = computed(() => [
  { value: 'horizontal', label: t('editorWorkshop.step2.landscape169') },
  { value: 'vertical', label: t('editorWorkshop.step2.vertical916') }
])

const secOpt = (seconds: string) => ({
  value: seconds,
  label: t('editorWorkshop.step2.secs', { n: Number(seconds) })
})

const videoDuration = ref('4')
const durationOptions = computed(() => ['4', '8', '12'].map((v) => secOpt(v)))

const modelDurationRaw: Record<string, string[]> = {
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

const modelDurationOptions = computed(() => {
  const out: Record<string, { value: string; label: string }[]> = {}
  for (const key of Object.keys(modelDurationRaw)) {
    out[key] = modelDurationRaw[key].map((v) => secOpt(v))
  }
  return out
})

const availableDurationOptions = computed(() => {
  const model = selectedVideoModel.value
  const localizedMap = modelDurationOptions.value
  if (model && localizedMap[model]) {
    const options = localizedMap[model]
    if (!options.find(o => o.value === videoDuration.value)) {
      videoDuration.value = options[0].value
    }
    return options
  }
  return durationOptions.value
})

watch(() => selectedVideoModel.value, () => {
  const options = availableDurationOptions.value
  if (options.length > 0 && !options.find(o => o.value === videoDuration.value)) {
    videoDuration.value = options[0].value
  }
})

const handleOrientationChange = async (value: 'horizontal' | 'vertical') => {
  if (!project.value) return
  const newResolution = value === 'horizontal'
    ? { width: 1920, height: 1080 }
    : { width: 1080, height: 1920 }
  await projectStore.updateProject(project.value.id, {
    orientation: value,
    resolution: newResolution
  })
}

const loadImageDimensions = (url: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      resolve({ width: 150, height: 150 })
    }
    img.src = url
  })
}

const currentStoryboardAssets = computed(() => {
  const assets: Array<{ id: string; name: string; url: string; type: string }> = []
  const currentStoryboard = storyboardStore.currentStoryboard

  if (!currentStoryboard) return assets

  const { characters, scene, props } = currentStoryboard.imagePrompt

  characters.forEach((char, index) => {
    if (char.url) {
      assets.push({
        id: `char-${char.id}`,
        name: char.name || t('editorWorkshop.step2.placeholderChar', { n: index + 1 }),
        url: char.url,
        type: 'character'
      })
    }
  })

  if (scene && scene.url) {
    assets.push({
      id: `scene-${scene.id}`,
      name: scene.name || t('editorWorkshop.step2.placeholderScene'),
      url: scene.url,
      type: 'scene'
    })
  }

  props.forEach((prop, index) => {
    if (prop.url) {
      assets.push({
        id: `prop-${prop.id}`,
        name: prop.name || t('editorWorkshop.step2.placeholderProp', { n: index + 1 }),
        url: prop.url,
        type: 'prop'
      })
    }
  })

  return assets
})

const handleOpenLocalMerge = async (storyboardId?: string) => {
  const targetId = storyboardId || storyboardStore.currentStoryboard?.id
  if (!targetId) return

  const targetIndex = storyboardStore.storyboards.findIndex(sb => sb.id === targetId)
  if (targetIndex === -1) return

  storyboardStore.setCurrentIndex(targetIndex)

  await nextTick()

  const currentStoryboard = storyboardStore.currentStoryboard
  if (!currentStoryboard) return

  const savedData = savedMergeData.value.get(currentStoryboard.id)
  if (savedData) {
    canvasImages.value = JSON.parse(JSON.stringify(savedData))
  } else {
    canvasImages.value = []
    const canvasWidth = 800
    const canvasHeight = 600
    const baseSize = 150

    console.log('当前分镜资产:', currentStoryboardAssets.value)

    const assets = currentStoryboardAssets.value
    const cols = Math.ceil(Math.sqrt(assets.length))
    const rows = Math.ceil(assets.length / cols)
    const cellWidth = canvasWidth / cols
    const cellHeight = canvasHeight / rows

    for (let index = 0; index < assets.length; index++) {
      const asset = assets[index]
      const dims = await loadImageDimensions(asset.url)
      const imgRatio = dims.width / dims.height

      let finalWidth, finalHeight
      if (imgRatio > 1) {
        finalWidth = baseSize
        finalHeight = baseSize / imgRatio
      } else {
        finalHeight = baseSize
        finalWidth = baseSize * imgRatio
      }

      const col = index % cols
      const row = Math.floor(index / cols)
      const cellX = col * cellWidth
      const cellY = row * cellHeight

      canvasImages.value.push({
        id: asset.id,
        url: asset.url,
        x: cellX + (cellWidth - finalWidth) / 2,
        y: cellY + (cellHeight - finalHeight) / 2,
        width: finalWidth,
        height: finalHeight,
        aspectRatio: imgRatio
      })
    }
  }

  selectedCanvasImage.value = null
  showLocalMergeDialog.value = true
}

const handleMergeDialogClose = () => {
  const currentStoryboard = storyboardStore.currentStoryboard
  if (currentStoryboard && canvasImages.value.length > 0) {
    savedMergeData.value.set(currentStoryboard.id, JSON.parse(JSON.stringify(canvasImages.value)))
  }
}

const handleSelectHistoryImage = (storyboardId: string, imageUrl: string, index?: number) => {
  const storyboard = storyboardStore.storyboards.find(s => s.id === storyboardId)
  if (!storyboard) {
    ElMessage.warning(t('editorWorkshop.messages.sbNotFound'))
    return
  }
  storyboardStore.selectGeneratedImage(storyboardId, imageUrl)
  if (index !== undefined) {
    ElMessage.success(
      t('editorWorkshop.messages.historyImgApplied', { i: index + 1, order: storyboard.order })
    )
  } else {
    ElMessage.success(t('editorWorkshop.messages.historyImgAppliedShort', { order: storyboard.order }))
  }
}

const handleSelectHistoryVideo = (storyboardId: string, videoUrl: string, index?: number) => {
  const storyboard = storyboardStore.storyboards.find(s => s.id === storyboardId)
  if (!storyboard) {
    ElMessage.warning(t('editorWorkshop.messages.sbNotFound'))
    return
  }
  storyboardStore.selectGeneratedVideo(storyboardId, videoUrl)
  if (index !== undefined) {
    ElMessage.success(
      t('editorWorkshop.messages.historyVidApplied', { i: index + 1, order: storyboard.order })
    )
  } else {
    ElMessage.success(t('editorWorkshop.messages.historyVidAppliedShort', { order: storyboard.order }))
  }
}

const handleClearHistoryImages = () => {
  const storyboard = storyboardStore.currentStoryboard
  if (!storyboard) return
  storyboard.generatedImages = []
  ElMessage.success(t('editorWorkshop.messages.historyImgCleared'))
}

const handleDeleteHistoryImage = (index: number) => {
  const storyboard = storyboardStore.currentStoryboard
  if (!storyboard || !storyboard.generatedImages) return
  storyboard.generatedImages.splice(index, 1)
  ElMessage.success(t('editorWorkshop.messages.historyImgRemoved'))
}

const handleClearHistoryVideos = () => {
  const storyboard = storyboardStore.currentStoryboard
  if (!storyboard) return
  storyboard.generatedVideos = []
  ElMessage.success(t('editorWorkshop.messages.historyVidCleared'))
}

const handleDeleteHistoryVideo = (index: number) => {
  const storyboard = storyboardStore.currentStoryboard
  if (!storyboard || !storyboard.generatedVideos) return
  storyboard.generatedVideos.splice(index, 1)
  ElMessage.success(t('editorWorkshop.messages.historyVidRemoved'))
}

const handleAddAssetToCanvas = async (asset: { id: string; name: string; url: string; type: string }) => {
  const exists = canvasImages.value.find(img => img.id === asset.id)
  if (exists) {
    ElMessage.warning(t('editorWorkshop.messages.assetInCanvas'))
    return
  }

  const canvasWidth = canvasContainerRef.value?.clientWidth || 800
  const canvasHeight = canvasContainerRef.value?.clientHeight || 600
  const baseSize = 150

  const dims = await loadImageDimensions(asset.url)
  const imgRatio = dims.width / dims.height

  let finalWidth, finalHeight
  if (imgRatio > 1) {
    finalWidth = baseSize
    finalHeight = baseSize / imgRatio
  } else {
    finalHeight = baseSize
    finalWidth = baseSize * imgRatio
  }

  canvasImages.value.push({
    id: asset.id,
    url: asset.url,
    x: Math.random() * (canvasWidth - finalWidth),
    y: Math.random() * (canvasHeight - finalHeight),
    width: finalWidth,
    height: finalHeight,
    aspectRatio: imgRatio
  })
}

const handleRemoveCanvasImage = (imageId: string) => {
  const index = canvasImages.value.findIndex(img => img.id === imageId)
  if (index !== -1) {
    canvasImages.value.splice(index, 1)
    if (selectedCanvasImage.value === imageId) {
      selectedCanvasImage.value = null
    }
  }
}

const handleCanvasMouseDown = (e: MouseEvent) => {
  if (e.target === canvasContainerRef.value) {
    selectedCanvasImage.value = null
  }
}

const handleCanvasMouseMove = (e: MouseEvent) => {
  if (isDragging.value && selectedCanvasImage.value) {
    const img = canvasImages.value.find(i => i.id === selectedCanvasImage.value)
    if (!img || !canvasContainerRef.value) return
    
    const rect = canvasContainerRef.value.getBoundingClientRect()
    let newX = e.clientX - rect.left - dragOffset.value.x
    let newY = e.clientY - rect.top - dragOffset.value.y
    
    newX = Math.max(0, Math.min(newX, canvasContainerRef.value.clientWidth - img.width))
    newY = Math.max(0, Math.min(newY, canvasContainerRef.value.clientHeight - img.height))
    
    canvasImages.value.forEach(otherImg => {
      if (otherImg.id === img.id) return
      
      if (Math.abs(newX - otherImg.x) < SNAP_THRESHOLD) {
        newX = otherImg.x
      }
      if (Math.abs(newX + img.width - otherImg.x - otherImg.width) < SNAP_THRESHOLD) {
        newX = otherImg.x + otherImg.width - img.width
      }
      if (Math.abs(newX - otherImg.x - otherImg.width) < SNAP_THRESHOLD) {
        newX = otherImg.x + otherImg.width
      }
      if (Math.abs(newX + img.width - otherImg.x) < SNAP_THRESHOLD) {
        newX = otherImg.x - img.width
      }
      
      if (Math.abs(newY - otherImg.y) < SNAP_THRESHOLD) {
        newY = otherImg.y
      }
      if (Math.abs(newY + img.height - otherImg.y - otherImg.height) < SNAP_THRESHOLD) {
        newY = otherImg.y + otherImg.height - img.height
      }
      if (Math.abs(newY - otherImg.y - otherImg.height) < SNAP_THRESHOLD) {
        newY = otherImg.y + otherImg.height
      }
      if (Math.abs(newY + img.height - otherImg.y) < SNAP_THRESHOLD) {
        newY = otherImg.y - img.height
      }
    })
    
    img.x = newX
    img.y = newY
  }
  
  if (isResizing.value && selectedCanvasImage.value) {
    const img = canvasImages.value.find(i => i.id === selectedCanvasImage.value)
    if (!img) return
    
    const deltaX = e.clientX - resizeStartData.value.mouseX
    const deltaY = e.clientY - resizeStartData.value.mouseY
    
    let newWidth = resizeStartData.value.width
    let newHeight = resizeStartData.value.height
    let newX = resizeStartData.value.x
    let newY = resizeStartData.value.y
    
    switch (resizeDirection.value) {
      case 'br':
        newWidth = Math.max(50, resizeStartData.value.width + deltaX)
        newHeight = newWidth / img.aspectRatio
        break
      case 'bl':
        newWidth = Math.max(50, resizeStartData.value.width - deltaX)
        newHeight = newWidth / img.aspectRatio
        newX = resizeStartData.value.x + resizeStartData.value.width - newWidth
        break
      case 'tr':
        newWidth = Math.max(50, resizeStartData.value.width + deltaX)
        newHeight = newWidth / img.aspectRatio
        newY = resizeStartData.value.y + resizeStartData.value.height - newHeight
        break
      case 'tl':
        newWidth = Math.max(50, resizeStartData.value.width - deltaX)
        newHeight = newWidth / img.aspectRatio
        newX = resizeStartData.value.x + resizeStartData.value.width - newWidth
        newY = resizeStartData.value.y + resizeStartData.value.height - newHeight
        break
    }
    
    img.width = newWidth
    img.height = newHeight
    img.x = newX
    img.y = newY
  }
}

const handleCanvasMouseUp = () => {
  isDragging.value = false
  isResizing.value = false
}

const handleImageMouseDown = (e: MouseEvent, img: { id: string; url: string; x: number; y: number; width: number; height: number; aspectRatio: number }) => {
  selectedCanvasImage.value = img.id
  isDragging.value = true
  dragOffset.value = { x: e.offsetX, y: e.offsetY }
}

const handleResizeStart = (e: MouseEvent, img: { id: string; url: string; x: number; y: number; width: number; height: number; aspectRatio: number }, direction: 'tl' | 'tr' | 'bl' | 'br') => {
  isResizing.value = true
  resizeDirection.value = direction
  resizeStartData.value = {
    width: img.width,
    height: img.height,
    x: img.x,
    y: img.y,
    mouseX: e.clientX,
    mouseY: e.clientY
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (!showLocalMergeDialog.value) return
  
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedCanvasImage.value) {
      handleRemoveCanvasImage(selectedCanvasImage.value)
    }
  }
}

watch(() => storyboardStore.currentStoryboardIndex, () => {
  if (showLocalMergeDialog.value) {
    canvasImages.value = []
    const currentStoryboard = storyboardStore.currentStoryboard
    if (currentStoryboard) {
      const savedData = savedMergeData.value.get(currentStoryboard.id)
      if (savedData) {
        canvasImages.value = JSON.parse(JSON.stringify(savedData))
      } else {
        currentStoryboardAssets.value.forEach((asset, index) => {
          const cols = Math.ceil(Math.sqrt(currentStoryboardAssets.value.length))
          const row = Math.floor(index / cols)
          const col = index % cols
          const imgSize = 150
          canvasImages.value.push({
            id: asset.id,
            url: asset.url,
            x: col * (imgSize + 20) + 20,
            y: row * (imgSize + 20) + 20,
            width: imgSize,
            height: imgSize,
            aspectRatio: 1
          })
        })
      }
    }
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  const projectId = route.params.id as string
  localStorage.setItem(`project_last_step_${projectId}`, 'step2')
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

const handleLocalImageUpload = () => {
  const input = localImageInputRef.value
  if (Array.isArray(input)) {
    input[0]?.click()
  } else {
    input?.click()
  }
}

const handleLocalImageSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string
    const localAsset = {
      id: `local_${Date.now()}`,
      name: file.name,
      url: dataUrl,
      type: 'local'
    }
    canvasImages.value.push({
      id: localAsset.id,
      url: localAsset.url,
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      aspectRatio: 1
    })
    selectedCanvasImage.value = localAsset.id
  }
  reader.readAsDataURL(file)
  input.value = ''
}

const handleLocalVideoUpload = (storyboardId: string) => {
  uploadingVideoStoryboardId.value = storyboardId
  const input = localVideoInputRef.value
  if (Array.isArray(input)) {
    const index = storyboardStore.storyboards.findIndex(sb => sb.id === storyboardId)
    if (index !== -1 && input[index]) {
      input[index].click()
    } else {
      input[0]?.click()
    }
  } else {
    input?.click()
  }
}

const handlePreviewImage = (imageUrl: string) => {
  previewImageUrl.value = imageUrl
  showImagePreviewDialog.value = true
}

const handleLocalVideoSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const storyboardId = uploadingVideoStoryboardId.value
  if (!storyboardId) {
    ElMessage.warning(t('editorWorkshop.messages.pickSbFirst'))
    return
  }

  try {
    const storyboard = storyboardStore.storyboards.find(s => s.id === storyboardId)
    if (!storyboard) {
      ElMessage.warning(t('editorWorkshop.messages.sbNotFound'))
      return
    }

    const project = projectStore.currentProject
    if (!project) {
      ElMessage.warning(t('editorWorkshop.messages.needProjectFirst'))
      return
    }

    ElMessage.info(t('editorWorkshop.messages.savingLocalVideo'))

    const fileBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    const fileName = `local_${Date.now()}_${file.name}`
    const saveResult = await projectFileService.saveLocalVideo(
      project.id,
      project.name,
      fileName,
      fileBase64
    )

    if (saveResult.success && saveResult.path) {
      storyboardStore.setGeneratedVideo(storyboardId, saveResult.path)
      ElMessage.success(t('editorWorkshop.messages.localVideoImported'))
    } else {
      ElMessage.error(
        t('editorWorkshop.messages.vidSaveFail', {
          msg: saveResult.message || t('logsPage.msg.unknownErr')
        })
      )
    }
  } catch (error) {
    console.error('本地视频导入失败:', error)
    ElMessage.error(t('editorWorkshop.messages.localVideoImportFail'))
  } finally {
    input.value = ''
    uploadingVideoStoryboardId.value = null
  }
}

const handleClearCanvas = () => {
  canvasImages.value = []
  selectedCanvasImage.value = null
}

const handleResetLayout = () => {
  const count = canvasImages.value.length
  if (count === 0) return

  const canvasWidth = canvasContainerRef.value?.clientWidth || 800
  const canvasHeight = canvasContainerRef.value?.clientHeight || 600
  const padding = 10

  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)

  canvasImages.value.forEach((img, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)

    const imgRatio = img.aspectRatio || 1

    const availableWidth = (canvasWidth - padding * 2) / cols
    const availableHeight = (canvasHeight - padding * 2) / rows

    const cellRatio = availableWidth / availableHeight

    let finalWidth, finalHeight
    if (imgRatio > cellRatio) {
      finalWidth = availableWidth - padding * 2
      finalHeight = finalWidth / imgRatio
    } else {
      finalHeight = availableHeight - padding * 2
      finalWidth = finalHeight * imgRatio
    }

    const cellX = col * availableWidth
    const cellY = row * availableHeight

    img.x = cellX + (availableWidth - finalWidth) / 2
    img.y = cellY + (availableHeight - finalHeight) / 2
    img.width = finalWidth
    img.height = finalHeight
  })
}

const handleConfirmMerge = async () => {
  if (canvasImages.value.length === 0) {
    ElMessage.warning(t('editorWorkshop.messages.noImagesCanvas'))
    return
  }
  
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    ElMessage.error(t('editorWorkshop.messages.cannotCreateCanvas'))
    return
  }
  
  const canvasWidth = canvasContainerRef.value?.clientWidth || 800
  const canvasHeight = canvasContainerRef.value?.clientHeight || 600
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  
  const loadPromises = canvasImages.value.map(img => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = img.url
    })
  })
  
  try {
    const images = await Promise.all(loadPromises)
    
    canvasImages.value.forEach((imgData, index) => {
      const image = images[index]
      ctx.drawImage(image, imgData.x, imgData.y, imgData.width, imgData.height)
    })
    
    const mergedImageUrl = canvas.toDataURL('image/png')
    
    const currentStoryboard = storyboardStore.currentStoryboard
    if (currentStoryboard) {
      storyboardStore.setGeneratedImage(currentStoryboard.id, mergedImageUrl)
      ElMessage.success(t('editorWorkshop.messages.composeOk'))
      showLocalMergeDialog.value = false
    }
  } catch (error) {
    console.error('合成失败:', error)
    ElMessage.error(t('editorWorkshop.messages.composeFail'))
  }
}

const handleSelectStoryboard = (index: number) => {
  storyboardStore.setCurrentIndex(index)
  scrollToStoryboard(index)
}

const scrollToStoryboard = async (index: number) => {
  if (!storyboardsContainerRef.value) return
  
  await nextTick()
  
  const rows = storyboardsContainerRef.value.querySelectorAll('.storyboard-row')
  if (rows[index]) {
    rows[index].scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

const getStatusClass = (status: string) => {
  return `status-${status}`
}

const handleTimelineScroll = (direction: 'left' | 'right') => {
  if (!timelineListRef.value) return
  
  const cardWidth = 123
  const scrollAmount = cardWidth * 3
  
  if (direction === 'left') {
    timelineListRef.value.scrollBy({
      left: -scrollAmount,
      behavior: 'smooth'
    })
  } else {
    timelineListRef.value.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    })
  }
}

const handleAddStoryboard = () => {
  const creativeContent = projectStore.pendingCreativeContent
  projectStore.pendingCreativeContent = null
  
  const newStoryboard: Storyboard = {
    id: Date.now().toString(),
    order: storyboardStore.storyboardCount + 1,
    duration: 5,
    textPrompt: {
      description: creativeContent || '',
      systemPrompt: '',
    },
    imagePrompt: {
      characters: [],
      scene: undefined,
      props: [],
      compositeSettings: {
        positionX: 0,
        positionY: 0,
        scale: 1,
        opacity: 1,
        blendMode: 'normal'
      }
    },
    generatedImages: [],
    generatedImage: undefined,
    generatedVideos: [],
    generatedVideo: undefined,
    status: 'pending',
  }
  storyboardStore.addStoryboard(newStoryboard)
}

const handleAddStoryboardAfter = (index: number) => {
  const newStoryboard: Storyboard = {
    id: Date.now().toString(),
    order: index + 2,
    duration: 5,
    textPrompt: {
      description: '',
      systemPrompt: '',
    },
    imagePrompt: {
      characters: [],
      scene: undefined,
      props: [],
      compositeSettings: {
        positionX: 0,
        positionY: 0,
        scale: 1,
        opacity: 1,
        blendMode: 'normal'
      }
    },
    generatedImages: [],
    generatedImage: undefined,
    generatedVideos: [],
    generatedVideo: undefined,
    status: 'pending',
  }
  storyboardStore.insertStoryboard(index + 1, newStoryboard)
  ElMessage.success(t('editorWorkshop.messages.sbAdded'))
}

const handleDuplicateStoryboard = (storyboardId: string) => {
  storyboardStore.duplicateStoryboard(storyboardId)
  ElMessage.success(t('editorWorkshop.messages.sbCopied'))
}

const handleDeleteStoryboard = (storyboardId: string) => {
  if (storyboardStore.storyboardCount <= 1) {
    ElMessage.warning(t('editorWorkshop.messages.sbKeepOne'))
    return
  }
  storyboardStore.deleteStoryboard(storyboardId)
  ElMessage.success(t('editorWorkshop.messages.sbDeleted'))
}

const uploadDevTypeLabel = (type: string) => {
  if (type === '场景' || type === 'scene' || type === 'Scene') {
    return t('editorWorkshop.messages.typeSceneShort')
  }
  if (type === '道具' || type === 'prop' || type === 'Prop') {
    return t('editorWorkshop.messages.typePropShort')
  }
  return t('editorWorkshop.messages.typeCharShort')
}

const handleUploadAsset = (type: string) => {
  ElMessage.info(t('editorWorkshop.messages.uploadDev', { type: uploadDevTypeLabel(type) }))
}

const handleGenerateTextFor = async (storyboardId: string) => {
  const storyboard = storyboardStore.storyboards.find(s => s.id === storyboardId)
  if (!storyboard) return
  
  const prompt = storyboard.textPrompt?.description
  if (!prompt || prompt.trim() === '') {
    ElMessage.warning(t('editorWorkshop.messages.enterSbDesc'))
    return
  }

  if (!apiConfigStore.isApiReadyForGroup(apiConfigStore.textApiModelGroup)) {
    ElMessage.warning(
      apiConfigStore.textApiModelGroup === 'flow2'
        ? t('settings.msg.enterApiUrlFirst')
        : t('editorWorkshop.step1.msgNeedApiKey')
    )
    return
  }

  if (!apiConfigStore.storyboardPromptModel) {
    ElMessage.warning(t('editorWorkshop.messages.pickSbPromptModel'))
    return
  }

  logsStore.addLog(
    'optimize-storyboard',
    'info',
    {
      messageKey: 'logsPage.msg.optSbStartTitle',
      detailKey: 'logsPage.msg.detailShotOrder',
      detailParams: { order: storyboard.order }
    },
    projectStore.currentProject?.id,
    projectStore.currentProject?.name
  )
  storyboardStore.setGeneratingType(storyboardId, 'text')
  storyboardStore.setStoryboardStatus(storyboardId, 'generating')
  try {
    const systemPrompt = promptsStore.getOptimizeTextPrompt()

    const optimizedPrompt = await apiService.generateText(prompt, {
      model: apiConfigStore.storyboardPromptModel,
      systemPrompt,
      modelGroup: apiConfigStore.textApiModelGroup
    })
    
    if (optimizedPrompt) {
      storyboardStore.updateStoryboard(storyboardId, {
        textPrompt: {
          description: optimizedPrompt,
          systemPrompt: storyboard.textPrompt?.systemPrompt || ''
        }
      })
      storyboardStore.setStoryboardStatus(storyboardId, 'completed')
      logsStore.addLog(
        'optimize-storyboard',
        'success',
        {
          messageKey: 'logsPage.msg.optSbOkTitle',
          detailKey: 'logsPage.msg.detailShotOrder',
          detailParams: { order: storyboard.order }
        },
        projectStore.currentProject?.id,
        projectStore.currentProject?.name
      )
      ElMessage.success(t('editorWorkshop.messages.promptOptOk'))
    } else {
      throw new Error(t('editorWorkshop.messages.noOptResult'))
    }
  } catch (error) {
    storyboardStore.setStoryboardStatus(storyboardId, 'failed')
    logsStore.addLog(
      'optimize-storyboard',
      'error',
      {
        messageKey: 'logsPage.msg.optSbFailTitle',
        detailRaw: error instanceof Error ? error.message : t('logsPage.msg.unknownErr')
      },
      projectStore.currentProject?.id,
      projectStore.currentProject?.name
    )
    ElMessage.error(
      t('editorWorkshop.messages.promptOptFail', {
        msg: error instanceof Error ? error.message : t('logsPage.msg.unknownErr')
      })
    )
  } finally {
    storyboardStore.setGeneratingType(storyboardId, null)
  }
}

const getGridConfig = (format: string): { rows: number; cols: number } => {
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
      return { rows: 1, cols: 1 }
  }
}

const handleGenerateImageFor = async (storyboardId: string) => {
  const storyboard = storyboardStore.storyboards.find(s => s.id === storyboardId)
  if (!storyboard) return

  const storyboardPrompt = storyboard.textPrompt?.description
  if (!storyboardPrompt) {
    ElMessage.warning(t('editorWorkshop.messages.enterSbPrompt'))
    return
  }

  if (!apiConfigStore.isApiReadyForGroup(imageModelGroup.value)) {
    ElMessage.warning(
      imageModelGroup.value === 'flow2'
        ? t('settings.msg.enterApiUrlFirst')
        : t('editorWorkshop.step1.msgNeedApiKey')
    )
    return
  }

  if (!apiConfigStore.imageModel) {
    ElMessage.warning(t('editorWorkshop.messages.pickImageModel'))
    return
  }

  const project = projectStore.currentProject
  if (!project) {
    ElMessage.warning(t('editorWorkshop.step1.msgSelectProject'))
    return
  }

  const referenceImages: string[] = []

  storyboard.imagePrompt.characters.forEach(char => {
    if (char.url) {
      referenceImages.push(char.url)
    }
  })

  if (storyboard.imagePrompt.scene?.url) {
    referenceImages.push(storyboard.imagePrompt.scene.url)
  }

  storyboard.imagePrompt.props.forEach(prop => {
    if (prop.url) {
      referenceImages.push(prop.url)
    }
  })

  const { rows, cols } = getGridConfig(imageFormat.value)
  
  // 生成宫格线框图并添加到参考图列表
  if (rows > 1 || cols > 1) {
    const gridDataUrl = generateStoryboardGridDataUrl(
      imageAspectRatio.value,
      rows,
      cols,
      imageSize.value === '1k' ? '1K' : '2K'
    )
    referenceImages.push(gridDataUrl)
  }

  const storyboardImageTemplate = resolveStep2StoryboardImageTemplate()
  const styleBlock = buildArtStylePromptPrefix(artStyleStore.artStyles, artStyleStore.selectedStyle)
  
  // 构建宫格相关的提示词
  let gridPrompt = ''
  if (rows > 1 || cols > 1) {
    if (rows === 1 && cols === 1) {
      gridPrompt = '请生成一张单格分镜整图（一整幅画面），保持角色与场景风格一致。画面宽高比须与参考线框图一致，勿自行裁成方形。'
    } else {
      gridPrompt = `请生成一张共 ${rows} 行 ${cols} 列宫格的分镜图，每格内容按照分镜描述依次排列，保持角色与场景风格一致。整体宽高比须与参考线框图一致。`
    }
  }
  
  const finalPrompt = `${storyboardImageTemplate}\n\n${styleBlock}${t('editorWorkshop.step2.markerShotPrompt')}\n${gridPrompt}\n${storyboardPrompt}`

  const refExtra =
    referenceImages.length > 0 ? t('logsPage.msg.refsExtra', { n: referenceImages.length }) : ''
  logsStore.addLog(
    'storyboard-image',
    'info',
    {
      messageKey: 'logsPage.msg.sbImgGenStart',
      detailKey: 'logsPage.msg.detailSbOrderExtra',
      detailParams: { order: storyboard.order, extra: refExtra }
    },
    projectStore.currentProject?.id,
    projectStore.currentProject?.name
  )
  storyboardStore.setGeneratingType(storyboardId, 'image')
  storyboardStore.setStoryboardStatus(storyboardId, 'generating')
  try {
    const imageUrl = await apiService.generateImage(finalPrompt, {
      model: apiConfigStore.imageModel,
      size: imageSize.value,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      aspectRatio: imageAspectRatio.value,
      modelGroup: imageModelGroup.value
    })
    
    if (imageUrl) {
      const fileName = projectFileService.generateImageFileName(storyboardId)
      
      const saveResult = await projectFileService.saveImage(
        project.id,
        project.name,
        'storyboard',
        fileName,
        imageUrl
      )

      let finalImageUrl = imageUrl
      if (saveResult.success && saveResult.path) {
        let path = saveResult.path.replace(/\\/g, '/')
        if (path.startsWith('file://')) {
          finalImageUrl = path
        } else {
          finalImageUrl = 'file://' + path
        }
        console.log('分镜图已保存到项目文件夹:', finalImageUrl)
      }
      
      storyboardStore.setGeneratedImage(storyboardId, finalImageUrl)

      logsStore.addLog(
        'storyboard-image',
        'success',
        {
          messageKey: 'logsPage.msg.sbImgOkTitle',
          detailKey: 'logsPage.msg.detailShotOrder',
          detailParams: { order: storyboard.order }
        },
        projectStore.currentProject?.id,
        projectStore.currentProject?.name
      )
      ElMessage.success(t('editorWorkshop.messages.sbImgOk'))
    } else {
      throw new Error(t('editorWorkshop.messages.unknownUrl'))
    }
  } catch (error) {
    storyboardStore.setStoryboardStatus(storyboardId, 'failed')
    logsStore.addLog(
      'storyboard-image',
      'error',
      {
        messageKey: 'logsPage.msg.sbImgFailTitle',
        detailRaw: error instanceof Error ? error.message : t('logsPage.msg.unknownErr')
      },
      projectStore.currentProject?.id,
      projectStore.currentProject?.name
    )
    ElMessage.error(
      t('editorWorkshop.messages.sbImgFail', {
        msg: error instanceof Error ? error.message : t('logsPage.msg.unknownErr')
      })
    )
  } finally {
    storyboardStore.setGeneratingType(storyboardId, null)
  }
}

const handleGenerateVideoFor = async (storyboardId: string) => {
  const storyboard = storyboardStore.storyboards.find(s => s.id === storyboardId)
  if (!storyboard) return
  
  const project = projectStore.currentProject
  if (!project) {
    ElMessage.warning(t('editorWorkshop.step1.msgSelectProject'))
    return
  }

  if (!apiConfigStore.isApiReadyForGroup(videoModelGroup.value)) {
    ElMessage.warning(
      videoModelGroup.value === 'flow2'
        ? t('settings.msg.enterApiUrlFirst')
        : t('editorWorkshop.step1.msgNeedApiKey')
    )
    return
  }

  if (!selectedVideoModel.value) {
    ElMessage.warning(t('editorWorkshop.messages.pickVidModelTab'))
    return
  }

  const storyboardPrompt = storyboard.textPrompt?.description || ''
  if (!storyboardPrompt) {
    ElMessage.warning(t('editorWorkshop.messages.fillSbPrompt'))
    return
  }

  const videoPromptTemplate = resolveStep2VideoPromptTemplate()
  const videoPrompt = `${videoPromptTemplate}\n\n${t('editorWorkshop.step2.markerShotPrompt')}\n${storyboardPrompt}`

  const styleBlock = buildArtStylePromptPrefix(artStyleStore.artStyles, artStyleStore.selectedStyle)
  const finalPrompt = `${styleBlock}${videoPrompt}`

  // 验证并修正 Kling 模型的时长
  let finalDuration = videoDuration.value
  if (selectedVideoModel.value === 'kling-video' || selectedVideoModel.value === 'kling-omni-video') {
    const validDurations = ['5', '10']
    if (!validDurations.includes(finalDuration)) {
      finalDuration = validDurations[0] // 默认选择 5 秒
      videoDuration.value = finalDuration
      ElMessage.warning(`Kling 模型仅支持 5 秒或 10 秒视频，已自动切换为 ${finalDuration} 秒`)
    }
  }

  logsStore.addLog(
    'ai-video',
    'info',
    {
      messageKey: 'logsPage.msg.aiVideoGenStart',
      detailKey: 'logsPage.msg.detailAiVideoParams',
      detailParams: {
        order: storyboard.order,
        model: selectedVideoModel.value,
        orient: orientation.value,
        secs: finalDuration
      }
    },
    projectStore.currentProject?.id,
    projectStore.currentProject?.name
  )
  storyboardStore.setGeneratingType(storyboardId, 'video')
  storyboardStore.setStoryboardStatus(storyboardId, 'generating')
  try {
    console.log('视频生成提示词:', finalPrompt)
    console.log('视频模型:', selectedVideoModel.value)
    console.log('视频方向:', orientation.value)
    console.log('视频时长:', finalDuration)
    console.log('分镜图:', storyboard.generatedImage)

    const videoUrl = await apiService.generateVideo(finalPrompt, {
      model: selectedVideoModel.value,
      aspectRatio: orientation.value,
      duration: finalDuration,
      referenceImage: storyboard.generatedImage,
      modelGroup: videoModelGroup.value
    })

    if (videoUrl) {
      const fileName = projectFileService.generateVideoFileName(storyboardId)
      const saveResult = await projectFileService.saveVideo(
        project.id,
        project.name,
        fileName,
        videoUrl
      )
      
      let finalVideoUrl = videoUrl
      if (saveResult.success && saveResult.path) {
        let path = saveResult.path.replace(/\\/g, '/')
        if (path.startsWith('file://')) {
          finalVideoUrl = path
        } else {
          finalVideoUrl = 'file://' + path
        }
        console.log('视频已保存到项目文件夹:', finalVideoUrl)
      }
      
      storyboardStore.setGeneratedVideo(storyboardId, finalVideoUrl)

      logsStore.addLog(
        'ai-video',
        'success',
        {
          messageKey: 'logsPage.msg.aiVideoOkTitle',
          detailKey: 'logsPage.msg.detailShotOrder',
          detailParams: { order: storyboard.order }
        },
        projectStore.currentProject?.id,
        projectStore.currentProject?.name
      )
      ElMessage.success(t('editorWorkshop.messages.vidOk'))
    } else {
      throw new Error(t('editorWorkshop.messages.unknownVidUrl'))
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('logsPage.msg.unknownErr')
    const videoId = (error as any).videoId
    const isTimeout =
      !!videoId &&
      (errorMessage.includes('超时') || /timeout/i.test(errorMessage))

    if (isTimeout) {
      storyboardStore.updateStoryboard(storyboardId, {
        videoTaskId: videoId,
        videoApiModelGroup: videoModelGroup.value
      })
      storyboardStore.setStoryboardStatus(storyboardId, 'generating')
      logsStore.addLog(
        'ai-video',
        'warning',
        {
          messageKey: 'logsPage.msg.aiVideoTimeoutTitle',
          detailKey: 'logsPage.msg.detailVideoTimeout',
          detailParams: { order: storyboard.order, taskId: videoId }
        },
        projectStore.currentProject?.id,
        projectStore.currentProject?.name
      )
      ElMessage.warning(t('editorWorkshop.messages.vidTimeoutRecover'))
    } else {
      storyboardStore.setStoryboardStatus(storyboardId, 'failed')
      logsStore.addLog(
        'ai-video',
        'error',
        {
          messageKey: 'logsPage.msg.aiVideoFailTitle',
          detailRaw: errorMessage
        },
        projectStore.currentProject?.id,
        projectStore.currentProject?.name
      )
      ElMessage.error(t('editorWorkshop.messages.vidFail', { msg: errorMessage }))
    }
  } finally {
    storyboardStore.setGeneratingType(storyboardId, null)
  }
}

const handleResumeVideo = async (storyboardId: string) => {
  const storyboard = storyboardStore.storyboards.find(s => s.id === storyboardId)
  if (!storyboard?.videoTaskId) {
    ElMessage.warning(t('editorWorkshop.messages.noRecoverVid'))
    return
  }

  const project = projectStore.currentProject
  if (!project) {
    ElMessage.warning(t('editorWorkshop.messages.openProjectFirst'))
    return
  }

  logsStore.addLog(
    'ai-video',
    'info',
    {
      messageKey: 'logsPage.msg.vidRecoverPollTitle',
      detailKey: 'logsPage.msg.detailVidPoll',
      detailParams: { order: storyboard.order, taskId: storyboard.videoTaskId }
    },
    projectStore.currentProject?.id,
    projectStore.currentProject?.name
  )
  storyboardStore.setGeneratingType(storyboardId, 'video')

  try {
    const pollGroup = (storyboard.videoApiModelGroup ?? videoModelGroup.value) as ApiModelGroup
    if (!apiConfigStore.isApiReadyForGroup(pollGroup)) {
      ElMessage.warning(
        pollGroup === 'flow2'
          ? t('settings.msg.enterApiUrlFirst')
          : t('editorWorkshop.step1.msgNeedApiKey')
      )
      return
    }

    const result = await apiService.queryGrokVideoStatus(storyboard.videoTaskId, pollGroup)

    if (result.status === 'completed' && result.videoUrl) {
      const fileName = projectFileService.generateVideoFileName(storyboardId)
      const saveResult = await projectFileService.saveVideo(project.id, project.name, fileName, result.videoUrl)

      let finalVideoUrl = result.videoUrl
      if (saveResult.success && saveResult.path) {
        finalVideoUrl = 'file://' + saveResult.path.replace(/\\/g, '/')
      }

      storyboardStore.setGeneratedVideo(storyboardId, finalVideoUrl)
      storyboardStore.updateStoryboard(storyboardId, { videoTaskId: undefined, videoApiModelGroup: undefined })
      storyboardStore.setStoryboardStatus(storyboardId, 'completed')

      logsStore.addLog(
        'ai-video',
        'success',
        {
          messageKey: 'logsPage.msg.vidRecoverOkTitle',
          detailKey: 'logsPage.msg.detailShotOrder',
          detailParams: { order: storyboard.order }
        },
        projectStore.currentProject?.id,
        projectStore.currentProject?.name
      )
      ElMessage.success(t('editorWorkshop.messages.vidRecoverOk'))
    } else if (result.status === 'failed') {
      storyboardStore.setStoryboardStatus(storyboardId, 'failed')
      storyboardStore.updateStoryboard(storyboardId, { videoTaskId: undefined, videoApiModelGroup: undefined })
      logsStore.addLog(
        'ai-video',
        'error',
        {
          messageKey: 'logsPage.msg.vidRecoverFailTitle',
          detailRaw: result.error || t('logsPage.msg.unknownErr')
        },
        projectStore.currentProject?.id,
        projectStore.currentProject?.name
      )
      ElMessage.error(
        t('editorWorkshop.messages.vidRecoverFail', {
          msg: result.error || t('logsPage.msg.unknownErr')
        })
      )
    } else {
      ElMessage.info(t('editorWorkshop.messages.vidStillGenerating'))
    }
  } catch (error) {
    logsStore.addLog(
      'ai-video',
      'error',
      {
        messageKey: 'logsPage.msg.vidRecoverErrTitle',
        detailRaw: error instanceof Error ? error.message : t('logsPage.msg.unknownErr')
      },
      projectStore.currentProject?.id,
      projectStore.currentProject?.name
    )
    ElMessage.error(
      t('editorWorkshop.messages.vidRecoverErr', {
        msg: error instanceof Error ? error.message : t('logsPage.msg.unknownErr')
      })
    )
  } finally {
    storyboardStore.setGeneratingType(storyboardId, null)
  }
}

const parseRangeExpression = (expression: string): number[] => {
  const indices: Set<number> = new Set()
  const parts = expression.split(',').map(p => p.trim()).filter(p => p)
  
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(n => parseInt(n.trim(), 10))
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          indices.add(i)
        }
      }
    } else {
      const num = parseInt(part, 10)
      if (!isNaN(num)) {
        indices.add(num)
      }
    }
  }
  
  return Array.from(indices).sort((a, b) => a - b)
}

const runWithConcurrency = async <T,>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<{ results: (T | Error)[]; successCount: number; failCount: number }> => {
  const results: (T | Error)[] = new Array(tasks.length)
  let successCount = 0
  let failCount = 0
  
  const executeTask = async (index: number) => {
    try {
      results[index] = await tasks[index]()
      successCount++
    } catch (error) {
      results[index] = error instanceof Error ? error : new Error(String(error))
      failCount++
    }
  }
  
  const executing: Promise<void>[] = []
  for (let i = 0; i < tasks.length; i++) {
    const promise = executeTask(i)
    executing.push(promise)
    
    if (executing.length >= concurrency) {
      await Promise.race(executing)
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      )
    }
  }
  
  await Promise.all(executing)
  
  return { results, successCount, failCount }
}

const getTargetStoryboardIndicesForStoryboard = (): number[] => {
  if (storyboardGenerateMode.value === 'all') {
    return storyboardStore.storyboards.map((_, index) => index)
  } else if (storyboardGenerateMode.value === 'ungenerated') {
    return storyboardStore.storyboards
      .map((storyboard, index) => !storyboard.generatedImage ? index : -1)
      .filter(index => index !== -1)
  } else {
    const rangeParts = storyboardCustomRangeInput.value.split(',').map(s => s.trim()).filter(Boolean)
    const indices = new Set<number>()
    for (const part of rangeParts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim()))
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            indices.add(i - 1)
          }
        }
      } else {
        const num = parseInt(part)
        if (!isNaN(num)) {
          indices.add(num - 1)
        }
      }
    }
    return Array.from(indices).filter(i => i >= 0 && i < storyboardStore.storyboardCount).sort((a, b) => a - b)
  }
}

const handleBatchGenerateStoryboards = async () => {
  const indices = getTargetStoryboardIndicesForStoryboard()

  if (indices.length === 0) {
    ElMessage.warning(t('editorWorkshop.messages.noSbToGen'))
    return
  }

  isBatchGenerating.value = true
  const concurrency = apiConfigStore.imageConcurrency

  logsStore.addLog(
    'batch-storyboard-image',
    'info',
    {
      messageKey: 'logsPage.msg.batchSbImgStart',
      detailKey: 'logsPage.msg.detailTotalConc',
      detailParams: { total: indices.length, conc: concurrency }
    },
    projectStore.currentProject?.id,
    projectStore.currentProject?.name
  )
  ElMessage.info(
    t('editorWorkshop.messages.batchSbStart', { n: indices.length, c: concurrency })
  )

  const tasks = indices
    .map(index => storyboardStore.storyboards[index])
    .filter(storyboard => storyboard)
    .map(storyboard => () => handleGenerateImageFor(storyboard.id))

  const { successCount, failCount } = await runWithConcurrency(tasks, concurrency)

  isBatchGenerating.value = false

  if (failCount === 0) {
    logsStore.addLog(
      'batch-storyboard-image',
      'success',
      {
        messageKey: 'logsPage.msg.batchSbDoneOkTitle',
        detailKey: 'logsPage.msg.detailOkOnly',
        detailParams: { ok: successCount }
      },
      projectStore.currentProject?.id,
      projectStore.currentProject?.name
    )
    ElMessage.success(
      t('editorWorkshop.messages.batchSbDone', { ok: successCount })
    )
  } else {
    logsStore.addLog(
      'batch-storyboard-image',
      'warning',
      {
        messageKey: 'logsPage.msg.batchSbDoneMixedTitle',
        detailKey: 'logsPage.msg.detailOkFail',
        detailParams: { ok: successCount, fail: failCount }
      },
      projectStore.currentProject?.id,
      projectStore.currentProject?.name
    )
    ElMessage.warning(
      t('editorWorkshop.messages.batchSbMixed', { ok: successCount, fail: failCount })
    )
  }
}

const getTargetVideoIndices = (): number[] => {
  if (videoGenerateMode.value === 'all') {
    return storyboardStore.storyboards.map((_, index) => index)
  } else if (videoGenerateMode.value === 'ungenerated') {
    return storyboardStore.storyboards
      .map((storyboard, index) => !storyboard.generatedVideo ? index : -1)
      .filter(index => index !== -1)
  } else {
    const rangeParts = videoCustomRangeInput.value.split(',').map(s => s.trim()).filter(Boolean)
    const indices = new Set<number>()
    for (const part of rangeParts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim()))
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            indices.add(i - 1)
          }
        }
      } else {
        const num = parseInt(part)
        if (!isNaN(num)) {
          indices.add(num - 1)
        }
      }
    }
    return Array.from(indices).filter(i => i >= 0 && i < storyboardStore.storyboardCount).sort((a, b) => a - b)
  }
}

const handleBatchGenerateVideos = async () => {
  const indices = getTargetVideoIndices()

  if (indices.length === 0) {
    ElMessage.warning(t('editorWorkshop.messages.noVidToGen'))
    return
  }

  isBatchGenerating.value = true
  const concurrency = apiConfigStore.videoConcurrency

  logsStore.addLog(
    'batch-video',
    'info',
    {
      messageKey: 'logsPage.msg.batchVidStart',
      detailKey: 'logsPage.msg.detailTotalConc',
      detailParams: { total: indices.length, conc: concurrency }
    },
    projectStore.currentProject?.id,
    projectStore.currentProject?.name
  )
  ElMessage.info(
    t('editorWorkshop.messages.batchVidStart', { n: indices.length, c: concurrency })
  )

  const tasks = indices
    .map(index => storyboardStore.storyboards[index])
    .filter(storyboard => storyboard)
    .map(storyboard => () => handleGenerateVideoFor(storyboard.id))

  const { successCount, failCount } = await runWithConcurrency(tasks, concurrency)

  isBatchGenerating.value = false

  if (failCount === 0) {
    logsStore.addLog(
      'batch-video',
      'success',
      {
        messageKey: 'logsPage.msg.batchVidDoneOkTitle',
        detailKey: 'logsPage.msg.detailOkOnly',
        detailParams: { ok: successCount }
      },
      projectStore.currentProject?.id,
      projectStore.currentProject?.name
    )
    ElMessage.success(
      t('editorWorkshop.messages.batchVidDone', { ok: successCount })
    )
  } else {
    logsStore.addLog(
      'batch-video',
      'warning',
      {
        messageKey: 'logsPage.msg.batchVidDoneMixedTitle',
        detailKey: 'logsPage.msg.detailOkFail',
        detailParams: { ok: successCount, fail: failCount }
      },
      projectStore.currentProject?.id,
      projectStore.currentProject?.name
    )
    ElMessage.warning(
      t('editorWorkshop.messages.batchVidMixed', { ok: successCount, fail: failCount })
    )
  }
}

const handleStartScheduledTask = () => {
  if (!scheduledStartTime.value) {
    ElMessage.warning(t('editorWorkshop.messages.pickStartTime'))
    return
  }

  const now = new Date()
  const startTime = new Date(scheduledStartTime.value)
  if (startTime <= now) {
    ElMessage.warning(t('editorWorkshop.messages.startMustFuture'))
    return
  }

  isScheduledTaskRunning.value = true
  currentRetryRound.value = 0

  const updateCountdown = () => {
    const remaining = startTime.getTime() - Date.now()
    if (remaining <= 0) {
      countdownText.value = ''
      executeScheduledBatchVideo()
      return
    }
    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    countdownText.value = t('editorWorkshop.step2.countdownRemain', { m: minutes, s: seconds })
  }

  updateCountdown()
  scheduledCountdownTimer.value = setInterval(updateCountdown, 1000)
}

const executeScheduledBatchVideo = async () => {
  if (scheduledTaskTimer.value) {
    clearTimeout(scheduledTaskTimer.value)
    scheduledTaskTimer.value = null
  }
  if (scheduledCountdownTimer.value) {
    clearInterval(scheduledCountdownTimer.value)
    scheduledCountdownTimer.value = null
  }

  currentRetryRound.value++
  const maxRounds = parseInt(scheduledRetryRounds.value)
  const intervalMs = parseInt(scheduledInterval.value) * 60 * 1000

  logsStore.addLog(
    'scheduled-video',
    'info',
    {
      messageKey: 'logsPage.msg.schedRunTitle',
      detailKey: 'logsPage.msg.detailSchedRoundStart',
      detailParams: { round: currentRetryRound.value }
    },
    projectStore.currentProject?.id,
    projectStore.currentProject?.name
  )
  ElMessage.info(
    t('editorWorkshop.messages.schedRunning', { r: currentRetryRound.value })
  )

  isBatchGenerating.value = true
  const concurrency = apiConfigStore.videoConcurrency

  const failedStoryboards = storyboardStore.storyboards.filter(s => s.status === 'failed' || !s.generatedVideo)
  const indices = failedStoryboards.map(sb => storyboardStore.storyboards.indexOf(sb))

  if (indices.length === 0) {
    isBatchGenerating.value = false
    logsStore.addLog(
      'scheduled-video',
      'success',
      {
        messageKey: 'logsPage.msg.schedAllVideosOkTitle',
        detailKey: 'logsPage.msg.schedDetailAllVid'
      },
      projectStore.currentProject?.id,
      projectStore.currentProject?.name
    )
    ElMessage.success(t('editorWorkshop.messages.schedAllVidDone'))
    isScheduledTaskRunning.value = false
    countdownText.value = ''
    return
  }

  const tasks = indices
    .map(index => storyboardStore.storyboards[index])
    .filter(storyboard => storyboard)
    .map(storyboard => () => handleGenerateVideoFor(storyboard.id))

  const { successCount, failCount } = await runWithConcurrency(tasks, concurrency)

  isBatchGenerating.value = false

  if (failCount === 0) {
    logsStore.addLog(
      'scheduled-video',
      'success',
      {
        messageKey: 'logsPage.msg.schedRoundPartialTitle',
        detailKey: 'logsPage.msg.detailSchedRoundOk',
        detailParams: { round: currentRetryRound.value, ok: successCount }
      },
      projectStore.currentProject?.id,
      projectStore.currentProject?.name
    )
    ElMessage.success(
      t('editorWorkshop.messages.schedRoundDone', {
        r: currentRetryRound.value,
        ok: successCount
      })
    )
    isScheduledTaskRunning.value = false
    countdownText.value = ''
  } else if (currentRetryRound.value >= maxRounds) {
    logsStore.addLog(
      'scheduled-video',
      'warning',
      {
        messageKey: 'logsPage.msg.schedMaxRoundsTitle',
        detailKey: 'logsPage.msg.detailMaxRoundsFails',
        detailParams: { max: maxRounds, fail: failCount }
      },
      projectStore.currentProject?.id,
      projectStore.currentProject?.name
    )
    ElMessage.warning(
      t('editorWorkshop.messages.schedMaxFails', { max: maxRounds, fail: failCount })
    )
    isScheduledTaskRunning.value = false
    countdownText.value = ''
  } else {
    logsStore.addLog(
      'scheduled-video',
      'info',
      {
        messageKey: 'logsPage.msg.schedRetryInfoTitle',
        detailKey: 'logsPage.msg.detailSchedRetry',
        detailParams: { fail: failCount, mins: scheduledInterval.value }
      },
      projectStore.currentProject?.id,
      projectStore.currentProject?.name
    )
    ElMessage.info(
      t('editorWorkshop.messages.schedRetrySoon', {
        fail: failCount,
        mins: scheduledInterval.value,
        next: currentRetryRound.value + 1
      })
    )
    countdownText.value = t('editorWorkshop.step2.countdownFlat', {
      m: Number(scheduledInterval.value)
    })

    let remainingMs = intervalMs
    const tick = () => {
      remainingMs -= 1000
      if (remainingMs <= 0) {
        executeScheduledBatchVideo()
      } else {
        const minutes = Math.floor(remainingMs / 60000)
        const seconds = Math.floor((remainingMs % 60000) / 1000)
        countdownText.value = t('editorWorkshop.step2.countdownRemain', { m: minutes, s: seconds })
        scheduledTaskTimer.value = setTimeout(tick, 1000)
      }
    }
    scheduledTaskTimer.value = setTimeout(tick, 1000)
  }
}

const handleCancelScheduledTask = () => {
  clearScheduledTaskTimers()
  isScheduledTaskRunning.value = false
  countdownText.value = ''
  ElMessage.info(t('editorWorkshop.messages.schedCancelled'))
}

const clearScheduledTaskTimers = () => {
  if (scheduledTaskTimer.value) {
    clearTimeout(scheduledTaskTimer.value)
    scheduledTaskTimer.value = null
  }
  if (scheduledCountdownTimer.value) {
    clearInterval(scheduledCountdownTimer.value)
    scheduledCountdownTimer.value = null
  }
}

onMounted(async () => {
  await nextTick()

  if (!projectDataLoaded.value) {
    await new Promise<void>((resolve) => {
      const stopWatch = watch(projectDataLoaded, (loaded) => {
        if (loaded) {
          stopWatch()
          resolve()
        }
      })
      setTimeout(() => {
        stopWatch()
        resolve()
      }, 5000)
    })
  }
})

const previewImage = ref<string | null>(null)
const previewPosition = ref({ x: 0, y: 0 })

const handleAssetMouseEnter = (imageUrl: string, event: MouseEvent) => {
  previewImage.value = imageUrl
  updatePreviewPosition(event)
}

const handleAssetMouseMove = (event: MouseEvent) => {
  updatePreviewPosition(event)
}

const handleAssetMouseLeave = () => {
  previewImage.value = null
}

const updatePreviewPosition = (event: MouseEvent) => {
  const x = event.clientX + 20
  const y = event.clientY + 20
  
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight
  const previewWidth = 300
  const previewHeight = 300
  
  previewPosition.value = {
    x: x + previewWidth > windowWidth ? x - previewWidth - 40 : x,
    y: y + previewHeight > windowHeight ? y - previewHeight - 40 : y
  }
}

const showMatchAssetDialog = ref(false)
const matchAssetStoryboardId = ref<string | null>(null)
const matchedCharacters = ref<Array<{ id: string; name: string; matched: boolean }>>([])
const matchedScene = ref<{ id: string; name: string; matched: boolean } | null>(null)
const matchedProps = ref<Array<{ id: string; name: string; matched: boolean }>>([])

const smartMatchAssets = (storyboard: Storyboard) => {
  const description = storyboard.textPrompt?.description || ''
  const title = storyboard.title || ''
  const fullText = `${title} ${description}`

  const characters = step1Store.characters.filter(char => {
    const name = char.name
    return fullText.includes(name)
  }).map(c => c.id)

  let sceneId: string | undefined
  for (const scene of step1Store.scenes) {
    const name = scene.name
    if (fullText.includes(name)) {
      sceneId = scene.id
      break
    }
  }

  const props = step1Store.props.filter(prop => {
    const name = prop.name
    return fullText.includes(name)
  }).map(p => p.id)

  console.log(`智能匹配资产 - 分镜 #${storyboard.order}:`, {
    人物: { 匹配到: characters.length, IDs: characters },
    场景: sceneId,
    道具: { 匹配到: props.length, IDs: props }
  })

  return { characters, sceneId, props }
}

const handleMatchAsset = (storyboardId: string) => {
  const storyboard = storyboardStore.storyboards.find(s => s.id === storyboardId)
  if (!storyboard) return
  
  const matchedInfo = storyboard.matchedAssets
  const useSmartMatch = !matchedInfo || matchedInfo.characters.length === 0

  if (useSmartMatch && matchedInfo) {
    ElMessage.info(t('editorWorkshop.messages.smartMatchEmpty'))
  }
  
  let charactersToMatch: string[] = []
  let sceneToMatch: string | undefined
  let propsToMatch: string[] = []
  
  if (useSmartMatch) {
    const smartResult = smartMatchAssets(storyboard)
    charactersToMatch = smartResult.characters
    sceneToMatch = smartResult.sceneId
    propsToMatch = smartResult.props
  } else if (matchedInfo) {
    charactersToMatch = matchedInfo.characters
      .map(name => step1Store.characters.find(c => c.name === name)?.id)
      .filter((id): id is string => !!id)
    sceneToMatch = step1Store.scenes.find(s => s.name === matchedInfo.scene)?.id
    propsToMatch = matchedInfo.props
      .map(name => step1Store.props.find(p => p.name === name)?.id)
      .filter((id): id is string => !!id)
  }
  
  matchAssetStoryboardId.value = storyboardId
  
  matchedCharacters.value = step1Store.characters.map(char => ({
    id: char.id,
    name: char.name,
    matched: charactersToMatch.includes(char.id)
  }))
  
  if (sceneToMatch && step1Store.scenes.length > 0) {
    const sceneData = step1Store.scenes.find(s => s.id === sceneToMatch)
    if (sceneData) {
      matchedScene.value = {
        id: sceneData.id,
        name: sceneData.name,
        matched: true
      }
    } else {
      matchedScene.value = null
    }
  } else {
    matchedScene.value = null
  }
  
  matchedProps.value = step1Store.props.map(prop => ({
    id: prop.id,
    name: prop.name,
    matched: propsToMatch.includes(prop.id)
  }))
  
  applyMatchedAssets()
  logsStore.addLog(
    'match-asset',
    'success',
    {
      messageKey: 'logsPage.msg.matchAssetOkTitle',
      detailKey: 'logsPage.msg.detailShotOrder',
      detailParams: { order: storyboard.order }
    },
    projectStore.currentProject?.id,
    projectStore.currentProject?.name
  )
  ElMessage.success(t('editorWorkshop.messages.matchAssetsOk'))
}

const applyMatchedAssets = () => {
  if (!matchAssetStoryboardId.value) return
  
  const matchedCharAssets = matchedCharacters.value
    .filter(m => m.matched)
    .map(m => {
      const char = step1Store.characters.find(c => c.id === m.id)
      if (char) {
        return {
          id: char.id,
          name: char.name,
          type: 'character' as const,
          url: char.imageUrl || '',
          tags: [] as string[],
          createdAt: new Date().toISOString()
        }
      }
      return null
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)
  
  let sceneAsset = undefined
  if (matchedScene.value?.matched) {
    const scene = step1Store.scenes.find(s => s.id === matchedScene.value!.id)
    if (scene) {
      sceneAsset = {
        id: scene.id,
        name: scene.name,
        type: 'scene' as const,
        url: scene.imageUrl || '',
        tags: [],
        createdAt: new Date().toISOString()
      }
    }
  }
  
  const matchedPropAssets = matchedProps.value
    .filter(m => m.matched)
    .map(m => {
      const prop = step1Store.props.find(p => p.id === m.id)
      if (prop) {
        return {
          id: prop.id,
          name: prop.name,
          type: 'props' as const,
          url: prop.imageUrl || '',
          tags: [] as string[],
          createdAt: new Date().toISOString()
        }
      }
      return null
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)
  
  storyboardStore.setMatchedAssets(matchAssetStoryboardId.value, {
    characters: matchedCharAssets,
    scene: sceneAsset,
    props: matchedPropAssets
  })
}

const batchMatchMode = ref<'all' | 'ungenerated' | 'custom'>('ungenerated')
const customMatchRangeInput = ref('')
const isBatchMatching = ref(false)
const showImagePreviewDialog = ref(false)
const previewImageUrl = ref('')

const getTargetMatchStoryboardIndices = (): number[] => {
  if (batchMatchMode.value === 'all') {
    return storyboardStore.storyboards.map((_, index) => index)
  } else if (batchMatchMode.value === 'ungenerated') {
    return storyboardStore.storyboards
      .map((s, index) => {
        const hasMatchedAssets = s.imagePrompt.characters.length > 0 || s.imagePrompt.scene || s.imagePrompt.props.length > 0
        return hasMatchedAssets ? -1 : index
      })
      .filter(i => i >= 0)
  } else {
    return parseRangeExpression(customMatchRangeInput.value)
      .map(n => n - 1)
      .filter(i => i >= 0 && i < storyboardStore.storyboards.length)
  }
}

const handleBatchMatchAssets = async () => {
  const indices = getTargetMatchStoryboardIndices()
  
  if (indices.length === 0) {
    ElMessage.warning(t('editorWorkshop.messages.noSbToMatch'))
    return
  }
  
  showMatchAssetDialog.value = false
  isBatchMatching.value = true
  
  logsStore.addLog(
    'batch-match-asset',
    'info',
    {
      messageKey: 'logsPage.msg.batchMatchStartTitle',
      detailKey: 'logsPage.msg.detailMatchBoardCount',
      detailParams: { total: indices.length }
    },
    projectStore.currentProject?.id,
    projectStore.currentProject?.name
  )
  ElMessage.info(
    t('editorWorkshop.messages.batchMatchStart', { n: indices.length })
  )
  
  let successCount = 0
  let failCount = 0
  
  for (const index of indices) {
    const storyboard = storyboardStore.storyboards[index]
    if (storyboard) {
      try {
        handleMatchAsset(storyboard.id)
        successCount++
      } catch (error) {
        failCount++
      }
    }
  }
  
  isBatchMatching.value = false
  
  if (failCount === 0) {
    logsStore.addLog(
      'batch-match-asset',
      'success',
      {
        messageKey: 'logsPage.msg.batchMatchDoneOkTitle',
        detailKey: 'logsPage.msg.detailOkOnly',
        detailParams: { ok: successCount }
      },
      projectStore.currentProject?.id,
      projectStore.currentProject?.name
    )
    ElMessage.success(
      t('editorWorkshop.messages.batchMatchOk', { ok: successCount })
    )
  } else {
    logsStore.addLog(
      'batch-match-asset',
      'warning',
      {
        messageKey: 'logsPage.msg.batchMatchDoneMixedTitle',
        detailKey: 'logsPage.msg.detailOkFail',
        detailParams: { ok: successCount, fail: failCount }
      },
      projectStore.currentProject?.id,
      projectStore.currentProject?.name
    )
    ElMessage.warning(
      t('editorWorkshop.messages.batchMatchMixed', { ok: successCount, fail: failCount })
    )
  }
}

const getVideoDuration = (videoUrl: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = video.duration
      resolve(duration)
    }
    video.onerror = () => {
      reject(new Error(t('editorWorkshop.messages.vidDurationFail')))
    }
    video.src = videoUrl
  })
}

const convertVideoToBase64 = async (videoUrl: string): Promise<string> => {
  if (videoUrl.startsWith('data:')) {
    return videoUrl
  }

  if (videoUrl.startsWith('blob:')) {
    try {
      const response = await fetch(videoUrl)
      const blob = await response.blob()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error('转换blob失败:', error)
      throw error
    }
  }

  return videoUrl
}

const exportToJianYing = async () => {
  if (!userStore.jianyingDraftPath) {
    ElMessage.warning(t('editorWorkshop.messages.needJyPath'))
    return
  }

  const storyboards = storyboardStore.storyboards
  const videoStoryboards = storyboards.filter(sb => sb.generatedVideo)

  if (videoStoryboards.length === 0) {
    ElMessage.warning(t('editorWorkshop.messages.noVidToExport'))
    return
  }

  try {
    if (!window.electronAPI?.exportToJianYing) {
      ElMessage.error(t('editorWorkshop.messages.exportNeedElectron'))
      return
    }

    ElMessage.info(t('editorWorkshop.messages.preparingVideos'))

    const videoUrls: string[] = []
    const videoDurations: number[] = []
    for (const sb of videoStoryboards) {
      const videoUrl = sb.generatedVideo!
      const converted = await convertVideoToBase64(videoUrl)
      videoUrls.push(converted)
      try {
        const duration = await getVideoDuration(videoUrl)
        videoDurations.push(duration)
      } catch (error) {
        console.warn('获取视频时长失败，使用默认值5秒:', error)
        videoDurations.push(5)
      }
    }

    const result = await window.electronAPI.exportToJianYing({
      draftPath: userStore.jianyingDraftPath,
      projectName: projectStore.currentProject?.name || t('editorWorkshop.step2.defaultProjectName'),
      videoUrls,
      videoDurations
    })

    if (result.success) {
      ElMessage.success(
        t('editorWorkshop.messages.exportJyOk', { n: videoStoryboards.length })
      )
      logsStore.addLog(
        'export-jianying',
        'success',
        {
          messageKey: 'logsPage.msg.exportJyOkTitle',
          detailKey: 'logsPage.msg.detailExportVidCount',
          detailParams: { total: videoStoryboards.length }
        },
        projectStore.currentProject?.id,
        projectStore.currentProject?.name
      )
    } else {
      ElMessage.error(
        t('editorWorkshop.messages.exportFail', {
          msg: result.message || t('logsPage.msg.unknownErr')
        })
      )
    }
  } catch (error) {
    console.error('导出剪映失败:', error)
    ElMessage.error(
      t('editorWorkshop.messages.exportJyErr', {
        msg: error instanceof Error ? error.message : t('logsPage.msg.unknownErr')
      })
    )
  }
}

const handleManualMatchAsset = (storyboardId: string, assetType: 'character' | 'scene' | 'props', assetId: string) => {
  const storyboard = storyboardStore.storyboards.find(s => s.id === storyboardId)
  if (!storyboard) return
  
  let asset
  if (assetType === 'character') {
    asset = step1Store.characters.find(c => c.id === assetId)
  } else if (assetType === 'scene') {
    asset = step1Store.scenes.find(s => s.id === assetId)
  } else {
    asset = step1Store.props.find(p => p.id === assetId)
  }
  
  if (!asset) {
    ElMessage.warning(t('editorWorkshop.messages.assetMissing'))
    return
  }
  
  const imageAsset = {
    id: asset.id,
    name: asset.name,
    type: assetType,
    url: asset.imageUrl || '',
    tags: [],
    createdAt: new Date().toISOString()
  }
  
  if (assetType === 'character') {
    const existingChars = storyboard.imagePrompt.characters || []
    const exists = existingChars.find(c => c.id === assetId)
    if (!exists) {
      storyboardStore.setMatchedAssets(storyboardId, {
        characters: [...existingChars, imageAsset]
      })
    }
  } else if (assetType === 'scene') {
    storyboardStore.setMatchedAssets(storyboardId, {
      scene: imageAsset
    })
  } else {
    const existingProps = storyboard.imagePrompt.props || []
    const exists = existingProps.find(p => p.id === assetId)
    if (!exists) {
      storyboardStore.setMatchedAssets(storyboardId, {
        props: [...existingProps, imageAsset]
      })
    }
  }
  
  logsStore.addLog(
    'match-asset',
    'success',
    {
      messageKey: 'logsPage.msg.matchManualOkTitle',
      detailKey: 'logsPage.msg.detailShotAndAsset',
      detailParams: { order: storyboard.order, asset: asset.name }
    },
    projectStore.currentProject?.id,
    projectStore.currentProject?.name
  )
  ElMessage.success(t('editorWorkshop.messages.manualMatchOk', { name: asset.name }))
}

const handleRemoveMatchedAsset = (storyboardId: string, assetType: 'character' | 'scene' | 'props', assetId: string) => {
  const storyboard = storyboardStore.storyboards.find(s => s.id === storyboardId)
  if (!storyboard) return

  if (assetType === 'character') {
    const chars = storyboard.imagePrompt.characters.filter(c => c.id !== assetId)
    storyboardStore.setMatchedAssets(storyboardId, { characters: chars })
  } else if (assetType === 'scene') {
    const newScene = undefined
    storyboard.imagePrompt.scene = newScene
    storyboardStore.setMatchedAssets(storyboardId, { scene: newScene })
  } else {
    const props = storyboard.imagePrompt.props.filter(p => p.id !== assetId)
    storyboardStore.setMatchedAssets(storyboardId, { props: props })
  }

  logsStore.addLog(
    'match-asset',
    'info',
    {
      messageKey: 'logsPage.msg.matchRemovedTitle',
      detailKey: 'logsPage.msg.detailShotOrder',
      detailParams: { order: storyboard.order }
    },
    projectStore.currentProject?.id,
    projectStore.currentProject?.name
  )
  ElMessage.success(t('editorWorkshop.messages.assetRemoved'))
}
</script>

<template>
  <div class="step2-content">
    <ProjectHeader />
    <div class="main-content">
      <div class="main-left">
        <div class="storyboard-content-wrapper">
          <div
            ref="storyboardsContainerRef"
            class="storyboards-container"
          >
            <div
              v-for="(storyboard, index) in storyboardStore.storyboards"
              :key="storyboard.id"
              class="storyboard-row"
              :class="{ active: index === storyboardStore.currentStoryboardIndex }"
              @click="handleSelectStoryboard(index)"
            >
              <div class="module-card text-module">
                <div class="module-header">
                  <div class="header-left">
                    <span class="storyboard-badge">#{{ storyboard.order }}</span>
                    <span class="module-title">{{ t('editorWorkshop.step2.shotBoardTitle') }}</span>
                  </div>
                  <div class="header-right">
                    <el-button 
                      type="primary" 
                      size="small" 
                      :loading="storyboard.status === 'generating' && storyboardStore.generatingType[storyboard.id] === 'text'"
                      :class="{ 'btn-generating': storyboard.status === 'generating' && storyboardStore.generatingType[storyboard.id] === 'text' }"
                      @click.stop="handleGenerateTextFor(storyboard.id)"
                    >
                      <template v-if="storyboard.status === 'generating' && storyboardStore.generatingType[storyboard.id] === 'text'">
                        <el-icon class="rotating">
                          <Loading />
                        </el-icon>
                        <span>{{ t('editorWorkshop.step2.optimizing') }}</span>
                      </template>
                      <template v-else>
                        {{ t('editorWorkshop.step2.rewritePrompt') }}
                      </template>
                    </el-button>
                  </div>
                </div>
                <div class="module-content text-input-content">
                  <el-input
                    v-model="storyboard.textPrompt.description"
                    type="textarea"
                    :placeholder="t('editorWorkshop.step2.sbDescPh')"
                    class="prompt-input full-height"
                  />
                </div>
              </div>

              <div class="module-card asset-module">
                <div class="module-header">
                  <div class="header-left">
                    <span class="module-title">{{ t('editorWorkshop.step2.usedAssets') }}</span>
                  </div>
                  <div class="header-right">
                    <el-button
                      type="primary"
                      size="small"
                      @click.stop="handleMatchAsset(storyboard.id)"
                    >
                      {{ t('editorWorkshop.step2.matchAssetsBtn') }}
                    </el-button>
                  </div>
                </div>
                <div class="module-content asset-module-content">
                  <div class="asset-top-row">
                    <div class="asset-characters-section">
                      <div class="asset-section-title">
                        {{ t('editorWorkshop.step2.people') }}
                      </div>
                      <div class="asset-characters-grid">
                        <div
                          v-for="(matchedChar, index) in storyboard.imagePrompt.characters.slice(0, 4)"
                          :key="matchedChar.id"
                          class="asset-item-large has-image"
                          @mouseenter="matchedChar.url && handleAssetMouseEnter(matchedChar.url, $event)"
                          @mousemove="matchedChar.url && handleAssetMouseMove($event)"
                          @mouseleave="handleAssetMouseLeave"
                          @contextmenu.prevent="handleRemoveMatchedAsset(storyboard.id, 'character', matchedChar.id)"
                        >
                          <img
                            v-if="matchedChar.url"
                            :src="matchedChar.url"
                            :alt="matchedChar.name"
                          >
                          <div
                            v-else
                            class="asset-item-placeholder-large"
                          >
                            <span class="placeholder-text">{{ t('editorWorkshop.step2.placeholderChar', { n: index + 1 }) }}</span>
                          </div>
                          <div class="asset-item-name-overlay">
                            {{ matchedChar.name }}
                          </div>
                        </div>
                        <div
                          v-for="i in Math.max(0, 4 - storyboard.imagePrompt.characters.length)"
                          :key="'empty-char-' + i"
                          class="asset-item-large empty"
                        >
                          <el-dropdown
                            trigger="click"
                            @command="(assetId: string) => handleManualMatchAsset(storyboard.id, 'character', assetId)"
                          >
                            <div class="asset-item-placeholder-large">
                              <span class="placeholder-text">{{ t('editorWorkshop.step2.placeholderChar', { n: storyboard.imagePrompt.characters.length + i }) }}</span>
                            </div>
                            <template #dropdown>
                              <el-dropdown-menu>
                                <el-dropdown-item
                                  v-for="char in step1Store.characters"
                                  :key="char.id"
                                  :command="char.id"
                                >
                                  {{ char.name }}
                                </el-dropdown-item>
                                <el-dropdown-item
                                  v-if="step1Store.characters.length === 0"
                                  disabled
                                >
                                  {{ t('editorWorkshop.step2.noChars') }}
                                </el-dropdown-item>
                              </el-dropdown-menu>
                            </template>
                          </el-dropdown>
                        </div>
                      </div>
                    </div>
                    <div class="asset-scene-section">
                      <div class="asset-section-title">
                        {{ t('editorWorkshop.step2.scene') }}
                      </div>
                      <div class="asset-scene-card">
                        <div
                          v-if="storyboard.imagePrompt.scene"
                          class="asset-item-scene has-image"
                          @mouseenter="storyboard.imagePrompt.scene.url && handleAssetMouseEnter(storyboard.imagePrompt.scene.url, $event)"
                          @mousemove="storyboard.imagePrompt.scene.url && handleAssetMouseMove($event)"
                          @mouseleave="handleAssetMouseLeave"
                          @contextmenu.prevent="handleRemoveMatchedAsset(storyboard.id, 'scene', storyboard.imagePrompt.scene!.id)"
                        >
                          <img
                            v-if="storyboard.imagePrompt.scene.url"
                            :src="storyboard.imagePrompt.scene.url"
                            :alt="storyboard.imagePrompt.scene.name"
                          >
                          <div
                            v-else
                            class="asset-item-placeholder-scene"
                          >
                            <span class="placeholder-text">{{ t('editorWorkshop.step2.placeholderScene') }}</span>
                          </div>
                          <div class="asset-item-name-overlay">
                            {{ storyboard.imagePrompt.scene.name }}
                          </div>
                        </div>
                        <div
                          v-else
                          class="asset-item-scene empty"
                        >
                          <el-dropdown
                            trigger="click"
                            @command="(assetId: string) => handleManualMatchAsset(storyboard.id, 'scene', assetId)"
                          >
                            <div class="asset-item-placeholder-scene">
                              <span class="placeholder-text">{{ t('editorWorkshop.step2.placeholderScene') }}</span>
                            </div>
                            <template #dropdown>
                              <el-dropdown-menu>
                                <el-dropdown-item
                                  v-for="scene in step1Store.scenes"
                                  :key="scene.id"
                                  :command="scene.id"
                                >
                                  {{ scene.name }}
                                </el-dropdown-item>
                                <el-dropdown-item
                                  v-if="step1Store.scenes.length === 0"
                                  disabled
                                >
                                  {{ t('editorWorkshop.step2.noScenes') }}
                                </el-dropdown-item>
                              </el-dropdown-menu>
                            </template>
                          </el-dropdown>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="asset-props-section">
                    <div class="asset-section-title">
                      {{ t('editorWorkshop.step2.propsLabel') }}
                    </div>
                    <div class="asset-props-grid">
                      <div
                        v-for="(matchedProp, index) in storyboard.imagePrompt.props.slice(0, 4)"
                        :key="matchedProp.id"
                        class="asset-item-prop has-image"
                        @mouseenter="matchedProp.url && handleAssetMouseEnter(matchedProp.url, $event)"
                        @mousemove="matchedProp.url && handleAssetMouseMove($event)"
                        @mouseleave="handleAssetMouseLeave"
                        @contextmenu.prevent="handleRemoveMatchedAsset(storyboard.id, 'props', matchedProp.id)"
                      >
                        <img
                          v-if="matchedProp.url"
                          :src="matchedProp.url"
                          :alt="matchedProp.name"
                        >
                        <div
                          v-else
                          class="asset-item-placeholder-prop"
                        >
                          <span class="placeholder-text">{{ t('editorWorkshop.step2.placeholderProp', { n: index + 1 }) }}</span>
                        </div>
                        <div class="asset-item-name-overlay">
                          {{ matchedProp.name }}
                        </div>
                      </div>
                      <div
                        v-for="i in Math.max(0, 4 - storyboard.imagePrompt.props.length)"
                        :key="'empty-prop-' + i"
                        class="asset-item-prop empty"
                      >
                        <el-dropdown
                          trigger="click"
                          @command="(assetId: string) => handleManualMatchAsset(storyboard.id, 'props', assetId)"
                        >
                          <div class="asset-item-placeholder-prop">
                            <span class="placeholder-text">{{ t('editorWorkshop.step2.placeholderProp', { n: storyboard.imagePrompt.props.length + i }) }}</span>
                          </div>
                          <template #dropdown>
                            <el-dropdown-menu>
                              <el-dropdown-item
                                v-for="prop in step1Store.props"
                                :key="prop.id"
                                :command="prop.id"
                              >
                                {{ prop.name }}
                              </el-dropdown-item>
                              <el-dropdown-item
                                v-if="step1Store.props.length === 0"
                                disabled
                              >
                                {{ t('editorWorkshop.step2.noProps') }}
                              </el-dropdown-item>
                            </el-dropdown-menu>
                          </template>
                        </el-dropdown>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="module-card image-module">
                <div class="module-header">
                  <div class="header-left">
                    <span class="module-title">{{ t('editorWorkshop.step2.sbImageTitle') }}</span>
                  </div>
                  <div class="header-right">
                    <el-button
                      type="warning"
                      size="small"
                      @click.stop="handleOpenLocalMerge(storyboard.id)"
                    >
                      {{ t('editorWorkshop.step2.localCompose') }}
                    </el-button>
                    <el-button
                      type="primary"
                      size="small"
                      :loading="storyboard.status === 'generating' && storyboardStore.generatingType[storyboard.id] === 'image'"
                      :class="{ 'btn-generating': storyboard.status === 'generating' && storyboardStore.generatingType[storyboard.id] === 'image' }"
                      @click.stop="handleGenerateImageFor(storyboard.id)"
                    >
                      <template v-if="storyboard.status === 'generating' && storyboardStore.generatingType[storyboard.id] === 'image'">
                        <el-icon class="rotating">
                          <Loading />
                        </el-icon>
                        <span>{{ t('editorWorkshop.step2.genImgLoading') }}</span>
                      </template>
                      <template v-else>
                        {{ t('editorWorkshop.step2.genImageBtn') }}
                      </template>
                    </el-button>
                  </div>
                </div>
                <div class="module-content image-module-content">
                  <div class="storyboard-preview">
                    <img
                      v-if="storyboard?.generatedImage"
                      :src="storyboard.generatedImage"
                      alt="Storyboard"
                      style="cursor: pointer"
                      @click="handlePreviewImage(storyboard.generatedImage!)"
                    >
                    <div
                      v-else
                      class="preview-empty"
                    >
                      <el-icon :size="24">
                        <Picture />
                      </el-icon>
                      <span>{{ t('editorWorkshop.step2.sbImagePlaceholder') }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="module-card video-module">
                <div class="module-header">
                  <div class="header-left">
                    <span class="module-title">{{ t('editorWorkshop.step2.videoTitle') }}</span>
                  </div>
                  <div class="header-right">
                    <el-button
                      size="small"
                      @click.stop="handleLocalVideoUpload(storyboard.id)"
                    >
                      <el-icon><Upload /></el-icon>
                      {{ t('editorWorkshop.step2.importVideo') }}
                    </el-button>
                    <el-button
                      v-if="storyboard.videoTaskId && storyboard.status !== 'generating'"
                      type="warning"
                      size="small"
                      @click.stop="handleResumeVideo(storyboard.id)"
                    >
                      <el-icon><Refresh /></el-icon>
                      {{ t('editorWorkshop.step2.recoverVideo') }}
                    </el-button>
                    <el-button
                      type="success"
                      size="small"
                      :loading="storyboard.status === 'generating' && storyboardStore.generatingType[storyboard.id] === 'video'"
                      :class="{ 'btn-generating': storyboard.status === 'generating' && storyboardStore.generatingType[storyboard.id] === 'video' }"
                      @click.stop="handleGenerateVideoFor(storyboard.id)"
                    >
                      <template v-if="storyboard.status === 'generating' && storyboardStore.generatingType[storyboard.id] === 'video'">
                        <el-icon class="rotating">
                          <Loading />
                        </el-icon>
                        <span>{{ t('editorWorkshop.step2.genImgLoading') }}</span>
                      </template>
                      <template v-else>
                        {{ t('editorWorkshop.step2.genVideoBtn') }}
                      </template>
                    </el-button>
                  </div>
                  <input
                    ref="localVideoInputRef"
                    type="file"
                    accept="video/*"
                    style="display: none"
                    @change="handleLocalVideoSelected"
                  >
                </div>
                <div class="module-content video-content">
                  <div
                    v-if="storyboard?.generatedVideo"
                    class="video-preview"
                  >
                    <video
                      :src="storyboard.generatedVideo"
                      controls
                    />
                  </div>
                  <div
                    v-else-if="storyboard?.generatedImage"
                    class="video-preview"
                  >
                    <img
                      :src="storyboard.generatedImage"
                      alt="Preview"
                    >
                  </div>
                  <div
                    v-else
                    class="video-placeholder"
                  >
                    <el-icon :size="32">
                      <Film />
                    </el-icon>
                    <span>{{ t('editorWorkshop.step2.videoPlaceholder') }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div
              class="add-storyboard-row"
              @click="handleAddStoryboard"
            >
              <el-icon :size="24">
                <Plus />
              </el-icon>
              <span>{{ t('editorWorkshop.step2.addSb') }}</span>
            </div>
          </div>

          <div class="properties-panel">
            <div class="properties-tabs">
              <div
                :class="['tab-btn', { active: propertiesTab === 'asset' }]"
                @click="propertiesTab = 'asset'"
              >
                <span>{{ t('editorWorkshop.step2.tabAsset') }}</span>
              </div>
              <div
                :class="['tab-btn', { active: propertiesTab === 'storyboard' }]"
                @click="propertiesTab = 'storyboard'"
              >
                <span>{{ t('editorWorkshop.step2.tabStory') }}</span>
              </div>
              <div
                :class="['tab-btn', { active: propertiesTab === 'video' }]"
                @click="propertiesTab = 'video'"
              >
                <span>{{ t('editorWorkshop.step2.tabVideo') }}</span>
              </div>
              <div
                :class="['tab-btn', { active: propertiesTab === 'audio' }]"
                @click="propertiesTab = 'audio'"
              >
                <span>{{ t('editorWorkshop.step2.tabVoice') }}</span>
              </div>
            </div>
            <div class="properties-content">
              <div
                v-if="propertiesTab === 'asset'"
                class="tab-content asset-tab"
              >
                <div class="batch-match-inline">
                  <div class="batch-match-info">
                  {{
                    t('editorWorkshop.step2.matchInfo', {
                      n: storyboardStore.storyboardCount,
                      m: matchedAssetsSbCount
                    })
                  }}
                  </div>
                  <div class="mode-options-inline">
                    <div
                      :class="['mode-option-inline', { active: batchMatchMode === 'all' }]"
                      @click="batchMatchMode = 'all'"
                    >
                      <div class="option-icon all-icon">
                        <el-icon :size="20">
                          <VideoPlay />
                        </el-icon>
                      </div>
                      <div class="option-content">
                        <div class="option-title">
                        {{ t('editorWorkshop.step2.matchAll') }}
                        </div>
                        <div class="option-desc">
                          {{ t('editorWorkshop.step2.matchAllDesc') }}
                        </div>
                      </div>
                      <div
                        v-if="batchMatchMode === 'all'"
                        class="option-check"
                      >
                        <el-icon><CircleCheck /></el-icon>
                      </div>
                    </div>
                    <div
                      :class="['mode-option-inline', { active: batchMatchMode === 'ungenerated' }]"
                      @click="batchMatchMode = 'ungenerated'"
                    >
                      <div class="option-icon ungenerated-icon">
                        <el-icon :size="20">
                          <Loading />
                        </el-icon>
                      </div>
                      <div class="option-content">
                        <div class="option-title">
                          {{ t('editorWorkshop.step2.matchOnlyEmpty') }}
                        </div>
                        <div class="option-desc">
                          {{ t('editorWorkshop.step2.matchOnlyEmptyDesc') }}
                        </div>
                      </div>
                      <div
                        v-if="batchMatchMode === 'ungenerated'"
                        class="option-check"
                      >
                        <el-icon><CircleCheck /></el-icon>
                      </div>
                    </div>
                    <div
                      :class="['mode-option-inline', { active: batchMatchMode === 'custom' }]"
                      @click="batchMatchMode = 'custom'"
                    >
                      <div class="option-icon custom-icon">
                        <el-icon :size="20">
                          <Plus />
                        </el-icon>
                      </div>
                      <div class="option-content">
                        <div class="option-title">
                          {{ t('editorWorkshop.step2.matchCustom') }}
                        </div>
                        <div class="option-desc">
                          {{ t('editorWorkshop.step2.matchCustomDesc') }}
                        </div>
                      </div>
                      <div
                        v-if="batchMatchMode === 'custom'"
                        class="option-check"
                      >
                        <el-icon><CircleCheck /></el-icon>
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="batchMatchMode === 'custom'"
                    class="custom-range-input"
                  >
                    <el-input
                      v-model="customMatchRangeInput"
                      :placeholder="t('editorWorkshop.step2.phSbIdx')"
                      size="small"
                      clearable
                    />
                    <div class="input-hint">
                      {{ t('editorWorkshop.step1.rangeFmtHint') }}
                    </div>
                  </div>
                  <el-button
                    type="primary"
                    size="small"
                    :loading="isBatchMatching"
                    class="start-match-btn"
                    @click="handleBatchMatchAssets"
                  >
                    <el-icon><Box /></el-icon>
                    <span>{{ t('editorWorkshop.step2.btnBatchMatch') }}</span>
                  </el-button>
                </div>
              </div>
              <div
                v-else-if="propertiesTab === 'storyboard'"
                class="tab-content storyboard-tab"
              >
                <div class="storyboard-settings">
                  <div class="section-panel">
                    <div class="section-title">
                      <el-icon :size="16"><Picture /></el-icon>
                      <span>{{ t('editorWorkshop.step2.imageModelLbl') }}</span>
                    </div>
                    <div class="model-selector-row">
                      <div class="model-group-selector">
                        <span class="setting-label">{{ t('editorWorkshop.step2.modelGroupLbl') }}</span>
                        <el-popover
                          v-model:visible="imageModelGroupPopoverVisible"
                          placement="bottom-start"
                          :width="275"
                          trigger="click"
                          popper-class="step1-popover"
                        >
                          <template #reference>
                            <button type="button" class="step1-prompt-chip">
                              <span class="step1-prompt-chip-name">{{ currentImageModelGroupLabel }}</span>
                            </button>
                          </template>
                          <div class="step1-prompt-panel">
                            <div class="step1-prompt-panel-label">选择模型分组</div>
                            <div class="step1-prompt-group">
                              <button
                                v-for="option in modelGroupOpts"
                                :key="option.value"
                                type="button"
                                class="step1-prompt-btn"
                                :class="{ active: imageModelGroup === option.value }"
                                @click="imageModelGroup = option.value; imageModelGroupPopoverVisible = false"
                              >
                                <span class="step1-prompt-btn-icon icon-official">
                                  {{ option.value === 'youshang' ? '优' : option.value === 'flow2' ? '本' : '官' }}
                                </span>
                                <span class="step1-prompt-btn-text">{{ option.label }}</span>
                              </button>
                            </div>
                          </div>
                        </el-popover>
                      </div>
                      <div class="model-select-wrapper">
                        <span class="setting-label">{{ t('editorWorkshop.step2.imageMdlPick') }}</span>
                        <el-popover
                          v-model:visible="imageModelPopoverVisible"
                          placement="bottom-start"
                          :width="320"
                          trigger="click"
                          popper-class="step1-popover"
                        >
                          <template #reference>
                            <button type="button" class="step1-prompt-chip" :disabled="imageModelOptions.length === 0">
                              <span class="step1-prompt-chip-name">{{ currentImageModel?.name || '请选择模型' }}</span>
                              <span v-if="currentImageModel?.price" class="step1-prompt-chip-group">{{ currentImageModel.price }}</span>
                            </button>
                          </template>
                          <div class="step1-prompt-panel">
                            <div class="step1-prompt-panel-label">选择图片模型</div>
                            <div class="step1-prompt-group">
                              <button
                                v-for="model in imageModelOptions"
                                :key="model.id"
                                type="button"
                                class="step1-prompt-btn"
                                :class="{ active: selectedImageModel === model.id }"
                                @click="selectedImageModel = model.id; imageModelPopoverVisible = false"
                              >
                                <span class="step1-prompt-btn-icon" :class="`platform-${model.badge.key}`">
                                  <svg v-if="model.badge.key === 'kling'" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                                    <path d="M5.4 13.8A23.2 23.2 0 017.4 9.3c3.2-5.5 7.8-8.8 10.3-7.3C12-1.3 4.6 1 1.1 7a13.4 13.4 0 00-1 2.2c-.3.8.1 1.6.8 2l4.6 2.6z" fill="#04A6F0"/>
                                    <path d="M18.6 10.2a23.2 23.2 0 01-2 4.5c-3.2 5.5-7.8 8.8-10.3 7.3 5.7 3.3 13.1 1.1 16.6-4.9a13.4 13.4 0 001-2.3c.3-.8-.1-1.6-.8-2l-4.5-2.6z" fill="#0DF35E"/>
                                    <path d="M16.6 14.6c3.2-5.5 3.7-11.1 1.2-12.6C15.2.6 10.6 3.8 7.4 9.3c2-3.6 5.8-5.3 8.3-3.8 2.6 1.5 2.9 5.6.9 9.1z" fill="#003EFF"/>
                                    <path d="M7.4 9.3c-3.2 5.5-3.7 11.1-1.2 12.6 2.6 1.5 7.2-1.8 10.4-7.3-2.1 3.6-5.9 5.3-8.4 3.9-2.5-1.4-2.9-5.6-.8-9.2z" fill="#0BFFE7"/>
                                  </svg>
                                  <svg v-else-if="model.badge.key === 'gpt'" fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                                    <title>OpenAI</title>
                                    <path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.71.71 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h-.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.069a.065.065 0 01-.036-.051V6.559c.003-2.274 1.87-4.12 4.174-4.123.976 0 1.92.338 2.671.954-.034.018-.093.05-.132.074l-4.44 2.53a.71.71 0 00-.364.623v6.176l1.877-1.069c.02-.01.033-.029.036-.05zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"/>
                                  </svg>
                                  
                                  <svg v-else-if="model.badge.key === 'banana'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;" aria-hidden="true">
                                    <path d="M1.5 19.824c0-.548.444-.992.991-.992h.744a.991.991 0 010 1.983H2.49a.991.991 0 01-.991-.991z" fill="#F3AD61"/>
                                    <path d="M14.837 13.5h7.076c.522 0 .784-.657.413-1.044l-1.634-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044zM3.587 13.5h7.076c.521 0 .784-.659.414-1.044l-1.635-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044z" fill="#F9C23C"/>
                                    <path d="M12.525 1.521c3.69-.53 5.97 8.923 4.309 12.744-1.662 3.82-5.248 4.657-9.053 6.152a3.49 3.49 0 01-1.279.244c-1.443 0-2.227 1.187-2.774-.282-.707-1.9.22-4.031 2.069-4.757 2.014-.79 3.084-2.308 3.89-4.364.82-2.096.877-2.956.873-5.241-.003-1.827-.123-4.195 1.965-4.496z" fill="#FEEFC2"/>
                                    <path d="M16.834 14.264l-7.095-3.257c-.815 1.873-2.29 3.308-4.156 4.043-2.16.848-3.605 3.171-2.422 5.54 2.364 4.727 13.673-.05 13.673-6.325z" fill="#FCD53F"/>
                                    <path d="M13.68 12.362c.296.094.46.41.365.707-1.486 4.65-5.818 6.798-9.689 6.997a.562.562 0 11-.057-1.124c3.553-.182 7.372-2.138 8.674-6.216a.562.562 0 01.707-.364z" fill="#F9C23C"/>
                                    <path d="M17.43 19.85l-7.648-8.835h6.753c1.595.08 2.846 1.433 2.846 3.073v5.664c0 .997-.898 1.302-1.95.098z" fill="#FFF478"/>
                                  </svg>
                                  <template v-else>{{ model.badge.short }}</template>
                                </span>
                                <span class="step1-prompt-btn-text">{{ model.name }}</span>
                                <span v-if="model.price" class="step1-prompt-btn-price">{{ model.price }}</span>
                              </button>
                            </div>
                          </div>
                        </el-popover>
                      </div>
                    </div>
                    <div class="model-selector-row">
                      <div class="model-select-wrapper">
                        <span class="setting-label">{{ t('editorWorkshop.step2.tplSbImg') }}</span>
                        <el-popover
                          v-model:visible="storyboardImagePromptPopoverVisible"
                          placement="bottom-start"
                          :width="275"
                          trigger="click"
                          popper-class="step1-popover"
                        >
                          <template #reference>
                            <button type="button" class="step1-prompt-chip">
                              <span class="step1-prompt-chip-name">{{ currentStep2StoryboardImagePrompt?.title || t('editorWorkshop.step1.pickTplPlaceholder') }}</span>
                              <span class="step1-prompt-chip-group">{{ currentStep2StoryboardImagePrompt?.isCustom ? t('promptsPage.badgeCustom') : t('promptsPage.badgeOfficial') }}</span>
                            </button>
                          </template>
                          <div class="step1-prompt-panel">
                            <div class="step1-prompt-panel-label">{{ t('editorWorkshop.step2.pickTplSbImg') }}</div>
                            <div class="step1-prompt-group">
                              <button
                                v-for="prompt in generateStoryboardImagePrompts"
                                :key="prompt.id"
                                type="button"
                                class="step1-prompt-btn"
                                :class="{ active: selectedStep2StoryboardImagePromptId === prompt.id }"
                                @click="selectedStep2StoryboardImagePromptId = prompt.id; storyboardImagePromptPopoverVisible = false"
                              >
                                <span class="step1-prompt-btn-icon" :class="prompt.isCustom ? 'icon-custom' : 'icon-official'">
                                  {{ prompt.isCustom ? t('promptsPage.badgeCustom').slice(0, 1) : t('promptsPage.badgeOfficial').slice(0, 1) }}
                                </span>
                                <span class="step1-prompt-btn-text">{{ prompt.title }}</span>
                              </button>
                            </div>
                          </div>
                        </el-popover>
                      </div>
                    </div>
                  </div>
                  <div class="section-panel">
                    <div class="section-title">
                      <el-icon :size="16"><Picture /></el-icon>
                      <span>{{ t('editorWorkshop.step2.imageSettings') }}</span>
                    </div>
                    <div class="style-selector-row">
                      <span class="setting-label">{{ t('editorWorkshop.step2.imageQualityLbl') }}</span>
                      <el-popover
                        v-model:visible="imageSizePopoverVisible"
                        placement="bottom-start"
                        :width="275"
                        trigger="click"
                        popper-class="step1-popover"
                      >
                        <template #reference>
                          <button type="button" class="step1-prompt-chip">
                            <span class="step1-prompt-chip-name">{{ currentImageSizeLabel }}</span>
                          </button>
                        </template>
                        <div class="step1-prompt-panel">
                          <div class="step1-prompt-panel-label">选择图片画质</div>
                          <div class="step1-prompt-group">
                            <button
                              v-for="size in imageSizeOptions"
                              :key="size.value"
                              type="button"
                              class="step1-prompt-btn"
                              :class="{ active: imageSize === size.value }"
                              @click="imageSize = size.value; imageSizePopoverVisible = false"
                            >
                              <span class="step1-prompt-btn-text">{{ size.label }}</span>
                            </button>
                          </div>
                        </div>
                      </el-popover>
                    </div>
                    <div class="style-selector-row">
                      <span class="setting-label">{{ t('canvas.artStyles.frameLabel') }}</span>
                      <el-popover
                        v-model:visible="artStylePopoverVisible"
                        placement="bottom-start"
                        :width="275"
                        trigger="click"
                        popper-class="step1-popover"
                      >
                        <template #reference>
                          <button type="button" class="step1-prompt-chip">
                            <span class="step1-prompt-chip-name">{{ currentArtStyleLabel }}</span>
                          </button>
                        </template>
                        <div class="step1-prompt-panel">
                          <div class="step1-prompt-panel-label">选择画面风格</div>
                          <div class="step1-prompt-group step1-prompt-group-2cols">
                            <button
                              v-for="style in artStyleStore.artStyles"
                              :key="style.value"
                              type="button"
                              class="step1-prompt-btn"
                              :class="{ active: artStyleStore.selectedStyle === style.value }"
                              @click="artStyleStore.selectedStyle = style.value; artStylePopoverVisible = false"
                            >
                              <span class="step1-prompt-btn-text">{{ artStyleSelectLabel(style) }}</span>
                            </button>
                          </div>
                        </div>
                      </el-popover>
                    </div>
                    <div class="style-selector-row">
                      <span class="setting-label">{{ t('editorWorkshop.step2.imageRatioLbl') }}</span>
                      <el-popover
                        v-model:visible="aspectRatioPopoverVisible"
                        placement="bottom-start"
                        :width="275"
                        trigger="click"
                        popper-class="step1-popover"
                      >
                        <template #reference>
                          <button type="button" class="step1-prompt-chip">
                            <span class="step1-prompt-chip-name">{{ currentAspectRatioLabel }}</span>
                          </button>
                        </template>
                        <div class="step1-prompt-panel">
                          <div class="step1-prompt-panel-label">选择画面比例</div>
                          <div class="step1-prompt-group">
                            <button
                              v-for="ratio in aspectRatioOptions"
                              :key="ratio.value"
                              type="button"
                              class="step1-prompt-btn"
                              :class="{ active: imageAspectRatio === ratio.value }"
                              @click="imageAspectRatio = ratio.value; aspectRatioPopoverVisible = false"
                            >
                              <span class="step1-prompt-btn-text">{{ ratio.label }}</span>
                            </button>
                          </div>
                        </div>
                      </el-popover>
                    </div>
                    <div class="style-selector-row">
                      <span class="setting-label">{{ t('editorWorkshop.step2.inferFmtLbl') }}</span>
                      <el-popover
                        v-model:visible="imageFormatPopoverVisible"
                        placement="bottom-start"
                        :width="275"
                        trigger="click"
                        popper-class="step1-popover"
                      >
                        <template #reference>
                          <button type="button" class="step1-prompt-chip">
                            <span class="step1-prompt-chip-name">{{ currentImageFormatLabel }}</span>
                          </button>
                        </template>
                        <div class="step1-prompt-panel">
                          <div class="step1-prompt-panel-label">选择推理格式</div>
                          <div class="step1-prompt-group">
                            <button
                              v-for="format in imageFormatOptions"
                              :key="format.value"
                              type="button"
                              class="step1-prompt-btn"
                              :class="{ active: imageFormat === format.value }"
                              @click="imageFormat = format.value; imageFormatPopoverVisible = false"
                            >
                              <span class="step1-prompt-btn-text">{{ format.label }}</span>
                            </button>
                          </div>
                        </div>
                      </el-popover>
                    </div>
                  </div>
                </div>
                <div class="batch-action">
                  <div class="section-panel">
                    <div class="section-title">
                      <el-icon :size="16"><Picture /></el-icon>
                      <span>{{ t('editorWorkshop.step2.batchGenHdr') }}</span>
                    </div>
                    <div class="batch-match-inline">
                      <div class="batch-match-info">
                        {{
                          t('editorWorkshop.step2.batchSbInfo', {
                            n: storyboardStore.storyboardCount,
                            g: generatedImageSbCount
                          })
                        }}
                      </div>
                      <div class="style-selector-row">
                        <span class="setting-label">{{ t('editorWorkshop.step2.genModeLbl') }}</span>
                        <el-popover
                          v-model:visible="storyboardGenerateModePopoverVisible"
                          placement="bottom-start"
                          :width="275"
                          trigger="click"
                          popper-class="step1-popover"
                        >
                          <template #reference>
                            <button type="button" class="step1-prompt-chip">
                              <span class="step1-prompt-chip-name">{{ currentStoryboardGenerateModeLabel }}</span>
                            </button>
                          </template>
                          <div class="step1-prompt-panel">
                            <div class="step1-prompt-panel-label">选择生成模式</div>
                            <div class="step1-prompt-group">
                              <button
                                v-for="mode in storyboardGenerateModeOptions"
                                :key="mode.value"
                                type="button"
                                class="step1-prompt-btn"
                                :class="{ active: storyboardGenerateMode === mode.value }"
                                @click="storyboardGenerateMode = mode.value; storyboardGenerateModePopoverVisible = false"
                              >
                                <span class="step1-prompt-btn-text">{{ mode.label }}</span>
                              </button>
                            </div>
                          </div>
                        </el-popover>
                      </div>
                      <div
                        v-if="storyboardGenerateMode === 'custom'"
                        class="custom-range-input"
                      >
                        <el-input
                          v-model="storyboardCustomRangeInput"
                          :placeholder="t('editorWorkshop.step2.phSbIdx')"
                          size="small"
                          clearable
                        />
                        <div class="input-hint">
                          {{ t('editorWorkshop.step1.rangeFmtHint') }}
                        </div>
                      </div>
                      <div class="style-selector-row">
                        <span class="setting-label">{{ t('editorWorkshop.step2.concurrencyLbl') }}</span>
                        <el-popover
                          v-model:visible="concurrencyPopoverVisible"
                          placement="bottom-start"
                          :width="275"
                          trigger="click"
                          popper-class="step1-popover"
                        >
                          <template #reference>
                            <button type="button" class="step1-prompt-chip">
                              <span class="step1-prompt-chip-name">{{ currentConcurrencyLabel }}</span>
                            </button>
                          </template>
                          <div class="step1-prompt-panel">
                            <div class="step1-prompt-panel-label">选择并发数量</div>
                            <div class="step1-prompt-group step1-prompt-group-5cols">
                              <button
                                v-for="conc in concurrencyOptions"
                                :key="conc.value"
                                type="button"
                                class="step1-prompt-btn"
                                :class="{ active: imageConcurrencyLocal === conc.value }"
                                @click="imageConcurrencyLocal = conc.value; concurrencyPopoverVisible = false"
                              >
                                <span class="step1-prompt-btn-text">{{ conc.label }}</span>
                              </button>
                            </div>
                          </div>
                        </el-popover>
                      </div>
                      <el-button
                        type="primary"
                        size="small"
                        :loading="isBatchGenerating && timelineViewMode === 'image'"
                        class="start-match-btn"
                        @click="handleBatchGenerateStoryboards"
                      >
                        <el-icon><Picture /></el-icon>
                        <span>{{ t('editorWorkshop.step2.btnBatchSbImg') }}</span>
                      </el-button>
                    </div>
                  </div>
                </div>
                <div class="history-records">
                  <div class="history-title">
                    <el-icon><Clock /></el-icon>
                    <span>{{ t('editorWorkshop.step2.historyImg') }}</span>
                    <span
                      v-if="storyboardStore.currentStoryboard?.generatedImages?.length"
                      class="history-count"
                    >({{ storyboardStore.currentStoryboard.generatedImages.length }})</span>
                    <el-button
                      v-if="storyboardStore.currentStoryboard?.generatedImages?.length"
                      type="danger"
                      size="small"
                      class="history-clear-btn"
                      @click="handleClearHistoryImages"
                    >
                      {{ t('editorWorkshop.step2.clear') }}
                    </el-button>
                  </div>
                  <div
                    v-if="storyboardStore.currentStoryboard"
                    class="history-list"
                  >
                    <template v-if="!storyboardStore.currentStoryboard.generatedImages || storyboardStore.currentStoryboard.generatedImages.length === 0">
                      <div class="history-empty">
                        {{ t('editorWorkshop.step2.noImgHistory') }}
                      </div>
                    </template>
                    <template v-else>
                      <div class="history-grid">
                        <div
                          v-for="(img, index) in storyboardStore.currentStoryboard.generatedImages"
                          :key="index"
                          class="history-item"
                          @click="handleSelectHistoryImage(storyboardStore.currentStoryboard.id, img, index)"
                        >
                          <img
                            :src="img"
                            class="history-thumb"
                          >
                          <div
                            class="history-item-delete"
                            @click.stop="handleDeleteHistoryImage(index)"
                          >
                            <el-icon><Close /></el-icon>
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>
                  <div
                    v-else
                    class="history-list"
                  >
                    <div class="history-empty">
                      {{ t('editorWorkshop.step2.selectSbFirstShort') }}
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-else-if="propertiesTab === 'video'"
                class="tab-content video-tab"
              >
                <div class="video-settings">
                  <div class="section-panel">
                    <div class="section-title">
                      <el-icon :size="16"><VideoPlay /></el-icon>
                      <span>{{ t('editorWorkshop.step2.videoMdlSection') }}</span>
                    </div>
                    <div class="model-selector-row">
                      <div class="model-group-selector">
                        <span class="setting-label">{{ t('editorWorkshop.step2.modelGroupLbl') }}</span>
                        <el-popover
                          v-model:visible="videoModelGroupPopoverVisible"
                          placement="bottom-start"
                          :width="275"
                          trigger="click"
                          popper-class="step1-popover"
                        >
                          <template #reference>
                            <button type="button" class="step1-prompt-chip">
                              <span class="step1-prompt-chip-name">{{ currentVideoModelGroupLabel }}</span>
                            </button>
                          </template>
                          <div class="step1-prompt-panel">
                            <div class="step1-prompt-panel-label">选择模型分组</div>
                            <div class="step1-prompt-group">
                              <button
                                v-for="option in modelGroupOpts"
                                :key="option.value"
                                type="button"
                                class="step1-prompt-btn"
                                :class="{ active: videoModelGroup === option.value }"
                                @click="videoModelGroup = option.value; videoModelGroupPopoverVisible = false"
                              >
                                <span class="step1-prompt-btn-icon icon-official">
                                  {{ option.value === 'youshang' ? '优' : option.value === 'flow2' ? '本' : '官' }}
                                </span>
                                <span class="step1-prompt-btn-text">{{ option.label }}</span>
                              </button>
                            </div>
                          </div>
                        </el-popover>
                      </div>
                      <div class="model-select-wrapper">
                        <span class="setting-label">{{ t('editorWorkshop.step2.videoMdlPickLbl') }}</span>
                        <el-popover
                          v-model:visible="videoModelPopoverVisible"
                          placement="bottom-start"
                          :width="275"
                          trigger="click"
                          popper-class="step1-popover"
                        >
                          <template #reference>
                            <button type="button" class="step1-prompt-chip" :disabled="videoModelOptions.length === 0">
                              <span class="step1-prompt-chip-name">{{ currentVideoModel?.name || '请选择模型' }}</span>
                              <span v-if="currentVideoModel?.price" class="step1-prompt-chip-group">{{ currentVideoModel.price }}</span>
                            </button>
                          </template>
                          <div class="step1-prompt-panel">
                            <div class="step1-prompt-panel-label">选择视频模型</div>
                            <div class="step1-prompt-group">
                              <button
                                v-for="model in videoModelOptions"
                                :key="model.id"
                                type="button"
                                class="step1-prompt-btn"
                                :class="{ active: selectedVideoModel === model.id }"
                                @click="selectedVideoModel = model.id; videoModelPopoverVisible = false"
                              >
                                <span class="step1-prompt-btn-icon" :class="`platform-${model.badge.key}`">
                                  <svg v-if="model.badge.key === 'kling'" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                                    <path d="M5.4 13.8A23.2 23.2 0 017.4 9.3c3.2-5.5 7.8-8.8 10.3-7.3C12-1.3 4.6 1 1.1 7a13.4 13.4 0 00-1 2.2c-.3.8.1 1.6.8 2l4.6 2.6z" fill="#04A6F0"/>
                                    <path d="M18.6 10.2a23.2 23.2 0 01-2 4.5c-3.2 5.5-7.8 8.8-10.3 7.3 5.7 3.3 13.1 1.1 16.6-4.9a13.4 13.4 0 001-2.3c.3-.8-.1-1.6-.8-2l-4.5-2.6z" fill="#0DF35E"/>
                                    <path d="M16.6 14.6c3.2-5.5 3.7-11.1 1.2-12.6C15.2.6 10.6 3.8 7.4 9.3c2-3.6 5.8-5.3 8.3-3.8 2.6 1.5 2.9 5.6.9 9.1z" fill="#003EFF"/>
                                    <path d="M7.4 9.3c-3.2 5.5-3.7 11.1-1.2 12.6 2.6 1.5 7.2-1.8 10.4-7.3-2.1 3.6-5.9 5.3-8.4 3.9-2.5-1.4-2.9-5.6-.8-9.2z" fill="#0BFFE7"/>
                                  </svg>
                                  <svg v-else-if="model.badge.key === 'gpt'" fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                                    <title>OpenAI</title>
                                    <path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"></path>
                                  </svg>
                                  
                                  <svg v-else-if="model.badge.key === 'banana'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;" aria-hidden="true"><path d="M1.5 19.824c0-.548.444-.992.991-.992h.744a.991.991 0 010 1.983H2.49a.991.991 0 01-.991-.991z" fill="#F3AD61"></path><path d="M14.837 13.5h7.076c.522 0 .784-.657.413-1.044l-1.634-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044zM3.587 13.5h7.076c.521 0 .784-.659.414-1.044l-1.635-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044z" fill="#F9C23C"></path><path d="M12.525 1.521c3.69-.53 5.97 8.923 4.309 12.744-1.662 3.82-5.248 4.657-9.053 6.152a3.49 3.49 0 01-1.279.244c-1.443 0-2.227 1.187-2.774-.282-.707-1.9.22-4.031 2.069-4.757 2.014-.79 3.084-2.308 3.89-4.364.82-2.096.877-2.956.873-5.241-.003-1.827-.123-4.195 1.965-4.496z" fill="#FEEFC2"></path><path d="M16.834 14.264l-7.095-3.257c-.815 1.873-2.29 3.308-4.156 4.043-2.16.848-3.605 3.171-2.422 5.54 2.364 4.727 13.673-.05 13.673-6.325z" fill="#FCD53F"></path><path d="M13.68 12.362c.296.094.46.41.365.707-1.486 4.65-5.818 6.798-9.689 6.997a.562.562 0 11-.057-1.124c3.553-.182 7.372-2.138 8.674-6.216a.562.562 0 01.707-.364z" fill="#F9C23C"></path><path d="M17.43 19.85l-7.648-8.835h6.753c1.595.08 2.846 1.433 2.846 3.073v5.664c0 .997-.898 1.302-1.95.098z" fill="#FFF478"></path></svg>
                                  <template v-else>{{ model.badge.short }}</template>
                                </span>
                                <span class="step1-prompt-btn-text">{{ model.name }}</span>
                                <span v-if="model.price" class="step1-prompt-btn-price">{{ model.price }}</span>
                              </button>
                            </div>
                          </div>
                        </el-popover>
                      </div>
                    </div>
                    <div class="model-selector-row">
                      <div class="model-select-wrapper">
                        <span class="setting-label">{{ t('editorWorkshop.step2.tplVideoGen') }}</span>
                        <el-popover
                          v-model:visible="videoPromptTemplatePopoverVisible"
                          placement="bottom-start"
                          :width="275"
                          trigger="click"
                          popper-class="step1-popover"
                        >
                          <template #reference>
                            <button type="button" class="step1-prompt-chip">
                              <span class="step1-prompt-chip-name">{{ currentStep2VideoPromptTemplate?.title || t('editorWorkshop.step1.pickTplPlaceholder') }}</span>
                              <span class="step1-prompt-chip-group">{{ currentStep2VideoPromptTemplate?.isCustom ? t('promptsPage.badgeCustom') : t('promptsPage.badgeOfficial') }}</span>
                            </button>
                          </template>
                          <div class="step1-prompt-panel">
                            <div class="step1-prompt-panel-label">{{ t('editorWorkshop.step2.pickTplVideoGen') }}</div>
                            <div class="step1-prompt-group">
                              <button
                                v-for="prompt in generateVideoPromptTemplates"
                                :key="prompt.id"
                                type="button"
                                class="step1-prompt-btn"
                                :class="{ active: selectedStep2VideoPromptTemplateId === prompt.id }"
                                @click="selectedStep2VideoPromptTemplateId = prompt.id; videoPromptTemplatePopoverVisible = false"
                              >
                                <span class="step1-prompt-btn-icon" :class="prompt.isCustom ? 'icon-custom' : 'icon-official'">
                                  {{ prompt.isCustom ? t('promptsPage.badgeCustom').slice(0, 1) : t('promptsPage.badgeOfficial').slice(0, 1) }}
                                </span>
                                <span class="step1-prompt-btn-text">{{ prompt.title }}</span>
                              </button>
                            </div>
                          </div>
                        </el-popover>
                      </div>
                    </div>
                  </div>
                  <div class="section-panel">
                    <div class="section-title">
                      <el-icon :size="16"><Grid /></el-icon>
                      <span>{{ t('editorWorkshop.step2.videoSettings') }}</span>
                    </div>
                    <div class="style-selector-row">
                      <span class="setting-label">{{ t('editorWorkshop.step2.videoRatioLbl') }}</span>
                      <el-popover
                        v-model:visible="videoOrientationPopoverVisible"
                        placement="bottom-start"
                        :width="275"
                        trigger="click"
                        popper-class="step1-popover"
                      >
                        <template #reference>
                          <button type="button" class="step1-prompt-chip">
                            <span class="step1-prompt-chip-name">{{ currentVideoOrientationLabel }}</span>
                          </button>
                        </template>
                        <div class="step1-prompt-panel">
                          <div class="step1-prompt-panel-label">选择画面比例</div>
                          <div class="step1-prompt-group">
                            <button
                              v-for="option in orientationOptions"
                              :key="option.value"
                              type="button"
                              class="step1-prompt-btn"
                              :class="{ active: orientation === option.value }"
                              @click="orientation = option.value; videoOrientationPopoverVisible = false; handleOrientationChange(option.value)"
                            >
                              <span class="step1-prompt-btn-text">{{ option.label }}</span>
                            </button>
                          </div>
                        </div>
                      </el-popover>
                    </div>
                    <div class="style-selector-row">
                      <span class="setting-label">{{ t('editorWorkshop.step2.videoDurLbl') }}</span>
                      <el-popover
                        v-model:visible="videoDurationPopoverVisible"
                        placement="bottom-start"
                        :width="275"
                        trigger="click"
                        popper-class="step1-popover"
                      >
                        <template #reference>
                          <button type="button" class="step1-prompt-chip">
                            <span class="step1-prompt-chip-name">{{ currentVideoDurationLabel }}</span>
                          </button>
                        </template>
                        <div class="step1-prompt-panel">
                          <div class="step1-prompt-panel-label">选择视频时长</div>
                          <div class="step1-prompt-group">
                            <button
                              v-for="option in availableDurationOptions"
                              :key="option.value"
                              type="button"
                              class="step1-prompt-btn"
                              :class="{ active: videoDuration === option.value }"
                              @click="videoDuration = option.value; videoDurationPopoverVisible = false"
                            >
                              <span class="step1-prompt-btn-text">{{ option.label }}</span>
                            </button>
                          </div>
                        </div>
                      </el-popover>
                    </div>
                    <div class="style-selector-row">
                      <span class="setting-label">{{ t('canvas.artStyles.frameLabel') }}</span>
                      <el-popover
                        v-model:visible="videoArtStylePopoverVisible"
                        placement="bottom-start"
                        :width="275"
                        trigger="click"
                        popper-class="step1-popover"
                      >
                        <template #reference>
                          <button type="button" class="step1-prompt-chip">
                            <span class="step1-prompt-chip-name">{{ currentArtStyleLabel }}</span>
                          </button>
                        </template>
                        <div class="step1-prompt-panel">
                          <div class="step1-prompt-panel-label">选择画面风格</div>
                          <div class="step1-prompt-group step1-prompt-group-2cols">
                            <button
                              v-for="style in artStyleStore.artStyles"
                              :key="style.value"
                              type="button"
                              class="step1-prompt-btn"
                              :class="{ active: artStyleStore.selectedStyle === style.value }"
                              @click="artStyleStore.selectedStyle = style.value; videoArtStylePopoverVisible = false"
                            >
                              <span class="step1-prompt-btn-text">{{ artStyleSelectLabel(style) }}</span>
                            </button>
                          </div>
                        </div>
                      </el-popover>
                    </div>
                  </div>
                </div>
                <div class="batch-action">
                  <div class="section-panel">
                    <div class="section-title">
                      <el-icon :size="16"><VideoPlay /></el-icon>
                      <span>{{ t('editorWorkshop.step2.batchGenHdr') }}</span>
                    </div>
                    <div class="batch-match-inline">
                      <div class="batch-match-info">
                        {{
                          t('editorWorkshop.step2.batchVidInfo', {
                            n: storyboardStore.storyboardCount,
                            g: generatedVideoSbCount
                          })
                        }}
                      </div>
                      <div class="style-selector-row">
                        <span class="setting-label">{{ t('editorWorkshop.step2.genModeLbl') }}</span>
                        <el-popover
                          v-model:visible="videoGenerateModePopoverVisible"
                          placement="bottom-start"
                          :width="275"
                          trigger="click"
                          popper-class="step1-popover"
                        >
                          <template #reference>
                            <button type="button" class="step1-prompt-chip">
                              <span class="step1-prompt-chip-name">{{ currentStoryboardGenerateModeLabel }}</span>
                            </button>
                          </template>
                          <div class="step1-prompt-panel">
                            <div class="step1-prompt-panel-label">选择生成模式</div>
                            <div class="step1-prompt-group">
                              <button
                                v-for="option in storyboardGenerateModeOptions"
                                :key="option.value"
                                type="button"
                                class="step1-prompt-btn"
                                :class="{ active: videoGenerateMode === option.value }"
                                @click="videoGenerateMode = option.value; videoGenerateModePopoverVisible = false"
                              >
                                <span class="step1-prompt-btn-text">{{ option.label }}</span>
                              </button>
                            </div>
                          </div>
                        </el-popover>
                      </div>
                      <div
                        v-if="videoGenerateMode === 'custom'"
                        class="custom-range-input"
                      >
                        <el-input
                          v-model="videoCustomRangeInput"
                          :placeholder="t('editorWorkshop.step2.phSbIdx')"
                          size="small"
                          clearable
                        />
                        <div class="input-hint">
                          {{ t('editorWorkshop.step1.rangeFmtHint') }}
                        </div>
                      </div>
                      <div class="style-selector-row">
                        <span class="setting-label">{{ t('editorWorkshop.step2.concurrencyLbl') }}</span>
                        <el-popover
                          v-model:visible="videoConcurrencyPopoverVisible"
                          placement="bottom-start"
                          :width="275"
                          trigger="click"
                          popper-class="step1-popover"
                        >
                          <template #reference>
                            <button type="button" class="step1-prompt-chip">
                              <span class="step1-prompt-chip-name">{{ currentVideoConcurrencyLabel }}</span>
                            </button>
                          </template>
                          <div class="step1-prompt-panel">
                            <div class="step1-prompt-panel-label">选择并发数量</div>
                            <div class="step1-prompt-group step1-prompt-group-5cols">
                              <button
                                v-for="conc in videoConcurrencyOptions"
                                :key="conc.value"
                                type="button"
                                class="step1-prompt-btn"
                                :class="{ active: videoConcurrencyLocal === conc.value }"
                                @click="videoConcurrencyLocal = conc.value; videoConcurrencyPopoverVisible = false"
                              >
                                <span class="step1-prompt-btn-text">{{ conc.label }}</span>
                              </button>
                            </div>
                          </div>
                        </el-popover>
                      </div>
                      <el-button
                        type="primary"
                        size="small"
                        :loading="isBatchGenerating && timelineViewMode === 'video'"
                        class="start-match-btn"
                        @click="handleBatchGenerateVideos"
                      >
                        <el-icon><VideoPlay /></el-icon>
                        <span>{{ t('editorWorkshop.step2.btnBatchVid') }}</span>
                      </el-button>
                      <div class="scheduled-task-section">
                        <div
                          class="scheduled-task-header"
                          @click="showScheduledTask = !showScheduledTask"
                        >
                          <div class="scheduled-task-title">
                            <el-icon><Timer /></el-icon>
                            <span>{{ t('editorWorkshop.step2.schedTask') }}</span>
                          </div>
                          <el-icon :class="['arrow-icon', { expanded: showScheduledTask }]">
                            <ArrowRight />
                          </el-icon>
                        </div>
                        <div
                          v-show="showScheduledTask"
                          class="scheduled-task-content"
                        >
                          <div class="setting-row">
                            <span class="setting-label">{{ t('editorWorkshop.step2.startTimeLbl') }}</span>
                            <el-date-picker
                              v-model="scheduledStartTime"
                              type="datetime"
                              :placeholder="t('editorWorkshop.step2.startTimePh')"
                              size="small"
                              :disabled="isScheduledTaskRunning"
                              style="flex: 1;"
                            />
                          </div>
                          <div class="setting-row">
                            <span class="setting-label">{{ t('editorWorkshop.step2.intervalLbl') }}</span>
                            <el-select
                              v-model="scheduledInterval"
                              size="small"
                              :disabled="isScheduledTaskRunning"
                              style="flex: 1;"
                            >
                              <el-option
                                v-for="opt in intervalOptions"
                                :key="opt.value"
                                :label="opt.label"
                                :value="opt.value"
                              />
                            </el-select>
                          </div>
                          <div class="setting-row">
                            <span class="setting-label">{{ t('editorWorkshop.step2.retriesLbl') }}</span>
                            <el-select
                              v-model="scheduledRetryRounds"
                              size="small"
                              :disabled="isScheduledTaskRunning"
                              style="flex: 1;"
                            >
                              <el-option
                                v-for="opt in retryRoundOptions"
                                :key="opt.value"
                                :label="opt.label"
                                :value="opt.value"
                              />
                            </el-select>
                          </div>
                          <div class="scheduled-task-action">
                            <template v-if="!isScheduledTaskRunning">
                              <el-button
                                type="primary"
                                size="small"
                                class="half-width-btn"
                                @click="handleStartScheduledTask"
                              >
                                {{ t('editorWorkshop.step2.schedSetBtn') }}
                              </el-button>
                            </template>
                            <template v-else>
                              <el-button
                                type="danger"
                                size="small"
                                class="half-width-btn"
                                @click="handleCancelScheduledTask"
                              >
                                {{ t('editorWorkshop.step2.schedCancelBtn') }}
                              </el-button>
                              <span
                                v-if="countdownText"
                                class="countdown-text half-width-text"
                              >{{ t('editorWorkshop.step2.countdownLbl', { text: countdownText }) }}</span>
                            </template>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="history-records">
                  <div class="history-title">
                    <el-icon><Clock /></el-icon>
                    <span>{{ t('editorWorkshop.step2.historyVid') }}</span>
                    <span
                      v-if="storyboardStore.currentStoryboard?.generatedVideos?.length"
                      class="history-count"
                    >({{ storyboardStore.currentStoryboard.generatedVideos.length }})</span>
                    <el-button
                      v-if="storyboardStore.currentStoryboard?.generatedVideos?.length"
                      type="danger"
                      size="small"
                      class="history-clear-btn"
                      @click="handleClearHistoryVideos"
                    >
                      {{ t('editorWorkshop.step2.clear') }}
                    </el-button>
                  </div>
                  <div
                    v-if="storyboardStore.currentStoryboard"
                    class="history-list"
                  >
                    <template v-if="!storyboardStore.currentStoryboard.generatedVideos || storyboardStore.currentStoryboard.generatedVideos.length === 0">
                      <div class="history-empty">
                        {{ t('editorWorkshop.step2.noVidHistory') }}
                      </div>
                    </template>
                    <template v-else>
                      <div class="history-grid">
                        <div
                          v-for="(video, index) in storyboardStore.currentStoryboard.generatedVideos"
                          :key="index"
                          class="history-item"
                          @click="handleSelectHistoryVideo(storyboardStore.currentStoryboard.id, video, index)"
                        >
                          <video
                            :src="video"
                            class="history-thumb"
                          />
                          <div
                            class="history-item-delete"
                            @click.stop="handleDeleteHistoryVideo(index)"
                          >
                            <el-icon><Close /></el-icon>
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>
                  <div
                    v-else
                    class="history-list"
                  >
                    <div class="history-empty">
                      {{ t('editorWorkshop.step2.selectSbFirstShort') }}
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-else-if="propertiesTab === 'audio'"
                class="tab-content audio-tab"
              >
                <div class="tab-placeholder">
                  <el-icon :size="32">
                    <Microphone />
                  </el-icon>
                  <span>{{ t('editorWorkshop.step2.voiceDev') }}</span>
                </div>
              </div>
            </div>
            <div class="test-button-area">
              <el-button
                type="primary"
                size="default"
                class="test-btn"
                @click="exportToJianYing"
              >
                {{ t('editorWorkshop.step2.exportJy') }}
              </el-button>
            </div>
          </div>
        </div>

        <div class="timeline-section">
          <div class="timeline-content">
            <div class="view-mode-switch">
              <div
                :class="['mode-btn', { active: timelineViewMode === 'image' }]"
                @click="timelineViewMode = 'image'"
              >
                <el-icon><Picture /></el-icon>
                <span>{{ t('editorWorkshop.step2.canvasTabPic') }}</span>
              </div>
              <div
                :class="['mode-btn', { active: timelineViewMode === 'video' }]"
                @click="timelineViewMode = 'video'"
              >
                <el-icon><VideoPlay /></el-icon>
                <span>{{ t('editorWorkshop.step2.canvasTabVid') }}</span>
              </div>
            </div>
            <div
              class="timeline-arrow left"
              @click="handleTimelineScroll('left')"
            >
              <el-icon :size="18">
                <ArrowLeft />
              </el-icon>
            </div>
            <div
              ref="timelineListRef"
              class="storyboard-list"
            >
              <div
                v-for="(storyboard, index) in storyboardStore.storyboards"
                :key="storyboard.id"
                :class="['storyboard-item', { active: index === storyboardStore.currentStoryboardIndex }, getStatusClass(storyboard.status)]"
                @click="handleSelectStoryboard(index)"
              >
                <div class="item-preview">
                  <img
                    v-if="timelineViewMode === 'image' && storyboard.generatedImage"
                    :src="storyboard.generatedImage"
                    alt=""
                  >
                  <video
                    v-else-if="timelineViewMode === 'video' && storyboard.generatedVideo"
                    :src="storyboard.generatedVideo"
                  />
                  <div
                    v-else
                    class="preview-placeholder"
                  >
                    <el-icon
                      v-if="storyboard.status === 'generating'"
                      class="rotating"
                    >
                      <Loading />
                    </el-icon>
                    <el-icon v-else-if="storyboard.status === 'completed'">
                      <CircleCheck />
                    </el-icon>
                    <el-icon v-else-if="storyboard.status === 'failed'">
                      <CircleClose />
                    </el-icon>
                    <span v-else>{{ storyboard.order }}</span>
                  </div>
                </div>
                <div class="item-header">
                  <span class="item-order">#{{ storyboard.order }}</span>
                </div>
                <div class="item-actions">
                  <el-tooltip
                    :content="t('editorWorkshop.step2.toolbarCopySb')"
                    placement="top"
                  >
                    <div
                      class="action-btn"
                      @click.stop="handleDuplicateStoryboard(storyboard.id)"
                    >
                      <el-icon><CopyDocument /></el-icon>
                    </div>
                  </el-tooltip>
                  <el-tooltip
                    :content="t('editorWorkshop.step2.toolbarAddSb')"
                    placement="top"
                  >
                    <div
                      class="action-btn"
                      @click.stop="handleAddStoryboardAfter(index)"
                    >
                      <el-icon><Plus /></el-icon>
                    </div>
                  </el-tooltip>
                  <el-tooltip
                    :content="t('editorWorkshop.step2.toolbarDelSb')"
                    placement="top"
                  >
                    <div
                      class="action-btn delete"
                      @click.stop="handleDeleteStoryboard(storyboard.id)"
                    >
                      <el-icon><Delete /></el-icon>
                    </div>
                  </el-tooltip>
                </div>
              </div>
              <div
                class="storyboard-item add-item"
                @click="handleAddStoryboard"
              >
                <el-icon :size="20">
                  <Plus />
                </el-icon>
                <span>{{ t('editorWorkshop.step2.addBtn') }}</span>
              </div>
            </div>
            <div
              class="timeline-arrow right"
              @click="handleTimelineScroll('right')"
            >
              <el-icon :size="18">
                <ArrowRight />
              </el-icon>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="showLocalMergeDialog"
      :title="t('editorWorkshop.step2.dialogComposeTitle')"
      width="1000px"
      @closed="handleMergeDialogClose"
    >
      <div class="local-merge-dialog">
        <div class="merge-canvas-area">
          <div 
            ref="canvasContainerRef" 
            class="canvas-container"
            @mousedown="handleCanvasMouseDown"
            @mousemove="handleCanvasMouseMove"
            @mouseup="handleCanvasMouseUp"
            @mouseleave="handleCanvasMouseUp"
          >
            <div
              v-for="img in canvasImages"
              :key="img.id"
              :class="['canvas-image', { selected: selectedCanvasImage === img.id }]"
              :style="{ left: img.x + 'px', top: img.y + 'px', width: img.width + 'px', height: img.height + 'px' }"
              @mousedown.stop="handleImageMouseDown($event, img)"
              @click.stop="selectedCanvasImage = img.id"
            >
              <img
                :src="img.url"
                alt=""
                draggable="false"
              >
              <template v-if="selectedCanvasImage === img.id">
                <div
                  class="resize-handle tl"
                  @mousedown.stop="handleResizeStart($event, img, 'tl')"
                />
                <div
                  class="resize-handle tr"
                  @mousedown.stop="handleResizeStart($event, img, 'tr')"
                />
                <div
                  class="resize-handle bl"
                  @mousedown.stop="handleResizeStart($event, img, 'bl')"
                />
                <div
                  class="resize-handle br"
                  @mousedown.stop="handleResizeStart($event, img, 'br')"
                />
              </template>
            </div>
            <div
              v-if="canvasImages.length === 0"
              class="canvas-empty"
            >
              <el-icon :size="32">
                <Picture />
              </el-icon>
              <span>{{ t('editorWorkshop.step2.composeHint') }}</span>
            </div>
          </div>
        </div>
        <div class="merge-assets-area">
          <div class="assets-list">
            <div class="assets-title">
              {{ t('editorWorkshop.step2.assetListTitle') }}
            </div>
            <div class="local-upload-row">
              <el-button
                size="small"
                @click="handleLocalImageUpload"
              >
                <el-icon><Upload /></el-icon>
                {{ t('editorWorkshop.step2.uploadCanvas') }}
              </el-button>
              <input
                ref="localImageInputRef"
                type="file"
                accept="image/*"
                style="display: none"
                @change="handleLocalImageSelected"
              >
            </div>
            <div class="assets-items">
              <div
                v-for="asset in currentStoryboardAssets"
                :key="asset.id"
                :class="['asset-item', { added: canvasImages.find(img => img.id === asset.id) }]"
                @click="handleAddAssetToCanvas(asset)"
              >
                <img
                  :src="asset.url"
                  :alt="asset.name"
                >
                <span class="asset-name">{{ asset.name }}</span>
              </div>
              <div
                v-if="currentStoryboardAssets.length === 0"
                class="no-assets"
              >
                {{ t('editorWorkshop.step2.noAssetsCanvas') }}
              </div>
            </div>
          </div>
          <div class="merge-actions">
            <el-button
              size="small"
              @click="handleClearCanvas"
            >
              {{ t('editorWorkshop.step2.clearCanvasBtn') }}
            </el-button>
            <el-button
              size="small"
              @click="handleResetLayout"
            >
              {{ t('editorWorkshop.step2.resetLayoutBtn') }}
            </el-button>
            <el-button
              type="primary"
              size="small"
              @click="handleConfirmMerge"
            >
              {{ t('editorWorkshop.step2.confirmComposeBtn') }}
            </el-button>
          </div>
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="showImagePreviewDialog"
      :title="t('editorWorkshop.step2.previewTitle')"
      draggable
      class="image-preview-dialog"
      destroy-on-close
    >
      <div class="image-preview-content">
        <img
          :src="previewImageUrl"
          :alt="t('editorWorkshop.step2.previewAlt')"
        >
      </div>
    </el-dialog>

    <Teleport to="body">
      <Transition name="preview-fade">
        <div 
          v-if="previewImage" 
          class="image-preview-tooltip"
          :style="{ left: previewPosition.x + 'px', top: previewPosition.y + 'px' }"
        >
          <img
            :src="previewImage"
            :alt="t('editorWorkshop.step2.previewAlt')"
          >
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.step2-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
}

.main-content {
  flex: 1;
  display: flex;
  min-height: 0;
}

.main-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.storyboard-content-wrapper {
  flex: 1;
  display: flex;
  gap: 10px;
  padding: 10px;
  min-height: 0;
  overflow: hidden;
}

.storyboard-content-wrapper .storyboards-container {
  flex: 8;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
  overflow-y: auto;
  min-height: 0;
}

.storyboard-content-wrapper .storyboards-container::-webkit-scrollbar {
  display: none;
}

.storyboard-content-wrapper .storyboards-container {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.storyboard-content-wrapper .add-storyboard-row {
  flex-shrink: 0;
}

.properties-panel {
  flex: 2;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  min-height: 0;

}

.properties-header {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  flex-shrink: 0;
}

.properties-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.properties-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.properties-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 12px;
}

.properties-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 8px;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 12px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--primary-color);
  background-color: var(--bg-tertiary);
}

.tab-btn.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
  background-color: var(--bg-color);
}

.tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow-y: auto;
  min-height: 0;
  align-items: flex-start;
}

.tab-section-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color);
  width: 100%;
}

.tab-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 12px;
}

.batch-match-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.batch-match-inline {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.style-selector-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--bg-tertiary);
  border-radius: 4px;
}

.style-selector-row .style-select {
  flex: 1;
}

.style-selector-row .style-select .el-select__wrapper {
  min-height: 28px;
  font-size: 12px;
}

.style-option {
  font-size: 12px;
}

.batch-match-info {
  font-size: 12px;
  color: var(--text-secondary);
  background-color: var(--bg-tertiary);
  border-radius: 4px;
}

.mode-options-inline {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.mode-option-inline {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background-color: var(--bg-tertiary);
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.mode-option-inline:hover {
  background-color: var(--bg-secondary);
  border-color: var(--border-color);
}

.mode-option-inline.active {
  background-color: var(--bg-secondary);
  border-color: var(--primary-color);
}

.option-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-color);
  border-radius: 6px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.option-icon.all-icon {
  color: #67c23a;
}

.option-icon.ungenerated-icon {
  color: #e6a23c;
}

.option-icon.custom-icon {
  color: #409eff;
}

.mode-option-inline.active .option-icon {
  color: var(--primary-color);
}

.option-check {
  margin-left: auto;
  color: var(--primary-color);
}

.start-match-btn {
  margin-top: 6px;
  width: 100%;
  height: 40px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
}

.storyboard-settings,
.video-settings {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.section-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 10px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.model-selector-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background-color: var(--bg-tertiary);
  border-radius: 4px;
}

.model-group-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-select-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-select {
  flex: 1;
}

.group-select {
  flex: 1;
}

.group-select :deep(.el-select__wrapper),
.group-select :deep(.el-input__wrapper) {
  min-height: 32px;
  font-size: 12px;
  background-color: black !important;
  box-shadow: 0 0 0 1px #3b3b3b inset !important;
  color: var(--text-primary);
  line-height: 32px;
}

.model-select :deep(.el-select__wrapper),
.model-select :deep(.el-input__wrapper) {
  min-height: 32px;
  font-size: 12px;
  background-color: black !important;
  box-shadow: 0 0 0 1px #3b3b3b inset !important;
  color: var(--text-primary);
  line-height: 32px;
}

.model-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.model-name {
  font-size: 12px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.setting-label {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
  padding-right: 10px;
}

/* 侧栏「分镜」Tab：表单行标签列固定宽度，避免中英文案长度不同时选择框错位 */
.tab-content.storyboard-tab .setting-label {
  flex: 0 0 100px;
  width: 100px;
  min-width: 100px;
  max-width: 100px;
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 侧栏「视频」Tab：标签列固定 100px */
.tab-content.video-tab .setting-label {
  flex: 0 0 100px;
  width: 100px;
  min-width: 100px;
  max-width: 100px;
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-row .el-select {
  flex: 1;
}

:deep(.el-select__wrapper) {
  background-color: var(--bg-secondary, #1a1a2e);
  box-shadow: 0 0 0 1px var(--border-color, #3a3a4a) inset;
  color: var(--text-primary, #e0e0e0);
  height: 30px;
  line-height: 30px;
}
:deep(.el-select__placeholder) {
  color: var(--text-secondary, #a0a0a0);
}

.batch-action {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  width: 100%;
  align-self: stretch;
  box-sizing: border-box;
}

.batch-action .batch-match-inline {
  width: 100%;
}

.batch-action .tab-section-title {
  margin-bottom: 8px;
}

.batch-action .el-button {
  width: 100%;
}

.history-records {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  width: 100%;
  align-self: stretch;
  box-sizing: border-box;
}

.history-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 10px;
  font-weight: 500;
  width: 100%;
}

.history-title .history-count {
  color: var(--text-muted);
  font-size: 11px;
}

.history-title .history-clear-btn {
  margin-left: auto;
  padding: 2px 8px;
  font-size: 11px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scheduled-task-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.scheduled-task-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 4px 0;
  user-select: none;
}

.scheduled-task-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.scheduled-task-header .arrow-icon {
  transition: transform 0.2s;
  color: var(--text-muted);
}

.scheduled-task-header .arrow-icon.expanded {
  transform: rotate(90deg);
}

.scheduled-task-content {
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.scheduled-task-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 4px;
}

.scheduled-task-action .el-button.half-width-btn {
  width: calc(50% - 5px) !important;
  height: 40px !important;
  padding: 0 !important;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  box-sizing: border-box;
}

.scheduled-task-action .half-width-text {
  width: calc(50% - 5px);
  text-align: center;
}

.countdown-text {
  font-size: 12px;
  color: var(--el-color-primary);
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.history-empty {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 12px 0;
}

.history-item {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background-color: var(--bg-tertiary);
  border-radius: 6px;
  cursor: pointer;
  overflow: hidden;
}

.history-item:hover {
  background-color: var(--bg-secondary);
}

.history-item-delete {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  color: #fff;
  opacity: 0;
  transition: opacity 0.2s;
  cursor: pointer;
  z-index: 1;
}

.history-item:hover .history-item-delete {
  opacity: 1;
}

.history-item-delete:hover {
  background-color: rgba(220, 38, 38, 0.9);
}

.history-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
  background-color: var(--bg-primary);
}

.history-thumb video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.history-info {
  display: none;
}

.storyboard-row {
  display: flex;
  gap: 10px;
  min-height: fit-content;
  padding: 5px;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.storyboard-row:hover {
  background-color: var(--bg-tertiary);
}

.storyboard-row.active {
  border-color: var(--primary-color);
}

.add-storyboard-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 60px;
  background-color: var(--bg-secondary);
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.2s;
}

.add-storyboard-row:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.module-card {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  min-height: 0;
}

.module-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background-color: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.size-select,
.format-select {
  width: 75px;
}

.size-select :deep(.el-input__wrapper),
.format-select :deep(.el-input__wrapper) {
  background-color: var(--bg-tertiary);
  box-shadow: none;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0 8px;
  height: 24px;
  transition: all 0.2s;
}

.size-select :deep(.el-input__wrapper:hover),
.format-select :deep(.el-input__wrapper:hover) {
  border-color: var(--primary-color);
}

.size-select :deep(.el-input__wrapper.is-focus),
.format-select :deep(.el-input__wrapper.is-focus) {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
}

.size-select :deep(.el-input__inner),
.format-select :deep(.el-input__inner) {
  font-size: 12px;
  color: var(--text-primary);
  height: 22px;
  line-height: 22px;
}

.size-select :deep(.el-input__suffix),
.format-select :deep(.el-input__suffix) {
  color: var(--text-muted);
}

.size-select :deep(.el-input__suffix-inner),
.format-select :deep(.el-input__suffix-inner) {
  color: var(--text-muted);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-right .el-button {
  padding: 4px 8px;
  font-size: 11px;
  transition: all 0.3s ease;
}

.header-right .el-button.btn-generating {
  background: linear-gradient(135deg, var(--primary-color), #667eea);
  border-color: transparent;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(0, 214, 143, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(0, 214, 143, 0);
  }
}

.header-right .el-button .rotating {
  animation: rotate 1s linear infinite;
}

.storyboard-badge {
  background-color: var(--primary-color);
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.module-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.orientation-tag {
  font-size: 10px;
  color: var(--text-muted);
  background-color: var(--bg-color);
  padding: 1px 4px;
  border-radius: 3px;
}

.orientation-select {
  width: 100px;
}

.orientation-select :deep(.el-input__wrapper) {
  background-color: var(--bg-color);
  border-color: var(--border-color);
  box-shadow: none;
}

.orientation-select :deep(.el-input__inner) {
  color: var(--text-primary);
  font-size: 12px;
}

.duration-select {
  width: 80px;
}

.duration-select :deep(.el-input__wrapper) {
  background-color: var(--bg-color);
  border-color: var(--border-color);
  box-shadow: none;
}

.duration-select :deep(.el-input__inner) {
  color: var(--text-primary);
  font-size: 12px;
}

.module-content {
  flex: 1;
  padding: 8px;
  overflow: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.text-input-content {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.asset-module-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  padding-bottom: 4px;
  flex-shrink: 0;
}

.asset-top-row {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  align-items: stretch;
  min-height: fit-content;
}

.asset-characters-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.asset-scene-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.asset-section-title {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 4px;
  flex-shrink: 0;
}

.asset-characters-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 4px;
  flex: 1;
  min-height: 0;
}

.asset-item-large {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
  aspect-ratio: 1;
  width: 100%;
}

.asset-item-large:hover {
  background-color: var(--bg-tertiary);
}

.asset-item-large img {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid var(--border-color);
}

.asset-item-placeholder-large {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  background-color: var(--bg-tertiary);
  border: 1px dashed var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.asset-item-large.empty .asset-item-placeholder-large {
  opacity: 0.5;
}

.asset-item-large.empty :deep(.el-dropdown) {
  width: 100%;
  height: 100%;
}

.asset-item-large.empty :deep(.el-dropdown .el-dropdown__wrapper) {
  width: 100%;
  height: 100%;
}

.asset-item-scene.empty :deep(.el-dropdown) {
  width: 100%;
  height: 100%;
}

.asset-item-scene.empty :deep(.el-dropdown .el-dropdown__wrapper) {
  width: 100%;
  height: 100%;
}

.asset-item-prop.empty :deep(.el-dropdown) {
  width: 100%;
  height: 100%;
}

.asset-item-prop.empty :deep(.el-dropdown .el-dropdown__wrapper) {
  width: 100%;
  height: 100%;
}

.asset-item-name-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px 2px;
  font-size: 10px;
  color: #fff;
  text-align: center;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 0 0 4px 4px;
}

.placeholder-text {
  font-size: 12px;
  color: var(--text-muted);
}

.asset-scene-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.asset-item-scene {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  border-radius: 4px;
  height: 100%;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.asset-item-scene:hover {
  background-color: var(--bg-tertiary);
}

.asset-item-scene img {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid var(--border-color);
}

.asset-item-placeholder-scene {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  background-color: var(--bg-tertiary);
  border: 1px dashed var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.asset-item-scene.empty .asset-item-placeholder-scene {
  opacity: 0.5;
}

.asset-props-section {
  flex-shrink: 0;
  min-height: fit-content;
}

.asset-props-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.asset-item-prop {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.asset-item-prop:hover {
  background-color: var(--bg-tertiary);
}

.asset-item-prop img {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid var(--border-color);
}

.asset-item-placeholder-prop {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 4px;
  background-color: var(--bg-tertiary);
  border: 1px dashed var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.asset-item-prop.empty .asset-item-placeholder-prop {
  opacity: 0.5;
}

.prompt-input.full-height {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.prompt-input.full-height :deep(.el-textarea) {
  flex: 1;
  min-height: 0;
}

.prompt-input.full-height :deep(.el-textarea__inner) {
  height: 100%;
  min-height: 60px;
  resize: none;
  background-color: var(--bg-tertiary);
  border-color: var(--border-color);
  color: var(--text-primary);
  font-size: 14px;
}

.image-module-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  flex: 1;
}

.storyboard-preview {
  flex: 1;
  min-height: 60px;
  max-height: 100%;
  background-color: var(--bg-tertiary);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.storyboard-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);
  font-size: 10px;
}

.video-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  aspect-ratio: 16/9;
  max-height: 100%;
}

.video-preview {
  flex: 1;
  min-height: 60px;
  max-height: 100%;
  background-color: var(--bg-tertiary);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.video-preview video,
.video-preview img {
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.video-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-muted);
  background-color: var(--bg-tertiary);
  border-radius: 6px;
  min-height: 60px;
  max-height: 100%;
  font-size: 10px;
}

.timeline-section {
  height: 140px;
  flex-shrink: 0;
  background-color: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  display: flex;
  min-width: 0;
  overflow: hidden;
}

.test-button-area {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  background-color: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}

.test-btn {
  width: 100%;
}

.timeline-content {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 8px 0;
  position: relative;
  overflow: hidden;
  min-width: 0;
}

.view-mode-switch {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-left: 8px;
  background-color: var(--bg-tertiary);
  border-radius: 6px;
  flex-shrink: 0;
  flex-grow: 0;
}

.mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.2s;
  font-size: 10px;
}

.mode-btn:hover {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.mode-btn.active {
  background-color: var(--primary-color);
  color: #fff;
}

.mode-btn .el-icon {
  font-size: 16px;
}

.mode-btn span {
  font-size: 10px;
}

.timeline-arrow {
  width: 28px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.2s;
  flex-shrink: 0;
  flex-grow: 0;
  z-index: 10;
  position: relative;
}

.timeline-arrow.left {
  background: linear-gradient(to right, var(--bg-secondary), transparent);
}

.timeline-arrow.right {
  background: linear-gradient(to left, var(--bg-secondary), transparent);
}

.timeline-arrow:hover {
  color: var(--primary-color);
}

.storyboard-list {
  display: flex;
  gap: 8px;
  height: 100%;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  min-width: 0;
  align-items: stretch;
  width: 0;
}

.storyboard-list::-webkit-scrollbar {
  display: none;
}

.storyboard-item {
  flex-shrink: 0;
  width: 122px;
  height: 100%;
  background-color: var(--bg-tertiary);
  border-radius: 6px;
  border: 2px solid var(--border-color);
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
  position: relative;
}

.storyboard-item:hover {
  border-color: var(--primary-light);
}

.storyboard-item.active {
  border-color: var(--danger-color);
}

.item-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  padding: 4px 6px;
  font-size: 11px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent);
  z-index: 2;
}

.item-order {
  color: #fff;
  font-size: 14px;
  background: var(--primary-color);
  padding: 2px;
  border-radius: 3px;
}

.item-preview {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.item-preview img,
.item-preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 12px;
}

.item-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 4px;
  padding: 4px;
  background: linear-gradient(to top, rgba(0,0,0,0.5), transparent);
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 2;
}

.storyboard-item:hover .item-actions {
  opacity: 1;
}

.action-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  color: #fff;
  background-color: rgba(0, 0, 0, 0.4);
  transition: all 0.2s;
}

.action-btn:hover {
  color: #fff;
  background-color: rgba(0, 214, 143, 0.8);
}

.action-btn.delete:hover {
  color: #fff;
  background-color: rgba(245, 108, 108, 0.8);
}

.add-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--text-muted);
  border-style: dashed;
  font-size: 11px;
  position: relative;
}

.add-item:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.status-generating {
  border-color: var(--warning-color);
}

.status-completed {
  border-color: var(--success-color);
}

.status-failed {
  border-color: var(--danger-color);
}

.rotating {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.batch-generate-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dialog-desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.dialog-desc strong {
  color: var(--primary-color);
  font-weight: 600;
}

.dialog-options {
  display: flex;
  gap: 16px;
  padding: 12px;
  background-color: var(--bg-tertiary);
  border-radius: 8px;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-label {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.dialog-select {
  width: 100px;
}

.dialog-select :deep(.el-input__wrapper) {
  background-color: var(--bg-secondary);
  box-shadow: none;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.dialog-select :deep(.el-input__inner) {
  font-size: 12px;
  color: var(--text-primary);
}

.local-merge-dialog {
  display: flex;
  gap: 16px;
  height: 600px;
}

.merge-canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.canvas-container {
  flex: 1;
  background-color: var(--bg-tertiary);
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  user-select: none;
}

.canvas-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
}

.canvas-image {
  position: absolute;
  cursor: move;
  border: 2px solid transparent;
  border-radius: 4px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.canvas-image:hover {
  border-color: var(--primary-color);
}

.canvas-image.selected {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.3);
}

.canvas-image img {
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
}

.resize-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background-color: var(--primary-color);
  border-radius: 50%;
  z-index: 10;
}

.resize-handle.tl {
  left: -6px;
  top: -6px;
  cursor: nw-resize;
}

.resize-handle.tr {
  right: -6px;
  top: -6px;
  cursor: ne-resize;
}

.resize-handle.bl {
  left: -6px;
  bottom: -6px;
  cursor: sw-resize;
}

.resize-handle.br {
  right: -6px;
  bottom: -6px;
  cursor: se-resize;
}

.merge-assets-area {
  width: 150px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.local-upload-row {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}

.local-upload-row .el-button {
  width: 100%;
}

.assets-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-tertiary);
  border-radius: 8px;
  overflow: hidden;
}

.assets-title {
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
}

.assets-items {
  flex: 1;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.asset-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  background-color: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.asset-item:hover {
  border-color: var(--primary-color);
}

.asset-item.added {
  opacity: 0.5;
  cursor: not-allowed;
}

.asset-item img {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
}

.asset-name {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.no-assets {
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
  padding: 20px 0;
}

.merge-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.merge-actions .el-button {
  width: 100%;
  margin-left: 0 !important;
}

.merge-actions .el-button + .el-button {
  margin-left: 0 !important;
}

.mode-radio-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mode-radio-group .el-radio {
  height: auto;
  margin-right: 0;
}

.mode-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background-color: var(--bg-tertiary);
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-option:hover {
  background-color: var(--bg-secondary);
  border-color: var(--border-color);
}

.mode-option.active {
  background-color: rgba(0, 214, 143, 0.08);
  border-color: var(--primary-color);
}

.option-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
}

.option-icon.all-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.option-icon.ungenerated-icon {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: #fff;
}

.option-icon.custom-icon {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: #fff;
}

.option-content {
  flex: 1;
  min-width: 0;
}

.option-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.option-desc {
  font-size: 12px;
  color: var(--text-muted);
}

.option-check {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
  font-size: 20px;
}

.custom-range-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 0px;
  background-color: var(--bg-tertiary);
  border-radius: 8px;
  width: 100%;
  box-sizing: border-box;
}

.input-hint {
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.5;
}

.image-preview-tooltip {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  padding: 8px;
  overflow: hidden;
}

.image-preview-tooltip img {
  height: 400px;
  object-fit: contain;
  border-radius: 4px;
}

.preview-fade-enter-active,
.preview-fade-leave-active {
  transition: opacity 0.15s ease;
}

.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
}

.image-preview-dialog :deep(.el-dialog__header) {
  cursor: move;
  user-select: none;
}

.image-preview-dialog .image-preview-content {
  display: flex;
  justify-content: center;
  align-items: center;
  max-height: 70vh;
  overflow: auto;
}

.image-preview-dialog .image-preview-content img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 4px;
}
</style>

<style>
.step1-prompt-chip {
  min-width: 0;
  flex: 1;
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 5px;
  background: #101114;
  color: rgba(248, 250, 252, 0.85);
  font-size: 12px;
  padding: 0 10px;
  cursor: pointer;
  overflow: hidden;
}

.step1-prompt-chip:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.22);
}

.step1-prompt-chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.step1-prompt-chip-name {
  min-width: 0;
  flex: 1;
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.step1-prompt-chip-group {
  flex-shrink: 0;
  font-size: 11px;
  color: rgba(142, 154, 179, 0.9);
}
</style>

<style>
.step1-popover.el-popper,
.step1-popover {
  padding: 12px !important;
  background: #17181c !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 14px !important;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.5) !important;
}

.step1-popover .step1-prompt-panel-label {
  margin: 2px 0 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.58);
}

.step1-popover .step1-prompt-group {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 4px;
}

.step1-popover .step1-prompt-group::-webkit-scrollbar {
  width: 6px;
}

.step1-popover .step1-prompt-group::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.step1-popover .step1-prompt-group::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.step1-popover .step1-prompt-group::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

.step1-popover .step1-prompt-group-2cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.step1-popover .step1-prompt-group-4cols {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.step1-popover .step1-prompt-group-5cols {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.step1-popover .step1-prompt-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  padding: 8px 8px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: #101114;
  color: rgba(220, 228, 242, 0.85);
  font-size: 13px;
  line-height: 1.2;
  cursor: pointer;
}

.step1-popover .step1-prompt-btn-icon {
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

.step1-popover .step1-prompt-btn-icon.icon-official {
  background: #409eff;
}

.step1-popover .step1-prompt-btn-icon.icon-custom {
  background: #f59e0b;
}

.step1-popover .step1-prompt-btn-text {
  min-width: 0;
  text-align: center;
  white-space: nowrap;
}

.step1-popover .step1-prompt-btn-price {
  font-size: 11px;
  color: rgba(142, 154, 179, 0.9);
  flex-shrink: 0;
}

.step1-popover .step1-prompt-btn.active {
  border-color: rgba(64, 158, 255, 0.65);
  background: rgba(64, 158, 255, 0.2);
  color: #e8f1ff;
  font-weight: 600;
}

.step1-popover .step1-prompt-btn-icon.platform-jimeng {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.step1-popover .step1-prompt-btn-icon.platform-gpt {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.step1-popover .step1-prompt-btn-icon.platform-banana {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.step1-popover .step1-prompt-btn-icon.platform-qwen {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.step1-popover .step1-prompt-btn-icon.platform-grok {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.step1-popover .step1-prompt-btn-icon.platform-sora {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.step1-popover .step1-prompt-btn-icon.platform-veo {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.step1-popover .step1-prompt-btn-icon.platform-deepseek {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.step1-popover .step1-prompt-btn-icon.platform-kling {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.step1-popover .step1-prompt-btn-icon.platform-other {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
</style>

<style>
.el-select__placeholder {
  color: #cbcbcb !important;
}

.el-select-dropdown {
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.el-select-dropdown__item {
  color: var(--text-primary);
  font-size: 12px;
  padding: 0 12px;
  height: 32px;
  line-height: 32px;
}

.el-select-dropdown__item:hover {
  background-color: var(--bg-secondary);
}

.el-select-dropdown__item.is-selected {
  color: var(--primary-color);
  font-weight: 500;
}

.el-select-dropdown__item.is-selected::after {
  color: var(--primary-color);
}

.el-popper.is-light {
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
}

.el-popper.is-light .el-popper__arrow::before {
  background-color: var(--bg-tertiary);
  border-color: var(--border-color);
}
</style>
