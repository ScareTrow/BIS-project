# UI inventory and design reference

Prepared from the implemented Next.js pages. This document does not assert a visual comparison with the inaccessible Figma source.

Original reference from TSIS 3: [ASAR Figma prototype](https://www.figma.com/make/XwYtlDOqLQT7hzT4ddQmYA/Homepage-Design-for-Asar).
Additional materials: [Google Drive folder](https://drive.google.com/drive/folders/1szJAzVO1QRMSLImK6ll155y_hYJ5bUdk).

| Area | Existing implementation |
|---|---|
| Home | Map/list switch, city filter, SOS, statistics |
| Request creation | Category, coordinates/address, description, duration, media |
| Request detail | Location, media, responses, completion and rating |
| Authentication/profile | Registration, login, profile editing, Telegram link guidance |
| Administration | Request moderation, user management, news editor |
| News/search | Public news list/detail and global search |
| Shared components | Header, footer, category badges, notifications, Leaflet helpers |

The restored library provides API types and client methods, Zustand state, all 112 literal translation keys in Russian/Kazakh/English, a major-city coordinate lookup with aliases, Leaflet icon setup and password validation. Existing hardcoded Russian UI text remains; this restoration does not claim full localization of every screen.

The local city lookup contains the major cities and regional centers, not every settlement. Existing geocoding continues to support other locations. Existing styles and layouts are retained.

