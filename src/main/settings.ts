import { dialog, ipcMain } from 'electron'

let onAutoThemeChange: ((enabled: boolean) => void) | null = null

export function setAutoThemeChangeCallback(callback: (enabled: boolean) => void): void {
  onAutoThemeChange = callback
}

ipcMain.handle('getAppSettings', () => {
  return settings
})

ipcMain.handle('updateAppSettings', (_event, _settings) => {
  const changedSettings: Partial<AppSettings> = {}
  for (const key of Object.keys(_settings) as (keyof AppSettings)[]) {
    if (_settings[key] !== settings[key]) {
      changedSettings[key] = _settings[key]
    }
  }

  if (Object.keys(changedSettings).length === 0) {
    return
  }

  Object.assign(settings, changedSettings)

  if ('autoTheme' in changedSettings && onAutoThemeChange) {
    onAutoThemeChange(Boolean(changedSettings.autoTheme))
  }

  const mainWindow = global.mainWindow
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings-updated', changedSettings)
  }
  const subtitleWindow = global.subtitleWindow
  if (subtitleWindow && !subtitleWindow.isDestroyed()) {
    subtitleWindow.webContents.send('settings-updated', changedSettings)
  }
})

ipcMain.handle('selectScreenshotDir', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: '选择截图保存目录'
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

export const settings = {
  apiBaseURL: process.env.API_BASE_URL || '',
  apiKey: process.env.API_KEY || '',
  model: process.env.MODEL || 'qwen/qwen3-coder',
  fallbackModel: process.env.FALLBACK_MODEL || 'qwen/qwen3-coder',
  codeLanguage: process.env.CODE_LANGUAGE || 'python',
  customPrompt: '',
  activePromptPresetId: 'new-lc',
  screenshotAutoSave: false,
  screenshotDir: '',
  dashscopeApiKey: process.env.DASHSCOPE_API_KEY || '',
  defaultAudioDeviceId: '',
  transcriptionAutoSubmitSeconds: 5,
  autoTheme: false,
  zenmuxApiKey: process.env.ZENMUX_API_KEY || '',
  zenmuxBaseURL: process.env.ZENMUX_BASE_URL || 'https://zenmux.ai/api/v1'
}

export type AppSettings = typeof settings
