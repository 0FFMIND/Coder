import { create } from 'zustand'

interface SolutionState {
  isLoading: boolean
  solutionChunks: string[]
  screenshotData: string | null
  errorMessage: string | null
  recentScreenshots: string[]
}

interface SolutionStore extends SolutionState {
  setIsLoading: (isReceiving: boolean) => void
  addSolutionChunk: (chunk: string) => void
  setSolutionChunks: (chunks: string[]) => void
  setScreenshotData: (data: string | null) => void
  setErrorMessage: (message: string | null) => void
  setRecentScreenshots: (screenshots: string[]) => void
  clearSolution: () => void
}

const defaultState: SolutionState = {
  isLoading: false,
  solutionChunks: [],
  screenshotData: null,
  errorMessage: null,
  recentScreenshots: []
}

export const useSolutionStore = create<SolutionStore>()((set) => ({
  ...defaultState,
  setIsLoading: (isReceiving) => {
    set({ isLoading: isReceiving })
  },
  addSolutionChunk: (chunk) => {
    set((state) => ({
      solutionChunks: [...state.solutionChunks, chunk]
    }))
  },
  setSolutionChunks: (chunks) => {
    set({ solutionChunks: chunks })
  },
  setScreenshotData: (data) => {
    set({ screenshotData: data })
  },
  setErrorMessage: (message) => {
    set({ errorMessage: message })
  },
  setRecentScreenshots: (screenshots) => {
    set({ recentScreenshots: screenshots })
  },
  clearSolution: () => {
    set({ solutionChunks: [], isLoading: false, errorMessage: null })
  }
}))
