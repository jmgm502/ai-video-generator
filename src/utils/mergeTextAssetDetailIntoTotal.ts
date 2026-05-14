import type { Ref } from 'vue'

export type TextAssetCategory = 'character' | 'scene' | 'prop'

export interface TextAssetItemForTotal {
  id: string
  name: string
  description: string
  imageUrl?: string | null
  category?: TextAssetCategory
}

export interface TextGroupedAssetsInput {
  character?: TextAssetItemForTotal[]
  scene?: TextAssetItemForTotal[]
  prop?: TextAssetItemForTotal[]
}

/** 快照里可能出现 null 占位，合并前剔除避免 findIndex / 展开时报错 */
function compactAssetList(list: TextAssetItemForTotal[] | undefined): TextAssetItemForTotal[] {
  if (!Array.isArray(list)) return []
  return list.filter((a): a is TextAssetItemForTotal => a != null && typeof a === 'object')
}

/**
 * 与 TextAssetResultCanvasNode 一致：分组里已有项则作为合并基线；否则用扁平 assets + category 拆组。
 * 避免仅存在 assets、groupedAssets 为空时合并把原有资产清空。
 */
export function baselineGroupedAssetsFromTotalData(data: {
  groupedAssets?: TextGroupedAssetsInput
  assets?: unknown
}): TextGroupedAssetsInput {
  const g = data.groupedAssets ?? {}
  const character = compactAssetList(g.character)
  const scene = compactAssetList(g.scene)
  const prop = compactAssetList(g.prop)
  if (character.length > 0 || scene.length > 0 || prop.length > 0) {
    return { character, scene, prop }
  }
  const out: Required<TextGroupedAssetsInput> = { character: [], scene: [], prop: [] }
  const flat = Array.isArray(data.assets) ? data.assets : []
  for (const raw of flat) {
    if (!raw || typeof raw !== 'object') continue
    const a = raw as Record<string, unknown>
    const name = String(a.name ?? '').trim()
    if (!name) continue
    const cat = a.category
    if (cat !== 'character' && cat !== 'scene' && cat !== 'prop') continue
    const item: TextAssetItemForTotal = {
      id: String(a.id ?? ''),
      name,
      description: String(a.description ?? ''),
      imageUrl: a.imageUrl == null ? null : String(a.imageUrl),
      category: cat
    }
    out[cat].push(item)
  }
  return out
}

export function inferAssetCategoryFromDetailData(data: Record<string, unknown>): TextAssetCategory | null {
  const c = data.assetCategory
  if (c === 'character' || c === 'scene' || c === 'prop') return c
  const label = String(data.label ?? '')
  if (label.includes('人物')) return 'character'
  if (label.includes('场景')) return 'scene'
  if (label.includes('道具')) return 'prop'
  return null
}

/**
 * 父级 nodes 常为 shallowRef，仅靠 updateNodeData 改 data 可能不触发自定义节点重绘；替换数组项保证刷新。
 */
export function patchTextAssetResultNodeInNodesList(
  nodes: Ref<any[]>,
  totalId: string,
  groupedAssets: Required<TextGroupedAssetsInput>,
  assets: TextAssetItemForTotal[]
): void {
  const list = nodes.value
  const i = list.findIndex((n) => n.id === totalId)
  if (i === -1) return
  const cur = list[i]
  if (cur.type !== 'textAssetResult') return
  nodes.value = list.map((n, j) =>
    j === i
      ? { ...n, data: { ...n.data, groupedAssets, assets, status: 'completed' } }
      : n
  )
}

/**
 * 将手动连线的 textAssetDetail 同步进 textAssetResult 的 groupedAssets / assets。
 * 使用 detail 节点 id 作为资产 id，便于重命名时覆盖同一条。
 */
export function mergeTextAssetDetailIntoTotal(
  grouped: TextGroupedAssetsInput | undefined,
  detailNodeId: string,
  category: TextAssetCategory,
  name: string,
  description: string
): { groupedAssets: Required<TextGroupedAssetsInput>; assets: TextAssetItemForTotal[] } {
  const g: Required<TextGroupedAssetsInput> = {
    character: compactAssetList(grouped?.character),
    scene: compactAssetList(grouped?.scene),
    prop: compactAssetList(grouped?.prop)
  }
  const list = [...g[category]]
  const idx = list.findIndex((a) => String(a.id ?? '') === detailNodeId)
  const item: TextAssetItemForTotal = {
    id: detailNodeId,
    name: name.trim() || '未命名资产',
    description: String(description ?? ''),
    imageUrl: null,
    category
  }
  if (idx >= 0) list[idx] = item
  else list.push(item)
  g[category] = list
  const assets = [...g.character, ...g.scene, ...g.prop]
  return { groupedAssets: g, assets }
}

/** 文本提取自动创建的详情节点 id：`asset-detail-{category}-{timestamp}-{index}`，与 grouped 中 AI 生成的 char_/scene_/prop_ id 不同，需按序号剔除 */
const EXTRACTED_DETAIL_NODE_ID_RE = /^asset-detail-(character|scene|prop)-(\d+)-(\d+)$/

/**
 * 删除人物/场景/道具详情节点后，从总资产分组中去掉对应一条。
 * 先按资产 id === 详情节点 id（手动连线合并）；否则按提取链路 id 解析分组下标。
 * @returns 有变更则返回新 grouped/扁平 assets，否则 null
 */
export function removeDetailNodeFromTotalAssets(
  totalData: { groupedAssets?: TextGroupedAssetsInput; assets?: unknown },
  detailNodeId: string
): { groupedAssets: Required<TextGroupedAssetsInput>; assets: TextAssetItemForTotal[] } | null {
  const base = baselineGroupedAssetsFromTotalData(totalData)
  const g: Required<TextGroupedAssetsInput> = {
    character: compactAssetList(base.character),
    scene: compactAssetList(base.scene),
    prop: compactAssetList(base.prop)
  }
  let changed = false
  for (const key of ['character', 'scene', 'prop'] as const) {
    const before = g[key].length
    g[key] = g[key].filter((a) => String(a.id ?? '') !== detailNodeId)
    if (g[key].length !== before) changed = true
  }
  if (!changed) {
    const m = detailNodeId.match(EXTRACTED_DETAIL_NODE_ID_RE)
    if (m) {
      const cat = m[1] as TextAssetCategory
      const idx = Number(m[3])
      if (Number.isFinite(idx) && idx >= 0 && idx < g[cat].length) {
        g[cat].splice(idx, 1)
        changed = true
      }
    }
  }
  if (!changed) return null
  const assets = [...g.character, ...g.scene, ...g.prop]
  return { groupedAssets: g, assets }
}

/** 手动/组合详情在总资产里的条目 id 与节点 id 一致；AI 提取的 char_/scene_/prop_ 不以此前缀开头 */
export const ASSET_DETAIL_NODE_ID_PREFIX = 'asset-detail-'

/**
 * 详情节点已被删但总资产仍保留条目时收敛（例如走了 Vue Flow 内置删除、未经过 deleteSelected）。
 * 仅移除「id 以 asset-detail- 开头且图中已无同 id 节点」的项。
 */
export function pruneOrphanedAssetDetailLinkedEntriesInTotals(nodes: Ref<any[]>): void {
  const nodeIds = new Set(nodes.value.map((n) => n.id))
  const list = nodes.value
  let changed = false
  const next = list.map((n) => {
    if (n.type !== 'textAssetResult') return n
    const base = baselineGroupedAssetsFromTotalData(n.data)
    const g: Required<TextGroupedAssetsInput> = {
      character: compactAssetList(base.character),
      scene: compactAssetList(base.scene),
      prop: compactAssetList(base.prop)
    }
    const pr = (arr: TextAssetItemForTotal[]) =>
      arr.filter((item) => {
        const id = String(item.id ?? '')
        if (!id.startsWith(ASSET_DETAIL_NODE_ID_PREFIX)) return true
        return nodeIds.has(id)
      })
    const nc = pr(g.character)
    const ns = pr(g.scene)
    const np = pr(g.prop)
    if (nc.length === g.character.length && ns.length === g.scene.length && np.length === g.prop.length) {
      return n
    }
    changed = true
    const groupedAssets: Required<TextGroupedAssetsInput> = { character: nc, scene: ns, prop: np }
    const assets = [...nc, ...ns, ...np]
    return { ...n, data: { ...n.data, groupedAssets, assets } }
  })
  if (changed) {
    nodes.value = next
  }
}
