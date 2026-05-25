import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer focus-visible:ring-ring/50 inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-[var(--app-control-border)] shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-[var(--app-switch-checked-bg)] data-[state=unchecked]:bg-[var(--app-switch-unchecked-bg)]',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-3 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[20px] data-[state=unchecked]:translate-x-[2px]',
          'data-[state=checked]:bg-white data-[state=unchecked]:bg-[var(--app-switch-thumb-off)]'
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
