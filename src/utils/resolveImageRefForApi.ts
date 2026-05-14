/**
 * 将画布节点中的图片引用转为可随 HTTP / JSON 发往网关的形式。
 * 本地 file://（落盘后的分镜图等）在 Electron 下读盘为 data URL；远端 API 无法直接访问用户磁盘路径。
 * 对于 http/https URL，也转换为 base64 格式，以提高兼容性。
 */
let warnedFileResolveFail = false
let warnedHttpFetchFail = false

async function urlToDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(new Error('Failed to read blob'))
      r.readAsDataURL(blob)
    })
  } catch (e) {
    if (!warnedHttpFetchFail) {
      warnedHttpFetchFail = true
      console.warn('[resolveImageRefForApi] 远程参考图读取失败，尝试原样发送', e)
    }
    return url
  }
}

export async function resolveImageRefForApi(url: string): Promise<string> {
  const u = String(url ?? '').trim()
  if (!u) return u
  
  // 已经是 data URL 了，直接返回
  if (u.startsWith('data:')) {
    return u
  }
  
  // HTTP/HTTPS URL，转换为 base64
  if (u.startsWith('http://') || u.startsWith('https://')) {
    return await urlToDataUrl(u)
  }
  
  // 本地文件路径
  if (u.startsWith('file://')) {
    const api = typeof window !== 'undefined' ? window.electronAPI?.file : undefined
    if (api?.readLocalFileAsDataUrl) {
      const res = await api.readLocalFileAsDataUrl(u)
      if (res?.success && typeof res.data === 'string' && res.data.startsWith('data:')) {
        return res.data
      }
      if (!warnedFileResolveFail) {
        warnedFileResolveFail = true
        console.warn('[resolveImageRefForApi] 本地参考图读取失败，远端可能无法使用', res?.message ?? '')
      }
    }
  }
  
  return u
}
