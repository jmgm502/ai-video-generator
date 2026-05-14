import type { Connection, Edge } from '@vue-flow/core'
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'

export interface UseNodeConnectionsParams {
  handleType?: 'source' | 'target'
  nodeId?: string
}

export interface NodeConnection {
  nodeId: string
  handleId?: string
  handleType: 'source' | 'target'
  connection: Connection
}

export function useNodeConnections(params: UseNodeConnectionsParams = {}): {
  connections: Ref<NodeConnection[]>
  findNodeConnections: (targetNodeId: string, handleType?: 'source' | 'target') => NodeConnection[]
} {
  const { edges } = useVueFlow()

  const { handleType, nodeId } = params

  const connections = computed<NodeConnection[]>(() => {
    const result: NodeConnection[] = []

    for (const edge of edges.value) {
      if (handleType === 'source') {
        if (edge.source === nodeId) {
          result.push({
            nodeId: edge.source,
            handleId: edge.sourceHandle || undefined,
            handleType: 'source',
            connection: {
              source: edge.source,
              target: edge.target,
              sourceHandle: edge.sourceHandle,
              targetHandle: edge.targetHandle,
            },
          })
        }
      } else if (handleType === 'target') {
        if (edge.target === nodeId) {
          result.push({
            nodeId: edge.target,
            handleId: edge.targetHandle || undefined,
            handleType: 'target',
            connection: {
              source: edge.source,
              target: edge.target,
              sourceHandle: edge.sourceHandle,
              targetHandle: edge.targetHandle,
            },
          })
        }
      } else {
        if (edge.source === nodeId) {
          result.push({
            nodeId: edge.source,
            handleId: edge.sourceHandle || undefined,
            handleType: 'source',
            connection: {
              source: edge.source,
              target: edge.target,
              sourceHandle: edge.sourceHandle,
              targetHandle: edge.targetHandle,
            },
          })
        }
        if (edge.target === nodeId) {
          result.push({
            nodeId: edge.target,
            handleId: edge.targetHandle || undefined,
            handleType: 'target',
            connection: {
              source: edge.source,
              target: edge.target,
              sourceHandle: edge.sourceHandle,
              targetHandle: edge.targetHandle,
            },
          })
        }
      }
    }

    return result
  })

  const findNodeConnections = (
    targetNodeId: string,
    targetHandleType?: 'source' | 'target'
  ): NodeConnection[] => {
    return connections.value.filter((conn) => {
      if (conn.nodeId !== targetNodeId) return false
      if (targetHandleType && conn.handleType !== targetHandleType) return false
      return true
    })
  }

  return {
    connections,
    findNodeConnections,
  }
}

export function useHandleConnections(handleType: 'source' | 'target', handleId?: string): {
  connections: ComputedRef<Connection[]>
} {
  const { edges } = useVueFlow()

  const connections = computed<Connection[]>(() => {
    const result: Connection[] = []

    for (const edge of edges.value) {
      if (handleType === 'source') {
        if (edge.sourceHandle === handleId || (!handleId && !edge.sourceHandle)) {
          result.push({
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
          })
        }
      } else if (handleType === 'target') {
        if (edge.targetHandle === handleId || (!handleId && !edge.targetHandle)) {
          result.push({
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
          })
        }
      }
    }

    return result
  })

  return {
    connections,
  }
}
