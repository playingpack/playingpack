# playingpack

## 0.3.1

### Patch Changes

- Sync version with npm registry

## 0.3.0

### Minor Changes

- 1630ab0: Improve UI and rename states for clarity
  - Action panel now always visible at bottom of UI (shows status when inactive)
  - Renamed internal states for better clarity:
    - `PRE_INTERCEPT` → `PAUSED` (request paused before LLM call)
    - `INTERCEPT` → `TOOL_CALL` (tool call detected, awaiting decision)
  - Status badges now show "PAUSED" and "TOOL CALL" labels
  - Release workflow configured to use prod environment

## 0.2.1

### Patch Changes

- 11d3d97: Honor `stream` parameter for non-streaming responses. Previously, PlayingPack always returned SSE streaming responses even when clients requested `stream: false`. This broke LangChain and other clients that expect JSON for non-streaming requests. Now the proxy transparently passes the stream parameter to upstream and returns responses in the appropriate format.

## 0.2.0

### Minor Changes

- c786da8: Initial release of PlayingPack - Chrome DevTools for AI Agents.

  Features:
  - VCR Mode: Record and replay LLM API responses deterministically
  - Real-time Dashboard: Browser-based UI for request inspection
  - Interceptor: Pause on tool calls, inspect payloads, inject mock responses
  - SSE Streaming: Full OpenAI-compatible streaming support
  - Multi-Provider: Works with OpenAI, Ollama, Azure OpenAI, LiteLLM, vLLM
  - TypeScript Config: `defineConfig` helper with full type safety
