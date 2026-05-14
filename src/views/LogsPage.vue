<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Setting,
  Download,
  Document,
  Edit,
  User,
  Picture,
  Box,
  Connection,
  PictureFilled,
  VideoPlay,
  RefreshRight,
  Delete,
  Search,
  CircleCheck,
  CircleClose,
  Warning,
  InfoFilled
} from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { useLogsStore, type LogType, type LogLevel, type LogEntry, logTypeConfigs } from '@/stores/logsStore'

const { t } = useI18n()
const logsStore = useLogsStore()

const activeType = ref<LogType | 'all'>('all')
const searchQuery = ref('')
const levelFilter = ref<LogLevel | 'all'>('all')

const iconMap: Record<string, any> = {
  'Setting': Setting,
  'Download': Download,
  'Document': Document,
  'Edit': Edit,
  'User': User,
  'Picture': Picture,
  'Box': Box,
  'Connection': Connection,
  'PictureFilled': PictureFilled,
  'VideoPlay': VideoPlay
}

const levelIconMap: Record<LogLevel, any> = {
  'info': InfoFilled,
  'success': CircleCheck,
  'warning': Warning,
  'error': CircleClose
}

const levelColorMap: Record<LogLevel, string> = {
  'info': '#909399',
  'success': '#67C23A',
  'warning': '#E6A23C',
  'error': '#F56C6C'
}

function logTypeToCamelCase(type: LogType): string {
  return type.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

const logTypeLabel = (type: LogType) =>
  t(`logsPage.typeNames.${logTypeToCamelCase(type)}`)

const levelLabel = (level: LogLevel) => {
  switch (level) {
    case 'info': return t('logsPage.levelInfo')
    case 'success': return t('logsPage.levelSuccess')
    case 'warning': return t('logsPage.levelWarning')
    case 'error': return t('logsPage.levelError')
    default: return level
  }
}

function logResolvedMessage(log: LogEntry): string {
  if (log.messageKey) {
    const p = log.messageParams
    return p && Object.keys(p).length > 0
      ? String(t(log.messageKey, p as Record<string, unknown>))
      : String(t(log.messageKey))
  }
  return log.message ?? ''
}

function logResolvedDetails(log: LogEntry): string {
  const chunks: string[] = []
  if (log.detailKey) {
    const p = log.detailParams
    chunks.push(
      p && Object.keys(p).length > 0
        ? String(t(log.detailKey, p as Record<string, unknown>))
        : String(t(log.detailKey))
    )
  }
  if (log.details) chunks.push(log.details)
  return chunks.join('\n')
}

const filteredLogs = computed(() => {
  let result = logsStore.logs

  if (activeType.value !== 'all') {
    result = result.filter(log => log.type === activeType.value)
  }

  if (levelFilter.value !== 'all') {
    result = result.filter(log => log.level === levelFilter.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(log => {
      const msg = logResolvedMessage(log).toLowerCase()
      const det = logResolvedDetails(log).toLowerCase()
      return msg.includes(query) ||
        det.includes(query) ||
        (log.projectName && log.projectName.toLowerCase().includes(query))
    })
  }

  return result
})

const formatTime = (date: Date) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

const getTypeConfig = (type: LogType) => {
  return logTypeConfigs.find(config => config.id === type)
}

const handleClearAll = () => {
  logsStore.clearLogs()
  ElMessage.success(t('logsPage.msgClearedAll'))
}

const handleClearType = () => {
  if (activeType.value !== 'all') {
    logsStore.clearLogsByType(activeType.value)
    ElMessage.success(t('logsPage.msgClearedCategory', { name: logTypeLabel(activeType.value) }))
  }
}

const handleRefresh = () => {
  ElMessage.success(t('logsPage.msgRefreshed'))
}
</script>

<template>
  <div class="logs-page">
    <div class="logs-header">
      <h2 class="page-title">
        {{ t('logsPage.title') }}
      </h2>
      <div class="header-actions">
        <el-button
          size="small"
          @click="handleRefresh"
        >
          <el-icon><RefreshRight /></el-icon>
          {{ t('logsPage.btnRefresh') }}
        </el-button>
        <el-button
          size="small"
          type="danger"
          @click="handleClearAll"
        >
          <el-icon><Delete /></el-icon>
          {{ t('logsPage.btnClearAll') }}
        </el-button>
      </div>
    </div>

    <div class="logs-content">
      <div class="logs-sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">{{ t('logsPage.sidebarHeading') }}</span>
        </div>
        <div class="type-list">
          <div
            class="type-item"
            :class="{ active: activeType === 'all' }"
            @click="activeType = 'all'"
          >
            <el-icon class="type-icon">
              <Document />
            </el-icon>
            <span class="type-name">{{ t('logsPage.allLogs') }}</span>
            <span class="type-count">{{ logsStore.logs.length }}</span>
          </div>
          <div
            v-for="config in logTypeConfigs"
            :key="config.id"
            class="type-item"
            :class="{ active: activeType === config.id }"
            @click="activeType = config.id"
          >
            <el-icon
              class="type-icon"
              :style="{ color: config.color }"
            >
              <component :is="iconMap[config.icon]" />
            </el-icon>
            <span class="type-name">{{ logTypeLabel(config.id) }}</span>
            <span class="type-count">{{ logsStore.logCounts[config.id] || 0 }}</span>
          </div>
        </div>
      </div>

      <div class="logs-main">
        <div class="filter-bar">
          <el-input
            v-model="searchQuery"
            :placeholder="t('logsPage.searchPlaceholder')"
            prefix-icon="Search"
            clearable
            class="search-input"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-select
            v-model="levelFilter"
            :placeholder="t('logsPage.levelPlaceholder')"
            class="level-select"
          >
            <el-option
              :label="t('logsPage.levelAll')"
              value="all"
            />
            <el-option
              :label="t('logsPage.levelInfo')"
              value="info"
            >
              <el-icon><InfoFilled /></el-icon>
              <span>{{ t('logsPage.levelInfo') }}</span>
            </el-option>
            <el-option
              :label="t('logsPage.levelSuccess')"
              value="success"
            >
              <el-icon><CircleCheck /></el-icon>
              <span>{{ t('logsPage.levelSuccess') }}</span>
            </el-option>
            <el-option
              :label="t('logsPage.levelWarning')"
              value="warning"
            >
              <el-icon><Warning /></el-icon>
              <span>{{ t('logsPage.levelWarning') }}</span>
            </el-option>
            <el-option
              :label="t('logsPage.levelError')"
              value="error"
            >
              <el-icon><CircleClose /></el-icon>
              <span>{{ t('logsPage.levelError') }}</span>
            </el-option>
          </el-select>
          <el-button
            v-if="activeType !== 'all'"
            size="small"
            type="warning"
            @click="handleClearType"
          >
            {{ t('logsPage.btnClearCategory') }}
          </el-button>
        </div>

        <div class="logs-list">
          <div
            v-if="filteredLogs.length === 0"
            class="empty-state"
          >
            <el-icon
              :size="48"
              color="#909399"
            >
              <Document />
            </el-icon>
            <p>{{ t('logsPage.emptyNoLogs') }}</p>
          </div>
          <div
            v-for="log in filteredLogs"
            :key="log.id"
            class="log-item"
            :class="['level-' + log.level]"
          >
            <div class="log-header">
              <div class="log-type">
                <el-icon :style="{ color: getTypeConfig(log.type)?.color }">
                  <component :is="iconMap[getTypeConfig(log.type)?.icon || 'Document']" />
                </el-icon>
                <span class="type-name">{{ logTypeLabel(log.type) }}</span>
              </div>
              <div class="log-level">
                <el-icon :style="{ color: levelColorMap[log.level] }">
                  <component :is="levelIconMap[log.level]" />
                </el-icon>
                <span :style="{ color: levelColorMap[log.level] }">
                  {{ levelLabel(log.level) }}
                </span>
              </div>
              <div class="log-time">
                {{ formatTime(log.timestamp) }}
              </div>
            </div>
            <div class="log-message">
              {{ logResolvedMessage(log) }}
            </div>
            <div
              v-if="logResolvedDetails(log)"
              class="log-details"
            >
              <pre>{{ logResolvedDetails(log) }}</pre>
            </div>
            <div
              v-if="log.projectName"
              class="log-project"
            >
              <span class="project-label">{{ t('logsPage.projectLabel') }}</span>
              <span class="project-name">{{ log.projectName }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.logs-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
}

.logs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.logs-content {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
  padding-left: 80px;
}

.logs-sidebar {
  width: 240px;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background-color: var(--bg-secondary);
}

.sidebar-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.type-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.type-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
}

.type-list .type-item:nth-child(3),
.type-list .type-item:nth-child(6),
.type-list .type-item:nth-child(9),
.type-list .type-item:nth-child(12),
.type-list .type-item:nth-child(14),
.type-list .type-item:nth-child(16) {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.type-item:hover {
  background-color: var(--bg-tertiary);
}

.type-item.active {
  background-color: var(--primary-color);
  color: #fff;
}

.type-item.active .type-icon,
.type-item.active .type-name,
.type-item.active .type-count {
  color: #fff;
}

.type-icon {
  font-size: 16px;
  margin-right: 8px;
  flex-shrink: 0;
}

.type-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type-count {
  font-size: 12px;
  color: var(--text-secondary);
  background-color: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.type-item.active .type-count {
  background-color: rgba(255, 255, 255, 0.2);
}

.logs-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  max-width: 300px;
}

.level-select {
  width: 140px;
}

.logs-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
}

.empty-state p {
  margin-top: 12px;
  font-size: 14px;
}

.log-item {
  background-color: var(--bg-secondary);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 12px;
  border: 1px solid var(--border-color);
  border-left: 3px solid var(--border-color);
}

.log-item.level-info {
  border-left-color: #909399;
}

.log-item.level-success {
  border-left-color: #67C23A;
}

.log-item.level-warning {
  border-left-color: #E6A23C;
}

.log-item.level-error {
  border-left-color: #F56C6C;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}

.log-type {
  display: flex;
  align-items: center;
  gap: 6px;
}

.log-type .type-name {
  font-size: 12px;
  font-weight: 500;
}

.log-level {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.log-time {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-secondary);
}

.log-message {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.5;
  word-break: break-word;
}

.log-details {
  margin-top: 8px;
  padding: 8px 12px;
  background-color: var(--bg-tertiary);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  overflow-x: auto;
}

.log-details pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.log-project {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.project-label {
  color: var(--text-muted);
}

.project-name {
  color: var(--primary-color);
}
</style>
