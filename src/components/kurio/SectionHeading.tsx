import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Título de seção.
 * - `accent`: título laranja alinhado à esquerda com divisor ("Mais desta coleção",
 *   "Colecionadores também viram").
 * - `center`: título creme centralizado com subtítulo ("Diário da Cunhagem").
 */
export function SectionHeading({
  title,
  description,
  action,
  variant = 'accent',
  as: Tag = 'h2',
  id,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  variant?: 'accent' | 'center'
  as?: 'h1' | 'h2' | 'h3'
  id?: string
  className?: string
}) {
  if (variant === 'center') {
    return (
      <div className={cn('flex flex-col items-center gap-2 text-center', className)}>
        <Tag id={id} className="text-title-1 text-foreground">
          {title}
        </Tag>
        {description && <p className="max-w-xl text-caption text-muted-foreground">{description}</p>}
      </div>
    )
  }
  return (
    <div className={cn('flex items-end justify-between gap-4 border-b border-border-strong pb-2', className)}>
      <div>
        <Tag id={id} className="text-title-3 font-bold text-price">
          {title}
        </Tag>
        {description && <p className="text-caption text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
