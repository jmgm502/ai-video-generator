<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/projectStore'
import { useStep1Store } from '@/stores/step1Store'
import type { Project } from '@/types'
import AnnouncementPanel from '@/components/home/AnnouncementPanel.vue'
import { Plus, Search, Grid, List, MoreFilled, Delete, Edit, VideoPlay, Bell, Refresh, ChatDotRound, Close, Document, Upload } from '@element-plus/icons-vue'

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
const MAX_PARTICLES = 500
const SPAWN_RATE = 20

function drawStar(ctx: Canvas2DRenderingContext, cx: number, cy: number, outerRadius: number, innerRadius: number, opacity: number, color: string) {
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
  const speedMultiplier = isFast ? (0.5 + Math.random() * 0.6) : (0.1 + Math.random() * 0.3)
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
const { t, locale } = useI18n()
const projectStore = useProjectStore()
const announcementPanelRef = ref()

const viewMode = ref<'grid' | 'list'>('grid')
const searchQuery = ref('')
const showCreateDialog = ref(false)
const showAnnouncementPopup = ref(false)
const showUpdateLogsPopup = ref(true)
const showAgreementPopup = ref(false)
const createMode = ref<'novel' | 'creative'>('novel')
const creatingCanvasQuick = ref(false)
const uploadInputRef = ref<HTMLInputElement | null>(null)
const uploadedNovelFile = ref<string>('')

const novelText = ref('')
const novelChapters = ref<{ id: string; title: string; content: string; selected: boolean }[]>([])
const isProcessingNovel = ref(false)

const hasNewVersion = computed(() => announcementPanelRef.value?.hasNewVersion ?? false)

const newProject = ref({
  name: '',
  description: '',
  orientation: 'horizontal' as 'horizontal' | 'vertical',
})

const filteredProjects = ref<Project[]>([])

const filterProjects = () => {
  if (!searchQuery.value) {
    filteredProjects.value = projectStore.projects
  } else {
    const query = searchQuery.value.toLowerCase()
    filteredProjects.value = projectStore.projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
    )
  }
}

const handleCreateProject = async () => {
  const isCreativeMode = createMode.value === 'creative'
  const creativeContent = newProject.value.description.trim()

  if (isCreativeMode && !creativeContent) {
    ElMessage.warning(t('homePage.warnEnterScript'))
    return
  }

  const newStoryboard = {
    id: `story_${Date.now()}`,
    order: 1,
    duration: 5,
    textPrompt: {
      description: creativeContent || '',
      systemPrompt: '',
    },
    imagePrompt: {
      characters: [],
      scene: undefined,
      props: [],
      compositeSettings: {
        positionX: 0,
        positionY: 0,
        scale: 1,
        opacity: 1,
        blendMode: 'normal'
      }
    },
    generatedImages: [],
    generatedImage: undefined,
    generatedVideos: [],
    generatedVideo: undefined,
    status: 'pending' as const,
  }

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '').slice(0, 12)
  const projectName = `${t('homePage.projNamePrefix')}${timestamp}`

  const project: Project = {
    id: `proj_${Date.now()}`,
    name: projectName,
    type: 'creative',
    description: newProject.value.description,
    orientation: newProject.value.orientation,
    resolution:
      newProject.value.orientation === 'horizontal'
        ? { width: 1920, height: 1080 }
        : { width: 1080, height: 1920 },
    storyboards: [newStoryboard],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  if (!isCreativeMode) {
    sessionStorage.setItem('newProjectWithContent', 'true')
    sessionStorage.setItem('newProjectNovelContent', novelText.value)
  }

  const success = await projectStore.addProject(project)
  if (!success) {
    ElMessage.error(t('homePage.errCreateFail'))
    return
  }

  projectStore.setCurrentProject(project)
  showCreateDialog.value = false
  newProject.value = { name: '', description: '', orientation: 'horizontal' }
  filterProjects()
  ElMessage.success(t('homePage.successCreateOk'))

  if (isCreativeMode) {
    router.push(`/editor/${project.id}/step2`)
  } else {
    router.push(`/editor/${project.id}/step1`)
  }

  novelText.value = ''
  novelChapters.value = []
  uploadedNovelFile.value = ''
}

/** 与画布工坊「新建项目」一致：创建 canvas 项目并进入编辑器 */
const handleCreateInfiniteCanvas = async () => {
  if (!window.electronAPI?.project) {
    ElMessage.warning(t('homePage.warnDesktopCanvas'))
    return
  }
  if (creatingCanvasQuick.value) return
  creatingCanvasQuick.value = true
  try {
    const newStoryboard = {
      id: `story_${Date.now()}`,
      order: 1,
      duration: 5,
      textPrompt: {
        description: '',
        systemPrompt: '',
      },
      imagePrompt: {
        characters: [],
        scene: undefined,
        props: [],
        compositeSettings: {
          positionX: 0,
          positionY: 0,
          scale: 1,
          opacity: 1,
          blendMode: 'normal',
        },
      },
      generatedImages: [],
      generatedImage: undefined,
      generatedVideos: [],
      generatedVideo: undefined,
      status: 'pending' as const,
    }

    const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', '').slice(0, 12)
    const project: Project = {
      id: `proj_${Date.now()}`,
      name: `${t('homePage.canvasProjNamePrefix')}${ts}`,
      type: 'canvas',
      description: '',
      orientation: 'horizontal',
      resolution: { width: 1920, height: 1080 },
      storyboards: [newStoryboard],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const success = await projectStore.addProject(project)
    if (!success) {
      ElMessage.error(t('homePage.errCanvasProjFail'))
      return
    }

    projectStore.setCurrentProject(project)
    ElMessage.success(t('homePage.successCanvasCreated'))
    await router.push(`/canvas/${project.id}`)
  } finally {
    creatingCanvasQuick.value = false
  }
}

const handleOpenProject = (project: Project) => {
  projectStore.setCurrentProject(project)
  router.push(`/editor/${project.id}`)
}

const handleDeleteProject = async (project: Project) => {
  try {
    await ElMessageBox.confirm(
      t('projectList.confirmDeleteTpl', { name: project.name }),
      t('projectList.confirmDeleteTitle'),
      {
        confirmButtonText: t('projectList.confirmDeleteBtn'),
        cancelButtonText: t('projectList.cancel'),
      type: 'warning',
    })
    projectStore.deleteProject(project.id)
    filterProjects()
    ElMessage.success(t('projectList.msgDeletedOk'))
  } catch {
    // 用户取消
  }
}

const extractChaptersFromText = (text: string) => {
  const chapterRegex = /第\s*([0-9０-９零一二三四五六七八九十百千万]+)\s*[章回节]\s*([^\n\r]*)/g
  const chapters: { id: string; title: string; content: string; selected: boolean }[] = []
  let match
  let lastIndex = 0
  const allMatches = []

  while ((match = chapterRegex.exec(text)) !== null) {
    allMatches.push({
      index: match.index,
      chapterNum: match[1],
      title: match[2] || `第${match[1]}章`,
      fullMatch: match[0]
    })
  }

  for (let i = 0; i < allMatches.length; i++) {
    const current = allMatches[i]
    const next = allMatches[i + 1]
    const startIndex = current.index + current.fullMatch.length
    const endIndex = next ? next.index : text.length
    const content = text.slice(startIndex, endIndex).trim()

    if (content.length > 0) {
      chapters.push({
        id: `chapter_${Date.now()}_${i}`,
        title: current.title,
        content: content,
        selected: true
      })
    }
  }

  return chapters
}

const handleNovelFileChange = (event: Event | any) => {
  let uploadFile: File | null = null

  if (event?.target?.files?.[0]) {
    uploadFile = event.target.files[0]
  } else if (event?.raw) {
    uploadFile = event.raw
  }

  if (!uploadFile) return

  if (!uploadFile.name.endsWith('.txt') && !uploadFile.name.endsWith('.doc') && !uploadFile.name.endsWith('.docx')) {
    ElMessage.warning(t('homePage.warnUploadFormats'))
    return
  }

  uploadedNovelFile.value = uploadFile.name

  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    novelText.value = content
    ElMessage.success(t('homePage.uploadDocOk'))
  }
  reader.onerror = () => {
    ElMessage.error(t('homePage.readFileFail'))
  }
  reader.readAsText(uploadFile)

  if (uploadInputRef.value) {
    uploadInputRef.value.value = ''
  }
}

const triggerUpload = () => {
  uploadInputRef.value?.click()
}

const handleStartCreation = async () => {
  if (!novelText.value.trim()) {
    ElMessage.warning(t('homePage.warnUploadNovelFirst'))
    return
  }

  const step1Store = useStep1Store()
  sessionStorage.setItem('newProjectWithContent', 'true')
  sessionStorage.setItem('newProjectNovelContent', novelText.value)
  step1Store.setExtractedContent(novelText.value)

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '').slice(0, 12)
  const projectName = `${t('homePage.projNamePrefix')}${timestamp}`

  const project: Project = {
    id: `proj_${Date.now()}`,
    name: projectName,
    type: 'creative',
    description: t('homePage.novelAdaptDesc'),
    orientation: 'horizontal',
    resolution: { width: 1920, height: 1080 },
    storyboards: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const success = await projectStore.addProject(project)
  if (!success) {
    ElMessage.error(t('homePage.errCreateFail'))
    return
  }

  projectStore.setCurrentProject(project)

  showCreateDialog.value = false
  filterProjects()
  ElMessage.success(t('homePage.successCreateGotoEditor'))

  router.push(`/editor/${project.id}/step1`)

  novelText.value = ''
  novelChapters.value = []
  uploadedNovelFile.value = ''
}

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString(locale.value === 'zh-CN' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

onMounted(() => {
  void projectStore.loadProjects().then(() => filterProjects())
  initStarlightCanvas()
})

onBeforeUnmount(() => {
  cleanupStarlightCanvas()
})

const handleCheckUpdate = () => {
  announcementPanelRef.value?.handleCheckUpdate()
}

const handleShowAnnouncement = () => {
  if (showUpdateLogsPopup.value) {
    showUpdateLogsPopup.value = false
  }
  showAnnouncementPopup.value = !showAnnouncementPopup.value
}

const handleShowUpdateLogs = () => {
  if (showAnnouncementPopup.value) {
    showAnnouncementPopup.value = false
  }
  showUpdateLogsPopup.value = !showUpdateLogsPopup.value
}
</script>

<template>
  <div class="home-container">
    <div class="video-bg">
      <img
        :src="bgImage"
        class="video-bg-media"
        alt="background"
      />
      <canvas ref="starlightCanvasRef" class="starlight-canvas" />
      <div class="video-bg-overlay" />
    </div>

    <AnnouncementPanel
      ref="announcementPanelRef"
      class="hidden-panel"
    />

    <div class="main-content">
      <div class="topbar-right">
        <div class="announcement-icon-wrapper">
          <el-icon
            class="announcement-icon"
            @click="handleShowAnnouncement"
          >
            <ChatDotRound />
          </el-icon>
          <Transition name="announcement-popup">
            <div
              v-if="showAnnouncementPopup"
              class="announcement-popup"
            >
              <div class="popup-header">
                <span class="popup-title">{{ t('homePage.systemAnnouncement') }}</span>
                <el-icon
                  class="popup-close"
                  @click="showAnnouncementPopup = false"
                >
                  <Close />
                </el-icon>
              </div>
              <div class="popup-body">
                <div
                  v-for="item in announcementPanelRef?.announcements"
                  :key="item.id"
                  class="popup-item"
                >
                  <div class="popup-item-header">
                    <span class="popup-item-title">{{ item.title }}</span>
                    <el-tag
                      v-if="item.isNew"
                      type="danger"
                      size="small"
                      effect="dark"
                    >
                      {{ t('homePage.tagNew') }}
                    </el-tag>
                  </div>
                  <div class="popup-item-time">{{ item.time }}</div>
                </div>
              </div>
              <div class="popup-footer">
                <el-button
                  size="small"
                  class="popup-dismiss-btn"
                  type="primary"
                  @click="showAnnouncementPopup = false"
                >
                  {{ t('homePage.btnDismissRead') }}
                </el-button>
              </div>
            </div>
          </Transition>
        </div>
        <div class="topbar-version">
          <span class="topbar-ver-tag">{{ announcementPanelRef?.appVersion }}</span>
          <el-button
            type="primary"
            size="small"
            class="topbar-update-btn"
            :class="{ 'has-new-version': hasNewVersion }"
            @click="handleCheckUpdate"
          >
            <el-icon class="update-icon"><Refresh /></el-icon>
            <span v-if="hasNewVersion">{{ t('homePage.hasNewVersion') }}</span>
            <span v-else>{{ t('homePage.checkUpdate') }}</span>
          </el-button>
        </div>
        <div class="changelog-bell-wrapper">
          <el-icon
            class="bell-trigger"
            @click="handleShowUpdateLogs"
          >
            <Bell />
            <span class="bell-dot" />
          </el-icon>
          <Transition name="announcement-popup">
            <div
              v-if="showUpdateLogsPopup"
              class="announcement-popup changelog-popup"
            >
              <div class="popup-header">
                <span class="popup-title">{{ t('homePage.updateLogs') }}</span>
                <el-icon
                  class="popup-close"
                  @click="showUpdateLogsPopup = false"
                >
                  <Close />
                </el-icon>
              </div>
              <div class="popup-body">
                <div
                  v-for="log in announcementPanelRef?.updateLogs"
                  :key="log.version"
                  class="popup-item"
                >
                  <div class="popup-item-header">
                    <span class="popup-version">{{ log.version }}</span>
                    <span class="popup-item-time">{{ log.date }}</span>
                    <el-tag
                      v-if="log.version === announcementPanelRef?.latestVersion"
                      type="success"
                      size="small"
                      effect="dark"
                    >
                      {{ t('homePage.tagLatest') }}
                    </el-tag>
                  </div>
                  <div class="popup-item-content">{{ log.notes }}</div>
                </div>
                <div
                  v-if="!announcementPanelRef?.updateLogs?.length"
                  class="popup-empty"
                >
                  {{ t('homePage.emptyUpdateLogs') }}
                </div>
              </div>
              <div class="popup-footer">
                <el-button
                  size="small"
                  class="popup-dismiss-btn"
                  type="primary"
                  @click="showUpdateLogsPopup = false"
                >
                  {{ t('homePage.btnDismissRead') }}
                </el-button>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <Transition name="fade">
        <div
          v-if="showAgreementPopup"
          class="agreement-overlay"
          @click.self="showAgreementPopup = false"
        >
          <div class="agreement-modal">
            <div class="popup-header">
              <span class="popup-title">{{ t('homePage.agreementModalTitle') }}</span>
              <el-icon
                class="popup-close"
                @click="showAgreementPopup = false"
              >
                <Close />
              </el-icon>
            </div>
            <div class="popup-body agreement-body">
              <div class="agreement-content">
              <h2>前言声明</h2>
              <p>本服务条款（"本条款"）是星梦动画平台（简称"本平台"）与用户之间具有法律约束力的协议，旨在明确界定平台服务性质、各方权利义务及责任边界。本平台严格遵循技术中立原则，并通过本条款构建法律防火墙，确保平台与用户创作内容及后续使用在法律上、商业上、责任上的完全隔离。请您在使用前务必仔细阅读、充分理解并审慎评估。</p>

              <h2>一、协议接受与法律效力</h2>
              <p><strong>1.1明确同意：</strong>您对星梦动画软件（"本服务"）的任何访问或使用，需先通过明确的勾选"同意"操作，此操作构成您对本条款的完整、自愿、知情同意，具有法律约束力。</p>
              <p><strong>1.2条款更新：</strong>本平台保留修改本条款的权利。重大变更将通过站内信、邮件或应用内公告等方式进行通知。若您在更新生效后继续使用服务，视为您接受修改；如不接受，应立即停止使用并删除相关数据。</p>
              <p><strong>1.3法律审查建议：</strong>我们建议商业用户在将创作内容用于重要商业活动前，寻求独立法律意见，以确认符合特定行业法规要求。</p>

              <h2>二、服务性质与法律定位</h2>
              <p><strong>2.1技术工具本质：</strong>星梦动画系AI辅助创作工具，本平台仅为技术服务提供方，提供中立的技术平台与工具功能。根据电子商务法相关规定，本平台作为技术服务提供者，不参与用户内容创作，不对用户生成内容承担责任。</p>
              <p><strong>2.2法律主体隔离：</strong>依据民法典相关规定，本平台与用户之间仅为工具使用关系，明确不构成合伙、合资、雇佣、代理、委托或其他任何法律关系。用户不得以任何形式对外宣称与本平台存在超出本条款明示范围的任何关联。</p>
              <p><strong>2.3技术中立原则：</strong>本平台对用户创作内容持完全技术中立立场，其法律地位等同于传统创作工具（如画笔、相机、文字处理器）。根据司法实践，技术工具提供者不对工具使用者的产出内容承担责任，除非存在明知或应知违法内容而不采取必要措施的情形。</p>

              <h2>三、用户资格与义务</h2>
              <p><strong>3.1注册资格：</strong>您必须：·已年满14周岁（根据未成年人保护法及个人信息保护法要求）·具有完全民事行为能力，或已获得法定监护人明确书面同意·不属于法律法规禁止使用本服务的主体</p>
              <p><strong>3.2内容责任：</strong>您对通过本服务创作的所有内容承担全部法律责任，包括但不限于：·确保内容不违反网络安全法、数据安全法等法律法规·确保内容不侵犯他人知识产权、人格权等合法权益·确保内容不含有法律法规禁止的内容·商业使用时符合广告法、反不正当竞争法等商业法规</p>
              <p><strong>3.3安全义务：</strong>用户不得：·通过本服务生成、传播违法不良信息·利用本技术服务实施任何侵犯他人权益的行为·试图逆向工程、破解或干扰本服务正常运行</p>

              <h2>四、知识产权体系</h2>
              <p><strong>4.1用户内容权属：</strong>根据著作权法相关规定，您通过本服务创作的作品，其著作权及相关知识产权归您所有，本平台不主张任何权利，但您授予本平台一项全球性、免许可费、非独占的许可，仅用于提供、维护、改进本服务及法律合规之必要。</p>
              <p><strong>4.2平台技术权属：</strong>本服务所有技术、算法、软件、界面设计、商标等知识产权归本平台或其许可方独家所有。未经书面许可，您不得复制、修改、分发、反向工程或用于开发竞争产品。</p>
              <p><strong>4.3商业使用边界：</strong>您可将创作内容用于商业目的，但必须：·明确标注内容为"由用户使用星梦动画工具独立创作"·不得将本平台名称、标识、界面截图作为您产品或服务的核心卖点·不得暗示本平台对您的商业活动有任何形式的背书、许可或关联</p>

              <h2>五、商业隔离与责任框架</h2>
              <p><strong>5.1责任隔离原则：</strong>根据民法典关于网络服务提供者责任的相关规定，本平台与您及其商业活动在法律上完全隔离：·本平台不参与、不干预、不批准您的任何商业决策·本平台不分享您的商业收益，不承担您的商业风险·任何第三方不得将本平台视为您商业活动的责任方</p>
              <p><strong>5.2赔偿承诺：</strong>如因您的内容或商业活动导致第三方对本平台提出索赔，您应负责抗辩、和解并承担全部赔偿责任，使本平台免受损害。本条款不影响您根据法律应当承担的责任。</p>
              <p><strong>5.3品牌保护：</strong>您不得在任何商业场景中使用本平台商标、名称或标识，除非获得书面授权。未经授权的使用将构成商标侵权，本平台保留追究法律责任的权利。</p>

              <h2>六、数据安全与隐私保护</h2>
              <p><strong>6.1最小必要原则：</strong>本平台遵循个人信息保护法的最小必要原则，仅收集提供服务所必需的最少数据。详细政策请参阅《隐私政策》。</p>
              <p><strong>6.2数据安全措施：</strong>本平台已建立符合数据安全法要求的数据安全管理制度，采取技术措施保障数据安全，提供符合行业标准的安全保障。</p>
              <p><strong>6.3用户数据责任：</strong>您不得在创作内容中包含个人敏感信息、国家秘密或商业机密。如因您主动提供此类信息导致的泄露或侵权，由您自行承担责任。</p>

              <h2>七、内容安全与合规机制</h2>
              <p><strong>7.1技术防范：</strong>本平台已部署内容安全过滤系统，对明显违法内容进行技术拦截，但这不构成对所有用户内容的事先审查，也不改变本平台的技术中立地位。</p>
              <p><strong>7.2合规响应：</strong>根据网络安全法相关规定，本平台在收到监管部门或权利人合法通知后，将依法采取必要措施，包括但不限于删除、屏蔽相关内容。此类措施不视为本平台对内容的审核责任。</p>
              <p><strong>7.3记录保存：</strong>依据网络安全法相关要求，本平台将依法保存用户日志不少于六个月，用于国家安全、刑事侦查等法定事由。</p>

              <h2>八、服务提供与终止</h2>
              <p><strong>8.1服务变更：</strong>本平台有权根据业务需要、法律法规变化或技术原因，调整、暂停或终止服务，并提前通知用户。</p>
              <p><strong>8.2账号终止：</strong>本平台可在以下情况下终止您对服务的访问：您严重违反本条款·根据法律法规要求或政府机关合法指令·为保护平台、用户或公众安全与权益</p>
              <p><strong>8.3数据保留：</strong>服务终止后，我们将根据适用法律要求保存必要数据，但不对内容丢失承担赔偿责任。建议您定期备份重要创作内容。</p>

              <h2>九、免责声明与责任限制</h2>
              <p><strong>9.1内容免责：</strong>作为技术工具提供者，本平台不对用户生成内容的准确性、合法性、适当性作任何明示或暗示的保证，不承担相关责任。</p>
              <p><strong>9.2商业活动免责：</strong>本平台对您将创作内容用于商业活动所产生的任何后果不承担责任，包括但不限于合同纠纷、消费者索赔、知识产权侵权或行政处罚。</p>
              <p><strong>9.3服务提供免责：</strong>本服务按"现状"和"可提供"基础上提供。在法律允许的最大范围内，本平台不提供任何明示或暗示的担保，包括但不限于适销性、特定用途适用性或不侵权担保。</p>
              <p><strong>9.4责任限制：</strong>在任何情况下，本平台及其关联方对因使用或无法使用本服务引起的任何间接、后果性损害不承担责任。根据民法典相关规定，本平台对于故意或重大过失造成的用户人身伤害、财产损失等法定责任不予排除。</p>

              <h2>十、法律适用与争议解决</h2>
              <p><strong>10.1法律适用：</strong>本条款的订立、执行、解释及争议解决均适用中华人民共和国法律（不含冲突法）。</p>
              <p><strong>10.2争议解决：</strong>任何争议应首先通过友好协商解决；协商不成的，任何一方均有权将争议提交至本平台主要营业地有管辖权的人民法院诉讼解决。</p>
              <p><strong>10.3条款独立性：</strong>如本条款任何部分被有管辖权的法院认定为无效或不可执行，不影响其余条款的效力。双方同意以最接近原条款意图且合法有效的条款替代无效条款，但责任隔离与免责的核心原则不受影响。</p>

              <h2>十一、特别法律声明</h2>
              <p><strong>工具中立与责任隔离重申：</strong>星梦动画作为AI辅助创作工具，其法律定位与画笔、相机、文字处理软件相同。根据民法典及司法实践，技术工具提供者不对工具使用者的产出内容承担责任。您确认理解并接受"自主创作、自主决策、自主担责"原则，放弃就您使用本服务产生的内容或活动向本平台主张任何权利或责任，除非该责任依法不可免除。</p>
              <p><strong>监管合规承诺：</strong>本平台承诺遵守国家法律法规，配合监管部门依法执行职务。如因监管要求需要调整服务或提供数据，我们将依法依规执行，且不承担由此给您带来的损失。</p>
              <p><strong>紧急处置权：</strong>在发生危害国家安全、公共安全或用户安全的紧急情况下，本平台有权不经事先通知立即采取必要措施，包括但不限于暂停服务、删除内容、报告监管部门等。</p>

              <h2 class="agreement-important">确认与接受</h2>
              <p class="agreement-important">重要提示：请点击"同意"前，确保您已完全阅读、理解本条款全部内容，特别是责任限制、免责条款及法律风险提示。<br><br>如您未满18周岁，请在法定监护人指导下阅读并由监护人代为同意。<br><br>点击"同意"或继续使用本服务，即表示您已达到法定年龄，具有完全民事行为能力（或已获得监护人授权），完全理解并接受本条款全部内容，特别确认接受本平台与您及其活动在法律上、商业上、责任上的完全隔离原则。</p>
              <p class="agreement-date">生效日期：2026年2月08日<br>最后更新：2026年2月15日</p>
              </div>
            </div>
            <div class="popup-footer">
              <el-button
                size="small"
                class="popup-dismiss-btn"
                type="primary"
                @click="showAgreementPopup = false"
              >
                {{ t('homePage.btnDismissRead') }}
              </el-button>
            </div>
          </div>
        </div>
      </Transition>

      <div class="project-section">
        <div class="hero-slogan">
          <h1 class="slogan-text">{{ t('homePage.slogan') }}</h1>
        </div>
        <div class="create-mode-tabs">
          <button
            :class="['mode-tab', { active: createMode === 'novel' }]"
            @click="createMode = 'novel'"
          >
            {{ t('homePage.modeNovelAdapt') }}
          </button>
          <button
            :class="['mode-tab', { active: createMode === 'creative' }]"
            @click="createMode = 'creative'"
          >
            {{ t('homePage.modeCreative') }}
          </button>
          <button
            type="button"
            class="mode-tab mode-tab-canvas"
            :disabled="creatingCanvasQuick"
            @click="handleCreateInfiniteCanvas"
          >
            {{ creatingCanvasQuick ? t('homePage.creating') : t('homePage.modeInfiniteCanvas') }}
          </button>
        </div>
        <Transition
          name="panel-fade"
          mode="out-in"
        >
          <div
            v-if="createMode === 'novel'"
            key="novel"
            class="novel-create-panel"
          >
            <div
              class="novel-upload-area"
              :class="{ 'has-file': uploadedNovelFile }"
              @click="triggerUpload"
            >
              <input
                ref="uploadInputRef"
                type="file"
                accept=".txt,.doc,.docx"
                style="display: none"
                @change="handleNovelFileChange"
              >
              <div
                v-if="!uploadedNovelFile"
                class="upload-card-content"
              >
                <el-icon class="upload-icon">
                  <Upload />
                </el-icon>
                <span class="upload-text">{{ t('homePage.uploadNovelHint') }}</span>
                <span class="upload-hint">{{ t('homePage.uploadFormatsHint') }}</span>
              </div>
              <div
                v-else
                class="uploaded-file-info"
              >
                <el-icon class="file-icon">
                  <Document />
                </el-icon>
                <span class="file-name">{{ uploadedNovelFile }}</span>
              </div>
              <div class="novel-create-actions">
                <el-button
                  type="primary"
                  size="large"
                  :disabled="!uploadedNovelFile"
                  @click.stop="handleStartCreation"
                >
                  {{ t('homePage.startCreate') }}
                </el-button>
              </div>
            </div>
          </div>
          <div
            v-else-if="createMode === 'creative'"
            key="creative"
            class="creative-create-panel"
          >
            <div class="creative-input-section">
              <div class="creative-content-input">
                <el-input
                  v-model="newProject.description"
                  type="textarea"
                  :rows="4"
                  :placeholder="t('homePage.phScriptContent')"
                />
                <div class="creative-create-actions">
                  <el-button
                    type="primary"
                    size="large"
                    :disabled="!newProject.description.trim()"
                    @click="handleCreateProject"
                  >
                    {{ t('homePage.startCreate') }}
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
        <div class="section-title-wrapper">
          <h3 class="section-title-text">{{ t('homePage.recentProjects') }}</h3>
        </div>
        <div
          v-if="filteredProjects.length === 0"
          class="empty-state"
        >
          <el-empty :description="t('homePage.emptyProjects')" />
        </div>

        <div
          v-else
          :class="['projects', viewMode]"
        >
          <div
            v-for="project in filteredProjects"
            :key="project.id"
            class="project-card"
            @click="handleOpenProject(project)"
          >
            <div class="project-info">
              <h3 class="project-name">
                {{ project.name }}
              </h3>
              <span class="project-time">{{ formatDate(project.updatedAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="showCreateDialog"
      :title="t('homePage.dialogNewProject')"
      width="480px"
      :close-on-click-modal="false"
    >
      <el-form label-width="80px">
        <el-form-item
          :label="t('homePage.labelProjectName')"
          required
        >
          <el-input
            v-model="newProject.name"
            :placeholder="t('homePage.phProjectName')"
            maxlength="50"
          />
        </el-form-item>
        <el-form-item :label="t('homePage.labelDesc')">
          <el-input
            v-model="newProject.description"
            type="textarea"
            :placeholder="t('homePage.phDescOptional')"
            :rows="3"
            maxlength="200"
          />
        </el-form-item>
        <el-form-item :label="t('homePage.labelOrientation')">
          <el-radio-group v-model="newProject.orientation">
            <el-radio value="horizontal">
              <span class="orientation-option">
                {{ t('homePage.orientationLandscape') }}
              </span>
            </el-radio>
            <el-radio value="vertical">
              <span class="orientation-option">
                {{ t('homePage.orientationPortrait') }}
              </span>
            </el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">
          {{ t('homePage.cancel') }}
        </el-button>
        <el-button
          type="primary"
          @click="handleCreateProject"
        >
          {{ t('homePage.create') }}
        </el-button>
      </template>
    </el-dialog>
    <div class="footer-links">
      <span
        class="footer-link"
        @click="showAgreementPopup = true"
      >{{ t('homePage.agreementFooterLink') }}</span>
      <span class="footer-divider">|</span>
      <span class="footer-text">{{ t('homePage.footerCopyright') }}</span>
    </div>
  </div>
</template>

<style scoped>
.home-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  background-color: var(--bg-color);
  overflow: hidden;
}

.hidden-panel {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.video-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.video-bg-media {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(1.05) brightness(0.76) contrast(1.04);
  opacity: 0.8;
}

.video-bg-overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
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

.main-content {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1;
}

.topbar-right {
  position: absolute;
  top: 16px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 100;
}

.announcement-icon-wrapper {
  display: flex;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, .06);
  padding: 7px;
  border-radius: 10px;
  background-color: var(--el-color-black);
}

.announcement-icon {
  font-size: 30px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: color 0.3s;
  padding: 6px;
  border-radius: 6px;
}

.announcement-icon:hover {
  color: var(--primary-color);
  background-color: var(--bg-tertiary);
}

.announcement-popup {
  position: absolute;
  top: calc(100% + 10px);
  right: 0px;
  width: 285px;
  max-height: 480px;
  display: flex;
  flex-direction: column;
  background-color: #000000d4;
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  overflow: hidden;
  z-index: 1000;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.popup-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.popup-close {
  font-size: 18px;
  cursor: pointer;
  color: var(--text-muted);
  transition: color 0.2s;
}

.popup-close:hover {
  color: var(--text-primary);
}

.popup-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.popup-item {
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.popup-item:hover {
  background-color: var(--bg-hover);
}

.popup-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.popup-item-title {
  font-size: 13px;
  color: var(--text-primary);
}

.popup-version {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-cyan);
}

.popup-item-time {
  font-size: 11px;
  color: var(--text-muted);
}

.popup-item-content {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  white-space: pre-line;
}

.popup-empty {
  text-align: center;
  padding: 40px 16px;
  color: var(--text-muted);
  font-size: 13px;
}

.popup-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 10px 16px;
  border-top: 1px solid var(--border-subtle);
}

.popup-dismiss-btn {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
}

.announcement-popup-enter-active {
  animation: popupIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.announcement-popup-leave-active {
  animation: popupOut 0.18s cubic-bezier(0.4, 0, 1, 1);
}

@keyframes popupIn {
  0% {
    opacity: 0;
    transform: translateY(-8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes popupOut {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-6px) scale(0.97);
  }
}

.panel-fade-enter-active {
  transition: all 0.3s ease;
}

.panel-fade-leave-active {
  transition: all 0.2s ease;
}

.panel-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.panel-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.topbar-version {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, .06);
  padding: 10px 15px;
  border-radius: 10px;
  background-color: var(--el-color-black);
}

.topbar-ver-tag {
  font-size: 12px;
  color: var(--primary-light);
  background-color: rgba(0, 214, 143, 0.15);
  padding: 4px 10px;
  border-radius: 4px;
  font-weight: bold;
}

.topbar-update-btn {
  display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: #ffffff0a;
    border: 1px solid rgba(255, 255, 255, .06);
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all .2s;
    white-space: nowrap;
}

.topbar-update-btn.has-new-version {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.2), rgba(103, 194, 58, 0.2));
  border-color: rgba(64, 158, 255, 0.4);
  animation: breathe 2s ease-in-out infinite;
  color: #409eff;
}

@keyframes breathe {
  0%, 100% {
    box-shadow: 0 0 5px rgba(64, 158, 255, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(64, 158, 255, 0.6), 0 0 30px rgba(103, 194, 58, 0.3);
  }
}

.update-icon {
  font-size: 12px;
}

.changelog-bell-wrapper {
  display: flex;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, .06);
  padding: 7px;
  border-radius: 10px;
  background-color: var(--el-color-black);
}

.bell-trigger {
  position: relative;
  font-size: 30px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: color 0.3s;
  padding: 6px;
  border-radius: 6px;
}

.bell-trigger:hover {
  color: var(--primary-color);
  background-color: var(--bg-tertiary);
}

.bell-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  background-color: #f56c6c;
  border-radius: 50%;
}

.bell-trigger.has-new .bell-dot {
  display: block;
}

.project-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 24px 24px;
  overflow: hidden;
}

.project-content {
  flex: 1;
  overflow-y: auto;
}

.hero-slogan {
  text-align: center;
  padding: 105px 20px 30px;
}

.slogan-text {
  font-size: 36px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 2px;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5);
  margin: 0;
}

.create-mode-tabs {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 0 20px 24px;
}

.mode-tab {
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s;
}

.mode-tab:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.mode-tab.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
}

.mode-tab-canvas {
  border-style: dashed;
}

.mode-tab-canvas:hover:not(:disabled) {
  border-color: rgba(64, 158, 255, 0.55);
  color: var(--primary-color);
}

.mode-tab-canvas:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.novel-create-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: rgb(0 0 0 / 54%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  width: 60%;
  margin: 0 auto;
  transition: all 0.3s ease;
  min-height: 220px;
}

.novel-upload-area {
  position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 210px;
}

.novel-upload-area:hover {
  border-color: var(--primary-color);
  background: rgba(0, 214, 143, 0.05);
}

.upload-card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  pointer-events: none;
}

.upload-icon {
  font-size: 36px;
  color: var(--text-muted);
}

.upload-text {
  font-size: 14px;
  color: var(--text-primary);
}

.upload-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.uploaded-file-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.file-icon {
  font-size: 36px;
  color: var(--primary-color);
}

.file-name {
  font-size: 14px;
  color: var(--text-primary);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.novel-upload-area .novel-create-actions {
  position: absolute;
  bottom: 12px;
  right: 12px;
  pointer-events: auto;
}

.creative-create-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: rgb(0 0 0 / 54%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  width: 60%;
  margin: 0 auto;
  transition: all 0.3s ease;
  min-height: 220px;
}

.creative-input-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 220px;
  position: relative;
}

.creative-name-input :deep(.el-input__wrapper) {
  background: #ffffff00 !important;
  border: 1px solid #6b6b6b;
}

.creative-content-input {
  position: relative;
}

.creative-content-input :deep(.el-textarea__inner) {
  background: #0d0d0d00;
  color: #ffffff;
  resize: none;
  min-height: 200px !important;
  box-shadow: 0 0 0 1px #4f4f4f inset;
}

.creative-create-actions {
  position: absolute;
  bottom: 10px;
  right: 10px;
  pointer-events: auto;
  z-index: 1;
}

.creative-create-panel .creative-create-actions {
  position: absolute;
  bottom: 20px;
  right: 20px;
}

.novel-chapters-preview {
  width: 100%;
  max-width: 600px;
}

.chapters-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.chapters-preview-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-color);
}

.chapter-preview-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
}

.chapter-preview-item:last-child {
  border-bottom: none;
}

.chapter-preview-title {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
}

.chapter-preview-length {
  font-size: 12px;
  color: var(--text-muted);
}

.section-title-wrapper {
  width: 60%;
    margin: 0 auto;
    padding: 15px 0px;
}

.section-title-text {
  font-size: 14px;
  color: var(--info-color);
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.footer-links {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 15px 0;
  z-index: 100;
}

.footer-link {
  font-size: 16px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.2s;
}

.footer-link:hover {
  color: var(--primary-color);
}

.footer-divider {
  color: var(--text-secondary);
  margin: 0 15px;
}

.footer-text {
  font-size: 14px;
  color: var(--text-secondary);
}

.agreement-popup {
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
}

.agreement-body {
  max-height: 60vh;
  overflow-y: auto;
  padding: 25px;
}

.agreement-content {
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.8;
}

.agreement-content h2 {
  font-size: 17px;
  color: var(--primary-color);
  margin: 16px 0 8px 0;
}

.agreement-content p {
  margin: 8px 0;
  text-indent: 2em;
}

.agreement-date {
  margin-top: 20px;
  text-align: right;
  color: var(--text-secondary);
}

.agreement-important {
  color: #e67366 !important;
}

.agreement-content h2.agreement-important {
  font-size: 15px;
  color: #e67366 !important;
  margin: 16px 0 8px 0;
}

.agreement-content p.agreement-important {
  text-indent: 2em;
  font-weight: bold;
}

.agreement-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.agreement-modal {
  width: 775px;
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}

.agreement-modal .popup-header {
  justify-content: center;
  position: relative;
}

.agreement-modal .popup-header .popup-close {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
}

.agreement-modal .popup-title {
  font-size: 20px;
  text-align: center;
}

.agreement-modal .popup-body {
  flex: 1;
  overflow-y: auto;
  user-select: text;
  -webkit-user-select: text;
}

.agreement-modal .popup-footer {
  display: flex;
  justify-content: center;
  padding: 16px;
  border-top: 1px solid var(--border-color);
}

.agreement-modal .popup-dismiss-btn {
  font-size: 20px;
  padding: 12px 40px;
  background-color: #03404b;
  color: var(--primary-color);
  height: 45px;
  font-weight: bold;
}

.projects {
  display: grid;
  gap: 12px;
}

.projects.grid {
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  width: 60%;
    margin: 0 auto;
}

.projects.list {
  grid-template-columns: 1fr;
}

.projects.list .project-card {
  flex-direction: row;
}

.project-card {
  background-color: var(--bg-secondary);
  border-radius: 15px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
}

.project-info {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.project-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-time {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
  margin-left: auto;
}

.project-menu {
  opacity: 0;
  transition: opacity 0.2s;
}

.project-card:hover .project-menu {
  opacity: 1;
}

.orientation-option {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
