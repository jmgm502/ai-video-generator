export interface User {
  id: string
  username: string
  email: string
  avatar?: string
  userGroup: 'normal' | 'vip'
  vipExpireAt?: string
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

export interface Project {
  id: string
  name: string
  type: 'creative' | 'canvas'
  description?: string
  orientation: 'horizontal' | 'vertical'
  resolution: {
    width: number
    height: number
  }
  storyboards: Storyboard[]
  createdAt: string
  updatedAt: string
}

export interface Storyboard {
  id: string
  title?: string
  order: number
  duration: number
  textPrompt: {
    description: string
    systemPrompt: string
  }
  imagePrompt: {
    characters: ImageAsset[]
    scene?: ImageAsset
    props: ImageAsset[]
    compositeSettings: CompositeSettings
  }
  matchedAssets?: {
    characters: string[]
    scene?: string
    props: string[]
  }
  generatedImages: string[]
  generatedImage?: string
  generatedVideos: string[]
  generatedVideo?: string
  videoTaskId?: string
  /** Grok 等异步视频任务创建时的 API 分组，恢复轮询时需与此一致 */
  videoApiModelGroup?: 'youshang' | 'official' | 'flow2'
  status: 'pending' | 'generating' | 'completed' | 'failed'
}

export interface ImageAsset {
  id: string
  name: string
  type: 'character' | 'scene' | 'props'
  url: string
  localPath?: string
  tags: string[]
  createdAt: string
}

export interface CompositeSettings {
  positionX: number
  positionY: number
  scale: number
  opacity: number
  blendMode: string
}

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface LoginRequest {
  username: string
  password: string
  remember?: boolean
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  confirmPassword: string
}

export interface LoginResponse {
  user: User
  token: string
  refreshToken: string
}

export interface GenerateImageRequest {
  prompt: string
  negativePrompt?: string
  width?: number
  height?: number
  style?: string
}

export interface GenerateVideoRequest {
  image?: string
  prompt: string
  duration: number
  fps?: number
}

export interface TaskStatus {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  result?: string
  error?: string
}
