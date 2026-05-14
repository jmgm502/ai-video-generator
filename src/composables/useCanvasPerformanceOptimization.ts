import { ref, computed, watch, type Ref } from 'vue'

/**
 * 性能优化 Hook
 * 提供虚拟滚动、懒加载、防抖节流等优化功能
 */
export function useCanvasPerformanceOptimization() {
  // 节点可见性状态
  const visibleNodeIds = ref<Set<string>>(new Set())
  
  // 视口状态
  const viewport = ref({ x: 0, y: 0, zoom: 1 })
  
  // 节点位置缓存
  const nodePositionsCache = ref<Map<string, { x: number; y: number; width: number; height: number }>>(new Map())
  
  // 性能配置
  const performanceConfig = ref({
    // 视口外缓冲区域大小（像素）
    viewportBuffer: 200,
    // 最大可见节点数
    maxVisibleNodes: 100,
    // 是否启用虚拟滚动
    enableVirtualScroll: true,
    // 是否启用懒加载
    enableLazyLoad: true,
    // 懒加载延迟时间（ms）
    lazyLoadDelay: 100
  })

  /**
   * 计算可见节点
   * 根据视口位置和缩放级别，计算哪些节点在可见区域内
   */
  function calculateVisibleNodes(
    nodes: Array<{ id: string; position: { x: number; y: number }; dimensions?: { width: number; height: number } }>,
    currentViewport: { x: number; y: number; zoom: number }
  ) {
    if (!performanceConfig.value.enableVirtualScroll) {
      // 如果不启用虚拟滚动，返回所有节点
      visibleNodeIds.value = new Set(nodes.map(n => n.id))
      return visibleNodeIds.value
    }

    viewport.value = currentViewport
    
    // 视口边界
    const viewportLeft = -currentViewport.x / currentViewport.zoom
    const viewportTop = -currentViewport.y / currentViewport.zoom
    const viewportRight = (window.innerWidth - currentViewport.x) / currentViewport.zoom
    const viewportBottom = (window.innerHeight - currentViewport.y) / currentViewport.zoom

    // 添加缓冲区域
    const buffer = performanceConfig.value.viewportBuffer / currentViewport.zoom
    const left = viewportLeft - buffer
    const top = viewportTop - buffer
    const right = viewportRight + buffer
    const bottom = viewportBottom + buffer

    const visibleIds = new Set<string>()
    
    for (const node of nodes) {
      const pos = node.position
      const width = node.dimensions?.width || 220
      const height = node.dimensions?.height || 160

      // 检查节点是否与可见区域相交
      const nodeRight = pos.x + width
      const nodeBottom = pos.y + height

      if (
        pos.x <= right &&
        nodeRight >= left &&
        pos.y <= bottom &&
        nodeBottom >= top
      ) {
        visibleIds.add(node.id)
      }

      // 限制最大可见节点数
      if (visibleIds.size >= performanceConfig.value.maxVisibleNodes) {
        break
      }
    }

    visibleNodeIds.value = visibleIds
    return visibleIds
  }

  /**
   * 检查节点是否可见
   */
  function isNodeVisible(nodeId: string): boolean {
    return visibleNodeIds.value.has(nodeId)
  }

  /**
   * 缓存节点位置
   */
  function cacheNodePosition(
    nodeId: string,
    position: { x: number; y: number; width: number; height: number }
  ) {
    nodePositionsCache.value.set(nodeId, position)
  }

  /**
   * 获取缓存的节点位置
   */
  function getCachedNodePosition(nodeId: string) {
    return nodePositionsCache.value.get(nodeId)
  }

  /**
   * 清除缓存
   */
  function clearCache() {
    nodePositionsCache.value.clear()
    visibleNodeIds.value.clear()
  }

  /**
   * 更新性能配置
   */
  function updatePerformanceConfig(config: Partial<typeof performanceConfig.value>) {
    performanceConfig.value = {
      ...performanceConfig.value,
      ...config
    }
  }

  return {
    visibleNodeIds,
    viewport,
    performanceConfig,
    calculateVisibleNodes,
    isNodeVisible,
    cacheNodePosition,
    getCachedNodePosition,
    clearCache,
    updatePerformanceConfig
  }
}

/**
 * 防抖 Hook
 */
export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return ((...args: any[]) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }) as T
}

/**
 * 节流 Hook
 */
export function useThrottle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): T {
  let inThrottle = false

  return ((...args: any[]) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }) as T
}
