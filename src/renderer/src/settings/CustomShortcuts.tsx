import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import ShortcutRenderer from '@/components/ShortcutRenderer'
import { isModifierKey, getShortcutAccelerator } from '@/lib/utils/keyboard'
import { useShortcutsStore } from '@/lib/store/shortcuts'
import { useSettingsStore } from '@/lib/store/settings'

const ShortcutsContext = createContext<{
  recordingAction: string | null
  setRecordingAction: (action: string | null) => void
}>({
  recordingAction: null,
  setRecordingAction: () => {}
})

export function CustomShortcuts() {
  const { shortcuts, updateShortcut } = useShortcutsStore()
  const { dashscopeApiKey } = useSettingsStore()
  const [recordingAction, setRecordingAction] = useState<string | null>(null)

  const onShortcutChange = useCallback(
    (action: string, key: string) => {
      const newShortcut = { ...shortcuts[action], key }
      updateShortcut(action, newShortcut)
      window.api.updateShortcuts([newShortcut])
    },
    [shortcuts, updateShortcut]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!recordingAction) return

      e.preventDefault()

      if (isModifierKey(e.code)) return
      const accelerator = getShortcutAccelerator(e)
      // User press escape to cancel recording.
      if (e.code === 'Escape' && !accelerator) {
        setRecordingAction(null)
      }
      if (!accelerator) return
      onShortcutChange(recordingAction, accelerator)
      setRecordingAction(null)
    },
    [recordingAction, onShortcutChange]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return (
    <ShortcutsContext.Provider value={{ recordingAction, setRecordingAction }}>
      <div className="space-y-4">
        {/* Window Management */}
        <div className="space-y-2">
          <h3 className="text-sm text-[var(--app-text-muted)]">窗口管理</h3>
          <Shortcut label="隐藏/显示窗口" shortcut="hideOrShowMainWindow" />
          <Shortcut
            label="折叠/展开窗口"
            description="折叠或展开窗口，与点击标题栏的 - 按钮功能相同"
            shortcut="toggleWindowCollapsed"
          />
        </div>

        {/* Screenshot & AI */}
        <div className="space-y-2">
          <h3 className="text-sm text-[var(--app-text-muted)]">截图与AI</h3>
          <Shortcut
            label="截图"
            description="截图并生成解题建议（会新开对话）"
            shortcut="takeScreenshot"
          />
          <Shortcut
            label="追加截图"
            description="在当前对话中追加截图并生成解题建议，适用于长题目等场景"
            shortcut="appendScreenshot"
          />
          <Shortcut
            label="停止生成"
            description="打断当前正在生成的解题建议"
            shortcut="stopSolutionStream"
          />
          <Shortcut
            label="语音转录"
            description="开始/暂停实时语音转录"
            shortcut="toggleTranscription"
            disabled={!dashscopeApiKey}
          />
          <Shortcut
            label="清除转录文本"
            description="清除已转录的文本（不会提交给AI）"
            shortcut="clearTranscription"
            disabled={!dashscopeApiKey}
          />
        </div>

        {/* Navigation */}
        <div className="space-y-2">
          <h3 className="text-sm text-[var(--app-text-muted)]">页面导航</h3>
          <Shortcut label="向上翻页" shortcut="pageUp" />
          <Shortcut label="向下翻页" shortcut="pageDown" />
        </div>

        {/* Window Movement */}
        <div className="space-y-2">
          <h3 className="text-sm text-[var(--app-text-muted)]">窗口移动</h3>
          <Shortcut label="向上移动窗口" shortcut="moveMainWindowUp" />
          <Shortcut label="向下移动窗口" shortcut="moveMainWindowDown" />
          <Shortcut label="向左移动窗口" shortcut="moveMainWindowLeft" />
          <Shortcut label="向右移动窗口" shortcut="moveMainWindowRight" />
        </div>
      </div>
    </ShortcutsContext.Provider>
  )
}

function Shortcut({
  label,
  description,
  shortcut: shortcutAction,
  disabled
}: {
  label: string
  description?: string
  shortcut: string
  disabled?: boolean
}) {
  const { shortcuts } = useShortcutsStore()
  const { recordingAction, setRecordingAction } = useContext(ShortcutsContext)
  const shortcut = shortcuts[shortcutAction]
  const isRecording = recordingAction === shortcutAction

  return shortcut ? (
    <div
      className={`flex items-center justify-between${disabled ? ' opacity-40 pointer-events-none' : ''}`}
    >
      <div className="flex gap-2 items-center">
        <label className="text-sm font-medium">{label}</label>
        {description && <p className="text-xs font-light">{description}</p>}
      </div>
      <span
        className="cursor-pointer"
        onClick={() => setRecordingAction(isRecording ? null : shortcutAction)}
      >
        {!isRecording ? (
          <ShortcutRenderer shortcut={shortcut.key} />
        ) : (
          <span className="font-mono text-sm align-middle rounded-md border border-[var(--app-control-border)] bg-[var(--app-control-bg)] pl-2 pr-1 py-1 transition-colors animate-pulse">
            请按下自定义快捷键...
          </span>
        )}
      </span>
    </div>
  ) : null
}

export function ResetDefaultShortcuts() {
  const { shortcuts, resetShortcuts } = useShortcutsStore()
  return (
    <Button
      variant="outline"
      size="sm"
      className="ml-auto border-[var(--app-control-border)] bg-[var(--app-control-bg)] text-[var(--app-text)] hover:bg-[var(--app-control-hover-bg)]"
      onClick={async () => {
        await window.api.updateShortcuts(
          Object.values(shortcuts)
            .filter(({ key, defaultKey }) => key !== defaultKey)
            .map((shortcut) => ({
              ...shortcut,
              key: shortcut.defaultKey
            }))
        )
        resetShortcuts()
        toast.success('重置默认快捷键成功')
      }}
    >
      重置默认快捷键
    </Button>
  )
}
