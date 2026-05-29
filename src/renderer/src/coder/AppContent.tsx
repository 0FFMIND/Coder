import { useShortcutsStore } from '@/lib/store/shortcuts'
import { useSolutionStore } from '@/lib/store/solution'
import { useTranscriptionStore } from '@/lib/store/transcription'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import ShortcutRenderer from '@/components/ShortcutRenderer'

export function AppContent() {
  const { screenshotData, solutionChunks, errorMessage, recentScreenshots, setErrorMessage } =
    useSolutionStore()
  const { isTranscribing, transcriptionText } = useTranscriptionStore()

  const hasTranscriptionContent = isTranscribing || transcriptionText.trim().length > 0
  const hasSolutionContent = solutionChunks.join('').trim().length > 0

  return (
    <div id="app-content" className="px-6 py-4 pb-5">
      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-3">
          <svg
            className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-red-400 font-medium text-sm">API 调用失败</p>
            <p className="text-red-300/80 text-sm mt-0.5 break-words">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-400/80 hover:text-red-300 flex-shrink-0"
            title="关闭"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Screenshot Gallery */}
      {recentScreenshots.length > 0 ? (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {recentScreenshots.map((data, index) => (
            <img
              key={index}
              src={`data:image/png;base64,${data}`}
              alt={`Screenshot ${index + 1}`}
              className="w-40 h-auto flex-shrink-0 border border-[var(--app-border)] rounded-lg shadow-lg hover:shadow-xl transition-shadow"
              title={`第 ${index + 1} 张截图`}
            />
          ))}
        </div>
      ) : screenshotData ? (
        <div className="mb-4">
          <img
            src={`data:image/png;base64,${screenshotData}`}
            alt="Screenshot"
            className="w-40 h-auto border border-[var(--app-border)] rounded-lg shadow-lg"
          />
        </div>
      ) : !hasTranscriptionContent && !hasSolutionContent && !errorMessage ? (
        <ShortcutTip />
      ) : null}

      {/* Solution Display */}
      <MarkdownRenderer>{solutionChunks.join('')}</MarkdownRenderer>
    </div>
  )
}

function ShortcutTip() {
  const { shortcuts } = useShortcutsStore()
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-xl text-[var(--app-text-muted)] select-none">
      <div className="flex items-center">
        请按下快捷键
        <ShortcutRenderer shortcut={shortcuts.takeScreenshot.key} className="mx-1 font-bold" />
        抓取屏幕进行分析
      </div>
      <div className="flex items-center">
        请按下快捷键
        <ShortcutRenderer shortcut={shortcuts.appendScreenshot.key} className="mx-1 font-bold" />
        追加截图进行多图分析
      </div>
    </div>
  )
}
