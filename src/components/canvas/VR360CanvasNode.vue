<script setup lang="ts">
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Download,
  FullScreen,
  Grid,
  Picture,
  Upload,
  VideoCamera
} from '@element-plus/icons-vue'
import type { ImageNodeData } from '@/components/canvas/ImageCanvasNode.vue'
import VrPanoView from '@/components/canvas/VrPanoView.vue'
import { useApiConfigStore } from '@/stores/apiConfigStore'
import { vueFlowEdgeTypeForSetting } from '@/utils/canvasEdgeType'
import { canvasEdgeStyleFromWidth } from '@/utils/canvasEdgeStyle'
import { useUserStore } from '@/stores/userStore'
import { useCanvasLodLevel } from '@/composables/useCanvasLodLevel'
import {
  captureCanvasImage,
  FOUR_GRID_VIEWS,
  mergeCanvasesGrid,
  renderPanoToCell,
  TWELVE_GRID_VIEWS
} from '@/utils/panoExportGrids'
import { useI18n } from 'vue-i18n'

export interface VR360NodeData {
  label: string
  type: 'vr360'
  imageUrl?: string | null
  previewImageUrl?: string | null
  autoRotate?: boolean
}

const VR360_W = 520
const VR360_H = 320

const props = withDefaults(
  defineProps<{
    id: string
    selected?: boolean
    data: VR360NodeData
  }>(),
  { selected: false }
)

const { t } = useI18n()

const apiStore = useApiConfigStore()
const userStore = useUserStore()
const lodLevel = useCanvasLodLevel()
const lodIsShell = computed(() => lodLevel.value === 'shell')
const { updateNodeData: rawUpdateNodeData, findNode, addNodes, addEdges, edges, nodes, updateNodeInternals } = useVueFlow()
const scheduleCanvasAutoSave = inject<(() => void) | undefined>('scheduleCanvasAutoSave', undefined)

function updateNodeData(nodeId: string, data: Partial<any>) {
  rawUpdateNodeData(nodeId, data)
  scheduleCanvasAutoSave?.()
}
const pushStateBeforeChange = inject<(() => void) | undefined>('canvasPushStateBeforeChange', undefined)

const panoViewRef = ref<InstanceType<typeof VrPanoView> | null>(null)
const viewerWrapRef = ref<HTMLDivElement | null>(null)
const isFullscreen = ref(false)
const exporting = ref(false)
const cameraFov = ref(75)

const displayImageUrl = computed(() => props.data.imageUrl ?? props.data.previewImageUrl ?? null)

const defaultVrTitle = computed(() => t('canvas.nodeUi.vr360.defaultTitle'))

const cameraFovPercent = computed(() => Math.round(((120 - cameraFov.value) / 90) * 100))

function buildExportedImageNodeData(
  imageUrl: string,
  title: string,
  aspect: string = '16:9'
): ImageNodeData {
  return {
    label: title.slice(0, 40),
    type: 'image',
    status: 'pending',
    description: t('canvas.nodeUi.vr360.exportEdgeDesc'),
    prompt: '',
    referenceImages: [],
    uploadedMainImageUrl: imageUrl,
    generatedImageUrl: null,
    toolbarExpanded: false,
    imageQuality: '1K',
    aspectRatio: aspect,
    imageModelGroup: apiStore.imageModelGroup as ImageNodeData['imageModelGroup'],
    imageModel: apiStore.imageModel
  }
}

function resolveUpstreamImageUrl(): string | null {
  for (const e of edges.value) {
    if (e.target !== props.id) continue
    const n = findNode(e.source)
    if (n?.type === 'imageCanvas' && n.data) {
      const d = n.data as ImageNodeData
      const u = d.generatedImageUrl ?? d.uploadedMainImageUrl
      if (u) return u
    }
  }
  return null
}

watch(
  [edges, nodes],
  () => {
    const incoming = resolveUpstreamImageUrl()
    if (incoming && incoming !== props.data.imageUrl) {
      updateNodeData(props.id, { imageUrl: incoming, previewImageUrl: incoming })
    }
  },
  { deep: true }
)

function onReplacePanoFile(e: Event) {
  const t = e.target as HTMLInputElement
  const f = t.files?.[0]
  if (f && f.type.startsWith('image/')) {
    const r = new FileReader()
    r.onload = () =>
      updateNodeData(props.id, { imageUrl: r.result as string, previewImageUrl: r.result as string })
    r.readAsDataURL(f)
  }
  t.value = ''
}

function handleFileUpload() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      updateNodeData(props.id, { imageUrl: base64, previewImageUrl: base64 })
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

function toggleFullscreen() {
  const el = viewerWrapRef.value
  if (!el) return
  if (!isFullscreen.value) {
    void el.requestFullscreen?.()
  } else {
    void document.exitFullscreen?.()
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
  setTimeout(() => window.dispatchEvent(new Event('resize')), 100)
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  nextTick(() => updateNodeInternals([props.id]))
})

watch(
  () => [displayImageUrl.value, isFullscreen.value],
  () => {
    nextTick(() => updateNodeInternals([props.id]))
  }
)

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})

function toggleAutoRotate() {
  const next = !props.data.autoRotate
  updateNodeData(props.id, { autoRotate: next })
}

function nudgeFov(delta: number) {
  cameraFov.value = Math.max(30, Math.min(120, cameraFov.value + delta))
}

function addExportImageNode(
  dataUrl: string,
  outW: number,
  outH: number
) {
  const self = findNode(props.id)
  if (!self) return
  const sourceW = self.dimensions?.width ?? VR360_W
  const newId = `image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const cam = vueFlowEdgeTypeForSetting(userStore.edgeStyle)
  const st = canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
  pushStateBeforeChange?.()
  addNodes({
    id: newId,
    type: 'imageCanvas',
    position: {
      x: (self.position?.x ?? 0) + sourceW + 28,
      y: self.position?.y ?? 0
    },
    data: {
      ...buildExportedImageNodeData(
        dataUrl,
        t('canvas.nodeUi.vr360.exportShotTitle'),
        outW > 0 && outH > 0 ? `${outW}:${outH}` : '16:9'
      )
    }
  })
  addEdges({
    id: `e-${props.id}-export-${newId}`,
    source: props.id,
    target: newId,
    type: cam,
    animated: true,
    style: st
  })
  nextTick(() => updateNodeInternals([newId]))
  ElMessage.success(t('canvas.nodeUi.vr360.addImageOk'))
}

function handleExportCurrentView() {
  const u = displayImageUrl.value
  if (!u) {
    ElMessage.warning(t('canvas.nodeUi.vr360.noPanorama'))
    return
  }
  const canvas = panoViewRef.value?.getCanvas?.() ?? null
  if (!canvas) return
  const dataUrl = captureCanvasImage(canvas)
  const node = findNode(props.id)
  const w = node?.dimensions?.width ?? VR360_W
  const h = node?.dimensions?.height ?? VR360_H
  addExportImageNode(dataUrl, w, h)
}

async function handleExport4Grid() {
  const u = displayImageUrl.value
  if (!u) {
    ElMessage.warning(t('canvas.nodeUi.vr360.noPanorama'))
    return
  }
  const sourceNode = findNode(props.id)
  const sourceW = sourceNode?.dimensions?.width ?? VR360_W
  const sourceH = sourceNode?.dimensions?.height ?? VR360_H
  const gridCols = 2
  const gridRows = 2
  const nodeHeight = sourceH
  const nodeW = sourceH * 2
  const cellW = nodeW / gridCols
  const cellH = nodeHeight / gridRows
  exporting.value = true
  try {
    const cells: HTMLCanvasElement[] = []
    for (const view of FOUR_GRID_VIEWS) {
      const c = await renderPanoToCell(u, view.yaw, view.pitch, cellW, cellH, 2)
      cells.push(c)
    }
    const merged = mergeCanvasesGrid(cells, gridCols, gridRows)
    const dataUrl = captureCanvasImage(merged)
    addExportImageNode(dataUrl, merged.width, merged.height)
  } catch (e) {
    console.error(e)
    ElMessage.error(t('canvas.nodeUi.vr360.exportGrid4Fail'))
  } finally {
    exporting.value = false
  }
}

async function handleExport12Grid() {
  const u = displayImageUrl.value
  if (!u) {
    ElMessage.warning(t('canvas.nodeUi.vr360.noPanorama'))
    return
  }
  const sourceNode = findNode(props.id)
  const sourceH = sourceNode?.dimensions?.height ?? VR360_H
  const gridCols = 4
  const gridRows = 3
  const nodeHeight = sourceH
  const nodeW = sourceH * 2
  const cellW = nodeW / gridCols
  const cellH = nodeHeight / gridRows
  exporting.value = true
  try {
    const cells: HTMLCanvasElement[] = []
    for (const view of TWELVE_GRID_VIEWS) {
      const c = await renderPanoToCell(u, view.yaw, view.pitch, cellW, cellH, 2)
      cells.push(c)
    }
    const merged = mergeCanvasesGrid(cells, gridCols, gridRows)
    const dataUrl = captureCanvasImage(merged)
    addExportImageNode(dataUrl, merged.width, merged.height)
  } catch (e) {
    console.error(e)
    ElMessage.error(t('canvas.nodeUi.vr360.exportGrid12Fail'))
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="vr360-root">
    <Handle type="target" :position="Position.Left" class="handle handle-target" />
    <div
      class="vr360-card"
      :class="{ 'is-selected': selected }"
    >
      <div class="vr360-header">
        <el-icon class="vr360-h-icon" :size="16"><VideoCamera /></el-icon>
        <span class="vr360-title">{{ data.label || defaultVrTitle }}</span>
      </div>

      <div v-if="lodIsShell" class="vr360-lod-shell nodrag nopan">
        <el-icon class="vr360-lod-icon" :size="22"><VideoCamera /></el-icon>
        <div class="vr360-lod-lines">
          <span class="vr360-lod-title">{{ data.label || defaultVrTitle }}</span>
          <span class="vr360-lod-sub">{{ displayImageUrl ? t('canvas.nodeUi.vr360.lodLoadedZoom') : t('canvas.nodeUi.vr360.lodNoUploadZoom') }}</span>
        </div>
      </div>

      <template v-else>
      <div v-if="!displayImageUrl" class="vr360-empty" @click.stop="handleFileUpload">
        <el-icon :size="48" class="vr360-up-ico"><Upload /></el-icon>
        <p>{{ t('canvas.nodeUi.vr360.uploadHintMain') }}</p>
        <p class="vr360-hint">{{ t('canvas.nodeUi.vr360.uploadHintRatio') }}</p>
      </div>

      <template v-else>
        <div
          ref="viewerWrapRef"
          class="vr360-viewer-wrap nodrag nopan"
          @pointerdown.stop
          @wheel.stop
        >
          <VrPanoView
            ref="panoViewRef"
            :image-url="displayImageUrl"
            :auto-rotate="!!data.autoRotate"
            :camera-fov="cameraFov"
          />
          <div v-if="isFullscreen" class="vr360-fs-bar" @click.stop>
            <div class="bar-group">
              <button type="button" class="bar-btn" @click="nudgeFov(10)">−</button>
              <button type="button" class="bar-pct" :title="t('canvas.nodeUi.vr360.fovResetTip')" @click="cameraFov = 75">
                {{ cameraFovPercent }}%
              </button>
              <button type="button" class="bar-btn" @click="nudgeFov(-10)">+</button>
            </div>
            <div class="bar-div" />
            <button
              type="button"
              class="bar-cta"
              :class="{ on: data.autoRotate }"
              @click="toggleAutoRotate"
            >
              {{ data.autoRotate ? t('canvas.nodeUi.vr360.autoRotateStop') : t('canvas.nodeUi.vr360.autoRotateStart') }}
            </button>
            <div class="bar-div" />
            <button type="button" class="bar-cta" @click="handleExportCurrentView">{{ t('canvas.nodeUi.vr360.exportView') }}</button>
            <div class="bar-div" />
            <button type="button" class="bar-cta" :disabled="exporting" @click="handleExport4Grid">{{ t('canvas.nodeUi.vr360.grid4') }}</button>
            <div class="bar-div" />
            <button type="button" class="bar-cta" :disabled="exporting" @click="handleExport12Grid">{{ t('canvas.nodeUi.vr360.grid12') }}</button>
            <div class="bar-div" />
            <button type="button" class="bar-cta" @click="toggleFullscreen">{{ t('canvas.nodeUi.common.exitFullscreen') }}</button>
          </div>
        </div>

        <div class="vr360-footer" @click.stop>
          <div class="f-left">
            <button type="button" class="f-mini" @click="nudgeFov(10)">−</button>
            <button type="button" class="f-mini" @click="nudgeFov(-10)">+</button>
            <button type="button" class="f-pct" @click="cameraFov = 75">{{ cameraFovPercent }}%</button>
          </div>
          <div class="f-right">
            <button type="button" class="f-btn" :disabled="exporting" @click="handleExportCurrentView">
              <el-icon><Picture /></el-icon>
              {{ t('canvas.nodeUi.vr360.exportView') }}
            </button>
            <button type="button" class="f-btn" :disabled="exporting" @click="handleExport4Grid">
              <el-icon><Grid /></el-icon>
              {{ t('canvas.nodeUi.vr360.grid4') }}
            </button>
            <button type="button" class="f-btn" :disabled="exporting" @click="handleExport12Grid">
              <el-icon><Grid /></el-icon>
              {{ t('canvas.nodeUi.vr360.grid12') }}
            </button>
            <button type="button" class="f-btn" @click="toggleFullscreen">
              <el-icon><FullScreen /></el-icon>
              {{ t('canvas.nodeUi.common.fullscreen') }}
            </button>
            <label class="f-btn f-file">
              <el-icon><Download /></el-icon>
              {{ t('canvas.nodeUi.vr360.swapImage') }}
              <input
                type="file"
                accept="image/*"
                class="vr-hidden"
                @change="onReplacePanoFile"
              >
            </label>
          </div>
        </div>
      </template>
      </template>
    </div>
    <Handle type="source" :position="Position.Right" class="handle handle-source" />
  </div>
</template>

<style scoped>
.vr360-lod-shell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 200px;
  margin: 0 12px 12px;
  padding: 14px;
  border-radius: 10px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  background: rgba(10, 12, 22, 0.45);
  box-sizing: border-box;
}

.vr360-lod-icon {
  flex-shrink: 0;
  color: rgba(120, 200, 255, 0.9);
}

.vr360-lod-lines {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.vr360-lod-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(240, 244, 255, 0.95);
}

.vr360-lod-sub {
  font-size: 12px;
  color: rgba(180, 192, 220, 0.78);
  line-height: 1.4;
}

.vr360-root {
  position: relative;
  width: 520px;
  min-width: 520px;
  max-width: 800px;
  box-sizing: border-box;
  overflow: visible;
  cursor: grab;
}

.vr360-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 360px;
  background: var(--bg-secondary, #1a1a2e);
  border: 2px solid var(--border-color, #3a3a4a);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.vr360-card.is-selected {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.4), 0 4px 14px rgba(64, 158, 255, 0.22);
}

.vr360-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  background: var(--bg-tertiary, #25253a);
  border-bottom: 1px solid var(--border-color, #3a3a4a);
  flex-shrink: 0;
}

.vr360-h-icon {
  color: #a78bfa;
}

.vr360-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.vr360-empty {
  flex: 1;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary, #a0a0b0);
  cursor: pointer;
  padding: 24px;
}

.vr360-empty:hover {
  background: rgba(255, 255, 255, 0.04);
}

.vr360-hint {
  font-size: 12px;
  opacity: 0.75;
}

.vr360-viewer-wrap {
  position: relative;
  flex: 1;
  min-height: 240px;
  height: 280px;
  background: #000;
}

.vr360-fs-bar {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.65);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.bar-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bar-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.bar-pct {
  min-width: 44px;
  padding: 0 6px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  cursor: pointer;
}

.bar-div {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.2);
}

.bar-cta {
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  white-space: nowrap;
}

.bar-cta:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bar-cta.on {
  background: #7c3aed;
  color: #fff;
}

.vr360-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.35);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.f-left,
.f-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.f-mini {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.f-pct {
  min-height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.45);
  color: rgba(255, 255, 255, 0.85);
  font-size: 10px;
  cursor: pointer;
}

.f-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  cursor: pointer;
}

.f-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.f-file {
  position: relative;
  overflow: hidden;
  cursor: pointer;
}

.vr-hidden {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
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
  left: 0 !important;
}

.handle-source {
  right: 0 !important;
}
</style>
