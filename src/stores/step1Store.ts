import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Storyboard } from '@/types'

export interface Chapter {
  id: string
  title: string
  content: string
  selected: boolean
}

export interface HistoryImage {
  id: string
  url: string
  createdAt: Date
}

export interface Asset {
  id: string
  name: string
  description: string
  imageUrl?: string
  referenceImageUrl?: string
  status: 'pending' | 'generating' | 'completed' | 'failed'
  historyImages?: HistoryImage[]
}

export const useStep1Store = defineStore(
  'step1',
  () => {
    const extractedContent = ref('')
    const chapters = ref<Chapter[]>([])
    const characters = ref<Asset[]>([])
    const scenes = ref<Asset[]>([])
    const props = ref<Asset[]>([])
    const generatedStoryboards = ref<Storyboard[]>([])
    const selectedStoryboardIds = ref<string[]>([])

    const isProcessing = ref(false)
    const isExtracting = ref(false)
    const isGenerating = ref(false)

    const aspectRatio = ref('16:9-1080')

    function setExtractedContent(content: string) {
      extractedContent.value = content
    }

    function setChapters(list: Chapter[]) {
      chapters.value = list
    }

    function updateChapterSelection(id: string, selected: boolean) {
      const chapter = chapters.value.find(c => c.id === id)
      if (chapter) {
        chapter.selected = selected
      }
    }

    function toggleChapterSelection(id: string) {
      const chapter = chapters.value.find(c => c.id === id)
      if (chapter) {
        chapter.selected = !chapter.selected
      }
    }

    function setCharacters(list: Asset[]) {
      characters.value = list
    }

    function addCharacter(asset: Asset) {
      characters.value.push(asset)
    }

    function setScenes(list: Asset[]) {
      scenes.value = list
    }

    function addScene(asset: Asset) {
      scenes.value.push(asset)
    }

    function setProps(list: Asset[]) {
      props.value = list
    }

    function addProp(asset: Asset) {
      props.value.push(asset)
    }

    function updateAssetStatus(
      type: 'character' | 'scene' | 'props',
      id: string,
      status: Asset['status'],
      imageUrl?: string
    ) {
      const list = type === 'character' ? characters : type === 'scene' ? scenes : props
      const asset = list.value.find(a => a.id === id)
      if (asset) {
        asset.status = status
        if (imageUrl) {
          if (!asset.historyImages) {
            asset.historyImages = []
          }
          const existsInHistory = asset.historyImages.some(img => img.url === imageUrl)
          if (!existsInHistory) {
            asset.historyImages.unshift({
              id: `img_${Date.now()}`,
              url: imageUrl,
              createdAt: new Date()
            })
          }
          asset.imageUrl = imageUrl
        }
      }
    }

    function updateAssetInfo(
      type: 'character' | 'scene' | 'props',
      id: string,
      updates: { name?: string; description?: string }
    ) {
      const list = type === 'character' ? characters : type === 'scene' ? scenes : props
      const asset = list.value.find(a => a.id === id)
      if (asset) {
        if (updates.name !== undefined) {
          asset.name = updates.name
        }
        if (updates.description !== undefined) {
          asset.description = updates.description
        }
      }
    }

    function setAssetMainImage(
      type: 'character' | 'scene' | 'props',
      id: string,
      imageUrl: string
    ) {
      const list = type === 'character' ? characters : type === 'scene' ? scenes : props
      const asset = list.value.find(a => a.id === id)
      if (asset) {
        asset.imageUrl = imageUrl
        asset.status = 'completed'
      }
    }

    function setAssetReferenceImage(
      type: 'character' | 'scene' | 'props',
      id: string,
      imageUrl: string
    ) {
      const list = type === 'character' ? characters : type === 'scene' ? scenes : props
      const asset = list.value.find(a => a.id === id)
      if (asset) {
        asset.referenceImageUrl = imageUrl
      }
    }

    function setGeneratedStoryboards(list: Storyboard[]) {
      generatedStoryboards.value = list
    }

    function addGeneratedStoryboard(storyboard: Storyboard) {
      generatedStoryboards.value.push(storyboard)
    }

    function updateStoryboardStatus(id: string, status: Storyboard['status']) {
      const storyboard = generatedStoryboards.value.find(s => s.id === id)
      if (storyboard) {
        storyboard.status = status
      }
    }

    function setSelectedStoryboardIds(ids: string[]) {
      selectedStoryboardIds.value = ids
    }

    function toggleStoryboardSelection(id: string) {
      const index = selectedStoryboardIds.value.indexOf(id)
      if (index > -1) {
        selectedStoryboardIds.value.splice(index, 1)
      } else {
        selectedStoryboardIds.value.push(id)
      }
    }

    function selectAllStoryboards() {
      selectedStoryboardIds.value = generatedStoryboards.value.map(s => s.id)
    }

    function clearStoryboardSelection() {
      selectedStoryboardIds.value = []
    }

    function clearAll() {
      extractedContent.value = ''
      chapters.value = []
      characters.value = []
      scenes.value = []
      props.value = []
      generatedStoryboards.value = []
      selectedStoryboardIds.value = []
      isProcessing.value = false
      isExtracting.value = false
      isGenerating.value = false
    }

    function clearAssetsOnly() {
      chapters.value = []
      characters.value = []
      scenes.value = []
      props.value = []
      generatedStoryboards.value = []
      selectedStoryboardIds.value = []
      isProcessing.value = false
      isExtracting.value = false
      isGenerating.value = false
    }

    return {
      extractedContent,
      chapters,
      characters,
      scenes,
      props,
      generatedStoryboards,
      selectedStoryboardIds,
      isProcessing,
      isExtracting,
      isGenerating,
      aspectRatio,
      setExtractedContent,
      setChapters,
      updateChapterSelection,
      toggleChapterSelection,
      setCharacters,
      addCharacter,
      setScenes,
      addScene,
      setProps,
      addProp,
      updateAssetStatus,
      updateAssetInfo,
      setAssetMainImage,
      setAssetReferenceImage,
      setGeneratedStoryboards,
      addGeneratedStoryboard,
      updateStoryboardStatus,
      setSelectedStoryboardIds,
      toggleStoryboardSelection,
      selectAllStoryboards,
      clearStoryboardSelection,
      clearAll,
      clearAssetsOnly
    }
  }
)
