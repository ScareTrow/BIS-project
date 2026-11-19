# ASAR access control

| Area | Expected access | Implementation |
| --- | --- | --- |
| Request list, map and search | Guests see approved requests. Authors can see their pending requests in their own feeds. | Map/list share the visibility predicate. Completed items remain in list history. Matching uses approved active requests only. |
| Request detail and aid | Guests see approved requests. Authors and administrators can inspect pending items. | UUID resolution applies visibility in SQL before dispatch. Public details include the point rendered on the map. |
| Responses | Authors and administrators can see the response list. Helpers see their own response. | Author accepts, rejects and closes. A per-request row lock serializes concurrent response creation. |
| Request contact | An accepted helper or an administrator can see the phone for an approved request. | The detail endpoint selects the phone from the author's profile only for eligible viewers. Public profiles omit email and private contact fields. |
| Uploads | Approved image attachments are public. Verification PDFs, pending images and unpublished images are limited to author and administrator. | Flask checks the related request before forwarding to storage. |
| Notifications | Recipient only. | Notification reads and updates include the current user in the query. New request links use the request UUID. |
| Reviews | Author rates a completed response. Administrators may hide review text. | Rating is unique per request and helper. Hidden review text is excluded from the JSON profile representation. |
| Resources | Approved points and their photos appear on the public home map. Owners and administrators can inspect their eligible pending or rejected submissions. | Admins review submissions. Photo authorization is checked before signing storage URLs. Resource owners can answer availability reminders for published points. |
| Administration | Administrator role for moderation and news. Privileged user actions have additional role checks. | Flask checks role independently of navigation. |
| Telegram | Authenticated account creates the short-lived linking token. Webhook requires its configured secret. | Telegram implementation continues to use internal identifiers for its state. |

Browser mutations check the configured frontend origin. Login, registration,
and response submission have a per-process request limit. Deployments with
multiple workers require shared rate-limit state for a consistent quota.

New request routes use UUIDs. Legacy numeric request URLs and compatibility
payloads still work. UUID migration of users, responses, notifications,
resources, news and other entities is pending.
