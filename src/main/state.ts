import { ipcMain } from 'electron'

export function updateAppState(_state: Partial<AppState>): void {
  Object.assign(state, _state)

  if ('ignoreMouse' in _state) {
    const mainWindow = global.mainWindow
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIgnoreMouseEvents(state.ignoreMouse)
      mainWindow.webContents.send('sync-app-state', state)
    }
  }

  const mainWindow = global.mainWindow
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sync-app-state', state)
  }
}

ipcMain.handle('updateAppState', (_event, _state) => {
  updateAppState(_state)
})

export const state = {
  inCoderPage: false,
  ignoreMouse: false,
  subtitleWindowOpen: false,
  subtitleMode: false,
  voiceTranscriptionMode: false
}

export type AppState = typeof state
