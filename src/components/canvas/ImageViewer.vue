<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  visible: boolean
  imageUrl: string | null
  imageList?: string[]
  currentIndex?: number
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="图片预览"
    draggable
    width="min(1200px, 92vw)"
    :close-on-click-modal="true"
    class="image-viewer-dialog"
    align-center
  >
    <div class="image-viewer-container">
      <div class="image-viewer-content">
        <img
          v-if="imageUrl"
          :src="imageUrl"
          class="preview-image"
        />
        <div v-else class="no-image">
          暂无图片
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
/* 可拖动时提示：顶部标题栏拖移弹窗（与 el-dialog draggable 一致） */
.image-viewer-dialog :deep(.el-dialog__header) {
  cursor: move;
  user-select: none;
}

.image-viewer-dialog :deep(.el-dialog__body) {
  padding: 8px 12px 16px;
  box-sizing: border-box;
}

.image-viewer-container {
  width: 100%;
  box-sizing: border-box;
}

/**
 * 固定预览舞台高度 + img 填充满舞台且 object-fit: contain，
 * 这样「合并分镜」等像素宽度较小（如 494px）的图也会按可用区域放大，而不会只占中间一条。
 */
.image-viewer-content {
  width: 100%;
  height: min(82vh, calc(100dvh - 120px));
  min-height: 200px;
  box-sizing: border-box;
  overflow: auto;
}

.preview-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  border-radius: 4px;
}

.no-image {
  color: #7f8798;
  font-size: 14px;
}
</style>
