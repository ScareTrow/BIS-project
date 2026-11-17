# Architecture and SOS flow

Prepared from the current code during reconstruction; this is not a recovered original diagram.

The browser uses Next.js App Router. The client calls Flask JSON endpoints through the Next.js `/api` rewrite by default; `NEXT_PUBLIC_API_URL` can select an explicit backend origin. Authentication uses Flask-Login session cookies. SQLAlchemy stores users, requests, responses, ratings, media metadata, news and notifications in PostgreSQL. Uploaded bytes live under `backend/instance/uploads`.

The Telegram bot uses aiogram FSM handlers and the same database models. Telegram identity is associated with a web user through `telegram_id`. The browser never receives the bot token.

```mermaid
flowchart LR
  Browser[Next.js browser UI] -->|JSON / multipart and cookies| Flask[Flask REST API]
  Flask --> DB[(PostgreSQL)]
  Flask --> Files[Local upload directory]
  Telegram[Telegram user] --> Bot[aiogram handlers]
  Bot --> DB
  Bot --> Files
  Flask -->|Optional notifications| TelegramAPI[Telegram Bot API]
  Bot --> TelegramAPI
```

```mermaid
flowchart TD
  Start[Authenticated user requests SOS] --> Location[Obtain coordinates]
  Location --> Valid{Valid coordinates and eligible user?}
  Valid -->|No| Error[Return actionable error]
  Valid -->|Yes| Save[Create emergency application with pending moderation]
  Save --> Review[Administrator reviews]
  Review -->|Approve| Map[Publish on map and list]
  Review -->|Reject| Notify[Notify requester]
  Map --> Respond[Volunteer responds]
  Respond --> Accept[Requester accepts response]
  Accept --> Resolve[Request resolved]
  Resolve --> Rating[Requester rates accepted or completed helper]
```

CORS currently permits the configured localhost origins with credentials. API authentication errors return JSON 401; browser HTML routes retain login redirects. The application factory accepts explicit test configuration so the same route registration is exercised in automated checks.

