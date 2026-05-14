import { computed, onUnmounted, ref } from 'vue'

/**
 * 画布节点「生成中」伪进度（与请求解耦，用于提示用户等待）。
 * 与 VideoCanvasNode 原逻辑一致：按时间推进，上限约 maxRatio（默认 96%）。
 */
export function useSimulatedGenerationProgress(options?: {
  durationMs?: number
  maxRatio?: number
  tickMs?: number
}) {
  const durationMs = options?.durationMs ?? 90_000
  const maxRatio = options?.maxRatio ?? 0.96
  const tickMs = options?.tickMs ?? 180

  const startedAt = ref<number | null>(null)
  const now = ref(Date.now())
  let timer: number | null = null

  const progressPercent = computed(() => {
    if (startedAt.value == null) return 0
    const elapsed = Math.max(0, now.value - startedAt.value)
    const progress = Math.min(elapsed / durationMs, maxRatio)
    return Math.round(progress * 100)
  })

  function start() {
    startedAt.value = Date.now()
    now.value = Date.now()
    if (timer !== null) window.clearInterval(timer)
    timer = window.setInterval(() => {
      now.value = Date.now()
    }, tickMs)
  }

  function stop() {
    if (timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
    startedAt.value = null
  }

  onUnmounted(() => {
    stop()
  })

  return { progressPercent, start, stop }
}
