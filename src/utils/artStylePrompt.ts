import type { ArtStyle } from '@/stores/artStyleStore'
import { i18n } from '@/i18n'
import { resolveArtStyleDescriptionGlobal, resolveArtStyleLabelGlobal } from '@/utils/artStyleLocale'

/**
 * 与 Step2 分镜生图一致：将所选画面风格写入模型提示词前缀（文案随界面语言）。
 */
export function buildArtStylePromptPrefix(artStyles: ArtStyle[], selectedStyle: string): string {
  const info = artStyles.find(s => s.value === selectedStyle)
  if (!info || info.value === 'none') return ''
  const label = resolveArtStyleLabelGlobal(info)
  const description = resolveArtStyleDescriptionGlobal(info).trim()
  const body = description.length > 0 ? `${label}：${description}` : `${label}`
  const header = i18n.global.t('canvas.artStyles.promptHeader')
  return `${header}\n${body}\n\n`
}
