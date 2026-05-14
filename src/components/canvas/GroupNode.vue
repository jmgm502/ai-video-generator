<script setup lang="ts">
import { computed, inject, nextTick, ref, withDefaults, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVueFlow } from '@vue-flow/core'
import { FolderOpened, Fold, ArrowDown } from '@element-plus/icons-vue'

const { t } = useI18n()

interface Props {
  id: string
  selected?: boolean
  data: {
    label?: string
    color?: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
})
const { getViewport, updateNode, updateNodeInternals, updateNodeData: rawUpdateNodeData, findNode } = useVueFlow()
const scheduleCanvasAutoSave = inject<(() => void) | undefined>('scheduleCanvasAutoSave', undefined)
const canvasGetNodes = inject<() => any[]>('canvasGetNodes', () => [])

function updateNodeData(nodeId: string, data: any) {
  rawUpdateNodeData(nodeId, data)
  scheduleCanvasAutoSave?.()
}

const canvasUngroup = inject<(groupId: string) => void>('canvasUngroup')

const onUngroupClick = (e: MouseEvent) => {
  e.stopPropagation()
  canvasUngroup?.(props.id)
}

const defaultGroupLabel = () => t('canvas.nodeUi.groupNode.defaultLabel')

const displayLabel = computed(() => {
  const raw = props.data.label?.trim()
  return raw || defaultGroupLabel()
})

const isEditingName = ref(false)
const nameDraft = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)
const isCollapsed = ref(props.data.isCollapsed || false)
const originalHeight = ref<number | null>(null)

// 监听外部 data 变化
watch(() => props.data.isCollapsed, (newVal) => {
  isCollapsed.value = newVal
})

// 初始化时处理折叠状态
if (props.data.isCollapsed) {
  nextTick(() => {
    const allNodes = canvasGetNodes()
    const childNodes = allNodes.filter(n => n.parentNode === props.id)
    childNodes.forEach(childNode => {
      updateNode(childNode.id, {
        hidden: true
      })
    })
  })
}

const startEditName = (e: MouseEvent) => {
  e.stopPropagation()
  e.preventDefault()
  nameDraft.value = displayLabel.value
  isEditingName.value = true
  nextTick(() => {
    nameInputRef.value?.focus()
    nameInputRef.value?.select()
  })
}

const commitName = () => {
  if (!isEditingName.value) return
  const v = nameDraft.value.trim()
  updateNodeData(props.id, { label: v || defaultGroupLabel() })
  isEditingName.value = false
}

const cancelEditName = () => {
  isEditingName.value = false
}

const MIN_GROUP_W = 120
const MIN_GROUP_H = 120

const bgColor = computed(() => props.data.color || 'rgba(0, 0, 0, 0.28)')
const borderColor = computed(() => {
  if (props.selected) return '#409eff'
  return props.data.color || 'rgba(255, 255, 255, 0.22)'
})

const isResizing = ref(false)
const resizeDirection = ref('')

function parseNodeSize(n: any): { w: number; h: number } {
  const st = (n?.style || {}) as Record<string, any>
  let w = st.width != null ? parseFloat(String(st.width)) : NaN
  let h = st.height != null ? parseFloat(String(st.height)) : NaN
  if (!Number.isFinite(w) || w <= 0) {
    w = typeof n.width === 'number' ? n.width : parseFloat(String(n.width ?? ''))
  }
  if (!Number.isFinite(h) || h <= 0) {
    h = typeof n.height === 'number' ? n.height : parseFloat(String(n.height ?? ''))
  }
  const dw = n.dimensions?.width
  const dh = n.dimensions?.height
  if ((!Number.isFinite(w) || w <= 0) && typeof dw === 'number' && dw > 0) w = dw
  if ((!Number.isFinite(h) || h <= 0) && typeof dh === 'number' && dh > 0) h = dh
  if (!Number.isFinite(w) || w <= 0) w = 220
  if (!Number.isFinite(h) || h <= 0) h = 160
  return { w, h }
}

const handleResizeStart = (direction: string, event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()
  isResizing.value = true
  resizeDirection.value = direction

  const startX = event.clientX
  const startY = event.clientY

  const nodeData = findNode(props.id)
  if (!nodeData) return

  const { w: startWidth, h: startHeight } = parseNodeSize(nodeData)
  const startPosX = nodeData.position.x
  const startPosY = nodeData.position.y

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.value) return

    const zoom = getViewport().zoom || 1
    const dx = (e.clientX - startX) / zoom
    const dy = (e.clientY - startY) / zoom

    let newWidth = startWidth
    let newHeight = startHeight
    let newPosX = startPosX
    let newPosY = startPosY

    if (resizeDirection.value.includes('e')) {
      newWidth = Math.max(MIN_GROUP_W, startWidth + dx)
    }
    if (resizeDirection.value.includes('s')) {
      newHeight = Math.max(MIN_GROUP_H, startHeight + dy)
    }
    if (resizeDirection.value.includes('w')) {
      newWidth = Math.max(MIN_GROUP_W, startWidth - dx)
      newPosX = startPosX + (startWidth - newWidth)
    }
    if (resizeDirection.value.includes('n')) {
      newHeight = Math.max(MIN_GROUP_H, startHeight - dy)
      newPosY = startPosY + (startHeight - newHeight)
    }

    const live = findNode(props.id)
    const baseStyle = (live?.style && typeof live.style === 'object' ? live.style : {}) as Record<string, any>

    // 必须用 useVueFlow().updateNode 原地合并，替换 nodes 数组项会破坏 GraphNode 导致无法缩放/拖动
    updateNode(props.id, {
      position: { x: newPosX, y: newPosY },
      width: newWidth,
      height: newHeight,
      style: {
        ...baseStyle,
        width: `${newWidth}px`,
        height: `${newHeight}px`
      }
    })
  }

  const handleMouseUp = () => {
    isResizing.value = false
    resizeDirection.value = ''
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    document.removeEventListener('pointerup', handleMouseUp)
    nextTick(() => updateNodeInternals([props.id]))
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('pointerup', handleMouseUp)
}

const toggleCollapse = (e: MouseEvent) => {
  e.stopPropagation()
  e.preventDefault()
  
  const nodeData = findNode(props.id)
  if (!nodeData) return

  const { w: currentWidth, h: currentHeight } = parseNodeSize(nodeData)

  // 获取所有子节点
  const allNodes = canvasGetNodes()
  const childNodes = allNodes.filter(n => n.parentNode === props.id)

  if (isCollapsed.value) {
    // 展开
    const targetHeight = originalHeight.value || Math.max(MIN_GROUP_H, currentHeight)
    const baseStyle = (nodeData.style && typeof nodeData.style === 'object' ? nodeData.style : {}) as Record<string, any>
    updateNode(props.id, {
      width: currentWidth,
      height: targetHeight,
      style: {
        ...baseStyle,
        width: `${currentWidth}px`,
        height: `${targetHeight}px`
      },
      data: {
        ...props.data,
        isCollapsed: false
      }
    })
    isCollapsed.value = false
    
    // 显示子节点
    childNodes.forEach(childNode => {
      updateNode(childNode.id, {
        hidden: false
      })
    })
  } else {
    // 折叠
    originalHeight.value = currentHeight
    const headerHeight = 40
    const baseStyle = (nodeData.style && typeof nodeData.style === 'object' ? nodeData.style : {}) as Record<string, any>
    updateNode(props.id, {
      width: currentWidth,
      height: headerHeight,
      style: {
        ...baseStyle,
        width: `${currentWidth}px`,
        height: `${headerHeight}px`
      },
      data: {
        ...props.data,
        isCollapsed: true
      }
    })
    isCollapsed.value = true
    
    // 隐藏子节点
    childNodes.forEach(childNode => {
      updateNode(childNode.id, {
        hidden: true
      })
    })
  }
}
</script>

<template>
  <div
    class="group-node"
    :class="{
      'is-selected': selected,
      'has-custom-border': !!data.color,
      'is-collapsed': isCollapsed
    }"
    :style="{
      backgroundColor: bgColor,
      '--group-border': borderColor
    }"
  >
    <div class="group-header">
      <div class="group-header-left">
        <el-icon class="group-type-icon">
          <Fold v-if="isCollapsed" />
          <FolderOpened v-else />
        </el-icon>
        <template v-if="!isEditingName">
          <span class="group-label">{{ displayLabel }}</span>
          <button
            type="button"
            class="group-edit-name-btn nodrag nopan"
            :title="t('canvas.nodeUi.groupNode.editTitle')"
            :aria-label="t('canvas.nodeUi.groupNode.ariaEdit')"
            @click="startEditName"
          >
            ✎
          </button>
        </template>
        <input
          v-else
          ref="nameInputRef"
          v-model="nameDraft"
          class="group-name-input nodrag nopan"
          type="text"
          maxlength="32"
          @keydown.enter.prevent="commitName"
          @keydown.esc.prevent="cancelEditName"
          @blur="commitName"
          @click.stop
          @mousedown.stop
        />
      </div>
      <div class="group-header-right">
        <button
          type="button"
          class="group-collapse-btn nodrag nopan"
          :title="isCollapsed ? '展开' : '折叠'"
          @click="toggleCollapse"
        >
          <el-icon>
            <ArrowDown v-if="isCollapsed" />
            <Fold v-else />
          </el-icon>
        </button>
        <button
          v-if="canvasUngroup"
          type="button"
          class="group-ungroup-btn nodrag nopan"
          @click="onUngroupClick"
        >
          {{ t('canvas.nodeUi.groupNode.ungroup') }}
        </button>
      </div>
    </div>

    <div
      v-if="!isCollapsed"
      class="resize-handle resize-e nodrag nopan"
      @mousedown.stop.prevent="handleResizeStart('e', $event)"
    ></div>
    <div
      v-if="!isCollapsed"
      class="resize-handle resize-s nodrag nopan"
      @mousedown.stop.prevent="handleResizeStart('s', $event)"
    ></div>
    <div
      v-if="!isCollapsed"
      class="resize-handle resize-se nodrag nopan"
      @mousedown.stop.prevent="handleResizeStart('se', $event)"
    ></div>
    <div
      v-if="!isCollapsed"
      class="resize-handle resize-w nodrag nopan"
      @mousedown.stop.prevent="handleResizeStart('w', $event)"
    ></div>
    <div
      v-if="!isCollapsed"
      class="resize-handle resize-n nodrag nopan"
      @mousedown.stop.prevent="handleResizeStart('n', $event)"
    ></div>
    <div
      v-if="!isCollapsed"
      class="resize-handle resize-ne nodrag nopan"
      @mousedown.stop.prevent="handleResizeStart('ne', $event)"
    ></div>
    <div
      v-if="!isCollapsed"
      class="resize-handle resize-sw nodrag nopan"
      @mousedown.stop.prevent="handleResizeStart('sw', $event)"
    ></div>
    <div
      v-if="!isCollapsed"
      class="resize-handle resize-nw nodrag nopan"
      @mousedown.stop.prevent="handleResizeStart('nw', $event)"
    ></div>
  </div>
</template>

<style scoped>
.group-node {
  min-width: 120px;
  min-height: 40px;
  width: 100%;
  height: 100%;
  border: 2px dashed var(--group-border, rgba(255, 255, 255, 0.22));
  border-radius: 8px;
  overflow: visible;
  transition:
    box-shadow 0.2s ease,
    border-color 0.2s ease;
  position: relative;
  box-sizing: border-box;
}

.group-node.is-collapsed {
  min-height: 40px;
}

.group-node:hover:not(.is-selected):not(.has-custom-border) {
  border-color: rgba(255, 255, 255, 0.5) !important;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.08);
}

.group-node.is-selected {
  box-shadow:
    0 0 0 1px rgba(64, 158, 255, 0.35),
    0 2px 12px rgba(64, 158, 255, 0.18);
}

.group-node.is-selected:hover {
  border-color: #66b1ff !important;
  box-shadow:
    0 0 0 1px rgba(64, 158, 255, 0.45),
    0 2px 14px rgba(64, 158, 255, 0.24);
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px 8px 12px;
  min-height: 40px;
  box-sizing: border-box;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.4);
  border-bottom: 1px dashed rgba(255, 255, 255, 0.18);
}

.group-node.is-collapsed .group-header {
  border-bottom: none;
}

.group-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.group-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.group-ungroup-btn {
  flex-shrink: 0;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-primary, #e8e8ef);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 4px;
  cursor: pointer;
  line-height: 1.4;
}

.group-ungroup-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.35);
}

.group-collapse-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  font-size: 14px;
  color: var(--text-secondary, #b8b8c8);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 4px;
  cursor: pointer;
}

.group-collapse-btn:hover {
  color: var(--text-primary, #ffffff);
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.35);
}

.group-type-icon {
  font-size: 16px;
  color: #8ab4f8;
  flex-shrink: 0;
}

.group-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #ffffff);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-edit-name-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  font-size: 13px;
  line-height: 1;
  color: var(--text-secondary, #b8b8c8);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.group-edit-name-btn:hover {
  color: var(--text-primary, #ffffff);
  background: rgba(255, 255, 255, 0.1);
}

.group-name-input {
  flex: 1;
  min-width: 48px;
  max-width: 160px;
  padding: 2px 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #ffffff);
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
}

.group-name-input:focus {
  border-color: rgba(255, 255, 255, 0.55);
}

.group-body {
  flex: 1;
}

.resize-handle {
  position: absolute;
  background: transparent;
  z-index: 10;
}

.resize-e {
  right: -4px;
  top: 20%;
  height: 60%;
  width: 8px;
  cursor: ew-resize;
}

.resize-s {
  bottom: -4px;
  left: 20%;
  width: 60%;
  height: 8px;
  cursor: ns-resize;
}

.resize-se {
  right: -4px;
  bottom: -4px;
  width: 12px;
  height: 12px;
  cursor: nwse-resize;
}

.resize-w {
  left: -4px;
  top: 20%;
  height: 60%;
  width: 8px;
  cursor: ew-resize;
}

.resize-n {
  top: -4px;
  left: 20%;
  width: 60%;
  height: 8px;
  cursor: ns-resize;
}

.resize-ne {
  right: -4px;
  top: -4px;
  width: 12px;
  height: 12px;
  cursor: nesw-resize;
}

.resize-sw {
  left: -4px;
  bottom: -4px;
  width: 12px;
  height: 12px;
  cursor: nesw-resize;
}

.resize-nw {
  left: -4px;
  top: -4px;
  width: 12px;
  height: 12px;
  cursor: nwse-resize;
}

.resize-handle:hover {
  background: rgba(255, 255, 255, 0.18);
  border-radius: 2px;
}
</style>
