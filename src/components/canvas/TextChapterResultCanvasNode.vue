<script setup lang="ts">
import { computed, inject, withDefaults } from 'vue'
import { useI18n } from 'vue-i18n'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { useCanvasNodeTitle } from '@/composables/useCanvasNodeUiI18n'

const { t } = useI18n()
const { canvasNodeDisplayTitle } = useCanvasNodeTitle()

interface ChapterItem {
  id: string
  title: string
  content: string
  selected?: boolean
}

interface TextChapterResultNodeData {
  label: string
  type: string
  status?: 'pending' | 'running' | 'completed' | 'error'
  description?: string
  sourceNodeId?: string
  chapters?: ChapterItem[]
  nodeTitleI18n?: { key: string; params?: Record<string, string | number> }
}

interface Props {
  id: string
  selected?: boolean
  data: TextChapterResultNodeData
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
})

const { updateNodeData: rawUpdateNodeData } = useVueFlow()
const scheduleCanvasAutoSave = inject<(() => void) | undefined>('scheduleCanvasAutoSave', undefined)

function updateNodeData(nodeId: string, data: Partial<any>) {
  rawUpdateNodeData(nodeId, data)
  scheduleCanvasAutoSave?.()
}

const headerTitle = computed(() =>
  canvasNodeDisplayTitle(props.data, 'canvas.nodeUi.textProcess.chapterDetectLabel', {
    preferFallbackOverPersisted: true
  })
)

const chapters = computed<ChapterItem[]>(() =>
  (props.data.chapters ?? []).filter((chapter): chapter is ChapterItem =>
    Boolean(chapter && typeof chapter.id === 'string' && chapter.id.trim().length > 0)
  )
)

const statusColor = computed(() => {
  switch (props.data.status) {
    case 'running': return '#409eff'
    case 'completed': return '#67c23a'
    case 'error': return '#f56c6c'
    default: return '#909399'
  }
})

function patchChapterSelection(nextChapters: ChapterItem[]) {
  updateNodeData(props.id, { chapters: nextChapters })
  const selectedChapterIds = nextChapters.filter(c => c.selected).map(c => c.id)
  if (props.data.sourceNodeId) {
    updateNodeData(props.data.sourceNodeId, { selectedChapterIds })
  }
}

function toggleChapter(chapterId: string, value: boolean) {
  const next = chapters.value.map(chapter =>
    chapter.id === chapterId ? { ...chapter, selected: value } : chapter
  )
  patchChapterSelection(next)
}

function selectAll() {
  patchChapterSelection(chapters.value.map(chapter => ({ ...chapter, selected: true })))
}

function clearSelection() {
  patchChapterSelection(chapters.value.map(chapter => ({ ...chapter, selected: false })))
}
</script>

<template>
  <div class="text-chapter-node-root">
    <Handle type="target" :position="Position.Left" class="handle handle-target" />
    <div class="text-chapter-node" :class="{ 'is-selected': selected }">
      <div class="node-header">
        <span class="node-label">{{ headerTitle }}</span>
        <span class="chapter-count">{{ t('canvas.nodeUi.textChapter.chaptersCount', { n: chapters.length }) }}</span>
      </div>
      <div class="node-actions nodrag nopan">
        <button type="button" class="small-btn" @click="selectAll">{{ t('canvas.nodeUi.textChapter.selectAll') }}</button>
        <button type="button" class="small-btn" @click="clearSelection">{{ t('canvas.nodeUi.textChapter.clearSelection') }}</button>
      </div>
      <div class="node-body nodrag nopan" @wheel.stop>
        <div v-if="chapters.length === 0" class="node-empty">{{ t('canvas.nodeUi.textChapter.noChapters') }}</div>
        <label v-for="(chapter, index) in chapters" :key="chapter.id || `chapter-${index}`" class="chapter-item">
          <input
            type="checkbox"
            :checked="Boolean(chapter.selected)"
            @change="toggleChapter(chapter.id, ($event.target as HTMLInputElement).checked)"
          >
          <span class="chapter-title">{{ chapter.title }}</span>
        </label>
      </div>
      <div class="node-status" :style="{ backgroundColor: statusColor }" />
    </div>
    <Handle type="source" :position="Position.Right" class="handle handle-source" />
  </div>
</template>

<style scoped>
.text-chapter-node-root {
  position: relative;
}

.text-chapter-node {
  min-width: 300px;
  max-width: 320px;
  min-height: 360px;
  background: var(--bg-secondary, #1a1a2e);
  border: 2px solid var(--border-color, #3a3a4a);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.text-chapter-node.is-selected {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.4), 0 4px 14px rgba(64, 158, 255, 0.22);
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: var(--bg-tertiary, #25253a);
  border-bottom: 1px solid var(--border-color, #3a3a4a);
}

.node-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.chapter-count {
  font-size: 11px;
  color: var(--text-secondary, #a0a0b0);
}

.node-actions {
  display: flex;
  gap: 8px;
  padding: 8px 10px 0;
}

.small-btn {
  border: 1px solid var(--border-color, #3a3a4a);
  background: transparent;
  color: var(--text-secondary, #a0a0b0);
  border-radius: 6px;
  font-size: 11px;
  padding: 2px 8px;
  cursor: pointer;
}

.small-btn:hover {
  border-color: #409eff;
  color: #409eff;
}

.node-body {
  padding: 8px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 280px;
  overflow: auto;
}

.node-empty {
  font-size: 12px;
  color: var(--text-secondary, #a0a0b0);
}

.chapter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border-color, #3a3a4a);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--text-primary, #fff);
}

.chapter-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-status {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.handle {
  z-index: 2;
  width: 10px !important;
  height: 10px !important;
  min-width: 10px;
  min-height: 10px;
  border-radius: 50% !important;
  background: #409eff !important;
  border: 2px solid #ffffff !important;
}

.handle-target {
  left: 0 !important;
}

.handle-source {
  right: 0 !important;
}
</style>
