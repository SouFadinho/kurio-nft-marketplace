import { expect, test } from '@playwright/test'
import { QueryClient } from '@tanstack/react-query'
import type { Order, OrderUpdatedEvent } from '../../src/api/contracts'
import { queryKeys } from '../../src/api/queryKeys'
import { applyOrderUpdated } from '../../src/realtime/applyEvent'
import { EventGuard } from '../../src/realtime/eventGuard'

const USER = 'usr_ana'
const order = (over: Partial<Order> = {}): Order => ({
  id: 'ord_1',
  userId: USER,
  status: 'pending',
  version: 1,
  lines: [],
  total: '1.206',
  txHash: null,
  createdAt: '2026-11-25T12:00:00.000Z',
  ...over,
})
let seq = 0
const event = (status: Order['status'], version: number, eventId = `evt_${++seq}`): OrderUpdatedEvent => ({
  eventId,
  type: 'order.updated',
  resource: { type: 'order', id: 'ord_1' },
  version,
  occurredAt: '2026-11-25T12:00:01.000Z',
  userId: USER,
  data: { status, txHash: status === 'confirmed' ? '0xabc' : null, settledAt: '2026-11-25T12:00:01.000Z', failureReason: status === 'rejected' ? 'payment_rejected' : null },
})

function setup(initial: Order = order()) {
  const qc = new QueryClient()
  const key = queryKeys.me.order(USER, 'ord_1')
  qc.setQueryData(key, initial)
  return { qc, guard: new EventGuard(), read: () => qc.getQueryData<Order>(key)! }
}

test.describe('applyOrderUpdated (ciclo de vida do pedido no cliente)', () => {
  test('aplica a versão nova com status, hash, data e motivo', () => {
    const { qc, guard, read } = setup()
    expect(applyOrderUpdated(qc, guard, USER, event('confirmed', 2))).toBe('apply')
    expect(read()).toMatchObject({ status: 'confirmed', version: 2, txHash: '0xabc', settledAt: '2026-11-25T12:00:01.000Z' })
  })

  test('evento repetido (mesmo eventId) é descartado', () => {
    const { qc, guard, read } = setup()
    const e = event('rejected', 2, 'evt_dup')
    expect(applyOrderUpdated(qc, guard, USER, e)).toBe('apply')
    qc.setQueryData(queryKeys.me.order(USER, 'ord_1'), order({ status: 'pending', version: 1 })) // força estado antigo
    expect(applyOrderUpdated(qc, guard, USER, e)).not.toBe('apply')
    expect(read().status).toBe('pending')
  })

  test('versão antiga ou igual não sobrescreve', () => {
    const { qc, guard, read } = setup(order({ version: 3 }))
    expect(applyOrderUpdated(qc, guard, USER, event('rejected', 2))).not.toBe('apply')
    expect(applyOrderUpdated(qc, guard, USER, event('confirmed', 3))).not.toBe('apply')
    expect(read()).toMatchObject({ status: 'pending', version: 3 })
  })

  test('estado terminal não regride, nem com versão maior', () => {
    const { qc, guard, read } = setup(order({ status: 'confirmed', version: 2, txHash: '0xabc' }))
    expect(applyOrderUpdated(qc, guard, USER, event('rejected', 9))).not.toBe('apply')
    expect(applyOrderUpdated(qc, guard, USER, event('pending', 10))).not.toBe('apply')
    expect(read()).toMatchObject({ status: 'confirmed', version: 2 })
  })
})
