<template>
  <el-dialog
    v-model="visible"
    title="确认关闭"
    width="400px"
    class="close-confirm-dialog"
    :close-on-click-modal="false"
    @close="handleCancel"
  >
    <div class="close-confirm-content">
      <el-icon class="warning-icon" :size="48">
        <WarningFilled />
      </el-icon>
      <p class="confirm-message">确定要关闭软件吗？</p>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" @click="handleConfirm">确认关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { WarningFilled } from '@element-plus/icons-vue'

const visible = ref(false)

const handleCancel = () => {
  visible.value = false
  window.electronAPI?.window.cancelClose()
}

const handleConfirm = () => {
  visible.value = false
  window.electronAPI?.window.confirmClose()
}

const showDialog = () => {
  visible.value = true
}

defineExpose({
  showDialog
})
</script>

<style scoped>
.close-confirm-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

.warning-icon {
  color: var(--warning-color, #E6A23C);
  margin-bottom: 16px;
}

.confirm-message {
  font-size: 16px;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.confirm-hint {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
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
</style>
