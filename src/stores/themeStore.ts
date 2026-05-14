import { defineStore } from 'pinia'
import { ref, watch, onMounted } from 'vue'

export type ThemeMode = 'dark' | 'light' | 'system'

export const useThemeStore = defineStore('theme', () => {
  const themeMode = ref<ThemeMode>('dark')
  const isDark = ref(true)

  const getSystemTheme = (): boolean => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return true
  }

  const applyTheme = (dark: boolean) => {
    isDark.value = dark
    if (dark) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }

  const updateTheme = () => {
    if (themeMode.value === 'system') {
      applyTheme(getSystemTheme())
    } else {
      applyTheme(themeMode.value === 'dark')
    }
  }

  const setThemeMode = (mode: ThemeMode) => {
    themeMode.value = mode
    updateTheme()
  }

  const toggleTheme = () => {
    if (isDark.value) {
      setThemeMode('light')
    } else {
      setThemeMode('dark')
    }
  }

  const getThemeIcon = () => {
    if (themeMode.value === 'dark') return 'Moon'
    if (themeMode.value === 'light') return 'Sunny'
    return 'Monitor'
  }

  const getThemeLabel = () => {
    if (themeMode.value === 'dark') return '深色模式'
    if (themeMode.value === 'light') return '浅色模式'
    return '跟随系统'
  }

  watch(themeMode, () => {
    updateTheme()
  })

  const initTheme = () => {
    updateTheme()
    if (typeof window !== 'undefined' && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (themeMode.value === 'system') {
          updateTheme()
        }
      })
    }
  }

  return {
    themeMode,
    isDark,
    setThemeMode,
    toggleTheme,
    getThemeIcon,
    getThemeLabel,
    initTheme,
  }
})
