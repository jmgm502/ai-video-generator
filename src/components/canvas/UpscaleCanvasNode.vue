<script setup lang="ts">
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { computed, ref, onMounted, onUnmounted, inject, type Ref } from 'vue'
import path from 'path-browserify'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  Upload,
  Download,
  MagicStick,
  Loading,
  Check,
  Close,
  Warning,
  Picture
} from '@element-plus/icons-vue'
import { projectFileService } from '@/services/projectFileService'
import { useUserStore } from '@/stores/userStore'
import { useCanvasLodLevel } from '@/composables/useCanvasLodLevel'

const { t, locale } = useI18n()
const userStore = useUserStore()

export interface UpscaleNodeData {
  label: string
  type: string
  status?: 'pending' | 'running' | 'completed' | 'error'
  description?: string
  inputImagePath?: string | null
  outputImagePath?: string | null
  selectedModel?: string
  scale?: string
  format?: 'png' | 'jpg' | 'webp'
  tileSize?: number
  compression?: string
  ttaMode?: boolean
  customWidth?: string
  gpuId?: string
  toolbarExpanded?: boolean
}

interface Props {
  id: string
  data: UpscaleNodeData
  selected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
})

const emit = defineEmits<{
  'update:data': [data: Partial<UpscaleNodeData>]
}>()

const { updateNodeData: rawUpdateNodeData } = useVueFlow()

function updateNodeData(data: Partial<UpscaleNodeData>) {
  rawUpdateNodeData(props.id, data)
  emit('update:data', data)
}

const isAvailable = ref(false)
const processing = ref(false)
const progressText = ref('')
const progressPercent = ref(0)
const comparePosition = ref(50)
const compareSliderRef = ref<HTMLElement | null>(null)
const availableModels = ref<Array<{ id: string; name: string; description: string; scale: string }>>([])
const canvasProjectContext = inject<{ projectId: Ref<string>; projectName: Ref<string>; projectType: Ref<'creative' | 'canvas'> } | null>(
  'canvasProjectContext',
  null
)

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

onMounted(async () => {
  if (window.electronAPI?.upscayl) {
    isAvailable.value = await window.electronAPI.upscayl.checkAvailable()
    availableModels.value = await window.electronAPI.upscayl.getAvailableModels()
  }
})

const isZhLocale = computed(() => String(locale.value || userStore.appLocale || 'zh').toLowerCase().startsWith('zh'))

const selectedModelInfo = computed(() => {
  return availableModels.value.find(m => m.id === props.data.selectedModel) || availableModels.value[0]
})

const isHighScale = computed(() => {
  const scale = parseInt(props.data.scale || '4')
  return scale >= 6
})

const modelDisplayNameMap: Record<string, { zh: string; en: string }> = {
  'upscayl-standard-4x': { zh: '通用标准模型', en: 'Upscayl Standard 4x' },
  'upscayl-lite-4x': { zh: '轻量快速模型', en: 'Upscayl Lite 4x' },
  'high-fidelity-4x': { zh: '高保真模型', en: 'High Fidelity 4x' },
  'remacri-4x': { zh: '锐化增强模型', en: 'Remacri 4x' },
  'ultramix-balanced-4x': { zh: '平衡混合模型', en: 'Ultramix Balanced 4x' },
  'ultrasharp-4x': { zh: '超锐利模型', en: 'Ultrasharp 4x' },
  'digital-art-4x': { zh: '数字艺术/动漫模型', en: 'Digital Art 4x' }
}

function getModelDisplayName(model: { id: string; name: string }): string {
  const mapped = modelDisplayNameMap[model.id]
  if (mapped) return isZhLocale.value ? mapped.zh : mapped.en
  return model.name
}

const handleSelectInputImage = async () => {
  if (!window.electronAPI?.dialog?.openFile) {
    ElMessage.warning('仅在桌面端可用')
    return
  }

  try {
    const result = await window.electronAPI.dialog.openFile({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }]
    })

    if (result && !result.canceled && result.filePaths && result.filePaths[0]) {
      const updateData: Partial<UpscaleNodeData> = {
        inputImagePath: result.filePaths[0],
        status: 'pending'
      }
      
      if (!props.data.selectedModel && availableModels.value.length > 0) {
        updateData.selectedModel = availableModels.value[0].id
      }
      
      if (!props.data.scale) {
        updateData.scale = '4'
      }
      
      if (!props.data.format) {
        updateData.format = 'png'
      }
      
      updateNodeData(updateData)
      ElMessage.success('图片已选择')
    }
  } catch (error) {
    console.error('选择文件失败:', error)
    ElMessage.error('选择文件失败')
  }
}

const handleSaveOutputImage = async () => {
  if (!props.data.outputImagePath) {
    ElMessage.warning('没有可保存的图片')
    return
  }

  if (!window.electronAPI?.dialog?.saveFile) {
    ElMessage.warning('仅在桌面端可用')
    return
  }

  try {
    const result = await window.electronAPI.dialog.saveFile({
      filters: [{ name: 'PNG Image', extensions: ['png'] }]
    })

    if (result && !result.canceled && result.filePath) {
      const copyResult = await window.electronAPI.file.copyFile(props.data.outputImagePath, result.filePath)
      if (copyResult.success) {
        ElMessage.success('图片已保存')
      } else {
        ElMessage.error(copyResult.message || '保存失败')
      }
    }
  } catch (error) {
    console.error('保存文件失败:', error)
    ElMessage.error('保存文件失败')
  }
}

let removeProgressListener: (() => void) | null = null
let compareDragging = false

function updateCompareFromClientX(clientX: number) {
  const slider = compareSliderRef.value
  if (!slider) return
  const rect = slider.getBoundingClientRect()
  if (rect.width <= 0) return
  const pos = ((clientX - rect.left) / rect.width) * 100
  comparePosition.value = Math.min(100, Math.max(0, pos))
}

function onComparePointerDown(event: PointerEvent) {
  if (!props.data.outputImagePath || props.data.status !== 'completed') return
  compareDragging = true
  updateCompareFromClientX(event.clientX)
  const move = (e: PointerEvent) => {
    if (!compareDragging) return
    updateCompareFromClientX(e.clientX)
  }
  const stop = () => {
    compareDragging = false
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
    window.removeEventListener('pointercancel', stop)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop, { once: true })
  window.addEventListener('pointercancel', stop, { once: true })
}

function onComparePointerMove(event: PointerEvent) {
  if (compareDragging) {
    updateCompareFromClientX(event.clientX)
  }
}

const handleStartUpscale = async () => {
  if (!props.data.inputImagePath) {
    ElMessage.warning('请先选择输入图片')
    return
  }

  if (!isAvailable.value) {
    ElMessage.warning('Upscayl 组件暂不可用，请检查')
    return
  }

  if (!props.data.selectedModel) {
    updateNodeData({ selectedModel: availableModels.value[0]?.id })
  }

  if (!window.electronAPI?.upscayl) {
    ElMessage.warning('仅在桌面端可用')
    return
  }

  try {
    const ctx = canvasProjectContext
    if (!ctx) {
      ElMessage.warning('当前无法获取项目目录')
      return
    }
    const pid = ctx.projectId.value
    const pname = String(ctx.projectName.value ?? '').trim()
    if (!pid || !pname) {
      ElMessage.warning('当前无法获取项目目录')
      return
    }
    if (!window.electronAPI?.project?.getPath) {
      ElMessage.warning('当前无法获取项目目录')
      return
    }

    const projectPath = await window.electronAPI.project.getPath(pid, pname, ctx.projectType.value)
    if (!projectPath) {
      ElMessage.warning('当前无法获取项目目录')
      return
    }

    const normalizedInputPath = props.data.inputImagePath.replace(/\\/g, '/')
    const inputFileName = normalizedInputPath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'output'
    const outputFileName = `${inputFileName}_upscayl_${props.data.scale || '4'}x.png`
    const outputPath = path.join(projectPath, 'canvas-media', 'images', outputFileName)

    processing.value = true
    progressText.value = '开始处理...'
    progressPercent.value = 0

    updateNodeData({ status: 'running' })

    const options = {
      inputPath: props.data.inputImagePath,
      outputPath,
      model: props.data.selectedModel || availableModels.value[0]?.id,
      scale: props.data.scale || '4',
      format: props.data.format || 'png',
      gpuId: props.data.gpuId,
      tileSize: props.data.tileSize,
      compression: props.data.compression,
      ttaMode: props.data.ttaMode,
      customWidth: props.data.customWidth
    }

    removeProgressListener = window.electronAPI.upscayl.onProgress((progress: { type: string; message?: string; progress?: number; outputPath?: string }) => {
      if (progress.type === 'progress') {
        progressPercent.value = progress.progress || 0
        progressText.value = progress.message || '处理中...'
      } else if (progress.type === 'scaling') {
        progressText.value = progress.message || '正在缩放和转换...'
      } else if (progress.type === 'error') {
        progressText.value = progress.message || '处理失败'
        processing.value = false
        updateNodeData({ status: 'error' })
        ElMessage.error(progress.message || '处理失败')
        if (removeProgressListener) {
          removeProgressListener()
          removeProgressListener = null
        }
      } else if (progress.type === 'done') {
        progressText.value = '处理完成'
        progressPercent.value = 100
        processing.value = false
        updateNodeData({
          status: 'completed',
          outputImagePath: progress.outputPath || outputPath
        })
        ElMessage.success('图片超分辨率完成')
        if (removeProgressListener) {
          removeProgressListener()
          removeProgressListener = null
        }
      }
    })

    const result2 = await window.electronAPI.upscayl.upscaleImage(options)
    
    if (!result2.success) {
      processing.value = false
      updateNodeData({ status: 'error' })
      ElMessage.error(result2.message || '处理失败')
      if (removeProgressListener) {
        removeProgressListener()
        removeProgressListener = null
      }
    }
  } catch (error) {
    console.error('超分辨率处理失败:', error)
    processing.value = false
    updateNodeData({ status: 'error' })
    ElMessage.error('超分辨率处理失败')
    if (removeProgressListener) {
      removeProgressListener()
      removeProgressListener = null
    }
  }
}

const handleStopUpscale = async () => {
  if (window.electronAPI?.upscayl) {
    await window.electronAPI.upscayl.cancelUpscale()
  }
  processing.value = false
  progressText.value = '已停止'
  updateNodeData({ status: 'pending' })
  if (removeProgressListener) {
    removeProgressListener()
    removeProgressListener = null
  }
}

onUnmounted(() => {
  if (removeProgressListener) {
    removeProgressListener()
    removeProgressListener = null
  }
})
</script>

<template>
  <div class="upscale-node-root">
    <Handle type="target" :position="Position.Left" class="handle handle-target" />
    <div class="upscale-node" :class="{ 'is-selected': selected }">
      <div class="node-header">
        <el-icon class="node-type-icon node-type-icon--upscale"><MagicStick /></el-icon>
        <span class="node-label">{{ data.label || t('canvas.nodeDefaults.upscaleLabel') }}</span>
      </div>

      <div class="node-body nodrag nopan">
        <!-- 鸟瞰模式：简化显示 -->
        <div
          v-if="lodIsShell"
          class="canvas-node-lod-shell nodrag nopan"
        >
          <el-icon class="canvas-node-lod-shell-icon"><MagicStick /></el-icon>
          <div class="canvas-node-lod-shell-lines">
            <span class="canvas-node-lod-shell-title">{{ data.label || t('canvas.nodeDefaults.upscaleLabel') }}</span>
            <span class="canvas-node-lod-shell-sub">
              {{ data.status === 'completed' ? t('upscale.completed') : data.status === 'running' ? t('upscale.processing') : t('upscale.pending') }}
            </span>
          </div>
        </div>

        <!-- 正常模式：完整UI -->
        <template v-else>
        <div v-if="!isAvailable" class="warning-banner">
          <el-icon class="warning-icon"><Close /></el-icon>
          <span>{{ t('upscale.notAvailable') || 'Upscayl 组件不可用' }}</span>
        </div>

        <div class="section upscale-actions-section">
          <div class="upscale-actions-split">
            <div class="upscale-actions-left">
              <div class="section-header section-header--row">
                <div class="section-header-left">
                  <span class="section-title">{{ t('upscale.modelSelect') }}</span>
                </div>
              </div>
              <div class="model-radio-list">
                <button
                  v-for="model in availableModels"
                  :key="model.id"
                  type="button"
                  class="model-radio-item"
                  :class="{ active: props.data.selectedModel === model.id }"
                  :disabled="processing"
                  @click="updateNodeData({ selectedModel: model.id })"
                >
                  <span class="model-radio-dot" />
                  <div class="model-option">
                    <span class="model-name">{{ getModelDisplayName(model) }}</span>
                  </div>
                </button>
              </div>
            </div>

            <div class="upscale-actions-right">
              <div class="settings-grid">
                <div class="setting-item">
                  <div class="setting-label-row">
                    <label class="setting-label">{{ t('upscale.scaleFactor') || '放大倍数' }}</label>
                    <el-tooltip
                      v-if="isHighScale"
                      :content="t('upscale.scaleWarning') || '超过 5X 可能会导致某些设备出现性能问题！'"
                      placement="top"
                    >
                      <el-icon class="scale-warning-icon"><Warning /></el-icon>
                    </el-tooltip>
                  </div>
                  <el-select
                    :model-value="props.data.scale"
                    size="default"
                    class="setting-control"
                    :disabled="processing"
                    @change="(val: string) => updateNodeData({ scale: val })"
                  >
                    <el-option label="2x" value="2" />
                    <el-option label="3x" value="3" />
                    <el-option label="4x" value="4" />
                    <el-option label="5x" value="5" />
                    <el-option label="6x" value="6" />
                    <el-option label="7x" value="7" />
                    <el-option label="8x" value="8" />
                    <el-option label="9x" value="9" />
                    <el-option label="10x" value="10" />
                  </el-select>
                </div>

                <div class="setting-item">
                  <label class="setting-label">{{ t('upscale.outputFormat') || '输出格式' }}</label>
                  <el-select
                    :model-value="props.data.format"
                    size="default"
                    class="setting-control"
                    :disabled="processing"
                    @change="(val: 'png' | 'jpg' | 'webp') => updateNodeData({ format: val })"
                  >
                    <el-option label="PNG" value="png" />
                    <el-option label="JPG" value="jpg" />
                    <el-option label="WebP" value="webp" />
                  </el-select>
                </div>

                <div class="setting-item setting-item-full setting-item--tta-row">
                  <label class="setting-label">{{ t('upscale.ttaMode') || 'TTA 模式' }}</label>
                  <div class="setting-control-column">
                    <div class="setting-control-row">
                      <el-switch
                        :model-value="props.data.ttaMode"
                        :disabled="processing"
                        @change="(val: boolean) => updateNodeData({ ttaMode: val })"
                      />
                      <span class="setting-hint">{{ t('upscale.ttaHint') || '提高质量但速度较慢' }}</span>
                    </div>
                    <el-button
                      type="primary"
                      :disabled="!props.data.inputImagePath || processing"
                      @click="handleStartUpscale"
                      class="start-btn start-btn--inline"
                    >
                      {{ props.data.status === 'completed' ? (t('upscale.reprocess') || '重新处理') : (t('upscale.startUpscale') || '开始超分辨率') }}
                    </el-button>
                    <el-button
                      v-if="data.outputImagePath && data.status === 'completed'"
                      type="success"
                      :icon="Download"
                      @click="handleSaveOutputImage"
                      class="save-btn save-btn--inline"
                    >
                      {{ t('upscale.saveImage') || '保存图片' }}
                    </el-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="processing" class="progress-section">
          <div class="progress-header">
            <el-icon class="rotating"><Loading /></el-icon>
            <span class="progress-text">{{ progressText }}</span>
            <span class="progress-percent">{{ progressPercent }}%</span>
          </div>
          <el-progress
            :percentage="progressPercent"
            :stroke-width="6"
            :show-text="false"
            class="progress-bar"
          />
          <el-button
            type="danger"
            size="small"
            :icon="Close"
            @click="handleStopUpscale"
            class="stop-btn"
          >
            {{ t('upscale.stopProcessing') || '停止处理' }}
          </el-button>
        </div>

        <div v-if="!data.outputImagePath" class="section input-section input-section--bottom">
          <div class="section-body">
            <el-button
              v-if="!data.inputImagePath"
              type="primary"
              :icon="Upload"
              @click="handleSelectInputImage"
              :disabled="processing"
              class="upload-btn"
            >
              <span>{{ t('upscale.selectImage') || '选择图片' }}</span>
            </el-button>
            <div v-else class="image-preview-wrapper">
              <div class="image-preview">
                <img :src="`file://${props.data.inputImagePath}`" :alt="t('upscale.inputImage')" />
                <button
                  type="button"
                  class="replace-image-btn nodrag nopan"
                  :disabled="processing"
                  @click="handleSelectInputImage"
                >
                  <el-icon class="replace-image-icon"><Upload /></el-icon>
                  <span>重新上传</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="data.outputImagePath && data.status === 'completed'" class="output-section">
          <div class="section-header">
            <el-icon class="section-icon success-icon"><Check /></el-icon>
            <span class="section-title">{{ t('upscale.outputImage') || '输出图片' }}</span>
          </div>
          <div class="section-body">
            <div ref="compareSliderRef" class="compare-slider" @pointerdown="onComparePointerDown" @pointermove="onComparePointerMove">
              <img class="compare-image compare-image--base" :src="`file://${props.data.inputImagePath}`" :alt="t('upscale.inputImage')" />
              <div class="compare-image compare-image--processed" :style="{ clipPath: `inset(0 0 0 ${comparePosition}%)` }">
                <img :src="`file://${props.data.outputImagePath}`" :alt="t('upscale.outputImage')" />
              </div>
              <div class="compare-divider" :style="{ left: `${comparePosition}%` }">
                <div class="compare-handle">
                  <span class="compare-arrow">◀</span>
                  <span class="compare-arrow">▶</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        </template>
      </div>

      <div class="node-status" :style="{ backgroundColor: statusColor }" />
    </div>
    <Handle type="source" :position="Position.Right" class="handle handle-source" />
  </div>
</template>

<style scoped>
.upscale-node-root {
  position: relative;
}

.upscale-node {
  position: relative;
  min-width: 420px;
  max-width: 420px;
  min-height: 320px;
  background: var(--bg-secondary, #1a1a2e);
  border: 2px solid var(--border-color, #3a3a4a);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.upscale-node.is-selected {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.4), 0 4px 14px rgba(64, 158, 255, 0.22);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-tertiary, #25253a);
  border-bottom: 1px solid var(--border-color, #3a3a4a);
}

.node-type-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.node-type-icon--upscale {
  color: #67c23a;
}

.node-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.node-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.node-actions {
  display: flex;
  justify-content: center;
  padding: 8px 10px 10px;
  border-top: 1px solid var(--border-color, #3a3a4a);
}

.node-status {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* 鸟瞰模式样式 */
.canvas-node-lod-shell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 180px;
  margin: 0 12px 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  background: rgba(10, 12, 22, 0.45);
  box-sizing: border-box;
}

.canvas-node-lod-shell-icon {
  font-size: 22px;
  color: rgba(180, 200, 255, 0.85);
  flex-shrink: 0;
}

.canvas-node-lod-shell-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.canvas-node-lod-shell-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(240, 244, 255, 0.95);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.canvas-node-lod-shell-sub {
  font-size: 11px;
  color: rgba(180, 192, 220, 0.75);
  line-height: 1.35;
}

.warning-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(244, 67, 54, 0.12);
  border: 1px solid rgba(244, 67, 54, 0.3);
  border-radius: 6px;
  color: #ffcdd2;
  font-size: 12px;
}

.warning-icon {
  color: #ef5350;
  font-size: 14px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
}

.section-icon.success-icon {
  background: rgba(76, 175, 80, 0.15);
  color: #81c784;
}

.section-title {
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  font-weight: 500;
}

.section-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.upload-btn {
  width: 100%;
  height: 100px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  font-size: 13px;
}

.upload-btn:hover {
  border-color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.08);
}

.image-preview-wrapper {
  width: 100%;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.15);
}

.image-preview {
  position: relative;
  width: 100%;
}

.image-preview img {
  width: 100%;
  height: auto;
  max-height: none;
  object-fit: contain;
  display: block;
}

.replace-image-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: rgba(248, 250, 255, 0.95);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18);
}

.replace-image-btn:hover {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(255, 255, 255, 0.28);
  transform: translateY(-1px);
}

.replace-image-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
}

.replace-image-icon {
  font-size: 14px;
}

.model-radio-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-radio-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 4px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  cursor: pointer;
  text-align: left;
  line-height: 17px;
}

.model-radio-item.active {
  border-color: rgba(64, 158, 255, 0.55);
  background: rgba(64, 158, 255, 0.12);
}

.model-radio-item:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.model-radio-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-top: 2px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
}

.model-radio-item.active .model-radio-dot {
  border-color: #409eff;
  background: #409eff;
}

.model-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.model-name {
  font-size: 12px;
}

.model-desc {
  font-size: 11px;
  color: rgba(180, 192, 220, 0.82);
}

.upscale-actions-section {
  padding: 5px;
}

.upscale-actions-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}

.upscale-actions-left,
.upscale-actions-right {
  min-width: 0;
}

.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-item-full {
  grid-column: 1 / -1;
}

.setting-label {
  color: rgba(255, 255, 255, 0.65);
  font-size: 11px;
  font-weight: 500;
}

.setting-control {
  width: 100%;
}

.setting-control-column {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.setting-control-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.start-btn--inline,
.save-btn--inline {
  width: 100%;
  margin-left: 0 !important;
}

.save-action-wrap {
  width: 100%;
}

.setting-hint {
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
}

.setting-label-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.scale-warning-icon {
  color: #ff9800;
  font-size: 14px;
  cursor: pointer;
}

.scale-warning-icon:hover {
  color: #ffb74d;
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.progress-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rotating {
  animation: icon-spin 1s linear infinite;
  color: #409eff;
  font-size: 14px;
}

.progress-text {
  flex: 1;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.progress-percent {
  color: #409eff;
  font-size: 12px;
  font-weight: 600;
}

.progress-bar {
  width: 100%;
}

.stop-btn {
  width: 100%;
}

.output-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compare-slider {
  position: relative;
  width: 100%;
  min-height: 180px;
  overflow: hidden;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.16);
  cursor: ew-resize;
  touch-action: none;
}

.compare-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.compare-image--base {
  z-index: 1;
  position: relative;
}

.compare-image--processed {
  z-index: 2;
  overflow: hidden;
}

.compare-image--processed img,
.compare-image--base {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.compare-divider {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(255, 255, 255, 0.85);
  z-index: 3;
  transform: translateX(-1px);
}

.compare-handle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(17, 24, 39, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.26);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  font-size: 10px;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);
  pointer-events: none;
}

.save-btn {
  width: 100%;
}

.start-btn {
  width: 100%;
  height: 36px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
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

@keyframes icon-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

<style>
:deep(.el-progress__bar) {
  border-radius: 3px;
}

:deep(.el-switch) {
  --el-switch-on-color: #67c23a;
}

:deep(.el-select .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.1) !important;
  box-shadow: none !important;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
}

:deep(.el-select .el-input__wrapper:hover) {
  border-color: rgba(255, 255, 255, 0.3);
}

:deep(.el-select .el-input__wrapper.is-focus) {
  border-color: rgba(255, 255, 255, 0.5);
}

:deep(.el-select .el-input__inner) {
  color: white !important;
  font-size: 13px;
}

:deep(.el-select .el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.5) !important;
}

:deep(.el-button) {
  border: none;
}
</style>
