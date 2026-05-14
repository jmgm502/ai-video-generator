<script setup lang="ts">
import { ref, computed } from 'vue'
import { User, Location, Box, Picture, Loading, Refresh, Clock, VideoPlay, Upload, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useStep1Store, type HistoryImage } from '@/stores/step1Store'
import { useApiConfigStore } from '@/stores/apiConfigStore'
import { useI18n } from 'vue-i18n'

interface Asset {
  id: string
  name: string
  description: string
  imageUrl?: string
  status: 'pending' | 'generating' | 'completed' | 'failed'
  historyImages?: HistoryImage[]
  referenceImageUrl?: string
}

interface Props {
  characters: Asset[]
  scenes: Asset[]
  propsAssets: Asset[]
  isExtracting: boolean
  isGenerating: boolean
  selectedChapterCount: number
  activeTab?: 'character' | 'scene' | 'props'
  finalContent?: string
}

const props = withDefaults(defineProps<Props>(), {
  activeTab: 'character',
  finalContent: ''
})

const emit = defineEmits<{
  (e: 'extractAssets', novelText: string): void
  (e: 'generateAssetImage', type: 'character' | 'scene' | 'props', id: string): void
  (e: 'batchGenerate', type: 'character' | 'scene' | 'props', mode: string, indices?: number[]): void
  (e: 'generateStoryboards'): void
  (e: 'update:activeTab', value: 'character' | 'scene' | 'props'): void
}>()

const step1Store = useStep1Store()
const apiConfigStore = useApiConfigStore()
const { t } = useI18n()

const editingAsset = ref<string | null>(null)
const editingField = ref<'name' | 'description' | null>(null)
const editingValue = ref('')

const showHistoryDialog = ref(false)
const historyAssetId = ref<string | null>(null)
const historyAssetType = ref<'character' | 'scene' | 'props'>('character')

const canExtract = computed(() => {
  if (props.finalContent && props.finalContent.trim()) {
    return true
  }
  return props.selectedChapterCount > 0
})

const previewImage = ref<string | null>(null)
const previewPosition = ref({ x: 0, y: 0 })

const showBatchDialog = ref(false)
const batchType = ref<'character' | 'scene' | 'props'>('character')
const batchMode = ref<'all' | 'ungenerated' | 'custom'>('ungenerated')
const customRangeInput = ref('')

const currentAssets = computed(() => {
  if (props.activeTab === 'character') return props.characters
  if (props.activeTab === 'scene') return props.scenes
  return props.propsAssets
})

const totalCount = computed(() => {
  return {
    characters: props.characters.length,
    scenes: props.scenes.length,
    props: props.propsAssets.length
  }
})

const pendingCount = computed(() => {
  const characters = props.characters.filter(a => a.status === 'pending').length
  const scenes = props.scenes.filter(a => a.status === 'pending').length
  const propsCount = props.propsAssets.filter(a => a.status === 'pending').length
  return { characters, scenes, props: propsCount }
})

const currentHistoryImages = computed(() => {
  if (!historyAssetId.value) return []
  const assetList = historyAssetType.value === 'character' ? props.characters 
    : historyAssetType.value === 'scene' ? props.scenes : props.propsAssets
  const asset = assetList.find(a => a.id === historyAssetId.value)
  return asset?.historyImages || []
})

function batchTypeLabel(type: 'character' | 'scene' | 'props') {
  if (type === 'character') return t('editorWorkshop.assetPanel.typeChar')
  if (type === 'scene') return t('editorWorkshop.assetPanel.typeScene')
  return t('editorWorkshop.assetPanel.typeProp')
}

const getAssetIcon = (type: string) => {
  if (type === 'character') return User
  if (type === 'scene') return Location
  return Box
}

const handleDeleteAsset = async (asset: Asset) => {
  try {
    await ElMessageBox.confirm(
      t('editorWorkshop.assetPanel.delConfirm'),
      t('editorWorkshop.assetPanel.delTitle'),
      {
        confirmButtonText: t('editorWorkshop.assetPanel.confirm'),
        cancelButtonText: t('editorWorkshop.assetPanel.cancelBtn'),
        type: 'warning'
      }
    )

    if (props.activeTab === 'character') {
      step1Store.characters = step1Store.characters.filter(c => c.id !== asset.id)
    } else if (props.activeTab === 'scene') {
      step1Store.scenes = step1Store.scenes.filter(s => s.id !== asset.id)
    } else {
      step1Store.props = step1Store.props.filter(p => p.id !== asset.id)
    }
    ElMessage.success(t('editorWorkshop.assetPanel.deleted'))
  } catch {
    // User cancelled
  }
}

const handleGenerateImage = (asset: Asset) => {
  emit('generateAssetImage', props.activeTab, asset.id)
}

const handleRegenerateImage = (asset: Asset) => {
  emit('generateAssetImage', props.activeTab, asset.id)
}

const handleShowHistory = (asset: Asset) => {
  historyAssetId.value = asset.id
  historyAssetType.value = props.activeTab
  showHistoryDialog.value = true
}

const handleSelectHistoryImage = (imageUrl: string) => {
  if (historyAssetId.value) {
    step1Store.setAssetMainImage(historyAssetType.value, historyAssetId.value, imageUrl)
    ElMessage.success(t('editorWorkshop.assetPanel.setMainOk'))
  }
  showHistoryDialog.value = false
}

const openBatchDialog = (type: 'character' | 'scene' | 'props') => {
  const assetList = type === 'character' ? props.characters : type === 'scene' ? props.scenes : props.propsAssets
  if (assetList.length === 0) {
    ElMessage.warning(t('editorWorkshop.assetPanel.noAssetsType', { type: batchTypeLabel(type) }))
    return
  }
  batchType.value = type
  batchMode.value = 'ungenerated'
  customRangeInput.value = ''
  showBatchDialog.value = true
}

const parseRangeInput = (input: string, maxCount: number): number[] => {
  const indices: Set<number> = new Set()
  const parts = input.split(',').map(p => p.trim()).filter(p => p)
  
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(s => s.trim())
      const start = parseInt(startStr)
      const end = parseInt(endStr)
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(maxCount, end); i++) {
          indices.add(i - 1)
        }
      }
    } else {
      const num = parseInt(part)
      if (!isNaN(num) && num >= 1 && num <= maxCount) {
        indices.add(num - 1)
      }
    }
  }
  
  return Array.from(indices).sort((a, b) => a - b)
}

const handleUploadLocalImage = (asset: Asset) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string
        step1Store.setAssetMainImage(props.activeTab, asset.id, imageUrl)
        ElMessage.success(t('editorWorkshop.assetPanel.uploadOk'))
      }
      reader.readAsDataURL(file)
    }
  }
  input.click()
}

const handleSelectReferenceImage = (asset: Asset) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string
        step1Store.setAssetReferenceImage(props.activeTab, asset.id, imageUrl)
        ElMessage.success(t('editorWorkshop.assetPanel.refOk'))
      }
      reader.readAsDataURL(file)
    }
  }
  input.click()
}

const handleConfirmBatchGenerate = () => {
  const assetList = batchType.value === 'character' ? props.characters 
    : batchType.value === 'scene' ? props.scenes : props.propsAssets
  
  let indices: number[] | undefined
  
  if (batchMode.value === 'all') {
    indices = assetList.map((_, i) => i)
  } else if (batchMode.value === 'ungenerated') {
    indices = assetList
      .map((asset, i) => asset.status === 'pending' ? i : -1)
      .filter(i => i >= 0)
  } else if (batchMode.value === 'custom') {
    indices = parseRangeInput(customRangeInput.value, assetList.length)
    if (indices.length === 0) {
      ElMessage.warning(t('editorWorkshop.assetPanel.rangeInvalid'))
      return
    }
  }
  
  if (!indices || indices.length === 0) {
    ElMessage.warning(t('editorWorkshop.assetPanel.noToGen'))
    return
  }
  
  showBatchDialog.value = false
  emit('batchGenerate', batchType.value, batchMode.value, indices)
}

const startEditing = (asset: Asset, field: 'name' | 'description') => {
  editingAsset.value = asset.id
  editingField.value = field
  editingValue.value = field === 'name' ? asset.name : asset.description
}

const finishEditing = () => {
  if (editingAsset.value && editingField.value) {
    const trimmedValue = editingValue.value.trim()
    if (trimmedValue) {
      step1Store.updateAssetInfo(props.activeTab, editingAsset.value, {
        [editingField.value]: trimmedValue
      })
    }
  }
  editingAsset.value = null
  editingField.value = null
  editingValue.value = ''
}

const cancelEditing = () => {
  editingAsset.value = null
  editingField.value = null
  editingValue.value = ''
}

const handleAddAsset = () => {
  const id = `asset_${Date.now()}`
  const newAsset: Asset = {
    id,
    name: '',
    description: '',
    status: 'pending'
  }

  if (props.activeTab === 'character') {
    step1Store.addCharacter(newAsset)
  } else if (props.activeTab === 'scene') {
    step1Store.addScene(newAsset)
  } else {
    step1Store.addProp(newAsset)
  }
}

const handleImageMouseEnter = (imageUrl: string, event: MouseEvent) => {
  previewImage.value = imageUrl
  updatePreviewPosition(event)
}

const handleImageMouseMove = (event: MouseEvent) => {
  updatePreviewPosition(event)
}

const handleImageMouseLeave = () => {
  previewImage.value = null
}

const updatePreviewPosition = (event: MouseEvent) => {
  const x = event.clientX + 20
  const y = event.clientY + 20
  
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight
  const previewWidth = 300
  const previewHeight = 300
  
  previewPosition.value = {
    x: x + previewWidth > windowWidth ? x - previewWidth - 40 : x,
    y: y + previewHeight > windowHeight ? y - previewHeight - 40 : y
  }
}
</script>

<template>
  <div class="asset-extraction-panel">
    <div class="panel-header">
      <div class="header-icon">
        <el-icon :size="20">
          <Picture />
        </el-icon>
      </div>
      <div class="header-text">
        <h3 class="panel-title">
          {{ t('editorWorkshop.assetPanel.sectionTitle') }}
        </h3>
        <p class="panel-desc">
          {{ t('editorWorkshop.assetPanel.sectionDesc') }}
        </p>
      </div>
      <div class="header-actions">
        <el-button
          type="primary"
          class="action-btn"
          :loading="isExtracting"
          :disabled="!canExtract"
          @click="$emit('extractAssets', props.finalContent || '')"
        >
          {{ isExtracting ? t('editorWorkshop.assetPanel.extractLoading') : t('editorWorkshop.assetPanel.extractBtn') }}
        </el-button>
        <el-button
          type="primary"
          class="action-btn"
          :disabled="!canExtract"
          :loading="isGenerating"
          @click="$emit('generateStoryboards')"
        >
          {{ t('editorWorkshop.assetPanel.genSbBtn') }}
        </el-button>
      </div>
    </div>

    <div class="asset-tabs">
      <div
        :class="['tab-item', { active: activeTab === 'character' }]"
        @click="emit('update:activeTab', 'character')"
      >
        <el-icon><User /></el-icon>
        <span>{{ t('editorWorkshop.assetPanel.tabChar') }}</span>
        <el-badge
          v-if="characters.length > 0"
          :value="characters.length"
          type="primary"
        />
      </div>
      <div
        :class="['tab-item', { active: activeTab === 'scene' }]"
        @click="emit('update:activeTab', 'scene')"
      >
        <el-icon><Location /></el-icon>
        <span>{{ t('editorWorkshop.assetPanel.tabScene') }}</span>
        <el-badge
          v-if="scenes.length > 0"
          :value="scenes.length"
          type="primary"
        />
      </div>
      <div
        :class="['tab-item', { active: activeTab === 'props' }]"
        @click="emit('update:activeTab', 'props')"
      >
        <el-icon><Box /></el-icon>
        <span>{{ t('editorWorkshop.assetPanel.tabProp') }}</span>
        <el-badge
          v-if="propsAssets.length > 0"
          :value="propsAssets.length"
          type="primary"
        />
      </div>
    </div>

    <div class="asset-content">
      <div class="asset-list">
        <div
          v-for="asset in currentAssets"
          :key="asset.id"
          class="asset-card"
        >
          <div class="asset-content">
            <div class="asset-left">
              <div
                class="asset-image"
                :class="{ 'has-image': asset.imageUrl }"
                @mouseenter="asset.imageUrl && handleImageMouseEnter(asset.imageUrl, $event)"
                @mousemove="asset.imageUrl && handleImageMouseMove($event)"
                @mouseleave="handleImageMouseLeave"
              >
                <img
                  v-if="asset.imageUrl"
                  :src="asset.imageUrl"
                  :alt="asset.name"
                >
                <div
                  v-else
                  class="image-placeholder"
                >
                  <el-icon :size="32">
                    <Picture />
                  </el-icon>
                </div>
                <div
                  v-if="asset.status === 'generating'"
                  class="image-loading"
                >
                  <el-icon
                    class="rotating"
                    :size="24"
                  >
                    <Loading />
                  </el-icon>
                </div>
              </div>
              <div class="asset-info">
                <div class="asset-header">
                  <div
                    v-if="editingAsset === asset.id && editingField === 'name'"
                    class="edit-input-wrapper name-input"
                  >
                    <el-input
                      ref="nameInputRef"
                      v-model="editingValue"
                      size="small"
                      :placeholder="t('editorWorkshop.assetPanel.namePh')"
                      autofocus
                      @blur="finishEditing"
                      @keyup.enter="finishEditing"
                      @keyup.escape="cancelEditing"
                    />
                  </div>
                  <div
                    v-else
                    class="asset-name"
                    :data-placeholder="t('editorWorkshop.assetPanel.nameEmpty')"
                    @dblclick="startEditing(asset, 'name')"
                  >
                    {{ asset.name || t('editorWorkshop.assetPanel.nameEmpty') }}
                  </div>
                </div>
                <div
                  v-if="editingAsset === asset.id && editingField === 'description'"
                  class="edit-input-wrapper desc-input"
                >
                  <el-input
                    v-model="editingValue"
                    size="small"
                    type="textarea"
                    :rows="2"
                    :placeholder="t('editorWorkshop.assetPanel.descPh')"
                    @blur="finishEditing"
                    @keyup.ctrl.enter="finishEditing"
                    @keyup.escape="cancelEditing"
                  />
                </div>
                <div
                  v-else
                  class="asset-desc"
                  :data-placeholder="t('editorWorkshop.assetPanel.descEmpty')"
                  @dblclick="startEditing(asset, 'description')"
                >
                  {{ asset.description || t('editorWorkshop.assetPanel.descEmpty') }}
                </div>
              </div>
            </div>
            <div class="asset-right">
              <div
                class="reference-image-box"
                @click="handleSelectReferenceImage(asset)"
              >
                <img
                  v-if="asset.referenceImageUrl"
                  :src="asset.referenceImageUrl"
                  :alt="t('editorWorkshop.assetPanel.refAlt')"
                >
                <div
                  v-else
                  class="reference-placeholder"
                >
                  <el-icon :size="24">
                    <Upload />
                  </el-icon>
                  <span>{{ t('editorWorkshop.assetPanel.refLabel') }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="asset-footer">
            <el-tooltip
              :content="t('editorWorkshop.assetPanel.delAsset')"
              placement="top"
            >
              <el-button
                size="small"
                type="danger"
                @click="handleDeleteAsset(asset)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip
              :content="t('editorWorkshop.assetPanel.uploadLocal')"
              placement="top"
            >
              <el-button
                size="small"
                @click="handleUploadLocalImage(asset)"
              >
                <el-icon><Upload /></el-icon>
                <span>{{ t('editorWorkshop.assetPanel.uploadLocal') }}</span>
              </el-button>
            </el-tooltip>
            <el-tooltip
              :content="t('editorWorkshop.assetPanel.historyGen')"
              placement="top"
            >
              <el-button
                size="small"
                :disabled="!asset.historyImages || asset.historyImages.length === 0"
                @click="handleShowHistory(asset)"
              >
                <el-icon><Clock /></el-icon>
                <span>{{ t('editorWorkshop.assetPanel.historyGen') }}</span>
              </el-button>
            </el-tooltip>
            <el-tooltip
              :content="t('editorWorkshop.assetPanel.regen')"
              placement="top"
            >
              <el-button
                size="small"
                :loading="asset.status === 'generating'"
                :disabled="asset.status === 'generating'"
                @click="handleRegenerateImage(asset)"
              >
                <el-icon><Refresh /></el-icon>
                <span>{{ t('editorWorkshop.assetPanel.regen') }}</span>
              </el-button>
            </el-tooltip>
            <el-tooltip
              :content="t('editorWorkshop.assetPanel.genImage')"
              placement="top"
            >
              <el-button
                size="small"
                type="primary"
                :loading="asset.status === 'generating'"
                :disabled="asset.status === 'completed'"
                @click="handleGenerateImage(asset)"
              >
                <el-icon><Picture /></el-icon>
                <span>{{ asset.status === 'completed' ? t('editorWorkshop.assetPanel.genDone') : t('editorWorkshop.assetPanel.genImage') }}</span>
              </el-button>
            </el-tooltip>
          </div>
        </div>

        <div
          class="add-asset-row"
          @click="handleAddAsset"
        >
          <el-icon :size="20">
            <Plus />
          </el-icon>
          <span>{{ t('editorWorkshop.assetPanel.addAsset', { type: batchTypeLabel(activeTab) }) }}</span>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="showHistoryDialog"
      :title="t('editorWorkshop.assetPanel.historyTitle')"
      width="600px"
      destroy-on-close
    >
      <div
        v-if="currentHistoryImages.length === 0"
        class="history-empty"
      >
        <el-icon :size="48">
          <Picture />
        </el-icon>
        <p>{{ t('editorWorkshop.assetPanel.noHistoryImg') }}</p>
      </div>
      <div
        v-else
        class="history-grid"
      >
        <div
          v-for="img in currentHistoryImages"
          :key="img.id"
          class="history-item"
          @click="handleSelectHistoryImage(img.url)"
        >
          <img
            :src="img.url"
            :alt="t('editorWorkshop.assetPanel.historyTitle')"
          >
          <div class="history-overlay">
            <span>{{ t('editorWorkshop.assetPanel.setMain') }}</span>
          </div>
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="showBatchDialog"
      :title="t('editorWorkshop.assetPanel.batchTitle', { type: batchTypeLabel(batchType) })"
      width="450px"
      destroy-on-close
    >
      <div class="batch-generate-dialog">
        <div class="dialog-desc">
          {{
            t('editorWorkshop.assetPanel.batchCountTpl', {
              n: batchType === 'character' ? characters.length : batchType === 'scene' ? scenes.length : propsAssets.length,
              g: (batchType === 'character' ? characters : batchType === 'scene' ? scenes : propsAssets).filter((a) => a.imageUrl).length,
              type: batchTypeLabel(batchType)
            })
          }}
        </div>
        
        <div class="mode-options">
          <div
            :class="['mode-option', { active: batchMode === 'all' }]"
            @click="batchMode = 'all'"
          >
            <div class="option-icon all-icon">
              <el-icon :size="20">
                <VideoPlay />
              </el-icon>
            </div>
            <div class="option-content">
              <div class="option-title">
                {{ t('editorWorkshop.assetPanel.modeAll') }}
              </div>
              <div class="option-desc">
                {{ t('editorWorkshop.assetPanel.modeAllDesc', { type: batchTypeLabel(batchType) }) }}
              </div>
            </div>
            <div
              v-if="batchMode === 'all'"
              class="option-check"
            >
              <el-icon><span style="color: var(--primary-color);">✓</span></el-icon>
            </div>
          </div>
          
          <div
            :class="['mode-option', { active: batchMode === 'ungenerated' }]"
            @click="batchMode = 'ungenerated'"
          >
            <div class="option-icon ungenerated-icon">
              <el-icon :size="20">
                <Loading />
              </el-icon>
            </div>
            <div class="option-content">
              <div class="option-title">
                {{ t('editorWorkshop.assetPanel.modeNew') }}
              </div>
              <div class="option-desc">
                {{ t('editorWorkshop.assetPanel.modeNewDesc') }}
              </div>
            </div>
            <div
              v-if="batchMode === 'ungenerated'"
              class="option-check"
            >
              <el-icon><span style="color: var(--primary-color);">✓</span></el-icon>
            </div>
          </div>
          
          <div
            :class="['mode-option', { active: batchMode === 'custom' }]"
            @click="batchMode = 'custom'"
          >
            <div class="option-icon custom-icon">
              <el-icon :size="20">
                <Picture />
              </el-icon>
            </div>
            <div class="option-content">
              <div class="option-title">
                {{ t('editorWorkshop.assetPanel.modeCustom') }}
              </div>
              <div class="option-desc">
                {{ t('editorWorkshop.assetPanel.modeCustomDesc') }}
              </div>
            </div>
            <div
              v-if="batchMode === 'custom'"
              class="option-check"
            >
              <el-icon><span style="color: var(--primary-color);">✓</span></el-icon>
            </div>
          </div>
        </div>
        
        <div
          v-if="batchMode === 'custom'"
          class="custom-range-input"
        >
          <el-input
            v-model="customRangeInput"
            :placeholder="t('editorWorkshop.assetPanel.indexPh')"
            clearable
          />
          <div class="input-hint">
            {{ t('editorWorkshop.assetPanel.indexHint') }}
          </div>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="showBatchDialog = false">
          {{ t('editorWorkshop.assetPanel.cancel') }}
        </el-button>
        <el-button
          type="primary"
          @click="handleConfirmBatchGenerate"
        >
          {{ t('editorWorkshop.assetPanel.startBatch') }}
        </el-button>
      </template>
    </el-dialog>

    <Teleport to="body">
      <Transition name="preview-fade">
        <div 
          v-if="previewImage" 
          class="image-preview-tooltip"
          :style="{ left: previewPosition.x + 'px', top: previewPosition.y + 'px' }"
        >
          <img
            :src="previewImage"
            :alt="t('editorWorkshop.assetPanel.previewAlt')"
          >
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.asset-extraction-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.header-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
  border-radius: 10px;
  color: #fff;
  flex-shrink: 0;
}

.header-text {
  flex: 1;
  min-width: 150px;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.panel-desc {
  font-size: 12px;
  color: var(--text-muted);
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.action-btn {
  height: 35px;
  padding: 0 16px;
  font-size: 14px;
}

.style-select {
  width: 120px;
}

.style-option {
  font-size: 12px;
}

.asset-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
}

.tab-item:hover {
  color: var(--text-primary);
  background-color: rgba(0, 214, 143, 0.05);
}

.tab-item.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

.asset-content {
  flex: 1;
  overflow-y: auto;
  margin: 10px;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.asset-content::-webkit-scrollbar {
  display: none;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
}

.empty-state p {
  margin-top: 12px;
  font-size: 14px;
}

.empty-asset-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--text-muted);
}

.empty-asset-section p {
  margin: 0;
  font-size: 14px;
}

.add-asset-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 60px;
  background-color: var(--bg-secondary);
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.2s;
  flex-shrink: 0;
}

.add-asset-row:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.empty-hint {
  font-size: 12px !important;
  color: var(--text-muted);
}

.text-input-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.text-input-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.text-input-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.asset-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.asset-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  _padding: 10px;
  background-color: var(--bg-color);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.asset-content {
  display: flex;
  gap: 12px;
}

.asset-left {
  display: flex;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.asset-right {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.reference-image-box {
  width: 150px;
  height: 150px;
  border-radius: 8px;
  border: 2px dashed var(--border-color);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--text-muted);
  transition: all 0.2s;
  overflow: hidden;
}

.reference-image-box:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.reference-image-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reference-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.asset-footer {
  display: flex;
  gap: 8px;
  padding: 0px 10px 10px 10px;
}

.asset-footer .el-button {
  flex: 1;
  height: 35px;
}

.reference-image-upload {
  width: 100%;
  min-height: 200px;
}

.reference-image-preview {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.reference-image-preview img {
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
}

.asset-image {
  width: 270px;
  height: 150px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
  border: 1px solid var(--border-color);
}

.asset-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-tertiary);
  color: var(--text-muted);
}

.image-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  color: #fff;
}

.rotating {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.asset-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 150px;
}

.asset-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
  padding: 3px;
  border-radius: 4px;
}

.asset-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
  width: 100%;
}

.asset-name:hover {
  background-color: rgba(0, 214, 143, 0.1);
}

.asset-name:empty::before,
.asset-desc:empty::before {
  color: var(--text-muted);
  content: attr(data-placeholder);
}

.asset-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.asset-actions .el-button {
  padding: 5px 8px;
  font-size: 12px;
}

.asset-desc {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
  overflow-y: auto;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
  line-height: 1.5;
  border: 1px solid var(--border-color);
}

.asset-desc:hover {
  background-color: rgba(0, 214, 143, 0.1);
}

.edit-input-wrapper {
  flex: 1;
}

.edit-input-wrapper.name-input {
  max-width: 100%;
}

.edit-input-wrapper.desc-input {
  flex: 1;
  display: flex;
}

.edit-input-wrapper.desc-input :deep(.el-textarea) {
  flex: 1;
}

.edit-input-wrapper.desc-input :deep(.el-textarea__inner) {
  height: 100% !important;
  min-height: 100% !important;
  resize: none;
  background-color: var(--bg-tertiary, #1a1a2e) !important;
  color: var(--text-primary, #e0e0e0) !important;
  border-color: var(--border-color, #3a3a4a) !important;
}

.panel-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
}

.pending-info {
  font-size: 12px;
  color: var(--text-secondary);
}

.pending-info span {
  margin-right: 12px;
  color: var(--primary-color);
}

.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--text-muted);
}

.history-empty p {
  margin-top: 12px;
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.history-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.history-item:hover {
  border-color: var(--primary-color);
}

.history-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.history-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.history-item:hover .history-overlay {
  opacity: 1;
}

.history-overlay span {
  color: #fff;
  font-size: 12px;
  font-weight: 500;
}

.asset-image.has-image {
  cursor: pointer;
}

.image-preview-tooltip {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  padding: 8px;
  overflow: hidden;
}

.image-preview-tooltip img {
  height: 400px;
  object-fit: contain;
  border-radius: 4px;
}

.preview-fade-enter-active,
.preview-fade-leave-active {
  transition: opacity 0.15s ease;
}

.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
}

.batch-generate-dialog {
  padding: 0 8px;
}

.dialog-desc {
  text-align: center;
  padding: 12px 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.dialog-desc strong {
  color: var(--primary-color);
  font-size: 16px;
}

.mode-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  border: 2px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s;
}

.mode-option:hover {
  border-color: var(--primary-color);
  background-color: rgba(0, 214, 143, 0.05);
}

.mode-option.active {
  border-color: var(--primary-color);
  background-color: rgba(0, 214, 143, 0.1);
}

.option-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
}

.all-icon {
  background-color: rgba(0, 214, 143, 0.15);
  color: var(--primary-color);
}

.ungenerated-icon {
  background-color: rgba(64, 158, 255, 0.15);
  color: #409eff;
}

.custom-icon {
  background-color: rgba(230, 162, 60, 0.15);
  color: #e6a23c;
}

.option-content {
  flex: 1;
}

.option-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.option-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.option-check {
  color: var(--primary-color);
  font-size: 18px;
}

.custom-range-input {
  margin-top: 16px;
}

.input-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
  line-height: 1.5;
}
</style>
