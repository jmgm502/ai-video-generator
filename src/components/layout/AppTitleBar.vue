<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '@/stores/themeStore'
import { useProjectStore } from '@/stores/projectStore'
import { useUserStore } from '@/stores/userStore'
import type { AppLocale } from '@/i18n'
import {
  Setting,
  Minus,
  FullScreen,
  Close,
} from '@element-plus/icons-vue'
import SettingsDialog from '@/components/SettingsDialog.vue'

const themeStore = useThemeStore()
const projectStore = useProjectStore()
const userStore = useUserStore()
const { t } = useI18n()

const appVersion = ref('')
const isMaximized = ref(false)
const showSettings = ref(false)
const showUpdatePopup = ref(false)
const updateLogs = ref<{ version: string; date: string; notes: string }[]>([])

const getFullVersion = () => {
  return '1.1.0'
}

const initAppVersion = async () => {
  try {
    if (window.electronAPI?.updater?.getCurrentVersion) {
      const versionInfo = await window.electronAPI.updater.getCurrentVersion()
      appVersion.value = versionInfo.version
    } else {
      appVersion.value = getFullVersion()
    }
  } catch (error) {
    console.error('获取版本失败:', error)
    appVersion.value = getFullVersion()
  }
}

interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  buildNumber?: number
  releaseDate?: string
  releaseNotes?: string
  percent?: number
  message?: string
}

const hasCurrentProject = computed(() => projectStore.currentProject !== null)

const latestVersion = computed(() => updateLogs.value[0]?.version || '')

onMounted(async () => {
  await initAppVersion()
  try {
    const logs = await window.electronAPI?.updater.getUpdateLogs() as Array<{ version: string; date: string; notes: string }> | undefined
    if (logs && logs.length > 0) {
      updateLogs.value = logs
    }
  } catch (error) {
    console.error('获取更新日志失败:', error)
  }

  if (window.electronAPI?.updater.onUpdateStatus) {
    window.electronAPI.updater.onUpdateStatus((status: UpdateStatus) => {
      if (status.status === 'available' || status.status === 'downloaded') {
        showUpdatePopup.value = true
      }
    })
  }
})

const handleMinimize = () => {
  window.electronAPI?.window.minimize()
}

const handleMaximize = async () => {
  window.electronAPI?.window.maximize()
  isMaximized.value = await window.electronAPI?.window.isMaximized()
}

const handleClose = () => {
  window.electronAPI?.window.close()
}

onMounted(async () => {
  isMaximized.value = await window.electronAPI?.window.isMaximized()
  themeStore.initTheme()
})
</script>

<template>
  <header class="title-bar">
    <div class="title-bar-drag">
      <div class="title-bar-logo">
        <img
          src="/icon.ico"
          class="logo-icon"
          alt="logo"
        >
        <span class="app-name">{{ t('brand.appName') }}</span>
        <span class="app-version">{{ appVersion }}</span>
      </div>
    </div>
    <div class="title-bar-actions">
      <div class="window-controls">
        <button
          class="control-btn dot minimize"
          @click="handleMinimize"
        />
        <button
          class="control-btn dot maximize"
          @click="handleMaximize"
        />
        <button
          class="control-btn dot close"
          @click="handleClose"
        />
      </div>
    </div>
  </header>
  
  <SettingsDialog
    v-model="showSettings"
    default-tab="profile"
  />
</template>

<style scoped>
.title-bar {
  height: 35px;
  background-color: #0a0a0a00;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 0;
  user-select: none;
  z-index: 100;
}

.title-bar-drag {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  -webkit-app-region: drag;
}

.title-bar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-left: 10px;
}

.logo-icon {
  width: 28px;
  height: 28px;
}

.app-name {
  font-size: 14px;
    color: var(--text-primary);
    letter-spacing: 2px;
}

.app-version {
  font-size: 12px;
}

.title-divider {
  width: 1px;
  height: 16px;
  background-color: var(--border-color);
  margin: 0 8px;
}

.model-manager-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  background-color: rgba(102, 126, 234, 0.1);
  transition: all 0.2s;
  -webkit-app-region: no-drag;
}

.model-manager-btn:hover {
  background-color: rgba(102, 126, 234, 0.2);
  color: var(--primary-color);
}

.style-select-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  background-color: rgba(0, 214, 143, 0.1);
  transition: all 0.2s;
  -webkit-app-region: no-drag;
}

.style-select-btn:hover {
  background-color: rgba(0, 214, 143, 0.2);
  color: #06b6d4;
}

.style-label {
  color: var(--tw-ring-offset-color);
}

.style-value {
  color: #06b6d4;
  font-weight: 500;
}

.project-name {
  font-size: 13px;
}

.title-bar-actions {
  display: flex;
  align-items: center;
  -webkit-app-region: no-drag;
}

.theme-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border-radius: 6px;
  transition: background-color 0.2s;
  color: var(--text-secondary);
  cursor: pointer;
}

.always-on-top-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border-radius: 6px;
  transition: all 0.2s;
  color: var(--text-secondary);
  cursor: pointer;
}

.always-on-top-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.always-on-top-btn.active {
  background-color: rgba(0, 214, 143, 0.15);
  color: var(--primary-color);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-radius: 6px;
  transition: background-color 0.2s;
  cursor: pointer;
}

.user-info:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.username {
  font-size: 13px;
  color: var(--text-primary);
}

.window-controls {
  display: flex;
  height: 100%;
  align-items: center;
  padding-right: 15px;
}

.control-btn {
  width: 40px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, color 0.2s;
  border-radius: 0;
}

.control-btn.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  padding: 0;
  margin: 0 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}

.control-btn.dot.minimize {
  background-color: #f5c542;
}

.control-btn.dot.maximize {
  background-color: #5ac05a;
}

.control-btn.dot.close {
  background-color: #e8413e;
}

.control-btn.dot:hover {
  opacity: 0.8;
}

.control-btn.dot.close:hover {
  background-color: #ff6058;
}

.check-icon {
  margin-left: auto;
}

.update-logs-container {
  max-height: 400px;
  overflow-y: auto;
}

.update-log-item {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.update-log-item:last-child {
  border-bottom: none;
}

.update-log-item.latest {
  background-color: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 8px;
}

.log-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.log-version {
  font-weight: 600;
  color: var(--primary-color);
}

.log-date {
  color: var(--text-muted);
  font-size: 12px;
}

.log-content {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-line;
}

.no-logs {
  text-align: center;
  color: var(--text-muted);
  padding: 40px;
}
</style>
