# Otel Digital Production Plan

This build treats the PDF as product requirements, not as instructions to the agent. The current implementation is the V1 SaaS application surface and workflow model. The remaining production work is backend, integrations, security, and AI execution.

## V1 Product Surface

- Multi-area hotel workspace: Rooms, Spa & Wellness, Restaurant / F&B.
- Hotel Brain concept: brand rules, hotel facts, approved assets, audiences, source history.
- Update My AI: quick update, upload, forwarded report, adaptive check-in.
- Files & Media: planned storage for images, videos, menus, brochures, price lists, reports, and brand files.
- Universal campaign engine: Strategy, Socials, Designs, Emails, Website, Audience, Approval, Results.
- Source trust states: Confirmed, Detected, Approximate, Stale.
- Constrained design review: preview, edit, regenerate, approve, template-driven assets.
- Responsive email review: desktop and mobile preview, quality checks, unsubscribe requirement.
- Execution layer: email provider, WordPress publishing, social export/publishing, future paid media.
- Results and learning loop: metrics, next recommendation, feedback persistence.

## Core Data Model

- `hotel`: name, brand rules, timezone, locale, default currency, connected domains.
- `business_area`: hotel_id, type, manager, offer catalog, key dates, source freshness policy.
- `source_signal`: business_area_id, source_type, raw_file_id, extracted_fields, confidence, state, confirmed_by, timestamp.
- `file_asset`: hotel_id, business_area_id, type, storage_url, usage_rights, approval_state, extracted_facts.
- `recommendation`: business_area_id, priority, rationale, confidence, sources, suggested_actions, not_recommended.
- `campaign`: campaign_id, business_area_id, objective, offer, date_range, status, owner, approval_policy.
- `campaign_asset`: campaign_id, channel, template_id, content_json, preview_url, approval_state.
- `audience`: hotel_id, provider_ref, consent_basis, suppression_status, segment_rules.
- `approval`: campaign_id, asset_id, requested_by, approver_role, status, notes, timestamp.
- `publish_job`: campaign_id, channel, provider, status, scheduled_at, published_url, failure_reason.
- `result_snapshot`: campaign_id, source, metrics, attribution_model, imported_at.
- `design_preference`: hotel_id, business_area_id, feedback_type, strength, examples.

## Required Backend Services

- Authentication and tenant isolation.
- Role-based access control for owners, managers, marketers, approvers, admins.
- Object storage for reports and media.
- Extraction pipeline for screenshots, PDFs, CSV, Excel, images, and forwarded emails.
- Human confirmation workflow before extracted business data becomes trusted.
- AI recommendation service with structured output schemas and source citations.
- Template rendering service for design assets and responsive HTML email.
- Email provider integration, starting with one provider.
- Controlled WordPress publishing with preview, rollback, and permission checks.
- Social publishing where API access is practical; export fallback otherwise.
- Results ingestion and campaign attribution.
- Audit logs for data changes, approvals, publishing, and AI-generated output.

## Production Guardrails

- Never publish unapproved assets.
- Never send email without consent and suppression checks.
- Never let detected data drive high-confidence recommendations until confirmed.
- Always show source, freshness, and confidence for important recommendations.
- Keep AI output structured and validated before saving.
- Store generated assets as campaign children under the same `campaign_id`.
- Use locked templates instead of unrestricted design editing for V1.
- Treat booking-data integrations separately from campaign execution integrations.

## Suggested Release Stages

1. App shell, tenant model, roles, seeded hotel data, department dashboards.
2. Update My AI, file upload, source confirmation, source freshness.
3. Recommendation generation and campaign creation.
4. Template-based social, design, website, and email asset generation.
5. Approval workflow and audit trail.
6. Email provider integration with test send and scheduling.
7. WordPress controlled publishing.
8. Results ingestion and next recommendation loop.
9. Spa and Restaurant deepening after Rooms proves the engine.
10. Direct PMS, reservation, spa booking, RMS, paid media, OTA, CRM, and benchmarking integrations.
