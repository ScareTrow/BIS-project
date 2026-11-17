# Reports and observed implementation

Sources: “TSIS 3 - Weekly Plan & Fact Report (1).pdf” and “TSIS 4 - Team Competency-Matrix (1).pdf”, supplied by the repository owner. TSIS 3 describes 14–18 September 2026; the original Git history is from September–December 2025.

| Report statement | Observed source snapshot / reconstruction |
|---|---|
| Figma prototype completed | PDF contains a Figma reference; original design could not be inspected. No completion claim added. |
| Activity and ER diagrams completed | Original diagram files absent from tracked source. New diagrams reconstructed from code and marked accordingly. |
| Flask/Next.js CORS blocked | CORS already enabled in the supplied code. Existing working behavior retained and checked. |
| latitude/longitude vs lat/lng mismatch | Current API and components use latitude/longitude consistently. No artificial mismatch introduced. |
| GeoJSON map endpoint | Actual response is a JSON array, not GeoJSON. Documented accurately. |
| Files above 10 MB not validated | Source already has 50 MiB/file and 100 MiB/request limits. Reconstruction retains these limits and adds empty-file/extension rejection. |
| Frontend implementation in progress | Pages exist, but six imported library modules were absent and excluded by the global lib/ ignore rule. Restored during reconstruction. |
| QA suite and Postman prepared | Tests exist in source; original Postman collection absent. New collection prepared from actual routes. |
| Mentoring and coordination activities | Treated as planned activities, not verified meetings or work performed. |

The new commit author assignments follow report roles. They do not establish historical authorship. Original PDFs are not edited. Codex assistance in the new code and documents is disclosed in the root reconstruction document.

