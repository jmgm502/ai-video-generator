import type { ComposerTranslation } from 'vue-i18n'
import type { ArtStyle } from '@/stores/artStyleStore'
import { i18n } from '@/i18n'

type Translate = ComposerTranslation

function presetKey(style: ArtStyle): string {
  return `canvas.artStyles.presets.${style.value}`
}

/** 画布顶部网格、下拉、提示词前缀等统一用此解析（built-in：`preset`，自定义：沿用用户 label/desc） */
export function resolveArtStyleLabel(style: ArtStyle, t: Translate): string {
  if (style.preset) return String(t(`${presetKey(style)}.label`))
  return style.label
}

export function resolveArtStyleDescription(style: ArtStyle, t: Translate): string {
  if (style.preset) return String(t(`${presetKey(style)}.desc`))
  return style.description ?? ''
}

/** Pinia / 工具函数内无组件 `t` 时使用 */
export function resolveArtStyleLabelGlobal(style: ArtStyle): string {
  return resolveArtStyleLabel(style, i18n.global.t as Translate)
}

export function resolveArtStyleDescriptionGlobal(style: ArtStyle): string {
  return resolveArtStyleDescription(style, i18n.global.t as Translate)
}
