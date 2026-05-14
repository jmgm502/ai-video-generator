import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'
import { readFileSync } from 'fs'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

const versionInfo = JSON.parse(readFileSync(resolve(__dirname, 'version.json'), 'utf-8'))

export default defineConfig({
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', '@excalidraw/excalidraw'],
    esbuildOptions: {
      jsx: 'automatic',
    },
  },
  esbuild: {
    jsx: 'automatic',
    charset: 'utf8',
  },
  define: {
    __APP_VERSION__: JSON.stringify(versionInfo.version),
    __APP_BUILD_NUMBER__: versionInfo.buildNumber,
  },
  plugins: [
    vue(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart(options) {
          options.startup()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    charset: 'utf8',
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
      },
      output: {
        charset: 'utf8',
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
})
