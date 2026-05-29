import { useEffect, useRef, useState } from 'react'
import { MessageSquarePlus, Mic, MicOff, PlusCircle, Send, Subtitles } from 'lucide-react'
import ShortcutRenderer from '@/components/ShortcutRenderer'
import { useSettingsStore } from '@/lib/store/settings'
import { useShortcutsStore } from '@/lib/store/shortcuts'
import { useTranscriptionStore } from '@/lib/store/transcription'
import { useSolutionStore } from '@/lib/store/solution'
import { useAppStore } from '@/lib/store/app'
import { startAudioCapture, stopAudioCapture } from '@/lib/audio-capture'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn, getCloneableFields } from '@/lib/utils'

type PromptPreset = {
  id: string
  label: string
  prompt: string
  description?: string
}

type CompactLevel = 0 | 1 | 2 | 3

function getCompactLevel(width: number): CompactLevel {
  if (width >= 760) return 0
  if (width >= 640) return 1
  if (width >= 520) return 2
  return 3
}

const quickModels = [
  { value: 'qwen/qwen3-vl-32b-instruct', label: 'Qwen VL' },
  { value: 'qwen/qwen3-coder', label: 'Qwen Coder' },
  { value: 'openai/chat-latest', label: 'GPT-5.5' }
]

export function CoderToolbar() {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [promptPresets, setPromptPresets] = useState<PromptPreset[]>([])
  const [compactLevel, setCompactLevel] = useState<CompactLevel>(0)
  const {
    activePromptPresetId,
    updateSetting,
    dashscopeApiKey,
    defaultAudioDeviceId,
    model,
    autoTheme
  } = useSettingsStore()
  const { shortcuts } = useShortcutsStore()
  const { isTranscribing, autoMode, setIsTranscribing, setAutoMode, transcriptionText, clearText } =
    useTranscriptionStore()
  const { setErrorMessage, screenshotData, solutionChunks } = useSolutionStore()
  const { subtitleWindowOpen, setSubtitleWindowOpen } = useAppStore()
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false)
  const [followUpText, setFollowUpText] = useState('')
  const isSendingFollowUpRef = useRef(false)
  const [showNewQuestionDialog, setShowNewQuestionDialog] = useState(false)
  const [newQuestionText, setNewQuestionText] = useState('')
  const isSendingNewQuestionRef = useRef(false)

  useEffect(() => {
    const updateCompactLevel = () => {
      const width = toolbarRef.current?.clientWidth ?? window.innerWidth
      setCompactLevel(getCompactLevel(width))
    }

    updateCompactLevel()
    const resizeObserver = new ResizeObserver(updateCompactLevel)
    if (toolbarRef.current) {
      resizeObserver.observe(toolbarRef.current)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    window.api.getPromptPresets().then((presets) => {
      setPromptPresets(presets)
    })
  }, [])

  useEffect(() => {
    const activePreset = promptPresets.find((preset) => preset.id === activePromptPresetId)
    if (activePreset) {
      updateSetting('customPrompt', activePreset.prompt)
    }
  }, [activePromptPresetId, promptPresets, updateSetting])

  const handlePromptPresetClick = async (preset: PromptPreset) => {
    if (activePromptPresetId === preset.id) return
    updateSetting('activePromptPresetId', preset.id)
    updateSetting('customPrompt', preset.prompt)
    await window.api.updateAppSettings(getCloneableFields(useSettingsStore.getState()))
    if (screenshotData || solutionChunks.length > 0) {
      try {
        const result = await window.api.resendWithNewModel()
        if (result && !result.success) {
          setErrorMessage(`切换提示词失败：${result.error}`)
        }
      } catch (err) {
        console.error('Failed to resend with new prompt:', err)
        setErrorMessage('切换提示词失败，请重试')
      }
    }
  }

  const handleToggleTranscription = async () => {
    if (isTranscribing) {
      stopAudioCapture()
      await window.api.stopTranscription()
      setIsTranscribing(false)
      const text = transcriptionText.trim()
      if (text) {
        clearText()
        try {
          await window.api.sendFollowUpQuestion(text)
        } catch (err) {
          console.error('Failed to send transcription as follow-up:', err)
          setErrorMessage('语音转录提交失败，请重试')
        }
      }
    } else {
      if (!dashscopeApiKey) {
        setErrorMessage('请先在设置中配置百炼平台 API Key')
        return
      }
      try {
        await startAudioCapture(defaultAudioDeviceId || undefined)
        await window.api.startTranscription(dashscopeApiKey)
        setIsTranscribing(true)
        setErrorMessage(null)
      } catch (err) {
        console.error('Failed to start transcription:', err)
        stopAudioCapture()
        setErrorMessage('启动语音转录失败，请检查系统音频权限')
      }
    }
  }

  const handleModelChange = async (newModel: string) => {
    if (model === newModel) return
    updateSetting('model', newModel)
    await window.api.updateAppSettings(getCloneableFields(useSettingsStore.getState()))
    if (screenshotData || solutionChunks.length > 0) {
      try {
        const result = await window.api.resendWithNewModel()
        if (result && !result.success) {
          setErrorMessage(`切换模型失败：${result.error}`)
        }
      } catch (err) {
        console.error('Failed to resend with new model:', err)
        setErrorMessage('切换模型失败，请重试')
      }
    }
  }

  const handleToggleAutoTheme = async () => {
    const nextAutoTheme = !autoTheme
    updateSetting('autoTheme', nextAutoTheme)
    await window.api.updateAppSettings(getCloneableFields(useSettingsStore.getState()))
  }

  const handleToggleSubtitle = async () => {
    const nextState = !subtitleWindowOpen
    try {
      const result = await window.api.toggleSubtitleWindow(nextState)
      setSubtitleWindowOpen(result)
    } catch (err) {
      console.error('Failed to toggle subtitle window:', err)
      setErrorMessage('切换字幕窗口失败，请重试')
    }
  }

  const handleFollowUpClick = () => {
    setFollowUpText('')
    setShowFollowUpDialog(true)
  }

  const handleFollowUpOpenChange = (open: boolean) => {
    setShowFollowUpDialog(open)
  }

  const handleSendFollowUp = async () => {
    const text = followUpText.trim()
    if (!text || isSendingFollowUpRef.current) return
    isSendingFollowUpRef.current = true
    setShowFollowUpDialog(false)
    setFollowUpText('')
    try {
      const result = await window.api.sendFollowUpQuestion(text)
      if (result && !result.success) {
        setErrorMessage(`追加提问提交失败：${result.error}`)
      }
    } catch (err) {
      console.error('Failed to send follow-up question:', err)
      setErrorMessage('追加提问提交失败，请重试')
    } finally {
      isSendingFollowUpRef.current = false
    }
  }

  const handleFollowUpKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!followUpText.trim()) {
        setShowFollowUpDialog(false)
        return
      }
      void handleSendFollowUp()
    }
  }

  const handleNewQuestionClick = () => {
    setNewQuestionText('')
    setShowNewQuestionDialog(true)
  }

  const handleNewQuestionOpenChange = (open: boolean) => {
    setShowNewQuestionDialog(open)
  }

  const handleSendNewQuestion = async () => {
    const text = newQuestionText.trim()
    if (!text || isSendingNewQuestionRef.current) return
    isSendingNewQuestionRef.current = true
    setShowNewQuestionDialog(false)
    setNewQuestionText('')
    try {
      const result = await window.api.sendNewQuestion(text)
      if (result && !result.success) {
        setErrorMessage(`新建提问提交失败：${result.error}`)
      }
    } catch (err) {
      console.error('Failed to send new question:', err)
      setErrorMessage('新建提问提交失败，请重试')
    } finally {
      isSendingNewQuestionRef.current = false
    }
  }

  const handleNewQuestionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!newQuestionText.trim()) {
        setShowNewQuestionDialog(false)
        return
      }
      void handleSendNewQuestion()
    }
  }

  return (
    <div
      ref={toolbarRef}
      className="flex w-full max-w-full min-w-0 flex-col gap-1 overflow-x-hidden text-xs leading-none text-[var(--app-text)]"
    >
      <div
        className={cn(
          'flex items-center flex-nowrap overflow-x-hidden',
          compactLevel >= 2 ? 'gap-1.5' : 'gap-3'
        )}
      >
        <div className={cn('flex items-center shrink-0', compactLevel >= 2 ? 'gap-1' : 'gap-2')}>
          {compactLevel === 0 && (
            <span className="text-[var(--app-toolbar-label-text)] shrink-0">常用快捷键</span>
          )}
          <ToolbarShortcut
            compactLevel={compactLevel}
            label={compactLevel >= 2 ? '' : '截图分析'}
            shortcut={shortcuts.takeScreenshot.key}
            onClick={() => window.api.triggerShortcutAction('takeScreenshot')}
          />
          <ToolbarShortcut
            compactLevel={compactLevel}
            label={compactLevel >= 2 ? '' : '追加截图'}
            shortcut={shortcuts.appendScreenshot.key}
            hideAlt
            onClick={() => window.api.triggerShortcutAction('appendScreenshot')}
          />
        </div>

        <div className={cn('flex items-center shrink-0', compactLevel >= 2 ? 'gap-1' : 'gap-2')}>
          {compactLevel === 0 && (
            <span className="text-[var(--app-toolbar-label-text)] shrink-0">本次提示词</span>
          )}
          <div className="flex items-center gap-1">
            {promptPresets.map((preset) => (
              <button
                key={preset.id}
                className={cn(
                  'rounded border px-2 py-0.5 text-xs transition-colors [-webkit-app-region:no-drag]! shrink-0 whitespace-nowrap',
                  activePromptPresetId === preset.id
                    ? 'border-[var(--app-border)] bg-[var(--app-toolbar-active-bg)] text-[var(--app-toolbar-btn-text)]'
                    : 'border-current bg-transparent text-[var(--app-text)] hover:bg-[var(--app-toolbar-hover-bg)] hover:text-[var(--app-toolbar-hover-text,var(--app-toolbar-btn-text))]'
                )}
                onClick={() => handlePromptPresetClick(preset)}
                title={preset.description}
              >
                {compactLevel >= 1 ? getCompactPresetLabel(preset.label) : preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={cn(
          'flex items-center flex-nowrap overflow-x-hidden',
          compactLevel >= 2 ? 'gap-1' : 'gap-2'
        )}
      >
        {compactLevel === 0 && (
          <span className="text-[var(--app-toolbar-label-text)] shrink-0">模型</span>
        )}
        <div className="flex items-center gap-1">
          {quickModels.map((m) => (
            <button
              key={m.value}
              className={cn(
                'rounded border py-0.5 text-xs transition-colors [-webkit-app-region:no-drag]! shrink-0 whitespace-nowrap',
                compactLevel >= 3 ? 'px-1.5' : 'px-2',
                model === m.value
                  ? 'border-[var(--app-border)] bg-[var(--app-toolbar-active-bg)] text-[var(--app-toolbar-btn-text)]'
                  : 'border-current bg-transparent text-[var(--app-text)] hover:bg-[var(--app-toolbar-hover-bg)] hover:text-[var(--app-toolbar-hover-text,var(--app-toolbar-btn-text))]'
              )}
              onClick={() => handleModelChange(m.value)}
              title={m.value}
            >
              {compactLevel > 2 ? getCompactModelLabel(m.label) : m.label}
            </button>
          ))}
        </div>
        <div className="ml-1 flex items-center gap-1 shrink-0">
          {compactLevel === 0 && (
            <span className="text-[var(--app-toolbar-label-text)] shrink-0">自动变色</span>
          )}
          <button
            className={cn(
              'flex items-center gap-1 rounded border py-0.5 text-xs transition-colors [-webkit-app-region:no-drag]! shrink-0 whitespace-nowrap',
              compactLevel >= 3 ? 'px-1.5' : 'px-2',
              autoTheme
                ? 'border-[var(--app-border)] bg-[var(--app-toolbar-active-bg)] text-[var(--app-toolbar-btn-text)]'
                : 'border-current bg-transparent text-[var(--app-text)] hover:bg-[var(--app-toolbar-hover-bg)] hover:text-[var(--app-toolbar-hover-text,var(--app-toolbar-btn-text))]'
            )}
            onClick={handleToggleAutoTheme}
            title={autoTheme ? '点击关闭自动变色' : '点击开启自动变色'}
          >
            <span>变色</span>
            {compactLevel < 3 && <span>{autoTheme ? 'on' : 'off'}</span>}
          </button>
        </div>
      </div>

      <div
        className={cn(
          'flex items-center flex-nowrap overflow-x-hidden',
          compactLevel >= 2 ? 'gap-1' : 'gap-2'
        )}
      >
        <VoiceControls
          compactLevel={compactLevel}
          isTranscribing={isTranscribing}
          autoMode={autoMode}
          onToggleTranscription={handleToggleTranscription}
          onToggleAutoMode={() => setAutoMode(!autoMode)}
        />
        <button
          className={cn(
            'flex items-center gap-1 rounded border py-0.5 text-xs transition-colors [-webkit-app-region:no-drag]! shrink-0 whitespace-nowrap',
            compactLevel >= 3 ? 'px-1.5' : 'px-2',
            subtitleWindowOpen
              ? 'border-[var(--app-border)] bg-[var(--app-toolbar-active-bg)] text-[var(--app-toolbar-btn-text)]'
              : 'border-current bg-transparent text-[var(--app-text)] hover:bg-[var(--app-toolbar-hover-bg)] hover:text-[var(--app-toolbar-hover-text,var(--app-toolbar-btn-text))]'
          )}
          onClick={handleToggleSubtitle}
          title={subtitleWindowOpen ? '关闭字幕窗口' : '开启字幕窗口'}
        >
          <Subtitles className="w-3 h-3" />
          {compactLevel < 3 && <span>{subtitleWindowOpen ? '字幕开' : '字幕关'}</span>}
        </button>
        <button
          className={cn(
            'flex items-center gap-1 rounded border border-current py-0.5 text-xs whitespace-nowrap transition-colors hover:bg-[var(--app-toolbar-hover-bg)] hover:text-[var(--app-toolbar-hover-text,var(--app-toolbar-btn-text))] hover:border-[var(--app-toolbar-hover-text,var(--app-toolbar-btn-text))] [-webkit-app-region:no-drag]! shrink-0',
            compactLevel >= 3 ? 'px-1.5' : 'px-2'
          )}
          onClick={handleNewQuestionClick}
          title="新建提问（开启全新对话）"
        >
          <PlusCircle className="w-3 h-3" />
          {compactLevel < 2 ? <span>新建提问</span> : <span>新建</span>}
        </button>
        <button
          className={cn(
            'flex items-center gap-1 rounded border border-current py-0.5 text-xs whitespace-nowrap transition-colors hover:bg-[var(--app-toolbar-hover-bg)] hover:text-[var(--app-toolbar-hover-text,var(--app-toolbar-btn-text))] hover:border-[var(--app-toolbar-hover-text,var(--app-toolbar-btn-text))] [-webkit-app-region:no-drag]! shrink-0',
            compactLevel >= 3 ? 'px-1.5' : 'px-2'
          )}
          onClick={handleFollowUpClick}
          title="追加提问"
        >
          <MessageSquarePlus className="w-3 h-3" />
          {compactLevel < 2 ? <span>追加提问</span> : <span>追加</span>}
        </button>
      </div>

      <Dialog open={showFollowUpDialog} onOpenChange={handleFollowUpOpenChange}>
        <DialogContent
          showCloseButton
          className="max-w-md p-4 gap-3 [-webkit-app-region:no-drag]"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="gap-1">
            <DialogTitle className="text-base">追加提问</DialogTitle>
          </DialogHeader>
          <Textarea
            value={followUpText}
            onChange={(e) => setFollowUpText(e.target.value)}
            onKeyDown={handleFollowUpKeyDown}
            autoFocus
            placeholder="输入或粘贴问题，按 Enter 发送，Shift+Enter 换行"
            className="min-h-[4rem] resize-y"
          />
          <DialogFooter className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Enter 发送 · Shift+Enter 换行</span>
            <Button
              size="sm"
              onClick={() => void handleSendFollowUp()}
              disabled={!followUpText.trim() || isSendingFollowUpRef.current}
            >
              <Send className="mr-1 h-4 w-4" />
              发送
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewQuestionDialog} onOpenChange={handleNewQuestionOpenChange}>
        <DialogContent
          showCloseButton
          className="max-w-md p-4 gap-3 [-webkit-app-region:no-drag]"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="gap-1">
            <DialogTitle className="text-base">新建提问</DialogTitle>
            <p className="text-xs text-muted-foreground">
              将开启一个全新对话，之前的截图和对话历史会被清空。
            </p>
          </DialogHeader>
          <Textarea
            value={newQuestionText}
            onChange={(e) => setNewQuestionText(e.target.value)}
            onKeyDown={handleNewQuestionKeyDown}
            autoFocus
            placeholder="输入或粘贴问题，按 Enter 发送，Shift+Enter 换行"
            className="min-h-[4rem] resize-y"
          />
          <DialogFooter className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Enter 发送 · Shift+Enter 换行</span>
            <Button
              size="sm"
              onClick={() => void handleSendNewQuestion()}
              disabled={!newQuestionText.trim() || isSendingNewQuestionRef.current}
            >
              <Send className="mr-1 h-4 w-4" />
              发送
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function VoiceControls({
  compactLevel,
  isTranscribing,
  autoMode,
  onToggleTranscription,
  onToggleAutoMode
}: {
  compactLevel: CompactLevel
  isTranscribing: boolean
  autoMode: boolean
  onToggleTranscription: () => void
  onToggleAutoMode: () => void
}) {
  return (
    <div className={cn('flex items-center shrink-0', compactLevel >= 2 ? 'gap-1' : 'gap-2')}>
      {compactLevel < 3 && (
        <span className="text-[var(--app-toolbar-label-text)] shrink-0">语音</span>
      )}
      <button
        className={cn(
          'flex items-center gap-1 rounded border py-0.5 text-xs transition-colors [-webkit-app-region:no-drag]! shrink-0',
          compactLevel >= 3 ? 'px-1.5' : 'px-2',
          isTranscribing
            ? 'border-[var(--app-border)] bg-[var(--app-toolbar-active-bg)] text-[var(--app-toolbar-btn-text)]'
            : 'border-current bg-transparent text-[var(--app-text)] hover:bg-[var(--app-toolbar-hover-bg)] hover:text-[var(--app-toolbar-hover-text,var(--app-toolbar-btn-text))]'
        )}
        onClick={onToggleTranscription}
        title={isTranscribing ? '点击关闭语音转录' : '点击开启语音转录'}
      >
        {isTranscribing ? (
          <>
            <Mic className="w-3 h-3" />
            {compactLevel < 3 && <span>on</span>}
          </>
        ) : (
          <>
            <MicOff className="w-3 h-3" />
            {compactLevel < 3 && <span>off</span>}
          </>
        )}
      </button>
      <button
        className={cn(
          'flex items-center gap-1 rounded border py-0.5 text-xs transition-colors [-webkit-app-region:no-drag]! shrink-0 whitespace-nowrap',
          compactLevel >= 3 ? 'px-1.5' : 'px-2',
          autoMode
            ? 'border-[var(--app-border)] bg-[var(--app-toolbar-active-bg)] text-[var(--app-toolbar-btn-text)]'
            : 'border-current bg-transparent text-[var(--app-text)] hover:bg-[var(--app-toolbar-hover-bg)] hover:text-[var(--app-toolbar-hover-text,var(--app-toolbar-btn-text))]'
        )}
        onClick={onToggleAutoMode}
        title={autoMode ? '点击关闭自动提交转录' : '点击开启自动提交转录'}
      >
        <span>auto</span>
        {compactLevel < 3 && <span>{autoMode ? 'on' : 'off'}</span>}
      </button>
    </div>
  )
}

function getCompactPresetLabel(label: string) {
  if (/debug/i.test(label)) return 'Debug'
  if (/new/i.test(label)) return 'New'
  if (label.includes('问题回答')) return '问题'
  return label
}

function getCompactModelLabel(label: string) {
  if (label === 'Qwen VL') return 'VL'
  if (label === 'Qwen Coder') return 'Coder'
  return label
}

function ToolbarShortcut({
  compactLevel,
  label,
  shortcut,
  hideAlt,
  onClick
}: {
  compactLevel: CompactLevel
  label: string
  shortcut?: string
  hideAlt?: boolean
  onClick: () => void
}) {
  const displayShortcut =
    hideAlt && shortcut ? shortcut.replace(/Alt\+|CommandOrControl\+/g, '') : shortcut
  return (
    <button
      className={cn(
        'flex items-center gap-1 shrink-0 rounded border border-current py-0.5 whitespace-nowrap transition-colors hover:bg-[var(--app-toolbar-hover-bg)] hover:text-[var(--app-toolbar-hover-text,var(--app-toolbar-btn-text))] hover:border-[var(--app-toolbar-hover-text,var(--app-toolbar-btn-text))] [-webkit-app-region:no-drag]!',
        compactLevel >= 2 ? 'px-1' : 'px-2'
      )}
      onClick={onClick}
    >
      {label && <span>{label}</span>}
      {displayShortcut && (
        <ShortcutRenderer
          shortcut={displayShortcut}
          variant="inline"
          className="shrink-0 px-1 py-0 text-[11px]"
        />
      )}
    </button>
  )
}
