/**
 * Paginação (Figma: quadrados pequenos "1 2 3 4 >", ativo laranja).
 * Implementada sobre o Button do shadcn/ui; não usa o pagination do shadcn porque ele
 * renderiza <a> sem `asChild`, e aqui a página vem do estado da URL (TanStack Router),
 * passado por `onPageChange`.
 * Acessível: <nav aria-label>, página atual com `aria-current="page"`.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pageWindow } from '@/lib/pagination'
import { cn } from '@/lib/utils'

export function Pagination({
  page,
  pageCount,
  onPageChange,
  className,
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  className?: string
}) {
  if (pageCount <= 1) return null
  const item = 'size-9 rounded-xs text-caption lg:size-8'
  return (
    <nav aria-label="Paginação" className={cn('flex justify-end', className)}>
      <ul className="flex items-center gap-1.5">
        {pageWindow(page, pageCount).map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={p}>
              <Button
                variant={p === page ? 'default' : 'secondary'}
                size="icon"
                className={cn(item, p !== page && 'bg-transparent text-muted-foreground hover:text-foreground')}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Página ${p}`}
                onClick={() => p !== page && onPageChange(p)}
              >
                {p}
              </Button>
            </li>
          ),
        )}
        <li className="flex gap-1.5">
          <Button variant="ghost" size="icon" className={item} aria-label="Página anterior" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" className={item} aria-label="Próxima página" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
            <ChevronRight aria-hidden />
          </Button>
        </li>
      </ul>
    </nav>
  )
}
