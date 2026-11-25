/**
 * CP9.2 (performance medida): substituto mínimo de `tldts` NO BUILD DO NAVEGADOR (alias em
 * vite.config.ts).
 *
 * Cadeia: msw → tough-cookie (cookie jar emulado do MSW) → tldts. O `tough-cookie` usa apenas
 * `getDomain()` (domínio registrável, eTLD+1) para validar o domínio de cookies. O `tldts`
 * embute a Public Suffix List inteira: 251 kB de 482 kB do chunk do MSW, baixados e
 * interpretados antes do primeiro dado de qualquer página.
 *
 * O KURIO não usa cookies: a sessão viaja no header `Authorization` e nenhum handler lê
 * `request.cookies` nem responde `Set-Cookie`. O cookie jar do MSW continua funcionando; só a
 * regra de sufixo público fica simplificada (os dois últimos rótulos: `a.b.co.uk` → `co.uk`, em vez
 * de `b.co.uk`). Isso afeta apenas cookies simulados de domínios com sufixos de vários
 * níveis, que a aplicação não usa. Versões de MSW e tough-cookie inalteradas.
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
