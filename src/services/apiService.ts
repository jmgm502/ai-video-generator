import { useApiConfigStore, type ApiModelGroup, type APIConfig } from '@/stores/apiConfigStore'
import logger from '@/utils/logger'
import { resolveImageRefForApi } from '@/utils/resolveImageRefForApi'
import { resolveDoubaoImageRequestSize } from '@/utils/doubaoImageRequestSize'
import { useKlingVideoTaskStore } from '@/stores/klingVideoTaskStore'

const apiLogger = logger.child('API')

export interface GenerateTextOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  type?: string
  /** 与节点/工坊所选「优尚API / 官方直连 / Flow2API」一致，决定 baseURL 与密钥 */
  modelGroup?: ApiModelGroup
}

export interface StreamCallback {
  (chunk: string, fullContent: string): void
}

/** Gemini 官方通过 generationConfig.imageConfig 控制比例与分辨率；需规范为 512 / 1K / 2K / 4K */
function normalizeGeminiImageSize(raw?: string): string {
  if (!raw) return '1K'
  const t = String(raw).trim()
  if (t === '512') return '512'
  const upper = t.toUpperCase()
  if (upper === '1K' || upper === '2K' || upper === '4K') return upper
  if (t === '1k' || t === '2k') return t === '2k' ? '2K' : '1K'
  return '1K'
}

/** 兼容 error 字段为 `{ message?, code? }` 或纯字符串 */
function pickVideoTaskErrorPayload(errorField: unknown): { message?: string; code?: string } {
  if (typeof errorField === 'string') return { message: errorField }
  if (errorField && typeof errorField === 'object') {
    const e = errorField as Record<string, unknown>
    return {
      message: typeof e.message === 'string' ? e.message : undefined,
      code: typeof e.code === 'string' ? e.code : undefined
    }
  }
  return {}
}

/** 视频任务失败后网关常见英文 code → 可读中文提示（不改变原始日志） */
function describeVideoGenerationFailure(remoteMessage?: string, remoteCode?: string): string {
  const blob = `${remoteMessage ?? ''} ${remoteCode ?? ''}`
  if (blob.includes('PUBLIC_ERROR_AUDIO_FILTERED')) {
    return '视频生成失败：生成内容未通过服务端安全筛选（音视频相关）。请调整提示词、更换参考图，或弱化可能触发审核的描述后重试。'
  }
  if (blob.includes('PUBLIC_ERROR_CONTENT_FILTERED')) {
    return '视频生成失败：生成内容未通过服务端安全筛选。请修改提示词或参考素材后重试。'
  }
  if (blob.includes('PUBLIC_ERROR_PROMINENT_PEOPLE_FILTER_FAILED')) {
    return '视频生成失败：提示词或参考图包含知名公众人物。请移除相关内容后重试。'
  }
  if (blob.includes('unsupported action or model for this channel')) {
    return '视频生成失败：当前 API 渠道不支持所选视频模型或该模型的当前调用方式。请切换到支持的渠道/模型，或改用该渠道已支持的视频模型后重试。'
  }
  const detail = remoteMessage || remoteCode || '未知错误'
  return `视频生成失败：${detail}`
}

function clampPromptToMaxLength(prompt: string, maxLength: number): { prompt: string; wasTrimmed: boolean } {
  const normalized = String(prompt ?? '')
  if (normalized.length <= maxLength) {
    return { prompt: normalized, wasTrimmed: false }
  }
  return {
    prompt: normalized.slice(0, maxLength),
    wasTrimmed: true
  }
}

const VIDEO_MODEL_CONFIG: Record<string, { promptLimit?: number; durationOptions?: string[] }> = {
  'kling-omni-video': { promptLimit: 2500, durationOptions: ['5', '10'] },
  'kling-video': { durationOptions: ['5', '10'] },
  'sora-2': { durationOptions: ['4', '8', '12'] },
  'sora-2-all': { durationOptions: ['10', '15'] },
  'sora-2-pro': { durationOptions: ['4', '8', '12'] },
  'grok-video-3': { durationOptions: ['6', '10'] },
  'grok-video-3-10s': { durationOptions: ['10'] },
  'veo_3_1-fast': { durationOptions: ['4', '5', '8'] },
  'veo_3_1-fast-4K': { durationOptions: ['6', '10'] },
  'veo_3_1-4K': { durationOptions: ['6', '10'] },
  'veo_3_1-components-4K': { durationOptions: ['6', '10'] },
  'veo_3_1-fast-components-4K': { durationOptions: ['6', '10'] }
}

/** 从 HTTP JSON 体中尽量取出 message / code（兼容 OpenAI 嵌套 error 与其它字段） */
function pickVideoPayloadFromHttpError(errorData: Record<string, unknown>): { message?: string; code?: string } {
  const fromNested = pickVideoTaskErrorPayload(errorData.error)
  if (fromNested.message || fromNested.code) return fromNested
  const fromRoot = pickVideoTaskErrorPayload(errorData)
  if (fromRoot.message || fromRoot.code) return fromRoot
  const msg = typeof errorData.message === 'string' ? errorData.message : undefined
  return { message: msg }
}

class APIService {
  private resolveConfig(modelGroup?: ApiModelGroup): APIConfig {
    return useApiConfigStore().configForModelGroup(modelGroup)
  }

  private buildURL(endpoint: string, config: APIConfig): string {
    const base = String(config.baseURL ?? '').replace(/\/$/, '')
    const ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return `${base}${ep}`
  }

  private buildHeaders(config: APIConfig): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    }
  }

  async validateApiKey(modelGroup?: ApiModelGroup): Promise<boolean> {
    const g = modelGroup ?? 'youshang'
    const config = this.resolveConfig(g)

    if (g === 'flow2') {
      if (!config.baseURL || !String(config.baseURL).trim()) return false
    } else if (!config.apiKey || !String(config.apiKey).trim()) {
      return false
    }

    try {
      const url = this.buildURL('/models', config)
      const headers = this.buildHeaders(config)

      const response = await fetch(url, {
        method: 'GET',
        headers
      })

      return response.ok
    } catch {
      return false
    }
  }

  async generateText(prompt: string, options: GenerateTextOptions = {}): Promise<string> {
    const config = this.resolveConfig(options.modelGroup)
    const model = options.model || config.selectedModel

    const messages = []
    if (options.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt
      })
    }
    messages.push({
      role: 'user',
      content: prompt
    })

    const requestBody: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? config.temperature,
      stream: false
    }

    if (!config.unlimitedTokens && config.maxTokens) {
      requestBody.max_tokens = options.maxTokens ?? config.maxTokens
    }

    const url = this.buildURL('/chat/completions', config)
    const headers = this.buildHeaders(config)

    apiLogger.info('发送文本生成请求', { model, url })

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMsg = `API请求失败: ${response.status} - ${errorData.error?.message || '未知错误'}`
        apiLogger.error(errorMsg, errorData)
        throw new Error(errorMsg)
      }

      const data = await response.json()
      apiLogger.info('文本生成成功')
      return data.choices[0]?.message?.content || ''
    } catch (error) {
      apiLogger.error('API请求错误:', error)
      throw error
    }
  }

  async generateTextStream(
    prompt: string,
    options: GenerateTextOptions = {},
    onChunk?: StreamCallback
  ): Promise<string> {
    const config = this.resolveConfig(options.modelGroup)
    const g = options.modelGroup ?? 'youshang'

    if (g !== 'flow2' && (!config.apiKey || !String(config.apiKey).trim())) {
      throw new Error('API密钥未配置，请先在设置中配置API密钥')
    }

    if (!config.baseURL || !String(config.baseURL).trim()) {
      throw new Error('API地址未配置，请先在设置中配置API地址')
    }

    const model = options.model || config.selectedModel

    const messages = []
    if (options.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt
      })
    }
    messages.push({
      role: 'user',
      content: prompt
    })

    const requestBody: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? config.temperature,
      stream: true
    }

    if (!config.unlimitedTokens && config.maxTokens) {
      requestBody.max_tokens = options.maxTokens ?? config.maxTokens
    }

    const url = this.buildURL('/chat/completions', config)
    const headers = this.buildHeaders(config)

    let fullContent = ''

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(300000)
      })

      if (!response.ok) {
        const errorText = await response.text()
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(`API请求失败: ${response.status} - ${errorData.error?.message || '未知错误'}`)
        } catch {
          throw new Error(`API请求失败: ${response.status} - ${errorText}`)
        }
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let streamFinished = false

      while (!streamFinished) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmedLine = line.trim()

          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6).trim()

            if (data === '[DONE]') {
              streamFinished = true
              break
            }

            if (!data) continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || ''

              if (content) {
                fullContent += content

                if (onChunk) {
                  onChunk(content, fullContent)
                }
              }

              if (parsed.choices?.[0]?.finish_reason) {
                streamFinished = true
                break
              }

              if (parsed.error) {
                throw new Error(`API错误: ${parsed.error.message || '未知错误'}`)
              }
            } catch (e) {
              if (e instanceof Error && e.message.startsWith('API错误:')) {
                throw e
              }
            }
          }
        }
      }

      return fullContent
    } catch (error) {
      console.error('流式生成错误:', error)
      throw error
    }
  }

  async generateImage(
    prompt: string,
    options: {
      model?: string
      size?: string
      referenceImages?: string[]
      imageCount?: number
      aspectRatio?: string
      /** Gemini 3.x 出图：与 aspectRatio 配套，取值 512、1K、2K、4K（大写 K），见官方 imageConfig.imageSize */
      imageSize?: string
      modelGroup?: ApiModelGroup
    } = {}
  ): Promise<string> {
    const config = this.resolveConfig(options.modelGroup)
    const model = options.model || 'gemini-2.0-flash-preview-image-generation'

    const isGeminiModel = model.includes('gemini') && model.includes('image')
    const isImagenModel = model.startsWith('imagen-')
    const isDoubaoModel = model.startsWith('doubao-seedream')
    const isZImageTurboModel = model === 'z-image-turbo'
    const isGptImage2Model = model.startsWith('gpt-image-2')
    
    // 预处理参考图：使用 resolveImageRefForApi 统一处理
    const resolvedReferenceImages = options.referenceImages && options.referenceImages.length > 0
      ? await Promise.all(options.referenceImages.map((u) => resolveImageRefForApi(String(u))))
      : []

    if (isDoubaoModel) {
      const requestBody: Record<string, unknown> = {
        model,
        prompt,
        watermark: false,
        response_format: 'url'
      }

      const rawSize = options.size ? String(options.size) : '2K'
      requestBody.size = resolveDoubaoImageRequestSize(rawSize, options.aspectRatio)

      if (resolvedReferenceImages.length > 0) {
        if (resolvedReferenceImages.length === 1) {
          requestBody.image = resolvedReferenceImages[0]
        } else {
          requestBody.image = resolvedReferenceImages
          requestBody.sequential_image_generation = 'auto'
          if (options.imageCount && options.imageCount > 1) {
            requestBody.sequential_image_generation_options = {
              max_images: Math.min(options.imageCount, 15)
            }
          }
        }
      }

      const url = this.buildURL('/images/generations', config)
      const headers = this.buildHeaders(config)

      apiLogger.info('发送豆包图片生成请求', { model, url, body: requestBody })

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          const errorData = await response.json()
          const errorMsg = `图片生成失败: ${response.status} - ${errorData.error?.message || '未知错误'}`
          apiLogger.error(errorMsg, errorData)
          throw new Error(errorMsg)
        }

        const data = await response.json()

        let imageUrls: string[] = []
        if (data.data && Array.isArray(data.data)) {
          imageUrls = data.data.map((item: { url?: string; b64_json?: string }) => {
            if (item.url) return item.url
            if (item.b64_json) return `data:image/png;base64,${item.b64_json}`
            return ''
          }).filter(Boolean)
        }

        if (imageUrls.length > 0) {
          apiLogger.info('豆包图片生成成功', { count: imageUrls.length })
          return imageUrls[0]
        }

        apiLogger.warn('豆包图片生成响应无URL', data)
        throw new Error('无法从响应中提取图片URL')
      } catch (error) {
        apiLogger.error('豆包图片生成错误:', error)
        throw error
      }
    } else if (isZImageTurboModel) {
      const requestBody = {
        model,
        prompt,
        size: options.size || '1280x720',
        n: 1,
        watermark: false,
        prompt_extend: true
      }

      const url = this.buildURL('/images/generations', config)
      const headers = this.buildHeaders(config)

      apiLogger.info('发送Z-Image Turbo图片生成请求', { model, url, body: requestBody })

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          const errorData = await response.json()
          const errorMsg = `图片生成失败: ${response.status} - ${errorData.error?.message || '未知错误'}`
          apiLogger.error(errorMsg, errorData)
          throw new Error(errorMsg)
        }

        const data = await response.json()

        let imageUrls: string[] = []
        if (data.data && Array.isArray(data.data)) {
          imageUrls = data.data.map((item: { url?: string; b64_json?: string }) => {
            if (item.url) return item.url
            if (item.b64_json) return `data:image/png;base64,${item.b64_json}`
            return ''
          }).filter(Boolean)
        }

        if (imageUrls.length > 0) {
          apiLogger.info('Z-Image Turbo图片生成成功')
          return imageUrls[0]
        }

        apiLogger.warn('Z-Image Turbo图片生成响应无URL', data)
        throw new Error('无法从响应中提取图片URL')
      } catch (error) {
        apiLogger.error('Z-Image Turbo图片生成错误:', error)
        throw error
      }
    } else if (isGptImage2Model) {
      // 部分中转（如优尚）不接受 OpenAI 的 response_format，会报 Unknown parameter
      const requestBody: Record<string, unknown> = {
        model,
        prompt,
        n: 1,
        size: options.size || '1024x1024'
      }

      const url = this.buildURL('/images/generations', config)
      const headers = this.buildHeaders(config)

      apiLogger.info('发送GPT-Image-2图片生成请求', { model, url, body: requestBody })

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          const errorData = await response.json()
          const errorMsg = `图片生成失败: ${response.status} - ${errorData.error?.message || '未知错误'}`
          apiLogger.error(errorMsg, errorData)
          throw new Error(errorMsg)
        }

        const data = await response.json()

        let imageUrls: string[] = []
        if (data.data && Array.isArray(data.data)) {
          imageUrls = data.data.map((item: { url?: string; b64_json?: string }) => {
            if (item.url) return item.url
            if (item.b64_json) return `data:image/png;base64,${item.b64_json}`
            return ''
          }).filter(Boolean)
        }

        if (imageUrls.length > 0) {
          apiLogger.info('GPT-Image-2图片生成成功')
          return imageUrls[0]
        }

        apiLogger.warn('GPT-Image-2图片生成响应无URL', data)
        throw new Error('无法从响应中提取图片URL')
      } catch (error) {
        apiLogger.error('GPT-Image-2图片生成错误:', error)
        throw error
      }
    } else if (isImagenModel) {
      // Imagen 模型通过 /chat/completions 调用
      const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = []
      
      if (resolvedReferenceImages.length > 0) {
        resolvedReferenceImages.forEach(imageUrl => {
          content.push({
            type: 'image_url',
            image_url: { url: imageUrl }
          })
        })
      }
      
      content.push({
        type: 'text',
        text: prompt
      })
      
      const aspectRatio = options.aspectRatio || '1:1'

      const requestBody: Record<string, unknown> = {
        model,
        messages: [
          {
            role: 'user',
            content
          }
        ],
        temperature: 0.7,
        stream: false,
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio
          }
        },
        generation_config: {
          response_modalities: ['TEXT', 'IMAGE'],
          image_config: {
            aspect_ratio: aspectRatio
          }
        }
      }

      requestBody.aspect_ratio = aspectRatio

      // Flow2 本地服务使用 /v1/chat/completions 端点
      const endpoint = options.modelGroup === 'flow2' ? '/v1/chat/completions' : '/chat/completions'
      const url = this.buildURL(endpoint, config)
      const headers = this.buildHeaders(config)

      apiLogger.info('发送Imagen图片生成请求', {
        model,
        url,
        aspectRatio
      })
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          const errorMsg = `图片生成失败: ${response.status} - ${errorData.error?.message || '未知错误'}`
          apiLogger.error(errorMsg, errorData)
          throw new Error(errorMsg)
        }
        
        const data = await response.json()
        
        apiLogger.info('Imagen图片生成完整响应', JSON.stringify(data, null, 2))
        
        const message = data.choices?.[0]?.message
        const content = message?.content || ''
        
        if (typeof content === 'object' && content !== null) {
          const contentObj = content as Record<string, unknown>
          if (contentObj.url) {
            apiLogger.info('Imagen图片生成成功，从content对象提取URL')
            return contentObj.url as string
          }
          if (contentObj.image_url) {
            apiLogger.info('Imagen图片生成成功，从content对象提取image_url')
            return contentObj.image_url as string
          }
        }
        
        if (message?.image_url) {
          apiLogger.info('Imagen图片生成成功，从message提取image_url')
          return message.image_url as string
        }
        
        if (typeof content === 'string') {
          const markdownUrlMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s"'<>]+)\)/)
          if (markdownUrlMatch) {
            apiLogger.info('Imagen图片生成成功，从Markdown提取到URL')
            return markdownUrlMatch[1]
          }
          
          const urlMatch = content.match(/https?:\/\/[^\s"'<>]+/)
          if (urlMatch) {
            apiLogger.info('Imagen图片生成成功，提取到URL')
            return urlMatch[0]
          }
          
          const markdownBase64Match = content.match(/!\[.*?\]\((data:image\/[^;]+;base64,[A-Za-z0-9+/=\s]+)/)
          if (markdownBase64Match) {
            const base64Data = markdownBase64Match[1].replace(/\s/g, '')
            apiLogger.info('Imagen图片生成成功，从Markdown提取到Base64，长度:', base64Data.length)
            return base64Data
          }
          
          const base64Match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=\s]+/)
          if (base64Match) {
            const base64Data = base64Match[0].replace(/\s/g, '')
            apiLogger.info('Imagen图片生成成功，提取到Base64，长度:', base64Data.length)
            return base64Data
          }
          
          const jsonUrlMatch = content.match(/"url"\s*:\s*"([^"]+)"/)
          if (jsonUrlMatch) {
            apiLogger.info('Imagen图片生成成功，从JSON提取到URL')
            return jsonUrlMatch[1]
          }
        }
        
        if (data.data?.[0]?.url) {
          apiLogger.info('Imagen图片生成成功，从data提取到URL')
          return data.data[0].url
        }
        
        apiLogger.warn('Imagen图片生成响应无法提取URL', data)
        throw new Error('无法从响应中提取图片URL')
      } catch (error) {
        apiLogger.error('Imagen图片生成错误:', error)
        throw error
      }
    } else if (isGeminiModel) {
      const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = []
      
      if (resolvedReferenceImages.length > 0) {
        resolvedReferenceImages.forEach(imageUrl => {
          content.push({
            type: 'image_url',
            image_url: { url: imageUrl }
          })
        })
      }
      
      content.push({
        type: 'text',
        text: prompt
      })
      
      const aspectRatio = options.aspectRatio || '1:1'
      const imageSize = normalizeGeminiImageSize(options.imageSize ?? options.size)

      /** 官方要求与 imageConfig 同时设置，否则多类网关/模型会忽略比例与分辨率，落回 1:1 / 默认档 */
      const geminiImageGenerationConfig = {
        responseModalities: ['TEXT', 'IMAGE'] as const,
        imageConfig: {
          aspectRatio,
          imageSize
        }
      }

      const requestBody: Record<string, unknown> = {
        model,
        messages: [
          {
            role: 'user',
            content
          }
        ],
        temperature: 0.7,
        stream: false,
        // OpenAI 兼容：camelCase（多数 litellm/自建转发识别）
        generationConfig: geminiImageGenerationConfig,
        // 部分转发层只透传 snake_case（贴近 Google REST）
        generation_config: {
          response_modalities: ['TEXT', 'IMAGE'],
          image_config: {
            aspect_ratio: aspectRatio,
            image_size: imageSize
          }
        },
        // Gemini 安全过滤设置：降低拦截级别，仅拦截高风险内容
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_ONLY_HIGH'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_ONLY_HIGH'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_ONLY_HIGH'
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_ONLY_HIGH'
          }
        ]
      }

      requestBody.aspect_ratio = aspectRatio

      // Flow2 本地服务使用 /v1/chat/completions 端点
      const endpoint = options.modelGroup === 'flow2' ? '/v1/chat/completions' : '/chat/completions'
      const url = this.buildURL(endpoint, config)
      const headers = this.buildHeaders(config)

      apiLogger.info('发送Gemini图片生成请求', {
        model,
        url,
        aspectRatio,
        imageSize,
        responseModalities: geminiImageGenerationConfig.responseModalities
      })
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          const errorMsg = `图片生成失败: ${response.status} - ${errorData.error?.message || '未知错误'}`
          apiLogger.error(errorMsg, errorData)
          throw new Error(errorMsg)
        }
        
        const data = await response.json()
        
        apiLogger.info('Gemini图片生成完整响应', JSON.stringify(data, null, 2))
        
        // 检查 choices 是否直接是字符串 URL（新格式）
        if (typeof data.choices === 'string' && data.choices.startsWith('http')) {
          apiLogger.info('Gemini图片生成成功，从choices字段直接提取URL')
          return data.choices
        }
        
        const message = data.choices?.[0]?.message
        const content = message?.content || ''
        
        // Flow2 格式：content 是数组，每个元素有 type 和 image_url
        if (Array.isArray(content)) {
          for (const item of content) {
            if (item.type === 'image_url' && item.image_url?.url) {
              apiLogger.info('Gemini图片生成成功，从content数组提取URL')
              return item.image_url.url as string
            }
          }
        }
        
        if (typeof content === 'object' && content !== null && !Array.isArray(content)) {
          const contentObj = content as Record<string, unknown>
          if (contentObj.url) {
            apiLogger.info('Gemini图片生成成功，从content对象提取URL')
            return contentObj.url as string
          }
          if (contentObj.image_url) {
            apiLogger.info('Gemini图片生成成功，从content对象提取image_url')
            return contentObj.image_url as string
          }
        }
        
        if (message?.image_url) {
          apiLogger.info('Gemini图片生成成功，从message提取image_url')
          return message.image_url as string
        }
        
        if (typeof content === 'string') {
          const markdownUrlMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s"'<>]+)\)/)
          if (markdownUrlMatch) {
            apiLogger.info('Gemini图片生成成功，从Markdown提取到URL')
            return markdownUrlMatch[1]
          }
          
          const urlMatch = content.match(/https?:\/\/[^\s"'<>]+/)
          if (urlMatch) {
            apiLogger.info('Gemini图片生成成功，提取到URL')
            return urlMatch[0]
          }
          
          const markdownBase64Match = content.match(/!\[.*?\]\((data:image\/[^;]+;base64,[A-Za-z0-9+/=\s]+)/)
          if (markdownBase64Match) {
            const base64Data = markdownBase64Match[1].replace(/\s/g, '')
            apiLogger.info('Gemini图片生成成功，从Markdown提取到Base64，长度:', base64Data.length)
            return base64Data
          }
          
          const base64Match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=\s]+/)
          if (base64Match) {
            const base64Data = base64Match[0].replace(/\s/g, '')
            apiLogger.info('Gemini图片生成成功，提取到Base64，长度:', base64Data.length)
            return base64Data
          }
          
          const jsonUrlMatch = content.match(/"url"\s*:\s*"([^"]+)"/)
          if (jsonUrlMatch) {
            apiLogger.info('Gemini图片生成成功，从JSON提取到URL')
            return jsonUrlMatch[1]
          }
        }
        
        if (data.data?.[0]?.url) {
          apiLogger.info('Gemini图片生成成功，从data提取到URL')
          return data.data[0].url
        }
        
        apiLogger.warn('Gemini图片生成响应无法提取URL', data)
        throw new Error('无法从响应中提取图片URL')
      } catch (error) {
        apiLogger.error('Gemini图片生成错误:', error)
        throw error
      }
    } else {
      const requestBody: Record<string, unknown> = {
        model,
        prompt,
        n: 1,
        size: options.size || '1024x1024'
      }

      const url = this.buildURL('/images/generations', config)
      const headers = this.buildHeaders(config)

      apiLogger.info('发送图片生成请求', { model, url })

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          const errorData = await response.json()
          const errorMsg = `图片生成失败: ${response.status} - ${errorData.error?.message || '未知错误'}`
          apiLogger.error(errorMsg, errorData)
          throw new Error(errorMsg)
        }

        const data = await response.json()
        const first = data.data?.[0] as { url?: string; b64_json?: string } | undefined
        const imageUrl = first?.url || ''
        if (first?.b64_json) {
          apiLogger.info('图片生成成功（Base64）')
          return `data:image/png;base64,${first.b64_json}`
        }
        if (imageUrl) {
          apiLogger.info('图片生成成功')
        } else {
          apiLogger.warn('图片生成响应无URL')
        }
        return imageUrl
      } catch (error) {
        apiLogger.error('图片生成错误:', error)
        throw error
      }
    }
  }

  /** 千问图片编辑 / 视角：固定走 POST …/images/generations + qwen-image-edit-2509/qwen-image-edit-max（与节点所选「图片模型」无关；path 勿再含 /v1，因 baseURL 已带） */
  async generateQwenImageEdit2509(prompt: string, image: string, modelGroup?: ApiModelGroup, model?: string): Promise<string> {
    const config = this.resolveConfig(modelGroup)
    const modelToUse = model || (modelGroup === 'aliyun' ? 'qwen-image-edit-max-2026-01-16' : 'qwen-image-edit-2509')
    const processedImage = await resolveImageRefForApi(image)
    
    // 阿里云格式需要不同的请求格式
    if (modelGroup === 'aliyun') {
      // 阿里云格式：直接构建正确的 URL，不使用 buildURL
      const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
      const headers = this.buildHeaders(config)
      
      // 阿里云的请求格式
      const requestBody = {
        model: modelToUse,
        input: {
          messages: [
            {
              role: 'user',
              content: [
                { image: processedImage },
                { text: prompt }
              ]
            }
          ]
        },
        parameters: {
          n: 1,
          prompt_extend: true,
          watermark: false
        }
      }
      
      apiLogger.info('阿里云千问图片编辑请求', { model: modelToUse, url, imageLen: processedImage?.length })

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const errorMsg = `图片编辑失败: ${response.status} - ${(errorData as { message?: string }).message || '未知错误'}`
          apiLogger.error(errorMsg, errorData)
          throw new Error(errorMsg)
        }

        const data = await response.json() as {
          status_code?: number
          output?: {
            choices?: Array<{
              message?: {
                content?: Array<{ image?: string }>
              }
            }>
          }
        }
        
        if (data.output?.choices?.[0]?.message?.content?.[0]?.image) {
          const imageUrl = data.output.choices[0].message.content[0].image
          apiLogger.info('阿里云千问图片编辑成功', { hasUrl: true })
          return imageUrl
        }

        throw new Error('无法从阿里云响应中提取图片')
      } catch (error) {
        apiLogger.error('阿里云千问图片编辑错误:', error)
        throw error
      }
    } else {
      // 优尚网关格式
      const requestBody = { model: modelToUse, prompt, image: processedImage }
      const url = this.buildURL('/images/generations', config)
      const headers = this.buildHeaders(config)
      apiLogger.info('千问图片编辑请求', { model: modelToUse, url, imageLen: processedImage?.length })

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const errorMsg = `图片编辑失败: ${response.status} - ${(errorData as { error?: { message?: string } }).error?.message || '未知错误'}`
          apiLogger.error(errorMsg, errorData)
          throw new Error(errorMsg)
        }

        const data = await response.json() as { data?: Array<{ url?: string; b64_json?: string }> }
        if (data.data && Array.isArray(data.data)) {
          const first = data.data[0]
          if (first?.url) {
            apiLogger.info('千问图片编辑成功', { hasUrl: true })
            return first.url
          }
          if (first?.b64_json) {
            return `data:image/png;base64,${first.b64_json}`
          }
        }

        throw new Error('无法从响应中提取图片')
      } catch (error) {
        apiLogger.error('千问图片编辑错误:', error)
        throw error
      }
    }
  }

  async generateVideo(prompt: string, options: {
    model?: string
    aspectRatio?: string
    duration?: string
    /** @deprecated 请优先使用 referenceImages */
    referenceImage?: string
    /** 多参考图（如画布多路人物/场景/道具连线）；后端仅一张时取 [0] */
    referenceImages?: string[]
    /** 用于持久化与恢复轮询的节点ID */
    nodeId?: string
    modelGroup?: ApiModelGroup
  } = {}): Promise<string> {
    const model = options.model || 'sora-2'

    const grokModels = ['grok-video-3', 'grok-video-3-10s']
    const isGrokModel = grokModels.includes(model)
    const isKlingModel = model === 'kling-video'
    const isKlingOmniModel = model === 'kling-omni-video'

    let size = '1280x720'
    if (options.aspectRatio) {
      if (options.aspectRatio === 'horizontal' || options.aspectRatio === '16:9') {
        size = '1920x1080'
      } else if (options.aspectRatio === 'vertical' || options.aspectRatio === '9:16') {
        size = '1080x1920'
      }
    }

    let duration = String(options.duration || '5')
    
    // 为Kling模型验证并修正时长
    if (isKlingModel || isKlingOmniModel) {
      const validDurations = ['5', '10']
      apiLogger.info('generateVideo: 原始duration:', options.duration, '类型:', typeof options.duration, '转换后:', duration)
      if (!validDurations.includes(duration)) {
        duration = validDurations[0]
        apiLogger.warn(`generateVideo: Kling模型时长${options.duration}无效，已修正为${duration}`)
      }
    }

    const referenceImages =
      options.referenceImages && options.referenceImages.length > 0
        ? options.referenceImages
        : options.referenceImage
          ? [options.referenceImage]
          : []

    const resolvedReferenceImages =
      referenceImages.length > 0
        ? await Promise.all(referenceImages.map((u) => resolveImageRefForApi(String(u))))
        : []

    if (options.modelGroup === 'flow2') {
      return this.generateFlow2Video(prompt, {
        model,
        size,
        duration,
        referenceImages: resolvedReferenceImages,
        modelGroup: options.modelGroup
      })
    }

    const taskStore = options.nodeId ? await import('@/stores/klingVideoTaskStore').then((m) => m.useKlingVideoTaskStore()) : null

    if (isGrokModel) {
      return this.generateGrokVideo(prompt, {
        model,
        size,
        duration,
        referenceImages: resolvedReferenceImages,
        modelGroup: options.modelGroup
      })
    }
    
    if (isKlingModel) {
      return this.generateKlingVideo(prompt, {
        model,
        size,
        duration,
        referenceImages: resolvedReferenceImages,
        nodeId: options.nodeId,
        modelGroup: options.modelGroup
      })
    }
    
    if (isKlingOmniModel) {
      return this.generateKlingOmniVideo(prompt, {
        model,
        size,
        duration,
        referenceImages: resolvedReferenceImages,
        nodeId: options.nodeId,
        modelGroup: options.modelGroup
      })
    }
    
    return this.generateOpenAIVideo(prompt, {
      model,
      size,
      duration,
      referenceImages: resolvedReferenceImages,
      modelGroup: options.modelGroup
    })
  }

  async queryGrokVideoStatus(
    videoId: string,
    modelGroup?: ApiModelGroup
  ): Promise<{ status: string; videoUrl?: string; error?: string }> {
    const config = this.resolveConfig(modelGroup)
    const statusUrl = this.buildURL(`/video/query?id=${videoId}`, config)
    const headers = this.buildHeaders(config)

    try {
      const statusResponse = await fetch(statusUrl, {
        method: 'GET',
        headers
      })

      if (!statusResponse.ok) {
        return { status: 'error', error: `查询失败: ${statusResponse.status}` }
      }

      const statusData = await statusResponse.json()
      apiLogger.info('Grok视频状态查询结果:', statusData)

      if (statusData.status === 'completed' || statusData.status === 'succeeded') {
        return {
          status: 'completed',
          videoUrl: statusData.video_url || statusData.url
        }
      } else if (statusData.status === 'failed' || statusData.status === 'error') {
        return {
          status: 'failed',
          error: statusData.error?.message || '视频生成失败'
        }
      }

      return { status: statusData.status || 'processing' }
    } catch (error) {
      apiLogger.error('Grok视频状态查询错误:', error)
      return { status: 'error', error: String(error) }
    }
  }

  private async generateGrokVideo(prompt: string, options: {
    model: string
    size: string
    duration: string
    referenceImages?: string[]
    modelGroup?: ApiModelGroup
  }): Promise<string> {
    const config = this.resolveConfig(options.modelGroup)

    const requestBody: Record<string, any> = {
      model: options.model,
      prompt: prompt,
      aspect_ratio: options.size === '1920x1080' ? '16:9' : '9:16',
      duration: parseInt(options.duration) || 10
    }

    const imgs = (options.referenceImages ?? []).filter(Boolean)
    if (imgs.length === 1) {
      requestBody.image = imgs[0]
    } else if (imgs.length > 1) {
      requestBody.image = imgs
    }

    const url = this.buildURL('/video/create', config)
    const headers = this.buildHeaders(config)

    apiLogger.info('Grok视频生成请求', { model: options.model, url })

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, unknown>
        const { message, code } = pickVideoPayloadFromHttpError(errorData)
        const errorMsg = describeVideoGenerationFailure(message, code)
        apiLogger.error(errorMsg, errorData)
        throw new Error(errorMsg)
      }

      const data = await response.json()
      apiLogger.info('Grok视频生成任务已创建', data)

      if (!data.id) {
        throw new Error('视频任务创建失败，未获取到任务ID')
      }

      const videoId = data.id
      const maxAttempts = 200
      const pollInterval = 5000

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))

        const statusUrl = this.buildURL(`/video/query?id=${videoId}`, config)
        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers
        })

        if (!statusResponse.ok) {
          continue
        }

        const statusData = await statusResponse.json()
        apiLogger.info(`Grok视频生成状态 ${attempt + 1}/${maxAttempts}:`, statusData)

        if (statusData.status === 'completed' || statusData.status === 'succeeded') {
          if (statusData.video_url || statusData.url) {
            return statusData.video_url || statusData.url
          }
        } else if (statusData.status === 'failed' || statusData.status === 'error') {
          const { message, code } = pickVideoTaskErrorPayload(statusData.error ?? (statusData as any).failure_reason)
          throw new Error(describeVideoGenerationFailure(message, code))
        }
      }

      const error = new Error('视频生成超时，请稍后重试')
      ;(error as any).videoId = videoId
      throw error
    } catch (error) {
      apiLogger.error('Grok视频生成错误:', error)
      throw error
    }
  }

  private async generateOpenAIVideo(prompt: string, options: {
    model: string
    size: string
    duration: string
    referenceImages?: string[]
    modelGroup?: ApiModelGroup
  }): Promise<string> {
    const config = this.resolveConfig(options.modelGroup)

    const formData = new FormData()
    formData.append('prompt', prompt)
    formData.append('model', options.model)
    formData.append('size', options.size)
    formData.append('seconds', options.duration)

    const imgs = (options.referenceImages ?? []).filter(Boolean)
    for (let i = 0; i < imgs.length; i++) {
      const ref = imgs[i]
      if (ref.startsWith('data:')) {
        const base64Data = ref.split(',')[1]
        const mimeType = ref.split(';')[0].replace('data:', '')
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: mimeType })
        formData.append('input_reference', blob, `reference-${i}.png`)
      } else if (i === 0) {
        formData.append('image', ref)
      }
    }

    const url = this.buildURL('/videos', config)
    const headers = {
      Authorization: `Bearer ${config.apiKey}`
    }

    apiLogger.info('OpenAI格式视频生成请求', { model: options.model, url })

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, unknown>
        const { message, code } = pickVideoPayloadFromHttpError(errorData)
        const errorMsg = describeVideoGenerationFailure(message, code)
        apiLogger.error(errorMsg, errorData)
        throw new Error(errorMsg)
      }

      const data = await response.json()
      apiLogger.info('OpenAI格式视频生成任务已创建', data)

      if (!data.id) {
        throw new Error('视频任务创建失败，未获取到任务ID')
      }

      const videoId = data.id
      const maxAttempts = 60
      const pollInterval = 5000

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))

        const statusUrl = this.buildURL(`/videos/${videoId}`, config)
        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers
        })

        if (!statusResponse.ok) {
          continue
        }

        const statusData = await statusResponse.json()
        apiLogger.info(`OpenAI视频生成状态 ${attempt + 1}/${maxAttempts}:`, statusData)

        if (statusData.status === 'completed' || statusData.status === 'succeeded') {
          if (statusData.video_url || statusData.url) {
            return statusData.video_url || statusData.url
          }
        } else if (statusData.status === 'failed' || statusData.status === 'error') {
          const { message, code } = pickVideoTaskErrorPayload(statusData.error ?? (statusData as Record<string, unknown>).failure_reason)
          throw new Error(describeVideoGenerationFailure(message, code))
        }
      }

      throw new Error('视频生成超时，请稍后重试')
    } catch (error) {
      apiLogger.error('OpenAI视频生成错误:', error)
      throw error
    }
  }

  private async generateKlingVideo(prompt: string, options: {
    model: string
    size: string
    duration: string
    referenceImages?: string[]
    nodeId?: string
    modelGroup?: ApiModelGroup
  }): Promise<string> {
    const config = this.resolveConfig(options.modelGroup)
    const taskStore = options.nodeId ? useKlingVideoTaskStore() : null
    
    const imgs = (options.referenceImages ?? []).filter(Boolean)
    const imageCount = imgs.length
    
    // 验证并修正时长
    const validDurations = ['5', '10']
    let finalDuration = String(options.duration)
    apiLogger.info('Kling视频原始duration:', options.duration, '类型:', typeof options.duration, '转换后:', finalDuration)
    if (!validDurations.includes(finalDuration)) {
      finalDuration = validDurations[0]
      apiLogger.warn(`Kling视频时长${options.duration}无效，已修正为${finalDuration}`)
    }
    apiLogger.info('Kling视频最终duration:', finalDuration)
    
    let endpoint = '/kling/v1/videos/text2video'
    const body: Record<string, any> = {
      prompt,
      model_name: options.model,
      duration: finalDuration
    }
    
    if (imageCount === 1) {
      endpoint = '/kling/v1/videos/image2video'
      body.image = imgs[0]
    } else if (imageCount > 1) {
      endpoint = '/kling/v1/videos/multi-image2video'
      body.images = imgs
    }
    
    // 修复：避免重复的 /v1 前缀
    const base = String(config.baseURL ?? '').replace(/\/$/, '').replace(/\/v1$/, '')
    const ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = `${base}${ep}`
    
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    }
    
    apiLogger.info('Kling视频生成请求', { model: options.model, url, endpoint, imageCount, base, body })
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, unknown>
        const { message, code } = pickVideoPayloadFromHttpError(errorData)
        const errorMsg = describeVideoGenerationFailure(message, code)
        apiLogger.error(errorMsg, errorData)
        throw new Error(errorMsg)
      }
      
      const responseData = await response.json()
      apiLogger.info('Kling视频生成任务已创建', responseData)
      
      // 处理响应数据结构 {code: 0, data: {task_id: ...}, message: 'success'}
      const data = responseData.data || responseData
      
      if (!data.task_id && !data.id) {
        throw new Error('视频任务创建失败，未获取到任务ID')
      }
      
      const videoId = data.task_id || data.id
      const maxAttempts = 200
      const initialDelayMs = 3000
      const maxDelayMs = 30000
      const backoffFactor = 1.35

      if (taskStore && options.nodeId) {
        taskStore.upsertTask({
          nodeId: options.nodeId,
          taskId: String(videoId),
          model: options.model,
          endpoint,
          status: 'running',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          prompt,
          duration: options.duration,
          aspectRatio: options.size,
          referenceCount: imgs.length
        })
      }
      
      let delayMs = initialDelayMs
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
        delayMs = Math.min(maxDelayMs, Math.round(delayMs * backoffFactor))
        
        // 轮询必须使用“创建任务时的同一路径前缀”
        // /kling/v1/videos/text2video/{id}
        // /kling/v1/videos/image2video/{id}
        // /kling/v1/videos/multi-image2video/{id}
        const statusEndpoint = `${endpoint}/${videoId}`
        const statusUrl = `${base}${statusEndpoint}`
        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers
        })
        
        if (!statusResponse.ok) {
          const statusText = await statusResponse.text().catch(() => '')
          apiLogger.warn('Kling视频状态查询失败', {
            attempt: attempt + 1,
            maxAttempts,
            status: statusResponse.status,
            statusUrl,
            statusText
          })
          continue
        }
        
        let statusResponseData: any
        try {
          statusResponseData = await statusResponse.json()
        } catch (parseError) {
          const statusText = await statusResponse.text().catch(() => '')
          apiLogger.warn('Kling视频状态响应解析失败，继续轮询', {
            attempt: attempt + 1,
            maxAttempts,
            statusUrl,
            parseError: String(parseError),
            statusText
          })
          continue
        }
        apiLogger.info(`Kling视频生成状态 ${attempt + 1}/${maxAttempts}:`, statusResponseData)
        
        // 处理状态响应数据结构
        const statusData = statusResponseData.data || statusResponseData
        
        // 检查任务状态
        const taskStatus = statusData.task_status || statusData.status
        if (taskStatus === 'completed' || taskStatus === 'succeeded' || taskStatus === 'submit_success') {
          // 尝试从多种可能的字段中获取视频 URL
          let videoUrl = statusData.video_url || statusData.url
          if (!videoUrl && statusData.task_result && statusData.task_result.videos && statusData.task_result.videos.length > 0) {
            videoUrl = statusData.task_result.videos[0].url
          }
          if (videoUrl) {
            if (taskStore && options.nodeId) {
              taskStore.updateTask(options.nodeId, {
                status: 'completed',
                videoUrl: String(videoUrl)
              })
            }
            return videoUrl
          }
        } else if (taskStatus === 'failed' || taskStatus === 'error') {
          const { message, code } = pickVideoTaskErrorPayload(statusData.error ?? (statusData as Record<string, unknown>).failure_reason)
          const errorMessage = describeVideoGenerationFailure(message, code)
          if (taskStore && options.nodeId) {
            taskStore.updateTask(options.nodeId, {
              status: 'error',
              errorMessage
            })
          }
          throw new Error(errorMessage)
        }
      }
      
      if (taskStore && options.nodeId) {
        taskStore.updateTask(options.nodeId, {
          status: 'error',
          errorMessage: '视频生成超时，请稍后重试'
        })
      }
      throw new Error('视频生成超时，请稍后重试')
    } catch (error) {
      apiLogger.error('Kling视频生成错误:', error)
      throw error
    }
  }

  private async generateKlingOmniVideo(prompt: string, options: {
    model: string
    size: string
    duration: string
    referenceImages?: string[]
    nodeId?: string
    modelGroup?: ApiModelGroup
  }): Promise<string> {
    const config = this.resolveConfig(options.modelGroup)
    const taskStore = options.nodeId ? useKlingVideoTaskStore() : null
    
    const modelConfig = VIDEO_MODEL_CONFIG[options.model] ?? {}

    // 验证并修正时长
    const validDurations = modelConfig.durationOptions ?? ['5', '10']
    let finalDuration = String(options.duration)
    apiLogger.info('Kling Omni视频原始duration:', options.duration, '类型:', typeof options.duration, '转换后:', finalDuration)
    if (!validDurations.includes(finalDuration)) {
      finalDuration = validDurations[0]
      apiLogger.warn(`Kling Omni视频时长${options.duration}无效，已修正为${finalDuration}`)
    }
    apiLogger.info('Kling Omni视频最终duration:', finalDuration)

    const promptLimit = modelConfig.promptLimit ?? 4000
    const { prompt: finalPrompt, wasTrimmed } = clampPromptToMaxLength(prompt, promptLimit)
    if (wasTrimmed) {
      apiLogger.warn('视频prompt超出限制，已截断', {
        model: options.model,
        originalLength: prompt.length,
        maxLength: promptLimit,
        finalLength: finalPrompt.length
      })
    }
    
    const imgs = (options.referenceImages ?? []).filter(Boolean)
    const imageCount = imgs.length
    
    const body: Record<string, any> = {
      model_name: options.model,
      prompt: finalPrompt,
      duration: finalDuration
    }
    
    if (imageCount === 1) {
      body.image = imgs[0]
    } else if (imageCount > 1) {
      body.image_list = imgs.map((image) => ({ image }))
    }
    
    // 修复：避免重复的 /v1 前缀
    const base = String(config.baseURL ?? '').replace(/\/$/, '').replace(/\/v1$/, '')
    const endpoint = '/kling/v1/videos/omni-video'
    const url = `${base}${endpoint}`
    
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    }
    
    apiLogger.info('Kling Omni Video视频生成请求', { model: options.model, url, base, body })
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, unknown>
        const { message, code } = pickVideoPayloadFromHttpError(errorData)
        const errorMsg = describeVideoGenerationFailure(message, code)
        apiLogger.error(errorMsg, errorData)
        throw new Error(errorMsg)
      }
      
      const responseData = await response.json()
      apiLogger.info('Kling Omni Video视频生成任务已创建', responseData)
      
      // 处理响应数据结构 {code: 0, data: {task_id: ...}, message: 'success'}
      const data = responseData.data || responseData
      
      if (!data.task_id && !data.id) {
        throw new Error('视频任务创建失败，未获取到任务ID')
      }
      
      const videoId = data.task_id || data.id
      const maxAttempts = 200
      const initialDelayMs = 3000
      const maxDelayMs = 30000
      const backoffFactor = 1.35

      if (taskStore && options.nodeId) {
        taskStore.upsertTask({
          nodeId: options.nodeId,
          taskId: String(videoId),
          model: options.model,
          endpoint,
          status: 'running',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          prompt,
          duration: options.duration,
          aspectRatio: options.size,
          referenceCount: imgs.length
        })
      }
      
      let delayMs = initialDelayMs
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
        delayMs = Math.min(maxDelayMs, Math.round(delayMs * backoffFactor))
        
        // 修复：状态查询也避免重复的 /v1 前缀
        const statusEndpoint = `/kling/v1/videos/${videoId}`
        const statusUrl = `${base}${statusEndpoint}`
        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers
        })
        
        if (!statusResponse.ok) {
          const statusText = await statusResponse.text().catch(() => '')
          apiLogger.warn('Kling Omni Video状态查询失败', {
            attempt: attempt + 1,
            maxAttempts,
            status: statusResponse.status,
            statusUrl,
            statusText
          })
          continue
        }
        
        let statusResponseData: any
        try {
          statusResponseData = await statusResponse.json()
        } catch (parseError) {
          const statusText = await statusResponse.text().catch(() => '')
          apiLogger.warn('Kling Omni Video状态响应解析失败，继续轮询', {
            attempt: attempt + 1,
            maxAttempts,
            statusUrl,
            parseError: String(parseError),
            statusText
          })
          continue
        }
        apiLogger.info(`Kling Omni Video视频生成状态 ${attempt + 1}/${maxAttempts}:`, statusResponseData)
        
        // 处理状态响应数据结构
        const statusData = statusResponseData.data || statusResponseData
        
        // 检查任务状态
        const taskStatus = statusData.task_status || statusData.status
        if (taskStatus === 'completed' || taskStatus === 'succeeded' || taskStatus === 'submit_success') {
          // 尝试从多种可能的字段中获取视频 URL
          let videoUrl = statusData.video_url || statusData.url
          if (!videoUrl && statusData.task_result && statusData.task_result.videos && statusData.task_result.videos.length > 0) {
            videoUrl = statusData.task_result.videos[0].url
          }
          if (videoUrl) {
            if (taskStore && options.nodeId) {
              taskStore.updateTask(options.nodeId, {
                status: 'completed',
                videoUrl: String(videoUrl)
              })
            }
            return videoUrl
          }
        } else if (taskStatus === 'failed' || taskStatus === 'error') {
          const { message, code } = pickVideoTaskErrorPayload(statusData.error ?? (statusData as Record<string, unknown>).failure_reason)
          const errorMessage = describeVideoGenerationFailure(message, code)
          if (taskStore && options.nodeId) {
            taskStore.updateTask(options.nodeId, {
              status: 'error',
              errorMessage
            })
          }
          throw new Error(errorMessage)
        }
      }
      
      if (taskStore && options.nodeId) {
        taskStore.updateTask(options.nodeId, {
          status: 'error',
          errorMessage: '视频生成超时，请稍后重试'
        })
      }
      throw new Error('视频生成超时，请稍后重试')
    } catch (error) {
      apiLogger.error('Kling Omni Video视频生成错误:', error)
      throw error
    }
  }

  private async generateFlow2Video(prompt: string, options: {
    model: string
    size: string
    duration: string
    referenceImages?: string[]
    modelGroup?: ApiModelGroup
  }): Promise<string> {
    const config = this.resolveConfig(options.modelGroup)
    const model = options.model

    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = []

    if (options.referenceImages && options.referenceImages.length > 0) {
      for (const imageUrl of options.referenceImages) {
        content.push({
          type: 'image_url',
          image_url: { url: imageUrl }
        })
      }
    }

    content.push({
      type: 'text',
      text: prompt
    })

    const requestBody: Record<string, unknown> = {
      model,
      messages: [
        {
          role: 'user',
          content
        }
      ],
      temperature: 0.7,
      stream: false
    }

    const endpoint = '/v1/chat/completions'
    const url = this.buildURL(endpoint, config)
    const headers = this.buildHeaders(config)

    apiLogger.info('发送Flow2视频生成请求', {
      model,
      url,
      size: options.size,
      duration: options.duration
    })

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMsg = `视频生成失败: ${response.status} - ${errorData.error?.message || '未知错误'}`
        apiLogger.error(errorMsg, errorData)
        throw new Error(errorMsg)
      }

      const data = await response.json()

      apiLogger.info('Flow2视频生成完整响应', JSON.stringify(data, null, 2))

      const message = data.choices?.[0]?.message
      const contentData = message?.content || ''

      if (typeof contentData === 'string') {
        const htmlVideoMatch = contentData.match(/<video[^>]*src=['"]([^'"]+)['"]/)
        if (htmlVideoMatch) {
          apiLogger.info('Flow2视频生成成功，从HTML标签提取到URL')
          return htmlVideoMatch[1]
        }

        const markdownVideoMatch = contentData.match(/!\[.*?\]\((https?:\/\/[^\s"'<>]+\.(?:mp4|webm|mov)[^\s"'<>]*)\)/)
        if (markdownVideoMatch) {
          apiLogger.info('Flow2视频生成成功，从Markdown提取到URL')
          return markdownVideoMatch[1]
        }

        const urlMatch = contentData.match(/https?:\/\/[^\s"'<>]+\.(mp4|webm|mov)/i)
        if (urlMatch) {
          apiLogger.info('Flow2视频生成成功，提取到URL')
          return urlMatch[0]
        }
      }

      if (data.url) {
        apiLogger.info('Flow2视频生成成功，从data提取到URL')
        return data.url as string
      }

      apiLogger.warn('Flow2视频生成响应无法提取URL', data)
      throw new Error('无法从响应中提取视频URL')
    } catch (error) {
      apiLogger.error('Flow2视频生成错误:', error)
      throw error
    }
  }
}

export const apiService = new APIService()
export default apiService
