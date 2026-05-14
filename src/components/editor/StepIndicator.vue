<script setup lang="ts">
import { computed } from 'vue'
import { Check } from '@element-plus/icons-vue'

interface Props {
  currentStep: number
  steps: { title: string; description: string }[]
  mode?: 'default' | 'compact'
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'default'
})

const emit = defineEmits<{
  (e: 'update:currentStep', value: number): void
}>()

const handleStepClick = (index: number) => {
  emit('update:currentStep', index)
}

const getStepStatus = (index: number) => {
  if (index < props.currentStep) return 'completed'
  if (index === props.currentStep) return 'active'
  return 'pending'
}
</script>

<template>
  <div :class="['step-indicator', mode]">
    <div
      v-for="(step, index) in steps"
      :key="index"
      :class="['step-item', getStepStatus(index)]"
      @click="handleStepClick(index)"
    >
      <div class="step-circle">
        <el-icon
          v-if="getStepStatus(index) === 'completed'"
          :size="mode === 'compact' ? 12 : 16"
        >
          <Check />
        </el-icon>
        <span v-else>{{ index + 1 }}</span>
      </div>
      <div
        v-if="mode === 'default'"
        class="step-content"
      >
        <div class="step-title">
          {{ step.title }}
        </div>
        <div class="step-description">
          {{ step.description }}
        </div>
      </div>
      <span
        v-else
        class="step-title-compact"
      >{{ step.title }}</span>
      <div
        v-if="index < steps.length - 1"
        class="step-line"
      />
    </div>
  </div>
</template>

<style scoped>
.step-indicator {
  display: flex;
  align-items: center;
}

.step-indicator.default {
  padding: 16px 24px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.step-indicator.compact {
  gap: 0;
}

.step-item {
  display: flex;
  align-items: center;
  cursor: pointer;
  position: relative;
}

.step-circle {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  transition: all 0.3s;
  flex-shrink: 0;
}

.default .step-circle {
  width: 32px;
  height: 32px;
  font-size: 14px;
}

.compact .step-circle {
  width: 22px;
  height: 22px;
  font-size: 12px;
}

.step-content {
  margin-left: 12px;
  flex: 1;
}

.step-title-compact {
  margin-left: 6px;
  font-size: 13px;
  font-weight: 500;
}

.step-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.step-description {
  font-size: 12px;
  color: var(--text-muted);
}

.step-line {
  background-color: var(--border-color);
}

.default .step-line {
  position: absolute;
  left: 48px;
  top: 16px;
  width: calc(100% - 64px);
  height: 2px;
}

.compact .step-line {
  width: 24px;
  height: 2px;
  margin: 0 4px;
}

.step-item.pending .step-circle {
  background-color: var(--bg-tertiary);
  border: 2px solid var(--border-color);
  color: var(--text-muted);
}

.step-item.pending .step-title,
.step-item.pending .step-title-compact {
  color: var(--text-muted);
}

.step-item.active .step-circle {
  background-color: var(--primary-color);
  border: 2px solid var(--primary-color);
  color: #fff;
}

.step-item.active .step-title,
.step-item.active .step-title-compact {
  color: var(--primary-color);
}

.step-item.completed .step-circle {
  background-color: var(--primary-color);
  border: 2px solid var(--primary-color);
  color: #fff;
}

.step-item.completed .step-line {
  background-color: var(--primary-color);
}
</style>
