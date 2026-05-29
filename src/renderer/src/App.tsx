import { useEffect, useRef, useState } from 'react'
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router'
import { Toaster } from 'sonner'
import CoderPage from '@/coder'
import SettingsPage from '@/settings'
import HelpPage from '@/help'
import SubtitlePage from '@/subtitle'
import { AppHeader } from '@/coder/AppHeader'
import TranscriptionManager from '@/coder/TranscriptionManager'
import SolutionManager from '@/coder/SolutionManager'
import { useSettingsStore, type Settings } from '@/lib/store/settings'
import { useShortcutsStore } from '@/lib/store/shortcuts'
import { useAppStore } from '@/lib/store/app'
import { getCloneableFields } from '@/lib/utils'
import { getShortcutAccelerator } from '@/lib/utils/keyboard'

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, [contenteditable="true"]'))
}

function NavigateToCoderListener() {
  const navigate = useNavigate()
  useEffect(() => {
    const handle = () => {
      navigate('/')
    }
    window.api.onNavigateToCoder(handle)
    return () => {
      window.api.removeNavigateToCoderListener()
    }
  }, [navigate])
  return null
}

function AppContent({
  collapsed,
  setCollapsed
}: {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}) {
  const location = useLocation()

  if (location.pathname === '/subtitle') {
    return <SubtitlePage />
  }

  return (
    <>
      <TranscriptionManager />
      <SolutionManager />
      <div className="flex flex-col h-full overflow-hidden">
        <AppHeader collapsed={collapsed} onCollapsedChange={setCollapsed} />
        {!collapsed && (
          <Routes>
            <Route index element={<CoderPage collapsed={collapsed} />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="help" element={<HelpPage />} />
            <Route path="subtitle" element={<SubtitlePage />} />
          </Routes>
        )}
      </div>
    </>
  )
}

function AppFrameOverlay() {
  const location = useLocation()
  if (location.pathname === '/subtitle') return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      <div className="absolute left-0 right-0 top-0 h-px bg-[var(--app-outer-border)]" />
      <div className="absolute bottom-0 left-0 top-0 w-px bg-[var(--app-outer-border)]" />
      <div className="absolute bottom-0 right-0 top-0 w-px bg-[var(--app-outer-border)]" />
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--app-outer-border)]" />
    </div>
  )
}

export default function App() {
  const [initialized, setInitialized] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const settingsStore = useSettingsStore()
  const { shortcuts } = useShortcutsStore()
  const { syncAppState } = useAppStore()
  const { theme, autoTheme, opacity } = settingsStore

  useEffect(() => {
    if (!autoTheme) {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }, [theme, autoTheme])

  useEffect(() => {
    document.documentElement.style.setProperty('--app-bg-opacity', opacity.toString())
  }, [opacity])

  useEffect(() => {
    const handle = (autoThemeValue: 'dark' | 'light') => {
      if (useSettingsStore.getState().autoTheme) {
        useSettingsStore.getState().updateSetting('theme', autoThemeValue)
        document.documentElement.setAttribute('data-theme', autoThemeValue)
      }
    }
    window.api.onAutoThemeChanged(handle)
    return () => {
      window.api.removeAutoThemeChangedListener()
    }
  }, [])

  useEffect(() => {
    const handle = (settings: Partial<Settings>) => {
      const state = useSettingsStore.getState()
      const changedSettings: Partial<Settings> = {}
      for (const key of Object.keys(settings) as (keyof Settings)[]) {
        if (settings[key] !== state[key]) {
          ;(changedSettings as Record<string, unknown>)[key] = settings[key]
        }
      }
      if (Object.keys(changedSettings).length > 0) {
        state.syncSettings(changedSettings)
      }
    }
    window.api.onSettingsUpdated(handle)
    return () => {
      window.api.removeSettingsUpdatedListener()
    }
  }, [])

  useEffect(() => {
    window.api.getAppSettings().then((settings) => {
      const blankFields = Object.keys(settings).filter(
        (key) => settings[key] && !settingsStore[key]
      )
      settingsStore.syncSettings(
        blankFields.reduce(
          (acc, key) => {
            acc[key] = settings[key]
            return acc
          },
          {} as Partial<typeof settingsStore>
        )
      )
      setInitialized(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lastSyncedSettingsRef = useRef<Partial<Settings>>({})

  useEffect(() => {
    if (!initialized) return

    const unsubscribe = useSettingsStore.subscribe((state) => {
      const currentSettings = getCloneableFields(state) as Partial<Settings>
      const lastSettings = lastSyncedSettingsRef.current
      const changedSettings: Partial<Settings> = {}

      for (const key of Object.keys(currentSettings) as (keyof Settings)[]) {
        if (currentSettings[key] !== lastSettings[key]) {
          ;(changedSettings as Record<string, unknown>)[key] = currentSettings[key]
        }
      }

      if (Object.keys(changedSettings).length > 0) {
        lastSyncedSettingsRef.current = { ...lastSettings, ...changedSettings }
        window.api.updateAppSettings(changedSettings)
      }
    })

    return unsubscribe
  }, [initialized])

  useEffect(() => {
    console.log('App initShortcuts:', shortcuts) // DEBUG: 检查新键
    window.api.initShortcuts(shortcuts)
    window.api.getShortcuts().then((shortcutsStatus) => {
      console.log('Shortcuts registered:', shortcutsStatus) // DEBUG: 主进程状态
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return

      const accelerator = getShortcutAccelerator(event)
      if (!accelerator) return

      const shortcut = Object.values(shortcuts).find((shortcut) => shortcut.key === accelerator)
      if (!shortcut) return

      event.preventDefault()
      window.api.triggerShortcutAction(shortcut.action)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])

  useEffect(() => {
    window.api.onWindowCollapsedChanged((nextCollapsed) => {
      setCollapsed(nextCollapsed)
    })
    return () => {
      window.api.removeWindowCollapsedChangedListener()
    }
  }, [])

  useEffect(() => {
    window.api.onSyncAppState((state) => {
      syncAppState(state)
    })
    return () => {
      window.api.removeSyncAppStateListener()
    }
  }, [syncAppState])

  return (
    <>
      <HashRouter>
        <NavigateToCoderListener />
        <AppContent collapsed={collapsed} setCollapsed={setCollapsed} />
        <AppFrameOverlay />
      </HashRouter>

      <Toaster />
    </>
  )
}
