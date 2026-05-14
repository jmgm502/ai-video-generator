import { computed, inject, type ComputedRef, type InjectionKey } from 'vue'

/** 鸟瞰（低缩放）：不挂载预览图 / 视频 / WebGL / 大块表单，减轻千级节点同屏卡顿 */
export type CanvasLodLevel = 'shell' | 'full'

/** 视口 zoom 低于该值时使用 shell UI（与 Vue Flow viewport.zoom 对齐） */
export const CANVAS_LOD_SHELL_ZOOM_THRESHOLD = 0.38

export const canvasLodLevelKey: InjectionKey<ComputedRef<CanvasLodLevel>> = Symbol('canvasLodLevel')
export const canvasViewportZoomKey: InjectionKey<ComputedRef<number>> = Symbol('canvasViewportZoom')

const fallbackLod: ComputedRef<CanvasLodLevel> = computed(() => 'full')
const fallbackZoom: ComputedRef<number> = computed(() => 1)

export function useCanvasLodLevel(): ComputedRef<CanvasLodLevel> {
  return inject(canvasLodLevelKey, fallbackLod)
}

export function useCanvasViewportZoom(): ComputedRef<number> {
  return inject(canvasViewportZoomKey, fallbackZoom)
}
