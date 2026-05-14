<script setup lang="ts">
import { computed } from 'vue'
import { Film, Check, Loading, Refresh, Edit } from '@element-plus/icons-vue'
import type { Storyboard } from '@/types'

interface Props {
  storyboards: Storyboard[]
  isGenerating: boolean
  selectedChapterCount: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'editStoryboard', id: string): void
  (e: 'regenerate', id: string): void
  (e: 'generateStoryboards'): void
  (e: 'goToStep2'): void
}>()

const completedCount = computed(() => 
  props.storyboards.filter(s => s.status === 'completed').length
)
</script>

<template>
  <div class="storyboard-generation-panel">
    <div class="panel-header">
      <div class="header-icon">
        <el-icon :size="20">
          <Film />
        </el-icon>
      </div>
      <div class="header-text">
        <h3 class="panel-title">
          分镜生成
        </h3>
        <p class="panel-desc">
          AI生成分镜
        </p>
      </div>
      <div class="header-actions">
        <el-button
          type="primary"
          class="action-btn"
          :loading="isGenerating"
          :disabled="selectedChapterCount === 0"
          @click="$emit('generateStoryboards')"
        >
          {{ isGenerating ? '生成中...' : '生成分镜' }}
        </el-button>
      </div>
    </div>

    <div class="generation-info">
      <div class="info-item">
        <span class="info-label">总分镜数</span>
        <span class="info-value">{{ storyboards.length }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">已完成</span>
        <span class="info-value">{{ completedCount }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">选中章节</span>
        <span class="info-value">{{ selectedChapterCount }}</span>
      </div>
    </div>

    <div class="asset-content">
      <div
        v-if="storyboards.length === 0"
        class="empty-state"
      >
        <el-icon
          :size="48"
          color="var(--text-muted)"
        >
          <Film />
        </el-icon>
        <p>暂无分镜数据</p>
        <p class="empty-hint">
          请先选择章节并点击"生成分镜"
        </p>
      </div>

      <div
        v-else
        class="storyboard-list"
      >
        <div
          v-for="storyboard in storyboards"
          :key="storyboard.id"
          :class="['storyboard-item', { completed: storyboard.status === 'completed' }]"
        >
          <div class="item-order">
            <span>{{ storyboard.order }}</span>
          </div>
          <div class="item-content">
            <div class="item-description">
              {{ storyboard.textPrompt.description || '等待生成...' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="completedCount === storyboards.length && storyboards.length > 0"
      class="panel-footer"
    >
      <div class="completion-message">
        <el-icon color="var(--primary-color)">
          <Check />
        </el-icon>
        <span>所有分镜已生成完成</span>
      </div>
      <el-button
        type="primary"
        @click="$emit('goToStep2')"
      >
        进入第二步：编辑分镜
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.storyboard-generation-panel {
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
}

.header-text {
  flex: 1;
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

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  height: 35px;
  padding: 0 16px;
  font-size: 14px;
}

.generation-info {
  display: flex;
  justify-content: space-around;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.info-item {
  text-align: center;
}

.info-label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.info-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.asset-content {
  flex: 1;
  overflow-y: auto;
  margin: 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
}

.empty-state p {
  margin-top: 12px;
  font-size: 14px;
}

.empty-hint {
  font-size: 12px !important;
  color: var(--text-muted);
}

.storyboard-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.storyboard-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: var(--bg-color);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s;
}

.storyboard-item:hover {
  border-color: var(--primary-color);
}

.storyboard-item.active {
  background-color: rgba(0, 214, 143, 0.1);
  border-color: var(--primary-color);
}

.item-order {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-tertiary);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.storyboard-item.completed .item-order {
  background-color: var(--primary-color);
  color: #fff;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-description {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-status {
  display: flex;
  align-items: center;
}

.status-failed {
  color: var(--danger-color);
  font-size: 12px;
}

.rotating {
  animation: rotate 1s linear infinite;
  color: var(--primary-color);
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.item-actions {
  display: flex;
  gap: 8px;
}

.panel-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
}

.completion-message {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--primary-color);
}
</style>
