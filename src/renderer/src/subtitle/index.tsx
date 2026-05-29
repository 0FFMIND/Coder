import { useEffect, useState } from 'react'
import { Mic } from 'lucide-react'

export default function SubtitlePage() {
  const [lines, setLines] = useState<string[]>([])
  const [isTranscribing, setIsTranscribing] = useState(false)

  useEffect(() => {
    const handleText = ({ text }: { text: string; isPartial: boolean }) => {
      setIsTranscribing(true)
      const allLines = text.split('\n').filter(Boolean)
      const recentLines = allLines.slice(-4)
      setLines(recentLines)
    }

    const handleStopped = () => {
      setIsTranscribing(false)
    }

    const handleCleared = () => {
      setLines([])
    }

    window.api.onTranscriptionText(handleText)
    window.api.onTranscriptionStopped(handleStopped)
    window.api.onTranscriptionCleared(handleCleared)

    return () => {
      window.api.removeTranscriptionTextListener()
      window.api.removeTranscriptionStoppedListener()
      window.api.removeTranscriptionClearedListener()
    }
  }, [])

  return (
    <div className="fixed inset-0 flex items-end justify-center pb-4 pointer-events-none">
      <div className="w-[90%] max-w-4xl rounded-xl bg-black/70 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <Mic
            className={`mt-1 h-5 w-5 shrink-0 ${isTranscribing ? 'text-red-400 animate-pulse' : 'text-gray-400'}`}
          />
          <div className="flex-1 space-y-1">
            {lines.length > 0 ? (
              lines.map((line, index) => (
                <p key={index} className="text-white text-lg leading-relaxed">
                  {line}
                </p>
              ))
            ) : (
              <p className="text-gray-400 text-lg">等待语音输入...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
