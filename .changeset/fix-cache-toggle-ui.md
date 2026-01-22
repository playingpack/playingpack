---
"playingpack": patch
---

Fix cache toggle not taking effect when changed in UI

- Cache mode setting now reads from session manager instead of static startup config
- UI changes to cache mode (Off/Read/R/W) now properly affect request handling
