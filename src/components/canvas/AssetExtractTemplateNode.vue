<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Box, Promotion } from '@element-plus/icons-vue'
import { useVueFlow } from '@vue-flow/core'
import { usePromptsStore } from '@/stores/promptsStore'
import { useApiConfigStore } from '@/stores/apiConfigStore'
import { useUserStore } from '@/stores/userStore'
import { vueFlowEdgeTypeForSetting } from '@/utils/canvasEdgeType'
import { canvasEdgeStyleFromWidth } from '@/utils/canvasEdgeStyle'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import apiService from '@/services/apiService'
import { getModelPlatformBadge } from '@/utils/modelPlatformBadge'
import { useCanvasNodeCommon } from '@/composables/useCanvasNodeUiI18n'

interface AssetItem {
  id: string
  name: string
  description: string
  imageUrl: string | null
  category: 'character' | 'scene' | 'prop'
  status?: 'pending' | 'generating' | 'completed' | 'error'
}

type AssetCategory = 'character' | 'scene' | 'prop'

interface GroupedAssets {
  character: AssetItem[]
  scene: AssetItem[]
  prop: AssetItem[]
}

interface Props {
  id: string
  selected?: boolean
  data: {
    label: string
    type: string
    status?: 'pending' | 'running' | 'completed' | 'error'
    textProcessNodeId?: string
    selectedExtractAssetPromptId?: string
    textModelGroup?: 'youshang' | 'flow2'
    textModel?: string
    description?: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
})

const { t, apiGroupLabelMap, notChosenModel, modelGroupFallback } = useCanvasNodeCommon()
const promptsStore = usePromptsStore()
const apiStore = useApiConfigStore()
const userStore = useUserStore()

const { findNode, updateNodeData: rawUpdateNodeData, addNodes, addEdges, removeNodes, edges } = useVueFlow()
const scheduleCanvasAutoSave = inject<(() => void) | undefined>('scheduleCanvasAutoSave', undefined)

function updateNodeData(nodeId: string, data: any) {
  rawUpdateNodeData(nodeId, data)
  scheduleCanvasAutoSave?.()
}

const extractingAssets = ref(false)

const canvasAssetExtractPromptTemplateId = inject<Ref<string>>('canvasAssetExtractPromptTemplateId')

const ASSET_TOTAL_NODE_OFFSET_X = 380
const ASSET_DETAIL_CHAIN_OFFSET_X = 80
const ASSET_CHAIN_COLUMN_STEP_X = 520
const ASSET_DETAIL_TO_IMAGE_GAP_Y = 360
const ASSET_CATEGORY_SECTION_GAP_Y = 220
const ASSET_IMAGE_NODE_HEIGHT = 300
const ASSET_CATEGORY_SECTION_SPAN_Y = ASSET_DETAIL_TO_IMAGE_GAP_Y + ASSET_IMAGE_NODE_HEIGHT

const tpData = computed(() => {
  if (!props.data.textProcessNodeId) return null
  const tpNode = findNode(props.data.textProcessNodeId)
  return tpNode?.data as {
    textModelGroup?: 'youshang' | 'flow2'
    textModel?: string
  } | null
})

const textModel = computed({
  get: () => tpData.value?.textModel || apiStore.documentUploadModel || apiStore.textModels[0]?.id || '',
  set: () => {}
})

const mergedTextModelOptions = computed(() => {
  const m = apiGroupLabelMap.value
  return [
    { value: 'youshang', label: m.youshang, models: apiStore.textModels },
    { value: 'flow2', label: m.flow2, models: [] as typeof apiStore.textModels }
  ] as const
})

const currentTextModelGroupOption = computed(() => {
  const currentGroup = tpData.value?.textModelGroup || 'youshang'
  return mergedTextModelOptions.value.find(group => group.value === currentGroup) || mergedTextModelOptions.value[0]
})

const panelTextModels = computed(() => {
  const hit = mergedTextModelOptions.value.find(item => item.value === (tpData.value?.textModelGroup || 'youshang'))
  return hit?.models || []
})

const panelTextModelsWithBadge = computed(() =>
  panelTextModels.value.map((model) => ({
    ...model,
    badge: getModelPlatformBadge(model.id, model.name)
  }))
)

const currentTextModelMeta = computed(() => {
  const group = currentTextModelGroupOption.value
  const hit = group.models.find(item => item.id === textModel.value) || group.models[0]
  return {
    modelName: hit?.name || notChosenModel(),
    groupLabel: group?.label || modelGroupFallback()
  }
})

const statusColor = computed(() => {
  switch (props.data.status) {
    case 'running': return '#409eff'
    case 'completed': return '#67c23a'
    case 'error': return '#f56c6c'
    default: return '#909399'
  }
})

const extractAssetPrompts = computed(() => promptsStore.getSubCategoryPrompts('extract-assets'))

const selectedExtractAssetPromptId = computed({
  get: () => canvasAssetExtractPromptTemplateId?.value || '1',
  set: () => {}
})

const currentSelectedPrompt = computed(() => {
  return extractAssetPrompts.value.find(p => p.id === selectedExtractAssetPromptId.value)
})

function ensureDefaults() {
  // 不需要在这个节点保存模型设置，因为模型设置在文本处理节点中
}

function getSourceTextFromTextProcessNode(): string | null {
  if (!props.data.textProcessNodeId) return null
  const textProcessNode = findNode(props.data.textProcessNodeId)
  if (!textProcessNode) return null
  const data = textProcessNode.data as any
  const chapters = data.chapters || []
  const selectedChapterIds = data.selectedChapterIds || []
  
  if (selectedChapterIds.length > 0 && chapters.length > 0) {
    const selectedChapters = chapters.filter((chapter: any) => selectedChapterIds.includes(chapter.id))
    return selectedChapters.map((chapter: any) => `${chapter.title}\n${chapter.content}`).join('\n\n')
  }
  
  return (data.textContent || '').trim()
}

function safeParseJsonObject(text: string): any {
  if (!text || typeof text !== 'string') return null
  
  // 策略1：尝试直接解析
  try {
    return JSON.parse(text)
  } catch {}

  // 策略2：提取第一个大的JSON对象（最外层匹配）
  try {
    let start = 0
    let braceCount = 0
    let foundStart = false
    let resultStart = 0
    let resultEnd = 0
    
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (!foundStart) {
          foundStart = true
          resultStart = i
        }
        braceCount++
      } else if (text[i] === '}') {
        braceCount--
        if (foundStart && braceCount === 0) {
          resultEnd = i + 1
          break
        }
      }
    }
    
    if (foundStart && resultEnd > resultStart) {
      const jsonStr = text.slice(resultStart, resultEnd)
      return JSON.parse(jsonStr)
    }
  } catch {}

  // 策略3：使用正则提取，但更精确地寻找匹配
  try {
    const jsonMatch = text.match(/\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch {}

  // 策略4：清理一些常见的干扰字符后再尝试
  try {
    // 移除 markdown 代码块标记
    let cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*$/g, '')
    // 移除开头的非JSON字符直到遇到第一个 {
    const startIdx = cleaned.indexOf('{')
    if (startIdx !== -1) {
      cleaned = cleaned.slice(startIdx)
      // 移除结尾的非JSON字符从最后一个 } 之后
      const endIdx = cleaned.lastIndexOf('}')
      if (endIdx !== -1) {
        cleaned = cleaned.slice(0, endIdx + 1)
      }
      return JSON.parse(cleaned)
    }
  } catch {}

  // 策略5：尝试从 Markdown 代码块中提取
  try {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim())
    }
  } catch {}

  return null
}

function buildAssetImagePrompt(name: string, description: string) {
  const n = String(name ?? '').trim()
  const d = String(description ?? '').trim()
  return [
    n ? `${t('canvas.nodeUi.textProcess.assetNamePrefix')}${n}` : '',
    d ? `${t('canvas.nodeUi.textProcess.assetDescPrefix')}${d}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

function resolveAssetDetailNodeLabel(category: AssetCategory): string {
  if (category === 'character') return t('canvas.nodeUi.textProcess.assetCatCharacterLabel')
  if (category === 'scene') return t('canvas.nodeUi.textProcess.assetCatSceneLabel')
  return t('canvas.nodeUi.textProcess.assetCatPropLabel')
}

function assetDetailNodeTitleKey(category: AssetCategory):
  | 'canvas.nodeUi.textProcess.assetCatCharacterLabel'
  | 'canvas.nodeUi.textProcess.assetCatSceneLabel'
  | 'canvas.nodeUi.textProcess.assetCatPropLabel' {
  if (category === 'character') return 'canvas.nodeUi.textProcess.assetCatCharacterLabel'
  if (category === 'scene') return 'canvas.nodeUi.textProcess.assetCatSceneLabel'
  return 'canvas.nodeUi.textProcess.assetCatPropLabel'
}

function removeExistingAssetDetailChains(totalNodeId: string) {
  const removableIds = new Set<string>()
  edges.value.forEach((edge) => {
    if (edge.source !== totalNodeId) return
    const detailNode = findNode(edge.target)
    if (!detailNode || detailNode.type !== 'textAssetDetail') return
    if (!(detailNode.data as any)?.generatedByTextProcess) return
    removableIds.add(detailNode.id)
    const linkedImageNodeId = String((detailNode.data as any)?.linkedImageNodeId ?? '').trim()
    if (linkedImageNodeId) {
      removableIds.add(linkedImageNodeId)
    }
  })
  if (removableIds.size > 0) {
    removeNodes(Array.from(removableIds))
  }
}

function createGroupedAssetDetailChains(totalNodeId: string, groupedAssets: GroupedAssets) {
  removeExistingAssetDetailChains(totalNodeId)
  const totalNode = findNode(totalNodeId)
  const selfNode = findNode(props.id)
  if (!totalNode) return
  const baseX = totalNode.position.x + (totalNode.dimensions?.width ?? 300) + ASSET_DETAIL_CHAIN_OFFSET_X
  const categories: AssetCategory[] = ['character', 'scene', 'prop']
  const textCenterY = (selfNode?.position.y ?? totalNode.position.y)
    + ((selfNode?.dimensions?.height ?? 360) / 2)
  const categoryCenterOffsetY = ASSET_CATEGORY_SECTION_SPAN_Y / 2
  const sceneDetailY = textCenterY - categoryCenterOffsetY
  const sectionStartByCategory: Record<AssetCategory, number> = {
    character: sceneDetailY - ASSET_CATEGORY_SECTION_SPAN_Y - ASSET_CATEGORY_SECTION_GAP_Y,
    scene: sceneDetailY,
    prop: sceneDetailY + ASSET_CATEGORY_SECTION_SPAN_Y + ASSET_CATEGORY_SECTION_GAP_Y
  }
  const now = Date.now()

  categories.forEach((category) => {
    const assets = groupedAssets[category] ?? []
    if (assets.length === 0) return
    const detailY = sectionStartByCategory[category]
    const imageY = detailY + ASSET_DETAIL_TO_IMAGE_GAP_Y
    assets.forEach((asset, index) => {
      const assetName =
        String(asset.name ?? '').trim() ||
        t('canvas.nodeUi.textProcess.assetTpl', { n: index + 1 })
      const assetDescription = String(asset.description ?? '').trim()
      const detailNodeId = `asset-detail-${category}-${now}-${index}`
      const imageNodeId = `asset-image-${category}-${now}-${index}`
      const columnX = baseX + (index * ASSET_CHAIN_COLUMN_STEP_X)

      addNodes({
        id: detailNodeId,
        type: 'textAssetDetail',
        position: { x: columnX, y: detailY },
        data: {
          label: resolveAssetDetailNodeLabel(category),
          type: 'textAssetDetail',
          status: 'completed',
          description: t('canvas.nodeUi.textProcess.detailDesc'),
          assetCategory: category,
          assetName,
          assetDescription,
          linkedImageNodeId: imageNodeId,
          generatedByTextProcess: true,
          nodeTitleI18n: { key: assetDetailNodeTitleKey(category) }
        }
      })

      addEdges({
        id: `e-${totalNodeId}-${detailNodeId}-${now}-${index}`,
        source: totalNodeId,
        target: detailNodeId,
        animated: true,
        type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
        style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
      })

      addNodes({
        id: imageNodeId,
        type: 'imageCanvas',
        position: { x: columnX, y: imageY },
        data: {
          label: t('canvas.nodeUi.textProcess.assetImageLabelTpl', { name: assetName }),
          type: 'image',
          status: 'pending',
          description: t('canvas.nodeUi.textProcess.assetImageGenDescTpl', { name: assetName }),
          prompt: buildAssetImagePrompt(assetName, assetDescription),
          referenceImages: [],
          uploadedMainImageUrl: null,
          generatedImageUrl: null,
          toolbarExpanded: false,
          imageQuality: '1K',
          aspectRatio: '16:9',
          imageModelGroup: apiStore.imageModelGroup,
          imageModel: apiStore.imageModel,
          assetCategory: category,
          sourceAssetDetailNodeId: detailNodeId,
          generatedByTextProcess: true,
          nodeTitleI18n: {
            key: 'canvas.nodeUi.textProcess.assetImageLabelTpl',
            params: { name: assetName }
          }
        }
      })

      addEdges({
        id: `e-${detailNodeId}-${imageNodeId}-${now}-${index}`,
        source: detailNodeId,
        target: imageNodeId,
        animated: true,
        type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
        style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
      })
    })
  })
}

async function handleExtractAssets() {
  const sourceText = getSourceTextFromTextProcessNode()
  if (!sourceText) {
    ElMessage.warning(t('canvas.nodeUi.textProcess.noContentAssets'))
    return
  }
  const tg = tpData.value?.textModelGroup || 'youshang'
  if (!apiStore.isApiReadyForGroup(tg)) {
    ElMessage.warning(
      tg === 'flow2' ? t('settings.msg.enterApiUrlFirst') : t('canvas.nodeUi.textProcess.needApiFirst')
    )
    return
  }

  extractingAssets.value = true
  updateNodeData(props.id, { status: 'running' })

  try {
    const selectedPrompt = promptsStore.getPromptById(selectedExtractAssetPromptId.value)
    let promptContent = selectedPrompt?.content || promptsStore.getExtractAssetsPrompt()

    if (selectedPrompt?.isCustom) {
      promptContent = `${promptContent}\n\n${promptsStore.getExtractAssetsStandardConstraint()}`
    }

    const extractPromptBody = '\n\n请提取所有重要的人物、场景和道具。\n只返回 JSON，格式如下：\n{\n  "characters": [{ "name": "人物名", "description": "人物描述" }],\n  "scenes": [{ "name": "场景名", "description": "场景描述" }],\n  "props": [{ "name": "道具名", "description": "道具描述" }]\n}'
    const extractPrompt = `${promptContent}${t('canvas.nodeUi.textProcess.extractPromptNovelLabel')}${sourceText}${extractPromptBody}`

    const result = await apiService.generateText(extractPrompt, {
      model: textModel.value,
      systemPrompt: t('canvas.nodeUi.textProcess.extractSystemPrompt'),
      modelGroup: tg
    })
    const parsed = safeParseJsonObject(result)
    if (!parsed) {
      throw new Error(t('canvas.nodeUi.textProcess.aiAssetsJsonFail'))
    }

    const characters: AssetItem[] = (parsed.characters ?? []).map((item: any, index: number) => ({
      id: `char-${Date.now()}-${index}`,
      name: String(item.name || t('canvas.nodeUi.textProcess.assetTpl', { n: index + 1 })),
      description: String(item.description || ''),
      imageUrl: null,
      category: 'character' as const
    }))
    const scenes: AssetItem[] = (parsed.scenes ?? []).map((item: any, index: number) => ({
      id: `scene-${Date.now()}-${index}`,
      name: String(item.name || t('canvas.nodeUi.textProcess.assetTpl', { n: index + 1 })),
      description: String(item.description || ''),
      imageUrl: null,
      category: 'scene' as const
    }))
    const propsAssets: AssetItem[] = (parsed.props ?? []).map((item: any, index: number) => ({
      id: `prop-${Date.now()}-${index}`,
      name: String(item.name || t('canvas.nodeUi.textProcess.assetTpl', { n: index + 1 })),
      description: String(item.description || ''),
      imageUrl: null,
      category: 'prop' as const
    }))
    const groupedAssets: GroupedAssets = {
      character: characters,
      scene: scenes,
      prop: propsAssets
    }
    const flattenedAssets = [...characters, ...scenes, ...propsAssets]

    const selfNode = findNode(props.id)
    if (selfNode) {
      const topY = selfNode.position.y - (selfNode.dimensions?.height ?? 350) - 60
      const totalAssetNodeId = `asset-result-${Date.now()}`
      
      addNodes({
        id: totalAssetNodeId,
        type: 'textAssetResult',
        position: { x: selfNode.position.x, y: topY },
        data: {
          label: t('canvas.nodeUi.textProcess.assetResultLabel'),
          type: 'textAsset',
          status: 'completed',
          assets: flattenedAssets,
          groupedAssets
        }
      })

      addEdges({
        id: `e-${props.id}-${totalAssetNodeId}`,
        source: props.id,
        target: totalAssetNodeId,
        type: vueFlowEdgeTypeForSetting(userStore.edgeStyle)
      })

      // 创建资产详情节点和图片节点
      createGroupedAssetDetailChains(totalAssetNodeId, groupedAssets)
    }

    updateNodeData(props.id, { status: 'completed' })

    ElMessage.success(
      t('canvas.nodeUi.textProcess.assetsOk', {
        a: characters.length,
        b: scenes.length,
        c: propsAssets.length
      })
    )
  } catch (error) {
    updateNodeData(props.id, { status: 'error' })
    ElMessage.error(
      error instanceof Error ? error.message : t('canvas.nodeUi.textProcess.assetsFail')
    )
  } finally {
    extractingAssets.value = false
  }
}
</script>

<template>
  <div class="asset-extract-template-node-root">
    <Handle type="target" :position="Position.Left" class="handle handle-target" />
    <div class="asset-extract-template-node" :class="{ 'is-selected': selected }">
      <div class="node-header">
        <el-icon class="node-type-icon node-type-icon--box">
          <Box />
        </el-icon>
        <span class="node-label">{{ data.label }}</span>
      </div>

      <div class="node-body">
        <div class="template-selector">
          <div class="prompt-chip nodrag nopan disabled">
            <span class="prompt-chip-name">{{ currentSelectedPrompt?.title || '请选择模板' }}</span>
            <span class="prompt-chip-group">{{ currentSelectedPrompt?.isCustom ? '自定义' : '官方' }}</span>
          </div>
        </div>

        <div class="model-selector">
          <div class="model-chip nodrag nopan disabled">
            <span class="model-chip-name">{{ currentTextModelMeta.modelName }}</span>
            <span class="model-chip-group">{{ currentTextModelMeta.groupLabel }}</span>
          </div>
        </div>

        <div class="action-buttons">
          <button
            type="button"
            class="extract-button"
            :disabled="extractingAssets"
            @click="handleExtractAssets"
          >
            <el-icon v-if="extractingAssets" class="is-loading">
              <Promotion />
            </el-icon>
            <el-icon v-else>
              <Promotion />
            </el-icon>
            <span>{{ extractingAssets ? t('canvas.nodeUi.textProcess.extractingAssets') : t('canvas.nodeUi.textProcess.extractAssets') }}</span>
          </button>
        </div>
      </div>

      <div class="node-status" :style="{ backgroundColor: statusColor }" />
    </div>
    <Handle type="source" :position="Position.Right" class="handle handle-source" />
  </div>
</template>

<style scoped>
.asset-extract-template-node-root {
  position: relative;
  min-width: 0;
  box-sizing: border-box;
}

.asset-extract-template-node {
  min-width: 300px;
  max-width: 300px;
  min-height: 150px;
  background: var(--bg-secondary, #1a1a2e);
  border: 2px solid var(--border-color, #3a3a4a);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  cursor: grab;
}

.asset-extract-template-node:hover:not(.is-selected) {
  border-color: rgba(255, 255, 255, 0.58);
  box-shadow: 0 2px 12px rgba(255, 255, 255, 0.07);
}

.asset-extract-template-node.is-selected {
  border-color: #409eff;
  box-shadow:
    0 0 0 1px rgba(64, 158, 255, 0.4),
    0 4px 14px rgba(64, 158, 255, 0.22);
}

.asset-extract-template-node:active {
  cursor: grabbing;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-tertiary, #25253a);
  border-bottom: 1px solid var(--border-color, #3a3a4a);
}

.node-type-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.node-type-icon--box {
  color: #409eff;
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
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.template-selector,
.model-selector {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.selector-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #a0a0b0);
}

.prompt-chip {
  min-width: 170px;
  max-width: 100%;
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 5px;
  background: #101114;
  color: rgba(248, 250, 255, 0.95);
  font-size: 12px;
  padding: 0 10px;
  cursor: pointer;
  overflow: hidden;
}

.prompt-chip:hover {
  border-color: rgba(255, 255, 255, 0.22);
}

.prompt-chip-name {
  min-width: 0;
  flex: 1;
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.prompt-chip-group,
.model-chip-group {
  flex-shrink: 0;
  font-size: 11px;
  color: rgba(142, 154, 179, 0.9);
}

.model-chip {
  min-width: 290px;
  max-width: 100%;
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 5px;
  background: #101114;
  color: rgba(248, 250, 255, 0.95);
  font-size: 12px;
  padding: 0 10px;
  cursor: pointer;
  overflow: hidden;
}

.model-chip:hover {
  border-color: rgba(255, 255, 255, 0.22);
}

.model-chip-name {
  min-width: 0;
  flex: 1;
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.extract-button {
  width: 100%;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: #409eff;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease;
}

.extract-button:hover:not(:disabled) {
  background: #66b1ff;
}

.extract-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.is-loading {
  animation: icon-spin 1s linear infinite;
}

@keyframes icon-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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
</style>

<style>
.asset-prompt-popover.el-popper,
.asset-prompt-popover,
.asset-model-popover.el-popper,
.asset-model-popover {
  padding: 12px !important;
  background: #17181c !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 14px !important;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.5) !important;
}

.asset-prompt-popover .prompt-panel-label {
  margin: 2px 0 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.58);
}

.asset-prompt-popover .prompt-group {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 8px;
}

.asset-prompt-popover .prompt-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: #101114;
  color: rgba(220, 228, 242, 0.85);
  font-size: 13px;
  line-height: 1.2;
  cursor: pointer;
}

.asset-prompt-popover .prompt-btn-icon {
  width: 28px;
  height: 20px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: #fff;
  flex-shrink: 0;
}

.asset-prompt-popover .prompt-btn-icon.icon-official {
  background: #409eff;
}

.asset-prompt-popover .prompt-btn-icon.icon-custom {
  background: #f59e0b;
}

.asset-prompt-popover .prompt-btn-text {
  min-width: 0;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-prompt-popover .prompt-btn.active {
  border-color: rgba(64, 158, 255, 0.65);
  background: rgba(64, 158, 255, 0.2);
  color: #e8f1ff;
  font-weight: 600;
}

.asset-model-popover .model-panel-label {
  margin: 2px 0 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.58);
}

.asset-model-popover .provider-group {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.asset-model-popover .provider-btn {
  min-height: 32px;
  width: 100%;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: #101114;
  color: rgba(220, 228, 242, 0.82);
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
}

.asset-model-popover .provider-btn.active {
  border-color: rgba(64, 158, 255, 0.65);
  background: rgba(64, 158, 255, 0.2);
  color: #e8f1ff;
  font-weight: 600;
}

.asset-model-popover .model-group {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.asset-model-popover .model-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: #101114;
  color: rgba(220, 228, 242, 0.85);
  font-size: 13px;
  line-height: 1.2;
  cursor: pointer;
}

.asset-model-popover .model-btn-icon {
  width: 28px;
  height: 20px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: #fff;
  flex-shrink: 0;
}

.asset-model-popover .model-btn-icon.platform-openai {
  background: #10a37f;
}

.asset-model-popover .model-btn-icon.platform-anthropic {
  background: #cc81ff;
}

.asset-model-popover .model-btn-icon.platform-qwen {
  background: #ff9800;
}

.asset-model-popover .model-btn-icon.platform-deepseek {
  background: #5568f2;
}

.asset-model-popover .model-btn-icon.platform-groq {
  background: #f55036;
}

.asset-model-popover .model-btn-icon.platform-volc {
  background: #1664ff;
}

.asset-model-popover .model-btn-icon.platform-step {
  background: #4f46e5;
}

.asset-model-popover .model-btn-icon.platform-other {
  background: #6b7280;
}

.asset-model-popover .model-btn-text {
  min-width: 0;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-model-popover .model-btn.active {
  border-color: rgba(64, 158, 255, 0.65);
  background: rgba(64, 158, 255, 0.2);
  color: #e8f1ff;
  font-weight: 600;
}

.asset-model-popover .model-empty {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.52);
}
</style>
