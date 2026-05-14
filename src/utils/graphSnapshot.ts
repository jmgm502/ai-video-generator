import { toRaw } from 'vue'

/**
 * 历史 / 落盘用拷贝：只保留可 JSON 化的数据。
 * 体量提示：若在 `node.data` 中长期塞超长 base64 或整块提示词冗余副本，会令每次 clone/JSON.stringify 卡顿；
 * 大资源应尽量用文件路径 / URL / 画布媒体目录引用，而非内联进 data（本函数不对业务字段做裁剪，以免影响撤销一致性）。
 * 不可使用 `structuredClone`：Vue Flow 的节点/边里可能带内部对象、环引用等，会抛 DOMException。
 */
export function cloneGraphStateForSnapshot<T>(value: T): T {
  const raw = toRaw(value) as object
  try {
    return JSON.parse(safeStringifyForGraph(raw)) as T
  } catch (e) {
    console.warn('[cloneGraphStateForSnapshot] 序列化失败，回退空结构', e)
    return (Array.isArray(value) ? [] : ({} as unknown)) as T
  }
}

function safeStringifyForGraph(data: object): string {
  const seen = new WeakSet<object>()

  return JSON.stringify(
    data,
    function replacer(this: object, _key: string, val: unknown) {
      if (val === null || typeof val !== 'object') {
        if (typeof val === 'bigint') return val.toString()
        if (typeof val === 'function' || typeof val === 'symbol') return undefined
        return val
      }
      if (val instanceof Object && 'nodeType' in val && typeof (val as { nodeType: unknown }).nodeType === 'number') {
        return undefined
      }
      const obj = val as object
      if (seen.has(obj)) {
        return undefined
      }
      seen.add(obj)
      return val
    }
  )
}
