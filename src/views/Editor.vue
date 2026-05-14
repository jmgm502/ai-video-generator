<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/stores/projectStore'
import { useStoryboardStore } from '@/stores/storyboardStore'
import { useStep1Store } from '@/stores/step1Store'
import { projectFileService } from '@/services/projectFileService'

defineOptions({
  name: 'Editor'
})

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const storyboardStore = useStoryboardStore()
const step1Store = useStep1Store()

const project = computed(() => projectStore.currentProject)
const isLoadingProjectData = ref(false)
const isSavingProjectData = ref(false)
const hasUnsavedChanges = ref(false)
let saveTimeout: ReturnType<typeof setTimeout> | null = null

const loadProjectData = async (forceReload = false) => {
  if (!project.value) return

  projectStore.projectDataLoading = true
  isLoadingProjectData.value = true
  hasUnsavedChanges.value = false
  
  step1Store.clearAll()
  storyboardStore.clearStoryboards()

  const hasStoryboardsInMemory = project.value.storyboards && project.value.storyboards.length > 0

  try {
    const result = await projectFileService.loadProject(project.value.id, project.value.name)

    if (result.data && result.data.storyboard && result.data.storyboard.length > 0) {
      const storyboards = result.data.storyboard.map((sb, index) =>
        projectFileService.deserializeStoryboard(sb, index)
      )

      storyboardStore.setStoryboards(storyboards)
      storyboardStore.ensureVideoPathsValid()
      step1Store.setGeneratedStoryboards(storyboards)

      const projectIndex = projectStore.projects.findIndex((p) => p.id === project.value?.id)
      if (projectIndex !== -1) {
        projectStore.projects[projectIndex] = {
          ...projectStore.projects[projectIndex],
          storyboards
        }
      }
    } else if (hasStoryboardsInMemory) {
      storyboardStore.setStoryboards(project.value.storyboards)
      storyboardStore.ensureVideoPathsValid()
      step1Store.setGeneratedStoryboards(project.value.storyboards)
      console.log(`✅ 创建分镜成功：内容插入项目${project.value.name} 分镜1`)
    }

    if (result.success && result.data) {
      if (result.data.novelContent) {
        step1Store.setExtractedContent(result.data.novelContent)
      }

      if (result.data.assets && result.data.assets.length > 0) {
        const characters = result.data.assets
          .filter((a) => a.type === 'character')
          .map((a) => projectFileService.deserializeAsset(a))

        const scenes = result.data.assets
          .filter((a) => a.type === 'scene')
          .map((a) => projectFileService.deserializeAsset(a))

        const props = result.data.assets
          .filter((a) => a.type === 'prop')
          .map((a) => projectFileService.deserializeAsset(a))

        step1Store.setCharacters(characters)
        step1Store.setScenes(scenes)
        step1Store.setProps(props)
      }
    }
  } catch (error) {
    console.error('加载项目数据失败:', error)
  } finally {
    isLoadingProjectData.value = false
    projectStore.projectDataLoading = false
  }
}

const saveProjectData = async () => {
  if (!project.value) {
    return
  }
  if (isLoadingProjectData.value || projectStore.projectDataLoading) {
    return
  }
  if (isSavingProjectData.value) {
    return
  }

  isSavingProjectData.value = true
  hasUnsavedChanges.value = false

  try {
    const assets = [
      ...step1Store.characters.map((a) => ({
        id: a.id,
        name: a.name,
        type: 'character' as const,
        description: a.description,
        imageUrl: a.imageUrl,
        status: a.status,
        historyImages: a.historyImages
      })),
      ...step1Store.scenes.map((a) => ({
        id: a.id,
        name: a.name,
        type: 'scene' as const,
        description: a.description,
        imageUrl: a.imageUrl,
        status: a.status,
        historyImages: a.historyImages
      })),
      ...step1Store.props.map((a) => ({
        id: a.id,
        name: a.name,
        type: 'prop' as const,
        description: a.description,
        imageUrl: a.imageUrl,
        status: a.status,
        historyImages: a.historyImages
      }))
    ].map((a) => projectFileService.serializeAssetForSave(a))

    let storyboardsToSave = storyboardStore.storyboards
    if (storyboardsToSave.length === 0 && step1Store.generatedStoryboards.length > 0) {
      storyboardsToSave = step1Store.generatedStoryboards
    }

    const storyboards = storyboardsToSave.map((sb) =>
      projectFileService.serializeStoryboardForSave(sb)
    )

    await projectFileService.saveAllProjectData(
      project.value.id,
      project.value.name,
      assets,
      storyboards,
      step1Store.extractedContent
    )
  } catch (error) {
    console.error('保存项目数据失败:', error)
  } finally {
    isSavingProjectData.value = false
  }
}

const markAsChanged = () => {
  if (isLoadingProjectData.value || projectStore.projectDataLoading) {
    return
  }

  hasUnsavedChanges.value = true

  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }

  saveTimeout = setTimeout(() => {
    if (hasUnsavedChanges.value) {
      saveProjectData()
    }
  }, 1000)
}

const forceSaveProjectData = async () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }

  if (hasUnsavedChanges.value) {
    await saveProjectData()
  }
}

const initProject = async () => {
  const projectId = route.params.id as string

  if (!project.value || project.value.id !== projectId) {
    let foundProject = projectStore.projects.find((p) => p.id === projectId)

    if (!foundProject) {
      await projectStore.loadProjects()
      foundProject = projectStore.projects.find((p) => p.id === projectId)
    }

    if (foundProject) {
      projectStore.setCurrentProject(foundProject)
    } else {
      ElMessage.error('项目不存在')
      router.push('/home')
      return false
    }
  }

  return true
}

onMounted(async () => {
  console.log('✅ 打开项目:', project.value?.name, project.value?.id)
  const canProceed = await initProject()
  if (canProceed) {
    await loadProjectData()
  }
})

watch(() => storyboardStore.storyboards, (newStoryboards) => {
  // 同步更新 step1Store，这样从 Step2 返回 Step1 时数据不会丢失
  if (newStoryboards && newStoryboards.length > 0) {
    step1Store.setGeneratedStoryboards(newStoryboards)
  }
  markAsChanged()
}, { deep: true })

watch(() => step1Store.characters, () => {
  markAsChanged()
}, { deep: true })

watch(() => step1Store.scenes, () => {
  markAsChanged()
}, { deep: true })

watch(() => step1Store.props, () => {
  markAsChanged()
}, { deep: true })

watch(() => step1Store.generatedStoryboards, () => {
  markAsChanged()
}, { deep: true })

watch(() => project.value?.id, async (newProjectId, oldProjectId) => {
  if (newProjectId && newProjectId !== oldProjectId) {
    console.log('✅ 切换项目，从', oldProjectId, '到', newProjectId)
    await forceSaveProjectData()
    await loadProjectData()
  }
})

onBeforeUnmount(async () => {
  await forceSaveProjectData()
})
</script>

<template>
  <div class="editor-container">
    <router-view />
  </div>
</template>

<style scoped>
.editor-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
}
</style>