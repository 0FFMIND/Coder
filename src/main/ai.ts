import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { streamText, type ModelMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { settings, AppSettings } from './settings'

export const PROMPT_SYSTEM = readFileSync(join(import.meta.dirname, 'prompts.md'), 'utf-8').trim()
export const OCR_MODEL = 'qwen/qwen3-vl-32b-instruct'
export const CODER_PIPELINE_MODEL = 'qwen/qwen3-coder'
export const GLM_4_6V_MODEL = 'z-ai/glm-4.6v'
export const GLM_5V_TURBO_MODEL = 'z-ai/glm-5v-turbo'
export const GLM_TURBO_PIPELINE = 'z-ai/glm-turbo'
const FIRST_TEXT_TIMEOUT_MS = 25_000
const THINKING_MODEL_FIRST_TEXT_TIMEOUT_MS = 75_000

const OCR_SYSTEM_PROMPT = `
你是一个截图转结构化文本助手。你只负责识别截图内容，不要解题。

请从截图中提取以下信息，能看到多少写多少：
1. 题目标题
2. 题目描述
3. 示例与约束
4. 用户当前代码，尽量保留缩进和符号
5. 错误信息、测试用例、运行结果

要求：
- 不要修复代码。
- 不要给出解题建议。
- 看不清或不确定的内容请标注“看不清”或“不确定”。
- 输出为清晰的 Markdown 文本。
`.trim()

function processPromptWithLanguage(prompt: string, language: string): string {
  return prompt.replace(/\{\{language\}\}/g, language)
}

function getPrimaryModel(_settings: AppSettings): string {
  const model = _settings.model
  if (isCoderPipelineModel(model)) {
    return getPipelineCoderModel(model)
  }
  const fallbackModel = _settings.apiBaseURL.includes('siliconflow')
    ? 'Qwen/Qwen3-VL-32B-Instruct'
    : 'gpt-5-mini'
  return model || fallbackModel
}

export function isCoderPipelineModel(model: string) {
  const m = model.toLowerCase()
  return m === CODER_PIPELINE_MODEL || m === GLM_TURBO_PIPELINE
}

export function getPipelineOcrModel(model: string): string {
  if (model.toLowerCase() === GLM_TURBO_PIPELINE) return GLM_4_6V_MODEL
  return OCR_MODEL
}

export function getPipelineCoderModel(model: string): string {
  if (model.toLowerCase() === GLM_TURBO_PIPELINE) return GLM_5V_TURBO_MODEL
  return model
}

function isUnsupportedModelError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const apiError = error as Error & { statusCode?: number; responseBody?: string }
  const status = apiError.statusCode
  const body = apiError.responseBody ?? ''
  if (status === 404 || status === 429 || status === 400) return true
  if (/model.*not.*(found|available|support)/i.test(body)) return true
  if (/does not exist|invalid model|unsupported model|unavailable model/i.test(body)) return true
  return false
}

function getFirstTextTimeoutMs(modelName: string) {
  return /thinking/i.test(modelName) ? THINKING_MODEL_FIRST_TEXT_TIMEOUT_MS : FIRST_TEXT_TIMEOUT_MS
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

async function nextWithTimeout<T>(
  iterator: AsyncIterator<T>,
  timeoutMs: number,
  modelName: string
): Promise<IteratorResult<T>> {
  if (timeoutMs <= 0) return iterator.next()

  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      iterator.next(),
      new Promise<IteratorResult<T>>((_, reject) => {
        timeout = setTimeout(() => {
          reject(
            new Error(
              `模型 ${modelName} 在 ${Math.round(timeoutMs / 1000)} 秒内没有返回任何文本，请稍后重试或切换模型。`
            )
          )
        }, timeoutMs)
      })
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function* streamWithFallback(
  messages: ModelMessage[],
  systemPrompt: string,
  primaryModel: string,
  abortSignal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const fallbackModel = settings.fallbackModel
  const openai = createOpenAI({
    baseURL: settings.apiBaseURL,
    apiKey: settings.apiKey
  })

  const tryStream = async (modelName: string) => {
    return streamText({
      model: openai.chat(modelName),
      system: systemPrompt,
      messages,
      abortSignal
    })
  }

  let streamEnded = false
  let fallbackTriggered = false
  let currentStream = await tryStream(primaryModel)
  let currentModelName = primaryModel

  while (!streamEnded) {
    try {
      console.info(`AI stream started: model=${currentModelName}`)
      let hasText = false
      const iterator = currentStream.fullStream[Symbol.asyncIterator]()
      while (true) {
        const { value: part, done } = await nextWithTimeout(
          iterator,
          hasText ? 0 : getFirstTextTimeoutMs(currentModelName),
          currentModelName
        )
        if (done) break
        if (abortSignal?.aborted) return
        if (part.type === 'text-delta') {
          if (!hasText) {
            console.info(`AI first text received: model=${currentModelName}`)
          }
          hasText = true
          yield part.text
        }
        if (part.type === 'error') {
          console.error(`AI stream error part: model=${currentModelName}`, part.error)
          throw part.error
        }
        if (part.type === 'finish') {
          console.info(`AI stream finished: model=${currentModelName}, reason=${part.finishReason}`)
          console.info(
            `AI stream finish detail: model=${currentModelName}, totalUsage=${safeStringify(
              part.totalUsage
            )}`
          )
        } else if (part.type !== 'text-delta') {
          console.info(
            `AI stream part: model=${currentModelName}, type=${part.type}, data=${safeStringify(
              part
            )}`
          )
        }
      }
      streamEnded = true
    } catch (error) {
      if (abortSignal?.aborted) throw error
      if (
        !fallbackTriggered &&
        fallbackModel &&
        fallbackModel !== primaryModel &&
        isUnsupportedModelError(error)
      ) {
        console.warn(
          `Model ${primaryModel} 不可用，自动回退到 ${fallbackModel}`
        )
        fallbackTriggered = true
        currentModelName = fallbackModel
        currentStream = await tryStream(fallbackModel)
        continue
      }
      throw error
    }
  }
}

export function getSolutionStream(messages: ModelMessage[], abortSignal?: AbortSignal) {
  const systemPrompt = settings.customPrompt
    ? processPromptWithLanguage(settings.customPrompt, settings.codeLanguage) +
      `\n使用编程语言：${settings.codeLanguage} 解答。`
    : PROMPT_SYSTEM + `\n使用编程语言：${settings.codeLanguage} 解答。`

  return streamWithFallback(messages, systemPrompt, getPrimaryModel(settings), abortSignal)
}

export function getScreenshotTextStream(messages: ModelMessage[], abortSignal?: AbortSignal, ocrModel?: string) {
  return streamWithFallback(messages, OCR_SYSTEM_PROMPT, ocrModel || OCR_MODEL, abortSignal)
}

export function getFollowUpStream(
  messages: ModelMessage[],
  userQuestion: string,
  abortSignal?: AbortSignal
) {
  const updatedMessages: ModelMessage[] = [
    ...messages,
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: userQuestion
        }
      ]
    }
  ]

  const systemPrompt = settings.customPrompt
    ? processPromptWithLanguage(settings.customPrompt, settings.codeLanguage) +
      `\n使用编程语言：${settings.codeLanguage} 解答。`
    : PROMPT_SYSTEM + `\n使用编程语言：${settings.codeLanguage} 解答。`

  return streamWithFallback(
    updatedMessages,
    systemPrompt,
    getPrimaryModel(settings),
    abortSignal
  )
}

export function getGeneralStream(messages: ModelMessage[], abortSignal?: AbortSignal) {
  const systemPrompt = settings.customPrompt
    ? processPromptWithLanguage(settings.customPrompt, settings.codeLanguage) +
      `\n使用编程语言：${settings.codeLanguage} 解答。\n\n注意：如果有多张截图，请结合所有截图内容进行完整分析，不要遗漏任何部分。`
    : PROMPT_SYSTEM +
      `\n使用编程语言：${settings.codeLanguage} 解答。\n\n注意：如果有多张截图，请结合所有截图内容进行完整分析，不要遗漏任何部分。`

  return streamWithFallback(messages, systemPrompt, getPrimaryModel(settings), abortSignal)
}
