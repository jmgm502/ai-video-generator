import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { InjectionKey, Ref } from 'vue'
import { useUserStore } from '@/stores/userStore'

export interface PerformanceWarning {
  type: 'node-count' | 'memory' | 'render-time'
  message: string
  level: 'warning' | 'info'
}

export interface CanvasPerformanceConfig {
  maxNodesForAnimations: number
  maxNodesForFullRender: number
  viewportPadding: number
}

const DEFAULT_CONFIG: CanvasPerformanceConfig = {
  maxNodesForAnimations: 20,
  maxNodesForFullRender: 100,
  viewportPadding: 100
}

export const canvasPerformanceConfigKey: InjectionKey<CanvasPerformanceConfig> = Symbol('canvasPerformanceConfig')
export const canvasPerformanceKey: InjectionKey<ReturnType<typeof useCanvasPerformance>> = Symbol('canvasPerformance')

export function useCanvasPerformance(nodeCount: Ref<number>, viewport: Ref<{ x: number; y: number; zoom: number }>) {
  const userStore = useUserStore()
  const warnings = ref<PerformanceWarning[]>([])
  const lastFrameTime = ref(0)
  const frameCount = ref(0)
  const fps = ref(60)
  const lastFPSUpdate = ref(0)
  let frameObserver: number | null = null

  const shouldAnimateEdges = computed(() => nodeCount.value <= 20)
  const shouldUseShellMode = computed(() => viewport.value.zoom < userStore.canvasLodShellZoomThreshold)

  function addWarning(type: PerformanceWarning['type'], message: string, level: PerformanceWarning['level'] = 'warning') {
    const existing = warnings.value.find(w => w.type === type && w.message === message)
    if (!existing) {
      warnings.value.push({ type, message, level })
    }
  }

  function removeWarning(type: PerformanceWarning['type']) {
    warnings.value = warnings.value.filter(w => w.type !== type)
  }

  function checkNodeCount() {
    if (nodeCount.value > 50) {
      addWarning('node-count', `当前有 ${nodeCount.value} 个节点，建议分组或减少数量`, 'info')
    } else {
      removeWarning('node-count')
    }
  }

  function measureFrame() {
    const now = performance.now()
    if (lastFPSUpdate.value === 0) {
      lastFPSUpdate.value = now
      return
    }

    frameCount.value++
    const elapsed = now - lastFPSUpdate.value
    if (elapsed >= 1000) {
      fps.value = Math.round((frameCount.value * 1000) / elapsed)
      frameCount.value = 0
      lastFPSUpdate.value = now

      if (fps.value < 30) {
        addWarning('render-time', `帧率较低 (${fps.value} FPS)，建议简化画布`, 'warning')
      } else if (fps.value < 45) {
        addWarning('render-time', `帧率中等 (${fps.value} FPS)`, 'info')
      } else {
        removeWarning('render-time')
      }
    }
  }

  function startPerformanceMonitoring() {
    const loop = () => {
      measureFrame()
      frameObserver = requestAnimationFrame(loop)
    }
    frameObserver = requestAnimationFrame(loop)
  }

  function stopPerformanceMonitoring() {
    if (frameObserver !== null) {
      cancelAnimationFrame(frameObserver)
      frameObserver = null
    }
  }

  function isNodeInViewport(
    nodePosition: { x: number; y: number },
    nodeSize: { width: number; height: number },
    viewportBounds: { x: number; y: number; width: number; height: number }
  ): boolean {
    const nodeLeft = nodePosition.x
    const nodeRight = nodePosition.x + nodeSize.width
    const nodeTop = nodePosition.y
    const nodeBottom = nodePosition.y + nodeSize.height

    const viewportLeft = viewportBounds.x - config.viewportPadding
    const viewportRight = viewportBounds.x + viewportBounds.width + config.viewportPadding
    const viewportTop = viewportBounds.y - config.viewportPadding
    const viewportBottom = viewportBounds.y + viewportBounds.height + config.viewportPadding

    return nodeRight >= viewportLeft && nodeLeft <= viewportRight && nodeBottom >= viewportTop && nodeTop <= viewportBottom
  }

  onMounted(() => {
    startPerformanceMonitoring()
  })

  onBeforeUnmount(() => {
    stopPerformanceMonitoring()
  })

  return {
    warnings,
    fps,
    shouldAnimateEdges,
    shouldUseShellMode,
    checkNodeCount,
    isNodeInViewport
  }
}

export default useCanvasPerformance
