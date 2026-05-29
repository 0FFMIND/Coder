import { useEffect, useRef } from 'react'
import { useSettingsStore } from '@/lib/store/settings'
import { useTranscriptionStore } from '@/lib/store/transcription'
import { useSolutionStore } from '@/lib/store/solution'
import { startAudioCapture, stopAudioCapture } from '@/lib/audio-capture'

export default function TranscriptionManager() {
  const { dashscopeApiKey, defaultAudioDeviceId } = useSettingsStore()
  const { setIsTranscribing, setTranscriptionText, clearText, autoMode } = useTranscriptionStore()
  const { setErrorMessage } = useSolutionStore()

  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoModeRef = useRef(autoMode)
  const isAutoSubmittingRef = useRef(false)
  const isStoppedByUserRef = useRef(false)
  const dashscopeApiKeyRef = useRef(dashscopeApiKey)
  const defaultAudioDeviceIdRef = useRef(defaultAudioDeviceId)

  autoModeRef.current = autoMode
  dashscopeApiKeyRef.current = dashscopeApiKey
  defaultAudioDeviceIdRef.current = defaultAudioDeviceId

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }

  const submitTranscription = async ({ keepTranscribing = false } = {}) => {
    if (isAutoSubmittingRef.current) return
    const text = useTranscriptionStore.getState().transcriptionText.trim()
    if (!text) return

    isAutoSubmittingRef.current = true
    clearSilenceTimer()
    if (!keepTranscribing) {
      stopAudioCapture()
      await window.api.stopTranscription()
    }
    clearText()
    await window.api.clearTranscriptionText()
    try {
      const result = await window.api.sendFollowUpQuestion(text)
      if (result && !result.success) {
        setErrorMessage(`语音转录提交失败：${result.error}`)
      }
    } catch (err) {
      console.error('Failed to send transcription as follow-up:', err)
      setErrorMessage('语音转录提交失败，请重试')
    } finally {
      isAutoSubmittingRef.current = false
      isStoppedByUserRef.current = false
    }
  }

  useEffect(() => {
    window.api.updateAppState({ inCoderPage: true })
    return () => {
      window.api.updateAppState({ inCoderPage: false })
    }
  }, [])

  useEffect(() => {
    const handleToggle = async () => {
      const currentState = useTranscriptionStore.getState()
      if (currentState.isTranscribing) {
        stopAudioCapture()
        await window.api.stopTranscription()
      } else {
        if (!dashscopeApiKeyRef.current) {
          setErrorMessage('请先在设置中配置百炼平台 API Key')
          return
        }
        try {
          await startAudioCapture(defaultAudioDeviceIdRef.current || undefined)
          await window.api.startTranscription(dashscopeApiKeyRef.current)
          setIsTranscribing(true)
          setErrorMessage(null)
        } catch (err) {
          console.error('Failed to start transcription:', err)
          stopAudioCapture()
          setErrorMessage('启动语音转录失败，请检查系统音频权限')
        }
      }
    }

    window.api.onToggleTranscription(handleToggle)
    window.api.onStopTranscriptionInput(() => {
      if (!useTranscriptionStore.getState().isTranscribing) return
      isStoppedByUserRef.current = true
      stopAudioCapture()
      void window.api.stopTranscription()
    })
    return () => {
      window.api.removeToggleTranscriptionListener()
      window.api.removeStopTranscriptionInputListener()
    }
  }, [setIsTranscribing, setErrorMessage])

  useEffect(() => {
    window.api.onTranscriptionText((data) => {
      setTranscriptionText(data.text)
      if (autoModeRef.current && useTranscriptionStore.getState().isTranscribing) {
        clearSilenceTimer()
        silenceTimerRef.current = setTimeout(
          () => {
            submitTranscription({ keepTranscribing: true })
          },
          (useSettingsStore.getState().transcriptionAutoSubmitSeconds || 2) * 1000
        )
      }
    })
    window.api.onTranscriptionError((message) => {
      setErrorMessage(message)
      setIsTranscribing(false)
      stopAudioCapture()
    })
    window.api.onTranscriptionStopped(() => {
      setIsTranscribing(false)
      if (!isAutoSubmittingRef.current && !isStoppedByUserRef.current) {
        isStoppedByUserRef.current = true
        const text = useTranscriptionStore.getState().transcriptionText
        if (text) {
          submitTranscription()
        } else {
          isStoppedByUserRef.current = false
        }
      }
    })
    window.api.onTranscriptionCleared(() => {
      clearText()
    })

    return () => {
      window.api.removeTranscriptionTextListener()
      window.api.removeTranscriptionErrorListener()
      window.api.removeTranscriptionStoppedListener()
      window.api.removeTranscriptionClearedListener()
    }
  }, [setTranscriptionText, setErrorMessage, setIsTranscribing, clearText])

  useEffect(() => {
    return () => {
      clearSilenceTimer()
      if (useTranscriptionStore.getState().isTranscribing) {
        isStoppedByUserRef.current = true
        stopAudioCapture()
        window.api.stopTranscription()
      }
    }
  }, [])

  return null
}
