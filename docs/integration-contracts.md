# Integration Contracts

Execution integrations are separate from business-data integrations. V1 should ship with fallback data capture even when direct booking-system APIs are unavailable.

## Shared Integration Requirements

- OAuth or API credentials are stored server-side only.
- Token refresh and provider retry happen in backend workers.
- Provider errors are normalized into user-safe categories.
- Every publish action creates a `publish_job`.
- Every provider callback/webhook creates an audit event.
- Disconnecting an integration must not delete campaign history.

## Email Provider

V1 target: Brevo or Mailchimp.

Required capabilities:

- import or reference audience segment,
- sync suppression list,
- render responsive HTML,
- send test email,
- schedule/send campaign,
- import opens, clicks, bounces, unsubscribes, spam complaints.

Blocking gates:

- campaign approved,
- sender configured,
- unsubscribe footer present,
- audience consent valid,
- suppression sync successful,
- test send completed when hotel policy requires it.

## WordPress

V1 target: controlled publishing to approved blocks/pages.

Required capabilities:

- connect site,
- list approved placement targets,
- preview generated block,
- publish/update controlled block,
- store previous revision,
- rollback to previous revision.

Blocking gates:

- asset approved,
- placement selected,
- preview generated,
- user has publish permission.

## Social Media

V1 target: publish where practical, export fallback otherwise.

Required capabilities:

- generate platform-specific copy,
- generate/export approved creative,
- schedule/publish when connected platform allows,
- store post URL or export timestamp,
- import basic engagement where available.

Fallback:

- downloadable asset pack,
- copy-to-clipboard captions,
- manual status tracking.

## Rooms Data

V1 target: PMS report ingestion, not direct PMS API dependency.

Input types:

- CSV,
- Excel,
- PDF,
- screenshot,
- forwarded pickup report email.

Later:

- direct PMS APIs,
- RMS partner,
- OTA connections.

## Spa Data

V1 target: diary screenshot/report upload, quick update, adaptive check-in.

Later:

- spa booking API,
- treatment-level inventory,
- therapist availability.

## Restaurant Data

V1 target: reservation report upload or quick trading update by service period.

Later:

- reservation API,
- POS integration,
- event/local demand feeds.

## Webhooks

The backend should accept webhooks for:

- email delivered/opened/clicked/bounced/unsubscribed,
- publish job status,
- provider token revoked,
- WordPress publish/update failure,
- future social post status.

Webhook handling must be idempotent by provider event id.
