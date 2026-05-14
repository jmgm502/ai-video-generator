import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import { useUserStore } from '@/stores/userStore'
import { resolveArtStyleDescriptionGlobal, resolveArtStyleLabelGlobal } from '@/utils/artStyleLocale'

export interface ArtStyle {
  value: string
  label: string
  description: string
  /** 内置：展示与提示词走 locale `canvas.artStyles.presets.{value}` */
  preset?: boolean
}

const defaultStyles: ArtStyle[] = [
  { value: 'none', label: '无风格', description: '', preset: true },
  { value: 'urban-korean', label: '都市韩漫', description: '都市韩漫风格，韩式精致五官，流畅韩漫线条，都市潮流穿搭质感，韩式细腻面部刻画，高饱和低对比色彩，韩漫经典人物比例', preset: true },
  { value: '3dcg-guoman', label: '3DCG国漫', description: '3DCG国漫风格，国风3D建模渲染，东方传统面部审美，国风服饰纹理精准，中式光影层次，国漫经典人物建模比例，PBR材质质感', preset: true },
  { value: '3d-cyberpunk', label: '3D赛博朋克', description: '3D赛博朋克风格，赛博朋克3D建模，霓虹灯光材质反射，赛博改造配饰细节，未来都市人物质感，金属塑料材质渲染，暗调霓虹色彩体系', preset: true },
  { value: 'pixar', label: '皮克斯', description: '皮克斯3D动画风格，皮克斯经典卡通建模，圆润人物轮廓，柔光卡通光影，高饱和明亮色彩，细腻皮肤质感，皮克斯标志性萌系五官', preset: true },
  { value: 'shadow-puppet', label: '皮影风', description: '传统皮影风，皮影镂空雕刻质感，非遗皮影线条，红黑金棕经典皮影配色，皮影人物剪影轮廓，牛皮皮影材质纹理，中式对称皮影设计', preset: true },
  { value: 'disney-3d', label: '迪士尼3D', description: '迪士尼3D动画风格，迪士尼经典卡通人物建模，精致面部渲染，蓬松毛发，顺滑布料质感，梦幻柔光光影，高饱和清新色彩，迪士尼黄金比例', preset: true },
  { value: 'american-comic', label: '美漫', description: '美式超级英雄漫画风格，硬朗粗线条美漫线条，肌肉感人物轮廓，高对比强明暗，撞色色彩体系，美漫经典网点纸质感，夸张立体五官', preset: true },
  { value: 'pencil-line', label: '钢笔线条', description: '钢笔纯线条风格，写实钢笔硬线条，细腻排线纹理，黑白单色，钢笔速写质感，线条疏密分层，精准人物轮廓，无色彩无渐变', preset: true },
  { value: 'ghibli', label: '宫崎骏', description: '宫崎骏手绘动漫风格，吉卜力经典手绘笔触，柔和水彩质感，自然清新色彩，圆润治愈人物轮廓，日式田园奇幻人物特征，手绘线条自然流畅', preset: true },
  { value: 'anime', label: '日漫', description: '经典日系动漫风格，日式二次元手绘线条，大眼萌系五官，日式平涂色彩，柔和阴影层次，日漫经典7头身比例，二次元发丝纹理渲染', preset: true },
  { value: 'q-version-handdrawn', label: 'Q版手绘', description: 'Q版手绘风格，手绘软糯线条，Q版2/3头身比例，大圆脸萌系五官，简化肢体轮廓，马卡龙柔和色彩，手绘涂鸦质感，细节简约造型可爱', preset: true },
  { value: 'printmaking', label: '版画', description: '经典版画风格，版画凹凸肌理质感，套色版画色彩，硬朗块面线条，极简造型刻画，版画经典撞色，无渐变平涂块面', preset: true },
  { value: 'american-comedy-cartoon', label: '美式喜剧动漫', description: '美式喜剧动漫风格，美式卡通夸张造型，简化五官突出表情，流畅粗黑轮廓线，高饱和明快平涂色彩，夸张肢体比例，喜剧感人物动态', preset: true },
  { value: 'anime-painting', label: '动漫彩绘', description: '动漫彩绘风格，二次元彩绘质感，高透水彩彩绘，细腻色彩晕染，精致二次元五官，渐变发丝纹理，彩绘通透色彩体系，手绘彩绘笔触', preset: true },
  { value: 'q-version-3d', label: 'Q版3D', description: 'Q版3D风格，Q版3D萌系建模，圆润无棱角轮廓，大头小身3头身比例，萌系简化五官，柔光3D渲染，马卡龙低饱和色彩，卡通化材质纹理', preset: true },
  { value: 'cinematic-portrait', label: '电影写真', description: '电影级写真风格，胶片质感成像，电影叙事性光影，胶片颗粒感细腻均匀，电影色调调色体系，五官立体通透发丝纹理清晰有层次，贴合人物气质的妆容自然服帖，简约质感服饰布料纹理真实', preset: true },
  { value: 'shinkai', label: '新海诚', description: '新海诚动漫风格，新海诚式精致写实五官，通透光影色彩，细腻发丝纹理皮肤质感，日系清新冷调色彩，光影渐变层次丰富，新海诚经典写实二次元比例', preset: true },
]

export const useArtStyleStore = defineStore(
  'artStyle',
  () => {
    const userStore = useUserStore()
    const selectedStyle = ref('urban-korean')
    const customStyles = ref<ArtStyle[]>([])

    const artStyles = computed(() => {
      const noneStyle = defaultStyles.find(s => s.value === 'none')
      const otherDefaults = defaultStyles.filter(s => s.value !== 'none')
      return noneStyle ? [noneStyle, ...customStyles.value, ...otherDefaults] : [...customStyles.value, ...defaultStyles]
    })

    const nonePreset = defaultStyles.find((s) => s.value === 'none')!

    const selectedStyleLabel = computed(() => {
      void userStore.appLocale
      const style = artStyles.value.find(s => s.value === selectedStyle.value)
      return style ? resolveArtStyleLabelGlobal(style) : resolveArtStyleLabelGlobal(nonePreset)
    })

    const selectedStyleDescription = computed(() => {
      void userStore.appLocale
      const style = artStyles.value.find(s => s.value === selectedStyle.value)
      return style && style.value !== 'none' ? resolveArtStyleDescriptionGlobal(style) : ''
    })

    const selectedStyleFullText = computed(() => {
      void userStore.appLocale
      const style = artStyles.value.find(s => s.value === selectedStyle.value)
      if (!style || style.value === 'none') return ''
      const label = resolveArtStyleLabelGlobal(style)
      const desc = resolveArtStyleDescriptionGlobal(style)
      return desc.trim().length > 0 ? `${label}，${desc}` : label
    })

    function setSelectedStyle(style: string) {
      selectedStyle.value = style
    }

    function addStyle(style: ArtStyle) {
      const v = String(style.value ?? '').trim().toLowerCase().replace(/\s+/g, '-')
      const normalized: ArtStyle = {
        value: v,
        label: style.label,
        description: style.description ?? ''
      }
      const exists = artStyles.value.some((s) => {
        const sv = String(s.value ?? '').trim().toLowerCase().replace(/\s+/g, '-')
        return sv === normalized.value
      })
      if (exists) {
        return false
      }
      customStyles.value.unshift(normalized)
      return true
    }

    function removeStyle(value: string) {
      const key = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '-')
      const index = customStyles.value.findIndex((s) => {
        const sv = String(s.value ?? '').trim().toLowerCase().replace(/\s+/g, '-')
        return sv === key
      })
      if (index > -1) {
        customStyles.value.splice(index, 1)
        return true
      }
      return false
    }

    return {
      selectedStyle,
      artStyles,
      customStyles,
      selectedStyleLabel,
      selectedStyleDescription,
      selectedStyleFullText,
      setSelectedStyle,
      addStyle,
      removeStyle,
    }
  },
  {
    persist: {
      key: 'art-style-store',
      paths: ['selectedStyle', 'customStyles'],
      storage: {
        getItem: (key) => {
          if (window.electronAPI?.storeSync) {
            return window.electronAPI.storeSync.get(key)
          }
          return localStorage.getItem(key)
        },
        setItem: (key, value) => {
          if (window.electronAPI?.storeSync) {
            window.electronAPI.storeSync.set(key, value)
          } else {
            localStorage.setItem(key, value)
          }
        },
      },
    },
  }
)
