import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

const isSubtitleWindow = window.location.hash.startsWith('#/subtitle')

async function init() {
  let RootApp
  if (isSubtitleWindow) {
    const { default: SubtitleApp } = await import('./SubtitleApp')
    RootApp = SubtitleApp
  } else {
    const { default: App } = await import('./App')
    RootApp = App
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RootApp />
    </StrictMode>
  )
}

init()
