<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Calendar, Star } from '@element-plus/icons-vue'
import { fetchCloudStars } from '@/config/cloudApi'
import { useUserStore } from '@/stores/userStore'

const { t } = useI18n()
const userStore = useUserStore()

const hasCheckedIn = ref(false)
const continuousDays = ref(0)
const checkinLoading = ref(false)
const checkinHistory = ref<any[]>([])
const currentMonth = ref(new Date().toISOString().slice(0, 7))

const calendarDays = computed(() => {
  const year = parseInt(currentMonth.value.split('-')[0])
  const month = parseInt(currentMonth.value.split('-')[1])
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const daysInMonth = lastDay.getDate()
  const startDayOfWeek = firstDay.getDay()
  
  const days: Array<{
    date: string
    day: number
    isCurrentMonth: boolean
    isCheckedIn: boolean
    isToday: boolean
  }> = []
  
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate()
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    days.push({
      date: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      day,
      isCurrentMonth: false,
      isCheckedIn: false,
      isToday: false
    })
  }
  
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    days.push({
      date: dateStr,
      day,
      isCurrentMonth: true,
      isCheckedIn: checkinHistory.value.some(r => r.checkin_date === dateStr),
      isToday: dateStr === todayStr
    })
  }
  
  const remainingDays = 42 - days.length
  for (let day = 1; day <= remainingDays; day++) {
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    days.push({
      date: `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      day,
      isCurrentMonth: false,
      isCheckedIn: false,
      isToday: false
    })
  }
  
  return days
})

const weekDays = computed(() => {
  return [t('stars.sun'), t('stars.mon'), t('stars.tue'), t('stars.wed'), t('stars.thu'), t('stars.fri'), t('stars.sat')]
})

async function fetchCheckinStatus() {
  try {
    const response = await fetchCloudStars('checkin-status', {
      method: 'GET',
      headers: {
        ...userStore.getAuthFetchHeaders(),
      },
    })
    const result = await response.json()
    if (result.success) {
      hasCheckedIn.value = result.data.hasCheckedIn
      continuousDays.value = result.data.continuousDays
    }
  } catch (error) {
    console.error('获取签到状态失败:', error)
  }
}

async function fetchCheckinHistory() {
  try {
    const response = await fetchCloudStars('checkin-history', {
      method: 'GET',
      headers: {
        ...userStore.getAuthFetchHeaders(),
      },
    }, new URLSearchParams({ month: currentMonth.value }))
    const result = await response.json()
    if (result.success) {
      checkinHistory.value = result.data.records
    }
  } catch (error) {
    console.error('获取签到历史失败:', error)
  }
}

async function handleCheckin() {
  if (hasCheckedIn.value) {
    ElMessage.warning(t('stars.alreadyCheckedIn'))
    return
  }

  checkinLoading.value = true
  try {
    const response = await fetchCloudStars('checkin', {
      method: 'POST',
      headers: {
        ...userStore.getAuthFetchHeaders(),
      },
    })
    const result = await response.json()
    if (result.success) {
      hasCheckedIn.value = true
      continuousDays.value = result.data.continuousDays
      
      let message = t('stars.checkinSuccess')
      if (result.data.bonusStars > 0) {
        message = t('stars.checkinBonus', { 
          days: result.data.continuousDays, 
          bonus: result.data.bonusStars 
        })
      }
      
      ElMessage.success(message)
      fetchCheckinHistory()
    } else {
      ElMessage.error(result.message || t('stars.checkinFail'))
    }
  } catch (error) {
    ElMessage.error(t('stars.checkinFail'))
  } finally {
    checkinLoading.value = false
  }
}

function prevMonth() {
  const year = parseInt(currentMonth.value.split('-')[0])
  const month = parseInt(currentMonth.value.split('-')[1])
  if (month === 1) {
    currentMonth.value = `${year - 1}-12`
  } else {
    currentMonth.value = `${year}-${String(month - 1).padStart(2, '0')}`
  }
  fetchCheckinHistory()
}

function nextMonth() {
  const year = parseInt(currentMonth.value.split('-')[0])
  const month = parseInt(currentMonth.value.split('-')[1])
  if (month === 12) {
    currentMonth.value = `${year + 1}-01`
  } else {
    currentMonth.value = `${year}-${String(month + 1).padStart(2, '0')}`
  }
  fetchCheckinHistory()
}

function getBonusTip(days: number) {
  if (days === 7) return t('stars.bonus7Days')
  if (days === 30) return t('stars.bonus30Days')
  return ''
}

onMounted(() => {
  fetchCheckinStatus()
  fetchCheckinHistory()
})
</script>

<template>
  <div class="daily-checkin">
    <div class="checkin-card">
      <div class="checkin-header">
        <el-icon :size="32" class="checkin-icon"><Calendar /></el-icon>
        <div class="checkin-info">
          <h3>{{ t('stars.checkinTitle') }}</h3>
          <p class="checkin-desc">{{ t('stars.checkinDesc') }}</p>
        </div>
      </div>
      
      <div class="checkin-stats">
        <div class="stat-item">
          <div class="stat-value">{{ continuousDays }}</div>
          <div class="stat-label">{{ t('stars.continuousDays') }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">2 ⭐</div>
          <div class="stat-label">{{ t('stars.dailyReward') }}</div>
        </div>
      </div>
      
      <el-button
        type="primary"
        size="large"
        :disabled="hasCheckedIn"
        :loading="checkinLoading"
        class="checkin-btn"
        @click="handleCheckin"
      >
        <el-icon v-if="!hasCheckedIn"><Star /></el-icon>
        {{ hasCheckedIn ? t('stars.checkedIn') : t('stars.btnCheckin') }}
      </el-button>
      
      <div class="bonus-tips" v-if="continuousDays < 7">
        <p>{{ t('stars.bonusTip', { days: 7 - continuousDays }) }}</p>
      </div>
    </div>

    <div class="calendar-section">
      <div class="calendar-header">
        <el-button @click="prevMonth" :icon="Calendar" size="small">{{ t('stars.prevMonth') }}</el-button>
        <span class="current-month">{{ currentMonth }}</span>
        <el-button @click="nextMonth" :icon="Calendar" size="small">{{ t('stars.nextMonth') }}</el-button>
      </div>
      
      <div class="calendar-grid">
        <div class="weekday-header" v-for="day in weekDays" :key="day">
          {{ day }}
        </div>
        
        <div
          v-for="(day, index) in calendarDays"
          :key="index"
          :class="[
            'calendar-day',
            { 'current-month': day.isCurrentMonth },
            { 'checked-in': day.isCheckedIn },
            { 'today': day.isToday }
          ]"
        >
          <span class="day-number">{{ day.day }}</span>
          <el-icon v-if="day.isCheckedIn" class="check-mark" :size="12"><Star /></el-icon>
        </div>
      </div>
    </div>

    <div class="checkin-rules">
      <h4>{{ t('stars.checkinRules') }}</h4>
      <ul>
        <li>{{ t('stars.ruleDaily') }}</li>
        <li>{{ t('stars.rule7Days') }}</li>
        <li>{{ t('stars.rule30Days') }}</li>
        <li>{{ t('stars.ruleReset') }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.daily-checkin {
  padding: 8px;
}

.checkin-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  color: white;
  margin-bottom: 16px;
  text-align: center;
}

.checkin-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.checkin-icon {
  font-size: 32px;
}

.checkin-info h3 {
  margin: 0 0 2px 0;
  font-size: 16px;
  font-weight: 600;
}

.checkin-desc {
  margin: 0;
  font-size: 12px;
  opacity: 0.9;
}

.checkin-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.stat-item {
  flex: 1;
  background: rgba(255, 255, 255, 0.2);
  padding: 12px;
  border-radius: 6px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 2px;
}

.stat-label {
  font-size: 12px;
  opacity: 0.9;
}

.checkin-btn {
  width: 100%;
  height: 40px;
  font-size: 16px;
  margin-bottom: 12px;
}

.bonus-tips {
  font-size: 12px;
  opacity: 0.9;
}

.calendar-section {
  background: var(--bg-secondary, #f5f7fa);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.current-month {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #303133);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
  max-width: 500px;
  margin: 0 auto;
}

.weekday-header {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #606266);
  padding: 6px 0;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary, #909399);
  position: relative;
}

.calendar-day.current-month {
  color: var(--text-primary, #303133);
  font-weight: 500;
}

.calendar-day.today {
  background: var(--primary-color, #409eff);
  color: white;
}

.calendar-day.checked-in {
  background: rgba(103, 194, 58, 0.2);
}

.calendar-day.checked-in .day-number {
  color: var(--success-color, #67c23a);
  font-weight: bold;
}

.check-mark {
  color: var(--success-color, #67c23a);
  font-size: 10px;
}

.checkin-rules {
  padding: 12px;
  background: var(--bg-secondary, #f5f7fa);
  border-radius: 6px;
}

.checkin-rules h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #303133);
}

.checkin-rules ul {
  margin: 0;
  padding-left: 16px;
}

.checkin-rules li {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--text-secondary, #606266);
  line-height: 1.5;
}
</style>
