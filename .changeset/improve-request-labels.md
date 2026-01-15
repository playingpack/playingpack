---
"playingpack": minor
---

Redesign request labeling strategy for better developer clarity

**Breaking Change:** Replaced `cacheHit: boolean` with `cacheAvailable: boolean` and `responseSource?: 'llm' | 'cache' | 'mock'`

- Separated lifecycle state from response source into distinct badges
- Updated lifecycle labels: WAITING → PAUSED, PROCESSING → CALLING, CACHED/DONE → DONE
- Added new SourceBadge component showing LLM, CACHE, or MOCK
- Completed requests now show both state (DONE) and source (LLM/CACHE/MOCK)
- Renamed `cacheHit` to `cacheAvailable` to clarify it indicates cache availability, not usage
- Added `responseSource` field to track where the response actually came from
