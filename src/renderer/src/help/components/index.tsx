import { LucideIcon } from 'lucide-react'

export function HelpSection({
  Icon,
  title,
  description,
  children
}: {
  Icon: LucideIcon
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-[var(--app-panel-bg)] rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center text-[var(--app-text)]">
        <Icon className="h-5 w-5 mr-2" />
        {title}
        {description && (
          <span className="ml-2 pt-1 text-xs font-normal text-[var(--app-text-muted)]">
            {description}
          </span>
        )}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}
