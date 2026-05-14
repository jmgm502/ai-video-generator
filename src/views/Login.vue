<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/userStore'
import { fetchCloudAuth } from '@/config/cloudApi'
import { Lock, View, Hide, VideoPlay, PictureFilled, MagicStick, Timer, Message, Key, Promotion } from '@element-plus/icons-vue'
import LoginAnimatedCharacters from '@/components/login/LoginAnimatedCharacters.vue'

const bgImage = new URL('/bg.jpg', import.meta.url).href
const starlightCanvasRef = ref<HTMLCanvasElement | null>(null)
let animationFrameId: number | null = null

interface StarParticle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  opacity: number
  color: string
  life: number
  maxLife: number
  isFast: boolean
  isStar: boolean
  twinklePhase: number
  twinkleSpeed: number
}

const STAR_COLORS = [
  'rgba(255, 255, 255, ',
  'rgba(200, 220, 255, ',
  'rgba(255, 240, 200, ',
  'rgba(180, 200, 255, ',
  'rgba(255, 200, 220, ',
]

const particles: StarParticle[] = []
const MAX_PARTICLES = 200
const SPAWN_RATE = 20

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerRadius: number, innerRadius: number, opacity: number, color: string) {
  const spikes = 5
  let rot = Math.PI / 2 * 3
  const step = Math.PI / spikes

  ctx.beginPath()
  ctx.moveTo(cx, cy - outerRadius)

  for (let i = 0; i < spikes; i++) {
    let x = cx + Math.cos(rot) * outerRadius
    let y = cy + Math.sin(rot) * outerRadius
    ctx.lineTo(x, y)
    rot += step

    x = cx + Math.cos(rot) * innerRadius
    y = cy + Math.sin(rot) * innerRadius
    ctx.lineTo(x, y)
    rot += step
  }

  ctx.lineTo(cx, cy - outerRadius)
  ctx.closePath()
  ctx.fillStyle = color + opacity + ')'
  ctx.fill()
}

function createParticle(canvasWidth: number, canvasHeight: number): StarParticle {
  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2

  const spawnRadius = Math.min(canvasWidth, canvasHeight) * 0.40
  const spawnAngle = Math.random() * Math.PI * 2
  const spawnX = centerX + Math.cos(spawnAngle) * spawnRadius
  const spawnY = centerY + Math.sin(spawnAngle) * spawnRadius

  const edge = Math.floor(Math.random() * 4)
  let targetX: number, targetY: number

  switch (edge) {
    case 0:
      targetX = Math.random() * canvasWidth
      targetY = -50
      break
    case 1:
      targetX = canvasWidth + 50
      targetY = Math.random() * canvasHeight
      break
    case 2:
      targetX = Math.random() * canvasWidth
      targetY = canvasHeight + 50
      break
    default:
      targetX = -50
      targetY = Math.random() * canvasHeight
      break
  }

  const dx = targetX - spawnX
  const dy = targetY - spawnY
  const dist = Math.sqrt(dx * dx + dy * dy)

  const isFast = Math.random() > 0.5
  const isStar = Math.random() > 0.7
  const speedMultiplier = isFast ? (0.8 + Math.random() * 0.7) : (0.2 + Math.random() * 0.3)
  const baseSpeed = (1.5 + Math.random() * 2) * speedMultiplier

  return {
    x: spawnX,
    y: spawnY,
    z: 800 + Math.random() * 400,
    vx: (dx / dist) * baseSpeed,
    vy: (dy / dist) * baseSpeed,
    vz: -(2 + Math.random() * 4) * speedMultiplier,
    size: isStar ? (2 + Math.random() * 3) : (1 + Math.random() * 2),
    opacity: 0,
    color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    life: 0,
    maxLife: isFast ? (60 + Math.random() * 80) : (150 + Math.random() * 150),
    isFast,
    isStar,
    twinklePhase: Math.random() * Math.PI * 2,
    twinkleSpeed: 0.03 + Math.random() * 0.05,
  }
}

function animateStarlight() {
  const canvas = starlightCanvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height

  ctx.clearRect(0, 0, width, height)

  if (particles.length < MAX_PARTICLES) {
    for (let i = 0; i < SPAWN_RATE; i++) {
      if (particles.length < MAX_PARTICLES) {
        particles.push(createParticle(width, height))
      }
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]

    p.x += p.vx
    p.y += p.vy
    p.z += p.vz
    p.life++
    p.twinklePhase += p.twinkleSpeed

    const progress = p.life / p.maxLife
    const scale = 800 / Math.max(p.z, 1)

    let twinkleFactor = 1
    if (p.isStar) {
      twinkleFactor = 0.4 + Math.sin(p.twinklePhase) * 0.6
    }

    let baseOpacity = progress < 0.3 ? progress / 0.3 : progress > 0.7 ? (1 - progress) / 0.3 : 1
    baseOpacity *= 0.8
    p.opacity = baseOpacity * twinkleFactor

    const screenX = (p.x - width / 2) * scale + width / 2
    const screenY = (p.y - height / 2) * scale + height / 2
    const screenSize = p.size * scale

    if (screenX < -50 || screenX > width + 50 || screenY < -50 || screenY > height + 50 || p.z <= 0) {
      particles.splice(i, 1)
      continue
    }

    if (p.isStar) {
      const outerR = Math.max(screenSize * 1.5, 1)
      const innerR = outerR * 0.4
      drawStar(ctx, screenX, screenY, outerR, innerR, p.opacity, p.color)

      if (screenSize > 2) {
        ctx.beginPath()
        ctx.arc(screenX, screenY, screenSize * 3, 0, Math.PI * 2)
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, screenSize * 3)
        gradient.addColorStop(0, p.color + (p.opacity * 0.4) + ')')
        gradient.addColorStop(0.5, p.color + (p.opacity * 0.15) + ')')
        gradient.addColorStop(1, p.color + '0)')
        ctx.fillStyle = gradient
        ctx.fill()
      }
    } else {
      ctx.beginPath()
      ctx.arc(screenX, screenY, Math.max(screenSize, 0.5), 0, Math.PI * 2)
      ctx.fillStyle = p.color + p.opacity + ')'
      ctx.fill()

      if (screenSize > 1.5) {
        ctx.beginPath()
        ctx.arc(screenX, screenY, screenSize * 2, 0, Math.PI * 2)
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, screenSize * 2)
        gradient.addColorStop(0, p.color + (p.opacity * 0.3) + ')')
        gradient.addColorStop(1, p.color + '0)')
        ctx.fillStyle = gradient
        ctx.fill()
      }
    }
  }

  animationFrameId = requestAnimationFrame(animateStarlight)
}

function initStarlightCanvas() {
  const canvas = starlightCanvasRef.value
  if (!canvas) return

  const resize = () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }

  resize()
  window.addEventListener('resize', resize)

  particles.length = 0
  animateStarlight()
}

function cleanupStarlightCanvas() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  particles.length = 0
}

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const { t } = useI18n()

const formRef = ref()
const loading = ref(false)
const showPassword = ref(false)
const isRegister = ref(false)
const isForgotPassword = ref(false)
const countdown = ref(0)
const sendingCode = ref(false)

/** 左侧角色动画：任意表单控件聚焦视为 typing */
const formInputFocused = ref(false)
let formFocusBlurTimer: number | undefined

function onLoginFormFocusIn() {
  if (formFocusBlurTimer) clearTimeout(formFocusBlurTimer)
  formInputFocused.value = true
}

function onLoginFormFocusOut() {
  formFocusBlurTimer = window.setTimeout(() => {
    const root = formRef.value?.$el as HTMLElement | undefined
    const ae = document.activeElement as HTMLElement | null
    if (root && ae && root.contains(ae)) return
    formInputFocused.value = false
  }, 60)
}

/** 密码框有内容时驱动「捂密码 / 张望」等行为（对齐 login-animation-master） */
const hasSecretPassword = computed(() => loginForm.password.trim().length > 0)

const loginForm = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  verifyCode: '',
  inviteCode: '',
  remember: false,
})

const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

onMounted(() => {
  const savedCredentials = localStorage.getItem('remembered_credentials')
  if (savedCredentials) {
    try {
      const { email, password } = JSON.parse(savedCredentials)
      loginForm.email = email || ''
      loginForm.password = password || ''
      loginForm.remember = true
    } catch {
      localStorage.removeItem('remembered_credentials')
    }
  }

  initStarlightCanvas()
})

onUnmounted(() => {
  if (formFocusBlurTimer) clearTimeout(formFocusBlurTimer)
  cleanupStarlightCanvas()
})

const loginRules = computed(() => ({
  email: [
    { required: true, message: t('loginPage.valEmailRequired'), trigger: 'blur' },
    { type: 'email' as const, message: t('loginPage.valEmailFormat'), trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('loginPage.valPasswordRequired'), trigger: 'blur' },
    { min: 6, max: 20, message: t('loginPage.valPasswordLen'), trigger: 'blur' },
  ],
}))

const registerRules = computed(() => ({
  email: [
    { required: true, message: t('loginPage.valEmailRequired'), trigger: 'blur' },
    { type: 'email' as const, message: t('loginPage.valEmailFormat'), trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('loginPage.valPasswordRequired'), trigger: 'blur' },
    { min: 6, max: 20, message: t('loginPage.valPasswordLen'), trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: t('loginPage.valConfirmPassword'), trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (value && value !== loginForm.password) {
          callback(new Error(t('loginPage.valPasswordMismatch')))
        } else {
          callback()
        }
      },
      trigger: ['blur', 'change'],
    },
  ],
  verifyCode: [
    { required: true, message: t('loginPage.valVerifyRequired'), trigger: 'blur' },
    { len: 6, message: t('loginPage.valVerifyLen'), trigger: 'blur' },
  ],
}))

/** 找回密码表单需校验邮箱、新密码、确认、验证码（与登录规则不同） */
const forgotRules = computed(() => ({
  email: [
    { required: true, message: t('loginPage.valEmailRequired'), trigger: 'blur' },
    { type: 'email' as const, message: t('loginPage.valEmailFormat'), trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('loginPage.valPasswordRequired'), trigger: 'blur' },
    { min: 6, max: 20, message: t('loginPage.valPasswordLen'), trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: t('loginPage.valConfirmPassword'), trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (value && value !== loginForm.password) {
          callback(new Error(t('loginPage.valPasswordMismatch')))
        } else {
          callback()
        }
      },
      trigger: ['blur', 'change'],
    },
  ],
  verifyCode: [
    { required: true, message: t('loginPage.valVerifyRequired'), trigger: 'blur' },
    { len: 6, message: t('loginPage.valVerifyLen'), trigger: 'blur' },
  ],
}))

const currentRules = computed(() => {
  if (isForgotPassword.value) return forgotRules.value
  return isRegister.value ? registerRules.value : loginRules.value
})

const features = computed(() => [
  {
    icon: VideoPlay,
    title: t('loginPage.feat1Title'),
    description: t('loginPage.feat1Desc'),
  },
  {
    icon: PictureFilled,
    title: t('loginPage.feat2Title'),
    description: t('loginPage.feat2Desc'),
  },
  {
    icon: MagicStick,
    title: t('loginPage.feat3Title'),
    description: t('loginPage.feat3Desc'),
  },
  {
    icon: Timer,
    title: t('loginPage.feat4Title'),
    description: t('loginPage.feat4Desc'),
  },
])

const sendVerifyCode = async () => {
  if (!loginForm.email) {
    ElMessage.warning(t('loginPage.warnEmailFirst'))
    return
  }
  
  if (!emailPattern.test(loginForm.email)) {
    ElMessage.warning(t('loginPage.warnBadEmail'))
    return
  }

  if (isForgotPassword.value) {
    if (!loginForm.password) {
      ElMessage.warning(t('loginPage.warnNewPwd'))
      return
    }
    if (loginForm.password.length < 6) {
      ElMessage.warning(t('loginPage.warnPwdShort'))
      return
    }
    if (!loginForm.confirmPassword) {
      ElMessage.warning(t('loginPage.warnConfirmNewPwd'))
      return
    }
    if (loginForm.password !== loginForm.confirmPassword) {
      ElMessage.warning(t('loginPage.warnPwdMismatchShort'))
      return
    }
  }

  sendingCode.value = true
  try {
    const type = isForgotPassword.value ? 'reset' : 'register'
    const response = await fetchCloudAuth('send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginForm.email, type })
    })

    if (response.status === 404) {
      ElMessage.error(t('loginPage.errAuth404'))
      return
    }

    const result = await response.json()
    
    if (result.success) {
      ElMessage.success(t('loginPage.successCodeSent'))
      countdown.value = 60
      
      const timer = setInterval(() => {
        countdown.value--
        if (countdown.value <= 0) {
          clearInterval(timer)
        }
      }, 1000)
    } else {
      ElMessage.error(result.message || t('loginPage.errCodeSendFail'))
    }
  } catch {
    ElMessage.error(t('loginPage.errCodeSendRetry'))
  } finally {
    sendingCode.value = false
  }
}

const handleLogin = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    const action = isRegister.value ? 'register' : 'login'
    const body = isRegister.value
      ? { 
          email: loginForm.email, 
          password: loginForm.password, 
          nickname: loginForm.email.split('@')[0], 
          verifyCode: loginForm.verifyCode,
          inviteCode: loginForm.inviteCode
        }
      : { email: loginForm.email, password: loginForm.password }

    const response = await fetchCloudAuth(action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (response.status === 404) {
      ElMessage.error(t('loginPage.errAuth404'))
      return
    }

    const result = await response.json()
    
    if (result.success) {
      userStore.setUser(result.data.user)
      userStore.setToken(result.data.token)
      
      if (!isRegister.value) {
        if (loginForm.remember) {
          localStorage.setItem('remembered_credentials', JSON.stringify({
            email: loginForm.email,
            password: loginForm.password
          }))
        } else {
          localStorage.removeItem('remembered_credentials')
        }
      }
      
      ElMessage.success(isRegister.value ? t('loginPage.successRegister') : t('loginPage.successLogin'))
      
      const redirect = route.query.redirect as string
      router.push(redirect || '/home')
    } else {
      ElMessage.error(result.message || (isRegister.value ? t('loginPage.errRegisterFail') : t('loginPage.errLoginFail')))
    }
  } catch (error) {
    ElMessage.error(isRegister.value ? t('loginPage.errRegisterNetwork') : t('loginPage.errLoginNetwork'))
  } finally {
    loading.value = false
  }
}

const toggleMode = () => {
  isRegister.value = !isRegister.value
  isForgotPassword.value = false
  loginForm.confirmPassword = ''
  loginForm.verifyCode = ''
  loginForm.inviteCode = ''
}

const showForgotPasswordMode = () => {
  isForgotPassword.value = true
  isRegister.value = false
  loginForm.password = ''
  loginForm.confirmPassword = ''
  loginForm.verifyCode = ''
}

const backToLogin = () => {
  isForgotPassword.value = false
  isRegister.value = false
  loginForm.password = ''
  loginForm.confirmPassword = ''
  loginForm.verifyCode = ''
}

const handleResetPassword = async () => {
  if (!loginForm.email || !loginForm.verifyCode || !loginForm.password) {
    ElMessage.warning(t('loginPage.warnFormIncomplete'))
    return
  }
  
  if (loginForm.password !== loginForm.confirmPassword) {
    ElMessage.warning(t('loginPage.warnPwdMismatchShort'))
    return
  }
  
  if (loginForm.password.length < 6) {
    ElMessage.warning(t('loginPage.warnPwdMin6'))
    return
  }
  
  loading.value = true
  try {
    const response = await fetchCloudAuth('reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: loginForm.email,
        password: loginForm.password,
        verifyCode: loginForm.verifyCode
      })
    })
    
    const result = await response.json()
    
    if (result.success) {
      ElMessage.success(t('loginPage.successPwdReset'))
      backToLogin()
    } else {
      ElMessage.error(result.message || t('loginPage.errResetFail'))
    }
  } catch {
    ElMessage.error(t('loginPage.errResetNetwork'))
  } finally {
    loading.value = false
  }
}

const countdownLabel = computed(() =>
  countdown.value > 0 ? t('loginPage.countdownSec', { n: countdown.value }) : t('loginPage.sendCode')
)

</script>

<template>
  <div class="login-container">
    <div class="video-bg">
      <img
        :src="bgImage"
        class="video-bg-media"
        alt="background"
      />
      <canvas ref="starlightCanvasRef" class="starlight-canvas" />
      <div class="video-bg-overlay" />
    </div>

    <div class="login-content">
      <div class="intro-section">
        <div class="intro-content">
          <div class="animation-area">
            <LoginAnimatedCharacters
              :is-typing="formInputFocused"
              :has-secret="hasSecretPassword"
              :secret-visible="showPassword"
            />
          </div>

          <div class="text-area">
            <p class="brand-subtitle">
              {{ t('loginPage.brandSubtitle') }}
            </p>
            <p class="brand-description">
              {{ t('loginPage.brandDesc') }}
            </p>
          </div>

          <div class="features-list">
            <div
              v-for="(feature, index) in features"
              :key="index"
              class="feature-item"
            >
              <div class="feature-icon">
                <el-icon :size="24">
                  <component :is="feature.icon" />
                </el-icon>
              </div>
              <div class="feature-text">
                <h3 class="feature-title">
                  {{ feature.title }}
                </h3>
                <p class="feature-desc">
                  {{ feature.description }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="login-section">
        <div class="login-card">
          <div class="login-header">
            <h2 class="login-title">
              {{ isForgotPassword ? t('loginPage.titleForgot') : (isRegister ? t('loginPage.titleRegister') : t('loginPage.titleWelcome')) }}
            </h2>
            <p class="login-subtitle">
              {{ isForgotPassword ? t('loginPage.subForgot') : (isRegister ? t('loginPage.subRegister') : t('loginPage.subLogin')) }}
            </p>
          </div>

          <el-form
            ref="formRef"
            :model="loginForm"
            :rules="currentRules"
            class="login-form"
            @submit.prevent="isForgotPassword ? handleResetPassword() : handleLogin()"
            @focusin.capture="onLoginFormFocusIn"
            @focusout.capture="onLoginFormFocusOut"
          >
            <el-form-item prop="email">
              <el-input
                v-model="loginForm.email"
                :placeholder="t('loginPage.phEmail')"
                size="large"
                :prefix-icon="Message"
              />
            </el-form-item>

            <el-form-item
              v-if="!isForgotPassword"
              prop="password"
            >
              <el-input
                v-model="loginForm.password"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="t('loginPage.phPassword')"
                size="large"
                :prefix-icon="Lock"
                @keyup.enter="handleLogin"
              >
                <template #suffix>
                  <el-icon
                    class="cursor-pointer"
                    @click="showPassword = !showPassword"
                  >
                    <View v-if="!showPassword" />
                    <Hide v-else />
                  </el-icon>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item
              v-if="isForgotPassword"
              prop="password"
            >
              <el-input
                v-model="loginForm.password"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="t('loginPage.phNewPassword')"
                size="large"
                :prefix-icon="Lock"
              >
                <template #suffix>
                  <el-icon
                    class="cursor-pointer"
                    @click="showPassword = !showPassword"
                  >
                    <View v-if="!showPassword" />
                    <Hide v-else />
                  </el-icon>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item
              v-if="isRegister || isForgotPassword"
              prop="confirmPassword"
            >
              <el-input
                v-model="loginForm.confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="isForgotPassword ? t('loginPage.phConfirmNewPassword') : t('loginPage.phConfirmPassword')"
                size="large"
                :prefix-icon="Lock"
              >
                <template #suffix>
                  <el-icon
                    class="cursor-pointer"
                    @click="showPassword = !showPassword"
                  >
                    <View v-if="!showPassword" />
                    <Hide v-else />
                  </el-icon>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item
              v-if="isRegister || isForgotPassword"
              prop="verifyCode"
            >
              <div class="verify-code-row">
                <el-input
                  v-model="loginForm.verifyCode"
                  :placeholder="t('loginPage.phVerifyCode')"
                  size="large"
                  :prefix-icon="Key"
                  maxlength="6"
                />
                <el-button
                  type="primary"
                  size="large"
                  :loading="sendingCode"
                  :disabled="countdown > 0"
                  class="send-code-btn"
                  @click="sendVerifyCode"
                >
                  {{ countdownLabel }}
                </el-button>
              </div>
            </el-form-item>

            <el-form-item
              v-if="isRegister"
              prop="inviteCode"
            >
              <el-input
                v-model="loginForm.inviteCode"
                :placeholder="t('loginPage.phInvite')"
                size="large"
                :prefix-icon="Promotion"
              />
            </el-form-item>

            <el-form-item v-if="!isRegister && !isForgotPassword">
              <div class="form-options">
                <el-checkbox v-model="loginForm.remember">
                  {{ t('loginPage.rememberMe') }}
                </el-checkbox>
                <el-link
                  type="primary"
                  underline="never"
                  @click="showForgotPasswordMode"
                >
                  {{ t('loginPage.forgotPassword') }}
                </el-link>
              </div>
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                size="large"
                class="login-btn"
                :loading="loading"
                @click="isForgotPassword ? handleResetPassword() : handleLogin()"
              >
                {{ isForgotPassword ? t('loginPage.btnResetPassword') : (isRegister ? t('loginPage.btnRegister') : t('loginPage.btnLogin')) }}
              </el-button>
            </el-form-item>

            <div class="switch-link">
              <template v-if="isForgotPassword">
                <el-link
                  type="primary"
                  underline="never"
                  @click="backToLogin"
                >
                  {{ t('loginPage.backToLogin') }}
                </el-link>
              </template>
              <template v-else>
                {{ isRegister ? t('loginPage.hasAccount') : t('loginPage.noAccount') }}
                <el-link
                  type="primary"
                  underline="never"
                  @click="toggleMode"
                >
                  {{ isRegister ? t('loginPage.toLogin') : t('loginPage.toRegister') }}
                </el-link>
              </template>
            </div>
          </el-form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.video-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.video-bg-media {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(1.05) brightness(0.9) contrast(1.04);
  opacity: 0.7;
}

.video-bg-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at top, rgba(10, 18, 34, 0.08), transparent 40%),
    linear-gradient(180deg, rgba(3, 8, 18, 0.16), rgba(4, 9, 18, 0.38) 68%, rgba(3, 6, 12, 0.58));
}

.starlight-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.login-content {
  position: relative;
    z-index: 1;
    display: flex;
    width: 90%;
    max-width: 1100px;
    height: 80%;
    max-height: 650px;
    border-radius: 24px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(1px);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.intro-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px 32px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.intro-content {
  max-width: 500px;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.animation-area {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-height: 200px;
  padding-top: 10px;
  box-sizing: border-box;
}

.text-area {
  text-align: center;
  margin-bottom: 20px;
}

.brand-subtitle {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 12px;
}

.brand-description {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.6;
}

.features-list {
  display: flex;
  flex-direction: row;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s;
  flex: 1;
  min-width: calc(50% - 6px);
}

.feature-item:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-4px);
}

.feature-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%);
  border-radius: 10px;
  color: #fff;
  flex-shrink: 0;
}

.feature-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 2px;
}

.feature-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.3;
}

.login-section {
  width: 420px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.login-card {
  width: 100%;
  max-width: 360px;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-title {
  font-size: 24px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 8px;
}

.login-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.login-form {
  width: 100%;
}

.login-form :deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: none;
}

.login-form :deep(.el-input__wrapper:hover) {
  border-color: rgba(102, 126, 234, 0.5);
}

.login-form :deep(.el-input__wrapper.is-focus) {
  border-color: #667eea;
}

.login-form :deep(.el-input__inner) {
  color: #fff;
}

.login-form :deep(.el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.4);
}

.login-form :deep(.el-input__prefix) {
  color: rgba(255, 255, 255, 0.6);
}

.verify-code-row {
  display: flex;
  gap: 12px;
  width: 100%;
}

.verify-code-row .el-input {
  flex: 1;
}

.send-code-btn {
  flex-shrink: 0;
  width: 120px;
}

.form-options {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-options :deep(.el-checkbox__label) {
  color: rgba(255, 255, 255, 0.7);
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  background: linear-gradient(135deg, #06b6d4 0%, #00b377 100%);
  border: none;
}

.login-btn:hover {
  background: linear-gradient(135deg, #00f5a0 0%, #06b6d4 100%);
}

.switch-link {
  text-align: center;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.cursor-pointer {
  cursor: pointer;
}
</style>
