<script setup lang="ts">
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { computed, inject, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Box, Camera } from '@element-plus/icons-vue'
import {
  AmbientLight,
  BackSide,
  BasicDepthPacking,
  Box3,
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  DirectionalLight,
  GridHelper,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshStandardMaterial,
  MOUSE,
  Object3D,
  OctahedronGeometry,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  TorusGeometry,
  TorusKnotGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import type { ImageNodeData } from '@/components/canvas/ImageCanvasNode.vue'
import { useApiConfigStore } from '@/stores/apiConfigStore'
import { useUserStore } from '@/stores/userStore'
import { vueFlowEdgeTypeForSetting } from '@/utils/canvasEdgeType'
import { canvasEdgeStyleFromWidth } from '@/utils/canvasEdgeStyle'
import { useCanvasNodeCommon } from '@/composables/useCanvasNodeUiI18n'
import { useCanvasLodLevel } from '@/composables/useCanvasLodLevel'

interface Viewport3DObject {
  id: string
  name: string
  shape?: PrimitiveShape
  modelKey?: string
  assetKey?: string
  position: { x: number; y: number; z: number }
  rotation?: { x: number; y: number; z: number }
  scale?: { x: number; y: number; z: number }
  color?: string
}

type PrimitiveShape =
  | 'plane'
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'ring'
  | 'pyramid'
  | 'torus'
  | 'capsule'
  | 'dodecahedron'
  | 'octahedron'
  | 'torusKnot'
  | 'star'
  | 'heart'
  | 'diamond'

interface ObjectPreset {
  id: string
  name: string
  shape?: PrimitiveShape
  color?: string
}

interface ObjectSubCategory {
  id: string
  name: string
  presets: ObjectPreset[]
}

interface ObjectCategory {
  id: string
  name: string
  subCategories?: ObjectSubCategory[]
  presets?: ObjectPreset[]
}

const COLOR_GENERAL = '#7c6cff'
const COLOR_INDOOR = '#5aa9ff'
const COLOR_OUTDOOR = '#4dc27a'
const COLOR_GUFENG = '#d7a550'
const COLOR_ARCH = '#8d9ab3'
const COLOR_DECOR = '#cc6ab7'
const COLOR_GEOMETRY = '#52d6d6'
const PERSON_COLOR_PALETTE = ['#7c6cff', '#5a88ff', '#44a5b7', '#6f8f4e', '#b16bd7', '#d26b8a', '#4f9e78']
const ASSET_MODEL_URLS: Record<string, string> = {
  character1: 'models/character1.obj',
  character2: 'models/character2.obj',
  character3: 'models/character3.obj'
}

const OBJECT_CATEGORIES: ObjectCategory[] = [
  {
    id: 'people',
    name: '人物',
    presets: [
      { id: 'pose-stand', name: '站立', shape: 'box', color: COLOR_GENERAL },
      { id: 'pose-sit', name: '坐姿', shape: 'box', color: COLOR_GENERAL },
      { id: 'pose-lie', name: '躺姿', shape: 'box', color: COLOR_GENERAL }
    ]
  },
  {
    id: 'indoor',
    name: '室内',
    presets: [
      '沙发椅子', '书桌', '床', '柜子', '书架', '电脑', '手机', '冰箱', '洗衣机', '电视'
    ].map((name, idx) => ({ id: `indoor-${idx}`, name, shape: 'box' as PrimitiveShape, color: COLOR_INDOOR }))
  },
  {
    id: 'outdoor',
    name: '室外',
    presets: [
      '房子', '树', '汽车', '长椅', '桌子', '石头', '围栏', '石墩', '路灯', '消防栓'
    ].map((name, idx) => ({ id: `outdoor-${idx}`, name, shape: name === '树' ? 'cone' : 'box', color: COLOR_OUTDOOR }))
  },
  {
    id: 'gufeng',
    name: '道具',
    presets: [
      '剑', '灯笼', '酒壶', '古琴', '花瓶', '屏风', '床', '茶几', '丹炉', '莲花座',
      '折扇', '油纸伞', '茶壶', '茶杯', '风铃', '蜡烛', '铜镜', '梳子', '枕头'
    ].map((name, idx) => ({ id: `gufeng-${idx}`, name, shape: 'box' as PrimitiveShape, color: COLOR_GUFENG }))
  },
  {
    id: 'arch',
    name: '建筑',
    presets: [
      '亭子', '石桥', '云朵', '祭坛', '石碑', '卷轴', '竹子', '盆景', '画卷', '纱帘',
      '古井', '院墙与大门', '古庙', '宝塔', '帐篷', '城楼', '拱门', '现代墙', '玻璃门', '高楼', '小卖部'
    ].map((name, idx) => ({ id: `arch-${idx}`, name, shape: name === '云朵' ? 'sphere' : 'box', color: COLOR_ARCH }))
  },
  {
    id: 'decor',
    name: '装饰',
    presets: [
      '长灯笼', '砚台', '毛笔', '沙漏', '香炉', '书籍'
    ].map((name, idx) => ({ id: `decor-${idx}`, name, shape: 'box' as PrimitiveShape, color: COLOR_DECOR }))
  },
  {
    id: 'geometry',
    name: '模型',
    presets: [
      { id: 'geo-plane', name: '平面', shape: 'plane', color: COLOR_GEOMETRY },
      { id: 'geo-box', name: '立方体', shape: 'box', color: COLOR_GEOMETRY },
      { id: 'geo-sphere', name: '球体', shape: 'sphere', color: COLOR_GEOMETRY },
      { id: 'geo-cylinder', name: '圆柱', shape: 'cylinder', color: COLOR_GEOMETRY },
      { id: 'geo-cone', name: '圆锥', shape: 'cone', color: COLOR_GEOMETRY },
      { id: 'geo-ring', name: '圆环', shape: 'ring', color: COLOR_GEOMETRY },
      { id: 'geo-pyramid', name: '金字塔', shape: 'pyramid', color: COLOR_GEOMETRY },
      { id: 'geo-torus', name: '环面', shape: 'torus', color: COLOR_GEOMETRY },
      { id: 'geo-capsule', name: '胶囊', shape: 'capsule', color: COLOR_GEOMETRY },
      { id: 'geo-dodecahedron', name: '12面体', shape: 'dodecahedron', color: COLOR_GEOMETRY },
      { id: 'geo-octahedron', name: '8面体', shape: 'octahedron', color: COLOR_GEOMETRY },
      { id: 'geo-torus-knot', name: '环结', shape: 'torusKnot', color: COLOR_GEOMETRY },
      { id: 'geo-star', name: '星星', shape: 'star', color: COLOR_GEOMETRY },
      { id: 'geo-heart', name: '爱心', shape: 'heart', color: COLOR_GEOMETRY },
      { id: 'geo-diamond', name: '钻石', shape: 'diamond', color: COLOR_GEOMETRY }
    ]
  }
]

/** 预设展示名中文（回退）；几何分支使用稳定 id（与历史中文 modelKey 通过首访映射兼容） */
const VIEWPORT_LEGACY_CN_TO_CANONICAL_ID: Record<string, string> = (() => {
  const m: Record<string, string> = {
    站立: 'pose-stand',
    站立姿势: 'pose-stand',
    坐姿: 'pose-sit',
    坐姿势: 'pose-sit',
    躺姿: 'pose-lie',
    躺姿势: 'pose-lie'
  }
  const addPreset = (p: ObjectPreset) => {
    if (!m[p.name]) m[p.name] = p.id
    m[p.id] = p.id
  }
  for (const cat of OBJECT_CATEGORIES) {
    cat.presets?.forEach(addPreset)
    cat.subCategories?.forEach((s) => s.presets.forEach(addPreset))
  }
  return m
})()

function resolveCanonicalPresetId(raw: string): string {
  const base = raw.replace(/\s+\d+$/, '').trim()
  return VIEWPORT_LEGACY_CN_TO_CANONICAL_ID[base] ?? base
}

export interface Viewport3DNodeData {
  label: string
  type: 'viewport3d'
  imageUrl?: string | null
  previewImageUrl?: string | null
  /** 等距柱状全景贴球幕内表面；未设置时：上游为 VR360 节点则默认全景，否则为平面背景 */
  panoBackground?: boolean
  objects?: Viewport3DObject[]
}

const props = withDefaults(defineProps<{ id: string; selected?: boolean; data: Viewport3DNodeData }>(), {
  selected: false
})

const { t } = useCanvasNodeCommon()

const lodLevel = useCanvasLodLevel()
const lodIsShell = computed(() => lodLevel.value === 'shell')

const { updateNodeData: rawUpdateNodeData, findNode, edges, nodes, addNodes, addEdges } = useVueFlow()
const scheduleCanvasAutoSave = inject<(() => void) | undefined>('scheduleCanvasAutoSave', undefined)

function updateNodeData(nodeId: string, data: Partial<any>) {
  rawUpdateNodeData(nodeId, data)
  scheduleCanvasAutoSave?.()
}
const apiStore = useApiConfigStore()
const userStore = useUserStore()
const pushStateBeforeChange = inject<(() => void) | undefined>('canvasPushStateBeforeChange', undefined)

const containerRef = ref<HTMLDivElement | null>(null)
const viewerWrapRef = ref<HTMLDivElement | null>(null)
const cardRef = ref<HTMLDivElement | null>(null)
const selectedObjectId = ref<string | null>(null)
const transformMode = ref<'translate' | 'rotate' | 'scale'>('translate')
const isFullscreen = ref(false)

const scene = shallowRef<Scene | null>(null)
const camera = shallowRef<PerspectiveCamera | null>(null)
const renderer = shallowRef<WebGLRenderer | null>(null)
const orbit = shallowRef<OrbitControls | null>(null)
const transform = shallowRef<TransformControls | null>(null)
const transformHelper = shallowRef<Object3D | null>(null)
const currentTexture = shallowRef<Texture | null>(null)
/** 背景：平面贴图或球幕全景 */
const backgroundBackdrop = shallowRef<Mesh | null>(null)
const meshMap = shallowRef<Map<string, Object3D>>(new Map())
const modelTemplateMap = shallowRef<Map<string, Object3D>>(new Map())
const modelLoadingMap = new Map<string, Promise<Object3D | null>>()

const raycaster = new Raycaster()
const pointer = new Vector2()
const pointerDownPos = ref<{ x: number; y: number; moved: boolean; skipSelect: boolean } | null>(null)
let raf = 0
let resizeObs: ResizeObserver | null = null

const objects = computed(() => props.data.objects ?? [])
const displayImageUrl = computed(() => props.data.imageUrl ?? props.data.previewImageUrl ?? null)
const selectedObject = computed(() => objects.value.find(o => o.id === selectedObjectId.value) ?? null)
const activeCategoryId = ref<string>(OBJECT_CATEGORIES[0].id)
const activeSubCategoryId = ref<string>(OBJECT_CATEGORIES[0].subCategories?.[0]?.id ?? '')

const activeCategory = computed(() => OBJECT_CATEGORIES.find(c => c.id === activeCategoryId.value) ?? OBJECT_CATEGORIES[0])
const activeSubCategories = computed(() => activeCategory.value.subCategories ?? [])
const personQuickPresets = computed(() => OBJECT_CATEGORIES.find(c => c.id === 'people')?.presets ?? [])
const activePresets = computed(() => {
  if (activeSubCategories.value.length > 0) {
    const sub = activeSubCategories.value.find(s => s.id === activeSubCategoryId.value) ?? activeSubCategories.value[0]
    return sub?.presets ?? []
  }
  return activeCategory.value.presets ?? []
})

function selectCategory(categoryId: string) {
  activeCategoryId.value = categoryId
  const category = OBJECT_CATEGORIES.find(c => c.id === categoryId)
  activeSubCategoryId.value = category?.subCategories?.[0]?.id ?? ''
}

function selectSubCategory(subCategoryId: string) {
  activeSubCategoryId.value = subCategoryId
}

function createGeometryByShape(shape: PrimitiveShape) {
  switch (shape) {
    case 'plane': return new PlaneGeometry(1.4, 1.4)
    case 'sphere': return new SphereGeometry(0.65, 24, 24)
    case 'cylinder': return new CylinderGeometry(0.52, 0.52, 1.2, 24)
    case 'cone': return new ConeGeometry(0.62, 1.25, 24)
    case 'ring': return new TorusGeometry(0.55, 0.17, 18, 48)
    case 'pyramid': return new ConeGeometry(0.7, 1.25, 4)
    case 'torus': return new TorusGeometry(0.55, 0.22, 20, 48)
    case 'capsule': return new CapsuleGeometry(0.38, 0.9, 8, 16)
    case 'dodecahedron': return new DodecahedronGeometry(0.7)
    case 'octahedron': return new OctahedronGeometry(0.75)
    case 'torusKnot': return new TorusKnotGeometry(0.45, 0.16, 120, 20)
    case 'star': return new ConeGeometry(0.7, 1.2, 5)
    case 'heart': return new SphereGeometry(0.68, 24, 24)
    case 'diamond': return new OctahedronGeometry(0.8)
    case 'box':
    default:
      return new BoxGeometry(1, 1, 1)
  }
}

function randomPersonColor(): string {
  const idx = Math.floor(Math.random() * PERSON_COLOR_PALETTE.length)
  return PERSON_COLOR_PALETTE[idx]
}

function getDefaultSpawnY(shape: PrimitiveShape, isPersonPreset: boolean, presetId: string): number {
  if (isPersonPreset) return 0.02
  if (shape === 'plane') return 0.06

  // 语义化组合模型大多已在本地坐标内贴地，根节点贴地即可
  if (!presetId.startsWith('geo-')) return 0.02

  // 几何模型按形体给默认贴地高度，避免埋地或悬空
  switch (shape) {
    case 'box': return 0.5
    case 'sphere': return 0.65
    case 'cylinder': return 0.6
    case 'cone':
    case 'pyramid':
    case 'star':
      return 0.62
    case 'ring':
    case 'torus':
      return 0.77
    case 'capsule': return 0.83
    case 'dodecahedron': return 0.7
    case 'octahedron': return 0.75
    case 'torusKnot': return 0.65
    case 'heart': return 0.68
    case 'diamond': return 0.8
    default:
      return 0.02
  }
}

function normalizeObjTemplate(root: Object3D): Object3D {
  const box = new Box3().setFromObject(root)
  const size = new Vector3()
  const center = new Vector3()
  box.getSize(size)
  box.getCenter(center)

  root.position.sub(center)
  const maxDim = Math.max(size.x, size.y, size.z) || 1
  const scale = 1.7 / maxDim
  root.scale.setScalar(scale)

  const box2 = new Box3().setFromObject(root)
  root.position.y -= box2.min.y

  root.traverse((child) => {
    if (!(child instanceof Mesh)) return
    const sourceMat = child.material
    const toStd = (m: any) => new MeshStandardMaterial({
      color: new Color((m as any)?.color ?? '#7c6cff'),
      metalness: 0.12,
      roughness: 0.72
    })
    child.material = Array.isArray(sourceMat) ? sourceMat.map(toStd) : toStd(sourceMat)
    child.userData.tintable = true
  })

  return root
}

function cloneTemplateObject(template: Object3D): Object3D {
  const cloned = template.clone(true)
  cloned.traverse((child) => {
    if (!(child instanceof Mesh)) return
    const mat = child.material
    if (Array.isArray(mat)) child.material = mat.map(m => m.clone())
    else child.material = mat.clone()
  })
  return cloned
}

async function ensureObjAsset(assetKey: string, url: string): Promise<Object3D | null> {
  const cached = modelTemplateMap.value.get(assetKey)
  if (cached) return Promise.resolve(cached)
  const pending = modelLoadingMap.get(assetKey)
  if (pending) return pending

  let resolvedUrl = url
  let useFileAPI = false
  if (window.electronAPI?.app?.getResourcePath) {
    try {
      const resourcePath = await window.electronAPI.app.getResourcePath(url)
      resolvedUrl = resourcePath
      useFileAPI = true
      console.log(`[3D Viewport] 资源路径: ${url} -> ${resourcePath}`)
    } catch (e) {
      console.warn('[3D Viewport] 获取资源路径失败，使用默认路径:', e)
    }
  }

  const loader = new OBJLoader()
  const task = new Promise<Object3D | null>((resolve) => {
    if (useFileAPI && window.electronAPI?.file?.readTextFile) {
      window.electronAPI.file.readTextFile(resolvedUrl).then(result => {
        if (result.success && result.content) {
          console.log(`[3D Viewport] 模型加载成功: ${assetKey}`)
          const obj = loader.parse(result.content)
          const normalized = normalizeObjTemplate(obj)
          modelTemplateMap.value.set(assetKey, normalized)
          modelLoadingMap.delete(assetKey)
          syncMeshesFromData()
          resolve(normalized)
        } else {
          console.error(`[3D Viewport] 模型加载失败: ${assetKey}`, result.message)
          modelLoadingMap.delete(assetKey)
          resolve(null)
        }
      }).catch(error => {
        console.error(`[3D Viewport] 模型加载失败: ${assetKey}`, error)
        modelLoadingMap.delete(assetKey)
        resolve(null)
      })
    } else {
      loader.load(
        resolvedUrl,
        (obj) => {
          console.log(`[3D Viewport] 模型加载成功: ${assetKey}`)
          const normalized = normalizeObjTemplate(obj)
          modelTemplateMap.value.set(assetKey, normalized)
          modelLoadingMap.delete(assetKey)
          syncMeshesFromData()
          resolve(normalized)
        },
        undefined,
        (error) => {
          console.error(`[3D Viewport] 模型加载失败: ${assetKey}`, error)
          modelLoadingMap.delete(assetKey)
          resolve(null)
        }
      )
    }
  })

  modelLoadingMap.set(assetKey, task)
  return task
}

function makePartMesh(
  shape: PrimitiveShape,
  color: string,
  pos: { x: number; y: number; z: number },
  scale: { x: number; y: number; z: number },
  rot?: { x?: number; y?: number; z?: number },
  tintable = true
): Mesh {
  const mesh = new Mesh(
    createGeometryByShape(shape),
    new MeshStandardMaterial({ color, metalness: 0.12, roughness: 0.72 })
  )
  mesh.position.set(pos.x, pos.y, pos.z)
  mesh.scale.set(scale.x, scale.y, scale.z)
  mesh.rotation.set(rot?.x ?? 0, rot?.y ?? 0, rot?.z ?? 0)
  mesh.userData.tintable = tintable
  return mesh
}

function findPresetById(presetId: string): ObjectPreset | undefined {
  for (const cat of OBJECT_CATEGORIES) {
    const fromList = cat.presets?.find((p) => p.id === presetId)
    if (fromList) return fromList
    const fromSub = cat.subCategories?.flatMap((s) => s.presets).find((p) => p.id === presetId)
    if (fromSub) return fromSub
  }
  return undefined
}

/** 左侧对象列表：随语言刷新「预设名 + 序号」 */
function objectRowDisplayName(obj: Viewport3DObject): string {
  const canon = resolveCanonicalPresetId(obj.modelKey ?? obj.name.replace(/\s+\d+$/, ''))
  const preset = findPresetById(canon)
  const tail = obj.name.match(/\s+(\d+)\s*$/)
  const seq = tail ? tail[1] : ''
  if (preset) {
    const base = presetDisplayName(preset)
    return seq ? `${base} ${seq}` : base
  }
  return obj.name
}

function buildCompositeModel(modelKey: string, color: string): Object3D | null {
  const key = resolveCanonicalPresetId(modelKey)
  const g = new Group()
  const wood = '#7b5a3b'
  const metal = '#8f96a3'
  const dark = '#2d3340'
  const light = '#dde6ef'

  const add = (shape: PrimitiveShape, p: { x: number; y: number; z: number }, s: { x: number; y: number; z: number }, c = color, r?: { x?: number; y?: number; z?: number }) => {
    g.add(makePartMesh(shape, c, p, s, r, c === color))
  }

  switch (key) {
    case 'outdoor-1':
      add('cylinder', { x: 0, y: 0.55, z: 0 }, { x: 0.24, y: 0.9, z: 0.24 }, wood)
      add('cone', { x: 0, y: 1.45, z: 0 }, { x: 1, y: 1.15, z: 1 }, '#4ca86b')
      break
    case 'outdoor-8':
      add('cylinder', { x: 0, y: 0.95, z: 0 }, { x: 0.14, y: 1.6, z: 0.14 }, metal)
      add('sphere', { x: 0, y: 1.95, z: 0 }, { x: 0.28, y: 0.28, z: 0.28 }, '#ffde91')
      add('box', { x: 0, y: 0.08, z: 0 }, { x: 0.7, y: 0.12, z: 0.7 }, '#555d6a')
      break
    case 'outdoor-4':
    case 'indoor-1':
    case 'gufeng-7':
      add('box', { x: 0, y: 0.72, z: 0 }, { x: 1.3, y: 0.12, z: 0.85 }, wood)
      ;[-0.52, 0.52].forEach((x) => {
        ;[-0.3, 0.3].forEach((z) => add('cylinder', { x, y: 0.36, z }, { x: 0.08, y: 0.62, z: 0.08 }, wood))
      })
      break
    case 'outdoor-3':
    case 'indoor-0':
      add('box', { x: 0, y: 0.45, z: 0 }, { x: 1.35, y: 0.22, z: 0.6 }, color)
      add('box', { x: 0, y: 0.92, z: -0.24 }, { x: 1.35, y: 0.62, z: 0.16 }, color)
      ;[-0.58, 0.58].forEach((x) => add('cylinder', { x, y: 0.18, z: 0 }, { x: 0.08, y: 0.26, z: 0.08 }, dark))
      break
    case 'indoor-2':
    case 'gufeng-6':
      add('box', { x: 0, y: 0.32, z: 0 }, { x: 1.65, y: 0.34, z: 2.2 }, color)
      add('box', { x: 0, y: 0.8, z: -1.02 }, { x: 1.65, y: 0.9, z: 0.16 }, wood)
      add('box', { x: -0.42, y: 0.6, z: -0.55 }, { x: 0.52, y: 0.18, z: 0.36 }, light)
      add('box', { x: 0.42, y: 0.6, z: -0.55 }, { x: 0.52, y: 0.18, z: 0.36 }, light)
      break
    case 'indoor-4':
    case 'indoor-3':
      add('box', { x: 0, y: 0.95, z: 0 }, { x: 1.45, y: 1.85, z: 0.4 }, wood)
      add('box', { x: 0, y: 1.55, z: 0.22 }, { x: 1.25, y: 0.05, z: 0.05 }, '#d7b487')
      add('box', { x: 0, y: 0.95, z: 0.22 }, { x: 1.25, y: 0.05, z: 0.05 }, '#d7b487')
      break
    case 'indoor-5':
      add('box', { x: 0, y: 0.8, z: 0 }, { x: 1.1, y: 0.62, z: 0.08 }, dark)
      add('cylinder', { x: 0, y: 0.4, z: 0 }, { x: 0.08, y: 0.35, z: 0.08 }, metal)
      add('box', { x: 0, y: 0.18, z: 0 }, { x: 0.65, y: 0.08, z: 0.35 }, metal)
      break
    case 'indoor-6':
      add('box', { x: 0, y: 0.55, z: 0 }, { x: 0.5, y: 1.05, z: 0.07 }, dark)
      add('box', { x: 0, y: 0.55, z: 0.04 }, { x: 0.42, y: 0.9, z: 0.01 }, '#7ea6ff')
      break
    case 'indoor-7':
    case 'indoor-8':
      add('box', { x: 0, y: 0.8, z: 0 }, { x: 0.9, y: 1.6, z: 0.8 }, '#e8edf3')
      add('box', { x: 0, y: 1.18, z: 0.41 }, { x: 0.68, y: 0.05, z: 0.02 }, '#c6ced8')
      break
    case 'indoor-9':
      add('box', { x: 0, y: 0.8, z: 0 }, { x: 1.5, y: 0.85, z: 0.09 }, dark)
      add('box', { x: 0, y: 0.8, z: 0.05 }, { x: 1.35, y: 0.72, z: 0.01 }, '#8eb0ff')
      add('box', { x: 0, y: 0.2, z: 0 }, { x: 0.55, y: 0.08, z: 0.32 }, metal)
      break
    case 'outdoor-0':
      add('box', { x: 0, y: 0.62, z: 0 }, { x: 1.9, y: 1.25, z: 1.6 }, '#d9d0c3')
      add('pyramid', { x: 0, y: 1.6, z: 0 }, { x: 1.45, y: 0.85, z: 1.2 }, '#a35642')
      break
    case 'arch-0':
      add('pyramid', { x: 0, y: 1.95, z: 0 }, { x: 1.55, y: 0.8, z: 1.55 }, '#8f4f3b')
      add('box', { x: 0, y: 1.05, z: 0 }, { x: 1.5, y: 0.12, z: 1.5 }, '#d0a56f')
      ;[-0.62, 0.62].forEach((x) => {
        ;[-0.62, 0.62].forEach((z) => add('cylinder', { x, y: 0.55, z }, { x: 0.12, y: 0.95, z: 0.12 }, '#7a4f32'))
      })
      break
    case 'arch-1':
      add('box', { x: 0, y: 0.38, z: 0 }, { x: 2.2, y: 0.1, z: 0.9 }, '#a0a2aa')
      add('ring', { x: -0.7, y: 0.08, z: 0 }, { x: 0.38, y: 0.38, z: 0.38 }, '#8d8f98', { x: Math.PI / 2 })
      add('ring', { x: 0, y: 0.08, z: 0 }, { x: 0.38, y: 0.38, z: 0.38 }, '#8d8f98', { x: Math.PI / 2 })
      add('ring', { x: 0.7, y: 0.08, z: 0 }, { x: 0.38, y: 0.38, z: 0.38 }, '#8d8f98', { x: Math.PI / 2 })
      break
    case 'arch-2':
      add('sphere', { x: -0.45, y: 0.72, z: 0 }, { x: 0.55, y: 0.45, z: 0.55 }, '#e6edf6')
      add('sphere', { x: 0, y: 0.82, z: 0 }, { x: 0.78, y: 0.55, z: 0.78 }, '#edf3fb')
      add('sphere', { x: 0.52, y: 0.7, z: 0 }, { x: 0.52, y: 0.4, z: 0.52 }, '#e6edf6')
      break
    case 'arch-3':
      add('cylinder', { x: 0, y: 0.22, z: 0 }, { x: 1.25, y: 0.25, z: 1.25 }, '#a7a9b0')
      add('cylinder', { x: 0, y: 0.52, z: 0 }, { x: 0.95, y: 0.22, z: 0.95 }, '#9a9ca3')
      add('cylinder', { x: 0, y: 0.8, z: 0 }, { x: 0.65, y: 0.2, z: 0.65 }, '#8f9198')
      break
    case 'arch-4':
      add('box', { x: 0, y: 0.85, z: 0 }, { x: 0.95, y: 1.35, z: 0.26 }, '#9b9da5')
      add('box', { x: 0, y: 0.15, z: 0 }, { x: 1.2, y: 0.15, z: 0.5 }, '#868892')
      break
    case 'arch-5':
      add('box', { x: 0, y: 0.45, z: 0 }, { x: 1.4, y: 0.5, z: 0.08 }, '#e5d5b1')
      add('cylinder', { x: -0.68, y: 0.45, z: 0 }, { x: 0.09, y: 0.52, z: 0.09 }, '#8a603c', { z: Math.PI / 2 })
      add('cylinder', { x: 0.68, y: 0.45, z: 0 }, { x: 0.09, y: 0.52, z: 0.09 }, '#8a603c', { z: Math.PI / 2 })
      break
    case 'arch-6':
      add('cylinder', { x: 0, y: 0.95, z: 0 }, { x: 0.14, y: 1.7, z: 0.14 }, '#7db46e')
      add('box', { x: 0, y: 1.42, z: 0 }, { x: 0.18, y: 0.03, z: 0.18 }, '#6ba35d')
      add('box', { x: 0, y: 0.82, z: 0 }, { x: 0.18, y: 0.03, z: 0.18 }, '#6ba35d')
      break
    case 'arch-7':
      add('box', { x: 0, y: 0.14, z: 0 }, { x: 0.9, y: 0.22, z: 0.5 }, '#83593f')
      add('cylinder', { x: 0, y: 0.55, z: 0 }, { x: 0.08, y: 0.65, z: 0.08 }, '#7a5738')
      add('sphere', { x: 0.1, y: 1.0, z: 0 }, { x: 0.55, y: 0.45, z: 0.55 }, '#5fa06a')
      break
    case 'arch-8':
      add('box', { x: 0, y: 0.92, z: 0 }, { x: 1.2, y: 1.6, z: 0.06 }, '#f3e8d0')
      add('cylinder', { x: 0, y: 1.72, z: 0 }, { x: 0.06, y: 0.65, z: 0.06 }, '#8a603c', { z: Math.PI / 2 })
      add('cylinder', { x: 0, y: 0.1, z: 0 }, { x: 0.06, y: 0.65, z: 0.06 }, '#8a603c', { z: Math.PI / 2 })
      break
    case 'arch-9':
      add('cylinder', { x: 0, y: 1.8, z: 0 }, { x: 0.07, y: 1.6, z: 0.07 }, '#a79886', { z: Math.PI / 2 })
      add('box', { x: 0, y: 0.92, z: 0 }, { x: 1.5, y: 1.6, z: 0.03 }, '#f4eee3')
      break
    case 'arch-10':
      add('cylinder', { x: 0, y: 0.42, z: 0 }, { x: 0.8, y: 0.55, z: 0.8 }, '#8f8f95')
      add('cylinder', { x: -0.52, y: 1.05, z: 0 }, { x: 0.08, y: 0.72, z: 0.08 }, wood)
      add('cylinder', { x: 0.52, y: 1.05, z: 0 }, { x: 0.08, y: 0.72, z: 0.08 }, wood)
      add('cylinder', { x: 0, y: 1.42, z: 0 }, { x: 0.07, y: 1.1, z: 0.07 }, wood, { z: Math.PI / 2 })
      break
    case 'arch-11':
      add('box', { x: -0.95, y: 0.7, z: 0 }, { x: 1.3, y: 1.4, z: 0.18 }, '#b8a38d')
      add('box', { x: 0.95, y: 0.7, z: 0 }, { x: 1.3, y: 1.4, z: 0.18 }, '#b8a38d')
      add('box', { x: 0, y: 0.72, z: 0 }, { x: 0.65, y: 1.45, z: 0.12 }, '#7a3e2e')
      add('box', { x: 0, y: 1.58, z: 0 }, { x: 3.0, y: 0.14, z: 0.22 }, '#92674a')
      break
    case 'arch-12':
      add('box', { x: 0, y: 0.62, z: 0 }, { x: 2.2, y: 1.2, z: 1.6 }, '#d6c5ab')
      add('pyramid', { x: 0, y: 1.55, z: 0 }, { x: 1.8, y: 0.7, z: 1.4 }, '#9a5a45')
      add('box', { x: 0, y: 0.2, z: 0.76 }, { x: 0.7, y: 0.4, z: 0.1 }, '#733a2d')
      break
    case 'arch-13':
      add('cylinder', { x: 0, y: 0.2, z: 0 }, { x: 0.75, y: 0.22, z: 0.75 }, '#b5a591')
      add('box', { x: 0, y: 0.62, z: 0 }, { x: 0.92, y: 0.35, z: 0.92 }, '#cbb79f')
      add('pyramid', { x: 0, y: 1.0, z: 0 }, { x: 0.68, y: 0.32, z: 0.68 }, '#8f4f3b')
      add('box', { x: 0, y: 1.3, z: 0 }, { x: 0.68, y: 0.3, z: 0.68 }, '#cbb79f')
      add('pyramid', { x: 0, y: 1.62, z: 0 }, { x: 0.5, y: 0.3, z: 0.5 }, '#8f4f3b')
      break
    case 'arch-14':
      add('pyramid', { x: 0, y: 0.72, z: 0 }, { x: 1.3, y: 1.0, z: 1.05 }, '#b58f62')
      add('box', { x: 0, y: 0.24, z: 0 }, { x: 1.28, y: 0.16, z: 1.0 }, '#6f573f')
      break
    case 'arch-15':
      add('box', { x: 0, y: 0.62, z: 0 }, { x: 2.45, y: 1.25, z: 1.35 }, '#9ea0a8')
      add('box', { x: 0, y: 1.45, z: 0 }, { x: 1.7, y: 0.55, z: 1.1 }, '#c2ab8b')
      add('pyramid', { x: 0, y: 1.95, z: 0 }, { x: 1.45, y: 0.55, z: 1 }, '#8f4f3b')
      break
    case 'arch-16':
      add('cylinder', { x: -0.75, y: 0.75, z: 0 }, { x: 0.18, y: 1.2, z: 0.18 }, '#a2a5ad')
      add('cylinder', { x: 0.75, y: 0.75, z: 0 }, { x: 0.18, y: 1.2, z: 0.18 }, '#a2a5ad')
      add('ring', { x: 0, y: 1.42, z: 0 }, { x: 0.62, y: 0.62, z: 0.62 }, '#a2a5ad', { x: Math.PI / 2 })
      add('box', { x: 0, y: 0.12, z: 0 }, { x: 1.9, y: 0.12, z: 0.4 }, '#8f9198')
      break
    case 'arch-17':
      add('box', { x: 0, y: 0.82, z: 0 }, { x: 2.4, y: 1.62, z: 0.12 }, '#d5dbe2')
      add('box', { x: 0, y: 1.58, z: 0 }, { x: 2.4, y: 0.08, z: 0.2 }, '#a8b4bf')
      break
    case 'arch-18':
      add('box', { x: -0.52, y: 1.0, z: 0 }, { x: 0.85, y: 2.0, z: 0.05 }, '#9cb2c7')
      add('box', { x: 0.52, y: 1.0, z: 0 }, { x: 0.85, y: 2.0, z: 0.05 }, '#9cb2c7')
      add('box', { x: 0, y: 2.05, z: 0 }, { x: 1.86, y: 0.08, z: 0.12 }, '#78899b')
      break
    case 'arch-19':
      add('box', { x: 0, y: 1.85, z: 0 }, { x: 1.5, y: 3.6, z: 1.2 }, '#a6afba')
      add('box', { x: 0, y: 0.14, z: 0 }, { x: 1.8, y: 0.18, z: 1.5 }, '#7d8a98')
      add('box', { x: 0, y: 1.9, z: 0.61 }, { x: 1.2, y: 2.8, z: 0.03 }, '#7ea4d1')
      break
    case 'arch-20':
      add('box', { x: 0, y: 0.62, z: 0 }, { x: 1.8, y: 1.2, z: 1.2 }, '#e2d6c3')
      add('pyramid', { x: 0, y: 1.4, z: 0 }, { x: 1.4, y: 0.55, z: 1 }, '#ad5a42')
      add('box', { x: 0, y: 0.68, z: 0.61 }, { x: 1.3, y: 0.5, z: 0.05 }, '#f0e6cf')
      break
    case 'outdoor-2':
      add('box', { x: 0, y: 0.42, z: 0 }, { x: 1.7, y: 0.45, z: 0.95 }, color)
      add('box', { x: 0.1, y: 0.72, z: 0 }, { x: 0.9, y: 0.35, z: 0.82 }, '#a3c5ff')
      ;[-0.62, 0.62].forEach((x) => {
        ;[-0.42, 0.42].forEach((z) => add('torus', { x, y: 0.16, z }, { x: 0.22, y: 0.22, z: 0.22 }, dark, { x: Math.PI / 2 }))
      })
      break
    case 'outdoor-5':
      add('dodecahedron', { x: 0, y: 0.45, z: 0 }, { x: 1.1, y: 0.82, z: 0.95 }, '#8f8f93', { y: 0.7 })
      break
    case 'outdoor-6':
      ;[-0.65, -0.2, 0.25, 0.7].forEach((x) => add('cylinder', { x, y: 0.45, z: 0 }, { x: 0.08, y: 0.7, z: 0.08 }, wood))
      add('box', { x: 0, y: 0.55, z: 0 }, { x: 1.65, y: 0.08, z: 0.08 }, wood)
      add('box', { x: 0, y: 0.3, z: 0 }, { x: 1.65, y: 0.08, z: 0.08 }, wood)
      break
    case 'outdoor-7':
      add('cylinder', { x: 0, y: 0.42, z: 0 }, { x: 0.52, y: 0.68, z: 0.52 }, '#9fa0a6')
      break
    case 'outdoor-9':
      add('cylinder', { x: 0, y: 0.5, z: 0 }, { x: 0.4, y: 0.8, z: 0.4 }, '#d74a3f')
      add('sphere', { x: 0, y: 0.95, z: 0 }, { x: 0.25, y: 0.25, z: 0.25 }, '#d74a3f')
      add('cylinder', { x: 0.35, y: 0.58, z: 0 }, { x: 0.12, y: 0.2, z: 0.12 }, '#d74a3f', { z: Math.PI / 2 })
      add('cylinder', { x: -0.35, y: 0.58, z: 0 }, { x: 0.12, y: 0.2, z: 0.12 }, '#d74a3f', { z: Math.PI / 2 })
      break
    case 'gufeng-0':
      add('box', { x: 0, y: 0.95, z: 0 }, { x: 0.1, y: 1.45, z: 0.05 }, light)
      add('box', { x: 0, y: 0.28, z: 0 }, { x: 0.5, y: 0.08, z: 0.08 }, '#b49b66')
      add('cylinder', { x: 0, y: 0.1, z: 0 }, { x: 0.08, y: 0.25, z: 0.08 }, '#805d2e')
      break
    case 'gufeng-1':
      add('sphere', { x: 0, y: 0.75, z: 0 }, { x: 0.55, y: 0.65, z: 0.55 }, '#d4573c')
      add('cylinder', { x: 0, y: 1.45, z: 0 }, { x: 0.06, y: 0.3, z: 0.06 }, '#d6b37f')
      add('cylinder', { x: 0, y: 0.08, z: 0 }, { x: 0.05, y: 0.16, z: 0.05 }, '#d6b37f')
      break
    case 'decor-0':
      add('sphere', { x: 0, y: 0.75, z: 0 }, { x: 0.55, y: 0.9, z: 0.55 }, '#d4573c')
      add('cylinder', { x: 0, y: 1.45, z: 0 }, { x: 0.06, y: 0.3, z: 0.06 }, '#d6b37f')
      add('cylinder', { x: 0, y: 0.08, z: 0 }, { x: 0.05, y: 0.16, z: 0.05 }, '#d6b37f')
      break
    case 'gufeng-3':
      add('box', { x: 0, y: 0.28, z: 0 }, { x: 1.8, y: 0.22, z: 0.45 }, wood)
      add('cylinder', { x: -0.82, y: 0.28, z: 0 }, { x: 0.16, y: 0.45, z: 0.16 }, wood, { z: Math.PI / 2 })
      add('cylinder', { x: 0.82, y: 0.28, z: 0 }, { x: 0.16, y: 0.45, z: 0.16 }, wood, { z: Math.PI / 2 })
      break
    case 'gufeng-4':
    case 'gufeng-2':
    case 'gufeng-12':
      add('sphere', { x: 0, y: 0.5, z: 0 }, { x: 0.55, y: 0.55, z: 0.55 }, color)
      add('cylinder', { x: 0, y: 1.02, z: 0 }, { x: 0.14, y: 0.25, z: 0.14 }, color)
      add('cone', { x: 0.35, y: 0.65, z: 0 }, { x: 0.1, y: 0.22, z: 0.1 }, color, { z: -Math.PI / 2 })
      break
    case 'gufeng-13':
      add('cylinder', { x: 0, y: 0.28, z: 0 }, { x: 0.38, y: 0.35, z: 0.38 }, color)
      add('ring', { x: 0.38, y: 0.28, z: 0 }, { x: 0.18, y: 0.18, z: 0.18 }, color, { y: Math.PI / 2 })
      break
    case 'gufeng-5':
      add('box', { x: 0, y: 0.92, z: 0 }, { x: 1.95, y: 1.62, z: 0.08 }, '#d0b07f')
      add('box', { x: -0.82, y: 0.08, z: 0 }, { x: 0.28, y: 0.08, z: 0.42 }, wood)
      add('box', { x: 0.82, y: 0.08, z: 0 }, { x: 0.28, y: 0.08, z: 0.42 }, wood)
      break
    case 'gufeng-10':
      add('cone', { x: 0, y: 0.42, z: 0 }, { x: 1.1, y: 0.52, z: 0.12 }, '#d9c58e', { x: -Math.PI / 2 })
      add('cylinder', { x: 0, y: 0.08, z: 0 }, { x: 0.08, y: 0.2, z: 0.08 }, wood)
      break
    case 'gufeng-11':
      add('cone', { x: 0, y: 1.08, z: 0 }, { x: 1.25, y: 0.55, z: 1.25 }, '#e2d3a0')
      add('cylinder', { x: 0, y: 0.58, z: 0 }, { x: 0.06, y: 1.15, z: 0.06 }, wood)
      break
    case 'gufeng-14':
      add('cylinder', { x: 0, y: 0.9, z: 0 }, { x: 0.28, y: 0.45, z: 0.28 }, '#bb9770')
      add('cylinder', { x: 0, y: 0.2, z: 0 }, { x: 0.04, y: 0.35, z: 0.04 }, '#d7bf8f')
      break
    case 'gufeng-15':
      add('cylinder', { x: 0, y: 0.3, z: 0 }, { x: 0.2, y: 0.5, z: 0.2 }, '#f2ead5')
      add('cone', { x: 0, y: 0.65, z: 0 }, { x: 0.06, y: 0.15, z: 0.06 }, '#ffd172')
      break
    case 'gufeng-8':
      add('cylinder', { x: 0, y: 0.55, z: 0 }, { x: 0.52, y: 0.62, z: 0.52 }, '#4f5d6d')
      add('sphere', { x: 0, y: 1.0, z: 0 }, { x: 0.18, y: 0.18, z: 0.18 }, '#b89b68')
      break
    case 'gufeng-9':
      add('cylinder', { x: 0, y: 0.18, z: 0 }, { x: 0.62, y: 0.18, z: 0.62 }, '#ccb18b')
      add('cone', { x: 0, y: 0.38, z: 0 }, { x: 0.78, y: 0.32, z: 0.78 }, '#d5b98f')
      break
    case 'gufeng-16':
      add('ring', { x: 0, y: 0.82, z: 0 }, { x: 0.52, y: 0.52, z: 0.08 }, '#b1824f')
      add('cylinder', { x: 0, y: 0.3, z: 0 }, { x: 0.07, y: 0.52, z: 0.07 }, '#8e663c')
      break
    case 'gufeng-17':
      add('box', { x: 0, y: 0.2, z: 0 }, { x: 0.95, y: 0.18, z: 0.08 }, '#8a603c')
      ;[-0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4].forEach((x) => add('box', { x, y: 0.05, z: 0 }, { x: 0.03, y: 0.18, z: 0.04 }, '#8a603c'))
      break
    case 'gufeng-18':
      add('box', { x: 0, y: 0.2, z: 0 }, { x: 0.9, y: 0.25, z: 0.55 }, '#ebe5dd')
      break
    case 'decor-2':
      add('cylinder', { x: 0, y: 0.45, z: 0 }, { x: 0.05, y: 0.72, z: 0.05 }, '#8a603c')
      add('cone', { x: 0, y: 0.04, z: 0 }, { x: 0.06, y: 0.14, z: 0.06 }, '#d8c19d')
      break
    case 'decor-1':
      add('box', { x: 0, y: 0.15, z: 0 }, { x: 0.9, y: 0.2, z: 0.62 }, '#4b4e56')
      add('box', { x: 0.2, y: 0.21, z: 0 }, { x: 0.35, y: 0.06, z: 0.35 }, '#3d4048')
      break
    case 'decor-3':
      add('cone', { x: 0, y: 0.52, z: 0 }, { x: 0.32, y: 0.46, z: 0.32 }, '#d6bf8a')
      add('cone', { x: 0, y: 0.06, z: 0 }, { x: 0.32, y: 0.46, z: 0.32 }, '#d6bf8a', { x: Math.PI })
      add('cylinder', { x: 0, y: 0.3, z: 0 }, { x: 0.03, y: 0.12, z: 0.03 }, '#8a603c')
      break
    case 'decor-4':
      add('cylinder', { x: 0, y: 0.35, z: 0 }, { x: 0.45, y: 0.42, z: 0.45 }, '#8f744f')
      add('sphere', { x: 0, y: 0.75, z: 0 }, { x: 0.15, y: 0.12, z: 0.15 }, '#b89b68')
      break
    case 'decor-5':
      add('box', { x: 0, y: 0.16, z: 0 }, { x: 1.0, y: 0.18, z: 0.72 }, '#5e6d9c')
      add('box', { x: 0.05, y: 0.28, z: 0.02 }, { x: 0.92, y: 0.08, z: 0.62 }, '#d9d5c8')
      break
    default:
      return null
  }

  return g
}

function disposeObject3D(root: Object3D) {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return
    child.geometry.dispose()
    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose())
    else child.material.dispose()
  })
}

function applyColorToObject(root: Object3D, color: string) {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return
    if (child.userData.tintable === false) return
    const mat = child.material
    if (Array.isArray(mat)) mat.forEach((m) => ((m as MeshStandardMaterial).color?.set?.(color)))
    else (mat as MeshStandardMaterial).color?.set?.(color)
  })
}

function resolveUpstreamDisplay(): {
  url: string | null
  sourceKind: 'vr360' | 'imageCanvas' | null
} {
  for (const e of edges.value) {
    if (e.target !== props.id) continue
    const n = findNode(e.source)
    if (!n?.data) continue
    if (n.type === 'imageCanvas') {
      const d = n.data as { generatedImageUrl?: string | null; uploadedMainImageUrl?: string | null }
      const u = d.generatedImageUrl ?? d.uploadedMainImageUrl
      if (u) return { url: u, sourceKind: 'imageCanvas' }
    }
    if (n.type === 'vr360') {
      const d = n.data as { imageUrl?: string | null; previewImageUrl?: string | null }
      const u = d.imageUrl ?? d.previewImageUrl
      if (u) return { url: u, sourceKind: 'vr360' }
    }
  }
  return { url: null, sourceKind: null }
}

function resolveUpstreamImageUrl(): string | null {
  return resolveUpstreamDisplay().url
}

/** 是否在场景内将球幕全景贴于大球内侧（360°环顾），与全景节点 VrPanoView 语义一致 */
const wantPanoBackground = computed(() => {
  const explicit = props.data.panoBackground
  if (explicit === true) return true
  if (explicit === false) return false
  return resolveUpstreamDisplay().sourceKind === 'vr360'
})

function onPanoBackgroundChange(ev: Event) {
  const checked = (ev.target as HTMLInputElement).checked
  pushStateBeforeChange?.()
  updateNodeData(props.id, { panoBackground: checked })
}

watch([edges, nodes], () => {
  const incoming = resolveUpstreamImageUrl()
  if (incoming && incoming !== props.data.imageUrl) {
    updateNodeData(props.id, { imageUrl: incoming, previewImageUrl: incoming })
  }
}, { deep: true })

function setRendererSize() {
  const el = containerRef.value
  const gl = renderer.value
  const cam = camera.value
  if (!el || !gl || !cam) return
  const w = el.clientWidth
  const h = el.clientHeight
  if (w <= 0 || h <= 0) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  gl.setPixelRatio(dpr)
  gl.setSize(w, h, false)
  cam.aspect = w / h
  cam.updateProjectionMatrix()
}

function disposeSceneObjects() {
  meshMap.value.forEach((m) => {
    disposeObject3D(m)
    scene.value?.remove(m)
  })
  meshMap.value.clear()

  if (backgroundBackdrop.value) {
    backgroundBackdrop.value.geometry.dispose()
    const mat = backgroundBackdrop.value.material
    if (Array.isArray(mat)) mat.forEach(x => x.dispose())
    else mat.dispose()
    scene.value?.remove(backgroundBackdrop.value)
    backgroundBackdrop.value = null
  }
  if (currentTexture.value) {
    currentTexture.value.dispose()
    currentTexture.value = null
  }
}

function syncBackground() {
  const sc = scene.value
  if (!sc) return

  if (backgroundBackdrop.value) {
    sc.remove(backgroundBackdrop.value)
    backgroundBackdrop.value.geometry.dispose()
    const bm = backgroundBackdrop.value.material
    if (Array.isArray(bm)) bm.forEach((m) => m.dispose())
    else bm.dispose()
    backgroundBackdrop.value = null
  }
  if (currentTexture.value) {
    currentTexture.value.dispose()
    currentTexture.value = null
  }

  const u = displayImageUrl.value
  if (!u) return

  const loader = new TextureLoader()
  loader.crossOrigin = 'anonymous'
  loader.load(
    u,
    (tex) => {
      if (u !== displayImageUrl.value) {
        tex.dispose()
        return
      }
      tex.minFilter = LinearFilter
      tex.magFilter = LinearFilter
      tex.colorSpace = SRGBColorSpace
      currentTexture.value = tex
      const usePano = wantPanoBackground.value
      if (usePano) {
        const sphere = new Mesh(
          new SphereGeometry(160, 64, 40),
          new MeshBasicMaterial({ map: tex, side: BackSide })
        )
        sphere.position.set(0, 0.8, 0)
        sphere.scale.set(-1, 1, 1)
        sphere.name = 'viewport3d-pano-bg'
        backgroundBackdrop.value = sphere
        sc.add(sphere)
      } else {
        const plane = new Mesh(
          new PlaneGeometry(8, 6),
          new MeshStandardMaterial({ map: tex, transparent: true })
        )
        plane.position.set(0, 2.2, -6)
        backgroundBackdrop.value = plane
        sc.add(plane)
      }
    },
    undefined,
    () => {
      /* 纹理加载失败时忽略 */
    }
  )
}

function syncMeshesFromData() {
  const sc = scene.value
  if (!sc) return

  const map = meshMap.value
  const nextIds = new Set(objects.value.map(o => o.id))

  Array.from(map.keys()).forEach((id) => {
    if (!nextIds.has(id)) {
      const m = map.get(id)
      if (m) {
        sc.remove(m)
        disposeObject3D(m)
      }
      map.delete(id)
      if (selectedObjectId.value === id) selectedObjectId.value = null
    }
  })

  objects.value.forEach((obj) => {
    const rawKey = obj.modelKey ?? obj.name.replace(/\s+\d+$/, '')
    const modelKey = resolveCanonicalPresetId(rawKey)
    const shape = obj.shape ?? 'box'
    const assetKey = obj.assetKey ?? (
      modelKey === 'pose-stand'
        ? 'character1'
        : modelKey === 'pose-sit'
          ? 'character2'
          : modelKey === 'pose-lie'
            ? 'character3'
          : ''
    )
    let mesh = map.get(obj.id)
    const hasAssetTemplate = Boolean(assetKey && modelTemplateMap.value.get(assetKey))
    const isAssetFallback = Boolean(assetKey && mesh && mesh.userData.assetFromTemplate !== true)
    const shouldRebuild = !mesh
      || mesh.userData.shape !== shape
      || mesh.userData.modelKey !== modelKey
      || mesh.userData.assetKey !== assetKey
      || (hasAssetTemplate && isAssetFallback)
    if (shouldRebuild) {
      if (mesh) {
        sc.remove(mesh)
        disposeObject3D(mesh)
      }
      const assetUrl = ASSET_MODEL_URLS[assetKey]
      if (assetKey && assetUrl) {
        const template = modelTemplateMap.value.get(assetKey)
        if (template) {
          mesh = cloneTemplateObject(template)
          mesh.userData.assetFromTemplate = true
        } else {
          mesh = undefined
          void ensureObjAsset(assetKey, assetUrl)
        }
      }
      // 人物 OBJ 在未加载前不再回退占位组合模型，等待资源就绪后自动重建。
      if (!mesh && assetKey) return
      if (!mesh) {
        const composite = buildCompositeModel(modelKey, obj.color || '#7c6cff')
        mesh = composite ?? new Mesh(
          createGeometryByShape(shape),
          new MeshStandardMaterial({ color: obj.color || '#7c6cff', metalness: 0.15, roughness: 0.65 })
        )
        mesh.userData.assetFromTemplate = false
      }
      mesh.userData.objectId = obj.id
      mesh.userData.shape = shape
      mesh.userData.modelKey = modelKey
      mesh.userData.assetKey = assetKey
      mesh.traverse((child) => {
        child.userData.objectId = obj.id
      })
      map.set(obj.id, mesh)
      sc.add(mesh)
    }
    if (!mesh) return
    mesh.position.set(obj.position.x, obj.position.y, obj.position.z)
    mesh.rotation.set(obj.rotation?.x ?? 0, obj.rotation?.y ?? 0, obj.rotation?.z ?? 0)
    mesh.scale.set(obj.scale?.x ?? 1, obj.scale?.y ?? 1, obj.scale?.z ?? 1)
    applyColorToObject(mesh, obj.color || '#7c6cff')
  })

  attachTransform()
}

function attachTransform() {
  const tc = transform.value
  if (!tc) return
  if (!selectedObjectId.value) {
    tc.detach()
    return
  }
  const mesh = meshMap.value.get(selectedObjectId.value)
  if (mesh) tc.attach(mesh)
  else tc.detach()
}

function persistSelectedObjectTransform() {
  const id = selectedObjectId.value
  if (!id) return
  const mesh = meshMap.value.get(id)
  if (!mesh) return
  const next = objects.value.map(o => o.id === id ? {
    ...o,
    position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
    rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
    scale: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z }
  } : o)
  updateNodeData(props.id, { objects: next })
}

function updateObjectsWithHistory(next: Viewport3DObject[], pushHistory = true) {
  if (pushHistory) pushStateBeforeChange?.()
  updateNodeData(props.id, { objects: next })
}

function onCanvasPointerDown(e: PointerEvent) {
  e.stopPropagation()
  // 右键/中键交给 OrbitControls 做平移/缩放；这里仅阻止冒泡给 VueFlow
  if (e.button !== 0) return
  const gl = renderer.value
  const tc = transform.value
  if (!gl) return
  // 使用 TransformControls 自身的 axis 状态判定是否点在 gizmo 上，
  // 避免射线误判导致永远无法切换/取消选中。
  const clickedGizmoAxis = Boolean((tc as any)?.axis)
  pointerDownPos.value = { x: e.clientX, y: e.clientY, moved: false, skipSelect: clickedGizmoAxis }
}

function onCanvasPointerMove(e: PointerEvent) {
  const state = pointerDownPos.value
  if (!state) return
  if (state.moved) return
  const dx = e.clientX - state.x
  const dy = e.clientY - state.y
  if (dx * dx + dy * dy > 16) {
    state.moved = true
    pointerDownPos.value = state
  }
}

function onCanvasPointerUp(e: PointerEvent) {
  if (e.button !== 0) return
  const state = pointerDownPos.value
  pointerDownPos.value = null
  if (!state || state.skipSelect || state.moved) return

  const gl = renderer.value
  const cam = camera.value
  if (!gl || !cam) return

  const rect = gl.domElement.getBoundingClientRect()
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, cam)
  const hits = raycaster.intersectObjects(Array.from(meshMap.value.values()), true)
  selectedObjectId.value = hits.length ? (hits[0].object.userData.objectId as string) : null
  attachTransform()
}

function addObjectFromPreset(preset: ObjectPreset) {
  const count = objects.value.length
  const shape = preset.shape ?? 'box'
  const isPlane = shape === 'plane'
  const isPersonPreset = preset.id === 'pose-stand' || preset.id === 'pose-sit' || preset.id === 'pose-lie'
  const personColor = isPersonPreset ? randomPersonColor() : (preset.color || COLOR_GENERAL)
  const assetKey =
    preset.id === 'pose-stand'
      ? 'character1'
      : preset.id === 'pose-sit'
        ? 'character2'
        : preset.id === 'pose-lie'
          ? 'character3'
          : undefined
  const baseY = getDefaultSpawnY(shape, isPersonPreset, preset.id)
  const disp = presetDisplayName(preset)
  const obj: Viewport3DObject = {
    id: `${shape}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${disp} ${count + 1}`,
    shape,
    modelKey: preset.id,
    assetKey,
    position: { x: (count % 4) * 1.4 - 2.1, y: baseY, z: Math.floor(count / 4) * 1.4 - 1.4 },
    rotation: { x: isPlane ? -Math.PI / 2 : 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    color: personColor
  }
  updateObjectsWithHistory([...objects.value, obj], true)
  selectedObjectId.value = obj.id
  nextTick(() => attachTransform())
}

function presetDisplayName(preset: ObjectPreset): string {
  const path = `canvas.nodeUi.viewport3d.preset.${preset.id}`
  const tr = t(path)
  return tr === path ? preset.name : tr
}

function categoryDisplayName(cat: ObjectCategory): string {
  const path = `canvas.nodeUi.viewport3d.category.${cat.id}`
  const tr = t(path)
  return tr === path ? cat.name : tr
}

function removeSelectedObject() {
  if (!selectedObjectId.value) return
  const next = objects.value.filter(o => o.id !== selectedObjectId.value)
  updateObjectsWithHistory(next, true)
  selectedObjectId.value = null
  attachTransform()
}

function onWindowKeyDown(e: KeyboardEvent) {
  const key = e.key
  const isDeleteKey = key === 'Delete' || key === 'Backspace'
  if (!isDeleteKey || !selectedObjectId.value) return

  const target = e.target as HTMLElement | null
  if (target) {
    const tag = target.tagName
    const isTypingTarget = tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
    if (isTypingTarget) return
  }

  e.preventDefault()
  e.stopPropagation()
  removeSelectedObject()
}

function setTransformMode(mode: 'translate' | 'rotate' | 'scale') {
  transformMode.value = mode
  if (transform.value) transform.value.setMode(mode)
}

function setCameraPreset(preset: 'front' | 'back' | 'left' | 'right' | 'iso') {
  const cam = camera.value
  const oc = orbit.value
  if (!cam || !oc) return
  if (preset === 'front') cam.position.set(0, 1.8, 8)
  else if (preset === 'back') cam.position.set(0, 1.8, -8)
  else if (preset === 'left') cam.position.set(-8, 1.8, 0)
  else if (preset === 'right') cam.position.set(8, 1.8, 0)
  else cam.position.set(4.8, 3.2, 6.2)
  oc.target.set(0, 0.8, 0)
  oc.update()
}

function resetCamera() {
  setCameraPreset('iso')
}

function toggleFullscreen() {
  const el = cardRef.value
  if (!el) return
  if (!isFullscreen.value) {
    void el.requestFullscreen?.()
  } else {
    void document.exitFullscreen?.()
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
  setTimeout(() => setRendererSize(), 80)
}

function updateSelectedObjectName(name: string) {
  if (!selectedObjectId.value) return
  const next = objects.value.map(o => o.id === selectedObjectId.value ? { ...o, name } : o)
  updateObjectsWithHistory(next, true)
}

function updateSelectedObjectColor(color: string) {
  if (!selectedObjectId.value) return
  const next = objects.value.map(o => o.id === selectedObjectId.value ? { ...o, color } : o)
  updateObjectsWithHistory(next, true)
}

function readRenderTargetToDataUrl(target: WebGLRenderTarget): string {
  const gl = renderer.value
  if (!gl) return ''
  const w = target.width
  const h = target.height
  const pixels = new Uint8Array(w * h * 4)
  gl.readRenderTargetPixels(target, 0, 0, w, h, pixels)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 4
      const dst = ((h - 1 - y) * w + x) * 4
      img.data[dst] = pixels[src]
      img.data[dst + 1] = pixels[src + 1]
      img.data[dst + 2] = pixels[src + 2]
      img.data[dst + 3] = pixels[src + 3]
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

async function captureColorAndDepth(): Promise<{ color: string; depth: string }> {
  const gl = renderer.value
  const sc = scene.value
  const cam = camera.value
  const el = containerRef.value
  if (!gl || !sc || !cam || !el) {
    return { color: '', depth: '' }
  }

  // 固定导出尺寸为 1920x1080（16:9 横屏）
  const w = 1920
  const h = 1080

  const colorRT = new WebGLRenderTarget(w, h)
  colorRT.texture.colorSpace = SRGBColorSpace
  const depthRT = new WebGLRenderTarget(w, h)

  const prevTarget = gl.getRenderTarget()
  const prevOverride = sc.overrideMaterial
  const prevBg = sc.background

  gl.setRenderTarget(colorRT)
  gl.render(sc, cam)
  const colorUrl = readRenderTargetToDataUrl(colorRT)

  // --- 深度图：黑色背景 + 动态计算 near/far ---
  sc.background = new Color(0x000000)
  const depthMat = new MeshDepthMaterial({ depthPacking: BasicDepthPacking })
  sc.overrideMaterial = depthMat

  // 动态计算场景中所有 mesh 到相机的最近/最远距离
  let minDist = Infinity
  let maxDist = -Infinity
  const camPos = cam.position
  sc.traverse((obj: any) => {
    if (obj.isMesh && obj.geometry?.boundingSphere) {
      const sphere = obj.geometry.boundingSphere
      const worldPos = new Vector3()
      obj.getWorldPosition(worldPos)
      const dist = worldPos.distanceTo(camPos)
      const r = sphere.radius
      const dMin = Math.max(0.01, dist - r)
      const dMax = dist + r
      if (dMin < minDist) minDist = dMin
      if (dMax > maxDist) maxDist = dMax
    }
  })

  // 如果没有找到 mesh，使用默认值
  if (!isFinite(minDist)) minDist = 0.5
  if (!isFinite(maxDist)) maxDist = 30

  // near 略小于最近物体，far 略大于最远物体，留出余量
  const origNear = cam.near
  const origFar = cam.far
  cam.near = minDist * 0.8
  cam.far = maxDist * 1.3
  cam.updateProjectionMatrix()

  gl.setRenderTarget(depthRT)
  gl.render(sc, cam)

  // 恢复相机和场景状态
  cam.near = origNear
  cam.far = origFar
  cam.updateProjectionMatrix()
  sc.overrideMaterial = prevOverride
  sc.background = prevBg

  const rawDepthUrl = readRenderTargetToDataUrl(depthRT)

  gl.setRenderTarget(prevTarget)
  colorRT.dispose()
  depthRT.dispose()
  depthMat.dispose()

  // 深度图后处理：归一化拉伸 + gamma 校正，充分利用 0-255 动态范围
  const depthUrl = await new Promise<string>((resolve) => {
    const c = document.createElement('canvas')
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      c.width = img.width
      c.height = img.height
      const ctx = c.getContext('2d')
      if (!ctx) {
        resolve(rawDepthUrl)
        return
      }
      ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, c.width, c.height)
      
      // 第一步：找到非黑色区域的最小和最大灰度值
      let minVal = 255
      let maxVal = 0
      for (let i = 0; i < d.data.length; i += 4) {
        const val = d.data[i]
        if (val > 5) { // 跳过纯黑色背景
          if (val < minVal) minVal = val
          if (val > maxVal) maxVal = val
        }
      }
      
      // 如果没有找到有效像素，使用默认值
      if (minVal === 255 || maxVal === 0) {
        minVal = 0
        maxVal = 255
      }
      
      // 第二步：归一化 + gamma 校正 + 对比度增强
      const range = maxVal - minVal
      const contrast = 1.4 // 对比度增强系数
      const gamma = 0.8 // gamma 校正
      
      for (let i = 0; i < d.data.length; i += 4) {
        let val = d.data[i]
        
        if (val <= 5) {
          // 纯黑色背景保持黑色
          val = 0
        } else {
          // 归一化到 [0, 1]
          let normalized = (val - minVal) / range
          
          // 应用 gamma 校正（让亮的更亮）
          normalized = Math.pow(normalized, gamma)
          
          // 对比度增强
          normalized = ((normalized - 0.5) * contrast) + 0.5
          
          // 限制在 [0, 1] 范围内
          normalized = Math.max(0, Math.min(1, normalized))
          
          // 转回 [0, 255]
          val = Math.round(normalized * 255)
        }
        
        d.data[i] = val
        d.data[i + 1] = val
        d.data[i + 2] = val
        d.data[i + 3] = 255
      }
      
      ctx.putImageData(d, 0, 0)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => {
      resolve(rawDepthUrl)
    }
    img.src = rawDepthUrl
  })

  return { color: colorUrl, depth: depthUrl }
}

function buildExportedImageNodeData(imageUrl: string, title: string): ImageNodeData {
  return {
    label: title,
    type: 'image',
    status: 'pending',
    description: t('canvas.nodeUi.viewport3d.exportFrom'),
    prompt: '',
    referenceImages: [],
    uploadedMainImageUrl: imageUrl,
    generatedImageUrl: null,
    toolbarExpanded: false,
    imageQuality: '1K',
    aspectRatio: '16:9',
    imageModelGroup: apiStore.imageModelGroup as ImageNodeData['imageModelGroup'],
    imageModel: apiStore.imageModel
  }
}

/** 导出后右侧图片节点纵向占位（与 imageCanvas 卡片高度接近），用于对齐输出桩与两节点中线 */
const EXPORT_IMAGE_NODE_LAYOUT_HEIGHT = 400
/** 颜色图底与深度图顶之间的间距 */
const EXPORT_IMAGE_NODE_GAP_Y = 44
/** 三维视图右缘与导出图节点的水平间距 */
const EXPORT_IMAGE_NODE_GAP_X = 48

async function exportColorDepth() {
  const source = findNode(props.id)
  if (!source) return

  const { color, depth } = await captureColorAndDepth()
  if (!color || !depth) {
    ElMessage.error(t('canvas.nodeUi.viewport3d.exportFail'))
    return
  }

  const w = source.dimensions?.width ?? 520
  const hS = source.dimensions?.height ?? 430
  const sx = source.position?.x ?? 0
  const sy = source.position?.y ?? 0
  /** 输出桩在源节点垂直居中；两导出图以该水平线为中线对称排布：上颜色、下深度，中间留白 */
  const midY = sy + hS / 2
  const colorY = midY - EXPORT_IMAGE_NODE_LAYOUT_HEIGHT - EXPORT_IMAGE_NODE_GAP_Y / 2
  const depthY = midY + EXPORT_IMAGE_NODE_GAP_Y / 2
  const outX = sx + w + EXPORT_IMAGE_NODE_GAP_X

  const edgeT = vueFlowEdgeTypeForSetting(userStore.edgeStyle)
  const st = canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)

  pushStateBeforeChange?.()

  const colorId = `image-color-${Date.now()}`
  const depthId = `image-depth-${Date.now()}`

  addNodes([
    {
      id: colorId,
      type: 'imageCanvas',
      position: { x: outX, y: colorY },
      data: buildExportedImageNodeData(color, t('canvas.nodeUi.viewport3d.exportColorLabel'))
    },
    {
      id: depthId,
      type: 'imageCanvas',
      position: { x: outX, y: depthY },
      data: buildExportedImageNodeData(depth, t('canvas.nodeUi.viewport3d.depthLabel'))
    }
  ])

  addEdges([
    { id: `e-${props.id}-${colorId}`, source: props.id, target: colorId, type: edgeT, animated: true, style: st },
    { id: `e-${props.id}-${depthId}`, source: props.id, target: depthId, type: edgeT, animated: true, style: st }
  ])

  ElMessage.success(t('canvas.nodeUi.viewport3d.exportOk'))
}

function tick() {
  raf = requestAnimationFrame(tick)
  orbit.value?.update()
  if (renderer.value && scene.value && camera.value) {
    renderer.value.render(scene.value, camera.value)
  }
}

function buildScene() {
  const el = containerRef.value
  if (!el) return

  const sc = new Scene()
  sc.background = new Color(0x1a1a22)

  const cam = new PerspectiveCamera(50, 1, 0.1, 100)
  cam.position.set(4.8, 3.2, 6.2)
  cam.lookAt(0, 0.8, 0)

  const gl = new WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true })
  gl.outputColorSpace = SRGBColorSpace
  el.appendChild(gl.domElement)
  gl.domElement.style.display = 'block'
  gl.domElement.style.width = '100%'
  gl.domElement.style.height = '100%'

  const oc = new OrbitControls(cam, gl.domElement)
  oc.enableRotate = true
  oc.enableZoom = true
  oc.enablePan = true
  oc.screenSpacePanning = true
  oc.enableDamping = true
  oc.dampingFactor = 0.08
  oc.target.set(0, 0.8, 0)
  oc.mouseButtons = {
    LEFT: MOUSE.ROTATE,
    MIDDLE: MOUSE.DOLLY,
    RIGHT: MOUSE.PAN
  }

  const tc = new TransformControls(cam, gl.domElement)
  tc.setMode(transformMode.value)
  tc.setSize(1.15)
  tc.showX = true
  tc.showY = true
  tc.showZ = true
  tc.addEventListener('dragging-changed', (ev: any) => {
    if (Boolean(ev?.value)) {
      pushStateBeforeChange?.()
    }
    oc.enabled = !Boolean(ev?.value)
  })
  tc.addEventListener('objectChange', persistSelectedObjectTransform)
  const helper = tc.getHelper()
  sc.add(helper)

  sc.add(new AmbientLight(0xffffff, 0.75))
  const d1 = new DirectionalLight(0xffffff, 1)
  d1.position.set(5, 8, 4)
  sc.add(d1)
  const d2 = new DirectionalLight(0x9fb4ff, 0.45)
  d2.position.set(-5, 3, -4)
  sc.add(d2)
  const grid = new GridHelper(24, 24, 0x5a5a66, 0x343444)
  grid.position.y = 0
  sc.add(grid)

  scene.value = sc
  camera.value = cam
  renderer.value = gl
  orbit.value = oc
  transform.value = tc
  transformHelper.value = helper

  gl.domElement.addEventListener('pointerdown', onCanvasPointerDown)
  gl.domElement.addEventListener('pointermove', onCanvasPointerMove)
  gl.domElement.addEventListener('pointerup', onCanvasPointerUp)
  gl.domElement.addEventListener('contextmenu', (evt) => evt.preventDefault())

  setRendererSize()
  syncBackground()
  syncMeshesFromData()
  tick()
}

onMounted(() => {
  buildScene()
  void ensureObjAsset('character1', ASSET_MODEL_URLS.character1)
  void ensureObjAsset('character2', ASSET_MODEL_URLS.character2)
  void ensureObjAsset('character3', ASSET_MODEL_URLS.character3)
  resizeObs = new ResizeObserver(() => setRendererSize())
  if (containerRef.value) resizeObs.observe(containerRef.value)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('keydown', onWindowKeyDown, true)
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  resizeObs?.disconnect()
  resizeObs = null

  const gl = renderer.value
  if (gl) {
    gl.domElement.removeEventListener('pointerdown', onCanvasPointerDown)
    gl.domElement.removeEventListener('pointermove', onCanvasPointerMove)
    gl.domElement.removeEventListener('pointerup', onCanvasPointerUp)
    if (containerRef.value && gl.domElement.parentNode === containerRef.value) {
      containerRef.value.removeChild(gl.domElement)
    }
    gl.dispose()
  }

  transform.value?.dispose()
  orbit.value?.dispose()
  if (scene.value && transformHelper.value) {
    scene.value.remove(transformHelper.value)
  }
  disposeSceneObjects()
  modelTemplateMap.value.forEach((obj) => disposeObject3D(obj))
  modelTemplateMap.value.clear()
  modelLoadingMap.clear()
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('keydown', onWindowKeyDown, true)

  scene.value = null
  camera.value = null
  renderer.value = null
  orbit.value = null
  transform.value = null
  transformHelper.value = null
})

watch(displayImageUrl, () => syncBackground())
watch(wantPanoBackground, () => syncBackground())
watch(objects, () => syncMeshesFromData(), { deep: true })
watch(selectedObjectId, () => attachTransform())
</script>

<template>
  <div class="viewport3d-root">
    <Handle type="target" :position="Position.Left" class="handle handle-target" />

    <div ref="cardRef" class="viewport3d-card" :class="{ 'is-selected': selected }">
      <div class="viewport3d-header">
        <el-icon class="h-icon"><Box /></el-icon>
        <span class="h-title">{{ data.label || t('canvas.nodeUi.viewport3d.defaultTitle') }}</span>
      </div>

      <div v-if="lodIsShell" class="canvas-node-lod-shell nodrag nopan">
        <el-icon class="canvas-node-lod-shell-icon"><Box /></el-icon>
        <div class="canvas-node-lod-shell-lines">
          <span class="canvas-node-lod-shell-title">{{ data.label || '三维视图' }}</span>
          <span class="canvas-node-lod-shell-sub">3D 视图</span>
        </div>
      </div>

      <template v-else>
      <div class="viewport3d-body">
        <div class="object-panel">
          <div class="panel-title">{{ t('canvas.nodeUi.viewport3d.objectList') }}</div>
          <label v-if="displayImageUrl" class="pano-bg-toggle nodrag nopan">
            <input type="checkbox" :checked="wantPanoBackground" @change="onPanoBackgroundChange" />
            <span>{{ t('canvas.nodeUi.viewport3d.panoBg') }}</span>
          </label>
          <div v-if="isFullscreen">
            <div class="category-grid">
              <button
                v-for="category in OBJECT_CATEGORIES"
                :key="category.id"
                type="button"
                class="category-btn"
                :class="{ active: activeCategoryId === category.id }"
                @click="selectCategory(category.id)"
              >
                {{ categoryDisplayName(category) }}
              </button>
            </div>
            <div v-if="activeSubCategories.length" class="sub-category-row">
              <button
                v-for="sub in activeSubCategories"
                :key="sub.id"
                type="button"
                class="sub-category-btn"
                :class="{ active: activeSubCategoryId === sub.id }"
                @click="selectSubCategory(sub.id)"
              >
                {{ sub.name }}
              </button>
            </div>
            <div class="preset-grid">
              <button
                v-for="preset in activePresets"
                :key="preset.id"
                type="button"
                class="preset-btn"
                @click="addObjectFromPreset(preset)"
              >
                {{ presetDisplayName(preset) }}
              </button>
            </div>
          </div>
          <div v-else class="preset-grid quick-person-grid">
            <button
              v-for="preset in personQuickPresets"
              :key="preset.id"
              type="button"
              class="preset-btn"
              @click="addObjectFromPreset(preset)"
            >
              {{ presetDisplayName(preset) }}
            </button>
          </div>
          <div class="obj-list">
            <button
              v-for="obj in objects"
              :key="obj.id"
              type="button"
              class="obj-item"
              :class="{ active: selectedObjectId === obj.id }"
              @click="selectedObjectId = obj.id"
            >
              <span class="dot" :style="{ backgroundColor: obj.color || '#7c6cff' }" />
              <span class="name">{{ objectRowDisplayName(obj) }}</span>
            </button>
          </div>
          <div v-if="selectedObject" class="obj-editor">
            <input class="name-input" :value="selectedObject.name" @input="updateSelectedObjectName(($event.target as HTMLInputElement).value)" />
            <div class="color-row">
              <span>{{ t('canvas.nodeUi.viewport3d.color') }}</span>
              <input type="color" :value="selectedObject.color || '#7c6cff'" @input="updateSelectedObjectColor(($event.target as HTMLInputElement).value)" />
            </div>
            <button type="button" class="panel-del" @click="removeSelectedObject">{{ t('canvas.nodeUi.viewport3d.deleteSelected') }}</button>
          </div>
        </div>

        <div class="viewport3d-viewer nodrag nopan" @pointerdown.stop>
          <div ref="viewerWrapRef" class="viewport3d-wrap">
            <div ref="containerRef" class="viewport3d-canvas" />
          </div>
          <div class="mode-bar" :class="{ fs: isFullscreen }" @click.stop>
            <button type="button" class="m-btn" :class="{ on: transformMode === 'translate', fs: isFullscreen }" @click="setTransformMode('translate')">{{ t('canvas.nodeUi.viewport3d.translate') }}</button>
            <button type="button" class="m-btn" :class="{ on: transformMode === 'rotate', fs: isFullscreen }" @click="setTransformMode('rotate')">{{ t('canvas.nodeUi.viewport3d.rotate') }}</button>
            <button type="button" class="m-btn" :class="{ on: transformMode === 'scale', fs: isFullscreen }" @click="setTransformMode('scale')">{{ t('canvas.nodeUi.viewport3d.scale') }}</button>
          </div>
          <div class="camera-bar" :class="{ fs: isFullscreen }" @click.stop>
            <button type="button" class="c-btn" :class="{ fs: isFullscreen }" @click="setCameraPreset('front')">{{ t('canvas.nodeUi.viewport3d.camFront') }}</button>
            <button type="button" class="c-btn" :class="{ fs: isFullscreen }" @click="setCameraPreset('back')">{{ t('canvas.nodeUi.viewport3d.camBack') }}</button>
            <button type="button" class="c-btn" :class="{ fs: isFullscreen }" @click="setCameraPreset('left')">{{ t('canvas.nodeUi.viewport3d.camLeft') }}</button>
            <button type="button" class="c-btn" :class="{ fs: isFullscreen }" @click="setCameraPreset('right')">{{ t('canvas.nodeUi.viewport3d.camRight') }}</button>
            <button type="button" class="c-btn" :class="{ fs: isFullscreen }" @click="setCameraPreset('iso')">ISO</button>
          </div>
          <div v-if="isFullscreen" class="viewport3d-fs-bar" @click.stop>
            <button type="button" class="bar-cta" @click="exportColorDepth">{{ t('canvas.nodeUi.viewport3d.exportView') }}</button>
            <button type="button" class="bar-cta" @click="resetCamera">{{ t('canvas.nodeUi.viewport3d.resetCamera') }}</button>
            <button type="button" class="bar-cta" @click="toggleFullscreen">{{ t('canvas.nodeUi.common.exitFullscreen') }}</button>
          </div>
          <div v-else class="viewport3d-ns-bar" @click.stop>
            <button type="button" class="f-btn" @click="exportColorDepth">
              <el-icon><Camera /></el-icon>
              {{ t('canvas.nodeUi.viewport3d.exportView') }}
            </button>
            <button type="button" class="f-btn" @click="toggleFullscreen">{{ t('canvas.nodeUi.common.fullscreen') }}</button>
            <button type="button" class="f-btn" @click="resetCamera">{{ t('canvas.nodeUi.viewport3d.resetCamera') }}</button>
          </div>
        </div>
      </div>
      </template>
    </div>

    <Handle
      type="source"
      :position="Position.Right"
      class="handle handle-source viewport3d-out-handle"
    />
  </div>
</template>

<style scoped>
.canvas-node-lod-shell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 200px;
  margin: 0 12px 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  background: rgba(10, 12, 22, 0.45);
  box-sizing: border-box;
}

.canvas-node-lod-shell-icon {
  font-size: 22px;
  color: rgba(180, 200, 255, 0.85);
  flex-shrink: 0;
}

.canvas-node-lod-shell-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.canvas-node-lod-shell-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(240, 244, 255, 0.95);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.canvas-node-lod-shell-sub {
  font-size: 11px;
  color: rgba(180, 192, 220, 0.75);
  line-height: 1.35;
}

.viewport3d-root {
  position: relative;
  width: 520px;
  box-sizing: border-box;
  overflow: visible;
  cursor: grab;
}

.viewport3d-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 360px;
  background: var(--bg-secondary, #1a1a2e);
  border: 2px solid var(--border-color, #3a3a4a);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.viewport3d-card:fullscreen {
  width: 100vw;
  height: 100vh;
  min-height: 100vh;
  border-radius: 0;
  border-width: 0;
}
.viewport3d-card:fullscreen .viewport3d-body {
  grid-template-columns: 280px 1fr;
  min-height: 0;
}
.viewport3d-card:fullscreen .viewport3d-viewer {
  min-height: 0;
}
.viewport3d-card.is-selected {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.4), 0 4px 14px rgba(64, 158, 255, 0.22);
}

.viewport3d-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  background: var(--bg-tertiary, #25253a);
  border-bottom: 1px solid var(--border-color, #3a3a4a);
}
.h-icon { color: #67c23a; }
.h-title { font-size: 14px; font-weight: 600; color: #fff; }

.viewport3d-body {
  display: grid;
  grid-template-columns: 120px 1fr;
  min-height: 300px;
  flex: 1;
}

.object-panel {
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.22);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.panel-title {
  font-size: 12px;
  color: #dce6ff;
  font-weight: 600;
}
.pano-bg-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #b8c9e8;
  cursor: pointer;
  user-select: none;
  margin-bottom: 2px;
}
.pano-bg-toggle input {
  accent-color: #409eff;
}
.category-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.category-btn,
.sub-category-btn,
.preset-btn {
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 6px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.32);
  color: #fff;
  cursor: pointer;
}
.category-btn.active,
.sub-category-btn.active {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.2);
}
.sub-category-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  max-height: 180px;
  overflow: auto;
}
.quick-person-grid {
  grid-template-columns: repeat(1, minmax(0, 1fr));
  max-height: none;
}
.panel-add,
.panel-del {
  border: none;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  cursor: pointer;
}
.panel-del { background: rgba(245, 108, 108, 0.3); }

.obj-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 170px;
  overflow: auto;
}
.obj-item {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: transparent;
  color: #fff;
  padding: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.obj-item.active {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.18);
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.name {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.obj-editor {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px dashed rgba(255, 255, 255, 0.15);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.name-input {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 6px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.28);
  color: #fff;
}
.color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
}

.viewport3d-viewer {
  position: relative;
  background: #13131b;
}
.viewport3d-wrap {
  position: absolute;
  inset: 0;
}
.viewport3d-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.mode-bar,
.camera-bar {
  position: absolute;
  z-index: 5;
  display: flex;
  gap: 6px;
}
.mode-bar { top: 8px; left: 8px; }
.camera-bar { top: 8px; right: 8px; }
.mode-bar.fs { top: 16px; left: 16px; }
.camera-bar.fs { top: 16px; right: 16px; }
.m-btn,
.c-btn {
  border: none;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.48);
  color: #fff;
  cursor: pointer;
}
.m-btn.fs,
.c-btn.fs {
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 14px;
}
.m-btn.on { background: #409eff; }
.viewport3d-fs-bar {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.58);
}
.viewport3d-ns-bar {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 6px;
}
.bar-cta {
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  color: #fff;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.16);
}

.viewport3d-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.35);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.left .tips {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}
.right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.f-btn {
  border: none;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.handle {
  z-index: 2;
  width: 10px !important;
  height: 10px !important;
  min-width: 10px;
  min-height: 10px;
  box-sizing: border-box;
  border-radius: 50% !important;
  background: #409eff !important;
  border: 2px solid #ffffff !important;
}
.handle-target { left: 0 !important; }
.handle-source { right: 0 !important; }
/** 输出桩对齐节点垂直中心，与右侧颜色/深度两节点整体中线一致 */
.viewport3d-out-handle {
  top: 50% !important;
  transform: translate(50%, -50%) !important;
}
</style>
