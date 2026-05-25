import { useEffect, useRef } from 'react'
import { Mic, OctagonX, Send } from 'lucide-react'
import { useTranscriptionStore } from '@/lib/store/transcription'
import { useShortcutsStore } from '@/lib/store/shortcuts'
import { useSolutionStore } from '@/lib/store/solution'
import ShortcutRenderer from '@/components/ShortcutRenderer'
import { stopAudioCapture } from '@/lib/audio-capture'

export function TranscriptionBar() {
  const { isTranscribing, transcriptionText, clearText } = useTranscriptionStore()
  const { shortcuts } = useShortcutsStore()
  const { setErrorMessage } = useSolutionStore()
  const textRef = useRef<HTMLDivElement>(null)
  const isSubmittingRef = useRef(false)

  useEffect(() => {
    if (textRef.current) {
      textRef.current.scrollTop = textRef.current.scrollHeight
    }
  }, [transcriptionText])

  const handleStopAndSend = async () => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true

    try {
      stopAudioCapture()
      await window.api.stopTranscription()
    } catch (err) {
      console.error('Failed to stop transcription:', err)
    } finally {
      isSubmittingRef.current = false
    }
  }

  const handleSendOnly = async () => {
    if (isSubmittingRef.current) return
    const text = transcriptionText.trim()
    if (!text) return

    isSubmittingRef.current = true
    clearText()
    await window.api.clearTranscriptionText()
    try {
      const result = await window.api.sendFollowUpQuestion(text)
      if (result && !result.success) {
        setErrorMessage(`语音转录提交失败：${result.error}`)
      }
    } catch (err) {
      console.error('Failed to send transcription:', err)
      setErrorMessage('语音转录提交失败，请重试')
    } finally {
      isSubmittingRef.current = false
    }
  }

  if (!isTranscribing && !transcriptionText) return null

  const hasText = transcriptionText.trim().length > 0

  return (
    <div className="mx-4 mt-2 mb-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-3 py-2 shadow-md">
      <div className="flex items-start gap-2">
        <Mic
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isTranscribing ? 'text-red-400 animate-pulse' : 'text-[var(--app-text-muted)]'}`}
        />
        <div
          ref={textRef}
          className="max-h-[4.5em] min-w-0 flex-1 overflow-y-auto text-xs leading-snug text-[var(--app-text)] [overflow-wrap:break-word]"
        >
          {transcriptionText || (
            <span className="text-[var(--app-text-muted)]">等待语音输入...</span>
          )}
        </div>
        {isTranscribing ? (
          <button
            className="ml-2 flex shrink-0 items-center gap-1 rounded border border-current px-2 py-0.5 text-xs text-[var(--app-text)] transition-colors hover:border-[var(--app-toolbar-hover-text,var(--app-toolbar-btn-text))] hover:bg-[var(--app-toolbar-hover-bg)] hover:text-[var(--app-toolbar-hover-text,var(--app-toolbar-btn-text))] [-webkit-app-region:no-drag]!"
            onClick={handleStopAndSend}
            title="停止语音输入并发送"
          >
            <OctagonX className="h-3 w-3" />
            <span>停止</span>
            <ShortcutRenderer
              shortcut={shortcuts.toggleTranscription.key}
              variant="inline"
              className="border bg-transparent px-1 py-0 text-[11px]"
            />
          </button>
        ) : hasText ? (
          <button
            className="ml-2 flex shrink-0 items-center gap-1 rounded border border-current px-2 py-0.5 text-xs text-[var(--app-text)] transition-colors hover:border-[var(--app-toolbar-hover-text,var(--app-toolbar-btn-text))] hover:bg-[var(--app-toolbar-hover-bg)] hover:text-[var(--app-toolbar-hover-text,var(--app-toolbar-btn-text))] [-webkit-app-region:no-drag]!"
            onClick={handleSendOnly}
            title="发送语音内容"
          >
            <Send className="h-3 w-3" />
            <span>发送</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
