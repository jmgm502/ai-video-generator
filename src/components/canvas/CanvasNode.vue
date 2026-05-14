<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { computed, withDefaults, type Component } from 'vue'
import { Picture, VideoPlay, Document, Microphone, Box } from '@element-plus/icons-vue'

interface Props {
  id: string
  /** Vue Flow 传入 */
  selected?: boolean
  data: {
    label: string
    type: string
    icon?: string
    status?: 'pending' | 'running' | 'completed' | 'error'
    description?: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
})

const statusColor = computed(() => {
  switch (props.data.status) {
    case 'running': return '#409eff'
    case 'completed': return '#67c23a'
    case 'error': return '#f56c6c'
    default: return '#909399'
  }
})

const headerIcon = computed((): Component => {
  const t = props.data.type
  if (t === 'video') return VideoPlay
  if (t === 'text') return Document
  if (t === 'audio') return Microphone
  if (t === 'image') return Picture
  return Box
})

const headerIconClass = computed(() => {
  const t = props.data.type
  if (t === 'video') return 'node-type-icon--video'
  if (t === 'text') return 'node-type-icon--text'
  if (t === 'audio') return 'node-type-icon--audio'
  if (t === 'image') return 'node-type-icon--image'
  return 'node-type-icon--default'
})
</script>

<template>
  <div
    class="canvas-node-root"
    :class="`status-${data.status || 'pending'}`"
  >
    <Handle type="target" :position="Position.Left" class="handle handle-target" />
    <div
      class="canvas-node"
      :class="[`node-${data.type}`, { 'is-selected': selected }]"
    >
      <div class="node-header">
        <el-icon class="node-type-icon" :class="headerIconClass">
          <component :is="headerIcon" />
        </el-icon>
        <span class="node-label">{{ data.label }}</span>
      </div>

      <div class="node-body">
        <span class="node-description">{{ data.description || data.type }}</span>
      </div>

      <div class="node-status" :style="{ backgroundColor: statusColor }" />
    </div>
    <Handle type="source" :position="Position.Right" class="handle handle-source" />
  </div>
</template>

<style scoped>
.canvas-node-root {
  position: relative;
  min-width: 0;
  box-sizing: border-box;
}

.canvas-node {
  min-width: 350px;
  max-width: 400px;
  min-height: 260px;
  background: var(--bg-secondary, #1a1a2e);
  border: 2px solid var(--border-color, #3a3a4a);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  cursor: grab;
  will-change: transform;
}

/* 悬停：略亮的白边；选中时由 .is-selected 覆盖 */
.canvas-node:hover:not(.is-selected) {
  border-color: rgba(255, 255, 255, 0.58);
  box-shadow: 0 2px 12px rgba(255, 255, 255, 0.07);
}

.canvas-node.is-selected {
  border-color: #409eff;
  box-shadow:
    0 0 0 1px rgba(64, 158, 255, 0.4),
    0 4px 14px rgba(64, 158, 255, 0.22);
}

.canvas-node.is-selected:hover {
  border-color: #66b1ff;
  box-shadow:
    0 0 0 1px rgba(64, 158, 255, 0.5),
    0 4px 16px rgba(64, 158, 255, 0.28);
}

.canvas-node:active {
  cursor: grabbing;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 5px;
  background: var(--bg-tertiary, #25253a);
  border-bottom: 1px solid var(--border-color, #3a3a4a);
}

.node-type-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.node-type-icon--image {
  color: #409eff;
}

.node-type-icon--video {
  color: #e6a23c;
}

.node-type-icon--text {
  color: #b37feb;
}

.node-type-icon--audio {
  color: #36cfc9;
}

.node-type-icon--default {
  color: #909399;
}

.node-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #ffffff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-body {
  padding: 8px 12px;
}

.node-description {
  font-size: 11px;
  color: var(--text-secondary, #a0a0b0);
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
  box-sizing: border-box;
  border-radius: 50% !important;
  background: #409eff !important;
  border: 2px solid #ffffff !important;
}

.handle-target {
  left: 0px !important;
}

.handle-source {
  right: 0px !important;
}

.status-running .handle {
  background: #409eff !important;
  animation: pulse 1.5s infinite;
}

.status-completed .handle {
  background: #67c23a !important;
}

.status-error .handle {
  background: #f56c6c !important;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(64, 158, 255, 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(64, 158, 255, 0);
  }
}
</style>
