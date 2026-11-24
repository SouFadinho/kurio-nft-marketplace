import * as React from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

/**
 * Abas (base shadcn/ui, Radix). Figma: texto creme; a aba ativa fica laranja com sublinhado
 * de 2px ("Todos os NFTs", "Detalhes do NFT"). Divisor inferior opcional (`bordered`).
 * O estado ativo não depende só de cor: há o sublinhado e `aria-selected`.
 */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-4', className)} {...props} />
}

function TabsList({ className, bordered = false, ...props }: React.ComponentProps<typeof TabsPrimitive.List> & { bordered?: boolean }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'flex max-w-full items-center gap-6 overflow-x-auto [scrollbar-width:none]',
        bordered && 'border-b border-border-strong',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'relative inline-flex min-h-11 shrink-0 items-center whitespace-nowrap py-2 font-mono text-body text-foreground/85 lg:min-h-9',
        'transition-colors duration-[var(--duration-fast)] hover:text-foreground',
        'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity',
        'data-[state=active]:font-semibold data-[state=active]:text-price data-[state=active]:after:opacity-100',
        'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:pointer-events-none disabled:opacity-45',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn('outline-none', className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
