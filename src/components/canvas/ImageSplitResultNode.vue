<script setup lang="ts">
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { computed, inject, ref } from 'vue'
import { useCanvasLodLevel } from '@/composables/useCanvasLodLevel'
import { useI18n } from 'vue-i18n'
import { ElButton, ElDialog, ElInput, ElMessage, ElTooltip } from 'element-plus'
import { TopRight, PictureRounded, Grid } from '@element-plus/icons-vue'
import { mergeCellsToGridImage } from '@/utils/imageNodeCanvasTools'
import { useApiConfigStore } from '@/stores/apiConfigStore'
import { useUserStore } from '@/stores/userStore'
import { vueFlowEdgeTypeForSetting } from '@/utils/canvasEdgeType'
import { canvasEdgeStyleFromWidth } from '@/utils/canvasEdgeStyle'
import type { ImageNodeData } from '@/components/canvas/ImageCanvasNode.vue'
import { useCanvasNodeTitle } from '@/composables/useCanvasNodeUiI18n'

export interface ImageSplitResultNodeData {
  label: string
  type: string
  /** 切割得到的小图 data URL，行优先（与 splitImageToCells 顺序一致） */
  cells: string[]
  gridRows: number
  gridCols: number
  /** 每格下方文案，缺省为「分镜01描述」… */
  captions?: string[]
  /** 已导出为右侧图片节点的格子索引，导出后该格不再显示导出按钮 */
  exportedCellIndices?: number[]
  nodeTitleI18n?: { key: string; params?: Record<string, string | number> }
}

const props = withDefaults(
  defineProps<{
    id: string
    data: ImageSplitResultNodeData
    selected?: boolean
  }>(),
  { selected: false }
)

const apiStore = useApiConfigStore()
const userStore = useUserStore()
const { updateNodeData: rawUpdateNodeData, findNode, addNodes, addEdges, edges } = useVueFlow()
const scheduleCanvasAutoSave = inject<(() => void) | undefined>('scheduleCanvasAutoSave', undefined)

function updateNodeData(nodeId: string, data: any) {
  rawUpdateNodeData(nodeId, data)
  scheduleCanvasAutoSave?.()
}
const { t } = useI18n()
const { canvasNodeDisplayTitle } = useCanvasNodeTitle()
const lodLevel = useCanvasLodLevel()
const lodIsShell = computed(() => lodLevel.value === 'shell')

const splitResultHeaderTitle = computed(() =>
  canvasNodeDisplayTitle(props.data, 'canvas.nodeUi.imageSplit.defaultTitle', { preferFallbackOverPersisted: true })
)

const cols = computed(() => Math.max(1, props.data.gridCols || 1))

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${cols.value}, minmax(0, 1fr))`,
  gap: '10px'
}))

function defaultCaption(index: number): string {
  const shot = String(index + 1).padStart(2, '0')
  return t('canvas.nodeUi.imageSplit.frameDescTpl', { shot })
}

function captionAt(index: number): string {
  const cap = props.data.captions
  if (cap && index < cap.length) return cap[index]
  return defaultCaption(index)
}

function setCaption(index: number, value: string) {
  const n = props.data.cells.length
  const prev = props.data.captions ? [...props.data.captions] : []
  while (prev.length < n) {
    prev.push(defaultCaption(prev.length))
  }
  prev[index] = value
  updateNodeData(props.id, { captions: prev })
}

function isCellExported(index: number): boolean {
  return (props.data.exportedCellIndices ?? []).includes(index)
}

/** 与单格导出节点一致：简短标题 + 同一 description */
function buildExportedImageNodeData(imageUrl: string, title: string): ImageNodeData {
  return {
    label: title.slice(0, 40),
    type: 'image',
    status: 'pending',
    description: t('canvas.nodeUi.imageSplit.exportNodeDesc'),
    prompt: '',
    referenceImages: [],
    uploadedMainImageUrl: imageUrl,
    generatedImageUrl: null,
    toolbarExpanded: false,
    imageQuality: '1K',
    aspectRatio: '16:9',
    imageModelGroup: apiStore.imageModelGroup,
    imageModel: apiStore.imageModel
  }
}

/** 左侧输入已连接图片节点时，可取得上游主图 URL */
const upstreamImageUrl = computed((): string | null => {
  for (const e of edges.value) {
    if (e.target !== props.id) continue
    const n = findNode(e.source)
    if (n?.type === 'imageCanvas' && n.data) {
      const d = n.data as ImageNodeData
      const url = d.generatedImageUrl ?? d.uploadedMainImageUrl
      if (url) return url
    }
  }
  return null
})

const hasIncomingImage = computed(() => !!upstreamImageUrl.value)

function exportCellToImageNode(cellIndex: number) {
  if (isCellExported(cellIndex)) return
  const url = props.data.cells[cellIndex]
  if (!url) return
  const self = findNode(props.id)
  if (!self) return
  const w = self.dimensions?.width ?? 520
  const gap = 48
  const idx = String(cellIndex + 1).padStart(2, '0')
  const cap = captionAt(cellIndex).trim()
  const title = cap || t('canvas.nodeUi.imageSplit.shotTitleTpl', { shot: idx })
  const newId = `image-export-${Date.now()}-${cellIndex}`

  addNodes({
    id: newId,
    type: 'imageCanvas',
    position: {
      x: self.position.x + w + gap,
      y: self.position.y + cellIndex * 36
    },
    data: buildExportedImageNodeData(url, title)
  })
  addEdges({
    id: `e-${props.id}-export-${newId}`,
    source: props.id,
    target: newId,
    type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
    animated: true,
    style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
  })
  const prevExported = [...(props.data.exportedCellIndices ?? [])]
  if (!prevExported.includes(cellIndex)) prevExported.push(cellIndex)
  updateNodeData(props.id, { exportedCellIndices: prevExported })
  ElMessage.success(t('canvas.nodeUi.imageSplit.addedImageNode'))
}

function replaceCellFromUpstream(cellIndex: number) {
  const src = upstreamImageUrl.value
  if (!src) {
    ElMessage.warning(t('canvas.nodeUi.imageSplit.needConnectLeft'))
    return
  }
  const next = [...props.data.cells]
  next[cellIndex] = src
  const prevExported = (props.data.exportedCellIndices ?? []).filter((i) => i !== cellIndex)
  updateNodeData(props.id, { cells: next, exportedCellIndices: prevExported })
  ElMessage.success(t('canvas.nodeUi.imageSplit.replacedCell'))
}

const packDialogVisible = ref(false)
const exportFolderPath = ref('')

function openPackDialog() {
  exportFolderPath.value = ''
  packDialogVisible.value = true
}

async function pickExportFolder() {
  const api = window.electronAPI
  if (!api?.dialog?.selectFolder) {
    ElMessage.warning(t('canvas.nodeUi.imageSplit.needDesktopPack'))
    return
  }
  const r = await api.dialog.selectFolder({
    title: t('canvas.nodeUi.imageSplit.pickFolderTitle'),
    message: t('canvas.nodeUi.imageSplit.pickFolderMsg')
  })
  if (!r.canceled && r.filePaths?.length) {
    exportFolderPath.value = r.filePaths[0]
  }
}

async function confirmPackExport() {
  const dir = exportFolderPath.value.trim()
  if (!dir) {
    ElMessage.warning(t('canvas.nodeUi.imageSplit.pickFolderFirst'))
    return
  }
  const fileApi = window.electronAPI?.file
  if (!fileApi?.writeDataUrlsToDirectory) {
    ElMessage.warning(t('canvas.nodeUi.imageSplit.needDesktopPack'))
    return
  }
  const cells = props.data.cells
  const files = cells.map((dataUrl, i) => {
    const idx = String(i + 1).padStart(2, '0')
    const raw = captionAt(i)
    const slug =
      raw
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
        .trim()
        .slice(0, 60) || t('canvas.nodeUi.imageSplit.shotTitleTpl', { shot: idx })
    return { fileName: `${idx}_${slug}.png`, dataUrl }
  })
  const res = await fileApi.writeDataUrlsToDirectory(dir, files)
  if (res.success) {
    ElMessage.success(t('canvas.nodeUi.imageSplit.savedImages', { count: res.count ?? files.length }))
    packDialogVisible.value = false
  } else {
    ElMessage.error(res.message ?? t('canvas.nodeUi.imageSplit.exportFailed'))
  }
}

/** 合并全部分镜为一张图，输出到右侧图片节点（命名与单格切割导出一致，并连线） */
async function mergeAndOutputStoryboardNode() {
  if (!props.data.cells?.length) {
    ElMessage.warning(t('canvas.nodeUi.imageSplit.noFramesToMerge'))
    return
  }
  const self = findNode(props.id)
  if (!self) return
  try {
    const rows = Math.max(1, props.data.gridRows || 1)
    const colsCount = Math.max(1, props.data.gridCols || 1)
    const merged = await mergeCellsToGridImage(props.data.cells, colsCount, rows)
    const w = self.dimensions?.width ?? 520
    const gap = 48
    const base = splitResultHeaderTitle.value.trim().slice(0, 28)
    const title = `${base}${t('canvas.nodeUi.imageSplit.mergeSuffix')}`
    const newId = `image-merge-${Date.now()}`
    const yOffset = props.data.cells.length * 36 + 24

    addNodes({
      id: newId,
      type: 'imageCanvas',
      position: {
        x: self.position.x + w + gap,
        y: self.position.y + yOffset
      },
      data: buildExportedImageNodeData(merged, title)
    })
    addEdges({
      id: `e-${props.id}-merge-${newId}`,
      source: props.id,
      target: newId,
      type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
      animated: true,
      style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
    })
    ElMessage.success(t('canvas.nodeUi.imageSplit.mergeSuccess'))
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t('canvas.nodeUi.imageSplit.mergeFailed'))
  }
}
</script>

<template>
  <div class="split-result-root" :class="{ 'is-selected': selected }">
    <Handle type="target" :position="Position.Left" class="handle handle-target" />
    <div class="split-result-card">
      <div class="split-result-header">
        <el-icon class="split-result-type-icon" aria-hidden="true"><Grid /></el-icon>
        <span class="split-result-title">{{ splitResultHeaderTitle }}</span>
      </div>
      <div v-if="lodIsShell" class="split-result-shell nodrag nopan">
        <el-icon class="split-result-shell-icon" aria-hidden="true"><Grid /></el-icon>
        <div class="split-result-shell-lines">
          <span class="split-result-shell-title">{{ splitResultHeaderTitle }}</span>
          <span class="split-result-shell-sub">{{ t('canvas.nodeUi.imageSplit.shellHint', { n: data.cells.length }) }}</span>
        </div>
      </div>
      <template v-else>
      <div class="split-result-body">
        <div class="split-grid" :style="gridStyle">
          <div v-for="(url, i) in data.cells" :key="`${id}-cell-${i}`" class="split-cell">
            <div class="split-cell-img-wrap">
              <img :src="url" alt="" class="split-cell-img" draggable="false">
              <el-tooltip v-if="!isCellExported(i)" :content="t('canvas.nodeUi.imageSplit.exportTooltip')" placement="top">
                <button
                  type="button"
                  class="split-cell-fab split-cell-fab--export"
                  :aria-label="t('canvas.nodeUi.imageSplit.exportAria')"
                  @click.stop="exportCellToImageNode(i)"
                >
                  <el-icon class="split-cell-fab-icon"><TopRight /></el-icon>
                </button>
              </el-tooltip>
              <el-tooltip v-if="hasIncomingImage" :content="t('canvas.nodeUi.imageSplit.replaceTooltip')" placement="bottom">
                <button
                  type="button"
                  class="split-cell-fab split-cell-fab--replace"
                  :aria-label="t('canvas.nodeUi.imageSplit.replaceAria')"
                  @click.stop="replaceCellFromUpstream(i)"
                >
                  <el-icon class="split-cell-fab-icon"><PictureRounded /></el-icon>
                </button>
              </el-tooltip>
            </div>
            <el-input
              class="split-caption-input"
              type="textarea"
              :rows="1"
              :model-value="captionAt(i)"
              :placeholder="t('canvas.nodeUi.imageSplit.descPh')"
              @update:model-value="(v: string) => setCaption(i, v)"
              @wheel.stop
            />
          </div>
        </div>
      </div>
      <div class="split-result-footer">
        <el-button type="primary" size="small" @click="openPackDialog">
          {{ t('canvas.nodeUi.imageSplit.packDownload') }}
        </el-button>
        <button type="button" class="btn-generate" @click="mergeAndOutputStoryboardNode">
          {{ t('canvas.nodeUi.imageSplit.mergeShots') }}
        </button>
      </div>
      </template>
    </div>
    <Handle type="source" :position="Position.Right" class="handle handle-source" />

    <el-dialog
      v-model="packDialogVisible"
      :title="t('canvas.nodeUi.imageSplit.packTitle')"
      width="420px"
      align-center
      class="split-pack-dialog"
      append-to-body
    >
      <p class="split-pack-hint">{{ t('canvas.nodeUi.imageSplit.packHintIntro') }}</p>
      <div class="split-pack-path-row">
        <el-input
          :model-value="exportFolderPath"
          readonly
          :placeholder="t('canvas.nodeUi.imageSplit.folderPh')"
          class="split-pack-path-input"
        />
        <el-button @click="pickExportFolder">{{ t('canvas.nodeUi.common.browse') }}</el-button>
      </div>
      <template #footer>
        <el-button @click="packDialogVisible = false">{{ t('canvas.dialogs.cancel') }}</el-button>
        <el-button type="primary" @click="confirmPackExport">{{ t('canvas.dialogs.ok') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.split-result-root {
  position: relative;
  width: 520px;
  max-width: min(520px, 92vw);
  box-sizing: border-box;
}

.split-result-card {
  background: linear-gradient(165deg, #1e1e22 0%, #141418 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
}

.split-result-shell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 180px;
  margin: 0 12px 12px;
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  background: rgba(10, 12, 22, 0.45);
  box-sizing: border-box;
}

.split-result-shell-icon {
  font-size: 26px;
  color: rgba(100, 200, 255, 0.88);
  flex-shrink: 0;
}

.split-result-shell-lines {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.split-result-shell-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(240, 244, 255, 0.95);
  line-height: 1.35;
  word-break: break-word;
}

.split-result-shell-sub {
  font-size: 11px;
  color: rgba(180, 192, 220, 0.78);
  line-height: 1.4;
}

.split-result-root.is-selected .split-result-card {
  border-color: rgba(64, 158, 255, 0.65);
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.35);
}

.split-result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.25);
}

.split-result-type-icon {
  font-size: 18px;
  color: #5ecdcc;
  flex-shrink: 0;
}

.split-result-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
}

.split-result-body {
  padding: 12px;
  max-height: 480px;
  overflow: auto;
}

.split-result-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
}

.btn-generate {
  margin-left: auto;
  padding: 6px 12px;
  min-height: 32px;
  border-radius: 6px;
  border: none;
  background: #409eff;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.btn-generate:hover {
  background: #58abff;
}

.split-grid {
  display: grid;
}

.split-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

/* 固定可视高度（约 1.5 行）；须 !important 盖过 Element Plus 内联 minHeight */
.split-caption-input {
  --split-caption-textarea-h: calc(2px + (3 * 1.5 * 11px)  + 2px);
}

.split-cell-img-wrap {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
  background: #0a0a0c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72px;
  max-height: 140px;
}

.split-cell-fab {
  position: absolute;
  z-index: 2;
  box-sizing: border-box;
  width: 18px;
  height: 18px;
  padding: 0;
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.5);
  color: rgba(255, 255, 255, 0.95);
  cursor: pointer;
  outline: none;
  transition: background 0.15s ease, transform 0.1s ease;
  -webkit-tap-highlight-color: transparent;
}

.split-cell-fab:hover {
  background: rgba(0, 0, 0, 0.62);
}

.split-cell-fab:active {
  transform: scale(0.96);
}

.split-cell-fab--export {
  top: 6px;
  right: 6px;
}

.split-cell-fab--replace {
  bottom: 6px;
  right: 6px;
}

.split-cell-fab-icon {
  font-size: 18px;
}

.split-cell-img {
  width: 100%;
  max-height: 140px;
  object-fit: contain;
  display: block;
  vertical-align: top;
}

.split-caption-input :deep(.el-textarea__inner) {
  font-size: 11px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.75);
  background: rgba(0, 0, 0, 0.35);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: none;
  box-sizing: border-box;
  padding: 2px 8px;
  resize: none !important;
  overflow-y: auto !important;
  /* EP 会用内联 style 写 minHeight，普通 CSS 不生效，必须用 !important */
  min-height: var(--split-caption-textarea-h) !important;
  max-height: var(--split-caption-textarea-h) !important;
  height: var(--split-caption-textarea-h) !important;
}

.split-caption-input :deep(.el-textarea__inner::placeholder) {
  color: rgba(255, 255, 255, 0.35);
}

.handle {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #409eff;
  border: 2px solid #fff;
}

.handle-target {
  left: -6px;
}

.handle-source {
  right: -6px;
}

.split-pack-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.split-pack-path-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.split-pack-path-input {
  flex: 1;
  min-width: 0;
}
</style>
