# Mutual-aid implementation — 15 October 2026

This implementation follows the revised TSIS 1&2 and the agreed conceptual
[ER diagram](asar-er.puml). October commit timestamps are retrospective labels,
not actual preparation or test execution times; see [scope disclosure](scope-october-2026.md).

## What changed

- Existing requests now include clothing, household help, delivery, volunteering
  and social projects, alongside food, medicine, shelter and emergency help.
  SOS uses the same application table and creation endpoint with a higher priority.
- A profile can select capabilities and enable availability. Matching requires
  the same city and all capabilities required by a request; only available users
  are selected. Matching is advisory, not automatic assignment.
- Request creation accepts a city, needed-help description, capability IDs and
  quantified needs. A food request is no longer treated by the frontend as a
  registered resource point. Photos use the existing multipart upload path;
  requests without photos use JSON, as already supported by the backend.
- Accepted helpers can promise and deliver quantities. Need rows are locked
  while promises are checked on PostgreSQL. Composite foreign keys keep needs
  and responses in the same application. Decimal quantities use precision 0.001.
- The author confirms individual completed responses and can give one 1–5
  rating for the actual helper. Closing the entire request requires all quantity
  needs to be delivered and author permission. Legacy rating endpoints remain
  available for compatibility; the updated detail UI uses the response rating.
- Resource offers have their own table, form and map layer, separate from
  requests. Resource owners answer availability reminders. Unanswered expired
  reminders make information outdated. `/resources` in the bot reads resource
  offers rather than treating food/shelter applications as offers.
- Matching creates in-app notifications after approval. If Telegram is configured
  and linked, the existing transport is also used. Resource Telegram reminders
  include availability buttons; callbacks verify the linked responsible user.
- Triage evaluates active category/keyword rules when new requests are created,
  including ordinary Telegram requests. It only raises urgency and does not
  overwrite explicit user SOS or an administrator priority.
- Administration exposes active demand by city and a heatmap of aggregated
  coordinate cells. Counts are derived from approved, unresolved, non-false requests.
- Existing moderation endpoints now append a moderation audit entry. Pending
  request details and verification PDFs are restricted to author/administrator.

## Migration and operation

From the configured backend environment:

```powershell
cd D:\Python\BIS-project\backend
flask --app main:app db upgrade
flask --app main:app seed-capabilities
```

The additive revision is `20261014_mutual_aid`. It extends the PostgreSQL enum,
adds application metadata and creates ten new tables. Existing user/application
IDs and old categories are retained. The catalog is seeded idempotently.
Fresh auto-created databases and migration retries are supported by guards.
Existing databases are not modified by application startup when this revision
is missing: upgrade before serving requests. No local working database was
modified during this task.

Response uniqueness is checked by the new database constraints. If old records
contain duplicate responses for one volunteer/application pair, the migration
fails instead of deleting history. Resolve duplicates deliberately after a backup.
Automatic downgrade is intentionally unavailable because it would drop stored
contributions and reminder history.

For periodic resource freshness checks, run the following commands using the
deployment's scheduler; no scheduler or live message delivery was enabled here:

```powershell
flask --app main:app remind-resources
flask --app main:app expire-resource-confirmations
```

`remind-resources` prompts owners whose confirmation is at least seven days old,
deduplicates outstanding reminders, creates in-app messages and uses Telegram
if configured. Responses expire after 24 hours. The expiry command and resource
reads mark stale information. External delivery uses the retained background
transport; this is not a durable message queue or a delivery-receipt implementation.

## REST additions

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/capabilities` | Capability catalog |
| GET / PUT | `/api/user/capabilities` | Own availability and capabilities |
| GET | `/api/applications/matching` | Suitable active requests for current volunteer |
| GET | `/api/applications/{id}/aid` | Needs, totals, required capabilities and permitted contributions |
| PUT | `/api/responses/{id}/contributions` | Create/update own accepted contribution |
| POST | `/api/responses/{id}/complete` | Author confirms individual help |
| POST | `/api/responses/{id}/rating` | Author rates completed response, score 1–5 |
| GET / POST | `/api/resources` | List resource offers / create own offer |
| POST | `/api/resources/{id}/reminders` | Owner/admin requests availability confirmation |
| GET | `/api/resource-confirmations` | Own reminder history |
| POST | `/api/resource-confirmations/{id}/answer` | Responsible owner answers reminder |
| GET / POST | `/api/admin/triage-rules` | List/add administrator rules |
| GET | `/api/admin/community/analytics` | Regional counts and heatmap cells |

Additional application creation fields work in JSON or multipart. Multipart
`capability_ids` and `needs` are JSON strings. For example:

```json
{
  "category": "clothing",
  "description": "Нужны вещи и помощь с доставкой",
  "city": "Almaty",
  "latitude": 43.22,
  "longitude": 76.85,
  "priority": "normal",
  "needed_help": "Доставка наборов вещей",
  "capability_ids": [1],
  "needs": [{"resource_name": "Набор вещей", "unit": "набор", "quantity_needed": 10}]
}
```

Use actual catalog IDs rather than assuming ID 1 always means a car. The same
city spelling should be selected for request and volunteer profile. The map
keeps the existing latitude/longitude JSON array contract; the client fetches
resources separately and overlays them. It is not a GeoJSON migration.

## Physical compatibility with the ER

The ER is the agreed domain model, while this repository contains legacy names
and features. This change is additive; it does not claim a one-to-one physical
rename of all 21 conceptual entities.

| Conceptual ER | Retained implementation |
|---|---|
| `users` | `user`; first_name/last_name, password and admin booleans retained |
| `applications` | `application`; user_id is author_id, date is created_at |
| `cities`, `categories` | City strings and an expanded ApplicationCategory enum, not normalized tables |
| `responses` | `application_response`; responder_id is volunteer_id, pending is offered |
| `media` | `application_media`; existing file path/MIME fields retained |
| `ratings` | `rating`; existing author/helper/application pair identifies the response |
| `notifications` | `notification`; existing in-app record plus optional Telegram transport |
| `badges`, `user_badges` | Existing User.badge and reputation rules retained |
| `news_posts` | Existing `news` table and published-news UI |
| Capability, resource, need, contribution, triage and moderation entities | Dedicated additive tables using the agreed names |

Priorities retain the existing integer contract: normal 0, high 3, SOS 5.
`priority_source` identifies `user_normal`, `user_sos`, `auto` or `admin`.
Legacy moderation and resolved flags still represent request lifecycle; the
canonical single status enum from the conceptual ER is not a physical migration.
Existing account-blocking/admin features are retained, rather than discarding
old data because those fields are absent from the conceptual diagram.

## Validation and limits

Tests use isolated SQLite databases and disabled external services. Added
coverage exercises matching after approval, ownership, invalid quantities,
overpromising, shared partial delivery, resource freshness, Telegram callback
identity, triage and preservation/idempotence of the static migration.
PostgreSQL DDL and row-lock behavior still require verification in a disposable
PostgreSQL test database before production deployment. Live Telegram transport
was not exercised in this update.

The retained upload limit is 50 MiB per file / 100 MiB per request, with
extension/size checks. This task does not replace the existing upload stack with
the proposed 10 MiB/binary-inspection policy from the Figma specification.
Map coordinate privacy, complete localization of new controls, durable Telegram
delivery tracking, resource editing and rule editing remain follow-up work.
The new controls are primarily Russian; the existing language switch and category
labels in Russian/Kazakh/English are preserved.

This repository update implements the change in product direction and the five
Idea List areas, while keeping these implementation differences visible. It does
not certify every requirement in the conceptual ER as already implemented.
