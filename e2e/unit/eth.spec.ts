import { expect, test } from '@playwright/test'
import { addEth, formatEth, mulEth, parseEth, toEthString } from '../../src/lib/eth'

test.describe('lib/eth (bigint em wei)', () => {
  test('soma exata onde number falha', () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(toEthString(addEth(parseEth('0.1'), parseEth('0.2')))).toBe('0.3')
  })

  test('total do carrinho desktop do Figma fecha exatamente', () => {
    const total = addEth(mulEth(parseEth('1.19'), 2), mulEth(parseEth('1.39'), 6), mulEth(parseEth('1.79'), 9))
    expect(toEthString(total)).toBe('26.83')
    expect(toEthString(addEth(total, parseEth('0.016')))).toBe('26.846')
  })

  test('18 casas decimais preservadas', () => {
    expect(toEthString(addEth(parseEth('0.000000000000000001'), parseEth('1')))).toBe('1.000000000000000001')
  })

  test('formatação half-up para exibição', () => {
    expect(formatEth('1.19')).toBe('1.19 ETH')
    expect(formatEth('8.936')).toBe('8.936 ETH')
    expect(formatEth('0.00005')).toBe('0.0001 ETH')
    expect(formatEth('2')).toBe('2.00 ETH')
  })

  test('rejeita entradas inválidas', () => {
    expect(() => parseEth('1,19')).toThrow()
    expect(() => parseEth('-1')).toThrow()
    expect(() => mulEth(parseEth('1'), 1.5)).toThrow()
  })
})
