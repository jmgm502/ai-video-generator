import type { Ref, ComputedRef } from 'vue'
import { ref, computed } from 'vue'
import type { Connection, HandleType } from '@vue-flow/core'
import { useVueFlow } from '@vue-flow/core'

export interface ConnectionState {
  status: 'pending' | 'valid' | 'invalid' | null
  isValid: boolean
}

export function useConnection(): {
  position: Ref<{ x: number, y: number }>
  startHandle: ComputedRef<{ nodeId: string, handleId: string | null, type: HandleType } | null>
  endHandle: ComputedRef<{ nodeId: string, handleId: string | null, type: HandleType } | null>
  status: ComputedRef<ConnectionState['status']>
  isValid: ComputedRef<boolean>
} {
  const { connectionLookup } = useVueFlow()

  const position = ref({ x: 0, y: 0 })

  const startHandle = computed(() => {
    return null
  })

  const endHandle = computed(() => {
    return null
  })

  const status = computed(() => {
    return null
  })

  const isValid = computed(() => {
    return status.value === 'valid'
  })

  return {
    position,
    startHandle,
    endHandle,
    status,
    isValid
  }
}

export function useConnectionActions(): {
  onConnect: (callback: (connection: Connection) => void) => void
  onConnectionStart: (callback: (info: { nodeId: string, handleId: string | null, type: HandleType }) => void) => void
  onConnectionEnd: (callback: () => void) => void
} {
  const { onConnect: vueFlowOnConnect } = useVueFlow()

  const onConnect = (callback: (connection: Connection) => void) => {
    vueFlowOnConnect((connection) => {
      callback(connection)
    })
  }

  return {
    onConnect,
    onConnectionStart: () => {},
    onConnectionEnd: () => {}
  }
}
