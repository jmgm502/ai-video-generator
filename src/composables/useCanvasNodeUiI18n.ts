import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/** 节点标题随语言刷新：存入 data 的稳定 i18n 键（可选占位参数） */
export interface CanvasNodeTitleI18n {
  key: string
  params?: Record<string, string | number>
}

/** 画布节点内「供应商」分组 value → 展示名（随语言切换） */
export function useApiGroupLabelMap() {
  const { t } = useI18n()
  return computed(() => ({
    youshang: t('canvas.nodeUi.common.apiGroupYoushang'),
    official: t('canvas.nodeUi.common.apiGroupOfficial'),
    flow2: t('canvas.nodeUi.common.apiGroupFlow2'),
    aliyun: t('canvas.nodeUi.common.apiGroupAliyun'),
  }) as Record<string, string>)
}

export function useCanvasNodeCommon() {
  const { t } = useI18n()
  const apiGroupLabelMap = useApiGroupLabelMap()
  return {
    t,
    apiGroupLabelMap,
    notChosenModel: () => t('canvas.nodeUi.common.notChosenModel'),
    modelGroupFallback: () => t('canvas.nodeUi.common.modelGroup'),
  }
}

function hasParams(p: Record<string, string | number> | undefined): p is Record<string, string | number> {
  return Boolean(p && Object.keys(p).length > 0)
}

/** 章节识别 / 总资产等：无 `nodeTitleI18n` 时仍以 fallback 译文为准（避免持久化中文 label 挡住语言切换） */
export interface CanvasNodeDisplayTitleOpts {
  preferFallbackOverPersisted?: boolean
}

/** 有 `nodeTitleI18n` 时按当前语言渲染；其余见 `preferFallbackOverPersisted` */
export function useCanvasNodeTitle() {
  const { t } = useI18n()

  function canvasNodeDisplayTitle(
    data: { label?: string; nodeTitleI18n?: CanvasNodeTitleI18n | null },
    fallbackKey?: string,
    opts?: CanvasNodeDisplayTitleOpts
  ): string {
    const i18n = data.nodeTitleI18n
    if (i18n?.key) {
      if (hasParams(i18n.params)) return t(i18n.key, i18n.params)
      return t(i18n.key)
    }
    const raw = String(data.label ?? '').trim()
    const preferFallback = opts?.preferFallbackOverPersisted === true
    if (preferFallback && fallbackKey) return t(fallbackKey)
    if (raw) return raw
    return fallbackKey ? t(fallbackKey) : ''
  }

  return { canvasNodeDisplayTitle }
}
