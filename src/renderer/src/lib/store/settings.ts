import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Settings {
  theme: 'light' | 'dark'
  autoTheme: boolean
  apiBaseURL: string
  apiKey: string
  model: string
  customModels: string[]
  customPrompt: string
  activePromptPresetId: string

  opacity: number
  codeLanguage: string

  screenshotAutoSave: boolean
  screenshotDir: string

  dashscopeApiKey: string
  defaultAudioDeviceId: string
  transcriptionAutoSubmitSeconds: number
}

interface SettingsStore extends Settings {
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  syncSettings: (settings: Partial<Settings>) => void
}

const DEFAULT_VISION_MODEL = 'qwen/qwen3-vl-32b-instruct'

function normalizeScreenshotModel(model?: string) {
  if (model === 'Qwen/Qwen3-VL-32B-Instruct') {
    return 'qwen/qwen3-vl-32b-instruct'
  }
  if (model === 'Qwen/Qwen3-VL-8B-Thinking') {
    return 'qwen/qwen3-vl-8b-thinking'
  }
  if (
    !model ||
    model === 'qwen/qwen3.7-max' ||
    model === 'qwen/qwen3.6-plus' ||
    model === 'qwen/qwen3.6-flash'
  ) {
    return DEFAULT_VISION_MODEL
  }
  if (model === 'xiaomi/mimo-v2-omni') {
    return 'qwen/qwen3-coder'
  }
  return model
}

const defaultSettings: Settings = {
  theme: 'dark',
  autoTheme: false,
  apiBaseURL: '',
  apiKey: '',
  model: DEFAULT_VISION_MODEL,
  customModels: [],
  customPrompt: '',
  activePromptPresetId: 'new-lc',
  codeLanguage: '',

  opacity: 0.8,

  screenshotAutoSave: false,
  screenshotDir: '',

  dashscopeApiKey: '',
  defaultAudioDeviceId: '',
  transcriptionAutoSubmitSeconds: 5
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      updateSetting: (key, value) => {
        set({ [key]: value })
      },
      syncSettings: (settings) => {
        set(settings)
      }
    }),
    {
      name: 'interview-coder-settings',
      version: 12,
      migrate: (state) => ({
        ...(state as Settings),
        theme: (state as Partial<Settings>).theme || 'dark',
        autoTheme: (state as Partial<Settings>).autoTheme || false,
        model: normalizeScreenshotModel((state as Partial<Settings>).model),
        activePromptPresetId: (state as Partial<Settings>).activePromptPresetId || 'new-lc'
      })
    }
  )
)
