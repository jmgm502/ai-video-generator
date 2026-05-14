<script setup lang="ts">
defineProps<{
  title: string
  description: string
  /** 0–100 */
  percent: number
  metaLine: string
}>()
</script>

<template>
  <div class="canvas-gen-overlay">
    <div class="canvas-gen-panel">
      <div class="canvas-gen-title">
        {{ title }}
      </div>
      <div class="canvas-gen-desc">
        {{ description }}
      </div>
      <div class="canvas-gen-progress">
        <div
          class="canvas-gen-progress-bar"
          :style="{ width: `${percent}%` }"
        />
      </div>
      <div class="canvas-gen-meta">
        {{ metaLine }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.canvas-gen-overlay {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  background: rgba(8, 12, 24, 0.62);
  backdrop-filter: blur(2px);
}

.canvas-gen-panel {
  width: 100%;
  max-width: 320px;
  border: 1px solid rgba(102, 177, 255, 0.42);
  border-radius: 12px;
  background: rgba(15, 24, 44, 0.92);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
  padding: 12px 12px 11px;
}

.canvas-gen-title {
  color: #ecf5ff;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.canvas-gen-desc {
  margin-top: 4px;
  color: rgba(223, 236, 255, 0.75);
  font-size: 12px;
  line-height: 1.45;
}

.canvas-gen-progress {
  margin-top: 10px;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.12);
}

.canvas-gen-progress-bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #409eff 0%, #66b1ff 100%);
  transition: width 0.16s linear;
}

.canvas-gen-meta {
  margin-top: 7px;
  color: rgba(218, 231, 255, 0.82);
  font-size: 11px;
  line-height: 1.4;
}
</style>
