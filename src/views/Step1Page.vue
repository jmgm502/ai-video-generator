<script setup lang="ts">
defineOptions({
  name: 'Step1Page'
})

import { computed, ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { DArrowLeft, DArrowRight, VideoPlay, Loading, Plus, Picture, CircleCheck, Box, Location, User, Document } from '@element-plus/icons-vue'
import { useStoryboardStore } from '@/stores/storyboardStore'
import { useStep1Store, type Chapter, type Asset } from '@/stores/step1Store'
import { useApiConfigStore, type ApiModelGroup } from '@/stores/apiConfigStore'
import { useProjectStore } from '@/stores/projectStore'
import { usePromptsStore } from '@/stores/promptsStore'
import { useLogsStore } from '@/stores/logsStore'
import { useArtStyleStore } from '@/stores/artStyleStore'
import type { ArtStyle } from '@/stores/artStyleStore'
import { resolveArtStyleLabel } from '@/utils/artStyleLocale'
import { buildArtStylePromptPrefix } from '@/utils/artStylePrompt'
import { useI18n } from 'vue-i18n'
import { projectFileService } from '@/services/projectFileService'
import apiService from '@/services/apiService'
import DocumentUploadPanel from '@/components/editor/DocumentUploadPanel.vue'
import AssetExtractionPanel from '@/components/editor/AssetExtractionPanel.vue'
import ProjectHeader from '@/components/editor/ProjectHeader.vue'
import type { Storyboard, ImageAsset } from '@/types'
import { getModelPlatformBadge } from '@/utils/modelPlatformBadge'

const router = useRouter()
const route = useRoute()

const storyboardStore = useStoryboardStore()
const step1Store = useStep1Store()
const apiConfigStore = useApiConfigStore()
const projectStore = useProjectStore()
const promptsStore = usePromptsStore()
const logsStore = useLogsStore()
const artStyleStore = useArtStyleStore()
const { t } = useI18n()

function artStyleSelectLabel(style: ArtStyle) {
  return resolveArtStyleLabel(style, t)
}

const isBatchMode = ref(false)

const extractedContent = computed({
  get: () => step1Store.extractedContent,
  set: (val) => step1Store.setExtractedContent(val)
})

const finalContent = ref('')

const chapters = computed({
  get: () => step1Store.chapters,
  set: (val) => step1Store.setChapters(val)
})

const characters = computed({
  get: () => step1Store.characters,
  set: (val) => step1Store.setCharacters(val)
})

const scenes = computed({
  get: () => step1Store.scenes,
  set: (val) => step1Store.setScenes(val)
})

const props = computed({
  get: () => step1Store.props,
  set: (val) => step1Store.setProps(val)
})

const generatedStoryboards = computed({
  get: () => step1Store.generatedStoryboards,
  set: (val) => step1Store.setGeneratedStoryboards(val)
})

const isProcessing = computed(() => step1Store.isProcessing)
const isExtracting = computed(() => step1Store.isExtracting)
const isGenerating = computed(() => step1Store.isGenerating)

const selectedChapterCount = computed(() => step1Store.chapters.filter(c => c.selected).length)

const activeTab = ref<'character' | 'scene' | 'props'>('character')

const characterGenerateMode = ref<'all' | 'ungenerated' | 'custom'>('all')
const characterCustomRangeInput = ref('')

const sceneGenerateMode = ref<'all' | 'ungenerated' | 'custom'>('all')
const sceneCustomRangeInput = ref('')

const propsGenerateMode = ref<'all' | 'ungenerated' | 'custom'>('all')
const propsCustomRangeInput = ref('')

const aspectRatioOptions = computed(() => [
  { value: '16:9', label: t('editorWorkshop.step1.aspect169_4k') },
  { value: '16:9-1080', label: t('editorWorkshop.step1.aspect169_2k') },
  { value: '4:3', label: t('editorWorkshop.step1.aspect43') },
  { value: '1:1', label: t('editorWorkshop.step1.aspect11') },
  { value: '9:16-v', label: t('editorWorkshop.step1.aspect916_4k') },
  { value: '9:16-1080', label: t('editorWorkshop.step1.aspect916_2k') },
  { value: '3:4', label: t('editorWorkshop.step1.aspect34') }
])

const modelGroupOptions = computed(() => [
  { value: 'youshang' as const, label: t('editorWorkshop.modelGroup.youshang') },
  { value: 'flow2' as const, label: t('editorWorkshop.modelGroup.flow2') }
])

const textModelGroup = computed({
  get: (): ApiModelGroup => apiConfigStore.textApiModelGroup,
  set: (val: ApiModelGroup) => apiConfigStore.setTextApiModelGroup(val)
})
const selectedTextModel = ref('deepseek-chat')
const selectedExtractAssetPromptId = ref('1')
const selectedGenerateStoryboardPromptId = ref('3')
const selectedCharacterImagePromptId = ref('5')
const selectedSceneImagePromptId = ref('6')
const selectedPropsImagePromptId = ref('7')

const textModelGroupPopoverVisible = ref(false)
const textModelPopoverVisible = ref(false)
const extractAssetPromptPopoverVisible = ref(false)
const generateStoryboardPromptPopoverVisible = ref(false)
const characterImagePromptPopoverVisible = ref(false)
const sceneImagePromptPopoverVisible = ref(false)
const propsImagePromptPopoverVisible = ref(false)
const imageModelGroupPopoverVisible = ref(false)
const imageModelPopoverVisible = ref(false)
const artStylePopoverVisible = ref(false)
const aspectRatioPopoverVisible = ref(false)

const textModelOptions = computed(() => {
  if (textModelGroup.value === 'youshang') {
    return apiConfigStore.textModels.map(model => ({
      ...model,
      badge: getModelPlatformBadge(model.id, model.name)
    }))
  }
  return []
})

const extractAssetPrompts = computed(() => promptsStore.getSubCategoryPrompts('extract-assets'))
const generateStoryboardPrompts = computed(() => promptsStore.getSubCategoryPrompts('generate-storyboard'))
const generateCharacterPrompts = computed(() => promptsStore.getSubCategoryPrompts('generate-character'))
const generateScenePrompts = computed(() => promptsStore.getSubCategoryPrompts('generate-scene'))
const generatePropsPrompts = computed(() => promptsStore.getSubCategoryPrompts('generate-props'))

const currentTextModelGroupLabel = computed(() => {
  const option = modelGroupOptions.value.find(o => o.value === textModelGroup.value)
  return option?.label || ''
})

const currentTextModel = computed(() => {
  return textModelOptions.value.find(m => m.id === selectedTextModel.value)
})

const currentImageModelGroupLabel = computed(() => {
  const option = modelGroupOptions.value.find(o => o.value === imageModelGroup.value)
  return option?.label || ''
})

const currentImageModel = computed(() => {
  return imageModelOptions.value.find(m => m.id === selectedImageModel.value)
})

const currentExtractAssetPrompt = computed(() => {
  return extractAssetPrompts.value.find(p => p.id === selectedExtractAssetPromptId.value)
})

const currentGenerateStoryboardPrompt = computed(() => {
  return generateStoryboardPrompts.value.find(p => p.id === selectedGenerateStoryboardPromptId.value)
})

const currentCharacterImagePrompt = computed(() =>
  generateCharacterPrompts.value.find((p) => p.id === selectedCharacterImagePromptId.value),
)
const currentSceneImagePrompt = computed(() =>
  generateScenePrompts.value.find((p) => p.id === selectedSceneImagePromptId.value),
)
const currentPropsImagePrompt = computed(() =>
  generatePropsPrompts.value.find((p) => p.id === selectedPropsImagePromptId.value),
)

const currentArtStyleLabel = computed(() => {
  const style = artStyleStore.artStyles.find(s => s.value === artStyleStore.selectedStyle)
  return style ? artStyleSelectLabel(style) : ''
})

const currentAspectRatioLabel = computed(() => {
  const ratio = aspectRatioOptions.value.find(r => r.value === step1Store.aspectRatio)
  return ratio?.label || ''
})

const selectedImageModel = computed({
  get: () => apiConfigStore.imageModel,
  set: (val) => apiConfigStore.setImageModel(val)
})

const imageModelGroup = computed({
  get: () => apiConfigStore.imageModelGroup,
  set: (val) => apiConfigStore.setImageModelGroup(val)
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

const handleExtractChapters = async () => {
  if (!step1Store.extractedContent) {
    ElMessage.warning(t('editorWorkshop.step1.msgUploadDoc'))
    return
  }
  
  step1Store.isProcessing = true
  try {
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const lines = step1Store.extractedContent.split('\n')
    const chapterList: Chapter[] = []
    let currentChapter: { title: string; content: string[] } | null = null
    
    const chapterRegex = /^(?:第\s*)?([0-9０-９零一二三四五六七八九十百千万〇]+)\s*[章节回节部卷集]\s*([^\n\r]*?)\s*$/
    const pureNumRegex = /^(?:第\s*)?(\d{1,4})[\.\s、：:]\s*([^\n\r]*?)\s*$/
    const englishRegex = /^(?:chapter|ch\.?)\s*(\d+)\s*[:\-]?\s*([^\n\r]*)$/i
    
    const isChapterTitle = (line: string): boolean => {
      const trimmedLine = line.trim()
      if (chapterRegex.test(trimmedLine)) return true
      if (pureNumRegex.test(trimmedLine)) return true
      if (englishRegex.test(trimmedLine)) return true
      return false
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
    
    step1Store.setChapters(chapterList)
    ElMessage.success(t('editorWorkshop.step1.msgChaptersFound', { n: chapterList.length }))
  } catch {
    ElMessage.error(t('editorWorkshop.step1.msgChapterFail'))
  } finally {
    step1Store.isProcessing = false
  }
}

const handleExtractAssets = async (novelText?: string) => {
  if (!apiConfigStore.isApiReadyForGroup(textModelGroup.value)) {
    ElMessage.warning(
      textModelGroup.value === 'flow2'
        ? t('settings.msg.enterApiUrlFirst')
        : t('editorWorkshop.step1.msgNeedApiKey')
    )
    return
  }

  let combinedContent = ''

  if (novelText && novelText.trim()) {
    combinedContent = novelText.trim()
  } else {
    const selectedChapters = step1Store.chapters.filter(c => c.selected)
    if (selectedChapters.length === 0) {
      ElMessage.warning(t('editorWorkshop.step1.msgSelectChapterOrText'))
      return
    }
    combinedContent = selectedChapters.map(c => `${c.title}\n${c.content}`).join('\n\n')
  }
  
  step1Store.isExtracting = true
  logsStore.addLog(
    'extract-assets',
    'info',
    {
      messageKey: 'logsPage.msg.extractStartTitle',
      detailKey: 'logsPage.msg.detailInputLen',
      detailParams: { chars: combinedContent.length }
    },
    projectStore.currentProject?.id,
    projectStore.currentProject?.name
  )

  try {
    const selectedPrompt = promptsStore.getPromptById(selectedExtractAssetPromptId.value)
    let promptContent = selectedPrompt?.content || promptsStore.getExtractAssetsPrompt()
    
    // 如果是自定义模板，添加标准约束
    if (selectedPrompt?.isCustom) {
      promptContent = `${promptContent}

${promptsStore.getExtractAssetsStandardConstraint()}`
    }
    
    const extractPrompt = `${promptContent}

小说内容：
${combinedContent}

请提取所有重要的人物（主角、配角等）、场景（室内、室外等地点）和道具（物品、武器等）。`

    const result = await apiService.generateText(extractPrompt, {
      model: selectedTextModel.value,
      systemPrompt: '你是一个小说资产提取助手，擅长从小说文本中提取人物、场景和道具信息。',
      modelGroup: textModelGroup.value
    })

    let parsedResult: {
      characters: { name: string; description: string }[]
      scenes: { name: string; description: string }[]
      props: { name: string; description: string }[]
    } | null = null

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0])
      }
      console.log('【解析后JSON】:', parsedResult)
    } catch (parseError) {
      console.error('解析AI返回结果失败:', parseError)
      logsStore.addLog(
        'extract-assets',
        'error',
        {
          messageKey: 'logsPage.msg.extractFailTitle',
          detailKey: 'logsPage.msg.aiReturnParseFail'
        },
        projectStore.currentProject?.id,
        projectStore.currentProject?.name
      )
      ElMessage.error(t('editorWorkshop.step1.msgAiParseFail'))
      return
    }

    if (parsedResult) {
      const characters = parsedResult.characters?.map((char, idx) => ({
        id: `char_${Date.now()}_${idx}`,
        name: char.name,
        description: char.description,
        status: 'pending' as const
      })) || []

      const scenes = parsedResult.scenes?.map((scene, idx) => ({
        id: `scene_${Date.now()}_${idx}`,
        name: scene.name,
        description: scene.description,
        status: 'pending' as const
      })) || []

      const props = parsedResult.props?.map((prop, idx) => ({
        id: `prop_${Date.now()}_${idx}`,
        name: prop.name,
        description: prop.description,
        status: 'pending' as const
      })) || []

      step1Store.setCharacters(characters)
      step1Store.setScenes(scenes)
      step1Store.setProps(props)

      const totalAssets = characters.length + scenes.length + props.length
      logsStore.addLog(
        'extract-assets',
        'success',
        {
          messageKey: 'logsPage.msg.extractOkTitle',
          detailKey: 'logsPage.msg.detailExtractSummary',
          detailParams: {
            total: totalAssets,
            ch: characters.length,
            sc: scenes.length,
            pr: props.length
          }
        },
        projectStore.currentProject?.id,
        projectStore.currentProject?.name
      )
      ElMessage.success(
        t('editorWorkshop.step1.msgExtractDone', {
          total: totalAssets,
          ch: characters.length,
          sc: scenes.length,
          pr: props.length
        })
      )
    } else {
      logsStore.addLog(
        'extract-assets',
        'warning',
        {
          messageKey: 'logsPage.msg.extractWarnTitle',
          detailKey: 'logsPage.msg.extractWarnParse'
        },
        projectStore.currentProject?.id,
        projectStore.currentProject?.name
      )
      ElMessage.warning(t('editorWorkshop.step1.msgExtractParseWarn'))
    }
  } catch (error) {
    console.error('资产提取失败:', error)
    logsStore.addLog(
      'extract-assets',
      'error',
      {
        messageKey: 'logsPage.msg.extractFailTitle',
        detailRaw: error instanceof Error ? error.message : t('logsPage.msg.unknownErr')
      },
      projectStore.currentProject?.id,
      projectStore.currentProject?.name
    )
    ElMessage.error(
      t('editorWorkshop.step1.msgExtractFail', {
        msg: error instanceof Error ? error.message : t('logsPage.msg.unknownErr')
      })
    )
  } finally {
    step1Store.isExtracting = false
  }
}

const findBestCharacterMatch = (charName: string): Asset | undefined => {
  return step1Store.characters.find(c => c.name === charName)
}

const findBestSceneMatch = (sceneName: string): Asset | undefined => {
  return step1Store.scenes.find(s => s.name === sceneName)
}

const findBestPropMatch = (propName: string): Asset | undefined => {
  return step1Store.props.find(p => p.name === propName)
}

const handleGenerateStoryboards = async () => {
  const selectedChapters = step1Store.chapters.filter(c => c.selected)
  let combinedContent = ''

  if (selectedChapters.length > 0) {
    combinedContent = selectedChapters.map(c => `${c.title}\n${c.content}`).join('\n\n')
  } else if (finalContent.value && finalContent.value.trim()) {
    combinedContent = finalContent.value.trim()
  } else {
    ElMessage.warning(t('editorWorkshop.step1.msgSelectChapterOrText'))
    return
  }

  if (!apiConfigStore.isApiReadyForGroup(textModelGroup.value)) {
    ElMessage.warning(
      textModelGroup.value === 'flow2'
        ? t('settings.msg.enterApiUrlFirst')
        : t('editorWorkshop.step1.msgNeedApiKey')
    )
    return
  }

  step1Store.isGenerating = true
  logsStore.addLog(
    'generate-storyboard',
    'info',
    {
      messageKey: 'logsPage.msg.genSbStartTitle',
      detailKey: 'logsPage.msg.detailInputLen',
      detailParams: { chars: combinedContent.length }
    },
    projectStore.currentProject?.id,
    projectStore.currentProject?.name
  )

  try {
    const selectedPrompt = promptsStore.getPromptById(selectedGenerateStoryboardPromptId.value)
    let promptContent = selectedPrompt?.content || promptsStore.getGenerateStoryboardPrompt()
    
    // 如果是自定义模板，添加标准约束
    if (selectedPrompt?.isCustom) {
      promptContent = `${promptContent}

${promptsStore.getGenerateStoryboardStandardConstraint()}`
    }
    
    const generatePrompt = `${promptContent}

小说内容：
${combinedContent}

请根据章节内容生成合适的分镜，每个分镜描述应该清晰具体，便于后续生成图片。`

    const result = await apiService.generateText(generatePrompt, {
      model: selectedTextModel.value,
      systemPrompt: '你是一个分镜生成助手，擅长将小说内容转化为分镜描述。',
      modelGroup: textModelGroup.value
    })

    let parsedResult: {
      storyboards: { title: string; description: string; duration: number; matchedAssets?: { characters: string[]; scene?: string; props: string[] } }[]
    } | null = null

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0])
      }
    } catch (parseError) {
      console.error('解析AI返回结果失败:', parseError)
      logsStore.addLog(
        'generate-storyboard',
        'error',
        {
          messageKey: 'logsPage.msg.genSbFailTitle',
          detailKey: 'logsPage.msg.aiReturnParseFail'
        },
        projectStore.currentProject?.id,
        projectStore.currentProject?.name
      )
      ElMessage.error(t('editorWorkshop.step1.msgAiParseFail'))
      return
    }

    if (parsedResult && parsedResult.storyboards && parsedResult.storyboards.length > 0) {
      const storyboards: Storyboard[] = parsedResult.storyboards.map((sb, index) => {
        const matchedAssets = sb.matchedAssets ? {
          characters: sb.matchedAssets.characters || [],
          scene: sb.matchedAssets.scene,
          props: sb.matchedAssets.props || []
        } : undefined
        
        const imagePrompt = {
          characters: [] as ImageAsset[],
          props: [] as ImageAsset[],
          scene: undefined as ImageAsset | undefined,
          compositeSettings: {
            positionX: 50,
            positionY: 50,
            scale: 100,
            opacity: 100,
            blendMode: 'normal' as const
          },
          generatedImages: [],
          generatedVideos: []
        }

        const matchedCharacterNames: string[] = []
        const matchedSceneName: string | undefined = matchedAssets?.scene
        const matchedPropNames: string[] = []

        if (matchedAssets) {
          matchedAssets.characters.forEach(charName => {
            const char = step1Store.characters.find(c => c.name === charName)
            if (char) {
              imagePrompt.characters.push({
                id: char.id,
                name: char.name,
                type: 'character' as const,
                url: char.imageUrl || '',
                tags: [],
                createdAt: new Date().toISOString()
              })
              matchedCharacterNames.push(char.name)
            } else {
              console.warn(`人物匹配失败: "${charName}" 在资产列表中未找到`)
            }
          })

          if (matchedAssets.scene) {
            const scene = step1Store.scenes.find(s => s.name === matchedAssets.scene)
            if (scene) {
              imagePrompt.scene = {
                id: scene.id,
                name: scene.name,
                type: 'scene' as const,
                url: scene.imageUrl || '',
                tags: [],
                createdAt: new Date().toISOString()
              }
              matchedSceneName !== undefined
            } else {
              console.warn(`场景匹配失败: "${matchedAssets.scene}" 在资产列表中未找到`)
            }
          }

          matchedAssets.props.forEach(propName => {
            const prop = step1Store.props.find(p => p.name === propName)
            if (prop) {
              imagePrompt.props.push({
                id: prop.id,
                name: prop.name,
                type: 'props' as const,
                url: prop.imageUrl || '',
                tags: [],
                createdAt: new Date().toISOString()
              })
              matchedPropNames.push(prop.name)
            } else {
              console.warn(`道具匹配失败: "${propName}" 在资产列表中未找到`)
            }
          })

          console.log(`分镜 #${index + 1} 资产匹配结果:`, {
            人物: { 请求: matchedAssets.characters, 匹配: matchedCharacterNames },
            场景: { 请求: matchedAssets.scene, 匹配: matchedSceneName },
            道具: { 请求: matchedAssets.props, 匹配: matchedPropNames }
          })
        }
        
        return {
          id: `sb_${Date.now()}_${index}`,
          title: sb.title || t('editorWorkshop.step1.sbTitleFallback', { n: index + 1 }),
          order: index + 1,
          duration: sb.duration || 5,
          textPrompt: {
            description: sb.description,
            systemPrompt: ''
          },
          imagePrompt,
          matchedAssets,
          status: 'completed' as const,
          generatedImages: [],
          generatedVideos: []
        }
      })

      storyboardStore.setStoryboards(storyboards)
      step1Store.setGeneratedStoryboards(storyboards)
      logsStore.addLog(
        'generate-storyboard',
        'success',
        {
          messageKey: 'logsPage.msg.genSbOkTitle',
          detailKey: 'logsPage.msg.detailShotCount',
          detailParams: { n: storyboards.length }
        },
        projectStore.currentProject?.id,
        projectStore.currentProject?.name
      )
      ElMessage.success(t('editorWorkshop.step1.msgGenSbDone', { n: storyboards.length }))

      const project = projectStore.currentProject
      if (project) {
        const assets = [
          ...step1Store.characters.map((a) => ({
            id: a.id,
            name: a.name,
            type: 'character' as const,
            description: a.description,
            image: a.imageUrl,
            status: a.status
          })),
          ...step1Store.scenes.map((a) => ({
            id: a.id,
            name: a.name,
            type: 'scene' as const,
            description: a.description,
            image: a.imageUrl,
            status: a.status
          })),
          ...step1Store.props.map((a) => ({
            id: a.id,
            name: a.name,
            type: 'prop' as const,
            description: a.description,
            image: a.imageUrl,
            status: a.status
          }))
        ]
        const storyboardData = storyboards.map((sb) => projectFileService.serializeStoryboardForSave(sb))
        await projectFileService.saveAllProjectData(project.id, project.name, assets, storyboardData)
      }

      const projectId = route.params.id as string
      router.push(`/editor/${projectId}/step2`)
    } else {
      logsStore.addLog(
        'generate-storyboard',
        'warning',
        {
          messageKey: 'logsPage.msg.genSbWarnTitle',
          detailKey: 'logsPage.msg.genSbWarnParse'
        },
        projectStore.currentProject?.id,
        projectStore.currentProject?.name
      )
      ElMessage.warning(t('editorWorkshop.step1.msgGenSbParseWarn'))
    }
  } catch (error) {
    console.error('分镜生成失败:', error)
    logsStore.addLog(
      'generate-storyboard',
      'error',
      {
        messageKey: 'logsPage.msg.genSbFailTitle',
        detailRaw: error instanceof Error ? error.message : t('logsPage.msg.unknownErr')
      },
      projectStore.currentProject?.id,
      projectStore.currentProject?.name
    )
    ElMessage.error(
      t('editorWorkshop.step1.msgGenSbFail', {
        msg: error instanceof Error ? error.message : t('logsPage.msg.unknownErr')
      })
    )
  } finally {
    step1Store.isGenerating = false
  }
}

function resolveAssetImageBasePrompt(type: 'character' | 'scene' | 'props'): string {
  const id =
    type === 'character'
      ? selectedCharacterImagePromptId.value
      : type === 'scene'
        ? selectedSceneImagePromptId.value
        : selectedPropsImagePromptId.value
  const content = promptsStore.getPromptContentById(id)
  if (content && content.trim()) return content
  const fb = type === 'character' ? '5' : type === 'scene' ? '6' : '7'
  return promptsStore.getPromptContentById(fb)
}

const handleGenerateAssetImage = async (type: 'character' | 'scene' | 'props', id: string, isBatchCall = false) => {
  const assetList = type === 'character' ? step1Store.characters : type === 'scene' ? step1Store.scenes : step1Store.props
  const asset = assetList.find(a => a.id === id)
  if (!asset) return
  
  const project = projectStore.currentProject
  if (!project) {
    ElMessage.warning(t('editorWorkshop.step1.msgSelectProject'))
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
  
  const logType = type === 'character' ? 'character-image' : type === 'scene' ? 'scene-image' : 'props-image'
  const startMsgKey =
    type === 'character'
      ? 'logsPage.msg.startGenCharacterImg'
      : type === 'scene'
        ? 'logsPage.msg.startGenSceneImg'
        : 'logsPage.msg.startGenPropImg'
  logsStore.addLog(
    logType,
    'info',
    {
      messageKey: startMsgKey,
      detailKey: 'logsPage.msg.detailAssetNamed',
      detailParams: { name: asset.name }
    },
    projectStore.currentProject?.id,
    projectStore.currentProject?.name
  )
  
  step1Store.updateAssetStatus(type, id, 'generating')
  try {
    const basePrompt = resolveAssetImageBasePrompt(type)

    const styleDescription = buildArtStylePromptPrefix(artStyleStore.artStyles, artStyleStore.selectedStyle)

    const aspectRatioMap: Record<string, { ratio: string; size: string }> = {
      '16:9': { ratio: '16:9', size: '3840x2160' },
      '16:9-1080': { ratio: '16:9', size: '1920x1080' },
      '4:3': { ratio: '4:3', size: '1920x1440' },
      '1:1': { ratio: '1:1', size: '1440x1440' },
      '9:16-v': { ratio: '9:16', size: '2160x3840' },
      '9:16-1080': { ratio: '9:16', size: '1080x1920' },
      '3:4': { ratio: '3:4', size: '1440x1920' }
    }
    const aspectInfo = aspectRatioMap[step1Store.aspectRatio] || aspectRatioMap['16:9']
    const aspectDescription = `${t('editorWorkshop.step1.promptAspect')}\n${aspectInfo.ratio} (${aspectInfo.size})\n\n`

    const imagePrompt = `${styleDescription}${aspectDescription}${basePrompt}

${t('editorWorkshop.step1.promptAssetBlock')}
${t('editorWorkshop.step1.assetNameLine')}${asset.name}
${t('editorWorkshop.step1.assetDescLine')}${asset.description}`

    const referenceImages = asset.referenceImageUrl ? [asset.referenceImageUrl] : undefined
    const imageUrl = await apiService.generateImage(imagePrompt, {
      model: selectedImageModel.value,
      referenceImages,
      modelGroup: imageModelGroup.value
    })

    if (imageUrl && imageUrl.startsWith('data:')) {
      const category = type === 'character' ? 'character' : type === 'scene' ? 'scene' : 'prop'
      const fileName = projectFileService.generateImageFileName(id)
      
      const saveResult = await projectFileService.saveImage(
        project.id,
        project.name,
        category,
        fileName,
        imageUrl
      )

      if (saveResult.success) {
        step1Store.updateAssetStatus(type, id, 'completed', imageUrl)
        storyboardStore.updateMatchedAssetImage(type, id, imageUrl)
        logsStore.addLog(
          logType,
          'success',
          {
            messageKey: 'logsPage.msg.detailAssetImgOkNamed',
            messageParams: { name: asset.name },
            detailKey: 'logsPage.msg.imgSavedLocally'
          },
          projectStore.currentProject?.id,
          projectStore.currentProject?.name
        )
        ElMessage.success(t('editorWorkshop.step1.msgImgOk', { name: asset.name }))
      } else {
        step1Store.updateAssetStatus(type, id, 'completed', imageUrl)
        storyboardStore.updateMatchedAssetImage(type, id, imageUrl)
        logsStore.addLog(
          logType,
          'success',
          {
            messageKey: 'logsPage.msg.detailAssetImgOkNamed',
            messageParams: { name: asset.name },
            detailKey: 'logsPage.msg.imgGenerated'
          },
          projectStore.currentProject?.id,
          projectStore.currentProject?.name
        )
        ElMessage.success(t('editorWorkshop.step1.msgImgOk', { name: asset.name }))
      }
    } else {
      step1Store.updateAssetStatus(type, id, 'completed', imageUrl)
      storyboardStore.updateMatchedAssetImage(type, id, imageUrl)
      logsStore.addLog(
        logType,
        'success',
        {
          messageKey: 'logsPage.msg.detailAssetImgOkNamed',
          messageParams: { name: asset.name },
          detailKey: 'logsPage.msg.imgGenerated'
        },
        projectStore.currentProject?.id,
        projectStore.currentProject?.name
      )
    ElMessage.success(t('editorWorkshop.step1.msgImgOk', { name: asset.name }))
    }
  } catch (error) {
    console.error('图片生成失败:', error)
    step1Store.updateAssetStatus(type, id, 'failed')
    logsStore.addLog(
      logType,
      'error',
      {
        messageKey: 'logsPage.msg.detailAssetImgFailNamed',
        messageParams: { name: asset.name },
        detailRaw: error instanceof Error ? error.message : t('logsPage.msg.unknownErr')
      },
      projectStore.currentProject?.id,
      projectStore.currentProject?.name
    )
    if (!isBatchCall) {
      step1Store.isGenerating = false
    }
    ElMessage.error(
      t('editorWorkshop.step1.msgImgFail', {
        name: asset.name,
        msg: error instanceof Error ? error.message : t('logsPage.msg.unknownErr')
      })
    )
  }
}

const getTargetCharacterIndices = (): number[] => {
  if (characterGenerateMode.value === 'all') {
    return step1Store.characters.map((_, index) => index)
  } else if (characterGenerateMode.value === 'ungenerated') {
    return step1Store.characters
      .map((c, index) => c.imageUrl ? -1 : index)
      .filter(index => index !== -1)
  } else {
    const rangeParts = characterCustomRangeInput.value.split(',').map(s => s.trim()).filter(Boolean)
    const indices: number[] = []
    for (const part of rangeParts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(s => parseInt(s.trim(), 10))
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start - 1; i < end; i++) {
            if (i >= 0 && i < step1Store.characters.length) {
              indices.push(i)
            }
          }
        }
      } else {
        const idx = parseInt(part, 10) - 1
        if (!isNaN(idx) && idx >= 0 && idx < step1Store.characters.length) {
          indices.push(idx)
        }
      }
    }
    return [...new Set(indices)].sort((a, b) => a - b)
  }
}

const handleBatchGenerateCharacter = async () => {
  const indices = getTargetCharacterIndices()
  if (indices.length === 0) {
    ElMessage.warning(t('editorWorkshop.step1.msgNoChars'))
    return
  }
  await handleBatchGenerate('character', 'all', indices)
}

const handleBatchGenerateScene = async () => {
  const indices = getTargetSceneIndices()
  if (indices.length === 0) {
    ElMessage.warning(t('editorWorkshop.step1.msgNoScenes'))
    return
  }
  await handleBatchGenerate('scene', 'all', indices)
}

const handleBatchGenerateProps = async () => {
  const indices = getTargetPropsIndices()
  if (indices.length === 0) {
    ElMessage.warning(t('editorWorkshop.step1.msgNoProps'))
    return
  }
  await handleBatchGenerate('props', 'all', indices)
}

const getTargetSceneIndices = (): number[] => {
  if (sceneGenerateMode.value === 'all') {
    return step1Store.scenes.map((_, index) => index)
  } else if (sceneGenerateMode.value === 'ungenerated') {
    return step1Store.scenes
      .map((s, index) => s.imageUrl ? -1 : index)
      .filter(index => index !== -1)
  } else {
    const rangeParts = sceneCustomRangeInput.value.split(',').map(s => s.trim()).filter(Boolean)
    const indices: number[] = []
    for (const part of rangeParts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(s => parseInt(s.trim(), 10))
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start - 1; i < end; i++) {
            if (i >= 0 && i < step1Store.scenes.length) {
              indices.push(i)
            }
          }
        }
      } else {
        const idx = parseInt(part, 10) - 1
        if (!isNaN(idx) && idx >= 0 && idx < step1Store.scenes.length) {
          indices.push(idx)
        }
      }
    }
    return [...new Set(indices)].sort((a, b) => a - b)
  }
}

const getTargetPropsIndices = (): number[] => {
  if (propsGenerateMode.value === 'all') {
    return step1Store.props.map((_, index) => index)
  } else if (propsGenerateMode.value === 'ungenerated') {
    return step1Store.props
      .map((p, index) => p.imageUrl ? -1 : index)
      .filter(index => index !== -1)
  } else {
    const rangeParts = propsCustomRangeInput.value.split(',').map(s => s.trim()).filter(Boolean)
    const indices: number[] = []
    for (const part of rangeParts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(s => parseInt(s.trim(), 10))
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start - 1; i < end; i++) {
            if (i >= 0 && i < step1Store.props.length) {
              indices.push(i)
            }
          }
        }
      } else {
        const idx = parseInt(part, 10) - 1
        if (!isNaN(idx) && idx >= 0 && idx < step1Store.props.length) {
          indices.push(idx)
        }
      }
    }
    return [...new Set(indices)].sort((a, b) => a - b)
  }
}

const handleBatchGenerate = async (type: 'character' | 'scene' | 'props', mode: string, indices?: number[]) => {
  const assetList = type === 'character' ? step1Store.characters : type === 'scene' ? step1Store.scenes : step1Store.props
  const typeName =
    type === 'character'
      ? t('editorWorkshop.assetPanel.typeChar')
      : type === 'scene'
        ? t('editorWorkshop.assetPanel.typeScene')
        : t('editorWorkshop.assetPanel.typeProp')
  
  if (!indices || indices.length === 0) {
    ElMessage.info(t('editorWorkshop.step1.msgNothingToBatch'))
    return
  }
  
  const batchLogType = type === 'character' ? 'batch-character-image' : type === 'scene' ? 'batch-scene-image' : 'batch-props-image'
  const batchMsgKey =
    type === 'character'
      ? 'logsPage.msg.batchStartCharacter'
      : type === 'scene'
        ? 'logsPage.msg.batchStartScene'
        : 'logsPage.msg.batchStartProp'
  logsStore.addLog(
    batchLogType,
    'info',
    {
      messageKey: batchMsgKey,
      detailKey: 'logsPage.msg.detailCountConc',
      detailParams: { count: indices.length, conc: apiConfigStore.imageConcurrency }
    },
    projectStore.currentProject?.id,
    projectStore.currentProject?.name
  )
  
  isBatchMode.value = true
  step1Store.isGenerating = true
  const concurrency = apiConfigStore.imageConcurrency
  ElMessage.info(t('editorWorkshop.step1.msgBatchStart', { count: indices.length, type: typeName, conc: concurrency }))
  
  const tasks = indices.map(i => assetList[i]).filter(asset => asset)
  
  const executeWithConcurrency = async () => {
    const executing: Promise<void>[] = []
    let successCount = 0
    let failCount = 0
    
    for (const asset of tasks) {
      const promise = handleGenerateAssetImage(type, asset.id, true).then(() => {
        successCount++
      }).catch(() => {
        failCount++
      })
      executing.push(promise)
      
      if (executing.length >= concurrency) {
        await Promise.race(executing)
        const completedIndex = executing.findIndex(p => 
          p !== Promise.race([p])
        )
        if (completedIndex >= 0) {
          executing.splice(completedIndex, 1)
        }
      }
    }
    
    await Promise.all(executing)
    return { successCount, failCount }
  }
  
  const { successCount, failCount } = await executeWithConcurrency()
  
  step1Store.isGenerating = false
  isBatchMode.value = false
  
  if (failCount === 0) {
    ElMessage.success(t('editorWorkshop.step1.msgBatchDone', { ok: successCount }))
  } else {
    ElMessage.warning(t('editorWorkshop.step1.msgBatchMixed', { ok: successCount, fail: failCount }))
  }
}

const handleGoToStep2 = () => {
  if (step1Store.generatedStoryboards.length > 0) {
    storyboardStore.setStoryboards(step1Store.generatedStoryboards)
  }
  const projectId = route.params.id as string
  router.push(`/editor/${projectId}/step2`)
}

const handleEditStoryboard = (id: string) => {
  const index = step1Store.generatedStoryboards.findIndex(s => s.id === id)
  if (index === -1) return
  
  storyboardStore.setStoryboards(step1Store.generatedStoryboards)
  storyboardStore.setCurrentIndex(index)
  const projectId = route.params.id as string
  router.push(`/editor/${projectId}/step2`)
}

const handleRegenerateStoryboard = async (id: string) => {
  const storyboard = step1Store.generatedStoryboards.find(s => s.id === id)
  if (!storyboard) return
  
  step1Store.updateStoryboardStatus(id, 'generating')
  try {
    await new Promise(resolve => setTimeout(resolve, 1500))
    step1Store.updateStoryboardStatus(id, 'completed')
    ElMessage.success(t('editorWorkshop.step1.regenSbOk'))
  } catch {
    step1Store.updateStoryboardStatus(id, 'failed')
    ElMessage.error(t('editorWorkshop.step1.regenSbFail'))
  }
}

onMounted(() => {
  const projectId = route.params.id as string
  localStorage.setItem(`project_last_step_${projectId}`, 'step1')
})
</script>

<template>
  <div class="step1-container">
    <ProjectHeader />
    <div class="step1-row">
      <div class="step1-col left-col">
        <DocumentUploadPanel
          v-model:extracted-content="extractedContent"
          v-model:chapters="chapters"
          :is-processing="isProcessing"
          @extract-chapters="handleExtractChapters"
          @update:final-content="finalContent = $event"
        />
      </div>

      <div class="step1-col middle-col">
        <AssetExtractionPanel
          v-model:active-tab="activeTab"
          :characters="characters"
          :scenes="scenes"
          :props-assets="props"
          :is-extracting="isExtracting"
          :is-generating="isGenerating"
          :selected-chapter-count="selectedChapterCount"
          :final-content="finalContent"
          @extract-assets="handleExtractAssets"
          @generate-asset-image="handleGenerateAssetImage"
          @batch-generate="handleBatchGenerate"
          @generate-storyboards="handleGenerateStoryboards"
        />
      </div>

      <div class="step1-col right-col">
        <div class="properties-panel">
          <div class="section-panel">
            <div class="section-title">
              <el-icon :size="16"><Document /></el-icon>
              <span>{{ t('editorWorkshop.step1.textModelSection') }}</span>
            </div>
            <div class="model-selector-row">
              <div class="model-group-selector">
                <span class="setting-label">{{ t('editorWorkshop.step1.modelGroupLbl') }}</span>
                <el-popover
                  v-model:visible="textModelGroupPopoverVisible"
                  placement="bottom-start"
                  :width="275"
                  trigger="click"
                  popper-class="step1-popover"
                >
                  <template #reference>
                    <button type="button" class="step1-prompt-chip">
                      <span class="step1-prompt-chip-name">{{ currentTextModelGroupLabel }}</span>
                    </button>
                  </template>
                  <div class="step1-prompt-panel">
                    <div class="step1-prompt-panel-label">选择模型分组</div>
                    <div class="step1-prompt-group">
                      <button
                        v-for="option in modelGroupOptions"
                        :key="option.value"
                        type="button"
                        class="step1-prompt-btn"
                        :class="{ active: textModelGroup === option.value }"
                        @click="textModelGroup = option.value; textModelGroupPopoverVisible = false"
                      >
                        <span class="step1-prompt-btn-icon" :class="option.value === 'youshang' ? 'icon-official' : 'icon-official'">
                          {{ option.value === 'youshang' ? '优' : '官' }}
                        </span>
                        <span class="step1-prompt-btn-text">{{ option.label }}</span>
                      </button>
                    </div>
                  </div>
                </el-popover>
              </div>
            </div>
            <div class="model-selector-row">
              <div class="model-select-wrapper">
                <span class="setting-label">{{ t('editorWorkshop.step1.modelPickLbl') }}</span>
                <el-popover
                  v-model:visible="textModelPopoverVisible"
                  placement="bottom-start"
                  :width="275"
                  trigger="click"
                  popper-class="step1-popover"
                >
                  <template #reference>
                    <button type="button" class="step1-prompt-chip" :disabled="textModelOptions.length === 0">
                      <span class="step1-prompt-chip-name">{{ currentTextModel?.name || '请选择模型' }}</span>
                      <span v-if="currentTextModel?.price" class="step1-prompt-chip-group">{{ currentTextModel.price }}</span>
                    </button>
                  </template>
                  <div class="step1-prompt-panel">
                    <div class="step1-prompt-panel-label">选择文本模型</div>
                    <div class="step1-prompt-group">
                      <button
                        v-for="model in textModelOptions"
                        :key="model.id"
                        type="button"
                        class="step1-prompt-btn"
                        :class="{ active: selectedTextModel === model.id }"
                        @click="selectedTextModel = model.id; textModelPopoverVisible = false"
                      >
                        <span class="step1-prompt-btn-icon" :class="`platform-${model.badge.key}`">
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
                            <path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"></path>
                          </svg>
                          
                          <svg v-else-if="model.badge.key === 'banana'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;" aria-hidden="true"><path d="M1.5 19.824c0-.548.444-.992.991-.992h.744a.991.991 0 010 1.983H2.49a.991.991 0 01-.991-.991z" fill="#F3AD61"></path><path d="M14.837 13.5h7.076c.522 0 .784-.657.413-1.044l-1.634-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044zM3.587 13.5h7.076c.521 0 .784-.659.414-1.044l-1.635-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044z" fill="#F9C23C"></path><path d="M12.525 1.521c3.69-.53 5.97 8.923 4.309 12.744-1.662 3.82-5.248 4.657-9.053 6.152a3.49 3.49 0 01-1.279.244c-1.443 0-2.227 1.187-2.774-.282-.707-1.9.22-4.031 2.069-4.757 2.014-.79 3.084-2.308 3.89-4.364.82-2.096.877-2.956.873-5.241-.003-1.827-.123-4.195 1.965-4.496z" fill="#FEEFC2"></path><path d="M16.834 14.264l-7.095-3.257c-.815 1.873-2.29 3.308-4.156 4.043-2.16.848-3.605 3.171-2.422 5.54 2.364 4.727 13.673-.05 13.673-6.325z" fill="#FCD53F"></path><path d="M13.68 12.362c.296.094.46.41.365.707-1.486 4.65-5.818 6.798-9.689 6.997a.562.562 0 11-.057-1.124c3.553-.182 7.372-2.138 8.674-6.216a.562.562 0 01.707-.364z" fill="#F9C23C"></path><path d="M17.43 19.85l-7.648-8.835h6.753c1.595.08 2.846 1.433 2.846 3.073v5.664c0 .997-.898 1.302-1.95.098z" fill="#FFF478"></path></svg>
                          <svg v-else-if="model.badge.key === 'gemini'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;">
                            <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF"></path>
                          </svg>
                          <svg v-else-if="model.badge.key === 'deepseek'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;">
                            <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.005-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.003-.17.034-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE"/>
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
                <span class="setting-label">资产提取模板</span>
                <el-popover
                  v-model:visible="extractAssetPromptPopoverVisible"
                  placement="bottom-start"
                  :width="275"
                  trigger="click"
                  popper-class="step1-popover"
                >
                  <template #reference>
                    <button type="button" class="step1-prompt-chip">
                      <span class="step1-prompt-chip-name">{{ currentExtractAssetPrompt?.title || t('editorWorkshop.step1.pickTplPlaceholder') }}</span>
                      <span class="step1-prompt-chip-group">{{ currentExtractAssetPrompt?.isCustom ? t('promptsPage.badgeCustom') : t('promptsPage.badgeOfficial') }}</span>
                    </button>
                  </template>
                  <div class="step1-prompt-panel">
                    <div class="step1-prompt-panel-label">选择资产提取模板</div>
                    <div class="step1-prompt-group">
                      <button
                        v-for="prompt in extractAssetPrompts"
                        :key="prompt.id"
                        type="button"
                        class="step1-prompt-btn"
                        :class="{ active: selectedExtractAssetPromptId === prompt.id }"
                        @click="selectedExtractAssetPromptId = prompt.id; extractAssetPromptPopoverVisible = false"
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
            <div class="model-selector-row">
              <div class="model-select-wrapper">
                <span class="setting-label">生成分镜模板</span>
                <el-popover
                  v-model:visible="generateStoryboardPromptPopoverVisible"
                  placement="bottom-start"
                  :width="275"
                  trigger="click"
                  popper-class="step1-popover"
                >
                  <template #reference>
                    <button type="button" class="step1-prompt-chip">
                      <span class="step1-prompt-chip-name">{{ currentGenerateStoryboardPrompt?.title || t('editorWorkshop.step1.pickTplPlaceholder') }}</span>
                      <span class="step1-prompt-chip-group">{{ currentGenerateStoryboardPrompt?.isCustom ? t('promptsPage.badgeCustom') : t('promptsPage.badgeOfficial') }}</span>
                    </button>
                  </template>
                  <div class="step1-prompt-panel">
                    <div class="step1-prompt-panel-label">选择生成分镜模板</div>
                    <div class="step1-prompt-group">
                      <button
                        v-for="prompt in generateStoryboardPrompts"
                        :key="prompt.id"
                        type="button"
                        class="step1-prompt-btn"
                        :class="{ active: selectedGenerateStoryboardPromptId === prompt.id }"
                        @click="selectedGenerateStoryboardPromptId = prompt.id; generateStoryboardPromptPopoverVisible = false"
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
              <span>{{ t('editorWorkshop.step1.imageModelSection') }}</span>
            </div>
            <div class="model-selector-row">
              <div class="model-group-selector">
                <span class="setting-label">{{ t('editorWorkshop.step1.modelGroupLbl') }}</span>
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
                        v-for="option in modelGroupOptions"
                        :key="option.value"
                        type="button"
                        class="step1-prompt-btn"
                        :class="{ active: imageModelGroup === option.value }"
                        @click="imageModelGroup = option.value; imageModelGroupPopoverVisible = false"
                      >
                        <span class="step1-prompt-btn-icon icon-official">
                          {{ option.value === 'youshang' ? '优' : '官' }}
                        </span>
                        <span class="step1-prompt-btn-text">{{ option.label }}</span>
                      </button>
                    </div>
                  </div>
                </el-popover>
              </div>
            </div>
            <div class="model-selector-row">
              <div class="model-select-wrapper">
                <span class="setting-label">{{ t('editorWorkshop.step1.modelPickLbl') }}</span>
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
                          <svg v-else-if="model.badge.key === 'jimeng'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;">
                            <path d="M5.31 15.756c.172-3.75 1.883-5.999 2.549-6.739-3.26 2.058-5.425 5.658-6.358 8.308v1.12C1.501 21.513 4.226 24 7.59 24a6.59 6.59 0 002.2-.375c.353-.12.7-.248 1.039-.378.913-.899 1.65-1.91 2.243-2.992-4.877 2.431-7.974.072-7.763-4.5l.002.001z" fill="#1E37FC"/>
                            <path d="M22.57 10.283c-1.212-.901-4.109-2.404-7.397-2.8.295 3.792.093 8.766-2.1 12.773a12.782 12.782 0 01-2.244 2.992c3.764-1.448 6.746-3.457 8.596-5.219 2.82-2.683 3.353-5.178 3.361-6.66a2.737 2.737 0 00-.216-1.084v-.002z" fill="#37E1BE"/>
                            <path d="M14.303 1.867C12.955.7 11.248 0 9.39 0 7.532 0 5.883.677 4.545 1.807 2.791 3.29 1.627 5.557 1.5 8.125v9.201c.932-2.65 3.097-6.25 6.357-8.307.5-.318 1.025-.595 1.569-.829 1.883-.801 3.878-.932 5.746-.706-.222-2.83-.718-5.002-.87-5.617h.001z" fill="#A569FF"/>
                            <path d="M17.305 4.961a199.47 199.47 0 01-1.08-1.094c-.202-.213-.398-.419-.586-.622l-1.333-1.378c.151.615.648 2.786.869 5.617 3.288.395 6.185 1.898 7.396 2.8-1.306-1.275-3.475-3.487-5.266-5.323z" fill="#1E37FC"/>
                          </svg>
                          <svg v-else-if="model.badge.key === 'gpt'" fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                            <title>OpenAI</title>
                            <path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"></path>
                          </svg>
                          
                          <svg v-else-if="model.badge.key === 'banana'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;" aria-hidden="true"><path d="M1.5 19.824c0-.548.444-.992.991-.992h.744a.991.991 0 010 1.983H2.49a.991.991 0 01-.991-.991z" fill="#F3AD61"></path><path d="M14.837 13.5h7.076c.522 0 .784-.657.413-1.044l-1.634-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044zM3.587 13.5h7.076c.521 0 .784-.659.414-1.044l-1.635-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044z" fill="#F9C23C"></path><path d="M12.525 1.521c3.69-.53 5.97 8.923 4.309 12.744-1.662 3.82-5.248 4.657-9.053 6.152a3.49 3.49 0 01-1.279.244c-1.443 0-2.227 1.187-2.774-.282-.707-1.9.22-4.031 2.069-4.757 2.014-.79 3.084-2.308 3.89-4.364.82-2.096.877-2.956.873-5.241-.003-1.827-.123-4.195 1.965-4.496z" fill="#FEEFC2"></path><path d="M16.834 14.264l-7.095-3.257c-.815 1.873-2.29 3.308-4.156 4.043-2.16.848-3.605 3.171-2.422 5.54 2.364 4.727 13.673-.05 13.673-6.325z" fill="#FCD53F"></path><path d="M13.68 12.362c.296.094.46.41.365.707-1.486 4.65-5.818 6.798-9.689 6.997a.562.562 0 11-.057-1.124c3.553-.182 7.372-2.138 8.674-6.216a.562.562 0 01.707-.364z" fill="#F9C23C"></path><path d="M17.43 19.85l-7.648-8.835h6.753c1.595.08 2.846 1.433 2.846 3.073v5.664c0 .997-.898 1.302-1.95.098z" fill="#FFF478"></path></svg>
                          <svg v-else-if="model.badge.key === 'gemini'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;">
                            <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF"></path>
                          </svg>
                          <svg v-else-if="model.badge.key === 'deepseek'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;">
                            <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.005-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.003-.17.034-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE"/>
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
                <span class="setting-label">{{ t('editorWorkshop.step1.tplGenCharacter') }}</span>
                <el-popover
                  v-model:visible="characterImagePromptPopoverVisible"
                  placement="bottom-start"
                  :width="275"
                  trigger="click"
                  popper-class="step1-popover"
                >
                  <template #reference>
                    <button type="button" class="step1-prompt-chip">
                      <span class="step1-prompt-chip-name">{{ currentCharacterImagePrompt?.title || t('editorWorkshop.step1.pickTplPlaceholder') }}</span>
                      <span class="step1-prompt-chip-group">{{ currentCharacterImagePrompt?.isCustom ? t('promptsPage.badgeCustom') : t('promptsPage.badgeOfficial') }}</span>
                    </button>
                  </template>
                  <div class="step1-prompt-panel">
                    <div class="step1-prompt-panel-label">{{ t('editorWorkshop.step1.pickTplGenCharacter') }}</div>
                    <div class="step1-prompt-group">
                      <button
                        v-for="prompt in generateCharacterPrompts"
                        :key="prompt.id"
                        type="button"
                        class="step1-prompt-btn"
                        :class="{ active: selectedCharacterImagePromptId === prompt.id }"
                        @click="selectedCharacterImagePromptId = prompt.id; characterImagePromptPopoverVisible = false"
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
            <div class="model-selector-row">
              <div class="model-select-wrapper">
                <span class="setting-label">{{ t('editorWorkshop.step1.tplGenScene') }}</span>
                <el-popover
                  v-model:visible="sceneImagePromptPopoverVisible"
                  placement="bottom-start"
                  :width="275"
                  trigger="click"
                  popper-class="step1-popover"
                >
                  <template #reference>
                    <button type="button" class="step1-prompt-chip">
                      <span class="step1-prompt-chip-name">{{ currentSceneImagePrompt?.title || t('editorWorkshop.step1.pickTplPlaceholder') }}</span>
                      <span class="step1-prompt-chip-group">{{ currentSceneImagePrompt?.isCustom ? t('promptsPage.badgeCustom') : t('promptsPage.badgeOfficial') }}</span>
                    </button>
                  </template>
                  <div class="step1-prompt-panel">
                    <div class="step1-prompt-panel-label">{{ t('editorWorkshop.step1.pickTplGenScene') }}</div>
                    <div class="step1-prompt-group">
                      <button
                        v-for="prompt in generateScenePrompts"
                        :key="prompt.id"
                        type="button"
                        class="step1-prompt-btn"
                        :class="{ active: selectedSceneImagePromptId === prompt.id }"
                        @click="selectedSceneImagePromptId = prompt.id; sceneImagePromptPopoverVisible = false"
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
            <div class="model-selector-row">
              <div class="model-select-wrapper">
                <span class="setting-label">{{ t('editorWorkshop.step1.tplGenProps') }}</span>
                <el-popover
                  v-model:visible="propsImagePromptPopoverVisible"
                  placement="bottom-start"
                  :width="275"
                  trigger="click"
                  popper-class="step1-popover"
                >
                  <template #reference>
                    <button type="button" class="step1-prompt-chip">
                      <span class="step1-prompt-chip-name">{{ currentPropsImagePrompt?.title || t('editorWorkshop.step1.pickTplPlaceholder') }}</span>
                      <span class="step1-prompt-chip-group">{{ currentPropsImagePrompt?.isCustom ? t('promptsPage.badgeCustom') : t('promptsPage.badgeOfficial') }}</span>
                    </button>
                  </template>
                  <div class="step1-prompt-panel">
                    <div class="step1-prompt-panel-label">{{ t('editorWorkshop.step1.pickTplGenProps') }}</div>
                    <div class="step1-prompt-group">
                      <button
                        v-for="prompt in generatePropsPrompts"
                        :key="prompt.id"
                        type="button"
                        class="step1-prompt-btn"
                        :class="{ active: selectedPropsImagePromptId === prompt.id }"
                        @click="selectedPropsImagePromptId = prompt.id; propsImagePromptPopoverVisible = false"
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
          <div
            v-if="activeTab === 'character'"
            class="batch-match-content"
          >
            <div class="section-title">
              <el-icon :size="16"><User /></el-icon>
              <span>{{ t('editorWorkshop.step1.charGenSection') }}</span>
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
              <span class="setting-label">{{ t('editorWorkshop.step1.aspectRatioLbl') }}</span>
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
                      :class="{ active: step1Store.aspectRatio === ratio.value }"
                      @click="step1Store.aspectRatio = ratio.value; aspectRatioPopoverVisible = false"
                    >
                      <span class="step1-prompt-btn-text">{{ ratio.label }}</span>
                    </button>
                  </div>
                </div>
              </el-popover>
            </div>
            <div class="batch-match-inline">
              <div class="batch-match-info">
                {{
                  t('editorWorkshop.step1.batchInfoChars', {
                    n: step1Store.characters.length,
                    g: step1Store.characters.filter((c) => c.imageUrl).length
                  })
                }}
              </div>
              <div class="mode-options-inline">
                <div
                  :class="['mode-option-inline', { active: characterGenerateMode === 'all' }]"
                  @click="characterGenerateMode = 'all'"
                >
                  <div class="option-icon all-icon">
                    <el-icon :size="20">
                      <VideoPlay />
                    </el-icon>
                  </div>
                  <div class="option-content">
                    <div class="option-title">{{ t('editorWorkshop.step1.modeAllTitle') }}</div>
                    <div class="option-desc">{{ t('editorWorkshop.step1.modeAllDescChars') }}</div>
                  </div>
                  <div
                    v-if="characterGenerateMode === 'all'"
                    class="option-check"
                  >
                    <el-icon><CircleCheck /></el-icon>
                  </div>
                </div>
                <div
                  :class="['mode-option-inline', { active: characterGenerateMode === 'ungenerated' }]"
                  @click="characterGenerateMode = 'ungenerated'"
                >
                  <div class="option-icon ungenerated-icon">
                    <el-icon :size="20">
                      <Loading />
                    </el-icon>
                  </div>
                  <div class="option-content">
                    <div class="option-title">{{ t('editorWorkshop.step1.modeGapTitle') }}</div>
                    <div class="option-desc">{{ t('editorWorkshop.step1.modeGapDescChars') }}</div>
                  </div>
                  <div
                    v-if="characterGenerateMode === 'ungenerated'"
                    class="option-check"
                  >
                    <el-icon><CircleCheck /></el-icon>
                  </div>
                </div>
                <div
                  :class="['mode-option-inline', { active: characterGenerateMode === 'custom' }]"
                  @click="characterGenerateMode = 'custom'"
                >
                  <div class="option-icon custom-icon">
                    <el-icon :size="20">
                      <Plus />
                    </el-icon>
                  </div>
                  <div class="option-content">
                    <div class="option-title">{{ t('editorWorkshop.step1.modeCustomTitle') }}</div>
                    <div class="option-desc">{{ t('editorWorkshop.step1.modeCustomDescChars') }}</div>
                  </div>
                  <div
                    v-if="characterGenerateMode === 'custom'"
                    class="option-check"
                  >
                    <el-icon><CircleCheck /></el-icon>
                  </div>
                </div>
              </div>
              <div
                v-if="characterGenerateMode === 'custom'"
                class="custom-range-input"
              >
                <el-input
                  v-model="characterCustomRangeInput"
                  :placeholder="t('editorWorkshop.step1.phCharIdx')"
                  size="small"
                  clearable
                />
                <div class="input-hint">{{ t('editorWorkshop.step1.rangeFmtHint') }}</div>
              </div>
            </div>
            <el-button
              type="primary"
              class="start-match-btn"
              size="small"
              :disabled="step1Store.characters.length === 0"
              :loading="isGenerating"
              @click="handleBatchGenerateCharacter"
            >
              <el-icon><Picture /></el-icon>
              <span>{{ t('editorWorkshop.step1.btnBatchChars') }}</span>
            </el-button>
          </div>
          <div
            v-else-if="activeTab === 'scene'"
            class="batch-match-content"
          >
            <div class="section-title">
              <el-icon :size="16"><Location /></el-icon>
              <span>{{ t('editorWorkshop.step1.sceneGenSection') }}</span>
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
              <span class="setting-label">{{ t('editorWorkshop.step1.aspectRatioLbl') }}</span>
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
                      :class="{ active: step1Store.aspectRatio === ratio.value }"
                      @click="step1Store.aspectRatio = ratio.value; aspectRatioPopoverVisible = false"
                    >
                      <span class="step1-prompt-btn-text">{{ ratio.label }}</span>
                    </button>
                  </div>
                </div>
              </el-popover>
            </div>
            <div class="batch-match-inline">
              <div class="batch-match-info">
                {{
                  t('editorWorkshop.step1.batchInfoScenes', {
                    n: step1Store.scenes.length,
                    g: step1Store.scenes.filter((s) => s.imageUrl).length
                  })
                }}
              </div>
              <div class="mode-options-inline">
                <div
                  :class="['mode-option-inline', { active: sceneGenerateMode === 'all' }]"
                  @click="sceneGenerateMode = 'all'"
                >
                  <div class="option-icon all-icon">
                    <el-icon :size="20">
                      <VideoPlay />
                    </el-icon>
                  </div>
                  <div class="option-content">
                    <div class="option-title">{{ t('editorWorkshop.step1.modeAllTitle') }}</div>
                    <div class="option-desc">{{ t('editorWorkshop.step1.modeAllDescScenes') }}</div>
                  </div>
                  <div
                    v-if="sceneGenerateMode === 'all'"
                    class="option-check"
                  >
                    <el-icon><CircleCheck /></el-icon>
                  </div>
                </div>
                <div
                  :class="['mode-option-inline', { active: sceneGenerateMode === 'ungenerated' }]"
                  @click="sceneGenerateMode = 'ungenerated'"
                >
                  <div class="option-icon ungenerated-icon">
                    <el-icon :size="20">
                      <Loading />
                    </el-icon>
                  </div>
                  <div class="option-content">
                    <div class="option-title">{{ t('editorWorkshop.step1.modeGapTitle') }}</div>
                    <div class="option-desc">{{ t('editorWorkshop.step1.modeGapDescScenes') }}</div>
                  </div>
                  <div
                    v-if="sceneGenerateMode === 'ungenerated'"
                    class="option-check"
                  >
                    <el-icon><CircleCheck /></el-icon>
                  </div>
                </div>
                <div
                  :class="['mode-option-inline', { active: sceneGenerateMode === 'custom' }]"
                  @click="sceneGenerateMode = 'custom'"
                >
                  <div class="option-icon custom-icon">
                    <el-icon :size="20">
                      <Plus />
                    </el-icon>
                  </div>
                  <div class="option-content">
                    <div class="option-title">{{ t('editorWorkshop.step1.modeCustomTitle') }}</div>
                    <div class="option-desc">{{ t('editorWorkshop.step1.modeCustomDescScenes') }}</div>
                  </div>
                  <div
                    v-if="sceneGenerateMode === 'custom'"
                    class="option-check"
                  >
                    <el-icon><CircleCheck /></el-icon>
                  </div>
                </div>
              </div>
              <div
                v-if="sceneGenerateMode === 'custom'"
                class="custom-range-input"
              >
                <el-input
                  v-model="sceneCustomRangeInput"
                  :placeholder="t('editorWorkshop.step1.phSceneIdx')"
                  size="small"
                  clearable
                />
                <div class="input-hint">{{ t('editorWorkshop.step1.rangeFmtHint') }}</div>
              </div>
            </div>
            <el-button
              type="primary"
              class="start-match-btn"
              size="small"
              :disabled="step1Store.scenes.length === 0"
              :loading="isGenerating"
              @click="handleBatchGenerateScene"
            >
              <el-icon><Picture /></el-icon>
              <span>{{ t('editorWorkshop.step1.btnBatchScenes') }}</span>
            </el-button>
          </div>
          <div
            v-else
            class="batch-match-content"
          >
            <div class="section-title">
              <el-icon :size="16"><Box /></el-icon>
              <span>{{ t('editorWorkshop.step1.propsGenSection') }}</span>
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
              <span class="setting-label">{{ t('editorWorkshop.step1.aspectRatioLbl') }}</span>
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
                      :class="{ active: step1Store.aspectRatio === ratio.value }"
                      @click="step1Store.aspectRatio = ratio.value; aspectRatioPopoverVisible = false"
                    >
                      <span class="step1-prompt-btn-text">{{ ratio.label }}</span>
                    </button>
                  </div>
                </div>
              </el-popover>
            </div>
            <div class="batch-match-inline">
              <div class="batch-match-info">
                {{
                  t('editorWorkshop.step1.batchInfoProps', {
                    n: step1Store.props.length,
                    g: step1Store.props.filter((p) => p.imageUrl).length
                  })
                }}
              </div>
              <div class="mode-options-inline">
                <div
                  :class="['mode-option-inline', { active: propsGenerateMode === 'all' }]"
                  @click="propsGenerateMode = 'all'"
                >
                  <div class="option-icon all-icon">
                    <el-icon :size="20">
                      <VideoPlay />
                    </el-icon>
                  </div>
                  <div class="option-content">
                    <div class="option-title">{{ t('editorWorkshop.step1.modeAllTitle') }}</div>
                    <div class="option-desc">{{ t('editorWorkshop.step1.modeAllDescProps') }}</div>
                  </div>
                  <div
                    v-if="propsGenerateMode === 'all'"
                    class="option-check"
                  >
                    <el-icon><CircleCheck /></el-icon>
                  </div>
                </div>
                <div
                  :class="['mode-option-inline', { active: propsGenerateMode === 'ungenerated' }]"
                  @click="propsGenerateMode = 'ungenerated'"
                >
                  <div class="option-icon ungenerated-icon">
                    <el-icon :size="20">
                      <Loading />
                    </el-icon>
                  </div>
                  <div class="option-content">
                    <div class="option-title">{{ t('editorWorkshop.step1.modeGapTitle') }}</div>
                    <div class="option-desc">{{ t('editorWorkshop.step1.modeGapDescProps') }}</div>
                  </div>
                  <div
                    v-if="propsGenerateMode === 'ungenerated'"
                    class="option-check"
                  >
                    <el-icon><CircleCheck /></el-icon>
                  </div>
                </div>
                <div
                  :class="['mode-option-inline', { active: propsGenerateMode === 'custom' }]"
                  @click="propsGenerateMode = 'custom'"
                >
                  <div class="option-icon custom-icon">
                    <el-icon :size="20">
                      <Plus />
                    </el-icon>
                  </div>
                  <div class="option-content">
                    <div class="option-title">{{ t('editorWorkshop.step1.modeCustomTitle') }}</div>
                    <div class="option-desc">{{ t('editorWorkshop.step1.modeCustomDescProps') }}</div>
                  </div>
                  <div
                    v-if="propsGenerateMode === 'custom'"
                    class="option-check"
                  >
                    <el-icon><CircleCheck /></el-icon>
                  </div>
                </div>
              </div>
              <div
                v-if="propsGenerateMode === 'custom'"
                class="custom-range-input"
              >
                <el-input
                  v-model="propsCustomRangeInput"
                  :placeholder="t('editorWorkshop.step1.phPropIdx')"
                  size="small"
                  clearable
                />
                <div class="input-hint">{{ t('editorWorkshop.step1.rangeFmtHint') }}</div>
              </div>
            </div>
            <el-button
              type="primary"
              class="start-match-btn"
              size="small"
              :disabled="step1Store.props.length === 0"
              :loading="isGenerating"
              @click="handleBatchGenerateProps"
            >
              <el-icon><Picture /></el-icon>
              <span>{{ t('editorWorkshop.step1.btnBatchProps') }}</span>
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.step1-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.step1-row {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  min-height: 0;
}

.step1-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.left-col {
  flex: 3;
  min-width: 300px;
}

.middle-col {
  flex: 6;
  min-width: 400px;
}

.right-col {
  flex: 3;
  min-width: 280px;
}

.properties-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  padding: 10px;
  gap: 10px;
}

/* 文档解析右侧功能区：标签列固定 100px，避免中英文切换时下拉错位 */
.properties-panel .setting-label {
  flex: 0 0 100px;
  width: 100px;
  min-width: 100px;
  max-width: 100px;
  box-sizing: border-box;
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
  padding-right: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 10px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
}

.batch-match-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.batch-match-inline {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.batch-match-info {
  font-size: 12px;
  color: var(--text-muted);
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
  flex-shrink: 0;
  font-size: 20px;
}

.option-icon.all-icon {
  color: var(--primary-color);
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

.option-content {
  flex: 1;
  min-width: 0;
}

.option-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.option-desc {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.option-check {
  margin-left: auto;
  color: var(--primary-color);
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

.style-selector-row .style-select :deep(.el-select__wrapper) {
  min-height: 32px;
  font-size: 12px;
  background-color: black !important;
  box-shadow: 0 0 0 1px #3b3b3b inset !important;
  color: var(--text-primary);
  line-height: 32px;
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

.model-select :deep(.el-select__wrapper .el-input__inner),
.model-select :deep(.el-input__wrapper .el-input__inner) {
  color: var(--text-primary);
  line-height: 32px;
}

.model-select :deep(.el-select-dropdown) {
  position: absolute !important;
  top: 100% !important;
  left: 0 !important;
  transform: none !important;
  margin-top: 4px;
  background-color: #1a1a1a !important;
  border: 1px solid #3b3b3b !important;
  border-radius: 4px !important;
}

.model-select :deep(.el-option) {
  background-color: transparent !important;
  color: var(--text-primary) !important;
  font-size: 12px !important;
  padding: 8px 12px !important;
}

.model-select :deep(.el-option:hover) {
  background-color: rgba(102, 126, 234, 0.15) !important;
}

.model-select :deep(.el-option.is-selected) {
  background-color: rgba(102, 126, 234, 0.15) !important;
  color: var(--primary-color) !important;
}

.model-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 8px;
}

.model-option .model-name {
  flex: 1;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.model-name {
  font-size: 12px;
}

.model-price {
  font-size: 11px;
  color: var(--text-muted);
}

.style-option {
  display: flex;
  align-items: center;
  gap: 6px;
}

.start-match-btn {
  margin-top: 6px;
  width: 100%;
  height: 40px;
  border-radius: 8px;
  font-size: 14px;
}

.custom-range-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-hint {
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.5;
}

.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 500;
  flex-shrink: 0;
  border: none;
}

.official-tag {
  background-color: rgba(102, 126, 234, 0.15);
  color: var(--primary-color);
}

.custom-tag {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

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

.step1-popover .step1-prompt-btn {
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
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
