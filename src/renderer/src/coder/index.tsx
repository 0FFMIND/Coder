import { AppContent } from './AppContent'
import { AppStatusBar } from './AppStatusBar'
import { PrerequisitesChecker } from './PrerequisitesChecker'

export default function CoderPage({ collapsed }: { collapsed: boolean }) {
  return (
    <>
      {!collapsed && (
        <>
          <AppContent />
          <AppStatusBar />
          <PrerequisitesChecker />
        </>
      )}
    </>
  )
}
