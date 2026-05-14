import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false, titleKey: 'routes.login' },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
    meta: { requiresAuth: false, titleKey: 'routes.register' },
  },
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: { requiresAuth: true, titleKey: 'routes.home' },
  },
  {
    path: '/projects',
    name: 'ProjectList',
    component: () => import('@/views/ProjectList.vue'),
    meta: { requiresAuth: true, titleKey: 'routes.projects' },
  },
  {
    path: '/canvas-projects',
    name: 'CanvasProjectList',
    component: () => import('@/views/CanvasProjectList.vue'),
    meta: { requiresAuth: true, titleKey: 'routes.canvasProjects' },
  },
  {
    path: '/canvas/:id',
    component: () => import('@/views/CanvasEditor.vue'),
    meta: { requiresAuth: true, titleKey: 'routes.canvasEditor' },
  },
  {
    path: '/editor/:id',
    component: () => import('@/views/Editor.vue'),
    meta: { requiresAuth: true, titleKey: 'routes.editor' },
    children: [
      {
        path: '',
        name: 'Editor',
        redirect: to => {
          const projectId = to.params.id as string
          const savedStep = localStorage.getItem(`project_last_step_${projectId}`)
          if (savedStep === 'step2') {
            return { path: `/editor/${projectId}/step2` }
          }
          return { path: `/editor/${projectId}/step1` }
        }
      },
      {
        path: 'step1',
        name: 'EditorStep1',
        component: () => import('@/views/Step1Page.vue'),
        meta: { requiresAuth: true, titleKey: 'routes.step1' },
      },
      {
        path: 'step2',
        name: 'EditorStep2',
        component: () => import('@/views/Step2Page.vue'),
        meta: { requiresAuth: true, titleKey: 'routes.step2' },
      },
    ]
  },
  {
    path: '/prompts',
    name: 'Prompts',
    component: () => import('@/views/PromptsPage.vue'),
    meta: { requiresAuth: true, titleKey: 'routes.prompts' },
  },
  {
    path: '/logs',
    name: 'Logs',
    component: () => import('@/views/LogsPage.vue'),
    meta: { requiresAuth: true, titleKey: 'routes.logs' },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue'),
    meta: { requiresAuth: true, titleKey: 'routes.settings' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { requiresAuth: false, titleKey: 'routes.notFound' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  const userStore = useUserStore()
  const isLoggedIn = userStore.isLoggedIn

  if (to.meta.requiresAuth && !isLoggedIn) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if ((to.name === 'Login' || to.name === 'Register') && isLoggedIn) {
    next({ name: 'Home' })
  } else {
    next()
  }
})

export default router
