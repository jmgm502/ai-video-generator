/** 内联 SVG（找不到 `public/icon.ico` 或解码失败时使用） */
const FALLBACK_LOGO_SVG = `<svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea" />
          <stop offset="100%" style="stop-color:#764ba2" />
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="80" height="80" rx="16" fill="url(#g)" />
      <path d="M50 20 L56 38 L75 38 L60 50 L66 68 L50 56 L34 68 L40 50 L25 38 L44 38 Z" fill="white" />
    </svg>`

/**
 * @param logoDataUrl 主进程将 `public/icon.ico` 转为 PNG 的 data URL；为 null 则用内联矢量占位
 */
export function buildSplashHtml(logoDataUrl: string | null): string {
  const logoBlock = logoDataUrl
    ? `<img class="logo logo-img" src="${logoDataUrl}" alt="" draggable="false" />`
    : FALLBACK_LOGO_SVG

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100%;
      background: #0d0d0d;
      color: #e8e8e8;
      font-family: system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
      -webkit-font-smoothing: antialiased;
      user-select: none;
    }
    .wrap {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 28px 24px;
      gap: 22px;
    }
    .logo {
      width: 88px;
      height: 88px;
      filter: drop-shadow(0 4px 20px rgba(102, 126, 234, 0.35));
      flex-shrink: 0;
    }
    .logo-img {
      display: block;
      object-fit: contain;
    }
    .title {
      font-size: 15px;
      font-weight: 500;
      letter-spacing: 0.06em;
      color: #c8c8d0;
    }
    .dots {
      display: inline-block;
      min-width: 1.5em;
      text-align: left;
    }
    .dot {
      animation: blink 1.2s steps(1, end) infinite;
      opacity: 0.25;
    }
    .dot:nth-child(1) { animation-delay: 0s; }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes blink {
      0%, 100% { opacity: 0.2; }
      50% { opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    ${logoBlock}
    <div class="title">星梦正在启动中<span class="dots"><span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span></div>
  </div>
</body>
</html>`
}
