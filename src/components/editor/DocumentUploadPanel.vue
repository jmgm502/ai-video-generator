<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Upload, Document, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

interface Chapter {
  id: string
  title: string
  content: string
  selected: boolean
}

interface Props {
  extractedContent: string
  chapters: Chapter[]
  isProcessing: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:extractedContent', value: string): void
  (e: 'update:chapters', value: Chapter[]): void
  (e: 'extractChapters'): void
  (e: 'update:finalContent', value: string): void
}>()

const { t } = useI18n()

const localText = ref('')

const selectedChapters = computed(() => props.chapters.filter(c => c.selected))

const finalContent = computed(() => {
  if (selectedChapters.value.length > 0) {
    return selectedChapters.value.map(c => c.content).join('\n\n')
  }
  return localText.value
})

watch(() => props.extractedContent, (newVal) => {
  localText.value = newVal || ''
}, { immediate: true })

watch(finalContent, (newVal) => {
  emit('update:finalContent', newVal)
})

const handleTextChange = (value: string) => {
  localText.value = value
  emit('update:extractedContent', value)
}

const handleFileChange = (file: any) => {
  if (!file?.raw) return
  
  const uploadFile = file.raw
  if (!uploadFile.name.endsWith('.txt') && !uploadFile.name.endsWith('.doc') && !uploadFile.name.endsWith('.docx')) {
    ElMessage.warning(t('editorWorkshop.documentPanel.msgFormat'))
    return
  }
  
  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    localText.value = content
    emit('update:extractedContent', content)
    ElMessage.success(t('editorWorkshop.documentPanel.msgUploadOk'))
    emit('extractChapters')
  }
  reader.onerror = () => {
    ElMessage.error(t('editorWorkshop.documentPanel.msgReadFail'))
  }
  reader.readAsText(uploadFile)
}

const toggleChapter = (chapter: Chapter) => {
  const updated = props.chapters.map(c => 
    c.id === chapter.id ? { ...c, selected: !c.selected } : c
  )
  emit('update:chapters', updated)
}

const selectAllChapters = () => {
  const updated = props.chapters.map(c => ({ ...c, selected: true }))
  emit('update:chapters', updated)
}

const clearSelection = () => {
  const updated = props.chapters.map(c => ({ ...c, selected: false }))
  emit('update:chapters', updated)
}
</script>

<template>
  <div class="document-upload-panel">
    <div class="panel-header">
      <div class="header-left">
        <div class="header-icon">
          <el-icon :size="20">
            <Upload />
          </el-icon>
        </div>
        <div class="header-text">
          <h3 class="panel-title">
            {{ t('editorWorkshop.documentPanel.title') }}
          </h3>
          <p class="panel-desc">
            {{ t('editorWorkshop.documentPanel.subtitle') }}
          </p>
        </div>
      </div>
      <div class="header-actions">
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          accept=".txt,.doc,.docx"
          class="upload-btn-wrapper"
          @change="handleFileChange"
        >
          <el-button
            type="primary"
            class="upload-btn"
          >
            {{ t('editorWorkshop.documentPanel.uploadBtn') }}
          </el-button>
        </el-upload>
      </div>
    </div>

    <div class="content-preview">
      <div class="preview-content">
        <el-input
          v-model="localText"
          type="textarea"
          :placeholder="chapters.length > 0 ? t('editorWorkshop.documentPanel.phWithChapters') : t('editorWorkshop.documentPanel.phEmpty')"
          class="full-height-textarea"
          @input="handleTextChange"
        />
      </div>
    </div>

    <div class="chapters-section">
      <div class="chapters-header">
        <span class="chapters-label">{{ t('editorWorkshop.documentPanel.chaptersLabel', { n: chapters.length }) }}</span>
        <div class="chapters-actions">
          <el-button
            type="primary"
            class="upload-btn"
            :disabled="!localText.trim() || isProcessing"
            :loading="isProcessing"
            @click="$emit('extractChapters')"
          >
            {{ isProcessing ? t('editorWorkshop.documentPanel.extractLoading') : t('editorWorkshop.documentPanel.extractBtn') }}
          </el-button>
          <el-button
            v-if="chapters.length > 0"
            size="small"
            @click="selectAllChapters"
          >
            {{ t('editorWorkshop.documentPanel.selectAll') }}
          </el-button>
          <el-button
            v-if="chapters.length > 0"
            size="small"
            @click="clearSelection"
          >
            {{ t('editorWorkshop.documentPanel.clearSelection') }}
          </el-button>
        </div>
      </div>
      <div
        v-if="chapters.length > 0"
        class="chapters-list"
      >
        <div
          v-for="chapter in chapters"
          :key="chapter.id"
          :class="['chapter-item', { selected: chapter.selected }]"
          @click="toggleChapter(chapter)"
        >
          <el-checkbox 
            :model-value="chapter.selected" 
            @click.stop 
            @change="toggleChapter(chapter)" 
          />
          <el-icon class="chapter-icon">
            <Document />
          </el-icon>
          <span class="chapter-title">{{ chapter.title }}</span>
          <span class="chapter-length">{{ chapter.content.length }} {{ t('editorWorkshop.documentPanel.charsUnit') }}</span>
        </div>
      </div>
      <div
        v-else
        class="chapters-empty"
      >
        <p>{{ t('editorWorkshop.documentPanel.emptyHint') }}</p>
      </div>
      <div
        v-if="chapters.length > 0"
        class="chapters-footer"
      >
        <div class="selected-info">
          {{ t('editorWorkshop.documentPanel.selectedLine', { n: selectedChapters.length }) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.document-upload-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
  transition: width 0.3s ease;
  will-change: width;
}

.document-upload-panel.collapsed {
  width: 60px;
}

.document-upload-panel.collapsed .panel-header {
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 12px 8px;
  gap: 12px;
  min-height: 200px;
  border-bottom: none;
}

.document-upload-panel.collapsed .header-left {
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.document-upload-panel.collapsed .header-text {
  display: none;
}

.document-upload-panel.collapsed .header-actions {
  flex-direction: column;
  align-items: center;
  margin-left: 0;
}

.document-upload-panel.collapsed .content-preview,
.document-upload-panel.collapsed .chapters-section {
  display: none;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-desc {
  font-size: 12px;
  color: var(--text-muted);
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
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.upload-btn-wrapper {
  margin-left: 0;
}

.upload-btn-wrapper :deep(.el-upload) {
  display: inline-block;
}

.upload-btn {
  height: 28px;
  padding: 0 16px;
  font-size: 14px;
}

.collapse-btn {
  height: 28px;
  padding: 0 8px;
}

.content-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 16px 16px;
  min-height: 0;
  overflow: hidden;
}

.preview-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.preview-content :deep(.el-textarea) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.preview-content :deep(.el-textarea__inner) {
  flex: 1;
  background-color: var(--bg-color);
  border-color: var(--border-color);
  color: var(--text-primary);
  resize: none;
}

.chapters-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 16px 16px;
  overflow: hidden;
}

.chapters-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.chapters-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.chapters-actions {
  display: flex;
  gap: 8px;
}

.chapters-list {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-color);
}

.chapters-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-color);
}

.chapters-empty p {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  padding: 0 16px;
}

.chapter-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color 0.2s;
}

.chapter-item:last-child {
  border-bottom: none;
}

.chapter-item:hover {
  background-color: rgba(0, 214, 143, 0.05);
}

.chapter-item.selected {
  background-color: rgba(0, 214, 143, 0.1);
}

.chapter-icon {
  color: var(--text-muted);
}

.chapter-title {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chapter-length {
  font-size: 12px;
  color: var(--text-muted);
}

.chapters-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.selected-info {
  font-size: 13px;
  color: var(--text-secondary);
}

.selected-info strong {
  color: var(--primary-color);
}
</style>
