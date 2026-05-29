import { create } from 'zustand'

interface TranscriptionState {
  isTranscribing: boolean
  transcriptionText: string
  errorMessage: string | null
  autoMode: boolean
  subtitleMode: boolean
  voiceTranscriptionMode: boolean
}

interface TranscriptionStore extends TranscriptionState {
  setIsTranscribing: (v: boolean) => void
  setTranscriptionText: (text: string) => void
  clearText: () => void
  setError: (msg: string | null) => void
  setAutoMode: (v: boolean) => void
  setSubtitleMode: (v: boolean) => void
  setVoiceTranscriptionMode: (v: boolean) => void
  resetState: () => void
}

const defaultState: TranscriptionState = {
  isTranscribing: false,
  transcriptionText: '',
  errorMessage: null,
  autoMode: false,
  subtitleMode: false,
  voiceTranscriptionMode: false
}

export const useTranscriptionStore = create<TranscriptionStore>()((set) => ({
  ...defaultState,
  setIsTranscribing: (v) => set({ isTranscribing: v }),
  setTranscriptionText: (text) => set({ transcriptionText: text }),
  clearText: () => set({ transcriptionText: '' }),
  setError: (msg) => set({ errorMessage: msg }),
  setAutoMode: (v) => set({ autoMode: v }),
  setSubtitleMode: (v) => set({ subtitleMode: v }),
  setVoiceTranscriptionMode: (v) => set({ voiceTranscriptionMode: v }),
  resetState: () => set(defaultState)
}))
