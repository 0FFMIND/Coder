import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import icon from '../../resources/icon.png?asset'

export function createSubtitleWindow(): void {
  if (global.subtitleWindow && !global.subtitleWindow.isDestroyed()) {
    showSubtitleWindow()
    return
  }

  const display = screen.getPrimaryDisplay()
  const { width, height } = display.workAreaSize

  const subtitleWindow = new BrowserWindow({
    width: width,
    height: 120,
    x: 0,
    y: height - 120,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hiddenInMissionControl: true,
    focusable: true,
    resizable: true,
    movable: true,
    show: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  global.subtitleWindow = subtitleWindow

  subtitleWindow.setMenuBarVisibility(false)
  subtitleWindow.setContentProtection(true)
  subtitleWindow.setAlwaysOnTop(true, 'screen-saver', 1)
  subtitleWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const devRendererUrl =
    process.env['ELECTRON_RENDERER_URL'] ||
    (process.env['NODE_ENV'] === 'development' ? 'http://localhost:5173' : undefined)

  if (devRendererUrl) {
    subtitleWindow.loadURL(`${devRendererUrl}#/subtitle`)
  } else {
    subtitleWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/subtitle' })
  }

  subtitleWindow.on('ready-to-show', () => {
    subtitleWindow.showInactive()
  })

  subtitleWindow.on('closed', () => {
    global.subtitleWindow = null
    const mainWindow = global.mainWindow
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('subtitle-window-closed')
    }
  })
}

export function showSubtitleWindow(): void {
  if (global.subtitleWindow && !global.subtitleWindow.isDestroyed()) {
    if (global.subtitleWindow.isMinimized()) {
      global.subtitleWindow.restore()
    }
    global.subtitleWindow.showInactive()
  }
}

export function hideSubtitleWindow(): void {
  if (global.subtitleWindow && !global.subtitleWindow.isDestroyed()) {
    global.subtitleWindow.hide()
  }
}

export function destroySubtitleWindow(): void {
  if (global.subtitleWindow && !global.subtitleWindow.isDestroyed()) {
    global.subtitleWindow.close()
    global.subtitleWindow = null
  }
}
