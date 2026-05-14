<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  HomeFilled,
  EditPen,
  List,
  Setting,
  FolderOpened,
  Document,
  Film,
  User,
  Tools,
} from '@element-plus/icons-vue'
import SettingsDialog from '@/components/SettingsDialog.vue'
import { useProjectStore } from '@/stores/projectStore'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const { t } = useI18n()
const showSettings = ref(false)
const settingsDefaultTab = ref<'storage' | 'profile' | 'api' | 'model' | 'about'>('storage')
const isExpanded = ref(false)

const allMenuItems = computed(() => {
  const items: Array<{ id: string; path?: string; icon: typeof HomeFilled; label: string; action?: () => void }> = [
    { id: 'home', path: '/home', icon: HomeFilled, label: t('sideNav.home') },
    { id: 'projects', path: '/projects', icon: FolderOpened, label: t('sideNav.dreamWorkshop') },
    { id: 'canvas-projects', path: '/canvas-projects', icon: FolderOpened, label: t('sideNav.canvasWorkshop') },
  ]

  if (projectStore.currentProject) {
    items.push(
      { id: 'step1', path: '/step1', icon: Document, label: t('sideNav.docParse') },
      { id: 'step2', path: '/step2', icon: Film, label: t('sideNav.storyboardEdit') }
    )
  }

  items.push(
    { id: 'prompts', path: '/prompts', icon: EditPen, label: t('sideNav.prompts') },
    { id: 'logs', path: '/logs', icon: List, label: t('sideNav.recentLogs') }
  )

  return items
})

const bottomMenuItems = computed(() => [
  { id: 'user', icon: User, label: t('sideNav.userCenter'), action: () => openUserCenter() },
  { id: 'model', icon: Tools, label: t('sideNav.modelManager'), action: () => openModelManager() },
  { id: 'settings', icon: Setting, label: t('sideNav.settings'), action: () => openSettings() }
])

const currentPath = computed(() => route.path)

const isActive = (item: { id: string; path?: string }) => {
  if (item.id === 'home' && currentPath.value === '/') return true
  if (item.id === 'step1' && currentPath.value.includes('/step1')) return true
  if (item.id === 'step2' && currentPath.value.includes('/step2')) return true
  if (item.id === 'projects' && currentPath.value === '/projects') return true
  if (item.id === 'canvas-projects' && currentPath.value === '/canvas-projects') return true
  if (item.path) return currentPath.value === item.path
  return false
}

const handleClick = (item: { id: string; path?: string; action?: () => void }) => {
  if (item.action) {
    item.action()
    return
  }

  if (item.id === 'step1' || item.id === 'step2') {
    if (!projectStore.currentProject) {
      ElMessage.warning(t('sideNav.selectProjectFirst'))
      router.push('/projects')
      return
    }
    router.push(`/editor/${projectStore.currentProject.id}${item.path}`)
  } else if (item.path) {
    router.push(item.path)
  }
}

const openSettings = () => {
  settingsDefaultTab.value = 'storage'
  showSettings.value = true
}

const openUserCenter = () => {
  settingsDefaultTab.value = 'profile'
  showSettings.value = true
}

const openModelManager = () => {
  settingsDefaultTab.value = 'model'
  showSettings.value = true
}

const handleMouseEnter = () => {
  isExpanded.value = true
}

const handleMouseLeave = () => {
  isExpanded.value = false
}
</script>

<template>
  <aside
    class="sidebar"
    :class="{ expanded: isExpanded }"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <nav class="sidebar-nav">
      <div class="nav-wrapper">
        <div class="nav-list">
          <div
            v-for="item in allMenuItems"
            :key="item.id"
            :class="['nav-item', { active: isActive(item) }]"
            @click="handleClick(item)"
          >
            <el-icon :size="20">
              <component :is="item.icon" />
            </el-icon>
            <span class="nav-label">{{ item.label }}</span>
          </div>
        </div>

        <div class="nav-divider" />

        <div class="nav-list">
          <div
            v-for="item in bottomMenuItems"
            :key="item.id"
            class="nav-item"
            @click="item.action?.()"
          >
            <el-icon :size="20">
              <component :is="item.icon" />
            </el-icon>
            <span class="nav-label">{{ item.label }}</span>
          </div>
        </div>
      </div>
    </nav>

    <SettingsDialog
      v-model="showSettings"
      :default-tab="settingsDefaultTab"
    />
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  left: 10px;
  top: 0;
  height: 100%;
  width: 60px;
  display: flex;
  flex-direction: column;
  z-index: 100;
  transition: width 0.2s ease;
  overflow: hidden;
}

.sidebar.expanded {
  width: 140px;
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 8px 0;
}

.nav-wrapper {
  background-color: var(--bg-secondary);
  border: 1px solid #00f4ff8c;
  border-radius: 8px;
  padding: 8px 8px;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 8px 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary);
  position: relative;
  white-space: nowrap;
}

.nav-item:hover:not(.disabled) {
  background-color: rgba(102, 126, 234, 0.1);
  color: var(--text-primary);
}

.nav-item.active {
  background-color: var(--primary-color);
  color: #fff;
}

.nav-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-label {
  font-size: 13px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.sidebar.expanded .nav-label {
  opacity: 1;
}
</style>
