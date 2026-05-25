import { desktopCapturer, screen } from 'electron'
import { settings } from './settings'

const DEFAULT_MAX_SCREENSHOT_WIDTH = 1920
const DEFAULT_MAX_SCREENSHOT_HEIGHT = 1200
const SMALL_VISION_MAX_SCREENSHOT_WIDTH = 768
const SMALL_VISION_MAX_SCREENSHOT_HEIGHT = 512

function shouldCompressScreenshotForModel(model: string) {
  return model.toLowerCase() === 'qwen/qwen3-vl-8b-thinking'
}

function getScaledSize(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(1, maxWidth / width, maxHeight / height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: scale < 1
  }
}

export function takeScreenshot(): Promise<string | void> {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return Promise.resolve()

  // Get the primary display's size.
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.size
  const shouldCompress = shouldCompressScreenshotForModel(settings.model)
  const thumbnailSize = shouldCompress
    ? getScaledSize(width, height, SMALL_VISION_MAX_SCREENSHOT_WIDTH, SMALL_VISION_MAX_SCREENSHOT_HEIGHT)
    : getScaledSize(width, height, DEFAULT_MAX_SCREENSHOT_WIDTH, DEFAULT_MAX_SCREENSHOT_HEIGHT)

  return desktopCapturer
    .getSources({ types: ['screen'], thumbnailSize })
    .then((sources) => {
      if (sources.length > 0) {
        const screenshot = sources[0]?.thumbnail.toPNG()
        const base64Data = screenshot.toString('base64')
        console.info(
          `Screenshot captured: model=${settings.model}, ${width}x${height} -> ${thumbnailSize.width}x${thumbnailSize.height}, ${Math.round(screenshot.length / 1024)}KB${shouldCompress && thumbnailSize.scaled ? ', compressed for small vision model' : thumbnailSize.scaled ? ', scaled' : ''}`
        )
        return base64Data
      }
      return undefined
    })
    .catch((error) => {
      console.error('Error taking screenshot:', error)
    })
}
