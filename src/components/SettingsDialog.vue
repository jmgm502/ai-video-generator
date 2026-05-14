<template>
  <el-dialog
    v-model="visible"
    :show-close="false"
    :close-on-click-modal="true"
    :close-on-press-escape="true"
    class="settings-dialog"
    @close="handleClose"
  >
    <div class="settings-container">
      <button
        type="button"
        class="settings-dialog-close settings-dialog-close--floating"
        :aria-label="t('settings.ariaCloseDialog')"
        @click="handleClose"
      >
        <el-icon><Close /></el-icon>
      </button>
      <div class="settings-sidebar">
        <div class="settings-sidebar-head">
          <span class="settings-sidebar-title">{{ t('settings.sidebarTitle') }}</span>
        </div>
        <div
          :class="['sidebar-item', { active: activeTab === 'profile' }]"
          @click="activeTab = 'profile'"
        >
          <el-icon><User /></el-icon>
          <span>{{ t('settings.tabProfile') }}</span>
        </div>
        <div
          :class="['sidebar-item', { active: activeTab === 'storage' }]"
          @click="activeTab = 'storage'"
        >
          <el-icon><FolderOpened /></el-icon>
          <span>{{ t('settings.tabStorage') }}</span>
        </div>
        <div
          :class="['sidebar-item', { active: activeTab === 'api' }]"
          @click="activeTab = 'api'"
        >
          <el-icon><Connection /></el-icon>
          <span>{{ t('settings.tabApi') }}</span>
        </div>
        <div
          :class="['sidebar-item', { active: activeTab === 'model' }]"
          @click="activeTab = 'model'"
        >
          <el-icon><Operation /></el-icon>
          <span>{{ t('settings.tabModel') }}</span>
        </div>
        <div
          :class="['sidebar-item', { active: activeTab === 'interface' }]"
          @click="activeTab = 'interface'"
        >
          <el-icon><Monitor /></el-icon>
          <span>{{ t('settings.tabInterface') }}</span>
        </div>
        <div
          :class="['sidebar-item', { active: activeTab === 'about' }]"
          @click="activeTab = 'about'"
        >
          <el-icon><InfoFilled /></el-icon>
          <span>{{ t('settings.tabAbout') }}</span>
        </div>
      </div>

      <div class="settings-main">
        <div
          v-show="activeTab === 'profile'"
          class="settings-content"
        >
          <div class="profile-section">
            <div class="profile-header">
              <el-avatar
                :size="80"
                :src="userStore.userAvatar"
                :icon="User"
              />
              <div class="profile-basic">
                <h3 class="profile-name">
                  {{ userStore.userName || t('settings.profile.notLoggedIn') }}
                </h3>
                <div class="profile-tags">
                  <el-tag
                    :type="userStore.userGroup === 'vip' ? 'warning' : 'info'"
                    size="small"
                  >
                    {{ userStore.userGroup === 'vip' ? t('settings.profile.badgeVip') : t('settings.profile.badgeNormal') }}
                  </el-tag>
                  <el-button
                    type="primary"
                    size="small"
                    style="margin-left: 8px;"
                    @click="showVipDialog = true"
                  >
                    {{ userStore.userGroup === 'vip' ? t('settings.profile.renewVip') : t('settings.profile.upgradeVip') }}
                  </el-button>
                </div>
              </div>
            </div>
            
            <el-divider />

            <div class="profile-info-grid">
              <div class="info-item">
                <span class="info-label">{{ t('settings.profile.loginEmail') }}</span>
                <span class="info-value">{{ userStore.userEmail || t('settings.dataStorage.notSet') }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">{{ t('settings.profile.createdAt') }}</span>
                <span class="info-value">{{ userStore.createdAt || t('settings.profile.unknown') }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">{{ t('settings.profile.lastLogin') }}</span>
                <span class="info-value">{{ userStore.lastLoginAt || t('settings.profile.unknown') }}</span>
              </div>
              <div
                v-if="userStore.userGroup === 'vip'"
                class="info-item"
              >
                <span class="info-label">{{ t('settings.profile.vipExpire') }}</span>
                <span class="info-value vip-expire">{{ userStore.vipExpireAt || t('settings.profile.forever') }}</span>
              </div>
            </div>
            
            <el-divider />

            <div class="profile-tabs">
              <button
                type="button"
                :class="['profile-tab-btn', { active: profileActiveTab === 'assets' }]"
                @click="profileActiveTab = 'assets'"
              >
                <el-icon><Star /></el-icon>
                <span>{{ t('settings.profile.tabAssets') }}</span>
              </button>
              <button
                type="button"
                :class="['profile-tab-btn', { active: profileActiveTab === 'password' }]"
                @click="profileActiveTab = 'password'"
              >
                <el-icon><Lock /></el-icon>
                <span>{{ t('settings.profile.tabPassword') }}</span>
              </button>
              <button
                type="button"
                :class="['profile-tab-btn', { active: profileActiveTab === 'checkin' }]"
                @click="profileActiveTab = 'checkin'"
              >
                <el-icon><Calendar /></el-icon>
                <span>{{ t('settings.profile.tabCheckin') }}</span>
              </button>
            </div>

            <div v-show="profileActiveTab === 'assets'" class="profile-tab-content">
              <StarsAssets />
            </div>

            <div v-show="profileActiveTab === 'password'" class="profile-tab-content">
              <div class="profile-actions">
                <h4>{{ t('settings.profile.changePassword') }}</h4>
                <el-form
                  ref="passwordFormRef"
                  :model="passwordForm"
                  :rules="passwordRules"
                  label-width="100px"
                  class="password-form"
                >
                  <el-form-item
                    :label="t('settings.profile.currentPassword')"
                    prop="oldPassword"
                  >
                    <el-input
                      v-model="passwordForm.oldPassword"
                      type="password"
                      :placeholder="t('settings.profile.phCurrentPassword')"
                      show-password
                    />
                  </el-form-item>
                  <el-form-item
                    :label="t('settings.profile.newPassword')"
                    prop="newPassword"
                  >
                    <el-input
                      v-model="passwordForm.newPassword"
                      type="password"
                      :placeholder="t('settings.profile.phNewPassword')"
                      show-password
                    />
                  </el-form-item>
                  <el-form-item
                    :label="t('settings.profile.confirmPasswordLabel')"
                    prop="confirmPassword"
                  >
                    <el-input
                      v-model="passwordForm.confirmPassword"
                      type="password"
                      :placeholder="t('settings.profile.phConfirmPassword')"
                      show-password
                    />
                  </el-form-item>
                  <el-form-item>
                    <el-button
                      type="primary"
                      :loading="passwordLoading"
                      @click="handleChangePassword"
                    >
                      {{ t('settings.profile.btnChangePassword') }}
                    </el-button>
                  </el-form-item>
                </el-form>
              </div>
            </div>

            <div v-show="profileActiveTab === 'checkin'" class="profile-tab-content">
              <DailyCheckin />
            </div>

            <div class="profile-logout-footer">
              <el-button
                type="danger"
                size="small"
                plain
                @click="handleLogout"
              >
                {{ t('settings.profile.logout') }}
              </el-button>
            </div>
          </div>
        </div>

        <div
          v-show="activeTab === 'storage'"
          class="settings-content"
        >
          <div class="important-warning">
            <strong>重要提醒:</strong> 所有本地目录和文件路径都禁止使用中文，否则可能出现素材库图片无法加载等问题。
          </div>
          <div class="storage-section">
            <div class="section-header">
              <el-icon><FolderOpened /></el-icon>
              <span>{{ t('settings.tabStorage') }}</span>
            </div>
            <div class="section-body">
              <div class="storage-item-row">
                <span class="item-label">{{ t('settings.dataStorage.labelCurrentPath') }}</span>
                <span class="item-value path-value">{{ currentDataPath || t('settings.dataStorage.loading') }}</span>
                <div class="item-actions">
                  <el-button
                    size="small"
                    type="primary"
                    :loading="pathLoading"
                    @click="selectDataPath"
                  >
                    {{ t('settings.dataStorage.btnSelect') }}
                  </el-button>
                  <el-button
                    size="small"
                    @click="openDataPath"
                  >
                    {{ t('settings.dataStorage.btnOpen') }}
                  </el-button>
                </div>
              </div>
              <div class="storage-item-row">
                <span class="item-label">{{ t('settings.dataStorage.labelDefaultPath') }}</span>
                <span class="item-value path-value default">{{ defaultDataPath || t('settings.dataStorage.loading') }}</span>
                <div class="item-actions">
                  <el-button
                    size="small"
                    :disabled="!hasCustomPath"
                    :loading="pathLoading"
                    @click="resetDataPath"
                  >
                    {{ t('settings.dataStorage.btnRestoreDefault') }}
                  </el-button>
                </div>
              </div>
              <div class="storage-tips-container">
                <div class="storage-tips">
                  <p><strong>{{ t('settings.dataStorage.tipsHeading') }}</strong></p>
                  <ul>
                    <li>{{ t('settings.dataStorage.tipStoredPath') }}</li>
                    <li>{{ t('settings.dataStorage.tipMigrate') }}</li>
                    <li>{{ t('settings.dataStorage.tipDiskSpace') }}</li>
                  </ul>
                </div>
                <div class="storage-tips platform-info">
                  <p><strong>{{ t('settings.dataStorage.defaultLocationHeading') }}</strong></p>
                  <p class="platform-item">Windows: %APPDATA%\ai-video-generator\</p>
                  <p class="platform-item">macOS: ~/Library/Application Support/ai-video-generator/</p>
                  <p class="platform-item">Linux: ~/.config/ai-video-generator/</p>
                </div>
              </div>
            </div>
          </div>

          <div class="jianying-section">
            <div class="section-header">
              <el-icon><VideoPlay /></el-icon>
              <span>{{ t('settings.dataStorage.jianyingSectionTitle') }}</span>
            </div>
            <div class="section-body">
              <div class="jianying-item-row">
                <span class="item-label">{{ t('settings.dataStorage.labelDraftPath') }}</span>
                <span class="item-value path-value">{{ userStore.jianyingDraftPath || t('settings.dataStorage.notSet') }}</span>
                <div class="item-actions">
                  <el-button
                    size="small"
                    type="primary"
                    :loading="jianyingPathLoading"
                    @click="selectJianyingDraftPath"
                  >
                    {{ t('settings.dataStorage.btnSelect') }}
                  </el-button>
                  <el-button
                    size="small"
                    :disabled="!userStore.jianyingDraftPath"
                    @click="openJianyingDraftPath"
                  >
                    {{ t('settings.dataStorage.btnOpen') }}
                  </el-button>
                </div>
              </div>
              <div class="jianying-tips">
                <p>{{ t('settings.dataStorage.jianyingIntro') }}</p>
                <p class="platform-default">
                  <strong>{{ t('settings.dataStorage.defaultDraftLocationHeading') }}</strong><br>
                  Windows: %LOCALAPPDATA%\JianYingPro\draft\<br>
                  macOS: ~/Library/Application Support/JianYingPro/draft/
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          v-show="activeTab === 'api'"
          class="settings-content"
        >
          <div class="config-type-selector">
            <el-radio-group
              v-model="configType"
              @change="(val: any) => handleConfigTypeChange(val)"
            >
              <el-radio-button value="official">
                {{ t('settings.api.tabYoushang') }}
                <span :class="officialForm.apiKey ? 'config-dot configured' : 'config-dot unconfigured'"></span>
              </el-radio-button>
              <el-radio-button value="flow2">
                {{ t('settings.api.tabFlow2') }}
                <span :class="flow2Form.baseURL ? 'config-dot configured' : 'config-dot unconfigured'"></span>
              </el-radio-button>
              <el-radio-button value="aliyun">
                阿里云
                <span :class="aliyunForm.apiKey ? 'config-dot configured' : 'config-dot unconfigured'"></span>
              </el-radio-button>
            </el-radio-group>
          </div>

          <div
            v-if="configType === 'official'"
            class="config-section"
          >
            <div class="section-tips">
              <h4>{{ t('settings.api.officialHeading') }}</h4>
              <p>{{ t('settings.api.officialIntro') }}</p>
            </div>

            <el-form
              :model="officialForm"
              label-width="100px"
              size="default"
              class="config-form"
            >
              <el-form-item
                :label="t('settings.api.labelApiKey')"
                required
              >
                <el-input
                  v-model="officialForm.apiKey"
                  type="password"
                  :placeholder="t('settings.api.phApiKey')"
                  show-password
                  clearable
                  style="flex: 1;"
                />
                <el-button
                  type="primary"
                  style="margin-left: 12px;"
                  @click="openPurchaseLink"
                >
                  {{ t('settings.api.getApiKey') }}
                </el-button>
              </el-form-item>

              <el-form-item :label="t('settings.api.labelApiUrl')">
                <div class="api-url-row">
                  <el-input
                    v-model="officialForm.baseURL"
                    placeholder="https://api.ussn.cn/v1"
                    style="flex: 1;"
                  />
                  <el-button
                    type="primary"
                    :loading="validating"
                    style="margin-left: 12px;"
                    @click="saveOfficialConfig"
                  >
                    {{ validating ? t('settings.api.validating') : t('settings.api.saveConfig') }}
                  </el-button>
                  <el-button
                    :loading="validating"
                    style="margin-left: 8px;"
                    @click="testOfficialConnection"
                  >
                    {{ t('settings.api.testConnection') }}
                  </el-button>
                </div>
              </el-form-item>
            </el-form>
            
            <div class="api-usage-guide">
              <h4 class="guide-title">API使用说明</h4>
              <div class="guide-content">
                <div class="guide-step">
                  <div class="step-number">1</div>
                  <div class="step-content">
                    <p class="step-title">获取API密钥</p>
                    <p class="step-desc">点击"获取密钥"注册账号登录，然后点击【API令牌】新建令牌，点击密钥后面的复制按钮填写到软件API密钥处，点击保存</p>
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

          <div
            v-else-if="configType === 'flow2'"
            class="config-section"
          >
            <div class="section-tips">
              <h4>
                {{ t('settings.api.flowHeading') }}
                <el-button
                  type="primary"
                  link
                  size="small"
                  @click="showFlow2GuideDialog"
                >
                  文字使用说明
                </el-button>
                <el-button
                  type="success"
                  link
                  size="small"
                  @click="openVideoGuide"
                >
                  视频使用说明
                </el-button>
              </h4>
              <p>{{ t('settings.api.flowIntro') }}</p>
            </div>

            <el-form
              :model="flow2Form"
              label-width="100px"
              size="default"
              class="config-form"
            >
              <el-form-item :label="t('settings.api.labelApiKey')">
                <el-input
                  v-model="flow2Form.apiKey"
                  :placeholder="t('settings.api.phApiKeyOptional')"
                  clearable
                  style="flex: 1;"
                />
                <el-button
                  type="primary"
                  link
                  style="margin-left: 8px;"
                  @click="openYesCaptchaPurchase"
                >
                  购买 YesCaptcha API 密钥
                </el-button>
              </el-form-item>

              <el-form-item :label="t('settings.api.labelApiUrl')">
                <span style="margin-right: 8px; color: #606266;">http://localhost:</span>
                <el-input
                  v-model="flow2Port"
                  placeholder="8001"
                  clearable
                  style="width: 120px;"
                />
                <el-button
                  type="primary"
                  :loading="validating"
                  style="margin-left: 12px;"
                  @click="saveFlow2Config"
                >
                  {{ validating ? t('settings.api.validating') : t('settings.api.saveConfig') }}
                </el-button>
              </el-form-item>

              <el-form-item :label="t('settings.api.labelServiceControl')">
                <div class="service-controls">
                  <el-button
                    :loading="validating"
                    @click="testFlow2Connection"
                  >
                    {{ t('settings.api.testConnection') }}
                  </el-button>
                  <el-button 
                    type="primary" 
                    :loading="flow2ServiceStatus === 'starting'" 
                    :disabled="flow2ServiceStatus === 'running'"
                    @click="startFlow2Service"
                  >
                    {{ t('settings.api.btnStartService') }}
                  </el-button>
                  <el-button 
                    type="danger" 
                    :disabled="flow2ServiceStatus !== 'running'"
                    @click="stopFlow2Service"
                  >
                    {{ t('settings.api.btnStopService') }}
                  </el-button>
                  <el-button 
                    @click="openFlow2Dashboard"
                  >
                    {{ t('settings.api.btnAdminDashboard') }}
                  </el-button>
                  <div class="service-status-right">
                    <el-tag
                      :type="flow2ServiceStatus === 'running' ? 'success' : flow2ServiceStatus === 'stopped' ? 'danger' : 'info'"
                      size="large"
                    >
                      {{ flow2ServiceStatusText }}
                    </el-tag>
                  </div>
                </div>
              </el-form-item>
            </el-form>
            
            <div class="api-usage-guide">
              <h4 class="guide-title">Flow2API 使用说明</h4>
              <div class="guide-content">
                <div class="guide-step">
                  <div class="step-number">1</div>
                  <div class="step-content">
                    <p class="step-title">安装 Python</p>
                    <p class="step-desc">确保已安装 Python 3.8 或更高版本，建议安装在默认位置</p>
                  </div>
                </div>
                <div class="guide-step">
                  <div class="step-number">2</div>
                  <div class="step-content">
                    <p class="step-title">配置端口</p>
                    <p class="step-desc">在 API 地址处设置 Flow2API 的访问地址（如 http://localhost:8001），确保端口可用</p>
                  </div>
                </div>
                <div class="guide-step">
                  <div class="step-number">3</div>
                  <div class="step-content">
                    <p class="step-title">启动服务</p>
                    <p class="step-desc">点击"启动服务"按钮，软件会自动在后台启动 Flow2API 服务（首次启动会自动安装依赖）</p>
                  </div>
                </div>
                <div class="guide-step">
                  <div class="step-number">4</div>
                  <div class="step-content">
                    <p class="step-title">管理面板</p>
                    <p class="step-desc">服务启动后，可点击"管理面板"按钮打开 Flow2API 的 Web 管理界面，账号：admin 密码：admin</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-else-if="configType === 'aliyun'"
            class="config-section"
          >
            <div class="section-tips">
              <h4>阿里云</h4>
              <p>直接连接阿里云百炼 API，支持图片编辑/视角调整等功能</p>
            </div>

            <el-form
              :model="aliyunForm"
              label-width="100px"
              size="default"
              class="config-form"
            >
              <el-form-item label="API Key" required>
                <el-input
                  v-model="aliyunForm.apiKey"
                  type="password"
                  placeholder="请输入阿里云百炼 API Key"
                  show-password
                  clearable
                  style="flex: 1;"
                />
              </el-form-item>

              <el-form-item label="API 地址" required>
                <div class="api-url-row">
                  <el-input
                    v-model="aliyunForm.baseURL"
                    placeholder="https://dashscope.aliyuncs.com/api/v1"
                    style="flex: 1;"
                  />
                  <el-button
                    type="primary"
                    :loading="validating"
                    style="margin-left: 12px;"
                    @click="saveAliyunConfig"
                  >
                    {{ validating ? t('settings.api.validating') : t('settings.api.saveConfig') }}
                  </el-button>
                  <el-button
                    :loading="validating"
                    style="margin-left: 8px;"
                    @click="testAliyunConnection"
                  >
                    {{ t('settings.api.testConnection') }}
                  </el-button>
                </div>
              </el-form-item>
            </el-form>
            
            <div class="api-usage-guide">
              <h4 class="guide-title">使用说明</h4>
              <div class="guide-content">
                <div class="guide-step">
                  <div class="step-number">1</div>
                  <div class="step-content">
                    <p class="step-title">获取 API Key</p>
                    <p class="step-desc">访问 https://help.aliyun.com/model-studio/get-api-key 注册并获取您的 API Key</p>
                  </div>
                </div>
                <div class="guide-step">
                  <div class="step-number">2</div>
                  <div class="step-content">
                    <p class="step-title">配置 Base URL</p>
                    <p class="step-desc">使用 https://dashscope.aliyuncs.com/api/v1 或根据需要使用 https://dashscope-intl.aliyuncs.com/api/v1 (国际版)</p>
                  </div>
                </div>
                <div class="guide-step">
                  <div class="step-number">3</div>
                  <div class="step-content">
                    <p class="step-title">使用功能</p>
                    <p class="step-desc">支持 qwen-image-edit-max 模型用于图片编辑、视角调整、图片生成等功能</p>
                  </div>
                </div>
              </div>
            </div>
          </div>


        </div>

        <div
          v-show="activeTab === 'model'"
          class="settings-content"
        >
          <div class="model-manager">
            <!-- 模型类型横向 Tab -->
            <div class="model-type-tabs">
              <button
                type="button"
                :class="['model-type-tab', { active: modelActiveTab === 'text' }]"
                @click="modelActiveTab = 'text'"
              >
                <span>{{ t('settings.model.textModel') }}</span>
              </button>
              <button
                type="button"
                :class="['model-type-tab', { active: modelActiveTab === 'image' }]"
                @click="modelActiveTab = 'image'"
              >
                <span>{{ t('settings.model.imageModel') }}</span>
              </button>
              <button
                type="button"
                :class="['model-type-tab', { active: modelActiveTab === 'video' }]"
                @click="modelActiveTab = 'video'"
              >
                <span>{{ t('settings.model.videoModel') }}</span>
              </button>
              <button
                type="button"
                :class="['model-type-tab', { active: modelActiveTab === 'vision' }]"
                @click="modelActiveTab = 'vision'"
              >
                <span>{{ t('settings.model.visionModel') }}</span>
              </button>
            </div>

            <!-- 文字模型 -->
            <div v-show="modelActiveTab === 'text'" class="model-panel">
              <div class="model-panel-section">
                <div class="model-panel-label">{{ t('settings.model.modelGroup') }}</div>
                <div class="model-group-radios">
                  <label
                    :class="['model-group-radio', { active: modelGroup.text === 'youshang' }]"
                    @click="modelGroup.text = 'youshang'"
                  >
                    <span class="radio-dot"></span>
                    <span>{{ t('settings.model.groupYoushang') }}</span>
                  </label>
                </div>
              </div>
              <div class="model-panel-section">
                <div class="model-panel-label">{{ t('settings.model.modelPick') }}</div>
                <div class="model-list">
                  <label
                    v-for="model in textModels"
                    :key="model.id"
                    :class="['model-item', { active: selectedTextModel === model.id }]"
                    @click="selectedTextModel = model.id"
                  >
                    <span class="radio-dot"></span>
                    <span class="model-icon" :class="`platform-${getModelPlatformBadge(model.id, model.name).key}`">
                      <svg v-if="getModelPlatformBadge(model.id, model.name).key === 'kling'" viewBox="0 0 24 24" style="width: 18px; height: 18px;">
                        <path d="M5.4 13.8A23.2 23.2 0 017.4 9.3c3.2-5.5 7.8-8.8 10.3-7.3C12-1.3 4.6 1 1.1 7a13.4 13.4 0 00-1 2.2c-.3.8.1 1.6.8 2l4.6 2.6z" fill="#04A6F0"/>
                        <path d="M18.6 10.2a23.2 23.2 0 01-2 4.5c-3.2 5.5-7.8 8.8-10.3 7.3 5.7 3.3 13.1 1.1 16.6-4.9a13.4 13.4 0 001-2.3c.3-.8-.1-1.6-.8-2l-4.5-2.6z" fill="#0DF35E"/>
                        <path d="M16.6 14.6c3.2-5.5 3.7-11.1 1.2-12.6C15.2.6 10.6 3.8 7.4 9.3c2-3.6 5.8-5.3 8.3-3.8 2.6 1.5 2.9 5.6.9 9.1z" fill="#003EFF"/>
                        <path d="M7.4 9.3c-3.2 5.5-3.7 11.1-1.2 12.6 2.6 1.5 7.2-1.8 10.4-7.3-2.1 3.6-5.9 5.3-8.4 3.9-2.5-1.4-2.9-5.6-.8-9.2z" fill="#0BFFE7"/>
                      </svg>
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'jimeng'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;">
                        <path d="M5.31 15.756c.172-3.75 1.883-5.999 2.549-6.739-3.26 2.058-5.425 5.658-6.358 8.308v1.12C1.501 21.513 4.226 24 7.59 24a6.59 6.59 0 002.2-.375c.353-.12.7-.248 1.039-.378.913-.899 1.65-1.91 2.243-2.992-4.877 2.431-7.974.072-7.763-4.5l.002.001z" fill="#1E37FC"/>
                        <path d="M22.57 10.283c-1.212-.901-4.109-2.404-7.397-2.8.295 3.792.093 8.766-2.1 12.773a12.782 12.782 0 01-2.244 2.992c3.764-1.448 6.746-3.457 8.596-5.219 2.82-2.683 3.353-5.178 3.361-6.66a2.737 2.737 0 00-.216-1.084v-.002z" fill="#37E1BE"/>
                        <path d="M14.303 1.867C12.955.7 11.248 0 9.39 0 7.532 0 5.883.677 4.545 1.807 2.791 3.29 1.627 5.557 1.5 8.125v9.201c.932-2.65 3.097-6.25 6.357-8.307.5-.318 1.025-.595 1.569-.829 1.883-.801 3.878-.932 5.746-.706-.222-2.83-.718-5.002-.87-5.617h.001z" fill="#A569FF"/>
                        <path d="M17.305 4.961a199.47 199.47 0 01-1.08-1.094c-.202-.213-.398-.419-.586-.622l-1.333-1.378c.151.615.648 2.786.869 5.617 3.288.395 6.185 1.898 7.396 2.8-1.306-1.275-3.475-3.487-5.266-5.323z" fill="#1E37FC"/>
                      </svg>
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'gpt'" fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24" style="width: 18px; height: 18px;">
                        <title>OpenAI</title>
                        <path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h-.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h-.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"></path>
                      </svg>
                      
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'banana'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;" aria-hidden="true">
                        <path d="M1.5 19.824c0-.548.444-.992.991-.992h.744a.991.991 0 010 1.983H2.49a.991.991 0 01-.991-.991z" fill="#F3AD61"/>
                        <path d="M14.837 13.5h7.076c.522 0 .784-.657.413-1.044l-1.634-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044zM3.587 13.5h7.076c.521 0 .784-.659.414-1.044l-1.635-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044z" fill="#F9C23C"/>
                        <path d="M12.525 1.521c3.69-.53 5.97 8.923 4.309 12.744-1.662 3.82-5.248 4.657-9.053 6.152a3.49 3.49 0 01-1.279.244c-1.443 0-2.227 1.187-2.774-.282-.707-1.9.22-4.031 2.069-4.757 2.014-.79 3.084-2.308 3.89-4.364.82-2.096.877-2.956.873-5.241-.003-1.827-.123-4.195 1.965-4.496z" fill="#FEEFC2"/>
                        <path d="M16.834 14.264l-7.095-3.257c-.815 1.873-2.29 3.308-4.156 4.043-2.16.848-3.605 3.171-2.422 5.54 2.364 4.727 13.673-.05 13.673-6.325z" fill="#FCD53F"/>
                        <path d="M13.68 12.362c.296.094.46.41.365.707-1.486 4.65-5.818 6.798-9.689 6.997a.562.562 0 11-.057-1.124c3.553-.182 7.372-2.138 8.674-6.216a.562.562 0 01.707-.364z" fill="#F9C23C"/>
                        <path d="M17.43 19.85l-7.648-8.835h6.753c1.595.08 2.846 1.433 2.846 3.073v5.664c0 .997-.898 1.302-1.95.098z" fill="#FFF478"/>
                      </svg>
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'gemini'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;">
                        <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF"/>
                      </svg>
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'deepseek'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;">
                        <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE"/>
                      </svg>
                      <template v-else>{{ getModelPlatformBadge(model.id, model.name).short }}</template>
                    </span>
                    <span class="model-item-name">{{ model.name }}</span>
                    <span v-if="model.price" class="model-item-price">{{ model.price }}</span>
                  </label>
                  <div v-if="textModels.length === 0" class="model-empty">
                    {{ t('settings.model.noModels') || '暂无可用模型' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 图片模型 -->
            <div v-show="modelActiveTab === 'image'" class="model-panel">
              <div class="model-panel-section">
                <div class="model-panel-label">{{ t('settings.model.modelGroup') }}</div>
                <div class="model-group-radios">
                  <label
                    :class="['model-group-radio', { active: modelGroup.image === 'youshang' }]"
                    @click="store.setImageModelGroup('youshang')"
                  >
                    <span class="radio-dot"></span>
                    <span>{{ t('settings.model.groupYoushang') }}</span>
                  </label>
                  <label
                    :class="['model-group-radio', { active: modelGroup.image === 'flow2' }]"
                    @click="store.setImageModelGroup('flow2')"
                  >
                    <span class="radio-dot"></span>
                    <span>{{ t('settings.model.groupFlow2') }}</span>
                  </label>
                  <label
                    :class="['model-group-radio', { active: modelGroup.image === 'aliyun' }]"
                    @click="store.setImageModelGroup('aliyun')"
                  >
                    <span class="radio-dot"></span>
                    <span>{{ t('settings.model.groupAliyun') }}</span>
                  </label>
                </div>
              </div>
              <div class="model-panel-section">
                <div class="model-panel-label">{{ t('settings.model.modelPick') }}</div>
                <div class="model-list">
                  <label
                    v-for="model in imageModels"
                    :key="model.id"
                    :class="['model-item', { active: selectedImageModel === model.id }]"
                    @click="selectedImageModel = model.id"
                  >
                    <span class="radio-dot"></span>
                    <span class="model-icon" :class="`platform-${getModelPlatformBadge(model.id, model.name).key}`">
                      <svg v-if="getModelPlatformBadge(model.id, model.name).key === 'kling'" viewBox="0 0 24 24" style="width: 18px; height: 18px;">
                        <path d="M5.4 13.8A23.2 23.2 0 017.4 9.3c3.2-5.5 7.8-8.8 10.3-7.3C12-1.3 4.6 1 1.1 7a13.4 13.4 0 00-1 2.2c-.3.8.1 1.6.8 2l4.6 2.6z" fill="#04A6F0"/>
                        <path d="M18.6 10.2a23.2 23.2 0 01-2 4.5c-3.2 5.5-7.8 8.8-10.3 7.3 5.7 3.3 13.1 1.1 16.6-4.9a13.4 13.4 0 001-2.3c.3-.8-.1-1.6-.8-2l-4.5-2.6z" fill="#0DF35E"/>
                        <path d="M16.6 14.6c3.2-5.5 3.7-11.1 1.2-12.6C15.2.6 10.6 3.8 7.4 9.3c2-3.6 5.8-5.3 8.3-3.8 2.6 1.5 2.9 5.6.9 9.1z" fill="#003EFF"/>
                        <path d="M7.4 9.3c-3.2 5.5-3.7 11.1-1.2 12.6 2.6 1.5 7.2-1.8 10.4-7.3-2.1 3.6-5.9 5.3-8.4 3.9-2.5-1.4-2.9-5.6-.8-9.2z" fill="#0BFFE7"/>
                      </svg>
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'jimeng'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;">
                        <path d="M5.31 15.756c.172-3.75 1.883-5.999 2.549-6.739-3.26 2.058-5.425 5.658-6.358 8.308v1.12C1.501 21.513 4.226 24 7.59 24a6.59 6.59 0 002.2-.375c.353-.12.7-.248 1.039-.378.913-.899 1.65-1.91 2.243-2.992-4.877 2.431-7.974.072-7.763-4.5l.002.001z" fill="#1E37FC"/>
                        <path d="M22.57 10.283c-1.212-.901-4.109-2.404-7.397-2.8.295 3.792.093 8.766-2.1 12.773a12.782 12.782 0 01-2.244 2.992c3.764-1.448 6.746-3.457 8.596-5.219 2.82-2.683 3.353-5.178 3.361-6.66a2.737 2.737 0 00-.216-1.084v-.002z" fill="#37E1BE"/>
                        <path d="M14.303 1.867C12.955.7 11.248 0 9.39 0 7.532 0 5.883.677 4.545 1.807 2.791 3.29 1.627 5.557 1.5 8.125v9.201c.932-2.65 3.097-6.25 6.357-8.307.5-.318 1.025-.595 1.569-.829 1.883-.801 3.878-.932 5.746-.706-.222-2.83-.718-5.002-.87-5.617h.001z" fill="#A569FF"/>
                        <path d="M17.305 4.961a199.47 199.47 0 01-1.08-1.094c-.202-.213-.398-.419-.586-.622l-1.333-1.378c.151.615.648 2.786.869 5.617 3.288.395 6.185 1.898 7.396 2.8-1.306-1.275-3.475-3.487-5.266-5.323z" fill="#1E37FC"/>
                      </svg>
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'gpt'" fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24" style="width: 18px; height: 18px;">
                        <title>OpenAI</title>
                        <path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h-.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h-.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"></path>
                      </svg>
                      
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'banana'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;" aria-hidden="true">
                        <path d="M1.5 19.824c0-.548.444-.992.991-.992h.744a.991.991 0 010 1.983H2.49a.991.991 0 01-.991-.991z" fill="#F3AD61"/>
                        <path d="M14.837 13.5h7.076c.522 0 .784-.657.413-1.044l-1.634-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044zM3.587 13.5h7.076c.521 0 .784-.659.414-1.044l-1.635-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044z" fill="#F9C23C"/>
                        <path d="M12.525 1.521c3.69-.53 5.97 8.923 4.309 12.744-1.662 3.82-5.248 4.657-9.053 6.152a3.49 3.49 0 01-1.279.244c-1.443 0-2.227 1.187-2.774-.282-.707-1.9.22-4.031 2.069-4.757 2.014-.79 3.084-2.308 3.89-4.364.82-2.096.877-2.956.873-5.241-.003-1.827-.123-4.195 1.965-4.496z" fill="#FEEFC2"/>
                        <path d="M16.834 14.264l-7.095-3.257c-.815 1.873-2.29 3.308-4.156 4.043-2.16.848-3.605 3.171-2.422 5.54 2.364 4.727 13.673-.05 13.673-6.325z" fill="#FCD53F"/>
                        <path d="M13.68 12.362c.296.094.46.41.365.707-1.486 4.65-5.818 6.798-9.689 6.997a.562.562 0 11-.057-1.124c3.553-.182 7.372-2.138 8.674-6.216a.562.562 0 01.707-.364z" fill="#F9C23C"/>
                        <path d="M17.43 19.85l-7.648-8.835h6.753c1.595.08 2.846 1.433 2.846 3.073v5.664c0 .997-.898 1.302-1.95.098z" fill="#FFF478"/>
                      </svg>
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'gemini'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;">
                        <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF"/>
                      </svg>
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'deepseek'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;">
                        <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE"/>
                      </svg>
                      <template v-else>{{ getModelPlatformBadge(model.id, model.name).short }}</template>
                    </span>
                    <span class="model-item-name">{{ model.name }}</span>
                    <span v-if="model.price" class="model-item-price">{{ model.price }}</span>
                  </label>
                  <div v-if="imageModels.length === 0" class="model-empty">
                    {{ t('settings.model.noModels') || '暂无可用模型' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 视频模型 -->
            <div v-show="modelActiveTab === 'video'" class="model-panel">
              <div class="model-panel-section">
                <div class="model-panel-label">{{ t('settings.model.modelGroup') }}</div>
                <div class="model-group-radios">
                  <label
                    :class="['model-group-radio', { active: modelGroup.video === 'youshang' }]"
                    @click="store.setVideoModelGroup('youshang')"
                  >
                    <span class="radio-dot"></span>
                    <span>{{ t('settings.model.groupYoushang') }}</span>
                  </label>
                  <label
                    :class="['model-group-radio', { active: modelGroup.video === 'flow2' }]"
                    @click="store.setVideoModelGroup('flow2')"
                  >
                    <span class="radio-dot"></span>
                    <span>{{ t('settings.model.groupFlow2') }}</span>
                  </label>
                </div>
              </div>
              <div class="model-panel-section">
                <div class="model-panel-label">{{ t('settings.model.modelPick') }}</div>
                <div class="model-list">
                  <label
                    v-for="model in videoModels"
                    :key="model.id"
                    :class="['model-item', { active: selectedVideoModel === model.id }]"
                    @click="selectedVideoModel = model.id"
                  >
                    <span class="radio-dot"></span>
                    <span class="model-icon" :class="`platform-${getModelPlatformBadge(model.id, model.name).key}`">
                      <svg v-if="getModelPlatformBadge(model.id, model.name).key === 'kling'" viewBox="0 0 24 24" style="width: 18px; height: 18px;">
                        <path d="M5.4 13.8A23.2 23.2 0 017.4 9.3c3.2-5.5 7.8-8.8 10.3-7.3C12-1.3 4.6 1 1.1 7a13.4 13.4 0 00-1 2.2c-.3.8.1 1.6.8 2l4.6 2.6z" fill="#04A6F0"/>
                        <path d="M18.6 10.2a23.2 23.2 0 01-2 4.5c-3.2 5.5-7.8 8.8-10.3 7.3 5.7 3.3 13.1 1.1 16.6-4.9a13.4 13.4 0 001-2.3c.3-.8-.1-1.6-.8-2l-4.5-2.6z" fill="#0DF35E"/>
                        <path d="M16.6 14.6c3.2-5.5 3.7-11.1 1.2-12.6C15.2.6 10.6 3.8 7.4 9.3c2-3.6 5.8-5.3 8.3-3.8 2.6 1.5 2.9 5.6.9 9.1z" fill="#003EFF"/>
                        <path d="M7.4 9.3c-3.2 5.5-3.7 11.1-1.2 12.6 2.6 1.5 7.2-1.8 10.4-7.3-2.1 3.6-5.9 5.3-8.4 3.9-2.5-1.4-2.9-5.6-.8-9.2z" fill="#0BFFE7"/>
                      </svg>
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'jimeng'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;">
                        <path d="M5.31 15.756c.172-3.75 1.883-5.999 2.549-6.739-3.26 2.058-5.425 5.658-6.358 8.308v1.12C1.501 21.513 4.226 24 7.59 24a6.59 6.59 0 002.2-.375c.353-.12.7-.248 1.039-.378.913-.899 1.65-1.91 2.243-2.992-4.877 2.431-7.974.072-7.763-4.5l.002.001z" fill="#1E37FC"/>
                        <path d="M22.57 10.283c-1.212-.901-4.109-2.404-7.397-2.8.295 3.792.093 8.766-2.1 12.773a12.782 12.782 0 01-2.244 2.992c3.764-1.448 6.746-3.457 8.596-5.219 2.82-2.683 3.353-5.178 3.361-6.66a2.737 2.737 0 00-.216-1.084v-.002z" fill="#37E1BE"/>
                        <path d="M14.303 1.867C12.955.7 11.248 0 9.39 0 7.532 0 5.883.677 4.545 1.807 2.791 3.29 1.627 5.557 1.5 8.125v9.201c.932-2.65 3.097-6.25 6.357-8.307.5-.318 1.025-.595 1.569-.829 1.883-.801 3.878-.932 5.746-.706-.222-2.83-.718-5.002-.87-5.617h.001z" fill="#A569FF"/>
                        <path d="M17.305 4.961a199.47 199.47 0 01-1.08-1.094c-.202-.213-.398-.419-.586-.622l-1.333-1.378c.151.615.648 2.786.869 5.617 3.288.395 6.185 1.898 7.396 2.8-1.306-1.275-3.475-3.487-5.266-5.323z" fill="#1E37FC"/>
                      </svg>
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'gpt'" fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24" style="width: 18px; height: 18px;">
                        <title>OpenAI</title>
                        <path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h-.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h-.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"></path>
                      </svg>
                      
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'banana'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;" aria-hidden="true">
                        <path d="M1.5 19.824c0-.548.444-.992.991-.992h.744a.991.991 0 010 1.983H2.49a.991.991 0 01-.991-.991z" fill="#F3AD61"/>
                        <path d="M14.837 13.5h7.076c.522 0 .784-.657.413-1.044l-1.634-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044zM3.587 13.5h7.076c.521 0 .784-.659.414-1.044l-1.635-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044z" fill="#F9C23C"/>
                        <path d="M12.525 1.521c3.69-.53 5.97 8.923 4.309 12.744-1.662 3.82-5.248 4.657-9.053 6.152a3.49 3.49 0 01-1.279.244c-1.443 0-2.227 1.187-2.774-.282-.707-1.9.22-4.031 2.069-4.757 2.014-.79 3.084-2.308 3.89-4.364.82-2.096.877-2.956.873-5.241-.003-1.827-.123-4.195 1.965-4.496z" fill="#FEEFC2"/>
                        <path d="M16.834 14.264l-7.095-3.257c-.815 1.873-2.29 3.308-4.156 4.043-2.16.848-3.605 3.171-2.422 5.54 2.364 4.727 13.673-.05 13.673-6.325z" fill="#FCD53F"/>
                        <path d="M13.68 12.362c.296.094.46.41.365.707-1.486 4.65-5.818 6.798-9.689 6.997a.562.562 0 11-.057-1.124c3.553-.182 7.372-2.138 8.674-6.216a.562.562 0 01.707-.364z" fill="#F9C23C"/>
                        <path d="M17.43 19.85l-7.648-8.835h6.753c1.595.08 2.846 1.433 2.846 3.073v5.664c0 .997-.898 1.302-1.95.098z" fill="#FFF478"/>
                      </svg>
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'gemini'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;">
                        <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF"/>
                      </svg>
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'deepseek'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;">
                        <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE"/>
                      </svg>
                      <template v-else>{{ getModelPlatformBadge(model.id, model.name).short }}</template>
                    </span>
                    <span class="model-item-name">{{ model.name }}</span>
                    <span v-if="model.price" class="model-item-price">{{ model.price }}</span>
                  </label>
                  <div v-if="videoModels.length === 0" class="model-empty">
                    {{ t('settings.model.noModels') || '暂无可用模型' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 图片视觉理解模型 -->
            <div v-show="modelActiveTab === 'vision'" class="model-panel">
              <div class="model-panel-section">
                <div class="model-panel-label">{{ t('settings.model.modelGroup') }}</div>
                <div class="model-group-radios">
                  <label
                    :class="['model-group-radio', { active: modelGroup.vision === 'youshang' }]"
                    @click="store.setVisionModelGroup('youshang')"
                  >
                    <span class="radio-dot"></span>
                    <span>{{ t('settings.model.groupYoushang') }}</span>
                  </label>
                </div>
              </div>
              <div class="model-panel-section">
                <div class="model-panel-label">{{ t('settings.model.modelPick') }}</div>
                <div class="model-list">
                  <label
                    v-for="model in visionModels"
                    :key="model.id"
                    :class="['model-item', { active: selectedVisionModel === model.id }]"
                    @click="selectedVisionModel = model.id"
                  >
                    <span class="radio-dot"></span>
                    <span class="model-icon" :class="`platform-${getModelPlatformBadge(model.id, model.name).key}`">
                      <svg v-if="getModelPlatformBadge(model.id, model.name).key === 'kling'" viewBox="0 0 24 24" style="width: 18px; height: 18px;">
                        <path d="M5.4 13.8A23.2 23.2 0 017.4 9.3c3.2-5.5 7.8-8.8 10.3-7.3C12-1.3 4.6 1 1.1 7a13.4 13.4 0 00-1 2.2c-.3.8.1 1.6.8 2l4.6 2.6z" fill="#04A6F0"/>
                        <path d="M18.6 10.2a23.2 23.2 0 01-2 4.5c-3.2 5.5-7.8 8.8-10.3 7.3 5.7 3.3 13.1 1.1 16.6-4.9a13.4 13.4 0 001-2.3c.3-.8-.1-1.6-.8-2l-4.5-2.6z" fill="#0DF35E"/>
                        <path d="M16.6 14.6c3.2-5.5 3.7-11.1 1.2-12.6C15.2.6 10.6 3.8 7.4 9.3c2-3.6 5.8-5.3 8.3-3.8 2.6 1.5 2.9 5.6.9 9.1z" fill="#003EFF"/>
                        <path d="M7.4 9.3c-3.2 5.5-3.7 11.1-1.2 12.6 2.6 1.5 7.2-1.8 10.4-7.3-2.1 3.6-5.9 5.3-8.4 3.9-2.5-1.4-2.9-5.6-.8-9.2z" fill="#0BFFE7"/>
                      </svg>
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'jimeng'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;">
                        <path d="M5.31 15.756c.172-3.75 1.883-5.999 2.549-6.739-3.26 2.058-5.425 5.658-6.358 8.308v1.12C1.501 21.513 4.226 24 7.59 24a6.59 6.59 0 002.2-.375c.353-.12.7-.248 1.039-.378.913-.899 1.65-1.91 2.243-2.992-4.877 2.431-7.974.072-7.763-4.5l.002.001z" fill="#1E37FC"/>
                        <path d="M22.57 10.283c-1.212-.901-4.109-2.404-7.397-2.8.295 3.792.093 8.766-2.1 12.773a12.782 12.782 0 01-2.244 2.992c3.764-1.448 6.746-3.457 8.596-5.219 2.82-2.683 3.353-5.178 3.361-6.66a2.737 2.737 0 00-.216-1.084v-.002z" fill="#37E1BE"/>
                        <path d="M14.303 1.867C12.955.7 11.248 0 9.39 0 7.532 0 5.883.677 4.545 1.807 2.791 3.29 1.627 5.557 1.5 8.125v9.201c.932-2.65 3.097-6.25 6.357-8.307.5-.318 1.025-.595 1.569-.829 1.883-.801 3.878-.932 5.746-.706-.222-2.83-.718-5.002-.87-5.617h.001z" fill="#A569FF"/>
                        <path d="M17.305 4.961a199.47 199.47 0 01-1.08-1.094c-.202-.213-.398-.419-.586-.622l-1.333-1.378c.151.615.648 2.786.869 5.617 3.288.395 6.185 1.898 7.396 2.8-1.306-1.275-3.475-3.487-5.266-5.323z" fill="#1E37FC"/>
                      </svg>
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'gpt'" fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24" style="width: 18px; height: 18px;">
                        <title>OpenAI</title>
                        <path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h-.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h-.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"></path>
                      </svg>
                      
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'banana'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;" aria-hidden="true">
                        <path d="M1.5 19.824c0-.548.444-.992.991-.992h.744a.991.991 0 010 1.983H2.49a.991.991 0 01-.991-.991z" fill="#F3AD61"/>
                        <path d="M14.837 13.5h7.076c.522 0 .784-.657.413-1.044l-1.634-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044zM3.587 13.5h7.076c.521 0 .784-.659.414-1.044l-1.635-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044z" fill="#F9C23C"/>
                        <path d="M12.525 1.521c3.69-.53 5.97 8.923 4.309 12.744-1.662 3.82-5.248 4.657-9.053 6.152a3.49 3.49 0 01-1.279.244c-1.443 0-2.227 1.187-2.774-.282-.707-1.9.22-4.031 2.069-4.757 2.014-.79 3.084-2.308 3.89-4.364.82-2.096.877-2.956.873-5.241-.003-1.827-.123-4.195 1.965-4.496z" fill="#FEEFC2"/>
                        <path d="M16.834 14.264l-7.095-3.257c-.815 1.873-2.29 3.308-4.156 4.043-2.16.848-3.605 3.171-2.422 5.54 2.364 4.727 13.673-.05 13.673-6.325z" fill="#FCD53F"/>
                        <path d="M13.68 12.362c.296.094.46.41.365.707-1.486 4.65-5.818 6.798-9.689 6.997a.562.562 0 11-.057-1.124c3.553-.182 7.372-2.138 8.674-6.216a.562.562 0 01.707-.364z" fill="#F9C23C"/>
                        <path d="M17.43 19.85l-7.648-8.835h6.753c1.595.08 2.846 1.433 2.846 3.073v5.664c0 .997-.898 1.302-1.95.098z" fill="#FFF478"/>
                      </svg>
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'gemini'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;">
                        <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF"/>
                      </svg>
                      <svg v-else-if="getModelPlatformBadge(model.id, model.name).key === 'deepseek'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;">
                        <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE"/>
                      </svg>
                      <template v-else>{{ getModelPlatformBadge(model.id, model.name).short }}</template>
                    </span>
                    <span class="model-item-name">{{ model.name }}</span>
                    <span v-if="model.price" class="model-item-price">{{ model.price }}</span>
                  </label>
                  <div v-if="visionModels.length === 0" class="model-empty">
                    {{ t('settings.model.noModels') || '暂无可用模型' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-show="activeTab === 'interface'"
          class="settings-content"
        >
          <div class="interface-section">
            <h3>{{ t('settings.ui.pageTitle') }}</h3>
            <el-divider />
            
            <div class="setting-section-block">
              <h4 class="setting-section-title">{{ t('settings.ui.languageSection') }}</h4>
              <div class="setting-row">
                <span class="setting-label">{{ t('settings.ui.language') }}</span>
                <div class="language-options">
                  <button
                    :class="['language-option-btn', { active: userStore.appLocale === 'zh-CN' }]"
                    @click="userStore.setAppLocale('zh-CN')"
                  >
                    <span>🇨🇳</span>
                    <span>{{ t('settings.ui.languageZh') }}</span>
                  </button>
                  <button
                    :class="['language-option-btn', { active: userStore.appLocale === 'en-US' }]"
                    @click="userStore.setAppLocale('en-US')"
                  >
                    <span>🇺🇸</span>
                    <span>{{ t('settings.ui.languageEn') }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="setting-section-block">
              <h4 class="setting-section-title">{{ t('settings.ui.themeSection') }}</h4>
              <div class="setting-row">
                <span class="setting-label">{{ t('settings.ui.themeMode') }}</span>
                <div class="theme-options">
                  <button
                    :class="['theme-option-btn', { active: themeStore.themeMode === 'dark' }]"
                    @click="themeStore.setThemeMode('dark')"
                  >
                    <el-icon><Moon /></el-icon>
                    <span>{{ t('settings.ui.themeDark') }}</span>
                  </button>
                  <button
                    :class="['theme-option-btn', { active: themeStore.themeMode === 'light' }]"
                    @click="themeStore.setThemeMode('light')"
                  >
                    <el-icon><Sunny /></el-icon>
                    <span>{{ t('settings.ui.themeLight') }}</span>
                  </button>
                  <button
                    :class="['theme-option-btn', { active: themeStore.themeMode === 'system' }]"
                    @click="themeStore.setThemeMode('system')"
                  >
                    <el-icon><Monitor /></el-icon>
                    <span>{{ t('settings.ui.themeSystem') }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="canvas-settings">
              <h4>{{ t('settings.ui.canvasBlock') }}</h4>
              <div class="setting-row">
                <span class="setting-label">{{ t('settings.ui.edgeStyle') }}</span>
                <div class="edge-style-options">
                  <button
                    :class="['style-option-btn', { active: userStore.edgeStyle === 'straight' }]"
                    @click="userStore.edgeStyle = 'straight'"
                  >
                    <svg width="60" height="20" viewBox="0 0 60 20">
                      <line x1="5" y1="15" x2="55" y2="5" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <span>直线</span>
                  </button>
                  <button
                    :class="['style-option-btn', { active: userStore.edgeStyle === 'smooth' }]"
                    @click="userStore.edgeStyle = 'smooth'"
                  >
                    <svg width="60" height="20" viewBox="0 0 60 20">
                      <path d="M5,15 Q30,0 55,5" fill="none" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <span>曲线</span>
                  </button>
                  <button
                    :class="['style-option-btn', { active: userStore.edgeStyle === 'step' }]"
                    @click="userStore.edgeStyle = 'step'"
                  >
                    <svg width="60" height="20" viewBox="0 0 60 20">
                      <path d="M5,15 L30,15 L30,5 L55,5" fill="none" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <span>直角阶梯</span>
                  </button>
                  <button
                    :class="['style-option-btn', { active: userStore.edgeStyle === 'smoothstep' }]"
                    @click="userStore.edgeStyle = 'smoothstep'"
                  >
                    <svg width="60" height="20" viewBox="0 0 60 20">
                      <path d="M5,15 L20,15 Q30,15 30,5 L55,5" fill="none" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <span>平滑阶梯</span>
                  </button>
                </div>
              </div>
              <div class="setting-row edge-width-row">
                <span class="setting-label">{{ t('settings.ui.edgeWidth') }}</span>
                <div class="edge-width-control">
                  <el-slider
                    v-model="userStore.edgeStrokeWidth"
                    :min="1"
                    :max="5"
                    :step="1"
                    :format-tooltip="(v) => `${v}px`"
                    :show-tooltip="true"
                  />
                  <span class="edge-width-value">{{ userStore.edgeStrokeWidth }}px</span>
                </div>
              </div>
              <div class="setting-row edge-color-row">
                <span class="setting-label">{{ t('settings.ui.edgeColor') }}</span>
                <div class="edge-color-control">
                  <el-color-picker
                    v-model="userStore.edgeColor"
                    :predefine="[
                      '#409eff',
                      '#67c23a',
                      '#e6a23c',
                      '#f56c6c',
                      '#909399',
                      '#ffffff',
                      '#7c4dff',
                      '#00bcd4'
                    ]"
                    :show-alpha="false"
                  />
                  <span class="edge-color-value">{{ userStore.edgeColor }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-show="activeTab === 'about'"
          class="settings-content"
        >
          <div class="about-section">
            <div class="about-header">
              <h3>{{ t('settings.aboutAppName') }}</h3>
              <el-tag
                type="success"
                size="small"
              >
                v{{ appVersion }}
              </el-tag>
            </div>
            
            <div class="about-info">
              <p class="about-desc">
                {{ t('settings.aboutTagline') }}
              </p>
            </div>

            <el-divider />

            <div class="update-section">
              <div class="update-status">
                <div class="update-actions">
                  <el-button
                    v-if="updateStatus === 'idle' || updateStatus === 'not-available'"
                    type="primary"
                    :loading="false"
                    @click="handleCheckUpdate"
                  >
                    {{ t('settings.aboutCheckUpdate') }}
                  </el-button>
                </div>
                <span
                  v-if="updateStatus === 'idle' || updateStatus === 'not-available'"
                  class="status-text"
                >
                  {{ t('settings.aboutStatusLatest') }}
                </span>
                <span
                  v-else-if="updateStatus === 'checking'"
                  class="checking"
                >
                  <el-icon class="is-loading"><Loading /></el-icon>
                  {{ t('settings.aboutStatusChecking') }}
                </span>
                <span
                  v-else-if="updateStatus === 'available'"
                  class="available"
                >
                  {{ t('settings.aboutStatusNewTpl', { version: latestVersion }) }}
                  <span v-if="latestReleaseDate"> ({{ latestReleaseDate }})</span>
                </span>
                <span
                  v-else-if="updateStatus === 'downloading'"
                  class="downloading"
                >
                  {{ t('settings.aboutStatusDownloadingTpl', { n: downloadPercent }) }}
                </span>
                <span
                  v-else-if="updateStatus === 'downloaded'"
                  class="downloaded"
                >
                  {{ t('settings.aboutStatusDownloaded') }}
                </span>
                <span
                  v-else-if="updateStatus === 'error'"
                  class="error"
                >
                  {{ t('settings.aboutStatusErrTpl', { msg: updateErrorMessage }) }}
                </span>
              </div>

              <div
                v-if="updateStatus !== 'idle' && updateStatus !== 'not-available'"
                class="update-actions"
              >
                <el-button
                  v-if="updateStatus === 'available'"
                  type="primary"
                  @click="handleDownloadUpdate"
                >
                  {{ t('settings.aboutBtnDownloadInstall') }}
                </el-button>
                <el-button 
                  v-if="updateStatus === 'downloaded'" 
                  type="success" 
                  @click="handleInstallUpdate"
                >
                  {{ t('settings.aboutBtnRestartApp') }}
                </el-button>
              </div>

              <el-progress 
                v-if="updateStatus === 'downloading'" 
                :percentage="downloadPercent" 
                :stroke-width="10"
                style="margin-top: 10px;"
              />

              <div
                v-if="latestReleaseNotes"
                class="release-notes"
              >
                <h5>{{ t('settings.aboutReleaseHeading') }}</h5>
                <pre>{{ latestReleaseNotes }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>

  <el-dialog
    v-model="showVipDialog"
    :title="t('settings.vip.dialogTitle')"
    width="500px"
    class="vip-dialog"
  >
    <div class="vip-packages">
      <div 
        v-for="pkg in vipPackages" 
        :key="pkg.id"
        :class="['vip-package', { selected: selectedPackage === pkg.id }]"
        @click="selectedPackage = pkg.id"
      >
        <div class="package-header">
          <h4>{{ pkg.name }}</h4>
          <el-tag
            v-if="pkg.recommended"
            type="danger"
            size="small"
          >
            {{ t('settings.vip.recommended') }}
          </el-tag>
        </div>
        <div class="package-price">
          <span class="price-symbol">¥</span>
          <span class="price-value">{{ pkg.price }}</span>
        </div>
        <div class="package-desc">
          {{ pkg.description }}
        </div>
        <div class="package-duration">
          {{ t('settings.vip.validityPrefix') }}{{ pkg.duration }}
        </div>
      </div>
    </div>
    
    <div class="vip-benefits">
      <h4>{{ t('settings.vip.benefitsTitle') }}</h4>
      <ul>
        <li>{{ t('settings.vip.benefit1') }}</li>
        <li>{{ t('settings.vip.benefit2') }}</li>
        <li>{{ t('settings.vip.benefit3') }}</li>
        <li>{{ t('settings.vip.benefit4') }}</li>
      </ul>
    </div>
    
    <template #footer>
      <el-button @click="showVipDialog = false">
        {{ t('settings.profile.cancel') }}
      </el-button>
      <el-button
        type="primary"
        :loading="purchaseLoading"
        @click="handlePurchaseVip"
      >
        {{ t('settings.vip.payNow') }} ¥{{ selectedPackagePrice }}
      </el-button>
    </template>
  </el-dialog>

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
          <span class="amount">¥{{ selectedPackagePrice }}</span>
        </div>
        <div class="pay-order">
          {{ t('settings.vip.orderPrefix') }}{{ currentOrderNo }}
        </div>
      </div>
      <div class="pay-tips">
        <p>{{ t('settings.vip.tipWechat') }}</p>
        <p>{{ t('settings.vip.tipAutoUpgrade') }}</p>
      </div>
    </div>
    <template #footer>
      <el-button @click="handleCancelPayment">
        {{ t('settings.vip.cancelPayment') }}
      </el-button>
    </template>
  </el-dialog>
  <el-dialog
    v-model="showFlow2Guide"
    title="Flow2API 使用说明"
    width="600px"
    class="flow2-guide-dialog"
  >
    <div class="flow2-guide-content">
      <pre v-text="flow2GuideContent" class="guide-text"></pre>
    </div>
    <template #footer>
      <el-button @click="showFlow2Guide = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { FolderOpened, Connection, User, Lock, Operation, Loading, InfoFilled, Monitor, Moon, Sunny, Close, VideoPlay, View, Star, Calendar, Promotion } from '@element-plus/icons-vue'
import { useApiConfigStore, type ModelType, type ApiModelGroup } from '@/stores/apiConfigStore'
import { getModelPlatformBadge } from '@/utils/modelPlatformBadge'
import { useUserStore } from '@/stores/userStore'
import { useLogsStore } from '@/stores/logsStore'
import { useThemeStore } from '@/stores/themeStore'
import { useI18n } from 'vue-i18n'
import apiService from '@/services/apiService'
import { fetchCloudPayment } from '@/config/cloudApi'
import StarsAssets from '@/components/StarsAssets.vue'
import DailyCheckin from '@/components/DailyCheckin.vue'
import InviteFriends from '@/components/InviteFriends.vue'

const props = defineProps<{
  modelValue: boolean
  defaultTab?: 'profile' | 'storage' | 'api' | 'about' | 'model' | 'interface'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const router = useRouter()
const store = useApiConfigStore()
const userStore = useUserStore()
const logsStore = useLogsStore()
const themeStore = useThemeStore()
const { t } = useI18n()
const validating = ref(false)
const configType = ref<'official' | 'flow2' | 'aliyun'>('official')
const activeTab = ref(props.defaultTab || 'storage')
const profileActiveTab = ref<'assets' | 'password' | 'checkin'>('assets')

// 模型管理相关状态
const modelActiveTab = ref<'text' | 'image' | 'video' | 'vision'>('text')

const modelGroup = reactive({
  text: 'youshang' as ApiModelGroup,
  image: 'youshang' as ApiModelGroup,
  video: 'youshang' as ApiModelGroup,
  vision: 'youshang' as ApiModelGroup
})

watch(() => store.textApiModelGroup, (val) => {
  modelGroup.text = val
}, { immediate: true })

watch(() => modelGroup.text, (val) => {
  if (val === 'youshang' || val === 'flow2') {
    store.setTextApiModelGroup(val)
  }
})

watch(() => store.imageModelGroup, (val) => {
  modelGroup.image = val
}, { immediate: true })

watch(() => modelGroup.image, (val) => {
  if (val === 'youshang' || val === 'official' || val === 'flow2' || val === 'aliyun') {
    store.setImageModelGroup(val)
  }
})

watch(() => store.visionModelGroup, (val) => {
  modelGroup.vision = val
}, { immediate: true })

watch(() => modelGroup.vision, (val) => {
  if (val === 'youshang') {
    store.setVisionModelGroup(val)
  }
})

const textModels = computed(() => {
  if (modelGroup.text === 'youshang') return store.textModels
  return []
})

const imageModels = computed(() => {
  if (modelGroup.image === 'youshang') return store.imageModels
  if (modelGroup.image === 'flow2') return store.flow2ImageModels
  if (modelGroup.image === 'aliyun') return store.imageModels.filter(m => m.id.startsWith('qwen-image'))
  return []
})

const videoModels = computed(() => {
  if (modelGroup.video === 'youshang') return store.videoModels
  if (modelGroup.video === 'flow2') return store.flow2VideoModels
  return []
})

const visionModels = computed(() => {
  if (modelGroup.vision === 'youshang') return store.visionModels
  return []
})

const selectedTextModel = computed({
  get: () => store.documentUploadModel,
  set: (val) => store.setDocumentUploadModel(val)
})

const selectedImageModel = computed({
  get: () => store.imageModel,
  set: (val) => store.setImageModel(val)
})

const selectedVideoModel = computed({
  get: () => store.videoModel,
  set: (val) => store.setVideoModel(val)
})

const selectedVisionModel = computed({
  get: () => store.visionModel,
  set: (val) => store.setVisionModel(val)
})

// 自动更新相关状态
const appVersion = ref(__APP_VERSION__ || '1.0.0')
const updateStatus = ref<'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'>('idle')
const latestVersion = ref('')
const latestReleaseDate = ref('')
const latestReleaseNotes = ref('')
const downloadPercent = ref(0)
const updateErrorMessage = ref('')
let updateStatusCleanup: (() => void) | null = null

// 更新相关状态
let currentVersionInfo: {
  version: string
  buildNumber: number
  releaseDate: string
  releaseNotes: string
  downloadUrl: string
  checksum: string
} | null = null

const ossForm = reactive({
  ossEndpoint: '',
  ossVersionPath: '',
  ossAccessKeyId: '',
  ossAccessKeySecret: ''
})
const ossSaving = ref(false)

const flow2ServiceStatus = ref<'stopped' | 'starting' | 'running' | 'stopping'>('stopped')
let flow2StatusCheckInterval: ReturnType<typeof setInterval> | null = null

const currentDataPath = ref('')
const defaultDataPath = ref('')
const pathLoading = ref(false)
const jianyingPathLoading = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const hasCustomPath = computed(() => {
  return currentDataPath.value && currentDataPath.value !== defaultDataPath.value
})

const flow2ServiceStatusText = computed(() => {
  switch (flow2ServiceStatus.value) {
    case 'stopped': return t('settings.flowStopped')
    case 'starting': return t('settings.flowStarting')
    case 'running': return t('settings.flowRunning')
    case 'stopping': return t('settings.flowStopping')
    default: return t('settings.flowUnknown')
  }
})

const officialForm = reactive({
  apiKey: '',
  baseURL: 'https://api.ussn.cn/v1'
})

const flow2Form = reactive({
  apiKey: 'XINGMENGDONGHUA',
  baseURL: 'http://localhost:8001'
})

const aliyunForm = reactive({
  apiKey: '',
  baseURL: 'https://dashscope.aliyuncs.com/api/v1'
})

// 初始化阿里云表单
watch(() => store.aliyunConfig, (val) => {
  if (val) {
    aliyunForm.apiKey = val.apiKey || ''
    aliyunForm.baseURL = val.baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  }
}, { immediate: true })

const flow2Port = ref('8001')

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const passwordFormRef = ref()
const passwordLoading = ref(false)

const showVipDialog = ref(false)
const showPayQrcode = ref(false)
const showFlow2Guide = ref(false)
const flow2GuideContent = ref('')
const purchaseLoading = ref(false)
const selectedPackage = ref(2)
const payQrcodeUrl = ref('')
const currentOrderNo = ref('')

const vipPackageDefs = [
  { id: 1, price: 38, days: 30, type: 'vip_monthly', recommended: false, nameKey: 'settings.vip.pkgMonthlyName', descKey: 'settings.vip.pkgMonthlyDesc' },
  { id: 2, price: 88, days: 90, type: 'vip_quarterly', recommended: true, nameKey: 'settings.vip.pkgQuarterName', descKey: 'settings.vip.pkgQuarterDesc' },
  { id: 3, price: 188, days: 365, type: 'vip_yearly', recommended: false, nameKey: 'settings.vip.pkgYearName', descKey: 'settings.vip.pkgYearDesc' },
] as const

const vipPackages = computed(() =>
  vipPackageDefs.map((d) => ({
    ...d,
    name: t(d.nameKey),
    description: t(d.descKey),
    duration: t('settings.vip.durationDays', { n: d.days }),
  }))
)

const selectedPackagePrice = computed(() => {
  const pkg = vipPackages.value.find((p) => p.id === selectedPackage.value)
  return pkg ? pkg.price : 0
})

const handlePurchaseVip = async () => {
  const pkg = vipPackages.value.find((p) => p.id === selectedPackage.value)
  if (!pkg) return

  const token = userStore.token?.trim()
  if (!token) {
    ElMessage.warning(t('settings.msg.vipLoginRequired'))
    return
  }

  purchaseLoading.value = true
  try {
    const response = await fetchCloudPayment(
      'create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...userStore.getAuthFetchHeaders(),
        },
        body: JSON.stringify({ productId: pkg.id, accessToken: token })
      }
    )

    const result = await response.json().catch(() => ({}))

    if (response.status === 401) {
      ElMessage.error((result as { message?: string }).message || t('settings.msg.vipSessionExpired'))
      return
    }

    if (result.success && result.data.codeUrl) {
      currentOrderNo.value = result.data.orderNo
      payQrcodeUrl.value = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(result.data.codeUrl)}`
      showVipDialog.value = false
      showPayQrcode.value = true
      startPaymentCheck()
    } else {
      ElMessage.error(result.message || t('settings.msg.orderCreateFail'))
    }
  } catch (error) {
    ElMessage.error(t('settings.msg.orderCreateNetwork'))
  } finally {
    purchaseLoading.value = false
  }
}

let paymentCheckTimer: ReturnType<typeof setInterval> | null = null

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
      const response = await fetchCloudPayment(
        'order',
        { headers: userStore.getAuthFetchHeaders() },
        q
      )
      
      const result = await response.json()
      
      if (result.success) {
        if (result.data.status === 'paid') {
          clearInterval(paymentCheckTimer!)
          paymentCheckTimer = null
          showPayQrcode.value = false
          logsStore.addLog('system', 'success', {
            messageKey: 'logsPage.msg.vipOkTitle',
            detailKey: 'logsPage.msg.lineUser',
            detailParams: { user: String(userStore.userName || userStore.userEmail || '') }
          })
          ElMessage.success(t('settings.msg.paySuccessVip'))
          userStore.refreshUserInfo()
        } else if (result.data.status === 'closed') {
          clearInterval(paymentCheckTimer!)
          paymentCheckTimer = null
          showPayQrcode.value = false
          logsStore.addLog('system', 'warning', {
            messageKey: 'logsPage.msg.vipOrderClosedTitle',
            detailKey: 'logsPage.msg.lineOrder',
            detailParams: { order: String(currentOrderNo.value || '') }
          })
          ElMessage.warning(t('settings.msg.orderClosed'))
        } else if (result.data.paymentStatus?.tradeState === 'UNKNOWN' && result.data.paymentStatus?.tradeStateDesc) {
          console.error('微信支付查询错误:', result.data.paymentStatus.tradeStateDesc)
        }
      }
    } catch (error) {
      console.error('检查支付状态失败:', error)
    }
  }, 3000)
}

const handleCancelPayment = () => {
  if (paymentCheckTimer) {
    clearInterval(paymentCheckTimer)
    paymentCheckTimer = null
  }
  showPayQrcode.value = false
  currentOrderNo.value = ''
  payQrcodeUrl.value = ''
  ElMessage.info(t('settings.msg.paymentCancelled'))
}

const handleLogout = () => {
  ElMessageBox.confirm(t('settings.profile.logoutConfirm'), t('settings.profile.logoutTitle'), {
    confirmButtonText: t('settings.profile.ok'),
    cancelButtonText: t('settings.profile.cancel'),
    type: 'warning'
  }).then(() => {
    logsStore.addLog('system', 'info', {
      messageKey: 'logsPage.msg.logoutTitle',
      detailKey: 'logsPage.msg.lineUser',
      detailParams: { user: String(userStore.userName || userStore.userEmail || '') }
    })
    userStore.logout()
    emit('update:modelValue', false)
    router.push('/login')
    ElMessage.success(t('settings.profile.loggedOut'))
  }).catch(() => {})
}

const passwordRules = computed(() => ({
  oldPassword: [
    { required: true, message: t('settings.profile.ruleOldPasswordRequired'), trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: t('settings.profile.ruleNewPasswordRequired'), trigger: 'blur' },
    { min: 6, message: t('settings.profile.rulePasswordMin'), trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: t('settings.profile.ruleConfirmPasswordRequired'), trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (e?: Error) => void) => {
        if (!value) {
          callback(new Error(t('settings.profile.ruleConfirmEmpty')))
        } else if (value !== passwordForm.newPassword) {
          callback(new Error(t('settings.profile.rulePasswordMismatch')))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}))

const handleChangePassword = async () => {
  if (!passwordFormRef.value) return
  
  await passwordFormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      passwordLoading.value = true
      try {
        ElMessage.success(t('settings.profile.passwordChanged'))
        logsStore.addLog('system', 'success', {
          messageKey: 'logsPage.msg.pwdOkTitle',
          detailKey: 'logsPage.msg.lineUser',
          detailParams: { user: String(userStore.userName || userStore.userEmail || '') }
        })
        passwordForm.oldPassword = ''
        passwordForm.newPassword = ''
        passwordForm.confirmPassword = ''
      } catch (error) {
        if (error instanceof Error) {
          logsStore.addLog('system', 'error', {
            messageKey: 'logsPage.msg.pwdFailTitle',
            detailRaw: error.message
          })
          ElMessage.error(t('settings.profile.passwordChangeFailPrefix') + error.message)
        }
      } finally {
        passwordLoading.value = false
      }
    }
  })
}

const handleClose = () => {
  emit('update:modelValue', false)
}

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
    ElMessage.warning(t('settings.msg.electronOnly'))
    return
  }

  pathLoading.value = true
  try {
    const result = await window.electronAPI.dialog.selectFolder()
    if (!result.canceled && result.filePaths.length > 0) {
      const newPath = result.filePaths[0]
      const setResult = await window.electronAPI.dataPath!.set(newPath)
      if (setResult.success) {
        logsStore.addLog('system', 'success', {
          messageKey: 'logsPage.msg.dataPathSavedTitle',
          detailKey: 'logsPage.msg.detailNewPath',
          detailParams: { path: newPath }
        })
        ElMessage.success(setResult.message)
        await loadDataPaths()
      } else {
        logsStore.addLog('system', 'error', {
          messageKey: 'logsPage.msg.dataPathSaveFailTitle',
          detailRaw: setResult.message
        })
        ElMessage.error(setResult.message)
      }
    }
  } catch (error) {
    logsStore.addLog('system', 'error', {
      messageKey: 'logsPage.msg.pathPickFailTitle',
      detailRaw: error instanceof Error ? error.message : t('logsPage.msg.unknownErr')
    })
    ElMessage.error(t('settings.msg.selectPathFail'))
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
      logsStore.addLog('system', 'success', {
        messageKey: 'logsPage.msg.dataPathResetTitle',
        detailKey: 'logsPage.msg.detailPathColon',
        detailParams: { path: String(defaultDataPath.value || '') }
      })
      ElMessage.success(result.message)
      await loadDataPaths()
    } else {
      logsStore.addLog('system', 'error', {
        messageKey: 'logsPage.msg.dataPathResetFailTitle',
        detailRaw: result.message
      })
      ElMessage.error(result.message)
    }
  } catch (error) {
    logsStore.addLog('system', 'error', {
      messageKey: 'logsPage.msg.dataPathResetFailTitle',
      detailRaw: error instanceof Error ? error.message : t('logsPage.msg.unknownErr')
    })
    ElMessage.error(t('settings.msg.restorePathFail'))
  } finally {
    pathLoading.value = false
  }
}

const openDataPath = async () => {
  if (!currentDataPath.value) {
    ElMessage.warning(t('settings.msg.pathNotLoaded'))
    return
  }
  
  if (window.electronAPI?.shell?.openPath) {
    try {
      await window.electronAPI.shell.openPath(currentDataPath.value)
    } catch (error) {
      ElMessage.error(t('settings.msg.openFolderFail'))
    }
  } else {
    ElMessage.warning(t('settings.msg.electronOnly'))
  }
}

const selectJianyingDraftPath = async () => {
  if (!window.electronAPI?.dialog?.selectFolder) {
    ElMessage.warning(t('settings.msg.electronOnly'))
    return
  }

  jianyingPathLoading.value = true
  try {
    const result = await window.electronAPI.dialog.selectFolder()
    if (!result.canceled && result.filePaths.length > 0) {
      userStore.jianyingDraftPath = result.filePaths[0]
      ElMessage.success(t('settings.msg.jianyingPathOk'))
    }
  } catch (error) {
    ElMessage.error(t('settings.msg.selectPathFail'))
  } finally {
    jianyingPathLoading.value = false
  }
}

const openJianyingDraftPath = async () => {
  if (!userStore.jianyingDraftPath) {
    ElMessage.warning(t('settings.msg.jianyingPathUnset'))
    return
  }
  
  if (window.electronAPI?.shell?.openPath) {
    try {
      await window.electronAPI.shell.openPath(userStore.jianyingDraftPath)
    } catch (error) {
      ElMessage.error(t('settings.msg.openFolderFail'))
    }
  } else {
    ElMessage.warning(t('settings.msg.electronOnly'))
  }
}

const openPurchaseLink = () => {
  window.open('https://api.ussn.cn/register?aff=xkUd', '_blank')
}

const handleConfigTypeChange = (val: string) => {
  const type = val as 'official' | 'flow2'
  configType.value = type
  store.setConfigType(type)
}

const saveOfficialConfig = async () => {
  if (!officialForm.apiKey) {
    ElMessage.warning(t('settings.msg.needApiKey'))
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
    logsStore.addLog('system', 'success', {
      messageKey: 'logsPage.msg.apiOfficialSavedTitle',
      detailKey: 'logsPage.msg.detailOfficialApi',
      detailParams: { url: officialForm.baseURL }
    })
    ElMessage.success(t('settings.msg.configSaved'))
  } catch (error) {
    if (error instanceof Error) {
      logsStore.addLog('system', 'error', {
        messageKey: 'logsPage.msg.apiOfficialSaveFailTitle',
        detailRaw: error.message
      })
      ElMessage.error(t('settings.msg.configSaveFailPrefix') + error.message)
    }
  } finally {
    validating.value = false
  }
}

const testOfficialConnection = async () => {
  if (!officialForm.apiKey) {
    ElMessage.warning(t('settings.msg.enterApiKeyFirst'))
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
      ElMessage.success(t('settings.msg.testOk'))
    } else {
      ElMessage.error(t('settings.msg.testFail'))
    }
  } catch (error) {
    if (error instanceof Error) {
      ElMessage.error(t('settings.msg.testFailPrefix') + error.message)
    }
  } finally {
    validating.value = false
  }
}

const saveFlow2Config = async () => {
  if (!flow2Port.value) {
    ElMessage.warning('请输入端口号')
    return
  }

  // 拼接完整的 baseURL
  flow2Form.baseURL = `http://localhost:${flow2Port.value}`

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
    ElMessage.success(t('settings.msg.configSaved'))
  } catch (error) {
    if (error instanceof Error) {
      ElMessage.error(t('settings.msg.configSaveFailPrefix') + error.message)
    }
  } finally {
    validating.value = false
  }
}

const testFlow2Connection = async () => {
  if (!flow2Form.baseURL) {
    ElMessage.warning(t('settings.msg.enterApiUrlFirst'))
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
      ElMessage.success(t('settings.msg.flow2Ok'))
    } else {
      ElMessage.error(t('settings.msg.flow2Fail'))
    }
  } catch (error) {
    ElMessage.error(t('settings.msg.flow2EnsureRunning'))
  } finally {
    validating.value = false
  }
}

const saveAliyunConfig = async () => {
  if (!aliyunForm.apiKey) {
    ElMessage.warning('请输入 API Key')
    return
  }

  validating.value = true
  try {
    store.updateAliyunConfig({
      apiKey: aliyunForm.apiKey,
      baseURL: aliyunForm.baseURL,
      maxTokens: null,
      unlimitedTokens: true,
      temperature: 0.7
    })
    store.setConfigType('aliyun')
    ElMessage.success(t('settings.msg.configSaved'))
  } catch (error) {
    if (error instanceof Error) {
      ElMessage.error(t('settings.msg.configSaveFailPrefix') + error.message)
    }
  } finally {
    validating.value = false
  }
}

const testAliyunConnection = async () => {
  if (!aliyunForm.apiKey) {
    ElMessage.warning('请输入 API Key')
    return
  }

  validating.value = true
  try {
    store.updateAliyunConfig({
      apiKey: aliyunForm.apiKey,
      baseURL: aliyunForm.baseURL,
      maxTokens: null,
      unlimitedTokens: true,
      temperature: 0.7
    })
    store.setConfigType('aliyun')

    const isValid = await apiService.validateApiKey('aliyun')
    if (isValid) {
      ElMessage.success(t('settings.msg.testOk'))
    } else {
      ElMessage.error(t('settings.msg.testFail'))
    }
  } catch (error) {
    if (error instanceof Error) {
      ElMessage.error(t('settings.msg.testFailPrefix') + error.message)
    }
  } finally {
    validating.value = false
  }
}

const checkFlow2Status = async () => {
  if (configType.value !== 'flow2') {
    return
  }
  
  try {
    // 先检查 Electron 中的进程状态
    if (window.electronAPI?.flow2api) {
      const isRunningFromElectron = await window.electronAPI.flow2api.isRunning()
      
      if (isRunningFromElectron) {
        // 进程正在运行，再检查 HTTP 服务
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
          } else {
            flow2ServiceStatus.value = 'starting'
          }
        } catch {
          // HTTP 还没启动成功，但进程已在运行
          flow2ServiceStatus.value = 'starting'
        }
        return
      }
    }
    
    // 否则只检查 HTTP
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
      } else {
        flow2ServiceStatus.value = 'stopped'
      }
    } catch {
      flow2ServiceStatus.value = 'stopped'
    }
  } catch {
    flow2ServiceStatus.value = 'stopped'
  }
}

const extractPortFromBaseURL = (baseURL: string): number => {
  try {
    const url = new URL(baseURL)
    return parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80)
  } catch {
    return 8001
  }
}

const startFlow2Service = async () => {
  if (!window.electronAPI?.flow2api) {
    ElMessage.warning('无法调用 Flow2API，请确保应用以 Electron 方式运行')
    return
  }
  
  flow2ServiceStatus.value = 'starting'
  
  try {
    const port = extractPortFromBaseURL(flow2Form.baseURL)
    const result = await window.electronAPI.flow2api.start(port)
    
    if (result.success) {
      ElMessage.success('Flow2API 服务启动成功！')
      flow2ServiceStatus.value = 'running'
      
      if (!flow2StatusCheckInterval) {
        flow2StatusCheckInterval = setInterval(checkFlow2Status, 5000)
      }
    } else {
      ElMessage.error(result.message || 'Flow2API 服务启动失败')
      flow2ServiceStatus.value = 'stopped'
    }
  } catch (error) {
    console.error('启动Flow2失败:', error)
    flow2ServiceStatus.value = 'stopped'
    ElMessage.error('Flow2API 服务启动失败，请查看日志了解详情')
  }
}

const stopFlow2Service = async () => {
  if (!window.electronAPI?.flow2api) {
    ElMessage.warning('无法调用 Flow2API，请确保应用以 Electron 方式运行')
    return
  }
  
  flow2ServiceStatus.value = 'stopping'
  
  try {
    const result = await window.electronAPI.flow2api.stop()
    
    if (result.success) {
      ElMessage.success('Flow2API 服务已停止')
      flow2ServiceStatus.value = 'stopped'
    } else {
      ElMessage.error(result.message || 'Flow2API 服务停止失败')
      flow2ServiceStatus.value = 'running'
    }
  } catch (error) {
    console.error('停止Flow2失败:', error)
    flow2ServiceStatus.value = 'running'
    ElMessage.error('Flow2API 服务停止失败，请查看日志了解详情')
  }
}

const openFlow2Dashboard = () => {
  window.open(`${flow2Form.baseURL}`, '_blank')
}

const showFlow2GuideDialog = async () => {
  try {
    // 尝试通过 Electron API 读取文件
    if (window.electronAPI?.fs?.readFile) {
      const content = await window.electronAPI.fs.readFile(
        'flow2api-main/flow2api使用说明.txt',
        'utf-8'
      )
      flow2GuideContent.value = content
    } else {
      // 备用：直接嵌入说明内容
      flow2GuideContent.value = `==========================================
  Flow2API 集成使用说明
==========================================

📦 一、环境要求

1. 必须安装：
   - Python 3.8 或更高版本
   - 下载地址：https://www.python.org/downloads/
   - ⚠️ 安装时务必勾选 "Add Python to PATH"
   - 文字教程 https://blog.csdn.net/janechel/article/details/134457443

2. 推荐安装：
   - Chrome 或 Edge 浏览器（用于验证码处理）

🔧 二、安装步骤

方式一：自动安装（推荐）
1. 双击运行 flow2api-main\simple-install.bat
2. 等待安装完成

方式二：手动安装
1. 进入 flow2api-main 目录
2. 创建虚拟环境：python -m venv venv
3. 激活虚拟环境：venv\Scripts\activate
4. 安装依赖：pip install -r requirements.txt
5. 安装浏览器：playwright install chromium
6. 复制配置：复制 config\setting_example.toml 为 config\setting.toml

🚀 三、启动使用

1. 直接启动你的星梦动画软件
2. Flow2API 会自动在后台启动
3. 首次启动可能需要几秒钟

⚙️ 四、配置说明

1. 在星梦动画软件中：
   - 打开设置 → API 设置
   - 选择 "Flow2" 标签
   - API 地址：http://localhost:8000
   - API Key：XINGMENG2026（默认，可在 setting.toml 中修改）

2. Flow2API 管理后台：
   - 浏览器访问：http://localhost:8000
   - 用户名：admin
   - 密码：admin（首次登录请修改）
   - 在后台可以添加 Flow Token
3.浏览器中配置使用插件 Flow2API-Token-Updater-main
   - 使用谷歌浏览器找到扩展程序，开启开发者模式
   - 将 Flow2API-Token-Updater-main 直接拖入扩展程序页面内，并开启
   - http://localhost:8000 中点击系统配置
   - 把插件连接配置中的接口和链接token配置到 插件中保存
   - 点击浏览器的插件中的立即测试，并查看日志是否链接正确
   - 需要自行打开 https://labs.google/fx/vi/tools/flow 进行谷歌账号登录
   - 如果链接不上请科学上网
   - 返回后台的token管理中看是否已经读取到账号
4. 在模型设置中：
   - 图片生成 → 模型组选择 "Flow2"
   - 视频生成 → 模型组选择 "Flow2"
5. 开始使用

📝 五、常见问题

Q: 启动时提示找不到 Python？
A: 请重新安装 Python，并确保勾选 "Add Python to PATH"

Q: 依赖安装失败？
A: 尝试使用国内镜像源：
   pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

Q: Flow2API 启动失败？
A: 检查 8000 端口是否被占用，或修改 config/setting.toml 中的端口

Q: 生成失败？
A: 请先在 Flow2API 管理后台添加有效的 Flow Token

`
    }
    showFlow2Guide.value = true
  } catch (error) {
    console.error('读取说明文件失败:', error)
    ElMessage.error('读取说明文件失败，请检查文件是否存在')
  }
}

const openVideoGuide = () => {
  window.open('https://www.bilibili.com/video/BV1gzRDBcE72', '_blank')
}

const openYesCaptchaPurchase = () => {
  window.open('https://yescaptcha.com/i/3fA47q', '_blank')
}

const loadConfig = () => {
  configType.value = store.configType

  if (store.officialConfig) {
    officialForm.apiKey = store.officialConfig.apiKey
    officialForm.baseURL = store.officialConfig.baseURL || 'https://api.ussn.cn/v1'
  }

  if (store.customConfig) {
    flow2Form.apiKey = store.customConfig.apiKey || 'XINGMENGDONGHUA'
    flow2Form.baseURL = store.customConfig.baseURL || 'http://localhost:8001'
    // 从 baseURL 中提取端口号
    const urlMatch = flow2Form.baseURL.match(/:(\d+)/)
    flow2Port.value = urlMatch ? urlMatch[1] : '8001'
  }

  checkFlow2Status()
}

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    activeTab.value = props.defaultTab || 'storage'
    loadConfig()
    loadDataPaths()
    checkFlow2Status()
  }
})

onBeforeUnmount(() => {
  if (flow2StatusCheckInterval) {
    clearInterval(flow2StatusCheckInterval)
  }
  if (paymentCheckTimer) {
    clearInterval(paymentCheckTimer)
  }
  if (updateStatusCleanup) {
    updateStatusCleanup()
  }
})

// 自动更新处理函数
const handleCheckUpdate = async () => {
  console.log('handleCheckUpdate 被调用')
  updateStatus.value = 'checking'
  updateErrorMessage.value = ''
  try {
    console.log('调用 getCurrentVersion...')
    const currentVer = await window.electronAPI.updater.getCurrentVersion()
    console.log('当前版本:', currentVer)
    ElMessage.info(t('settings.msg.currentVersionTpl', { version: currentVer.version, build: currentVer.buildNumber }))
    console.log('调用 checkForUpdates...')
    await window.electronAPI.updater.checkForUpdates()
    console.log('checkForUpdates 调用完成')
  } catch (error) {
    console.error('检查更新失败:', error)
    updateStatus.value = 'error'
    updateErrorMessage.value = error instanceof Error ? error.message : '检查更新失败'
    ElMessage.error(t('settings.msg.checkUpdateFailPrefix') + updateErrorMessage.value)
  }
}

const handleDownloadUpdate = async () => {
  if (!currentVersionInfo) {
    ElMessage.error(t('settings.msg.invalidVersionInfo'))
    return
  }
  try {
    const result = await window.electronAPI.updater.downloadUpdate()
    if (result.success) {
      ElMessage.success(t('settings.msg.updateDownloaded'))
    } else if (result.message) {
      ElMessage.error(result.message)
    }
  } catch (error) {
    ElMessage.error(t('settings.msg.downloadFailPrefix') + (error instanceof Error ? error.message : t('settings.msg.unknownErr')))
  }
}

const handleInstallUpdate = () => {
  window.electronAPI.updater.installUpdate()
}

const openExternalLink = (url: string) => {
  window.electronAPI.shell.openPath(url)
}

const handleSaveOssConfig = async () => {
  if (!ossForm.ossEndpoint || !ossForm.ossVersionPath) {
    ElMessage.warning(t('settings.msg.ossIncomplete'))
    return
  }
  ossSaving.value = true
  try {
    await window.electronAPI.updater.setOssConfig({
      ossEndpoint: ossForm.ossEndpoint,
      ossVersionPath: ossForm.ossVersionPath,
      ossAccessKeyId: ossForm.ossAccessKeyId,
      ossAccessKeySecret: ossForm.ossAccessKeySecret
    })
    ElMessage.success(t('settings.msg.ossSaved'))
  } catch (error) {
    ElMessage.error(t('settings.msg.ossSaveFail'))
  } finally {
    ossSaving.value = false
  }
}

const handleTestOssConfig = async () => {
  if (!ossForm.ossEndpoint) {
    ElMessage.warning(t('settings.msg.ossNeedEndpoint'))
    return
  }
  ElMessage.info(t('settings.msg.ossTesting'))
  await handleCheckUpdate()
}

// 加载OSS配置
const loadOssConfig = async () => {
  try {
    const config = await window.electronAPI.updater.getOssConfig()
    ossForm.ossEndpoint = config.ossEndpoint || ''
    ossForm.ossVersionPath = config.ossVersionPath || ''
    ossForm.ossAccessKeyId = config.ossAccessKeyId || ''
    ossForm.ossAccessKeySecret = config.ossAccessKeySecret || ''
  } catch (error) {
    console.error('加载OSS配置失败:', error)
  }
}

// 监听更新状态变化
const initUpdateListener = () => {
  console.log('initUpdateListener 被调用')
  if (updateStatusCleanup) {
    updateStatusCleanup()
  }
  updateStatusCleanup = window.electronAPI.updater.onUpdateStatus((status) => {
    console.log('收到更新状态:', JSON.stringify(status))
    switch (status.status) {
      case 'checking':
        updateStatus.value = 'checking'
        break
      case 'available':
        updateStatus.value = 'available'
        latestVersion.value = status.version || ''
        latestReleaseDate.value = status.releaseDate || ''
        latestReleaseNotes.value = typeof status.releaseNotes === 'string' ? status.releaseNotes : ''
        currentVersionInfo = {
          version: status.version || '',
          buildNumber: status.buildNumber || 0,
          releaseDate: status.releaseDate || '',
          releaseNotes: typeof status.releaseNotes === 'string' ? status.releaseNotes : '',
          downloadUrl: status.downloadUrl || '',
          checksum: ''
        }
        activeTab.value = 'about'
        void ElMessageBox.alert(
          t('settings.newVersionDlgBodyTpl', {
            version: status.version || '',
            about: t('settings.tabAbout'),
            download: t('settings.aboutBtnDownloadInstall'),
          }),
          t('settings.newVersionDlgTitle'),
          { confirmButtonText: t('settings.newVersionDlgConfirm'), type: 'success', appendTo: document.body }
        )
        break
      case 'not-available':
        updateStatus.value = 'not-available'
        ElMessage.info(t('settings.msg.updateAlreadyLatest'))
        break
      case 'downloading':
        updateStatus.value = 'downloading'
        downloadPercent.value = Math.round(status.percent || 0)
        break
      case 'downloaded':
        updateStatus.value = 'downloaded'
        ElMessage.success(t('settings.msg.updateDownloaded'))
        break
      case 'error':
        updateStatus.value = 'error'
        updateErrorMessage.value = status.message || '更新出错'
        ElMessage.error(t('settings.msg.updateErrTpl', { msg: status.message || '' }))
        break
    }
  })
}

// 监听 visible 变化，初始化/清理更新监听
watch(visible, (newVal) => {
  if (newVal) {
    updateStatus.value = 'idle'
    initUpdateListener()
  }
}, { immediate: true })
</script>

<style scoped>
.settings-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.settings-container {
  position: relative;
  display: flex;
}

.settings-sidebar {
  width: 160px;
  flex-shrink: 0;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  padding: 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-sidebar-head {
  margin-bottom: 8px;
  text-align: center;
}

.settings-sidebar-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
  min-width: 0;
}

.settings-dialog-close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.settings-dialog-close--floating {
  position: absolute;
  top: 2px;
  right: 2px;
  z-index: 30;
}

.settings-dialog-close:hover {
  background-color: rgba(102, 126, 234, 0.12);
  color: var(--primary-color);
}

.settings-dialog-close .el-icon {
  font-size: 18px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary);
  font-size: 14px;
}

.sidebar-item:hover {
  background-color: rgba(102, 126, 234, 0.1);
  color: var(--primary-color);
}

.sidebar-item.active {
  background-color: rgba(102, 126, 234, 0.15);
  color: var(--primary-color);
}

.sidebar-item .el-icon {
  font-size: 18px;
  color: inherit;
}

.settings-main {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
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

.settings-content {
  min-height: 300px;
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
  background-color: var(--bg-secondary);
  padding: 8px 12px;
  border-radius: 6px;
  flex: 1;
}

.storage-value.default {
  color: var(--text-muted);
}

.storage-tips-container {
  display: flex;
  gap: 16px;
  margin-top: 16px;
}

.storage-tips-container .storage-tips,
.storage-tips-container .platform-info {
  flex: 1;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.storage-tips-container .storage-tips {
  flex: 1;
}

.storage-tips-container .platform-info {
  flex: 1.1;
}

.storage-tips-container .platform-info .platform-item {
  margin: 4px 0;
  font-size: 12px;
  color: var(--text-muted);
  font-family: monospace;
}

.storage-tips-container .storage-tips p {
  margin: 0 0 8px 0;
}

.storage-tips-container .storage-tips ul {
  margin: 8px 0;
  padding-left: 20px;
}

.storage-tips-container .storage-tips li {
  margin-bottom: 4px;
}

.storage-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.jianying-path-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
}

.storage-section,
.jianying-section {
  background-color: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.section-header .el-icon {
  font-size: 18px;
  color: var(--primary-color);
}

.section-body {
  padding: 20px;
}

.storage-item-row,
.jianying-item-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.storage-item-row:last-child,
.jianying-item-row:last-child {
  margin-bottom: 0;
}

.item-label {
  font-size: 14px;
  color: var(--text-secondary);
  flex-shrink: 0;
  min-width: 100px;
}

.item-value {
  font-size: 14px;
  color: var(--text-primary);
}

.path-value {
  flex: 1;
  word-break: break-all;
  font-family: monospace;
  background-color: var(--bg-tertiary);
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
}

.path-value.default {
  color: var(--text-muted);
}

.item-actions {
  display: flex;
  width: 120px;
  gap: 8px;
  flex-shrink: 0;
}

.storage-item-row--auto-save .auto-save-input {
  flex: 1;
  min-width: 0;
}

.auto-save-input {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.auto-save-unit {
  font-size: 14px;
  color: var(--text-secondary);
}

.auto-save-hint {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.storage-actions,
.jianying-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.jianying-tips {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.jianying-tips p {
  margin: 0 0 8px 0;
}

.jianying-tips p:last-child {
  margin-bottom: 0;
}

.jianying-tips .platform-default {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
  color: var(--text-muted);
  font-size: 12px;
}

.jianying-path-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.jianying-path-info {
  margin-bottom: 16px;
}

.jianying-path-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.jianying-path-label {
  color: var(--text-secondary);
  font-size: 14px;
}

.jianying-path-value {
  color: var(--text-primary);
  font-size: 14px;
  word-break: break-all;
}

.jianying-path-tips {
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 12px;
}

.jianying-path-tips p {
  margin-bottom: 4px;
}

.jianying-path-actions {
  display: flex;
  gap: 12px;
}

.config-status {
  margin-bottom: 16px;
}

.config-type-selector {
  margin-bottom: 24px;
}

.config-type-selector :deep(.el-radio-button__inner) {
  padding: 10px 20px;
}

.config-dot {
  display: inline-block;
  margin-left: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.config-dot.configured {
  background-color: #67c23a;
  box-shadow: 0 0 4px rgba(103, 194, 58, 0.6);
}

.config-dot.unconfigured {
  background-color: #f56c6c;
  box-shadow: 0 0 4px rgba(245, 108, 108, 0.6);
}

.config-section {
  margin-top: 20px;
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

.api-url-row {
  display: flex;
  align-items: center;
  width: 100%;
}

.service-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.service-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.service-status-right {
  margin-left: 15px;
}

.profile-section {
  max-width:100%;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 16px;
}

.profile-basic {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profile-tags {
  display: flex;
  align-items: center;
}

.profile-tags .el-tag {
  height: 24px;
  line-height: 24px;
}

.profile-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.profile-logout-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.profile-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  padding: 4px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.profile-tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.profile-tab-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.profile-tab-btn.active {
  background: var(--primary-color);
  color: #fff;
  font-weight: 500;
}

.profile-tab-btn .el-icon {
  font-size: 16px;
}

.profile-tab-content {
  min-height: 300px;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.profile-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.info-label {
  width: 80px;
  font-size: 14px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.info-value {
  font-size: 14px;
  color: var(--text-primary);
}

.info-value.vip-expire {
  color: #e6a23c;
  font-weight: 500;
}

.profile-actions {
  margin-top: 16px;
}

.profile-actions h4 {
  margin: 0 0 16px 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.password-form {
  max-width: 400px;
}

.about-section {
  padding: 0 20px;
}

.about-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.about-header h3 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary);
}

.about-info {
  margin-bottom: 16px;
}

.about-desc {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0;
}

.update-section {
  margin: 20px 0;
}

.update-status {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--text-secondary);
}

.update-actions {
  display: flex;
  gap: 12px;
}

.update-status .checking {
  color: var(--primary-color);
}

.update-status .available {
  color: var(--success-color);
}

.update-status .downloading {
  color: var(--primary-color);
}

.update-status .downloaded {
  color: var(--success-color);
  font-weight: 500;
}

.update-status .error {
  color: var(--danger-color);
}

.release-notes {
  margin-top: 16px;
  padding: 12px;
  background-color: var(--bg-tertiary);
  border-radius: 8px;
}

.release-notes h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: var(--text-primary);
}

.release-notes pre {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.oss-config-section {
  margin-top: 20px;
}

.oss-config-section h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: var(--text-primary);
}

.oss-tips {
  margin: 0 0 16px 0;
  font-size: 13px;
  color: var(--text-muted);
}

.oss-form {
  max-width: 400px;
}

.form-tip {
  margin-top: -12px;
  margin-bottom: 16px;
  padding-left: 120px;
  font-size: 12px;
  color: var(--text-muted);
}

.vip-packages {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.vip-package {
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
}

.vip-package:hover {
  border-color: var(--primary-color);
  transform: translateY(-2px);
}

.vip-package.selected {
  border-color: var(--primary-color);
  background-color: rgba(102, 126, 234, 0.1);
}

.package-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}

.package-header h4 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary);
}

.package-price {
  margin-bottom: 8px;
}

.price-symbol {
  font-size: 16px;
  color: var(--primary-color);
}

.price-value {
  font-size: 28px;
  font-weight: bold;
  color: var(--primary-color);
}

.package-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.package-duration {
  font-size: 12px;
  color: var(--text-muted);
}

.vip-benefits {
  background-color: var(--bg-secondary);
  border-radius: 8px;
  padding: 16px;
}

.vip-benefits h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--text-primary);
}

.vip-benefits ul {
  margin: 0;
  padding-left: 20px;
}

.vip-benefits li {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
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

.pay-tips {
  font-size: 13px;
  color: var(--text-secondary);
}

.model-manager {
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
}

.model-type-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--border-color);
  margin-bottom: 16px;
}

.model-type-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.model-type-tab:hover {
  color: var(--text-primary);
}

.model-type-tab.active {
  color: var(--primary-color);
}

.model-type-tab.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--primary-color);
}

.model-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.model-panel-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.model-panel-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.model-group-radios {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.model-group-radio {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-color);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.model-group-radio:hover {
  border-color: var(--primary-color);
  color: var(--text-primary);
}

.model-group-radio.active {
  border-color: var(--primary-color);
  background: rgba(64, 158, 255, 0.1);
  color: var(--primary-color);
}

.model-group-radio .radio-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  position: relative;
  flex-shrink: 0;
}

.model-group-radio.active .radio-dot::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.model-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 8px;
}

.model-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 15px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.model-item:hover {
  border-color: var(--primary-color);
  color: var(--text-primary);
}

.model-item.active {
  border-color: var(--primary-color);
  background: rgba(64, 158, 255, 0.1);
  color: var(--primary-color);
}

.model-item .radio-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  position: relative;
  flex-shrink: 0;
}

.model-item.active .radio-dot::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.model-item-name {
  flex: 1;
  font-weight: 500;
}

.model-item-price {
  color: var(--primary-color);
  font-size: 12px;
}

.model-empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 24px;
  color: var(--text-secondary);
  font-size: 13px;
}

.el-radio-group :deep(.el-radio-button__inner) {
  background-color: var(--bg-color);
  border-color: var(--border-color);
  color: var(--text-secondary);
}

.el-radio-group :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
}

.el-radio-group :deep(.el-radio-button__inner:hover) {
  color: var(--primary-color);
}

.pay-tips p {
  margin: 4px 0;
}

.setting-section-block {
  margin-bottom: 24px;
}

.setting-section-title {
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.language-options {
  display: flex;
  gap: 12px;
}

.language-option-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background-color: var(--bg-tertiary);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary);
  min-width: 120px;
}

.language-option-btn:hover {
  border-color: var(--primary-color);
  color: var(--text-primary);
}

.language-option-btn.active {
  border-color: var(--primary-color);
  background-color: rgba(102, 126, 234, 0.15);
  color: var(--primary-color);
}

.language-option-btn span:first-child {
  font-size: 20px;
}

.language-option-btn span:last-child {
  font-size: 14px;
  font-weight: 500;
}

.theme-options {
  display: flex;
  gap: 12px;
}

.theme-option-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  background-color: var(--bg-tertiary);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary);
  min-width: 80px;
}

.theme-option-btn:hover {
  border-color: var(--primary-color);
  color: var(--text-primary);
}

.theme-option-btn.active {
  border-color: var(--primary-color);
  background-color: var(--primary-color);
  color: #fff;
}

.theme-option-btn .el-icon {
  font-size: 24px;
}

.theme-option-btn span {
  font-size: 13px;
  font-weight: 500;
}

.canvas-settings {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color);
}

.canvas-settings h4 {
  margin: 0 0 16px 0;
  font-size: 15px;
  color: var(--text-primary);
}

.edge-style-options {
  display: flex;
  gap: 12px;
}

.style-option-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: var(--bg-tertiary);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary);
  min-width: 80px;
}

.style-option-btn:hover {
  border-color: var(--primary-color);
  color: var(--text-primary);
}

.style-option-btn.active {
  border-color: var(--primary-color);
  background-color: rgba(64, 158, 255, 0.15);
  color: var(--primary-color);
}

.style-option-btn svg {
  width: 60px;
  height: 20px;
}

.style-option-btn span {
  font-size: 13px;
  font-weight: 500;
}

.edge-width-row .edge-width-control {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
  max-width: 360px;
}

.edge-width-row .edge-width-control .el-slider {
  flex: 1;
  min-width: 0;
}

.edge-width-value {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--text-secondary);
  width: 36px;
  text-align: right;
}

.edge-color-row .edge-color-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.edge-color-value {
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 78px;
  text-transform: uppercase;
}

.api-usage-guide {
  margin-top: 24px;
  padding: 20px;
  background-color: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.guide-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.guide-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.guide-step {
  display: flex;
  gap: 12px;
}

.step-number {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  color: white;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-content {
  flex: 1;
}

.step-title {
  margin: 0 0 6px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.step-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.flow2-guide-content {
  max-height: 500px;
  overflow-y: auto;
  padding: 8px;
  background-color: var(--bg-secondary);
  border-radius: 8px;
}

.flow2-guide-content .guide-text {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.8;
  font-family: 'Microsoft YaHei', sans-serif;
}
</style>

<style>
/*
 * 系统设置弹窗 teleport 到 body，仅用 scoped 时 .el-dialog__header 仍占位。
 * 无标题时彻底去掉 header 区域。
 */
.el-dialog.settings-dialog {
  min-width: 1000px !important;
  min-height: 750px !important;
  margin-top: 50px !important;
}

.el-dialog.settings-dialog .el-dialog__header {
  display: none !important;
}
</style>