<template>
  <div class="characters-root">
    <div class="characters-container">
      <!-- Purple -->
      <div ref="purpleRef" class="char purple" :style="purpleStyle">
        <div class="eyes" :style="purpleEyesStyle">
          <LoginEyeBall
            v-for="i in 2"
            :key="'p' + i"
            :size="18"
            :pupil-size="7"
            :max-distance="5"
            eye-color="white"
            pupil-color="#2d2d2d"
            :is-blinking="isPurpleBlinking"
            :force-look-x="purpleLookX"
            :force-look-y="purpleLookY"
          />
        </div>
      </div>
      <!-- Black -->
      <div ref="blackRef" class="char black" :style="blackStyle">
        <div class="eyes" :style="blackEyesStyle">
          <LoginEyeBall
            v-for="i in 2"
            :key="'b' + i"
            :size="16"
            :pupil-size="6"
            :max-distance="4"
            eye-color="white"
            pupil-color="#2d2d2d"
            :is-blinking="isBlackBlinking"
            :force-look-x="blackLookX"
            :force-look-y="blackLookY"
          />
        </div>
      </div>
      <!-- Orange -->
      <div ref="orangeRef" class="char orange" :style="orangeStyle">
        <div class="eyes" :style="orangeEyesStyle">
          <LoginPupil
            v-for="i in 2"
            :key="'o' + i"
            :size="12"
            :max-distance="5"
            pupil-color="#2d2d2d"
            :force-look-x="hiding ? -5 : undefined"
            :force-look-y="hiding ? -4 : undefined"
          />
        </div>
      </div>
      <!-- Yellow -->
      <div ref="yellowRef" class="char yellow" :style="yellowStyle">
        <div class="eyes" :style="yellowEyesStyle">
          <LoginPupil
            v-for="i in 2"
            :key="'y' + i"
            :size="12"
            :max-distance="5"
            pupil-color="#2d2d2d"
            :force-look-x="hiding ? -5 : undefined"
            :force-look-y="hiding ? -4 : undefined"
          />
        </div>
        <div class="mouth" :style="yellowMouthStyle" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import LoginEyeBall from './LoginEyeBall.vue'
import LoginPupil from './LoginPupil.vue'

const props = withDefaults(
  defineProps<{
    /** 表单内有输入框聚焦（typing） */
    isTyping?: boolean
    /** 密码类字段是否有内容 */
    hasSecret?: boolean
    /** 密码是否明文可见 */
    secretVisible?: boolean
  }>(),
  {
    isTyping: false,
    hasSecret: false,
    secretVisible: false,
  },
)

const mouseX = ref(0)
const mouseY = ref(0)
const isPurpleBlinking = ref(false)
const isBlackBlinking = ref(false)
const isLookingAtEachOther = ref(false)
const isPurplePeeking = ref(false)

const purpleRef = ref<HTMLDivElement | null>(null)
const blackRef = ref<HTMLDivElement | null>(null)
const yellowRef = ref<HTMLDivElement | null>(null)
const orangeRef = ref<HTMLDivElement | null>(null)

const purplePos = reactive({ faceX: 0, faceY: 0, bodySkew: 0 })
const blackPos = reactive({ faceX: 0, faceY: 0, bodySkew: 0 })
const yellowPos = reactive({ faceX: 0, faceY: 0, bodySkew: 0 })
const orangePos = reactive({ faceX: 0, faceY: 0, bodySkew: 0 })

const hiding = computed(() => props.hasSecret && props.secretVisible)
const leaning = computed(() => props.isTyping || (props.hasSecret && !props.secretVisible))

function calcPos(el: HTMLDivElement | null, target: { faceX: number; faceY: number; bodySkew: number }) {
  if (!el) return
  const r = el.getBoundingClientRect()
  const dx = mouseX.value - (r.left + r.width / 2)
  const dy = mouseY.value - (r.top + r.height / 3)
  target.faceX = Math.max(-15, Math.min(15, dx / 20))
  target.faceY = Math.max(-10, Math.min(10, dy / 30))
  target.bodySkew = Math.max(-6, Math.min(6, -dx / 120))
}

let rafId = 0
function tick() {
  calcPos(purpleRef.value, purplePos)
  calcPos(blackRef.value, blackPos)
  calcPos(yellowRef.value, yellowPos)
  calcPos(orangeRef.value, orangePos)
  rafId = requestAnimationFrame(tick)
}

function onMouseMove(e: MouseEvent) {
  mouseX.value = e.clientX
  mouseY.value = e.clientY
}

function setupBlink(target: { value: boolean }) {
  let t = 0
  let cancelled = false
  const go = () => {
    if (cancelled) return
    t = window.setTimeout(() => {
      if (cancelled) return
      target.value = true
      window.setTimeout(() => {
        target.value = false
        go()
      }, 150)
    }, Math.random() * 4000 + 3000)
  }
  go()
  return () => {
    cancelled = true
    clearTimeout(t)
  }
}

let stopPurpleBlink: (() => void) | undefined
let stopBlackBlink: (() => void) | undefined

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove)
  stopPurpleBlink = setupBlink(isPurpleBlinking)
  stopBlackBlink = setupBlink(isBlackBlinking)
  rafId = requestAnimationFrame(tick)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  cancelAnimationFrame(rafId)
  stopPurpleBlink?.()
  stopBlackBlink?.()
})

watch(
  () => props.isTyping,
  (v) => {
    if (v) {
      isLookingAtEachOther.value = true
      window.setTimeout(() => {
        isLookingAtEachOther.value = false
      }, 800)
    } else {
      isLookingAtEachOther.value = false
    }
  },
)

let peekOpenT: number | undefined
let peekCloseT: number | undefined

watch(
  () => [props.hasSecret, props.secretVisible] as const,
  () => {
    if (peekOpenT) clearTimeout(peekOpenT)
    if (peekCloseT) clearTimeout(peekCloseT)
    isPurplePeeking.value = false
    if (props.hasSecret && props.secretVisible) {
      peekOpenT = window.setTimeout(() => {
        isPurplePeeking.value = true
        peekCloseT = window.setTimeout(() => {
          isPurplePeeking.value = false
        }, 800)
      }, Math.random() * 3000 + 2000)
    }
  },
)

const purpleStyle = computed(() => ({
  /* 原 400/440px 高于容器易被 .login-content overflow 裁切，整体缩小并入框 */
  height: leaning.value ? '336px' : '308px',
  transform: hiding.value
    ? 'skewX(0deg)'
    : leaning.value
      ? `skewX(${purplePos.bodySkew - 12}deg) translateX(28px)`
      : `skewX(${purplePos.bodySkew}deg)`,
}))

const purpleEyesStyle = computed(() => ({
  left: hiding.value ? '20px' : isLookingAtEachOther.value ? '55px' : `${45 + purplePos.faceX}px`,
  top: hiding.value ? '35px' : isLookingAtEachOther.value ? '65px' : `${40 + purplePos.faceY}px`,
  gap: '32px',
}))

const purpleLookX = computed(() =>
  hiding.value ? (isPurplePeeking.value ? 4 : -4) : isLookingAtEachOther.value ? 3 : undefined,
)
const purpleLookY = computed(() =>
  hiding.value ? (isPurplePeeking.value ? 5 : -4) : isLookingAtEachOther.value ? 4 : undefined,
)

const blackStyle = computed(() => ({
  transform: hiding.value
    ? 'skewX(0deg)'
    : isLookingAtEachOther.value
      ? `skewX(${blackPos.bodySkew * 1.5 + 10}deg) translateX(20px)`
      : leaning.value
        ? `skewX(${blackPos.bodySkew * 1.5}deg)`
        : `skewX(${blackPos.bodySkew}deg)`,
}))

const blackEyesStyle = computed(() => ({
  left: hiding.value ? '10px' : isLookingAtEachOther.value ? '32px' : `${26 + blackPos.faceX}px`,
  top: hiding.value ? '28px' : isLookingAtEachOther.value ? '12px' : `${32 + blackPos.faceY}px`,
  gap: '24px',
}))

const blackLookX = computed(() => (hiding.value ? -4 : isLookingAtEachOther.value ? 0 : undefined))
const blackLookY = computed(() => (hiding.value ? -4 : isLookingAtEachOther.value ? -4 : undefined))

const orangeStyle = computed(() => ({
  transform: hiding.value ? 'skewX(0deg)' : `skewX(${orangePos.bodySkew}deg)`,
}))

const orangeEyesStyle = computed(() => ({
  left: hiding.value ? '50px' : `${82 + orangePos.faceX}px`,
  top: hiding.value ? '85px' : `${90 + orangePos.faceY}px`,
  gap: '32px',
}))

const yellowStyle = computed(() => ({
  transform: hiding.value ? 'skewX(0deg)' : `skewX(${yellowPos.bodySkew}deg)`,
}))

const yellowEyesStyle = computed(() => ({
  left: hiding.value ? '20px' : `${52 + yellowPos.faceX}px`,
  top: hiding.value ? '35px' : `${40 + yellowPos.faceY}px`,
  gap: '24px',
}))

const yellowMouthStyle = computed(() => ({
  left: hiding.value ? '10px' : `${40 + yellowPos.faceX}px`,
  top: hiding.value ? '88px' : `${88 + yellowPos.faceY}px`,
}))
</script>

<style scoped>
.characters-root {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  min-height: 188px;
}

.characters-container {
  position: relative;
  width: min(100%, 400px);
  /* clamp 下限对齐紫色最高态，避免头顶被 .login-content overflow 裁掉 */
  height: clamp(336px, 36vh, 352px);
}

.char {
  position: absolute;
  bottom: 0;
  transition:
    transform 0.65s cubic-bezier(0.4, 0, 0.2, 1),
    height 0.65s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: bottom center;
}

.purple {
  left: clamp(24px, 7vw, 62px);
  width: clamp(128px, 30vw, 168px);
  background: #6c3ff5;
  border-radius: 10px 10px 0 0;
  z-index: 1;
}

.black {
  left: clamp(136px, 34vw, 220px);
  width: clamp(88px, 20vw, 112px);
  height: 252px;
  background: #2d2d2d;
  border-radius: 8px 8px 0 0;
  z-index: 2;
}

.orange {
  left: 0;
  width: clamp(176px, 40vw, 220px);
  height: 168px;
  background: #ff9b6b;
  border-radius: 120px 120px 0 0;
  z-index: 3;
}

.yellow {
  left: clamp(180px, 44vw, 310px);
  width: clamp(108px, 24vw, 128px);
  height: 198px;
  background: #e8d754;
  border-radius: 70px 70px 0 0;
  z-index: 4;
}

.eyes {
  position: absolute;
  display: flex;
  transition:
    left 0.65s cubic-bezier(0.4, 0, 0.2, 1),
    top 0.65s cubic-bezier(0.4, 0, 0.2, 1),
    gap 0.65s cubic-bezier(0.4, 0, 0.2, 1);
}

.mouth {
  position: absolute;
  width: 60px;
  height: 4px;
  background: #2d2d2d;
  border-radius: 4px;
  transition:
    left 0.65s cubic-bezier(0.4, 0, 0.2, 1),
    top 0.65s cubic-bezier(0.4, 0, 0.2, 1);
}

@media (max-width: 900px) {
  .characters-container {
    transform: scale(0.82);
    transform-origin: bottom center;
  }
}
</style>
