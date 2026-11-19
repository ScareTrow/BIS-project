# REST contract used by Next.js

For the new capabilities, contributions, resources, confirmations and triage endpoints see [the October REST additions](mutual-aid-implementation.md#rest-additions). The contracts below remain available for compatibility.

The authoritative implementations are `backend/website/views.py` and `auth.py`. [OpenAPI inventory](openapi.json) lists their API routes; schemas are specified for the central creation and map contracts. Other inventory entries intentionally have general response schemas.

| Operation | Request | Response |
|---|---|---|
| POST /api/auth/signup | email, firstName, password1, password2, phone, city | success and user |
| POST /api/auth/login | email, password | success and user; session cookie |
| GET /api/user/current | Session cookie | user and profile statistics |
| POST /api/applications | Multipart with description, category, location and photos | HTTP 201 with `public_id` and legacy numeric identifiers |
| POST /api/sos | Multipart with latitude, longitude and photos | HTTP 201, public SOS immediately visible; 429 for the fourth SOS in one hour |
| GET /api/map/points | Optional city, status, format | JSON array by default; GeoJSON for `format=geojson` |
| GET /api/applications/list | Optional city | JSON array of list entries |
| GET /api/applications/{id} | Request UUID or legacy numeric id | Request detail; pending visibility is restricted; phone is included only for the accepted helper or an administrator |
| POST /api/admin/applications/{id}/approve | Administrator session | Moderation result |
| GET /api/notifications | Session cookie | notifications and unread_count |
| POST /api/locations/reverse | Authenticated JSON with latitude and longitude | Address label and unchanged coordinates |
| POST /api/user/capabilities/onboarding | Session cookie | `show: true` for the first claim of the onboarding prompt |
| POST /api/responses/{id}/rating | Request author, a completed response, score 1–5, optional comment up to 1000 characters | HTTP 201 and rating ID |
| POST /api/admin/reviews/{id}/hide | Administrator session | Hide the review comment while retaining the score |

Map points carry numeric `latitude` and `longitude`. GeoJSON geometry uses
`[longitude, latitude]` as required by GeoJSON. The map omits completed and
expired requests. The list still supports a completed filter.

Ordinary requests start pending. SOS appears immediately and is reviewed afterward.
Use `media_files` once per photo. Ordinary requests accept an optional
`verification_document`, which is visible to the author and administrators.

Requests and SOS require 1–3 JPEG/PNG photos, no more than 10 MiB per photo.
The server checks extension and image content before persistence. Empty files
return 400, oversized files 413, and unsupported image content 415.

New links use the request's `public_id`. Numeric request IDs remain available
for existing links and API clients. Notifications include the request UUID
and category when the associated request exists. Other entity identifiers
remain numeric.

Errors use HTTP 400 for invalid payloads, 401 for missing authentication, 403 for insufficient permission, 404 for missing resources and 413 for oversized requests. Existing success status codes and response envelopes are preserved. CORS and cookie settings must be configured together when using a separate frontend origin.

