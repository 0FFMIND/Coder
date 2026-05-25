import { useRef } from 'react'
import { OctagonX, Mic, Send } from 'lucide-react'
import { useSolutionStore } from '@/lib/store/solution'
import { useShortcutsStore } from '@/lib/store/shortcuts'
import { useTranscriptionStore } from '@/lib/store/transcription'
import ShortcutRenderer from '@/components/ShortcutRenderer'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { stopAudioCapture } from '@/lib/audio-capture'

export function AppStatusBar() {
  const { isLoading: isReceivingSolution, setIsLoading, setErrorMessage } = useSolutionStore()
  const { shortcuts } = useShortcutsStore()
  const { isTranscribing, transcriptionText, clearText } = useTranscriptionStore()
  const trimmedTranscription = transcriptionText.trim()
  const isSubmittingRef = useRef(false)

  const handleStopGenerating = () => {
    setIsLoading(false)
    void window.api.stopSolutionStream()
  }

  const handleStopTranscription = async () => {
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

  const handleSendTranscription = async () => {
    if (isSubmittingRef.current) return
    const text = trimmedTranscription
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

  const hasTranscription = isTranscribing || trimmedTranscription

  return (
    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center w-full bg-transparent px-4 pb-1 pointer-events-none">
      {hasTranscription ? (
        <div className="pointer-events-auto mb-1 flex max-w-[calc(100vw-2rem)] flex-col items-center gap-1 rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-3 py-2 shadow-lg">
          <div
            className={cn(
              'max-h-[3.25rem] max-w-full overflow-y-auto whitespace-pre-wrap text-center text-xs leading-snug text-[var(--app-text)] [overflow-wrap:anywhere]',
              !trimmedTranscription && 'text-[var(--app-text-muted)]'
            )}
          >
            {trimmedTranscription || '等待语音输入...'}
          </div>
          <div className="flex items-center gap-2">
            {isTranscribing ? (
              <>
                <span className="flex items-center gap-1 text-xs text-[var(--app-text-muted)]">
                  <Mic className="h-3 w-3 text-red-400 animate-pulse" />
                  正在聆听...
                </span>
                <Button
                  variant="secondary"
                  className="h-7 px-3 text-xs shadow-md"
                  onClick={handleStopTranscription}
                >
                  <OctagonX className="w-3.5 h-3.5" />
                  停止
                  <ShortcutRenderer
                    shortcut={shortcuts.toggleTranscription.key}
                    variant="inline"
                    className="inline-block border bg-transparent py-0 px-1"
                  />
                </Button>
              </>
            ) : trimmedTranscription ? (
              <>
                <span className="flex items-center gap-1 text-xs text-[var(--app-text-muted)]">
                  点击发送语音内容
                </span>
                <Button
                  variant="secondary"
                  className="h-7 px-3 text-xs shadow-md"
                  onClick={handleSendTranscription}
                >
                  <Send className="w-3.5 h-3.5" />
                  发送
                </Button>
              </>
            ) : null}
            {isReceivingSolution && (
              <div className="flex items-center gap-1 text-xs text-[var(--app-text-muted)]">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[currentColor]"></div>
                AI 生成中
              </div>
            )}
          </div>
        </div>
      ) : isReceivingSolution ? (
        <div className="flex items-center space-x-2 pointer-events-auto">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-r-2 border-[currentColor] text-[var(--app-text)]"></div>
          <span className="text-sm text-[var(--app-text)]">正在生成...</span>
          <Button
            variant="secondary"
            className="h-8 px-4 text-base shadow-lg"
            onClick={handleStopGenerating}
          >
            <OctagonX className="w-4 h-4" />
            停止生成
            <ShortcutRenderer
              shortcut={shortcuts.stopSolutionStream.key}
              variant="inline"
              className="inline-block border bg-transparent py-0 px-1"
            />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
