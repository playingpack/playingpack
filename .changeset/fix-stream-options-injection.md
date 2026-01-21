---
"playingpack": patch
---

Fix stream_options injection for non-streaming requests

- Only inject `stream_options: { include_usage: true }` when `stream: true` is explicitly set
- Preserve any existing `stream_options` the client sends while adding `include_usage`
- Fixes error: "The 'stream_options' parameter is only allowed when 'stream' is enabled"
- Updated misleading comments about OpenAI's stream default behavior
