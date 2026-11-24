import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Campo de texto (base shadcn/ui). Figma: fundo transparente, borda fina, placeholder caramelo,
 * cantos de 8px no mobile e 4px no desktop. A borda usa `--color-input` (3.38:1, WCAG 1.4.11),
 * mais visível que a do Figma: desvio documentado. Altura de 48px no mobile (área de toque).
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-12 w-full min-w-0 rounded-md border border-input bg-transparent px-4 font-mono text-body text-foreground lg:h-10 lg:rounded-xs lg:px-3',
        'transition-[border-color,box-shadow] duration-[var(--duration-fast)] outline-none',
        'hover:border-muted-foreground focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_rgb(210_138_76/0.25)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:focus-visible:shadow-[0_0_0_3px_rgb(255_138_128/0.25)]',
        'file:border-0 file:bg-transparent file:font-mono file:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
