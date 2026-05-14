import type { Project, Storyboard, ImageAsset } from '@/types'

export interface ProjectInfo {
  id: string
  name: string
  type: 'creative' | 'canvas'
  path: string
  createdAt: string
  updatedAt: string
}

export interface ProjectData {
  id: string
  name: string
  type: 'creative' | 'canvas'
  description?: string
  createdAt: string
  updatedAt: string
}

export interface AssetData {
  id: string
  name: string
  type: 'character' | 'scene' | 'prop'
  description: string
  image?: string
  status?: string
  historyImages?: { id: string; url: string; createdAt: string }[]
}

export interface StoryboardData {
  id: string
  prompt: string
  systemPrompt?: string
  duration?: number
  image?: string
  video?: string
  generatedImages?: string[]
  generatedVideos?: string[]
  imagePrompt?: {
    characters: ImageAsset[]
    scene?: ImageAsset
    props: ImageAsset[]
  }
  status?: string
}

export interface ProjectFileData {
  project: ProjectData
  assets: AssetData[]
  storyboard: StoryboardData[]
  novelContent?: string
}

type ImageCategory = 'character' | 'scene' | 'prop' | 'storyboard' | 'canvas'

class ProjectFileService {
  serializeAssetForSave(asset: {
    id: string
    name: string
    type: 'character' | 'scene' | 'prop'
    description: string
    imageUrl?: string
    status?: string
    historyImages?: { id: string; url: string; createdAt: string | Date }[]
  }): AssetData {
    return {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      description: asset.description,
      image: asset.imageUrl,
      status: asset.status,
      historyImages: asset.historyImages?.map(hi => ({
        id: hi.id,
        url: hi.url,
        createdAt: typeof hi.createdAt === 'string' ? hi.createdAt : hi.createdAt instanceof Date ? hi.createdAt.toISOString() : String(hi.createdAt)
      }))
    }
  }

  serializeStoryboardForSave(storyboard: Storyboard): StoryboardData {
    const result =  {
      id: storyboard.id,
      prompt: storyboard.textPrompt?.description || '',
      systemPrompt: storyboard.textPrompt?.systemPrompt || '',
      duration: storyboard.duration,
      image: storyboard.generatedImage,
      video: storyboard.generatedVideo,
      generatedImages: storyboard.generatedImages || [],
      generatedVideos: storyboard.generatedVideos || [],
      imagePrompt: {
        characters: (storyboard.imagePrompt?.characters || []).map(c => ({ id: c.id, name: c.name, type: c.type, url: c.url, localPath: c.localPath, tags: c.tags, createdAt: c.createdAt })),
        scene: storyboard.imagePrompt?.scene ? { id: storyboard.imagePrompt.scene.id, name: storyboard.imagePrompt.scene.name, type: storyboard.imagePrompt.scene.type, url: storyboard.imagePrompt.scene.url, localPath: storyboard.imagePrompt.scene.localPath, tags: storyboard.imagePrompt.scene.tags, createdAt: storyboard.imagePrompt.scene.createdAt } : undefined,
        props: (storyboard.imagePrompt?.props || []).map(p => ({ id: p.id, name: p.name, type: p.type, url: p.url, localPath: p.localPath, tags: p.tags, createdAt: p.createdAt }))
      },
      status: storyboard.status
    }
    return result
  }

  deserializeStoryboard(data: StoryboardData, index: number): Storyboard {
    return {
      id: data.id,
      title: (data.prompt || '').substring(0, 50),
      order: index + 1,
      duration: data.duration || 5,
      textPrompt: {
        description: data.prompt || '',
        systemPrompt: data.systemPrompt || ''
      },
      imagePrompt: {
        characters: data.imagePrompt?.characters || [],
        scene: data.imagePrompt?.scene,
        props: data.imagePrompt?.props || [],
        compositeSettings: {
          positionX: 50,
          positionY: 50,
          scale: 100,
          opacity: 100,
          blendMode: 'normal' as const
        }
      },
      generatedImage: data.image,
      generatedVideo: data.video,
      generatedImages: data.generatedImages || [],
      generatedVideos: data.generatedVideos || [],
      status: (data.status as Storyboard['status']) || 'completed'
    }
  }

  deserializeAsset(data: AssetData) {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      imageUrl: data.image,
      status: (data.status || (data.image ? 'completed' : 'pending')) as 'pending' | 'generating' | 'completed' | 'failed',
      historyImages: (data.historyImages || []).map(hi => ({
        id: hi.id,
        url: hi.url,
        createdAt: typeof hi.createdAt === 'string' ? new Date(hi.createdAt) : hi.createdAt
      }))
    }
  }

  async createProject(project: Project): Promise<{ success: boolean; path?: string; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.create({
      id: project.id,
      name: project.name,
      type: project.type,
      description: project.description
    })
  }

  async loadProject(projectId: string, projectName: string): Promise<{
    success: boolean
    data?: ProjectFileData
    message?: string
  }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.load(projectId, projectName)
  }

  async saveProjectData(projectId: string, projectName: string, data: Partial<ProjectData>): Promise<{ success: boolean; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.saveData(projectId, projectName, 'project', data)
  }

  async saveAssetsData(projectId: string, projectName: string, assets: AssetData[]): Promise<{ success: boolean; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.saveData(projectId, projectName, 'assets', assets)
  }

  async saveStoryboardData(projectId: string, projectName: string, storyboard: StoryboardData[]): Promise<{ success: boolean; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    const serializedData = JSON.parse(JSON.stringify(storyboard))
    try {
      return await window.electronAPI.project.saveData(projectId, projectName, 'storyboard', serializedData)
    } catch (error) {
      throw error
    }
  }

  async saveAllProjectData(
    projectId: string,
    projectName: string,
    assets: AssetData[],
    storyboards: StoryboardData[],
    novelContent?: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const assetsResult = await this.saveAssetsData(projectId, projectName, assets)
      const storyboardResult = await this.saveStoryboardData(projectId, projectName, storyboards)
      if (novelContent) {
        await window.electronAPI?.project?.saveData(projectId, projectName, 'novel', { content: novelContent })
      }
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : '保存失败' }
    }
  }

  async listProjects(): Promise<{ success: boolean; projects?: ProjectInfo[]; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.list()
  }

  async listCanvasProjects(): Promise<{ success: boolean; projects?: ProjectInfo[]; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.listCanvas()
  }

  async deleteProject(projectId: string, projectName: string, fromRecycleBin: boolean = false, projectType?: 'creative' | 'canvas'): Promise<{ success: boolean; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.delete(projectId, projectName, fromRecycleBin, projectType)
  }

  async moveToRecycleBin(projectId: string, projectName: string, projectType?: 'creative' | 'canvas'): Promise<{ success: boolean; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.moveToRecycleBin(projectId, projectName, projectType)
  }

  async restoreFromRecycleBin(projectId: string, projectName: string, projectType?: 'creative' | 'canvas'): Promise<{ success: boolean; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.restoreFromRecycleBin(projectId, projectName, projectType)
  }

  async listRecycleBinProjects(): Promise<{ success: boolean; projects?: ProjectInfo[]; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.listRecycleBin()
  }

  async renameProject(projectId: string, oldName: string, newName: string): Promise<{ success: boolean; newPath?: string; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.rename(projectId, oldName, newName)
  }

  async clearProjectData(projectId: string, projectName: string): Promise<{ success: boolean; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.clearData(projectId, projectName)
  }

  async saveImage(
    projectId: string,
    projectName: string,
    category: ImageCategory,
    fileName: string,
    imageData: string,
    projectType?: 'creative' | 'canvas'
  ): Promise<{ success: boolean; path?: string; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.saveImage(
      projectId,
      projectName,
      category,
      fileName,
      imageData,
      projectType
    )
  }

  async loadImage(
    projectId: string,
    projectName: string,
    category: ImageCategory,
    fileName: string,
    projectType?: 'creative' | 'canvas'
  ): Promise<{ success: boolean; data?: string; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.loadImage(
      projectId,
      projectName,
      category,
      fileName,
      projectType
    )
  }

  async saveVideo(
    projectId: string,
    projectName: string,
    fileName: string,
    videoData: string,
    projectType?: 'creative' | 'canvas'
  ): Promise<{ success: boolean; path?: string; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.saveVideo(projectId, projectName, fileName, videoData, projectType)
  }

  async saveLocalVideo(
    projectId: string,
    projectName: string,
    fileName: string,
    fileData: string
  ): Promise<{ success: boolean; path?: string; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.saveLocalVideo(projectId, projectName, fileName, fileData)
  }

  async loadVideo(
    projectId: string,
    projectName: string,
    fileName: string
  ): Promise<{ success: boolean; path?: string; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.loadVideo(projectId, projectName, fileName)
  }

  async exportProject(projectId: string, projectName: string): Promise<{ success: boolean; path?: string; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.export(projectId, projectName)
  }

  async importProject(): Promise<{ success: boolean; project?: ProjectData; message?: string }> {
    if (!window.electronAPI?.project) {
      return { success: false, message: 'Electron API 不可用' }
    }

    return await window.electronAPI.project.import()
  }

  generateImageFileName(id: string, extension: string = 'png'): string {
    return `${id}.${extension}`
  }

  generateVideoFileName(id: string, extension: string = 'mp4'): string {
    return `${id}.${extension}`
  }
}

export const projectFileService = new ProjectFileService()