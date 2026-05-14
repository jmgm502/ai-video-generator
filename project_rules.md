# 项目代码规范与约束

> 本文档定义了项目开发中的重要约束和规范，修改代码前必须阅读并遵守。

---

## 第一百五十阶段（API 路由按模型分组：`configType` 仅表单，`modelGroup` 决定请求）

### 变更时间
2026-05-04

### 变更文件
- **`src/stores/apiConfigStore.ts`**：**`textApiModelGroup`**（持久化；工坊 Step1 文本与 Step2 提示词优化、设置「文本模型」分组）；**`imageModelGroup`** 类型扩展为 **`ApiModelGroup`**（含 **`flow2`**）；**`currentConfig`** 仍为优尚网关快照；运行时 **`configForModelGroup`** / **`isApiReadyForGroup`**
- **`src/services/apiService.ts`**：**`resolveConfig(modelGroup)`**；**`generateText`/`generateTextStream`/`generateImage`/`generateVideo`/`generateQwenImageEdit2509`/`queryGrokVideoStatus`** 均支持 **`modelGroup`**
- **`src/types/index.ts`**：**`Storyboard.videoApiModelGroup`**（Grok 超时恢复轮询与创建任务同源）
- **`src/views/Step1Page.vue`**、**`src/views/Step2Page.vue`**、画布 **`TextProcessCanvasNode`** / **`StoryboardTemplateNode`** / **`AssetExtractTemplateNode`** / **`ImageCanvasNode`** / **`StoryboardGenCanvasNode`** / **`VideoCanvasNode`**：调用 API 时传入节点或工坊所选分组；校验 **`isApiReadyForGroup`**（Flow2 查 **`baseURL`**，其余查 **`apiKey`**）
- **`src/components/SettingsDialog.vue`**：文本分组增加 Flow2；**`textApiModelGroup`**、**`imageModelGroup`** 与 **`modelGroup`** 双向同步；**`modelGroup.image`** 写入 **`flow2`** 时同步到 store
- **`src/locales/editorWorkshopLocales.ts`**：**`editorWorkshop.modelGroup.flow2`**

### 变更原因
- 设置里切换「优尚 / Flow2」标签不应独占运行时通道；实际走哪套 **`baseURL`/密钥** 应由各节点或工坊中的「模型分组」决定。

### 影响说明
- Grok 视频超时后会话 **`videoTaskId`** 与 **`videoApiModelGroup`** 一并写入；恢复查询 **`queryGrokVideoStatus`** 使用 **`storyboard.videoApiModelGroup`**，避免用户切换分组后轮询走错网关。

---

## 第一百四十九阶段（恢复 StoryboardTemplateNode：文件被清空导致构建失败）

### 变更时间
2026-05-04

### 变更文件
- **`src/components/canvas/StoryboardTemplateNode.vue`**（重建）：与 **`AssetExtractTemplateNode`** 同级交互——**`generate-storyboard`** 模板芯片、文字模型 **`asset-model-popover`**、**「生成分镜」** 按钮；从 **`textProcessNodeId`** 读取章节/正文与 **`textModel`**（写入上游文本节点）；生成链路对齐 **`TextProcessCanvasNode.handleGenerateStoryboardNodes`**（**`resolveStoryboardFlowStartPosition`**、**`storyboardGen`** 节点与连线自文本节点 **`source`**）；**`inject`** **`canvasPushStateBeforeChange`**
- **`src/utils/canvasStoryboardAi.ts`**（新建）：**`safeParseJsonObject`**、**`parseStoryboardResult`**、**`extractGridTexts`**、**`normalizeStoryboardGridTexts`**、**`computeGridShape`**、**`buildStoryboardFrames`**、**`resolveStoryboardFlowStartPosition`**，供文本节点与分镜模板节点共用
- **`src/components/canvas/TextProcessCanvasNode.vue`**：上述解析/布局函数改为从 **`canvasStoryboardAi`** 导入；**`normalizeStoryboardGridTexts`** 仍为组件内薄封装（传入 **`sbGridPlaceholder`**）；**`handleExtractAssets`** 内 **`safeParseJsonObject`** 结果按 **`Record<string, unknown>`** 收窄并 **`Array.isArray`** 读取 **`characters`/`scenes`/`props`**

### 变更原因
- **`StoryboardTemplateNode.vue`** 曾被清空，触发 **`At least one <template> or <script> is required`**，画布 **`storyboardTemplate`** 节点无法编译加载。

### 影响说明
- 弹层样式沿用 **`AssetExtractTemplateNode`** 的全局 **`asset-prompt-popover` / `asset-model-popover`**（**`CanvasEditor`** 仍引入提取模板节点）；分镜 AI 解析逻辑与文本节点侧集中在一处工具模块，后续改动只需改 **`canvasStoryboardAi.ts`**。

---

## 第一百四十八阶段（画布工坊参数设置：人物/场景/道具资产生图模板）

### 变更时间
2026-05-04

### 变更文件
- **`src/views/CanvasEditor.vue`**：画布工坊快照 **`canvasWorkbench`** 扩展 **`characterAssetPromptTemplateId`**、**`sceneAssetPromptTemplateId`**、**`propsAssetPromptTemplateId`**（默认 **`5`/`6`/`7`**）；**`normalize`** 与子分类列表对齐；**`provide`** **`canvasCharacterAssetPromptTemplateId`**、**`canvasSceneAssetPromptTemplateId`**、**`canvasPropsAssetPromptTemplateId`**；上述三项变更触发 **`triggerAutoSave`**
- **`src/components/canvas/CanvasWorkbenchParamDrawer.vue`**：抽屉内增加三类模板列表（**`generate-character` / `generate-scene` / `generate-props`**），与分镜图、视频模板同一交互；文案复用 **`editorWorkshop.step1.tplGen*`**；模板选择为与提取资产节点一致的 **`el-popover` + `prompt-chip`**（**`popper-class="asset-prompt-popover"`**）
- **`src/components/canvas/ImageCanvasNode.vue`**：**`inject`** 上述三个 **`Ref`**，**`getPromptContentById`** 解析模板正文（空则回退 **`5`/`6`/`7`**），替换原先 **`getCharacterPrompt` / `getScenePrompt` / `getPropsPrompt`** 直连

### 变更原因
- 与创梦工坊 Step1、画布上分镜/视频全局模板一致：人物/场景/道具 **资产图片** 生图所用模板可在「参数设置」中全局配置并随工程快照持久化。

### 影响说明
- 旧快照无上述字段时加载回退 **`5`/`6`/`7`**；未挂载画布编辑器上下文时 **`inject`** 为空则解析逻辑仍落到默认 id。

---

## 第一百四十七阶段（画布工坊：分镜生成节点底部「生成分镜图模板」）

### 变更时间
2026-05-04

### 变更文件
- **`src/components/canvas/StoryboardGenCanvasNode.vue`**：展开底部工具栏在「额外提示词」文本框下方增加 **生成分镜图模板** 芯片（列表 **`promptsStore.getSubCategoryPrompts('generate-storyboard-image')`**）；节点数据 **`selectedStoryboardImagePromptId`**，默认 **`8`**；**`composeCanvasStoryboardImagePrompt`** 经 **`resolveCanvasStoryboardImageTemplate()`**（**`getPromptContentById`**，空则回退 **`8`**）
- **`src/views/CanvasEditor.vue`**：**`buildNewStoryboardGenNodeData`** 写入 **`selectedStoryboardImagePromptId: '8'`**
- **`src/components/canvas/TextProcessCanvasNode.vue`**、**`StoryboardTemplateNode.vue`**：批量创建 **`storyboardGen`** 节点时同上默认字段

### 变更原因
- 与创梦工坊 Step2 一致：画布侧可按节点切换「生成分镜图」所用提示词模板，无需隐式依赖全局 **`getStoryboardImagePrompt()`**。

### 影响说明
- 旧画布项目在节点挂载 **`ensureDefaults`** 时会补齐合法 **`selectedStoryboardImagePromptId`**；生成链路拼接顺序仍为模板 → 画风 → **【分镜提示词内容】** → 正文。

---

## 第一百四十六阶段（创梦工坊 Step2：分镜 Tab / 视频 Tab 挂载模板芯片）

### 变更时间
2026-05-04

### 变更文件
- **`src/views/Step2Page.vue`**：右侧属性区 **分镜 Tab** 在图片模型选择下方增加 **生成分镜图模板**（**`generate-storyboard-image`**），**视频 Tab** 在视频模型选择下方增加 **生成视频模板**（**`generate-video`**）；默认选中 id **`8`** / **`9`**；**`handleGenerateImageFor`** 使用 **`resolveStep2StoryboardImageTemplate()`**，**`handleGenerateVideoFor`** 使用 **`resolveStep2VideoPromptTemplate()`**（空内容回退内置 id）
- **`src/locales/editorWorkshopLocales.ts`**：**`step2.tplSbImg`**、**`pickTplSbImg`**、**`tplVideoGen`**、**`pickTplVideoGen`**（中英）

### 变更原因
- 与 Step1 侧栏模板选择一致：分镜编辑时在对应 Tab 内切换提示词模板，无需依赖全局 **`getStoryboardImagePrompt()` / `getVideoPrompt()`** 隐式默认。

### 影响说明
- 批量生成分镜图 / 批量生成视频仍走同一 handler，随所选模板生效；模板列表与「提示词管理」子分类同步。

---

## 第一百四十五阶段（创梦工坊 Step1：人物/场景/道具生图模板迁至图片模型区）

### 变更时间
2026-05-04

### 变更文件
- **`src/views/Step1Page.vue`**：在右侧「图片模型」**模型选择**下方新增三行模板芯片（生成人物 / 生成场景 / 生成道具），列表数据来自 **`promptsStore.getSubCategoryPrompts('generate-character'|'generate-scene'|'generate-props')`**；默认选中 id **`5`/`6`/`7`**；**`handleGenerateAssetImage`** 通过 **`resolveAssetImageBasePrompt`** 按类型读取所选模板 **`getPromptContentById`**，空内容回退至 **`5`/`6`/`7`**；提取资产 / 生成分镜芯片的官方·自定义徽标改为 **`promptsPage.badgeOfficial` / `badgeCustom`**
- **`src/locales/editorWorkshopLocales.ts`**：**`step1.tplGenCharacter`**、**`tplGenScene`**、**`tplGenProps`**、**`pickTplGenCharacter`**、**`pickTplGenScene`**、**`pickTplGenProps`**、**`pickTplPlaceholder`**（中英）
- **`src/locales/zh-CN.ts`**、**`en-US.ts`**：**`promptsPage.badgeOfficial`**（中英）

### 变更原因
- 文档解析侧栏原先仅在「文字模型」下挂载文本类模板；人物/场景/道具 **生图** 所用模板与 **图片模型** 同属一条链路，需在图片模型区域可选择模板并与 **`generateImage`** 前缀拼接逻辑一致。

### 影响说明
- Step1 单张与批量资产生图均使用上述三类所选模板；切换模板后立即作用于后续生成（不设单独持久化 store，会话内 **`ref`**）。提示词库中新自定义条目会自动出现在对应 popover 列表中。

---

## 第一百四十四阶段（登录页左侧角色动画：对齐 login-animation-master 交互）

### 变更时间
2026-05-04

### 变更文件
- **`src/components/login/LoginEyeBall.vue`**（新建）：白眼球 + 瞳孔向量追踪、`forceLook` 覆盖、`isBlinking` 眨眼挤扁高度
- **`src/components/login/LoginPupil.vue`**（新建）：纯色瞳孔向量追踪与 `forceLook`
- **`src/components/login/LoginAnimatedCharacters.vue`**（新建）：四色角色 RAF 跟随鼠标、`setupBlink`、输入聚焦短时对视、`hasSecret && secretVisible` 时的捂密码与紫色间歇张望（逻辑参考桌面 **`login-animation-master`**）
- **`src/views/Login.vue`**：移除全局 `mousemove` + 统一瞳孔 RAF；左侧改为挂载 **`LoginAnimatedCharacters`**；表单 **`focusin`/`focusout`** 推导 **`isTyping`**；**`hasSecret`** 由 **`loginForm.password`** 非空推导；**`secretVisible`** 接 **`showPassword`**

### 变更原因
- 参考 **`login-animation-master`**：逐角色面部/body skew、眨眼与密码可见语义动画，替换原先整块同名偏移与「闭眼」简化逻辑，交互更丰富且不依赖 **`document.querySelector('.animation-area')`**。

### 影响说明
- 仅登录页左侧展示与动画挂载方式变更；登录/注册/找回业务流程与云端鉴权不变。角色组件内另有 **`window.mousemove`**（与参考一致），卸载时已移除 RAF 与定时器。

---

## 第一百四十三阶段（画布工坊：自由画板节点集成 Excalidraw，导出到图片节点）

### 变更时间
2026-04-30

### 变更文件
- **依赖**：**`react`、`react-dom`、`@excalidraw/excalidraw`**；开发依赖 **`@vitejs/plugin-react`**、**`@types/react`**、**`@types/react-dom`**
- **`vite.config.ts`**：**`@vitejs/plugin-react`**（**`*.tsx`**）与 **`optimizeDeps.include`**
- **`src/excalidraw-bridge/ExcalidrawWorkbench.tsx`**：**Excalidraw** 嵌入：**`UIOptions`** 关闭 **`loadScene/saveAsImage/export`** 中与文件/多端导出菜单；画布主题随 **`themeStore`**，**`langCode`** 随 **`zh-CN`** / **`en`**；**`serializeAsJSON`** 持久化快照；绘图变更时清空 **`element.link`** 写入序列化（宿主侧导出同样去链接）
- **`src/components/canvas/ExcalidrawFreeboardCanvasNode.vue`**：React **`createRoot`** 挂载工作台；防抖写入节点 **`data.excalidrawJSON`**；**「导出到图片节点」** 使用 **`exportToBlob`** PNG；**卡片 `requestFullscreen`**：**全屏/退出全屏** 按钮（与 **`canvas.nodeUi.common.fullscreen`** 文案一致）；**双击标题栏**亦可切换；**`:fullscreen`** 样式使画板区铺满并 **`resize`** 通知 Excalidraw
- **`src/views/CanvasEditor.vue`**：双击菜单在 **文本** 下一项：**`freeboard`**；**`nodeTypes.excalidrawFreeboard`**；**`addNodeAtPosition('excalidrawFreeboard')`**
- **`src/locales/zh-CN.ts` / `en-US.ts`**：**`canvas.menus.freeboard*`**、**`nodeDefaults.freeboardLabel`**、**`canvas.nodeUi.excalidraw.*`**

### 变更原因
- 画布工坊需手写白板能力与 Excalidraw 一致的体验，且不引入协作/E2EE/JSON 导出等产品能力；绘图结果导出为画布内 **`imageCanvas`**（**`uploadedMainImageUrl`**）供下游生图链路使用。
- UI 中英走现有 **`vue-i18n`**；工作台内 Excalidraw 内置文案随 **`langCode`**（简中 **`zh-CN`**、英文 **`en`**）。

### 影响说明
- 安装包/renderer 体积因 **React + Excalidraw** 增加；大图元 + 防抖持久化仍会增大项目 JSON。**`excalidrawJSON`** 首帧后即由编辑器接管，不向 React 回填每次 **`updateNodeData`**，以免整板重置。
- **`vite.config.ts`**：已与 **`@vitejs/plugin-vue`** 同仓共用 **`@vitejs/plugin-react`** 时易出现整页白屏；改为仅用 Vite 内置 **`esbuild.jsx: 'automatic'`** 编译 **`*.tsx`**，并卸载 **`@vitejs/plugin-react`**。

---

## 第一百四十二阶段（Electron 启动屏：Logo +「星梦正在启动中」，主界面就绪后关闭）

### 变更时间
2026-04-29

### 变更文件
- `electron/splashHtml.ts`：**`buildSplashHtml`** — data URL 内嵌 HTML；Logo 为 **`public/icon.ico`** 经主进程 **`nativeImage`** 转 PNG base64 的 **`<img>`**，缺失或解码失败时用内联矢量备用；文案与轻量 CSS 动画不变
- `electron/main.ts`：**`resolveSplashIconPath` / `getSplashLogoDataUrl`**；**`createSplashWindow` / `closeSplashWindow`**；**`createWindow`** 起始创建启动屏；**`showMainWindowOnce`**（**`shell-ready`** 与兜底超时）中先 **`closeSplashWindow`** 再 **`mainWindow.show`**；用户确认退出时顺带关闭启动屏
- **`package.json`**：**`build.files`** 增加 **`public/icon.ico`**，确保安装包内启动屏能读到与安装器相同的图标文件

### 变更原因
- 冷启动加载期间主窗口保持隐藏时出现黑屏或长时间无反馈；先展示无边框启动窗改善体感，与 **`notifyShellReady`** 后主窗显示的流程衔接。Logo 与 **`win.icon`** 同源 **`public/icon.ico`**，避免两套图。

### 影响说明
- 启动时会多一枚临时置顶小窗，主进程 **`show`** 或超时兜底时关闭。启动屏不使用 **`preload`**、不挂载业务逻辑。若 **`icon.ico`** 未打进包或路径异常，日志 **`warn`** 且仍显示矢量备用图。

---

## 第一百四十一阶段（Electron 启动提速：首屏后再 show + 去掉全量图标注册）

### 变更时间
2026-04-29

### 变更文件
- `src/main.ts`：删除 **`@element-plus/icons-vue` 全量 `app.component`**；在 **`router.isReady()` + `nextTick` + 双 **`requestAnimationFrame`** 后调用 **`window.electronAPI.notifyShellReady()`**（仅存在时），减轻首包解析量并配合主进程晚一点 **`show`**
- `electron/preload.ts` / `electron/main.ts`：**`shell-ready` IPC**；主窗口改为 **`ipcMain.once('shell-ready')`** 再 **`show`**，并保留 **8s** 兜底 **`setTimeout`**，去掉原 **`ready-to-show` / `did-finish-load+320ms`** 的过早显示
- `src/vite-env.d.ts`：为 **`notifyShellReady`** 补类型

### 变更原因
- 打包后双击先见黑底再数秒才像「打开完成」：主进程过早 **`show`** 时 Vue 尚未挂载；全量注册图标放大 **`index` chunk**、拖慢首帧。

### 影响说明
- 窗口出现时刻略晚于「HTML 加载完」，但出现时更接近「当前路由首屏已就绪」，黑屏/空壳感减弱。浏览器调试无 **`electronAPI`** 时仍仅靠超时兜底（仅 Electron 生产路径有 **`notifyShellReady`**）。各页图标需在 **SFC 内自行 `import` Icons**（沿用项目既有写法）。

---

## 第一百四十阶段（创梦工坊 Step2：界面与 ElMessage 全量 i18n）

### 变更时间
2026-04-29

### 变更文件
- `src/views/Step2Page.vue`：分镜编辑页模板文案、**`ElMessage`**、提示词中的分镜标记、剪映默认项目名、定时倒计时字符串、视频超时判断（**`timeout`** + **`超时`**）、**`currentStoryboardAssets`** 默认名、**`getVideoDuration`** 错误文案等，统一走 **`editorWorkshop.step1` / `editorWorkshop.step2` / `editorWorkshop.messages`** 与 **`logsPage.msg.unknownErr`**；图片/视频侧模型分组使用 **`modelGroupOpts`**；补充 **`Upload` / `Refresh`** 图标导入，移除未使用的 **`ElMessageBox`** 导入；**模板结构**：还原误合并的 **`view-mode-switch`**（图片/视频两枚按钮）、左/右 **`timeline-arrow`** 与 **`add-item`** 的闭合层级，消除 **`plugin:vite:vue` 「Element is missing end tag」** 报错

### 变更原因
- 分镜编辑页在英文界面下大量按钮、侧栏、溶图对话框与气泡提示仍为中文；与全局 **`appLocale`** 一致。

### 影响说明
- 切换语言后 Step2 主界面与 **`ElMessage`** 随当前语言刷新；已写入 AI 提示词的 **`markerShotPrompt`** 以生成时语言为准（不随切换改写历史提示）。

---

## 第一百三十九阶段（步骤二：最近日志正文 i18n — 批量分镜/视频/定时/匹配/剪映）

### 变更时间
2026-04-29

### 变更文件
- `src/views/Step2Page.vue`：**`logsStore.addLog`** 中批量生成分镜图、批量生成视频、定时视频任务、资产匹配/批量匹配、剪映导出、手动匹配与移除匹配等，由硬编码中文改为 **`LogI18nPayload`**（**`messageKey`/`detailKey`/`detailParams`/`detailRaw`**），与 **`src/locales/logsPageMsgs.ts`** 及 **`logsPage.msg.*`** 一致

### 变更原因
- 「最近日志」列表在英文界面下仍会显示写入时的中文标题与详情；与全局语言切换一致需存键与参数，由 **`LogsPage`** 侧 **`t()`** 解析展示。

### 影响说明
- 历史 localStorage 中的旧日志仍为纯字符串；新产生的步骤二相关日志随 **`appLocale`** 切换语言。错误类接口原文仍通过 **`detailRaw`** 附加。

---

## 第一百三十八阶段（登录页移除语言切换入口）

### 变更时间
2026-04-29

### 变更文件
- `src/views/Login.vue`：删除右下角 **语言切换按钮** 及 **`toggleLocale` / `.login-lang-btn`**；语言仅通过 **窗口标题栏** 入口切换（ **`userStore.appLocale`/`setAppLocale`** 行为不变）

### 变更原因
- 产品要求中英文切换只保留顶部标题栏一处，登录页重复入口移除。

### 影响说明
- 登录态仍跟随全局已保存的语言与 Element Plus **`locale`**；未登录需在标题栏切换。

---

## 第一百三十七阶段（画布：切割结果标题 / 图片工具弹窗与中英）

### 变更时间
2026-04-29

### 变更文件
- `src/locales/zh-CN.ts`、`src/locales/en-US.ts`：新增 **`canvas.nodeUi.imageTools`**（裁剪/标注/切割弹窗全文案）；**`canvas.nodeUi.imageNode.genImageRunning`**
- `src/components/canvas/ImageNodeImageToolsDialog.vue`：`useI18n`；标题、表单、脚注、气泡与 **`ElMessage` / `ElMessageBox.prompt`** 全部走 **`imageTools.*`**；裁剪说明区域 **`v-html`** 使用受控双语 HTML
- `src/components/canvas/ImageSplitResultNode.vue`：**`nodeTitleI18n`** 类型声明；头部标题 **`useCanvasNodeTitle` + `preferFallbackOverPersisted`**；合并导出节点前缀与展示一致随语言刷新
- `src/components/canvas/ImageCanvasNode.vue`：切割结果写入 **`nodeTitleI18n`** 与 **`imageSplit.defaultTitle`**；拆分格默认 **`storyboardShotDescTpl`**；裁剪/标注/视角副节点 **`imageNode.*`** **`ElMessage`**；**`handleGenerate`** 与占位遮罩、生成按钮、「裁剪/标注/切割」、画质/比例/模型面板、`apiGroupLabelMap` 等与 **`canvas.nodeUi`/`common`** 对齐

### 变更原因
- 切割流程与图片工具对话框在英文界面下仍为中文；生成态遮罩与主按钮未随 **`appLocale`** 切换。

### 影响说明
- 裁剪说明 HTML 仅来自本项目 locale，无外部输入；切割历史节点仍可能带中文 **`label`**，标题用 **`preferFallbackOverPersisted`** + **`nodeTitleI18n`** 拉回当前语言。

---

## 第一百三十六阶段（画布：文本处理 / 章节识别 / 总资产 / 资产详情标题随语言）

### 变更时间
2026-04-29

### 变更文件
- `src/composables/useCanvasNodeUiI18n.ts`：`canvasNodeDisplayTitle` 增加可选 **`preferFallbackOverPersisted`**；为 `true` 时无 **`nodeTitleI18n`** 则先 **`t(fallbackKey)`** 再退回 **`label`**，避免持久化中文标题盖住中英切换；（图片节点等不传该项，仍为 **`nodeTitleI18n` → `label` → fallback**）
- `src/views/CanvasEditor.vue`：**`buildNewTextProcessNodeData`** 写入 **`nodeTitleI18n: { key: 'canvas.nodeDefaults.textLabel' }`**；画布工具栏拖拽创建的 **`textAssetDetail`** 套餐写入与分组一致的 **`comboDetailLabels.*`** 标题键
- `src/components/canvas/TextProcessCanvasNode.vue`：头部与 LOD 壳标题改用 **`canvasNodeDisplayTitle`** + **`canvas.nodeDefaults.textLabel`**（**`preferFallbackOverPersisted: true`**）；**`TextProcessNodeData`** 增加可选 **`nodeTitleI18n`**
- `src/components/canvas/TextChapterResultCanvasNode.vue`、`src/components/canvas/TextAssetResultCanvasNode.vue`：画布标题同上传递 **`preferFallbackOverPersisted: true`**
- `src/components/canvas/TextAssetDetailCanvasNode.vue`：存在 **`assetCategory`** 时优先 **`comboDetailLabels.*`**，再考虑持久化 **`label`**，避免冻结中文盖住英文界面

### 变更原因
- 历史数据与非流程创建的资产节点仅存 **`label`**，切换 **`appLocale`** 后章节识别、总资产、文本处理与人/景/道具详情头等仍停留在创建时语言；与 **`vue-i18n`** 语义不一致。

### 影响说明
- 对上述「语义固定」节点，若用户曾自定义 **`label`** 且未设置 **`nodeTitleI18n`**，切换语言后以 **fallback / 分类键** 的译文为准（与「宁可跟语言也不要冻中文」一致）；自定义标题可走后续扩展 **`nodeTitleI18n`** 或使用无 **`assetCategory`** 的详情路径。

---

## 第一百三十五阶段（登录页背景改为与主页一致的视频）

### 变更时间
2026-04-29

### 变更文件
- `src/views/Login.vue`：移除粒子/渐变漂移/光斑/波浪等 **CSS 动态背景**；与 `Home.vue` 相同使用 **`/SP.mov`** + **双 `requestAnimationFrame` 延后赋 `src` 与 `play()`**；叠加层与 **`object-fit: cover`、滤镜** 与主页一致；语言按钮补充 **定位与 z-index** 以免被挡

### 变更原因
- 登录与首页视觉统一，去掉装饰性动画以降低干扰与 GPU 占用。

### 影响说明
- 依赖与主页相同的静态资源 **`SP.mov`**；无登录逻辑变更。

---

## 第一百三十四阶段（最近日志页 / 提示词管理页 / 画布提示词功能区 i18n）

### 变更时间
2026-04-29

### 变更文件
- `src/locales/zh-CN.ts`、`src/locales/en-US.ts`：新增 **`logsPage`**、`**promptsPage**`；`canvas.nodeUi.common` 增加 **`toolbarPromptPlaceholder`**、**`promptToolbarAria`**（原 video/textProcess 内重复占位文案删除并归并到 common）
- `src/views/LogsPage.vue`：界面与级别、分类名、清空/刷新 **`ElMessage`** 随语言切换；分类标签由 **`logsPage.typeNames.*`**（kebab **`LogType` → camelCase 键**）解析
- `src/views/PromptsPage.vue`：侧栏/标题/按钮/警示/预设名与 **`ElMessage`** 走 **`promptsPage.*`**；预设 **`default` / `preset-2`** 展示名与 store 内中文 label 解耦
- `src/components/canvas/ImageCanvasNode.vue`、`StoryboardGenCanvasNode.vue`、`VideoCanvasNode.vue`、`TextProcessCanvasNode.vue`：提示词占位统一 **`common.toolbarPromptPlaceholder`**；参考图按钮 title 接 **`imageNode.addRefAria`**；底部参考图+提示词区域 **`role="group"`** + **`promptToolbarAria`**
- `src/constants/canvasToolbar.ts`：**删除**（已无引用，占位改走 i18n）

### 变更原因
- 「最近日志」「提示词管理」与画布节点底部「提示词功能区」在英文界面下与全局 **`appLocale`** 一致。

### 影响说明
- 历史日志 **message/details** 仍为写入时的语言；仅 UI 壳与分类/级别标签英文化。

---

## 第一百三十三阶段（系统设置 · 个人中心 / API / 模型 / 界面 / VIP 与画布工具条 i18n）

### 变更时间
2026-04-29

### 变更文件
- `src/locales/zh-CN.ts`、`src/locales/en-US.ts`：`settings.msg` 增加 **`updateAlreadyLatest`**、**`updateErrTpl`**；`canvas.nodeUi.controls` 增加 **`toolbarAria`**（画布左下工具条无障碍标签）
- `src/components/SettingsDialog.vue`：**个人中心、API、模型管理、界面设置、VIP 与支付弹窗** 模板与 **`ElMessage` / `ElMessageBox`** 全面接 **`settings.profile` / `settings.api` / `settings.model` / `settings.ui` / `settings.vip` / `settings.msg`**；VIP 套餐为 **`computed`** 随语言刷新；**`passwordRules`** 为 **`computed`**
- `src/components/canvas/CanvasControls.vue`：工具条容器 **`role="toolbar"`** + **`aria-label` → `toolbarAria`**

### 变更原因
- 系统设置上述页签与 VIP 流程、画布「功能区」控件随 **`appLocale`** 中英切换；提示与表单校验文案与 Element Plus 语言一致。

### 影响说明
- 无业务逻辑变更；日志 `logsStore.addLog` 中文说明未改（仅界面与 Toast）。

---

## 第一百三十二阶段（系统设置 · 数据存储与剪映草稿 i18n）

### 变更时间
2026-04-29

### 变更文件
- `src/locales/zh-CN.ts`、`src/locales/en-US.ts`：在 **`settings.dataStorage`** 下增加当前/默认路径、按钮、自动保存说明、三条提示、默认位置标题、剪映区块标题与草稿说明等
- `src/components/SettingsDialog.vue`：数据存储与剪映草稿区域全部 **`t('settings.dataStorage.*')`**（平台路径行仍为技术常量）

### 变更原因
- 英文界面下该页与全局 `appLocale` 一致；与用户截图标注的标签、按钮、说明文案对齐。

### 影响说明
- 无数据路径逻辑变更，仅展示文案随语言切换。

---

## 第一百三十一阶段（主页 / 侧栏 / 项目列表 / 设置关于 / 品牌化 & 路由标题 i18n）

### 变更时间
2026-04-29

### 变更文件
- `src/locales/zh-CN.ts`、`src/locales/en-US.ts`：新增 **`brand`、`routes`、`sideNav`、`homePage`、`projectList`、`settings`**（含内置公告、`Flow2`/关于页状态英文、画布新建对话框键等）
- `src/env-router-meta.d.ts`：**`vue-router` `RouteMeta.titleKey`** 增强（独立于 `vite-env`，避免 ambient 被破坏）
- `src/router/index.ts`：路由 **`meta.titleKey`**；移除手写中文 `document.title`
- `src/App.vue`：根据 **`matched` 末端 `titleKey` + `brand.appName`** 同步 **`document.title`**
- `src/components/layout/AppTitleBar.vue`：应用名为 **`t('brand.appName')`**（英文为 StarDream Studio，中文仍为 星梦动画）
- `src/components/layout/SideNav.vue`：侧栏 **`t(sideNav.*)`**，修正跳转判断为 **`step1`/`step2`**
- `src/components/home/AnnouncementPanel.vue`：公告列表 **`t(homePage.ann*)`**
- `src/views/Home.vue`：主页弹层（公告/检测更新/更新日志）、创作区、`ElMessage`、`formatDate`、`Upload` 图标、协议标题/页脚等 **`t()`**（协议正文仍中文）
- `src/views/ProjectList.vue`、`CanvasProjectList.vue`：搜索/新建/回收站、右键与对话框、`ElMessage*`，**`dialogCreateCanvasTitle`**
- `src/components/SettingsDialog.vue`：侧栏标题与分类、关于页产品与更新文案、**发现新版本 `ElMessageBox`、Flow 状态条**

### 变更原因
- 主工作台、侧栏工坊入口、列表页操作与回收站随 **`userStore.appLocale`** 切换；品牌化英文界面使用 **StarDream Studio**。
- 浏览器/Electron **`document.title`** 与画布等子页标题随语言与路由一并更新。

### 影响说明
- 服务条款**正文**仍为中文（法律文本未翻）；英文下仅外层标题、「知道了」类按钮等为英文。
- 历史数据中项目名前缀（如 `项目_`、`星梦无限画布_`）不随切换改写；新建项目会使用当前语言的 **`homePage.projNamePrefix` / `canvasProjNamePrefix`**。

---

## 第一百三十阶段（登录页中英文 + 语言切换与 titleBar 缩写键）

### 变更时间
2026-04-29

### 变更文件
- `src/locales/zh-CN.ts`、`src/locales/en-US.ts`：`loginPage` 全量文案；`titleBar.switchToEnAbbrev` / `titleBar.switchToZhAbbrev`（语言按钮缩写，登录页与标题栏共用）
- `src/views/Login.vue`：`useI18n`，表单占位、校验规则、`ElMessage`、左侧特性、卡片文案与 **`countdownLabel`** 随 `appLocale`；右上角语言切换与 `userStore.setAppLocale` 对齐 **`App.vue` → i18n**
- `src/components/layout/AppTitleBar.vue`：语言按钮缩写改为 **`t('titleBar.switchToEnAbbrev'|'switchToZhAbbrev')`**

### 变更原因
- 登录路由独立展示时需与全局中英文、Element Plus 语言包一致；避免硬编码中文校验与按钮文案。
- 语言切换按钮「EN / 中」走 i18n，便于后续改写或无障碍文案统一。

### 影响说明
- 切换语言后登录页表单校验消息与 placeholders 即时更新；持久化 **`userStore.appLocale`** 在进入画布后行为与第一百二十七阶段一致。

---

## 第一百二十九阶段（三维预设 id + 中英文；文本链节点标题 nodeTitleI18n）

### 变更时间
2026-04-29

### 变更文件
- `src/locales/viewport3dNodePresets.ts`（新建）：三维分类与预设 id→中英展示名，与 `Viewport3DCanvasNode` OBJECT_CATEGORIES 对齐
- `src/locales/zh-CN.ts`、`src/locales/en-US.ts`：`viewport3d.category` / `viewport3d.preset` 展开；`imageNode.storyboardShotImgTpl`
- `src/composables/useCanvasNodeUiI18n.ts`：`CanvasNodeTitleI18n`、`useCanvasNodeTitle().canvasNodeDisplayTitle`
- `src/components/canvas/Viewport3DCanvasNode.vue`：`modelKey` 存预设 id，`buildCompositeModel` 全部改为 id 分支 + 中文/旧 data 映射入 id；预设/分类按钮与对象列表用 `t()`；实例名 `{展示名} n` 随语言刷新
- `src/components/canvas/TextProcessCanvasNode.vue`：章节识别、总资产、资产详情、资产链图片节点写入 `nodeTitleI18n`
- `src/components/canvas/TextChapterResultCanvasNode.vue`、`TextAssetResultCanvasNode.vue`、`TextAssetDetailCanvasNode.vue`、`ImageCanvasNode.vue`：标题区使用 `canvasNodeDisplayTitle` 或 `nodeTitleI18n`；分镜输出图 LOD 与子标题中英

### 变更原因
- 英文界面下三维预设与分类按钮显示英文，同时保持几何逻辑稳定（id 驱动 + 兼容历史中文 `modelKey`）。
- 文本处理一键生成的章节/资产/图片节点标题随语言切换而更新：`data.label` 保留兼容，`nodeTitleI18n.key` 为稳定语义键。

### 影响说明
- 同名中文预设（如多分类下的「床」）在历史数据仅能映射到**先注册的 id**（当前为室内床）；新放置对象一律存 id，无歧义。
- **已保存画布**若无 `nodeTitleI18n` 仍只用 `label` 字符串显示（与既有策略一致）。

---

## 第一百二十八阶段（画布节点 UI 中英：视频 / 剧本处理 / 三维视图面板）

### 变更时间
2026-04-29

### 变更文件
- `src/locales/zh-CN.ts`、`src/locales/en-US.ts`：`canvas.nodeUi.video.toolbarPromptPlaceholder`、`canvas.nodeUi.textProcess` 增补（工具栏占位、资产/分镜导出节点文案、LLM 中英提示与 system 文案等）
- `src/components/canvas/VideoCanvasNode.vue`：修复 `storyboardGen` 上下文变量遮蔽 `t()`；比例/时长汇总与模板、消息、`CanvasGeneratingOverlay` 等全面 `t()`
- `src/components/canvas/TextProcessCanvasNode.vue`：`useCanvasNodeCommon`、文本模型分组、`ElMessage`、新建节点 label/description、用户可见 LLM 拼装文案随语言切换（预设解析正则仍面向中英文章标题混排）
- `src/components/canvas/Viewport3DCanvasNode.vue`：标题/侧栏/变换与相机/导出/全屏、`ElMessage`、导出图片节点 label/description 国际化；**预设库**：首版仍为中文展示名 tied to modelKey（见第一百二十九阶段改为 id+i18n）

### 变更原因
延续画布节点标题、按钮、提示与导出结果的中英文一致性；避免 Video 节点局部变量遮蔽 `t` 的运行时错误。

### 影响说明
- _viewport3d 预设中英与 id 迁移见第一百二十九阶段。_
- TextProcess：**新建**节点的 `label`/`nodeTitleI18n`；已落盘无 `nodeTitleI18n` 的仍为旧行为（第一百二十九阶段）。

---

## 第一百二十七阶段（vue-i18n + 画布功能区国际化 + 标题栏语言）

### 变更时间
2026-04-29

### 变更文件
- `package.json` / `npm`：`vue-i18n@9`
- `src/i18n/index.ts`、`src/locales/zh-CN.ts`、`src/locales/en-US.ts`（新建或扩展文案树）
- `src/main.ts`：`app.use(i18n)`
- `src/App.vue`：`ElConfigProvider`（Element Plus 语言包）+ `watch(userStore.appLocale)` 同步 `vue-i18n` 与 `document.documentElement.lang`
- `src/stores/userStore.ts`：`appLocale`、`setAppLocale`、persist `paths`
- `src/components/layout/AppTitleBar.vue`：最小化左侧语言切换按钮
- `src/views/CanvasEditor.vue`：画布顶栏、空状态、快照/快捷键/自定义风格对话框、右键与双击菜单、`ElMessage*` / 画布消息条等接入 `t()`

### 变更原因
- 采用 vue-i18n 主流栈实现中英文切换；首阶段覆盖画布编辑器功能区；标题栏控件位于窗口控制点前（最小化左侧），符合约定。

### 变更内容
1. Pinia 持久化 `zh-CN` / `en-US`，应用层与 Element Plus、`vue-i18n` locale 对齐。
2. 画布默认节点文案、资产组合、`migrateLegacyNodes` 中旧快照 label（如「图片生成」/ `Image generation`）与国际化并存。
3. 快捷键面板按四类（编辑 / 分组 / 选择 / 视图）渲染，快捷键说明随语言切换。

### 影响说明
- 画布节点 **`data.label`/`description`** 在用户切换语言后，**只对新建或通过迁移回填的默认值**随当前语言更新；已落盘图中的旧字符串不会自动重写（与业务数据兼容）。

---

## 第一百二十六阶段（画布性能：鸟瞰 LOD + 防抖落盘 + 历史档位数）

### 变更时间
2026-05-06

### 变更文件
- `src/composables/useCanvasLodLevel.ts`（新建）
- `src/views/CanvasEditor.vue`
- `src/components/canvas/ImageCanvasNode.vue`
- `src/components/canvas/VideoCanvasNode.vue`
- `src/components/canvas/StoryboardGenCanvasNode.vue`
- `src/components/canvas/TextProcessCanvasNode.vue`
- `src/components/canvas/VR360CanvasNode.vue`
- `src/utils/graphSnapshot.ts`（注释：data 体量建议）

### 变更原因
- 画布项目可出现大量节点；鸟瞰（低缩放）时同屏仍可能挂载过多富 UI（图/视频/WebGL），导致拖拽与缩放卡顿。需在「可操作流畅性」上与虚拟化、`immutable`、防抖存储、历史快照策略协同。

### 变更内容
1. **LOD（壳层 UI）**：视口缩放低于阈值（常量 `CANVAS_LOD_SHELL_ZOOM_THRESHOLD`，默认 0.38）时为 `shell`：图片/视频/分镜网格/正文大输入框/全景 WebGL 不挂载，仅标题式条带；放大后恢复完整编辑。注入键：`canvasLodLevelKey`、`canvasViewportZoomKey`。
2. **边动画**：低缩放鸟瞰时禁用连线 `animated`，与 LOD 阈值一致。
3. **防抖落盘**：`debouncedSaveSnapshot` 由 300ms 调至约 980ms，合并短时连续触发。
4. **历史**：撤销栈 `maxHistory` 12 → 10，略减大图场景下克隆尖峰峰值。
5. **懒加载**：主预览图、`img` 参考缩略、`video` 设置 `preload="none"` 等与壳层并存时减轻解码压力。
6. **graphSnapshot**：文档层说明应避免在 `node.data` 内长期塞超长 base64，以免 clone/ stringify 卡住主线程。

### 影响说明
- 缩小视图时需放大到约阈值 zoom 以上才显示节点内完整内容与工具栏。**按需 Worker**：未引入（当前瓶颈以 DOM/媒体为主；日后若有纯布局算法可再在 Worker 中跑）。

---

## 第一百二十五阶段（画布：返回按钮磨砂半透明底框）

### 变更时间
2026-04-29

### 变更文件
- `src/views/CanvasEditor.vue`

### 变更原因
- 画布顶部「返回」仅靠文字按钮在背景上可读性偏弱，需半透明磨砂底框与时间栏风格呼应。

### 变更内容
- 用 `.canvas-header-back-frost` 包裹返回按钮：`backdrop-filter` 磨砂、`rgba` 半透明底与细边框。

---

## 第一百二十四阶段（首页：系统公告弹窗默认展开）

### 变更时间
2026-04-29

### 变更文件
- `src/views/Home.vue`

### 变更原因
- 进入软件首页时希望「系统公告」气泡默认处于打开状态，减少一次点击。

### 变更内容
- `showAnnouncementPopup` 初始值由 `false` 改为 `true`。

### 影响说明
- 用户仍可点击关闭或「朕已阅」收起；点击公告图标仍可切换显示。

---

## 第一百二十三阶段（分镜生成：占位图节点 + 从左向右伪进度）

### 变更时间
2026-04-29

### 变更文件
- `src/components/canvas/StoryboardGenCanvasNode.vue`
- `src/components/canvas/ImageCanvasNode.vue`

### 变更原因
- 与参考项目 `F:\8.gongzuoliu` 一致：点击「生成」后立即在分镜节点右侧创建图片连线节点并开始请求；占位期间在图片节点上展示从左向右的渐变扫光与时间伪进度（非等图载入后再出现节点）。

### 变更内容
1. `StoryboardGenCanvasNode`：`createPendingStoryboardOutputNode` 在 API 前置空图节点与边（`storyboardGenerating`、`generationStartedAt` 等）；`finalizeStoryboardOutputNode` / `failStoryboardOutputNode` 在完成或失败时更新该节点。
2. `ImageCanvasNode`：占位态显示分镜专用扫光层与失败文案；计时器刷新使用 `window.setInterval` 的返回类型与其它 DOM API 一致。

### 补（同日）
- 分镜本体节点移除生成遮罩动画与图标旋转（进度集中到右侧占位图节点）；占位节点展示「预计约 1-3 分钟，当前进度 xx%」，图标与文案在预览区水平垂直居中并叠在扫光层之上。

### 影响说明
- 分镜批量多次输出时仍可沿用原有右侧堆叠与 `#N 分镜图片 XX` 标签编号逻辑。

---

## 第一百二十二阶段（分镜编号：镜头 N → Grid N，提示词与解析对齐）

### 变更时间
2026-04-29

### 变更文件
- `src/components/canvas/StoryboardGenCanvasNode.vue`
- `src/components/canvas/VideoCanvasNode.vue`
- `src/components/canvas/TextProcessCanvasNode.vue`（仅等待文案）
- `src/utils/storyboardGridReference.ts`
- `src/stores/promptsStore.ts`（默认内置模板，`id` 为 3/4/8/9 等与分镜结构相关的条目）

### 变更原因
- 产品要求分镜占位与拼装统一使用 Grid1、Grid2…命名，替换原「镜头1、镜头2…」在：**画布分镜拼装、视频上游摘要、内置提示词默认值、线框推断**等处。

### 变更内容
1. `StoryboardGenCanvasNode`：`buildStoryboardDescription`、宫格占位、线框附录说明等均改为 Grid 序号用语。
2. `inferShotsFromStoryboardText`：优先扫描 `GridN`（含中英文冒号等），再兼容旧文案 `镜头 N`。
3. `promptsStore`：`id` 3/4/8/9 模板中条目编号与 `#Grid 条目格式/数量规则` 等用词与上文一致（保留泛指「镜头语言」「运镜」等专业表述未机械替换）。
4. `VideoCanvasNode.extractStoryboardGenPromptText`：`Grid${i}` 前缀对齐画布。
5. 文本节点「正在生成分镜」等待文案改为按 Grid 格子拆分表述。

### 影响说明
- 用户若在「提示词管理」中改过内容，仍以用户本地覆盖为准；本阶段仅变更 `defaultPrompts` 内置默认。**历史项目**里仍为「镜头」开头的正文可被 `inferShotsFromStoryboardText` 兼容。
- **补**：`defaultPrompts['3']` 长模板若为反引号字符串，正文内禁止使用未转义的 `` `...@...` `` 代码样式（会打断模板字面量）；已改为「@」括号表述，并在 `'3'` 结束符与 `'4'` 之间补逗号。

---

## 第一百二十一阶段（OpenAI/Grok 视频任务失败：`PUBLIC_*` code 可读提示）

### 变更时间
2026-04-29

### 变更文件
- `src/services/apiService.ts`

### 变更原因
- 网关轮询 `/videos/:id` 失败时返回 `PUBLIC_ERROR_AUDIO_FILTERED` 等英文 code，仅展示原始串用户难以理解；部分响应中 `error` 还可能为不带 `message` 的结构。

### 变更内容
1. 新增 `pickVideoTaskErrorPayload`、`pickVideoPayloadFromHttpError`、`describeVideoGenerationFailure`：解析 `error` 字符串或对象字段，并对 `PUBLIC_ERROR_AUDIO_FILTERED`、`PUBLIC_ERROR_CONTENT_FILTERED` 映射为简短中文说明与处置建议。
2. `generateOpenAIVideo` / `generateGrokVideo`：创建任务的 HTTP 非 200 与轮询 `failed` 分支统一走上述格式化后再 `throw`。

### 影响说明
- 不改变请求参数与安全策略本身；仍为服务端风控结果；仅改善前端报错文案与解析健壮性。

---

## 第一百二十阶段（三维视图：上游全景接入球幕 360° 背景）

### 变更时间
2026-04-29

### 变更文件
- `src/components/canvas/Viewport3DCanvasNode.vue`

### 变更原因
- 从左输入接入全景图（尤其来自「三维全景」节点）时原逻辑将图贴到远处平面，无法得到 360° 环顾效果；需与 `VrPanoView` 一致使用等距柱状贴图 + 球壳内侧显示。

### 变更内容
1. 统一 `resolveUpstreamDisplay()`：同时解析上游 URL 与来源类型（`imageCanvas` / `vr360`），与 `resolveUpstreamImageUrl` 顺序一致。
2. 节点数据增加可选 `panoBackground`：`true`/`false` 显式覆盖；未设置时仅当**当前生效上游为 VR360 节点**默认启用全景球幕。
3. `syncBackground`：全景模式下使用大半径 `SphereGeometry` + `MeshBasicMaterial` + `BackSide`、位置对齐轨道目标 `(0,0.8,0)`，与全景节点视觉语义一致；非全景仍用原平面背景。
4. 对象列表上方增加「全景360°背景」勾选（有参考图时显示），便于从**图片节点**接入等距全景时手动开启。

### 影响说明
- 从 VR360 连入三维视图即默认 360° 背景；纯图片节点连入仍为平面，需勾选开启全景模式。

---

## 第一百一十九阶段（云端 API 基址可配置 + 登录 404 提示）

### 变更时间
2026-04-28

### 变更文件
- `src/config/cloudApi.ts`（新建）
- `src/views/Login.vue`
- `src/App.vue`
- `src/stores/userStore.ts`
- `src/components/SettingsDialog.vue`

### 变更原因
- 线上 `xmdm.ussn.cn` 若未部署 `server` 中 PHP 或 Nginx 未按 `server/README.md` 配置，`/api/auth/index.php` 会由 Nginx 直接返回 **404**，与前端逻辑无关；需便于改域名并给用户明确提示。

### 变更内容
1. 新增 `cloudApi.ts`：`CLOUD_API_ORIGIN` 默认 `https://xmdm.ussn.cn`，可通过 **`VITE_CLOUD_API_ORIGIN`** 覆盖；提供 `cloudAuthUrl`、`cloudPaymentUrl`。
2. 登录、发码、个人资料、支付等请求改为使用上述方法拼接 URL。
3. `Login.vue` 在登录/发验证码请求 **`response.status === 404`** 时提示检查服务端部署或环境变量。
4. **补**：`fetchCloudAuth` / `fetchCloudPayment` 在 **`/api/.../index.php?action=`** 返回 404 时自动再请求 **`/auth/{action}`**、**`/payment/{action}`**（与 `server/.htaccess` 伪静态一致），适配仅配了伪静态、未直接暴露 `index.php` 的 Nginx；两次皆 404 时再提示。

### 影响说明
- 恢复服务：将 `server` 部署到站点目录并配置 Nginx（参见 `server/README.md`）。若 API 临时挂在其他域名，构建前设置 `VITE_CLOUD_API_ORIGIN` 即可。

---

## 第一百一十八阶段（鉴权备用：X-Auth-Token + JSON/Query accessToken）

### 变更时间
2026-04-28

### 变更文件
- `server/includes/jwt.php`
- `server/api/auth/index.php`
- `server/api/payment/index.php`
- `server/api/apikey/index.php`
- `server/api/version/index.php`
- `src/stores/userStore.ts`
- `src/App.vue`
- `src/components/SettingsDialog.vue`

### 变更原因
- 部分反代会剥掉 `Authorization`，仅 Bearer 时支付接口 401。
- 线上实测 `OPTIONS` 预检仍为 `Allow-Headers: Content-Type, Authorization` 时，若前端再增加未声明的自定义头会导致预检失败；故支付链路增加**不依赖新 CORS 头**的备用传参。

### 变更内容
1. `jwt.php`：`getJwtTokenStringFromRequest()` 仍支持 `Bearer` 与 `X-Auth-Token`。新增 `resolveAuthUser(?array $jsonBody)`，`requireAuth(?array $jsonBody)` 在头解析失败后依次尝试 **JSON 字段 `accessToken`**、**GET `accessToken`**。`getAuthUser()` 等价于 `resolveAuthUser(null)`（仅头 + query，无 body）。
2. `payment/create`：`requireAuth($input)`，创建订单请求体带 `accessToken`。
3. `payment/order`（GET）：轮询 URL 增加 query `accessToken`（头仍带 Bearer，双保险）。
4. 各 API：`Access-Control-Allow-Headers` 含 `X-Auth-Token`（可选；前端当前仅 Bearer + body/query，与旧版 CORS 兼容）。
5. `userStore.getAuthFetchHeaders()` 仅 `Authorization: Bearer`；`App.vue` / `refreshUserInfo` 沿用该方法。

### 影响说明
- **必须部署**更新后的 `jwt.php` 与 `payment/index.php`，否则 body/query 中的 token 不会被接受。部署后即使 `Authorization` 未到达 PHP，支付创建与订单查询仍可通过 `accessToken` 鉴权。Token 出现在 URL 时可能进入访问日志，属与可用性权衡。

---

## 第一百一十七阶段（VIP 下单 401：Authorization 经 Rewrite 传入 + 前端校验 token）

### 变更时间
2026-04-28

### 变更文件
- `server/.htaccess`
- `server/includes/jwt.php`
- `src/components/SettingsDialog.vue`

### 变更原因
- 支付接口走 Apache `RewriteRule` 时，`Authorization` 常无法以 `getallheaders()['Authorization']` 形式进入 PHP，`requireAuth()` 误判未登录返回 401。
- 前端在 token 为空或接口 401 时缺少明确提示。

### 变更内容
1. `.htaccess`：对 `HTTP:Authorization` 使用 `RewriteRule … [E=HTTP_AUTHORIZATION:%1]`，使 PHP 可读 `$_SERVER['HTTP_AUTHORIZATION']`。
2. `jwt.php`：新增 `getAuthorizationHeaderValue()`，合并 `getallheaders`（不区分大小写）、`HTTP_AUTHORIZATION`、`REDIRECT_HTTP_AUTHORIZATION`。
3. `SettingsDialog.vue`：`handlePurchaseVip` 在请求前校验 token；`response.status === 401` 时优先展示接口 `message` 并提示重新登录。

### 影响说明
- 部署需同步更新服务端 `.htaccess` 与 `jwt.php` 后，已登录用户带 Bearer 的下单请求应能正常鉴权；若 token 过期仍返回 401，前端提示更清晰。

---

## 第一百一十六阶段（启动提速：窗口尽早显示 + 首页背景视频延后解码）

### 变更时间
2026-04-28

### 变更文件
- `electron/main.ts`
- `index.html`
- `src/views/Home.vue`

### 变更原因
- 仅依赖 `ready-to-show` 时，SPA 首帧较晚，用户长时间黑屏或迟迟看不到窗口。
- 首页 `SP.mov` 背景在首帧即加载/解码，易阻塞主线程，拉长 `ready-to-show`。
- 开发模式下启动立即 `openDevTools()` 会明显拖慢首屏。

### 变更内容
1. `main.ts`：`did-finish-load` 后约 320ms 与 `ready-to-show` 双通道 `show()`（幂等），尽快亮窗；开发环境 DevTools 延后约 1.2s 再打开。
2. `index.html`：`html/body` 默认背景 `#0d0d0d`，避免白闪。
3. `Home.vue`：背景 `video` 使用 `preload="none"`，在 `onMounted` 双 `rAF` 后再赋 `src` 并 `play`；项目列表 `loadProjects` 改为不阻塞 `onMounted` 的异步链。

### 影响说明
- 启动后更快出现窗口与首页布局；背景视频略晚于首帧出现，属可接受权衡。

---

## 第一百一十五阶段（设置内检查更新：发现新版本改为 MessageBox 弹窗）

### 变更时间
2026-04-28

### 变更文件
- `src/components/SettingsDialog.vue`

### 变更原因
- `onUpdateStatus` 在 `available` 时使用 `ElMessage.success`，表现为顶部轻提示，用户期望与启动时类似的居中弹窗提示。

### 变更内容
1. `available`：去掉 `ElMessage`，改为 `ElMessageBox.alert`（标题「发现新版本」），并 `activeTab = 'about'` 便于直接看到「下载并安装更新」。
2. `checking`：去掉重复的「正在检查更新」`ElMessage`（界面已有检查中状态）。

### 影响说明
- 在设置中检查到新版时以弹窗确认；启动时仍使用 `AppStartupUpdateDialog`（未改）。

---

## 第一百一十四阶段（总资产合并：shallowRef 刷新 + 分组基线 + 边列表补同步）

### 变更时间
2026-04-28

### 变更文件
- `src/utils/mergeTextAssetDetailIntoTotal.ts`
- `src/views/CanvasEditor.vue`
- `src/components/canvas/TextAssetDetailCanvasNode.vue`

### 变更原因
- 画布 `nodes` 为 `shallowRef`，仅 `updateNodeData` 原地改总资产节点 `data` 时，自定义总资产节点可能不重绘，表现为连线后列表仍无新资产。
- 合并时若只读 `groupedAssets`、而历史数据仅扁平 `assets` 有内容，会误把原有资产基线当空，与节点展示逻辑不一致。
- 从快照恢复时可能仅有边、未再次触发 `connect`，需在边列表变化时补跑合并。

### 变更内容
1. `mergeTextAssetDetailIntoTotal.ts`：新增 `baselineGroupedAssetsFromTotalData`（与 `TextAssetResultCanvasNode` 分组/扁平回退一致）、`inferAssetCategoryFromDetailData`（缺 `assetCategory` 时按详情 `label` 推断）、`patchTextAssetResultNodeInNodesList`（替换 `nodes` 数组项强制刷新）。
2. `CanvasEditor`：`syncTextAssetDetailConnectionToTotal` 使用上述基线/推断/补丁；`watch` 边 id/source/target 签名，在 `nextTick` 中对每条边尝试合并（幂等）。
3. `TextAssetDetailCanvasNode`：改名同步总资产时同样使用基线、推断与节点列表补丁。
4. `mergeTextAssetDetailIntoTotal`：`groupedAssets` 各组数组中若含 `null`（脏快照），合并前 `compactAssetList` 过滤；`findIndex` 用 `String(a.id ?? '')` 比对。
5. 删除 `textAssetDetail` 或删除「总资产↔详情」边时：`removeDetailNodeFromTotalAssets` 从总资产分组剔除对应项（先按资产 id === 详情节点 id，否则按提取链路 id `asset-detail-{cat}-{ts}-{index}` 下标删除）；`CanvasEditor` 的 `deleteSelected` 与删除连线菜单中调用。
6. Vue Flow 内置 `Delete` 与窗口 `deleteSelected` 冲突会导致删了节点却未同步总资产：`delete-key-code` 置为 `null`，统一走窗口删除逻辑；并注册 `onNodesChange` 在移除 `textAssetDetail` 前按边快照调用 `removeDetailNodeFromTotalAssets`；`pruneOrphanedAssetDetailLinkedEntriesInTotals` 在节点 id 集合变化后剔除已无对应节点的 `asset-detail-*` 条目。

### 影响说明
- 手动连线或载入已有边后，总资产分组应稳定出现对应详情资产；编辑详情名称仍同步总资产。
- 删除资产详情节点或拆掉与总资产的连线后，总资产列表同步减少对应条目。

---

## 第一百一十三阶段（总资产 ↔ 资产详情连线：双向 source/target 同步）

### 变更时间
2026-04-28

### 变更文件
- `src/views/CanvasEditor.vue`
- `src/components/canvas/TextAssetDetailCanvasNode.vue`

### 变更原因
- Vue Flow 在 Loose 模式下可从任一端拖线，`source`/`target` 可能为「详情 → 总资产」；原逻辑仅处理「总资产 → 详情」，导致合并 `groupedAssets` 不执行，总资产列表不显示新连上的详情节点。
- 详情节点内改名同步仅查找 `target === 详情` 的边，同样漏掉反向连线。

### 变更内容
1. `CanvasEditor`：`onConnect` 在 `nextTick` 中调用 `syncTextAssetDetailConnectionToTotal`，同时识别 `textAssetResult`↔`textAssetDetail` 两种端点顺序后写入总资产数据并 `triggerAutoSave`。
2. `TextAssetDetailCanvasNode`：`syncToTotalAssetNode` 遍历边，在详情为 `source` 或 `target` 时解析对端 `textAssetResult` 并合并。

### 影响说明
- 无论从哪一侧完成「总资产—人物/场景/道具详情」连线，总资产分组应立即出现对应条目；编辑详情名称时总资产同步更新。

---

## 第一百一十二阶段（图片节点：默认宽高比 16:9）

### 变更时间
2026-04-28

### 变更文件
- `src/components/canvas/ImageCanvasNode.vue`
- `src/views/CanvasEditor.vue`
- `src/components/canvas/TextProcessCanvasNode.vue`
- `src/components/canvas/ImageSplitResultNode.vue`
- `src/components/canvas/Viewport3DCanvasNode.vue`
- `src/components/canvas/VR360CanvasNode.vue`

### 变更原因
- 新建/补默认的图片节点宽高比由 1:1 改为 16:9，与横屏创作场景一致。

### 变更内容
1. `ImageCanvasNode`：`aspectRatio` 缺省、`ensureDefaults`、裁剪/标注/视角派生节点回退值；比例选项列表将 16:9 置前。
2. `CanvasEditor`：`buildNewImageCanvasNodeData`、旧 `canvasNode` 迁移缺省。
3. 文本切割导出、三维/全景导出等新建 `imageCanvas` 的 `buildExportedImageNodeData` 默认改为 16:9；VR360 无尺寸推断时的回退由 1:1 改为 16:9。

### 影响说明
- 已存快照里显式保存为 `1:1` 的节点不变；仅缺省或新节点为 16:9。

---

## 第一百一十一阶段（图片节点：左侧入边上游图并入 generateImage 参考图）

### 变更时间
2026-04-28

### 变更文件
- `src/components/canvas/ImageCanvasNode.vue`

### 变更原因
- 左侧 target 桩连接 `imageCanvas` / `storyboardGen` / `imageSplitResult` 等产出图时，生成接口应自动携带与 `VideoCanvasNode` 一致的上游图 URL，无需仅依赖手动参考图槽。

### 变更内容
1. `useVueFlow` 增加 `edges`；复用与 `VideoCanvasNode` 相同的 `extractImageUrlFromSourceNode` 逻辑。
2. `collectIncomingReferenceImageUrls` 收集 `target === 本节点` 的入边来源图；`mergeRefsForApi` 先入边、后 `data.referenceImages`，去重，最多 12 张。
3. `handleGenerate` 使用合并结果作为 `apiService.generateImage` 的 `referenceImages`。

### 影响说明
- 视角编辑 `generateQwenImageEdit2509` 仍仅用主预览图，未改。

---

## 第一百零九阶段（更新安装：拉起安装包时显示 NSIS 向导）

### 变更时间
2026-04-28

### 变更文件
- `electron/updaterManager.ts`

### 变更原因
- `quitAndInstall` 对安装包传入 NSIS `/S` 导致静默安装，用户看不到安装界面，误以为在后台安装。

### 变更内容
1. `spawn` 参数改为无额外参数，使用默认图形化安装向导。
2. 增加 `windowsHide: false`，避免 Windows 下子进程窗口被隐藏。

### 影响说明
- 用户需在向导中点击步骤完成安装；若曾依赖无人值守静默升级，需另行约定参数（不推荐与「可见向导」混用）。

---

## 第一百零八阶段（启动更新弹窗：方形弹窗与方形版本卡、底部留白）

### 变更时间
2026-04-28

### 变更文件
- `src/components/AppStartupUpdateDialog.vue`

### 变更原因
- `prompt` 态需接近正方形整体；当前/最新为方形块而非横向拉伸；底部双键与弹窗边保留统一内边距。

### 变更内容
1. `is-prompt`：`--prompt-dialog-size: min(400px, 100vw-32px, 100vh-32px)`，宽高同为该值；`flex` 列布局，主体区垂直居中。
2. `.ver-card` 固定约 `118×118`、`aspect-ratio: 1`、圆角 12px。
3. 页眉/主体/页脚（含 `.dialog-footer--prompt`）使用约 `20px` 水平内边距，页脚底部约 `20px`。

### 影响说明
- 仅 `prompt` 态布局；下载/错误态宽度逻辑不变。

---

## 第一百零七阶段（启动更新弹窗：版本卡/按钮对齐图2、去掉更新说明）

### 变更时间
2026-04-28

### 变更文件
- `src/components/AppStartupUpdateDialog.vue`

### 变更原因
- 稿 2 要求更紧凑：无「更新说明」区块；当前/最新为 `#2a2a2a` 卡片，最新为亮青描边与 `#00aaff` 版本号；主按钮渐变 `#00b4db`→`#6e48aa`，次按钮与卡片同色系弱描边、弱对比文字。

### 变更内容
1. 删除 `prompt` 态下更新说明 DOM 及相关样式；`releaseNotes` 仍保留为可选 prop（父组件可继续传入，界面不展示）。
2. 调整 `.ver-card`、`.ver-card--latest`、`.ver-num--accent`、`.ver-arrow` 与 `.btn-update-now`、`.btn-later`；弹窗背景改为 `#121214`、圆角约 14px。

### 影响说明
- 仅发现新版本态 UI；下载/错误态不变。

---

## 第一百零六阶段（启动更新弹窗：发现新版本视觉稿）

### 变更时间
2026-04-28

### 变更文件
- `src/components/AppStartupUpdateDialog.vue`

### 变更原因
- 产品稿要求「发现新版本」态为居中暗色卡片：顶栏 Logo（`public/icon.ico`）、标题、左右版本卡与箭头、渐变主按钮 + 描边次按钮。

### 变更内容
1. `prompt` 态：自定义 header（Logo +「发现新版本」）、`当前`/`最新` 双卡片与 `→`、`最新` 版本号青色强调。
2. 底部「立即更新」使用青→蓝→紫渐变与下载图标；「稍后再说」深底描边。
3. 弹窗圆角 16px、背景 `#1a1a1a`→`#121212` 渐变与阴影；下载/错误态仍用原 `el-dialog` 页眉样式。

### 影响说明
- 仅 UI；更新逻辑与 IPC 不变。`/icon.ico` 依赖 Vite `public` 与打包后 `dist` 根目录资源。

---

## 第一百零五阶段（Electron：启动发现新版本弹窗、下载进度、完成后拉起安装包）

### 变更时间
2026-04-28

### 变更文件
- `src/components/AppStartupUpdateDialog.vue`（新建）
- `src/App.vue`
- `electron/updaterManager.ts`

### 变更原因
1. 启动检测到新版本时，需要独立弹窗展示当前/最新版本与更新说明，替代仅 Toast 提示「请到设置下载」。
2. 用户确认更新后需要可视化下载进度（百分比、已下/总量、速度）。
3. 下载完成后应直接启动本地安装包并退出应用；设置页触发的下载仍由用户手动点「重启应用」，避免误退出。

### 变更内容
1. `AppStartupUpdateDialog`：`prompt` / `downloading` / `error` 三态 UI，与现有暗色主题变量一致。
2. `App.vue`：监听 `update-status`，`available` 时打开弹窗；`startupUpdateAwaitingInstall` 仅在用户点击「立即更新」后为真，在此流程下响应 `downloading`、`downloaded`（调用 `installUpdate`）与下载错误；弹窗 `@closed` 统一 `dismiss` 以清除标志。
3. `updaterManager.downloadFile`：按时间窗口计算平滑 `bytesPerSecond`，供渲染进程显示速率。

### 影响说明
- 生产环境主进程仍会延迟调用 `updaterManager.checkForUpdates()`；开发模式不自动检查，弹窗逻辑在收到 `available` 时同样生效。
- NSIS 静默参数仍为 `/S`，若安装包变更需同步 `quitAndInstall`。

---

## 第一百零四阶段（裁剪固定比例：初始略小于最大内接框、选框与图像对齐、滚轮缩放更顺）

### 变更时间
2026-04-28

### 变更文件
- `src/components/canvas/ImageNodeImageToolsDialog.vue`

### 变更原因
1. 竖图/方图选 16:9 时最大内接框宽贴满 `iw`，`left` 钳在 0，表现为只能上下移动。
2. 裁剪框坐标相对图像，但 `.crop-marquee` 相对 `.crop-stage` 定位，图像 `margin: 0 auto` 时未加偏移，拖拽与遮罩与图错位。
3. 滚轮缩放步进固定，希望随滚轮/触控板幅度更顺滑地同比缩放。

### 变更内容
1. `createInitialFixedAspectRect`：相对最大内接框约 92% 居中，横纵均保留平移余量。
2. `cropStageRef` + `cropImgLayoutOffset`，`cropBoxStyle` 叠加图像在舞台内的偏移。
3. `onCropStageWheel` 按 `deltaY` 幅度计算 `factor`，并限制单次缩放范围。
4. `ResizeObserver` 同时观察 stage，仅在 `clientWidth/Height` 变化时按比例映射 `cropFixedRect`，避免无谓重置。

---

## 第一百零三阶段（裁剪弹窗：固定比例选区可拖动、滚轮同比缩放）

### 变更时间
2026-04-28

### 变更文件
- `src/components/canvas/ImageNodeImageToolsDialog.vue`

### 变更原因
- 固定比例（如 16:9）时裁剪框原为「居中最大内接矩形」且不可交互；用户需要在框内平移选区，并以滚轮在保持比例的前提下放大/缩小裁剪范围。

### 变更内容
1. 引入 `cropFixedRect` 存储固定比例下的显示坐标矩形；切换比例或图片加载时初始化为 `fitAspectRectInDisplay`。
2. `clampFixedAspectRect` 将矩形限制在图内且锁定目标宽高比；`ResizeObserver` 在预览尺寸变化时按比例映射 `cropFixedRect`。
3. 裁剪框（`.crop-marquee--movable`）支持指针拖动平移（`setPointerCapture`）；在 `.crop-stage` 上 `@wheel.prevent` 以指针位置为锚点同比缩放。
4. 「自由」模式仍为底层交互层拖拽框选；固定比例时交互层不再禁用，仅框体可点拖。

### 影响说明
- `confirmCrop` 仍用 `cropDisplayRect` 映射到 `cropImagePixelRect`，输出逻辑不变。

---

## 第一百零二阶段（图片预览：小尺寸合并图在弹窗内放大占满预览区）

### 变更时间
2026-04-28

### 变更文件
- `src/components/canvas/ImageViewer.vue`

### 变更原因
- 「切割结果 → 合并分镜」产出的合成图按节点栅格常量绘制，宽度约 494px。预览使用 `max-width: 100%` + `width: auto` 时，浏览器按**固有宽度**渲染，不会放大到弹窗内容区宽度，宽屏下两侧留白明显（如图）。

### 变更内容
1. 预览区 `.image-viewer-content` 使用明确高度 `min(82vh, 100dvh - 120px)` 作为「舞台」。
2. `.preview-image` 使用 `width/height: 100%` + `object-fit: contain` + `object-position: center`，在舞台内等比放大至尽可能大。
3. `el-dialog` 宽度 `min(1200px, 92vw)`，并 `align-center` 垂直居中。

### 影响说明
- 所有经画布「图片预览」打开的图片均按同一规则显示；超大图仍由 `contain` 完整落在舞台内，可滚动。

---

## 第一百零一阶段（图片节点「视角」：结果落到右侧新节点，不覆盖原图）

### 变更时间
2026-04-28

### 变更文件
- `src/components/canvas/ImageCanvasNode.vue`

### 变更原因
- 视角调整（千问 `qwen-image-edit-2509`）原先把结果写回当前节点的 `generatedImageUrl`，覆盖主图；用户希望保留原图，像裁剪/标注一样从当前节点分出下游图片节点展示新图。

### 变更内容
1. 新增 `persistGeneratedImageUrlWithNodeId`：落盘时使用**新节点 id**，避免与父节点文件名混淆。
2. 新增 `createViewpointOutputNode`：在节点右侧创建 `imageCanvas`，`uploadedMainImageUrl` 为结果图，`generatedImageUrl` 为空；从当前节点连边到新节点；`pushStateBeforeChange` 与裁剪/全景一致。
3. `applyViewpointEdit` 成功时改为 `await createViewpointOutputNode(url)`，不再 `updateNodeData` 覆盖当前节点。

### 影响说明
- 原节点预览与生成状态不变；新节点标题为「图片（视角）」。多次应用若位置重叠，用户可手动拖开（与裁剪输出行为一致）。

---

## 第一百阶段（API：`baseURL` 已含 `/v1` 时图片接口勿重复 `/v1`）

### 变更时间
2026-04-28

### 变更文件
- `src/services/apiService.ts`

### 变更原因
- 官方配置默认 `baseURL` 为 `https://api.ussn.cn/v1`。`buildURL` 为简单拼接，若 endpoint 写成 `/v1/images/generations`，实际请求变为 `/v1/v1/images/generations`，网关返回 404（Invalid URL）。

### 变更内容
1. 豆包出图、Z-Image Turbo、`generateQwenImageEdit2509` 的请求 path 由 `/v1/images/generations` 改为 `/images/generations`，与 `gpt-image-2` 等分支及 `/chat/completions` 约定一致。

### 影响说明
- 若用户自定义 `baseURL` 为**不含**版本前缀的根域，需自行在设置里写成带 `/v1` 的地址，或后续可再引入「规范化 baseURL」工具函数。

---

## 第九十九阶段（画布图片预览：修复关闭弹窗时 Element Plus `instance` TDZ 报错）

### 变更时间
2026-04-28

### 变更文件
- `src/components/canvas/ImageViewer.vue`
- `src/views/CanvasEditor.vue`

### 变更原因
- 关闭 `el-dialog` 时在过渡 `leave` 的 `onClose` 路径上报错：`ReferenceError: Cannot access 'instance' before initialization`。根因是 **`v-model` 已与 `update:visible` 同步关闭**，仍使用 **`destroy-on-close` + `@close` 内再次 `dialogVisible = false` 并 `emit('close')`**，父级再写 `showImageViewer = false`，关闭链路重复、与销毁时序叠加，易触发 Element Plus 内部实例与过渡回调竞态。

### 变更内容
1. `ImageViewer`：去掉 `destroy-on-close`、`@close` 及对 `dialogVisible` 的二次赋值；仅保留 `v-model` 计算属性向父级同步 `visible`。
2. `CanvasEditor`：去掉 `ImageViewer` 上冗余的 `@close="showImageViewer = false"`（由 `v-model:visible` 负责）。

### 影响说明
- 预览弹窗不再每次关闭即销毁 DOM，体量小可接受；若需强制释放大图内存，可后续改为在 `@closed` 中再清理或由父级在 `visible === false` 时清空 `imageUrl`。

---

## 第九十八阶段（三维视图：导出颜色/深度图布局与输出桩垂直居中）

### 变更时间
2026-04-28

### 变更文件
- `src/components/canvas/Viewport3DCanvasNode.vue`

### 变更原因
- 「导出视图」需在右侧生成 **上颜色图、下深度图**，两节点保留间距；**源节点右侧输出桩**应落在两节点垂直方向的 **中间**，与示意图一致。

### 变更内容
1. 以源节点 `dimensions.height` 计算垂直中线 `midY`，颜色图 `y = midY - 估算节点高 - 间距/2`，深度图 `y = midY + 间距/2`，同列 `x = 源宽 + 水平间距`。
2. 常量：`EXPORT_IMAGE_NODE_LAYOUT_HEIGHT`、`EXPORT_IMAGE_NODE_GAP_Y`、`EXPORT_IMAGE_NODE_GAP_X`。
3. 右侧 `Handle` 增加 `viewport3d-out-handle`：`top: 50%` + `translate(50%, -50%)` 与源卡片垂直中心对齐。

### 影响说明
- 图片节点实际高度与估算值略有偏差时，中线为近似对齐；可再调常量。

---

## 第九十七阶段（画布分镜出图：画面风格与 Step2 同序，避免被长模板冲淡）

### 变更时间
2026-04-28

### 变更文件
- `src/components/canvas/StoryboardGenCanvasNode.vue`

### 变更原因
- 分镜生成节点原先为 `buildArtStylePromptPrefix + buildStoryboardPrompt`，即 **【画面风格】在最前**，其后才是提示词管理 id=8 的长模板与分镜正文。与 `Step2Page`（模板 → 画面风格 → 分镜内容）不一致；长模板易主导多模态模型，表现为「风格乱套」或风格丢失，尽管风格块仍在字符串中。

### 变更内容
1. 用 `composeCanvasStoryboardImagePrompt` 替代 `buildStoryboardPrompt` + 前置风格：顺序与 Step2 对齐（含 `{description}` 占位时在展开后追加风格块）。
2. 无模板时仍带 `【画面风格】`（若非无风格）+ `【分镜提示词内容】`。

### 影响说明
- 仅影响画布 `storyboardGen` 节点生图；图片节点、Step2 不变。

---

## 第九十六阶段（分镜生成：单格提示避免「1x1」误导 Gemini 出方形）

### 变更时间
2026-04-28

### 变更文件
- `src/components/canvas/StoryboardGenCanvasNode.vue`

### 变更原因
- 物理宫格为 1×1 且无多镜头垫图时，首句原为「请生成一张 1x1 的分镜宫格图」。模型易将 **1x1** 理解为 **1:1 宽高比**，与 `generationConfig.imageConfig.aspectRatio`（如 16:9）冲突；同模型在普通图片节点无此文案故比例正常。

### 变更内容
1. `storyboardIntroLine`：单格改为「单格分镜整图」等表述，并明示与参考线框比例一致、勿自行裁成方形。
2. 多格改为「N 行 M 列」中文，避免 `2x3` 与像素写法混淆。

### 影响说明
- 仅提示词文案；线框垫图与 API 参数不变。

---

## 第九十五阶段（dall-e-3 / GPT-Image-2-All：size 仅允许三档）

### 变更时间
2026-04-28

### 变更文件
- `src/utils/imageModelGenerateOptions.ts`

### 变更原因
- 列表项「GPT-Image-2-All」的模型 id 为 `dall-e-3`；OpenAI 要求 `size` 只能是 `1024x1024`、`1024x1792`、`1792x1024`。原先与 `gpt-image-2` 共用按比例计算的 WxH（如 1792×1008），网关返回 500。

### 变更内容
1. `dall-e-3` 单独分支：按画布比例映射到上述三种之一（竖屏类 → 1024×1792，横屏类 → 1792×1024，1:1 → 1024×1024）。
2. `gpt-image-2` 仍走原有按画质与比例推算的像素逻辑。

### 影响说明
- 横竖分类为近似映射，与 DALL·E 3 固定三档一致。

---

## 第九十四阶段（GPT-Image-2：兼容不接受 response_format 的中转）

### 变更时间
2026-04-28

### 变更文件
- `src/services/apiService.ts`

### 变更原因
- 调用 `POST /v1/images/generations`（gpt-image-2）时，部分网关返回 `Unknown parameter: 'response_format'`，拒绝请求体中的 `response_format: 'url'`。

### 变更内容
1. GPT-Image-2 分支不再发送 `response_format`；响应仍按现有逻辑解析 `data[].url` 或 `b64_json`。
2. 通用 `/v1/images/generations` 回退分支同样去掉 `response_format`，并支持仅返回 `b64_json` 时的解析。

### 影响说明
- 若某环境必须显式 `response_format` 才返回 URL，需在该网关侧配置或由后续可选参数扩展；当前以优尚兼容为准。

---

## 第九十三阶段（Gemini 出图：补全 responseModalities 以生效 aspectRatio）

### 变更时间
2026-04-28

### 变更文件
- `src/services/apiService.ts`

### 变更原因
- 日志已传 `generationConfig.imageConfig.aspectRatio`（如 16:9）与 `imageSize`，但成品仍 1:1。Google 文档要求原生图像输出在 **GenerateContentConfig** 中同时设置 **`responseModalities: ['TEXT','IMAGE']`** 与 **`imageConfig`**；缺省时多类网关不按 imageConfig 出图。

### 变更内容
1. `generationConfig` 增加 `responseModalities: ['TEXT','IMAGE']`，与官方示例一致。
2. 额外附带 `generation_config`（snake_case）同级副本，便于只认 REST 风格的转发层。
3. 日志增加 `responseModalities` 便于排查。

### 影响说明
- 若某网关严格校验请求体并拒绝未知顶栏字段，可再按需去掉 `generation_config` 仅保留 camelCase。

---

## 第九十二阶段（分镜/图片生成：豆包 size 与比例、选项与图片节点统一）

### 变更时间
2026-04-28

### 变更文件
- `src/utils/doubaoImageRequestSize.ts`（新）
- `src/utils/imageModelGenerateOptions.ts`（新）
- `src/services/apiService.ts`
- `src/components/canvas/ImageCanvasNode.vue`
- `src/components/canvas/StoryboardGenCanvasNode.vue`

### 变更原因
- 分镜生成在正文无「镜头1/2…」时为单图；垫图 `generateStoryboardGridDataUrl` 已按节点 `aspectRatio` 绘制，但即梦/豆包分支请求体仅传 `size: 1K|2K|4K`，网关侧常按默认 **1:1** 出图，与节点所选 16:9 等不一致。
- 分镜节点内 `buildGenerateOptions` 与图片节点逻辑分叉，GPT/Gemini/豆包行为不一致。

### 变更内容
1. `resolveDoubaoImageRequestSize`：当 `size` 为 1K/2K/4K 时，按 `aspectRatio` 换算为 `宽x高`（长边 1024/2048/3840）再写入请求。
2. `buildImageModelGenerateOptions`：抽离为公共方法；豆包分支传 `size`（画质档位）+ `aspectRatio`；分镜与图片节点共用。
3. `generateImage` 豆包分支统一经 `resolveDoubaoImageRequestSize` 得到最终 `requestBody.size`。

### 影响说明
- 若调用方已传显式像素 `size`（如 `2560x1440`），解析函数原样保留，不强制改写。

---

## 第九十一阶段（画布编辑器：更多操作内打开系统设置弹窗）

### 变更时间
2026-04-28

### 变更文件
- `src/views/CanvasEditor.vue`

### 变更原因
- 画布顶栏「更多操作」需快速打开与侧栏一致的系统设置（API、存储等），避免离开画布页面。

### 变更内容
1. 引入 `SettingsDialog`，增加 `showSettingsDialog`、`settingsDialogDefaultTab` 与 `openCanvasSettings`。
2. 下拉菜单首项「设置」打开弹窗，默认标签页与侧栏「设置」一致为「数据存储」。

### 影响说明
- 纯 UI 行为；与 `SideNav` 共用同一对话框组件。

---

## 第九十阶段（视频节点：生成中状态与 data.status 绑定至任务结束）

### 变更时间
2026-04-28

### 变更文件
- `src/components/canvas/VideoCanvasNode.vue`

### 变更原因
- 原先用组件内 `ref generating` 控制遮罩，画布更新或节点重挂载时 ref 会丢失，表现为「生成中」提前消失；用户要求异步任务全程保持生成态，**仅在实际结束（成功/失败）后**再关闭。

### 变更内容
1. 用 `computed(() => data.status === 'running')` 驱动遮罩与按钮禁用；`handleGenerateVideo` 开始时 `updateNodeData(..., { status: 'running' })`，成功为 `completed`，失败为 `error`。
2. `watch` 该状态同步 `useSimulatedGenerationProgress` 的 start/stop（含 `immediate`），避免与本地 ref 双轨。
3. 生成中重复点击提示「视频正在生成中，请稍候」并直接返回。

### 影响说明
- 若历史快照里节点长期为 `running` 且无后台任务，遮罩会一直显示，需用户改状态或重新保存画布；属异常数据边界。

---

## 第八十九阶段（画布资产链生图落盘到 assets/characters|scenes|props）

### 变更时间
2026-04-28

### 变更文件
- `src/utils/canvasMediaPersist.ts`
- `src/components/canvas/ImageCanvasNode.vue`

### 变更原因
- 人物/场景/道具资产右侧图片此前与通用人像一样写入 `canvas-media/images`，用户希望与创作流一致：人物 → `assets/characters`，场景 → `assets/scenes`，道具 → `assets/props`。

### 变更内容
1. `persistCanvasGeneratedImage` 增加参数 `saveCategory`（默认 `canvas`），对应 `project-save-image` 的 `character` / `scene` / `prop` / `canvas`。
2. `ImageCanvasNode` 在 `persistGeneratedImageUrl` 中根据 `data.assetCategory` 选择上述分类；无分类或非资产链仍为 `canvas`。
3. 资产类文件名前缀为 `canvas-asset-{category}-...`，便于与纯画布图区分。

### 影响说明
- 分镜等非资产图片仍落盘 `canvas-media/images`（`StoryboardGenCanvasNode` 未改）。
- 主进程 `project-save-image` 对 canvas 项目的 `character|scene|prop` 路径原已支持，无需改 Electron。

---

## 第八十八阶段（视频生成：file:// 参考图转 data URL 再请求 API）

### 变更时间
2026-04-28

### 变更文件
- `electron/main.ts`、`electron/preload.ts`
- `src/vite-env.d.ts`
- `src/utils/resolveImageRefForApi.ts`（新）
- `src/services/apiService.ts`

### 变更原因
- 画布 AI 图片落盘为 `file://`，视频节点从连线收集的参考图 URL 同上；`generateVideo` 将 URL 原样写入 JSON/表单，**网关与模型无法读取用户本机路径**，表现为「已连线但生成视频不参考形象」。

### 变更内容
1. 主进程新增 `read-local-file-as-data-url`：将 `file://` 对应文件读为 Base64 并返回 `data:image/...;base64,...`。
2. `resolveImageRefForApi`：对 `file://` 在 Electron 下调用上述 IPC；`data:` / `http(s):` 保持不变。
3. `APIService.generateVideo` 在分发至 Grok / OpenAI 格式请求前，对 `referenceImages` 逐项 `await` 解析。

### 影响说明
- 大参考图会使请求体变大；与非落盘的 data URL 行为一致。
- 非 Electron 或 IPC 失败时仍回退为原始字符串（与改前行为一致，远端仍可能无效）。

---

## 第八十七阶段（文本生成分镜：序号标注与分镜输出图标题）

### 变更时间
2026-04-28

### 变更文件
- `src/components/canvas/TextProcessCanvasNode.vue`
- `src/components/canvas/StoryboardGenCanvasNode.vue`
- `src/components/canvas/ImageCanvasNode.vue`

### 变更原因
- 文本处理节点「生成分镜」创建的分镜节点需按顺序展示 **#1、#2…**（绿色加粗）+ 分镜标题，对齐创梦工坊分镜编辑体验。
- 分镜节点生成的右侧图片节点标题需包含分镜序号与「第几张」输出（01 起两位），且序号按当前与该分镜**仍连线**的 `imageCanvas` 数量递增（删边/断连后计数会变化）。

### 变更内容
1. `TextProcessCanvasNode`：为每个新建 `storyboardGen` 写入 `storyboardSequence`（1-based）、`storyboardTitle`（与 `label` 一致）。
2. `StoryboardGenNodeData` 增加上述字段；节点头部有 `storyboardSequence` 时渲染为绿色加粗 `#N` + 标题，否则沿用单字段 `label`。
3. `createGeneratedImageOutputNode`：用 `edges` 统计 `source === 当前分镜` 且目标为 `imageCanvas` 的边数，下一张为 `count + 1`；`label` 为 `#N 分镜图片 XX`，并写入 `storyboardOutputStoryIndex`、`storyboardOutputImageIndex`；新建节点 `y` 略错位避免重叠。
4. `ImageNodeData` 增加 `storyboardOutputStoryIndex`、`storyboardOutputImageIndex`；头部有这两字段时与分镜节点相同样式显示序号与后缀文案。

### 影响说明
- 旧画布分镜节点无 `storyboardSequence` 时头部仍为纯 `label`；旧输出图无索引字段时仍为单行 `label`。

---

## 第八十六阶段（视频节点：多路参考图 + 上游资产/分镜文案并入提示词）

### 变更时间
2026-04-28

### 变更文件
- `src/components/canvas/VideoCanvasNode.vue`
- `src/services/apiService.ts`

### 变更原因
- 需在视频节点左侧连多路图片（人物/场景/道具）；若上游图片来自资产详情或分镜生成，应将对应文字并入视频提示词。
- 原视频 API 仅传单张 `referenceImage`。

### 变更内容
1. 每条入边生成 `VideoIncomingFeed`：解析源节点参考图 URL；若源为 `imageCanvas`，沿入边递归收集 `textAssetDetail`（名称/描述/分类）、`storyboardGen`（镜头格与附加提示）；源为直连 `storyboardGen` 时合并分镜正文。
2. `allReferenceImagesForApi`：本地上传槽在前，再按边顺序拼接各路图片 URL 并去重；`generateVideo` 传入 `referenceImages` 数组。
3. `mergedUpstreamContextBlock`：各路上下文去重后追加在用户提示词之后（【画布连线上下文】）。
4. Grok 类：`requestBody.image` 在多单图时为数组（与豆包多图约定一致）；OpenAI 表单对多图 `data:` 多次 `append('input_reference', blob)`，非 data 仅首张走 `image` 字段。

### 影响说明
- 后端若仅支持单图，需在网关侧兼容或自动取首图；多 `input_reference` 是否生效依赖优尚 API。
- 左侧仍为单一 target 桩，Vue Flow 允许多边连同一桩。

---

## 第八十五阶段（视频节点：从连线读取上游参考图）

### 变更时间
2026-04-28

### 变更文件
- `src/components/canvas/VideoCanvasNode.vue`

### 变更原因
- 参考图仅来自节点内手动上传的 `referenceImages`，未解析 Vue Flow 入边；用户从图片/分镜节点连线到视频节点后仍提示「请输入提示词或参考图」，与预期不符。

### 变更内容
1. 遍历 `target === 当前视频节点` 的边，从源节点取出可作首帧的 URL：`imageCanvas`（生成图/主图）、`storyboardGen`（生成图）、`imageSplitResult`（首格 cells）。
2. `primaryReferenceImage`：手动上传槽位优先；否则使用按边顺序的第一张上游图（与当前 `generateVideo` 单张 `referenceImage` 一致）。
3. 工具栏在无手动图且存在上游图时展示简短提示文案。

### 影响说明
- 多路上游时仅传第一张非空图；双槽「首尾帧」若需两路连线需后续扩展 API。

---

## 第八十四阶段（画布：AI 图片/视频落盘为本地路径）

### 变更时间
2026-04-28

### 变更文件
- `src/utils/canvasMediaPersist.ts`（新）
- `src/views/CanvasEditor.vue`
- `src/components/canvas/ImageCanvasNode.vue`
- `src/components/canvas/VideoCanvasNode.vue`
- `src/components/canvas/StoryboardGenCanvasNode.vue`
- `src/services/projectFileService.ts`
- `electron/main.ts`、`electron/preload.ts`
- `src/vite-env.d.ts`

### 变更原因
- AI 返回的 data URL / 远程 URL 长期留在节点 `data` 中会撑爆渲染进程内存与撤销/快照体积；用户希望画布展示改为引用项目目录下的文件。

### 变更内容
1. 画布项目（`projectType: 'canvas'`）下新增目录 `canvas-media/images`、`canvas-media/videos`；`project-save-image` 增加分类 `canvas` 与可选 `projectType`；`project-save-video` / `project-load-image` 同步支持 `projectType` 与画布视频子目录。
2. `CanvasEditor` 通过 `provide('canvasProjectContext')` 注入当前项目 `id`、名称。
3. 图片节点主生图与视角重绘、分镜生成节点输出、视频节点生成成功后，在 Electron 下调用 `persistCanvasGeneratedImage` / `persistCanvasGeneratedVideo` 写入上述目录，节点字段改为 `file://` URL；已是 `file://` 则跳过；非 Electron 或保存失败则保留原 URL。
4. 创作流 Step1/Step2 调用 `saveImage`/`saveVideo` 不传 `projectType`，仍写入原「创作项目」目录，行为不变。

### 影响说明
- 用户本地上传的参考图仍为 data URL（未在本阶段统一落盘）；后续可同样接入以进一步省内存。

---

## 第八十三阶段（画布：缓解「内存不足已暂停」与撤销内存）

### 变更时间
2026-04-28

### 变更文件
- `electron/main.ts`
- `src/views/CanvasEditor.vue`
- `src/composables/useHistory.ts`

### 变更原因
- Chromium 在渲染进程内存逼近上限时会暂停页面（提示类似「在内存不足可能导致崩溃之前已暂停」），画布节点 `data` 中多张 Base64 大图叠加撤销栈多次整图 `JSON` 深拷贝，易触发峰值内存与冻结。

### 变更内容
1. 应用启动前增加 `js-flags --max-old-space-size=8192`，提高 V8 堆上限（须在 `app.whenReady` 之前）。
2. 画布撤销深度由 50 改为 12，降低同时驻留的整图快照份数。
3. 节点拖拽结束入撤销栈时，快照已由 `cloneGraphStateForSnapshot` 得到独立副本，`pushUndoSnapshot` 支持 `skipDeepClone: true`，避免对同一份大图数据二次整图序列化。

### 影响说明
- 可撤销步数减少；极低内存机器仍可能 OOM，需减少同屏大图节点或改用本地 `file://` 路径（若产品后续支持）。

---

## 第八十二阶段（画布资产链：生图携带分类提示词模板）

### 变更时间
2026-04-28

### 变更文件
- `src/components/canvas/ImageCanvasNode.vue`
- `src/components/canvas/TextProcessCanvasNode.vue`
- `src/components/canvas/TextAssetDetailCanvasNode.vue`

### 变更原因
- 人物/场景/道具资产右侧图片节点仅含「资产名称/描述」，未拼接提示词管理中「生成人物/场景/道具提示词」（id 5/6/7），与 Step1 资产生图不一致。

### 变更内容
1. `ImageNodeData` 增加 `assetCategory`、`sourceAssetDetailNodeId`、`generatedByTextProcess`（后两者与运行时数据对齐）。
2. 文本流程创建资产链时，为图片节点写入 `assetCategory`。
3. 资产详情节点同步关联图片节点时，一并写入 `assetCategory`。
4. `ImageCanvasNode` 主生图：若解析到资产分类（节点字段或经 `sourceAssetDetailNodeId` 查详情节点），在用户可见提示词前拼接 `getCharacterPrompt` / `getScenePrompt` / `getPropsPrompt`，再接顶部画面风格前缀后请求 API。

### 影响说明
- 非资产链的普通图片节点行为不变；Step1 资产生图逻辑未改（已含上述模板）。

---

## 第八十一阶段（画布：分镜/图片/视频生成携带顶部画面风格）

### 变更时间
2026-04-28

### 变更文件
- `src/utils/artStylePrompt.ts`（新）
- `src/components/canvas/StoryboardGenCanvasNode.vue`
- `src/components/canvas/ImageCanvasNode.vue`
- `src/components/canvas/VideoCanvasNode.vue`

### 变更原因
- 画布顶部所选风格仅更新 `artStyleStore`，分镜生成节点、图片节点主生图、视频节点生视频未写入提示词，与 Step2 分镜生图不一致。

### 变更内容
1. 新增 `buildArtStylePromptPrefix(artStyles, selectedStyle)`：生成 `【画面风格】\n{label}：{description}\n\n`；选中「无风格」不写；自定义风格无描述时仅写 `label`。
2. 分镜生成 `handleGenerateStoryboard`、图片节点 `handleGenerate`、视频节点 `handleGenerateVideo` 在请求 API 前拼接该前缀。
3. 图片节点「视角」重绘（`applyViewpointEdit` / `generateQwenImageEdit2509`）不拼接，避免与「保持整体风格」类指令冲突。

### 影响说明
- 风格文案与内置列表一致，见 `artStyleStore` 中各 `defaultStyles` 的 `label` + `description`；用户自定义风格以后台存储为准。

---

## 第八十阶段（图片切割弹窗：默认 2×2、约 2px 线、纯红预览）

### 变更时间
2026-04-27

### 变更文件
- `src/utils/imageNodeCanvasTools.ts`
- `src/components/canvas/ImageNodeImageToolsDialog.vue`

### 变更原因
- 切割工具弹窗默认行列与分割线粗细与产品预期不一致；预览分割线需纯红、易于辨认。

### 变更内容
1. 新增 `lineThicknessPercentForTargetLinePx`：按图短边换算出约目标像素宽度的 `lineThicknessPercent`（与现有切割算法一致），供默认约 2px。
2. 切割模式：打开弹窗或切换图时默认行 2、列 2；预览 `load` 与 `watch` 用上述辅助函数将滑块推到约 2px。
3. 预览 SVG：小格轮廓线改为 `#ff0000`、`stroke-width` 4；丢弃区分割线区域改为 `rgba(255,0,0,0.45)`；图例色块为 `#ff0000`。

### 影响说明
- 实际切割线宽仍由 `resolveSplitLineThicknessPx` 与行列约束决定，「约 2px」在极小图或分割线过粗无效时会被压到允许上限。

---

## 第七十九阶段（分镜生成：单格多镜头时线框与提示一致）

### 变更时间
2026-04-27

### 变更文件
- `src/utils/storyboardGridReference.ts`
- `src/components/canvas/StoryboardGenCanvasNode.vue`

### 变更原因
- 节点仍为 1×1 但单格内已用「镜头1…镜头N」写满多镜时，不宜再只生成 1×1 无内线垫图；需与 `F:\\8.gongzuoliu` 的 N 宫格线框标准对齐，且不必把正文拆成多格再拼合。

### 变更内容
1. 新增 `inferShotsFromStoryboardText`（从正文取 `镜头+编号` 的最大编号）、`computePadGridForShotCount`（镜头数 → 行列表，与多格分镜的宫格形状算法一致）。
2. 当 `rows*cols===1` 且推断到至少 2 个镜头时，用推断行列生成线框垫图，并令 `buildStoryboardDescription` 首行「请生成 M×N 宫格」与垫图一致；在最终 `prompt` 末追加【线框与镜头对应】说明格序与 `镜头1…N` 对应。
3. 多格物理布局或非单格多镜头时行为与第七十八阶段一致。

### 影响说明
- 镜头编号需可被正则 `镜头[\\s:：*＊]?\\s*数字` 或 `Grid\\d+` 识别；无编号的多镜长文需用户改格子或手调文案。

---

## 第七十八阶段（分镜生成：线框格垫图参考）

### 变更时间
2026-04-27

### 变更文件
- `src/utils/storyboardGridReference.ts`（新）
- `src/components/canvas/StoryboardGenCanvasNode.vue`

### 变更原因
- 与 `F:\\8.gongzuoliu` 中分镜生图逻辑对齐：在调用生图 API 时除用户/资产参考图外，追加程序绘制的白底黑线宫格线稿，作为**最后一张**参考图，减少模型在宫格切分上跑偏。

### 变更内容
1. 新增 `generateStoryboardGridDataUrl`：按当前 `aspectRatio`、行列（1~6）、画质（1K/2K/4K 对应长边基准像素）在 canvas 上绘制与 `8.gongzuoliu` 的 `generateGridImageDataUrl` 一致的白底内线分割图，输出 `dataURL`。
2. `handleGenerateStoryboard` 在合并上游参考后，将用户侧参考截断为 `MAX_MODEL_REFERENCE_IMAGES - 1`，再 `push` 线框格图，整组作为 `referenceImages` 请求。

### 影响说明
- 每次生成分镜图至少多 1 张参考（线框）；若已接近参考上限，会优先保证线框而少带一张用户参考。仅在浏览器/ Electron 渲染进程可用（依赖 `document.createElement('canvas')`）。

---

## 第七十七阶段（文本节点：多章生成分镜条数与解析）

### 变更时间
2026-04-27

### 变更文件
- `src/components/canvas/TextProcessCanvasNode.vue`

### 变更原因
- 用户勾选多章时期望分镜节点数量与章节数一致或至少「每章有镜」；原「生成分镜」流程仅拼接模板 `3` + 小说内容，模板按**剧情拆镜**（15s/镜等）而非「一章一镜」，模型常将多章合并为少量分镜，长文堆在少数 `description` 中，表现为补全很长但只生成少量分镜节点。另：模型若输出 \`\`\`json 包裹内容，未去代码块时解析失败或异常。

### 变更内容
1. 当 `selectedChapterIds` 对应章节数 N>0 时，在请求用户消息末尾追加硬约束：`storyboards` 至少 N 条、不得无故多章合并为少镜。
2. 当 API 配置**非**无限 token 且限长时，对多章请求将 `max_tokens` 提升为 `min(32768, maxTokens * min(4, N))`，降低长 JSON 被截断概率。
3. `parseStoryboardResult` 增加对 \`\`\`json 代码块的剥离后再 `JSON.parse`。
4. 若解析到的分镜条数仍小于 N，弹出 `ElMessage.warning` 提示可重试或改提示词模板。

### 影响说明
- 「每章一镜」来自本次追加约束，与模板中「拆镜/15s」规则若冲突，以用户消息中本条「必须遵守」为优先；仍依赖模型配合。官方配置 `unlimitedTokens: true` 时不对 max_tokens 做上述倍增。

---

## 第七十六阶段（性能：Vue Flow 边选中抬升、交互时暂停小地图、Electron 前台限流）

### 变更时间
2026-04-27

### 变更文件
- `src/views/CanvasEditor.vue`
- `electron/main.ts`

### 变更原因
- 在已有「多节点/自动保存/边动画」等优化基础上，继续降低画布同帧 work：小地图在视口平移/缩放、节点拖拽、框选拖拽时与主视口同时更新会叠压主线程；边选中时默认抬升 z-index 与节点类似存在额外重算；Electron 默认在窗口失焦时降低 timer/RAF 调度，切回应用时易有短暂顿挫。

### 变更内容
1. `VueFlow` 增加 `elevate-edges-on-select="false"`，与已有 `elevate-nodes-on-select` 策略一致，减轻选中边时的 z-index/层叠更新。
2. 使用 `onNodeDragStart`/`onNodeDragStop`、`onSelectionDragStart`/`onSelectionDragStop` 驱动 `showMiniMapActive`：节点拖拽与框选移动时用 `v-if` 临时卸载 `MiniMap`（未在视口平移/滚轮缩放时卸载，避免 d3 `move` 过密导致小地图闪烁）。
3. `BrowserWindow` 的 `webPreferences` 增加 `backgroundThrottling: false`，减少失焦/后台时 Chromium 对调度降档，从而改善切回窗口时的跟手感（略增失焦时 CPU，与多数桌面工具类应用取舍一致）。

### 影响说明
- 小地图在拖节点、Ctrl+框选移动选区时会短暂消失，停手后恢复；若需「始终可见」可再改回仅降频不卸载。参考：Vue Flow 配置与大型图性能讨论（[vueflow.dev 配置](https://vueflow.dev/guide/vue-flow/config.html)、[xyflow/xyflow#3883 onlyRenderVisibleElements](https://github.com/xyflow/xyflow/issues/3883)）、Electron [webPreferences.backgroundThrottling](https://www.electronjs.org/docs/latest/api/structures/web-preferences).

---

## 第七十五阶段（画布：移除复制/粘贴/剪切节点）

### 变更时间
2026-04-27

### 变更文件
- `src/views/CanvasEditor.vue`

### 变更原因
- 产品要求取消画布内通过剪贴板复制、粘贴、剪切节点的能力。

### 变更内容
1. 删除内部 `clipboard` 状态及 `copySelected`、`pasteNodes`、`cutSelected`。
2. 移除快捷键 `Ctrl+C` / `Ctrl+V` / `Ctrl+X` 对应处理；快捷键说明列表同步删去上述三项。
3. 浏览器默认的复制/粘贴（如聚焦输入框时）不受影响，因仅去掉了画布全局拦截与节点剪贴逻辑。

### 影响说明
- 画布上不再支持节点级复制与粘贴；删除、撤销/重做、分组等其它快捷键不变。

---

## 第七十四阶段（画布：小地图性能与单实例）

### 变更时间
2026-04-27

### 变更文件
- `src/views/CanvasEditor.vue`
- `src/components/canvas/CanvasControls.vue`

### 变更原因
- 开启小地图后主线程与合成压力上升；且工具栏与画布曾各渲染一个 `MiniMap`，并在一处启用了 `pannable`+`zoomable`，与主画布 d3 zoom 叠加重算，浪费明显。

### 变更内容
1. **仅保留 `CanvasEditor` 内一个小地图实例**，从 `CanvasControls` 移除 `MiniMap`（开关仍通过 `v-model:showMiniMap` 控制父级显示）。
2. 小地图：`pannable`/`zoomable` 设为 `false`；`node-color`/`node-stroke-color` 使用字符串；较细描边、`maskBorderRadius=0`、`maskStrokeWidth=0`、`offsetScale=2`，降低 path/描边负担。
3. 按节点数分级缩小 `width`/`height`，多节点时用更小 SVG；容器 `contain: paint` 与暗色底栏样式统一在 `canvas-editor-minimap`。
4. 消息区 `right` 随小地图宽度略作预留，避免重叠。

### 影响说明
- 小地图内不再支持拖移/滚轮缩放（与主画布操作一致由主视口完成）；点击小地图空白/节点行为仍由 `@vue-flow/minimap` 默认处理。

---

## 第七十三阶段（画布：多节点性能 — 自动保存与边动画）

### 变更时间
2026-04-27

### 变更文件
- `src/views/CanvasEditor.vue`

### 变更原因
- 节点数增多时画布仍易卡顿；`watch([nodes, edges], { deep: true })` 在拖拽 `position` 高频变更时会反复触发自动保存逻辑，与 Vue Flow 更新叠加后主线程压力大。

### 变更内容
1. 自动保存改为只监听 `nodes.length` / `edges.length`；节点拖拽结束在 `onNodeDragStop` 中已产生撤销点时额外 `triggerAutoSave()`，以覆盖「只改坐标、条数不变」的保存需求。
2. 提供 `scheduleCanvasAutoSave`（同 `triggerAutoSave` 封装），供子节点在仅改 `data`、条数不变时主动排程保存；并增加约 60s 定时节流作兜底（仍走原有 debounced 存盘链）。
3. 节点数超过 `EDGE_ANIM_MAX_NODES`（20）时新建边与全量 `apply` 时不再使用 `animated` 边动画，减轻多虚线时的 GPU/CSS 负担；节点增删时同步已有边的 `animated`。
4. `VueFlow` 设置 `elevate-nodes-on-select` 为 `false`，减少选中时整节点 z-index 重算。

### 影响说明
- 自动保存不再依赖对 `nodes`/`edges` 的 deep 监听；未主动调用 `scheduleCanvasAutoSave` 时，仅改节点内部数据且长时间不改条数/不拖拽的极端情况下，最大延迟约为定时节流间隔加上用户设置的自动保存延迟；重要编辑可在节点内调用 `scheduleCanvasAutoSave` 缩短该窗口。

---

## 第七十二阶段（画布：工作区配色、拖拽不卡顿、撤销仍正确）

### 变更时间
2026-04-27

### 变更文件
- `src/composables/useHistory.ts`
- `src/views/CanvasEditor.vue`
- `src/styles/index.css`

### 变更原因
- 整体配色与 Comfy 系暗色工作区更协调；减少拖动节点时卡顿；在优化历史记录方式后仍须保证「撤销可回到移动前」。

### 变更内容
1. 新增 `pushUndoSnapshot`：允许压入已构造好的 `nodes/edges` 快照。
2. 将节点拖拽的撤销点从 `onNodeDragStart`+`pushStateBeforeChange`（全图 `JSON` 克隆，抓取瞬间主线程重）改为：`onNodeDragStart` 仅记录各节点坐标 `Map`；`onNodeDragStop` 若位置有变，再深拷贝并恢复坐标得到「移动前」图，调用 `pushUndoSnapshot` 入栈。拖拽过程中不再做全量快照。
3. 画布：`Background` 使用 `--canvas-flow-bg` / `--canvas-flow-dot`；容器与视口背景与变量一致；`vue-flow__node.dragging` 使用 `will-change`/`contain` 降低抖动；暗色下风格菜单上下文项与 hover 与深色背景统一。
4. 全局 `index.css` 增加/浅色主题下覆盖画布区 CSS 变量。

### 影响说明
- 撤销对「仅移动节点」仍应回到移动前；其它操作仍用 `pushState` / `pushStateBeforeChange`；`getNodes` 在 Vue Flow 内为 `ComputedRef`，入栈时通过 `unref(getNodes)` 取当前节点列表。

---

## 第七十一阶段（画布：滚轮缩放 / Ctrl+滚轮纵向平移 / Ctrl 框选）

### 变更时间
2026-04-27

### 变更文件
- `src/views/CanvasEditor.vue`

### 变更原因
- 需求：普通滚轮用于缩放画布；Ctrl+滚轮用于上下平移；框选与多选由 Shift+拖动/点击 改为 Ctrl+拖动/点击；并修正原先 `multi-select-key-code` 与组件实际 prop `multi-selection-key-code` 不一致的问题。

### 变更内容
1. `pan-on-scroll` 设为 `false`，`zoom-on-scroll` 为 `true`，使默认滚轮走缩放。
2. 在 `canvas-flow` 上使用 `@wheel.capture`：当 `ctrlKey` 且目标非输入类元素时 `preventDefault`，按与 Vue Flow 近似的公式用 `setViewport` 做纵向平移（避免库内对 ctrl+wheel 的过滤导致无响应）。
3. `selection-key-code` 与 `multi-selection-key-code` 均设为 `Control`。
4. 更新快捷键表与「请先选择要分组…」提示文案。

### 影响说明
- 空白处按住 Ctrl 拖动画布为框选；单节点多选为 Ctrl+点击。Mac 上需使用 **Control 键**（非 Command），与项目明确约定一致。

---

## 第七十阶段（Gemini 出图按节点比例/分辨率：使用 generationConfig.imageConfig）

### 变更时间
2026-04-27

### 变更文件
- `src/services/apiService.ts`
- `src/components/canvas/ImageCanvasNode.vue`
- `src/components/canvas/StoryboardGenCanvasNode.vue`

### 变更原因
- Gemini 图片模型（如 `gemini-3.1-flash-image-preview`）在 OpenAI 兼容 `/v1/chat/completions` 下，仅设根级 `aspect_ratio` 时上游可能不生效，输出易为默认 1:1；官方文档要求通过 `generationConfig.imageConfig` 的 `aspectRatio` 与 `imageSize` 控制；画布节点上「画质 4K + 16:9」需同步传入。

### 变更内容
1. `generateImage` 增加可选参数 `imageSize`；对 Gemini 分支在请求体中增加 `generationConfig: { imageConfig: { aspectRatio, imageSize } }`，并保留 `aspect_ratio` 与现有网关兼容；增加 `normalizeGeminiImageSize` 将 `1k`/`2k`、1K/2K/4K 等规范为 API 所需字符串。
2. 图片节点 `buildGenerateOptions`：Gemini 分支在 `aspectRatio` 外增加 `imageSize`（来自节点画质）。
3. 分镜节点 `buildGenerateOptions`：对名称含 `gemini`+`image` 的模型优先走与图片节点相同的 Gemini 分支，传入 `imageSize` 与 `aspectRatio`。

### 影响说明
- 非 Gemini 出图逻辑不变；分镜/步骤页中若用 Gemini 且已传 `size`/`aspectRatio`，`imageSize` 可从 `size` 推导（与 `imageSize` 二选一）。

---

## 第六十九阶段（画布「生成中」效果复用：图片与视频一致）

### 变更时间
2026-04-27

### 变更文件
- `src/composables/useSimulatedGenerationProgress.ts`（新增）
- `src/components/canvas/CanvasGeneratingOverlay.vue`（新增）
- `src/components/canvas/ImageCanvasNode.vue`
- `src/components/canvas/VideoCanvasNode.vue`

### 变更原因
- 图片节点点击「生成图片」的反馈与视频节点「生成视频」不一致；需统一样式与交互，并减少重复实现。

### 变更内容
1. 抽离伪进度条逻辑为 `useSimulatedGenerationProgress`（时间推进、约 96% 上限、卸载时清定时器），与原视频节点行为一致。
2. 抽离遮罩+标题+说明+进度+底部文案为 `CanvasGeneratingOverlay`，图片/视频节点传入不同标题与说明。
3. 图片节点：`generating` 改为本地 `ref`，与视频一样在 `try/finally` 中启停伪进度与遮罩；预览区使用同一 overlay 与 `fade-overlay` 过渡；生成按钮在生成中保持 Promotion 图标并 `is-spinning`。
4. 视频节点：用上述 composable 与 overlay 组件替换内联实现，删除原 `video-generating-*` 局部样式与手写定时器；移除仅用于清定时器的 `onBeforeUnmount`（由 composable 内 `onUnmounted` 处理）。

### 影响说明
- 节点数据中的 `status: 'running' | 'completed' | 'error'` 仍照常写入，与撤销/流式状态兼容；仅「生成中」UI 与本地 `ref`+伪进度与视频侧对齐。

---

## 第六十六阶段（修复分镜输入框 @资产高亮在 scoped 场景失效）

### 变更时间
2026-04-26

### 变更文件
- `src/components/canvas/StoryboardGenCanvasNode.vue`

### 变更原因
- 分镜生成节点中，`@资产名` 已正确匹配到资产，但输入框内未显示红/黄/蓝高亮，造成“引用成功但视觉无反馈”。

### 变更内容
1. 修复 `v-html + scoped` 样式作用域问题
   - 将 `mention-token / mention-character / mention-scene / mention-prop` 相关样式改为 `.frame-input-highlight :deep(...)` 选择器。
   - 保证 `v-html` 动态插入的高亮节点可命中样式。

2. 保持分类色映射不变
   - 人物：红色
   - 场景：黄色
   - 道具：蓝色
   - 仅对已命中资产映射的 `@资产名` 上色，未命中保持普通文本样式。

### 影响说明
- 仅修复分镜输入框内 `@` 命中高亮显示，不改变分镜生成请求参数与引用图片收集逻辑。

## 第六十七阶段（分镜 @资产改为原子引用并强制空格分隔）

### 变更时间
2026-04-26

### 变更文件
- `src/components/canvas/StoryboardGenCanvasNode.vue`

### 变更原因
- 用户反馈：`@资产名` 可被继续编辑，容易改坏导致匹配失效；且 `@资产名` 后紧跟正文时会出现误匹配或不匹配。
- 需要将“已成功引用”的 `@资产` 视为不可拆分 token，提升稳定性与可用性。

### 变更内容
1. `@` 选择成功后强制补空格
   - `applyMentionSelection` 中替换文本后，自动在 `@资产名` 后补 1 个空格（若后面已有空格则不重复补）。

2. 引用识别改为“资产名精确匹配 + 边界判断”
   - 新增 `parseAssetMentionRanges`，基于资产名称表执行最长优先匹配。
   - 仅当 `@资产名` 后满足边界字符（空白或标点）时才判定为有效引用。
   - 生成时的 `extractMentionNames` 与输入高亮 `renderFrameHighlight` 均复用同一解析逻辑，避免前后不一致。

3. 输入交互原子化
   - 点击已命中的 `@资产` 时，自动整段选中（`@` + 资产名）。
   - 在 token 内输入普通字符被阻止，避免“半改坏”。
   - 删除时（Backspace/Delete）整段删除 `@资产名`，并同时吞掉后续由系统补的空格。
   - 若多选区与 token 相交，删除时会扩展为完整 token 范围再删除。

### 影响说明
- `@` 引用从“可任意字符编辑”调整为“受保护 token 编辑”；
- 引用稳定性提升，减少因误编辑和粘连文本导致的资产匹配失败。

## 第六十八阶段（画布设置新增连线颜色自定义）

### 变更时间
2026-04-26

### 变更文件
- `src/components/SettingsDialog.vue`
- `src/stores/userStore.ts`
- `src/utils/canvasEdgeStyle.ts`
- `src/views/CanvasEditor.vue`
- `src/components/canvas/TextProcessCanvasNode.vue`
- `src/components/canvas/StoryboardGenCanvasNode.vue`
- `src/components/canvas/ImageCanvasNode.vue`
- `src/components/canvas/ImageSplitResultNode.vue`
- `src/components/canvas/Viewport3DCanvasNode.vue`
- `src/components/canvas/VR360CanvasNode.vue`

### 变更原因
- 用户要求在“设置 -> 画布设置”中支持自定义连线颜色，以适配个人习惯和不同视觉偏好。

### 变更内容
1. 新增用户设置项（持久化）
   - `userStore` 增加 `edgeColor`，默认值 `#409eff`，随用户设置持久化保存。

2. 扩展连线样式生成能力
   - `canvasEdgeStyleFromWidth(width, color?)` 增加颜色参数；
   - 未传颜色时回退默认蓝色，保持兼容。

3. 设置面板新增“连线颜色”
   - 在“画布设置”中新增颜色选择器（预设常用颜色 + 十六进制展示）；
   - 用户修改后即时作用于画布连线。

4. 全画布连线统一接入颜色设置
   - 所有创建连线、批量重绘连线、节点内派生连线逻辑统一使用：
     `canvasEdgeStyleFromWidth(userStore.edgeStrokeWidth, userStore.edgeColor)`；
   - `CanvasEditor` 的设置监听依赖增加 `edgeColor`，确保颜色修改实时刷新已存在连线。

### 影响说明
- 连线颜色从固定蓝色改为用户可配置；
- 宽度、样式、颜色三项画布连线参数统一由用户设置控制，且对历史/新建连线行为一致。

## 第六十九阶段（分镜节点新增总字数统计并统一上限 20000）

### 变更时间
2026-04-26

### 变更文件
- `src/components/canvas/StoryboardGenCanvasNode.vue`

### 变更原因
- 用户要求在分镜生成节点头部增加“所有格子总字数统计”，并将最大字数统一为 `20000`，且与现有“格数统计”并排展示、中间有分割线、格数区域固定宽度。

### 变更内容
1. 新增总字数统计
   - 在分镜头部（行/列控制右侧）新增文案：`{当前字数}/20000提示词`。
   - 当无输入时显示 `0/20000提示词`，有输入时实时显示累计值。

2. 统一最大字数上限并落地为真实约束
   - 新增常量 `MAX_STORYBOARD_PROMPT_CHARS = 20000`。
   - 在分镜文本更新流程中加入总字数裁剪：任意格子输入会按“其余格子字数 + 当前格子可用额度”自动截断，确保总字数不超过 `20000`。

3. 头部布局优化
   - 字数统计与格数统计之间新增竖向分割线。
   - 格数统计区域设置固定宽度，避免字数变化时抖动。

### 影响说明
- 分镜节点支持实时总字数可视化与硬上限控制；
- 统计条布局更稳定，信息密度更高且不影响原有行列控制操作。

## 第七十阶段（文本处理模型选择器升级为“先分组后模型”）

### 变更时间
2026-04-26

### 变更文件
- `src/components/canvas/TextProcessCanvasNode.vue`

### 变更原因
- 用户要求文本处理节点模型选择器支持“先选择分组，再显示该分组模型”，并将模型按钮统一为每行 2 个等宽排列，便于后续扩展多渠道模型分组。

### 变更内容
1. 新增分组选择层
   - 模型弹层新增“供应商”分组按钮区（优尚API / 官方直连 / Flow2API）。
   - 先选分组，再展示对应模型列表。

2. 节点数据新增分组字段
   - 在 `TextProcessNodeData` 中新增 `textModelGroup`，并在默认值流程中初始化为 `youshang`。
   - 选择模型时同步记录当前分组，保证节点状态可回显。

3. 模型按钮布局改造
   - 模型区由换行 `flex` 改为 `grid` 两列布局：`repeat(2, minmax(0, 1fr))`。
   - 每个模型按钮固定占满单元格，实现每行 2 个、同等宽度。

4. 空分组兜底提示
   - 当某分组暂无模型时显示“当前分组暂无可用模型”，避免空白误解。

### 影响说明
- 文本模型选择流程与分镜/视频节点一致，后续扩展新模型渠道时无需改交互结构；
- 当前仅优尚API有模型时，仍保持可用并具备前向兼容能力。

## 第七十一阶段（图片/分镜/视频模型选择器统一为分组优先与两列等宽）

### 变更时间
2026-04-26

### 变更文件
- `src/components/canvas/ImageCanvasNode.vue`
- `src/components/canvas/StoryboardGenCanvasNode.vue`
- `src/components/canvas/VideoCanvasNode.vue`

### 变更原因
- 用户要求将视频生成、分镜生成、图片节点的模型选择器统一为：
  1) 先选分组再选模型；
  2) 模型列表每行 2 个且等宽；
  3) 为后续新增模型渠道预留空分组展示能力。

### 变更内容
1. 三类节点模型弹层统一交互
   - 增加（或完善）“供应商分组 -> 模型列表”的两段式选择流程。
   - 当分组暂无模型时显示空态提示：`当前分组暂无可用模型`。

2. 分组列表保留空分组
   - 图片节点与分镜节点的分组源改为保留全部分组（不再过滤空分组），与文本/视频保持一致，确保未来可直接扩展。

3. 模型按钮统一为两列等宽
   - 三类节点模型区统一改为 `grid` 两列布局：
     `grid-template-columns: repeat(2, minmax(0, 1fr))`
   - 模型按钮宽度设为 `100%`，实现每行 2 个、同等宽度。

### 影响说明
- 图片、分镜、视频三个节点的模型选择体验与文本处理节点一致；
- 当前只有优尚API有模型时功能不受影响，同时兼容后续多渠道模型接入。

## 第七十二阶段（模型选择项增加平台徽标前缀）

### 变更时间
2026-04-27

### 变更文件
- `src/utils/modelPlatformBadge.ts`
- `src/components/canvas/TextProcessCanvasNode.vue`
- `src/components/canvas/ImageCanvasNode.vue`
- `src/components/canvas/StoryboardGenCanvasNode.vue`
- `src/components/canvas/VideoCanvasNode.vue`

### 变更原因
- 用户要求在模型选择器中，模型名称前展示平台标识，便于快速识别即梦 / GPT / Banana / 千问 / Grok / Sora / Veo / DeepSeek 等来源。

### 变更内容
1. 新增平台识别与徽标映射工具
   - 新建 `modelPlatformBadge` 工具，按 `modelId + modelName` 识别平台。
   - 输出统一徽标数据（平台 key + short 文本），供各节点复用。

2. 四类节点模型列表统一接入徽标
   - 文本处理、图片、分镜、视频节点模型弹层中，模型按钮前新增平台徽标块。
   - 模型按钮结构统一为：`平台徽标 + 模型名称`。

3. 平台徽标视觉规范
   - 按平台提供固定色块与短标识（如 JM / GPT / BN / QW / GK / SO / VE / DS / AI）。
   - 模型名称保持省略策略，保证弹层在两列等宽布局下可读。

### 影响说明
- 模型来源识别效率提升，减少跨平台模型误选；
- 徽标逻辑集中在工具文件，后续替换为真实 logo 资源时只需改一处映射。

## 第七十三阶段（点击连线就地弹出删除按钮）

### 变更时间
2026-04-27

### 变更文件
- `src/views/CanvasEditor.vue`

### 变更原因
- 用户要求在点击连线时，于点击位置显示可操作按钮，用于快速切断节点之间的连接，降低连线编辑成本。

### 变更内容
1. 连线点击交互增强
   - `@edge-click` 事件改为接收点击坐标与目标边信息。
   - 在鼠标点击位置附近弹出“删除连线”按钮（固定定位并做视口边界约束）。

2. 连线删除动作接入
   - 点击按钮后删除当前目标边，并推入历史（支持撤销/重做链路一致性）。
   - 删除成功后显示提示消息：`连线已删除`。

3. 收起与互斥逻辑
   - 点击画布空白、节点或遮罩时自动关闭连线删除按钮。
   - 与双击加节点菜单共存，互不干扰。

### 影响说明
- 连线删除从“键盘/间接操作”升级为“就地可视化操作”；
- 不改变既有节点与边的数据结构，仅增强编辑体验。

## 第七十四阶段（资产提取升级为“总资产 -> 单资产 -> 图片资产”链路）

### 变更时间
2026-04-27

### 变更文件
- `src/components/canvas/TextProcessCanvasNode.vue`
- `src/components/canvas/TextAssetResultCanvasNode.vue`
- `src/components/canvas/TextAssetDetailCanvasNode.vue`（新增）
- `src/views/CanvasEditor.vue`

### 变更原因
- 用户要求资产提取后不再只输出三类列表节点，而是形成可继续编辑与出图的资产生产链路：
  1) 人物/场景/道具总资产节点只展示资产名；
  2) 每个资产拆分为可编辑“资产节点”；
  3) 每个资产节点后自动连接图片节点，并在资产名/描述改动时同步图片节点提示词。

### 变更内容
1. 总资产节点改造（仅显示资产名）
   - 三类节点标签调整为：`人物总资产节点`、`场景总资产节点`、`道具总资产节点`。
   - `TextAssetResultCanvasNode` 由“名称+描述+绑图”改为“仅名称列表展示”。

2. 新增单资产节点类型
   - 新增组件 `TextAssetDetailCanvasNode`（`type: textAssetDetail`）。
   - 节点内提供可编辑字段：资产名称、资产描述。
   - 编辑时同步写回节点数据，并触发下游图片节点提示词更新。

3. 资产提取后自动生成二级链路
   - 在 `handleExtractAssets` 成功后，按三类总资产节点分别创建：
     `总资产节点 -> 单资产节点 -> 图片节点(imageCanvas)`。
   - 图片节点初始化携带资产提示词（名称+描述），可直接用于资产图生成。
   - 再次提取时会清理旧的“总资产节点下游自动生成链路”并重建，避免重复堆叠。

4. 画布节点注册
   - `CanvasEditor` 注册 `textAssetDetail` 节点类型并补充尺寸回退，确保渲染与分组逻辑稳定。

### 影响说明
- 资产提取从“结果展示”升级为“可编辑 + 可出图”流水线；
- 资产信息编辑可直接驱动下游图片节点提示词，减少重复手工维护。

## 第七十五阶段（资产提取节点自动排布防遮盖）

### 变更时间
2026-04-27

### 变更文件
- `src/components/canvas/TextProcessCanvasNode.vue`

### 变更原因
- 用户反馈资产提取后自动创建的节点出现遮盖和重叠，影响编辑效率与可读性。

### 变更内容
1. 总资产节点纵向间距重排
   - 人物/场景/道具总资产节点由紧密排布改为固定纵向大间距排布，避免三类总资产节点互相覆盖。

2. 单资产链路改为分类分列排布
   - 单资产节点与其图片节点按资产类别分配独立列偏移（人物列/场景列/道具列），减少跨类别堆叠。

3. 同类别资产链路行步距放大
   - 同一类别下的“资产节点 -> 图片节点”按固定行高步距递增，确保多资产场景下节点之间保留可视间隔，不再上下覆盖。

### 影响说明
- 资产提取后生成节点更接近“自动整齐编排”，可直接继续编辑与出图；
- 不改变资产数据结构，仅优化自动布局算法与可视化稳定性。

## 第七十六阶段（资产链按“人物→场景→道具”纵向分段排布）

### 变更时间
2026-04-27

### 变更文件
- `src/components/canvas/TextProcessCanvasNode.vue`

### 变更原因
- 用户要求资产链路展示顺序固定为：
  - 人物（左）- 人物图片（右）连续多行；
  - 然后场景（左）- 场景图片（右）连续多行；
  - 最后道具（左）- 道具图片（右）连续多行；
- 目标是避免类别交错，提升浏览与批量编辑效率。

### 变更内容
1. 资产链布局统一为两列
   - 所有“资产节点”使用同一左列 X 坐标；
   - 所有“图片节点”使用同一右列 X 坐标；
   - 每行保持“左资产、右图片”一一对应。

2. 类别顺序改为分段纵排
   - 以人物 -> 场景 -> 道具固定顺序创建链路；
   - 每个类别完成后，按分段间距切换到下一类别起始行；
   - 取消旧的“按类别分不同横向列偏移”策略。

3. 段内行距与段间距独立控制
   - 段内使用固定行步距，保证同类多资产不重叠；
   - 段间使用独立间距，保证类别分隔清晰。

### 影响说明
- 资产提取后的自动布局从“分类分列”改为“分类分段纵向列表”；
- 连线关系和节点数据结构保持不变，仅调整自动排布顺序与坐标策略。

## 第七十七阶段（单资产节点标题按类别语义化）

### 变更时间
2026-04-27

### 变更文件
- `src/components/canvas/TextProcessCanvasNode.vue`
- `src/components/canvas/TextAssetDetailCanvasNode.vue`

### 变更原因
- 用户要求单资产节点标题不再统一显示“资产节点”，而是按类别显示：
  - 人物资产
  - 场景资产
  - 道具资产

### 变更内容
1. 新建单资产节点时按类别写入标题
   - 人物类别写入 `人物资产`
   - 场景类别写入 `场景资产`
   - 道具类别写入 `道具资产`

2. 历史节点标题兼容显示
   - 在单资产节点组件增加标题兜底逻辑：当节点历史数据仍是 `资产节点` 时，基于 `assetCategory` 动态映射为对应类别标题，避免旧数据显示不一致。

### 影响说明
- 新创建与历史已有的单资产节点标题均统一为类别语义化名称；
- 不改变资产编辑、连线、出图及提示词同步逻辑。

## 第七十八阶段（单资产节点名称区简化与描述框可变高）

### 变更时间
2026-04-27

### 变更文件
- `src/components/canvas/TextAssetDetailCanvasNode.vue`

### 变更原因
- 用户要求单资产节点进一步优化可编辑性与空间利用：
  1) 资产描述输入框支持自由调整高度；
  2) 去掉“资产名称”文案，仅直接显示资产名输入；
  3) 节点默认外观调整为正方形，后续可随描述框拉伸而增高。

### 变更内容
1. 资产名称区域简化
   - 删除名称输入上方“资产名称”字段标签；
   - 保留名称输入框本体，减少视觉冗余。

2. 描述输入框改为可拖拽变高
   - `textarea` 由 `resize: none` 调整为 `resize: vertical`，支持用户手动拉伸高度。

3. 单资产节点默认尺寸改为正方形
   - 节点默认宽高统一为 `300 x 300`（最小高度 300）；
   - 节点保持自适应增高能力，当描述框被拉高时节点总高度随内容增长。

### 影响说明
- 单资产节点默认更规整，编辑描述时更灵活；
- 不影响资产数据结构、链路布局顺序与下游图片节点同步逻辑。

## 第七十九阶段（总资产节点合并为单节点分组折叠展示）

### 变更时间
2026-04-27

### 变更文件
- `src/components/canvas/TextProcessCanvasNode.vue`
- `src/components/canvas/TextAssetResultCanvasNode.vue`
- `src/components/canvas/StoryboardGenCanvasNode.vue`
- `src/views/CanvasEditor.vue`

### 变更原因
- 用户要求资产提取后不再拆分“人物总资产 / 场景总资产 / 道具总资产”三个节点，改为一个总资产节点，并在节点内分组展示且可折叠。
- 要求节点顶部显示提取总数，分组头显示“角色（数量）/ 场景（数量）/ 道具（数量）”。

### 变更内容
1. 文本处理节点提取流程改为单总资产节点
   - 资产提取等待态与完成态统一写入 `totalAssetNodeId` 对应节点；
   - 提取结果写入同一节点的 `groupedAssets`（角色/场景/道具）及扁平 `assets`（兼容链路）；
   - 清理历史三总资产节点字段与节点实例，避免新旧结构并存导致混乱。

2. 总资产节点 UI 改为分组折叠结构
   - 节点头部新增总数徽标：`提取资产数量（N）`；
   - 节点体内展示三组折叠区：`角色（数量）`、`场景（数量）`、`道具（数量）`；
   - 支持点击分组头展开/收起，并将折叠状态写回节点数据。

3. 单资产链路创建逻辑改为从单总资产节点分段生成
   - 详情节点与图片节点依旧按角色->场景->道具顺序纵向分段排布；
   - 统一从同一个总资产节点向右输出链路。

4. 分镜节点资产采集兼容新结构
   - 分镜侧提取上游资产时优先读取 `groupedAssets`；
   - 保留对旧 `assets` 扁平结构的兼容，避免历史项目断链。

### 影响说明
- 资产提取入口由“三总资产节点”升级为“单总资产节点 + 分组折叠”；
- 分镜 `@资产` 与参考图收集逻辑继续可用，并兼容历史数据。

## 第八十阶段（总资产分组标题统一为“人物/场景/道具”）

### 变更时间
2026-04-27

### 变更文件
- `src/components/canvas/TextAssetResultCanvasNode.vue`

### 变更原因
- 用户明确要求总资产节点内分组名称为“人物、场景、道具”，避免“角色”与其它页面文案不一致。

### 变更内容
1. 分组标题文案对齐
   - 将总资产节点内第一组标题由 `角色` 调整为 `人物`；
   - 保持其余两组为 `场景`、`道具`，分组计数显示逻辑不变。

### 影响说明
- 总资产节点内分组命名与用户预期一致；
- 不影响分组折叠状态、分镜读取资产、资产链路生成与保存结构。

## 第八十一阶段（总资产节点新增“重新提取”与高度上限提升）

### 变更时间
2026-04-27

### 变更文件
- `src/components/canvas/TextAssetResultCanvasNode.vue`
- `src/components/canvas/TextProcessCanvasNode.vue`

### 变更原因
- 用户要求在总资产节点底部增加“重新提取”入口，直接在资产节点触发二次提取；
- 用户要求提升总资产节点可展示的最大高度，减少分组内容滚动压缩。

### 变更内容
1. 总资产节点底部操作区
   - 新增固定底部区域与按钮 `重新提取`；
   - 提取中状态下按钮禁用并显示 `提取中…`，避免重复触发。

2. “重新提取”动作打通文本节点提取链路
   - 总资产节点点击后定位其上游文本处理节点（优先 `sourceNodeId`，其次连线回溯）；
   - 通过写入 `assetReextractTrigger` 触发文本处理节点 `handleExtractAssets` 重跑提取流程。

3. 总资产节点最大展示高度提升
   - 将总资产节点内容区 `max-height` 从 360 提升到 520，提升分组内容可见面积。

4. 总资产节点数据补充来源字段
   - 总资产节点写入 `sourceNodeId`，便于节点内“重新提取”精准回溯来源文本节点。

### 影响说明
- 用户可直接在总资产节点中重跑提取，无需回到文本节点点击；
- 总资产节点在资产较多时可一次展示更多内容，交互更顺畅。

## 第八十二阶段（总资产分组单组最多显示5条并组内滚动）

### 变更时间
2026-04-27

### 变更文件
- `src/components/canvas/TextAssetResultCanvasNode.vue`

### 变更原因
- 用户要求每个资产分组展开时最多显示 5 个资产；超过 5 个时在分组内部滚轮滚动查看。
- 同时要求三组展开时可见容量按“最多约 15 条（每组 5 条）”组织。

### 变更内容
1. 分组资产列表限高
   - 为每个分组内的资产列表增加固定 `max-height`（约 5 条资产可见）。
   - 超出条目启用 `overflow-y: auto`，在当前分组内部滚动。

2. 总资产内容区高度上限提升
   - 提高总资产节点内容区 `max-height`，使三组同时展开时可承载三段“5条可视”区域。

### 影响说明
- 每组资产展示密度稳定：最多显示 5 条，更多条目通过组内滚动查看；
- 三组并开展示时，信息层级更清晰，滚动行为从“整节点混滚”优化为“分组局部滚动”。

## 第八十三阶段（资产详情与图片改为分类横排网格布局）

### 变更时间
2026-04-27

### 变更文件
- `src/components/canvas/TextProcessCanvasNode.vue`

### 变更原因
- 用户要求总资产节点右侧链路按类别改为横向构图：
  - 每个类别内“上排资产节点、下排对应图片节点”横向展开；
  - 类别之间纵向分区且间距明显；
  - 资产节点与图片节点上下间距加大并避免重叠。

### 变更内容
1. 类别内布局由纵排改为横排
   - 人物/场景/道具各类别内部，按资产索引横向递增 X 坐标；
   - 每一列保持“上资产节点、下图片节点”一一对应。

2. 分类纵向分区增强
   - 类别区块按“人物 -> 场景 -> 道具”顺序纵向排布；
   - 区块跨度与区块间隙增大，确保类别之间有明显视觉留白。

3. 资产与图片垂直间距增大
   - 同列中资产节点到图片节点的 Y 间距提高，避免上下贴近。

### 影响说明
- 自动布局从“按类别纵向列表”升级为“按类别横向网格 + 纵向分区”；
- 节点连线和资产数据结构不变，重点提升可读性与后续批量编辑效率。

## 第八十四阶段（资产横排布局改为“场景居中锚定”）

### 变更时间
2026-04-27

### 变更文件
- `src/components/canvas/TextProcessCanvasNode.vue`

### 变更原因
- 用户要求资产自动排布的纵向锚点以文本处理节点中心为基准：
  - 场景资产区块（场景资产行 + 场景图片行）的中心对齐文本处理节点垂直中心；
  - 人物区块在其上方；
  - 道具区块在其下方。

### 变更内容
1. 引入中心锚定计算
   - 读取文本处理节点 `position + dimensions` 计算垂直中心线；
   - 场景区块起始 Y 由“中心线 - 区块半高”推导，不再使用顺序累加起点。

2. 三类区块改为固定相对位移
   - 人物区块：`场景区块 - 区块高度 - 类别间距`；
   - 道具区块：`场景区块 + 区块高度 + 类别间距`；
   - 保持类别内横向排布、上下两行（资产在上、图片在下）不变。

### 影响说明
- 自动布局纵向视觉中心与文本处理节点对齐，构图更稳定；
- 当用户关注文本处理主链路时，场景区块处于中轴位置，人物/道具上下分布更符合阅读动线。

## 第八十五阶段（总资产节点兼容空资产脏数据防崩溃）

### 变更时间
2026-04-27

### 变更文件
- `src/components/canvas/TextAssetResultCanvasNode.vue`

### 变更原因
- 历史快照中存在 `groupedAssets/assets` 含 `null` 项的情况，模板渲染 `asset.id` 时触发：
  - `TypeError: Cannot read properties of null (reading 'id')`
- 需要提升总资产节点对旧数据与异常数据的容错能力。

### 变更内容
1. 增加资产列表清洗函数
   - 对分组资产和扁平资产统一做规范化：
     - 过滤 `null/非对象` 项；
     - 兜底字段类型（`id/name/description/imageUrl/category`）；
     - 过滤空名称项。

2. 模板渲染兜底
   - `v-for` key 增加回退：`asset.id || \`${group.key}-${index}\``；
   - 资产名称显示增加回退文案：`未命名资产N`。

### 影响说明
- 总资产节点加载历史快照时不再因空资产项崩溃；
- 不改变正常资产提取流程与分组展示结构，仅增强容错稳定性。

## 第八十六阶段（分镜生成节点锚定到道具图片区块下方并左对齐资产列）

### 变更时间
2026-04-27

### 变更文件
- `src/components/canvas/TextProcessCanvasNode.vue`

### 变更原因
- 用户要求文本处理节点“生成分镜”后的分镜节点排布与资产链路构图一致：
  1) 分镜节点起点应位于“道具图片节点”区块下方；
  2) 与资产图片区块保持与“场景区块/道具区块”一致的纵向间距；
  3) 分镜节点左边界与上方资产节点列左对齐。

### 变更内容
1. 新增分镜起点解析函数
   - `resolveStoryboardStartPosition` 在生成分镜前计算起始坐标；
   - 优先基于总资产节点与已生成资产链路定位，缺失时回退旧默认坐标。

2. Y 轴锚定改造
   - 遍历自动生成链路中的“道具图片节点”，取其底部最大值；
   - 分镜首节点 Y = `道具图片区块底部 + ASSET_CATEGORY_SECTION_GAP_Y`。

3. X 轴左对齐改造
   - 分镜首节点 X 与资产详情节点列 X 统一（总资产节点右侧资产列起点）；
   - 保证分镜节点与上方资产节点形成同一左对齐基线。

### 影响说明
- 文本处理 -> 资产 -> 分镜 的纵向流程层级更清晰；
- 分镜节点不再与资产区块抢占中段空间，且构图左边线统一。

## 第八十七阶段（分镜节点读取资产分组增加空值容错）

### 变更时间
2026-04-27

### 变更文件
- `src/components/canvas/StoryboardGenCanvasNode.vue`

### 变更原因
- 用户反馈在加载历史快照时，分镜节点报错：
  - `Cannot read properties of null (reading 'id')`
- 原因是 `groupedAssets` / `assets` 中混入 `null` 或非标准对象，分镜节点在收集资产时直接读取字段触发异常。

### 变更内容
1. 新增资产清洗函数
   - 在分镜节点侧增加 `normalizeAssetItems`；
   - 统一过滤 `null/非对象` 资产项，并规范 `id/name/description/imageUrl/category`。

2. 分组与扁平资产两条链路统一清洗
   - 读取 `groupedAssets.character/scene/prop` 时先清洗再映射；
   - 读取历史 `assets`（扁平结构）时同样先清洗再回退分类映射。

### 影响说明
- 分镜节点在历史快照和脏数据场景下不再因空资产项崩溃；
- 不改变正常 `@资产` 联想、引用汇总与参考图收集逻辑，仅增强容错稳定性。

## 阶段记录（仅保留逻辑变更）

## 第五十九阶段（文本处理节点新增“生成分镜”并自动落地到画布）

### 变更时间
2026-04-26

### 变更文件
- `src/components/canvas/TextProcessCanvasNode.vue`

### 变更原因
- 用户要求在文本处理节点中新增“生成分镜”能力，逻辑对齐创梦工坊文档上传区的分镜生成功能。
- 额外要求：AI 返回多少个分镜就创建多少个 `分镜生成` 节点；每个分镜中包含多少个 `grid`，就占用该节点对应数量的镜头格子。

### 变更内容
1. 节点按钮扩展
   - 在文本处理节点底部动作区新增按钮：`生成分镜`。
   - 增加独立加载状态 `generatingStoryboards`，避免重复触发。

2. 分镜生成流程接入
   - 复用与文档上传页一致的提示词来源：`promptsStore.getGenerateStoryboardPrompt()`。
   - 文本来源规则：
     - 若已选章节，拼接选中章节内容；
     - 否则使用文本处理节点正文内容。
   - 调用 `apiService.generateText()` 生成分镜 JSON。

3. AI 结果解析与 Grid 提取
   - 支持解析 `storyboards` 数组结构（兼容直接 JSON 或包裹 JSON 文本）。
   - 每个分镜优先读取 `grids` 字段；若无则从 `description` 中按 `Grid1 / Grid2 / Grid3`（或镜头编号）拆分。
   - 自动计算网格布局（rows/cols），并将每条 grid 文案填充到 `frames`，实现“1 grid = 1 镜头格”。

4. 自动创建画布节点
   - 按 AI 返回分镜数量，批量创建 `storyboardGen` 节点并在右侧纵向排布。
   - 为每个新节点创建与文本处理节点的连线，保持画布流程可视化。
   - 节点默认数据包含：`gridRows/gridCols/frames/imageModelGroup/imageModel/imageQuality/aspectRatio` 等必要字段。

### 结果
- 文本处理节点可一键生成多个分镜生成节点；
- 分镜数量与 AI 返回条目一一对应；
- 每个分镜的 grid 数量可直接映射到对应节点镜头格，减少手动拆分工作量。

## 第六十阶段（文本/视频模型分组语义与默认来源修正）

### 变更时间
2026-04-26

### 变更文件
- `src/components/canvas/TextProcessCanvasNode.vue`
- `src/components/canvas/VideoCanvasNode.vue`

### 变更原因
- 用户明确：文本处理中的文字模型、视频生成中的视频模型均属于 `优尚API` 分组。
- 排查发现文本节点模型默认值存在回退到全局 `selectedModel` 的风险，可能误落到图片模型。

### 变更内容
1. 文本处理节点模型来源修正
   - `textModel` 默认回退从 `currentConfig.selectedModel` 调整为：
     `documentUploadModel -> textModels[0] -> ''`。
   - `ensureDefaults` 增加合法性校验：若节点中缓存模型不在 `textModels` 列表内，自动纠正为文字模型默认值。
   - 模型弹层打开时同样执行合法性校验，避免异常 ID 残留导致请求走错模型。

2. 分组标签语义统一
   - 文本处理模型芯片副标签调整为 `优尚API`。
   - 视频生成模型芯片副标签调整为 `优尚API`。

### 结果
- 文本处理节点的文字模型稳定限定在文字模型集合内，不再受全局通用模型字段干扰；
- 文本/视频节点底部模型分组展示与实际分组语义一致。

## 第六十一阶段（图片节点下载IPC缺失修复）

### 变更时间
2026-04-26

### 变更文件
- `electron/main.ts`

### 变更原因
- 用户点击图片节点右上角下载按钮时报错：
  `Error invoking remote method 'dialog-saveFile': No handler registered for 'dialog-saveFile'`。
- 排查发现 `preload.ts` 已暴露 `dialog.saveFile`，但主进程未注册对应 IPC handler。

### 变更内容
- 在主进程新增以下 IPC 处理器：
  - `dialog-openFile`
  - `dialog-saveFile`
- 调用 Electron 原生 `dialog.showOpenDialog / dialog.showSaveDialog`，并返回统一结构。

### 结果
- 图片节点下载流程所依赖的 `dialog-saveFile` 可正常调用；
- 渲染进程 `electronAPI.dialog` 与主进程 handler 对齐，不再出现“未注册 handler”错误。

## 第六十二阶段（分镜生成结果自动输出图片节点）

### 变更时间
2026-04-26

### 变更文件
- `src/components/canvas/StoryboardGenCanvasNode.vue`

### 变更原因
- 用户要求：分镜生成节点点击“生成分镜”后，不仅在本节点显示结果，还要从右侧自动输出一个图片节点用于承接与展示生成图。
- 参考 `F:\8.gongzuoliu` 的分镜生成后结果节点自动落地思路，保持画布流程连贯。

### 变更内容
1. 接入画布节点/连线创建能力
   - 在分镜节点中引入 `addNodes/addEdges/findNode`，用于在当前节点右侧创建新图片节点并连线。
   - 引入 `canvasPushStateBeforeChange`，在自动创建节点前写入历史快照，保证撤销/重做链路可用。

2. 新增分镜输出节点创建逻辑
   - 新增 `createGeneratedImageOutputNode(url, prompt, modelId)`：
     - 基于当前分镜节点坐标，在右侧偏移位置创建 `imageCanvas` 节点；
     - 将本次生成图写入新节点 `generatedImageUrl`；
     - 将本次提示词、模型、比例、质量等参数透传到新节点数据；
     - 自动创建当前分镜节点到新图片节点的连线，并复用全局连线样式配置。

3. 生成成功后自动落地输出节点
   - 在 `handleGenerateStoryboard` 生成成功分支中，更新当前节点状态后，立即创建右侧图片输出节点。

### 结果
- 分镜生成成功后，画布会自动在节点右侧新增图片节点并显示结果图；
- 新节点与分镜节点自动连线，后续可继续串联图片编辑、视频生成等流程；
- 节点自动创建行为可被撤销，交互连续性与可操作性提升。

## 第六十三阶段（分镜生成接入“生成分镜图提示词”模板）

### 变更时间
2026-04-26

### 变更文件
- `src/components/canvas/StoryboardGenCanvasNode.vue`

### 变更原因
- 用户要求画布工坊中的分镜生成逻辑与创梦工厂一致：生成分镜图时需携带主页左侧【提示词】中“生成分镜图提示词”的配置内容。

### 变更内容
1. 接入提示词仓库
   - 在分镜节点中引入 `usePromptsStore`，读取 `getStoryboardImagePrompt()` 模板内容。

2. 分离“分镜描述”与“最终请求提示词”
   - 新增 `buildStoryboardDescription()` 负责组装节点当前分镜描述（宫格说明 + 镜头描述 + 额外提示词）。
   - 新增 `buildStoryboardPrompt(description)` 负责将描述与模板合成最终请求提示词。

3. 支持模板占位符替换
   - 当模板中存在 `{description}` 时，使用分镜描述进行替换；
   - 当模板不含占位符时，按“模板 + 分镜提示词内容”方式拼接，保证兼容旧模板。

4. 保持原有空内容拦截逻辑
   - 校验仍基于“分镜描述”本身是否为空，避免仅因模板存在导致误触发生成。

### 结果
- 画布分镜生成已携带并使用【提示词】中“生成分镜图提示词”模板；
- 模板可通过 `{description}` 精确注入当前分镜描述，行为与创梦工厂配置方式对齐。

## 第六十四阶段（分镜生成接入“@资产 + 连线收图 + 去重”）

### 变更时间
2026-04-26

### 变更文件
- `src/components/canvas/TextProcessCanvasNode.vue`
- `src/components/canvas/TextAssetResultCanvasNode.vue`
- `src/components/canvas/StoryboardGenCanvasNode.vue`

### 变更原因
- 用户要求将 C 方案与“@资产引用 + 上游连线兜底”结合：
  - 分镜文案中出现 `@资产名` 时，优先携带对应资产图；
  - 同时支持遍历输入连线自动收集上游图片；
  - 同一资产或同一图片只携带一次，避免重复。

### 变更内容
1. 资产数据结构升级（C 方案底座）
   - 为资产项增加 `imageUrl` 字段，文本处理节点提取出的资产默认带 `imageUrl: null`。
   - 资产结果节点支持给每条资产绑定/替换/移除图片，图片写回节点 `assets` 数据。

2. 分镜生成的 `@资产` 解析
   - 分镜节点新增 `@` 语法解析（从分镜描述中提取 `@资产名`）。
   - 从输入连线连接的资产节点中匹配命中资产，提取其描述并拼入提示词上下文（`【@引用资产信息】`）。

3. 输入连线图片自动收集 + 去重
   - 分镜节点在生成时遍历输入连线，收集上游节点主图及资产节点内图片。
   - 与“@命中资产图”及节点本地参考图统一合并去重。
   - 最终参考图按上限裁剪（防止模型请求超限）。

4. 生成请求统一出口
   - 分镜图生成请求改为使用“合并后的参考图数组”，不再只依赖节点底部手动上传参考图。

### 结果
- 分镜生成支持“文本中精确点名资产 + 连线自动补图”的混合策略；
- 同图重复上传问题得到规避，参考图携带更稳定；
- 画布分镜链路更贴近创梦工坊的资产驱动生成逻辑。

## 第六十五阶段（分镜输入框 @资产联想选择）

### 变更时间
2026-04-26

### 变更文件
- `src/components/canvas/StoryboardGenCanvasNode.vue`

### 变更原因
- 用户反馈手输 `@资产名` 时不确定格式是否正确，期望提供确认选择，降低误拼写导致的命中失败。

### 变更内容
1. 分镜输入框新增 `@` 联想面板
   - 在镜头输入框中输入 `@` 后，根据当前输入光标位置解析 token；
   - 联想来源为当前分镜节点输入连线可见的资产名称列表；
   - 支持模糊过滤显示候选项。

2. 键盘与鼠标交互
   - 支持方向键上下切换、Enter/Tab 确认、Esc 关闭；
   - 支持鼠标点击候选项完成替换；
   - 替换后自动回填到原输入框并保持光标位置连续。

3. 面板显示与收起控制
   - 根据输入框聚焦/失焦状态进行延时收起，避免点击候选时误关闭；
   - 面板定位在当前输入框下方，支持滚动。

### 结果
- 分镜输入 `@资产` 不再依赖纯手工拼写；
- 资产引用命中率提升，`@` 语义引用与图片携带逻辑更稳定可用。

## 九、最近逻辑调整记录

### 2026-04-25 新增「三维视图」节点
- 参考来源：`F:\8.gongzuoliu\src\features\canvas\nodes\Viewport3DNode.tsx` 的节点职责与交互思路。
- 新增文件：`src/components/canvas/Viewport3DCanvasNode.vue`。
- 主要能力：
  - 节点内 Three.js 场景（网格、灯光、OrbitControls）。
  - 左输入/右输出 Handle，支持连接到上下游节点。
  - 自动读取上游图片节点/VR360 节点图像并作为三维背景平面贴图。
  - 支持添加立方体、选中对象、TransformControls（移动/旋转/缩放）与对象状态回写节点数据。
- 编辑器接入：
  - `src/views/CanvasEditor.vue` 注册新节点类型 `viewport3d`。
  - 右键“添加节点”菜单新增「三维视图」入口。
  - `addNodeAtPosition` 增加 `viewport3d` 分支及默认数据结构。

### 2026-04-25 三维视图能力补齐（第二阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 新增能力：
  - 对象列表面板（对象选择、重命名、颜色调整、删除选中）。
  - 相机预设按钮（前/后/左/右/ISO）。
  - 导出“颜色图 + 深度图”，并在画布右侧自动生成两个图片节点并连线。
- 说明：深度图使用 Three.js `MeshDepthMaterial + BasicDepthPacking` 渲染并做近远反相（近处更亮）。

### 2026-04-25 三维视图交互修正（第三阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 点击物体后显示并稳定保留 `TransformControls` 轴线（移动/旋转/缩放）。
  - 点击 Gizmo 轴线时不再触发“空白取消选中”（新增 Gizmo 命中检测）。
  - 强化 `OrbitControls`：启用自由旋转/缩放/平移（左键旋转，中键缩放，右键平移）。
  - 增加节点内全屏切换能力（含 `fullscreenchange` 后尺寸重算）。
- 结果：三维视图可实现“选中对象→显示轴线→拖拽变换”，并支持自由观察场景与全屏编辑。

### 2026-04-25 三维视图报错与场景控制修复（第四阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 将 `TransformControls` 按 three.js 新用法接入：`scene.add(transformControls.getHelper())`，不再将 `TransformControls` 本体直接加入场景。
  - Gizmo 命中检测改为检测 `getHelper()`，修复点击物体/轴线时报错问题。
  - 对象点选仅响应左键，右键/中键保留给 OrbitControls，避免抢占平移/缩放交互。
  - 追加 `contextmenu.preventDefault`，保证右键平移不被浏览器菜单打断。
- 结果：点击物体不再报错，场景可自由旋转、缩放与平移。

### 2026-04-25 三维视图鼠标交互传播修正（第五阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：移除自定义 `pointermove` / `pointerup` 处理中的 `stopPropagation()`。
- 原因：事件被拦截在 canvas 层会导致 OrbitControls 无法在场景内接收连续 move/up，表现为“鼠标移出场景才开始正常旋转/平移”。
- 结果：左键场景内拖动可正常旋转，右键场景内拖动可正常平移，行为与预期一致。

### 2026-04-25 三维视图对象选中修复（第六阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：将“是否点击到 gizmo”的判定从自定义射线检测改为 `TransformControls.axis` 状态判定。
- 原因：旧射线检测在某些角度下会误判为命中 gizmo，导致空白点击无法取消选中、点击其它物体也无法切换选中。
- 结果：支持“选中 A → 点击空白取消 → 选中 B”，物体选择切换恢复正常。

### 2026-04-25 三维视图对象库分类扩展（第七阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 对象库扩展为 7 大分类：人物分类、室内家居、室外道具、古风道具、建筑大件、装饰品类、几何模型。
  - 分类按钮采用“两列网格”展示，满足“分类每行两个”交互要求。
  - 人物分类补充子分类（站立姿势、坐姿势、躺姿势），并支持切换对应素材列表。
  - 所有素材按钮均接入“添加到场景”逻辑；几何模型按类型生成对应几何体（平面、球体、圆柱、圆环、12面体等）。
- 结果：点击任意分类素材按钮都可新增场景对象，满足对象库分组与批量扩展需求。

### 2026-04-25 三维视图语义化组合模型（第八阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 将场景对象容器从单一 `Mesh` 扩展为 `Object3D`，支持组合模型（`Group`）并保持 TransformControls 可编辑。
  - 新增组合模型构建器：为非几何类素材按语义生成多部件默认形态（如树=树干+树冠、路灯=细柱+灯头、房子=主体+屋顶、汽车=车身+车窗+轮子等）。
  - 点击检测改为递归射线（`intersectObjects(..., true)`），保证组合模型任一子部件都可正确选中整对象。
  - 新增对象资源回收与着色遍历逻辑，避免组合子 Mesh 的内存泄漏并保持颜色编辑可用。
- 结果：非几何素材从“单方块占位”升级为“语义化组合模型”，视觉辨识度显著提升。

### 2026-04-25 三维视图建筑/古风语义模型深化（第九阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 扩展 `buildCompositeModel`，对建筑大件、人物姿态、古风与装饰素材补充二层语义模型。
  - 新增/细化模型示例：亭子、石桥、云朵、祭坛、石碑、卷轴、竹子、盆景、画卷、纱帘、古井、院墙与大门、古庙、宝塔、帐篷、城楼、拱门、现代墙、玻璃门、高楼、小卖部。
  - 同步增加人物姿势与古风/装饰细分模型（站/坐/躺姿势、丹炉、莲花座、铜镜、梳子、枕头、毛笔、砚台、沙漏、香炉、书籍）。
- 结果：非几何类素材在场景中具备更明显结构差异，便于快速搭景与视觉识别。

### 2026-04-25 三维视图 Delete 键删除对象优先级修复（第十阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：新增窗口级 `keydown` 捕获监听；当三维场景内存在已选中对象时，拦截 `Delete/Backspace` 并执行“删除选中对象”。
- 保护：若当前焦点在输入框/文本域/可编辑区域，则不拦截键盘事件，避免影响文本编辑。
- 结果：修复“按 Delete 误删整个节点”的问题，实现“选中场景物体后按 Delete 删除物体”。

### 2026-04-25 三维视图分类文案与人物按钮直达（第十一阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 分类名称调整为：人物、室内、室外、道具、建筑、装饰、模型。
  - 人物分类从“二级子分类”改为“直接素材按钮”，提供 `站立`、`坐姿`、`躺姿`，点击即添加对象。
  - 兼容旧对象名称：组合模型判定同时支持 `站立姿势/坐姿势/躺姿势` 与新名称，避免历史数据显示异常。
- 结果：人物分类操作路径更短，分类命名与最新产品文案保持一致。

### 2026-04-25 三维视图人物模型精细化（第十二阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 重构 `站立/坐姿/躺姿` 的组合模型，替换原“单胶囊+球体”简化结构。
  - 新增更细部件：头部、头发、颈部、躯干、骨盆、双臂、双手、双腿、鞋体，并根据姿态设置不同关节朝向。
  - 保持人物主色可编辑，同时对肤色/头发/裤装/鞋体使用固定辅色，提高人物可读性与层次感。
- 结果：人物造型从占位体升级为结构化角色模型，视觉精细度与识别度明显提升。

### 2026-04-25 人物模型结构纠偏（第十三阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 按用户反馈修复人物关键结构：补充眼睛/鼻子/嘴巴，修正手臂挂点与长度，骨盆由方块改为更自然的圆柱结构。
  - 调整下肢间距与尺寸，降低“大腿穿模”概率；同步修正鞋体高度与脚踝连接关系。
  - 对站立/坐姿/躺姿三种姿态统一执行上述纠偏，保证模型风格和连接逻辑一致。
- 结果：人物面部可识别，四肢连接更自然，站姿观感明显改善。

### 2026-04-25 站立人物接入 OBJ 模型（第十四阶段）
- 文件：`public/models/character1.obj`、`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 从参考项目复制 `character1.obj` 到当前项目 `public/models/character1.obj`。
  - 三维视图新增 OBJ 资源加载与缓存逻辑（`OBJLoader`），并在场景构建时预加载角色模型。
  - “站立”人物新增时优先使用 `character1.obj` 实例化；若资源未就绪则短暂回退到原逻辑并在加载后自动重建。
  - 新增人物颜色随机策略：人物类（站立/坐姿/躺姿）每次添加从调色盘随机取色，支持多人快速区分。
- 结果：站立人物由真实外部模型驱动，且添加多个人物时自动呈现随机色差。

### 2026-04-25 坐姿人物接入 character2.obj（第十五阶段）
- 文件：`public/models/character2.obj`、`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 新增资产映射表，统一管理人物 OBJ 资源（`character1`、`character2`）。
  - 坐姿（含历史名称 `坐姿势`）默认绑定 `character2` 资源，并在重建逻辑中优先使用该 OBJ。
  - 节点初始化阶段预加载 `character1.obj` 与 `character2.obj`，减少首次点击时的等待。
- 结果：点击“坐姿”按钮时默认使用 `character2.obj`，与站立模型分离且逻辑一致。

### 2026-04-25 躺姿人物接入 character3.obj（第十六阶段）
- 文件：`public/models/character3.obj`、`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 资产映射表新增 `character3 -> /models/character3.obj`。
  - 躺姿（含历史名称 `躺姿势`）默认绑定 `character3`，创建与重建均优先使用该 OBJ。
  - 节点初始化预加载链路补充 `character3.obj`，与站立/坐姿保持一致。
- 结果：点击“躺姿”按钮时默认使用 `character3.obj`。

### 2026-04-25 重开后人物 OBJ 回退问题修复（第十七阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 增加 `assetFromTemplate` 标记区分“真实 OBJ 实例”与“等待加载时的占位组合模型”。
  - 在对象重建判定中加入“模板已就绪但当前仍是占位体”条件，触发自动替换为真实 OBJ。
- 原因：此前重开项目时若对象先以占位模型创建，OBJ 异步加载完成后未命中重建条件，导致一直停留在占位体。
- 结果：重新打开软件后，站姿/坐姿/躺姿会自动恢复为各自 OBJ 模型，而不是简化占位模型。

### 2026-04-25 删除人物占位组合模型（第十八阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 移除 `buildCompositeModel` 中人物相关分支（站立/坐姿/躺姿及其历史命名）。
  - 在网格同步逻辑中增加“若对象绑定了人物 OBJ 资源且模板未就绪，则不创建任何占位体”的分支。
- 结果：人物只使用 OBJ 模型渲染，不再出现组合占位人形。

### 2026-04-25 对象列表全屏分级展示（第十九阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 非全屏状态下，对象面板仅展示人物三种姿势快捷按钮（站立、坐姿、躺姿）。
  - 进入全屏后，恢复完整对象分类与素材列表（人物/室内/室外/道具/建筑/装饰/模型）。
- 结果：常规视图下界面更简洁，全屏编辑时提供完整对象库能力。

### 2026-04-25 三维视图全屏容器与底部退出栏修复（第二十阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 将全屏挂载目标从“画布容器”调整为“整张三维视图卡片”，确保对象列表、顶部工具、底部栏同时进入全屏。
  - 增加全屏样式：卡片占满视口、对象区列宽放大、视图区域自适应拉伸。
  - 新增全屏底部悬浮操作条，提供“退出全屏”按钮（参考同目录全景节点底部交互风格）。
- 结果：全屏下可看到完整对象列表、右上角视图按钮、移动/旋转/缩放按钮，并提供明确的底部退出入口。

### 2026-04-25 三维视图全屏工具条重排（第二十一阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 全屏状态下隐藏底部栏右侧三按钮（导出视图/全屏切换/重置相机），避免重复入口。
  - 将“导出视图”“重置相机”移动至场景区底部全屏悬浮条，与“退出全屏”同区域展示。
  - 全屏下放大左上角（移动/旋转/缩放）和右上角（前后左右/ISO）按钮尺寸与间距，提高可操作性。
- 结果：全屏操作聚合到场景内部，底部更干净，核心控制按钮更易点击。

### 2026-04-25 全屏隐藏参考图提示区（第二十二阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：将底部 `viewport3d-footer` 调整为仅在非全屏渲染（`v-if="!isFullscreen"`）。
- 结果：全屏状态下不再显示“参考图自动承接上游图片节点”提示区域，仅保留场景内悬浮控制条。

### 2026-04-25 非全屏底部区域隐藏与按钮悬浮化（第二十三阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 移除非全屏底部整条 `footer` 区域（含提示文案区）。
  - 将“导出视图 / 全屏 / 重置相机”改为非全屏场景内右下角悬浮按钮组（保留原按钮视觉风格）。
- 结果：非全屏不再出现底部区域，三个功能按钮继续以悬浮方式可用。

### 2026-04-25 画布网格吸附与小地图默认关闭（第二十四阶段）
- 文件：`src/views/CanvasEditor.vue`
- 变更：将 `snapToGrid` 与 `showMiniMap` 的初始值从 `true` 调整为 `false`。
- 结果：进入画布后，网格吸附和小地图默认关闭，用户可按需手动开启。

### 2026-04-25 人物贴地初始高度修正（第二十五阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：在新增对象逻辑中区分人物与普通道具初始高度；人物（站立/坐姿/躺姿，OBJ 模型）默认 `y` 调整为贴地值（约 `0.02`）。
- 原因：人物按普通道具默认高度创建会出现“悬空”。
- 结果：新添加人物默认落在地面附近，不再明显悬浮。

### 2026-04-25 全对象贴地初始高度修正（第二十六阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 新增 `getDefaultSpawnY`，统一控制新增对象初始高度。
  - 非几何的语义化组合模型改为默认贴地生成（`y≈0.02`）。
  - 几何模型按不同形体设置贴地高度（如立方体 0.5、球体 0.65、胶囊 0.83 等），避免埋地与悬空。
- 结果：除人物外，其它新增对象也默认落地显示。

### 2026-04-25 三维对象撤销历史修复（第二十七阶段）
- 文件：`src/components/canvas/Viewport3DCanvasNode.vue`
- 变更：
  - 新增 `updateObjectsWithHistory`，在对象新增/删除/属性修改前写入撤销历史。
  - 在 `TransformControls` 拖拽开始（`dragging-changed: true`）时写入一次历史，避免每帧变换写入。
- 原因：此前三维对象操作未稳定写入历史栈，`Ctrl+Z` 会回退到节点级历史，出现“撤销一次直接删节点”。
- 结果：`Ctrl+Z` 优先回退三维对象改动，不再误删整个三维节点。

### 2026-04-25 画布新增文本处理节点能力（第二十八阶段）
- 文件：`src/components/canvas/TextProcessCanvasNode.vue`、`src/components/canvas/TextChapterResultCanvasNode.vue`、`src/components/canvas/TextAssetResultCanvasNode.vue`、`src/views/CanvasEditor.vue`
- 变更：
  - 新增专用 `textProcess` 节点类型，节点内提供文本输入区及底部三个动作按钮：`上传文本`、`识别章节`、`资产提取`。
  - 文本节点点击后仅在下方弹出外部工具栏，工具栏包含“剧情输入区 + 文字模型选择器 + 右侧固定生成剧情按钮”。
  - “上传文本”支持 `.txt/.md` 文件直传并写回节点文本；“生成剧情”调用文本模型，将返回内容回填到节点文本区。
  - “识别章节”沿用创梦工坊章节识别规则，右侧自动生成/更新“章节识别”节点并支持章节勾选回传。
  - “资产提取”按“有章节选择优先章节，否则使用全文”取源文；右侧自动生成/更新“人物资产、场景资产、道具资产”三个结果节点，先显示等待态，AI返回后分别填充。
  - 画布层补充节点注册、文本节点新增入口接入、旧 `canvasNode(text)` 数据迁移到 `textProcess`，并统一“点击空白收起外部工具栏”逻辑覆盖图片/文本两类节点。
- 结果：文本处理从占位节点升级为可上传、可章节识别、可剧情生成、可资产拆分并外显结果节点的完整工作流。

### 2026-04-25 文本处理节点深色输入可读性修复（第二十九阶段）
- 文件：`src/components/canvas/TextProcessCanvasNode.vue`
- 变更：
  - 为主文本输入框与底部弹窗输入框统一补充深色模式样式：背景色、文字色、placeholder 色、聚焦边框色。
  - 覆盖 Element Plus 文本域默认样式，避免深色主题下“输入文字与背景接近”导致不可读。
- 结果：文本处理节点内外两个输入区域在深色模式下均可清晰输入与查看内容。

### 2026-04-25 文本处理节点按钮视觉对齐（第三十阶段）
- 文件：`src/components/canvas/TextProcessCanvasNode.vue`
- 变更：
  - `上传文本 / 识别章节 / 资产提取` 改为与图片节点动作按钮一致的视觉样式（透明底、圆角、hover 高亮、禁用态透明）。
  - `生成剧情` 改为与图片节点 `生成图片` 相同的 `btn-generate` 按钮底色与状态样式（正常/禁用/加载）。
- 结果：文本处理节点与其它节点按钮风格统一，主操作按钮颜色与图片生成保持一致。

### 2026-04-25 图片节点底部内嵌操作区调整（第三十一阶段）
- 文件：`src/components/canvas/ImageCanvasNode.vue`
- 变更：
  - 将“无图时上传按钮”从节点上方悬浮区迁移到节点内底部操作区。
  - 将“有图时裁剪/标注/切割/视角/3D预览/下载/全屏/删除”操作按钮从节点上方悬浮区迁移到节点内底部操作区。
  - 新增节点内底部操作区样式 `img-inline-actions`，与文本处理节点“节点内底部按钮”交互逻辑保持一致。
- 结果：图片节点主操作入口均在节点内部底部，不再出现在节点上方悬浮区。

### 2026-04-25 图片节点上传/工具按钮常显切换（第三十二阶段）
- 文件：`src/components/canvas/ImageCanvasNode.vue`
- 变更：
  - 图片节点内底部“上传图片”按钮改为无图时始终显示，不再依赖 `toolbarExpanded` 的隐藏逻辑。
  - 当节点已有图片时，自动隐藏“上传图片”，并常显“裁剪/标注/切割/视角/3D预览/下载/全屏/删除”按钮组。
- 结果：图片节点操作符合“无图即上传、有图即编辑”的直观切换，不需要先展开工具栏。

### 2026-04-25 图片底部工具区去外框（第三十三阶段）
- 文件：`src/components/canvas/ImageCanvasNode.vue`
- 变更：
  - 移除图片节点内底部操作区顶部边框。
  - 移除“裁剪等按钮区”外层胶囊容器的背景、边框、阴影与圆角，仅保留按钮本身样式。
- 结果：图片节点底部按钮区视觉与文本处理节点底部按钮区一致，无外层边框。

### 2026-04-25 图片右上角悬浮快捷按钮（第三十四阶段）
- 文件：`src/components/canvas/ImageCanvasNode.vue`
- 变更：
  - 将“下载 / 全屏查看 / 删除”从底部裁剪工具区移至图片预览区右上角悬浮显示。
  - 悬浮按钮逻辑改为：鼠标移入图片区域时显示，移出后隐藏。
  - 原“删除节点”按钮功能改为“重新上传”，点击后直接触发主图文件选择并替换图片。
  - 移除不再使用的节点删除确认逻辑与相关依赖。
- 结果：图片快捷操作更聚焦主预览区域，且保留“快速替换图片”能力。

### 2026-04-25 图片节点主区与底部区统一高度（第三十五阶段）
- 文件：`src/components/canvas/ImageCanvasNode.vue`
- 变更：
  - 新增统一尺寸变量：`--image-main-area-height`（主展示区）与 `--image-bottom-actions-height`（底部按钮区）。
  - 无图“点击展开工具栏”区域与有图预览区域统一使用同一固定高度，避免状态切换时高度跳变。
  - 无图上传区与有图裁剪工具区统一底部最小高度，保持按钮区节奏一致。
  - 节点卡片补齐最小高度，和文本处理节点布局高度保持一致。
- 结果：图片节点在“无图/有图”两种状态下主体和底部区域高度一致，视觉与文本处理节点对齐。

### 2026-04-25 图片右上角悬浮按钮定位修复（第三十六阶段）
- 文件：`src/components/canvas/ImageCanvasNode.vue`
- 变更：
  - 将图片预览容器设为定位上下文（`position: relative`），确保“下载/全屏/重新上传”按钮锚定在图片区域右上角，而非节点右上角。
  - 增加悬浮按钮自身 `:hover` 保活样式，避免鼠标移向按钮时出现闪烁或误隐藏。
- 结果：悬浮快捷按钮稳定显示在图片区域右上角，交互更符合预期。

### 2026-04-25 图片/文本节点底部间距与主区高度统一（第三十七阶段）
- 文件：`src/components/canvas/ImageCanvasNode.vue`、`src/components/canvas/TextProcessCanvasNode.vue`
- 变更：
  - 图片节点底部操作区移除上下内边距，仅保留左右内边距，去掉底部区域上/下间距。
  - 文本处理节点底部按钮区移除下内边距，仅保留左右内边距，去掉底部区域上/下间距。
  - 提升图片主显示区固定高度（预览区变高），并同步提高图片节点最小高度。
  - 提升文本处理输入框高度，并同步提高文本节点最小高度。
- 结果：两类节点底部区域更紧凑，图片预览区与文本输入区更高，版式更统一。

### 2026-04-25 资产节点滚轮事件优先级修复（第三十八阶段）
- 文件：`src/components/canvas/TextAssetResultCanvasNode.vue`
- 变更：
  - 在资产节点内容滚动区添加 `@wheel.stop`，拦截滚轮事件向画布层传播。
- 结果：选中人物资产/场景资产/道具资产节点后，滚轮优先滚动节点内部内容，不再触发画布平移。

### 2026-04-25 章节识别节点滚轮事件优先级修复（第三十九阶段）
- 文件：`src/components/canvas/TextChapterResultCanvasNode.vue`
- 变更：
  - 在章节识别节点内容滚动区添加 `@wheel.stop`，阻止滚轮事件冒泡到画布层。
- 结果：章节识别节点在滚轮操作时优先滚动节点内部列表，不再带动画布移动。

### 2026-04-25 图片/文本底部按钮区高度统一（第四十阶段）
- 文件：`src/components/canvas/TextProcessCanvasNode.vue`
- 变更：
  - 将文本处理节点底部按钮容器 `node-actions` 补齐与图片节点一致的最小高度（`44px`）和垂直居中对齐。
- 结果：文本处理与图片节点底部按钮区显示高度一致。

### 2026-04-25 图片全屏查看弹窗 UI 简化美化（第四十一阶段）
- 文件：`src/components/canvas/ImageViewer.vue`
- 变更：
  - 移除 Element 默认弹窗头部，改为纯内容式全屏预览结构。
  - 优化工具栏为简洁半透明样式（统一深色、轻模糊、细边框），保留缩放/翻页/关闭能力。
  - 调整预览容器尺寸与内边距，提升主图展示占比与整体观感。
  - 统一工具按钮视觉风格（悬浮态、禁用态、文本按钮样式）。
- 结果：全屏查看弹窗更简洁美观，视觉层次更统一，交互逻辑保持不变。

### 2026-04-25 图片工具弹窗应用按钮样式统一（第四十二阶段）
- 文件：`src/components/canvas/ImageNodeImageToolsDialog.vue`
- 变更：
  - 为“应用裁剪 / 应用标注 / 应用切割”按钮统一添加主按钮样式类 `apply-main-btn`。
  - 样式与图片节点“生成图片”主按钮保持一致（蓝底、尺寸、字重、禁用态）。
- 结果：图片工具弹窗的应用按钮与主流程“生成图片”按钮风格一致。

### 2026-04-25 图片全屏查看弹窗裁剪为纯展示区（第四十三阶段）
- 文件：`src/components/canvas/ImageViewer.vue`
- 变更：
  - 弹窗宽度改为 `auto`，并通过内部容器控制展示尺寸，去除外层无效壳体占位。
  - 预览容器调整为 `min(92vw, 1400px) × min(82vh, 900px)`，仅保留图片区域边框与内容。
  - 覆盖 `el-overlay-dialog` 为居中 Flex 布局，消除默认对话框外层留白干扰。
- 结果：全屏查看时视觉上仅保留核心图片展示区域（贴近红框目标区域）。

### 2026-04-25 图片全屏查看弹窗样式对齐示意图（第四十四阶段）
- 文件：`src/components/canvas/ImageViewer.vue`
- 变更：
  - 恢复并定制标题栏，标题固定为“图片预览”，右上角保留关闭按钮。
  - 对话框改为大尺寸卡片（`96vw`）并设置深色半透明外壳、细边框与阴影，贴近示意图风格。
  - 内容区改为统一深蓝背景容器，图片在容器内居中显示并保留内边距。
  - 调整头部文字尺寸、分割线、关闭按钮位置与颜色，统一整体视觉层次。
- 结果：全屏查看弹窗结构与样式接近用户示意图（标题栏 + 中央深色图片展示区）。

### 2026-04-25 图片全屏预览对齐创梦工坊分镜逻辑（第四十五阶段）
- 文件：`src/components/canvas/ImageViewer.vue`
- 变更：
  - 预览弹窗结构对齐 `Step2Page.vue` 的分镜图预览：`title="图片预览"`、`destroy-on-close`、默认关闭行为。
  - 移除画布端自定义壳层/大卡片样式，恢复为与创梦工坊一致的默认对话框宽度逻辑。
  - 内容区与图片尺寸规则同步为 `max-height: 70vh`，图片 `object-fit: contain` 且保留 `4px` 圆角。
- 结果：画布节点“全屏查看”与创梦工坊“分镜编辑分镜图显示”在逻辑和宽高规则上保持一致。

### 2026-04-25 图片节点重新上传按钮失效修复（第四十六阶段）
- 文件：`src/components/canvas/ImageCanvasNode.vue`
- 变更：
  - 将主图文件选择器 `mainFileInputRef` 从 `v-if="!hasImage"` 区块中移出，改为节点内始终挂载。
  - 保持“上传图片”和“右上角重新上传”共用同一 `triggerMainFilePick -> onMainFileChange` 链路。
- 原因：有图状态下 `v-if` 会销毁文件输入框，导致“全屏查看右侧上传/重新上传”按钮点击无效。
- 结果：有图状态点击右上角上传按钮可正确弹出文件选择并替换主图。

### 2026-04-25 新增视频生成节点（第四十七阶段）
- 文件：`src/components/canvas/VideoCanvasNode.vue`、`src/views/CanvasEditor.vue`
- 变更：
  - 新增专用 `videoCanvas` 节点，卡片尺寸与图片节点对齐；中间预览区在无视频时显示“点击展开工具栏”。
  - 节点下方扩展工具栏按图片节点交互实现，包含：上传参考图、额外提示词输入框、视频模型选择、画面比例、视频时长、生成视频按钮。
  - 视频模型来源统一使用设置页同源数据（`apiConfigStore.videoModels / videoModel`）。
  - 生成逻辑接入 `apiService.generateVideo`，成功后回填节点视频地址并在预览区展示。
  - 画布编辑器接入：注册 `videoCanvas` 节点类型、右键添加视频节点改为新类型、兼容迁移旧 `canvasNode(video)` 数据、分组包围盒尺寸与“点击空白收起工具栏”逻辑扩展到视频节点。
- 结果：画布中可直接使用与图片节点一致交互范式的视频生成节点。

### 2026-04-25 视频节点比例与时长合并为单入口（第四十八阶段）
- 文件：`src/components/canvas/VideoCanvasNode.vue`
- 变更：
  - 将“画面比例”和“视频时长”两个独立下拉合并为单一配置入口，交互形态对齐图片节点“画质比例”。
  - 工具栏改为显示汇总按钮（示例：`16:9 - 4秒`）；点击后在弹层内统一设置“视频时长 + 画面比例”。
  - 新增弹层分组样式（时长段选 + 比例按钮），并保留模型选择与生成按钮布局不变。
- 结果：视频参数配置入口更集中，操作路径与图片节点一致。

### 2026-04-25 视频节点参考图改为双占位上传（第四十九阶段）
- 文件：`src/components/canvas/VideoCanvasNode.vue`、`src/views/CanvasEditor.vue`
- 变更：
  - 视频节点参考图由单图改为最多2张（`referenceImages`），并在工具栏固定展示2个上传占位槽位。
  - 每个槽位可直接点击上传并即时显示图片；已上传槽位支持右上角清除，不再需要单独“上传按钮”。
  - 保持旧数据兼容：迁移逻辑支持 `referenceImage` 自动映射到双槽位第一项，并补齐第二槽位为空。
  - 生成视频时默认取双槽位中首张有效图作为当前接口的参考图参数，避免现有 API 调用链中断。
- 结果：视频节点参考图上传体验升级为“固定双槽位直传直显”，并满足最多2张图片限制。

### 2026-04-25 视频双占位尺寸对齐旧上传按钮（第五十阶段）
- 文件：`src/components/canvas/VideoCanvasNode.vue`
- 变更：
  - 将两个上传占位槽位尺寸从大卡片样式调整为与改造前上传按钮一致（`40 × 40`）。
  - 占位态改为仅显示上传图标，避免在小尺寸下文字挤压。
- 结果：双占位视觉尺寸与原上传按钮保持一致，布局更紧凑。

### 2026-04-25 新增分镜生成节点（第五十一阶段）
- 文件：`src/components/canvas/StoryboardGenCanvasNode.vue`、`src/views/CanvasEditor.vue`
- 变更：
  - 参考 `F:\8.gongzuoliu` 的 `StoryboardGenNode.tsx` 新增画布专用 `storyboardGen` 节点。
  - 节点内提供分镜宫格能力：行列控制（默认 2x2）、分镜描述输入格、参考图上传、额外提示词、模型/画质/比例配置、生成分镜按钮。
  - 生成逻辑接入 `apiService.generateImage`，成功后在节点内回显分镜结果图。
  - 画布编辑器接入：节点类型注册、右键菜单新增“分镜生成”入口、迁移与分组尺寸兜底支持。
- 结果：画布工坊可直接添加并使用“分镜生成”节点完成分镜图生成流程。

### 2026-04-25 分镜节点镜头文案调整（第五十二阶段）
- 文件：`src/components/canvas/StoryboardGenCanvasNode.vue`
- 变更：
  - 节点内宫格输入占位文案由“分镜1/分镜2...”调整为“镜头1/镜头2...”。
  - 生成提示词中分段前缀同步由“分镜N”改为“镜头N”。
- 结果：节点内镜头编号文案与产品表述保持一致。

### 2026-04-25 分镜镜头输入框字体对齐（第五十三阶段）
- 文件：`src/components/canvas/StoryboardGenCanvasNode.vue`
- 变更：
  - 将镜头输入框 `frame-input` 的字号从 `11px` 调整为 `13px`。
  - 输入框字体改为 `font-family: inherit`，与节点“点击展开工具栏”提示文案保持同源字体。
- 结果：分镜镜头输入框文字在字号与字体上与目标提示文案一致。

---

## 九、最近逻辑调整记录

### 2026-04-25 画布缩放行为修正
- 文件：`src/views/CanvasEditor.vue`
- 变更：将 `<VueFlow>` 的 `:fit-view-on-init` 从 `true` 调整为 `false`。
- 原因：初始空画布在首次新增节点时会触发 VueFlow 的初始化自适应，导致视口自动放大到节点附近。
- 结果：进入项目后手动/默认比例（如 100%）在新增节点时不再被自动改写。

### 2026-04-25 视角黄球拖拽逻辑修正
- 文件：`src/components/canvas/ViewpointCamera3D.vue`
- 变更：将黄球缩放控制从“按屏幕 `movementY` 上下位移”改为“鼠标射线投影到黄线段（靶心→黄线末端）”计算参数 `t`。
- 原因：用户预期黄球应沿黄线始末方向控制远近，而不是垂直屏幕方向控制。
- 结果：黄球远近与黄线方向一致，拖拽语义更直观。

---

## 一、项目架构概览

```
f:\1.jsdongmanxiangmu\
├── electron/                 # Electron 主进程
│   ├── main.ts               # 主进程入口
│   ├── preload.ts           # 预加载脚本
│   └── utils/               # 工具函数
├── src/                      # Vue 渲染进程
│   ├── views/               # 页面组件
│   ├── components/          # 公共组件
│   ├── stores/              # Pinia 状态管理
│   ├── services/            # 服务层
│   └── router/              # 路由配置
└── vue-flow-master/         # Vue Flow 源码（参考）
```

---

## 二、画布工坊核心文件约束

### 2.1 画布编辑器核心文件
| 文件路径 | 用途 | 重要约束 |
|----------|------|----------|
| `src/views/CanvasEditor.vue` | 画布编辑器主页面 | **修改前必读** |
| `src/components/canvas/CanvasNode.vue` | 自定义节点组件 | **修改前必读** |
| `src/stores/projectStore.ts` | 项目状态管理 | **修改前必读** |
| `src/services/projectFileService.ts` | 项目文件服务 | **修改前必读** |

### 2.2 画布数据持久化相关
| 文件路径 | 用途 | 重要约束 |
|----------|------|----------|
| `electron/main.ts` | IPC handlers | 包含 canvas-snapshot handlers |
| `electron/preload.ts` | API 暴露 | 包含 canvasSaveSnapshot 等 |
| `src/vite-env.d.ts` | 类型定义 | 包含 canvasSaveSnapshot 类型 |

### 2.3 关键数据结构

**CanvasSnapshot 接口 (electron/main.ts)**：
```typescript
interface CanvasSnapshot {
  nodes: any[]           // 节点数据
  edges: any[]           // 连线数据
  viewport: {
    x: number            // 视口 X 偏移
    y: number            // 视口 Y 偏移
    zoom: number         // 缩放级别
  }
  savedAt: string        // 保存时间 ISO 格式
}
```

**ProjectInfo 接口 (projectFileService.ts)**：
```typescript
interface ProjectInfo {
  id: string
  name: string
  type: 'creative' | 'canvas'
  path: string
  createdAt: string
  updatedAt: string
}
```

---

## 三、项目路径规则

### 3.1 项目文件夹分离
| 项目类型 | 存储位置 | 变量/函数 |
|----------|----------|-----------|
| 创梦工坊 | `projects/` | `getProjectsPath()` |
| 画布工坊 | `projects-huabu/` | `getCanvasProjectsPath()` |

### 3.2 项目文件夹命名格式
```
{projectId}_{projectName}/
├── project.json          # 项目元数据
├── canvas_snapshot.json  # 画布自动快照（仅画布项目）
└── snapshots/            # 命名快照目录（仅画布项目）
    └── snapshot_xxx.json
```

### 3.3 修改路径函数的位置
- **main.ts** 第 40-80 行左右：`getProjectsPath()`, `getCanvasProjectsPath()`, `getProjectPath()`

---

## 四、IPC 通信规范

### 4.1 画布相关 IPC Handlers
| Handler 名称 | 参数 | 返回值 | 用途 |
|-------------|------|--------|------|
| `canvas-save-snapshot` | projectId, projectName, snapshot | { success, message } | 保存自动快照 |
| `canvas-load-snapshot` | projectId, projectName | { success, snapshot? } | 加载快照 |
| `canvas-list-snapshots` | projectId, projectName | { success, snapshots } | 列出快照 |
| `canvas-save-named-snapshot` | projectId, projectName, snapshotId, snapshot | { success } | 保存命名快照 |
| `canvas-load-named-snapshot` | projectId, projectName, snapshotId | { success, snapshot } | 加载命名快照 |

### 4.2 添加新 IPC Handler 的步骤
1. 在 `electron/main.ts` 添加 handler
2. 在 `electron/preload.ts` 暴露 API
3. 在 `src/vite-env.d.ts` 添加类型定义
4. 在 `src/services/` 或组件中调用

---

## 五、Vue Flow 使用规范

### 5.1 官方文档位置
- 源码：`F:\1.jsdongmanxiangmu\vue-flow-master\`
- 文档：`vue-flow-master\docs\src\guide\`

### 5.2 关键 Composables
```typescript
import { useVueFlow } from '@vue-flow/core'

const {
  onConnect,      // 连接事件
  addEdges,       // 添加连线
  addNodes,       // 添加节点
  fitView,        // 自适应视图
  getViewport,    // 获取视口状态
  setViewport     // 设置视口状态
} = useVueFlow()
```

### 5.3 节点类型注册
```typescript
import { markRaw } from 'vue'
import CustomNode from '@/components/canvas/CanvasNode.vue'

const nodeTypes = markRaw({
  canvasNode: CustomNode
})
```

### 5.4 视口状态获取
```typescript
const viewport = getViewport()
// viewport: { x: number, y: number, zoom: number }
```

---

## 六、状态管理规范

### 6.1 projectStore 核心方法
| 方法 | 用途 | 约束 |
|------|------|------|
| `loadProjects()` | 加载创梦工坊项目 | 创梦工坊列表页使用 |
| `loadCanvasProjects()` | 加载画布工坊项目 | 画布工坊列表页使用 |
| `addProject(project)` | 创建项目 | 项目类型必须在 project.type 中指定 |
| `deleteProject(id)` | 删除项目 | |
| `moveToRecycleBin(id)` | 移入回收站 | |

### 6.2 添加 store 方法的步骤
1. 在 `src/stores/projectStore.ts` 添加方法
2. 在返回对象中导出
3. 在 `src/stores/index.ts` 中导出（如果需要）

---

## 七、代码修改 checklist

修改以下文件前必须：
- [ ] 理解现有代码逻辑
- [ ] 确认修改不会破坏已有功能
- [ ] 更新相关类型定义
- [ ] 运行 `npm run build` 验证编译通过
- [ ] 如修改 IPC，确保 preload 和 vite-env.d.ts 同时更新

### 画布编辑器 (CanvasEditor.vue)
- [ ] 修改节点数据结构 → 检查 CanvasSnapshot 接口
- [ ] 修改保存逻辑 → 检查 main.ts IPC handler
- [ ] 修改加载逻辑 → 检查 canvas-load-snapshot handler

### 项目列表 (CanvasProjectList.vue)
- [ ] 修改项目加载 → 检查 loadCanvasProjects vs loadProjects
- [ ] 修改项目创建 → 检查 project.type 是否正确

### 画布节点 (CanvasNode.vue)
- [ ] 修改节点显示 → 理解 Handle 和 Position 用法
- [ ] 参考 vue-flow-master\docs\src\guide\node.md

---

## 八、参考项目

### 8.1 Vue Flow 源码
- 位置：`F:\1.jsdongmanxiangmu\vue-flow-master\`
- 关键文件：
  - `packages\core\src\` - 核心实现
  - `packages\core\src\composables\` - Composables 实现
  - `packages\core\src\types\` - 类型定义
  - `packages\core\src\utils\` - 工具函数
  - `docs\src\guide\` - 官方文档

### 8.2 Vue Flow 核心 Composables

| Composable | 用途 | 我们的画布可用功能 |
|-----------|------|------------------|
| `useVueFlow` | 核心 store，节点/连线/视口管理 | ✅ 已在用 |
| `useViewportHelper` | 视口操作 (zoomIn/Out, fitView, setViewport) | ✅ 已在用 (getViewport, setViewport) |
| `useNodesData` | 根据 ID 获取节点数据 | ✅ 已实现 |
| `useNodeConnections` | 获取节点的所有连接 | ✅ 已实现 |
| `useHandleConnections` | 获取 Handle 的连接 | ✅ 已实现 |
| `useHistory` | 撤销/重做历史记录 | ✅ 已实现 |
| `useEdge` | 边的操作 | ✅ 已实现 |
| `useNode` | 节点操作 | ✅ 已实现 |
| `useDrag` | 拖拽相关 | ✅ 已实现 |
| `useConnection` | 连接相关 | ✅ 已实现 |

### 8.3 Vue Flow Store 核心状态 (VueFlowStore)

```typescript
interface VueFlowStore {
  // 节点和连线
  nodes: GraphNode[]
  edges: GraphEdge[]

  // 视口状态
  viewport: ViewportTransform  // { x, y, zoom }
  dimensions: Dimensions        // { width, height }

  // 状态标志
  nodesSelectionActive: boolean
  multiSelectionActive: boolean

  // Actions
  addNodes: (nodes: Node[]) => void
  addEdges: (edges: Edge[]) => void
  setViewport: (viewport: ViewportTransform) => void
  fitView: (options?: FitViewOptions) => void

  // 查找
  findNode: (id: string) => GraphNode | undefined
  getNodes: () => GraphNode[]
  getEdges: () => GraphEdge[]
}
```

### 8.4 Vue Flow 视口操作

```typescript
// 获取视口
const viewport = getViewport()
// viewport: { x: number, y: number, zoom: number }

// 设置视口
setViewport({ x: 0, y: 0, zoom: 1 })

// 自适应视图
fitView({ padding: 0.1 })

// 缩放
zoomIn()   // 放大
zoomOut()  // 缩小
zoomTo(1)  // 缩放到指定级别
```

### 8.5 Vue Flow 自定义节点注册模式

```typescript
import { markRaw } from 'vue'
import CustomNode from './CustomNode.vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'

// 节点类型注册（必须使用 markRaw 防止响应式穿透）
const nodeTypes = markRaw({
  customNode: CustomNode
})

// 在模板中使用
// <VueFlow :node-types="nodeTypes" ... />
```

### 8.6 Vue Flow 事件监听

```typescript
const { onInit, onNodeClick, onEdgeClick, onConnect } = useVueFlow()

onInit((instance) => {
  // VueFlow 初始化完成
  instance.fitView()
})

onNodeClick(({ node }) => {
  // 节点点击
})

onConnect((connection) => {
  // 连接创建
  addEdges([connection])
})
```

### 8.7 参考项目 F:\8.gongzuoliu
- Canvas 实现参考：`src\features\canvas\`
- Store 参考：`src\stores\canvasStore.ts`
- 特色功能：
  - 撤销/重做历史 ✅ 已实现
  - 节点分组
  - 图片预览查看器 ✅ 已实现

### 8.8 我们已实现的 Composables

| 文件 | 功能 | API |
|------|------|-----|
| `useNodesData.ts` | 节点数据获取 | `useNodesData(nodeId)` → `ComputedRef<T>` |
| `useConnections.ts` | 节点/Hanlde连接 | `useNodeConnections({ nodeId, handleType })`, `useHandleConnections(type, id)` |
| `useHistory.ts` | 撤销/重做 | `useHistory()` → `{ canUndo, canRedo, undo, redo, pushState }` |
| `useEdge.ts` | 边的操作 | `useEdges()`, `useEdgeActions()` |
| `useNode.ts` | 节点操作 | `useNodes()`, `useNodeActions()` |
| `useConnection.ts` | 连接状态 | `useConnection()`, `useConnectionActions()` |
| `useDrag.ts` | 拖拽相关 | `useDrag()` |

---

