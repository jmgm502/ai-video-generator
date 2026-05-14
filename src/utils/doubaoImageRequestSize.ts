/**
 * 豆包/即梦 Seedream 类：`size` 传 1K/2K/4K 时服务端多为默认比例（常为 1:1）。
 * 需改为「宽x高」像素串才能按画布所选比例出图（与火山文档中按宽高比给像素一致）。
 */
export function resolveDoubaoImageRequestSize(
  size: string | undefined,
  aspectRatio: string | undefined
): string {
  const raw = String(size ?? '2K').trim()
  const q = raw.toUpperCase()
  const isTier = q === '1K' || q === '2K' || q === '4K'
  if (!isTier) return raw

  const ar = String(aspectRatio ?? '1:1').trim() || '1:1'
  const long = q === '1K' ? 1024 : q === '4K' ? 3840 : 2048
  const parts = ar.split(':').map((s) => parseFloat(s.trim()))
  const aw = parts[0]
  const ah = parts[1]
  if (!Number.isFinite(aw) || !Number.isFinite(ah) || aw <= 0 || ah <= 0) {
    return `${long}x${long}`
  }
  if (aw >= ah) {
    const w = long
    const h = Math.max(64, Math.round((long * ah) / aw))
    return `${w}x${h}`
  }
  const h = long
  const w = Math.max(64, Math.round((long * aw) / ah))
  return `${w}x${h}`
}
