# Error And Failure States

Every failure should be visible, recoverable, and audited. The user-facing message should explain what happened and what action is available without exposing provider secrets or internal stack traces.

## Upload And Extraction

| Scenario | System state | User action | Audit event |
| --- | --- | --- | --- |
| Unsupported file type | File saved, extraction skipped | Replace file or keep as media | `file.unsupported_type` |
| File too large | Upload rejected | Compress or upload smaller file | `file.rejected_size` |
| OCR/parser fails | File saved, source signal failed | Enter quick update manually | `extraction.failed` |
| Low confidence extraction | Source state `Detected` | Confirm/edit fields | `extraction.low_confidence` |
| Conflicting extracted values | Source state `Detected` | Choose correct value | `extraction.conflict` |
| Stale source | Source state `Stale` | Run adaptive check-in | `source.stale` |

## AI Recommendation

| Scenario | System behavior |
| --- | --- |
| Not enough current data | Show monitor-only recommendation or ask for update |
| Unconfirmed critical signal | Recommendation cannot be `High` confidence |
| AI output schema invalid | Reject output, retry once, then show error |
| Brand rule conflict | Block generated asset and explain conflict |
| Unsafe or unsupported claim | Remove claim and request human review |

## Campaign Generation

| Scenario | System behavior |
| --- | --- |
| Missing offer | Ask user to select or create offer |
| Missing audience | Allow draft, block send/publish |
| Missing image rights | Use approved template placeholder or request asset |
| Template unavailable | Fall back to approved default template |
| Regeneration fails | Keep previous version and allow retry |

## Approval

| Scenario | System behavior |
| --- | --- |
| Approver unavailable | Escalate according to hotel policy |
| Changes requested | Campaign returns to editable review state |
| Partial approval | Only approved assets can proceed |
| Direct publish attempted by department head | Block and offer send-for-approval |

## Email

| Scenario | System behavior |
| --- | --- |
| Provider disconnected | Block send and prompt reconnect |
| Consent check fails | Block send and show affected audience count |
| Suppression sync fails | Block send until retry succeeds |
| Test send fails | Keep campaign draft and show provider error category |
| Bounce/spam complaint import | Add to results and suppress affected contact |

## WordPress

| Scenario | System behavior |
| --- | --- |
| Auth/token expired | Block publish and prompt reconnect |
| Page/block not found | Save draft and request destination selection |
| Publish fails | Keep campaign scheduled state, create failed publish job |
| Live preview mismatch | Block publish until reviewed |
| Rollback needed | Restore previous block revision and audit action |

## Social

| Scenario | System behavior |
| --- | --- |
| API unavailable | Offer export/download fallback |
| Token expired | Prompt reconnect |
| Asset rejected by platform | Show platform category and request edit |
| Rate limit | Queue retry with backoff |

## Results

| Scenario | System behavior |
| --- | --- |
| Metrics unavailable | Show unavailable source state |
| Attribution uncertain | Mark result as assisted or manual reconciliation |
| Provider import delayed | Show last imported timestamp |
| Conflicting revenue figures | Require confirmation before learning loop uses revenue |
