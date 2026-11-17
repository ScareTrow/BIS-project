# ASAR: October scope update

ASAR is a **Mutual aid and emergency response platform**. Everyday help with
food, clothing, household tasks and deliveries, volunteering and social or
charity initiatives share the same application workflow as emergency requests.
SOS is a priority, not a separate emergency-dispatch product.

Requirements source: the revised TSIS 1&2 supplied by the team. The revised
description supersedes the emergency-only positioning of the earlier report.
The team's approved rename is `capabilities`, with `user_capabilities` and
`application_capabilities`. A person can request help and volunteer without
changing account role. Administrative privileges remain separate.

## Scope and priorities

Must: request creation and photos, map of **requests and resources**, Telegram,
volunteer response/accept/completion, moderation, notifications, quick SOS.
Should: ratings and badges, search/filtering/relevance, secure media serving.
Could: regional reporting, leaderboard and news.

The revised Idea List contains five ideas. Their implementation priority is
not specified; do not automatically label them as Could or promise they are
already implemented:

1. Matching available volunteers by capabilities.
2. Resource availability confirmations and stale-information handling.
3. Automatic triage with SOS / High / Normal priorities.
4. Several volunteers covering quantities of the same request.
5. Regional analytics and heatmaps derived from existing request data.

The [agreed conceptual ER](asar-er.puml) describes the target domain. It is not
an assertion that every physical table in this existing repository already has
the same name or every feature has shipped. Compatibility mappings and actual
implementation status must be recorded with the implementation.

## User journeys

- A resident describes a problem, selects city/category/location and optionally
  adds photos, required capabilities and quantified needs. Pending requests are
  moderated before public publication, including SOS.
- An available volunteer finds suitable requests and offers help. The author
  accepts several helpers if necessary. Each accepted helper can promise and
  deliver part of a need; finishing one response does not finish every response.
- The resource owner confirms whether a resource point is available. Missing
  confirmation makes information outdated, not definitely unavailable.
- The author confirms completion and can rate the actual helper. Administrators
  review requests, record decisions and view aggregate regional demand.

## History disclosure

This update is being prepared on **15 October 2026** with Codex assistance.
At the repository owner's request the two new commits are assigned conditional
author and committer dates within **6–14 October 2026 (UTC+5)**. Those dates
organize the retrospective scope change; they do not establish that the code
was written or tested on those days. Existing September commits are retained,
and no teammate author identities are assigned to this new work.
