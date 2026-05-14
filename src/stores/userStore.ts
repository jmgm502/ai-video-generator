import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'
import { fetchCloudAuth } from '@/config/cloudApi'
import type { AppLocale } from '@/i18n'

export type { AppLocale }

export const useUserStore = defineStore(
  'user',
  () => {
    const user = ref<User | null>(null)
    const token = ref<string>('')
    const refreshToken = ref<string>('')

    const isLoggedIn = computed(() => !!token.value && !!user.value)
    const userName = computed(() => user.value?.username || '')
    const userEmail = computed(() => user.value?.email || '')
    const userAvatar = computed(() => user.value?.avatar || '')
    const userGroup = computed(() => user.value?.userGroup || 'normal')
    const userGroupLabel = computed(() => {
      return user.value?.userGroup === 'vip' ? 'VIP用户' : '普通用户'
    })
    const createdAt = computed(() => user.value?.createdAt || '')
    const lastLoginAt = computed(() => user.value?.lastLoginAt || '')
    const vipExpireAt = computed(() => user.value?.vipExpireAt || '')
    const jianyingDraftPath = ref<string>('')
    const autoSaveInterval = ref<number>(30)
    const edgeStyle = ref<'straight' | 'smooth' | 'step' | 'smoothstep'>('straight')
    /** 画布连线宽度（默认 1px，最大 5px） */
    const edgeStrokeWidth = ref(1)
    /** 画布连线颜色（默认主题蓝） */
    const edgeColor = ref('#409eff')

    /** 鸟瞰模式缩放阈值，低于此值进入鸟瞰模式（默认 0.38） */
    const canvasLodShellZoomThreshold = ref(0.38)

    /** 电影故事版模式开关 */
    const enableCinemaStoryboard = ref(false)

    /** 全局界面语言（标题栏切换，持久化） */
    const appLocale = ref<AppLocale>('zh-CN')

    function setAppLocale(locale: AppLocale) {
      appLocale.value = locale
    }

    function setUser(userData: User) {
      user.value = userData
    }

    function setToken(accessToken: string, refresh?: string) {
      token.value = accessToken
      if (refresh) {
        refreshToken.value = refresh
      }
    }

    function logout() {
      user.value = null
      token.value = ''
      refreshToken.value = ''
    }

    function updateAvatar(avatar: string) {
      if (user.value) {
        user.value.avatar = avatar
      }
    }

    function updateLastLogin(date: string) {
      if (user.value) {
        user.value.lastLoginAt = date
      }
    }

    function getAuthFetchHeaders(): Record<string, string> {
      const t = token.value?.trim()
      if (!t) return {}
      return {
        Authorization: `Bearer ${t}`,
      }
    }

    async function refreshUserInfo() {
      if (!token.value) return
      
      try {
        const response = await fetchCloudAuth('profile', {
          headers: getAuthFetchHeaders(),
        })
        
        const result = await response.json()
        
        if (result.success && result.data.user) {
          user.value = result.data.user
        }
      } catch (error) {
        console.error('刷新用户信息失败:', error)
      }
    }

    return {
      user,
      token,
      refreshToken,
      isLoggedIn,
      userName,
      userEmail,
      userAvatar,
      userGroup,
      userGroupLabel,
      createdAt,
      lastLoginAt,
      vipExpireAt,
      jianyingDraftPath,
      autoSaveInterval,
      edgeStyle,
      edgeStrokeWidth,
      edgeColor,
      canvasLodShellZoomThreshold,
      enableCinemaStoryboard,
      appLocale,
      setAppLocale,
      setUser,
      setToken,
      logout,
      updateAvatar,
      updateLastLogin,
      getAuthFetchHeaders,
      refreshUserInfo,
    }
  },
  {
    persist: {
      key: 'user-store',
      paths: [
        'token',
        'refreshToken',
        'jianyingDraftPath',
        'autoSaveInterval',
        'edgeStyle',
        'edgeStrokeWidth',
        'edgeColor',
      'canvasLodShellZoomThreshold',
      'enableCinemaStoryboard',
      'appLocale',
      ],
      storage: {
        getItem: (key) => {
          if (window.electronAPI?.storeSync) {
            return window.electronAPI.storeSync.get(key)
          }
          return localStorage.getItem(key)
        },
        setItem: (key, value) => {
          if (window.electronAPI?.storeSync) {
            window.electronAPI.storeSync.set(key, value)
          } else {
            localStorage.setItem(key, value)
          }
        },
      },
    },
  }
)
