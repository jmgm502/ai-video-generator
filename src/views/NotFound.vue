<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Back } from '@element-plus/icons-vue'

const router = useRouter()

const handleBack = () => {
  router.push('/')
}
</script>

<template>
  <div class="not-found-container">
    <div class="not-found-content">
      <h1 class="error-code">
        404
      </h1>
      <h2 class="error-title">
        页面未找到
      </h2>
      <p class="error-description">
        抱歉，您访问的页面不存在或已被移除
      </p>
      <el-button
        type="primary"
        :icon="Back"
        @click="handleBack"
      >
        返回首页
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.not-found-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%);
}

.not-found-content {
  text-align: center;
}

.error-code {
  font-size: 120px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
  margin-bottom: 16px;
}

.error-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.error-description {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 32px;
}
</style>
