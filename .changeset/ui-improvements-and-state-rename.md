---
"playingpack": minor
---

Improve UI and rename states for clarity

- Action panel now always visible at bottom of UI (shows status when inactive)
- Renamed internal states for better clarity:
  - `PRE_INTERCEPT` → `PAUSED` (request paused before LLM call)
  - `INTERCEPT` → `TOOL_CALL` (tool call detected, awaiting decision)
- Status badges now show "PAUSED" and "TOOL CALL" labels
- Release workflow configured to use prod environment
