import type { Ref } from 'vue'
import { ref } from 'vue'
import type { XYPosition } from '@vue-flow/core'
import { useVueFlow } from '@vue-flow/core'

export interface UseDragOptions {
  onStart?: (event: { node: any, nodeId: string }) => void
  onDrag?: (event: { node: any, nodeId: string, position: XYPosition }) => void
  onStop?: (event: { node: any, nodeId: string, position: XYPosition }) => void
}

export function useDrag(options: UseDragOptions = {}) {
  const { nodes } = useVueFlow()

  const isDragging = ref(false)
  const draggedNodeId = ref<string | null>(null)

  const updateNodePosition = (
    nodeId: string,
    position: XYPosition
  ) => {
    const nodeIndex = nodes.value.findIndex(n => n.id === nodeId)
    if (nodeIndex === -1) return

    const updatedNode = {
      ...nodes.value[nodeIndex],
      position
    }

    nodes.value = [
      ...nodes.value.slice(0, nodeIndex),
      updatedNode,
      ...nodes.value.slice(nodeIndex + 1)
    ]
  }

  const getNodePosition = (nodeId: string): XYPosition | undefined => {
    const node = nodes.value.find(n => n.id === nodeId)
    return node?.position
  }

  const getSelectedNodes = (): any[] => {
    return nodes.value.filter(n => (n as any).selected)
  }

  return {
    isDragging,
    draggedNodeId,
    updateNodePosition,
    getNodePosition,
    getSelectedNodes
  }
}
