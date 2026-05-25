import { cn } from '@renderer/lib/utils'
import { getShortcutAcceleratorDisplay } from '@/lib/utils/keyboard'

export default function ShortcutRenderer({
  shortcut,
  className,
  variant = 'chip'
}: {
  shortcut: string
  className?: string
  variant?: 'chip' | 'inline'
}) {
  const keys = getShortcutAcceleratorDisplay(shortcut).split('+')
  return (
    <span
      className={cn(
        'text-sm font-semibold rounded transition-colors py-1 px-2 space-x-1',
        variant === 'chip' && 'border',
        variant === 'chip' &&
          'hover:bg-[var(--app-control-hover-bg)] hover:border-[var(--app-control-active-bg)] hover:text-[var(--app-text)]',
        className
      )}
      style={
        variant === 'chip'
          ? {
              background: 'var(--app-shortcut-chip-bg)',
              borderColor: 'var(--app-shortcut-chip-border)',
              color: 'var(--app-text)'
            }
          : {
              color: 'var(--app-text)'
            }
      }
    >
      {keys.map((key) => (
        <span key={key}>{key}</span>
      ))}
    </span>
  )
}
