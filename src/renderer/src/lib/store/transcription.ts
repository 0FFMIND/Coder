import { create } from 'zustand'

interface TranscriptionState {
  isTranscribing: boolean
  transcriptionText: string
  errorMessage: string | null
  autoMode: boolean
}

interface TranscriptionStore extends TranscriptionState {
  setIsTranscribing: (v: boolean) => void
  setTranscriptionText: (text: string) => void
  clearText: () => void
  setError: (msg: string | null) => void
  setAutoMode: (v: boolean) => void
  resetState: () => void
}

const defaultState: TranscriptionState = {
  isTranscribing: false,
  transcriptionText: '',
  errorMessage: null,
  autoMode: false
}

export const useTranscriptionStore = create<TranscriptionStore>()((set) => ({
  ...defaultState,
  setIsTranscribing: (v) => set({ isTranscribing: v }),
  setTranscriptionText: (text) => set({ transcriptionText: text }),
  clearText: () => set({ transcriptionText: '' }),
  setError: (msg) => set({ errorMessage: msg }),
  setAutoMode: (v) => set({ autoMode: v }),
  resetState: () => set(defaultState)
}))
