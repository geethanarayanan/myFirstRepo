# Specification: collections-agent

> **Guidelines**: Read [guidelines.md](../guidelines.md) and [guidelines-agent.md](../guidelines-agent.md) before executing ANY tasks below. Follow all constraints described there throughout execution.

## Basic Setup

- [ ] Read `product-requirements-document.md` and `intent.md` for full business context
- [ ] Bootstrap agent code in `assets/collections-agent/` using skill `sap-agent-bootstrap` (invoke from inside `assets/collections-agent/`, use copy commands — do NOT create files manually)
- [ ] Install dependencies, validate the agent starts and responds at `/.well-known/agent.json`

## Agent Identity & System Prompt

- [ ] Set agent name: `Collections AI Agent`
- [ ] Set agent description: `Autonomous collections assistant that analyses customer payment history and account context from S/4HANA to draft personalised collection emails and recommend escalation actions (order hold, dispute escalation, collection agency referral).`
- [ ] Write system prompt in `@prompt_section` covering:
  - Role: senior collections specialist with access to S/4HANA dunning, credit, and dispute data
  - Always retrieve dunning history (via MCP) and credit/dispute status before drafting any email or recommendation
  - Email drafts must reflect customer payment behaviour: long-standing good payers get a softer tone; chronic late payers get a firmer tone
  - Escalation recommendations must cite specific data points (e.g. days overdue, total outstanding, dunning level, dispute status)
  - Always set `top` to a maximum of 100 on every MCP tool call that accepts it — inform the user when this limit is applied
  - Never hallucinate customer data — only use data returned by tools
  - If tool data is incomplete, surface a warning and state what data is missing before proceeding

## MCP Tool Wiring (Dunning History — existing MCP server)

- [ ] Register the existing Dunning History MCP server in the agent's tool loading:
  - MCP server ORD ID: `sap.mcpbuilder:apiResource:contract_accounting_dunning_history_mcp_demo:v1`
  - Tools available: `list_dunning_runs`, `list_dunned_items`, `get_dunning_run_by_key`, `get_dunned_item_by_key`, `get_metadata_ca_dunning`
  - Schema files: `specification/collections-agent/mcp-specs/mcp-spec-dunning-history-list_dunning_runs.json`, `mcp-spec-dunning-history-list_dunned_items.json`
- [ ] Wire MCP tool loading using `get_mcp_tools()` from `mcp_tools.py` — never hard-code tool names; resolve by capability at runtime
- [ ] Add dunning MCP server dependency to `assets/collections-agent/asset.yaml`:
  ```yaml
  requires:
    - name: contract-accounting-dunning-history-mcp
      kind: mcp-server
      ordId: sap.mcpbuilder:apiResource:contract_accounting_dunning_history_mcp_demo:v1
  ```

## API Specs → MCP Translation (Credit Management & Dispute)

- [ ] Verify the following API spec files exist in `specification/collections-agent/api-specs/`:
  - `credit-management-master-data.edmx` (ORD ID: `sap.s4:apiResource:API_CRDTMBUSINESSPARTNER:v1`)
  - `dispute.edmx` (ORD ID: `sap.s4:apiResource:CE_API_DISPUTE_MANAGE_0001:v1`)
  - `payment-advice.edmx` (ORD ID: `sap.s4:apiResource:CE_PAYMENTADVICE_0001:v1`)
- [ ] Invoke `mcp-translation-file` skill to generate MCP translation files for all three API specs
- [ ] Invoke `setup-solution` skill to create MCP server assets for the generated translation files
- [ ] Add the new MCP server dependencies to `assets/collections-agent/asset.yaml` under `requires`
- [ ] Invoke `mcp-mock-config` skill to generate `mcp-mock.json` (run AFTER both `mcp-translation-file` and `setup-solution` complete)

## Core Agent Tools

Implement the following tools in `assets/collections-agent/app/tools/`:

### Tool: get_customer_dunning_profile
- [ ] Create `assets/collections-agent/app/tools/dunning_tool.py`
- [ ] Tool accepts: `business_partner` (str), `contract_account` (str, optional), `top` (int, default 20)
- [ ] Calls `list_dunning_runs` MCP tool filtered by BusinessPartner; also calls `list_dunned_items` to get item-level detail
- [ ] Returns: dunning level, dunning balance, collection step, last dunning date, next dunning date, submitted-to-agency flag, list of dunned items with amounts and due dates
- [ ] Apply `top=100` cap; inform caller if truncated

### Tool: get_credit_status
- [ ] Create `assets/collections-agent/app/tools/credit_tool.py`
- [ ] Tool accepts: `business_partner` (str)
- [ ] Calls Credit Management Master Data MCP tool to retrieve credit segment, credit limit, credit exposure, credit risk class, credit worthiness score
- [ ] Returns: structured credit profile summary
- [ ] Apply `top=100` cap

### Tool: get_dispute_cases
- [ ] Create `assets/collections-agent/app/tools/dispute_tool.py`
- [ ] Tool accepts: `business_partner` (str), `status_filter` (str, optional, e.g. "Open")
- [ ] Calls Dispute MCP tool to retrieve open and recently closed dispute cases
- [ ] Returns: list of disputes with case ID, status, reason, amount, creation date
- [ ] Apply `top=100` cap

### Tool: draft_collection_email
- [ ] Create `assets/collections-agent/app/tools/email_draft_tool.py`
- [ ] Tool accepts: `business_partner` (str), `customer_name` (str), `overdue_amount` (float), `currency` (str), `days_overdue` (int), `dunning_profile` (dict), `credit_status` (dict), `dispute_cases` (list)
- [ ] Uses LLM (via agent reasoning) to compose a personalised email — the tool assembles context and returns a structured prompt; the agent graph's LLM node generates the draft
- [ ] Output schema: `{ "subject": str, "body": str, "tone": str, "key_context_used": list[str] }`
- [ ] Tone selection logic:
  - `friendly` — first late payment, good credit history, no prior dunning notices
  - `firm` — 2nd or 3rd dunning level, moderate risk
  - `final_warning` — 4th+ dunning level, high risk, high overdue balance
  - `dispute_sensitive` — active open disputes exist; do not pressure on disputed amounts

### Tool: recommend_escalation_action
- [ ] Create `assets/collections-agent/app/tools/escalation_tool.py`
- [ ] Tool accepts: `business_partner` (str), `days_overdue` (int), `overdue_amount` (float), `dunning_level` (str), `credit_risk_class` (str), `open_disputes` (list), `payment_history_summary` (str)
- [ ] Returns a structured recommendation:
  ```json
  {
    "recommended_action": "order_hold | dispute_escalation | collection_agency | additional_reminder | no_action",
    "rationale": "string — cites specific data points",
    "confidence": "high | medium | low",
    "supporting_data": { "days_overdue": int, "dunning_level": str, "open_dispute_count": int }
  }
  ```
- [ ] Decision rules (as agent reasoning hints, not hard-coded logic):
  - 60+ days overdue AND dunning level ≥ 3 AND no active dispute → suggest order_hold
  - 90+ days overdue AND dunning level ≥ 4 → suggest collection_agency
  - Active open dispute exists → suggest dispute_escalation first
  - < 30 days overdue, first instance → additional_reminder

## Agent Graph & Flow

- [ ] Implement `assets/collections-agent/app/agent.py` orchestration:
  - On query received: determine intent (email draft request vs. escalation recommendation vs. account overview)
  - Always call `get_customer_dunning_profile` and `get_credit_status` before any email or recommendation
  - Call `get_dispute_cases` to check for active disputes (affects both email tone and escalation recommendation)
  - For email requests: call `draft_collection_email` with all gathered context
  - For escalation requests: call `recommend_escalation_action` with all gathered context
  - Return structured output including data sources cited

## Business Step Instrumentation

- [ ] Implement milestone log statements in the agent flow (pattern: `[MILESTONE_ID].[achieved|missed]: [description]`):
  - `M1.achieved: overdue receivables loaded — {count} accounts, {total_overdue_amount} total overdue`
  - `M1.missed: failed to retrieve overdue receivables from S/4HANA — {error_detail}`
  - `M3.achieved: email draft generated — account {customer_id}, model {model_id}, tokens_used {tokens}`
  - `M3.missed: email draft generation failed — account {customer_id}, reason {error_detail}`
  - `M4.achieved: escalation recommendation produced — account {customer_id}, action {recommended_action}, confidence {confidence_score}`
  - `M4.missed: escalation recommendation not produced — account {customer_id}, reason {error_detail}`
- [ ] Add OpenTelemetry custom spans for each business step using decorator or context-manager form on non-generator functions
  - Extract all business logic from `stream()` into `_run_agent()` async helper — instrument `_run_agent()`, never `stream()`
- [ ] Verify `auto_instrument()` is called at top of `main.py` before any AI framework imports

## API Spec Quick Reference

The following APIs are available as reference for MCP translation:

| API | ORD ID | File | Key Entities |
|-----|--------|------|--------------|
| Credit Management Master Data | `sap.s4:apiResource:API_CRDTMBUSINESSPARTNER:v1` | `credit-management-master-data.edmx` | CrdtMgmtBuPa, CrdtSegment, CrdtAccount |
| Dispute (FI-AR) | `sap.s4:apiResource:CE_API_DISPUTE_MANAGE_0001:v1` | `dispute.edmx` | Dispute, DisputeItem |
| Payment Advice | `sap.s4:apiResource:CE_PAYMENTADVICE_0001:v1` | `payment-advice.edmx` | PaymentAdvice, PaymentAdviceItem |

Dunning History MCP (existing, no translation needed):
- `list_dunning_runs` — schema: `mcp-specs/mcp-spec-dunning-history-list_dunning_runs.json`
- `list_dunned_items` — schema: `mcp-specs/mcp-spec-dunning-history-list_dunned_items.json`

## Testing

- [ ] `conftest.py` only sets `IBD_TESTING=true`
- [ ] Write unit tests in `assets/collections-agent/tests/`:
  - [ ] `test_dunning_tool.py` — mock `get_mcp_tools`; test filtering by BusinessPartner, top-100 cap applied
  - [ ] `test_credit_tool.py` — mock MCP; verify credit profile fields returned
  - [ ] `test_dispute_tool.py` — mock MCP; test open dispute filtering
  - [ ] `test_email_draft_tool.py` — mock LLM; verify tone selection based on dunning level
  - [ ] `test_escalation_tool.py` — test all 5 recommendation paths with representative inputs
  - Run each test file immediately after writing it
- [ ] Write one integration test `tests/test_agent_integration.py` — mock LLM + MCP; exercise full agent flow for email draft request end-to-end
- [ ] Run `pytest` from `assets/collections-agent/` (no args)
- [ ] Verify `grep -c "^@agent_model\|^@agent_config\|^@prompt_section" assets/collections-agent/app/agent.py` returns 3
- [ ] If coverage < 70%, add targeted tests
- [ ] Run final `pytest` (no args) from `assets/collections-agent/` to generate `test_report.json`
- [ ] Verify `test_report.json` exists in `assets/collections-agent/`

## Agent Evaluation

- [ ] Invoke `sap-aeval-generate-tool-schema` skill from `assets/collections-agent/` to generate `tools.json`
- [ ] Invoke `sap-aeval-generate-testcase` skill with `tools.json` and `specification/collections-agent/specification.md`
- [ ] Review generated test cases in `aeval/testcases/` — replace placeholder values with realistic collection scenario data
