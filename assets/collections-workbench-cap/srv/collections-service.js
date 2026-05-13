const cds = require('@sap/cds')
const LOG = cds.log('collections')

module.exports = class CollectionsService extends cds.ApplicationService {

  async init() {
    const { OverdueAccounts, ReminderLogs, CollectionOutcomes, PaymentPromises } = this.entities

    // ââ refreshOverdueAccounts ââââââââââââââââââââââââââââââââââââââââââââââââ
    this.on('refreshOverdueAccounts', async (req) => {
      try {
        // Attempt to connect to S/4HANA dunning remote service.
        // Falls back gracefully to mock data if destination not configured.
        let dunningRuns = []
        try {
          const s4 = await cds.connect.to('S4HANA_DUNNING')
          const result = await s4.run(
            SELECT.from('CADunning')
              .where({ CADunningBalance: { '>': 0 } })
              .columns('BusinessPartner','ContractAccount','CADunningLevel',
                       'CADunningBalance','TransactionCurrency','CACollectionStep',
                       'CANextDunningDate','CAIsSubmittedToCollAgency')
              .limit(100)
          )
          dunningRuns = result || []
        } catch (e) {
          LOG.warn('S/4HANA_DUNNING not available â using mock data:', e.message)
          dunningRuns = _mockDunningRuns()
        }

        const today = new Date()
        let count = 0

        for (const run of dunningRuns) {
          const daysOverdue = run.CANextDunningDate
            ? Math.floor((today - new Date(run.CANextDunningDate)) / 86400000)
            : 0
          const agingBucket = daysOverdue <= 30 ? '1-30'
            : daysOverdue <= 60 ? '31-60'
            : daysOverdue <= 90 ? '61-90' : '90+'

          await UPSERT.into(OverdueAccounts).entries({
            customerId:      run.BusinessPartner,
            customerName:    run.BusinessPartner, // name resolved via BP master if available
            companyCode:     run.CAStandardCompanyCode || '1000',
            totalOverdue:    run.CADunningBalance || 0,
            currency:        run.TransactionCurrency || 'EUR',
            agingBucket_code: agingBucket,
            dunningLevel:    run.CADunningLevel || '01',
            collectionStep:  run.CACollectionStep || '',
            nextDunningDate: run.CANextDunningDate || null,
            creditRiskClass: '',
            hasOpenDispute:  false,
            lastRefreshedAt: today.toISOString()
          })
          count++
        }

        // M1 milestone: overdue receivables loaded
        LOG.info(`M1.achieved: overdue receivables loaded â ${count} accounts`)
        return { count }
      } catch (e) {
        LOG.error(`M1.missed: failed to retrieve overdue receivables â ${e.message}`)
        return req.reject(500, `Failed to refresh overdue accounts: ${e.message}`)
      }
    })

    // ââ requestAiDraft ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
    this.on('requestAiDraft', async (req) => {
      const { customerId, agentBaseUrl } = req.data
      if (!customerId) return req.reject(400, 'customerId is required')

      const account = await SELECT.one.from(OverdueAccounts).where({ customerId })
      if (!account) return req.reject(404, `Account ${customerId} not found in workbench`)

      try {
        const base = agentBaseUrl || process.env.AGENT_BASE_URL || 'http://localhost:5000'
        const payload = {
          query: `Draft a collection email for customer ${customerId} (${account.customerName}).
Overdue amount: ${account.totalOverdue} ${account.currency}.
Aging bucket: ${account.agingBucket_code}. Dunning level: ${account.dunningLevel}.
Open dispute: ${account.hasOpenDispute}.`,
          context_id: `collections-${customerId}`
        }

        // Call agent via A2A /invoke
        const http = require('http')
        const data = JSON.stringify(payload)
        const url = new URL(`${base}/invoke`)

        const result = await new Promise((resolve, reject) => {
          const opts = {
            hostname: url.hostname, port: url.port || 5000,
            path: url.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
          }
          const r = http.request(opts, (res) => {
            let body = ''
            res.on('data', c => body += c)
            res.on('end', () => {
              try { resolve(JSON.parse(body)) } catch { resolve({ output: body }) }
            })
          })
          r.on('error', reject)
          r.setTimeout(15000, () => r.destroy(new Error('Agent timeout')))
          r.write(data); r.end()
        })

        const output = result.output || result.result || ''
        // Parse subject/body/tone from agent output (agent returns structured JSON or freetext)
        let subject = 'Payment Reminder', body = output, tone = 'firm'
        try {
          const parsed = typeof output === 'string' ? JSON.parse(output) : output
          if (parsed.subject) subject = parsed.subject
          if (parsed.body)    body    = parsed.body
          if (parsed.tone)    tone    = parsed.tone
        } catch { /* freetext response â use as body */ }

        // Log AI draft request as outcome
        await INSERT.into(CollectionOutcomes).entries({
          ID: cds.utils.uuid(), customerId, customerName: account.customerName,
          actionType_code: 'email_sent', actionDate: new Date().toISOString(),
          recordedBy: req.user?.id || 'system', notes: 'AI draft requested',
          aiRecommendationUsed: true, aiDraftApproved: false
        })

        return { subject, body, tone }
      } catch (e) {
        LOG.warn(`AI agent unavailable for ${customerId}: ${e.message}`)
        return {
          subject: 'Payment Reminder',
          body: `Dear Customer,\n\nWe notice that your account has an outstanding balance of ${account.totalOverdue} ${account.currency}.\n\nPlease arrange payment at your earliest convenience.\n\nKind regards,\nCollections Team`,
          tone: 'friendly'
        }
      }
    })

    // ââ recordOutcome âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
    this.on('recordOutcome', async (req) => {
      const { customerId, actionType, notes, aiDraftApproved } = req.data
      if (!customerId || !actionType) return req.reject(400, 'customerId and actionType are required')

      const account = await SELECT.one.from(OverdueAccounts).where({ customerId })

      const outcome = {
        ID: cds.utils.uuid(), customerId,
        customerName: account?.customerName || customerId,
        actionType_code: actionType,
        actionDate: new Date().toISOString(),
        recordedBy: req.user?.id || 'system',
        notes: notes || '',
        aiRecommendationUsed: false,
        aiDraftApproved: aiDraftApproved || false
      }
      await INSERT.into(CollectionOutcomes).entries(outcome)

      // M5 milestone: collection outcome recorded
      LOG.info(`M5.achieved: collection outcome recorded â account ${customerId}, action ${actionType}, user ${req.user?.id || 'system'}`)

      return await SELECT.one.from(CollectionOutcomes).where({ ID: outcome.ID })
    })

    // ââ checkBrokenPromises âââââââââââââââââââââââââââââââââââââââââââââââââââ
    this.on('checkBrokenPromises', async () => {
      const today = new Date().toISOString().split('T')[0]
      const broken = await UPDATE(PaymentPromises)
        .set({ status_code: 'broken' })
        .where({ status_code: 'active', promiseDate: { '<': today } })
      LOG.info(`checkBrokenPromises: ${broken} promises marked broken`)
      return { broken: broken || 0 }
    })

    await super.init()
  }
}

// ââ Mock data for local dev without S/4HANA âââââââââââââââââââââââââââââââââââ
function _mockDunningRuns() {
  return [
    { BusinessPartner: 'BP001', CADunningBalance: 15200, TransactionCurrency: 'EUR', CADunningLevel: '01', CACollectionStep: 'ST1', CANextDunningDate: _daysAgo(10), CAStandardCompanyCode: '1000' },
    { BusinessPartner: 'BP002', CADunningBalance: 45000, TransactionCurrency: 'EUR', CADunningLevel: '02', CACollectionStep: 'ST2', CANextDunningDate: _daysAgo(35), CAStandardCompanyCode: '1000' },
    { BusinessPartner: 'BP003', CADunningBalance: 8700,  TransactionCurrency: 'USD', CADunningLevel: '01', CACollectionStep: 'ST1', CANextDunningDate: _daysAgo(5),  CAStandardCompanyCode: '1000' },
    { BusinessPartner: 'BP004', CADunningBalance: 92000, TransactionCurrency: 'EUR', CADunningLevel: '03', CACollectionStep: 'ST3', CANextDunningDate: _daysAgo(70), CAStandardCompanyCode: '1000' },
    { BusinessPartner: 'BP005', CADunningBalance: 3200,  TransactionCurrency: 'EUR', CADunningLevel: '01', CACollectionStep: 'ST1', CANextDunningDate: _daysAgo(20), CAStandardCompanyCode: '1000' },
    { BusinessPartner: 'BP006', CADunningBalance: 125000,TransactionCurrency: 'EUR', CADunningLevel: '04', CACollectionStep: 'ST4', CANextDunningDate: _daysAgo(95), CAStandardCompanyCode: '1000' },
  ]
}
function _daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]
}
