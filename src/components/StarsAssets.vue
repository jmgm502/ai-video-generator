<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Star, Wallet, Copy, Document, Loading } from '@element-plus/icons-vue'
import { fetchCloudStars } from '@/config/cloudApi'
import { useUserStore } from '@/stores/userStore'

const { t } = useI18n()
const userStore = useUserStore()

const balance = ref(0)
const logs = ref<any[]>([])
const logsLoading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const totalLogs = ref(0)
const rechargeAmount = ref('')
const rechargeLoading = ref(false)

const showPayQrcode = ref(false)
const payQrcodeUrl = ref('')
const currentOrderNo = ref('')
const currentStars = ref(0)
let paymentCheckTimer: ReturnType<typeof setInterval> | null = null

const STARS_PER_YUAN = 10

const calculatedStars = computed(() => {
  const amount = parseFloat(rechargeAmount.value)
  if (!amount || amount <= 0) return 0
  return Math.floor(amount * STARS_PER_YUAN)
})

const typeLabels: Record<string, string> = {
  register: '注册赠送',
  checkin: '每日签到',
  invite: '邀请奖励',
  recharge: '充值获得',
  bonus: '活动奖励',
}

async function fetchBalance() {
  try {
    const response = await fetchCloudStars('balance', {
      method: 'GET',
      headers: {
        ...userStore.getAuthFetchHeaders(),
      },
    })
    const result = await response.json()
    if (result.success) {
      balance.value = result.data.balance
    }
  } catch (error) {
    console.error('获取余额失败:', error)
  }
}

async function fetchLogs(page = 1) {
  logsLoading.value = true
  try {
    const response = await fetchCloudStars('logs', {
      method: 'GET',
      headers: {
        ...userStore.getAuthFetchHeaders(),
      },
    }, new URLSearchParams({ page: String(page), pageSize: String(pageSize.value) }))
    const result = await response.json()
    if (result.success) {
      logs.value = result.data.list
      totalLogs.value = result.data.pagination.total
      currentPage.value = page
    }
  } catch (error) {
    console.error('获取日志失败:', error)
  } finally {
    logsLoading.value = false
  }
}

async function handleRecharge() {
  const amount = parseFloat(rechargeAmount.value)
  if (!amount || amount <= 0) {
    ElMessage.warning('请输入有效的充值金额')
    return
  }

  if (amount < 1) {
    ElMessage.warning('最低充值金额为1元')
    return
  }

  rechargeLoading.value = true
  try {
    const token = userStore.token?.trim()
    if (!token) {
      ElMessage.warning('请先登录')
      return
    }

    const response = await fetchCloudStars('recharge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...userStore.getAuthFetchHeaders(),
      },
      body: JSON.stringify({ amount, accessToken: token }),
    })

    const result = await response.json()

    if (response.status === 401) {
      ElMessage.error('登录已过期，请重新登录')
      return
    }

    if (result.success) {
      currentOrderNo.value = result.data.orderNo
      currentStars.value = result.data.stars
      payQrcodeUrl.value = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(result.data.codeUrl)}`
      showPayQrcode.value = true
      startPaymentCheck()
    } else {
      ElMessage.error(result.message || '充值失败')
    }
  } catch (error) {
    console.error('充值请求异常:', error)
    ElMessage.error('充值失败，请重试')
  } finally {
    rechargeLoading.value = false
  }
}

const startPaymentCheck = () => {
  if (paymentCheckTimer) {
    clearInterval(paymentCheckTimer)
  }
  
  paymentCheckTimer = setInterval(async () => {
    if (!currentOrderNo.value) return
    
    try {
      const pollToken = userStore.token?.trim() || ''
      const q = new URLSearchParams({
        orderNo: currentOrderNo.value,
        ...(pollToken ? { accessToken: pollToken } : {}),
      })
      
      const response = await fetchCloudStars('recharge-order', {
        method: 'GET',
        headers: {
          ...userStore.getAuthFetchHeaders(),
        },
      }, q)
      
      const result = await response.json()
      
      if (result.success) {
        if (result.data.status === 'paid') {
          clearInterval(paymentCheckTimer!)
          paymentCheckTimer = null
          showPayQrcode.value = false
          
          ElMessage.success(`充值成功！获得 ${currentStars.value} ⭐`)
          balance.value += currentStars.value
          currentOrderNo.value = ''
          fetchLogs(1)
        } else if (result.data.status === 'closed') {
          clearInterval(paymentCheckTimer!)
          paymentCheckTimer = null
          showPayQrcode.value = false
          currentOrderNo.value = ''
          ElMessage.warning('订单已关闭')
        } else if (result.data.paymentStatus?.tradeState === 'UNKNOWN' && result.data.paymentStatus?.tradeStateDesc) {
          console.error('微信支付查询错误:', result.data.paymentStatus.tradeStateDesc)
        }
      }
    } catch (error) {
      console.error('检查支付状态失败:', error)
    }
  }, 3000)
}

function handleClosePayDialog() {
  showPayQrcode.value = false
  if (paymentCheckTimer) {
    clearInterval(paymentCheckTimer)
    paymentCheckTimer = null
  }
  currentOrderNo.value = ''
}

function getTypeLabel(type: string) {
  return typeLabels[type] || type
}

function formatAmount(amount: number) {
  return amount > 0 ? `+${amount}` : `${amount}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  fetchBalance()
  fetchLogs(1)
})
</script>

<template>
  <div class="stars-assets">
    <div class="balance-card">
      <div class="balance-header">
        <el-icon :size="32" class="star-icon"><Star /></el-icon>
        <div class="balance-info">
          <div class="balance-label">{{ t('stars.currentBalance') }}</div>
          <div class="balance-value">{{ balance }} <span class="unit">⭐</span></div>
        </div>
      </div>
      
      <el-divider />
      
      <div class="recharge-section">
        <h4>{{ t('stars.recharge') }}</h4>
        <div class="recharge-form">
          <el-input
            v-model="rechargeAmount"
            type="number"
            :placeholder="t('stars.rechargePlaceholder')"
            :prefix-icon="Wallet"
            style="width: 200px;"
          >
            <template #append>元</template>
          </el-input>
          <el-button
            type="primary"
            :loading="rechargeLoading"
            @click="handleRecharge"
          >
            {{ t('stars.btnRecharge') }}
          </el-button>
        </div>
        <div class="recharge-calc" v-if="calculatedStars > 0">
          <span class="calc-label">{{ t('stars.willGet') }}</span>
          <span class="calc-value">{{ calculatedStars }} ⭐</span>
        </div>
        <div class="recharge-tips">
          {{ t('stars.rechargeTips') }}
        </div>
      </div>
    </div>

    <div class="logs-section">
      <h4>{{ t('stars.logsTitle') }}</h4>
      <el-table
        :data="logs"
        v-loading="logsLoading"
        style="width: 100%"
        empty-text="暂无积分记录"
      >
        <el-table-column prop="type" :label="t('stars.logType')" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="row.change_amount > 0 ? 'success' : 'danger'">
              {{ getTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="change_amount" :label="t('stars.logAmount')" width="100">
          <template #default="{ row }">
            <span :class="['amount-text', row.change_amount > 0 ? 'positive' : 'negative']">
              {{ formatAmount(row.change_amount) }} ⭐
            </span>
          </template>
        </el-table-column>
        
        <el-table-column prop="balance_after" :label="t('stars.logBalanceAfter')" width="120">
          <template #default="{ row }">
            {{ row.balance_after }} ⭐
          </template>
        </el-table-column>
        
        <el-table-column prop="description" :label="t('stars.logDescription')" />
        
        <el-table-column prop="created_at" :label="t('stars.logTime')" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
      
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="totalLogs"
          layout="prev, pager, next"
          @current-change="fetchLogs"
        />
      </div>
    </div>
  </div>

  <el-dialog
    v-model="showPayQrcode"
    :title="t('settings.vip.payDialogTitle')"
    width="400px"
    class="pay-dialog"
    :close-on-click-modal="false"
    :show-close="false"
  >
    <div class="pay-content">
      <div class="qrcode-container">
        <img
          v-if="payQrcodeUrl"
          :src="payQrcodeUrl"
          :alt="t('settings.vip.qrAlt')"
          class="qrcode-image"
        >
        <div
          v-else
          class="qrcode-loading"
        >
          <el-icon class="is-loading">
            <Loading />
          </el-icon>
          <span>{{ t('settings.vip.generatingQr') }}</span>
        </div>
      </div>
      <div class="pay-info">
        <div class="pay-amount">
          <span>{{ t('settings.vip.amountLabel') }}</span>
          <span class="amount">¥{{ rechargeAmount }}</span>
        </div>
        <div class="pay-order">
          {{ t('settings.vip.orderPrefix') }}{{ currentOrderNo }}
        </div>
        <div class="pay-stars">
          {{ t('stars.willGet') }}{{ currentStars }} ⭐
        </div>
      </div>
      <div class="pay-tips">
        <p>{{ t('settings.vip.tipWechat') }}</p>
        <p>{{ t('stars.tipAutoRecharge') }}</p>
      </div>
    </div>
    <template #footer>
      <el-button @click="handleClosePayDialog">
        {{ t('settings.vip.cancelPayment') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.stars-assets {
  padding: 8px;
}

.stars-assets :deep(.el-table) {
  background-color: transparent !important;
}

.stars-assets :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.stars-assets :deep(.el-table tr) {
  background-color: transparent !important;
}

.stars-assets :deep(.el-table th.el-table__cell),
.stars-assets :deep(.el-table td.el-table__cell) {
  background-color: transparent !important;
}

.balance-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  color: white;
  margin-bottom: 16px;
}

.balance-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.star-icon {
  font-size: 32px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.balance-info {
  flex: 1;
}

.balance-label {
  font-size: 12px;
  opacity: 0.9;
  margin-bottom: 2px;
}

.balance-value {
  font-size: 28px;
  font-weight: bold;
}

.unit {
  font-size: 18px;
}

.el-divider {
  margin: 12px 0;
  border-color: rgba(255, 255, 255, 0.3);
}

.recharge-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
}

.recharge-form {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}

.recharge-calc {
  margin-bottom: 6px;
  font-size: 13px;
}

.calc-label {
  color: rgba(255, 255, 255, 0.8);
  margin-right: 6px;
}

.calc-value {
  color: #ffd700;
  font-weight: bold;
  font-size: 14px;
}

.recharge-tips {
  font-size: 11px;
  opacity: 0.8;
  line-height: 1.5;
}

.logs-section {
  padding: 0 8px;
}

.logs-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #303133);
}

.amount-text {
  font-weight: 600;
}

.amount-text.positive {
  color: #67c23a;
}

.amount-text.negative {
  color: #f56c6c;
}

.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

.pay-content {
  text-align: center;
}

.qrcode-container {
  width: 200px;
  height: 200px;
  margin: 0 auto 20px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fff;
}

.qrcode-image {
  width: 180px;
  height: 180px;
}

.qrcode-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-secondary);
}

.qrcode-loading .el-icon {
  font-size: 32px;
  color: var(--primary-color);
}

.pay-info {
  margin-bottom: 16px;
}

.pay-amount {
  font-size: 16px;
  margin-bottom: 8px;
}

.pay-amount .amount {
  font-size: 24px;
  font-weight: bold;
  color: var(--primary-color);
}

.pay-order {
  font-size: 12px;
  color: var(--text-muted);
}

.pay-stars {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.pay-tips {
  font-size: 13px;
  color: var(--text-secondary);
}

.pay-tips p {
  margin: 4px 0;
}
</style>
