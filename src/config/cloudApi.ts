/**
 * 云端用户中心 / 支付等接口根域名与 URL 构造。
 * 部署变更时可设环境变量 VITE_CLOUD_API_ORIGIN（勿尾随 /），无需改业务代码。
 */
const raw = (import.meta.env.VITE_CLOUD_API_ORIGIN as string | undefined)?.trim()

export const CLOUD_API_ORIGIN = (raw && raw.replace(/\/$/, '')) || 'https://xmdm.ussn.cn'

/** 与 server/api/auth/index.php 路由一致，使用 query action */
export function cloudAuthUrl(action: string): string {
  return `${CLOUD_API_ORIGIN}/api/auth/index.php?action=${encodeURIComponent(action)}`
}

/** 与 server/api/payment/index.php 路由一致 */
export function cloudPaymentUrl(action: string, query?: URLSearchParams): string {
  const base = `${CLOUD_API_ORIGIN}/api/payment/index.php?action=${encodeURIComponent(action)}`
  const extra = query?.toString()
  return extra ? `${base}&${extra}` : base
}

/** 与 server/.htaccess 中 RewriteRule ^auth/(.*)$ 一致（部分 Nginx 只配了伪静态未暴露 index.php） */
export function cloudAuthPathUrl(action: string): string {
  return `${CLOUD_API_ORIGIN}/auth/${encodeURIComponent(action)}`
}

/** 与 RewriteRule ^payment/(.*)$ 一致 */
export function cloudPaymentPathUrl(action: string, query?: URLSearchParams): string {
  const base = `${CLOUD_API_ORIGIN}/payment/${encodeURIComponent(action)}`
  const extra = query?.toString()
  return extra ? `${base}?${extra}` : base
}

/** 先请求 index.php?action=，若 Nginx 返回 404 再试 /auth/{action} */
export async function fetchCloudAuth(action: string, init?: RequestInit): Promise<Response> {
  const r1 = await fetch(cloudAuthUrl(action), init)
  if (r1.status !== 404) return r1
  return fetch(cloudAuthPathUrl(action), init)
}

/** 先请求 api/payment/index.php?action=，404 再试 /payment/{action} */
export async function fetchCloudPayment(action: string, init?: RequestInit, query?: URLSearchParams): Promise<Response> {
  const r1 = await fetch(cloudPaymentUrl(action, query), init)
  if (r1.status !== 404) return r1
  return fetch(cloudPaymentPathUrl(action, query), init)
}

/** 星星积分系统 API */
export async function fetchCloudStars(action: string, init?: RequestInit, query?: URLSearchParams): Promise<Response> {
  const base = `${CLOUD_API_ORIGIN}/api/stars/index.php?action=${encodeURIComponent(action)}`
  const extra = query?.toString()
  return extra ? fetch(`${base}&${extra}`, init) : fetch(base, init)
}
