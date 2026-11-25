import { expect, test } from '@playwright/test'
import { ApplyCoupon, PaymentWallet, networksForAddress, sameQuoteValues, type Quote } from '../../src/api/contracts'
import { mergeCartLines } from '../../src/mocks/cart-model'
import { NETWORK_FEE, priceCart } from '../../src/mocks/pricing'

const line = (lineId: string, unitPrice: string, quantity: number) => ({ lineId, nftId: lineId, editionId: 'ed', name: lineId, unitPrice, quantity })

test.describe('cotação (pricing.ts, wei/bigint)', () => {
  test('carrinho do Figma: 2 × 1.19 + 6 × 1.39 + 9 × 1.79 = 26.83; total com taxa Ethereum = 26.846', () => {
    const p = priceCart([line('a', '1.19', 2), line('b', '1.39', 6), line('c', '1.79', 9)], 0, 'ethereum')
    expect(p.lines.map((l) => l.lineTotal)).toEqual(['2.38', '8.34', '16.11'])
    expect(p.subtotal).toBe('26.83')
    expect(p.networkFee).toBe('0.016')
    expect(p.total).toBe('26.846')
  })

  test('sem ponto flutuante: 0.1 + 0.2 = 0.3 exatamente; 18 casas preservadas', () => {
    expect(priceCart([line('a', '0.1', 1), line('b', '0.2', 1)], 0, 'ethereum').subtotal).toBe('0.3')
    expect(0.1 + 0.2).not.toBe(0.3) // o motivo de não usar number
    expect(priceCart([line('a', '0.000000000000000001', 3)], 0, 'solana').subtotal).toBe('0.000000000000000003')
  })

  test('desconto percentual em wei (piso) e taxa por rede', () => {
    const p = priceCart([line('a', '1.19', 1)], 10, 'ethereum')
    expect([p.subtotal, p.discount, p.total]).toEqual(['1.19', '0.119', '1.087'])
    // 5% de 0.000000000000000003 = 0.00000000000000000015 → piso = 0 wei
    expect(priceCart([line('a', '0.000000000000000003', 1)], 5, 'polygon').discount).toBe('0')
    expect(priceCart([line('a', '1', 1)], 0, 'polygon').networkFee).toBe(NETWORK_FEE.polygon)
    expect(priceCart([], 0, 'ethereum').total).toBe('0')
    expect(() => priceCart([line('a', '1', 1)], 101, 'ethereum')).toThrow()
  })
})

test.describe('merge do carrinho de visitante (cart-model.ts)', () => {
  const stock: Record<string, number> = { 'nft-1:ed': 4, 'nft-2:ed': 2, 'nft-3:ed': 5, 'nft-4:ed': 0 }
  const available = (n: string, e: string) => stock[`${n}:${e}`] ?? 0
  const l = (nftId: string, quantity: number) => ({ nftId, editionId: 'ed', quantity, priceAtAdd: '1' })

  test('soma quantidades, mantém a ordem, limita ao estoque e remove o que esgotou', () => {
    const r = mergeCartLines(
      { lines: [l('nft-1', 1), l('nft-2', 2)], couponCode: null },
      { lines: [l('nft-1', 2), l('nft-2', 1), l('nft-3', 1), l('nft-4', 1)], couponCode: 'KURIO10' },
      available,
      (id) => id.toUpperCase(),
    )
    expect(r.cart.lines.map((x) => [x.nftId, x.quantity])).toEqual([
      ['nft-1', 3],
      ['nft-2', 2],
      ['nft-3', 1],
    ])
    expect(r.adjusted).toEqual([
      { name: 'NFT-2', requested: 3, kept: 2 },
      { name: 'NFT-4', requested: 1, kept: 0 },
    ])
    expect(r.cart.couponCode).toBe('KURIO10')
    expect(r.merged).toBe(4)
  })

  test('determinístico: mesma entrada, mesma saída; cupom do usuário prevalece', () => {
    const user = { lines: [l('nft-3', 1)], couponCode: 'COLECAO5' }
    const guest = { lines: [l('nft-1', 1)], couponCode: 'KURIO10' }
    const a = mergeCartLines(user, guest, available, (x) => x)
    const b = mergeCartLines(user, guest, available, (x) => x)
    expect(a).toEqual(b)
    expect(a.cart.couponCode).toBe('COLECAO5')
    expect(user.lines[0]!.quantity).toBe(1) // entradas não são mutadas
  })
})

test.describe('contratos do checkout', () => {
  const quote = (over: Partial<Quote> = {}): Quote => ({
    id: 'qt_1',
    cartVersion: 1,
    network: 'ethereum',
    lines: [{ lineId: 'a', nftId: 'a', editionId: 'ed', name: 'A', unitPrice: '1.19', quantity: 1, lineTotal: '1.19' }],
    subtotal: '1.19',
    discount: '0',
    networkFee: '0.016',
    total: '1.206',
    coupon: null,
    expiresAt: '2026-01-01T00:00:00.000Z',
    ...over,
  })

  test('sameQuoteValues: id e validade não importam; qualquer valor importa', () => {
    expect(sameQuoteValues(quote(), quote({ id: 'qt_2', expiresAt: '2030-01-01T00:00:00.000Z', cartVersion: 9 }))).toBe(true)
    expect(sameQuoteValues(quote(), quote({ total: '1.207' }))).toBe(false)
    expect(sameQuoteValues(quote(), quote({ network: 'polygon' }))).toBe(false)
    expect(sameQuoteValues(quote(), quote({ lines: [{ ...quote().lines[0]!, unitPrice: '1.20' }] }))).toBe(false)
  })

  test('rede compatível com o endereço', () => {
    expect(networksForAddress('0xA91F7c2D3e4F5a6B7c8D9e0F1a2B3c4D5e6FE82C')).toEqual(['ethereum', 'polygon'])
    expect(networksForAddress('7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2')).toEqual(['solana'])
  })

  test('carteira de pagamento: cadastrada ou externa validada pela rede', () => {
    expect(PaymentWallet.safeParse({ kind: 'saved', walletId: 'wal_ana_1' }).success).toBe(true)
    expect(PaymentWallet.safeParse({ kind: 'external', network: 'solana', type: 'walletconnect', address: '0x1234567890abcdef1234567890abcdef12345678' }).success).toBe(false)
    expect(PaymentWallet.safeParse({ kind: 'external', network: 'polygon', type: 'metamask', address: '0x1234567890abcdef1234567890abcdef12345678' }).success).toBe(true)
  })

  test('cupom: normaliza para maiúsculas e exige código', () => {
    expect(ApplyCoupon.parse({ code: '  kurio10 ' }).code).toBe('KURIO10')
    expect(ApplyCoupon.safeParse({ code: '' }).success).toBe(false)
  })
})
