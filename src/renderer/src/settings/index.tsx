import { useEffect, useState } from 'react'
import {
  SquareTerminal,
  Palette,
  Bot,
  Eye,
  EyeOff,
  Keyboard,
  FolderOpen,
  Mic,
  MousePointerClick,
  Sun,
  Moon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { useSettingsStore } from '@/lib/store/settings'
import { useAppStore } from '@/lib/store/app'
import { useShortcutsStore } from '@/lib/store/shortcuts'
import { useTranscriptionStore } from '@/lib/store/transcription'
import ShortcutRenderer from '@/components/ShortcutRenderer'
import { SelectLanguage } from './SelectLanguage'
import { CustomShortcuts, ResetDefaultShortcuts } from './CustomShortcuts'

const controlClass =
  'bg-[var(--app-control-bg)] border-[var(--app-control-border)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:ring-2 focus:ring-[var(--app-control-active-bg)]'
const iconButtonClass =
  'border-[var(--app-control-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover-bg)] hover:border-[var(--app-control-border)]'

export default function SettingsPage() {
  const {
    theme,
    autoTheme,
    opacity,
    codeLanguage,
    apiBaseURL,
    apiKey,
    screenshotAutoSave,
    screenshotDir,
    dashscopeApiKey,
    defaultAudioDeviceId,
    transcriptionAutoSubmitSeconds,
    updateSetting
  } = useSettingsStore()
  const { ignoreMouse, setIgnoreMouse, syncAppState } = useAppStore()
  const { shortcuts } = useShortcutsStore()
  const { autoMode, setAutoMode } = useTranscriptionStore()
  const [showApiKey, setShowApiKey] = useState(false)
  const [showDashscopeApiKey, setShowDashscopeApiKey] = useState(false)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])

  const handleIgnoreMouseToggle = (checked: boolean) => {
    setIgnoreMouse(checked)
    window.api.updateAppState({ ignoreMouse: checked })
  }

  useEffect(() => {
    window.api.onSyncAppState((state) => {
      syncAppState(state)
    })
    return () => {
      window.api.removeSyncAppStateListener()
    }
  }, [syncAppState])

  useEffect(() => {
    const enumerateDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioInputDevices = devices.filter((d) => d.kind === 'audioinput')
        setAudioDevices(audioInputDevices)
      } catch (err) {
        console.error('Failed to enumerate audio devices:', err)
      }
    }
    void enumerateDevices()

    const handleDeviceChange = () => {
      void enumerateDevices()
    }
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [])

  return (
    <>
      {/* Settings Content */}
      <div id="app-content" className="flex flex-col gap-4 p-8">
        {/* AI Settings */}
        <div className="bg-[var(--app-panel-bg)] rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Bot className="h-5 w-5 mr-2" />
            AI 设置
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                API Base URL
                <span className="ml-2 text-xs font-light">
                  如硅基流动为 https://api.siliconflow.cn/v1
                </span>
              </label>
              <input
                type="text"
                value={apiBaseURL}
                onChange={(e) => updateSetting('apiBaseURL', e.target.value)}
                className={`w-60 px-3 py-2 rounded-md text-sm border focus:outline-none ${controlClass}`}
                placeholder="可为空，默认使用 OpenAI 的 API"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">API Key</label>
              <div className="flex items-center w-60">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => updateSetting('apiKey', e.target.value)}
                  className={`flex-1 px-3 py-2 rounded-l-md text-sm border focus:outline-none ${controlClass}`}
                  placeholder="输入 API Key"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className={`border border-l-0 rounded-l-none rounded-r-md h-9 w-9 ${iconButtonClass}`}
                >
                  {showApiKey ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
        {/* Transcription Settings */}
        <div className="bg-[var(--app-panel-bg)] rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Mic className="h-5 w-5 mr-2" />
            语音转录
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                百炼平台 API Key
                <span className="ml-2 text-xs font-light">
                  从阿里云
                  <a
                    href="https://bailian.console.aliyun.com/cn-beijing?tab=model#/api-key"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-0.5 text-blue-700 hover:underline"
                  >
                    百炼平台
                  </a>
                  获取，如不需要语音转录功能可跳过
                </span>
              </label>
              <div className="flex items-center w-60">
                <input
                  type={showDashscopeApiKey ? 'text' : 'password'}
                  value={dashscopeApiKey}
                  onChange={(e) => updateSetting('dashscopeApiKey', e.target.value)}
                  className={`flex-1 px-3 py-2 rounded-l-md text-sm border focus:outline-none ${controlClass}`}
                  placeholder="输入百炼平台 API Key"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDashscopeApiKey(!showDashscopeApiKey)}
                  className={`border border-l-0 rounded-l-none rounded-r-md h-9 w-9 ${iconButtonClass}`}
                >
                  {showDashscopeApiKey ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                默认麦克风
                <span className="ml-2 text-xs font-light">选择用于语音转录的音频输入设备</span>
              </label>
              <select
                value={defaultAudioDeviceId}
                onChange={(e) => updateSetting('defaultAudioDeviceId', e.target.value)}
                className={`w-60 px-3 py-2 rounded-md text-sm border focus:outline-none ${controlClass}`}
              >
                <option value="">自动选择（默认）</option>
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `麦克风 ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Auto 模式
                <span className="ml-2 text-xs font-light">
                  开启后，语音转录 {transcriptionAutoSubmitSeconds || 5} 秒无输入自动提交给 AI
                </span>
              </label>
              <div className="w-60 flex items-center justify-end gap-2">
                <span
                  className={`text-xs font-medium tabular-nums ${
                    autoMode ? '' : 'text-[var(--app-text-muted)]'
                  }`}
                >
                  {autoMode ? 'On' : 'Off'}
                </span>
                <Switch
                  checked={autoMode}
                  onCheckedChange={setAutoMode}
                  disabled={!dashscopeApiKey}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                自动提交时间
                <span className="ml-2 text-xs font-light">
                  语音转录多少秒无输入后自动提交给 AI（单位：秒）
                </span>
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={transcriptionAutoSubmitSeconds}
                disabled={!dashscopeApiKey}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  if (!Number.isFinite(val)) return
                  const clamped = Math.max(1, Math.min(120, Math.floor(val)))
                  updateSetting('transcriptionAutoSubmitSeconds', clamped)
                }}
                className={`w-60 px-3 py-2 rounded-md text-sm border focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${controlClass}`}
              />
            </div>
          </div>
        </div>
        <div className="bg-[var(--app-panel-bg)] rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <SquareTerminal className="h-5 w-5 mr-2" />
            解题设置
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">编程语言</label>
              <SelectLanguage
                value={codeLanguage}
                onChange={(value) => updateSetting('codeLanguage', value)}
              />
            </div>
          </div>
        </div>

        {/* Appearance Settings */}
        <div className="bg-[var(--app-panel-bg)] rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Palette className="h-5 w-5 mr-2" />
            外观设置
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                窗口透明度
                <span className="ml-2 text-xs font-light">拖动可实时预览效果</span>
              </label>
              <div className="w-60 flex items-center gap-2">
                <span className="text-xs whitespace-nowrap">透明</span>
                <Slider
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={[opacity]}
                  onValueChange={(value) => {
                    updateSetting('opacity', value[0])
                    document.documentElement.style.setProperty(
                      '--app-bg-opacity',
                      value[0].toString()
                    )
                  }}
                />
                <span className="text-xs whitespace-nowrap">不透明</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                外观模式
                <span className="ml-2 text-xs font-light">
                  {theme === 'dark' ? '暗色调背景，浅色文字' : '浅色背景，深色文字'}
                </span>
              </label>
              <div className="w-60 flex items-center justify-end gap-3">
                <Sun
                  className={theme === 'dark' ? 'h-4 w-4 text-[var(--app-text-muted)]' : 'h-4 w-4'}
                />
                <Switch
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) => {
                    updateSetting('theme', checked ? 'dark' : 'light')
                    if (autoTheme) {
                      updateSetting('autoTheme', false)
                    }
                  }}
                />
                <Moon
                  className={theme === 'light' ? 'h-4 w-4 text-[var(--app-text-muted)]' : 'h-4 w-4'}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Feature Settings */}
        <div className="bg-[var(--app-panel-bg)] rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <MousePointerClick className="h-5 w-5 mr-2" />
            功能设置
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                鼠标穿透
                <span className="ml-2 text-xs font-light">
                  启用后窗口对鼠标穿透，可以点击窗口背后的内容
                </span>
                <ShortcutRenderer
                  shortcut={shortcuts.ignoreOrEnableMouse.key}
                  variant="inline"
                  className="inline-block ml-2 scale-75 text-xs border border-current bg-transparent py-0 px-1"
                />
              </label>
              <div className="w-24 flex items-center justify-end gap-2">
                <span className="text-xs font-medium tabular-nums">
                  {ignoreMouse ? 'On' : 'Off'}
                </span>
                <Switch checked={ignoreMouse} onCheckedChange={handleIgnoreMouseToggle} />
              </div>
            </div>
          </div>
        </div>

        {/* Shortcuts Settings */}
        <div className="bg-[var(--app-panel-bg)] rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Keyboard className="h-5 w-5 mr-2" />
            快捷键设置
            <div className="text-sm font-light ml-2 mt-1">
              只有在主界面时，快捷键才有效。当前页面仅部分快捷键生效。
            </div>
            <ResetDefaultShortcuts />
          </h2>
          <CustomShortcuts />
        </div>

        {/* Screenshot Save Settings */}
        <div className="bg-[var(--app-panel-bg)] rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <FolderOpen className="h-5 w-5 mr-2" />
            保存截图
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                保存截图到本地
                <span className="ml-2 text-xs font-light">
                  开启后，每次截图都会自动保存到指定目录
                </span>
              </label>
              <Switch
                checked={screenshotAutoSave}
                onCheckedChange={(checked) => updateSetting('screenshotAutoSave', checked)}
              />
            </div>
            {screenshotAutoSave && (
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  保存目录
                  <span className="ml-2 text-xs font-light">
                    可点击右侧内容重新选择保存目录（选择弹窗可能被本窗口遮挡）
                  </span>
                </label>
                <button
                  className="text-xs text-[var(--app-text-muted)] max-w-48 truncate hover:text-[var(--app-text)] cursor-pointer transition-colors"
                  title="点击选择保存目录"
                  onClick={async () => {
                    const dir = await window.api.selectScreenshotDir()
                    if (dir) updateSetting('screenshotDir', dir)
                  }}
                >
                  {screenshotDir || '默认: 图片/InterviewCoder'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
