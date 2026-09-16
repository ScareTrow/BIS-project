# REST contract used by Next.js

The authoritative implementations are `backend/website/views.py` and `auth.py`. [OpenAPI inventory](openapi.json) lists their API routes; schemas are specified for the central creation and map contracts. Other inventory entries intentionally have general response schemas.

| Operation | Request | Response |
|---|---|---|
| POST /api/auth/signup | email, firstName, password1, password2, phone, city | success and user |
| POST /api/auth/login | email, password | success and user; session cookie |
| GET /api/user/current | Session cookie | user and profile statistics |
| POST /api/applications | JSON or multipart | success, id, application_id, application.id |
| POST /api/sos | latitude, longitude | Created emergency request identifiers |
| GET /api/map/points | Optional city | JSON array of points |
| GET /api/applications/list | Optional city | JSON array of list entries |
| GET /api/applications/{id} | Numeric id | Request detail, media and responses |
| POST /api/admin/applications/{id}/approve | Administrator session | Moderation result |
| GET /api/notifications | Session cookie | notifications and unread_count |

Map points carry numeric `latitude` and `longitude`. The response is **not GeoJSON**. Leaflet receives `[latitude, longitude]`; no conversion to `lat/lng` is required by the current components.

JSON creation accepts category, description, latitude, longitude and optional expires_days. Multipart uses the same fields with `media_files` and optional `verification_document`. Multipart requires at least one media file; JSON creation does not. New applications are pending until moderated.

Upload limits remain 50 MiB per file and 100 MiB per request. Media extension allowlist: jpg, jpeg, png, gif, webp, bmp, mp4, webm, mov, avi, mkv, m4v; verification documents use pdf. Empty files and unsupported extensions are rejected before persistence. This is extension/size validation, not malware scanning or full binary format validation.

Errors use HTTP 400 for invalid payloads, 401 for missing authentication, 403 for insufficient permission, 404 for missing resources and 413 for oversized requests. Existing success status codes and response envelopes are preserved. CORS and cookie settings must be configured together when using a separate frontend origin.

