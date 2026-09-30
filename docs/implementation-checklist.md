# Implementation Checklist

## Frontend

- [x] App scaffold.
- [x] Production-style dashboard surface.
- [x] Department switching.
- [x] Campaign engine surface.
- [x] Responsive email preview surface.
- [x] Trust, approval, execution, and results panels.
- [x] Domain types and service contracts.
- [ ] Split `App.tsx` into route-level pages and reusable components.
- [ ] Add router.
- [ ] Add forms with validation.
- [ ] Add loading, empty, error, and permission states.
- [ ] Add accessibility tests.
- [ ] Add visual regression checks.

## Backend

- [ ] Choose backend runtime and hosting.
- [ ] Create database migrations from `docs/schema.sql`.
- [ ] Add auth provider and tenant middleware.
- [ ] Implement hotel/business-area endpoints.
- [ ] Implement file upload and storage.
- [ ] Implement extraction jobs.
- [ ] Implement AI recommendation generation.
- [ ] Implement campaign persistence.
- [ ] Implement approval workflow.
- [ ] Implement audit events.
- [ ] Implement email provider integration.
- [ ] Implement WordPress controlled publishing.
- [ ] Implement result ingestion.

## Integrations

- [ ] Email provider: choose Brevo or Mailchimp first.
- [ ] WordPress: define allowed blocks and rollback behavior.
- [ ] Social: decide API publishing vs export fallback.
- [ ] PMS/report ingestion: Rooms first.
- [ ] Consent: define import rules, suppression sync, unsubscribe handling.

## Production

- [ ] Environment separation.
- [ ] Secrets management.
- [ ] Rate limits.
- [ ] Background worker queue.
- [ ] Observability.
- [ ] Backup and recovery.
- [ ] Security review.
- [ ] Legal/compliance review for email and audience data.
