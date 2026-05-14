<script setup lang="ts">
import { RouterView, useRoute, useRouter } from 'vue-router'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElConfigProvider } from 'element-plus'
import zhCnLocale from 'element-plus/es/locale/lang/zh-cn'
import enLocale from 'element-plus/es/locale/lang/en'
import { useI18n } from 'vue-i18n'
import { useUserStore } from '@/stores/userStore'
import { useLogsStore } from '@/stores/logsStore'
import AppTitleBar from '@/components/layout/AppTitleBar.vue'
import SideNav from '@/components/layout/SideNav.vue'
import CloseConfirmDialog from '@/components/CloseConfirmDialog.vue'
import AppStartupUpdateDialog from '@/components/AppStartupUpdateDialog.vue'
import { ElMessage } from 'element-plus'
import { fetchCloudAuth } from '@/config/cloudApi'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const logsStore = useLogsStore()
const { locale: i18nLocale, t } = useI18n()
const epLocaleMap = {
  'zh-CN': zhCnLocale,
  'en-US': enLocale
} as const

const elementLocale = computed(() => epLocaleMap[userStore.appLocale])

watch(
  () => userStore.appLocale,
  (l) => {
    i18nLocale.value = l
    if (typeof document !== 'undefined') {
      document.documentElement.lang = l === 'zh-CN' ? 'zh-CN' : 'en'
    }
  },
  { immediate: true }
)

function syncDocumentTitle() {
  const matched = route.matched
  const leaf = matched[matched.length - 1]
  const titleKey = (leaf?.meta?.titleKey ?? route.meta.titleKey) as string | undefined
  const pageTitle = titleKey ? String(t(titleKey)) : String(t('routes.home'))
  document.title = `${pageTitle} — ${String(t('brand.appName'))}`
}

watch(() => [route.fullPath, i18nLocale.value] as const, syncDocumentTitle, { immediate: true })

const isInitialized = ref(false)
const closeConfirmDialogRef = ref<InstanceType<typeof CloseConfirmDialog> | null>(null)

/** 用户在启动弹窗中点击「立即更新」后为 true，用于区分设置页触发的下载（不自动拉起安装包） */
const startupUpdateAwaitingInstall = ref(false)
const startupUpdateVisible = ref(false)
const startupUpdatePhase = ref<'prompt' | 'downloading' | 'error'>('prompt')
const startupCurrentVer = ref('')
const startupLatestVer = ref('')
const startupReleaseNotes = ref('')
const startupDownloadPercent = ref(0)
const startupTransferred = ref(0)
const startupTotal = ref(0)
const startupBytesPerSecond = ref(0)
const startupUpdateError = ref('')

const hasElectronUpdater = computed(
  () => typeof window !== 'undefined' && !!window.electronAPI?.updater
)

let removeStartupUpdateListener: (() => void) | undefined

const showSideNav = computed(() => {
  const hiddenRoutes = ['/login', '/register']
  if (hiddenRoutes.includes(route.path)) return false
  if (route.path.includes('/editor/')) return false
  if (route.path.includes('/canvas/')) return false
  return true
})

onMounted(async () => {
  logsStore.addLog('system', 'info', {
    messageKey: 'logsPage.msg.sysBootTitle',
    detailKey: 'logsPage.msg.sysBootDetail'
  })

  window.electronAPI?.window.onCloseRequested(() => {
    closeConfirmDialogRef.value?.showDialog()
  })

  if (window.electronAPI?.updater) {
    removeStartupUpdateListener = window.electronAPI.updater.onUpdateStatus((status: Record<string, unknown>) => {
      const st = status.status as string
      console.log('收到更新状态:', JSON.stringify(status))
      switch (st) {
        case 'available':
          startupUpdateAwaitingInstall.value = false
          startupLatestVer.value = (status.version as string) || ''
          startupReleaseNotes.value =
            typeof status.releaseNotes === 'string' ? status.releaseNotes : ''
          startupUpdatePhase.value = 'prompt'
          startupUpdateError.value = ''
          startupUpdateVisible.value = true
          window.electronAPI!.updater.getCurrentVersion().then((v) => {
            startupCurrentVer.value = v.version
          })
          break
        case 'downloading':
          if (startupUpdateAwaitingInstall.value) {
            startupUpdateVisible.value = true
            startupUpdatePhase.value = 'downloading'
            startupDownloadPercent.value = Number(status.percent) || 0
            startupTransferred.value = Number(status.transferred) || 0
            startupTotal.value = Number(status.total) || 0
            startupBytesPerSecond.value = Number(status.bytesPerSecond) || 0
          }
          break
        case 'downloaded':
          if (startupUpdateAwaitingInstall.value) {
            startupUpdateAwaitingInstall.value = false
            window.electronAPI!.updater.installUpdate()
          }
          break
        case 'not-available':
          console.log('当前已是最新版本')
          break
        case 'error':
          console.error('更新失败:', status.message)
          if (startupUpdateAwaitingInstall.value) {
            startupUpdatePhase.value = 'error'
            startupUpdateError.value = (status.message as string) || '更新失败'
            startupUpdateVisible.value = true
            startupUpdateAwaitingInstall.value = false
          } else if (!startupUpdateVisible.value) {
            ElMessage.error(String(status.message || '检查更新失败'))
          }
          break
        default:
          break
      }
    })
  }
  
  if (userStore.token && !userStore.user) {
    try {
      const response = await fetchCloudAuth('profile', {
        headers: userStore.getAuthFetchHeaders(),
      })
      
      const result = await response.json()
      
      if (result.success && result.data.user) {
        userStore.setUser(result.data.user)
        logsStore.addLog('system', 'success', {
          messageKey: 'logsPage.msg.loginOkTitle',
          detailKey: 'logsPage.msg.lineUser',
          detailParams: {
            user: String(result.data.user.username || result.data.user.email || '')
          }
        })
      } else {
        userStore.logout()
        logsStore.addLog('system', 'warning', {
          messageKey: 'logsPage.msg.sessionExpiredTitle',
          detailKey: 'logsPage.msg.sessionExpiredDetail'
        })
        router.push('/login')
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
      logsStore.addLog('system', 'error', {
        messageKey: 'logsPage.msg.fetchUserFailTitle',
        detailRaw: error instanceof Error ? error.message : t('logsPage.msg.unknownErr')
      })
      userStore.logout()
      router.push('/login')
    }
  }
  
  if (!userStore.isLoggedIn && route.meta.requiresAuth) {
    router.push('/login')
  }
  
  isInitialized.value = true
})

onUnmounted(() => {
  removeStartupUpdateListener?.()
})

function onStartupUpdateConfirm() {
  if (!window.electronAPI?.updater) return
  startupUpdateAwaitingInstall.value = true
  startupUpdatePhase.value = 'downloading'
  startupDownloadPercent.value = 0
  startupTransferred.value = 0
  startupBytesPerSecond.value = 0
  window.electronAPI.updater.downloadUpdate().then((result) => {
    if (!result.success && startupUpdatePhase.value === 'downloading') {
      startupUpdatePhase.value = 'error'
      startupUpdateError.value = result.message || '下载失败'
      startupUpdateAwaitingInstall.value = false
    }
  })
}

function onStartupUpdateDismiss() {
  startupUpdateAwaitingInstall.value = false
}
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <div class="app-container">
      <AppTitleBar />
      <div class="app-body">
        <SideNav v-if="showSideNav" />
        <main class="app-main">
          <RouterView v-slot="{ Component, route: currentRoute }">
            <keep-alive :include="['Editor', 'Step1Page', 'Step2Page']">
              <component
                :is="Component"
                :key="currentRoute.meta.noCache ? currentRoute.fullPath : undefined"
              />
            </keep-alive>
          </RouterView>
        </main>
      </div>
      <CloseConfirmDialog ref="closeConfirmDialogRef" />
      <AppStartupUpdateDialog
        v-if="hasElectronUpdater"
        v-model="startupUpdateVisible"
        :phase="startupUpdatePhase"
        :current-version="startupCurrentVer"
        :latest-version="startupLatestVer"
        :release-notes="startupReleaseNotes"
        :download-percent="startupDownloadPercent"
        :transferred="startupTransferred"
        :total="startupTotal"
        :bytes-per-second="startupBytesPerSecond"
        :error-message="startupUpdateError"
        @confirm="onStartupUpdateConfirm"
        @dismiss="onStartupUpdateDismiss"
      />
    </div>
  </el-config-provider>
</template>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
  overflow: hidden;
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.app-main {
  flex: 1;
  overflow: visible;
  position: relative;
  z-index: 1;
}
</style>
