/** 画布 / 步骤页 内置画面风格：内置项在 store 中带 preset: true，展示与提示词前缀走 i18n */

export const canvasArtStylePresetsZh = {
  none: {
    label: '无风格',
    desc: ''
  },
  'urban-korean': {
    label: '都市韩漫',
    desc: '都市韩漫风格，韩式精致五官，流畅韩漫线条，都市潮流穿搭质感，韩式细腻面部刻画，高饱和低对比色彩，韩漫经典人物比例'
  },
  '3dcg-guoman': {
    label: '3DCG国漫',
    desc: '3DCG国漫风格，国风3D建模渲染，东方传统面部审美，国风服饰纹理精准，中式光影层次，国漫经典人物建模比例，PBR材质质感'
  },
  '3d-cyberpunk': {
    label: '3D赛博朋克',
    desc: '3D赛博朋克风格，赛博朋克3D建模，霓虹灯光材质反射，赛博改造配饰细节，未来都市人物质感，金属塑料材质渲染，暗调霓虹色彩体系'
  },
  pixar: {
    label: '皮克斯',
    desc: '皮克斯3D动画风格，皮克斯经典卡通建模，圆润人物轮廓，柔光卡通光影，高饱和明亮色彩，细腻皮肤质感，皮克斯标志性萌系五官'
  },
  'shadow-puppet': {
    label: '皮影风',
    desc: '传统皮影风，皮影镂空雕刻质感，非遗皮影线条，红黑金棕经典皮影配色，皮影人物剪影轮廓，牛皮皮影材质纹理，中式对称皮影设计'
  },
  'disney-3d': {
    label: '迪士尼3D',
    desc: '迪士尼3D动画风格，迪士尼经典卡通人物建模，精致面部渲染，蓬松毛发，顺滑布料质感，梦幻柔光光影，高饱和清新色彩，迪士尼黄金比例'
  },
  'american-comic': {
    label: '美漫',
    desc: '美式超级英雄漫画风格，硬朗粗线条美漫线条，肌肉感人物轮廓，高对比强明暗，撞色色彩体系，美漫经典网点纸质感，夸张立体五官'
  },
  'pencil-line': {
    label: '钢笔线条',
    desc: '钢笔纯线条风格，写实钢笔硬线条，细腻排线纹理，黑白单色，钢笔速写质感，线条疏密分层，精准人物轮廓，无色彩无渐变'
  },
  ghibli: {
    label: '宫崎骏',
    desc: '宫崎骏手绘动漫风格，吉卜力经典手绘笔触，柔和水彩质感，自然清新色彩，圆润治愈人物轮廓，日式田园奇幻人物特征，手绘线条自然流畅'
  },
  anime: {
    label: '日漫',
    desc: '经典日系动漫风格，日式二次元手绘线条，大眼萌系五官，日式平涂色彩，柔和阴影层次，日漫经典7头身比例，二次元发丝纹理渲染'
  },
  'q-version-handdrawn': {
    label: 'Q版手绘',
    desc: 'Q版手绘风格，手绘软糯线条，Q版2/3头身比例，大圆脸萌系五官，简化肢体轮廓，马卡龙柔和色彩，手绘涂鸦质感，细节简约造型可爱'
  },
  printmaking: {
    label: '版画',
    desc: '经典版画风格，版画凹凸肌理质感，套色版画色彩，硬朗块面线条，极简造型刻画，版画经典撞色，无渐变平涂块面'
  },
  'american-comedy-cartoon': {
    label: '美式喜剧动漫',
    desc: '美式喜剧动漫风格，美式卡通夸张造型，简化五官突出表情，流畅粗黑轮廓线，高饱和明快平涂色彩，夸张肢体比例，喜剧感人物动态'
  },
  'anime-painting': {
    label: '动漫彩绘',
    desc: '动漫彩绘风格，二次元彩绘质感，高透水彩彩绘，细腻色彩晕染，精致二次元五官，渐变发丝纹理，彩绘通透色彩体系，手绘彩绘笔触'
  },
  'q-version-3d': {
    label: 'Q版3D',
    desc: 'Q版3D风格，Q版3D萌系建模，圆润无棱角轮廓，大头小身3头身比例，萌系简化五官，柔光3D渲染，马卡龙低饱和色彩，卡通化材质纹理'
  },
  'cinematic-portrait': {
    label: '电影写真',
    desc: '电影级写真风格，胶片质感成像，电影叙事性光影，胶片颗粒感细腻均匀，电影色调调色体系，五官立体通透发丝纹理清晰有层次，贴合人物气质的妆容自然服帖，简约质感服饰布料纹理真实'
  },
  shinkai: {
    label: '新海诚',
    desc: '新海诚动漫风格，新海诚式精致写实五官，通透光影色彩，细腻发丝纹理皮肤质感，日系清新冷调色彩，光影渐变层次丰富，新海诚经典写实二次元比例'
  }
} as const

export const canvasArtStylePresetsEn = {
  none: {
    label: 'No preset',
    desc: ''
  },
  'urban-korean': {
    label: 'Urban webtoon',
    desc: 'Urban Korean webtoon: refined features, clean manhwa linework, trendy street fashion, soft facial rendering, high-saturation low-contrast palette, classic manhwa proportions'
  },
  '3dcg-guoman': {
    label: '3D Chinese animation',
    desc: 'Chinese 3DCG style: cultural 3D shading, East Asian facial ideals, detailed traditional costume fabrics, layered Chinese lighting, anime-grade PBR surfaces'
  },
  '3d-cyberpunk': {
    label: '3D cyberpunk',
    desc: '3D cyberpunk: neon material reflections, augmentation props, futuristic skin and clothing, metallic and plastic shaders, dark base with neon accents'
  },
  pixar: {
    label: 'Pixar-like 3D',
    desc: 'Pixar-style 3D: rounded forms, soft cartoon lighting, bright saturated palette, supple skin shading, hallmark cute expressive eyes'
  },
  'shadow-puppet': {
    label: 'Shadow puppet',
    desc: 'Traditional leather silhouette puppet: carved cutout planes, opera red/gold/black palette, flat symmetrical Chinese silhouettes, parchment-like texture'
  },
  'disney-3d': {
    label: 'Disney-like 3D',
    desc: 'Disney-inspired 3D: expressive rigs, silky hair grooming, dreamy rim light, saturated fresh colors, heroic golden-ratio proportions'
  },
  'american-comic': {
    label: 'American comic',
    desc: 'Superhero comics: bold inked contours, muscular silhouettes, high-contrast shading, punchy complements, halftone texture, exaggerated facial planes'
  },
  'pencil-line': {
    label: 'Pen line art',
    desc: 'Pen-only monochrome: realistic hard strokes, cross-hatching, no color or gradients, sketchbook pacing, razor-sharp outlines'
  },
  ghibli: {
    label: 'Ghibli-esque',
    desc: 'Hand-painted look inspired by Studio Ghibli: soft watercolor washes, pastoral palette, rounded gentle characters, organic linework'
  },
  anime: {
    label: 'Japanese anime',
    desc: 'Classic 2D anime: cel shading, expressive eyes, 7-head-tall proportions, pastel shadows, glossy hair highlights'
  },
  'q-version-handdrawn': {
    label: 'Chibi hand-drawn',
    desc: 'Chibi illustration: plush linework, 2–3 head-tall proportions, oversized round faces, candy colors, doodle softness'
  },
  printmaking: {
    label: 'Printmaking',
    desc: 'Relief-print texture with flat color blocks: carved edges, layered inks, poster-like contrasts, minimal gradients'
  },
  'american-comedy-cartoon': {
    label: 'US comedy cartoon',
    desc: 'US TV comedy cartoons: exaggerated expressions, thick outlines, slapstick poses, saturated flat fills'
  },
  'anime-painting': {
    label: 'Anime paint',
    desc: 'Anime with painted finish: luminous watercolor passes, blended cheeks, ornate hair gradients, translucent color layers'
  },
  'q-version-3d': {
    label: 'Chibi 3D',
    desc: 'Chibi 3D: bubbly meshes, oversized heads on tiny bodies, soft global illumination, pastel materials'
  },
  'cinematic-portrait': {
    label: 'Cinematic portrait',
    desc: 'Film portrait: cinematic lighting, analog grain, color grading discipline, pore-level skin, wardrobe with believable folds'
  },
  shinkai: {
    label: 'Makoto Shinkai-like',
    desc: 'Shinkai-inspired anime: luminous skies, microscopic light rays, silky hair strands, crisp cool palettes, lyrical atmosphere'
  }
} as const
