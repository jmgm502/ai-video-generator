<script setup lang="ts">
import { ref, computed } from 'vue'
import { EditPen, Document, Picture, VideoPlay, Plus, Edit, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElDialog, ElForm, ElInput } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { usePromptsStore, type PromptItem, type SubCategory } from '@/stores/promptsStore'

const { t } = useI18n()
const promptsStore = usePromptsStore()

const categories = computed(() => promptsStore.categories)

const activeSubCategory = ref<string>('extract-assets')
const selectedPrompt = ref<PromptItem | null>(null)

const showEditDialog = ref(false);
const editingPrompt = ref<PromptItem | null>(null);
const editForm = ref({
  title: '',
  description: '',
  content: ''
});

const activeSubCategoryData = computed(() => {
  for (const category of categories.value) {
    const sub = category.subCategories.find(s => s.id === activeSubCategory.value)
    if (sub) return sub
  }
  return null
})

const selectSubCategory = (subId: string) => {
  activeSubCategory.value = subId
  selectedPrompt.value = null
}

const selectPrompt = (prompt: PromptItem) => {
  selectedPrompt.value = prompt
}

const copyPrompt = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content)
    ElMessage.success(t('promptsPage.msgCopied'))
  } catch {
    ElMessage.error(t('promptsPage.msgCopyFail'))
  }
}

const resetPrompt = (prompt: PromptItem, subCategory: SubCategory) => {
  const currentPresetContent = getCurrentPresetContent(prompt, subCategory)
  prompt.content = currentPresetContent
  promptsStore.saveToStorage()
  const preset = subCategory.presets?.find(p => p.value === prompt.preset)
  const name = preset ? presetOptionLabel(preset.value) : t('promptsPage.badgeDefault')
  ElMessage.success(t('promptsPage.msgResetTo', { name }))
}

const savePrompt = (prompt: PromptItem) => {
  promptsStore.saveToStorage()
  ElMessage.success(t('promptsPage.msgSaved'))
}

const getCurrentPresetContent = (prompt: PromptItem, subCategory: SubCategory): string => {
  if (!subCategory.presets) return prompt.defaultContent
  const preset = subCategory.presets.find(p => p.value === prompt.preset)
  return preset ? preset.content : prompt.defaultContent
}

const isPromptCustom = (prompt: PromptItem, subCategory: SubCategory): boolean => {
  const currentPresetContent = getCurrentPresetContent(prompt, subCategory)
  return prompt.content !== currentPresetContent
}

const onContentChange = (prompt: PromptItem) => {
}

const onPresetChange = (prompt: PromptItem, presetValue: string, subCategory: SubCategory) => {
  const preset = subCategory.presets?.find(p => p.value === presetValue)
  if (preset) {
    prompt.content = preset.content
    prompt.preset = presetValue
    promptsStore.saveToStorage()
    ElMessage.success(t('promptsPage.msgSwitchedTo', { name: presetOptionLabel(preset.value) }))
  }
}

const hasPresets = (subCategory: SubCategory): boolean => {
  return !!subCategory.presets && subCategory.presets.length > 0
}

const subCategoryI18nKey = (id: string) =>
  id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

const categoryLabel = (id: string) => t(`promptsPage.categories.${id}`)

const subCategoryLabel = (id: string) => t(`promptsPage.subCategories.${subCategoryI18nKey(id)}`)

const presetOptionLabel = (value: string) => {
  if (value === 'default') return t('promptsPage.preset.systemDefault')
  if (value === 'preset-2') return t('promptsPage.preset.preset2')
  return value
}

const isImagePrompt = (subCategory: SubCategory): boolean => {
  return !!subCategory.exampleImage
}

const openAddDialog = () => {
  editingPrompt.value = null
  editForm.value = {
    title: '',
    description: '',
    content: ''
  }
  showEditDialog.value = true
}

const openEditDialog = (prompt: PromptItem) => {
  editingPrompt.value = prompt
  editForm.value = {
    title: prompt.title,
    description: prompt.description || '',
    content: prompt.content
  }
  showEditDialog.value = true
}

const saveEdit = () => {
  if (!editForm.value.title.trim() || !editForm.value.content.trim()) {
    ElMessage.warning('请填写完整信息')
    return
  }

  if (editingPrompt.value) {
    promptsStore.updateCustomPrompt(
      activeSubCategory.value,
      editingPrompt.value.id,
      editForm.value.title,
      editForm.value.description,
      editForm.value.content
    )
    ElMessage.success('模板已更新')
  } else {
    promptsStore.addCustomPrompt(
      activeSubCategory.value,
      editForm.value.title,
      editForm.value.description,
      editForm.value.content
    )
    ElMessage.success('模板已添加')
  }
  showEditDialog.value = false
}

const handleDeleteCustomPrompt = (prompt: PromptItem) => {
  promptsStore.deleteCustomPrompt(activeSubCategory.value, prompt.id)
  if (selectedPrompt.value?.id === prompt.id) {
    selectedPrompt.value = null
  }
  ElMessage.success('模板已删除')
}
</script>

<template>
  <div class="prompt-panel">
    <div class="panel-header">
      <div class="header-icon">
        <el-icon :size="20">
          <EditPen />
        </el-icon>
      </div>
      <div class="header-text">
        <h3 class="panel-title">
          {{ t('promptsPage.panelTitle') }}
        </h3>
        <p class="panel-desc">
          {{ t('promptsPage.panelDesc') }}
        </p>
      </div>
      <div class="header-warning">
        {{ t('promptsPage.jsonWarning') }}
      </div>
    </div>

    <div class="panel-content">
      <div class="category-sidebar">
        <div class="category-list">
          <div
            v-for="category in categories"
            :key="category.id"
            class="category-item"
          >
            <div class="category-header">
              <span class="category-name">{{ categoryLabel(category.id) }}</span>
            </div>
            <div class="sub-category-list">
              <div
                v-for="sub in category.subCategories"
                :key="sub.id"
                :class="['sub-category-item', { active: activeSubCategory === sub.id }]"
                @click="selectSubCategory(sub.id)"
              >
                {{ subCategoryLabel(sub.id) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="prompt-content">
        <div
          v-if="!activeSubCategoryData"
          class="empty-state"
        >
          <el-icon :size="48">
            <EditPen />
          </el-icon>
          <p>{{ t('promptsPage.pickCategoryHint') }}</p>
        </div>

        <template v-else>
          <div class="template-area">
            <div class="area-header">
              <div class="area-title">
                <el-icon><Document /></el-icon>
                <span>官方模板</span>
                <span class="count-badge">{{ activeSubCategoryData.officialPrompts.length }}</span>
              </div>
            </div>
            <div class="template-list">
              <div
                v-for="prompt in activeSubCategoryData.officialPrompts"
                :key="prompt.id"
                :class="['template-card', { active: selectedPrompt?.id === prompt.id }]"
                @click="selectPrompt(prompt)"
              >
                <div class="template-header">
                  <div class="template-name-wrapper">
                    <span class="template-name">{{ prompt.title }}</span>
                    <span class="tag official-tag">官方</span>
                  </div>
                </div>
                <div class="template-description">
                  {{ prompt.description }}
                </div>
              </div>
            </div>
          </div>

          <div class="template-area">
            <div class="area-header">
              <div class="area-title">
                <el-icon><EditPen /></el-icon>
                <span>我的模板</span>
                <span class="count-badge">{{ activeSubCategoryData.customPrompts.length }}</span>
              </div>
              <el-button type="primary" size="small" @click="openAddDialog">
                <el-icon><Plus /></el-icon>
                添加
              </el-button>
            </div>
            <div class="template-list">
              <div
                v-if="activeSubCategoryData.customPrompts.length === 0"
                class="empty-templates"
              >
                <p>暂无自定义模板，点击右上角"添加"按钮创建</p>
              </div>
              <div
                v-for="prompt in activeSubCategoryData.customPrompts"
                :key="prompt.id"
                :class="['template-card', { active: selectedPrompt?.id === prompt.id }]"
                @click="selectPrompt(prompt)"
              >
                <div class="template-header">
                  <div class="template-name-wrapper">
                    <span class="template-name">{{ prompt.title }}</span>
                    <span class="tag custom-tag">自定义</span>
                  </div>
                  <div class="template-actions">
                    <el-button size="small" @click.stop="openEditDialog(prompt)">
                      <el-icon><Edit /></el-icon>
                    </el-button>
                    <el-button size="small" type="danger" @click.stop="handleDeleteCustomPrompt(prompt)">
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                </div>
                <div class="template-description">
                  {{ prompt.description }}
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <el-dialog
      v-model="showEditDialog"
      :title="editingPrompt ? '编辑模板' : '添加模板'"
      width="700px"
      :close-on-click-modal="false"
    >
      <el-form label-width="100px">
        <el-form-item label="模板名称">
          <el-input v-model="editForm.title" placeholder="请输入模板名称" />
        </el-form-item>
        <el-form-item label="模板介绍">
          <el-input v-model="editForm.description" placeholder="简短描述模板用途" />
        </el-form-item>
        <el-form-item label="提示词内容">
          <el-input
            v-model="editForm.content"
            type="textarea"
            :rows="12"
            placeholder="请输入提示词内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.prompt-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.header-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
  border-radius: 10px;
  color: #fff;
  flex-shrink: 0;
}

.header-text {
  flex-shrink: 0;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.panel-desc {
  font-size: 12px;
  color: var(--text-muted);
}

.header-warning {
  margin-left: auto;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: #e6a23c;
  background-color: rgba(230, 162, 60, 0.1);
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid rgba(230, 162, 60, 0.3);
}

.panel-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  padding-left: 80px;
}

.category-sidebar {
  width: 240px;
  border: 1px solid var(--border-color);
  overflow-y: auto;
  flex-shrink: 0;
}

.category-list {
  padding: 8px;
}

.category-item {
  margin-bottom: 8px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  background-color: var(--bg-tertiary);
  border-radius: 6px;
  cursor: default;
}

.category-name {
  flex: 1;
}

.sub-category-list {
  margin-top: 4px;
  padding-left: 8px;
}

.sub-category-item {
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 2px;
}

.sub-category-item:hover {
  background-color: rgba(102, 126, 234, 0.1);
  color: var(--primary-color);
}

.sub-category-item.active {
  background-color: var(--primary-color);
  color: #fff;
}

.prompt-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 16px;
  gap: 16px;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  gap: 12px;
}

.template-area {
  background-color: var(--bg-tertiary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.area-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--bg-color);
  border-bottom: 1px solid var(--border-color);
}

.area-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.count-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  background-color: rgba(102, 126, 234, 0.15);
  color: var(--primary-color);
}

.template-list {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-templates {
  text-align: center;
  padding: 32px;
  color: var(--text-muted);
}

.template-card {
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}

.template-card:hover {
  border-color: var(--primary-color);
  background-color: rgba(102, 126, 234, 0.05);
}

.template-card.active {
  border-color: var(--primary-color);
  background-color: rgba(102, 126, 234, 0.1);
}

.template-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.template-name-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.template-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.official-tag {
  background-color: rgba(102, 126, 234, 0.15);
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
}

.custom-tag {
  background-color: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid #10b981;
}

.template-actions {
  display: flex;
  gap: 8px;
}

.template-description {
  padding: 12px 16px;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
}
</style>
