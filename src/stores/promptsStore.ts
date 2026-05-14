import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface PromptItem {
  id: string
  title: string
  description: string
  content: string
  defaultContent: string
  preset?: string
  isCustom?: boolean
}

export interface PresetOption {
  label: string
  value: string
  content: string
  image?: string
}

export interface SubCategory {
  id: string
  name: string
  icon: any
  officialPrompts: PromptItem[]
  customPrompts: PromptItem[]
  presets?: PresetOption[]
  exampleImage?: string
}

export interface Category {
  id: string
  name: string
  icon: any
  subCategories: SubCategory[]
}

// 提取资产的标准约束 - 当用户使用自定义模板时必须添加
const EXTRACT_ASSETS_STANDARD_CONSTRAINT = `
##重点说明：输出前严格核对，确保无遗漏、无改写、无新增内容，所有元素均来自原文，贴合短剧视觉化制作需求。人物,场景,道具的描述文字严格照搬原文，不新增不脑补，需要按照提供的小说内容总结最符合故事情节的描述文字,描述文字完整可直接画图。不附加其他多余的解释与表述，请严格按照以下JSON格式返回,不要添加任何其他内容:
{
  "characters": [
    {"name": "人物名称", "description": "人物描述"}
  ],
  "scenes": [
    {"name": "场景名称", "description": "场景描述"}
  ],
  "props": [
    {"name": "道具名称", "description": "道具描述"}
  ]
}
`

// 生成分镜的标准约束 - 当用户使用自定义模板时必须添加
const GENERATE_STORYBOARD_STANDARD_CONSTRAINT = `
输出严格按照以下JSON格式返回,每个分镜中至少包含2个Grid条目，最多4个Grid条目,条目内容严格套用Grid标准格式，不添加多余解释文字:
{
  "storyboards": [
    {
      "title": "分镜标题",
      "description": "完整逐条填入Grid1~Grid4标准格式内容",
      "duration": 15,
      "matchedAssets": {
        "characters": ["人物名称1", "人物名称2"],
        "scene": "场景名称",
        "props": ["道具名称1", "道具名称2"]
      }
    }
  ]
}
`

const defaultPrompts: Record<string, string> = {
  '1': `请从以下小说内容中提取资产信息,包括人物、场景和道具。
## 人物提取规范
1. 提取所有出场人物，明确人物身份（贴合原文设定）；全面提取原文明确描述的人物相关信息，只提取原文明确写出的信息，不脑补、不新增、不美化、不删减。外貌、穿着、配饰必须细到能直接画图。语言简洁、结构化、无废话，可直接丢给 AI 生成人物立绘。
2. 人物描述文字在200字至300字之间：
描述文字包含：身份、性别、年龄、职业（高中生 / 青年 / 中年 / 老年）；人种、地域特征、气质（冷静 / 阳光 / 阴郁 / 痞气 / 温柔 / 坚毅等）；外貌细节：脸型、五官（眼、眉、鼻、唇）、肤色、发型、发色、面部特征、身材、体态、标志性外貌细节；穿着；性格：xxx（外向 / 内向、热情 / 冷漠、冲动 / 沉稳、善良 / 狠厉等）；与主角 / 其他人物的核心关系（同学、朋友、恋人、兄弟、敌人等）。
3、提取原文中所有出现的场景，描述文字在200字至300字之间，场景名称与原文保持一致，统一输出格式包含：
场景类型：对应情节：高光 / 核心冲突：是 / 否；空间布局：（室内 / 室外、封闭 / 开阔、结构层次）；整体风格：（写实 / 古风 / 现代 / 科幻 / 暗黑 / 治愈等）；色调：（主色 + 辅色）；光线：（自然光 / 人工光、强弱、冷暖、方向）；陈设装饰：（家具、道具、摆放位置、材质、新旧、破损）；背景细节：（远景、中景、近景元素、环境特征）；氛围：（压抑 / 温馨 / 紧张 / 静谧 / 肃杀等）；画面用途：场景图生成、短剧分镜搭建，严格照搬原文，不新增不脑补，完整可出图。）
4、道具提取规范，描述文字在200字至300字之间，包含（道具类型：xxx；剧情定位：关键道具 / 普通道具；功能用途：xxx（关键道具详细说明，普通道具简洁说明）；外观细节：颜色、材质、尺寸、纹理、表面特征、边角细节、新旧程度、是否有破损 / 污渍 / 特殊标记，全部照搬原文，完整可画图；关联信息：与对应人物 / 场景的关联的关系（无则写 “无”）；画面用途：道具图片生成，严格贴合原文，不新增、不脑补，保留核心视觉信息，适配 AI 绘图与短剧道具还原。）
##重点说明：输出前严格核对，确保无遗漏、无改写、无新增内容，所有元素均来自原文，贴合短剧视觉化制作需求。人物,场景,道具的描述文字严格照搬原文，不新增不脑补，需要按照提供的小说内容总结最符合故事情节的描述文字,描述文字完整可直接画图。不附加其他多余的解释与表述，请严格按照以下JSON格式返回,不要添加任何其他内容:
{
  "characters": [
    {"name": "人物名称", "description": "人物描述"}
  ],
  "scenes": [
    {"name": "场景名称", "description": "场景描述"}
  ],
  "props": [
    {"name": "道具名称", "description": "道具描述"}
  ]
}`,
  '3-2': `将提供的小说文本精准转为分镜脚本，不删改、不新增，执行优先级：核心约束＞严禁项＞规则＞格式。
一、核心约束（硬性强制）
1. 逐句跟随原文，场景、对话、时空、地点、人物进出等切换，均需单独新建分镜，不合并。
2. 不遗漏剧情、台词、内心独白、旁白，还原人物毫米级微表情、肢体细节。
3. 单分镜固定15秒，含2-4条Grid条目（单条≥0.5秒，累加=15秒），不跨剧情/场景。
4. 单分镜先设缓冲对抗层（黑屏定场+视觉桥接），再放正片关键帧，精准分配时长。
5. 场景、人物加@标签，明确区分@叙述者（我）OS旁白与实景台词。
二、分镜与Grid规则
1. 按剧情拆分分镜，单分镜Grid条目为2/4条（优先2-4条），累加时长=15秒。
2. 无切换→1条Grid（15秒）；1次切换→2条；多人正反打→4条，不超4条。
三、Grid条目格式（必套）
1. 场景地点：（@带标签，与原文一致）
2. 时间：（白天/夜晚等精准标注）
3. 时间控制: X秒（X≥0.5）
4. 画面: 【导演+摄影指导视角】前景+中景+后景，按动作→细节→微表情→光影→运镜→音效→台词撰写，标注符号化载体/特效。
5. 运镜: 速度+轨迹+景别+视角微调（贴合情绪）
6. 音效: 环境氛围+具体音效（与画面同步）
7. 台词: [@人物]:"内容"；旁白统一@叙述者（我）OS: "内容"，对话交替拆分。
8. 设计意图：说明镜头情绪、剧情作用。
四、拆镜与画面规范
1. 场景、时空、情绪、动作、台词等转折，立即拆新分镜；动作拆至最小单元，1个动作1条Grid。
2. 画面按指定逻辑撰写，动作毫米级、台词与动作同步，光影随情绪变化，运镜贴合情绪。
五、资产匹配（必执行）
matchedAssets仅填写分镜内实际出现的@人物、@场景、道具，独立配置，名称与原文一致。
六、严禁项
1. 不笼统描述、不删改剧情/台词、不遗漏细节；不出现单Grid＜0.5秒、分镜≠15秒。
2. 不堆砌多核心内容、不空镜凑数；不省略@标签、设计意图、缓冲对抗层；不冗余填写资产。
七、输出格式（JSON，无多余文字）
{
  "storyboards": [
    {
      "title": "分镜标题",
      "description": "逐条填Grid1~Grid4（每条分段）",
      "duration": 15,
      "matchedAssets": {
        "characters": ["@人物1", "@人物2"],
        "scene": "@场景",
        "props": ["道具1", "道具2"]
      }
    }
  ]
}`,
  '3': `
请将提供的文本内容严格转换为分镜脚本，所有规则均为硬性要求，执行优先级：核心约束＞严禁项＞拆镜规则＞Grid相关规则＞资产匹配规则，全程遵循小说原文，不做任何偏离。
一、#核心约束（硬性强制，必严格执行，优先级最高）
1. 拆分要求：严禁合并任何剧情段落、严禁压缩情节，严格逐句跟随小说原文推进；每一次场景切换、人物对话切换、现实转回忆、回忆转现实、地点移动、时间跳转、人物出场、人物退场，必须单独新建一个分镜，绝不允许揉在同一个分镜里。
2. 细节完整性：严格按照小说内容剧情转化分镜，做到一字不遗漏故事情节、不遗漏任何一句人物台词、不遗漏任何内心独白、不遗漏叙述者旁白。
3. 分镜时长与范围：单分镜固定为15秒总时长，仅承载当前一小段剧情，不跨剧情、不跨场景；每个分镜内至少2条Grid（可根据规则灵活调整为4条、6条或者9条，并非默认2条，单条Grid条目时长≥0.5秒。
4. 拆镜粒度：一小段对话、一个动作、一个心理活动、一段旁白、一个场景空镜，都要独立拆分成单独分镜，不许凑堆、不许合并。
5. 地点约束：单分镜只承载一个剧情小单元，不能同时包含教室、操场、饭店、菜市场、小区等多个地点的剧情，地点发生变化时，立即新开分镜。
6. 分镜架构：每个15秒分镜必须先做**缓冲对抗层（黑屏定场+视觉桥接）** ，再做**正片关键帧序列**；内部按0-1s、1-3s、多段关键帧做精准时间切片，不可笼统概括时长分配。
7. 标签规范：所有场景统一加前缀「@」命名场景；所有人物统一加前缀「@」角色标签；单独区分**叙述者（我）OS旁白**与人物实景台词，明确标注对话顺序，不可混淆。
8. 人物细节：镜头必须还原人物头发、神态、微表情、肢体细微动作，如鼻翼微动、眉头褶皱、胸口起伏、眼神茫然错愕等毫米级细节，贴合原文描写。
二、#拆镜规则（核心约束补充，强制执行）
1. 拆镜节点：场景转折、时空转折、回忆与现实互转、情绪转折、动作切换、台词交替、旁白分段、地点更换、时间变化，全部必须立刻拆出新分镜，不允许共用一个分镜，不拖延拆镜。
2. 动作拆分：核心动作拆至最小单元，一个动作对应一个Grid条目单元，贴合原文每一句描写、每一句旁白，不合并动作。
3. Grid条目约束：单个Grid条目仅承载1个核心动作 / 1种情绪 / 1个特效；物理动态严格遵循现实重力、气流逻辑，不出现穿模、动作不合理的情况。
4. 衔接要求：运镜、光影、特效在单Grid条目内闭环，Grid条目之间无缝切换，无动作断裂、无剧情跳跃、无逻辑漏洞。
三、#分镜与Grid条目数量规则
1. 分镜数量：根据小说剧情细粒度拆分，严格遵循核心约束与拆镜规则，分镜数量与剧情拆分的单元数量一致，不合并、不遗漏任何拆镜节点。
2. Grid条目数量：每个分镜内包含的Grid条目数量，必须是2/4/6/9条，单条Grid条目时长≥0.5秒，所有条目时长累加严格等于15秒。
3. Grid条目分配：无镜头切换→Grid1（独占15秒）；1次镜头切换→Grid1+Grid2（合计15秒）；多人正反打/多镜头叙事→Grid1+Grid2+Grid3+Grid4（合计15秒）；单个分镜描述最多4条Grid条目，若累加时长超过15秒，则减少该分镜内Grid条目数量，确保时长合规。
四、#Grid 条目格式（必须直接套用，缺一不可）
每条Grid条目必须包含以下全部内容，严格按顺序填写，不修改格式、不遗漏内容：
1. 场景地点：（@带标签标准场景名，与小说原文一致）
2. 时间：（白天/日内/夜晚/黄昏/黎明/清晨/午后/傍晚/深夜等精准标注，贴合原文场景）
3. 时间控制: X 秒（X≥0.5，所有Grid条目时长累加=15秒）
4. 画面:【导演+摄影指导视角】严格遵循**前景+中景+后景**三层构图；按「动作触发 → 物理细节 → 微表情 → 光影变化 → 运镜轨迹 → 音效搭配 → 台词呈现」的逻辑撰写；标注△符号化载体、光影色彩、特效（贴合原文，不新增）。
5. 运镜: 速度 + 轨迹 + 景别 + 视角微调（运镜速度贴合画面情绪）
6. 音效: 开篇前置标注环境整体氛围、安静度，再补充动作音/环境音/台词音，音效与画面、动作同步。
7. 台词:[@人物标签]:"内容" 【叙述者旁白统一标注 OBSERVER: 或 @叙述者（我）OS: "内容"】；多人对话按"说话人Grid条目+倾听人Grid条目"交替拆分，不集中堆砌台词。
8. 设计意图：本段镜头情绪、剧情铺垫、叙事作用说明（不笼统、不冗余，贴合当前Grid条目剧情）。
五、#画面描述规范（强制遵循，适配文生图/视频双需求）
1. 视角要求：以【导演+摄影指导】视角，严格按以下逻辑撰写画面细节。
2. 撰写逻辑：动作触发 → 物理细节 → 微表情 → 光影变化 → 运镜轨迹 → 音效搭配 → 台词呈现，不颠倒、不遗漏。
3. 动作细节: 必须毫米级量化，明确抬手角度、指尖力度、身体倾斜幅度、布料褶皱、液体轨迹、呼吸胸口起伏、眉眼微动等，符合物理逻辑，不违背现实常识。
4. 台词绑定: 台词/旁白必须与动作同步，开口、转头、抬手、停顿等动作同步触发对应内容，多人对话按"说话人Grid条目+倾听人Grid条目"交替拆分，不集中堆砌台词。
5. 光影特效: 光影随情绪动态变化(冷色/暖色/强度/阴影位置)，空气中浮尘、光晕、明暗层次具象化，不冗余，在单个Grid条目时长内闭环。
6. 景别运镜: 单个Grid条目仅允许景别缩放/视角微调(标注【切:特写/近景/中景/全景】)，不中断核心动作与台词节奏，运镜速度贴合画面情绪(激昂场景快运镜，慢情绪场景慢运镜)。
六、#资产匹配规则（必须严格执行，不冗余、不遗漏）
1. matchedAssets 字段必须根据每个分镜的实际内容填写，不要随意填写、不冗余添加。
2. 只填写该分镜中实际出现 / 提及的人物、场景、道具，不要添加未出现、未提及、未使用的内容。
3. 如果一个人物在该分镜的描述、台词、动作中完全没有出现，不要填写至characters列表。
4. 如果一个道具在该分镜中没有被使用、没有被提及，不要填写至props列表。
5. 场景只能填写该分镜发生的地点，不要填写其他无关场景，与Grid条目内的“场景地点”保持一致。
6. 每个分镜的资产独立配置，不共用其他分镜的人物、场景、道具，避免冗余。
7. 仔细分析Grid的描述、台词、画面内容，确保资产名称准确匹配，与小说原文提及名称完全一致，区分大小写。
七、#严禁项（触碰即违规，必规避）
1. 禁止Grid条目中笼统概括场景、人物，必须包含前景+中景+后景三层构图及微表情细节；禁止随意自创剧情、删减旁白、修改台词。
2. 禁止单条Grid条目时长＜0.5 秒、单个分镜总时长≠15 秒；禁止时长累加错误。
3. 禁止多个核心剧情、多个动作、多种情绪塞一个Grid条目；禁止空镜凑数、禁止动作断裂、禁止台词旁白与动作脱节。
4. 禁止添加任何解释备注、禁止精简剧情、禁止省略原文台词、心理活动、叙述者旁白。
5. 禁止不给场景、人物打@标签；禁止Grid条目不写设计意图；禁止分镜不设置缓冲对抗层（黑屏定场+视觉桥接）。
八、#输出格式（必须严格套用，无多余文字）
严格按照以下JSON格式输出，每个分镜中至少包含2个Grid条目，条目内容严格套用Grid标准格式输出，不添加多余解释文字、备注信息：
{
  "storyboards": [
    {
      "title": "分镜标题（贴合当前分镜核心剧情，简洁明了）",
      "description": "完整逐条填入Grid1~Grid4标准格式内容（每条Grid单独分段，清晰可辨）",
      "duration": 15,
      "matchedAssets": {
        "characters": ["@人物名称1", "@人物名称2"],
        "scene": "@场景名称",
        "props": ["道具名称1", "道具名称2"]
      }
    }
  ]
}`,
  '4': `请优化以下分镜脚本,
#Grid 条目格式(直接套用)
时间控制:X 秒
画面:毫米级动作 + 微表情 + 物理细节 + 环境,人物状态,场景,△符号化载体,光影色彩,特效
运镜:速度 + 轨迹 + 景别
音效:环境音/动作音/台词音
输出严格按照以下JSON格式返回,每个分镜中包含 Grid1~Grid3 共三条 Grid 条目,不要添加任何其他内容:
{
  "storyboards": [
    {
      "title": "分镜标题",
      "description": "本分镜的 Grid 条目描述（含画面／运镜等）",
      "duration": 5
    }
  ]
}
  改进以下方面:
  1.Grid语言:优化景别和角度的选择
  2. 节奏把控:调整分镜时长和切换节奏
  3. 视觉效果:增强画面表现力
  4. 情感表达:强化情感渲染
  请保持原有故事内容,仅优化表现形式。`,
  '5': `请根据以下人物描述生成专业角色设计参考图:
生成一份专业的角色设计图,标题【人物名称】,结构清晰,能够被视频生成模型完全解读,旨在为视频生成模型提供稳定一致的人物参考。
使用网格布局,背景为纯白色,所有视图均需保持100%一致的比例、服装和细节,不得变形.
左侧部分:3张全身图,垂直排列——正面、左侧90°侧面、背面,均为标准中性站姿,无需裁剪。每张图片下方标注视角名称。
右侧部分:上排:3张特写头像,三种表情各异,每张都标注相应的表情名称。
下排:4张细节特写:1张眼睛特写(清晰展现眼形、虹膜颜色和瞳孔细节)、1张皮肤特写(展现肤色和纹理)、1张颈部和下颌线特写、1张服装面料特写(展现材质纹理和细节)。
底部:清晰的色卡,包含头发、眼睛、服装、肤色和配饰的色块,并附有标签。右下角标注人物名称。
整体美术风格简洁,线条锐利,细节丰富,以人物为中心,无其他分散注意力的元素。
人物细节:电影级摄影风格,胶片颗粒质感,电影级叙事光影,细腻均匀的胶片颗粒,电影级色彩分级系统,立体感强的面部特征,清晰的头发纹理层次,自然妆容契合人物气质,简约高品质的服装,面料质感逼真。
人体比例[黄金比例/Q版XX头身比例],比例和细节完全一致,无偏差;
柔和的自然光覆盖整个画面,光线均匀,无强烈阴影/无细节遮挡;
居中构图,人物占据画面80%以上,四周留白较少,人物完整无裁剪;
无畸形,无多余肢体,无模糊,无过度简化。
全中文标注,高清细节,无水印文字。`,
  '5-2': `请根据以下人物描述生成专业角色设计三视图参考图,标题【人物名称】,包含正面、侧面、背面、半身特写四个标准视角,四个视角均匀整齐排列在同一张横版画面中,布局对称工整,纯白极简背景,无水印杂物干扰,右下角标注人物名称,超高清晰度,8K超清画质,极致精细纹理,清晰柔和的影视级光影,明暗层次分明,无过曝无死黑,结构精准比例标准,轮廓清晰线条利落,角色体态自然标准,专业美术建模参考图,细节丰富饱满,质感细腻,画面干净高级,适合角色设定、建模参考、美术设计使用`,
  '6': `请根据以下的场景描述生成专业动漫场景设定参考图,标题【场景名称】,严格固定排版:
顶部:4个横向矩形小图 → 正面视角、侧面视角、高俯视角、低仰视角
左侧:3个纵向矩形图 → 白天、黄昏、夜晚三种光影
中心:1个最大主画面 → 场景主体全景主视觉
要求:专业美术风格,结构精准,线条清晰,光影细腻,色调统一,无水印文字,纯白背景,8K高清,极致细节,对称工整,专业场景设定稿,适合建模与动画参考`,
  '6-2': `专业动漫场景360°设定参考图,标题【场景名称】,严格固定布局:
中左侧:大型矩形画面【正面主场景图】,细节完整
正下方:矩形面板【场景所使用的颜色】,含主色/辅助色/点缀色
右侧:3个垂直矩形图 → 主场景左90度图、主场景右90度图、主场景对面的场景
整体深色科技风背景,区域标注清晰,透视统一,色调协调,专业动画美术设定稿,干净线条,高清细节,8K,适合建模与动画制作`,
  '7': `请根据要求生成专业道具设定参考图,标题【道具名称】,严格固定布局:
顶部:4个横向小图 → 正面、侧面、高俯角、低仰角
左侧:3个纵向图 → 白天、黄昏、夜晚三种光影材质
中心:1个最大主视图 → 道具完整比例与核心细节
底部:3个方形特写 → 道具关键细节标注
右侧:竖版色卡 → 主色3-5个、辅助色2-3个、点缀色1-2个
分辨率【宽x高】,专业道具美术,精准线条,真实材质,深色科技背景,全中文标注,高清细节,生产级参考图`,
  '7-2': '请根据以下道具描述生成图像:\n创建一个高质量的道具设计图,适用于动画和游戏项目。\n要求:\n1. 道具清晰可见,细节丰富\n2. 多角度展示(正面、侧面、背面)\n3. 材质纹理清晰\n4. 背景简洁,突出道具主体',
  '8': `请根据以下分镜描述,参考提供的资产图片,生成专业的分镜合成图:
#核心要求
1、参考提供的人物角色图片,场景图片,道具图片,保持人物外观、服装、配饰一致性,场景风格、色调、氛围一致性,道具细节、材质一致性
2、严禁合成的分镜图上出现任何分镜描述的相关台词及其他文字,除非是分镜描述中明确要求的。
3、最重点：根据分镜描述，Grid1 对应图片左上角标注文字 Grid1，Grid2 对应图片左上角标注文字 Grid2，以此类推，不要添加任何其他内容；
#合成要求
1、将人物、场景、道具元素自然融合到同一画面中
2、保持各资产原有的视觉特征和细节
3、根据分镜描述调整人物姿态、表情和位置
4、统一画面光影和色调,确保视觉协调
5、画面构图符合Grid要求
#分镜信息描述:{description}

#输出规格
1、高清画质,细节丰富
2、专业动画分镜风格
3、适合后续视频制作使用`,
  '8-2': `请根据分镜描述和资产参考图片,生成高质量的分镜合成图:

【任务目标】
根据分镜文字描述,将提供的人物、场景、道具图片合成为一张完整的分镜画面

【合成规则】
1. 人物处理:
   - 保持人物外观特征与参考图一致
   - 根据分镜描述调整人物姿态和表情
   - 人物与场景透视关系正确

2. 场景处理:
   - 保持场景风格与参考图一致
   - 根据分镜需求调整场景角度和范围
   - 场景光影与人物协调

3. 道具处理:
   - 道具位置符合分镜描述
   - 保持道具细节与参考图一致
   - 道具与场景、人物的比例协调

4. 整体效果:
   - 画面构图完整,视觉层次分明
   - 光影统一,氛围符合分镜情绪
   - 高清输出,适合动画制作标准`,
  '8-cinema': `#全篇提示词用中文

#创建一个电影制作板/视觉规划表：比例16:9，展示短片或商业广告的完整。布局应简洁、基于网格，并分为清晰标记的部分。包含：
共享创意指导（顶部栏）：整体限制，如镜头数量、统一的调色板和一般的环境背景。
#角色与风格参考部分：一个从多个角度展示的模型（正面、背面、侧面、特写、放松姿态），配有服装和配饰参考。强调身份的一致性，同时允许在特定场景中进行细微变化。
#环境和场景设计部分：一个具有戏剧性自然特征的场景户外地点，以及一个俯视示意图，说明在空间中的移动路径。包括摄像机位置和沿路线标注的拍摄类型。
#故事板部分：一系列编号的帧（大约 8 个镜头）展示场景的进展。每个帧包括：摄像机类型/镜头感觉、镜头大小（广角、中景、特写、微距）、运动方式（静态、跟踪、手持等）、动作和情绪进展的简要描述。
#灯光/情绪/风格备注：与灯光条件、氛围和纹理相关的视觉示例和简短描述。包括一天中不同时间的过渡和光线质量的变化。
情绪和关键词块：指导作品的简洁情绪基调主题描述列表。
#音频/音调部分：环境声音、音乐风格和整体声音氛围的指示。
#电影摄影笔记：包括镜头特性、运动风格和后期处理感觉的总体视觉哲学。
整个版面应感觉连贯、电影化且专业设计——就像导演的预制作指南，能一眼传达出基调、节奏和视觉叙事。要求是中国演员真人拍摄分镜，细致的肌肤纹理和逼真的光影。`,
  '9': `#【核心要求】生成一段**15秒连贯写实风格短视频**，必须严格遵循以下所有硬性规则，不得修改、删减或添加任何内容。
## 重要限制（必须严格遵守，违者生成无效）：
1.视频画面禁止出现任何字幕、文字、标题或水印；
2.视频不要有背景音乐，不要环境音效，仅保留人声和动作音效；
3.禁止出现任何文字气泡、对话气泡、聊天气泡或漫画式对白框；
4.禁止出现任何其他文字、字幕、标题或水印。
## 硬性规则（必须100%遵守，违者生成无效）
1.  **画面还原**：严格复刻提供的N格分镜，**Grid1～GridN 分别从第一行从左到右的顺序一一对应画面**，100%还原剧情、人物动作、场景、突发事件、人物形象与场景构图，无删减、无篡改、无原创加戏；视频全程**严禁画面上出现格子编号字样（包括但不限于 Grid、Grid条目编号等任何形式）**。
2.  **时长控制**：总时长**严格为15秒**，Grid1～4 的时间段分别对应**4s/4s/3s/4s**，Grid条目间转场自然流畅，无卡顿、无画面断裂。
3.  **影视级写实逻辑**：动作细节写实、物理规则闭环，光影随剧情情绪变化，灾难场景氛围感拉满，特效（彩光碰撞、白光爆发、血腥画面、异变生物效果）自然具象，无穿模、无画面崩坏。
4.  **运镜复刻**：运镜完全照搬分镜描述要求；画面拉伸、变焦、焦点、视角切换精准匹配，运镜速度贴合画面氛围。
5.  **音画同步**：环境音效、人物台词与画面节奏完全贴合，人物口型、表情与台词精准同步，情绪神态与剧情高度契合。
6.  **风格约束**：画面风格严格遵循分镜设定，**回忆部分（Grid1-2／前两格）色调灰暗压抑，现实部分（Grid3-4／后段格）色调明亮真实**，形成鲜明对比，不得添加任何额外内容。
7.  **内容禁令**：严禁违规修改人物、场景、道具、血腥异变画面，无多余空镜；视频中严禁出现分镜描述相关台词及其他无关文字，仅保留分镜明确要求的台词内容。
8.  **聚焦核心**：叙事聚焦核心剧情冲突，重点突出人物微表情、肢体动作、突发事件冲击感，以及场景氛围感、道具细节质感。`,
  '10': '你是一个专业的动画分镜师和提示词优化专家。你的任务是优化用户提供的分镜描述,使其更加详细、生动,适合用于AI图像生成。\n\n优化要求:\n1. 保持原始描述的核心内容和意图\n2. 添加更多视觉细节描述(光影、构图、氛围等)\n3. 使用专业术语增强描述的准确性\n4. 确保优化后的提示词适合AI图像生成\n5. 输出优化后的提示词,不要添加任何解释或前缀\n\n请直接输出优化后的提示词,不要添加任何其他内容。'
}

const STORAGE_KEY = 'prompts-store-data'

export const usePromptsStore = defineStore('prompts', () => {
  const categories = ref<Category[]>([
    {
      id: 'text',
      name: '文字处理提示词',
      icon: null,
      subCategories: [
        {
          id: 'extract-assets',
          name: '提取资产提示词',
          icon: null,
          officialPrompts: [
            {
              id: '1',
              title: '资产提取模板',
              description: '官方预设资产提取模板，可以提取人物，场景，道具的名字及生成介绍',
              content: defaultPrompts['1'],
              defaultContent: defaultPrompts['1'],
              preset: 'default',
              isCustom: false
            }
          ],
          customPrompts: []
        },
        {
          id: 'generate-storyboard',
          name: '生成分镜提示词',
          icon: null,
          officialPrompts: [
            {
              id: '3',
              title: '分镜生成模板',
              description: '官方预设分镜生成模板，根据小说内容生成分镜脚本',
              content: defaultPrompts['3'],
              defaultContent: defaultPrompts['3'],
              preset: 'default',
              isCustom: false
            },
            {
              id: '3-2',
              title: 'Gemini-3-Pro专用4镜头模板',
              description: 'Gemini-3-Pro 专用4镜头模板，精准转化不删改不新增',
              content: defaultPrompts['3-2'],
              defaultContent: defaultPrompts['3-2'],
              preset: 'default',
              isCustom: false
            }
          ],
          customPrompts: []
        },
        {
          id: 'optimize-storyboard',
          name: '优化分镜提示词',
          icon: null,
          officialPrompts: [
            {
              id: '4',
              title: '分镜优化模板',
              description: '官方预设分镜优化模板，优化现有分镜的视觉效果和节奏',
              content: defaultPrompts['4'],
              defaultContent: defaultPrompts['4'],
              preset: 'default',
              isCustom: false
            }
          ],
          customPrompts: []
        }
      ]
    },
    {
      id: 'image',
      name: '图片处理提示词',
      icon: null,
      subCategories: [
        {
          id: 'generate-character',
          name: '生成人物提示词',
          icon: null,
          officialPrompts: [
            {
              id: '5',
              title: '人物图像生成模板',
              description: '官方预设人物生成模板，根据描述生成角色设计图',
              content: defaultPrompts['5'],
              defaultContent: defaultPrompts['5'],
              preset: 'default',
              isCustom: false
            }
          ],
          customPrompts: [],
          presets: [
            { label: '系统默认提示词', value: 'default', content: defaultPrompts['5'] },
            { label: '预设提示词二', value: 'preset-2', content: defaultPrompts['5-2'] }
          ]
        },
        {
          id: 'generate-scene',
          name: '生成场景提示词',
          icon: null,
          officialPrompts: [
            {
              id: '6',
              title: '场景图像生成模板',
              description: '官方预设场景生成模板，根据描述生成场景设定图',
              content: defaultPrompts['6'],
              defaultContent: defaultPrompts['6'],
              preset: 'default',
              isCustom: false
            }
          ],
          customPrompts: [],
          presets: [
            { label: '系统默认提示词', value: 'default', content: defaultPrompts['6'] },
            { label: '预设提示词二', value: 'preset-2', content: defaultPrompts['6-2'] }
          ]
        },
        {
          id: 'generate-props',
          name: '生成道具提示词',
          icon: null,
          officialPrompts: [
            {
              id: '7',
              title: '道具图像生成模板',
              description: '官方预设道具生成模板，根据描述生成道具设定图',
              content: defaultPrompts['7'],
              defaultContent: defaultPrompts['7'],
              preset: 'default',
              isCustom: false
            }
          ],
          customPrompts: [],
          presets: [
            { label: '系统默认提示词', value: 'default', content: defaultPrompts['7'] },
            { label: '预设提示词二', value: 'preset-2', content: defaultPrompts['7-2'] }
          ]
        },
        {
          id: 'generate-storyboard-image',
          name: '生成分镜图提示词',
          icon: null,
          officialPrompts: [
            {
              id: '8',
              title: '分镜图生成模板',
              description: '官方预设分镜图生成模板，根据描述合成分镜画面',
              content: defaultPrompts['8'],
              defaultContent: defaultPrompts['8'],
              preset: 'default',
              isCustom: false
            },
            {
              id: '8-cinema',
              title: '故事版模板-电影故事版专用',
              description: '官方预设电影故事版模板，适用于非宫格叙事分镜生成',
              content: defaultPrompts['8-cinema'],
              defaultContent: defaultPrompts['8-cinema'],
              preset: 'cinema',
              isCustom: false
            }
          ],
          customPrompts: [],
          presets: [
            { label: '系统默认提示词', value: 'default', content: defaultPrompts['8'] },
            { label: '预设提示词二', value: 'preset-2', content: defaultPrompts['8-2'] },
            { label: '故事版模板', value: 'cinema', content: defaultPrompts['8-cinema'] }
          ]
        }
      ]
    },
    {
      id: 'video',
      name: '视频处理提示词',
      icon: null,
      subCategories: [
        {
          id: 'generate-video',
          name: '生成视频提示词',
          icon: null,
          officialPrompts: [
            {
              id: '9',
              title: '视频生成模板',
              description: '官方预设视频生成模板，根据分镜描述生成视频',
              content: defaultPrompts['9'],
              defaultContent: defaultPrompts['9'],
              preset: 'default',
              isCustom: false
            }
          ],
          customPrompts: []
        }
      ]
    }
  ])

  const loadFromStorage = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        data.forEach((savedCategory: any) => {
          const category = categories.value.find(c => c.id === savedCategory.id)
          if (category) {
            savedCategory.subCategories.forEach((savedSub: any) => {
              const subCategory = category.subCategories.find(s => s.id === savedSub.id)
              if (subCategory) {
                if (savedSub.officialPrompts) {
                  savedSub.officialPrompts.forEach((savedPrompt: any) => {
                    const prompt = subCategory.officialPrompts.find(p => p.id === savedPrompt.id)
                    if (prompt) {
                      prompt.content = savedPrompt.content
                      prompt.preset = savedPrompt.preset
                    }
                  })
                }
                if (savedSub.customPrompts) {
                  subCategory.customPrompts = savedSub.customPrompts
                }
              }
            })
          }
        })
      }
    } catch (e) {
      console.error('加载提示词存储失败:', e)
    }
  }

  const saveToStorage = () => {
    try {
      const data = categories.value.map(category => ({
        id: category.id,
        subCategories: category.subCategories.map(sub => ({
          id: sub.id,
          officialPrompts: sub.officialPrompts.map(p => ({
            id: p.id,
            content: p.content,
            preset: p.preset
          })),
          customPrompts: sub.customPrompts
        }))
      }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('保存提示词存储失败:', e)
    }
  }

  const addCustomPrompt = (subCategoryId: string, title: string, description: string, content: string) => {
    for (const category of categories.value) {
      const subCategory = category.subCategories.find(s => s.id === subCategoryId)
      if (subCategory) {
        const newPrompt: PromptItem = {
          id: `custom-${Date.now()}`,
          title,
          description,
          content,
          defaultContent: content,
          preset: 'default',
          isCustom: true
        }
        subCategory.customPrompts.push(newPrompt)
        saveToStorage()
        return newPrompt
      }
    }
    return null
  }

  const updateCustomPrompt = (subCategoryId: string, promptId: string, title: string, description: string, content: string) => {
    for (const category of categories.value) {
      const subCategory = category.subCategories.find(s => s.id === subCategoryId)
      if (subCategory) {
        const prompt = subCategory.customPrompts.find(p => p.id === promptId)
        if (prompt) {
          prompt.title = title
          prompt.description = description
          prompt.content = content
          saveToStorage()
          return prompt
        }
      }
    }
    return null
  }

  const deleteCustomPrompt = (subCategoryId: string, promptId: string) => {
    for (const category of categories.value) {
      const subCategory = category.subCategories.find(s => s.id === subCategoryId)
      if (subCategory) {
        const index = subCategory.customPrompts.findIndex(p => p.id === promptId)
        if (index !== -1) {
          subCategory.customPrompts.splice(index, 1)
          saveToStorage()
          return true
        }
      }
    }
    return false
  }

  const getPromptById = (id: string): PromptItem | undefined => {
    for (const category of categories.value) {
      for (const subCategory of category.subCategories) {
        const officialPrompt = subCategory.officialPrompts.find(p => p.id === id)
        if (officialPrompt) return officialPrompt
        const customPrompt = subCategory.customPrompts.find(p => p.id === id)
        if (customPrompt) return customPrompt
      }
    }
    return undefined
  }

  const getPromptContentById = (id: string): string => {
    const prompt = getPromptById(id)
    return prompt?.content || defaultPrompts[id] || ''
  }

  const getCharacterPrompt = (): string => {
    return getPromptContentById('5')
  }

  const getScenePrompt = (): string => {
    return getPromptContentById('6')
  }

  const getPropsPrompt = (): string => {
    return getPromptContentById('7')
  }

  const getStoryboardImagePrompt = (): string => {
    return getPromptContentById('8')
  }

  const getExtractAssetsPrompt = (): string => {
    return getPromptContentById('1')
  }

  const getGenerateStoryboardPrompt = (): string => {
    return getPromptContentById('3')
  }

  const getOptimizeStoryboardPrompt = (): string => {
    return getPromptContentById('4')
  }

  const getVideoPrompt = (): string => {
    return getPromptContentById('9')
  }

  const getOptimizeTextPrompt = (): string => {
    return getPromptContentById('10')
  }

  const updatePromptContent = (id: string, content: string) => {
    const prompt = getPromptById(id)
    if (prompt) {
      prompt.content = content
      saveToStorage()
    }
  }

  const getSubCategoryPrompts = (subCategoryId: string): PromptItem[] => {
    for (const category of categories.value) {
      const subCategory = category.subCategories.find(s => s.id === subCategoryId)
      if (subCategory) {
        return [...subCategory.officialPrompts, ...subCategory.customPrompts]
      }
    }
    return []
  }

  // 获取提取资产的标准约束
  const getExtractAssetsStandardConstraint = (): string => {
    return EXTRACT_ASSETS_STANDARD_CONSTRAINT
  }

  // 获取生成分镜的标准约束
  const getGenerateStoryboardStandardConstraint = (): string => {
    return GENERATE_STORYBOARD_STANDARD_CONSTRAINT
  }

  loadFromStorage()

  return {
    categories,
    getPromptById,
    getPromptContentById,
    getCharacterPrompt,
    getScenePrompt,
    getPropsPrompt,
    getStoryboardImagePrompt,
    getExtractAssetsPrompt,
    getGenerateStoryboardPrompt,
    getOptimizeStoryboardPrompt,
    getVideoPrompt,
    getOptimizeTextPrompt,
    updatePromptContent,
    saveToStorage,
    defaultPrompts,
    addCustomPrompt,
    updateCustomPrompt,
    deleteCustomPrompt,
    getSubCategoryPrompts,
    getExtractAssetsStandardConstraint,
    getGenerateStoryboardStandardConstraint
  }
})
