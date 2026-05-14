import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Storyboard, ImageAsset } from '@/types'

export const useStoryboardStore = defineStore(
  'storyboard',
  () => {
    const storyboards = ref<Storyboard[]>([])
    const currentStoryboardIndex = ref<number>(0)
    const selectedStoryboard = ref<Storyboard | null>(null)
    const generatingType = ref<Record<string, 'text' | 'image' | 'video'>>({})

    const currentStoryboard = computed(() => {
      if (storyboards.value.length === 0) return null
      return storyboards.value[currentStoryboardIndex.value] || null
    })

    const storyboardCount = computed(() => storyboards.value.length)

    const totalDuration = computed(() => {
      return storyboards.value.reduce((sum, sb) => sum + sb.duration, 0)
    })

    function setGeneratingType(storyboardId: string, type: 'text' | 'image' | 'video' | null) {
      if (type === null) {
        delete generatingType.value[storyboardId]
      } else {
        generatingType.value[storyboardId] = type
      }
    }

    function getGeneratingType(storyboardId: string): 'text' | 'image' | 'video' | undefined {
      return generatingType.value[storyboardId]
    }

    function setStoryboards(list: Storyboard[]) {
      storyboards.value = list.map(sb => {
        if (!sb.generatedImages) {
          sb.generatedImages = []
          if (sb.generatedImage) {
            sb.generatedImages.push(sb.generatedImage)
          }
        }
        if (!sb.generatedVideos) {
          sb.generatedVideos = []
          if (sb.generatedVideo) {
            sb.generatedVideos.push(sb.generatedVideo)
          }
        }
        return sb
      })
      if (list.length > 0 && currentStoryboardIndex.value >= list.length) {
        currentStoryboardIndex.value = 0
      }
    }

    function ensureVideoPathsValid() {
      storyboards.value.forEach(storyboard => {
        if (storyboard.generatedVideo) {
          storyboard.generatedVideo = normalizeVideoPath(storyboard.generatedVideo)
        }
        if (storyboard.generatedVideos) {
          storyboard.generatedVideos = storyboard.generatedVideos.map(v => normalizeVideoPath(v))
        }
      })
    }

    function normalizeVideoPath(path: string): string {
      if (!path) return path
      if (path.startsWith('blob:') || path.startsWith('http:') || path.startsWith('https:') || path.startsWith('data:') || path.startsWith('file://')) {
        return path
      }
      return 'file://' + path.replace(/\\/g, '/')
    }

    function addStoryboard(storyboard: Storyboard) {
      storyboards.value.push(storyboard)
      currentStoryboardIndex.value = storyboards.value.length - 1
    }

    function insertStoryboard(index: number, storyboard: Storyboard) {
      storyboards.value.splice(index, 0, storyboard)
      reorderStoryboards()
    }

    function updateStoryboard(id: string, updates: Partial<Storyboard>) {
      const index = storyboards.value.findIndex((sb) => sb.id === id)
      if (index !== -1) {
        storyboards.value[index] = { ...storyboards.value[index], ...updates }
      }
    }

    function deleteStoryboard(id: string) {
      const index = storyboards.value.findIndex((sb) => sb.id === id)
      if (index !== -1) {
        storyboards.value.splice(index, 1)
        reorderStoryboards()
        if (currentStoryboardIndex.value >= storyboards.value.length) {
          currentStoryboardIndex.value = Math.max(0, storyboards.value.length - 1)
        }
      }
    }

    function reorderStoryboards() {
      storyboards.value.forEach((sb, index) => {
        sb.order = index + 1
      })
    }

    function moveStoryboard(fromIndex: number, toIndex: number) {
      const [removed] = storyboards.value.splice(fromIndex, 1)
      storyboards.value.splice(toIndex, 0, removed)
      reorderStoryboards()
    }

    function setCurrentIndex(index: number) {
      if (index >= 0 && index < storyboards.value.length) {
        currentStoryboardIndex.value = index
      }
    }

    function setSelectedStoryboard(storyboard: Storyboard | null) {
      selectedStoryboard.value = storyboard
    }

    function updateTextPrompt(id: string, description: string, systemPrompt: string) {
      const storyboard = storyboards.value.find((sb) => sb.id === id)
      if (storyboard) {
        storyboard.textPrompt = { description, systemPrompt }
      }
    }

    function updateImagePrompt(
      id: string,
      data: {
        characters?: ImageAsset[]
        scene?: ImageAsset
        props?: ImageAsset[]
      }
    ) {
      const storyboard = storyboards.value.find((sb) => sb.id === id)
      if (storyboard) {
        storyboard.imagePrompt = { ...storyboard.imagePrompt, ...data }
      }
    }

    function setGeneratedImage(id: string, imageUrl: string) {
      const storyboard = storyboards.value.find((sb) => sb.id === id)
      if (storyboard) {
        const newGeneratedImages = storyboard.generatedImages ? [...storyboard.generatedImages] : []
        newGeneratedImages.push(imageUrl)
        updateStoryboard(id, {
          generatedImages: newGeneratedImages,
          generatedImage: imageUrl,
          status: 'completed'
        })
      }
    }

    function setGeneratedVideo(id: string, videoUrl: string) {
      const storyboard = storyboards.value.find((sb) => sb.id === id)
      if (storyboard) {
        const newGeneratedVideos = storyboard.generatedVideos ? [...storyboard.generatedVideos] : []
        newGeneratedVideos.push(videoUrl)
        updateStoryboard(id, {
          generatedVideos: newGeneratedVideos,
          generatedVideo: videoUrl
        })
      }
    }

    function setStoryboardStatus(id: string, status: Storyboard['status']) {
      const storyboard = storyboards.value.find((sb) => sb.id === id)
      if (storyboard) {
        updateStoryboard(id, { status })
      }
    }

    function selectGeneratedImage(id: string, imageUrl: string) {
      updateStoryboard(id, { generatedImage: imageUrl })
    }

    function selectGeneratedVideo(id: string, videoUrl: string) {
      updateStoryboard(id, { generatedVideo: videoUrl })
    }

    function duplicateStoryboard(id: string) {
      const index = storyboards.value.findIndex((sb) => sb.id === id)
      if (index !== -1) {
        const original = storyboards.value[index]
        const duplicate: Storyboard = {
          ...JSON.parse(JSON.stringify(original)),
          id: generateId(),
          order: 0,
          status: 'pending',
          generatedImages: [],
          generatedImage: undefined,
          generatedVideos: [],
          generatedVideo: undefined,
        }
        storyboards.value.splice(index + 1, 0, duplicate)
        reorderStoryboards()
      }
    }

    function clearStoryboards() {
      storyboards.value = []
      currentStoryboardIndex.value = 0
      selectedStoryboard.value = null
    }

    function setMatchedAssets(
      id: string,
      data: {
        characters?: ImageAsset[]
        scene?: ImageAsset | null
        props?: ImageAsset[]
      }
    ) {
      const storyboard = storyboards.value.find((sb) => sb.id === id)
      if (storyboard) {
        if (data.characters !== undefined) {
          storyboard.imagePrompt.characters = data.characters
        }
        if (data.scene !== undefined) {
          storyboard.imagePrompt.scene = data.scene || undefined
        }
        if (data.props !== undefined) {
          storyboard.imagePrompt.props = data.props
        }
      }
    }

    function updateMatchedAssetImage(
      assetType: 'character' | 'scene' | 'props',
      assetId: string,
      imageUrl: string
    ) {
      storyboards.value.forEach(storyboard => {
        if (assetType === 'character') {
          const char = storyboard.imagePrompt.characters.find(c => c.id === assetId)
          if (char) {
            char.url = imageUrl
          }
        } else if (assetType === 'scene') {
          if (storyboard.imagePrompt.scene && storyboard.imagePrompt.scene.id === assetId) {
            storyboard.imagePrompt.scene.url = imageUrl
          }
        } else {
          const prop = storyboard.imagePrompt.props.find(p => p.id === assetId)
          if (prop) {
            prop.url = imageUrl
          }
        }
      })
    }

    function generateId(): string {
      return `sb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    return {
      storyboards,
      currentStoryboardIndex,
      selectedStoryboard,
      generatingType,
      currentStoryboard,
      storyboardCount,
      totalDuration,
      setGeneratingType,
      getGeneratingType,
      setStoryboards,
      ensureVideoPathsValid,
      addStoryboard,
      insertStoryboard,
      updateStoryboard,
      deleteStoryboard,
      moveStoryboard,
      setCurrentIndex,
      setSelectedStoryboard,
      updateTextPrompt,
      updateImagePrompt,
      setGeneratedImage,
      setGeneratedVideo,
      setStoryboardStatus,
      selectGeneratedImage,
      selectGeneratedVideo,
      duplicateStoryboard,
      clearStoryboards,
      setMatchedAssets,
      updateMatchedAssetImage,
    }
  }
)
