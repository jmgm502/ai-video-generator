# AI Video Generator（星梦动画）

一款基于 **Vue 3 + TypeScript + Vite + Electron** 构建的桌面端 AI 画布工坊，支持通过节点化画布完成文本、图片、视频等多模态内容的生成、串联与管理，适合用于 AIGC 创作、分镜编排与视频生成工作流搭建。

## 项目简介

本项目面向 AI 内容生产场景，提供可视化节点画布，用户可以将文本、图片、视频等节点连接起来，形成完整的生成链路。项目同时支持多种模型与 API 渠道配置，可按需切换不同供应商和能力，满足不同创作需求。

## 主要功能

- 节点式画布工作流
- 文本生成
- 图片生成
- 视频生成
- 参考图输入与多图联动
- 上下游节点内容传递
- 生成结果预览与保存
- 多模型 / 多渠道切换
- 桌面端打包发布（Windows 等）
- 任务状态与生成进度展示

## 技术栈

- **前端框架**：Vue 3
- **语言**：TypeScript
- **构建工具**：Vite
- **桌面端**：Electron
- **状态管理**：Pinia
- **路由**：Vue Router
- **国际化**：vue-i18n
- **UI 组件**：Element Plus
- **画布/流程编排**：Vue Flow
- **3D/可视化相关**：Three.js / TresJS
- **测试**：Playwright
- **打包工具**：electron-builder

## 仓库结构

- `src/`：核心业务源码
- `public/`：静态资源与图标等
- `flow2api-main/`：相关服务/集成内容
- `server/`：服务端或辅助资源
- `scripts/`：构建与清理脚本
- `release/`：打包输出目录

## 环境要求

- Node.js 18+
- npm 9+
- Windows / macOS / Linux（视打包配置而定）

## 安装依赖

```bash
npm install
```

## 本地开发

```bash
npm run dev
```

如需同时运行 Electron 相关流程，可按项目脚本执行：

```bash
npm run electron:dev
```

## 生产构建

```bash
npm run build
```

## 仅构建前端

```bash
npm run build:vite
```

## 打包桌面应用

```bash
npm run electron:build
```

Windows 安装包会输出到 `release/` 目录。

## 常用脚本

- `npm run dev`：启动前端开发环境
- `npm run build`：完整构建并打包
- `npm run build:vite`：仅执行前端构建与类型检查
- `npm run preview`：预览构建结果
- `npm run lint`：代码检查并自动修复
- `npm run format`：格式化 `src/`
- `npm run test`：运行 Playwright 测试
- `npm run clean:tmp`：清理临时文件

## 配置说明

项目支持在设置中配置不同的 API 渠道与模型，用于文本、图片、视频生成。

你通常需要配置：

- API 地址 / Base URL
- API Key
- 目标模型
- 供应商分组（如优尚 / Flow2 等）

> 注意：真实密钥不要提交到 GitHub，请使用本地配置或 `.env` / 设置界面保存。

## 功能亮点

- 可视化节点编排，适合内容工作流搭建
- 支持多路参考图和上下游上下文注入
- 视频生成节点支持不同模型与参数配置
- 支持生成任务状态管理与结果回写
- 适合用于 AIGC 原型验证、创意生产与自动化内容生成

## 注意事项

- `node_modules/`、`dist/`、`release/` 等产物不应提交到仓库
- 真实 API 密钥、账号信息不要公开
- 若某些模型在当前渠道不可用，请切换到支持的模型或渠道

## 许可证

本项目采用 **GNU General Public License v3.0 (GPL-3.0)** 许可证。

你可以：
- ✅ 商业使用
- ✅ 修改
- ✅ 分发
- ✅ 专利使用
- ✅ 私有使用

条件：
- ⚠️ 必须使用相同许可证开源
- ⚠️ 必须保留版权和许可证声明
- ⚠️ 修改的文件必须标注改动
- ⚠️ 在分发时必须提供完整的许可证文本

完整许可证内容请查看项目根目录下的 `LICENSE` 文件，或访问：
https://www.gnu.org/licenses/gpl-3.0.html

## 作者

清心
