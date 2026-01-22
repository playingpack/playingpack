---
"playingpack": patch
---

Fix Stream field in UI showing "true" when request doesn't specify stream

- Session manager now correctly defaults `stream` to `false` (matching OpenAI's actual default)
- UI now accurately reflects whether streaming was requested
