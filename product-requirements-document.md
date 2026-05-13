# Product Requirements Document (PRD)

**Title:** Collections Workbench with AI-Assisted Receivables Recovery  
**Date:** 2026-05-13  
**Owner:** AR Operations / Finance Technology  
**Solution Category:** BTP Extension, n8n Workflow, AI Agent

---

## Product Purpose & Value Proposition

**Elevator Pitch:**  
Collections teams spend hours manually reviewing aging reports, sending generic dunning notices, and deciding when to escalate. This solution replaces that fragmented process with a unified workbench that surfaces overdue receivables from S/4HANA, automates tiered reminder sequences, and provides an AI agent that reasons over each customer's payment history to draft personalised emails and recommend the right next action.

**Business Need:**  
There is no single system where collections agents can see overdue receivables, track reminder status, and act — they switch between S/4HANA transaction views, spreadsheets, and email manually. Standard S/4HANA dunning is rules-based and generates uniform notices regardless of customer relationship or payment behaviour. Escalation decisions are informal and inconsistent.

**Expected Value:**

- Reduced time-to-first-contact on overdue accounts through automated reminders
- Higher recovery rates from context-aware, personalised communications
- Consistent escalation decisions grounded in account data rather than individual judgment
- Reduced manual workload for collections agents and AR managers

**Product Objectives (Prioritized):**

1. Provide a single workbench view of all overdue customer receivables grouped by aging bucket
2. Automate multi-step payment reminder sequences with configurable escalation timing
3. Enable AI-assisted drafting of personalised collection emails and escalation recommendations per account
4. Record collection outcomes and reflect updated status in the workbench

---

## User Profiles & Personas

### Primary Persona: Maya — Collections Specialist

Maya is a 34-year-old collections specialist at a mid-size manufacturing company. She manages a portfolio of 120+ customer accounts, spending most of her day cross-referencing S/4HANA aging reports with email threads to identify who needs follow-up. She manually drafts dunning emails, often reusing templates that do not reflect each customer's history. She is frustrated that a long-standing customer who has paid late once gets the same generic notice as a chronic late payer. She is comfortable with SAP but has limited experience with AI tools. She measures her success by the percentage of overdue amounts collected each month.

### Secondary Persona: Daniel — Accounts Receivable Manager

Daniel is a 45-year-old AR manager responsible for the overall health of the receivables portfolio. He reviews weekly aging reports, approves escalation actions (order holds, collection agency referrals), and answers questions from the CFO about overdue exposure. He does not process individual accounts day-to-day but needs a clear portfolio view and confidence that the right escalation actions are being taken. He is data-driven and wants evidence-based recommendations rather than gut-feel escalations.

### Other User Types

- **SAP S/4HANA Administrator** — manages API connectivity and system configuration
- **IT / BTP Administrator** — manages BTP deployment, credential management, and n8n workflow operations

---

## User Goals & Tasks

### For Maya (Collections Specialist):

**Goals:**
- Know which accounts need action today without manually building reports
- Send effective, personalised payment reminders without drafting from scratch each time
- Understand each customer's payment behaviour before making contact

**Key Tasks:**
- Open the workbench and view overdue accounts sorted by risk or amount
- Select an account and review its payment history, dunning history, and dispute status
- Request an AI-generated email draft tailored to the account and approve or edit it
- Send the email and log the outcome in the workbench

### For Daniel (AR Manager):

**Goals:**
- Have an up-to-date portfolio view of overdue exposure at any time
- Approve or override escalation actions recommended by the AI agent
- Track whether reminder sequences are producing results

**Key Tasks:**
- View portfolio-level aging dashboard with drill-down by customer
- Review AI escalation recommendations (order hold, agency referral) and approve or reject
- Monitor reminder sequence status across the portfolio

---

## Product Principles

1. **Data-driven personalisation**: Every collection communication should be informed by the customer's actual payment behaviour — not a template.
2. **Human-in-the-loop**: The AI proposes actions and drafts; humans approve before sending or escalating.
3. **Single source of truth**: Overdue receivables data is always sourced from S/4HANA — no manual data entry or parallel spreadsheets.
4. **Fail gracefully**: If S/4HANA APIs are unavailable or the AI agent cannot generate a recommendation, the workbench degrades to read-only mode with a clear status indicator.

---

## Business Context

**Current State:**  
Collections agents use S/4HANA transaction views (FBL5N, F150 dunning) and manual email for customer follow-up. There is no unified workbench. Reminder sequences are manually triggered. Email drafts are generic templates. Escalation decisions are informal.

**Strategic Alignment:**  
Improving working capital and reducing days sales outstanding (DSO) is a Finance priority. This solution directly reduces overdue exposure and collection cycle time by automating routine steps and improving communication quality.

**Success Criteria:**

- 100% of overdue accounts visible in the workbench within 24 hours of becoming overdue in S/4HANA
- Automated reminder sequences cover all accounts without manual triggering
- AI agent produces an accepted email draft (approved or lightly edited) in at least 70% of interactions
- Escalation recommendations aligned with manager approval in at least 80% of cases

---

## Goals and Non-Goals

### Goals (In Scope)

- Unified BTP-hosted workbench displaying overdue receivables from S/4HANA (aging, dunning history, credit status, disputes)
- n8n workflow automating tiered payment reminder sequences based on days overdue and customer segment
- AI agent reasoning over account context to draft personalised collection emails and recommend escalation actions
- Human review and approval step before emails are sent or escalation actions are triggered
- Outcome logging reflected in the workbench

### Non-Goals (Out of Scope)

- Replacing S/4HANA as the system of record for financial postings
- Automated payment posting or cash application
- Customer self-service portal for dispute submission
- Integration with external debt collection systems (flagged as future phase)
- SMS or in-app notification channels (email only in this release)

---

## Requirements

### Must-Have Requirements

**R1: Overdue Receivables Dashboard**

- **Problem to Solve**: Collections agents have no single view of all overdue customer accounts and must manually compile aging data from S/4HANA.
- **User Story**: As a collections specialist, I need a dashboard showing all overdue open items grouped by aging bucket so that I can prioritise which accounts to action first.
- **Acceptance Criteria**:
  - Given a collections agent logs in, when the workbench loads, then all open items overdue by at least 1 day are displayed, grouped by aging bucket (1–30, 31–60, 61–90, 90+ days).
  - Given an account is selected, when the detail view opens, then dunning history, credit status, dispute flags, and payment trend are visible.
- **Maps to Objective**: Objective 1
- **Priority Rank**: 1

**R2: Multi-Step Payment Reminder Automation**

- **Problem to Solve**: Reminder sequences are triggered manually, leading to inconsistent follow-up timing and missed accounts.
- **User Story**: As a collections specialist, I need overdue accounts to automatically receive tiered reminders based on days overdue so that no account is missed and escalation follows a consistent schedule.
- **Acceptance Criteria**:
  - Given an account becomes overdue, when the n8n workflow runs (daily schedule), then the appropriate reminder step is triggered based on the configured escalation ladder.
  - Given a reminder is sent, when the outcome is recorded, then the workflow advances the account to the next step or closes the sequence.
- **Maps to Objective**: Objective 2
- **Priority Rank**: 2

**R3: AI-Assisted Collection Email Drafting**

- **Problem to Solve**: Collection emails are generic templates that do not reflect the customer's payment behaviour or relationship context.
- **User Story**: As a collections specialist, I need the AI agent to draft a personalised collection email for a selected account so that I can send a more effective communication without starting from scratch.
- **Acceptance Criteria**:
  - Given a collections agent selects an account and requests an email draft, when the AI agent analyses dunning history, payment trend, credit status, and dispute flags, then a contextually appropriate draft is produced within 10 seconds.
  - Given the draft is produced, when the agent reviews it, then they can edit or approve before sending.
- **Maps to Objective**: Objective 3
- **Priority Rank**: 3

**R4: AI-Driven Escalation Recommendation**

- **Problem to Solve**: Escalation decisions (order hold, dispute escalation, collection agency) are informal and inconsistent across the team.
- **User Story**: As an AR manager, I need the AI agent to recommend the appropriate escalation action for a high-risk account so that escalation decisions are consistent and evidence-based.
- **Acceptance Criteria**:
  - Given an account meets risk thresholds (e.g. 60+ days overdue, high outstanding amount, no payment promise), when the AI agent is invoked, then a recommended action is provided with a rationale grounded in account data.
  - Given a recommendation is produced, when the AR manager reviews it, then they can approve, reject, or override with a comment.
- **Maps to Objective**: Objective 3
- **Priority Rank**: 4

**R5: Collection Outcome Recording**

- **Problem to Solve**: There is no way to track whether reminders and escalation actions are producing results without manual log-keeping.
- **User Story**: As a collections specialist, I need to log the outcome of each interaction so that the workbench reflects current account status and the reminder sequence progresses correctly.
- **Acceptance Criteria**:
  - Given an email is sent or an escalation action is taken, when the agent records the outcome, then the account status in the workbench is updated and the n8n reminder sequence advances accordingly.
- **Maps to Objective**: Objective 4
- **Priority Rank**: 5

### High-Want Requirements

**R6: Portfolio-Level Aging Analytics**

- **Problem to Solve**: AR managers cannot quickly assess total overdue exposure or identify trends without running manual reports.
- **User Story**: As an AR manager, I need a portfolio-level view with total overdue amounts by aging bucket and customer segment so that I can report on receivables health.
- **Priority Rank**: 1

**R7: Payment Promise Tracking**

- **Problem to Solve**: When a customer commits to a payment date, there is no structured way to track whether they follow through.
- **User Story**: As a collections specialist, I need to record a payment promise and have the system remind me if the promise date passes without payment so that I can follow up promptly.
- **Priority Rank**: 2

### Nice-to-Have Requirements

**R8: Escalation History Timeline**

- **Problem to Solve**: Managers cannot see the full escalation history for an account in one view.
- **User Story**: As an AR manager, I need a timeline view of all interactions and escalation steps for an account so that I can make informed decisions on next actions.
- **Priority Rank**: 1

---

## Non-Functional Requirements

### Performance

- **Latency**: Workbench initial load under 3 seconds; AI agent email draft under 10 seconds.
- **Throughput**: Support up to 500 concurrent account lookups; AI agent handles up to 50 simultaneous drafting requests.

### Reliability

- **Availability**: BTP workbench available 99.5% during business hours.
- **Fallback**: If S/4HANA APIs are unavailable, workbench displays last-cached data with a staleness indicator. AI agent returns a graceful error if LLM service is unavailable.

### Explainability

- **Traceability**: AI recommendations include a brief rationale citing the data points used (e.g. "3 consecutive late payments, current outstanding EUR 45,000, no active dispute").
- **Decision Logging**: All AI-generated drafts, recommendations, and human approvals/overrides are logged with timestamps.
- **Uncertainty Communication**: AI agent surfaces a confidence indicator; low-confidence recommendations prompt the agent to suggest manual review.

---

## Solution Architecture

**Architecture Overview:**  
Three components deployed on SAP BTP: a CAP backend + React frontend (Collections Workbench), an n8n workflow engine (Reminder Automation), and a Python AI agent (Collections Agent). All three consume S/4HANA Cloud Public APIs. The AI agent additionally uses the Dunning History MCP server available in the customer's landscape.

**Key Components:**

- **Collections Workbench (CAP + React)** — BTP-hosted UI with CAP Node.js backend; aggregates overdue receivables from S/4HANA APIs and surfaces AI agent output inline.
- **Payment Reminder Workflow (n8n)** — Scheduled daily workflow that queries overdue items, evaluates escalation rules, triggers email reminders, and updates account reminder status.
- **Collections AI Agent (Python, A2A)** — Autonomous agent with tools for dunning history (MCP), open items, credit management, and dispute data; produces email drafts and escalation recommendations.

**Integration Points:**

- S/4HANA Cloud Public — Contract Accounting Dunning API (`CADUNNING_0001`), Payment Advice API (`CE_PAYMENTADVICE_0001`), Dispute API (`CE_API_DISPUTE_MANAGE_0001`), Credit Management API (`API_CRDTMBUSINESSPARTNER`) — read, inbound to BTP, on-demand and scheduled
- Dunning History MCP Server (`sap.mcpbuilder:apiResource:contract_accounting_dunning_history_mcp_demo:v1`) — consumed by the AI agent for structured dunning history queries
- Email gateway (SMTP or SAP Integration Suite) — outbound email delivery for reminder sequences

**Deployment Environments:**

- **Dev**: BTP sub-account with sandbox S/4HANA API credentials; isolated from production data
- **QA**: BTP sub-account connected to S/4HANA quality system; used for integration and UAT
- **Prod**: BTP sub-account connected to S/4HANA production; production email delivery enabled

### Agent Extensibility & Instrumentation

**Agent Extensibility:**

- The Collections AI Agent is designed with extension points to allow additional tools to be registered without modifying core agent logic (A2A protocol).
- Extensible capabilities: new data sources (e.g. CRM interaction history, external credit bureau data), additional communication channels (SMS, in-app), and custom escalation rule tools.
- Extension points are declared in the agent's tool registry; administrators can add approved tools without redeployment.

**Business Step Instrumentation:**

- Each of the five key milestones below maps to an instrumented log statement emitted by the AI agent at runtime.
- Log statements follow the pattern: `[MILESTONE_ID].[achieved|missed]: [description]`
- Structured logs are forwarded to SAP Cloud Logging for monitoring and alerting.

### Automation & Agent Behaviour

**Automation Level:** Hybrid — rule-based for reminder sequencing (n8n); autonomous AI agent for email drafting and escalation recommendations.

**Actions the system performs without human approval:**

- Triggering scheduled reminder emails at configured escalation steps (n8n workflow)
- Querying S/4HANA APIs to refresh overdue receivables data
- Generating email drafts and escalation recommendations (AI agent, read-only reasoning)

**Actions that require human review or approval:**

- Sending a collection email to a customer
- Triggering an order hold
- Escalating to a collection agency
- Overriding a scheduled reminder step

**Model or engine used:** GPT-4o via SAP Generative AI Hub (AI agent reasoning and email drafting); n8n rule engine (reminder sequencing).

**Knowledge & data sources accessed:**

- S/4HANA Cloud Public — dunning history, open items, payment advice, credit management master data, dispute cases (authoritative source of truth)
- Dunning History MCP Server — structured dunning event history per customer, read-only

**Tools or connectors invoked:**

- `get_dunning_history` — queries Dunning History MCP; read-only
- `get_open_items` — queries S/4HANA open items API; read-only
- `get_credit_status` — queries S/4HANA credit management API; read-only
- `get_dispute_cases` — queries S/4HANA dispute API; read-only
- `draft_collection_email` — generates personalised email using LLM; no side effects
- `recommend_escalation_action` — evaluates account risk signals and returns recommended action with rationale; no side effects

**Guardrails & fail-safes:**

- Agent never writes back to S/4HANA autonomously — all financial record modifications remain in S/4HANA and are triggered only by human action
- Escalation actions (order hold, agency referral) require explicit AR manager approval before execution
- If LLM service returns an error, the agent surfaces a fallback message and prompts the user to retry or proceed manually
- Agent does not process or store personally identifiable information beyond what is returned in the current session from S/4HANA APIs

---

## Milestones

### M1: Overdue Receivables Identified

- **Description**: The workbench successfully retrieves and displays all overdue open items from S/4HANA for the active user's portfolio.
- **Achieved when**: At least one overdue open item is returned and rendered in the dashboard, grouped by aging bucket.
- **Log on achievement**: `M1.achieved: overdue receivables loaded — {count} accounts, {total_overdue_amount} total overdue`
- **Log on miss**: `M1.missed: failed to retrieve overdue receivables from S/4HANA — {error_detail}`

### M2: Reminder Sequence Triggered

- **Description**: The n8n workflow identifies an overdue account and dispatches the appropriate escalation step reminder.
- **Achieved when**: A reminder email is generated and queued for sending for at least one account in the current workflow run.
- **Log on achievement**: `M2.achieved: reminder sequence step triggered — account {customer_id}, step {step_number}, days_overdue {days}`
- **Log on miss**: `M2.missed: reminder sequence did not trigger for account {customer_id} — {reason}`

### M3: AI Email Draft Generated

- **Description**: The AI agent produces a personalised collection email draft for a selected account.
- **Achieved when**: A non-empty email draft is returned by the agent within 10 seconds of the request.
- **Log on achievement**: `M3.achieved: email draft generated — account {customer_id}, model {model_id}, tokens_used {tokens}`
- **Log on miss**: `M3.missed: email draft generation failed — account {customer_id}, reason {error_detail}`

### M4: Escalation Action Recommended

- **Description**: The AI agent evaluates account risk signals and produces a recommended escalation action with rationale.
- **Achieved when**: A structured recommendation (action type + rationale) is returned for the queried account.
- **Log on achievement**: `M4.achieved: escalation recommendation produced — account {customer_id}, action {recommended_action}, confidence {confidence_score}`
- **Log on miss**: `M4.missed: escalation recommendation not produced — account {customer_id}, reason {error_detail}`

### M5: Collection Outcome Recorded

- **Description**: The collections agent or AR manager approves an action and the outcome is persisted in the workbench.
- **Achieved when**: An outcome record is written to the CAP backend for the account interaction.
- **Log on achievement**: `M5.achieved: collection outcome recorded — account {customer_id}, action {action_taken}, user {user_id}`
- **Log on miss**: `M5.missed: outcome recording failed — account {customer_id}, reason {error_detail}`

---

## Governance, Risk & Compliance

**Data Handling:**

- All receivables data resides in S/4HANA; BTP components cache data transiently per session only.
- Customer names and account numbers are considered business-sensitive; access is role-controlled via BTP XSUAA.
- AI agent does not persist customer data beyond the active reasoning session.

**Compliance Frameworks:**

- GDPR: No personal data is stored in BTP beyond transient session scope; customer contact data used for email delivery only.
- Internal finance controls: Escalation actions (order hold, agency referral) follow existing approval authority matrix.

**Approval Flows:**

- Order hold and collection agency referral require AR manager approval in the workbench before the action is communicated to S/4HANA or the collection agency.

---

## Risks, Assumptions, and Dependencies

### Risks

- **S/4HANA API availability**: All three components depend on S/4HANA Cloud Public APIs; an outage disrupts the full solution. Mitigation: graceful degradation to cached read-only mode.
- **AI output quality**: Email drafts and recommendations degrade if dunning history or credit data is incomplete. Mitigation: agent surfaces data completeness warnings to the user.
- **Escalation rule misconfiguration**: Poorly tuned reminder thresholds risk over-escalating valuable customer relationships. Mitigation: configurable thresholds with manager-controlled defaults; dry-run mode for n8n workflow.
- **Email deliverability**: Automated reminders may land in spam if not properly configured with SPF/DKIM. Mitigation: use SAP Integration Suite or a governed SMTP relay.

### Assumptions (Validate These)

- S/4HANA Cloud Public Edition APIs (`CADUNNING_0001`, `CE_PAYMENTADVICE_0001`, `CE_API_DISPUTE_MANAGE_0001`, `API_CRDTMBUSINESSPARTNER`) are accessible from BTP via service bindings or destination configuration.
- The Dunning History MCP server (`sap.mcpbuilder:apiResource:contract_accounting_dunning_history_mcp_demo:v1`) is provisioned and accessible from the BTP sub-account.
- SAP Generative AI Hub (GPT-4o) is available and licensed in the target BTP sub-account.
- An email relay (SMTP or SAP Integration Suite mail adapter) is available for outbound reminder delivery.

### Dependencies

- SAP S/4HANA Cloud Public Edition (source system for all financial data)
- SAP BTP (Cloud Foundry or Kyma runtime for deployment)
- SAP Generative AI Hub (LLM access for the AI agent)
- Dunning History MCP Server (pre-provisioned in landscape)
- n8n instance on BTP or managed n8n (workflow runtime)

---

## Open Questions

- What is the configurable escalation ladder (days overdue thresholds and step types) — to be defined with AR operations before n8n workflow build.
- Which email relay will be used for outbound reminder delivery (SMTP, SAP Integration Suite)?
- Should the workbench support multiple company codes, or is a single company code sufficient for the initial release?
- Is the Dunning History MCP server in production-ready state, or is it a demo instance that requires promotion?
