# QA protocol

Use only a disposable database and test accounts. [Postman collection](asar.postman_collection.json) uses variables; do not export credentials or cookies to Git.

1. Install dependencies from a clean checkout; run TypeScript, production build, Jest and pytest.
2. Register a requester with a password accepted by the existing policy; verify duplicate email and invalid-password errors.
3. Log in, refresh the page and confirm the profile remains available; log out and verify JSON 401 from private API routes.
4. Create a request with valid coordinates and an image; verify its pending status and file display.
5. Check invalid coordinate types/ranges, empty files, unsupported extensions and oversized requests; failed uploads must leave no request or files behind.
6. Sign in as administrator, approve the request and verify map/list visibility and correct coordinates; repeat rejection on another request.
7. Sign in as a second user, respond, accept as requester, complete the request and rate the accepted volunteer.
8. Verify notifications and mark-all-read; verify profile edits, search, news create/update/unpublish/delete and denial of admin actions to ordinary users.
9. Check the three language selections, map/list switching and CORS preflight from allowed/disallowed origins.
10. With an explicitly selected Telegram test chat, exercise /start, linking, /create, a location message, /sos, /resources and a notification. Confirm resulting rows in the isolated database.

Automated API checks replace geocoding with deterministic responses and disable Telegram sends. A separate live Telegram check is required to claim actual delivery. Passing the automated suite alone is not evidence of live Telegram operation.

Run backend tests with `python -m pytest backend/tests -o addopts='' -q`. Set `ASAR_TEST_DATABASE_URL` to a disposable database whose name ends in `_test` for PostgreSQL. The suite creates and drops tables there. Run frontend checks from `frontend`: `npm ci`, `npm run typecheck`, `npm test -- --runInBand`, `npm run build`.

