/**
 * CP9.2: o substituto do tough-cookie cobre exatamente o que o cookie jar emulado do MSW usa
 * (msw/lib/core/utils/cookieStore.mjs): guardar, ler por URL/caminho, expirar e persistir/restaurar.
 */
import { expect, test } from '@playwright/test'
import { Cookie, CookieJar, MemoryCookieStore } from '../../src/mocks/vendor/tough-cookie-lite'

test('setCookie/getCookiesSync: domínio host-only, caminho e expiração', async () => {
  const store = new MemoryCookieStore()
  const jar = new CookieJar(store)
  await jar.setCookie('theme=dark; Path=/', 'http://localhost:4173/api/x')
  await jar.setCookie('scoped=1; Path=/api', 'http://localhost:4173/api/x')
  await jar.setCookie('old=1; Max-Age=0', 'http://localhost:4173/')
  const names = (url: string) => jar.getCookiesSync(url).map((c) => `${c.key}=${c.value}`).sort()
  expect(names('http://localhost:4173/api/nfts')).toEqual(['scoped=1', 'theme=dark'])
  expect(names('http://localhost:4173/apix')).toEqual(['theme=dark'])
  expect(names('http://outro.host/api/nfts')).toEqual([])
})

test('persistência como o MSW faz (idx → toJSON → fromJSON)', async () => {
  const store = new MemoryCookieStore()
  await new CookieJar(store).setCookie('a=1; Expires=Wed, 01 Jan 2098 00:00:00 GMT', 'http://localhost:4173/')
  const data: unknown[] = []
  for (const d in store.idx) for (const p in store.idx[d]) for (const k in store.idx[d]![p]) data.push(store.idx[d]![p]![k]!.toJSON())
  const restored = new MemoryCookieStore()
  for (const raw of JSON.parse(JSON.stringify(data))) {
    const c = Cookie.fromJSON(raw)!
    ;((restored.idx[c.domain] ??= {})[c.path] ??= {})[c.key] = c
  }
  expect(new CookieJar(restored).getCookiesSync('http://localhost:4173/x').map((c) => c.value)).toEqual(['1'])
})
