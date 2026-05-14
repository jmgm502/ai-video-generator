export type ModelPlatformKey =
  | 'jimeng'
  | 'gpt'
  | 'banana'
  | 'qwen'
  | 'grok'
  | 'sora'
  | 'veo'
  | 'deepseek'
  | 'kling'
  | 'gemini'
  | 'other'

export interface ModelPlatformBadge {
  key: ModelPlatformKey
  short: string
}

function detectModelPlatform(modelId: string, modelName: string): ModelPlatformKey {
  const id = String(modelId || '').toLowerCase()
  const name = String(modelName || '').toLowerCase()
  const source = `${id} ${name}`

  if (source.includes('kling')) return 'kling'
  if (source.includes('banana')) return 'banana'
  if (source.includes('gemini')) return 'gemini'
  if (source.includes('seedream') || source.includes('jimeng') || source.includes('即梦') || source.includes('doubao')) {
    return 'jimeng'
  }
  if (source.includes('qwen') || source.includes('z-image') || source.includes('千问') || source.includes('tongyi')) {
    return 'qwen'
  }
  if (source.includes('deepseek')) return 'deepseek'
  if (source.includes('grok')) return 'grok'
  if (source.includes('sora')) return 'sora'
  if (source.includes('veo')) return 'veo'
  if (source.includes('gpt') || source.includes('dall-e') || source.includes('openai')) return 'gpt'
  return 'other'
}

const PLATFORM_SHORT_LABEL: Record<ModelPlatformKey, string> = {
  jimeng: 'JM',
  gpt: 'GPT',
  banana: 'BN',
  qwen: 'QW',
  grok: 'GK',
  sora: 'SO',
  veo: 'VE',
  deepseek: 'DS',
  kling: 'KL',
  gemini: 'GM',
  other: 'AI'
}

export function getModelPlatformBadge(modelId: string, modelName: string): ModelPlatformBadge {
  const key = detectModelPlatform(modelId, modelName)
  return {
    key,
    short: PLATFORM_SHORT_LABEL[key]
  }
}
