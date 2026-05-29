import { create } from 'zustand'

interface AppState {
  ignoreMouse: boolean
  subtitleWindowOpen: boolean
}

interface AppStore extends AppState {
  setIgnoreMouse: (ignore: boolean) => void
  toggleIgnoreMouse: () => void
  setSubtitleWindowOpen: (open: boolean) => void
  syncAppState: (state: AppState) => void
}

const defaultState: AppState = {
  ignoreMouse: false,
  subtitleWindowOpen: false
}

export const useAppStore = create<AppStore>()((set) => ({
  ...defaultState,
  setIgnoreMouse: (ignore) => {
    set({ ignoreMouse: ignore })
  },
  toggleIgnoreMouse: () => {
    set((state) => ({ ignoreMouse: !state.ignoreMouse }))
  },
  setSubtitleWindowOpen: (open) => {
    set({ subtitleWindowOpen: open })
  },
  syncAppState: (state) => {
    set(state)
  }
}))
