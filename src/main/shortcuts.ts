import { globalShortcut, ipcMain, screen } from 'electron'
import type { BrowserWindow, Rectangle } from 'electron'
import type { ModelMessage } from 'ai'
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyContentProtection, ensureWindowExpanded, toggleWindowCollapsed } from './main-window'
import { takeScreenshot } from './take-screenshot'
import { saveScreenshotToDisk } from './save-screenshot'
import {
  getSolutionStream,
  getFollowUpStream,
  getGeneralStream,
  getScreenshotTextStream,
  isCoderPipelineModel
} from './ai'
import { state } from './state'
import { settings } from './settings'
import { getTranscriptionText, clearTranscriptionText } from './transcription'

/**
 * Extract meaningful error message from API errors
 */
function extractErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error) || '未知错误'
  }

  // Handle model call failed with no content (finishReason: unknown)
  if (error.message.includes('调用失败，未返回任何内容')) {
    return error.message
  }

  // Handle timeout errors
  if (error.message.includes('没有返回任何文本')) {
    return error.message
  }

  // Try to extract responseBody from AI SDK errors
  const apiError = error as Error & {
    responseBody?: string
    statusCode?: number
    data?: unknown
  }

  // Try to parse responseBody for detailed message
  if (apiError.responseBody) {
    try {
      const body = JSON.parse(apiError.responseBody)
      if (body.message) {
        return body.message
      }
      if (body.error?.message) {
        return body.error.message
      }
    } catch {
      // If parsing fails, use responseBody as is
      if (typeof apiError.responseBody === 'string' && apiError.responseBody.length < 200) {
        return apiError.responseBody
      }
    }
  }

  // Handle common error types
  const status = apiError.statusCode
  if (status === 401 || status === 403) {
    return 'API 密钥无效或权限不足，请检查设置。'
  }
  if (status === 404) {
    return '模型不存在或 API 地址错误，请检查模型名称和 API 配置。'
  }
  if (status === 429) {
    return '请求过于频繁，请稍后重试。'
  }
  if (status && status >= 500) {
    return '服务器错误，请稍后重试。'
  }

  // Handle image/vision unsupported errors
  if (
    error.message.toLowerCase().includes('image') ||
    error.message.toLowerCase().includes('vision') ||
    error.message.toLowerCase().includes('不支持')
  ) {
    return '当前模型可能不支持图片输入，请切换到支持视觉的模型。'
  }

  // Fallback to error message
  return error.message || '未知错误'
}

function escapeCodeFence(text: string): string {
  return text.replace(/```/g, '``\\`')
}

function formatUserQuestionForPanel(question: string): string {
  const trimmedQuestion = question.trim()
  if (!trimmedQuestion) return '**你：**\n\n'

  if (!trimmedQuestion.includes('\n')) {
    return `**你：** ${trimmedQuestion}\n\n`
  }

  return `**你：**\n\n\`\`\`text\n${escapeCodeFence(trimmedQuestion)}\n\`\`\`\n\n`
}

type Shortcut = {
  action: string
  key: string
  status: ShortcutStatus
  registeredKeys: string[]
}

enum ShortcutStatus {
  Registered = 'registered',
  Failed = 'failed',
  /** Shortcut is available to register but not registered. */
  Available = 'available'
}

const MOVE_STEP = 200
const shortcuts: Record<string, Shortcut> = {}

type AbortReason = 'user' | 'new-request'

interface StreamContext {
  controller: AbortController
  reason: AbortReason | null
}

let currentStreamContext: StreamContext | null = null
let streamGeneration = 0
function isCurrentGeneration(gen: number): boolean {
  return streamGeneration === gen
}

interface GenerationContext {
  generation: number
  mainWindow: Electron.BrowserWindow
}

function createGenerationSender(ctx: GenerationContext) {
  return (channel: string, ...args: unknown[]) => {
    if (isCurrentGeneration(ctx.generation) && ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
      ctx.mainWindow.webContents.send(channel, ...args)
    }
  }
}

// Conversation history tracking
let conversationMessages: ModelMessage[] = []
let lastBaseConversationMessages: ModelMessage[] = []
// Always stores the image-based messages, regardless of pipeline conversion
let originalBaseMessages: ModelMessage[] = []
let recentScreenshots: string[] = [] // 最近截图，水平预览 (限5张)
// Track whether a separator has been inserted between appended screenshots.
// Currently only written (kept for future UI/highlight logic); read path removed
// because both branches of the original if/else performed the same send() call.
let hasAppendSeparator = false
void hasAppendSeparator

const MAX_CONVERSATION_MESSAGES = 20

// Keep first message (screenshot context) + most recent messages within the limit
function trimConversationMessages(): void {
  if (conversationMessages.length <= MAX_CONVERSATION_MESSAGES) return
  const head = conversationMessages.slice(0, 1)
  const tail = conversationMessages.slice(-(MAX_CONVERSATION_MESSAGES - 1))
  conversationMessages = [...head, ...tail]
}
const CODER_PIPELINE_LOG = join(process.cwd(), 'qwen-coder-pipeline.log')

function logCoderPipeline(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}\n`
  appendFileSync(CODER_PIPELINE_LOG, line, 'utf-8')
  console.info(`[Qwen Coder Pipeline] ${message}`)
}

function toCoderTextMessages(ocrText: string, transcriptionText?: string): ModelMessage[] {
  const text = [
    '以下内容来自截图 OCR/视觉转文字结果，请基于这些文字完成当前任务。',
    transcriptionText ? `\n语音转录：\n${transcriptionText}` : '',
    `\n截图文字：\n${ocrText}`
  ].join('\n')

  return [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text
        }
      ]
    }
  ]
}

async function convertImagesToText(
  messages: ModelMessage[],
  streamContext: StreamContext,
  send: (channel: string, ...args: unknown[]) => void
): Promise<string> {
  logCoderPipeline('OCR stage started')
  if (!streamContext.controller.signal.aborted) {
    send('solution-chunk', '[Qwen Coder] 1/2 正在将截图转换为结构化文字...\n\n')
  }

  const ocrStream = getScreenshotTextStream(messages, streamContext.controller.signal)
  let ocrText = ''
  for await (const chunk of ocrStream) {
    if (streamContext.controller.signal.aborted) break
    ocrText += chunk
  }

  logCoderPipeline(`OCR stage completed, ${ocrText.length} chars`)
  logCoderPipeline(`OCR text:\n${ocrText}`)
  if (!streamContext.controller.signal.aborted) {
    send('solution-chunk', '[Qwen Coder] OCR 完成，正在交给 qwen/qwen3-coder 生成结果...\n\n')
  }
  return ocrText
}

type StreamGetter = (messages: ModelMessage[], abortSignal: AbortSignal) => AsyncIterable<string>

type StreamPreprocess = (
  messages: ModelMessage[],
  streamContext: StreamContext,
  send: (channel: string, ...args: unknown[]) => void
) => Promise<ModelMessage[]>

interface RunSolutionStreamOptions {
  streamGetter: StreamGetter
  mainWindow: BrowserWindow
  preprocess?: StreamPreprocess
  sendLoadingEnd?: boolean
  generation: number
  send: (channel: string, ...args: unknown[]) => void
}

interface RunSolutionStreamResult {
  finalMessages: ModelMessage[]
  assistantResponse: string
  wasAborted: boolean
  isLatest: boolean
}

async function runSolutionStream(
  messages: ModelMessage[],
  options: RunSolutionStreamOptions
): Promise<RunSolutionStreamResult> {
  const { streamGetter, mainWindow, preprocess, sendLoadingEnd = true, generation, send } = options
  const isMyGeneration = () => streamGeneration === generation
  const sendIfLatest = send

  const streamContext: StreamContext = {
    controller: new AbortController(),
    reason: null
  }
  currentStreamContext = streamContext

  let endedNaturally = true
  let streamStarted = false
  let assistantResponse = ''
  let finalMessages = messages

  try {
    if (preprocess) {
      finalMessages = await preprocess(messages, streamContext, send)
    }

    const stream = streamGetter(finalMessages, streamContext.controller.signal)
    streamStarted = true

    try {
      for await (const chunk of stream) {
        if (streamContext.controller.signal.aborted) {
          endedNaturally = false
          break
        }
        assistantResponse += chunk
        sendIfLatest('solution-chunk', chunk)
      }
    } catch (error) {
      if (!streamContext.controller.signal.aborted) {
        endedNaturally = false
        console.error('Error streaming solution:', error)
        sendIfLatest('solution-error', extractErrorMessage(error))
      } else {
        endedNaturally = false
      }
    }

    if (streamContext.controller.signal.aborted) {
      if (streamContext.reason === 'user') {
        sendIfLatest('solution-stopped')
      }
    } else if (endedNaturally) {
      if (!assistantResponse) {
        sendIfLatest(
          'solution-error',
          'AI 没有返回内容，请检查当前模型是否支持截图输入，或稍后重试。'
        )
      }
      sendIfLatest('solution-complete')
    }
  } catch (error) {
    if (streamContext.controller.signal.aborted) {
      if (streamContext.reason === 'user') {
        sendIfLatest('solution-stopped')
      }
    } else {
      console.error('Error streaming solution:', error)
      sendIfLatest('solution-error', extractErrorMessage(error))
    }
  } finally {
    if (currentStreamContext === streamContext) {
      currentStreamContext = null
    }
    if (!streamStarted && streamContext.reason === 'user') {
      sendIfLatest('solution-stopped')
    }
    if (sendLoadingEnd && mainWindow && !mainWindow.isDestroyed()) {
      sendIfLatest('ai-loading-end')
    }
  }

  const wasAborted = streamContext.controller.signal.aborted || !endedNaturally
  return { finalMessages, assistantResponse, wasAborted, isLatest: isMyGeneration() }
}

const FRONT_REASSERT_DURATION = 8000
const FRONT_REASSERT_INTERVAL = 100
const FRONT_RELATIVE_LEVEL = 100
const BACKGROUND_GUARD_INTERVAL = 2000
let frontReassertTimer: NodeJS.Timeout | null = null
let backgroundGuardTimer: NodeJS.Timeout | null = null
let isWindowSoftHidden = false
let softHiddenBounds: Rectangle | null = null

/**
 * Reassert always-on-top. `aggressive` also calls moveTop() which
 * brings the window above everything — only use on explicit user actions
 * (show, screenshot, etc.) to avoid disturbing interaction with other apps.
 */
function applyTopMost(win: BrowserWindow, aggressive = true) {
  if (!win || win.isDestroyed()) return
  win.setAlwaysOnTop(true, 'screen-saver', FRONT_RELATIVE_LEVEL)
  if (aggressive) win.moveTop()
}

/**
 * Start a persistent low-frequency background guard that continuously
 * re-asserts always-on-top while the window is visible.
 * Uses the non-aggressive variant so it won't steal focus or
 * interfere with the user's interaction with other windows.
 */
function startBackgroundGuard(window: BrowserWindow) {
  if (backgroundGuardTimer) return // already running
  backgroundGuardTimer = setInterval(() => {
    if (!window || window.isDestroyed() || !window.isVisible()) {
      stopBackgroundGuard()
      return
    }
    applyTopMost(window, false)
  }, BACKGROUND_GUARD_INTERVAL)
}

function stopBackgroundGuard() {
  if (backgroundGuardTimer) {
    clearInterval(backgroundGuardTimer)
    backgroundGuardTimer = null
  }
}

function stopFrontReassert() {
  if (frontReassertTimer) {
    clearInterval(frontReassertTimer)
    frontReassertTimer = null
  }
}

function getOffscreenBounds(window: BrowserWindow): Rectangle {
  const displays = screen.getAllDisplays()
  const maxRight = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width))
  const topMost = Math.min(...displays.map((display) => display.bounds.y))
  const [width, height] = window.getSize()

  return {
    x: maxRight + 2000,
    y: topMost,
    width,
    height
  }
}

function softHideWindow(window: BrowserWindow) {
  if (isWindowSoftHidden || window.isDestroyed()) return

  stopFrontReassert()
  stopBackgroundGuard()
  softHiddenBounds = window.getBounds()
  isWindowSoftHidden = true

  window.setOpacity(0)
  window.setIgnoreMouseEvents(true)
  window.setBounds(getOffscreenBounds(window))
}

function restoreSoftHiddenWindow(window: BrowserWindow) {
  if (!isWindowSoftHidden || !softHiddenBounds || window.isDestroyed()) return

  applyContentProtection(window, true)
  window.setBounds(softHiddenBounds)
  window.setIgnoreMouseEvents(state.ignoreMouse)
  window.setOpacity(1)

  isWindowSoftHidden = false
  softHiddenBounds = null
  keepWindowInFront(window)
}

function showMainWindow(window: BrowserWindow) {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    window.showInactive()
  } else {
    window.show()
  }

  applyContentProtection(window, process.platform === 'win32')
  keepWindowInFront(window)
}

function keepWindowInFront(window: BrowserWindow) {
  if (!window || window.isDestroyed()) return
  if (frontReassertTimer) {
    clearInterval(frontReassertTimer)
    frontReassertTimer = null
  }

  const start = Date.now()
  const reassert = () => {
    if (!window.isVisible() || window.isDestroyed()) return false
    applyTopMost(window)
    return true
  }

  if (!reassert()) return

  // Aggressive burst: rapid reasserts for a short period
  frontReassertTimer = setInterval(() => {
    const shouldStop = Date.now() - start > FRONT_REASSERT_DURATION
    if (shouldStop || !reassert()) {
      if (frontReassertTimer) {
        clearInterval(frontReassertTimer)
        frontReassertTimer = null
      }
    }
  }, FRONT_REASSERT_INTERVAL)

  // Ensure background guard is running for persistent protection
  startBackgroundGuard(window)
}

function abortCurrentStream(reason: AbortReason) {
  if (!currentStreamContext) return
  currentStreamContext.reason = reason
  currentStreamContext.controller.abort()
}

function prepareCoderAction(mainWindow: BrowserWindow): boolean {
  if (!settings.apiKey) return false

  if (isWindowSoftHidden) {
    restoreSoftHiddenWindow(mainWindow)
  } else if (!mainWindow.isVisible()) {
    showMainWindow(mainWindow)
  } else {
    keepWindowInFront(mainWindow)
  }

  ensureWindowExpanded()
  state.inCoderPage = true
  mainWindow.webContents.send('navigate-to-coder')
  return true
}

const callbacks: Record<string, () => void> = {
  hideOrShowMainWindow: async () => {
    const mainWindow = global.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return

    if (process.platform === 'win32') {
      if (isWindowSoftHidden) {
        restoreSoftHiddenWindow(mainWindow)
        return
      }

      if (!mainWindow.isVisible()) {
        showMainWindow(mainWindow)
        return
      }

      softHideWindow(mainWindow)
      return
    }

    if (mainWindow.isVisible()) {
      stopBackgroundGuard()
      mainWindow.hide()
    } else {
      // 重新显示时不断重申置顶属性，抵消其他前台软件持续抢占
      showMainWindow(mainWindow)
    }
  },

  takeScreenshot: async () => {
    const mainWindow = global.mainWindow
    if (!mainWindow || mainWindow.isDestroyed() || !prepareCoderAction(mainWindow)) return

    const myGeneration = ++streamGeneration
    abortCurrentStream('new-request')
    const send = createGenerationSender({ generation: myGeneration, mainWindow })
    const screenshotData = await takeScreenshot()
    if (!isCurrentGeneration(myGeneration)) return
    if (screenshotData && mainWindow && !mainWindow.isDestroyed()) {
      saveScreenshotToDisk(screenshotData)
      const transcriptionText = state.voiceTranscriptionMode ? getTranscriptionText() : ''
      if (transcriptionText) {
        clearTranscriptionText()
        send('transcription-cleared')
      }
      conversationMessages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: transcriptionText
                ? `这是语音转录内容：\n${transcriptionText}\n\n同时附上屏幕截图：`
                : '这是屏幕截图'
            },
            {
              type: 'image',
              image: screenshotData,
              mediaType: 'image/png'
            }
          ]
        }
      ]

      recentScreenshots = [screenshotData]
      hasAppendSeparator = false
      send('solution-clear', true)
      send('screenshots-updated', recentScreenshots)
      send('screenshot-taken', screenshotData)
      send('set-last-response-start-index')
      send('ai-loading-start')

      originalBaseMessages = [...conversationMessages]

      const { finalMessages, assistantResponse, wasAborted, isLatest } = await runSolutionStream(
        conversationMessages,
        {
          streamGetter: (messages, signal) => getSolutionStream(messages, signal),
          mainWindow,
          preprocess: async (messages, streamContext, sendCtx) => {
            if (isCoderPipelineModel(settings.model)) {
              const ocrText = await convertImagesToText(messages, streamContext, sendCtx)
              return toCoderTextMessages(ocrText, transcriptionText)
            }
            return messages
          },
          generation: myGeneration,
          send
        }
      )

      if (isLatest) {
        conversationMessages = finalMessages
        lastBaseConversationMessages = [...conversationMessages]

        if (!wasAborted && assistantResponse) {
          conversationMessages.push({
            role: 'assistant',
            content: assistantResponse
          })
          trimConversationMessages()
          if (isCoderPipelineModel(settings.model)) {
            logCoderPipeline(`Coder result:\n${assistantResponse}`)
          }
        }
      }
    } else {
      send('ai-loading-end')
    }
  },

  // Append screenshot for continuous capture (if conversation exists)
  appendScreenshot: async () => {
    const mainWindow = global.mainWindow
    if (!mainWindow || mainWindow.isDestroyed() || !prepareCoderAction(mainWindow)) return

    // Fallback to first screenshot if no conversation
    if (conversationMessages.length === 0) {
      callbacks.takeScreenshot()
      return
    }

    const myGeneration = ++streamGeneration
    abortCurrentStream('new-request')
    const send = createGenerationSender({ generation: myGeneration, mainWindow })

    const screenshotData = await takeScreenshot()
    if (!isCurrentGeneration(myGeneration)) return
    if (screenshotData && mainWindow && !mainWindow.isDestroyed()) {
      saveScreenshotToDisk(screenshotData)
      const transcriptionText = state.voiceTranscriptionMode ? getTranscriptionText() : ''
      if (transcriptionText) {
        clearTranscriptionText()
        send('transcription-cleared')
      }
      // Append new image message to conversation
      const newUserMessage: ModelMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: transcriptionText
              ? `这是下一部分截图和语音转录内容：\n${transcriptionText}\n请结合之前所有截图和分析，继续分析解答，不要遗漏任何信息。`
              : '这是下一部分截图，请结合之前所有截图和分析，继续分析解答，不要遗漏任何信息。'
          },
          {
            type: 'image',
            image: screenshotData,
            mediaType: 'image/png'
          }
        ]
      }
      conversationMessages.push(newUserMessage)

      recentScreenshots.push(screenshotData)
      recentScreenshots = recentScreenshots.slice(-5) // 限5张
      send('screenshot-taken', screenshotData)
      send('screenshots-updated', recentScreenshots)
      send('solution-chunk', '\n\n')
      hasAppendSeparator = true
      send('set-last-response-start-index')
      send('ai-loading-start')

      originalBaseMessages = [...conversationMessages]

      const { finalMessages, assistantResponse, wasAborted, isLatest } = await runSolutionStream(
        conversationMessages,
        {
          streamGetter: (messages, signal) => getGeneralStream(messages, signal),
          mainWindow,
          preprocess: async (messages, streamContext, sendCtx) => {
            if (isCoderPipelineModel(settings.model)) {
              const ocrText = await convertImagesToText(messages, streamContext, sendCtx)
              return toCoderTextMessages(ocrText, transcriptionText)
            }
            return messages
          },
          generation: myGeneration,
          send
        }
      )

      if (isLatest) {
        conversationMessages = finalMessages
        lastBaseConversationMessages = [...conversationMessages]

        if (!wasAborted && assistantResponse) {
          conversationMessages.push({
            role: 'assistant',
            content: assistantResponse
          })
          trimConversationMessages()
          if (isCoderPipelineModel(settings.model)) {
            logCoderPipeline(`Coder result:\n${assistantResponse}`)
          }
        }
      }
    } else {
      send('ai-loading-end')
    }
  },

  // Stop current AI solution stream
  stopSolutionStream: () => {
    const mainWindow = global.mainWindow
    abortCurrentStream('user')
    if (!mainWindow || mainWindow.isDestroyed() || !state.inCoderPage) return
    mainWindow.webContents.send('stop-transcription-input')
  },

  ignoreOrEnableMouse: () => {
    const mainWindow = global.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return
    state.ignoreMouse = !state.ignoreMouse
    mainWindow.setIgnoreMouseEvents(state.ignoreMouse)
    mainWindow.webContents.send('sync-app-state', state)
  },

  pageUp: () => {
    const mainWindow = global.mainWindow
    if (!mainWindow || mainWindow.isDestroyed() || !state.inCoderPage) return
    mainWindow.webContents.send('scroll-page-up')
  },

  pageDown: () => {
    const mainWindow = global.mainWindow
    if (!mainWindow || mainWindow.isDestroyed() || !state.inCoderPage) return
    mainWindow.webContents.send('scroll-page-down')
  },

  moveMainWindowUp: () => {
    const mainWindow = global.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return
    const [x, y] = mainWindow.getPosition()
    mainWindow.setPosition(x, y - MOVE_STEP)
  },

  moveMainWindowDown: () => {
    const mainWindow = global.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return
    const [x, y] = mainWindow.getPosition()
    mainWindow.setPosition(x, y + MOVE_STEP)
  },

  moveMainWindowLeft: () => {
    const mainWindow = global.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return
    const [x, y] = mainWindow.getPosition()
    mainWindow.setPosition(x - MOVE_STEP, y)
  },

  moveMainWindowRight: () => {
    const mainWindow = global.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return
    const [x, y] = mainWindow.getPosition()
    mainWindow.setPosition(x + MOVE_STEP, y)
  },

  toggleTranscription: () => {
    const mainWindow = global.mainWindow
    if (!mainWindow || mainWindow.isDestroyed() || !state.inCoderPage) return
    mainWindow.webContents.send('toggle-transcription')
  },

  clearTranscription: () => {
    const mainWindow = global.mainWindow
    if (!mainWindow || mainWindow.isDestroyed() || !state.inCoderPage) return
    clearTranscriptionText()
    mainWindow.webContents.send('transcription-cleared')
  },

  toggleWindowCollapsed: () => {
    const mainWindow = global.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return
    toggleWindowCollapsed()
  }
}

function unregisterShortcut(action: string) {
  const shortcut = shortcuts[action]
  if (!shortcut) return
  if (shortcut.registeredKeys.length) {
    shortcut.registeredKeys.forEach((registeredKey) => {
      globalShortcut.unregister(registeredKey)
    })
  } else {
    globalShortcut.unregister(shortcut.key)
  }
  shortcut.status = ShortcutStatus.Available
  shortcut.registeredKeys = []
}

function getShortcutRegistrationKeys(key: string) {
  return [key]
}

function registerShortcut(action: string, key: string) {
  if (shortcuts[action]) {
    unregisterShortcut(action)
  }

  const keysToRegister = getShortcutRegistrationKeys(key)
  const registeredKeys: string[] = []
  keysToRegister.forEach((shortcutKey) => {
    if (globalShortcut.register(shortcutKey, callbacks[action])) {
      registeredKeys.push(shortcutKey)
    }
  })

  shortcuts[action] = {
    action,
    key,
    status: registeredKeys.length ? ShortcutStatus.Registered : ShortcutStatus.Failed,
    registeredKeys
  }
}

ipcMain.handle('getShortcuts', () => shortcuts)

ipcMain.handle('triggerShortcutAction', (_event, action: string) => {
  callbacks[action]?.()
})

ipcMain.handle(
  'initShortcuts',
  (_event, shortcuts: Record<string, { action: string; key: string }>) => {
    Object.entries(shortcuts).forEach(([action, { key }]) => {
      registerShortcut(action, key)
    })
  }
)

ipcMain.handle('updateShortcuts', (_event, _shortcuts: { action: string; key: string }[]) => {
  _shortcuts.forEach((shortcut) => {
    if (shortcuts[shortcut.action]?.key !== shortcut.key) {
      registerShortcut(shortcut.action, shortcut.key)
    }
  })
})

ipcMain.handle('stopSolutionStream', () => {
  if (!currentStreamContext) return false
  abortCurrentStream('user')
  return true
})

ipcMain.handle('sendFollowUpQuestion', async (_event, question: string) => {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed() || !settings.apiKey) {
    return { success: false, error: 'Invalid state' }
  }

  const myGeneration = ++streamGeneration
  abortCurrentStream('new-request')
  const send = createGenerationSender({ generation: myGeneration, mainWindow })

  if (!state.inCoderPage) {
    if (!prepareCoderAction(mainWindow)) {
      return { success: false, error: 'Invalid state' }
    }
  } else {
    ensureWindowExpanded()
  }

  const isNewConversation = conversationMessages.length === 0

  if (isNewConversation) {
    send('solution-clear', true)
    conversationMessages = [
      {
        role: 'user',
        content: [{ type: 'text', text: question }]
      }
    ]
  } else {
    send('solution-chunk', '\n\n---\n\n')
  }

  // Show the user's question in the solution panel without letting Markdown eat code spacing.
  send('solution-chunk', formatUserQuestionForPanel(question))
  send('set-last-response-start-index')
  send('ai-loading-start')

  const messagesForRetry: ModelMessage[] = isNewConversation
    ? [...conversationMessages]
    : [
        ...conversationMessages,
        {
          role: 'user',
          content: [{ type: 'text', text: question }]
        }
      ]

  originalBaseMessages = [...messagesForRetry]

  const { finalMessages, assistantResponse, wasAborted, isLatest } = await runSolutionStream(
    conversationMessages,
    {
      streamGetter: (messages, signal) =>
        isNewConversation
          ? getGeneralStream(messages, signal)
          : getFollowUpStream(messages, question, signal),
      mainWindow,
      generation: myGeneration,
      send
    }
  )

  if (isLatest) {
    lastBaseConversationMessages = [...messagesForRetry]

    if (!wasAborted) {
      conversationMessages = [...messagesForRetry]
      if (assistantResponse) {
        conversationMessages.push({
          role: 'assistant',
          content: assistantResponse
        })
        trimConversationMessages()
      }
    } else {
      conversationMessages = isNewConversation ? [] : [...finalMessages]
    }
  }

  return { success: true }
})

ipcMain.handle('sendNewQuestion', async (_event, question: string) => {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed() || !settings.apiKey) {
    return { success: false, error: 'Invalid state' }
  }

  const myGeneration = ++streamGeneration
  abortCurrentStream('new-request')
  const send = createGenerationSender({ generation: myGeneration, mainWindow })

  if (!state.inCoderPage) {
    if (!prepareCoderAction(mainWindow)) {
      return { success: false, error: 'Invalid state' }
    }
  } else {
    ensureWindowExpanded()
  }

  // Start a brand new conversation: clear history, screenshots, and solution panel.
  conversationMessages = []
  lastBaseConversationMessages = []
  originalBaseMessages = []
  recentScreenshots = []
  send('solution-clear', true)

  conversationMessages = [
    {
      role: 'user',
      content: [{ type: 'text', text: question }]
    }
  ]

  send('solution-chunk', formatUserQuestionForPanel(question))
  send('set-last-response-start-index')
  send('ai-loading-start')

  originalBaseMessages = [...conversationMessages]

  const { finalMessages, assistantResponse, wasAborted, isLatest } = await runSolutionStream(
    conversationMessages,
    {
      streamGetter: (messages, signal) => getGeneralStream(messages, signal),
      mainWindow,
      generation: myGeneration,
      send
    }
  )

  if (isLatest) {
    conversationMessages = finalMessages
    lastBaseConversationMessages = [...conversationMessages]

    if (!wasAborted && assistantResponse) {
      conversationMessages.push({
        role: 'assistant',
        content: assistantResponse
      })
      trimConversationMessages()
    }
  }

  return { success: true }
})

ipcMain.handle('resendWithNewModel', async () => {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed() || !settings.apiKey) {
    return { success: false, error: 'Invalid state' }
  }

  const myGeneration = ++streamGeneration
  abortCurrentStream('new-request')
  const send = createGenerationSender({ generation: myGeneration, mainWindow })

  if (!state.inCoderPage) {
    if (!prepareCoderAction(mainWindow)) {
      return { success: false, error: 'Invalid state' }
    }
  } else {
    ensureWindowExpanded()
  }

  if (originalBaseMessages.length === 0 && lastBaseConversationMessages.length === 0) {
    return { success: false, error: 'No conversation to resend' }
  }

  const hasImages = (messages: ModelMessage[]) => {
    return messages.some(
      (msg) => Array.isArray(msg.content) && msg.content.some((part) => part.type === 'image')
    )
  }

  hasAppendSeparator = false

  send('solution-clear-last-response')
  send('screenshots-updated', recentScreenshots)
  send('set-last-response-start-index')
  send('ai-loading-start')

  const base = originalBaseMessages.length > 0 ? originalBaseMessages : lastBaseConversationMessages
  conversationMessages = [...base]

  const { finalMessages, assistantResponse, wasAborted, isLatest } = await runSolutionStream(
    conversationMessages,
    {
      streamGetter: (messages, signal) => getGeneralStream(messages, signal),
      mainWindow,
      preprocess: async (messages, streamContext, sendCtx) => {
        if (isCoderPipelineModel(settings.model) && hasImages(messages)) {
          const transcriptionText = state.voiceTranscriptionMode ? getTranscriptionText() : ''
          const ocrText = await convertImagesToText(messages, streamContext, sendCtx)
          return toCoderTextMessages(ocrText, transcriptionText)
        }
        return messages
      },
      generation: myGeneration,
      send
    }
  )

  if (isLatest) {
    conversationMessages = finalMessages
    lastBaseConversationMessages = [...conversationMessages]

    if (!wasAborted && assistantResponse) {
      conversationMessages.push({
        role: 'assistant',
        content: assistantResponse
      })
      trimConversationMessages()
    }
  }

  return { success: true }
})
