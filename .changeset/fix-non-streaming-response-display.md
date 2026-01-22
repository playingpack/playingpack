---
"playingpack": patch
---

Fix non-streaming responses not displaying in UI

- Non-streaming responses (`stream: false`) are now parsed as JSON instead of SSE
- Content, tool calls, finish reason, and usage are properly extracted from JSON responses
- Both streaming and non-streaming responses now display correctly in the UI
