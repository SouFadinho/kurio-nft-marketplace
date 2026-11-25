/**
 * Substituto mínimo de `tldts` NO BUILD DO NAVEGADOR (alias em vite.config.ts). CP9.2, auditado no CP9.1.
 *
 * O QUE SUBSTITUI. Cadeia: msw → tough-cookie (cookie jar emulado do MSW) → tldts. O `tough-cookie`
 * (real, versão do lockfile) usa do `tldts` apenas `getDomain()`, o domínio registrável (eTLD+1),
 * para aplicar as regras de sufixo público a cookies SIMULADOS. O `tldts` embute a Public Suffix
 * List inteira: 251 kB de 482 kB do chunk do MSW, baixados e interpretados antes do primeiro dado de
 * qualquer página (LCP mobile 4,8 → 4,1 s ao remover; planning/CP9_2_REPORT.md).
 *
 * O QUE NÃO MUDA. O MSW, o `tough-cookie` e toda a lógica do cookie jar (busca por domínio e caminho,
 * ordem, serialização, expiração, persistência em localStorage) são os originais. Contratos REST,
 * autenticação (header `Authorization`, não cookie), isolamento entre usuários e a persistência do
 * banco simulado não passam por aqui. Nenhuma funcionalidade do desafio depende de cookies.
 *
 * DIFERENÇA. Para sufixos públicos de vários níveis (ex.: `vercel.app`, `github.io`, `co.uk`), o
 * substituto considera os dois últimos rótulos: `kurio.vercel.app` → `vercel.app` (o real devolve
 * `kurio.vercel.app`). Efeito possível: um cookie SIMULADO com `Domain=vercel.app` seria aceito.
 * Em localhost, IPs e domínios comuns o resultado é idêntico.
 *
 * GARANTIAS (testes):
 * - `e2e/unit/tldts-lite.spec.ts`: contrato (o tough-cookie importa do tldts só `getDomain`, nos
 *   builds ESM e CJS; quebra se uma atualização passar a usar outra função), diferencial com o
 *   tldts real e as diferenças conhecidas listadas explicitamente;
 * - `e2e/hardening.spec.ts` › cookie jar do MSW: app completo com o jar persistido PREENCHIDO;
 * - a suíte inteira passa por este caminho (o MSW consulta o jar em toda requisição).
 *
 * MANUTENÇÃO. MSW e tough-cookie estão fixados no lockfile. Ao atualizá-los, rodar os testes acima;
 * se o contrato quebrar, remover o alias (custo medido: ~111 kB gzip a mais no chunk do MSW).
 * Histórico: no CP9.2 o próprio tough-cookie chegou a ser substituído. A auditoria do CP9.1 achou
 * incompatibilidades (sem `toString()` usado pelo MSW, sem a ordem da RFC 6265) e reverteu essa
 * parte; o custo medido da reversão foi nulo na Início e de −2,5 pontos no Detalhe (A/B de 8 pares).
 */
export function getDomain(domain: string | null | undefined): string | null {
  if (!domain) return null
  const host = domain.replace(/\.$/, '').toLowerCase()
  const labels = host.split('.').filter(Boolean)
  if (labels.length < 2) return null
  // IPs não têm domínio registrável.
  if (/^\d+$/.test(labels[labels.length - 1]!)) return null
  return labels.slice(-2).join('.')
}

export default { getDomain }
