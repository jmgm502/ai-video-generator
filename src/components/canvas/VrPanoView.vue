<!-- Three.js 球幕全景（等距圆柱贴图）+ Orbit，与 8.gongzuoliu VR360 行为一致，便于在 Vue Flow 子树内与画布拖拽解耦 -->
<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import {
  BackSide,
  Color,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  WebGLRenderer
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const props = withDefaults(
  defineProps<{
    imageUrl: string | null
    autoRotate: boolean
    /** 透视 FOV，度 */
    cameraFov: number
  }>(),
  {
    imageUrl: null,
    autoRotate: false,
    cameraFov: 75
  }
)

const containerRef = ref<HTMLDivElement | null>(null)
const glCanvasRef = ref<HTMLCanvasElement | null>(null)

const scene = shallowRef<Scene | null>(null)
const camera = shallowRef<PerspectiveCamera | null>(null)
const renderer = shallowRef<WebGLRenderer | null>(null)
const controls = shallowRef<OrbitControls | null>(null)
const panoMesh = shallowRef<Mesh | null>(null)
const currentTexture = shallowRef<Texture | null>(null)

let rafId = 0
const loader = new TextureLoader()
loader.crossOrigin = 'anonymous'

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
  cam.fov = props.cameraFov
  cam.updateProjectionMatrix()
}

let resizeObs: ResizeObserver | null = null

function renderLoop() {
  rafId = requestAnimationFrame(renderLoop)
  if (!renderer.value || !scene.value || !camera.value) return
  if (panoMesh.value && props.autoRotate) {
    panoMesh.value.rotation.y += 0.002
  }
  if (controls.value) {
    controls.value.update()
  }
  renderer.value.render(scene.value, camera.value)
}

function disposeObject() {
  if (panoMesh.value) {
    const g = panoMesh.value.geometry
    const m = panoMesh.value.material
    g.dispose()
    if (Array.isArray(m)) m.forEach((x) => x.dispose())
    else m.dispose()
    panoMesh.value = null
  }
  if (currentTexture.value) {
    currentTexture.value.dispose()
    currentTexture.value = null
  }
}

function buildScene() {
  const el = containerRef.value
  if (!el) return

  disposeObject()

  const sc = new Scene()
  sc.background = new Color(0x000000)

  const cam = new PerspectiveCamera(props.cameraFov, 1, 0.1, 2000)
  cam.position.set(0, 0, 0.1)

  const gl = new WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true })
  gl.outputColorSpace = SRGBColorSpace
  el.appendChild(gl.domElement)
  glCanvasRef.value = gl.domElement
  gl.domElement.style.display = 'block'
  gl.domElement.style.width = '100%'
  gl.domElement.style.height = '100%'

  const oc = new OrbitControls(cam, gl.domElement)
  oc.enableZoom = false
  oc.enablePan = false
  oc.enableDamping = false
  oc.rotateSpeed = -0.3

  scene.value = sc
  camera.value = cam
  renderer.value = gl
  controls.value = oc

  if (props.imageUrl) {
    loadTextureToSphere(props.imageUrl, sc, cam, gl, oc)
  }
  setRendererSize()
  renderLoop()
}

function loadTextureToSphere(
  url: string,
  sc: Scene,
  cam: PerspectiveCamera,
  gl: WebGLRenderer,
  _oc: OrbitControls
) {
  loader.load(
    url,
    (tex) => {
        tex.minFilter = LinearFilter
        tex.magFilter = LinearFilter
      tex.colorSpace = SRGBColorSpace
      if (currentTexture.value) {
        currentTexture.value.dispose()
      }
      currentTexture.value = tex

      const old = sc.getObjectByName('pano-sphere') as Mesh | undefined
      if (old) {
        old.geometry.dispose()
        ;(old.material as MeshBasicMaterial).dispose()
        sc.remove(old)
      }

      const geom = new SphereGeometry(500, 60, 40)
      const mat = new MeshBasicMaterial({ map: tex, side: BackSide })
      const mesh = new Mesh(geom, mat)
      mesh.name = 'pano-sphere'
      mesh.scale.set(-1, 1, 1)
      sc.add(mesh)
      panoMesh.value = mesh
    },
    undefined,
    () => {
      /* 纹理失败时仅保留空场景 */
    }
  )
}

onMounted(() => {
  buildScene()
  resizeObs = new ResizeObserver(() => {
    setRendererSize()
  })
  if (containerRef.value) {
    resizeObs.observe(containerRef.value)
  }
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  resizeObs?.disconnect()
  resizeObs = null
  disposeObject()
  if (controls.value) {
    controls.value.dispose()
    controls.value = null
  }
  if (renderer.value) {
    if (containerRef.value && renderer.value.domElement.parentNode === containerRef.value) {
      containerRef.value.removeChild(renderer.value.domElement)
    }
    renderer.value.dispose()
    renderer.value = null
  }
  scene.value = null
  camera.value = null
  glCanvasRef.value = null
})

watch(
  () => props.imageUrl,
  (u) => {
    if (!scene.value || !camera.value || !renderer.value || !controls.value) return
    if (u) {
      loadTextureToSphere(u, scene.value, camera.value, renderer.value, controls.value)
    } else {
      disposeObject()
    }
  }
)

watch(
  () => props.cameraFov,
  (fov) => {
    const cam = camera.value
    if (cam) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
  }
)

defineExpose({
  getCanvas: () => glCanvasRef.value
})
</script>

<template>
  <div
    ref="containerRef"
    class="vr-pano-container nodrag nopan"
    @pointerdown.stop
    @wheel.stop
  />
</template>

<style scoped>
.vr-pano-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 200px;
  overflow: hidden;
  border-radius: 6px;
  background: #000;
}
</style>
