import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ipcMain } from 'electron'
import { load } from 'js-yaml'

export type PromptPreset = {
  id: string
  label: string
  prompt: string
  description?: string
}

const defaultPromptPresets: PromptPreset[] = [
  {
    id: 'debug-lc',
    label: 'Debug LC',
    prompt: '',
    description: '截图代码与错误信息，定位 bug 并给出修复方案。'
  },
  {
    id: 'new-lc',
    label: 'New LC',
    prompt: '',
    description: '截图题目，按 LeetCode Python 题解格式输出（新版）。'
  },
  {
    id: 'spoken-lc',
    label: '口述 LC',
    prompt:
      '你是一个编程面试助手。请根据截图和语音转录内容理解题意，先整理并补全口述题目，再给出思路、复杂度和可直接讲给面试官的代码。回答要适合现场口述，语言简洁清晰。'
  },
  {
    id: 'qa',
    label: '问题回答',
    prompt:
      '你是一个面试问答助手。请根据截图和语音转录内容直接回答问题，优先给出结论，再补充关键理由。不要强行输出算法题模板。'
  }
]

function isPromptPreset(value: unknown): value is PromptPreset {
  if (typeof value !== 'object' || value === null) return false
  const preset = value as Partial<PromptPreset>
  return (
    typeof preset.id === 'string' &&
    typeof preset.label === 'string' &&
    typeof preset.prompt === 'string' &&
    (preset.description === undefined || typeof preset.description === 'string')
  )
}

function getConfiguredPromptPresetsFile() {
  return resolve(process.cwd(), process.env.PROMPT_PRESETS_FILE || 'prompt-presets.yml')
}

function loadPromptPresetsFromYaml(): PromptPreset[] | null {
  const filePath = getConfiguredPromptPresetsFile()
  if (!existsSync(filePath)) return null

  const raw = load(readFileSync(filePath, 'utf-8'))
  const presets = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' &&
        raw !== null &&
        Array.isArray((raw as { presets?: unknown }).presets)
      ? (raw as { presets: unknown[] }).presets
      : null

  if (!presets) {
    console.warn(`Invalid prompt presets config: ${filePath}`)
    return null
  }

  const validPresets = presets.filter(isPromptPreset)
  if (!validPresets.length) {
    console.warn(`No valid prompt presets found in: ${filePath}`)
    return null
  }

  return validPresets
}

function getEnvPromptOverride(id: string) {
  const envKey = `PROMPT_PRESET_${id.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`
  return process.env[envKey]
}

export function getPromptPresets(): PromptPreset[] {
  return (loadPromptPresetsFromYaml() || defaultPromptPresets).map((preset) => ({
    ...preset,
    prompt: getEnvPromptOverride(preset.id) ?? preset.prompt
  }))
}

ipcMain.handle('getPromptPresets', () => getPromptPresets())
