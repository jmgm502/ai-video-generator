<script setup lang="ts">
import { computed, inject, withDefaults, type Component } from 'vue'
import { useCanvasLodLevel } from '@/composables/useCanvasLodLevel'
import { useI18n } from 'vue-i18n'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { ElMessage } from 'element-plus'
import { User, OfficeBuilding, Goods } from '@element-plus/icons-vue'
import { useCanvasNodeTitle } from '@/composables/useCanvasNodeUiI18n'

type AssetCategory = 'character' | 'scene' | 'prop'

const { t } = useI18n()
const { canvasNodeDisplayTitle } = useCanvasNodeTitle()
const lodLevel = useCanvasLodLevel()
const lodIsShell = computed(() => lodLevel.value === 'shell')
interface AssetItem {
  id: string
  name: string
  description: string
  imageUrl?: string | null
  category?: AssetCategory
}

interface GroupedAssets {
  character?: AssetItem[]
  scene?: AssetItem[]
  prop?: AssetItem[]
}

interface TextAssetResultNodeData {
  label: string
  type: string
  status?: 'pending' | 'running' | 'completed' | 'error'
  description?: string
  assets?: AssetItem[]
  groupedAssets?: GroupedAssets
  groupCollapse?: Partial<Record<AssetCategory, boolean>>
  sourceNodeId?: string
  nodeTitleI18n?: { key: string; params?: Record<string, string | number> }
}

interface Props {
  id: string
  selected?: boolean
  data: TextAssetResultNodeData
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
})

const headerTitle = computed(() =>
  canvasNodeDisplayTitle(props.data, 'canvas.nodeUi.textProcess.totalAssetsLabel', {
    preferFallbackOverPersisted: true
  })
)

const { updateNodeData: rawUpdateNodeData, findNode, edges } = useVueFlow()
const scheduleCanvasAutoSave = inject<(() => void) | undefined>('scheduleCanvasAutoSave', undefined)

function updateNodeData(nodeId: string, data: Partial<any>) {
  rawUpdateNodeData(nodeId, data)
  scheduleCanvasAutoSave?.()
}

function normalizeAssetList(input: unknown): AssetItem[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((asset): asset is Record<string, unknown> => Boolean(asset) && typeof asset === 'object')
    .map((asset) => {
      const categoryRaw = asset.category
      let category: AssetCategory | undefined
      if (categoryRaw === 'character' || categoryRaw === 'scene' || categoryRaw === 'prop') {
        category = categoryRaw
      }
      return {
        id: String(asset.id ?? ''),
        name: String(asset.name ?? '').trim(),
        description: String(asset.description ?? ''),
        imageUrl: asset.imageUrl == null ? null : String(asset.imageUrl),
        category
      }
    })
    .filter(asset => asset.name)
}

const groupedAssets = computed<Required<GroupedAssets>>(() => {
  const grouped = props.data.groupedAssets ?? {}
  const byGroup: Required<GroupedAssets> = {
    character: normalizeAssetList(grouped.character),
    scene: normalizeAssetList(grouped.scene),
    prop: normalizeAssetList(grouped.prop)
  }
  if (byGroup.character.length || byGroup.scene.length || byGroup.prop.length) {
    return byGroup
  }
  const flatAssets = normalizeAssetList(props.data.assets)
  flatAssets.forEach((asset) => {
    if (asset.category === 'character') byGroup.character.push(asset)
    else if (asset.category === 'scene') byGroup.scene.push(asset)
    else if (asset.category === 'prop') byGroup.prop.push(asset)
  })
  return byGroup
})
const totalAssetsCount = computed(() =>
  groupedAssets.value.character.length + groupedAssets.value.scene.length + groupedAssets.value.prop.length
)
const groupCollapsed = computed(() => ({
  character: Boolean(props.data.groupCollapse?.character),
  scene: Boolean(props.data.groupCollapse?.scene),
  prop: Boolean(props.data.groupCollapse?.prop)
}))
const groupMeta = computed((): Array<{
  key: AssetCategory
  title: string
  icon: Component
  assets: AssetItem[]
  collapsed: boolean
}> => ([
  {
    key: 'character',
    title: `${t('canvas.comboDetailLabels.character')}（${groupedAssets.value.character.length}）`,
    icon: User,
    assets: groupedAssets.value.character,
    collapsed: groupCollapsed.value.character
  },
  {
    key: 'scene',
    title: `${t('canvas.comboDetailLabels.scene')}（${groupedAssets.value.scene.length}）`,
    icon: OfficeBuilding,
    assets: groupedAssets.value.scene,
    collapsed: groupCollapsed.value.scene
  },
  {
    key: 'prop',
    title: `${t('canvas.comboDetailLabels.prop')}（${groupedAssets.value.prop.length}）`,
    icon: Goods,
    assets: groupedAssets.value.prop,
    collapsed: groupCollapsed.value.prop
  }
]))

function toggleGroup(category: AssetCategory) {
  updateNodeData(props.id, {
    groupCollapse: {
      ...props.data.groupCollapse,
      [category]: !groupCollapsed.value[category]
    }
  })
}

const reextracting = computed(() => props.data.status === 'running')

function resolveSourceTextNodeId(): string | null {
  const sourceNodeId = String(props.data.sourceNodeId ?? '').trim()
  if (sourceNodeId) {
    const sourceNode = findNode(sourceNodeId)
    if (sourceNode?.type === 'textProcess') return sourceNodeId
  }
  const incoming = edges.value.find(edge => edge.target === props.id)
  if (!incoming) return null
  const sourceNode = findNode(incoming.source)
  if (sourceNode?.type === 'textProcess') return sourceNode.id
  return null
}

function handleReextractAssets() {
  if (reextracting.value) return
  const sourceNodeId = resolveSourceTextNodeId()
  if (!sourceNodeId) {
    ElMessage.warning(t('canvas.nodeUi.textAssetResult.noTextNode'))
    return
  }
  updateNodeData(sourceNodeId, { assetReextractTrigger: Date.now() })
  ElMessage.success(t('canvas.nodeUi.textAssetResult.reextractQueued'))
}

const statusColor = computed(() => {
  switch (props.data.status) {
    case 'running': return '#409eff'
    case 'completed': return '#67c23a'
    case 'error': return '#f56c6c'
    default: return '#909399'
  }
})
</script>

<template>
  <div class="text-asset-node-root">
    <Handle type="target" :position="Position.Left" class="handle handle-target" />
    <div class="text-asset-node" :class="{ 'is-selected': selected }">
      <div class="node-header">
        <span class="node-label">{{ headerTitle }}</span>
        <span class="asset-count-badge">{{ t('canvas.nodeUi.textAssetResult.badgeTotal', { n: totalAssetsCount }) }}</span>
      </div>
      <div v-if="lodIsShell" class="text-asset-result-shell nodrag nopan">
        <el-icon class="text-asset-result-shell-icon" aria-hidden="true"><User /></el-icon>
        <div class="text-asset-result-shell-lines">
          <span class="text-asset-result-shell-title">{{ headerTitle }}</span>
          <span class="text-asset-result-shell-sub">{{ t('canvas.nodeUi.textAssetResult.shellHint', { n: totalAssetsCount }) }}</span>
        </div>
      </div>
      <template v-else>
      <div class="node-body nodrag nopan" @wheel.stop>
        <div v-if="data.status === 'running' && totalAssetsCount === 0" class="node-waiting">
          <span class="spinner" />
          <span>{{ t('canvas.nodeUi.textAssetResult.waitingAi') }}</span>
        </div>
        <div v-else-if="totalAssetsCount === 0" class="node-empty">
          {{ t('canvas.nodeUi.textAssetResult.noData') }}
        </div>
        <div v-else class="group-list">
          <div v-for="group in groupMeta" :key="group.key" class="asset-group">
            <button type="button" class="group-header-btn" @click.stop="toggleGroup(group.key)">
              <span class="group-header-left">
                <el-icon class="group-title-icon"><component :is="group.icon" /></el-icon>
                <span class="group-title">{{ group.title }}</span>
              </span>
              <span class="group-arrow" :class="{ collapsed: group.collapsed }">▾</span>
            </button>
            <div v-if="!group.collapsed && group.assets.length > 0" class="asset-list">
              <div v-for="(asset, index) in group.assets" :key="asset.id || `${group.key}-${index}`" class="asset-item">
                <div class="asset-name-row">
                  <span class="asset-index">{{ index + 1 }}.</span>
                <span class="asset-name">{{ asset.name || t('canvas.nodeUi.textAssetResult.unnamedAsset', { n: index + 1 }) }}</span>
                </div>
              </div>
            </div>
            <div v-else-if="!group.collapsed" class="group-empty">
              {{ t('canvas.nodeUi.textAssetResult.noAssetsInGroup') }}
            </div>
          </div>
        </div>
      </div>
      <div class="node-footer nodrag nopan">
        <button type="button" class="reextract-btn" :disabled="reextracting" @click.stop="handleReextractAssets">
          {{ reextracting ? t('canvas.nodeUi.textAssetResult.extracting') : t('canvas.nodeUi.textAssetResult.reextract') }}
        </button>
      </div>
      <div class="node-status" :style="{ backgroundColor: statusColor }" />
      </template>
    </div>
    <Handle type="source" :position="Position.Right" class="handle handle-source" />
  </div>
</template>

<style scoped>
.text-asset-node-root {
  position: relative;
}

.text-asset-node {
  min-width: 260px;
  max-width: 320px;
  min-height: 260px;
  background: var(--bg-secondary, #1a1a2e);
  border: 2px solid var(--border-color, #3a3a4a);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.text-asset-node.is-selected {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.4), 0 4px 14px rgba(64, 158, 255, 0.22);
}

.text-asset-result-shell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 170px;
  margin: 0 12px 12px;
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  background: rgba(10, 12, 22, 0.45);
  box-sizing: border-box;
}

.text-asset-result-shell-icon {
  font-size: 26px;
  color: rgba(180, 200, 255, 0.85);
  flex-shrink: 0;
}

.text-asset-result-shell-lines {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.text-asset-result-shell-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(240, 244, 255, 0.95);
  word-break: break-word;
}

.text-asset-result-shell-sub {
  font-size: 11px;
  color: rgba(180, 192, 220, 0.78);
  line-height: 1.4;
}

.node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-tertiary, #25253a);
  border-bottom: 1px solid var(--border-color, #3a3a4a);
}

.node-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.asset-count-badge {
  font-size: 11px;
  color: rgba(212, 226, 255, 0.92);
  background: rgba(64, 158, 255, 0.26);
  border: 1px solid rgba(64, 158, 255, 0.4);
  border-radius: 999px;
  padding: 2px 8px;
  white-space: nowrap;
}

.node-body {
  padding: 10px;
  max-height: 760px;
  overflow: auto;
}

.node-empty {
  font-size: 12px;
  color: var(--text-secondary, #a0a0b0);
}

.node-waiting {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary, #a0a0b0);
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(64, 158, 255, 0.3);
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.asset-group {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
}

.group-header-btn {
  width: 100%;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(240, 245, 255, 0.92);
  min-height: 30px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
}

.group-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.group-title-icon {
  font-size: 16px;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.88);
}

.group-title {
  font-size: 12px;
  font-weight: 600;
}

.group-arrow {
  transition: transform 0.15s ease;
}

.group-arrow.collapsed {
  transform: rotate(-90deg);
}

.asset-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  max-height: 210px;
  overflow-y: auto;
}

.group-empty {
  padding: 8px 10px 10px;
  font-size: 11px;
  color: var(--text-secondary, #a0a0b0);
}

.asset-item {
  border: 1px solid var(--border-color, #3a3a4a);
  border-radius: 6px;
  padding: 7px 9px;
  background: rgba(255, 255, 255, 0.02);
}

.asset-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.asset-index {
  font-size: 11px;
  color: var(--text-secondary, #a0a0b0);
}

.asset-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.node-status {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.node-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 8px 10px 10px;
}

.reextract-btn {
  width: 100%;
  min-height: 32px;
  border: none;
  border-radius: 8px;
  background: rgba(64, 158, 255, 0.92);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
}

.reextract-btn:hover:not(:disabled) {
  background: #5cadff;
}

.reextract-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
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

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
