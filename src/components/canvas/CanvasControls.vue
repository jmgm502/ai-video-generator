<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Panel, useVueFlow } from '@vue-flow/core'
import { ElButton } from 'element-plus'
import { Plus, Minus, RefreshRight, Grid, MapLocation } from '@element-plus/icons-vue'

const { t } = useI18n()

const props = defineProps<{
  snapToGrid?: boolean
  showMiniMap?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:snapToGrid', value: boolean): void
  (e: 'update:showMiniMap', value: boolean): void
}>()

const {
  zoomIn,
  zoomOut,
  fitView,
  zoomTo,
  viewport,
  minZoom,
  maxZoom,
  snapGrid
} = useVueFlow()

const localShowMiniMap = computed({
  get: () => props.showMiniMap ?? true,
  set: (val) => emit('update:showMiniMap', val)
})

const zoomPercent = computed(() => Math.round(viewport.value.zoom * 100))

const canZoomIn = computed(() => viewport.value.zoom < maxZoom.value)
const canZoomOut = computed(() => viewport.value.zoom > minZoom.value)

const localSnapToGrid = computed({
  get: () => props.snapToGrid ?? true,
  set: (val) => emit('update:snapToGrid', val)
})

const handleZoomIn = () => {
  zoomIn()
}

const handleZoomOut = () => {
  zoomOut()
}

const handleFitView = () => {
  fitView({ padding: 0.1 })
}

const handleResetZoom = () => {
  zoomTo(1)
}

const toggleMiniMap = () => {
  localShowMiniMap.value = !localShowMiniMap.value
}

const toggleSnapToGrid = () => {
  localSnapToGrid.value = !localSnapToGrid.value
}
</script>

<template>
  <Panel class="canvas-controls" position="bottom-left">
    <div
      class="controls-container"
      role="toolbar"
      :aria-label="t('canvas.nodeUi.controls.toolbarAria')"
    >
      <el-button
        :icon="Minus"
        :disabled="!canZoomOut"
        @click="handleZoomOut"
        class="control-btn"
        :title="t('canvas.nodeUi.controls.zoomOut')"
      />
      <span class="zoom-percent" @click="handleResetZoom" :title="t('canvas.nodeUi.controls.zoomResetHint')">{{ zoomPercent }}%</span>
      <el-button
        :icon="Plus"
        :disabled="!canZoomIn"
        @click="handleZoomIn"
        class="control-btn"
        :title="t('canvas.nodeUi.controls.zoomIn')"
      />
      <el-button
        :icon="Grid"
        :class="{ 'control-btn-active': localSnapToGrid }"
        @click="toggleSnapToGrid"
        class="control-btn"
        :title="t('canvas.nodeUi.controls.snapGrid')"
      />
      <el-button
        :icon="MapLocation"
        :class="{ 'control-btn-active': localShowMiniMap }"
        @click="toggleMiniMap"
        class="control-btn"
        :title="t('canvas.nodeUi.controls.minimap')"
      />
      <el-button
        :icon="RefreshRight"
        @click="handleFitView"
        class="control-btn"
        :title="t('canvas.nodeUi.controls.fitView')"
      />
    </div>
  </Panel>
</template>

<style scoped>
.canvas-controls {
  background:#0b0c10;
  border-radius: 5px;
}

.controls-container {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: transparent;
  border-radius: 5px;
  box-shadow: none;
}

.control-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  flex-shrink: 0;
  border-radius: 5px !important;
  background: transparent !important;
  border: 1px solid rgba(255, 255, 255, 0.28) !important;
  color: rgba(255, 255, 255, 0.92) !important;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.08) !important;
  border-color: rgba(255, 255, 255, 0.4) !important;
}

.control-btn:active {
  background: rgba(255, 255, 255, 0.14) !important;
}

.control-btn.is-disabled {
  opacity: 0.45 !important;
  background: transparent !important;
}

.control-btn.control-btn-active {
  background: rgba(64, 158, 255, 0.32) !important;
  border-color: rgba(64, 158, 255, 0.7) !important;
  color: #fff !important;
}

.control-btn.control-btn-active:hover {
  background: rgba(64, 158, 255, 0.42) !important;
}

.zoom-percent {
  min-width: 48px;
  text-align: center;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 5px;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.zoom-percent:hover {
  background: rgba(64, 158, 255, 0.2);
}
</style>
