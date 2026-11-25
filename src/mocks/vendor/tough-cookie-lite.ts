/**
 * CP9.2 (performance medida): substituto mínimo de `tough-cookie` NO BUILD DO NAVEGADOR (alias em
 * vite.config.ts).
 *
 * Quem usa: só o cookie jar emulado do MSW (`msw/lib/core/utils/cookieStore.mjs`):
 * - `new MemoryCookieStore()` e o índice `idx` (domínio → caminho → nome), persistido pelo MSW;
 * - `new CookieJar(store)`, `getCookiesSync(url)` e `setCookie(setCookieHeader, url)`;
 * - `Cookie.fromJSON(json)` e `cookie.toJSON()`.
 *
 * Por quê: o `tough-cookie` completo (com a Public Suffix List do `tldts`) somava 277 kB do chunk do
 * MSW e rodava em TODA requisição simulada (`canonicalDomain`, `getCookieContext`), antes do
 * primeiro dado de qualquer página. O KURIO não usa cookies: a sessão viaja no header
 * `Authorization`, e nenhum handler lê `request.cookies` nem responde `Set-Cookie`.
 *
 * Semântica mantida para o uso do MSW: cookies host-only por domínio, prefixo de caminho, `Expires` e
 * `Max-Age`. Fora de escopo (não usados aqui): regras de sufixo público, `Domain=` de subdomínios,
 * `SameSite`/`Secure`. Versões de MSW e tough-cookie inalteradas no lockfile.
 */

type CookieJSON = { key: string; value: string; domain: string; path: string; expires?: string | null }

export class Cookie {
  key: string
  value: string
  domain: string
  path: string
  expires: Date | null

  constructor({ key, value, domain, path, expires }: CookieJSON) {
    this.key = key
    this.value = value
    this.domain = domain
    this.path = path
    this.expires = expires ? new Date(expires) : null
  }

  static fromJSON(json: unknown): Cookie | null {
    const data = (typeof json === 'string' ? JSON.parse(json) : json) as Partial<CookieJSON> | null
    if (!data || typeof data.key !== 'string' || typeof data.domain !== 'string' || typeof data.path !== 'string') return null
    return new Cookie({ key: data.key, value: String(data.value ?? ''), domain: data.domain, path: data.path, expires: data.expires ?? null })
  }

  toJSON(): CookieJSON {
    return { key: this.key, value: this.value, domain: this.domain, path: this.path, expires: this.expires ? this.expires.toISOString() : null }
  }

  expired(now = Date.now()) {
    return this.expires !== null && this.expires.getTime() <= now
  }
}

export class MemoryCookieStore {
  idx: Record<string, Record<string, Record<string, Cookie>>> = {}
}

/** Caminho padrão (RFC 6265 §5.1.4): diretório do caminho da URL. */
function defaultPath(pathname: string) {
  if (!pathname.startsWith('/')) return '/'
  const last = pathname.lastIndexOf('/')
  return last <= 0 ? '/' : pathname.slice(0, last)
}

function pathMatches(requestPath: string, cookiePath: string) {
  return requestPath === cookiePath || (requestPath.startsWith(cookiePath) && (cookiePath.endsWith('/') || requestPath[cookiePath.length] === '/'))
}

export class CookieJar {
  private readonly store: MemoryCookieStore

  constructor(store: MemoryCookieStore) {
    this.store = store
  }

  getCookiesSync(url: string): Cookie[] {
    const { hostname, pathname } = new URL(url)
    const byPath = this.store.idx[hostname.toLowerCase()] ?? {}
    const now = Date.now()
    const result: Cookie[] = []
    for (const path in byPath) {
      if (!pathMatches(pathname, path)) continue
      for (const key in byPath[path]) {
        const cookie = byPath[path]![key]!
        if (cookie.expired(now)) delete byPath[path]![key]
        else result.push(cookie)
      }
    }
    return result
  }

  async setCookie(setCookieHeader: string | Cookie, url: string): Promise<Cookie | undefined> {
    const { hostname, pathname } = new URL(url)
    const cookie = typeof setCookieHeader === 'string' ? parseSetCookie(setCookieHeader, hostname.toLowerCase(), defaultPath(pathname)) : setCookieHeader
    if (!cookie) return undefined
    const byPath = (this.store.idx[cookie.domain] ??= {})
    const byKey = (byPath[cookie.path] ??= {})
    if (cookie.expired()) delete byKey[cookie.key]
    else byKey[cookie.key] = cookie
    return cookie
  }
}

function parseSetCookie(header: string, domain: string, path: string): Cookie | null {
  const [pair = '', ...attributes] = header.split(';')
  const eq = pair.indexOf('=')
  if (eq <= 0) return null
  const cookie = new Cookie({ key: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), domain, path, expires: null })
  for (const attribute of attributes) {
    const [rawName = '', ...rest] = attribute.split('=')
    const name = rawName.trim().toLowerCase()
    const value = rest.join('=').trim()
    if (name === 'path' && value.startsWith('/')) cookie.path = value
    else if (name === 'expires') {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) cookie.expires = date
    } else if (name === 'max-age' && /^-?\d+$/.test(value)) cookie.expires = new Date(Date.now() + Number(value) * 1000)
  }
  return cookie
}

export default { Cookie, CookieJar, MemoryCookieStore }
