import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Project } from '@/types'
import { projectFileService, type ProjectInfo } from '@/services/projectFileService'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)
  const loading = ref(false)
  const projectDataLoaded = ref<Set<string>>(new Set())
  const projectDataLoading = ref(false)
  const pendingCreativeContent = ref<string | null>(null)

  const projectCount = computed(() => projects.value.length)
  const hasProjects = computed(() => projects.value.length > 0)

  async function loadProjects(): Promise<boolean> {
    loading.value = true
    try {
      const result = await projectFileService.listProjects()
      if (result.success && result.projects) {
        projects.value = result.projects.map((p: ProjectInfo) => ({
          id: p.id,
          name: p.name,
          type: p.type || 'creative',
          description: '',
          orientation: 'horizontal' as const,
          resolution: { width: 1920, height: 1080 },
          storyboards: [],
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        }))
        return true
      }
      return false
    } catch (error) {
      console.error('加载项目列表失败:', error)
      return false
    } finally {
      loading.value = false
    }
  }

  async function loadCanvasProjects(): Promise<boolean> {
    loading.value = true
    try {
      const result = await projectFileService.listCanvasProjects()
      if (result.success && result.projects) {
        projects.value = result.projects.map((p: ProjectInfo) => ({
          id: p.id,
          name: p.name,
          type: p.type || 'canvas',
          description: '',
          orientation: 'horizontal' as const,
          resolution: { width: 1920, height: 1080 },
          storyboards: [],
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        }))
        return true
      }
      return false
    } catch (error) {
      console.error('加载画布项目列表失败:', error)
      return false
    } finally {
      loading.value = false
    }
  }

  async function addProject(project: Project): Promise<boolean> {
    try {
      const result = await projectFileService.createProject(project)
      if (result.success) {
        projects.value.unshift(project)
        return true
      }
      console.error('创建项目失败:', result.message)
      return false
    } catch (error) {
      console.error('创建项目失败:', error)
      return false
    }
  }

  async function updateProject(projectId: string, updates: Partial<Project>): Promise<boolean> {
    const index = projects.value.findIndex((p) => p.id === projectId)
    if (index !== -1) {
      const project = projects.value[index]
      const updatedProject = { ...project, ...updates }
      
      if (currentProject.value?.id === projectId) {
        const result = await projectFileService.saveProjectData(
          projectId, 
          project.name, 
          { name: updates.name, description: updates.description }
        )
        if (result.success) {
          projects.value[index] = updatedProject
          currentProject.value = updatedProject
          return true
        }
        return false
      }
      
      projects.value[index] = updatedProject
      return true
    }
    return false
  }

  async function deleteProject(projectId: string, fromRecycleBin: boolean = false): Promise<boolean> {
    const project = projects.value.find((p) => p.id === projectId)
    if (!project) return false
    
    try {
      const result = await projectFileService.deleteProject(projectId, project.name, fromRecycleBin, project.type)
      if (result.success) {
        if (!fromRecycleBin) {
          const index = projects.value.findIndex((p) => p.id === projectId)
          if (index !== -1) {
            projects.value.splice(index, 1)
          }
        }
        if (currentProject.value?.id === projectId) {
          currentProject.value = null
          projectDataLoaded.value.delete(projectId)
        }
        return true
      }
      return false
    } catch (error) {
      console.error('删除项目失败:', error)
      return false
    }
  }

  async function moveToRecycleBin(projectId: string): Promise<boolean> {
    const project = projects.value.find((p) => p.id === projectId)
    if (!project) return false
    
    try {
      const result = await projectFileService.moveToRecycleBin(projectId, project.name, project.type)
      if (result.success) {
        const index = projects.value.findIndex((p) => p.id === projectId)
        if (index !== -1) {
          projects.value.splice(index, 1)
        }
        recycleBinProjects.value.unshift({ ...project })
        return true
      }
      return false
    } catch (error) {
      console.error('移至回收站失败:', error)
      return false
    }
  }

  async function restoreFromRecycleBin(projectId: string): Promise<boolean> {
    const project = recycleBinProjects.value.find((p) => p.id === projectId)
    if (!project) return false
    
    try {
      const result = await projectFileService.restoreFromRecycleBin(projectId, project.name, project.type)
      if (result.success) {
        const index = recycleBinProjects.value.findIndex((p) => p.id === projectId)
        if (index !== -1) {
          recycleBinProjects.value.splice(index, 1)
        }
        projects.value.unshift({ ...project })
        return true
      }
      return false
    } catch (error) {
      console.error('从回收站恢复失败:', error)
      return false
    }
  }

  async function loadRecycleBinProjects(): Promise<boolean> {
    try {
      const result = await projectFileService.listRecycleBinProjects()
      if (result.success && result.projects) {
        recycleBinProjects.value = result.projects.map((p: ProjectInfo) => ({
          id: p.id,
          name: p.name,
          type: p.type || 'creative',
          description: '',
          orientation: 'horizontal' as const,
          resolution: { width: 1920, height: 1080 },
          storyboards: [],
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        }))
        return true
      }
      return false
    } catch (error) {
      console.error('加载回收站项目列表失败:', error)
      return false
    }
  }

  async function renameProject(projectId: string, newName: string): Promise<boolean> {
    const project = projects.value.find((p) => p.id === projectId)
    if (!project) return false
    
    try {
      const result = await projectFileService.renameProject(projectId, project.name, newName)
      if (result.success) {
        const index = projects.value.findIndex((p) => p.id === projectId)
        if (index !== -1) {
          projects.value[index] = { ...projects.value[index], name: newName, updatedAt: new Date().toISOString() }
        }
        if (currentProject.value?.id === projectId) {
          currentProject.value = { ...currentProject.value, name: newName, updatedAt: new Date().toISOString() }
        }
        return true
      }
      return false
    } catch (error) {
      console.error('重命名项目失败:', error)
      return false
    }
  }

  async function clearProjectData(projectId: string): Promise<boolean> {
    const project = projects.value.find((p) => p.id === projectId)
    if (!project) return false
    
    try {
      const result = await projectFileService.clearProjectData(projectId, project.name)
      if (result.success) {
        projectDataLoaded.value.delete(projectId)
        return true
      }
      return false
    } catch (error) {
      console.error('清空项目数据失败:', error)
      return false
    }
  }

  const recycleBinProjects = ref<Project[]>([])

  function setCurrentProject(project: Project | null) {
    currentProject.value = project
    if (project) {
      const index = projects.value.findIndex(p => p.id === project.id)
      if (index > 0) {
        projects.value.splice(index, 1)
        projects.value.unshift(project)
      }
    }
  }

  function setProjectDataLoaded(projectId: string) {
    projectDataLoaded.value.add(projectId)
  }

  function isProjectDataLoaded(projectId: string): boolean {
    return projectDataLoaded.value.has(projectId)
  }

  function setLoading(value: boolean) {
    loading.value = value
  }

  function clearProjects() {
    projects.value = []
    currentProject.value = null
    projectDataLoaded.value.clear()
  }

  return {
    projects,
    currentProject,
    loading,
    projectDataLoaded,
    projectDataLoading,
    pendingCreativeContent,
    projectCount,
    hasProjects,
    recycleBinProjects,
    loadProjects,
    loadCanvasProjects,
    addProject,
    updateProject,
    deleteProject,
    moveToRecycleBin,
    restoreFromRecycleBin,
    loadRecycleBinProjects,
    renameProject,
    clearProjectData,
    setCurrentProject,
    setProjectDataLoaded,
    isProjectDataLoaded,
    setLoading,
    clearProjects,
  }
})
