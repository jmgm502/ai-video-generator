import { ref, reactive } from 'vue'

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  nodes: any[]
  edges: any[]
  viewport: { x: number; y: number; zoom: number }
  createdAt: number
  updatedAt: number
  thumbnail?: string
  tags: string[]
}

const STORAGE_KEY = 'canvas_workflow_templates'

function loadTemplatesFromStorage(): WorkflowTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load workflow templates:', e)
  }
  return []
}

function saveTemplatesToStorage(templates: WorkflowTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  } catch (e) {
    console.error('Failed to save workflow templates:', e)
  }
}

export function useWorkflowTemplateStore() {
  const templates = ref<WorkflowTemplate[]>(loadTemplatesFromStorage())
  const selectedTemplate = ref<WorkflowTemplate | null>(null)

  function saveTemplate(template: Omit<WorkflowTemplate, 'id' | 'createdAt' | 'updatedAt'>): WorkflowTemplate {
    const now = Date.now()
    const newTemplate: WorkflowTemplate = {
      ...template,
      id: `workflow_${now}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now
    }
    templates.value.push(newTemplate)
    saveTemplatesToStorage(templates.value)
    return newTemplate
  }

  function updateTemplate(id: string, updates: Partial<WorkflowTemplate>): WorkflowTemplate | null {
    const index = templates.value.findIndex(t => t.id === id)
    if (index === -1) return null

    templates.value[index] = {
      ...templates.value[index],
      ...updates,
      updatedAt: Date.now()
    }
    saveTemplatesToStorage(templates.value)
    return templates.value[index]
  }

  function deleteTemplate(id: string): boolean {
    const index = templates.value.findIndex(t => t.id === id)
    if (index === -1) return false

    templates.value.splice(index, 1)
    saveTemplatesToStorage(templates.value)
    return true
  }

  function getTemplateById(id: string): WorkflowTemplate | null {
    return templates.value.find(t => t.id === id) || null
  }

  function exportTemplate(id: string): string | null {
    const template = getTemplateById(id)
    if (!template) return null
    return JSON.stringify(template, null, 2)
  }

  function importTemplate(jsonString: string): WorkflowTemplate | null {
    try {
      const template = JSON.parse(jsonString) as WorkflowTemplate
      const now = Date.now()
      const newTemplate: WorkflowTemplate = {
        ...template,
        id: `workflow_${now}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        updatedAt: now
      }
      templates.value.push(newTemplate)
      saveTemplatesToStorage(templates.value)
      return newTemplate
    } catch (e) {
      console.error('Failed to import workflow template:', e)
      return null
    }
  }

  return {
    templates,
    selectedTemplate,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplateById,
    exportTemplate,
    importTemplate
  }
}
