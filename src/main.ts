import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'

import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import './styles/index.css'

const app = createApp(App)

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(pinia)
app.use(i18n)
app.use(router)
app.use(ElementPlus, { size: 'default', zIndex: 3000 })

app.mount('#app')

/** 等在打包环境：首帧路由与异步页面就绪后再通知主进程 show，缩短「黑屏」体感；开发模式仍可走主进程兜底超时 */
function scheduleNotifyElectronShellPainted(): void {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined
  if (!api?.notifyShellReady) return

  router.isReady().then(() => {
    nextTick(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            api.notifyShellReady!()
          } catch {
            /* ignore */
          }
        })
      })
    })
  })
}

scheduleNotifyElectronShellPainted()

const startTime = new Date()
console.log(`[系统启动] 应用启动时间: ${startTime.toLocaleString()}`)
