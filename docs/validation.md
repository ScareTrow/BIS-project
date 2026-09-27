# Validation record

Actual execution: 29–30 September 2026. These results were produced during reconstruction; the conditional Git author dates are not execution dates.

| Check | Result |
| --- | --- |
| Clean dependency installation in reconstruction checkout | Python requirements and npm ci completed |
| Backend, Python 3.13.15 / PostgreSQL 18.6 | 103 passed; 180 existing deprecation warnings |
| Frontend Jest | 13 passed in 4 suites |
| TypeScript | tsc --noEmit passed |
| Next.js production build | Passed, including admin applications Suspense boundary |
| Fresh PostgreSQL migrations | Both revisions applied to isolated live-test database |
| Edge browser smoke | Eight public/authenticated routes returned HTTP 200; signup/login and cookie persistence passed; no page errors |
| Administrator browser smoke | Login through the actual form and direct navigation to four admin pages passed; no page errors |
| Live Telegram | Bot identity, account linking, request/location, SOS, resources and notification delivery passed in the user-confirmed private test chat |
| Independent clean clone | Pending final verification after reconstruction commits are assembled |

Backend tests exercise registration, login, profile, requests, SOS, files, map, search, responses, moderation, ratings, news, notifications, ordinary/admin permissions, cookie CORS and malformed input. Separate HTTP clients are used for different users. Automated tests use deterministic geocoding and disable Telegram delivery. Databases are disposable and separate from any production data.

The browser smoke visited `/`, `/about`, `/login`, `/sign-up`, `/news`, `/profile`, `/profile/edit` and `/applications/new`. Signup and login used the browser context's HTTP client; this does not claim every form was manually exercised. A browser reproduction found a session-loading redirect race on the new-request and admin-news pages; a failing regression was added before the fix and passed afterward.

Live Telegram verification used the actual aiogram dispatcher with synthetic incoming updates and real outgoing Telegram Bot API calls. The bot returned successful delivery responses; resulting requests were checked in the isolated database. This verifies dispatcher handling and live transport, not a human-operated polling journey. Credentials and chat identifiers are kept outside Git.

## Defects reproduced and checked

- Missing frontend modules and typings blocked compilation; restored contracts are covered by API/module tests and the production build.
- The admin applications page required a Suspense boundary for `useSearchParams`; verified by production build.
- SOS failed with an unbound local `current_user`; covered by API regression and live Telegram checks.
- Private API requests redirected to HTML; tests now require JSON 401.
- Invalid coordinates and unsupported/empty uploads reached persistence; regression tests require rejection without partial records.
- Notification ownership prevented user deletion; covered by the existing administrator tests.
- Test request contexts leaked cached login identities between clients; the fixture was corrected and independent-client role flows now pass.
- PostgreSQL driver selection and bootstrap/migration compatibility blocked startup on the installed dependency versions; verified with PostgreSQL and fresh migrations.
- Telegram `/resources` was not registered; checked through the live dispatcher.

## Limits

The map returns a JSON array, not GeoJSON. Upload limits remain 50 MiB per file and 100 MiB per request; validation checks extension, size and emptiness, not antivirus scanning or full binary-content validation. The city lookup contains twenty major Kazakhstan cities. Existing hardcoded Russian strings remain alongside the restored ru/kk/en dictionaries. External Figma/Drive originals were not recovered. The retained dependency baseline and existing warnings have not been turned into a general dependency-upgrade or security-audit project.

