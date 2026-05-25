import { desktopCapturer, screen } from 'electron'
import { settings } from './settings'

const SAMPLE_SIZE = 60
const THUMBNAIL_WIDTH = 360
const DARK_THRESHOLD = 120
const LIGHT_THRESHOLD = 165
const CHECK_INTERVAL_MS = 5000

let currentTheme: 'dark' | 'light' | null = null
let timer: ReturnType<typeof setInterval> | null = null
let lastCheckTime = 0
let generation = 0
let activeGeneration = -1
const MIN_CHECK_GAP = 2500

function getWindowBounds() {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return null
  return mainWindow.getBounds()
}

function getSampleRegions(
  bounds: Electron.Rectangle
): { x: number; y: number; width: number; height: number }[] {
  const half = Math.floor(SAMPLE_SIZE / 2)
  const rightX = bounds.x + bounds.width - SAMPLE_SIZE
  const bottomY = bounds.y + bounds.height - SAMPLE_SIZE
  const centerX = bounds.x + Math.floor(bounds.width / 2) - half
  const centerY = bounds.y + Math.floor(bounds.height / 2) - half

  return [
    { x: bounds.x, y: bounds.y, width: SAMPLE_SIZE, height: SAMPLE_SIZE },
    { x: rightX, y: bounds.y, width: SAMPLE_SIZE, height: SAMPLE_SIZE },
    { x: bounds.x, y: bottomY, width: SAMPLE_SIZE, height: SAMPLE_SIZE },
    { x: rightX, y: bottomY, width: SAMPLE_SIZE, height: SAMPLE_SIZE },
    { x: centerX, y: centerY, width: SAMPLE_SIZE, height: SAMPLE_SIZE }
  ]
}

function getDisplayContaining(x: number, y: number) {
  const displays = screen.getAllDisplays()
  for (const d of displays) {
    const b = d.bounds
    if (x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height) {
      return d
    }
  }
  return screen.getPrimaryDisplay()
}

function samplePixelFromImage(
  imageData: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  regionX: number,
  regionY: number,
  displayBounds: Electron.Rectangle,
  displaySize: Electron.Size
): number {
  const scaleX = imageWidth / displaySize.width
  const scaleY = imageHeight / displaySize.height
  const localX = Math.round((regionX - displayBounds.x) * scaleX)
  const localY = Math.round((regionY - displayBounds.y) * scaleY)
  const sampleWidth = Math.max(4, Math.round(SAMPLE_SIZE * scaleX))
  const sampleHeight = Math.max(4, Math.round(SAMPLE_SIZE * scaleY))

  if (
    localX < 0 ||
    localY < 0 ||
    localX + sampleWidth > imageWidth ||
    localY + sampleHeight > imageHeight
  ) {
    return -1
  }

  let sum = 0
  let count = 0
  for (let py = 0; py < sampleHeight; py++) {
    for (let px = 0; px < sampleWidth; px++) {
      const idx = ((localY + py) * imageWidth + (localX + px)) * 4
      const r = imageData[idx]
      const g = imageData[idx + 1]
      const b = imageData[idx + 2]
      const brightness = r * 0.299 + g * 0.587 + b * 0.114
      sum += brightness
      count++
    }
  }
  return count > 0 ? sum / count : -1
}

function nativeImageToImageData(
  nativeImage: Electron.NativeImage
): { data: Uint8ClampedArray; width: number; height: number } {
  const bitmap = nativeImage.toBitmap()
  const size = nativeImage.getSize()
  return {
    data: new Uint8ClampedArray(bitmap),
    width: size.width,
    height: size.height
  }
}

export async function sampleScreenBrightness(): Promise<number | null> {
  const bounds = getWindowBounds()
  if (!bounds) return null

  const regions = getSampleRegions(bounds)
  const displays = screen.getAllDisplays()

  const displayRegionsMap = new Map<Electron.Display, typeof regions>()
  for (const region of regions) {
    const display = getDisplayContaining(region.x + SAMPLE_SIZE / 2, region.y + SAMPLE_SIZE / 2)
    if (!displayRegionsMap.has(display)) {
      displayRegionsMap.set(display, [])
    }
    displayRegionsMap.get(display)!.push(region)
  }

  const brightnessValues: number[] = []

  for (const [display, displayRegions] of displayRegionsMap) {
    const { width, height } = display.size
    const thumbnailHeight = Math.max(1, Math.round((THUMBNAIL_WIDTH * height) / width))
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: THUMBNAIL_WIDTH, height: thumbnailHeight }
      })

      let source = sources.find(
        (s) =>
          s.display_id &&
          displays.find((d) => d.id.toString() === s.display_id)?.id === display.id
      )

      if (!source) {
        source = sources[0]
      }

      if (!source) continue

      const { data, width: imgWidth, height: imgHeight } = nativeImageToImageData(source.thumbnail)

      for (const region of displayRegions) {
        const val = samplePixelFromImage(
          data,
          imgWidth,
          imgHeight,
          region.x,
          region.y,
          display.bounds,
          display.size
        )
        if (val >= 0) {
          brightnessValues.push(val)
        }
      }
    } catch (error) {
      console.error('Auto-theme: failed to capture display:', error)
    }
  }

  if (brightnessValues.length === 0) return null

  const avg = brightnessValues.reduce((a, b) => a + b, 0) / brightnessValues.length
  return Math.round(avg)
}

export function determineTheme(brightness: number): 'dark' | 'light' | null {
  if (brightness < DARK_THRESHOLD) return 'dark'
  if (brightness > LIGHT_THRESHOLD) return 'light'
  return null
}

export function sendThemeToRenderer(theme: 'dark' | 'light') {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('auto-theme-changed', theme)
}

export async function checkAndApplyTheme(): Promise<void> {
  if (!settings.autoTheme) return

  const currentGen = generation
  if (activeGeneration === currentGen) return

  const now = Date.now()
  if (now - lastCheckTime < MIN_CHECK_GAP) return
  lastCheckTime = now

  activeGeneration = currentGen
  try {
    const brightness = await sampleScreenBrightness()
    if (generation !== currentGen) return
    if (brightness === null) return

    const newTheme = determineTheme(brightness)
    if (newTheme && newTheme !== currentTheme) {
      currentTheme = newTheme
      sendThemeToRenderer(newTheme)
    }
  } catch (error) {
    console.error('Auto-theme: check failed:', error)
  } finally {
    if (generation === currentGen) {
      activeGeneration = -1
    }
  }
}

export function startAutoThemeCheck() {
  if (timer) return
  timer = setInterval(() => {
    checkAndApplyTheme()
  }, CHECK_INTERVAL_MS)
}

export function stopAutoThemeCheck() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  currentTheme = null
  lastCheckTime = 0
  generation++
}

export function updateAutoThemeEnabled(enabled: boolean) {
  settings.autoTheme = enabled
  if (enabled) {
    startAutoThemeCheck()
    checkAndApplyTheme()
  } else {
    stopAutoThemeCheck()
  }
}
