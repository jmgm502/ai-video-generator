<template>
  <div class="settings-page">
    <div class="settings-layout">
      <aside class="settings-sidebar">
        <h1 class="settings-sidebar-title">
          系统设置
        </h1>
        <nav class="settings-nav">
          <button
            type="button"
            :class="['nav-item', { active: activePage === 'storage' }]"
            @click="activePage = 'storage'"
          >
            数据存储
          </button>
          <button
            type="button"
            :class="['nav-item', { active: activePage === 'api' }]"
            @click="activePage = 'api'"
          >
            API配置
          </button>
        </nav>
      </aside>

      <div class="settings-main">
        <div class="important-warning">
          <strong>重要提醒:</strong> 所有本地目录和文件路径都禁止使用中文，否则可能出现素材库图片无法加载等问题。
        </div>
        <div
          v-show="activePage === 'storage'"
          class="settings-section"
        >
        <div class="storage-info">
          <div class="storage-item">
            <span class="storage-label">当前存储路径：</span>
            <span class="storage-value">{{ currentDataPath || '加载中...' }}</span>
          </div>
          <div class="storage-item">
            <span class="storage-label">默认存储路径：</span>
            <span class="storage-value default">{{ defaultDataPath || '加载中...' }}</span>
          </div>
          <div class="storage-tips">
            <p><strong>说明：</strong></p>
            <ul>
              <li>项目数据、配置信息将存储在上述路径中</li>
              <li>自定义存储路径后，数据将自动迁移到新路径</li>
              <li>建议选择一个空间充足的磁盘位置</li>
            </ul>
            <p class="platform-default">
              <strong>默认存储位置：</strong><br>
              Windows: %APPDATA%\ai-video-generator\<br>
              macOS: ~/Library/Application Support/ai-video-generator/<br>
              Linux: ~/.config/ai-video-generator/
            </p>
          </div>
        </div>

        <div class="storage-actions">
          <el-button
            type="primary"
            :loading="pathLoading"
            @click="selectDataPath"
          >
            选择存储路径
          </el-button>
          <el-button
            :disabled="!hasCustomPath"
            :loading="pathLoading"
            @click="resetDataPath"
          >
            恢复默认路径
          </el-button>
          <el-button @click="openDataPath">
            打开存储目录
          </el-button>
        </div>
        </div>

        <div
          v-show="activePage === 'api'"
          class="settings-section"
        >
        <div class="api-panel-head">
          <el-tag
            :type="isConfigured ? 'success' : 'danger'"
            size="small"
          >
            {{ isConfigured ? '已配置' : '未配置' }}
          </el-tag>
        </div>

        <div class="config-type-selector">
          <el-radio-group
            v-model="configType"
            @change="handleConfigTypeChange"
          >
            <el-radio-button value="official">
              优尚API
            </el-radio-button>
            <el-radio-button value="flow2">
              Flow2API
            </el-radio-button>
          </el-radio-group>
        </div>

        <div
          v-if="configType === 'official'"
          class="config-section"
        >
          <div class="section-tips">
            <h4>优尚API配置</h4>
            <p>推荐使用优尚API，稳定可靠，按次计费。</p>
            <el-button
              type="primary"
              size="small"
              link
              @click="openPurchaseLink"
            >
              前往购买API密钥
            </el-button>
          </div>

          <el-form
            :model="officialForm"
            label-width="100px"
            size="default"
            class="config-form"
          >
            <el-form-item
              label="API密钥"
              required
            >
              <el-input
                v-model="officialForm.apiKey"
                type="password"
                placeholder="请输入API密钥"
                show-password
                clearable
                style="max-width: 400px"
              />
            </el-form-item>

            <el-form-item label="API地址">
              <el-input
                v-model="officialForm.baseURL"
                placeholder="https://api.ussn.cn/v1"
                style="max-width: 400px"
              />
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                :loading="validating"
                @click="saveOfficialConfig"
              >
                {{ validating ? '验证中...' : '保存配置' }}
              </el-button>
              <el-button
                :loading="validating"
                @click="testOfficialConnection"
              >
                测试连接
              </el-button>
            </el-form-item>
          </el-form>
        </div>

        <div
          v-else
          class="config-section"
        >
          <div class="section-tips">
            <h4>Flow2API配置</h4>
            <p>启动本地Flow2服务，使用本地API进行生成。支持文字、图片、视频生成。</p>
          </div>

          <el-form
            :model="flow2Form"
            label-width="100px"
            size="default"
            class="config-form"
          >
            <el-form-item label="API密钥">
              <el-input
                v-model="flow2Form.apiKey"
                placeholder="请输入API密钥（可选）"
                clearable
                style="max-width: 400px"
              />
            </el-form-item>

            <el-form-item label="API地址">
              <el-input
                v-model="flow2Form.baseURL"
                placeholder="http://localhost:8000"
                clearable
                style="max-width: 400px"
              />
            </el-form-item>

            <el-form-item label="服务状态">
              <div class="service-status">
                <el-tag
                  :type="flow2ServiceStatus === 'running' ? 'success' : flow2ServiceStatus === 'stopped' ? 'danger' : 'info'"
                  size="large"
                >
                  {{ flow2ServiceStatusText }}
                </el-tag>
              </div>
            </el-form-item>

            <el-form-item label="服务控制">
              <div class="service-controls">
                <el-button 
                  type="primary" 
                  :loading="flow2ServiceStatus === 'starting'" 
                  :disabled="flow2ServiceStatus === 'running'"
                  @click="startFlow2Service"
                >
                  启动服务
                </el-button>
                <el-button 
                  type="danger" 
                  :disabled="flow2ServiceStatus !== 'running'"
                  @click="stopFlow2Service"
                >
                  停止服务
                </el-button>
                <el-button 
                  @click="openFlow2Dashboard"
                >
                  管理后台
                </el-button>
              </div>
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                :loading="validating"
                @click="saveFlow2Config"
              >
                {{ validating ? '验证中...' : '保存配置' }}
              </el-button>
              <el-button
                :loading="validating"
                @click="testFlow2Connection"
              >
                测试连接
              </el-button>
            </el-form-item>
          </el-form>
        </div>

        <div class="api-usage-guide">
          <h4 class="guide-title">API使用说明</h4>
          <div class="guide-content">
            <div class="guide-step">
              <div class="step-number">1</div>
              <div class="step-content">
                <p class="step-title">获取API密钥</p>
                <p class="step-desc">点击"前往购买API密钥"注册账号登录，然后点击【API令牌】新建令牌，点击密钥后面的复制按钮填写到软件API密钥处，点击保存</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="step-number">2</div>
              <div class="step-content">
                <p class="step-title">设置API密钥分组</p>
                <p class="step-desc">需要单独对API密钥的分组进行设置，点击对应的API密钥后面的编辑，在【分组优先级】的地方添加分组</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="step-number">3</div>
              <div class="step-content">
                <p class="step-title">推荐API分组顺序</p>
                <p class="step-desc">推荐API分组前后顺序为：限时特价，逆向，纯AZ，官转gemini，官转OpenAI，sora-vip，优质官转OpenAI，优质gpt，优质grok</p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { useApiConfigStore } from '@/stores/apiConfigStore'
import { useUserStore } from '@/stores/userStore'
import apiService from '@/services/apiService'

const store = useApiConfigStore()
const userStore = useUserStore()
const activePage = ref<'storage' | 'api'>('storage')
const validating = ref(false)
const configType = ref<'official' | 'flow2'>('official')

const flow2ServiceStatus = ref<'stopped' | 'starting' | 'running' | 'stopping'>('stopped')
let flow2StatusCheckInterval: ReturnType<typeof setInterval> | null = null

const currentDataPath = ref('')
const defaultDataPath = ref('')
const pathLoading = ref(false)

const hasCustomPath = computed(() => {
  return currentDataPath.value && currentDataPath.value !== defaultDataPath.value
})

const loadDataPaths = async () => {
  if (window.electronAPI?.dataPath) {
    try {
      currentDataPath.value = await window.electronAPI.dataPath.getCurrent()
      defaultDataPath.value = await window.electronAPI.dataPath.getDefault()
    } catch (error) {
      console.error('获取存储路径失败:', error)
    }
  }
}

const selectDataPath = async () => {
  if (!window.electronAPI?.dialog?.selectFolder) {
    ElMessage.warning('请在 Electron 环境中使用此功能')
    return
  }

  pathLoading.value = true
  try {
    const result = await window.electronAPI.dialog.selectFolder()
    if (!result.canceled && result.filePaths.length > 0) {
      const newPath = result.filePaths[0]
      const setResult = await window.electronAPI.dataPath!.set(newPath)
      if (setResult.success) {
        ElMessage.success(setResult.message)
        await loadDataPaths()
      } else {
        ElMessage.error(setResult.message)
      }
    }
  } catch (error) {
    ElMessage.error('选择路径失败')
  } finally {
    pathLoading.value = false
  }
}

const resetDataPath = async () => {
  if (!window.electronAPI?.dataPath) {
    return
  }

  pathLoading.value = true
  try {
    const result = await window.electronAPI.dataPath.reset()
    if (result.success) {
      ElMessage.success(result.message)
      await loadDataPaths()
    } else {
      ElMessage.error(result.message)
    }
  } catch (error) {
    ElMessage.error('恢复默认路径失败')
  } finally {
    pathLoading.value = false
  }
}

const openDataPath = () => {
  if (currentDataPath.value) {
    window.open(`file://${currentDataPath.value}`, '_blank')
  }
}

const officialForm = reactive({
  apiKey: '',
  baseURL: 'https://api.ussn.cn/v1'
})

const flow2Form = reactive({
  apiKey: '',
  baseURL: 'http://localhost:8001'
})

const isConfigured = computed(() => {
  if (configType.value === 'official') {
    return !!officialForm.apiKey
  } else {
    return !!flow2Form.baseURL
  }
})

const flow2ServiceStatusText = computed(() => {
  switch (flow2ServiceStatus.value) {
    case 'stopped': return '未运行'
    case 'starting': return '启动中...'
    case 'running': return '运行中'
    case 'stopping': return '停止中...'
    default: return '未知'
  }
})

const openPurchaseLink = () => {
  window.open('https://api.ussn.cn/register?aff=xkUd', '_blank')
}

const handleConfigTypeChange = (val: string | number | boolean | undefined) => {
  const type = val as 'official' | 'flow2'
  configType.value = type
  store.setConfigType(type)
}

const saveOfficialConfig = async () => {
  if (!officialForm.apiKey) {
    ElMessage.warning('请输入API密钥')
    return
  }

  validating.value = true
  try {
    store.updateOfficialConfig({ 
      apiKey: officialForm.apiKey,
      baseURL: officialForm.baseURL,
      maxTokens: null,
      unlimitedTokens: true,
      temperature: 0.7
    })
    store.setConfigType('official')
    ElMessage.success('配置保存成功')
  } catch (error) {
    if (error instanceof Error) {
      ElMessage.error('配置保存失败：' + error.message)
    }
  } finally {
    validating.value = false
  }
}

const testOfficialConnection = async () => {
  if (!officialForm.apiKey) {
    ElMessage.warning('请先输入API密钥')
    return
  }

  validating.value = true
  try {
    store.updateOfficialConfig({ 
      apiKey: officialForm.apiKey,
      baseURL: officialForm.baseURL,
      maxTokens: null,
      unlimitedTokens: true,
      temperature: 0.7
    })
    store.setConfigType('official')

    const isValid = await apiService.validateApiKey()
    if (isValid) {
      ElMessage.success('连接测试成功')
    } else {
      ElMessage.error('连接测试失败')
    }
  } catch (error) {
    if (error instanceof Error) {
      ElMessage.error('连接测试失败：' + error.message)
    }
  } finally {
    validating.value = false
  }
}

const saveFlow2Config = async () => {
  if (!flow2Form.baseURL) {
    ElMessage.warning('请输入API地址')
    return
  }

  validating.value = true
  try {
    store.updateCustomConfig({
      apiKey: flow2Form.apiKey,
      baseURL: flow2Form.baseURL,
      selectedModel: 'gpt-3.5-turbo',
      maxTokens: 4096,
      unlimitedTokens: false,
      temperature: 0.7
    })
    store.setConfigType('flow2')
    ElMessage.success('配置保存成功')
  } catch (error) {
    if (error instanceof Error) {
      ElMessage.error('配置保存失败：' + error.message)
    }
  } finally {
    validating.value = false
  }
}

const testFlow2Connection = async () => {
  if (!flow2Form.baseURL) {
    ElMessage.warning('请先输入API地址')
    return
  }

  validating.value = true
  try {
    store.updateCustomConfig({
      apiKey: flow2Form.apiKey,
      baseURL: flow2Form.baseURL,
      selectedModel: 'gpt-3.5-turbo',
      maxTokens: 4096,
      unlimitedTokens: false,
      temperature: 0.7
    })
    store.setConfigType('flow2')

    const response = await fetch(`${flow2Form.baseURL}/docs`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    })
    
    if (response.ok || response.status === 200) {
      ElMessage.success('Flow2服务连接成功')
    } else {
      ElMessage.error('Flow2服务连接失败')
    }
  } catch (error) {
    ElMessage.error('Flow2服务连接失败，请确保服务已启动')
  } finally {
    validating.value = false
  }
}

const checkFlow2Status = async () => {
  if (configType.value !== 'flow2') {
    return
  }
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    
    const response = await fetch(`${flow2Form.baseURL}/docs`, {
      method: 'GET',
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (response.ok || response.status === 200) {
      flow2ServiceStatus.value = 'running'
      if (flow2StatusCheckInterval) {
        clearInterval(flow2StatusCheckInterval)
        flow2StatusCheckInterval = null
      }
    }
  } catch {
    flow2ServiceStatus.value = 'stopped'
  }
}

const startFlow2Service = async () => {
  flow2ServiceStatus.value = 'starting'
  
  try {
    ElMessage.info('请手动启动Flow2服务，或配置Electron主进程进行管理')
    
    setTimeout(() => {
      checkFlow2Status()
    }, 3000)
  } catch (error) {
    console.error('启动Flow2失败:', error)
    flow2ServiceStatus.value = 'stopped'
    ElMessage.error('Flow2服务启动失败')
  }
}

const stopFlow2Service = async () => {
  flow2ServiceStatus.value = 'stopping'
  
  try {
    ElMessage.info('请手动停止Flow2服务，或配置Electron主进程进行管理')
    flow2ServiceStatus.value = 'stopped'
  } catch (error) {
    console.error('停止Flow2失败:', error)
    flow2ServiceStatus.value = 'running'
    ElMessage.error('Flow2服务停止失败')
  }
}

const openFlow2Dashboard = () => {
  window.open(`${flow2Form.baseURL}`, '_blank')
}

const loadConfig = () => {
  configType.value = store.configType

  if (store.officialConfig) {
    officialForm.apiKey = store.officialConfig.apiKey
    officialForm.baseURL = store.officialConfig.baseURL || 'https://api.ussn.cn/v1'
  }

  if (store.customConfig) {
    flow2Form.apiKey = store.customConfig.apiKey
    flow2Form.baseURL = store.customConfig.baseURL || 'http://localhost:8001'
  }

  checkFlow2Status()
}

onMounted(() => {
  loadConfig()
  checkFlow2Status()
  loadDataPaths()
})

onBeforeUnmount(() => {
  if (flow2StatusCheckInterval) {
    clearInterval(flow2StatusCheckInterval)
  }
})
</script>

<style scoped>
.settings-page {
  width: 100%;
  min-width: 800px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
  overflow: hidden;
}

.settings-layout {
  flex: 1;
  display: flex;
  min-height: 0;
}

.settings-sidebar {
  width: 200px;
  flex-shrink: 0;
  padding: 20px 16px;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-sidebar-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 12px 14px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.nav-item:hover {
  background-color: rgba(102, 126, 234, 0.1);
  color: var(--primary-color);
}

.nav-item.active {
  background-color: rgba(102, 126, 234, 0.15);
  color: var(--primary-color);
  font-weight: 600;
}

.settings-main {
  flex: 1;
  min-width: 800px;
  overflow-y: auto;
  padding: 24px;
}

.important-warning {
  color: #ff5555;
    font-size: 15px;
    font-weight: bold;
}

.important-warning strong {
  color: #f56c6c;
  font-weight: 600;
}

.settings-section {
  background-color: var(--bg-secondary);
  border-radius: 12px;
  padding: 24px;
  max-width: 880px;
}

.api-panel-head {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.section-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.config-type-selector {
  margin-bottom: 24px;
}

.config-type-selector :deep(.el-radio-button__inner) {
  padding: 10px 20px;
}

.config-section {
  margin-top: 20px;
}

.section-tips {
  margin-bottom: 24px;
  padding: 16px;
  background-color: var(--bg-color);
  border-radius: 8px;
}

.section-tips h4 {
  margin: 0 0 8px 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.section-tips p {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.config-form {
  margin-top: 20px;
}

.service-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.service-controls {
  display: flex;
  gap: 12px;
}

.storage-info {
  margin-bottom: 20px;
}

.storage-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
  gap: 8px;
}

.storage-label {
  font-size: 14px;
  color: var(--text-secondary);
  flex-shrink: 0;
  min-width: 100px;
}

.storage-value {
  font-size: 14px;
  color: var(--text-primary);
  word-break: break-all;
  font-family: monospace;
  background-color: var(--bg-color);
  padding: 8px 12px;
  border-radius: 6px;
  flex: 1;
}

.storage-value.default {
  color: var(--text-muted);
}

.storage-tips {
  margin-top: 16px;
  padding: 16px;
  background-color: var(--bg-color);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.storage-tips p {
  margin: 0 0 8px 0;
}

.storage-tips ul {
  margin: 8px 0;
  padding-left: 20px;
}

.storage-tips li {
  margin-bottom: 4px;
}

.storage-tips .platform-default {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
  color: var(--text-muted);
  font-size: 12px;
}

.storage-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.api-usage-guide {
  margin-top: 32px;
  padding: 24px;
  background-color: var(--bg-color);
  border-radius: 8px;
}

.guide-title {
  margin: 0 0 20px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.guide-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.guide-step {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.step-number {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.step-content {
  flex: 1;
}

.step-title {
  margin: 0 0 6px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.step-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

</style>
