# playingpack

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
