import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** i18n path for document title via `routes.*` keys */
    titleKey?: string
    requiresAuth?: boolean
  }
}
