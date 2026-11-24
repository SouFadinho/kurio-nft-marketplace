/**
 * Busca textual do catálogo.
 * - Debounce de 300 ms: a URL (e a consulta) muda quando a pessoa para de digitar.
 * - A escrita na URL usa `replace` (sem uma entrada de histórico por tecla).
 * - Voltar/avançar e "Limpar filtros" sincronizam o campo com a URL (ajuste de estado
 *   durante o render, padrão recomendado pelo React em vez de effect + setState).
 * - Respostas fora de ordem não afetam a tela: cada termo tem a própria query key.
 */
import { useEffect, useEffectEvent, useState } from 'react'
import { SearchInput } from '@/components/kurio/SearchInput'
import type { CatalogController } from './controller'

export const SEARCH_DEBOUNCE_MS = 300

export function CatalogSearchField({ controller, variant = 'filled', className }: { controller: CatalogController; variant?: 'filled' | 'outline'; className?: string }) {
  const urlValue = controller.search.q ?? ''
  const [value, setValue] = useState(urlValue)
  const [syncedUrl, setSyncedUrl] = useState(urlValue)

  // A URL mudou por fora do campo: reflete o novo valor.
  if (urlValue !== syncedUrl) {
    setSyncedUrl(urlValue)
    setValue(urlValue)
  }

  const commit = useEffectEvent((next: string) => {
    if (next !== urlValue) controller.setFilters({ q: next || undefined }, { replace: true })
  })

  useEffect(() => {
    const next = value.trim()
    const t = window.setTimeout(() => commit(next), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [value])

  return (
    <SearchInput
      label="Buscar NFTs por nome, coleção ou categoria"
      placeholder={variant === 'outline' ? 'Buscar NFTs' : 'Explorar coleções'}
      variant={variant}
      value={value}
      maxLength={60}
      onChange={(e) => setValue(e.target.value)}
      onClear={() => setValue('')}
      className={className}
      data-testid="catalog-search"
    />
  )
}
