import { join } from 'node:path'
import { shell, app, BrowserWindow, ipcMain } from 'electron'
import icon from '../../resources/icon.png?asset'

const COLLAPSED_WINDOW_HEIGHT = 82
const COLLAPSED_RESIZE_THRESHOLD = COLLAPSED_WINDOW_HEIGHT + 24
let expandedWindowBounds: Electron.Rectangle | null = null
let isWindowCollapsed = false
let isRendererResizing = false
let isApplyingWindowBounds = false

function sendWindowCollapsedState(collapsed: boolean): void {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('window-collapsed-changed', collapsed)
}

function syncExpandedBoundsFromWindow(window: BrowserWindow): void {
  if (!isWindowCollapsed) {
    expandedWindowBounds = window.getBounds()
  }
}

function maybeRestoreCollapsedStateFromResize(window: BrowserWindow): void {
  if (isRendererResizing || isApplyingWindowBounds) return
  const bounds = window.getBounds()
  if (!isWindowCollapsed) {
    expandedWindowBounds = bounds
    return
  }

  if (bounds.height > COLLAPSED_RESIZE_THRESHOLD) {
    isWindowCollapsed = false
    expandedWindowBounds = bounds
    sendWindowCollapsedState(false)
  }
}

function setWindowBoundsSafely(window: BrowserWindow, bounds: Electron.Rectangle): void {
  isApplyingWindowBounds = true
  window.setBounds(bounds)

  setTimeout(() => {
    if (!window.isDestroyed()) {
      window.setBounds(bounds)
    }
    isApplyingWindowBounds = false
  }, 50)
}

function getExpandedRestoreBounds(window: BrowserWindow): Electron.Rectangle | null {
  if (!expandedWindowBounds) return null

  const currentBounds = window.getBounds()
  return {
    ...currentBounds,
    height: expandedWindowBounds.height
  }
}

export function applyContentProtection(window: BrowserWindow, forceReset = false): void {
  if (!window || window.isDestroyed()) return

  if (forceReset && process.platform === 'win32') {
    window.setContentProtection(false)
  }

  window.setContentProtection(true)
}

export function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hiddenInMissionControl: true,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Store reference to mainWindow globally
  global.mainWindow = mainWindow

  mainWindow.setMenuBarVisibility(false)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1)
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    app.dock?.show()
    applyContentProtection(mainWindow)

    // Reclaim top position when other apps steal it
    mainWindow.on('always-on-top-changed', (_event, isAlwaysOnTop) => {
      if (!isAlwaysOnTop && mainWindow.isVisible() && !mainWindow.isDestroyed()) {
        // Only re-set the flag; avoid moveTop() to not disturb other window focus
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1)
      }
    })
  })

  mainWindow.on('show', () => {
    applyContentProtection(mainWindow)
  })

  mainWindow.on('move', () => syncExpandedBoundsFromWindow(mainWindow))
  mainWindow.on('resize', () => maybeRestoreCollapsedStateFromResize(mainWindow))
  mainWindow.on('resized', () => maybeRestoreCollapsedStateFromResize(mainWindow))
  mainWindow.on('maximize', () => maybeRestoreCollapsedStateFromResize(mainWindow))
  mainWindow.on('unmaximize', () => maybeRestoreCollapsedStateFromResize(mainWindow))

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  const devRendererUrl =
    process.env['ELECTRON_RENDERER_URL'] ||
    (process.env['NODE_ENV'] === 'development' ? 'http://localhost:5173' : undefined)

  if (devRendererUrl) {
    mainWindow.loadURL(devRendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

export function ensureWindowExpanded(): boolean {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return false

  const [, height] = mainWindow.getSize()
  if (isWindowCollapsed && height <= COLLAPSED_RESIZE_THRESHOLD && expandedWindowBounds) {
    isWindowCollapsed = false
    const restoreBounds = getExpandedRestoreBounds(mainWindow)
    if (restoreBounds) {
      setWindowBoundsSafely(mainWindow, restoreBounds)
    }
    sendWindowCollapsedState(false)
    return true
  }
  return false
}

ipcMain.handle('setWindowCollapsed', (_event, collapsed: boolean) => {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return false

  if (collapsed) {
    if (!isWindowCollapsed) {
      expandedWindowBounds = mainWindow.isMaximized()
        ? mainWindow.getNormalBounds()
        : mainWindow.getBounds()
    }
    isWindowCollapsed = true

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    }

    const targetBounds = expandedWindowBounds ?? mainWindow.getBounds()
    setWindowBoundsSafely(mainWindow, {
      ...targetBounds,
      height: COLLAPSED_WINDOW_HEIGHT
    })
    sendWindowCollapsedState(true)
    return true
  }

  isWindowCollapsed = false
  const restoreBounds = getExpandedRestoreBounds(mainWindow)
  if (restoreBounds) {
    setWindowBoundsSafely(mainWindow, restoreBounds)
  }
  sendWindowCollapsedState(false)
  return false
})

ipcMain.handle('setWindowHeight', (_event, height: number) => {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return

  isRendererResizing = true
  const [width] = mainWindow.getSize()
  const bounds = mainWindow.getBounds()
  mainWindow.setBounds({ x: bounds.x, y: bounds.y, width, height })

  if (isWindowCollapsed && height > COLLAPSED_RESIZE_THRESHOLD) {
    isWindowCollapsed = false
    expandedWindowBounds = { x: bounds.x, y: bounds.y, width, height }
    sendWindowCollapsedState(false)
  }
})

ipcMain.handle('endRendererResize', () => {
  isRendererResizing = false
})

export function getWindowCollapsed(): boolean {
  return isWindowCollapsed
}

export function toggleWindowCollapsed(): boolean {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return isWindowCollapsed

  const nextCollapsed = !isWindowCollapsed

  if (nextCollapsed) {
    if (!isWindowCollapsed) {
      expandedWindowBounds = mainWindow.isMaximized()
        ? mainWindow.getNormalBounds()
        : mainWindow.getBounds()
    }
    isWindowCollapsed = true

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    }

    const targetBounds = expandedWindowBounds ?? mainWindow.getBounds()
    setWindowBoundsSafely(mainWindow, {
      ...targetBounds,
      height: COLLAPSED_WINDOW_HEIGHT
    })
    sendWindowCollapsedState(true)
    return true
  }

  isWindowCollapsed = false
  const restoreBounds = getExpandedRestoreBounds(mainWindow)
  if (restoreBounds) {
    setWindowBoundsSafely(mainWindow, restoreBounds)
  }
  sendWindowCollapsedState(false)
  return false
}
