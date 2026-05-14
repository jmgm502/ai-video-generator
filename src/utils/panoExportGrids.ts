/** 等距圆柱全景上按 yaw/pitch 取「窗口」栅格导出，逻辑对齐 8.gongzuoliu VR360Node */

export interface PanoGridView {
  label: string
  yaw: number
  pitch: number
}

export const FOUR_GRID_VIEWS: PanoGridView[] = [
  { label: '正面图', yaw: 0, pitch: 0 },
  { label: '左方图', yaw: -Math.PI / 2, pitch: 0 },
  { label: '背面图', yaw: Math.PI, pitch: 0 },
  { label: '右方图', yaw: Math.PI / 2, pitch: 0 }
]

export const TWELVE_GRID_VIEWS: PanoGridView[] = [
  { label: '正面图', yaw: 0, pitch: 0 },
  { label: '左方图', yaw: -Math.PI / 2, pitch: 0 },
  { label: '背面图', yaw: Math.PI, pitch: 0 },
  { label: '右方图', yaw: Math.PI / 2, pitch: 0 },
  { label: '前上方', yaw: 0, pitch: Math.PI / 4 },
  { label: '右上方', yaw: Math.PI / 2, pitch: Math.PI / 4 },
  { label: '后上方', yaw: Math.PI, pitch: Math.PI / 4 },
  { label: '左上方', yaw: -Math.PI / 2, pitch: Math.PI / 4 },
  { label: '前下方', yaw: 0, pitch: -Math.PI / 4 },
  { label: '右下方', yaw: Math.PI / 2, pitch: -Math.PI / 4 },
  { label: '后下方', yaw: Math.PI, pitch: -Math.PI / 4 },
  { label: '左下方', yaw: -Math.PI / 2, pitch: -Math.PI / 4 }
]

export function captureCanvasImage(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png')
}

function renderPanoToCellOptimized(
  imgData: ImageData,
  imgWidth: number,
  imgHeight: number,
  yaw: number,
  pitch: number,
  outWidth: number,
  outHeight: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = outWidth
  canvas.height = outHeight
  const ctx = canvas.getContext('2d')!
  const outImgData = ctx.createImageData(outWidth, outHeight)
  const outData = outImgData.data

  const thetaRange = (outWidth / outHeight) * (Math.PI / 2)
  const phiRange = Math.PI / 2

  for (let py = 0; py < outHeight; py++) {
    for (let px = 0; px < outWidth; px++) {
      const localTheta = (px / outWidth - 0.5) * thetaRange + yaw
      const localPhi = (py / outHeight - 0.5) * phiRange + pitch

      const dirX = Math.sin(Math.PI / 2 - localPhi) * Math.sin(localTheta)
      const dirY = Math.cos(Math.PI / 2 - localPhi)
      const dirZ = Math.sin(Math.PI / 2 - localPhi) * Math.cos(localTheta)

      const x = (Math.atan2(dirZ, dirX) + Math.PI) / (2 * Math.PI)
      const y = Math.acos(-dirY) / Math.PI

      const srcX = Math.floor(x * imgWidth) % imgWidth
      const srcY = Math.floor(y * imgHeight) % imgHeight
      if (srcX < 0 || srcY < 0 || srcX >= imgWidth || srcY >= imgHeight) {
        const oi = (py * outWidth + px) * 4
        outData[oi] = 0
        outData[oi + 1] = 0
        outData[oi + 2] = 0
        outData[oi + 3] = 255
        continue
      }

      const srcIdx = (srcY * imgWidth + srcX) * 4
      const outIdx = (py * outWidth + px) * 4
      outData[outIdx] = imgData.data[srcIdx]
      outData[outIdx + 1] = imgData.data[srcIdx + 1]
      outData[outIdx + 2] = imgData.data[srcIdx + 2]
      outData[outIdx + 3] = 255
    }
  }

  ctx.putImageData(outImgData, 0, 0)
  return canvas
}

/** 从全景图 dataURL/URL 按方位投射生成格子画布 */
export function renderPanoToCell(
  imageUrl: string,
  yaw: number,
  pitch: number,
  outWidth: number,
  outHeight: number,
  scale = 1
): Promise<HTMLCanvasElement> {
  const finalWidth = Math.round(outWidth * scale)
  const finalHeight = Math.round(outHeight * scale)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, img.width, img.height)
      const result = renderPanoToCellOptimized(data, img.width, img.height, yaw, pitch, finalWidth, finalHeight)
      resolve(result)
    }
    img.onerror = () => {
      const c = document.createElement('canvas')
      c.width = finalWidth
      c.height = finalHeight
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#333'
      ctx.fillRect(0, 0, finalWidth, finalHeight)
      resolve(c)
    }
    img.src = imageUrl
  })
}

export function mergeCanvasesGrid(
  cells: HTMLCanvasElement[],
  gridCols: number,
  gridRows: number
): HTMLCanvasElement {
  if (cells.length === 0) {
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    return c
  }
  const w = cells[0]!.width
  const h = cells[0]!.height
  const out = document.createElement('canvas')
  out.width = w * gridCols
  out.height = h * gridRows
  const ctx = out.getContext('2d')!
  for (let i = 0; i < cells.length; i++) {
    const col = i % gridCols
    const row = Math.floor(i / gridCols)
    ctx.drawImage(cells[i]!, col * w, row * h, w, h)
  }
  return out
}
