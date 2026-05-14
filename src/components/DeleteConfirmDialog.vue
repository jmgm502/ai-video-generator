<template>
  <el-dialog
    v-model="visible"
    title="删除确认"
    width="400px"
    class="delete-confirm-dialog"
    :close-on-click-modal="false"
    @close="handleCancel"
  >
    <div class="delete-confirm-content">
      <el-icon class="danger-icon" :size="48">
        <WarningFilled />
      </el-icon>
      <p class="confirm-message">{{ message }}</p>
      <p v-if="hint" class="confirm-hint">{{ hint }}</p>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="danger" @click="handleConfirm">删除</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { WarningFilled } from '@element-plus/icons-vue'

const visible = ref(false)
const message = ref('')
const hint = ref('')
let resolvePromise: ((value: boolean) => void) | null = null

const handleCancel = () => {
  visible.value = false
  if (resolvePromise) {
    resolvePromise(false)
    resolvePromise = null
  }
}

const handleConfirm = () => {
  visible.value = false
  if (resolvePromise) {
    resolvePromise(true)
    resolvePromise = null
  }
}

const showDialog = (msg: string, hintText?: string): Promise<boolean> => {
  message.value = msg
  hint.value = hintText || ''
  visible.value = true
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

defineExpose({
  showDialog
})
</script>

<style scoped>
.delete-confirm-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

.danger-icon {
  color: var(--danger-color, #f56c6c);
  margin-bottom: 16px;
}

.confirm-message {
  font-size: 16px;
  color: var(--text-primary);
  margin: 0 0 8px 0;
  text-align: center;
}

.confirm-hint {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  text-align: center;
}

.dialog-footer {
  display: flex;
  justify-content: center;
  gap: 16px;
}

:deep(.el-dialog) {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
}

:deep(.el-dialog__header) {
  border-bottom: 1px solid var(--border-color);
}

:deep(.el-dialog__title) {
  color: var(--text-primary);
}

:deep(.el-dialog__body) {
  color: var(--text-primary);
}

:deep(.el-dialog__footer) {
  border-top: 1px solid var(--border-color);
}

:deep(.el-button--danger) {
  background-color: var(--danger-color);
  border-color: var(--danger-color);
}

:deep(.el-button--danger:hover) {
  background-color: #e55555;
  border-color: #e55555;
}
</style>
