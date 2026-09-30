# API Contracts

Backend endpoints should be tenant-scoped and enforce membership permissions server-side.

## Hotels

`GET /api/hotels/:hotelId`

Returns hotel account, brand rules, connected integrations, and enabled business areas.

## Department Workspace

`GET /api/hotels/:hotelId/business-areas/:areaKey`

Returns metrics, source freshness, current recommendation, active campaigns, files, and key dates.

## Update My AI

`POST /api/hotels/:hotelId/business-areas/:areaKey/signals`

Request:

```json
{
  "sourceType": "quick_update",
  "message": "Next week is quiet for facials. We have availability for spa days."
}
```

Response:

```json
{
  "id": "signal_123",
  "sourceState": "Detected",
  "confidence": "Medium",
  "summary": "Spa has quiet demand next week with available spa day slots.",
  "extractedFields": {
    "demand": "quiet",
    "period": "next week",
    "offerContext": "spa days"
  },
  "requiresConfirmation": true
}
```

## File Upload

`POST /api/hotels/:hotelId/files`

Accepts screenshot, image, PDF, Excel, CSV, video, menu, brochure, price list, brand file, or report.

The server stores the file, starts extraction when appropriate, and returns a `file_asset`.

## Confirm Extracted Signal

`POST /api/source-signals/:signalId/confirm`

Request:

```json
{
  "editedFields": {
    "bookings": 38,
    "period": "2026-10-14 to 2026-11-04"
  }
}
```

## Recommendations

`POST /api/hotels/:hotelId/business-areas/:areaKey/recommendations/generate`

Returns structured recommendation with sources, confidence, reasons, and not-recommended actions.

## Campaigns

`POST /api/hotels/:hotelId/campaigns`

Creates a campaign from a recommendation or manual brief.

`GET /api/campaigns/:campaignId`

Returns campaign, stage state, child assets, approvals, publish jobs, and result snapshots.

`PATCH /api/campaigns/:campaignId`

Updates objective, offer, date range, audience, stage, or status.

## Campaign Assets

`POST /api/campaigns/:campaignId/assets/generate`

Generates template-based social, design, email, and website assets.

`PATCH /api/campaign-assets/:assetId`

Allows structured edits only: image, headline, CTA, offer text, crop, selected template, and channel copy.

## Email

`POST /api/campaigns/:campaignId/email/render`

Returns responsive HTML plus desktop/mobile preview metadata.

`POST /api/campaigns/:campaignId/email/test-send`

Sends a test email through the connected provider.

## Approvals

`POST /api/campaigns/:campaignId/approvals`

Requests approval for campaign or individual assets.

`POST /api/approvals/:approvalId/decision`

Approves or requests changes. Writes an audit event.

## Publish

`POST /api/campaigns/:campaignId/publish-jobs`

Creates email, WordPress, social, or paid-media publish jobs. The server must reject jobs without required approvals and consent checks.

## Results

`GET /api/campaigns/:campaignId/results`

Returns email, website, booking/report, and manually reconciled results with attribution model.

`POST /api/campaigns/:campaignId/results/import`

Imports provider metrics or manager-entered outcomes.
