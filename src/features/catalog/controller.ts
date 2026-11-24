/**
 * Controlador do catálogo: traduz ações da interface em navegação do TanStack Router.
 * A URL é a ÚNICA fonte do estado de busca/filtros (sobrevive a refresh, voltar/avançar e
 * links compartilhados).
 *
 * - Qualquer mudança de filtro, busca, aba ou ordenação volta para a página 1 (CAT-02).
 * - Digitação na busca usa `replace` (não cria uma entrada de histórico por tecla).
 * - Troca de página cria entrada de histórico (o "voltar" retorna à página anterior).
 */
import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import type { CatalogSearch } from './search'

export type CatalogPath = '/' | '/mercado'

export function useCatalogController(path: CatalogPath, search: CatalogSearch) {
  const navigate = useNavigate()

  const go = useCallback(
    (next: CatalogSearch, replace = false) => void navigate({ to: path, search: next, replace, resetScroll: false }),
    [navigate, path],
  )

  return {
    search,
    /** Atualiza filtros e volta para a primeira página. */
    setFilters: (patch: Partial<CatalogSearch>, options?: { replace?: boolean }) => {
      const next: CatalogSearch = { ...search, ...patch, page: undefined }
      for (const k of Object.keys(next) as Array<keyof CatalogSearch>) if (next[k] === undefined || next[k] === '') delete next[k]
      go(next, options?.replace)
    },
    setPage: (page: number) => go({ ...search, page: page > 1 ? page : undefined }),
    clearAll: () => go({ sort: search.sort }),
  }
}

export type CatalogController = ReturnType<typeof useCatalogController>
