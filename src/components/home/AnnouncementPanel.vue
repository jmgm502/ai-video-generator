<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Bell } from '@element-plus/icons-vue'
import { getFullVersion } from '@/utils/version'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const announcements = computed(() => [
  {
    id: 1,
    title: t('homePage.ann1Title'),
    time: t('homePage.announcementDateSample'),
    isNew: true,
  },
  {
    id: 2,
    title: t('homePage.ann2Title'),
    time: t('homePage.announcementDateSample'),
    isNew: false,
  },
  {
    id: 3,
    title: t('homePage.ann3Title'),
    time: t('homePage.announcementDateSample'),
    isNew: false,
  },
])

const appVersion = ref('')
const showUpdatePopup = ref(false)
const showAnnouncementPopup = ref(false)
const updateLogs = ref<{ version: string; date: string; notes: string }[]>([])
const latestVersion = ref('')
const hasNewVersion = ref(false)
const newVersionInfo = ref('')

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

const loadUpdateLogs = async () => {
  try {
    const logs = await window.electronAPI?.updater.getUpdateLogs() as Array<{ version: string; date: string; notes: string }> | undefined
    if (logs && logs.length > 0) {
      updateLogs.value = logs
      latestVersion.value = logs[0]?.version || ''
    }
  } catch (error) {
    console.error('获取更新日志失败:', error)
  }
}

const handleCheckUpdate = async () => {
  try {
    await window.electronAPI?.updater.checkForUpdates()
  } catch (error) {
    console.error('检查更新失败:', error)
  }
}

const handleNotificationClick = () => {
  showUpdatePopup.value = true
}

const handleItemClick = (id: number) => {
  console.log('查看公告详情:', id)
}

const handleAnnouncementClick = () => {
  showAnnouncementPopup.value = true
}

defineExpose({
  appVersion,
  announcements,
  updateLogs,
  latestVersion,
  showUpdatePopup,
  showAnnouncementPopup,
  handleCheckUpdate,
  handleNotificationClick,
  handleAnnouncementClick,
  hasNewVersion,
  newVersionInfo,
})

onMounted(async () => {
  await initAppVersion()
  await loadUpdateLogs()

  if (window.electronAPI?.updater.onUpdateStatus) {
    window.electronAPI.updater.onUpdateStatus((status: any) => {
      if (status.status === 'available') {
        hasNewVersion.value = true
        newVersionInfo.value = status.version || ''
        console.log('发现新版本:', status.version)
      }
    })
  }
})
</script>

<template>
  <!-- 此组件只提供数据，不渲染可见内容 -->
</template>

<style scoped>
/* 此组件不渲染可见内容，样式已移除 */
</style>