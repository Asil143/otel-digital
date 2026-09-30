# October 4 Demo Delivery Plan

Current date: 2026-09-29.
Demo date: 2026-10-04.

The goal is a production-grade SaaS demo that convincingly shows the Otel Digital V1 operating model end to end. Full live PMS, spa, restaurant, WordPress, social, and email integrations should not be promised as complete unless implemented behind secure backend services.

## Demo-Critical Scope

The demo must show:

- Hotel dashboard and business-area switching.
- Update My AI with structured signal confirmation.
- Source, freshness, and confidence visibility.
- AI recommendation with why-now reasoning.
- Universal campaign engine.
- Design/social/email/website asset workflow.
- Responsive email desktop/mobile preview.
- Audience consent and suppression gate.
- Approval workflow.
- Publishing/execution layer status.
- Results and learning loop.
- Working sidebar navigation and route persistence.
- Responsive layout on laptop and mobile viewport.

## Must Not Break

- Sidebar route switching.
- Department switching.
- Update My AI text editing and confirmation.
- Campaign stage switching.
- Email desktop/mobile preview.
- Audience checkbox state.
- Activity feed.
- Direct URLs such as `/campaigns`, `/files`, `/results`.

## Build Priorities

### September 29

- Complete clickable SaaS shell.
- Add route navigation and persistence.
- Add companion engineering specs.
- Add interactive dashboard actions.

### September 30

- Add realistic file upload/extraction demo flow.
- Add confirmation modal/state for extracted fields.
- Add richer campaign creation flow.
- Add stronger mobile polish.

### October 1

- Add demo data layer and mock API adapter.
- Add loading, empty, error, stale, and unavailable states.
- Add permission-aware UI states.
- Add publish simulation with success/failure states.

### October 2

- Add results detail view.
- Add brand/template library view.
- Add QA pass for responsiveness and accessibility.
- Add demo script.

### October 3

- Freeze demo scope.
- Fix bugs only.
- Polish copy, spacing, and interaction details.
- Record backup walkthrough.

### October 4

- Demo day.
- Use seeded data.
- Avoid live external dependencies unless tested.

## Production Reality

For the October 4 demo, the safest promise is:

> This is the production-grade V1 product experience and architecture foundation, with mocked provider execution where live integrations are not yet connected.

Do not promise:

- direct PMS APIs,
- live paid media execution,
- full social API publishing,
- automated multi-property benchmarking,
- production email sends from real guest data,
- live WordPress publishing,

unless those are implemented, secured, tested, and recoverable.
