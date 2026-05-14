<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Close } from '@element-plus/icons-vue'
import { usePromptsStore } from '@/stores/promptsStore'
import { useCanvasNodeCommon } from '@/composables/useCanvasNodeUiI18n'
import { useUserStore } from '@/stores/userStore'

const CHAR_DEFAULT = '5'
const SCENE_DEFAULT = '6'
const PROPS_DEFAULT = '7'
const SB_DEFAULT = '8'
const VID_DEFAULT = '9'
const ASSET_EXTRACT_DEFAULT = '1'
const STORYBOARD_GEN_DEFAULT = '3'

const props = defineProps<{
  visible: boolean
  characterAssetTemplateId: string | undefined | null
  sceneAssetTemplateId: string | undefined | null
  propsAssetTemplateId: string | undefined | null
  storyboardTemplateId: string | undefined | null
  videoTemplateId: string | undefined | null
  assetExtractTemplateId: string | undefined | null
  storyboardGenTemplateId: string | undefined | null
  storyboardGridFormat: string | undefined | null
}>()

const emit = defineEmits<{
  'update:visible': [boolean]
  'update:characterAssetTemplateId': [string]
  'update:sceneAssetTemplateId': [string]
  'update:propsAssetTemplateId': [string]
  'update:storyboardTemplateId': [string]
  'update:videoTemplateId': [string]
  'update:assetExtractTemplateId': [string]
  'update:storyboardGenTemplateId': [string]
  'update:storyboardGridFormat': [string]
}>()

const { t } = useCanvasNodeCommon()
const promptsStore = usePromptsStore()
const userStore = useUserStore()

const charPopoverVisible = ref(false)
const scenePopoverVisible = ref(false)
const propsPopoverVisible = ref(false)
const sbPopoverVisible = ref(false)
const vidPopoverVisible = ref(false)
const assetExtractPopoverVisible = ref(false)
const storyboardGenPopoverVisible = ref(false)
const storyboardGridPopoverVisible = ref(false)
const storyboardGridBlockedMessageVisible = ref(false)

function getGridConfig(format: string): { rows: number; cols: number } {
  switch (format) {
    case 'single':
      return { rows: 1, cols: 1 }
    case '4grid':
      return { rows: 2, cols: 2 }
    case '6grid':
      return { rows: 2, cols: 3 }
    case '9grid':
      return { rows: 3, cols: 3 }
    case '16grid':
      return { rows: 4, cols: 4 }
    case '25grid':
      return { rows: 5, cols: 5 }
    default:
      return { rows: 2, cols: 2 }
  }
}

const gridFormatOptions = computed(() => [
  { value: 'single', label: t('editorWorkshop.step2.grid1') },
  { value: '4grid', label: t('editorWorkshop.step2.grid4') },
  { value: '6grid', label: t('editorWorkshop.step2.grid6') },
  { value: '9grid', label: t('editorWorkshop.step2.grid9') },
  { value: '16grid', label: t('editorWorkshop.step2.grid16') },
  { value: '25grid', label: t('editorWorkshop.step2.grid25') }
])

const currentGridFormatLabel = computed(() => {
  const option = gridFormatOptions.value.find(o => o.value === (props.storyboardGridFormat || '4grid'))
  return option?.label || ''
})

const charPrompts = computed(() => promptsStore.getSubCategoryPrompts('generate-character'))
const scenePrompts = computed(() => promptsStore.getSubCategoryPrompts('generate-scene'))
const propsPrompts = computed(() => promptsStore.getSubCategoryPrompts('generate-props'))
const sbPrompts = computed(() => promptsStore.getSubCategoryPrompts('generate-storyboard-image'))
const vidPrompts = computed(() => promptsStore.getSubCategoryPrompts('generate-video'))
const assetExtractPrompts = computed(() => promptsStore.getSubCategoryPrompts('extract-assets'))
const storyboardGenPrompts = computed(() => promptsStore.getSubCategoryPrompts('generate-storyboard'))

const charActiveId = computed(() => props.characterAssetTemplateId ?? CHAR_DEFAULT)
const sceneActiveId = computed(() => props.sceneAssetTemplateId ?? SCENE_DEFAULT)
const propsActiveId = computed(() => props.propsAssetTemplateId ?? PROPS_DEFAULT)
const sbActiveId = computed(() => props.storyboardTemplateId ?? SB_DEFAULT)
const vidActiveId = computed(() => props.videoTemplateId ?? VID_DEFAULT)
const assetExtractActiveId = computed(() => props.assetExtractTemplateId ?? ASSET_EXTRACT_DEFAULT)
const storyboardGenActiveId = computed(() => props.storyboardGenTemplateId ?? STORYBOARD_GEN_DEFAULT)

const currentCharPrompt = computed(() => charPrompts.value.find((p) => p.id === charActiveId.value))
const currentScenePrompt = computed(() => scenePrompts.value.find((p) => p.id === sceneActiveId.value))
const currentPropsPrompt = computed(() => propsPrompts.value.find((p) => p.id === propsActiveId.value))
const currentSbPrompt = computed(() => sbPrompts.value.find((p) => p.id === sbActiveId.value))
const currentVidPrompt = computed(() => vidPrompts.value.find((p) => p.id === vidActiveId.value))
const currentAssetExtractPrompt = computed(() => assetExtractPrompts.value.find((p) => p.id === assetExtractActiveId.value))
const currentStoryboardGenPrompt = computed(() => storyboardGenPrompts.value.find((p) => p.id === storyboardGenActiveId.value))

function badgeLabel(isCustom: boolean) {
  return isCustom ? t('promptsPage.badgeCustom') : t('promptsPage.badgeOfficial')
}

function close() {
  emit('update:visible', false)
}

function handleGridFormatClick() {
  if (userStore.enableCinemaStoryboard) {
    storyboardGridBlockedMessageVisible.value = true
    window.setTimeout(() => {
      storyboardGridBlockedMessageVisible.value = false
    }, 1800)
    return
  }
  storyboardGridPopoverVisible.value = true
}

function pickChar(id: string) {
  emit('update:characterAssetTemplateId', id)
  charPopoverVisible.value = false
}

function pickScene(id: string) {
  emit('update:sceneAssetTemplateId', id)
  scenePopoverVisible.value = false
}

function pickPropsTpl(id: string) {
  emit('update:propsAssetTemplateId', id)
  propsPopoverVisible.value = false
}

function pickSb(id: string) {
  emit('update:storyboardTemplateId', id)
  sbPopoverVisible.value = false
}

function pickVid(id: string) {
  emit('update:videoTemplateId', id)
  vidPopoverVisible.value = false
}

function pickAssetExtract(id: string) {
  emit('update:assetExtractTemplateId', id)
  assetExtractPopoverVisible.value = false
}

function pickStoryboardGen(id: string) {
  emit('update:storyboardGenTemplateId', id)
  storyboardGenPopoverVisible.value = false
}
</script>

<template>
  <Teleport to="body">
    <div class="canvas-param-tele-root">
      <div
        class="canvas-param-mask"
        :class="{ 'canvas-param-mask--show': visible }"
        aria-hidden="true"
        @click="close"
      />
      <aside
        class="canvas-param-panel"
        :class="{ 'canvas-param-panel--open': visible }"
        role="dialog"
        :aria-label="t('canvas.header.paramDrawerTitle')"
      >
        <header class="canvas-param-panel-head">
          <span class="canvas-param-panel-title">{{ t('canvas.header.paramDrawerTitle') }}</span>
          <button type="button" class="canvas-param-panel-close nodrag nopan" @click="close">
            <el-icon><Close /></el-icon>
          </button>
        </header>

        <div class="canvas-param-panel-body">
      <!-- 文字模型组 -->
      <section class="canvas-param-section">
        <div class="canvas-param-section-label">{{ t('canvas.paramGroup.textModel') }}</div>
        <div class="canvas-param-template-grid">
          <div class="canvas-param-template-selector">
            <div class="prompt-above-label">{{ t('canvas.nodeUi.textProcess.pickTplExtractAssets') }}</div>
            <el-popover
              v-model:visible="assetExtractPopoverVisible"
              placement="bottom-start"
              :width="275"
              trigger="click"
              popper-class="asset-prompt-popover"
            >
              <template #reference>
                <button type="button" class="canvas-param-prompt-chip nodrag nopan">
                  <span class="canvas-param-prompt-chip-name">{{
                    currentAssetExtractPrompt?.title ?? t('editorWorkshop.step1.pickTplPlaceholder')
                  }}</span>
                  <span v-if="currentAssetExtractPrompt" class="canvas-param-prompt-chip-group">{{
                    badgeLabel(currentAssetExtractPrompt.isCustom)
                  }}</span>
                </button>
              </template>
              <div class="prompt-panel">
                <div class="prompt-group extract-grid">
                  <button
                    v-for="p in assetExtractPrompts"
                    :key="p.id"
                    type="button"
                    class="prompt-btn"
                    :class="{ active: assetExtractActiveId === p.id }"
                    @click="pickAssetExtract(p.id)"
                  >
                    <span class="prompt-btn-icon" :class="p.isCustom ? 'icon-custom' : 'icon-official'">
                      {{ p.isCustom ? '自' : '官' }}
                    </span>
                    <span class="prompt-btn-text">{{ p.title }}</span>
                  </button>
                </div>
              </div>
            </el-popover>
          </div>
          <div class="canvas-param-template-selector">
            <div class="prompt-above-label">{{ t('canvas.nodeUi.textProcess.pickTplGenStoryboard') }}</div>
            <el-popover
              v-model:visible="storyboardGenPopoverVisible"
              placement="bottom-start"
              :width="275"
              trigger="click"
              popper-class="asset-prompt-popover"
            >
              <template #reference>
                <button type="button" class="canvas-param-prompt-chip nodrag nopan">
                  <span class="canvas-param-prompt-chip-name">{{
                    currentStoryboardGenPrompt?.title ?? t('editorWorkshop.step1.pickTplPlaceholder')
                  }}</span>
                  <span v-if="currentStoryboardGenPrompt" class="canvas-param-prompt-chip-group">{{
                    badgeLabel(currentStoryboardGenPrompt.isCustom)
                  }}</span>
                </button>
              </template>
              <div class="prompt-panel">
                <div class="prompt-group extract-grid">
                  <button
                    v-for="p in storyboardGenPrompts"
                    :key="p.id"
                    type="button"
                    class="prompt-btn"
                    :class="{ active: storyboardGenActiveId === p.id }"
                    @click="pickStoryboardGen(p.id)"
                  >
                    <span class="prompt-btn-icon" :class="p.isCustom ? 'icon-custom' : 'icon-official'">
                      {{ p.isCustom ? '自' : '官' }}
                    </span>
                    <span class="prompt-btn-text">{{ p.title }}</span>
                  </button>
                </div>
              </div>
            </el-popover>
          </div>
        </div>
      </section>

      <!-- 图片模型组 -->
      <section class="canvas-param-section">
        <div class="canvas-param-section-label">{{ t('canvas.paramGroup.imageModel') }}</div>
        <div class="canvas-param-template-grid">
          <div class="canvas-param-template-selector">
            <div class="prompt-above-label">{{ t('editorWorkshop.step1.pickTplGenCharacter') }}</div>
            <el-popover
              v-model:visible="charPopoverVisible"
              placement="bottom-start"
              :width="275"
              trigger="click"
              popper-class="asset-prompt-popover"
            >
              <template #reference>
                <button type="button" class="canvas-param-prompt-chip nodrag nopan">
                  <span class="canvas-param-prompt-chip-name">{{
                    currentCharPrompt?.title ?? t('editorWorkshop.step1.pickTplPlaceholder')
                  }}</span>
                  <span v-if="currentCharPrompt" class="canvas-param-prompt-chip-group">{{
                    badgeLabel(currentCharPrompt.isCustom)
                  }}</span>
                </button>
              </template>
              <div class="prompt-panel">
                <div class="prompt-group">
                  <button
                    v-for="p in charPrompts"
                    :key="p.id"
                    type="button"
                    class="prompt-btn"
                    :class="{ active: charActiveId === p.id }"
                    @click="pickChar(p.id)"
                  >
                    <span class="prompt-btn-icon" :class="p.isCustom ? 'icon-custom' : 'icon-official'">
                      {{ p.isCustom ? '自' : '官' }}
                    </span>
                    <span class="prompt-btn-text">{{ p.title }}</span>
                  </button>
                </div>
              </div>
            </el-popover>
          </div>
          <div class="canvas-param-template-selector">
            <div class="prompt-above-label">{{ t('editorWorkshop.step1.pickTplGenScene') }}</div>
            <el-popover
              v-model:visible="scenePopoverVisible"
              placement="bottom-start"
              :width="275"
              trigger="click"
              popper-class="asset-prompt-popover"
            >
              <template #reference>
                <button type="button" class="canvas-param-prompt-chip nodrag nopan">
                  <span class="canvas-param-prompt-chip-name">{{
                    currentScenePrompt?.title ?? t('editorWorkshop.step1.pickTplPlaceholder')
                  }}</span>
                  <span v-if="currentScenePrompt" class="canvas-param-prompt-chip-group">{{
                    badgeLabel(currentScenePrompt.isCustom)
                  }}</span>
                </button>
              </template>
              <div class="prompt-panel">
                <div class="prompt-group">
                  <button
                    v-for="p in scenePrompts"
                    :key="p.id"
                    type="button"
                    class="prompt-btn"
                    :class="{ active: sceneActiveId === p.id }"
                    @click="pickScene(p.id)"
                  >
                    <span class="prompt-btn-icon" :class="p.isCustom ? 'icon-custom' : 'icon-official'">
                      {{ p.isCustom ? '自' : '官' }}
                    </span>
                    <span class="prompt-btn-text">{{ p.title }}</span>
                  </button>
                </div>
              </div>
            </el-popover>
          </div>
          <div class="canvas-param-template-selector">
            <div class="prompt-above-label">{{ t('editorWorkshop.step1.pickTplGenProps') }}</div>
            <el-popover
              v-model:visible="propsPopoverVisible"
              placement="bottom-start"
              :width="275"
              trigger="click"
              popper-class="asset-prompt-popover"
            >
              <template #reference>
                <button type="button" class="canvas-param-prompt-chip nodrag nopan">
                  <span class="canvas-param-prompt-chip-name">{{
                    currentPropsPrompt?.title ?? t('editorWorkshop.step1.pickTplPlaceholder')
                  }}</span>
                  <span v-if="currentPropsPrompt" class="canvas-param-prompt-chip-group">{{
                    badgeLabel(currentPropsPrompt.isCustom)
                  }}</span>
                </button>
              </template>
              <div class="prompt-panel">
                <div class="prompt-group">
                  <button
                    v-for="p in propsPrompts"
                    :key="p.id"
                    type="button"
                    class="prompt-btn"
                    :class="{ active: propsActiveId === p.id }"
                    @click="pickPropsTpl(p.id)"
                  >
                    <span class="prompt-btn-icon" :class="p.isCustom ? 'icon-custom' : 'icon-official'">
                      {{ p.isCustom ? '自' : '官' }}
                    </span>
                    <span class="prompt-btn-text">{{ p.title }}</span>
                  </button>
                </div>
              </div>
            </el-popover>
          </div>
          <div class="canvas-param-template-selector">
            <div class="prompt-above-label">{{ t('editorWorkshop.step2.pickTplSbImg') }}</div>
            <el-popover
              v-model:visible="sbPopoverVisible"
              placement="bottom-start"
              :width="275"
              trigger="click"
              popper-class="asset-prompt-popover"
            >
              <template #reference>
                <button type="button" class="canvas-param-prompt-chip nodrag nopan">
                  <span class="canvas-param-prompt-chip-name">{{
                    currentSbPrompt?.title ?? t('editorWorkshop.step1.pickTplPlaceholder')
                  }}</span>
                  <span v-if="currentSbPrompt" class="canvas-param-prompt-chip-group">{{
                    badgeLabel(currentSbPrompt.isCustom)
                  }}</span>
                </button>
              </template>
              <div class="prompt-panel">
                <div class="prompt-group">
                  <button
                    v-for="p in sbPrompts"
                    :key="p.id"
                    type="button"
                    class="prompt-btn"
                    :class="{ active: sbActiveId === p.id }"
                    @click="pickSb(p.id)"
                  >
                    <span class="prompt-btn-icon" :class="p.isCustom ? 'icon-custom' : 'icon-official'">
                      {{ p.isCustom ? '自' : '官' }}
                    </span>
                    <span class="prompt-btn-text">{{ p.title }}</span>
                  </button>
                </div>
              </div>
            </el-popover>
          </div>
        </div>
      </section>

      <!-- 视频模型组 -->
      <section class="canvas-param-section">
        <div class="canvas-param-section-label">{{ t('canvas.paramGroup.videoModel') }}</div>
        <div class="canvas-param-template-grid">
          <div class="canvas-param-template-selector">
            <div class="prompt-above-label">{{ t('editorWorkshop.step2.pickTplVideoGen') }}</div>
            <el-popover
              v-model:visible="vidPopoverVisible"
              placement="bottom-start"
              :width="275"
              trigger="click"
              popper-class="asset-prompt-popover"
            >
              <template #reference>
                <button type="button" class="canvas-param-prompt-chip nodrag nopan">
                  <span class="canvas-param-prompt-chip-name">{{
                    currentVidPrompt?.title ?? t('editorWorkshop.step1.pickTplPlaceholder')
                  }}</span>
                  <span v-if="currentVidPrompt" class="canvas-param-prompt-chip-group">{{
                    badgeLabel(currentVidPrompt.isCustom)
                  }}</span>
                </button>
              </template>
              <div class="prompt-panel">
                <div class="prompt-group">
                  <button
                    v-for="p in vidPrompts"
                    :key="p.id"
                    type="button"
                    class="prompt-btn"
                    :class="{ active: vidActiveId === p.id }"
                    @click="pickVid(p.id)"
                  >
                    <span class="prompt-btn-icon" :class="p.isCustom ? 'icon-custom' : 'icon-official'">
                      {{ p.isCustom ? '自' : '官' }}
                    </span>
                    <span class="prompt-btn-text">{{ p.title }}</span>
                  </button>
                </div>
              </div>
            </el-popover>
          </div>
        </div>
      </section>

      <!-- 宫格格式 + 电影故事版 + 自动保存间隔 + 鸟瞰模式 -->
      <section class="canvas-param-section canvas-param-inline-settings">
        <div class="inline-settings-row">
          <div class="inline-settings-item inline-settings-item--story">
            <div class="story-mode-card" :class="{ 'is-on': userStore.enableCinemaStoryboard }">
              <div class="story-mode-card-top">
                <div class="story-mode-title-wrap">
                  <div class="story-mode-title">电影故事版</div>
                  <div class="story-mode-subtitle">非宫格叙事模式</div>
                </div>
                <el-switch
                  v-model="userStore.enableCinemaStoryboard"
                  size="large"
                  inline-prompt
                  active-text="开"
                  inactive-text="关"
                  class="story-mode-switch"
                />
              </div>
            </div>
          </div>

          <div class="inline-settings-item inline-settings-item--grid" :class="{ 'is-disabled': userStore.enableCinemaStoryboard }">
            <div class="inline-settings-label">默认宫格格式</div>
            <el-popover
              v-model:visible="storyboardGridPopoverVisible"
              placement="bottom-start"
              :width="200"
              trigger="manual"
              popper-class="storyboard-format-popover"
            >
              <template #reference>
                <button
                  type="button"
                  class="format-chip nodrag nopan"
                  :class="{ 'is-disabled': userStore.enableCinemaStoryboard }"
                  :disabled="userStore.enableCinemaStoryboard"
                  @click.stop.prevent="handleGridFormatClick"
                >
                  <span class="format-chip-name">{{ currentGridFormatLabel }}</span>
                </button>
              </template>
              <div class="format-panel">
                <div class="format-group format-group--two-cols">
                  <button
                    v-for="format in gridFormatOptions"
                    :key="format.value"
                    type="button"
                    class="format-btn"
                    :class="{ active: (props.storyboardGridFormat || '4grid') === format.value }"
                    @click="emit('update:storyboardGridFormat', format.value); storyboardGridPopoverVisible = false"
                  >
                    <span class="format-btn-text">{{ format.label }}</span>
                  </button>
                </div>
              </div>
            </el-popover>
            <div v-if="storyboardGridBlockedMessageVisible" class="story-grid-blocked-tip">
              请关闭电影故事版模式
            </div>
          </div>
        </div>

        <div class="inline-settings-row inline-settings-row--bottom">
          <div class="inline-settings-item inline-settings-item--autosave">
            <div class="inline-settings-label">自动保存间隔</div>
            <div class="slider-row">
              <el-slider
                v-model="userStore.autoSaveInterval"
                :min="5"
                :max="300"
                :step="5"
                :show-tooltip="true"
                :format-tooltip="(val: number) => `${val}秒`"
              />
              <span class="slider-value">{{ userStore.autoSaveInterval }} 秒</span>
            </div>
          </div>

          <div class="inline-settings-item inline-settings-item--lod">
            <div class="inline-settings-label">进入鸟瞰模式阈值</div>
            <div class="slider-row">
              <el-slider
                v-model="userStore.canvasLodShellZoomThreshold"
                :min="0.1"
                :max="0.9"
                :step="0.05"
                :show-tooltip="true"
                :format-tooltip="(val: number) => `${(val * 100).toFixed(0)}%`"
              />
              <span class="slider-value">{{ (userStore.canvasLodShellZoomThreshold * 100).toFixed(0) }}%</span>
            </div>
          </div>
        </div>
      </section>
    </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.canvas-param-tele-root {
  position: fixed;
  inset: 0;
  z-index: 2998;
  pointer-events: none;
}

.canvas-param-inline-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inline-settings-row {
  display: flex;
  gap: 12px;
}

.story-mode-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(26, 29, 39, 0.96), rgba(18, 20, 28, 0.96));
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
}

.story-mode-card.is-on {
  border-color: rgba(59, 130, 246, 0.45);
  box-shadow: 0 10px 26px rgba(59, 130, 246, 0.14);
}

.story-mode-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.story-mode-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.story-mode-title {
  font-size: 16px;
  font-weight: 700;
  color: rgba(248, 250, 255, 0.98);
  letter-spacing: 0.2px;
}

.story-mode-subtitle {
  font-size: 11px;
  color: rgba(142, 154, 179, 0.9);
}


.story-mode-switch {
  flex-shrink: 0;
  margin-top: 1px;
}

.inline-settings-item--grid {
  position: relative;
}

.inline-settings-item--grid.is-disabled {
  opacity: 0.7;
}

.story-grid-blocked-tip {
  margin-top: 6px;
  font-size: 11px;
  color: rgba(248, 113, 113, 0.95);
}

.inline-settings-item--grid .format-chip {
  width: 100%;
  justify-content: space-between;
}

.inline-settings-item--grid .format-chip.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.inline-settings-item--grid .format-chip.is-disabled:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.inline-settings-item--story {
  min-width: 0;
}

.inline-settings-item--autosave,
.inline-settings-item--lod {
  min-width: 0;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.inline-settings-row--bottom {
  margin-top: 2px;
}

.inline-settings-item {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.story-mode-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(27, 31, 45, 0.96) 0%, rgba(20, 23, 34, 0.96) 100%);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  padding: 14px 14px 12px;
  transition: all 0.22s ease;
}

.story-mode-card.is-on {
  border-color: rgba(96, 165, 250, 0.32);
  box-shadow: 0 12px 28px rgba(59, 130, 246, 0.18);
  background: linear-gradient(180deg, rgba(28, 37, 63, 0.98) 0%, rgba(18, 22, 35, 0.98) 100%);
}

.story-mode-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.story-mode-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.story-mode-title {
  font-size: 14px;
  font-weight: 700;
  color: rgba(248, 250, 255, 0.96);
  letter-spacing: 0.2px;
}

.story-mode-subtitle {
  font-size: 11px;
  color: rgba(142, 154, 179, 0.92);
}

.story-mode-switch {
  flex-shrink: 0;
}


.inline-settings-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(180, 192, 220, 0.88);
}

.inline-settings-item--grid .format-chip {
  width: 100%;
  justify-content: space-between;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider-row :deep(.el-slider) {
  flex: 1;
}

.slider-value {
  min-width: 52px;
  text-align: right;
  font-size: 12px;
  font-weight: 600;
  color: rgba(248, 250, 255, 0.95);
}

.inline-settings-item--autosave .slider-row,
.inline-settings-item--lod .slider-row {
  justify-content: flex-start;
}

.format-chip {
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
  box-sizing: border-box;
}

.format-chip:hover {
  border-color: rgba(255, 255, 255, 0.22);
}

.format-chip.is-disabled,
.inline-settings-item--grid.is-disabled .format-chip {
  cursor: not-allowed;
  opacity: 0.5;
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}
</style>

<style>
:deep(.story-mode-switch.el-switch) {
  --el-switch-on-color: #3b82f6;
  --el-switch-off-color: rgba(255, 255, 255, 0.14);
  --el-switch-border-color: rgba(255, 255, 255, 0.14);
}

:deep(.story-mode-switch .el-switch__core) {
  height: 24px;
  min-width: 48px;
  border-radius: 999px;
}

:deep(.story-mode-switch .el-switch__action) {
  width: 18px;
  height: 18px;
}

:deep(.story-mode-switch.is-checked .el-switch__core) {
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.25);
}

.storyboard-format-popover {
  background: #101114;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
}

.storyboard-format-popover .format-panel {
  padding: 8px;
}

.storyboard-format-popover .format-panel-label {
  font-size: 11px;
  color: rgba(142, 154, 179, 0.9);
  margin-bottom: 6px;
  padding-left: 4px;
}

.storyboard-format-popover .format-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.storyboard-format-popover .format-group.format-group--two-cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.storyboard-format-popover .format-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: rgba(248, 250, 255, 0.9);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  box-sizing: border-box;
}

.storyboard-format-popover .format-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.storyboard-format-popover .format-btn.active {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.5);
  color: rgba(96, 165, 250, 1);
}

.canvas-param-mask {
  position: fixed;
  inset: 0;
  z-index: 2999;
  background: rgba(0, 0, 0, 0.42);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s ease;
}

.canvas-param-mask--show {
  opacity: 1;
  pointer-events: auto;
}

.canvas-param-panel {
  position: fixed;
  top: 48px;
  right: 0;
  bottom: 0;
  width: min(480px, 92vw);
  z-index: 3000;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #161821 0%, #12141c 100%);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: -12px 0 40px rgba(0, 0, 0, 0.45);
  transform: translateX(100%);
  transition:
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    visibility 0.28s;
  visibility: hidden;
  pointer-events: none;
}

.canvas-param-panel--open {
  transform: translateX(0);
  visibility: visible;
  pointer-events: auto;
}

.canvas-param-panel-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.canvas-param-panel-title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(248, 250, 255, 0.96);
}

.canvas-param-panel-close {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(220, 228, 242, 0.85);
  cursor: pointer;
}

.canvas-param-panel-close:hover {
  background: rgba(255, 255, 255, 0.12);
}

.canvas-param-panel-body {
  flex: 1;
  overflow: auto;
  padding: 14px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.canvas-param-section {
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(18, 20, 28, 0.96), rgba(14, 16, 22, 0.96));
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
  padding: 22px 14px 12px;
}

.canvas-param-section-label {
  position: absolute;
  top: -9px;
  left: 14px;
  z-index: 1;
  padding: 0 8px;
  font-size: 12px;
  color: rgba(232, 238, 248, 0.95);
}

.canvas-param-template-selector {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 模板网格布局：每行两个 */
.canvas-param-template-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.canvas-param-template-grid .canvas-param-template-selector {
  width: 100%;
}

/* 与 AssetExtractTemplateNode 提取资产模板 `.prompt-chip` 视觉一致，抽屉内铺满宽度 */
.canvas-param-prompt-chip {
  width: 100%;
  min-width: 0;
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
  box-sizing: border-box;
}

.canvas-param-prompt-chip:hover {
  border-color: rgba(255, 255, 255, 0.22);
}

.canvas-param-prompt-chip-name {
  min-width: 0;
  flex: 1;
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.canvas-param-prompt-chip-group {
  flex-shrink: 0;
  font-size: 11px;
  color: rgba(142, 154, 179, 0.9);
}

/* 自动保存与鸟瞰模式样式 */
</style>

<style>
/* 提取模板网格布局：每行两个 - 全局样式，因为 popover 挂载到 body */
.prompt-above-label {
  margin-bottom: 6px;
  font-size: 11px;
  color: rgba(142, 154, 179, 0.9);
  padding-left: 4px;
}

.asset-prompt-popover .prompt-group.extract-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.asset-prompt-popover .prompt-group.extract-grid .prompt-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(248, 250, 255, 0.9);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
  min-height: auto;
}

.asset-prompt-popover .prompt-group.extract-grid .prompt-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.asset-prompt-popover .prompt-group.extract-grid .prompt-btn.active {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.5);
  color: rgba(96, 165, 250, 1);
}

.asset-prompt-popover .prompt-group.extract-grid .prompt-btn-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.asset-prompt-popover .prompt-group.extract-grid .prompt-btn-icon.icon-official {
  background: rgba(59, 130, 246, 0.2);
  color: rgba(96, 165, 250, 1);
}

.asset-prompt-popover .prompt-group.extract-grid .prompt-btn-icon.icon-custom {
  background: rgba(168, 85, 247, 0.2);
  color: rgba(192, 132, 252, 1);
}

.asset-prompt-popover .prompt-group.extract-grid .prompt-btn-text {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
</style>
