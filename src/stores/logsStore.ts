import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type LogType =
  | 'system'
  | 'extract-assets'
  | 'generate-storyboard'
  | 'optimize-storyboard'
  | 'character-image'
  | 'scene-image'
  | 'props-image'
  | 'batch-character-image'
  | 'batch-scene-image'
  | 'batch-props-image'
  | 'match-asset'
  | 'scheduled-video'
  | 'batch-match-asset'
  | 'storyboard-image'
  | 'batch-storyboard-image'
  | 'ai-video'
  | 'batch-video'
  | 'export-jianying'

export type LogLevel = 'info' | 'success' | 'warning' | 'error'

/** 结构化日志（与当前语言 `logsPage.msg.*` 对应） */
export interface LogI18nPayload {
  messageKey: string
  messageParams?: Record<string, string | number>
  detailKey?: string
  detailParams?: Record<string, string | number>
  /** 逐字附加（接口错误信息等） */
  detailRaw?: string
}

export interface LogEntry {
  id: string
  type: LogType
  level: LogLevel
  /** 兼容旧数据的纯文案；新日志含 messageKey 时可为空字符串 */
  message: string
  details?: string
  messageKey?: string
  messageParams?: Record<string, string | number>
  detailKey?: string
  detailParams?: Record<string, string | number>
  timestamp: Date
  projectId?: string
  projectName?: string
}

export interface LogTypeConfig {
  id: LogType
  name: string
  icon: string
  color: string
}

export const logTypeConfigs: LogTypeConfig[] = [
  { id: 'system', name: '系统日志', icon: 'Setting', color: '#909399' },
  { id: 'extract-assets', name: '提取资产日志', icon: 'Download', color: '#409EFF' },
  { id: 'generate-storyboard', name: '分镜生成日志', icon: 'Document', color: '#67C23A' },
  { id: 'optimize-storyboard', name: '分镜优化日志', icon: 'Edit', color: '#E6A23C' },
  { id: 'character-image', name: '人物图片生成日志', icon: 'User', color: '#F56C6C' },
  { id: 'scene-image', name: '场景图片生成日志', icon: 'Picture', color: '#909399' },
  { id: 'props-image', name: '道具图片生成日志', icon: 'Box', color: '#9C27B0' },
  { id: 'batch-character-image', name: '批量人物图片生成日志', icon: 'User', color: '#F56C6C' },
  { id: 'batch-scene-image', name: '批量场景图片生成日志', icon: 'Picture', color: '#909399' },
  { id: 'batch-props-image', name: '批量道具图片生成日志', icon: 'Box', color: '#9C27B0' },
  { id: 'match-asset', name: '匹配资产日志', icon: 'Connection', color: '#00BCD4' },
  { id: 'batch-match-asset', name: '批量匹配资产日志', icon: 'Connection', color: '#00BCD4' },
  { id: 'storyboard-image', name: '分镜图生成图片日志', icon: 'PictureFilled', color: '#FF9800' },
  { id: 'batch-storyboard-image', name: '批量生成分镜图图片日志', icon: 'PictureFilled', color: '#FF9800' },
  { id: 'ai-video', name: 'AI生成视频日志', icon: 'VideoPlay', color: '#E91E63' },
  { id: 'batch-video', name: '批量生成视频日志', icon: 'VideoPlay', color: '#E91E63' },
]

function isPayload(x: unknown): x is LogI18nPayload {
  return typeof x === 'object' && x !== null && 'messageKey' in x
}

const STORAGE_KEY = 'logs-store-data'
const MAX_LOGS = 1000

export const useLogsStore = defineStore('logs', () => {
  const logs = ref<LogEntry[]>([])

  const loadFromStorage = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        logs.value = data.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }))
      }
    } catch (e) {
      console.error('Failed to load logs from storage:', e)
    }
  }

  const saveToStorage = () => {
    try {
      const data = logs.value.slice(-MAX_LOGS)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('Failed to save logs to storage:', e)
    }
  }

  /**
   * 第三参为结构化 payload 时，第四、五参为 projectId / projectName（无 details 占位）。
   * 第三参为 string 时为旧版：(message, details?, projectId?, projectName?)。
   */
  const addLog = (
    type: LogType,
    level: LogLevel,
    payload: string | LogI18nPayload,
    arg4?: string,
    arg5?: string,
    arg6?: string
  ) => {
    let message = ''
    let details: string | undefined
    let messageKey: string | undefined
    let messageParams: Record<string, string | number> | undefined
    let detailKey: string | undefined
    let detailParams: Record<string, string | number> | undefined
    let projectId: string | undefined
    let projectName: string | undefined

    if (isPayload(payload)) {
      messageKey = payload.messageKey
      messageParams = payload.messageParams
      detailKey = payload.detailKey
      detailParams = payload.detailParams
      details = payload.detailRaw
      projectId = arg4
      projectName = arg5
    } else {
      message = payload
      details = arg4
      projectId = arg5
      projectName = arg6
    }

    const log: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      level,
      message,
      details,
      messageKey,
      messageParams,
      detailKey,
      detailParams,
      timestamp: new Date(),
      projectId,
      projectName
    }
    logs.value.unshift(log)
    if (logs.value.length > MAX_LOGS) {
      logs.value = logs.value.slice(0, MAX_LOGS)
    }
    saveToStorage()
  }

  const clearLogs = () => {
    logs.value = []
    saveToStorage()
  }

  const clearLogsByType = (type: LogType) => {
    logs.value = logs.value.filter((log) => log.type !== type)
    saveToStorage()
  }

  const getLogsByType = (type: LogType): LogEntry[] => {
    return logs.value.filter((log) => log.type === type)
  }

  const getLogsByLevel = (level: LogLevel): LogEntry[] => {
    return logs.value.filter((log) => log.level === level)
  }

  const getLogsByProject = (projectId: string): LogEntry[] => {
    return logs.value.filter((log) => log.projectId === projectId)
  }

  const logCounts = computed(() => {
    const counts = {} as Record<LogType, number>
    logTypeConfigs.forEach((config) => {
      counts[config.id] = logs.value.filter((log) => log.type === config.id).length
    })
    return counts
  })

  const recentLogs = computed(() => {
    return logs.value.slice(0, 100)
  })

  loadFromStorage()

  return {
    logs,
    logCounts,
    recentLogs,
    addLog,
    clearLogs,
    clearLogsByType,
    getLogsByType,
    getLogsByLevel,
    getLogsByProject,
    logTypeConfigs
  }
})
