# AI Video Generator (Xingmeng Animation)

A desktop AI canvas workshop built with **Vue 3 + TypeScript + Vite + Electron**, supporting node-based canvas for text, image, video and other multi-modal content generation, chaining and management. Perfect for AIGC creation, storyboarding and video generation workflow construction.

## Project Introduction

This project is designed for AI content production scenarios, providing a visual node canvas. Users can connect text, image, video and other nodes to form a complete generation pipeline. The project also supports various models and API channel configurations, which can be switched between different providers and capabilities as needed to meet different creation requirements.

## Main Features

- Node-based canvas workflow
- Text generation
- Image generation
- Video generation
- Reference image input and multi-image linkage
- Upstream and downstream node content passing
- Generation result preview and saving
- Multi-model / multi-channel switching
- Desktop packaging and release (Windows, etc.)
- Task status and generation progress display

## Tech Stack

- **Frontend Framework**: Vue 3
- **Language**: TypeScript
- **Build Tool**: Vite
- **Desktop**: Electron
- **State Management**: Pinia
- **Routing**: Vue Router
- **Internationalization**: vue-i18n
- **UI Components**: Element Plus
- **Canvas/Workflow Orchestration**: Vue Flow
- **3D/Visualization**: Three.js / TresJS
- **Testing**: Playwright
- **Packaging Tool**: electron-builder

## Repository Structure

- `src/`: Core business source code
- `public/`: Static resources and icons
- `flow2api-main/`: Related services/integration content
- `scripts/`: Build and cleanup scripts
- `release/`: Packaging output directory

## Environment Requirements

- Node.js 18+
- npm 9+
- Windows / macOS / Linux (depending on packaging configuration)

## Install Dependencies

```bash
npm install
```

## Local Development

```bash
npm run dev
```

To run Electron related processes at the same time, execute according to project scripts:

```bash
npm run electron:dev
```

## Production Build

```bash
npm run build
```

## Build Frontend Only

```bash
npm run build:vite
```

## Package Desktop App

```bash
npm run electron:build
```

Windows installation package will be output to the `release/` directory.

## Common Scripts

- `npm run dev`: Start frontend development environment
- `npm run build`: Complete build and package
- `npm run build:vite`: Only perform frontend build and type checking
- `npm run preview`: Preview build results
- `npm run lint`: Code checking and auto-fix
- `npm run format`: Format `src/`
- `npm run test`: Run Playwright tests
- `npm run clean:tmp`: Clean up temporary files

## Configuration Instructions

The project supports configuring different API channels and models in the settings for text, image and video generation.

You usually need to configure:
- API address / Base URL
- API Key
- Target model
- Provider group (such as Youshang / Flow2, etc.)

> Note: Do not submit real keys to GitHub, use local configuration or `.env` / settings interface to save.

## Feature Highlights

- Visual node orchestration, suitable for content workflow construction
- Support multiple reference images and upstream and downstream context injection
- Video generation node supports different models and parameter configurations
- Support generation task status management and result write-back
- Suitable for AIGC prototype verification, creative production and automated content generation

## Notes

- Products like `node_modules/`, `dist/`, `release/` should not be submitted to the repository
- Do not disclose real API keys and account information
- If some models are not available in the current channel, please switch to a supported model or channel

## Support

If you find this project helpful, consider buying me some spicy snacks (spicy strips) as a thank you~ 🌶️🍥

<table>
  <tr>
    <td align="center">
      <img src="assets/wechat-donate.png" alt="WeChat Donate" width="200">
      <br>
      <p>Want some food? Ah? Ah? It's okay if not~ Feel free to donate</p>
    </td>
    <td align="center">
      <img src="assets/alipay-donate.png" alt="Alipay Donate" width="200">
      <br>
      <p>Love eating pineapple and watermelon in summer</p>
      <p>If you find it helpful, get a pack of spicy strips to reward me~</p>
    </td>
    <td align="center">
      <img src="assets/wechat-group.png" alt="WeChat" width="200">
      <br>
      <p>QR code valid for 7 days, please add WeChat or follow "Qingxinyun Technology" official account after expiration</p>
    </td>
  </tr>
</table>

## License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.

You can:
- ✅ Commercial use
- ✅ Modify
- ✅ Distribute
- ✅ Patent use
- ✅ Private use

Conditions:
- ⚠️ Must open source with the same license
- ⚠️ Must retain copyright and license notices
- ⚠️ Modified files must be marked with changes
- ⚠️ Must provide complete license text when distributing

For full license content, please see the `LICENSE` file in the project root directory, or visit:
https://www.gnu.org/licenses/gpl-3.0.html

## Author

Qingxin QQ 82413405

---

## Other Languages

- [中文 (Chinese)](README.md)
- [English](README.en.md)
- [日本語 (Japanese)](README.ja.md)
