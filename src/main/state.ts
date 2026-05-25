import { ipcMain } from 'electron'

ipcMain.handle('updateAppState', (_event, _state) => {
  Object.assign(state, _state)

  if ('ignoreMouse' in _state) {
    const mainWindow = global.mainWindow
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIgnoreMouseEvents(state.ignoreMouse)
      mainWindow.webContents.send('sync-app-state', state)
    }
  }
})

export const state = {
  inCoderPage: false,
  ignoreMouse: false
}

export type AppState = typeof state
