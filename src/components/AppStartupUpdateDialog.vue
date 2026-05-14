<template>
  <el-dialog
    :model-value="modelValue"
    class="app-startup-update-dialog"
    :class="{ 'is-prompt': phase === 'prompt' }"
    :width="phase === 'downloading' ? '460px' : phase === 'prompt' ? '520px' : '420px'"
    align-center
    :close-on-click-modal="false"
    :show-close="phase !== 'downloading'"
    :close-on-press-escape="phase !== 'downloading'"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
    @closed="emit('dismiss')"
  >
    <template #header>
      <div
        v-if="phase === 'prompt'"
        class="prompt-header"
      >
        <img
          class="prompt-logo"
          src="/icon.ico"
          alt=""
          width="56"
          height="56"
        />
        <h2 class="prompt-title">
          发现新版本
        </h2>
      </div>
      <span
        v-else
        class="dialog-title-text"
      >{{ headerTitle }}</span>
    </template>

    <div
      v-if="phase === 'prompt'"
      class="update-prompt"
    >
      <div class="version-compare">
        <div class="ver-card ver-card--current">
          <span class="ver-label">当前</span>
          <span class="ver-num">v{{ currentVersion || '—' }}</span>
        </div>
        <span
          class="ver-arrow"
          aria-hidden="true"
        >→</span>
        <div class="ver-card ver-card--latest">
          <span class="ver-label">最新</span>
          <span class="ver-num ver-num--accent">v{{ latestVersion || '—' }}</span>
        </div>
      </div>
    </div>

    <div
      v-else-if="phase === 'downloading'"
      class="update-download"
    >
      <el-progress
        :percentage="Math.min(100, Math.round(downloadPercent))"
        :stroke-width="12"
        striped
        striped-flow
      />
      <div class="download-stats">
        <span>{{ formatBytes(transferred) }} / {{ formatBytes(total || 0) }}</span>
        <span class="speed">{{ formatSpeed(bytesPerSecond) }}</span>
      </div>
      <p class="download-hint">
        下载完成后将自动启动安装程序，本应用会退出，请按安装向导完成升级。
      </p>
    </div>

    <div
      v-else
      class="update-error"
    >
      <el-icon
        class="error-icon"
        :size="40"
      >
        <CircleCloseFilled />
      </el-icon>
      <p>{{ errorMessage || '更新过程出现问题' }}</p>
    </div>

    <template #footer>
      <div
        class="dialog-footer"
        :class="{ 'dialog-footer--prompt': phase === 'prompt' }"
      >
        <template v-if="phase === 'prompt'">
          <button
            type="button"
            class="btn-pan-download"
            @click="onPanDownload"
          >
            <el-icon class="btn-pan-download__icon"><Link /></el-icon>
            网盘下载
          </button>
          <button
            type="button"
            class="btn-update-now"
            @click="emit('confirm')"
          >
            <el-icon class="btn-update-now__icon"><Download /></el-icon>
            立即更新
          </button>
          <button
            type="button"
            class="btn-later"
            @click="onLater"
          >
            稍后再说
          </button>
        </template>
        <el-button
          v-else-if="phase === 'error'"
          type="primary"
          @click="emit('update:modelValue', false)"
        >
          关闭
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CircleCloseFilled, Download, Link } from '@element-plus/icons-vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    phase: 'prompt' | 'downloading' | 'error'
    currentVersion?: string
    latestVersion?: string
    releaseNotes?: string
    downloadPercent?: number
    transferred?: number
    total?: number
    bytesPerSecond?: number
    errorMessage?: string
  }>(),
  {
    currentVersion: '',
    latestVersion: '',
    releaseNotes: '',
    downloadPercent: 0,
    transferred: 0,
    total: 0,
    bytesPerSecond: 0,
    errorMessage: ''
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  /** 弹窗关闭（含右上角关闭、稍后再说） */
  dismiss: []
}>()

const headerTitle = computed(() => {
  switch (props.phase) {
    case 'downloading':
      return '正在下载更新'
    case 'error':
      return '更新失败'
    default:
      return '发现新版本'
  }
})

function formatBytes(n: number): string {
  if (!n || n < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  const digits = i === 0 ? 0 : i === 1 ? 1 : 2
  return `${v.toFixed(digits)} ${units[i]}`
}

function formatSpeed(bps: number): string {
  if (!bps || bps < 1) return '—'
  return `${formatBytes(bps)}/s`
}

function onLater() {
  emit('update:modelValue', false)
}

function onPanDownload() {
  window.open('https://pan.quark.cn/s/7e5c3de84265', '_blank')
}
</script>

<style scoped>
.dialog-title-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.prompt-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 8px 0 4px;
}

.prompt-logo {
  width: 72px;
  height: 72px;
  object-fit: contain;
  display: block;
  border-radius: 14px;
  margin-bottom: 18px;
}

.prompt-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.02em;
}

.update-prompt {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.version-compare {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
}

.ver-card {
  flex: 0 0 auto;
  width: 118px;
  height: 118px;
  aspect-ratio: 1;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 8px;
  background: #2a2a2a;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.ver-card--current {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.ver-card--latest {
  border: 1px solid rgba(0, 170, 255, 0.65);
  box-shadow: 0 0 0 1px rgba(0, 180, 219, 0.15);
}

.ver-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
}

.ver-num {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
  letter-spacing: 0.02em;
}

.ver-num--accent {
  color: #00aaff;
}

.ver-arrow {
  flex-shrink: 0;
  align-self: center;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1;
  padding: 0 4px;
  font-weight: 300;
}

.update-download .download-stats {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.update-download .speed {
  color: var(--text-primary);
}

.update-download .download-hint {
  margin: 14px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.update-error {
  text-align: center;
  padding: 8px 0 16px;
}

.update-error .error-icon {
  color: var(--el-color-danger);
  margin-bottom: 12px;
}

.update-error p {
  margin: 0;
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.5;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.dialog-footer--prompt {
  justify-content: center;
  gap: 12px;
  flex-wrap: nowrap;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 20px 0;
  margin: 0;
}

.btn-update-now {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 46px;
  padding: 0 16px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(90deg, #00b4db 0%, #0083d4 45%, #6e48aa 100%);
  box-shadow: 0 4px 18px rgba(0, 102, 180, 0.35);
  transition: filter 0.15s ease, transform 0.1s ease;
  white-space: nowrap;
}

.btn-update-now:hover {
  filter: brightness(1.05);
}

.btn-update-now:active {
  transform: scale(0.98);
}

.btn-update-now__icon {
  font-size: 18px;
}

.btn-later {
  flex: 1;
  min-height: 46px;
  padding: 0 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  background: #2a2a2a;
  border: 1px solid rgba(0, 0, 0, 0.35);
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  white-space: nowrap;
}

.btn-pan-download {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 46px;
  padding: 0 16px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(90deg, #ff7e5f 0%, #feb47b 100%);
  box-shadow: 0 4px 18px rgba(255, 126, 95, 0.35);
  transition: filter 0.15s ease, transform 0.1s ease;
  white-space: nowrap;
}

.btn-pan-download:hover {
  filter: brightness(1.05);
}

.btn-pan-download:active {
  transform: scale(0.98);
}

.btn-pan-download__icon {
  font-size: 18px;
}

.btn-later:hover {
  background: #323232;
  border-color: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.72);
}
</style>

<style>
.app-startup-update-dialog.el-dialog {
  background: #121214;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 14px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.55);
}

.app-startup-update-dialog.is-prompt.el-dialog {
  --prompt-dialog-size: min(520px, calc(100vw - 32px), calc(100vh - 32px));
  padding: 0;
  width: var(--prompt-dialog-size) !important;
  height: var(--prompt-dialog-size);
  min-height: var(--prompt-dialog-size);
  max-height: var(--prompt-dialog-size);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
}

.app-startup-update-dialog .el-dialog__header {
  border-bottom: 1px solid var(--border-color);
  margin-right: 0;
}

.app-startup-update-dialog.is-prompt .el-dialog__header {
  border-bottom: none;
  padding: 16px 20px 8px;
  flex-shrink: 0;
}

.app-startup-update-dialog .el-dialog__headerbtn .el-dialog__close {
  color: rgba(255, 255, 255, 0.55);
}

.app-startup-update-dialog .el-dialog__headerbtn .el-dialog__close:hover {
  color: #fff;
}

.app-startup-update-dialog .el-dialog__title {
  color: var(--text-primary);
}

.app-startup-update-dialog.is-prompt .el-dialog__title {
  width: 100%;
}

.app-startup-update-dialog .el-dialog__body {
  color: var(--text-primary);
  padding-top: 8px;
}

.app-startup-update-dialog.is-prompt .el-dialog__body {
  padding: 8px 20px;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-startup-update-dialog .el-dialog__footer {
  border-top: 1px solid var(--border-color);
}

.app-startup-update-dialog.is-prompt .el-dialog__footer {
  border-top: none;
  padding: 0 0 20px;
  margin-top: auto;
  flex-shrink: 0;
}
</style>
