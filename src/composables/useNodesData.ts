import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import { useVueFlow } from '@vue-flow/core'

export function useNodesData<T = any>(nodeId: string): ComputedRef<T | null>
export function useNodesData<T = any>(nodeId: string[]): ComputedRef<T[]>
export function useNodesData<T = any>(nodeId: string | string[]): any {
  const { findNode } = useVueFlow()

  return computed(() => {
    if (!Array.isArray(nodeId)) {
      const node = findNode(nodeId)
      if (node) {
        return node.data as T
      }
      return null
    }

    const data: T[] = []
    for (const id of nodeId) {
      const node = findNode(id)
      if (node) {
        data.push(node.data as T)
      }
    }
    return data
  })
}
