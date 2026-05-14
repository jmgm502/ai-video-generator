/**
 * 画布文本节点 / 分镜模板节点共用的：AI 分镜 JSON 解析与宫格推导（与 TextProcessCanvasNode 行为保持一致）。
 */

export interface AiStoryboardItem {
  title?: string
  description?: string
  grids?: Array<string | { description?: string; text?: string }>
}

export function safeParseJsonObject(text: string): unknown | null {
  if (!text || typeof text !== 'string') return null

  try {
    return JSON.parse(text)
  } catch {}

  try {
    let braceCount = 0
    let foundStart = false
    let resultStart = 0
    let resultEnd = 0

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (!foundStart) {
          foundStart = true
          resultStart = i
        }
        braceCount++
      } else if (text[i] === '}') {
        braceCount--
        if (foundStart && braceCount === 0) {
          resultEnd = i + 1
          break
        }
      }
    }

    if (foundStart && resultEnd > resultStart) {
      const jsonStr = text.slice(resultStart, resultEnd)
      return JSON.parse(jsonStr)
    }
  } catch {}

  try {
    const jsonMatch = text.match(/\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch {}

  try {
    let cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*$/g, '')
    const startIdx = cleaned.indexOf('{')
    if (startIdx !== -1) {
      cleaned = cleaned.slice(startIdx)
      const endIdx = cleaned.lastIndexOf('}')
      if (endIdx !== -1) {
        cleaned = cleaned.slice(0, endIdx + 1)
      }
      return JSON.parse(cleaned)
    }
  } catch {}

  try {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim())
    }
  } catch {}

  return null
}

export function parseStoryboardResult(text: string): AiStoryboardItem[] {
  const content = (text || '').trim()
  if (!content) return []

  const parseCandidates = [
    () => safeParseJsonObject(content),
    () => safeParseJsonObject(`{"storyboards":${content}}`),
    () => safeParseJsonObject(`{"scenes":${content}}`),
    () => safeParseJsonObject(`{"items":${content}}`),
    () => safeParseJsonObject(`{"data":${content}}`),
    () => safeParseJsonObject(`{"result":${content}}`),
    () => {
      try {
        const arrayMatch = content.match(/\[[\s\S]*\]/)
        if (arrayMatch) {
          return JSON.parse(arrayMatch[0])
        }
      } catch {}
      return null
    }
  ]

  for (const parseFn of parseCandidates) {
    try {
      const candidate = parseFn()
      if (!candidate) continue

      if (Array.isArray(candidate)) {
        return candidate as AiStoryboardItem[]
      }

      const obj = candidate as Record<string, unknown>
      const arrayFields = ['storyboards', 'scenes', 'items', 'data', 'result', 'list', 'shots', 'frames']
      for (const field of arrayFields) {
        if (Array.isArray(obj[field])) {
          return obj[field] as AiStoryboardItem[]
        }
      }
    } catch {}
  }

  return []
}

export function extractGridTexts(description: string): string[] {
  const text = String(description || '').trim()
  if (!text) return []

  const headerPatterns = [
    /(?:^|\n)\s*(?:Grid|镜头|Shot|Frame|场景|分镜)\s*([0-9]{1,2})\s*[:：]/gi,
    /(?:^|\n)\s*(?:[0-9]{1,2})\s*[.:：-]\s*/gi,
    /(?:^|\n)\s*[（\[]\s*[0-9]{1,2}\s*[）\]]\s*/gi
  ]

  let anchors: number[] = []
  for (const pattern of headerPatterns) {
    const tempAnchors: number[] = []
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      tempAnchors.push(match.index + (match[0].startsWith('\n') ? 1 : 0))
    }
    if (tempAnchors.length > 0) {
      anchors = tempAnchors
      break
    }
  }

  if (!anchors.length) {
    const sections = text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
    if (sections.length > 1) {
      return sections
    }
    const lines = text.split('\n').map((s) => s.trim()).filter(Boolean)
    if (lines.length > 0) {
      return lines.length > 1 ? lines : [text]
    }
    return [text]
  }

  const sections: string[] = []
  for (let i = 0; i < anchors.length; i += 1) {
    const start = anchors[i]
    const end = i + 1 < anchors.length ? anchors[i + 1] : text.length
    const block = text.slice(start, end).trim()
    if (!block) continue

    const normalized = block
      .replace(/^(?:Grid|镜头|Shot|Frame|场景|分镜)?\s*[0-9]{1,2}\s*[:：.-]?\s*/i, '')
      .trim()

    sections.push(normalized || block)
  }

  return sections.length ? sections : [text]
}

export function normalizeStoryboardGridTexts(item: AiStoryboardItem, gridPlaceholder: string): string[] {
  const fromGrids = Array.isArray(item.grids)
    ? item.grids
        .map((grid) => {
          if (typeof grid === 'string') return grid.trim()
          if (grid && typeof grid === 'object') {
            return String(grid.description || grid.text || '').trim()
          }
          return ''
        })
        .filter(Boolean)
    : []
  if (fromGrids.length) return fromGrids

  const fromDescription = extractGridTexts(String(item.description || ''))
  return fromDescription.length ? fromDescription : [gridPlaceholder]
}

export function computeGridShape(gridCount: number): { rows: number; cols: number } {
  const count = Math.max(1, Math.min(36, gridCount))
  const cols = Math.max(1, Math.min(6, count <= 3 ? count : Math.ceil(Math.sqrt(count))))
  const rows = Math.max(1, Math.min(6, Math.ceil(count / cols)))
  return { rows, cols }
}

export function buildStoryboardFrames(
  gridTexts: string[],
  rows: number,
  cols: number
): Array<{ id: string; description: string }> {
  const total = rows * cols
  const next: Array<{ id: string; description: string }> = []
  for (let i = 0; i < total; i += 1) {
    next.push({
      id: `frame-${i + 1}`,
      description: gridTexts[i] || ''
    })
  }
  return next
}

export interface StoryboardLayoutNodeLike {
  position: { x: number; y: number }
  dimensions?: { width?: number; height?: number }
}

type EdgeLike = { source: string; target: string }

type FlowNodeProbe = StoryboardLayoutNodeLike & {
  type?: string
  data?: Record<string, unknown>
}

/** 与 TextProcessCanvasNode.resolveStoryboardStartPosition 一致：依赖总资产节点与道具链图片垂直位置 */
export function resolveStoryboardFlowStartPosition(params: {
  findNode: (id: string) => FlowNodeProbe | undefined | null
  edges: EdgeLike[]
  /** 文本处理节点 data.totalAssetNodeId */
  totalAssetNodeId: string | undefined | null
  selfNode: StoryboardLayoutNodeLike
  assetDetailChainOffsetX: number
  assetCategorySectionGapY: number
  assetImageNodeHeight: number
}): { x: number; y: number } {
  const {
    findNode,
    edges,
    totalAssetNodeId,
    selfNode,
    assetDetailChainOffsetX,
    assetCategorySectionGapY,
    assetImageNodeHeight
  } = params

  const fallback = {
    x: selfNode.position.x + (selfNode.dimensions?.width ?? 430) + 80,
    y: selfNode.position.y
  }
  const tid = String(totalAssetNodeId ?? '').trim()
  if (!tid) return fallback
  const totalNode = findNode(tid)
  if (!totalNode) return fallback

  const assetAlignedX =
    totalNode.position.x + (totalNode.dimensions?.width ?? 300) + assetDetailChainOffsetX
  let propImageBottom = Number.NEGATIVE_INFINITY

  for (const edge of edges) {
    const vnode = findNode(edge.target)
    if (!vnode || vnode.type !== 'imageCanvas') continue
    const imageData = vnode.data
    if (!imageData?.generatedByTextProcess) continue
    const detailNodeId = String(imageData.sourceAssetDetailNodeId ?? '').trim()
    if (!detailNodeId) continue
    const detailNode = findNode(detailNodeId)
    if (!detailNode || detailNode.type !== 'textAssetDetail') continue
    const detailData = detailNode.data
    if (detailData?.assetCategory !== 'prop') continue
    const imageBottom =
      vnode.position.y + (vnode.dimensions?.height ?? assetImageNodeHeight)
    if (imageBottom > propImageBottom) {
      propImageBottom = imageBottom
    }
  }

  if (!Number.isFinite(propImageBottom)) {
    return { x: assetAlignedX, y: fallback.y }
  }
  return {
    x: assetAlignedX,
    y: propImageBottom + assetCategorySectionGapY
  }
}
