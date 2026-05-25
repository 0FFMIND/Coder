import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Shortcut = {
  action: string
  key: string
  defaultKey: string
  category: string
  status?: ShortcutStatus
}

export enum ShortcutStatus {
  Registered = 'registered',
  Failed = 'failed',
  /** Shortcut is available to register but not registered. */
  Available = 'available'
}

interface ShortcutsState {
  shortcuts: Record<string, Shortcut>
}

interface ShortcutsStore extends ShortcutsState {
  updateShortcut: (action: string, shortcut: Shortcut) => void
  updateShortcuts: (shortcuts: Record<string, Shortcut>) => void
  resetShortcuts: () => void
}

type PersistedShortcutsState = {
  shortcuts?: Record<string, Shortcut>
}

function isPersistedShortcutsState(value: unknown): value is PersistedShortcutsState {
  return typeof value === 'object' && value !== null && 'shortcuts' in value
}

const defaultShortcuts: Record<string, Omit<Shortcut, 'defaultKey'>> = {
  hideOrShowMainWindow: {
    action: 'hideOrShowMainWindow',
    key: 'Alt+H',
    category: 'Window Management'
  },
  ignoreOrEnableMouse: {
    action: 'ignoreOrEnableMouse',
    key: 'Alt+M',
    category: 'Feature'
  },
  takeScreenshot: {
    action: 'takeScreenshot',
    key: 'Alt+Enter',
    category: 'Screenshot & AI'
  },
  appendScreenshot: {
    action: 'appendScreenshot',
    key: 'Alt+Shift+Enter',
    category: 'Screenshot & AI'
  },
  stopSolutionStream: {
    action: 'stopSolutionStream',
    key: 'Alt+.',
    category: 'Screenshot & AI'
  },
  toggleTranscription: {
    action: 'toggleTranscription',
    key: 'Alt+T',
    category: 'Screenshot & AI'
  },
  clearTranscription: {
    action: 'clearTranscription',
    key: 'Alt+Shift+T',
    category: 'Screenshot & AI'
  },
  pageUp: {
    action: 'pageUp',
    key: 'Alt+J',
    category: 'Navigation'
  },
  pageDown: {
    action: 'pageDown',
    key: 'Alt+K',
    category: 'Navigation'
  },
  moveMainWindowUp: {
    action: 'moveMainWindowUp',
    key: 'Alt+Up',
    category: 'Window Movement'
  },
  moveMainWindowDown: {
    action: 'moveMainWindowDown',
    key: 'Alt+Down',
    category: 'Window Movement'
  },
  moveMainWindowLeft: {
    action: 'moveMainWindowLeft',
    key: 'Alt+Left',
    category: 'Window Movement'
  },
  moveMainWindowRight: {
    action: 'moveMainWindowRight',
    key: 'Alt+Right',
    category: 'Window Movement'
  }
}

function buildDefaultShortcuts(): Record<string, Shortcut> {
  return Object.fromEntries(
    Object.entries(defaultShortcuts).map(([action, shortcut]) => [
      action,
      { ...shortcut, defaultKey: shortcut.key }
    ])
  )
}

export const useShortcutsStore = create<ShortcutsStore>()(
  persist(
    (set) => ({
      shortcuts: buildDefaultShortcuts(),
      updateShortcut: (action, shortcut) => {
        set((state) => ({
          shortcuts: {
            ...state.shortcuts,
            [action]: shortcut
          }
        }))
      },
      updateShortcuts: (shortcuts) => {
        set({ shortcuts })
      },
      resetShortcuts: () => {
        set({
          shortcuts: buildDefaultShortcuts()
        })
      }
    }),
    {
      name: 'interview-coder-shortcuts',
      version: 8,
      migrate: (state: unknown) => {
        if (!isPersistedShortcutsState(state)) return state as ShortcutsStore

        return {
          ...state,
          shortcuts: buildDefaultShortcuts()
        } as ShortcutsStore
      }
    }
  )
)
