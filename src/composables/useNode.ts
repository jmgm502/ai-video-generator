import type { ComputedRef, Ref } from 'vue'
import { computed, inject, ref } from 'vue'
import type { Node } from '@vue-flow/core'
import { useVueFlow } from '@vue-flow/core'

export function useNode(nodeId: string): {
  node: ComputedRef<Node | undefined>
  nodeEl: Ref<HTMLElement | null>
} {
  const { findNode } = useVueFlow()

  const node = computed(() => findNode(nodeId))
  const nodeEl = ref<HTMLElement | null>(null)

  return {
    node,
    nodeEl
  }
}

export function useNodes(): {
  nodes: Ref<Node[]>
  findNode: (id: string) => Node | undefined
  getNodes: () => Node[]
} {
  const { nodes, findNode } = useVueFlow()

  return {
    nodes,
    findNode,
    getNodes: () => nodes.value
  }
}

export interface NodeUpdate {
  id: string
  type?: string
  label?: string
  position?: { x: number, y: number }
  data?: Record<string, any>
  style?: Record<string, any>
  computedPosition?: { x: number, y: number }
}

export function useNodeActions(): {
  updateNode: (id: string, updates: Partial<Node>) => void
  removeNode: (id: string) => void
  addNode: (node: Node) => void
  updateNodeData: (id: string, data: Record<string, any>) => void
} {
  const { nodes, findNode, addNodes } = useVueFlow()

  const updateNode = (id: string, updates: Partial<Node>) => {
    const nodeIndex = nodes.value.findIndex(n => n.id === id)
    if (nodeIndex === -1) return

    const updatedNode = { ...nodes.value[nodeIndex], ...updates }
    nodes.value = [
      ...nodes.value.slice(0, nodeIndex),
      updatedNode,
      ...nodes.value.slice(nodeIndex + 1)
    ]
  }

  const removeNode = (id: string) => {
    nodes.value = nodes.value.filter(n => n.id !== id)
  }

  const addNode = (node: Node) => {
    addNodes([node])
  }

  const updateNodeData = (id: string, data: Record<string, any>) => {
    const nodeIndex = nodes.value.findIndex(n => n.id === id)
    if (nodeIndex === -1) return

    const updatedNode = {
      ...nodes.value[nodeIndex],
      data: { ...nodes.value[nodeIndex].data, ...data }
    }
    nodes.value = [
      ...nodes.value.slice(0, nodeIndex),
      updatedNode,
      ...nodes.value.slice(nodeIndex + 1)
    ]
  }

  return {
    updateNode,
    removeNode,
    addNode,
    updateNodeData
  }
}
