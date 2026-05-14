import type { Ref, ComputedRef } from 'vue'
import { computed, ref } from 'vue'
import type { Connection, Edge } from '@vue-flow/core'
import { useVueFlow } from '@vue-flow/core'

export function useEdge(edgeId: string): {
  edge: ComputedRef<any>
  edgeEl: Ref<HTMLElement | null>
} {
  const { findEdge } = useVueFlow()

  const edge = computed(() => findEdge(edgeId))
  const edgeEl = ref<HTMLElement | null>(null)

  return {
    edge,
    edgeEl
  }
}

export function useEdges(): {
  edges: Ref<any[]>
  findEdge: (id: string) => any
  getEdge: (id: string) => any
  getEdges: () => any[]
} {
  const { edges, findEdge } = useVueFlow()

  return {
    edges,
    findEdge,
    getEdge: findEdge,
    getEdges: () => edges.value
  }
}

export interface EdgeUpdate {
  id: string
  type?: string
  label?: string
  style?: Record<string, any>
  animated?: boolean
  data?: Record<string, any>
}

export function useEdgeActions(): {
  updateEdge: (id: string, updates: EdgeUpdate) => void
  removeEdge: (id: string) => void
  addEdge: (connection: Connection, edgeOptions?: Partial<Edge>) => Edge
} {
  const { edges } = useVueFlow()

  const updateEdge = (id: string, updates: EdgeUpdate) => {
    const edgeIndex = edges.value.findIndex(e => e.id === id)
    if (edgeIndex === -1) return

    const updatedEdge = { ...edges.value[edgeIndex], ...updates }
    edges.value = [
      ...edges.value.slice(0, edgeIndex),
      updatedEdge,
      ...edges.value.slice(edgeIndex + 1)
    ]
  }

  const removeEdge = (id: string) => {
    edges.value = edges.value.filter(e => e.id !== id)
  }

  const addEdge = (connection: Connection, edgeOptions?: Partial<Edge>): Edge => {
    const newEdge: any = {
      id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: 'default',
      animated: true,
      ...edgeOptions
    }
    edges.value = [...edges.value, newEdge] as any
    return newEdge
  }

  return {
    updateEdge,
    removeEdge,
    addEdge
  }
}
