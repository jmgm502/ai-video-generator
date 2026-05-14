<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { Tickets, Promotion } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { usePromptsStore } from '@/stores/promptsStore'
import { useApiConfigStore } from '@/stores/apiConfigStore'
import { useUserStore } from '@/stores/userStore'
import { vueFlowEdgeTypeForSetting } from '@/utils/canvasEdgeType'
import { canvasEdgeStyleFromWidth } from '@/utils/canvasEdgeStyle'
import { useCanvasNodeCommon } from '@/composables/useCanvasNodeUiI18n'
import { getModelPlatformBadge } from '@/utils/modelPlatformBadge'
import { apiService } from '@/services/apiService'
import {
  parseStoryboardResult,
  normalizeStoryboardGridTexts,
  computeGridShape,
  buildStoryboardFrames,
  resolveStoryboardFlowStartPosition,
  type AiStoryboardItem
} from '@/utils/canvasStoryboardAi'

interface ChapterItem {
  id: string
  title: string
  content: string
}

interface TextProcessTpData {
  label?: string
  type?: string
  textContent?: string
  chapters?: ChapterItem[]
  selectedChapterIds?: string[]
  totalAssetNodeId?: string
  textModelGroup?: 'youshang' | 'flow2'
  textModel?: string
}

interface Props {
  id: string
  selected?: boolean
  data: {
    label: string
    type: string
    status?: 'pending' | 'running' | 'completed' | 'error'
    textProcessNodeId?: string
    selectedGenerateStoryboardPromptId?: string
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

const { findNode, updateNodeData: rawUpdateNodeData, addNodes, addEdges, edges } = useVueFlow()
const scheduleCanvasAutoSave = inject<(() => void) | undefined>('scheduleCanvasAutoSave', undefined)

function updateNodeData(nodeId: string, data: any) {
  rawUpdateNodeData(nodeId, data)
  scheduleCanvasAutoSave?.()
}

const pushStateBeforeChange = inject<(() => void) | undefined>('canvasPushStateBeforeChange', undefined)

const DEFAULT_SB_PROMPT_ID = '3'

const ASSET_DETAIL_CHAIN_OFFSET_X = 80
const ASSET_CATEGORY_SECTION_GAP_Y = 220
const ASSET_IMAGE_NODE_HEIGHT = 300

const generatingStoryboards = ref(false)

const canvasStoryboardGenPromptTemplateId = inject<Ref<string>>('canvasStoryboardGenPromptTemplateId')

const tpNodeId = computed(() => String(props.data.textProcessNodeId ?? '').trim())

const tpData = computed(() => {
  if (!tpNodeId.value) return null
  const tpNode = findNode(tpNodeId.value)
  return tpNode?.data as TextProcessTpData | null
})

const mergedTextModelOptions = computed(() => {
  const m = apiGroupLabelMap.value
  return [
    { value: 'youshang' as const, label: m.youshang, models: apiStore.textModels },
    { value: 'flow2' as const, label: m.flow2, models: [] as typeof apiStore.textModels }
  ]
})

const currentTextModelGroupOption = computed(() => {
  const currentGroup = tpData.value?.textModelGroup || 'youshang'
  return mergedTextModelOptions.value.find((g) => g.value === currentGroup) || mergedTextModelOptions.value[0]
})

const panelTextModels = computed(() => {
  const hit = mergedTextModelOptions.value.find((item) => item.value === (tpData.value?.textModelGroup || 'youshang'))
  return hit?.models || []
})

const panelTextModelsWithBadge = computed(() =>
  panelTextModels.value.map((model) => ({
    ...model,
    badge: getModelPlatformBadge(model.id, model.name)
  }))
)

const textModel = computed({
  get: () =>
    tpData.value?.textModel ||
    apiStore.documentUploadModel ||
    apiStore.textModels[0]?.id ||
    '',
  set: () => {}
})

const currentTextModelMeta = computed(() => {
  const group = currentTextModelGroupOption.value
  const hit = group.models.find((item) => item.id === textModel.value) || group.models[0]
  return {
    modelName: hit?.name || notChosenModel(),
    groupLabel: group?.label || modelGroupFallback()
  }
})

const statusColor = computed(() => {
  switch (props.data.status) {
    case 'running':
      return '#409eff'
    case 'completed':
      return '#67c23a'
    case 'error':
      return '#f56c6c'
    default:
      return '#909399'
  }
})

const generateStoryboardPrompts = computed(() =>
  promptsStore.getSubCategoryPrompts('generate-storyboard')
)

const selectedGenerateStoryboardPromptId = computed({
  get: () => canvasStoryboardGenPromptTemplateId?.value || DEFAULT_SB_PROMPT_ID,
  set: () => {}
})

const currentSbPrompt = computed(() =>
  generateStoryboardPrompts.value.find((p) => p.id === selectedGenerateStoryboardPromptId.value)
)

function ensureDefaults() {
  // 不需要在这个节点保存模型设置，因为模型设置在文本处理节点中
}

onMounted(() => {
  // 不需要执行 ensureDefaults
})

async function handleGenerateStoryboards() {
  const tpId = tpNodeId.value
  if (!tpId) {
    ElMessage.warning(t('canvas.nodeUi.textProcess.noSelfNodeSb'))
    return
  }
  const tpNode = findNode(tpId)
  if (!tpNode?.data) {
    ElMessage.warning(t('canvas.nodeUi.textProcess.noSelfNodeSb'))
    return
  }

  const tpNodeData = tpNode.data as TextProcessTpData
  const selectedIds = new Set(tpNodeData.selectedChapterIds ?? [])
  const chapters = tpNodeData.chapters ?? []
  const selectedChapters = chapters.filter((chapter) => selectedIds.has(chapter.id))
  const rawText = String(tpNodeData.textContent ?? '').trim()
  const sourceText =
    selectedChapters.length > 0
      ? selectedChapters.map((chapter) => `${chapter.title}\n${chapter.content}`).join('\n\n')
      : rawText

  if (!sourceText) {
    ElMessage.warning(t('canvas.nodeUi.textProcess.noChapterForSb'))
    return
  }
  const tg = tpNodeData.textModelGroup || 'youshang'
  if (!apiStore.isApiReadyForGroup(tg)) {
    ElMessage.warning(
      tg === 'flow2' ? t('settings.msg.enterApiUrlFirst') : t('canvas.nodeUi.textProcess.needApiFirst')
    )
    return
  }

  generatingStoryboards.value = true
  updateNodeData(props.id, { status: 'running' })

  try {
    const selectedCount = selectedChapters.length
    const chapterConstraint =
      selectedCount > 0
        ? t('canvas.nodeUi.textProcess.sbChapterConstraint', { count: selectedCount })
        : ''

    const promptId = selectedGenerateStoryboardPromptId.value
    const selectedPrompt = promptsStore.getPromptById(promptId)
    let promptContent = selectedPrompt?.content || promptsStore.getGenerateStoryboardPrompt()

    if (selectedPrompt?.isCustom) {
      promptContent = `${promptContent}\n\n${promptsStore.getGenerateStoryboardStandardConstraint()}`
    }

    const generatePrompt = `${promptContent}${t('canvas.nodeUi.textProcess.sbPromptNovelLabel')}${sourceText}\n\n${t('canvas.nodeUi.textProcess.sbPromptFollow')}${chapterConstraint}`

    const cfg = apiStore.configForModelGroup(tg)
    let storyboardMaxTokens: number | undefined
    if (
      selectedCount >= 2 &&
      !cfg.unlimitedTokens &&
      typeof cfg.maxTokens === 'number' &&
      cfg.maxTokens > 0
    ) {
      storyboardMaxTokens = Math.min(32768, cfg.maxTokens * Math.min(4, selectedCount))
    }

    const result = await apiService.generateText(generatePrompt, {
      model: textModel.value,
      systemPrompt: t('canvas.nodeUi.textProcess.sbSystemPrompt'),
      ...(storyboardMaxTokens ? { maxTokens: storyboardMaxTokens } : {}),
      modelGroup: tg
    })

    const storyboardItems = parseStoryboardResult(result)
    if (!storyboardItems.length) {
      throw new Error(t('canvas.nodeUi.textProcess.sbAiNoParsed'))
    }

    if (selectedCount > 0 && storyboardItems.length < selectedCount) {
      ElMessage.warning(
        t('canvas.nodeUi.textProcess.sbWarnTooFew', {
          got: storyboardItems.length,
          need: selectedCount
        })
      )
    }

    const gridPlaceholder = t('canvas.nodeUi.textProcess.sbGridPlaceholder')

    const storyboardStart = resolveStoryboardFlowStartPosition({
      findNode,
      edges: edges.value,
      totalAssetNodeId: tpData.totalAssetNodeId,
      selfNode: tpNode,
      assetDetailChainOffsetX: ASSET_DETAIL_CHAIN_OFFSET_X,
      assetCategorySectionGapY: ASSET_CATEGORY_SECTION_GAP_Y,
      assetImageNodeHeight: ASSET_IMAGE_NODE_HEIGHT
    })

    const baseX = storyboardStart.x
    const baseY = storyboardStart.y
    const verticalGap = 460
    const now = Date.now()

    pushStateBeforeChange?.()

    storyboardItems.forEach((item: AiStoryboardItem, index: number) => {
      const gridTextsRaw = normalizeStoryboardGridTexts(item, gridPlaceholder)
      const gridTexts = gridTextsRaw.slice(0, 36)
      const shape = computeGridShape(gridTexts.length)
      const frames = buildStoryboardFrames(gridTexts, shape.rows, shape.cols)
      const nodeId = `storyboard-gen-${now}-${index}`
      const nodeLabel =
        String(item.title || t('canvas.nodeUi.textProcess.totalNodeLabel', { n: index + 1 })).trim() ||
        t('canvas.nodeUi.textProcess.totalNodeLabel', { n: index + 1 })

      addNodes({
        id: nodeId,
        type: 'storyboardGen',
        position: {
          x: baseX,
          y: baseY + index * verticalGap
        },
        data: {
          label: nodeLabel,
          storyboardSequence: index + 1,
          storyboardTitle: nodeLabel,
          type: 'storyboard',
          status: 'pending',
          description: t('canvas.nodeUi.textProcess.sbNodeDesc'),
          toolbarExpanded: false,
          gridRows: shape.rows,
          gridCols: shape.cols,
          frames,
          storyboardPrompt: '',
          referenceImages: [],
          generatedImageUrl: null,
          imageQuality: '1K',
          aspectRatio: '16:9',
          imageModelGroup: apiStore.imageModelGroup,
          imageModel: apiStore.imageModel
        }
      })

      addEdges({
        id: `e-${tpId}-${nodeId}-${now}`,
        source: tpId,
        target: nodeId,
        animated: true,
        type: vueFlowEdgeTypeForSetting(userStore.edgeStyle),
        style: canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)
      })
    })

    updateNodeData(props.id, { status: 'completed' })
    ElMessage.success(t('canvas.nodeUi.textProcess.genSbOk', { count: storyboardItems.length }))
  } catch (error) {
    updateNodeData(props.id, { status: 'error' })
    ElMessage.error(
      error instanceof Error ? error.message : t('canvas.nodeUi.textProcess.genSbFail')
    )
  } finally {
    generatingStoryboards.value = false
  }
}
</script>

<template>
  <div class="storyboard-template-node-root">
    <Handle type="target" :position="Position.Left" class="handle handle-target" />
    <div class="storyboard-template-node" :class="{ 'is-selected': selected }">
      <div class="node-header">
        <el-icon class="node-type-icon node-type-icon--sb">
          <Tickets />
        </el-icon>
        <span class="node-label">{{ data.label }}</span>
      </div>

      <div class="node-body">
        <div class="template-selector">
          <div class="prompt-chip nodrag nopan disabled">
            <span class="prompt-chip-name">{{
              currentSbPrompt?.title || t('editorWorkshop.step1.pickTplPlaceholder')
            }}</span>
            <span v-if="currentSbPrompt" class="prompt-chip-group">{{
              currentSbPrompt.isCustom ? t('promptsPage.badgeCustom') : t('promptsPage.badgeOfficial')
            }}</span>
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
            :disabled="generatingStoryboards"
            @click="handleGenerateStoryboards"
          >
            <el-icon :class="{ 'is-loading': generatingStoryboards }">
              <Promotion />
            </el-icon>
            <span>{{
              generatingStoryboards
                ? t('canvas.nodeUi.textProcess.genStoryboardsRunning')
                : t('canvas.nodeUi.textProcess.genStoryboards')
            }}</span>
          </button>
        </div>
      </div>

      <div class="node-status" :style="{ backgroundColor: statusColor }" />
    </div>
    <Handle type="source" :position="Position.Right" class="handle handle-source" />
  </div>
</template>

<style scoped>
.storyboard-template-node-root {
  position: relative;
  min-width: 0;
  box-sizing: border-box;
}

.storyboard-template-node {
  min-width: 300px;
  max-width: 300px;
  min-height: 150px;
  background: var(--bg-secondary, #1a1a2e);
  border: 2px solid var(--border-color, #3a3a4a);
  border-radius: 8px;
  overflow: hidden;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  cursor: grab;
}

.storyboard-template-node:hover:not(.is-selected) {
  border-color: rgba(255, 255, 255, 0.58);
  box-shadow: 0 2px 12px rgba(255, 255, 255, 0.07);
}

.storyboard-template-node.is-selected {
  border-color: #409eff;
  box-shadow:
    0 0 0 1px rgba(64, 158, 255, 0.4),
    0 4px 14px rgba(64, 158, 255, 0.22);
}

.storyboard-template-node:active {
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

.node-type-icon--sb {
  color: #67c23a;
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
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
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
