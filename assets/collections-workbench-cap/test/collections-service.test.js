const cds = require('@sap/cds')
const test = cds.test(__dirname + '/..')

let srv, OverdueAccounts, CollectionOutcomes, PaymentPromises

beforeAll(async () => {
  srv = await cds.connect.to('CollectionsService')
  ;({ OverdueAccounts, CollectionOutcomes, PaymentPromises } = srv.entities)
})

describe('refreshOverdueAccounts', () => {
  it('should return count of accounts loaded', async () => {
    const result = await srv.send('refreshOverdueAccounts', {})
    expect(result).toHaveProperty('count')
    expect(typeof result.count).toBe('number')
    expect(result.count).toBeGreaterThanOrEqual(0)
  })

  it('should classify aging buckets correctly after refresh', async () => {
    await srv.send('refreshOverdueAccounts', {})
    const accounts = await SELECT.from(OverdueAccounts)
    const validBuckets = ['1-30', '31-60', '61-90', '90+']
    for (const acct of accounts) {
      expect(validBuckets).toContain(acct.agingBucket_code)
    }
  })
})

describe('recordOutcome', () => {
  it('should create a CollectionOutcome record', async () => {
    const result = await srv.send('recordOutcome', {
      customerId: 'BP001',
      actionType: 'email_sent',
      notes: 'Test email outcome',
      aiDraftApproved: false
    })
    expect(result).toHaveProperty('ID')
    expect(result.actionType_code).toBe('email_sent')
    expect(result.customerId).toBe('BP001')
  })

  it('should reject if customerId is missing', async () => {
    await expect(
      srv.send('recordOutcome', { actionType: 'email_sent', notes: 'missing id' })
    ).rejects.toThrow()
  })
})

describe('checkBrokenPromises', () => {
  it('should mark overdue active promises as broken', async () => {
    const id = cds.utils.uuid()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const promiseDate = yesterday.toISOString().split('T')[0]

    await INSERT.into(PaymentPromises).entries({
      ID: id, customerId: 'BP002', customerName: 'Globex Industries',
      promisedAmount: 5000, currency: 'EUR',
      promiseDate, status_code: 'active'
    })

    const result = await srv.send('checkBrokenPromises', {})
    expect(result).toHaveProperty('broken')
    expect(result.broken).toBeGreaterThanOrEqual(1)

    const promise = await SELECT.one.from(PaymentPromises).where({ ID: id })
    expect(promise.status_code).toBe('broken')
  })
})
