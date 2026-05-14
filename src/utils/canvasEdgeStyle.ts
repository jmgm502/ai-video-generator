/** 默认 3px、最大 5px，与界面设置一致 */
export const DEFAULT_CANVAS_EDGE_STROKE_WIDTH = 3
export const DEFAULT_CANVAS_EDGE_COLOR = '#409eff'

export function canvasEdgeStyleFromWidth(width: number, color?: string): { stroke: string; strokeWidth: number } {
  const w = Number.isFinite(width) ? width : DEFAULT_CANVAS_EDGE_STROKE_WIDTH
  const c = String(color ?? '').trim() || DEFAULT_CANVAS_EDGE_COLOR
  return { stroke: c, strokeWidth: Math.max(1, Math.min(5, Math.round(w))) }
}
