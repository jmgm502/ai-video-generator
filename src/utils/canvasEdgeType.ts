/**
 * 与设置中「直线/曲线/直角阶梯/平滑阶梯」对应到 @vue-flow/core 的边类型
 * - 直线：straight（直接连接）
 * - 曲线：default（贝塞尔曲线）
 * - 直角阶梯：step（90度直角折线）
 * - 平滑阶梯：smoothstep（有弧度的直角折线）
 */
export function vueFlowEdgeTypeForSetting(style: 'straight' | 'smooth' | 'step' | 'smoothstep'): 'straight' | 'default' | 'step' | 'smoothstep' {
  switch (style) {
    case 'straight': return 'straight'
    case 'smooth': return 'default'
    case 'step': return 'step'
    case 'smoothstep': return 'smoothstep'
  }
}
