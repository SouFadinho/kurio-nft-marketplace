/** Lógica pura de paginação (sem UI), testada em e2e/unit/tokens.spec.ts. */
/** Janela de páginas com reticências: 1 … 4 5 6 … 20 */
export function pageWindow(page: number, pageCount: number, radius = 1): Array<number | 'gap'> {
  const pages = new Set<number>([1, pageCount])
  for (let p = page - radius; p <= page + radius; p++) if (p >= 1 && p <= pageCount) pages.add(p)
  const sorted = [...pages].sort((a, b) => a - b)
  const out: Array<number | 'gap'> = []
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1]
    if (i > 0 && prev !== undefined && p - prev > 1) out.push('gap')
    out.push(p)
  })
  return out
}
