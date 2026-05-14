/**
 * 画布图片节点 / 分镜生成节点共用的「模型 + 画质 + 比例」→ generateImage 可选参数。
 */
export function buildImageModelGenerateOptions(
  modelId: string,
  quality: string,
  aspect: string
): {
  size?: string
  aspectRatio?: string
  imageSize?: string
} {
  const isDoubao = modelId.startsWith('doubao-seedream')
  const isGemini = modelId.includes('gemini') && modelId.includes('image')

  // Flow2 本地图片模型：从 modelId 中解析画质和尺寸
  const flow2Quality = parseFlow2ImageQuality(modelId)
  const flow2Aspect = parseFlow2ImageAspect(modelId)
  if (flow2Quality || flow2Aspect) {
    const q = flow2Quality || quality
    const ar = flow2Aspect || aspect
    if (modelId.includes('gemini-3.0-pro-image') || modelId.includes('gemini-3.1-flash-image')) {
      return { aspectRatio: ar, imageSize: q }
    }
    if (modelId.startsWith('imagen-4.0')) {
      return { aspectRatio: ar, imageSize: q }
    }
  }
  
  // Flow2 基础模型（无画质后缀），根据传入的 quality 动态生成参数
  if (modelId.includes('gemini-3.0-pro-image') || modelId.includes('gemini-3.1-flash-image')) {
    const ar = parseFlow2ImageAspect(modelId) || aspect
    return { aspectRatio: ar, imageSize: quality }
  }
  if (modelId.startsWith('imagen-4.0')) {
    const ar = parseFlow2ImageAspect(modelId) || aspect
    return { aspectRatio: ar, imageSize: quality }
  }

  if (isDoubao) {
    return { size: quality, aspectRatio: aspect }
  }
  if (isGemini) {
    return { aspectRatio: aspect, imageSize: quality }
  }
  /** 商店名「GPT-Image-2-All」对应 id 为 dall-e-3；官方仅允许三种 size，不能用任意 WxH */
  if (modelId === 'dall-e-3') {
    if (aspect === '1:1') return { size: '1024x1024' }
    if (aspect === '9:16' || aspect === '3:4') return { size: '1024x1792' }
    if (aspect === '16:9' || aspect === '21:9' || aspect === '4:3') return { size: '1792x1024' }
    return { size: '1792x1024' }
  }
  if (modelId.startsWith('gpt-image-2')) {
    const base = quality === '4K' ? 1792 : quality === '2K' ? 1536 : 1024
    if (aspect === '1:1') return { size: `${base}x${base}` }
    if (aspect === '16:9') return { size: `${base}x${Math.round((base * 9) / 16)}` }
    if (aspect === '9:16') return { size: `${Math.round((base * 9) / 16)}x${base}` }
    if (aspect === '4:3') return { size: `${base}x${Math.round((base * 3) / 4)}` }
    if (aspect === '3:4') return { size: `${Math.round((base * 3) / 4)}x${base}` }
    if (aspect === '21:9') return { size: `${base}x${Math.round((base * 9) / 21)}` }
    return { size: '1024x1024' }
  }
  if (modelId === 'z-image-turbo' || modelId.includes('qwen-image')) {
    const map: Record<string, string> = {
      '1:1': '1024x1024',
      '16:9': '1280x720',
      '9:16': '720x1280',
      '4:3': '1024x768',
      '3:4': '768x1024',
      '21:9': '1920x823'
    }
    return { size: map[aspect] || '1024x1024' }
  }
  return { size: '1024x1024', aspectRatio: aspect !== '1:1' ? aspect : undefined }
}

/** 从 Flow2 图片模型 ID 中解析画质等级 */
function parseFlow2ImageQuality(modelId: string): string {
  if (modelId.includes('-4k')) return '4K'
  if (modelId.includes('-2k')) return '2K'
  return ''
}

/** 从 Flow2 图片模型 ID 中解析宽高比 */
function parseFlow2ImageAspect(modelId: string): string {
  if (modelId.includes('-landscape-') || modelId.endsWith('-landscape')) return '16:9'
  if (modelId.includes('-portrait-') || modelId.endsWith('-portrait')) return '9:16'
  if (modelId.includes('-square-') || modelId.endsWith('-square')) return '1:1'
  if (modelId.includes('-four-three-') || modelId.endsWith('-four-three')) return '4:3'
  if (modelId.includes('-three-four-') || modelId.endsWith('-three-four')) return '3:4'
  return ''
}
