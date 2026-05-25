import { useEffect } from 'react'
import { useSolutionStore } from '@/lib/store/solution'

const SCROLL_OFFSET = 120

export default function SolutionManager() {
  const {
    setScreenshotData,
    setIsLoading,
    addSolutionChunk,
    setErrorMessage,
    clearSolution,
    setRecentScreenshots
  } = useSolutionStore()

  useEffect(() => {
    window.api.onScreenshotTaken((data: string) => {
      setScreenshotData(data)
    })
    window.api.onScreenshotsUpdated((screenshots: string[]) => {
      setRecentScreenshots(screenshots)
    })
    window.api.onSolutionClear((resetScreenshots: boolean) => {
      clearSolution()
      if (resetScreenshots) {
        setRecentScreenshots([])
        setScreenshotData(null)
      }
    })
    window.api.onSolutionChunk((chunk: string) => {
      addSolutionChunk(chunk)
    })
    window.api.onAiLoadingStart(() => {
      setIsLoading(true)
      setErrorMessage(null)
    })
    window.api.onAiLoadingEnd(() => {
      setIsLoading(false)
    })
    return () => {
      window.api.removeScreenshotListener()
      window.api.removeScreenshotsUpdatedListener()
      window.api.removeSolutionChunkListener()
      window.api.removeAiLoadingStartListener()
      window.api.removeAiLoadingEndListener()
      window.api.removeSolutionClearListener()
    }
  }, [
    setScreenshotData,
    setRecentScreenshots,
    clearSolution,
    setIsLoading,
    addSolutionChunk,
    setErrorMessage
  ])

  useEffect(() => {
    window.api.onSolutionComplete(() => {
      setIsLoading(false)
    })
    window.api.onSolutionStopped(() => {
      setIsLoading(false)
    })
    window.api.onSolutionError((message: string) => {
      setIsLoading(false)
      setErrorMessage(message)
    })
    return () => {
      window.api.removeSolutionCompleteListener()
      window.api.removeSolutionStoppedListener()
      window.api.removeSolutionErrorListener()
    }
  }, [setIsLoading, setErrorMessage])

  useEffect(() => {
    window.api.onScrollPageUp(() => {
      const container = document.getElementById('app-content')
      if (!container) return
      container.scrollTo({
        top: container.scrollTop - window.innerHeight + SCROLL_OFFSET,
        behavior: 'smooth'
      })
    })
    return () => {
      window.api.removeScrollPageUpListener()
    }
  }, [])

  useEffect(() => {
    window.api.onScrollPageDown(() => {
      const container = document.getElementById('app-content')
      if (!container) return
      container.scrollTo({
        top: container.scrollTop + window.innerHeight - SCROLL_OFFSET,
        behavior: 'smooth'
      })
    })
    return () => {
      window.api.removeScrollPageDownListener()
    }
  }, [])

  return null
}
