<script setup lang="ts">
import { computed, inject, withDefaults, type Component } from 'vue'
import { useCanvasLodLevel } from '@/composables/useCanvasLodLevel'
import { useI18n } from 'vue-i18n'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { User, OfficeBuilding, Goods } from '@element-plus/icons-vue'
import type { ImageNodeData } from '@/components/canvas/ImageCanvasNode.vue'
import {
  mergeTextAssetDetailIntoTotal,
  baselineGroupedAssetsFromTotalData,
  inferAssetCategoryFromDetailData,
  patchTextAssetResultNodeInNodesList,
  type TextGroupedAssetsInput
} from '@/utils/mergeTextAssetDetailIntoTotal'

type AssetCategory = 'character' | 'scene' | 'prop'

interface TextAssetDetailNodeData {
  label: string
  type: string
  status?: 'pending' | 'running' | 'completed' | 'error'
  description?: string
  assetCategory?: AssetCategory
  assetName?: string
  assetDescription?: string
  linkedImageNodeId?: string | null
  generatedByTextProcess?: boolean
  /** 画布节点标题：随语言刷新（文案处理链创建） */
  nodeTitleI18n?: { key: string; params?: Record<string, string | number> }
}

interface Props {
  id: string
  selected?: boolean
  data: TextAssetDetailNodeData
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
})

const { updateNodeData, findNode, edges, nodes } = useVueFlow()
const scheduleCanvasAutoSave = inject<(() => void) | undefined>('scheduleCanvasAutoSave', undefined)

const LEGACY_GENERIC_ASSET_DETAIL = new Set(['资产节点', 'Asset'])

const { t } = useI18n()
const lodLevel = useCanvasLodLevel()
const lodIsShell = computed(() => lodLevel.value === 'shell')

const statusColor = computed(() => {
  switch (props.data.status) {
    case 'running': return '#409eff'
    case 'completed': return '#67c23a'
    case 'error': return '#f56c6c'
    default: return '#909399'
  }
})

const assetTypeClass = computed(() => {
  const t = props.data.assetCategory
  if (t === 'character') return 'asset-type-character'
  if (t === 'scene') return 'asset-type-scene'
  if (t === 'prop') return 'asset-type-prop'
  return 'asset-type-default'
})

const detailNodeLabel = computed(() => {
  const i18n = props.data.nodeTitleI18n
  if (i18n?.key) {
    const p = i18n.params
    if (p && Object.keys(p).length > 0) return t(i18n.key, p as Record<string, unknown>)
    return t(i18n.key)
  }
  const category = props.data.assetCategory
  if (category === 'character') return t('canvas.comboDetailLabels.character')
  if (category === 'scene') return t('canvas.comboDetailLabels.scene')
  if (category === 'prop') return t('canvas.comboDetailLabels.prop')
  const raw = String(props.data.label ?? '').trim()
  if (raw && !LEGACY_GENERIC_ASSET_DETAIL.has(raw) && raw !== t('canvas.nodeUi.textAssetDetail.assetNode')) return raw
  return t('canvas.nodeUi.textAssetDetail.assetNode')
})

function buildAssetImagePrompt(name: string, description: string) {
  const n = String(name ?? '').trim()
  const d = String(description ?? '').trim()
  const lines: string[] = []
  if (n) lines.push(t('canvas.nodeDefaults.assetNameLine', { name: n }))
  if (d) lines.push(t('canvas.nodeDefaults.assetDescLine', { desc: d }))
  return lines.join('\n')
}

const headerIcon = computed((): Component | null => {
  const c = props.data.assetCategory
  if (c === 'character') return User
  if (c === 'scene') return OfficeBuilding
  if (c === 'prop') return Goods
  return null
})

const assetNameModel = computed({
  get: () => String(props.data.assetName ?? ''),
  set: (value: string) => patchAssetFields(value, assetDescriptionModel.value)
})

const assetDescriptionModel = computed({
  get: () => String(props.data.assetDescription ?? ''),
  set: (value: string) => patchAssetFields(assetNameModel.value, value)
})

function syncToTotalAssetNode(assetName: string, assetDescription: string) {
  const cat = inferAssetCategoryFromDetailData(props.data as unknown as Record<string, unknown>)
  if (!cat) return

  let totalId: string | null = null
  for (const e of edges.value) {
    if (e.target === props.id) {
      const src = findNode(e.source)
      if (src?.type === 'textAssetResult') {
        totalId = e.source
        break
      }
    }
    if (e.source === props.id) {
      const tgt = findNode(e.target)
      if (tgt?.type === 'textAssetResult') {
        totalId = e.target
        break
      }
    }
  }
  if (!totalId) return

  const total = findNode(totalId)
  if (total?.type !== 'textAssetResult') return
  const prevGrouped = baselineGroupedAssetsFromTotalData(total.data as { groupedAssets?: TextGroupedAssetsInput; assets?: unknown })
  const { groupedAssets, assets } = mergeTextAssetDetailIntoTotal(
    prevGrouped,
    props.id,
    cat,
    assetName,
    assetDescription
  )
  patchTextAssetResultNodeInNodesList(nodes, totalId, groupedAssets, assets)
  scheduleCanvasAutoSave?.()
}

function patchAssetFields(name: string, description: string) {
  const assetName = String(name ?? '')
  const assetDescription = String(description ?? '')
  updateNodeData(props.id, { assetName, assetDescription })
  syncLinkedImageNode(assetName, assetDescription)
  syncToTotalAssetNode(assetName, assetDescription)
}

function syncLinkedImageNode(name: string, description: string) {
  const linkedImageNodeId = String(props.data.linkedImageNodeId ?? '').trim()
  if (!linkedImageNodeId) return
  const linked = findNode(linkedImageNodeId)
  if (!linked) return
  const trimmedName = name.trim() || t('canvas.nodeUi.textAssetDetail.genericAsset')
  const prompt = buildAssetImagePrompt(name, description)
  const patch: Partial<ImageNodeData> = {
    label: t('canvas.nodeDefaults.imageNameWithAsset', { name: trimmedName }),
    description: t('canvas.nodeDefaults.imageGenDescWithAsset', { name: trimmedName }),
    prompt
  }
  const cat = props.data.assetCategory
  if (cat === 'character' || cat === 'scene' || cat === 'prop') {
    patch.assetCategory = cat
  }
  updateNodeData(linkedImageNodeId, patch)
}
</script>

<template>
  <div class="text-asset-detail-node-root" :class="assetTypeClass">
    <Handle type="target" :position="Position.Left" class="handle handle-target" />
    <div class="text-asset-detail-node" :class="{ 'is-selected': selected }">
      <div class="node-header">
        <el-icon v-if="headerIcon" class="node-header-icon"><component :is="headerIcon" /></el-icon>
        <span class="node-label">{{ detailNodeLabel }}</span>
      </div>
      <div v-if="lodIsShell" class="text-asset-detail-shell nodrag nopan">
        <el-icon class="text-asset-detail-shell-icon" aria-hidden="true"><component :is="headerIcon" /></el-icon>
        <div class="text-asset-detail-shell-lines">
          <span class="text-asset-detail-shell-title">{{ detailNodeLabel }}</span>
          <span class="text-asset-detail-shell-sub">{{ t('canvas.nodeUi.textAssetDetail.shellHint') }}</span>
        </div>
      </div>
      <template v-else>
      <div class="node-body nodrag nopan" @wheel.stop>
        <div class="field-row field-row-name">
          <el-input v-model="assetNameModel" :placeholder="t('canvas.nodeUi.textAssetDetail.namePh')" @wheel.stop />
        </div>
        <div class="field-row">
          <div class="field-label">{{ t('canvas.nodeUi.textAssetDetail.descLabel') }}</div>
          <el-input
            v-model="assetDescriptionModel"
            type="textarea"
            :rows="4"
            :placeholder="t('canvas.nodeUi.textAssetDetail.descPh')"
            @wheel.stop
          />
        </div>
      </div>
      <div class="node-status" :style="{ backgroundColor: statusColor }" />
      </template>
    </div>
    <Handle type="source" :position="Position.Right" class="handle handle-source" />
  </div>
</template>

<style scoped>
.text-asset-detail-node-root {
  position: relative;
}

.text-asset-detail-node {
  width: 430px;
  min-width: 430px;
  max-width: 430px;
  min-height: 280px;
  background: var(--bg-secondary, #1a1a2e);
  border: 2px solid var(--border-color, #3a3a4a);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.text-asset-detail-node.is-selected {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.4), 0 4px 14px rgba(64, 158, 255, 0.22);
}

.text-asset-detail-shell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 200px;
  margin: 0 12px 12px;
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  background: rgba(10, 12, 22, 0.45);
  box-sizing: border-box;
}

.text-asset-detail-shell-icon {
  font-size: 26px;
  color: rgba(180, 200, 255, 0.85);
  flex-shrink: 0;
}

.text-asset-detail-shell-lines {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.text-asset-detail-shell-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(240, 244, 255, 0.95);
  word-break: break-word;
}

.text-asset-detail-shell-sub {
  font-size: 11px;
  color: rgba(180, 192, 220, 0.78);
  line-height: 1.4;
}

.text-asset-detail-node-root.asset-type-character .node-header {
  background: #f56c6c;
}

.text-asset-detail-node-root.asset-type-scene .node-header {
  background: #e6a23c;
}

.text-asset-detail-node-root.asset-type-prop .node-header {
  background: #409eff;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.16);
}

.node-header-icon {
  font-size: 18px;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.95);
}

.node-label {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.node-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-row-name {
  gap: 0;
}

.field-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.68);
}

.node-body :deep(.el-input__wrapper),
.node-body :deep(.el-textarea__inner) {
  background: rgba(8, 12, 20, 0.62);
  border-color: rgba(255, 255, 255, 0.14);
  color: rgba(241, 245, 252, 0.94);
}

.node-body :deep(.el-textarea__inner) {
  min-height: 150px !important;
  resize: vertical;
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
