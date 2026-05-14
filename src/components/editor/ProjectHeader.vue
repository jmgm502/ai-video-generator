<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'
import { Folder, Document, Film } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()
const { t } = useI18n()

const emit = defineEmits<{
  (e: 'switch-step', step: 'step1' | 'step2'): void
}>()

const currentStep = computed(() => {
  if (route.path.includes('/step1')) return 'step1'
  if (route.path.includes('/step2')) return 'step2'
  return 'step1'
})

const goBack = () => {
  router.push('/projects')
}

const switchToStep1 = () => {
  if (projectStore.currentProject) {
    router.push(`/editor/${projectStore.currentProject.id}/step1`)
  }
}

const switchToStep2 = () => {
  if (projectStore.currentProject) {
    router.push(`/editor/${projectStore.currentProject.id}/step2`)
  }
}
</script>

<template>
  <div class="project-header">
    <div class="header-left">
      <el-button
        :icon="Folder"
        @click="goBack"
        class="project-back-button"
      >
        项目
      </el-button>
      <span class="project-header-name">{{ projectStore.currentProject?.name }}</span>
    </div>
    <div class="step-tabs">
      <div
        :class="['step-tab', { active: currentStep === 'step1' }]"
        @click="switchToStep1"
      >
        <el-icon><Document /></el-icon>
        <span>{{ t('editorWorkshop.header.stepDoc') }}</span>
      </div>
      <div class="step-line" />
      <div
        :class="['step-tab', { active: currentStep === 'step2' }]"
        @click="switchToStep2"
      >
        <el-icon><Film /></el-icon>
        <span>{{ t('editorWorkshop.header.stepStory') }}</span>
      </div>
    </div>
    <div class="header-right"></div>
  </div>
</template>

<style scoped>
.project-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 200px;
}

.project-back-button {
  border-radius: 8px !important;
  padding: 8px 16px !important;
  background-color: var(--bg-tertiary) !important;
  border: 1px solid var(--border-color) !important;
  color: var(--text-primary) !important;
}

.project-back-button:hover {
  background-color: var(--bg-primary) !important;
  border-color: var(--primary-color) !important;
}

.project-header-name {
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
}

.step-tabs {
  display: flex;
  align-items: center;
  gap: 0;
}

.header-right {
  min-width: 200px;
}

.step-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 14px;
  transition: all 0.2s;
  border-radius: 6px;
}

.step-tab:hover {
  color: var(--text-primary);
  background-color: var(--bg-tertiary);
}

.step-tab.active {
  color: var(--primary-color);
  background-color: var(--bg-tertiary);
  font-weight: bold;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(var(--primary-color-rgb, 59, 130, 246), 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(var(--primary-color-rgb, 59, 130, 246), 0);
  }
}

.step-line {
  width: 60px;
  height: 2px;
  background: linear-gradient(90deg, var(--border-color) 0%, var(--border-color) 50%, var(--border-color) 100%);
  position: relative;
}
</style>
