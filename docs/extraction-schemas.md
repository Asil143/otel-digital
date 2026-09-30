# AI Extraction Schemas

All AI extraction outputs must be structured JSON, validated server-side, and stored as `source_signals`. Extracted commercial figures must remain `Detected` until a human confirms or edits them.

## Common Extraction Envelope

```json
{
  "sourceType": "file_upload",
  "businessArea": "spa",
  "sourceState": "Detected",
  "confidence": "Medium",
  "summary": "Tuesday and Wednesday spa availability appears high next week.",
  "extractedFields": {},
  "missingFields": [],
  "warnings": [],
  "requiresConfirmation": true
}
```

## Rooms Schema

```json
{
  "periodStart": "2026-10-12",
  "periodEnd": "2026-10-30",
  "occupancyPercent": 68,
  "occupancyTargetPercent": 82,
  "pickupRooms": 24,
  "adr": 118,
  "revpar": 78,
  "directBookings": 142,
  "segmentMix": {
    "leisure": 0.52,
    "corporate": 0.28,
    "ota": 0.2
  },
  "lowDemandDates": ["2026-10-14", "2026-10-15"],
  "recommendedActionType": "campaign"
}
```

Required for high-confidence Rooms recommendation:

- period,
- at least one demand signal: occupancy, pickup, RevPAR, ADR, or direct bookings,
- source date,
- comparison baseline or target.

## Spa Schema

```json
{
  "periodStart": "2026-10-14",
  "periodEnd": "2026-11-04",
  "treatmentAvailability": "high",
  "quietDays": ["Tuesday", "Wednesday"],
  "bookings": 342,
  "activeOffer": "Midweek Spa Day £79",
  "capacityNotes": "Afternoon slots available",
  "recommendedActionType": "campaign"
}
```

Required for high-confidence Spa recommendation:

- period,
- demand level or available slots,
- quiet days or dates,
- active offer or suggested offer.

## Restaurant / F&B Schema

```json
{
  "periodStart": "2026-10-06",
  "periodEnd": "2026-10-27",
  "servicePeriod": "weekday dinner",
  "covers": 824,
  "averageSpend": 32,
  "bookings": 412,
  "quietDays": ["Tuesday"],
  "activeOffer": "1961 Menu - 2 courses £20.95",
  "recommendedActionType": "campaign"
}
```

Required for high-confidence Restaurant recommendation:

- service period,
- demand level or covers/bookings,
- quiet day/date pattern,
- offer or booking CTA.

## Confidence Rules

- `High`: required fields present, source is current, values are internally consistent, and baseline exists.
- `Medium`: enough directional data exists, but one important field is approximate or missing.
- `Low`: ambiguous extraction, malformed file, conflicting values, or missing date period.

## Failure Handling

- Low-confidence extraction must show a confirmation screen with highlighted uncertain fields.
- Conflicting values must be shown side-by-side with source snippets.
- Unsupported file type must save the file but skip extraction.
- Multi-language documents should attempt extraction, mark warnings, and require confirmation.
- Malformed files must create a failed extraction event and keep the original file available.
- No extracted value may overwrite a confirmed current value without user confirmation.
