---
"playingpack": patch
---

Fix mock and modified responses not displaying in UI

- Mock responses now update session content so they appear in the response panel
- Point 2 modifications now clear old content before setting new content
- Added `clearResponse` method to session manager for response modifications
