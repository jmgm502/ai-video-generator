<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/projectStore'
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog.vue'
import type { Project } from '@/types'
import {
  Plus,
  Search,
  Grid,
  List,
  MoreFilled,
  Delete,
  Edit,
  DocumentCopy,
  DeleteFilled,
  FolderOpened,
} from '@element-plus/icons-vue'

const router = useRouter()
const { t, locale } = useI18n()
const projectStore = useProjectStore()

const viewMode = ref<'grid' | 'list'>('grid')
const searchQuery = ref('')
const showCreateDialog = ref(false)
const loading = ref(false)

const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuProject = ref<Project | null>(null)

const showRecycleBinDialog = ref(false)
const recycleBinProjects = ref<Project[]>([])
const deleteConfirmDialogRef = ref<InstanceType<typeof DeleteConfirmDialog> | null>(null)

const newProject = ref({
  name: '',
  description: '',
  orientation: 'horizontal' as 'horizontal' | 'vertical',
})

const canvasProjects = computed(() => {
  return projectStore.projects.filter(p => p.type === 'canvas')
})

const filteredProjects = ref<Project[]>([])

const filterProjects = () => {
  if (!searchQuery.value) {
    filteredProjects.value = canvasProjects.value
  } else {
    const query = searchQuery.value.toLowerCase()
    filteredProjects.value = canvasProjects.value.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
    )
  }
}

const handleCreateProject = async () => {
  if (!newProject.value.name.trim()) {
    ElMessage.warning(t('projectList.msgNeedProjName'))
    return
  }

  const newStoryboard = {
    id: `story_${Date.now()}`,
    order: 1,
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
    status: 'pending' as const,
  }

  const project: Project = {
    id: `proj_${Date.now()}`,
    name: newProject.value.name,
    type: 'canvas',
    description: newProject.value.description,
    orientation: newProject.value.orientation,
    resolution:
      newProject.value.orientation === 'horizontal'
        ? { width: 1920, height: 1080 }
        : { width: 1080, height: 1920 },
    storyboards: [newStoryboard],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const success = await projectStore.addProject(project)
  if (!success) {
    ElMessage.error(t('projectList.msgCreateFail'))
    return
  }

  projectStore.setCurrentProject(project)
  showCreateDialog.value = false
  newProject.value = { name: '', description: '', orientation: 'horizontal' }
  filterProjects()
  ElMessage.success(t('projectList.msgCreateOk'))

  router.push(`/canvas/${project.id}`)
}

const handleOpenProject = (project: Project) => {
  projectStore.setCurrentProject(project)
  router.push(`/canvas/${project.id}`)
}

const handleDeleteProject = async (project: Project) => {
  closeContextMenu()
  try {
    const confirmed = await deleteConfirmDialogRef.value?.showDialog(
      t('projectList.confirmDeleteTpl', { name: project.name })
    )
    if (!confirmed) return

    const success = await projectStore.deleteProject(project.id)
    if (success) {
      filterProjects()
      ElMessage.success(t('projectList.msgDeletedOk'))
    } else {
      ElMessage.error(t('projectList.msgDeleteFail'))
    }
  } catch {
    // 用户取消
  }
}

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString(locale.value === 'zh-CN' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

const loadProjectList = async () => {
  loading.value = true
  await projectStore.loadCanvasProjects()
  filterProjects()
  loading.value = false
}

const handleContextMenu = (event: MouseEvent, project: Project) => {
  event.preventDefault()
  contextMenuProject.value = project
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuVisible.value = true
}

const closeContextMenu = () => {
  contextMenuVisible.value = false
  contextMenuProject.value = null
}

const handleCopyProjectFromDropdown = async (project: Project) => {
  const copyProject: Project = {
    ...project,
    id: `proj_${Date.now()}`,
    name: `${project.name}${t('projectList.copySuffix')}`,
    type: 'canvas',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const success = await projectStore.addProject(copyProject)
  if (success) {
    filterProjects()
    ElMessage.success(t('projectList.msgCopyOk'))
  } else {
    ElMessage.error(t('projectList.msgCopyFail'))
  }
}

const handleMoveToRecycleBinFromDropdown = async (project: Project) => {
  const success = await projectStore.moveToRecycleBin(project.id)
  if (success) {
    filterProjects()
    ElMessage.success(t('projectList.msgMovedRecycle'))
  } else {
    ElMessage.error(t('projectList.msgMoveRecycleFail'))
  }
}

const handleRenameProjectFromDropdown = async (project: Project) => {
  try {
    const { value: newName } = await ElMessageBox.prompt(
      t('projectList.renamePrompt'),
      t('projectList.renameTitle'),
      {
        confirmButtonText: t('projectList.ok'),
        cancelButtonText: t('projectList.cancel'),
        inputValue: project.name,
      }
    )
    if (!newName?.trim()) {
      ElMessage.warning(t('projectList.msgNameEmpty'))
      return
    }
    const success = await projectStore.renameProject(project.id, newName.trim())
    if (success) {
      filterProjects()
      ElMessage.success(t('projectList.msgRenameOk'))
    } else {
      ElMessage.error(t('projectList.msgRenameFail'))
    }
  } catch {
  }
}

const handleCopyProject = async () => {
  if (!contextMenuProject.value) return
  const original = contextMenuProject.value
  const copyProject: Project = {
    ...original,
    id: `proj_${Date.now()}`,
    name: `${original.name}${t('projectList.copySuffix')}`,
    type: 'canvas',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const success = await projectStore.addProject(copyProject)
  if (success) {
    filterProjects()
    ElMessage.success(t('projectList.msgCopyOk'))
  } else {
    ElMessage.error(t('projectList.msgCopyFail'))
  }
  closeContextMenu()
}

const handleMoveToRecycleBin = async () => {
  if (!contextMenuProject.value) return
  const success = await projectStore.moveToRecycleBin(contextMenuProject.value.id)
  if (success) {
    filterProjects()
    ElMessage.success(t('projectList.msgMovedRecycle'))
  } else {
    ElMessage.error(t('projectList.msgMoveRecycleFail'))
  }
  closeContextMenu()
}

const handleRenameProject = async () => {
  if (!contextMenuProject.value) return
  try {
    const { value: newName } = await ElMessageBox.prompt(
      t('projectList.renamePrompt'),
      t('projectList.renameTitle'),
      {
        confirmButtonText: t('projectList.ok'),
        cancelButtonText: t('projectList.cancel'),
        inputValue: contextMenuProject.value.name,
      }
    )
    if (!newName?.trim()) {
      ElMessage.warning(t('projectList.msgNameEmpty'))
      return
    }
    const success = await projectStore.renameProject(contextMenuProject.value.id, newName.trim())
    if (success) {
      filterProjects()
      ElMessage.success(t('projectList.msgRenameOk'))
    } else {
      ElMessage.error(t('projectList.msgRenameFail'))
    }
  } catch {
    // 用户取消
  }
  closeContextMenu()
}

const handleOpenRecycleBin = async () => {
  recycleBinProjects.value = projectStore.recycleBinProjects.filter(p => p.type === 'canvas')
  showRecycleBinDialog.value = true
}

const handleRestoreFromRecycleBin = async (project: Project) => {
  const success = await projectStore.restoreFromRecycleBin(project.id)
  if (success) {
    filterProjects()
    recycleBinProjects.value = projectStore.recycleBinProjects.filter(p => p.type === 'canvas')
    ElMessage.success(t('projectList.msgRestoredOk'))
  } else {
    ElMessage.error(t('projectList.msgRestoreFail'))
  }
}

const handleDeleteFromRecycleBin = async (project: Project) => {
  try {
    const confirmed = await deleteConfirmDialogRef.value?.showDialog(
      t('projectList.confirmPermanentDeleteTpl', { name: project.name }),
      t('projectList.irreversibleHint')
    )
    if (!confirmed) return

    const success = await projectStore.deleteProject(project.id, true)
    if (success) {
      recycleBinProjects.value = projectStore.recycleBinProjects.filter(p => p.type === 'canvas')
      ElMessage.success(t('projectList.msgPurgedOk'))
    } else {
      ElMessage.error(t('projectList.msgPurgeFail'))
    }
  } catch {
    // 用户取消
  }
}

onMounted(() => {
  document.addEventListener('click', closeContextMenu)
  loadProjectList()
})

onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu)
})
</script>

<template>
  <div class="project-list-container">
    <div class="project-list-header">
      <h2 class="page-title">
        {{ t('projectList.canvasPageTitle') }}
      </h2>
      <div class="header-actions">
        <el-button
          type="primary"
          :icon="Plus"
          @click="showCreateDialog = true"
        >
          {{ t('projectList.newProject') }}
        </el-button>
      </div>
    </div>

    <div class="project-list-content">
      <el-button
        class="recycle-bin-float-btn"
        :icon="DeleteFilled"
        circle
        @click="handleOpenRecycleBin"
      />
      <div
        v-if="filteredProjects.length === 0"
        class="empty-state"
      >
        <el-empty :description="t('projectList.emptyCanvasProjects')">
          <el-button
            type="primary"
            @click="showCreateDialog = true"
          >
            {{ t('projectList.createFirstCanvas') }}
          </el-button>
        </el-empty>
      </div>

      <div
        v-else
        :class="['projects', viewMode]"
      >
        <div
          v-for="project in filteredProjects"
          :key="project.id"
          class="project-card"
          @click="handleOpenProject(project)"
          @contextmenu="handleContextMenu($event, project)"
        >
          <div class="project-info">
            <h3 class="project-name">
              {{ project.name }}
            </h3>
            <p class="project-description">
              {{ project.description || t('projectList.noDesc') }}
            </p>
            <div class="project-meta">
              <span class="meta-item">
                {{ project.orientation === 'horizontal' ? t('projectList.landscape') : t('projectList.portrait') }}
              </span>
              <span class="meta-item">{{ formatDate(project.updatedAt) }}</span>
            </div>
          </div>
          <el-dropdown
            trigger="click"
            class="project-menu"
            @mousedown.stop
          >
            <el-button
              text
              :icon="MoreFilled"
              @click.stop
            />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  :icon="Edit"
                  @click="handleRenameProjectFromDropdown(project)"
                >
                  {{ t('projectList.rename') }}
                </el-dropdown-item>
                <el-dropdown-item
                  :icon="DocumentCopy"
                  @click="handleCopyProjectFromDropdown(project)"
                >
                  {{ t('projectList.copyProject') }}
                </el-dropdown-item>
                <el-dropdown-item
                  :icon="DeleteFilled"
                  @click="handleMoveToRecycleBinFromDropdown(project)"
                >
                  {{ t('projectList.moveToRecycle') }}
                </el-dropdown-item>
                <el-dropdown-item
                  :icon="Delete"
                  divided
                  @click="handleDeleteProject(project)"
                >
                  {{ t('projectList.delete') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="showCreateDialog"
      :title="t('projectList.dialogCreateCanvasTitle')"
      width="480px"
      :close-on-click-modal="false"
    >
      <el-form label-width="80px">
        <el-form-item
          :label="t('projectList.labelName')"
          required
        >
          <el-input
            v-model="newProject.name"
            :placeholder="t('projectList.phName')"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        <el-form-item :label="t('projectList.labelDesc')">
          <el-input
            v-model="newProject.description"
            type="textarea"
            :placeholder="t('projectList.phDescOptional')"
            :rows="3"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item :label="t('projectList.labelOrientation')">
          <el-radio-group v-model="newProject.orientation">
            <el-radio value="horizontal">
              <span class="orientation-option">
                {{ t('projectList.orientationH') }}
              </span>
            </el-radio>
            <el-radio value="vertical">
              <span class="orientation-option">
                {{ t('projectList.orientationV') }}
              </span>
            </el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">
          {{ t('projectList.cancel') }}
        </el-button>
        <el-button
          type="primary"
          @click="handleCreateProject"
        >
          {{ t('projectList.create') }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showRecycleBinDialog"
      :title="t('projectList.recycleTitle')"
      width="600px"
    >
      <div v-if="recycleBinProjects.length === 0">
        <el-empty :description="t('projectList.recycleEmpty')" />
      </div>
      <div
        v-else
        class="recycle-bin-list"
      >
        <div
          v-for="project in recycleBinProjects"
          :key="project.id"
          class="recycle-bin-item"
        >
          <div class="recycle-bin-item-info">
            <span class="recycle-bin-item-name">{{ project.name }}</span>
            <span class="recycle-bin-item-date">{{ formatDate(project.updatedAt) }}</span>
          </div>
          <div class="recycle-bin-item-actions">
            <el-button
              size="small"
              @click="handleRestoreFromRecycleBin(project)"
            >
              {{ t('projectList.restore') }}
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click="handleDeleteFromRecycleBin(project)"
            >
              {{ t('projectList.delete') }}
            </el-button>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showRecycleBinDialog = false">
          {{ t('projectList.close') }}
        </el-button>
      </template>
    </el-dialog>

    <DeleteConfirmDialog ref="deleteConfirmDialogRef" />
  </div>
</template>

<style scoped>
.project-list-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
  overflow: hidden;
}

.project-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 30px;
  _background-color: var(--bg-secondary);
  _border-bottom: 1px solid var(--border-color);
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.search-input {
  width: 240px;
}

.view-toggle {
  margin-right: 8px;
}

.project-list-content {
  flex: 1;
  overflow-y: auto;
  padding: 5px 15px 0 80px;
}

.projects.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.projects.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.projects.list .project-card {
  flex-direction: row;
  height: 80px;
}

.projects.list .project-thumbnail {
  width: 120px;
  height: 80px;
  flex-shrink: 0;
}

.projects.list .project-info {
  flex: 1;
}

.project-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.project-card:hover {
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.project-thumbnail {
  position: relative;
  width: 100%;
  height: 80px;
  background-color: var(--bg-color);
  overflow: hidden;
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.project-info {
  padding: 12px;
}

.project-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-description {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 8px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.project-menu {
  position: absolute;
  top: 8px;
  right: 8px;
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.recycle-bin-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recycle-bin-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.recycle-bin-item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.recycle-bin-item-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.recycle-bin-item-date {
  font-size: 12px;
  color: var(--text-secondary);
}

.recycle-bin-item-actions {
  display: flex;
  gap: 8px;
}

.recycle-bin-float-btn {
  position: fixed;
  bottom: 40px;
  right: 40px;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
