<script setup lang="ts">
import { ref, computed } from 'vue'
import { Check, Plus, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useArtStyleStore, type ArtStyle } from '@/stores/artStyleStore'
import { resolveArtStyleLabel } from '@/utils/artStyleLocale'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const artStyleStore = useArtStyleStore()
const { t } = useI18n()

function artStyleCardLabel(style: ArtStyle) {
  return resolveArtStyleLabel(style, t)
}

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const showAddDialog = ref(false)
const newStyleName = ref('')
const newStylePrompt = ref('')
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const selectedStyleForDelete = ref<ArtStyle | null>(null)

const isCustomStyle = (style: ArtStyle) => !style.preset

const handleSelectStyle = (style: ArtStyle) => {
  artStyleStore.setSelectedStyle(style.value)
  visible.value = false
}

const handleAddStyle = () => {
  newStyleName.value = ''
  newStylePrompt.value = ''
  showAddDialog.value = true
}

const handleConfirmAdd = () => {
  if (!newStyleName.value.trim()) {
    ElMessage.warning(t('canvas.artStyles.needStyleName'))
    return
  }

  const value = 'custom-' + Date.now()
  const newStyle: ArtStyle = {
    value,
    label: newStyleName.value.trim(),
    description: newStylePrompt.value.trim() || newStyleName.value.trim()
  }

  const success = artStyleStore.addStyle(newStyle)
  if (success) {
    ElMessage.success(t('canvas.style.addSuccess'))
    showAddDialog.value = false
  } else {
    ElMessage.error(t('canvas.style.duplicateStyle'))
  }
}

const handleContextMenu = (e: MouseEvent, style: ArtStyle) => {
  if (!isCustomStyle(style)) return

  e.preventDefault()
  selectedStyleForDelete.value = style
  contextMenuPosition.value = { x: e.clientX, y: e.clientY }
  contextMenuVisible.value = true
}

const handleDeleteStyle = async () => {
  if (!selectedStyleForDelete.value) return

  try {
    await ElMessageBox.confirm(
      t('canvas.artStyles.removeNamedConfirm', { label: selectedStyleForDelete.value.label }),
      t('canvas.artStyles.deleteConfirmTitle'),
      {
        confirmButtonText: t('canvas.dialogs.ok'),
        cancelButtonText: t('canvas.dialogs.cancel'),
        type: 'warning',
      }
    )

    const success = artStyleStore.removeStyle(selectedStyleForDelete.value.value)
    if (success) {
      ElMessage.success(t('canvas.artStyles.removeSuccess'))
    }
  } catch {
    // 用户取消
  } finally {
    contextMenuVisible.value = false
    selectedStyleForDelete.value = null
  }
}

const handleCloseContextMenu = () => {
  contextMenuVisible.value = false
  selectedStyleForDelete.value = null
}
</script>

<template>
  <el-dialog
    v-model="visible"
    width="600px"
    :close-on-click-modal="true"
    class="style-select-dialog"
    :show-close="false"
    @close="handleCloseContextMenu"
  >
    <template #header>
      <div class="dialog-header">
        <span class="dialog-title">{{ t('canvas.artStyles.pickTitle') }}</span>
        <el-button
          type="primary"
          size="small"
          :icon="Plus"
          @click="handleAddStyle"
        >
          {{ t('canvas.artStyles.pickAddBtn') }}
        </el-button>
      </div>
    </template>
    
    <div
      class="style-scroll-container"
      @click="handleCloseContextMenu"
    >
      <div class="style-grid">
        <div
          v-for="style in artStyleStore.artStyles"
          :key="style.value"
          :class="['style-card', { selected: artStyleStore.selectedStyle === style.value, 'custom-style': isCustomStyle(style) }]"
          @click="handleSelectStyle(style)"
          @contextmenu="handleContextMenu($event, style)"
        >
          <div class="style-info">
            <span class="style-icon" :class="isCustomStyle(style) ? 'icon-custom' : 'icon-official'">
              {{ isCustomStyle(style) ? '自' : '官' }}
            </span>
            <span class="style-label">{{ artStyleCardLabel(style) }}</span>
            <el-icon
              v-if="artStyleStore.selectedStyle === style.value"
              :size="18"
              color="#06b6d4"
              class="style-check"
            >
              <Check />
            </el-icon>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>

  <el-dialog
    v-model="showAddDialog"
    :title="t('canvas.dialogs.addStyleTitle')"
    width="400px"
    class="add-style-dialog"
  >
    <el-form label-width="80px">
      <el-form-item
        :label="t('canvas.dialogs.styleNameLabel')"
        required
      >
        <el-input
          v-model="newStyleName"
          :placeholder="t('canvas.dialogs.styleNamePh')"
          maxlength="20"
          show-word-limit
        />
      </el-form-item>
      <el-form-item :label="t('canvas.dialogs.styleDescLabel')">
        <el-input
          v-model="newStylePrompt"
          type="textarea"
          :rows="3"
          :placeholder="t('canvas.dialogs.styleDescPh')"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showAddDialog = false">
        {{ t('canvas.dialogs.cancel') }}
      </el-button>
      <el-button
        type="primary"
        @click="handleConfirmAdd"
      >
        {{ t('canvas.dialogs.ok') }}
      </el-button>
    </template>
  </el-dialog>

  <Teleport to="body">
    <div
      v-if="contextMenuVisible"
      class="context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
    >
      <div
        class="context-menu-item delete"
        @click="handleDeleteStyle"
      >
        <el-icon><Delete /></el-icon>
        <span>{{ t('canvas.artStyles.contextDelete') }}</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.style-select-dialog :deep(.el-dialog__header) {
  padding: 16px 20px;
  margin-right: 0;
  border-bottom: 1px solid var(--border-color);
}

.style-select-dialog :deep(.el-dialog__body) {
  padding: 16px 20px;
}

.style-scroll-container {
  height: 650px;
  overflow-y: auto;
  padding: 0 4px;
}

.style-scroll-container::-webkit-scrollbar {
  width: 6px;
}

.style-scroll-container::-webkit-scrollbar-thumb {
  background-color: var(--border-color);
  border-radius: 3px;
}

.style-scroll-container::-webkit-scrollbar-thumb:hover {
  background-color: var(--text-muted);
}

.style-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.style-card {
  border-radius: 8px;
  border: 2px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s;
  background-color: var(--bg-secondary);
  padding: 10px 12px;
}

.style-card:hover {
  border-color: var(--primary-light);
  background-color: rgba(255, 255, 255, 0.05);
}

.style-card.selected {
  border-color: var(--primary-color);
  background-color: rgba(0, 214, 143, 0.1);
}

.style-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.style-icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.style-icon.icon-official {
  background: rgba(59, 130, 246, 0.2);
  color: rgba(96, 165, 250, 1);
}

.style-icon.icon-custom {
  background: rgba(168, 85, 247, 0.2);
  color: rgba(192, 132, 252, 1);
}

.style-label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.style-check {
  flex-shrink: 0;
}

.custom-style {
  position: relative;
}

.context-menu {
  position: fixed;
  z-index: 9999;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 120px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: background-color 0.2s;
}

.context-menu-item:hover {
  background-color: var(--bg-tertiary);
}

.context-menu-item.delete {
  color: #f56c6c;
}

.context-menu-item.delete:hover {
  background-color: rgba(245, 108, 108, 0.1);
}
</style>
