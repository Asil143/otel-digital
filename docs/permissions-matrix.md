# Permissions Matrix

Roles are tenant-scoped through `hotel_memberships`. Department managers also need business-area scope.

## Roles

- `Hotel manager`: full hotel access. Can manage users, integrations, templates, approvals, publishing, and hotel-wide settings.
- `Department manager`: department-level access. Can update department data, upload files, review AI recommendations, edit/request campaigns for their department, and send for hotel manager approval.
- `Admin`: internal Otel Digital operator. Can support configuration and troubleshoot, but production access should be audited.

## Capability Matrix

| Capability | Hotel manager | Department manager | Admin |
| --- | --- | --- | --- |
| View hotel workspace | Yes | Assigned departments only | Support-scoped |
| Manage users | Yes | No | Support-scoped |
| Manage integrations | Yes | No | Support-scoped |
| Update My AI | Yes | Assigned departments only | Support-scoped |
| Upload files/media | Yes | Assigned departments only | Support-scoped |
| Confirm extracted business data | Yes | Assigned departments only | Support-scoped |
| Generate recommendation | Yes | Assigned departments only | Support-scoped |
| Create campaign | Yes | Request only for assigned departments | Support-scoped |
| Edit campaign content | Yes | Assigned department draft/review | Support-scoped |
| Approve campaign | Yes | No | Support-scoped |
| Publish campaign | Yes | No | Support-scoped |
| View results | Yes | Assigned departments only | Support-scoped |
| Edit brand templates | Yes | No | Support-scoped |
| Delete assets/campaigns | Yes | No | Support-scoped |

## Approval Rules

- Department managers can request approval but cannot publish directly in V1.
- Publishing requires all required campaign assets to be approved.
- Website publishing requires Hotel manager approval.
- Email sending requires approval plus consent/suppression checks.
- Paid media is deferred and cannot publish in V1.
- Admin support actions must create audit events.

## Server-Side Enforcement

The backend must never trust frontend role checks. Every mutation endpoint must verify:

- user belongs to the hotel,
- role and department scope allow the action,
- entity belongs to the same hotel,
- required approval state is present,
- required consent or source confirmation gates pass.
