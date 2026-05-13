# Specification: collections-workbench-cap

> **Guidelines**: Read [guidelines.md](../guidelines.md) and [guidelines-cap.md](../guidelines-cap.md) before executing ANY tasks below. Follow all constraints described there throughout execution.

## Basic Setup

- [ ] Read `product-requirements-document.md` and `intent.md` for full business context
- [ ] Invoke the `cap-development` skill from `assets/collections-workbench-cap/` to set up the CAP project structure
- [ ] Install dependencies (`npm install`), validate the project starts (`cds watch`) and responds

## CDS Data Model

- [ ] Create `assets/collections-workbench-cap/db/schema.cds` with the following entities:

### Entity: OverdueAccount (local projection/cache)
```
OverdueAccount {
  key customerId : String(10);
  customerName   : String(80);
  companyCode    : String(4);
  totalOverdue   : Decimal(15,2);
  currency       : String(3);
  agingBucket    : String(10);  // '1-30', '31-60', '61-90', '90+'
  dunningLevel   : String(2);
  collectionStep : String(4);
  nextDunningDate: Date;
  creditRiskClass: String(4);
  hasOpenDispute : Boolean default false;
  lastRefreshedAt: Timestamp;
}
```

### Entity: ReminderLog
```
ReminderLog {
  key ID          : UUID;
  customerId      : String(10);
  customerName    : String(80);
  reminderStep    : Integer;   // 1=gentle, 2=firm, 3=final warning
  sentAt          : Timestamp;
  sentBy          : String(50); // 'automated' or user ID
  emailSubject    : String(200);
  status          : String(20) enum { sent; pending; failed; };
}
```

### Entity: CollectionOutcome
```
CollectionOutcome {
  key ID              : UUID;
  customerId          : String(10);
  actionType          : String(30) enum { email_sent; order_hold; dispute_escalation; collection_agency; promise_to_pay; no_action; };
  actionDate          : Timestamp;
  recordedBy          : String(50);
  notes               : String(500);
  paymentPromiseDate  : Date;
  aiRecommendationUsed: Boolean default false;
  aiDraftApproved     : Boolean default false;
}
```

### Entity: PaymentPromise
```
PaymentPromise {
  key ID            : UUID;
  customerId        : String(10);
  customerName      : String(80);
  promisedAmount    : Decimal(15,2);
  currency          : String(3);
  promiseDate       : Date;
  status            : String(20) enum { active; fulfilled; broken; };
  createdAt         : Timestamp;
  createdBy         : String(50);
}
```

## CDS Service Definition

- [ ] Create `assets/collections-workbench-cap/srv/collections-service.cds`:
  - Expose `OverdueAccount` (read-only, no insert from UI — populated by CAP handler from S/4HANA)
  - Expose `ReminderLog` (read + create)
  - Expose `CollectionOutcome` (read + create + update status)
  - Expose `PaymentPromise` (full CRUD)
  - Define action: `refreshOverdueAccounts()` — triggers re-fetch from S/4HANA Dunning API
  - Define action: `requestAiDraft(customerId: String, agentBaseUrl: String) returns { subject: String, body: String, tone: String }`
  - Define action: `recordOutcome(customerId: String, actionType: String, notes: String, aiDraftApproved: Boolean)`

## CAP Custom Handlers

- [ ] Create `assets/collections-workbench-cap/srv/collections-handler.js`

### Handler: refreshOverdueAccounts
- [ ] On `refreshOverdueAccounts()` action:
  - Call S/4HANA Dunning API (`CADUNNING_0001`) via CDS remote service using `cds.connect.to('S4HANA_DUNNING')`
  - Fetch dunning runs with outstanding balance > 0 and dunning level > 0
  - Map to `OverdueAccount` entities with correct aging bucket calculation based on `CANextDunningDate` vs. today
  - Upsert into local DB using `UPSERT INTO OverdueAccount VALUES(...)`
  - Return count of accounts refreshed

### Handler: requestAiDraft
- [ ] On `requestAiDraft(customerId, agentBaseUrl)` action:
  - Validate `customerId` exists in `OverdueAccount`
  - Call Collections AI Agent via HTTP POST to `{agentBaseUrl}/invoke` with customer context payload
  - Parse agent response and return `{ subject, body, tone }`
  - On agent error: return graceful error with message "AI agent unavailable — please draft manually"
  - Log the AI draft request in `CollectionOutcome` with `aiRecommendationUsed: true`

### Handler: recordOutcome
- [ ] On `recordOutcome(customerId, actionType, notes, aiDraftApproved)` action:
  - Insert `CollectionOutcome` record
  - If `actionType === 'email_sent'`, update `ReminderLog` status to `sent`
  - Emit milestone log: `M5.achieved: collection outcome recorded — account {customerId}, action {actionType}, user {req.user.id}`

### Handler: Payment Promise broken detection
- [ ] Register a scheduled check (or on-demand via action) that sets `PaymentPromise.status` to `broken` if `promiseDate < today AND status === 'active'`

## Remote Service Configuration (S/4HANA)

- [ ] Create `assets/collections-workbench-cap/srv/external/S4HANA_DUNNING.cds` — CDS projection of the Dunning OData service (entities: `CADunning`, `CADunningItem`)
- [ ] Add S/4HANA destination configuration in `package.json` under `cds.requires`:
  ```json
  "S4HANA_DUNNING": {
    "kind": "odata-v4",
    "model": "srv/external/S4HANA_DUNNING",
    "[production]": {
      "credentials": { "destination": "S4HANA_CLOUD_PUBLIC" }
    }
  }
  ```
- [ ] Mock the remote service in `test/` with minimal sample data (5–10 overdue accounts across aging buckets)

## React Frontend

- [ ] Invoke `cap-development` skill frontend scaffolding to create the React UI in `assets/collections-workbench-cap/ui/`

### Pages & Components

**Dashboard (Home)**
- [ ] `OverdueDashboard` component — KPI cards: Total Overdue Amount, Accounts 30+ Days, Accounts 60+ Days, Accounts 90+ Days
- [ ] `AgingBucketTable` component — table of overdue accounts grouped by aging bucket; columns: Customer, Total Overdue, Currency, Dunning Level, Collection Step, Dispute Flag, Next Dunning Date; sortable by overdue amount and days overdue
- [ ] `RefreshButton` — triggers `refreshOverdueAccounts()` action; shows last refreshed timestamp
- [ ] Filter bar: filter by aging bucket, credit risk class, dispute flag

**Account Detail View**
- [ ] `AccountDetailPanel` — shows full account context: aging bucket, dunning level, credit risk class, open disputes, last reminder date
- [ ] `ReminderHistory` sub-component — list of past reminders with date, step, status
- [ ] `OutcomeHistory` sub-component — list of recorded outcomes with type, date, user
- [ ] `PaymentPromiseCard` sub-component — active promise with status badge; broken promise highlighted in red

**AI Assistant Panel**
- [ ] `AiAssistantPanel` — right-side panel on Account Detail view
- [ ] "Generate Email Draft" button — calls `requestAiDraft()` action; shows loading spinner
- [ ] `EmailDraftEditor` — editable textarea pre-populated with AI draft; shows tone badge (friendly / firm / final warning / dispute-sensitive)
- [ ] "Approve & Send" button — calls `recordOutcome()` with `actionType='email_sent'` and `aiDraftApproved=true`
- [ ] "Edit & Send Manually" button — enables free editing; calls `recordOutcome()` with `aiDraftApproved=false`
- [ ] Escalation Recommendation section — displays recommended action with rationale if agent returned one; "Approve Escalation" button (AR Manager role only)

**Portfolio View (AR Manager)**
- [ ] `PortfolioView` — aggregate aging chart (bar chart by aging bucket); top 10 highest-risk accounts table
- [ ] `EscalationQueue` — list of accounts with pending escalation recommendations awaiting approval

### UI Routing
- [ ] Route `/` → Dashboard
- [ ] Route `/accounts/:customerId` → Account Detail + AI Assistant Panel
- [ ] Route `/portfolio` → Portfolio View (role-gated: AR Manager only)

## Authorization
- [ ] Define two roles in `xs-security.json`:
  - `CollectionsAgent` — read/write `OverdueAccount`, `ReminderLog`, `CollectionOutcome`, `PaymentPromise`; can call `requestAiDraft` and `recordOutcome`
  - `ARManager` — all `CollectionsAgent` permissions + approve escalation actions in `CollectionOutcome`
- [ ] Annotate service entities with `@requires` in CDS

## asset.yaml
- [ ] Create `assets/collections-workbench-cap/asset.yaml` with CAP app configuration (see guidelines-cap.md template)
- [ ] Set `metadata.name: collections-workbench`

## Testing
- [ ] Run `cds compile srv/` to validate all CDS models compile without errors
- [ ] Write tests for custom handler logic in `assets/collections-workbench-cap/test/`:
  - [ ] `test-refresh-overdue-accounts.js` — mock S4HANA_DUNNING remote service; verify aging bucket calculation for all 4 buckets
  - [ ] `test-record-outcome.js` — verify outcome records created correctly; M5 log emitted
  - [ ] `test-payment-promise.js` — verify broken promise detection sets status correctly
  - Run each test immediately after writing
- [ ] Run `cds watch` and verify service starts without errors
- [ ] Verify all React components render without console errors (run `npm test` in `ui/`)
