import { defineStore } from 'pinia'

export type KlingTaskStatus = 'running' | 'completed' | 'error'

export interface KlingVideoTaskState {
  nodeId: string
  taskId: string
  model: string
  endpoint: string
  status: KlingTaskStatus
  createdAt: number
  updatedAt: number
  prompt?: string
  duration?: string
  aspectRatio?: string
  referenceCount?: number
  videoUrl?: string | null
  errorMessage?: string | null
}

const STORAGE_KEY = 'kling-video-task-store'

export const useKlingVideoTaskStore = defineStore('klingVideoTask', {
  state: () => ({
    tasks: [] as KlingVideoTaskState[]
  }),
  actions: {
    upsertTask(task: KlingVideoTaskState) {
      const index = this.tasks.findIndex((item) => item.nodeId === task.nodeId)
      if (index >= 0) {
        this.tasks[index] = { ...this.tasks[index], ...task, updatedAt: Date.now() }
      } else {
        this.tasks.unshift({ ...task, createdAt: task.createdAt || Date.now(), updatedAt: Date.now() })
      }
    },
    updateTask(nodeId: string, patch: Partial<KlingVideoTaskState>) {
      const index = this.tasks.findIndex((item) => item.nodeId === nodeId)
      if (index >= 0) {
        this.tasks[index] = { ...this.tasks[index], ...patch, updatedAt: Date.now() }
      }
    },
    clearTask(nodeId: string) {
      this.tasks = this.tasks.filter((item) => item.nodeId !== nodeId)
    },
    getTaskByNodeId(nodeId: string) {
      return this.tasks.find((item) => item.nodeId === nodeId)
    }
  },
  persist: {
    key: STORAGE_KEY,
    storage: localStorage,
    paths: ['tasks']
  }
})
