# Specification: n8n

> **Guidelines**: Read [guidelines.md](../guidelines.md) and [guidelines-n8n-workflow.md](../guidelines-n8n-workflow.md) before executing ANY tasks below. Follow all constraints described there throughout execution.

## Basic Setup

- [ ] Read `product-requirements-document.md` and `intent.md` for full business context
- [ ] Create directory `assets/n8n/workflows/`

## Workflow 1: Payment Reminder Escalation Sequence

**File**: `assets/n8n/workflows/payment-reminder-escalation.n8n.json`

This workflow runs on a daily schedule, queries the Collections Workbench CAP service for overdue accounts, and dispatches tiered payment reminder emails based on days overdue.

### Nodes to implement:

- [ ] **Schedule Trigger** — cron: every day at 07:00 UTC; node type: `n8n-nodes-base.scheduleTrigger`

- [ ] **Get Overdue Accounts** — HTTP Request to CAP service `/odata/v4/collections/OverdueAccount?$filter=agingBucket ne '0'&$orderby=totalOverdue desc` — retrieve all active overdue accounts; URL parameterised as `{{CAP_SERVICE_BASE_URL}}`

- [ ] **Filter: Only Actionable Accounts** — Code node (JavaScript): filter out accounts where `hasOpenDispute === true AND dunningLevel < '02'` (do not auto-remind if there is a low-level open dispute on first notice); pass all others to reminder logic

- [ ] **Split Into Items** — `n8n-nodes-base.splitInBatches` or item-level processing to handle each account individually

- [ ] **Determine Reminder Step** — Code node (JavaScript):
  - agingBucket `1-30` AND dunningLevel `'01'` → Step 1 (gentle reminder)
  - agingBucket `31-60` OR dunningLevel `'02'` → Step 2 (firm notice)
  - agingBucket `61-90` OR dunningLevel `'03'` → Step 3 (final warning — flag for manager review)
  - agingBucket `90+` OR dunningLevel ≥ `'04'` → Step 4 (escalation flag — do NOT send email; notify AR manager)
  - Output fields: `customerId`, `customerName`, `reminderStep`, `totalOverdue`, `currency`, `agingBucket`, `dunningLevel`

- [ ] **Switch: Route by Reminder Step** — `n8n-nodes-base.switch` node routing to separate branches for steps 1, 2, 3, and escalation flag

- [ ] **Step 1 — Gentle Reminder Email** — `n8n-nodes-base.emailSend` (or HTTP Request to email relay):
  - Subject: `Payment Reminder — Invoice(s) Overdue`
  - Body: friendly template referencing `{{customerName}}`, `{{totalOverdue}}`, `{{currency}}`; payment link placeholder `{{PAYMENT_PORTAL_URL}}`
  - Note: credentials configured manually in n8n UI after import

- [ ] **Step 2 — Firm Notice Email**:
  - Subject: `Second Payment Notice — Action Required`
  - Body: firm tone; reference overdue amount, request confirmation of payment date within 5 business days

- [ ] **Step 3 — Final Warning Email**:
  - Subject: `Final Notice Before Escalation — {{customerName}}`
  - Body: final warning tone; state that account may be placed on hold if payment not received within 3 business days

- [ ] **Step 4 — Escalation Flag: Notify AR Manager** — HTTP Request POST to CAP action `/odata/v4/collections/requestEscalationReview` with `customerId` and `reason: 'auto_escalation_threshold'`; also send internal notification email to AR manager distribution list `{{AR_MANAGER_EMAIL}}`

- [ ] **Log Reminder Sent** — HTTP Request POST to CAP service action `/odata/v4/collections/ReminderLog` to record: `customerId`, `reminderStep`, `sentAt`, `sentBy: 'automated'`, `status: 'sent'`
  - Connect after each email step (Steps 1, 2, 3)
  - On HTTP error: route to **Log Failure** node

- [ ] **Log Failure** — Code node: log error details; HTTP Request POST to CAP `ReminderLog` with `status: 'failed'` and error message

- [ ] **Summary Report** — Code node: aggregate counts per step; HTTP Request POST to `{{AR_MANAGER_EMAIL}}` with daily summary: accounts processed, reminders sent by step, escalations flagged

### Workflow Variables (configure in n8n instance before activation):
```
CAP_SERVICE_BASE_URL     — e.g. https://collections-workbench.cfapps.eu10.hana.ondemand.com
PAYMENT_PORTAL_URL       — customer payment portal URL
AR_MANAGER_EMAIL         — AR manager or distribution list email address
```

---

## Workflow 2: Payment Promise Follow-Up

**File**: `assets/n8n/workflows/payment-promise-followup.n8n.json`

This workflow runs daily, checks for payment promises that are due today or overdue, and sends follow-up alerts.

### Nodes to implement:

- [ ] **Schedule Trigger** — cron: every day at 08:00 UTC

- [ ] **Get Active Promises** — HTTP Request GET to CAP service `/odata/v4/collections/PaymentPromise?$filter=status eq 'active' and promiseDate le {{today}}`; use Code node to inject today's date dynamically

- [ ] **Filter: Promises Due or Overdue** — Code node: separate promises into:
  - `due_today` — promiseDate === today
  - `overdue` — promiseDate < today

- [ ] **Follow-Up Email: Due Today** — Email send to collections agent (internal): subject `Payment Promise Due Today — {{customerName}}`; body listing promise amount and due date; prompt agent to verify payment in system

- [ ] **Mark Broken + Alert: Overdue Promise** — HTTP Request PATCH to CAP `PaymentPromise/{ID}` to set `status: 'broken'`; then send internal alert to collections agent with recommended follow-up action

- [ ] **Log Outcome** — HTTP Request POST to CAP `CollectionOutcome` for each broken promise with `actionType: 'promise_broken'`

---

## Workflow 3: Weekly AR Portfolio Summary

**File**: `assets/n8n/workflows/weekly-ar-portfolio-summary.n8n.json`

Sends AR managers a weekly overview of the overdue portfolio.

### Nodes to implement:

- [ ] **Schedule Trigger** — cron: every Monday at 07:00 UTC

- [ ] **Get Portfolio Summary** — HTTP Request GET to CAP `/odata/v4/collections/OverdueAccount?$apply=groupby((agingBucket),aggregate(totalOverdue with sum as bucketTotal,customerId with countdistinct as accountCount))`

- [ ] **Get Escalation Queue** — HTTP Request GET to CAP `/odata/v4/collections/CollectionOutcome?$filter=actionType eq 'order_hold' or actionType eq 'collection_agency'&$orderby=actionDate desc&$top=20`

- [ ] **Format Summary** — Code node: build HTML email body with:
  - Aging bucket table: bucket, account count, total overdue amount
  - Top 5 highest-risk accounts (sorted by total overdue)
  - Escalation actions taken this week

- [ ] **Send Summary Email** — Email send to `{{AR_MANAGER_EMAIL}}` with subject `Weekly AR Portfolio Summary — {{currentWeek}}`

---

## Validation

- [ ] Validate all three workflow JSON files are well-formed (parse with `node -e "JSON.parse(require('fs').readFileSync('...'))"`)
- [ ] Verify all node `connections` reference nodes by `name` not `id`
- [ ] Verify no `credentials` blocks exist in any workflow JSON
- [ ] Verify all CAP service URLs are parameterised as `{{CAP_SERVICE_BASE_URL}}` — never hard-coded
- [ ] Verify no `authentication` or `genericAuthType` fields exist on HTTP Request nodes
