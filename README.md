# Otel Digital

An AI marketing operating system for hotels, built as a clickable V1 demo from the Otel Digital product handoff (Version 1.0, October 2026).

**Live demo:** https://otel-hazel.vercel.app — start on **Departments**, and switch **Role** to *Hotel manager* in the top bar to use approvals.

Everything runs in the browser and is saved to local storage. There is no backend or login yet, and every screen that simulates something says so.

## What it does

The core V1 loop from the handoff, for any hotel business area:

1. **Keep the AI current** — Update My AI (quick update, file upload, forwarded email, Strong/Normal/Quiet check-in). AI-detected figures must be confirmed or edited before they are trusted.
2. **Get a grounded recommendation** — priority, why now, what not to do, alternatives, and "Based on … Confidence …". Confidence is capped automatically when data is detected, approximate or stale.
3. **Not every signal becomes a campaign** — outcomes include Monitor only, Revenue review, OTA/distribution review and Corporate action, each with its own action plan.
4. **One campaign engine for every area** — Create campaign (pre-filled from the recommendation) → Strategy → Socials → Designs → Emails → Website → Audience → Approve & send → Results, all under one `campaign_id`.
5. **Approve by role** — department managers prepare and send for approval; only the hotel manager approves, schedules or publishes.
6. **Results feed learning** — insights saved from results appear in Hotel Brain.

Also included: Hotel Brain (property facts, brand, assets, audiences, guardrails), Offers and Calendar (key dates) that feed recommendations, Audience with real CSV import/export and consent status, and 8 business areas (Rooms, Spa, Restaurant, Weddings, Hair & Beauty, Golf, Meetings, Beach Club).

## Real vs simulated

| Area | Status |
| --- | --- |
| Recommendations, confirmation gate, freshness, check-ins | Working |
| Campaign engine, approvals, statuses, timeline | Working |
| Audience CSV import/export, offers, key dates, learnings | Working |
| Live AI (recommendations, signal structuring, next steps) | Working when `server/` runs with `ANTHROPIC_API_KEY`; otherwise uses built-in demo recommendations. The live demo has no AI server. |
| Reading uploaded screenshots/PDF/Excel/CSV reports, forwarded emails | Simulated — sample fields, file contents are not read |
| Email test send + provider, WordPress publishing, social posting | Simulated — nothing is sent or published |
| Results and attribution | Demo figures |
| Login, secure roles, multi-hotel, database | Not built — role is a dropdown, data is per browser |

## Run locally

```bash
npm install
npm run dev              # app on http://localhost:5173
npm run server           # optional AI server on :8787 (proxied as /api)
```

To enable live AI: `ANTHROPIC_API_KEY=your-key npm run server`. Keys stay on the server and are never read by the browser.

```bash
npm run build   # typecheck + production build
npm run lint
```

## Project structure

- `src/pages/` — route pages (`DepartmentDashboard`, `WorkspacePage`, `workspaces/` for Offers, Calendar, Campaigns)
- `src/components/campaign/` — campaign engine, create form, outcome panel, and one file per stage in `stages/`
- `src/components/dashboard/` — department switcher, hero, recommendation, Update My AI
- `src/services/` — campaign lifecycle, permissions, AI client with fallbacks
- `src/lib/freshness.ts` — source freshness and confidence capping
- `src/data/` — seeded departments, offers, key dates, contacts
- `server/index.mjs` — minimal AI proxy to the Claude API
- `docs/` — production plan, schema draft, API and integration contracts, permissions matrix, error states

## Next for production

Backend and database (`docs/schema.sql`), authentication with server-enforced roles (`docs/permissions-matrix.md`), real file extraction, one email provider (Brevo or Mailchimp), controlled WordPress publishing, PMS report ingestion for Rooms, and real results attribution.
