import { ipcMain, dialog, app } from 'electron'
import Store from 'electron-store'

const store = new Store()

ipcMain.handle('store-get', (_event, key: string) => {
  return store.get(key)
})

ipcMain.handle('store-set', (_event, key: string, value: unknown) => {
  store.set(key, value)
  return true
})

ipcMain.handle('store-delete', (_event, key: string) => {
  store.delete(key)
  return true
})

ipcMain.handle('store-clear', () => {
  store.clear()
  return true
})

ipcMain.handle('dialog-openFile', async (_event, options) => {
  const result = await dialog.showOpenDialog(options)
  return result
})

ipcMain.handle('dialog-saveFile', async (_event, options) => {
  const result = await dialog.showSaveDialog(options)
  return result
})

ipcMain.handle('app-getVersion', () => {
  return app.getVersion()
})

ipcMain.handle('app-getPath', (_event, name: string) => {
  return app.getPath(name as Parameters<typeof app.getPath>[0])
})
