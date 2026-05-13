# Specification

> **Guidelines**: Read [guidelines.md](./guidelines.md) before executing ANY tasks below.

Check off items as completed.

## Solution Setup

- [ ] Create asset directories: `mkdir -p assets/collections-workbench-cap/ assets/collections-agent/ assets/n8n/`
- [ ] Invoke `setup-solution` skill to create `solution.yaml` and `asset.yaml` files for every asset
- [ ] Validate all `asset.yaml` and `solution.yaml` files exist and are well-formed

## Asset Implementation

- [ ] Execute specification/collections-workbench-cap/specification.md (all items)
- [ ] Execute specification/n8n/specification.md (all items)
- [ ] Execute specification/collections-agent/specification.md (all items)
- [ ] Cross-implementation compatibility check â verify the following interfaces align across all three assets:
  - CAP service base URL exposed by `collections-workbench-cap` matches `CAP_SERVICE_BASE_URL` used in n8n workflows
  - Agent HTTP endpoint (`/invoke`) expected by CAP `requestAiDraft` handler matches the A2A endpoint exposed by `collections-agent`
  - `CollectionOutcome`, `ReminderLog`, and `PaymentPromise` entity paths in n8n HTTP calls match CAP OData service paths
  - Auth/XSUAA roles (`CollectionsAgent`, `ARManager`) are consistent between CAP annotations and any UI role checks
  - Environment variables (`CAP_SERVICE_BASE_URL`, `PAYMENT_PORTAL_URL`, `AR_MANAGER_EMAIL`) documented in `ENV_VARS.md` at project root
  - Fix any mismatches before marking this item complete
