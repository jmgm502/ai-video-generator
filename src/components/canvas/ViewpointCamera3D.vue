<script setup lang="ts">
/**
 * 3D 视角控制器：与参考图一致
 * 粉色环+粉球-水平角；青色半圆轨迹+青球-俯仰；黄线+黄球+粉锥-距离/镜头
 * 白平面为图片导出区域
 */
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as THREE from 'three'

const props = withDefaults(
  defineProps<{
    /** 主图，贴到白平面；缺省为纯白 */
    imageUrl?: string | null
    /** 相机视角模式：从相机位置预览场景 */
    cameraView?: boolean
  }>(),
  { imageUrl: null, cameraView: false }
)

const horizontal = defineModel<number>('horizontal', { required: true })
const vertical = defineModel<number>('vertical', { required: true })
const zoom = defineModel<number>('zoom', { required: true })

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const COL = {
  pink: 0xff5ca8,
  cyan: 0x33ddff,
  yellow: 0xffdd33,
  floor: 0x2a2a32
} as const

const displayZoom = (z: number) => (1.0 + (z - 0.5) * 6.0).toFixed(1)

let renderer: THREE.WebGLRenderer
let scene: THREE.Scene
let viewCamera: THREE.PerspectiveCamera
let raf = 0
let resObs: ResizeObserver | null = null

const raycaster = new THREE.Raycaster()
const ndc = new THREE.Vector2()
let domRect = new DOMRect()

type DragMode = 'h' | 'v' | 'z' | null
let dragMode: DragMode = null
const planeForHorizontal = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08)
const target = new THREE.Vector3(0, 0.8, 0)

// gizmo 引用（更新用）
let meshPink: THREE.Mesh
let meshCyan: THREE.Mesh
let meshYellow: THREE.Mesh
let camGroup: THREE.Group
let lineZoom: THREE.Line
/** 俯仰用：在子午面内的半圆轨迹（与黄线/镜头轴分离） */
let lineCyanArc: THREE.Line
const vecTmp = new THREE.Vector3()
const rhArc = new THREE.Vector3()
const posVirtual = new THREE.Vector3()
const lineEnd = new THREE.Vector3()
const hRad = () => (horizontal.value * Math.PI) / 180
const eRad = () => (vertical.value * Math.PI) / 180

function zoomNum(): number {
  const z = Number(zoom.value)
  return Math.min(2, Math.max(0.5, Number.isFinite(z) ? z : 1))
}

/**
 * 3D 控制器内展示用机位：与粉环/青球同尺度（r≈1.4–2.2），
 * 避免黄线拉向远处导致粉锥出画、锥尖难辨。
 * （与 API 的提示词由父组件 yaw/pitch/zoom 描述，不依赖此世界坐标。）
 */
function getGizmoCameraPos(out: THREE.Vector3) {
  const r = 1.4 + (zoomNum() - 0.5) * 0.55
  const th = hRad()
  const ph = eRad()
  out.set(
    r * Math.cos(ph) * Math.sin(th),
    r * Math.sin(ph) + 0.8,
    r * Math.cos(ph) * Math.cos(th)
  )
  return out
}

function rHatY(out: THREE.Vector3) {
  const th = hRad()
  out.set(Math.sin(th), 0, Math.cos(th))
}

function setPointer(e: PointerEvent) {
  const w = domRect.width || 1
  const h = domRect.height || 1
  ndc.x = ((e.clientX - domRect.left) / w) * 2 - 1
  ndc.y = -((e.clientY - domRect.top) / h) * 2 + 1
}

function pickDragMode(e: PointerEvent): DragMode {
  if (!meshPink || !meshCyan || !meshYellow) return null
  setPointer(e)
  raycaster.setFromCamera(ndc, viewCamera)
  const hits = raycaster.intersectObjects([meshPink, meshCyan, meshYellow], false)
  if (hits.length === 0) return null
  const o = hits[0].object
  if (o === meshPink) return 'h'
  if (o === meshCyan) return 'v'
  if (o === meshYellow) return 'z'
  return null
}

const hitPlaneV = new THREE.Plane()
const linePt = new THREE.Vector3()
const toPlane = new THREE.Vector3()
const oCenter = new THREE.Vector3(0, 0.8, 0)
const rhDrag = new THREE.Vector3()
const nMeridian = new THREE.Vector3()
const quatCone = new THREE.Quaternion()
const yAxis = new THREE.Vector3(0, 1, 0)
const zoomSegStart = new THREE.Vector3()
const zoomSegEnd = new THREE.Vector3()
const closestPointOnRay = new THREE.Vector3()
const closestPointOnSeg = new THREE.Vector3()
const zoomSegDir = new THREE.Vector3()
const zoomSegToPoint = new THREE.Vector3()

function onPointerMoveHV(e: PointerEvent) {
  if (dragMode === null) return
  setPointer(e)
  raycaster.setFromCamera(ndc, viewCamera)

  if (dragMode === 'h') {
    const hit = new THREE.Vector3()
    if (raycaster.ray.intersectPlane(planeForHorizontal, hit)) {
      const ang = (Math.atan2(hit.x, hit.z) * 180) / Math.PI
      const h = ((ang % 360) + 360) % 360
      horizontal.value = h
    }
  } else if (dragMode === 'v') {
    const th = hRad()
    rhDrag.set(Math.sin(th), 0, Math.cos(th))
    nMeridian.crossVectors(rhDrag, yAxis).normalize()
    if (nMeridian.lengthSq() < 0.0001) nMeridian.set(1, 0, 0)
    hitPlaneV.setFromNormalAndCoplanarPoint(nMeridian, oCenter)
    if (raycaster.ray.intersectPlane(hitPlaneV, linePt)) {
      toPlane.copy(linePt).sub(oCenter)
      const xAlong = toPlane.dot(rhDrag)
      const yAlong = toPlane.y
      const e = Math.atan2(yAlong, xAlong)
      const vDeg = Math.max(-90, Math.min(90, (e * 180) / Math.PI))
      vertical.value = vDeg
    }
  }
}

function onPointerMoveZ(e: PointerEvent) {
  if (dragMode !== 'z') return
  // 距离控制改为沿黄线段（始末点）投影，而不是按屏幕上下位移。
  setPointer(e)
  raycaster.setFromCamera(ndc, viewCamera)

  getGizmoCameraPos(posVirtual)
  zoomSegStart.copy(target)
  zoomSegEnd.copy(posVirtual).lerp(target, 0.18)

  raycaster.ray.distanceSqToSegment(
    zoomSegStart,
    zoomSegEnd,
    closestPointOnRay,
    closestPointOnSeg
  )

  zoomSegDir.subVectors(zoomSegEnd, zoomSegStart)
  const segLenSq = zoomSegDir.lengthSq()
  if (segLenSq < 1e-8) return

  zoomSegToPoint.subVectors(closestPointOnSeg, zoomSegStart)
  const t = THREE.MathUtils.clamp(zoomSegToPoint.dot(zoomSegDir) / segLenSq, 0, 1)
  zoom.value = 0.5 + t * 1.5
}

function onWindowPointerMove(e: PointerEvent) {
  if (dragMode === null) return
  if (dragMode === 'h' || dragMode === 'v') onPointerMoveHV(e)
  else onPointerMoveZ(e)
}

function onPointerDown(e: PointerEvent) {
  if (!canvasRef.value) return
  domRect = canvasRef.value.getBoundingClientRect()
  const mode = pickDragMode(e)
  if (!mode) return
  dragMode = mode
  canvasRef.value.setPointerCapture(e.pointerId)
  if (mode === 'h' || mode === 'v') onPointerMoveHV(e)
  else onPointerMoveZ(e)
}

function onPointerUp(e: PointerEvent) {
  if (canvasRef.value?.hasPointerCapture(e.pointerId)) {
    canvasRef.value.releasePointerCapture(e.pointerId)
  }
  dragMode = null
}

function buildScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x14141c)
  const amb = new THREE.AmbientLight(0xffffff, 0.55)
  scene.add(amb)
  const d1 = new THREE.DirectionalLight(0xffffff, 0.85)
  d1.position.set(4, 10, 6)
  scene.add(d1)
  const d2 = new THREE.DirectionalLight(0x8899ff, 0.25)
  d2.position.set(-6, 4, -2)
  scene.add(d2)

  const grid = new THREE.GridHelper(14, 28, 0x4a4a55, 0x32323a)
  grid.position.y = 0
  scene.add(grid)

  // 白平面 = 导出的图（法线朝 +Z，相机从 +Z 前方向内看？这里固定从斜上方看，平面 XY 竖立，法线 +Z）
  const w = 1.15
  const h = 1.5
  const planeGeo = new THREE.PlaneGeometry(w, h)
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf5f5f5,
    roughness: 0.45,
    metalness: 0.05
  })
  const plane = new THREE.Mesh(planeGeo, whiteMat)
  plane.position.set(0, 0.8, 0)
  scene.add(plane)

  // 粉环
  const torus = new THREE.TorusGeometry(1.25, 0.025, 10, 64)
  const torMat = new THREE.MeshStandardMaterial({ color: COL.pink, emissive: 0x220011, emissiveIntensity: 0.4 })
  const ring = new THREE.Mesh(torus, torMat)
  ring.rotation.x = Math.PI / 2
  ring.position.set(0, 0.06, 0)
  scene.add(ring)

  const spGeo = new THREE.SphereGeometry(0.12, 20, 20)
  meshPink = new THREE.Mesh(
    spGeo,
    new THREE.MeshStandardMaterial({ color: COL.pink, emissive: 0x330022, emissiveIntensity: 0.35 })
  )
  meshCyan = new THREE.Mesh(
    spGeo,
    new THREE.MeshStandardMaterial({ color: COL.cyan, emissive: 0x002233, emissiveIntensity: 0.35 })
  )
  meshYellow = new THREE.Mesh(
    spGeo,
    new THREE.MeshStandardMaterial({ color: COL.yellow, emissive: 0x332200, emissiveIntensity: 0.35 })
  )
  scene.add(meshPink, meshCyan, meshYellow)

  camGroup = new THREE.Group()

  // 相机机身（长方体）
  const bodyGeo = new THREE.BoxGeometry(0.35, 0.25, 0.18)
  const bodyMat = new THREE.MeshStandardMaterial({ color: COL.pink, emissive: 0x220011, emissiveIntensity: 0.25 })
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat)
  camGroup.add(bodyMesh)

  // 相机镜头（圆柱体，朝向目标）
  const lensGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.15, 16)
  const lensMat = new THREE.MeshStandardMaterial({ color: 0xcc4488, emissive: 0x220011, emissiveIntensity: 0.25 })
  const lensMesh = new THREE.Mesh(lensGeo, lensMat)
  lensMesh.rotation.x = Math.PI / 2
  lensMesh.position.z = -0.15
  camGroup.add(lensMesh)

  // 相机顶部小凸起（取景器/闪光灯）
  const topGeo = new THREE.BoxGeometry(0.12, 0.08, 0.12)
  const topMesh = new THREE.Mesh(topGeo, bodyMat.clone())
  topMesh.position.y = 0.16
  camGroup.add(topMesh)

  scene.add(camGroup)

  const zLine = new Float32Array(6)
  const zBuf = new THREE.BufferAttribute(zLine, 3)
  const zGeo = new THREE.BufferGeometry()
  zGeo.setAttribute('position', zBuf)
  zGeo.setDrawRange(0, 2)
  const zMat = new THREE.LineBasicMaterial({ color: COL.yellow, linewidth: 1 })
  lineZoom = new THREE.Line(zGeo, zMat)
  scene.add(lineZoom)

  const ARC_SEG = 40
  const arcGeo = new THREE.BufferGeometry()
  const arcPos = new Float32Array((ARC_SEG + 1) * 3)
  arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPos, 3))
  const arcMat = new THREE.LineBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.85 })
  lineCyanArc = new THREE.Line(arcGeo, arcMat)
  scene.add(lineCyanArc)

  return { plane, whiteMat }
}

let planeMesh: THREE.Mesh
let imageMat: THREE.MeshStandardMaterial

function updateGizmo() {
  const h = hRad()
  const e = eRad()
  const ce = Math.cos(e)
  const se = Math.sin(e)
  meshPink.position.set(1.25 * Math.sin(h), 0.08, 1.25 * Math.cos(h))

  rHatY(rhArc)
  const Rarc = 1.1
  // 青色半圆：在子午面（水平径向 r_hat 与世界 Y 张成）内，与黄线/镜头轴分离
  const posArc = lineCyanArc.geometry.attributes.position as THREE.BufferAttribute
  const ARC_SEG = 40
  for (let i = 0; i <= ARC_SEG; i++) {
    const t = (i / ARC_SEG) * Math.PI - Math.PI / 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    const px = target.x + Rarc * (c * rhArc.x)
    const py = target.y + Rarc * s
    const pz = target.z + Rarc * (c * rhArc.z)
    posArc.setXYZ(i, px, py, pz)
  }
  posArc.needsUpdate = true
  lineCyanArc.geometry.boundingSphere = null

  // 青球在俯仰半圆上，角度即当前垂直角 e（与黄线、粉锥无强制共线）
  meshCyan.position.set(
    target.x + Rarc * ce * rhArc.x,
    target.y + Rarc * se,
    target.z + Rarc * ce * rhArc.z
  )

  getGizmoCameraPos(posVirtual)

  const t = 0.32 + (zoomNum() - 0.5) * 0.45
  meshYellow.position.lerpVectors(target, posVirtual, t)

  camGroup.position.copy(posVirtual)
  vecTmp.subVectors(target, posVirtual)
  if (vecTmp.lengthSq() > 0.0001) {
    vecTmp.normalize()
    quatCone.setFromUnitVectors(yAxis, vecTmp)
    camGroup.setRotationFromQuaternion(quatCone)
  }

  // 黄线略短于到锥体根部，避免遮住锥尖
  lineEnd.copy(posVirtual).lerp(target, 0.18)
  const posArr = lineZoom.geometry.attributes.position as THREE.BufferAttribute
  posArr.setXYZ(0, target.x, target.y, target.z)
  posArr.setXYZ(1, lineEnd.x, lineEnd.y, lineEnd.z)
  posArr.needsUpdate = true
  lineZoom.geometry.boundingSphere = null
}

let tex: THREE.Texture | null = null

function applyImageTexture() {
  if (!planeMesh || !imageMat) return
  const u = props.imageUrl
  if (!u) {
    if (tex) {
      tex.dispose()
      tex = null
    }
    imageMat.map = null
    imageMat.color.setHex(0xf5f5f5)
    imageMat.needsUpdate = true
    return
  }
  new THREE.TextureLoader().load(
    u,
    t => {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      if (tex) tex.dispose()
      tex = t
      imageMat.map = t
      imageMat.color.setHex(0xffffff)
      imageMat.needsUpdate = true
    },
    undefined,
    () => {
      imageMat.map = null
      imageMat.color.setHex(0xf5f5f5)
      imageMat.needsUpdate = true
    }
  )
}

function tick() {
  raf = requestAnimationFrame(tick)
  updateGizmo()
  if (renderer && viewCamera) renderer.render(scene, viewCamera)
}

function handleResize() {
  const el = containerRef.value
  if (!el || !renderer || !viewCamera) return
  const w = el.clientWidth
  const h = Math.max(2, Math.round(w / 2))
  if (w < 4) return
  const pr = Math.min(window.devicePixelRatio, 2)
  renderer.setSize(w, h, false)
  renderer.setPixelRatio(pr)
  viewCamera.aspect = w / h
  viewCamera.updateProjectionMatrix()
}

onMounted(() => {
  const { plane, whiteMat: wm } = buildScene()
  planeMesh = plane
  imageMat = wm
  const canvas = canvasRef.value!
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  viewCamera = new THREE.PerspectiveCamera(36, 2, 0.1, 80)
  viewCamera.position.set(3.6, 2.5, 4.0)
  viewCamera.lookAt(0.1, 0.65, 0)

  containerRef.value && (domRect = containerRef.value.getBoundingClientRect())
  handleResize()
  resObs = new ResizeObserver(() => handleResize())
  if (containerRef.value) resObs.observe(containerRef.value)
  updateGizmo()
  applyImageTexture()
  tick()
  canvas.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', onPointerUp)
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  resObs?.disconnect()
  const c = canvasRef.value
  if (c) {
    c.removeEventListener('pointerdown', onPointerDown)
  }
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  if (tex) {
    tex.dispose()
    tex = null
  }
  renderer?.dispose()
  lineZoom?.geometry?.dispose()
  const lmat = lineZoom?.material
  if (lmat && !Array.isArray(lmat)) lmat.dispose()
  lineCyanArc?.geometry?.dispose()
  const cmat = lineCyanArc?.material
  if (cmat && !Array.isArray(cmat)) cmat.dispose()
  scene?.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose()
      const m = obj.material
      if (Array.isArray(m)) m.forEach(x => x.dispose())
      else m?.dispose()
    }
  })
})

watch(
  () => props.imageUrl,
  () => applyImageTexture()
)

// 相机视角模式：根据 cameraView 属性切换观察视角
watch(
  () => props.cameraView,
  (isCameraView) => {
    if (!viewCamera) return
    if (isCameraView) {
      // 从相机位置观察场景
      getGizmoCameraPos(viewCamera.position)
      viewCamera.lookAt(target)
    } else {
      // 恢复到默认观察位置
      viewCamera.position.set(3.6, 2.5, 4.0)
      viewCamera.lookAt(0.1, 0.65, 0)
    }
  }
)
</script>

<template>
  <div ref="containerRef" class="viewpoint-cam-3d">
    <div class="v3d-legend" aria-hidden="true">
      <span class="leg-item"><i class="dot dot-pk" />粉色球-水平角度</span>
      <span class="leg-item"><i class="dot dot-cy" />青色球-垂直角度</span>
      <span class="leg-item"><i class="dot dot-yl" />黄色球-缩放距离</span>
    </div>
    <canvas ref="canvasRef" class="v3d-canvas" />
    <div class="v3d-readout">
      <span class="ro ro-h">水平 {{ Math.round(horizontal) }}°</span>
      <span class="ro ro-v">垂直 {{ Math.round(vertical) }}°</span>
      <span class="ro ro-z">距离 {{ displayZoom(zoomNum()) }}</span>
    </div>
  </div>
</template>

<style scoped>
.viewpoint-cam-3d {
  position: relative;
  width: 100%;
  /* 高度 = 宽度的一半 */
  aspect-ratio: 5 / 3;
  max-width: 100%;
  min-height: 0;
  border-radius: 8px;
  overflow: hidden;
  background: #14141c;
  border: 1px solid rgba(255, 255, 255, 0.1);
  user-select: none;
}

.v3d-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: grab;
}
.v3d-canvas:active {
  cursor: grabbing;
}

.v3d-legend {
  position: absolute;
  top: 8px;
  left: 10px;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  pointer-events: none;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
}
.leg-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.dot-pk {
  background: #ff5ca8;
  box-shadow: 0 0 6px #ff5ca8;
}
.dot-cy {
  background: #33ddff;
  box-shadow: 0 0 6px #33ddff;
}
.dot-yl {
  background: #ffdd33;
  box-shadow: 0 0 6px #ffdd33;
}

.v3d-readout {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 16px 24px;
  padding: 8px 10px 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.45));
  pointer-events: none;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}
.ro-h {
  color: #ff6eb3;
}
.ro-v {
  color: #44eeff;
}
.ro-z {
  color: #ffe055;
}
</style>
