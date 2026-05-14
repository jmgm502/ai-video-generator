import { ref, computed, type Ref } from 'vue'
import { cloneGraphStateForSnapshot } from '@/utils/graphSnapshot'

export interface HistorySnapshot {
  nodes: any[]
  edges: any[]
}

export function useHistory(options: { 
  maxHistory?: number,
  nodes: Ref<any[]>,
  edges: Ref<any[]>
}): {
  past: Ref<HistorySnapshot[]>
  future: Ref<HistorySnapshot[]>
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
  pushState: () => void
  pushStateBeforeChange: () => void
  pushUndoSnapshot: (snapshot: HistorySnapshot, options?: { skipDeepClone?: boolean }) => void
  undo: () => boolean
  redo: () => boolean
  clear: () => void
} {
  const { maxHistory = 20, nodes, edges } = options

  const past = ref<HistorySnapshot[]>([])
  const future = ref<HistorySnapshot[]>([])
  let isUndoing = false
  let isRedoing = false

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  const createSnapshot = (): HistorySnapshot => {
    try {
      return {
        nodes: cloneGraphStateForSnapshot(nodes.value),
        edges: cloneGraphStateForSnapshot(edges.value)
      }
    } catch (e) {
      console.error('[useHistory] createSnapshot failed', e)
      return { nodes: [], edges: [] }
    }
  }

  const pushSnapshot = (history: HistorySnapshot[], snapshot: HistorySnapshot): HistorySnapshot[] => {
    return [...history, snapshot].slice(-maxHistory)
  }

  // 在变更后记录（用于显式调用）
  const pushState = () => {
    if (isUndoing || isRedoing) return
    const snapshot = createSnapshot()
    past.value = pushSnapshot(past.value, snapshot)
    future.value = []
  }

  // 在变更前记录（推荐）
  const pushStateBeforeChange = () => {
    if (isUndoing || isRedoing) return
    const snapshot = createSnapshot()
    past.value = pushSnapshot(past.value, snapshot)
    future.value = []
  }

  /**
   * 压入「已构造好」的快照（如节点拖拽结束：先还原移动前坐标再入栈）。
   * `skipDeepClone`: 调用方已用 `cloneGraphStateForSnapshot` 得到独立副本时再设为 true，
   * 避免对整图二次 JSON 序列化（大图 Base64 时峰值内存几乎翻倍）。
   */
  const pushUndoSnapshot = (snapshot: HistorySnapshot, options?: { skipDeepClone?: boolean }) => {
    if (isUndoing || isRedoing) return
    const skip = options?.skipDeepClone === true
    past.value = pushSnapshot(past.value, {
      nodes: skip ? snapshot.nodes : cloneGraphStateForSnapshot(snapshot.nodes),
      edges: skip ? snapshot.edges : cloneGraphStateForSnapshot(snapshot.edges)
    })
    future.value = []
  }

  const undo = (): boolean => {
    if (past.value.length === 0) {
      return false
    }

    isUndoing = true
    try {
      const target = past.value[past.value.length - 1]
      const currentSnapshot = createSnapshot()
      const nextPast = past.value.slice(0, -1)

      nodes.value = target.nodes
      edges.value = target.edges
      past.value = nextPast
      future.value = pushSnapshot(future.value, currentSnapshot)
    } finally {
      isUndoing = false
    }

    return true
  }

  const redo = (): boolean => {
    if (future.value.length === 0) {
      return false
    }

    isRedoing = true
    try {
      const target = future.value[future.value.length - 1]
      const currentSnapshot = createSnapshot()
      const nextFuture = future.value.slice(0, -1)

      nodes.value = target.nodes
      edges.value = target.edges
      past.value = pushSnapshot(past.value, currentSnapshot)
      future.value = nextFuture
    } finally {
      isRedoing = false
    }

    return true
  }

  const clear = () => {
    past.value = []
    future.value = []
  }

  return {
    past,
    future,
    canUndo,
    canRedo,
    pushState,
    pushStateBeforeChange,
    pushUndoSnapshot,
    undo,
    redo,
    clear
  }
}
