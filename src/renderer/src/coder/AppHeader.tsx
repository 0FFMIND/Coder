import { useRef, useState } from 'react'
import { Minus, SettingsIcon, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useAppStore } from '@/lib/store/app'
import { CoderToolbar } from './CoderToolbar'

const COLLAPSED_HEIGHT = 82
const RESIZE_THRESHOLD = COLLAPSED_HEIGHT + 24

export function AppHeader({
  collapsed,
  onCollapsedChange
}: {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { ignoreMouse } = useAppStore()
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const resizeStartYRef = useRef(0)
  const resizeStartHeightRef = useRef(0)
  const isResizingRef = useRef(false)

  const handleSettingsClick = async () => {
    if (collapsed) {
      await window.api.setWindowCollapsed(false)
      onCollapsedChange(false)
    }
    if (location.pathname === '/settings' || location.pathname === '#/settings') {
      navigate('/')
    } else {
      navigate('/settings')
    }
  }

  const handleCollapseClick = async () => {
    const nextCollapsed = !collapsed
    const collapsedState = await window.api.setWindowCollapsed(nextCollapsed)
    onCollapsedChange(collapsedState)
  }

  const handleCloseClick = () => {
    setShowCloseDialog(true)
  }

  const handleConfirmClose = () => {
    setShowCloseDialog(false)
    window.close()
  }

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizingRef.current = true
    resizeStartYRef.current = e.screenY
    resizeStartHeightRef.current = window.innerHeight

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return
      const deltaY = moveEvent.screenY - resizeStartYRef.current
      const newHeight = Math.max(COLLAPSED_HEIGHT, resizeStartHeightRef.current + deltaY)
      window.api.setWindowHeight(newHeight)
      if (collapsed && newHeight > RESIZE_THRESHOLD) {
        onCollapsedChange(false)
      }
    }

    const handleMouseUp = () => {
      isResizingRef.current = false
      window.api.endRendererResize()
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <>
      <div id="app-header" className="flex items-start text-[var(--app-text)]">
        <div className="actions flex min-w-0 flex-1 items-start overflow-x-hidden overflow-y-visible pt-1 pb-0 pl-4 pr-8">
          <CoderToolbar />
        </div>
        <div className={`actions shrink-0 ${ignoreMouse ? 'pointer-events-none' : ''}`}>
          <Button
            variant="ghost"
            className="size-8 cursor-pointer hover:opacity-50 [-webkit-app-region:no-drag]!"
            onClick={handleSettingsClick}
          >
            <SettingsIcon />
          </Button>
          <Button
            variant="ghost"
            className="size-8 cursor-pointer hover:opacity-50 [-webkit-app-region:no-drag]!"
            onClick={handleCollapseClick}
          >
            <Minus />
          </Button>
          <Button
            variant="ghost"
            className="size-8 cursor-pointer hover:opacity-50 hover:text-red-500 [-webkit-app-region:no-drag]!"
            onClick={handleCloseClick}
          >
            <X />
          </Button>
        </div>
      </div>

      {collapsed && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="h-[6px] w-full cursor-ns-resize bg-transparent [-webkit-app-region:no-drag]!"
          title="向下拖动以展开窗口"
        >
          <div className="mx-auto h-[2px] w-10 rounded-full bg-[var(--app-border)] opacity-60" />
        </div>
      )}

      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent showCloseButton={false} className="max-w-xs [-webkit-app-region:no-drag]">
          <DialogHeader>
            <DialogTitle>退出解题助手</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">确定要退出吗？</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCloseDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmClose}>
              退出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
