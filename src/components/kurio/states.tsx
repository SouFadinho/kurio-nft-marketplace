/**
 * Estados de dados (INT-05): carregamento, vazio e erro, no padrão visual do KURIO.
 * Não existem no Figma: derivados do design system (documentado).
 */
import type { ReactNode } from 'react'
import { AlertTriangle, Loader2, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function LoadingState({ label = 'Carregando…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-3 py-10 text-muted-foreground', className)}>
      <Loader2 className="size-5 animate-spin text-price motion-reduce:animate-none" aria-hidden />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
  headingLevel: Heading = 'h2',
}: {
  /** Use h1 quando o estado vazio for o conteúdo principal da página (ex.: 404). */
  headingLevel?: 'h1' | 'h2'
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong px-6 py-12 text-center', className)}>
      <span className="grid size-12 place-items-center rounded-full bg-surface text-price" aria-hidden>
        {icon ?? <SearchX className="size-5" />}
      </span>
      <Heading className="text-title-2">{title}</Heading>
      {description && <p className="max-w-md text-muted-foreground">{description}</p>}
      {action}
    </div>
  )
}

export function ErrorState({
  headingLevel: Heading = 'h2',
  title = 'Não foi possível carregar',
  message,
  onRetry,
  retrying = false,
  className,
}: {
  headingLevel?: 'h1' | 'h2'
  title?: string
  message?: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-lg bg-destructive-surface px-6 py-10 text-center', className)}>
      <AlertTriangle className="size-6 text-destructive" aria-hidden />
      <Heading className="text-title-2">{title}</Heading>
      {message && <p className="max-w-md text-muted-foreground">{message}</p>}
      {onRetry && (
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          {retrying ? 'Tentando novamente…' : 'Tentar novamente'}
        </Button>
      )}
    </div>
  )
}
