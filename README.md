# Otel Digital

An AI marketing operating system for hotels, built as a clickable V1 demo from the Otel Digital product handoff (Version 1.0, October 2026).

**Live demo:** https://otel-hazel.vercel.app — you start as Hannah Smith, the hotel manager, with full access. Use the user switcher at the bottom of the sidebar to see a department manager's view (e.g. Sarah Mitchell, Spa).

Everything runs in the browser and is saved to local storage. There is no backend or login yet, and every screen that simulates something says so.

## What it does

The core V1 loop from the handoff, for any hotel business area:

1. **Keep the AI current** — Update My AI (quick update, file upload, forwarded email, Strong/Normal/Quiet check-in). AI-detected figures must be confirmed or edited before they are trusted.
2. **Get a grounded recommendation** — priority, why now, what not to do, alternatives, and "Based on … Confidence …". Confidence is capped automatically when data is detected, approximate or stale.
3. **Not every signal becomes a campaign** — outcomes include Monitor only, Revenue review, OTA/distribution review and Corporate action, each with its own action plan.
4. **One campaign engine for every area** — Create campaign (pre-filled from the recommendation) → Strategy → Socials → Designs → Emails → Website → Audience → Approve & send → Results, all under one `campaign_id`.
5. **Access by person** — the hotel manager sees and approves everything; each department manager sees and edits only their own department (offers, dates, campaigns, results, files) and sends campaigns for approval. Hotel details, integrations and contact imports are hotel-manager only.
6. **Results feed learning** — results, KPIs, notifications and activity update across every screen as campaigns move; insights saved from results appear in Hotel Brain.

Also included:

- **Hotel Brain** — property facts and brand voice, a brain-health checklist of what the AI still needs, hotel-wide rules sent with every recommendation, a shared approved-asset library (department managers submit, the hotel manager approves), guest segments from real contacts, and a list of what the AI has learned that you can prune.
- **Departments** — a live "Today's focus" for each area, KPIs that update from confirmed data and show their source, and recommendations that flag when newer data has arrived.
- **Offers** — timing, overlap warnings against the hotel rules, terms and eligible channels, linked campaigns with results, and "Create campaign" from any offer.
- **Calendar** key dates, **Audience** with real CSV import/export and consent status, and 8 business areas (Rooms, Spa, Restaurant, Weddings, Hair & Beauty, Golf, Meetings, Beach Club).

## Real vs simulated

| Area | Status |
| --- | --- |
| Recommendations, confirmation gate, freshness, check-ins | Working |
| Campaign engine, approvals, statuses, timeline | Working |
| Audience CSV import/export, offers, key dates, learnings | Working |
| Live AI (recommendations, signal structuring, next steps) | Working when `server/` runs with `ANTHROPIC_API_KEY`; otherwise uses built-in demo recommendations. The live demo has no AI server. |
| Reading uploaded screenshots/PDF/Excel/CSV reports, forwarded emails | Simulated — sample fields, file contents are not read |
| Email test send + provider, WordPress publishing, social posting | Simulated — nothing is sent or published |
| Results | Modelled from each campaign's real state — audience size, consent rate, channels, offer price and days live. Projection before launch, grows daily while live. Not real booking attribution. |
| Login, secure roles, multi-hotel, database | Not built — users are a demo switcher and access is enforced in the browser only; data is per browser |

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
