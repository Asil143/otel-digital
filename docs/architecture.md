# Architecture

Otel Digital is structured as a multi-tenant SaaS application for hotel marketing operations.

## Frontend

- React + TypeScript + Vite.
- Typed domain model in `src/types/domain.ts`.
- Seed/demo data in `src/data`.
- Service contracts in `src/services`.
- Current UI in `src/App.tsx` and `src/App.css`.

## Backend To Implement

- Auth and tenant isolation.
- PostgreSQL schema for hotels, business areas, campaigns, assets, sources, approvals, publish jobs, and results.
- Object storage for uploaded reports, screenshots, brand assets, and generated previews.
- AI pipeline for:
  - structuring Update My AI messages,
  - extracting fields from files,
  - producing recommendations,
  - generating campaign content,
  - saving design preferences.
- Integration workers for email, WordPress, social channels, and analytics imports.
- Audit log for every confirmation, approval, publish action, and AI output mutation.

## Service Boundary

The frontend should call backend endpoints rather than provider APIs directly. Email provider keys, WordPress credentials, social tokens, and AI provider keys must stay server-side.

## Quality Gates

- TypeScript build passes.
- Mobile layouts verified.
- No publishing without approval.
- No email send without consent checks.
- No high-confidence recommendation from unconfirmed extracted data.
