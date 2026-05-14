import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ModelConfig {
  id: string
  name: string
  description: string
  price?: string
}

export interface APIConfig {
  apiKey: string
  baseURL: string
  selectedModel: string
  maxTokens: number | null
  unlimitedTokens: boolean
  temperature: number
}

export type ModelType = 'text' | 'image' | 'video' | 'vision'

/** 界面所选供应商分组：决定请求走优尚网关还是 Flow2 本地（与设置里「正在编辑」的标签无关） */
export type ApiModelGroup = 'youshang' | 'flow2' | 'aliyun'

export const useApiConfigStore = defineStore(
  'apiConfig',
  () => {
    /** 设置抽屉：当前展示的表单（仅 UI），不影响运行时路由 */
    const configType = ref<'official' | 'flow2'>('official')
    
    const officialConfig = ref<APIConfig>({
      apiKey: '',
      baseURL: 'https://api.ussn.cn/v1',
      selectedModel: 'gemini-3.1-pro-preview',
      maxTokens: null,
      unlimitedTokens: true,
      temperature: 0.7
    })
    
    const customConfig = ref<APIConfig>({
      apiKey: '',
      baseURL: 'http://localhost:8001',
      selectedModel: 'gpt-3.5-turbo',
      maxTokens: 4096,
      unlimitedTokens: false,
      temperature: 0.7
    })
    
    const aliyunConfig = ref<APIConfig>({
      apiKey: '',
      baseURL: 'https://dashscope.aliyuncs.com/api/v1',
      selectedModel: 'qwen-image-edit-max-2026-01-16',
      maxTokens: null,
      unlimitedTokens: true,
      temperature: 0.7
    })
    
    const currentModelType = ref<ModelType>('text')
    
    const documentUploadModel = ref('deepseek-chat')
    const storyboardPromptModel = ref('deepseek-chat')
    /** 工坊 Step1 文本、Step2 提示词优化等默认使用的 API 分组（与设置「文本模型」分组同步） */
    const textApiModelGroup = ref<ApiModelGroup>('youshang')

    const imageModelGroup = ref<ApiModelGroup>('youshang')
    const imageModel = ref('gpt-image-2')
    /** 每个分组独立记住选中的模型 */
    const imageModelByGroup = ref<Record<ApiModelGroup, string>>({
      youshang: 'gpt-image-2',
      flow2: '',
      aliyun: 'qwen-image-edit-max-2026-01-16'
    })
    
    const videoModel = ref('sora')
    const videoModelByGroup = ref<Record<ApiModelGroup, string>>({
      youshang: 'sora',
      flow2: '',
      aliyun: ''
    })
    const videoModelGroup = ref<ApiModelGroup>('youshang')
    
    const visionModelGroup = ref<ApiModelGroup>('youshang')
    const visionModel = ref('gemini-3-flash-preview')
    const visionModelByGroup = ref<Record<ApiModelGroup, string>>({
      youshang: 'gemini-3-flash-preview',
      flow2: '',
      aliyun: ''
    })
    
    const imageConcurrency = ref(2)
    const videoConcurrency = ref(2)
    
    const textModels: ModelConfig[] = [
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', description: 'Gemini 3.1 Pro 预览版', price: '￥0.15/次' },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', description: 'Gemini 3 Flash 预览版', price: '￥0.05/次' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Gemini 2.5 Pro 高性能模型', price: '￥0.1/次' },
      { id: 'deepseek-v3.2-fast', name: 'DeepSeek V3.2 Fast', description: 'DeepSeek最新快速对话模型', price: '￥0.01/次' },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', description: 'DeepSeek V4 高性能对话模型', price: '￥0.05/次' },
      { id: 'deepseek-v3.1-fast', name: 'DeepSeek V3.1 Fast', description: 'DeepSeek快速对话模型', price: '￥0.008/次' },
      { id: 'deepseek-chat', name: 'DeepSeek V3', description: 'DeepSeek最新对话模型', price: '￥0.01/次' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', description: 'DeepSeek推理模型', price: '￥0.02/次' },
      { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', description: 'OpenAI最新轻量高速模型', price: '￥0.05/次' },
      { id: 'gpt-5.4-pro', name: 'GPT-5.4 Pro', description: 'OpenAI最新高性能模型', price: '￥0.15/次' },
    ]
    
    const visionModels: ModelConfig[] = [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', description: 'Gemini 3 Flash 视觉理解模型', price: '￥0.05/次' },
      { id: 'gpt-5.4-mini-2026-03-17', name: 'GPT-5.4 Mini (2026-03-17)', description: 'OpenAI GPT-5.4 Mini 视觉理解模型', price: '￥0.05/次' },
      { id: 'gpt-5.4-nano-2026-03-17', name: 'GPT-5.4 Nano (2026-03-17)', description: 'OpenAI GPT-5.4 Nano 视觉理解模型', price: '￥0.03/次' },
      { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', description: 'OpenAI GPT-5.4 Nano 视觉理解模型', price: '￥0.03/次' },
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', description: 'OpenAI GPT-5.4 Mini 视觉理解模型', price: '￥0.05/次' },
      { id: 'qwen3.6-27b', name: 'Qwen3.6-27B', description: '通义千问 3.6 27B 视觉理解模型', price: '￥0.02/次' },
      { id: 'qwen3.6-35b-a3b', name: 'Qwen3.6-35B-A3B', description: '通义千问 3.6 35B 视觉理解模型', price: '￥0.03/次' },
      { id: 'qwen3.6-plus', name: 'Qwen3.6 Plus', description: '通义千问 3.6 Plus 视觉理解模型', price: '￥0.05/次' },
      { id: 'qwen3.6-plus-2026-04-02', name: 'Qwen3.6 Plus (2026-04-02)', description: '通义千问 3.6 Plus 视觉理解模型', price: '￥0.05/次' },
    ]
    
    const imageModels: ModelConfig[] = [
      { id: 'gpt-image-2', name: 'GPT-Image-2', description: 'GPT图片生成模型2.0版本', price: '￥0.1/次' },
      { id: 'gemini-3.1-flash-image-preview', name: 'Nano Banana 2', description: 'Gemini 3.1 Flash 图片生成模型', price: '￥0.1/次' },
      { id: 'dall-e-3', name: 'GPT-Image-2-All', description: 'GPT图片生成模型2.0全功能版', price: '￥0.15/次' },
      { id: 'doubao-seedream-5-0-260128', name: '即梦图片5.0', description: '豆包即梦图片生成模型5.0版本', price: '￥0.2/次' },
      { id: 'doubao-seedream-4-5-251128', name: '即梦图片4.5', description: '豆包即梦图片生成模型4.5版本', price: '￥0.15/次' },
      { id: 'doubao-seedream-4-0-250828', name: '即梦图片4.0', description: '豆包即梦图片生成模型4.0版本', price: '￥0.1/次' },
      { id: 'gemini-3-pro-image-preview', name: 'Nano Banana pro', description: 'Gemini 3 Pro 图片生成模型', price: '￥0.495/次' },
      { id: 'z-image-turbo', name: 'Z-Image Turbo', description: '通义千问图片生成模型-快速版', price: '￥0.05/次' },
      { id: 'qwen-image-edit-2509', name: '千问视角模型', description: '通义千问 qwen-image-edit-2509，图片视角/编辑', price: '￥0.1/次' },
    ]
    
    const videoModels: ModelConfig[] = [
      { id: 'sora-2', name: 'Sora-2', description: 'OpenAI Sora视频生成模型V2', price: '￥1.0/次' },
      { id: 'sora-2-all', name: 'Sora-2-All', description: 'OpenAI Sora视频生成模型V2-全功能版', price: '￥1.5/次' },
      { id: 'sora-2-pro', name: 'Sora-2-Pro', description: 'OpenAI Sora视频生成模型V2-专业版', price: '￥2.0/次' },
      { id: 'grok-video-3', name: 'Grok Video-3', description: 'Grok视频生成模型V3', price: '￥0.4/次' },
      { id: 'grok-video-3-10s', name: 'Grok Video-3-10s', description: 'Grok视频生成模型V3-10秒版', price: '￥0.4/次' },
      { id: 'veo_3_1-fast', name: 'Veo 3.1 Fast', description: 'Google Veo视频生成模型3.1快速版', price: '￥0.43/次' },
      { id: 'veo_3_1-fast-4K', name: 'Veo 3.1 Fast-4K', description: 'Google Veo视频生成模型3.1快速版-4K（支持首尾帧生视频）', price: '￥1.2/次' },
      { id: 'veo_3_1-4K', name: 'Veo 3.1-4K', description: 'Google Veo视频生成模型3.1-4K（支持首尾帧生视频）', price: '￥1.5/次' },
      { id: 'veo_3_1-components-4K', name: 'Veo 3.1 Components-4K', description: 'Google Veo视频生成模型3.1组件版-4K（支持多图参考生视频）', price: '￥1.8/次' },
      { id: 'veo_3_1-fast-components-4K', name: 'Veo 3.1 Fast Components-4K', description: 'Google Veo视频生成模型3.1快速组件版-4K（支持多图参考生视频）', price: '￥1.4/次' },
      { id: 'kling-video', name: 'Kling Video', description: 'Kling视频生成模型（支持文生视频/图生视频/多图参考）', price: '￥0.8/次' },
  { id: 'kling-omni-video', name: 'Kling Omni Video', description: 'Kling Omni Video视频生成模型', price: '￥0.8/次' },
    ]
    
    const customModels = ref<ModelConfig[]>([])
    
    /** Flow2 本地图片生成模型列表（仅基础 1K 版本，画质通过选择动态生成） */
    const flow2ImageModels: ModelConfig[] = [
      // Gemini 3.0 Pro Image 系列（基础 1K）
      { id: 'gemini-3.0-pro-image-landscape', name: 'Gemini 3.0 Pro Image - 横屏 16:9', description: '图/文生图 - 横屏', price: '' },
      { id: 'gemini-3.0-pro-image-portrait', name: 'Gemini 3.0 Pro Image - 竖屏 9:16', description: '图/文生图 - 竖屏', price: '' },
      { id: 'gemini-3.0-pro-image-square', name: 'Gemini 3.0 Pro Image - 方图 1:1', description: '图/文生图 - 方图', price: '' },
      { id: 'gemini-3.0-pro-image-four-three', name: 'Gemini 3.0 Pro Image - 横屏 4:3', description: '图/文生图 - 横屏 4:3', price: '' },
      { id: 'gemini-3.0-pro-image-three-four', name: 'Gemini 3.0 Pro Image - 竖屏 3:4', description: '图/文生图 - 竖屏 3:4', price: '' },
      // Imagen 4.0 系列（仅 1K）
      { id: 'imagen-4.0-generate-preview-landscape', name: 'Imagen 4.0 - 横屏 16:9', description: '图/文生图 - 横屏', price: '' },
      { id: 'imagen-4.0-generate-preview-portrait', name: 'Imagen 4.0 - 竖屏 9:16', description: '图/文生图 - 竖屏', price: '' },
      // Gemini 3.1 Flash Image 系列（基础 1K）
      { id: 'gemini-3.1-flash-image-landscape', name: 'Gemini 3.1 Flash Image - 横屏 16:9', description: '图/文生图 - 横屏', price: '' },
      { id: 'gemini-3.1-flash-image-portrait', name: 'Gemini 3.1 Flash Image - 竖屏 9:16', description: '图/文生图 - 竖屏', price: '' },
      { id: 'gemini-3.1-flash-image-square', name: 'Gemini 3.1 Flash Image - 方图 1:1', description: '图/文生图 - 方图', price: '' },
      { id: 'gemini-3.1-flash-image-four-three', name: 'Gemini 3.1 Flash Image - 横屏 4:3', description: '图/文生图 - 横屏 4:3', price: '' },
      { id: 'gemini-3.1-flash-image-three-four', name: 'Gemini 3.1 Flash Image - 竖屏 3:4', description: '图/文生图 - 竖屏 3:4', price: '' },
    ]
    
    /** 根据基础模型ID和画质生成最终的 Flow2 模型ID */
    function resolveFlow2ImageModelId(baseModelId: string, quality: string): string {
      if (!baseModelId || baseModelId.startsWith('imagen-')) {
        return baseModelId
      }
      const q = (quality || '').toLowerCase()
      if (q === '2k' || q === '2048') {
        if (baseModelId.includes('-landscape') || baseModelId.includes('-portrait') ||
            baseModelId.includes('-square') || baseModelId.includes('-four-three') ||
            baseModelId.includes('-three-four')) {
          return baseModelId + '-2k'
        }
      } else if (q === '4k' || q === '4096') {
        if (baseModelId.includes('-landscape') || baseModelId.includes('-portrait') ||
            baseModelId.includes('-square') || baseModelId.includes('-four-three') ||
            baseModelId.includes('-three-four')) {
          return baseModelId + '-4k'
        }
      }
      return baseModelId
    }
    
    /** Flow2 本地视频生成模型列表（Veo 3.1 图生视频系列） */
    const flow2VideoModels: ModelConfig[] = [
      // Veo 3.1 Fast 系列
      { id: 'veo_3_1_i2v_s_fast_portrait_fl', name: 'Veo 3.1 Fast - 竖屏', description: '图生视频 - 竖屏', price: '' },
      { id: 'veo_3_1_i2v_s_fast_fl', name: 'Veo 3.1 Fast - 横屏', description: '图生视频 - 横屏', price: '' },
      { id: 'veo_3_1_i2v_s_fast_portrait_ultra_fl', name: 'Veo 3.1 Fast Ultra - 竖屏', description: '图生视频 - 竖屏', price: '' },
      { id: 'veo_3_1_i2v_s_fast_ultra_fl', name: 'Veo 3.1 Fast Ultra - 横屏', description: '图生视频 - 横屏', price: '' },
      { id: 'veo_3_1_i2v_s_fast_portrait_ultra_relaxed', name: 'Veo 3.1 Fast Ultra Relaxed - 竖屏', description: '图生视频 - 竖屏', price: '' },
      { id: 'veo_3_1_i2v_s_fast_ultra_relaxed', name: 'Veo 3.1 Fast Ultra Relaxed - 横屏', description: '图生视频 - 横屏', price: '' },
      // Veo 3.1 标准系列
      { id: 'veo_3_1_i2v_s_portrait', name: 'Veo 3.1 - 竖屏', description: '图生视频 - 竖屏', price: '' },
      { id: 'veo_3_1_i2v_s_landscape', name: 'Veo 3.1 - 横屏', description: '图生视频 - 横屏', price: '' },
      { id: 'veo_3_1_i2v_s_landscape_4s', name: 'Veo 3.1 - 横屏 4秒', description: '图生视频 4秒 - 横屏', price: '' },
      { id: 'veo_3_1_i2v_s_portrait_4s', name: 'Veo 3.1 - 竖屏 4秒', description: '图生视频 4秒 - 竖屏', price: '' },
      { id: 'veo_3_1_i2v_s_landscape_6s', name: 'Veo 3.1 - 横屏 6秒', description: '图生视频 6秒 - 横屏', price: '' },
      { id: 'veo_3_1_i2v_s_portrait_6s', name: 'Veo 3.1 - 竖屏 6秒', description: '图生视频 6秒 - 竖屏', price: '' },
      // Veo 3.1 Fast 时长系列
      { id: 'veo_3_1_i2v_s_fast_landscape_4s_fl', name: 'Veo 3.1 Fast - 横屏 4秒', description: '图生视频 Fast 4秒 - 横屏', price: '' },
      { id: 'veo_3_1_i2v_s_fast_portrait_4s_fl', name: 'Veo 3.1 Fast - 竖屏 4秒', description: '图生视频 Fast 4秒 - 竖屏', price: '' },
      { id: 'veo_3_1_i2v_s_fast_landscape_6s_fl', name: 'Veo 3.1 Fast - 横屏 6秒', description: '图生视频 Fast 6秒 - 横屏', price: '' },
      { id: 'veo_3_1_i2v_s_fast_portrait_6s_fl', name: 'Veo 3.1 Fast - 竖屏 6秒', description: '图生视频 Fast 6秒 - 竖屏', price: '' },
      // Veo 3.1 Lite 系列（仅首帧）
      { id: 'veo_3_1_i2v_lite_portrait', name: 'Veo 3.1 Lite - 竖屏', description: '图生视频 Lite（仅首帧） - 竖屏', price: '' },
      { id: 'veo_3_1_i2v_lite_landscape', name: 'Veo 3.1 Lite - 横屏', description: '图生视频 Lite（仅首帧） - 横屏', price: '' },
      { id: 'veo_3_1_i2v_lite_4s_portrait', name: 'Veo 3.1 Lite - 竖屏 4秒', description: '图生视频 Lite 4秒（仅首帧） - 竖屏', price: '' },
      { id: 'veo_3_1_i2v_lite_4s_landscape', name: 'Veo 3.1 Lite - 横屏 4秒', description: '图生视频 Lite 4秒（仅首帧） - 横屏', price: '' },
      { id: 'veo_3_1_i2v_lite_6s_portrait', name: 'Veo 3.1 Lite - 竖屏 6秒', description: '图生视频 Lite 6秒（仅首帧） - 竖屏', price: '' },
      { id: 'veo_3_1_i2v_lite_6s_landscape', name: 'Veo 3.1 Lite - 横屏 6秒', description: '图生视频 Lite 6秒（仅首帧） - 横屏', price: '' },
      // Veo 3.1 Lite 首尾帧过渡系列
      { id: 'veo_3_1_interpolation_lite_portrait', name: 'Veo 3.1 Lite 过渡 - 竖屏', description: '图生视频 Lite（首尾帧过渡） - 竖屏', price: '' },
      { id: 'veo_3_1_interpolation_lite_landscape', name: 'Veo 3.1 Lite 过渡 - 横屏', description: '图生视频 Lite（首尾帧过渡） - 横屏', price: '' },
      { id: 'veo_3_1_interpolation_lite_4s_portrait', name: 'Veo 3.1 Lite 过渡 - 竖屏 4秒', description: '图生视频 Lite 4秒（首尾帧过渡） - 竖屏', price: '' },
      { id: 'veo_3_1_interpolation_lite_4s_landscape', name: 'Veo 3.1 Lite 过渡 - 横屏 4秒', description: '图生视频 Lite 4秒（首尾帧过渡） - 横屏', price: '' },
      { id: 'veo_3_1_interpolation_lite_6s_portrait', name: 'Veo 3.1 Lite 过渡 - 竖屏 6秒', description: '图生视频 Lite 6秒（首尾帧过渡） - 竖屏', price: '' },
      { id: 'veo_3_1_interpolation_lite_6s_landscape', name: 'Veo 3.1 Lite 过渡 - 横屏 6秒', description: '图生视频 Lite 6秒（首尾帧过渡） - 横屏', price: '' },
    ]
    
    /** 优尚网关（USSN）；画布/工坊默认校验与兼容旧代码读取密钥时用 */
    const currentConfig = computed(() => officialConfig.value)

    function configForModelGroup(group?: ApiModelGroup | null): APIConfig {
      if (group === 'flow2') return customConfig.value
      if (group === 'aliyun') return aliyunConfig.value
      return officialConfig.value
    }

    /** 所选分组是否具备发起请求的最低配置（Flow2 看 baseURL；其余看 apiKey） */
    function isApiReadyForGroup(group?: ApiModelGroup | null): boolean {
      const g = group ?? 'youshang'
      const c = configForModelGroup(g)
      if (g === 'flow2') {
        return !!(c.baseURL && String(c.baseURL).trim())
      }
      return !!(c.apiKey && String(c.apiKey).trim())
    }

    const isConfigured = computed(
      () =>
        !!(officialConfig.value.apiKey && String(officialConfig.value.apiKey).trim()) ||
        !!(customConfig.value.baseURL && String(customConfig.value.baseURL).trim())
    )
    
    const getModelsByType = (type: ModelType): ModelConfig[] => {
      switch (type) {
        case 'text':
          return textModels
        case 'image':
          return imageModels
        case 'video':
          return videoModels
        case 'vision':
          return visionModels
        default:
          return textModels
      }
    }
    
    const getCurrentModels = computed(() => {
      return getModelsByType(currentModelType.value)
    })
    
    function setConfigType(type: 'official' | 'flow2') {
      configType.value = type
    }
    
    function updateOfficialConfig(config: Partial<APIConfig>) {
      officialConfig.value = { ...officialConfig.value, ...config }
    }
    
    function updateCustomConfig(config: Partial<APIConfig>) {
      customConfig.value = { ...customConfig.value, ...config }
    }
    
    function updateAliyunConfig(config: Partial<APIConfig>) {
      aliyunConfig.value = { ...aliyunConfig.value, ...config }
    }
    
    function setCurrentModelType(type: ModelType) {
      currentModelType.value = type
    }
    
    function setSelectedModel(modelId: string) {
      if (configType.value === 'official') {
        officialConfig.value.selectedModel = modelId
      } else {
        customConfig.value.selectedModel = modelId
      }
    }

    /** 按分组写入默认选中模型（设置或未区分 Tab 时可用） */
    function setSelectedModelForGroup(modelId: string, group: ApiModelGroup) {
      if (group === 'flow2') {
        customConfig.value.selectedModel = modelId
      } else {
        officialConfig.value.selectedModel = modelId
      }
    }
    
    function addCustomModel(model: ModelConfig) {
      const exists = customModels.value.some(m => m.id === model.id)
      if (!exists) {
        customModels.value.push(model)
      }
    }
    
    function removeCustomModel(modelId: string) {
      const index = customModels.value.findIndex(m => m.id === modelId)
      if (index > -1) {
        customModels.value.splice(index, 1)
      }
    }
    
    function clearConfig() {
      officialConfig.value = {
        apiKey: '',
        baseURL: 'https://api.ussn.cn/v1',
        selectedModel: 'claude-4-sonnet',
        maxTokens: null,
        unlimitedTokens: true,
        temperature: 0.7
      }
      customConfig.value = {
        apiKey: '',
        baseURL: 'http://localhost:8001',
        selectedModel: 'gpt-3.5-turbo',
        maxTokens: 4096,
        unlimitedTokens: false,
        temperature: 0.7
      }
    }
    
    function setDocumentUploadModel(modelId: string) {
      documentUploadModel.value = modelId
    }
    
    function setStoryboardPromptModel(modelId: string) {
      storyboardPromptModel.value = modelId
    }

    function setTextApiModelGroup(group: ApiModelGroup) {
      textApiModelGroup.value = group
    }
    
    function setImageModelGroup(group: ApiModelGroup) {
      // 保存当前分组的模型选择
      imageModelByGroup.value[imageModelGroup.value] = imageModel.value
      // 切换到新分组
      imageModelGroup.value = group
      // 恢复新分组的模型选择
      imageModel.value = imageModelByGroup.value[group] || ''
    }
    
    function setImageModel(modelId: string) {
      imageModel.value = modelId
      // 同时更新当前分组的模型选择
      imageModelByGroup.value[imageModelGroup.value] = modelId
    }
    
    function setVideoModelGroup(group: ApiModelGroup) {
      // 保存当前分组的模型选择
      videoModelByGroup.value[videoModelGroup.value] = videoModel.value
      // 切换到新分组
      videoModelGroup.value = group
      // 恢复新分组的模型选择
      videoModel.value = videoModelByGroup.value[group] || ''
    }
    
    function setVideoModel(modelId: string) {
      videoModel.value = modelId
      // 同时更新当前分组的模型选择
      videoModelByGroup.value[videoModelGroup.value] = modelId
    }
    
    function setVisionModelGroup(group: ApiModelGroup) {
      // 保存当前分组的模型选择
      visionModelByGroup.value[visionModelGroup.value] = visionModel.value
      // 切换到新分组
      visionModelGroup.value = group
      // 恢复新分组的模型选择
      visionModel.value = visionModelByGroup.value[group] || ''
    }
    
    function setVisionModel(modelId: string) {
      visionModel.value = modelId
      // 同时更新当前分组的模型选择
      visionModelByGroup.value[visionModelGroup.value] = modelId
    }
    
    function setImageConcurrency(count: number) {
      imageConcurrency.value = count
    }
    
    function setVideoConcurrency(count: number) {
      videoConcurrency.value = count
    }
    
    return {
      configType,
      officialConfig,
      customConfig,
      aliyunConfig,
      currentConfig,
      configForModelGroup,
      isApiReadyForGroup,
      isConfigured,
      currentModelType,
      documentUploadModel,
      storyboardPromptModel,
      textApiModelGroup,
      imageModelGroup,
      imageModel,
      imageModelByGroup,
      videoModelGroup,
      videoModel,
      videoModelByGroup,
      visionModelGroup,
      visionModel,
      visionModelByGroup,
      imageConcurrency,
      videoConcurrency,
      textModels,
      imageModels,
      videoModels,
      visionModels,
      customModels,
      flow2ImageModels,
      flow2VideoModels,
      getCurrentModels,
      getModelsByType,
      setConfigType,
      updateOfficialConfig,
      updateCustomConfig,
      updateAliyunConfig,
      setCurrentModelType,
      setSelectedModel,
      setSelectedModelForGroup,
      setDocumentUploadModel,
      setStoryboardPromptModel,
      setTextApiModelGroup,
      setImageModelGroup,
      setImageModel,
      setVideoModelGroup,
      setVideoModel,
      setVisionModelGroup,
      setVisionModel,
      setImageConcurrency,
      setVideoConcurrency,
      addCustomModel,
      removeCustomModel,
      clearConfig,
      resolveFlow2ImageModelId
    }
  },
  {
    persist: {
      key: 'api-config-store',
      storage: {
        getItem: (key) => {
          if (window.electronAPI?.storeSync) {
            return window.electronAPI.storeSync.get(key)
          }
          return localStorage.getItem(key)
        },
        setItem: (key, value) => {
          if (window.electronAPI?.storeSync) {
            window.electronAPI.storeSync.set(key, value)
          } else {
            localStorage.setItem(key, value)
          }
        }
      }
    }
  }
)
