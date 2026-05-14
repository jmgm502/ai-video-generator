<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Promotion, CopyDocument, User } from '@element-plus/icons-vue'
import { fetchCloudStars } from '@/config/cloudApi'
import { useUserStore } from '@/stores/userStore'

const { t } = useI18n()
const userStore = useUserStore()

const inviteCode = ref('')
const inviteCount = ref(0)
const invitedUsers = ref<any[]>([])
const loading = ref(false)

async function fetchInviteInfo() {
  loading.value = true
  try {
    const response = await fetchCloudStars('invite-info', {
      method: 'GET',
      headers: {
        ...userStore.getAuthFetchHeaders(),
      },
    })
    const result = await response.json()
    if (result.success) {
      inviteCode.value = result.data.inviteCode
      inviteCount.value = result.data.inviteCount
      invitedUsers.value = result.data.invitedUsers || []
    }
  } catch (error) {
    console.error('获取邀请信息失败:', error)
  } finally {
    loading.value = false
  }
}

async function copyInviteCode() {
  try {
    await navigator.clipboard.writeText(inviteCode.value)
    ElMessage.success(t('stars.inviteCodeCopied'))
  } catch {
    const input = document.createElement('input')
    input.value = inviteCode.value
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    ElMessage.success(t('stars.inviteCodeCopied'))
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

onMounted(() => {
  fetchInviteInfo()
})
</script>

<template>
  <div class="invite-friends" v-loading="loading">
    <div class="invite-card">
      <div class="invite-header">
        <el-icon :size="32" class="invite-icon"><Promotion /></el-icon>
        <div class="invite-info">
          <h3>{{ t('stars.inviteTitle') }}</h3>
          <p class="invite-desc">{{ t('stars.inviteDesc') }}</p>
        </div>
      </div>
      
      <el-divider />
      
      <div class="invite-code-section">
        <div class="code-label">{{ t('stars.myInviteCode') }}</div>
        <div class="code-display">
          <span class="code-text">{{ inviteCode || '---' }}</span>
          <el-button
            type="primary"
            :icon="CopyDocument"
            size="small"
            :disabled="!inviteCode"
            @click="copyInviteCode"
          >
            {{ t('stars.btnCopyCode') }}
          </el-button>
        </div>
        <div class="code-tips">
          {{ t('stars.inviteCodeTips') }}
        </div>
      </div>
      
      <el-divider />
      
      <div class="invite-stats">
        <div class="stat-item">
          <div class="stat-value">{{ inviteCount }}</div>
          <div class="stat-label">{{ t('stars.invitedCount') }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ inviteCount * 20 }}</div>
          <div class="stat-label">{{ t('stars.totalReward') }} (⭐)</div>
        </div>
      </div>
    </div>

    <div class="invited-users" v-if="invitedUsers.length > 0">
      <h4>{{ t('stars.invitedUsers') }}</h4>
      <el-table :data="invitedUsers" style="width: 100%">
        <el-table-column prop="email" :label="t('stars.userEmail')" />
        <el-table-column prop="nickname" :label="t('stars.userNickname')" width="150">
          <template #default="{ row }">
            {{ row.nickname || row.email.split('@')[0] }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" :label="t('stars.registerTime')" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="invite-rules">
      <h4>{{ t('stars.inviteRules') }}</h4>
      <ul>
        <li>{{ t('stars.rule1') }}</li>
        <li>{{ t('stars.rule2') }}</li>
        <li>{{ t('stars.rule3') }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.invite-friends {
  padding: 20px;
}

.invite-card {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  border-radius: 12px;
  padding: 24px;
  color: white;
  margin-bottom: 24px;
}

.invite-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.invite-icon {
  font-size: 48px;
}

.invite-info h3 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
}

.invite-desc {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
}

.el-divider {
  margin: 20px 0;
  border-color: rgba(255, 255, 255, 0.3);
}

.invite-code-section {
  margin-top: 16px;
}

.code-label {
  font-size: 14px;
  margin-bottom: 8px;
  opacity: 0.9;
}

.code-display {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.2);
  padding: 12px 16px;
  border-radius: 8px;
}

.code-text {
  font-size: 24px;
  font-weight: bold;
  font-family: monospace;
  letter-spacing: 2px;
  flex: 1;
}

.code-tips {
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.8;
}

.invite-stats {
  display: flex;
  gap: 24px;
  margin-top: 16px;
}

.stat-item {
  flex: 1;
  text-align: center;
  background: rgba(255, 255, 255, 0.15);
  padding: 16px;
  border-radius: 8px;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  opacity: 0.9;
}

.invited-users h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #303133);
}

.invite-rules {
  margin-top: 24px;
  padding: 16px;
  background: var(--bg-secondary, #f5f7fa);
  border-radius: 8px;
}

.invite-rules h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #303133);
}

.invite-rules ul {
  margin: 0;
  padding-left: 20px;
}

.invite-rules li {
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-secondary, #606266);
  line-height: 1.6;
}
</style>
