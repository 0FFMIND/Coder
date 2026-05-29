import { useEffect, useState, type CSSProperties } from 'react'

const dragStyle = { WebkitAppRegion: 'drag' } as CSSProperties & { WebkitAppRegion: string }
const subtitleTextShadow =
  '0 1px 2px rgba(0,0,0,0.95), 1px 0 2px rgba(0,0,0,0.95), -1px 0 2px rgba(0,0,0,0.95), 0 -1px 2px rgba(0,0,0,0.95)'

export default function SubtitleApp() {
  const [lines, setLines] = useState<string[]>([])

  useEffect(() => {
    const handleText = ({ text }: { text: string; isPartial: boolean }) => {
      const allLines = text.split('\n').filter(Boolean)
      setLines(allLines.slice(-4))
    }

    const handleCleared = () => {
      setLines([])
    }

    window.api.onTranscriptionText(handleText)
    window.api.onTranscriptionCleared(handleCleared)

    return () => {
      window.api.removeTranscriptionTextListener()
      window.api.removeTranscriptionClearedListener()
    }
  }, [])

  const hasContent = lines.length > 0

  return (
    <div
      className="fixed inset-0 flex cursor-move flex-col justify-end border border-white/45 px-6 pb-3 [-webkit-app-region:drag]"
      style={dragStyle}
    >
      <div className="mx-auto w-full max-w-5xl rounded-md bg-transparent px-5 py-2.5">
        <div className="min-h-6 space-y-0.5">
          {hasContent ? (
            lines.map((line, index) => (
              <p
                key={index}
                className="text-center text-xl font-semibold leading-tight text-white"
                style={{ textShadow: subtitleTextShadow }}
              >
                {line}
              </p>
            ))
          ) : (
            <div className="mx-auto h-1.5 w-24 rounded-full bg-white/50" />
          )}
        </div>
      </div>
    </div>
  )
}
