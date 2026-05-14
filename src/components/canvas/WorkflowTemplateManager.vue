<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Delete,
  Edit,
  Download,
  Upload,
  Close
} from '@element-plus/icons-vue'
import { useWorkflowTemplateStore, type WorkflowTemplate } from '@/composables/useWorkflowTemplate'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'load-template': [template: WorkflowTemplate]
}>()

const { t } = useI18n()
const workflowStore = useWorkflowTemplateStore()

const showSaveDialog = ref(false)
const showImportDialog = ref(false)
const importJsonText = ref('')
const newTemplateName = ref('')
const newTemplateDescription = ref('')

const filteredTemplates = computed(() => {
  return workflowStore.templates.value
})

function handleSaveTemplate() {
  if (!newTemplateName.value.trim()) {
    ElMessage.warning('请输入模板名称')
    return
  }
  
  const template = workflowStore.saveTemplate({
    name: newTemplateName.value,
    description: newTemplateDescription.value,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    tags: []
  })
  
  ElMessage.success('模板保存成功')
  showSaveDialog.value = false
  newTemplateName.value = ''
  newTemplateDescription.value = ''
}

function handleDeleteTemplate(template: WorkflowTemplate) {
  ElMessageBox.confirm(
    `确定要删除模板 "${template.name}" 吗？`,
    '确认删除',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    workflowStore.deleteTemplate(template.id)
    ElMessage.success('模板已删除')
  }).catch(() => {})
}

function handleLoadTemplate(template: WorkflowTemplate) {
  emit('load-template', template)
  emit('update:visible', false)
}

function handleExportTemplate(template: WorkflowTemplate) {
  const json = workflowStore.exportTemplate(template.id)
  if (!json) {
    ElMessage.error('导出失败')
    return
  }
  
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${template.name}.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('模板导出成功')
}

function handleImportTemplate() {
  if (!importJsonText.value.trim()) {
    ElMessage.warning('请输入模板 JSON')
    return
  }
  
  const template = workflowStore.importTemplate(importJsonText.value)
  if (template) {
    ElMessage.success('模板导入成功')
    showImportDialog.value = false
    importJsonText.value = ''
  } else {
    ElMessage.error('模板导入失败，请检查 JSON 格式')
  }
}

function handleImportFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const template = workflowStore.importTemplate(content)
      if (template) {
        ElMessage.success('模板导入成功')
      } else {
        ElMessage.error('模板导入失败，请检查 JSON 格式')
      }
    }
    reader.readAsText(file)
  }
  input.click()
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="工作流模板管理"
    width="800px"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="workflow-template-manager">
      <div class="template-actions">
        <el-button type="primary" :icon="Plus" @click="showSaveDialog = true">
          新建模板
        </el-button>
        <el-button :icon="Upload" @click="showImportDialog = true">
          导入模板
        </el-button>
      </div>

      <div class="template-list">
        <div
          v-for="template in filteredTemplates"
          :key="template.id"
          class="template-card"
        >
          <div class="template-header">
            <h3 class="template-name">{{ template.name }}</h3>
            <div class="template-actions">
              <el-button
                type="primary"
                size="small"
                @click="handleLoadTemplate(template)"
              >
                加载
              </el-button>
              <el-button
                size="small"
                :icon="Download"
                @click="handleExportTemplate(template)"
              />
              <el-button
                size="small"
                :icon="Delete"
                type="danger"
                @click="handleDeleteTemplate(template)"
              />
            </div>
          </div>
          <p class="template-description">{{ template.description || '暂无描述' }}</p>
          <div class="template-meta">
            <span class="template-date">
              创建时间：{{ new Date(template.createdAt).toLocaleString() }}
            </span>
            <span class="template-nodes">
              节点数：{{ template.nodes.length }}
            </span>
          </div>
        </div>

        <div v-if="filteredTemplates.length === 0" class="empty-state">
          <p>暂无工作流模板</p>
          <el-button type="primary" :icon="Plus" @click="showSaveDialog = true">
            创建第一个模板
          </el-button>
        </div>
      </div>
    </div>

    <!-- 新建模板对话框 -->
    <el-dialog
      v-model="showSaveDialog"
      title="新建工作流模板"
      width="400px"
      append-to-body
    >
      <el-form label-width="80px">
        <el-form-item label="模板名称">
          <el-input v-model="newTemplateName" placeholder="请输入模板名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="newTemplateDescription"
            type="textarea"
            placeholder="请输入模板描述"
            :rows="3"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSaveDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSaveTemplate">保存</el-button>
      </template>
    </el-dialog>

    <!-- 导入模板对话框 -->
    <el-dialog
      v-model="showImportDialog"
      title="导入工作流模板"
      width="600px"
      append-to-body
    >
      <div class="import-options">
        <el-button type="primary" @click="handleImportFile">
          从文件导入
        </el-button>
        <span class="import-divider">或</span>
        <el-input
          v-model="importJsonText"
          type="textarea"
          placeholder="粘贴模板 JSON 内容"
          :rows="8"
        />
      </div>
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" @click="handleImportTemplate">导入</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<style scoped>
.workflow-template-manager {
  padding: 16px 0;
}

.template-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.template-card {
  padding: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fafafa;
  transition: box-shadow 0.2s ease;
}

.template-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.template-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.template-actions {
  display: flex;
  gap: 8px;
}

.template-description {
  margin: 0 0 12px;
  font-size: 14px;
  color: #606266;
  line-height: 1.5;
}

.template-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #909399;
}

.empty-state {
  text-align: center;
  padding: 40px 0;
  color: #909399;
}

.empty-state p {
  margin-bottom: 16px;
}

.import-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.import-divider {
  text-align: center;
  color: #909399;
  font-size: 14px;
}
</style>
