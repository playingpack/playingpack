---
"playingpack": patch
---

Honor `stream` parameter for non-streaming responses. Previously, PlayingPack always returned SSE streaming responses even when clients requested `stream: false`. This broke LangChain and other clients that expect JSON for non-streaming requests. Now the proxy transparently passes the stream parameter to upstream and returns responses in the appropriate format.
